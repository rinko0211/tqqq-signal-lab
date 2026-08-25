import { STRATEGIES, runBacktest, type Bar, type Metrics } from "./engine.ts";
import { SCREENING, makeCrossTickerDataset, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";

export const PHASE1_COMMON_START = "2016-08-22";
const PERFORMANCE_TICKERS: CrossTicker[] = ["TQQQ", "QLD", "UPRO", "SSO", "TECL", "ROM"];

export type Phase1Result = {
  ticker: CrossTicker;
  underlying: string;
  leverage: "2x daily" | "3x daily";
  researchPhase: ScreeningRow["researchPhase"];
  operationalQuality: number;
  commonStart: string;
  commonEnd: string;
  days: number;
  metrics: Metrics;
  actionDaysProxyPerYear: number;
  actionCapPassed: boolean;
  operationalGatePassed: boolean;
  performanceSanityPassed: boolean;
  phase1Decision: "ADVANCE TO PHASE 2" | "CONDITIONAL" | "QUEUE";
  reason: string;
};

export type Phase1Bundle = {
  schemaVersion: 1;
  phase: "PHASE_1_UNDERLYING_LEVERAGE_SCREEN";
  generatedAt: string;
  commonPeriod: { start: string; end: string | null };
  policy: string;
  results: Phase1Result[];
  cleanLeveragePairs: { underlying: string; twoX: CrossTicker; threeX: CrossTicker }[];
  researchQueue: { ticker: CrossTicker; reason: string }[];
  phase2Candidates: CrossTicker[];
  limitations: string[];
};

type Payload = { source?: string; retrievedAt?: string; crossSeries?: Record<string, Bar[]> };

export function phase1ScreeningBundle(payload: Payload): Phase1Bundle {
  const rows = PERFORMANCE_TICKERS.map((ticker) => SCREENING.find((x) => x.ticker === ticker)!).filter(Boolean);
  const results = rows.flatMap((row) => {
    const ds = makeCrossTickerDataset(payload, row, PHASE1_COMMON_START);
    if (!ds) return [];
    const metrics = runBacktest(ds, STRATEGIES.defensive).metrics;
    // For a single-risk-ticker + Cash strategy, ordersPerYear is a conservative
    // Phase-1 proxy for user Action Days. Phase 4 must count unique action dates
    // separately when ticker-to-ticker switches can create two broker orders.
    const actionDaysProxyPerYear = metrics.ordersPerYear;
    const actionCapPassed = actionDaysProxyPerYear <= 40;
    const operationalGatePassed = row.operationalQuality >= 80 && actionCapPassed;
    const performanceSanityPassed = metrics.cagr > 0 && metrics.calmar > 0;
    let phase1Decision: Phase1Result["phase1Decision"] = "CONDITIONAL";
    let reason = "Phase 2でOOS/WF/Stressを追加確認";
    if (row.researchPhase === "CORE" && operationalGatePassed && performanceSanityPassed) {
      phase1Decision = "ADVANCE TO PHASE 2";
      reason = "事前登録Core、運用適格性、年40 Action Days上限、共通期間Sanity Checkを通過";
    } else if (!operationalGatePassed) {
      phase1Decision = "CONDITIONAL";
      reason = `Operational Quality ${row.operationalQuality}/100 またはAction Days制約がCore Gate未達`;
    } else if (!performanceSanityPassed) {
      phase1Decision = "QUEUE";
      reason = "共通期間の共通戦略で正のCAGR/Calmarを確認できず、Phase 2優先度を下げる";
    }
    return [{
      ticker: row.ticker,
      underlying: row.underlying,
      leverage: row.leverage,
      researchPhase: row.researchPhase,
      operationalQuality: row.operationalQuality,
      commonStart: ds.days[0].date,
      commonEnd: ds.days.at(-1)!.date,
      days: ds.days.length,
      metrics,
      actionDaysProxyPerYear,
      actionCapPassed,
      operationalGatePassed,
      performanceSanityPassed,
      phase1Decision,
      reason,
    }];
  });

  const phase2Candidates = results
    .filter((x) => x.phase1Decision === "ADVANCE TO PHASE 2")
    .map((x) => x.ticker);
  const end = results.length ? results.map((x) => x.commonEnd).sort().at(0)! : null;

  return {
    schemaVersion: 1,
    phase: "PHASE_1_UNDERLYING_LEVERAGE_SCREEN",
    generatedAt: new Date().toISOString(),
    commonPeriod: { start: PHASE1_COMMON_START, end },
    policy: "Phase 1 is a bounded screen only: actual ETF OHLC, one frozen Common VS13 framework, one common period, no Native tuning, no parameter search, no new Forward enrollment. OOS/WF/cost-delay stress belongs to Phase 2.",
    results,
    cleanLeveragePairs: [
      { underlying: "Nasdaq-100", twoX: "QLD", threeX: "TQQQ" },
      { underlying: "S&P 500", twoX: "SSO", threeX: "UPRO" },
    ],
    researchQueue: SCREENING.filter((x) => x.researchPhase === "QUEUE").map((x) => ({ ticker: x.ticker, reason: x.reason })),
    phase2Candidates,
    limitations: [
      "Phase 1 performance is in-sample/common-period diagnostic evidence, not promotion evidence.",
      "Action Days is approximated by ordersPerYear only because each Phase-1 strategy holds one risk ticker + Cash. Multi-ticker Phase 4 must count unique user intervention dates separately.",
      "Price returns are used rather than dividend-reinvested total returns.",
      "QLD/TQQQ and SSO/UPRO are the clean leverage comparisons; semiconductor USD/SOXL is not because the tracked indices differ.",
      "Technology ROM/TECL remains conditional because operational liquidity is weaker and exact product/index comparability must not be assumed from historical return alone.",
    ],
  };
}
