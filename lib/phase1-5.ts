import { metricSet, runBacktest, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";

export type Phase15Family = "VS13_FIXED" | "SIMPLE_200DMA" | "VS13_VOL30" | "VS13_LEVERAGE_SCALED_STOP";
const CORE_TICKERS: CrossTicker[] = ["TQQQ", "QLD", "UPRO", "SSO"];

export type Phase15Metrics = Pick<Metrics,
  "cagr" | "totalReturn" | "annualizedVolatility" | "sharpe" | "sortino" |
  "maxDd" | "calmar" | "ulcerIndex" | "exposure" | "timeInCash"
> & { actionDaysPerYear: number };

export type Phase15Row = {
  ticker: CrossTicker;
  underlying: string;
  leverage: "2x daily" | "3x daily";
  family: Phase15Family;
  metrics: Phase15Metrics;
  actionCapPassed: boolean;
  notes: string;
};

export type Phase15Bundle = {
  schemaVersion: 1;
  phase: "PHASE_1_5_LEVERAGE_NEUTRAL_COMMON_STRATEGY_CHECK";
  generatedAt: string;
  commonPeriod: { start: string; end: string | null };
  policy: string;
  families: { id: Phase15Family; definition: string }[];
  rows: Phase15Row[];
  pairSummary: {
    underlying: string;
    twoX: CrossTicker;
    threeX: CrossTicker;
    families: {
      family: Phase15Family;
      twoXCagr: number;
      threeXCagr: number;
      twoXMaxDd: number;
      threeXMaxDd: number;
      twoXCalmar: number;
      threeXCalmar: number;
      twoXSortino: number;
      threeXSortino: number;
      twoXWinsRiskAdjusted: boolean;
    }[];
    twoXRiskAdjustedWins: number;
    totalFamilies: number;
  }[];
  limitations: string[];
};

type Payload = { source?: string; retrievedAt?: string; crossSeries?: Record<string, Bar[]> };

const familyDefs: Phase15Bundle["families"] = [
  { id: "VS13_FIXED", definition: "Frozen existing Volatility Shield / VS13, fixed 13% trailing stop." },
  { id: "SIMPLE_200DMA", definition: "Underlying proxy close above 200DMA => 100% risk ETF, else Cash; t close decision, t+1 open execution, 8bps turnover cost." },
  { id: "VS13_VOL30", definition: "Frozen VS13 signal framework with existing 30% annualized portfolio volatility target sizing." },
  { id: "VS13_LEVERAGE_SCALED_STOP", definition: "Frozen VS13 with stop = 13% × leverage/3; 3x=13%, 2x=8.6667%. Mechanical scaling only, no fitted stop." },
];

const leverageNumber = (row: ScreeningRow) => row.leverage.startsWith("2") ? 2 : 3;
const subset = (m: Metrics, actionDaysPerYear = m.ordersPerYear): Phase15Metrics => ({
  cagr: m.cagr,
  totalReturn: m.totalReturn,
  annualizedVolatility: m.annualizedVolatility,
  sharpe: m.sharpe,
  sortino: m.sortino,
  maxDd: m.maxDd,
  calmar: m.calmar,
  ulcerIndex: m.ulcerIndex,
  exposure: m.exposure,
  timeInCash: m.timeInCash,
  actionDaysPerYear,
});

function simple200Dma(ds: Dataset): Phase15Metrics {
  const n = ds.days.length;
  const under = ds.days.map((d) => d.qqq.close);
  const returns: number[] = [];
  const positions: number[] = [];
  const dates: string[] = [];
  let equity = 1;
  let position = 0;
  let nextTarget = 0;
  let changes = 0;

  for (let i = 1; i < n; i++) {
    const day = ds.days[i];
    const prev = ds.days[i - 1];
    const start = equity;
    equity *= 1 + position * (day.tqqq.open / prev.tqqq.close - 1);
    if (nextTarget !== position) {
      equity *= 1 - Math.abs(nextTarget - position) * 0.0008;
      position = nextTarget;
      changes++;
    }
    equity *= 1 + position * (day.tqqq.close / day.tqqq.open - 1);
    returns.push(equity / start - 1);
    positions.push(position);
    dates.push(day.date);

    if (i >= 199) {
      let sum = 0;
      for (let j = i - 199; j <= i; j++) sum += under[j];
      nextTarget = under[i] > sum / 200 ? 1 : 0;
    } else nextTarget = 0;
  }

  const m = metricSet(returns, [], [], dates, positions);
  const years = Math.max(returns.length / 252, 1 / 252);
  return subset(m, changes / years);
}

function configFor(family: Phase15Family, row: ScreeningRow): StrategyConfig | null {
  if (family === "SIMPLE_200DMA") return null;
  if (family === "VS13_FIXED") return { ...STRATEGIES.defensive };
  if (family === "VS13_VOL30") return { ...STRATEGIES.defensive, sizing: "volTarget", targetPortfolioVol: 0.30 };
  return { ...STRATEGIES.defensive, trailStop: 0.13 * leverageNumber(row) / 3 };
}

export function phase15Bundle(payload: Payload): Phase15Bundle {
  const datasets = CORE_TICKERS.flatMap((ticker) => {
    const row = SCREENING.find((x) => x.ticker === ticker);
    if (!row) return [];
    const ds = makeCrossTickerDataset(payload, row, PHASE1_COMMON_START);
    return ds ? [{ row, ds }] : [];
  });

  const commonEnd = datasets.length ? datasets.map((x) => x.ds.days.at(-1)!.date).sort().at(0)! : null;
  const rows: Phase15Row[] = [];
  for (const { row, ds } of datasets) {
    for (const family of familyDefs.map((x) => x.id)) {
      const cfg = configFor(family, row);
      const metrics = cfg ? subset(runBacktest(ds, cfg).metrics) : simple200Dma(ds);
      rows.push({
        ticker: row.ticker,
        underlying: row.underlying,
        leverage: row.leverage,
        family,
        metrics,
        actionCapPassed: metrics.actionDaysPerYear <= 40,
        notes: family === "VS13_LEVERAGE_SCALED_STOP"
          ? `Mechanical stop ${(0.13 * leverageNumber(row) / 3 * 100).toFixed(2)}%; not optimized.`
          : "Pre-registered common rule; no ticker-specific tuning.",
      });
    }
  }

  const pairs = [
    { underlying: "Nasdaq-100", twoX: "QLD" as CrossTicker, threeX: "TQQQ" as CrossTicker },
    { underlying: "S&P 500", twoX: "SSO" as CrossTicker, threeX: "UPRO" as CrossTicker },
  ];
  const pairSummary = pairs.map((pair) => {
    const families = familyDefs.map(({ id: family }) => {
      const two = rows.find((x) => x.ticker === pair.twoX && x.family === family)!;
      const three = rows.find((x) => x.ticker === pair.threeX && x.family === family)!;
      const twoXWinsRiskAdjusted = two.metrics.calmar > three.metrics.calmar && two.metrics.sortino > three.metrics.sortino;
      return {
        family,
        twoXCagr: two.metrics.cagr,
        threeXCagr: three.metrics.cagr,
        twoXMaxDd: two.metrics.maxDd,
        threeXMaxDd: three.metrics.maxDd,
        twoXCalmar: two.metrics.calmar,
        threeXCalmar: three.metrics.calmar,
        twoXSortino: two.metrics.sortino,
        threeXSortino: three.metrics.sortino,
        twoXWinsRiskAdjusted,
      };
    });
    return { ...pair, families, twoXRiskAdjustedWins: families.filter((x) => x.twoXWinsRiskAdjusted).length, totalFamilies: families.length };
  });

  return {
    schemaVersion: 1,
    phase: "PHASE_1_5_LEVERAGE_NEUTRAL_COMMON_STRATEGY_CHECK",
    generatedAt: new Date().toISOString(),
    commonPeriod: { start: PHASE1_COMMON_START, end: commonEnd },
    policy: "Diagnostic only. Four pre-registered common families across TQQQ/QLD/UPRO/SSO. No Native tuning, parameter search, Forward enrollment or Production promotion.",
    families: familyDefs,
    rows,
    pairSummary,
    limitations: [
      "Phase 1.5 was motivated after observing Phase 1, so it is not untouched confirmatory evidence.",
      "The common sample is still historically dominated by the post-2016 U.S. equity regime and cannot prove future leverage superiority.",
      "SIMPLE_200DMA is deliberately simple and binary; it tests strategy-family dependence rather than seeking optimal performance.",
      "VS13_VOL30 and leverage-scaled stop remain related to VS13; only SIMPLE_200DMA is structurally independent of the score framework.",
      "Price returns rather than dividend-reinvested total returns are used, consistent with the current project data model.",
    ],
  };
}
