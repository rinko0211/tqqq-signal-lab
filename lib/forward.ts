import {
  STRATEGIES,
  metricSet,
  nextExecutionDate,
  signals,
  type Dataset,
  type Metrics,
  type Signal,
  type StrategyConfig,
} from "./engine.ts";

export const FORWARD_SCHEMA_VERSION = 1;
export const FORWARD_START_DATE = "2026-08-21";
export const FORWARD_INITIAL_CAPITAL = 1_000_000;
export const FORWARD_BUILD_VERSION = "forward-1.0.0";

export type ForwardCategory = "Growth" | "Balanced" | "Defensive" | "Benchmark";
export type EvidenceLevel = "Insufficient" | "Low" | "Moderate" | "Strong";
export type ForwardStatus =
  | "KEEP CHAMPION"
  | "PROMOTION CANDIDATE"
  | "INSUFFICIENT EVIDENCE"
  | "KILL REVIEW REQUIRED"
  | "BENCHMARK";

export type StrategyFreeze = {
  id: "VS13" | "VS12" | "VT30" | "TQQQ_BH" | "QQQ_BH" | "UPRO_VS13" | "UPRO_NATIVE";
  name: string;
  version: string;
  category: ForwardCategory;
  role: "champion" | "challenger" | "risk-control" | "benchmark";
  frozenAt: string;
  startDate: string;
  initialCapital: number;
  asset: "TQQQ" | "QQQ";
  config: StrategyConfig | null;
  assumptions: {
    signal: string;
    execution: string;
    commissionBps: number;
    slippageBps: number;
    currency: string;
  };
};

export type ForwardExecution = {
  signalDate: string;
  intendedDate: string;
  recordedDate: string;
  price: number;
  before: number;
  after: number;
  turnover: number;
  commission: number;
  slippage: number;
  totalCost: number;
  status: "ON_TIME" | "SCHEDULED_CATCHUP";
};

export type ForwardRecord = {
  key: string;
  marketDataDate: string;
  recordedAt: string;
  recordMode: "LIVE" | "BACKFILLED_OBSERVATION";
  strategyId: StrategyFreeze["id"];
  strategyName: string;
  strategyVersion: string;
  score: number;
  components: Signal["components"];
  regime: string;
  targetExposure: number;
  previousExposure: number;
  signal: string;
  tradeReason: string;
  intendedExecutionDate: string;
  execution: ForwardExecution | null;
  assetClose: number;
  position: number;
  quantity: number;
  cash: number;
  equity: number;
  dailyReturn: number;
  currentDrawdown: number;
  cumulativeCosts: number;
  dataSource: string;
  dataStatus: "VALID" | "BACKFILLED_NO_SIGNAL";
  buildVersion: string;
};

export type ForwardCorrection = {
  correctionId: string;
  originalKey: string;
  recordedAt: string;
  reason: string;
  replacement: Partial<ForwardRecord>;
};

export type ForwardLedger = {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  appendOnly: true;
  championId: "VS13";
  freezes: StrategyFreeze[];
  promotionRule: string;
  reviewSchedule: { sixMonth: string; twelveMonth: string; twentyFourMonth: string };
  records: ForwardRecord[];
  corrections: ForwardCorrection[];
};

const champion = STRATEGIES.defensive;
export const STRATEGY_FREEZES: StrategyFreeze[] = [
  {
    id: "VS13", name: "Volatility Shield 13%", version: "VS13-v1.0", category: "Balanced", role: "champion",
    frozenAt: "2026-08-24T00:00:00.000Z", startDate: FORWARD_START_DATE, initialCapital: FORWARD_INITIAL_CAPITAL, asset: "TQQQ",
    config: { ...champion },
    assumptions: { signal: "market close t", execution: "next available US market open t+1", commissionBps: 3, slippageBps: 5, currency: "JPY-normalized; FX return excluded" },
  },
  {
    id: "VS12", name: "Volatility Shield 12%", version: "VS12-v1.0", category: "Growth", role: "challenger",
    frozenAt: "2026-08-24T00:00:00.000Z", startDate: FORWARD_START_DATE, initialCapital: FORWARD_INITIAL_CAPITAL, asset: "TQQQ",
    config: { ...champion, trailStop: .12 },
    assumptions: { signal: "market close t", execution: "next available US market open t+1", commissionBps: 3, slippageBps: 5, currency: "JPY-normalized; FX return excluded" },
  },
  {
    id: "VT30", name: "30% Volatility Targeting", version: "VT30-v1.0", category: "Defensive", role: "risk-control",
    frozenAt: "2026-08-24T00:00:00.000Z", startDate: FORWARD_START_DATE, initialCapital: FORWARD_INITIAL_CAPITAL, asset: "TQQQ",
    config: { ...champion, sizing: "volTarget", targetPortfolioVol: .30 },
    assumptions: { signal: "market close t", execution: "next available US market open t+1", commissionBps: 3, slippageBps: 5, currency: "JPY-normalized; FX return excluded" },
  },
  {
    id: "TQQQ_BH", name: "TQQQ Buy & Hold", version: "TQQQ-BH-v1.0", category: "Benchmark", role: "benchmark",
    frozenAt: "2026-08-24T00:00:00.000Z", startDate: FORWARD_START_DATE, initialCapital: FORWARD_INITIAL_CAPITAL, asset: "TQQQ", config: null,
    assumptions: { signal: "buy once at forward start", execution: "next available US market open", commissionBps: 3, slippageBps: 5, currency: "JPY-normalized; FX return excluded" },
  },
  {
    id: "QQQ_BH", name: "QQQ Buy & Hold", version: "QQQ-BH-v1.0", category: "Benchmark", role: "benchmark",
    frozenAt: "2026-08-24T00:00:00.000Z", startDate: FORWARD_START_DATE, initialCapital: FORWARD_INITIAL_CAPITAL, asset: "QQQ", config: null,
    assumptions: { signal: "buy once at forward start", execution: "next available US market open", commissionBps: 3, slippageBps: 5, currency: "JPY-normalized; FX return excluded" },
  },
];

export const PROMOTION_RULE = "Human approval only. Strong evidence; at least 12 months; >=6 executed orders; >=4 observed regimes; missing observations <=1%; challenger Sortino or Calmar >= Champion by 10%; total return >=90% of Champion; Max DD no worse by >3 percentage points; turnover <=150% of Champion; no integrity/execution issue; complexity increase <=1 free parameter.";

export function emptyForwardLedger(now = new Date().toISOString()): ForwardLedger {
  return {
    schemaVersion: FORWARD_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    appendOnly: true,
    championId: "VS13",
    freezes: STRATEGY_FREEZES,
    promotionRule: PROMOTION_RULE,
    reviewSchedule: { sixMonth: "2027-02-22", twelveMonth: "2027-08-23", twentyFourMonth: "2028-08-21" },
    records: [], corrections: [],
  };
}

const syntheticBenchmarkSignal = (date: string, target: number, previous: number, asset: string): Signal => ({
  date, score: 100, components: { trend: 100, momentum: 100, volatility: 0, market: 100 }, regime: "Benchmark",
  target, previousTarget: previous, reason: `${asset}をForward開始後に1回購入して保有`, nextChange: "変更なし",
  indicators: { sma50: NaN, sma200: NaN, rsi: NaN, momentum63: NaN, realizedVol: NaN, atrPct: NaN, vix: NaN },
});

const keyOf = (version: string, date: string) => `${version}|${date}`;

function appendForFreeze(ds: Dataset, ledger: ForwardLedger, freeze: StrategyFreeze, generatedAt: string, source: string) {
  const priorRecords = ledger.records.filter(r => r.strategyVersion === freeze.version).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
  const last = priorRecords.at(-1);
  const startIndex = last ? ds.days.findIndex(d => d.date === last.marketDataDate) + 1 : ds.days.findIndex(d => d.date >= freeze.startDate);
  if (startIndex < 0) return;
  const endIndex = ds.days.length - 1;
  for (let i = startIndex; i <= endIndex; i++) {
    const day = ds.days[i];
    if (ledger.records.some(r => r.key === keyOf(freeze.version, day.date))) continue;
    const isLatest = i === endIndex;
    const previous = ledger.records.filter(r => r.strategyVersion === freeze.version).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)).at(-1);
    const assetBar = freeze.asset === "QQQ" ? day.qqq : day.tqqq;
    const priorAssetClose = previous?.assetClose ?? assetBar.close;
    let equity = previous?.equity ?? freeze.initialCapital;
    const previousExposure = previous?.position ?? 0;
    let actualExposure = previousExposure;
    let execution: ForwardExecution | null = null;
    let cumulativeCosts = previous?.cumulativeCosts ?? 0;
    if (previous) {
      equity *= 1 + previousExposure * (assetBar.open / priorAssetClose - 1);
      const intended = previous.intendedExecutionDate;
      if (previous.targetExposure !== previous.position && intended <= day.date) {
        const turnover = Math.abs(previous.targetExposure - previous.position);
        const commission = equity * turnover * .0003;
        const slippage = equity * turnover * .0005;
        const totalCost = commission + slippage;
        equity -= totalCost; cumulativeCosts += totalCost;
        execution = { signalDate: previous.marketDataDate, intendedDate: intended, recordedDate: ds.days.at(-1)!.date,
          price: assetBar.open * (previous.targetExposure > previous.previousExposure ? 1.0005 : .9995),
          before: previous.position, after: previous.targetExposure, turnover, commission, slippage, totalCost,
          status: intended === day.date && isLatest ? "ON_TIME" : "SCHEDULED_CATCHUP" };
        actualExposure = previous.targetExposure;
      }
      equity *= 1 + actualExposure * (assetBar.close / assetBar.open - 1);
    }
    const peak = Math.max(freeze.initialCapital, ...priorRecords.map(r=>r.equity), equity);
    const currentDrawdown = equity / peak - 1;
    let signal: Signal;
    if (!isLatest) {
      signal = syntheticBenchmarkSignal(day.date, actualExposure, actualExposure, freeze.asset);
      signal.reason = "Action未実行日のためSignalを後知恵で生成せず、観測値のみBackfill";
      signal.regime = "Missing live observation";
      signal.score = 0;
    } else if (freeze.config) {
      signal = signals(ds.days.slice(0, i + 1), freeze.config).at(-1)!;
    } else {
      signal = syntheticBenchmarkSignal(day.date, 1, previous ? 1 : 0, freeze.asset);
    }
    const targetExposure = isLatest ? signal.target : actualExposure;
    const record: ForwardRecord = {
      key: keyOf(freeze.version, day.date), marketDataDate: day.date, recordedAt: generatedAt,
      recordMode: isLatest ? "LIVE" : "BACKFILLED_OBSERVATION", strategyId: freeze.id, strategyName: freeze.name,
      strategyVersion: freeze.version, score: signal.score, components: signal.components, regime: signal.regime,
      targetExposure, previousExposure, signal: targetExposure === previousExposure ? "HOLD" : targetExposure > previousExposure ? "INCREASE" : "REDUCE",
      tradeReason: signal.reason, intendedExecutionDate: nextExecutionDate(day.date), execution, assetClose: assetBar.close,
      position: actualExposure, quantity: assetBar.close ? equity * actualExposure / assetBar.close : 0, cash: equity * (1-actualExposure),
      equity, dailyReturn: previous ? equity / previous.equity - 1 : 0, currentDrawdown, cumulativeCosts,
      dataSource: source, dataStatus: isLatest ? "VALID" : "BACKFILLED_NO_SIGNAL", buildVersion: FORWARD_BUILD_VERSION,
    };
    ledger.records.push(record);
  }
}

export function updateForwardLedger(ds: Dataset, input: ForwardLedger | null | undefined, source: string, generatedAt = new Date().toISOString()) {
  const ledger = input?.schemaVersion === FORWARD_SCHEMA_VERSION ? structuredClone(input) : emptyForwardLedger(generatedAt);
  for (const freeze of ledger.freezes) appendForFreeze(ds, ledger, freeze, generatedAt, source);
  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));
  ledger.updatedAt = generatedAt;
  return ledger;
}

export type ForwardSummary = {
  id: StrategyFreeze["id"]; name: string; version: string; category: ForwardCategory; role: StrategyFreeze["role"];
  initialCapital: number; currentCapital: number; profit: number; totalReturn: number; metrics: Metrics;
  currentDd: number; orders: number; transactionCosts: number; observations: number; missing: number; regimes: number;
  evidence: EvidenceLevel; status: ForwardStatus; bestMonth: number; worstMonth: number;
};

export function summarizeForward(ledger: ForwardLedger): ForwardSummary[] {
  const summaries = ledger.freezes.map(freeze => {
    const rows = ledger.records.filter(r=>r.strategyVersion===freeze.version).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
    const returns = rows.map(r=>r.dailyReturn), positions=rows.map(r=>r.position), dates=rows.map(r=>r.marketDataDate);
    const metrics = metricSet(returns, [], [], dates, positions);
    const currentCapital = rows.at(-1)?.equity ?? freeze.initialCapital;
    const orders = rows.filter(r=>r.execution&&r.execution.turnover>0).length;
    const missing = rows.filter(r=>r.dataStatus!=="VALID").length;
    const regimes = new Set(rows.filter(r=>r.dataStatus==="VALID"&&!r.regime.includes("Benchmark")).map(r=>r.regime)).size;
    const observations = rows.filter(r=>r.dataStatus==="VALID").length;
    let evidence: EvidenceLevel = "Insufficient";
    if (observations>=252&&orders>=6&&regimes>=4&&missing/Math.max(1,rows.length)<=.01)evidence="Strong";
    else if(observations>=126&&orders>=3&&regimes>=3)evidence="Moderate";
    else if(observations>=63&&regimes>=2)evidence="Low";
    const months=new Map<string,number[]>();for(const r of rows){const k=r.marketDataDate.slice(0,7);months.set(k,[...(months.get(k)||[]),r.dailyReturn])}
    const monthReturns=[...months.values()].map(x=>x.reduce((e,r)=>e*(1+r),1)-1);
    return { id:freeze.id,name:freeze.name,version:freeze.version,category:freeze.category,role:freeze.role,initialCapital:freeze.initialCapital,
      currentCapital,profit:currentCapital-freeze.initialCapital,totalReturn:currentCapital/freeze.initialCapital-1,metrics,currentDd:rows.at(-1)?.currentDrawdown??0,
      orders,transactionCosts:rows.at(-1)?.cumulativeCosts??0,observations,missing,regimes,evidence,status:"INSUFFICIENT EVIDENCE" as ForwardStatus,
      bestMonth:monthReturns.length?Math.max(...monthReturns):0,worstMonth:monthReturns.length?Math.min(...monthReturns):0};
  });
  const championSummary=summaries.find(x=>x.id==="VS13")!;
  for(const s of summaries){
    if(s.role==="benchmark"){s.status="BENCHMARK";continue}
    if(s.id==="VS13"){s.status="KEEP CHAMPION";continue}
    if(s.evidence!=="Strong"){s.status="INSUFFICIENT EVIDENCE";continue}
    const pass=(s.metrics.sortino>=championSummary.metrics.sortino*1.10||s.metrics.calmar>=championSummary.metrics.calmar*1.10)&&s.totalReturn>=championSummary.totalReturn*.90&&s.metrics.maxDd>=championSummary.metrics.maxDd-.03&&s.orders<=Math.max(1,championSummary.orders)*1.5&&s.missing===0;
    s.status=pass?"PROMOTION CANDIDATE":"KEEP CHAMPION";
  }
  return summaries;
}
