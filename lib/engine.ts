import {marketDataLagSessions,nextNyseSession} from "./market-calendar.ts";

export type Ticker = "TQQQ" | "QQQ" | "SPY" | "VIX";
export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};
export type Day = { date: string; tqqq: Bar; qqq: Bar; spy: Bar; vix: Bar };
export type Issue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
};
export type Dataset = {
  days: Day[];
  issues: Issue[];
  source: "auto" | "csv" | "demo";
  precision: "next-open" | "next-close";
  retrievedAt?: string;
  provider?: string;
  tickers: Record<
    Ticker,
    { start: string; end: string; count: number; adjusted: boolean }
  >;
};
export type StrategyKey = "adaptive" | "trend" | "defensive";
export type PositionMode = "five" | "three" | "binary";
export type Ablation = "none" | "trend" | "momentum" | "volatility" | "market";
export type StrategyConfig = {
  key: StrategyKey;
  name: string;
  weights: {
    trend: number;
    momentum: number;
    volatility: number;
    market: number;
  };
  entry: number;
  exit: number;
  strong: number;
  confirmDays: number;
  minHold: number;
  cooldown: number;
  trailStop: number;
  mode: PositionMode;
  ablation: Ablation;
  activeFrom?: string;
  sizing?: "score" | "volTarget";
  targetPortfolioVol?: number;
  trailMode?: "fixed" | "atr";
  atrMultiple?: number;
};
export type Signal = {
  date: string;
  score: number;
  components: {
    trend: number;
    momentum: number;
    volatility: number;
    market: number;
  };
  regime: string;
  target: number;
  previousTarget: number;
  reason: string;
  nextChange: string;
  indicators: {
    sma50: number;
    sma200: number;
    rsi: number;
    momentum63: number;
    realizedVol: number;
    atrPct: number;
    vix: number;
  };
};
export type Order = {
  signalDate: string;
  executionDate: string;
  executionPrice: number;
  before: number;
  after: number;
  turnover: number;
  cost: number;
  reason: string;
  regime: string;
  components: Signal["components"];
  score: number;
  subsequentPnl: number;
  mfe: number;
  mae: number;
  holdingDays: number;
};
export type RoundTrade = {
  entry: string;
  exit: string;
  return: number;
  mfe: number;
  mae: number;
  days: number;
};
export type Metrics = {
  cagr: number;
  totalReturn: number;
  annualizedVolatility: number;
  sharpe: number;
  sortino: number;
  downsideDeviation: number;
  maxDd: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHold: number;
  medianHold: number;
  expectancy: number;
  ulcerIndex: number;
  exposure: number;
  timeInCash: number;
  recoveryDays: number | null;
  maxLossStreak: number;
  entries: number;
  exits: number;
  roundTrips: number;
  rebalanceOrders: number;
  changeDays: number;
  annualTurnover: number;
  ordersPerYear: number;
};
export type DailyResult = {
  date: string;
  equity: number;
  dailyReturn: number;
  position: number;
  signal: Signal;
  execution?: Order;
};
export type Backtest = {
  config: StrategyConfig;
  daily: DailyResult[];
  orders: Order[];
  roundTrips: RoundTrade[];
  metrics: Metrics;
  yearly: {
    year: number;
    return: number;
    maxDd: number;
    entries: number;
    exits: number;
    orders: number;
    turnover: number;
  }[];
  assumption: string;
};
export type WalkForwardYear = {
  year: number;
  selected: string;
  config: StrategyConfig;
  isMetrics: Metrics;
  oosReturn: number;
  oosMaxDd: number;
  oosSharpe: number;
  orders: number;
};
export type WalkForward = {
  years: WalkForwardYear[];
  oosCurve: { date: string; equity: number }[];
  metrics: Metrics;
  holdout: {
    startYear: number;
    selected: string;
    metrics: Metrics;
    curve: { date: string; equity: number }[];
  } | null;
  objective: string;
};

const mean = (x: number[]) =>
  x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0;
const stdev = (x: number[]) => {
  if (x.length < 2) return 0;
  const m = mean(x);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1));
};
const clamp = (x: number, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const sma = (x: number[], i: number, n: number) =>
  i < n - 1 ? NaN : mean(x.slice(i - n + 1, i + 1));
const change = (x: number[], i: number, n: number) =>
  i < n ? 0 : x[i] / x[i - n] - 1;
const nextWeekday = (date: string, delay = 1) => nextNyseSession(date,delay);
export const annualize = (daily: number[]) =>
  daily.length
    ? Math.pow(
        daily.reduce((e, r) => e * (1 + r), 1),
        252 / daily.length,
      ) - 1
    : 0;
export const maxDrawdown = (curve: number[]) => {
  let peak = curve[0] || 1,
    dd = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    dd = Math.min(dd, v / peak - 1);
  }
  return dd;
};
export const metricSet = (
  returns: number[],
  rounds: RoundTrade[] = [],
  orders: Order[] = [],
  dates: string[] = [],
  positions: number[] = [],
): Metrics => {
  void dates;
  const eq = returns.reduce((e, r) => e * (1 + r), 1),
    years = Math.max(returns.length / 252, 1 / 252),
    down = returns.map((r) => Math.min(0, r)),
    sh = stdev(returns) ? (mean(returns) / stdev(returns)) * Math.sqrt(252) : 0,
    sort = stdev(down) ? (mean(returns) / stdev(down)) * Math.sqrt(252) : 0,
    curve: number[] = [];
  returns.reduce((e, r) => {
    const v = e * (1 + r);
    curve.push(v);
    return v;
  }, 1);
  const dd = maxDrawdown(curve),
    wins = rounds.filter((x) => x.return > 0),
    loss = rounds.filter((x) => x.return <= 0);
  let peak=curve[0]||1,peakIndex=0,worstPeakIndex=0,worstIndex=0,worst=0;
  const drawdowns=curve.map((v,i)=>{if(v>=peak){peak=v;peakIndex=i}const d=v/peak-1;if(d<worst){worst=d;worstIndex=i;worstPeakIndex=peakIndex}return d});
  let recoveryDays:number|null=null;
  if(worstIndex>=worstPeakIndex&&worst<0){const recovery=curve.findIndex((v,i)=>i>worstIndex&&v>=curve[worstPeakIndex]);if(recovery>=0)recoveryDays=recovery-worstPeakIndex;}
  const holds=rounds.map(x=>x.days).sort((a,b)=>a-b),medianHold=holds.length?(holds.length%2?holds[(holds.length-1)/2]:(holds[holds.length/2-1]+holds[holds.length/2])/2):0;
  const exposure=positions.length?mean(positions):0;
  let streak = 0,
    maxStreak = 0;
  for (const t of rounds) {
    streak = t.return <= 0 ? streak + 1 : 0;
    maxStreak = Math.max(maxStreak, streak);
  }
  return {
    cagr: eq ** (1 / years) - 1,
    totalReturn: eq - 1,
    annualizedVolatility: stdev(returns)*Math.sqrt(252),
    sharpe: sh,
    sortino: sort,
    downsideDeviation: stdev(down) * Math.sqrt(252),
    maxDd: dd,
    calmar: dd ? annualize(returns) / Math.abs(dd) : 0,
    winRate: rounds.length ? wins.length / rounds.length : 0,
    profitFactor: loss.length
      ? wins.reduce((s, x) => s + x.return, 0) /
        Math.abs(loss.reduce((s, x) => s + x.return, 0))
      : wins.length
        ? Infinity
        : 0,
    avgWin: mean(wins.map((x) => x.return)),
    avgLoss: mean(loss.map((x) => x.return)),
    avgHold: mean(rounds.map((x) => x.days)),
    medianHold,
    expectancy: mean(rounds.map(x=>x.return)),
    ulcerIndex: Math.sqrt(mean(drawdowns.map(x=>x*x))),
    exposure,
    timeInCash: positions.length?positions.filter(x=>x===0).length/positions.length:0,
    recoveryDays,
    maxLossStreak: maxStreak,
    entries: orders.filter((x) => x.before === 0 && x.after > 0).length,
    exits: orders.filter((x) => x.before > 0 && x.after === 0).length,
    roundTrips: rounds.length,
    rebalanceOrders: orders.filter((x) => x.before > 0 && x.after > 0).length,
    changeDays: new Set(orders.map((x) => x.executionDate)).size,
    annualTurnover: orders.reduce((s, x) => s + x.turnover, 0) / years,
    ordersPerYear: orders.length / years,
  };
};

const csvLine = (line: string) => {
  const out: string[] = [];
  let cur = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
};
const canonical = (s: string) => s.toLowerCase().replace(/[ _.-]/g, "");
const inferTicker = (name: string) =>
  (name.toUpperCase().match(/TQQQ|QQQ|SPY|VIX/)?.[0] || "") as Ticker | "";
export function parseMarketCsv(
  files: { name: string; text: string }[],
): Dataset {
  const raw: Record<Ticker, Map<string, Bar>> = {
      TQQQ: new Map(),
      QQQ: new Map(),
      SPY: new Map(),
      VIX: new Map(),
    },
    adjustedPresent: Record<Ticker, boolean> = {
      TQQQ: false,
      QQQ: false,
      SPY: false,
      VIX: false,
    },
    issues: Issue[] = [];
  let hasOpen = true;
  for (const file of files) {
    const lines = file.text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      issues.push({
        severity: "error",
        code: "empty",
        message: `${file.name}: データ行がありません`,
      });
      continue;
    }
    const headers = csvLine(lines[0]).map(canonical),
      idx = (...n: string[]) =>
        n
          .map(canonical)
          .map((x) => headers.indexOf(x))
          .find((x) => x >= 0) ?? -1;
    const c = {
      date: idx("date", "timestamp"),
      ticker: idx("ticker", "symbol"),
      open: idx("open"),
      high: idx("high"),
      low: idx("low"),
      close: idx("close"),
      adj: idx("adjclose", "adjustedclose"),
      volume: idx("volume"),
    };
    if (c.date < 0) {
      issues.push({
        severity: "error",
        code: "date",
        message: `${file.name}: Date列がありません`,
      });
      continue;
    }
    const wide = ["TQQQ", "QQQ", "SPY", "VIX"].filter((t) =>
      headers.includes(t.toLowerCase()),
    ) as Ticker[];
    if (c.volume < 0 && !wide.length)
      issues.push({
        severity: "warning",
        code: "volume",
        message: `${file.name}: Volume列がありません`,
      });
    const lastByTicker = new Map<string, string>();
    for (let n = 1; n < lines.length; n++) {
      const a = csvLine(lines[n]),
        date = a[c.date];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        issues.push({
          severity: "error",
          code: "date-format",
          message: `${file.name} ${n + 1}行: 日付形式が不正です`,
        });
        continue;
      }
      if (wide.length) {
        for (const t of wide) {
          const v = Number(a[headers.indexOf(t.toLowerCase())]);
          if (Number.isFinite(v) && v > 0)
            raw[t].set(date, {
              date,
              open: v,
              high: v,
              low: v,
              close: v,
              adjClose: v,
              volume: 0,
            });
        }
        hasOpen = false;
        continue;
      }
      const ticker = ((c.ticker >= 0
        ? a[c.ticker].toUpperCase()
        : inferTicker(file.name)) || "") as Ticker;
      if (!raw[ticker]) {
        issues.push({
          severity: "error",
          code: "ticker",
          message: `${file.name} ${n + 1}行: Tickerを判定できません`,
        });
        continue;
      }
      const prior = lastByTicker.get(ticker);
      if (prior && date < prior)
        issues.push({
          severity: "warning",
          code: "unsorted",
          message: `${file.name}: ${ticker}の日付順が逆転しています（計算前に並べ替え）`,
        });
      lastByTicker.set(ticker, date);
      if (c.adj >= 0) adjustedPresent[ticker] = true;
      const close = Number(a[c.close >= 0 ? c.close : c.adj]),
        adj = Number(a[c.adj >= 0 ? c.adj : c.close]);
      if (
        !Number.isFinite(close) ||
        !Number.isFinite(adj) ||
        close <= 0 ||
        adj <= 0
      ) {
        issues.push({
          severity: "error",
          code: "numeric",
          message: `${file.name} ${n + 1}行: Close/Adj Closeが非数値または0以下です`,
        });
        continue;
      }
      const open = Number(a[c.open]),
        high = Number(a[c.high]),
        low = Number(a[c.low]);
      if (![open, high, low].every((v) => Number.isFinite(v) && v > 0))
        hasOpen = false;
      const scale = adj / close,
        bar: Bar = {
          date,
          open: Number.isFinite(open) && open > 0 ? open * scale : adj,
          high: Number.isFinite(high) && high > 0 ? high * scale : adj,
          low: Number.isFinite(low) && low > 0 ? low * scale : adj,
          close: adj,
          adjClose: adj,
          volume:
            c.volume >= 0 && Number.isFinite(Number(a[c.volume]))
              ? Number(a[c.volume])
              : 0,
        };
      if (raw[ticker].has(date))
        issues.push({
          severity: "error",
          code: "duplicate",
          message: `${ticker} ${date}: 重複日です`,
        });
      else raw[ticker].set(date, bar);
    }
  }
  const tickers = Object.keys(raw) as Ticker[];
  for (const t of tickers)
    if (!raw[t].size)
      issues.push({
        severity: "error",
        code: "missing-ticker",
        message: `${t}: データがありません`,
      });
  const common = [...raw.TQQQ.keys()]
    .filter((d) => tickers.every((t) => raw[t].has(d)))
    .sort();
  for (const t of tickers) {
    const missing = raw[t].size - common.length;
    if (missing > 0)
      issues.push({
        severity: "warning",
        code: "calendar-mismatch",
        message: `${t}: 他銘柄と一致しない${missing}営業日を除外しました`,
      });
  }
  if (common.length < 252)
    issues.push({
      severity: "error",
      code: "short",
      message: "共通期間が252営業日未満です",
    });
  if (!hasOpen)
    issues.push({
      severity: "warning",
      code: "no-open",
      message: "始値がないため次営業日終値約定（低精度）を使用します",
    });
  const days = common.map((date) => ({
    date,
    tqqq: raw.TQQQ.get(date)!,
    qqq: raw.QQQ.get(date)!,
    spy: raw.SPY.get(date)!,
    vix: raw.VIX.get(date)!,
  }));
  const info = {} as Dataset["tickers"];
  for (const t of tickers) {
    const values = [...raw[t].values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    info[t] = {
      start: values[0]?.date || "—",
      end: values.at(-1)?.date || "—",
      count: values.length,
      adjusted: adjustedPresent[t],
    };
    if (!adjustedPresent[t])
      issues.push({
        severity: "warning",
        code: "unadjusted",
        message: `${t}: Adj Close列がなく、分割・分配金調整を確認できません`,
      });
  }
  return {
    days,
    issues,
    source: "csv",
    precision: hasOpen ? "next-open" : "next-close",
    tickers: info,
  };
}
export function datasetFromPayload(payload: {
  source?: string;
  retrievedAt?: string;
  series: Record<Ticker, Bar[]>;
  warnings?: string[];
}): Dataset {
  const files = (Object.keys(payload.series) as Ticker[]).map((t) => ({
    name: `${t}.csv`,
    text: [
      "Date,Open,High,Low,Close,Adj Close,Volume,Ticker",
      ...payload.series[t].map(
        (b) =>
          `${b.date},${b.open},${b.high},${b.low},${b.close},${b.adjClose},${b.volume},${t}`,
      ),
    ].join("\n"),
  }));
  const ds = parseMarketCsv(files);
  ds.source = "auto";
  ds.retrievedAt = payload.retrievedAt;
  ds.provider = payload.source;
  ds.issues.push(
    ...(payload.warnings || []).map((message) => ({
      severity: "warning" as const,
      code: "provider",
      message,
    })),
  );
  return ds;
}

function rsi(x: number[], i: number, n = 14) {
  if (i < n) return 50;
  let up = 0,
    down = 0;
  for (let j = i - n + 1; j <= i; j++) {
    const d = x[j] - x[j - 1];
    if (d > 0) up += d;
    else down -= d;
  }
  return down ? 100 - 100 / (1 + up / down) : 100;
}
function atrPct(days: Day[], i: number, n = 20) {
  if (i < n) return 0;
  const tr: number[] = [];
  for (let j = i - n + 1; j <= i; j++) {
    const q = days[j].qqq,
      prev = days[j - 1].qqq.close;
    tr.push(
      Math.max(
        q.high - q.low,
        Math.abs(q.high - prev),
        Math.abs(q.low - prev),
      ) / q.close,
    );
  }
  return mean(tr) * 100;
}
function tqqqAtrPct(days:Day[],i:number,n=20){
  if(i<n)return 0;const tr:number[]=[];
  for(let j=i-n+1;j<=i;j++){const x=days[j].tqqq,prev=days[j-1].tqqq.close;tr.push(Math.max(x.high-x.low,Math.abs(x.high-prev),Math.abs(x.low-prev))/x.close)}
  return mean(tr)*100;
}
function realized(x: number[], i: number, n = 20) {
  if (i < n) return 0;
  return (
    stdev(
      x
        .slice(i - n + 1, i + 1)
        .map((v, j, a) => (j ? v / a[j - 1] - 1 : 0))
        .slice(1),
    ) *
    Math.sqrt(252) *
    100
  );
}
export const STRATEGIES: Record<StrategyKey, StrategyConfig> = {
  adaptive: {
    key: "adaptive",
    name: "Adaptive Regime",
    weights: { trend: 0.34, momentum: 0.24, volatility: 0.24, market: 0.18 },
    entry: 67,
    exit: 43,
    strong: 79,
    confirmDays: 3,
    minHold: 8,
    cooldown: 5,
    trailStop: 0.17,
    mode: "five",
    ablation: "none",
  },
  trend: {
    key: "trend",
    name: "Trend Confirmation",
    weights: { trend: 0.43, momentum: 0.31, volatility: 0.1, market: 0.16 },
    entry: 69,
    exit: 44,
    strong: 80,
    confirmDays: 3,
    minHold: 10,
    cooldown: 5,
    trailStop: 0.18,
    mode: "five",
    ablation: "none",
  },
  defensive: {
    key: "defensive",
    name: "Volatility Shield",
    weights: { trend: 0.27, momentum: 0.16, volatility: 0.37, market: 0.2 },
    entry: 70,
    exit: 48,
    strong: 82,
    confirmDays: 2,
    minHold: 6,
    cooldown: 8,
    trailStop: 0.13,
    mode: "five",
    ablation: "none",
  },
};
const mapPosition = (score: number, regime: string, c: StrategyConfig) => {
  if (["急落・危機", "下降トレンド"].includes(regime) || score < c.exit)
    return 0;
  if (c.mode === "binary") return score >= c.entry ? 1 : 0;
  if (c.mode === "three")
    return score >= c.strong ? 1 : score >= c.entry ? 0.5 : 0;
  return score >= c.strong
    ? 1
    : score >= c.entry + 6
      ? 0.75
      : score >= c.entry
        ? 0.5
        : score >= c.exit + 8
          ? 0.25
          : 0;
};
export function signals(days: Day[], config: StrategyConfig): Signal[] {
  const q = days.map((d) => d.qqq.close),
    t = days.map((d) => d.tqqq.close),
    spy = days.map((d) => d.spy.close),
    out: Signal[] = [];
  let target = 0,
    hold = 0,
    cool = 0,
    trail = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i],
      m50 = sma(q, i, 50),
      m200 = sma(q, i, 200),
      m200old = sma(q, i - 20, 200),
      mom = change(q, i, 63),
      spy200 = sma(spy, i, 200),
      spyMom = change(spy, i, 63),
      rs = rsi(q, i),
      rv = realized(q, i),
      at = atrPct(days, i),
      tAt=tqqqAtrPct(days,i),
      v = d.vix.close;
    const trend = Number.isFinite(m200)
        ? clamp(
            (q[i] > m200 ? 38 : 8) +
              (Number.isFinite(m50) && m50 > m200 ? 31 : 8) +
              (Number.isFinite(m200old) && m200 > m200old ? 31 : 8),
          )
        : 25,
      momentum = clamp(
        50 +
          mom * 190 +
          (rs >= 48 && rs <= 70 ? 10 : rs > 78 ? -18 : rs < 35 ? -8 : 0),
      ),
      volatility = clamp(
        100 -
          (Math.max(0, rv - 12) * 2.1 +
            Math.max(0, v - 15) * 2.2 +
            Math.max(0, at - 1) * 10),
      ),
      market = Number.isFinite(spy200)
        ? clamp(
            20 +
              (spy[i] > spy200 ? 42 : 5) +
              (spyMom > 0 ? 28 : 5) +
              clamp(spyMom * 80, -10, 10),
          )
        : 25;
    const components = { trend, momentum, volatility, market };
    const weights = { ...config.weights };
    if (config.ablation !== "none") {
      weights[config.ablation] = 0;
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      for (const k of Object.keys(weights) as (keyof typeof weights)[])
        weights[k] /= sum;
    }
    const score = Math.round(
      components.trend * weights.trend +
        components.momentum * weights.momentum +
        components.volatility * weights.volatility +
        components.market * weights.market,
    );
    const rg =
      v >= 38 || (Number.isFinite(m200) && q[i] < m200 && mom < -0.12)
        ? "急落・危機"
        : v >= 28
          ? "高ボラ"
          : Number.isFinite(m50) && q[i] > m50 && m50 > m200 && mom > 0.04
            ? "強い上昇"
            : Number.isFinite(m200) && q[i] > m200
              ? "弱い上昇"
              : Number.isFinite(m200) && q[i] < m200 && m200 < m200old
                ? "下降トレンド"
                : "レンジ";
    const prev = target;
    if (target > 0) {
      hold++;
      trail = Math.max(trail, t[i]);
    } else {
      hold = 0;
      if (cool > 0) cool--;
    }
    let desired =
      i < 200 || (config.activeFrom && d.date < config.activeFrom)
        ? 0
        : mapPosition(score, rg, config);
    if(config.sizing==="volTarget"&&desired>0){
      const targetVol=config.targetPortfolioVol||.30,estimatedTqqqVol=Math.max(.01,rv/100*3),cap=Math.floor(clamp(targetVol/estimatedTqqqVol,0,1)*4)/4;
      desired=Math.min(desired,cap);
    }
    const effectiveStop=config.trailMode==="atr"?clamp((config.atrMultiple||3)*tAt/100,.10,.25):config.trailStop;
    const crisis =
      rg === "急落・危機" ||
      (target > 0 && trail > 0 && t[i] / trail - 1 < -effectiveStop);
    if (crisis) desired = 0;
    if (desired > target && cool > 0) desired = target;
    const threshold = desired > target ? config.entry : config.exit,
      confirmed =
        out
          .slice(-config.confirmDays)
          .filter((s) =>
            desired > target ? s.score >= threshold : s.score < threshold,
          ).length >= Math.max(1, config.confirmDays - 1);
    if (desired !== target && !crisis && !confirmed) desired = target;
    if (desired < target && desired === 0 && hold < config.minHold && !crisis)
      desired = target;
    if (target > 0 && desired === 0) {
      cool = config.cooldown;
      trail = 0;
    }
    target = desired;
    const reason = crisis
      ? "危機レジームまたはトレーリングストップ"
      : target !== prev
        ? `確認条件成立。目標を${target * 100}%へ変更`
        : `${rg}・総合${score}点のため${target * 100}%を維持`;
    const nextChange =
      target === 0
        ? `総合${config.entry}点以上が${config.confirmDays}日中${Math.max(1, config.confirmDays - 1)}日かつ上昇レジーム`
        : `総合${config.exit}点未満、危機判定、または${config.trailMode==="atr"?`ATR連動（現在${Math.round(effectiveStop*100)}%）`:`${Math.round(config.trailStop * 100)}%`}トレーリングストップ`;
    out.push({
      date: d.date,
      score,
      components,
      regime: rg,
      target,
      previousTarget: prev,
      reason,
      nextChange,
      indicators: {
        sma50: m50,
        sma200: m200,
        rsi: rs,
        momentum63: mom,
        realizedVol: rv,
        atrPct: at,
        vix: v,
      },
    });
  }
  return out;
}

export function runBacktest(
  ds: Dataset,
  config: StrategyConfig,
  options = { commissionBps: 3, slippageBps: 5, delay: 1 },
): Backtest {
  const days = ds.days,
    sig = signals(days, config),
    orders: Order[] = [],
    daily: DailyResult[] = [],
    rounds: RoundTrade[] = [];
  let position = 0,
    equity = 1,
    openTrade: null | {
      entry: string;
      price: number;
      equity: number;
      mfe: number;
      mae: number;
      days: number;
    } = null;
  for (let i = 1; i < days.length; i++) {
    const d = days[i],
      prev = days[i - 1],
      execSignal = sig[i - options.delay];
    const dayStartEquity=equity;
    let overnight = 0,
      intraday = 0,
      order: Order | undefined;
    if (ds.precision === "next-open") {
      overnight = position * (d.tqqq.open / prev.tqqq.close - 1);
      equity *= 1 + overnight;
    } else {
      equity *= 1 + position * (d.tqqq.close / prev.tqqq.close - 1);
    }
    if (execSignal && execSignal.target !== position) {
      const before = position,
        after = execSignal.target,
        turnover = Math.abs(after - before),
        cost =
          (turnover * (options.commissionBps + options.slippageBps)) / 10000;
      equity *= 1 - cost;
      position = after;
      const px = ds.precision === "next-open" ? d.tqqq.open : d.tqqq.close;
      order = {
        signalDate: execSignal.date,
        executionDate: d.date,
        executionPrice:
          px *
          (after > before
            ? 1 + options.slippageBps / 10000
            : 1 - options.slippageBps / 10000),
        before,
        after,
        turnover,
        cost,
        reason: execSignal.reason,
        regime: execSignal.regime,
        components: execSignal.components,
        score: execSignal.score,
        subsequentPnl: 0,
        mfe: 0,
        mae: 0,
        holdingDays: 0,
      };
      orders.push(order);
      if (before === 0 && after > 0)
        openTrade = {
          entry: d.date,
          price: px,
          equity,
          mfe: 0,
          mae: 0,
          days: 0,
        };
      if (before > 0 && after === 0 && openTrade) {
        const tradeReturn = equity / openTrade.equity - 1;
        rounds.push({
          entry: openTrade.entry,
          exit: d.date,
          return: tradeReturn,
          mfe: openTrade.mfe,
          mae: openTrade.mae,
          days: openTrade.days,
        });
        openTrade = null;
      }
    }
    if (ds.precision === "next-open") {
      intraday = position * (d.tqqq.close / d.tqqq.open - 1);
      equity *= 1 + intraday;
    }
    const dailyReturn = equity/dayStartEquity-1;
    if (openTrade) {
      openTrade.days++;
      const px = d.tqqq.close,
        r = px / openTrade.price - 1;
      openTrade.mfe = Math.max(openTrade.mfe, r);
      openTrade.mae = Math.min(openTrade.mae, r);
    }
    daily.push({
      date: d.date,
      equity,
      dailyReturn,
      position,
      signal: sig[i],
      execution: order,
    });
  }
  if (openTrade) {
    const last = days.at(-1)!;
    rounds.push({
      entry: openTrade.entry,
      exit: last.date,
      return: equity / openTrade.equity - 1,
      mfe: openTrade.mfe,
      mae: openTrade.mae,
      days: openTrade.days,
    });
  }
  for (const o of orders) {
    const end = daily.findLastIndex(
        (x) => x.date <= nextWeekday(o.executionDate, 21),
      ),
      start = daily.findIndex((x) => x.date === o.executionDate),
      base = start >= 0 ? daily[start].equity : 1,
      last = end >= start ? daily[end] : daily.at(-1)!;
    o.subsequentPnl = last.equity / base - 1;
    o.holdingDays = Math.max(0, end - start);
    const slice = daily
      .slice(start, Math.max(start + 1, end + 1))
      .map((x) => x.equity / base - 1);
    o.mfe = Math.max(0, ...slice);
    o.mae = Math.min(0, ...slice);
  }
  const returns = daily.map((x) => x.dailyReturn),
    metrics = metricSet(
      returns,
      rounds,
      orders,
      daily.map((x) => x.date),
      daily.map((x)=>x.position),
    ),
    years = [...new Set(daily.map((x) => +x.date.slice(0, 4)))];
  const yearly = years.map((year) => {
    const x = daily.filter((d) => +d.date.slice(0, 4) === year),
      r = x.map((d) => d.dailyReturn),
      os = orders.filter((o) => +o.executionDate.slice(0, 4) === year);
    return {
      year,
      return: r.reduce((e, v) => e * (1 + v), 1) - 1,
      maxDd: maxDrawdown(
        r.reduce((a, v) => {
          a.push((a.at(-1) || 1) * (1 + v));
          return a;
        }, [] as number[]),
      ),
      entries: os.filter((o) => o.before === 0 && o.after > 0).length,
      exits: os.filter((o) => o.before > 0 && o.after === 0).length,
      orders: os.length,
      turnover: os.reduce((s, o) => s + o.turnover, 0),
    };
  });
  return {
    config,
    daily,
    orders,
    roundTrips: rounds,
    metrics,
    yearly,
    assumption:
      ds.precision === "next-open"
        ? "t日終値で判定→t+1始値で約定。前日終値〜始値は旧配分、始値〜終値は新配分。"
        : "t日終値で判定→t+1終値で約定する低精度代替。",
  };
}

export function benchmark(ds: Dataset, ticker: "tqqq" | "qqq" | "spy") {
  const x = ds.days.map((d) => d[ticker].close),
    r = x.slice(1).map((v, i) => v / x[i] - 1);
  return metricSet(
    r,
    [],
    [],
    ds.days.slice(1).map((d) => d.date),
    r.map(()=>1),
  );
}
const utility = (m: Metrics, yearly: { return: number }[]) => {
  const concentration = yearly.length
      ? Math.max(...yearly.map((y) => Math.max(0, y.return))) /
        Math.max(
          0.0001,
          yearly.reduce((s, y) => s + Math.max(0, y.return), 0),
        )
      : 1,
    scarcity = m.roundTrips < 5 ? 0.35 : 0,
    deep = m.maxDd < -0.65 ? 0.5 : 0;
  return (
    m.sharpe * 0.24 +
    m.sortino * 0.17 +
    m.calmar * 0.2 +
    m.cagr * 0.55 -
    Math.abs(m.maxDd) * 0.3 -
    m.downsideDeviation * 0.15 -
    concentration * 0.12 -
    scarcity -
    deep
  );
};
export const OBJECTIVE =
  "0.24×Sharpe + 0.17×Sortino + 0.20×Calmar + 0.55×CAGR − 0.30×|MaxDD| − 0.15×下方偏差 − 0.12×年次利益集中度 − 少数取引/深DDペナルティ";
export function candidateConfigs() {
  const out: StrategyConfig[] = [];
  for (const k of Object.keys(STRATEGIES) as StrategyKey[])
    for (const mode of ["five", "three", "binary"] as PositionMode[])
      out.push({
        ...STRATEGIES[k],
        mode,
        name: `${STRATEGIES[k].name} · ${mode}`,
      });
  return out;
}
const subset = (ds: Dataset, start: number, end: number, warmup = 0) => {
  const eligible = ds.days.filter(
    (d) => +d.date.slice(0, 4) >= start - warmup && +d.date.slice(0, 4) <= end,
  );
  return { ...ds, days: eligible };
};
const metricsFromDaily = (daily: DailyResult[]) =>
  metricSet(
    daily.map((x) => x.dailyReturn),
    [],
    daily.flatMap((x) => (x.execution ? [x.execution] : [])),
    daily.map((x) => x.date),
    daily.map((x)=>x.position),
  );
export function holdoutForConfig(ds: Dataset, config: StrategyConfig) {
  const years = [...new Set(ds.days.map((d) => +d.date.slice(0, 4)))].sort();
  const startYear = years.length >= 8 ? years.at(-2)! : Infinity;
  if (!Number.isFinite(startYear)) return null;
  const test = runBacktest(subset(ds, startYear, years.at(-1)!, 1), {
    ...config,
    activeFrom: `${startYear}-01-01`,
  });
  const daily = test.daily.filter((d) => +d.date.slice(0, 4) >= startYear);
  return { startYear, metrics: metricsFromDaily(daily), daily };
}
export function walkForward(ds: Dataset): WalkForward {
  const ys = [...new Set(ds.days.map((d) => +d.date.slice(0, 4)))].sort(),
    holdoutStart = ys.length >= 8 ? ys.at(-2)! : Infinity,
    testYears = ys.slice(4).filter((y) => y < holdoutStart),
    years: WalkForwardYear[] = [],
    oosCurve: { date: string; equity: number }[] = [],
    oosDaily: DailyResult[]=[];
  let equity = 1;
  for (const year of testYears) {
    const train = subset(ds, year - 4, year - 1),
      candidates = candidateConfigs()
        .map((config) => {
          const r = runBacktest(train, config);
          return { r, u: utility(r.metrics, r.yearly) };
        })
        .sort((a, b) => b.u - a.u),
      pick = candidates[0].r,
      oos = runBacktest(subset(ds, year, year, 1), {
        ...pick.config,
        activeFrom: `${year}-01-01`,
      }),
      daily = oos.daily.filter((d) => +d.date.slice(0, 4) === year);
    for (const d of daily) {
      equity *= 1 + d.dailyReturn;
      oosCurve.push({ date: d.date, equity });
      oosDaily.push(d);
    }
    const om = metricsFromDaily(daily);
    years.push({
      year,
      selected: pick.config.name,
      config: pick.config,
      isMetrics: pick.metrics,
      oosReturn: daily.reduce((e, d) => e * (1 + d.dailyReturn), 1) - 1,
      oosMaxDd: maxDrawdown(
        daily.reduce((a, d) => {
          a.push((a.at(-1) || 1) * (1 + d.dailyReturn));
          return a;
        }, [] as number[]),
      ),
      oosSharpe: om.sharpe,
      orders: daily.filter((d) => d.execution).length,
    });
  }
  const oosReturns = oosCurve.map((x, i) =>
      i ? x.equity / oosCurve[i - 1].equity - 1 : 0,
    ),
    wfMetrics = oosDaily.length?metricsFromDaily(oosDaily):metricSet(oosReturns);
  let holdout: WalkForward["holdout"] = null;
  if (Number.isFinite(holdoutStart)) {
    const pre = subset(ds, ys[0], holdoutStart - 1),
      pick = candidateConfigs()
        .map((c) => runBacktest(pre, c))
        .sort(
          (a, b) => utility(b.metrics, b.yearly) - utility(a.metrics, a.yearly),
        )[0],
      test = runBacktest(subset(ds, holdoutStart, ys.at(-1)!, 1), {
        ...pick.config,
        activeFrom: `${holdoutStart}-01-01`,
      }),
      daily = test.daily.filter((d) => +d.date.slice(0, 4) >= holdoutStart);
    let e = 1;
    const curve = daily.map((d) => ({
      date: d.date,
      equity: (e *= 1 + d.dailyReturn),
    }));
    holdout = {
      startYear: holdoutStart,
      selected: pick.config.name,
      metrics: metricsFromDaily(daily),
      curve,
    };
  }
  return { years, oosCurve, metrics: wfMetrics, holdout, objective: OBJECTIVE };
}

export function oosComparison(ds: Dataset) {
  const ys = [...new Set(ds.days.map((d) => +d.date.slice(0, 4)))].sort(),
    holdoutStart = ys.length >= 8 ? ys.at(-2)! : Infinity,
    testYears = ys.slice(4).filter((y) => y < holdoutStart);
  return (Object.keys(STRATEGIES) as StrategyKey[]).map((key) => {
    const daily: DailyResult[] = [];
    for (const year of testYears) {
      const run = runBacktest(subset(ds, year, year, 1), {
        ...STRATEGIES[key],
        activeFrom: `${year}-01-01`,
      });
      daily.push(...run.daily.filter((d) => +d.date.slice(0, 4) === year));
    }
    return {
      key,
      name: STRATEGIES[key].name,
      metrics: metricsFromDaily(daily),
      years: testYears.length,
    };
  });
}

export function robustness(ds: Dataset, base: StrategyConfig) {
  const variants = [0.8, 0.9, 1, 1.1, 1.2].map((mult) => {
      const c = {
        ...base,
        entry: Math.round(base.entry * mult),
        exit: Math.round(base.exit * mult),
        strong: Math.round(base.strong * mult),
      };
      const r = runBacktest(ds, c);
      return {
        label: `閾値 ×${mult.toFixed(1)}`,
        cagr: r.metrics.cagr,
        sharpe: r.metrics.sharpe,
        maxDd: r.metrics.maxDd,
      };
    }),
    cost = [1, 2, 3].map((mult) => {
      const r = runBacktest(ds, base, {
        commissionBps: 3 * mult,
        slippageBps: 5 * mult,
        delay: 1,
      });
      return {
        label: `コスト ×${mult}`,
        cagr: r.metrics.cagr,
        sharpe: r.metrics.sharpe,
        maxDd: r.metrics.maxDd,
      };
    }),
    delay = [1, 2].map((n) => {
      const r = runBacktest(ds, base, {
        commissionBps: 3,
        slippageBps: 5,
        delay: n,
      });
      return {
        label: `執行 T+${n}`,
        cagr: r.metrics.cagr,
        sharpe: r.metrics.sharpe,
        maxDd: r.metrics.maxDd,
      };
    }),
    ablation = (
      ["none", "trend", "momentum", "volatility", "market"] as Ablation[]
    ).map((a) => {
      const r = runBacktest(ds, { ...base, ablation: a });
      return {
        label: a === "none" ? "全要素" : `${a}除外`,
        cagr: r.metrics.cagr,
        sharpe: r.metrics.sharpe,
        maxDd: r.metrics.maxDd,
      };
    }),
    modes = (["five", "three", "binary"] as PositionMode[]).map((mode) => {
      const r = runBacktest(ds, { ...base, mode });
      return {
        label: mode,
        cagr: r.metrics.cagr,
        sharpe: r.metrics.sharpe,
        maxDd: r.metrics.maxDd,
      };
    });
  const bt = runBacktest(ds, base),
    tradeReturns = bt.roundTrips.map((x) => x.return);
  let seed = 1729;
  const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
    sims: number[] = [];
  for (let n = 0; n < 500; n++) {
    let e = 1;
    for (let i = 0; i < tradeReturns.length; i++)
      e *= 1 + tradeReturns[Math.floor(rand() * tradeReturns.length)];
    sims.push(e - 1);
  }
  sims.sort((a, b) => a - b);
  const grouped = new Map<string, DailyResult[]>();
  for (const d of bt.daily)
    grouped.set(d.signal.regime, [...(grouped.get(d.signal.regime) || []), d]);
  const regime = [...grouped].map(([name, x]) => {
    const r = x.map((d) => d.dailyReturn);
    return {
      name,
      days: x.length,
      return: r.reduce((e, v) => e * (1 + v), 1) - 1,
      sharpe: stdev(r) ? (mean(r) / stdev(r)) * Math.sqrt(252) : 0,
      maxDd: maxDrawdown(
        r.reduce((a, v) => {
          a.push((a.at(-1) || 1) * (1 + v));
          return a;
        }, [] as number[]),
      ),
    };
  });
  const windows = [
      { name: "2011債務危機", start: "2011-07-01", end: "2011-10-31" },
      { name: "2018 Q4", start: "2018-10-01", end: "2018-12-31" },
      { name: "COVID急落", start: "2020-02-19", end: "2020-04-30" },
      { name: "2022弱気相場", start: "2022-01-01", end: "2022-12-31" },
    ],
    crises = windows.flatMap((w) => {
      const x = bt.daily.filter((d) => d.date >= w.start && d.date <= w.end);
      if (!x.length) return [];
      const r = x.map((d) => d.dailyReturn);
      return [
        {
          name: w.name,
          return: r.reduce((e, v) => e * (1 + v), 1) - 1,
          maxDd: maxDrawdown(
            r.reduce((a, v) => {
              a.push((a.at(-1) || 1) * (1 + v));
              return a;
            }, [] as number[]),
          ),
          orders: x.filter((d) => d.execution).length,
        },
      ];
    });
  return {
    variants,
    cost,
    delay,
    ablation,
    modes,
    bootstrap: {
      p05: sims[Math.floor(sims.length * 0.05)] || 0,
      median: sims[Math.floor(sims.length * 0.5)] || 0,
      p95: sims[Math.floor(sims.length * 0.95)] || 0,
      samples: 500,
    },
    regime,
    crises,
  };
}

export function demoDataset(): Dataset {
  const days: Day[] = [],
    date = new Date("2014-01-02T12:00:00Z");
  let q = 85,
    s = 182,
    t = 12,
    seed = 91;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  while (days.length < 2600) {
    if (![0, 6].includes(date.getUTCDay())) {
      const n = (rnd() - 0.5) * 0.024 + 0.00035,
        sp = n * 0.65 + (rnd() - 0.5) * 0.008;
      q *= 1 + n;
      s *= 1 + sp;
      t *= 1 + clamp(n * 3 - 0.0002, -0.2, 0.2);
      const mk = (v: number): Bar => ({
        date: date.toISOString().slice(0, 10),
        open: v * (1 + (rnd() - 0.5) * 0.005),
        high: v * 1.008,
        low: v * 0.992,
        close: v,
        adjClose: v,
        volume: 1e7,
      });
      days.push({
        date: date.toISOString().slice(0, 10),
        tqqq: mk(t),
        qqq: mk(q),
        spy: mk(s),
        vix: mk(clamp(18 - Math.min(0, n) * 400, 11, 60)),
      });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const info = {} as Dataset["tickers"];
  for (const ticker of ["TQQQ", "QQQ", "SPY", "VIX"] as Ticker[])
    info[ticker] = {
      start: days[0].date,
      end: days.at(-1)!.date,
      count: days.length,
      adjusted: true,
    };
  return {
    days,
    issues: [
      {
        severity: "warning",
        code: "demo",
        message: "合成データです。成績は実績・採用判定に使用できません",
      },
    ],
    source: "demo",
    precision: "next-open",
    tickers: info,
  };
}
export function freshness(date: string, now=new Date().toISOString()) {
  const age = Math.floor((Date.parse(now) - new Date(`${date}T21:00:00Z`).getTime()) / 86400000),lagSessions=marketDataLagSessions(date,now),stale=!Number.isFinite(lagSessions)||lagSessions>0;
  return {
    age,
    lagSessions,
    stale,
    message: stale
      ? `最終データから${Number.isFinite(lagSessions)?lagSessions:"不明"}完了NYSEセッション遅延。現在シグナルとして使用しないでください`
      : `最新の完了NYSEセッションまで反映済み`,
  };
}
export const nextExecutionDate = (signalDate: string, delay = 1) =>
  nextNyseSession(signalDate, delay);
