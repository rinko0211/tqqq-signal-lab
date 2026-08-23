"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Backtest,
  Dataset,
  OBJECTIVE,
  STRATEGIES,
  StrategyKey,
  datasetFromPayload,
  demoDataset,
  freshness,
  holdoutForConfig,
  nextExecutionDate,
  oosComparison,
  parseMarketCsv,
  robustness,
  walkForward,
} from "../lib/engine";
import {simulatePaper,type LiveSnapshot,type PaperConfig} from "../lib/paper";

type RuntimeStatus={generatedAt?:string;actionRunId?:string;actionStatus?:"success"|"failed";marketDataDate?:string;signalDate?:string;jsonValid?:boolean;pwaExpected?:boolean;paperHistoryValid?:boolean;state?:"latest"|"market_closed"|"not_updated"|"failed";message?:string;errors?:string[]};
type SignalShape=Backtest["daily"][number]["signal"];
type DailySignalFile={generatedAt:string;dataDate:string;source:string;tqqqClose:number;strategy:string;state:RuntimeStatus["state"];signal:SignalShape&{executionDate?:string};suggestion:string;validation?:{holdout?:Backtest["metrics"]|null};warnings?:string[]};
type AnalysisBundle={bt?:Backtest;wf?:ReturnType<typeof walkForward>;rob?:ReturnType<typeof robustness>;comparison?:ReturnType<typeof oosComparison>;holdout?:ReturnType<typeof holdoutForConfig>;tqqq?:Backtest["metrics"];qqq?:Backtest["metrics"]};
const EXECUTION_ASSUMPTION="t日終値判定 → t+1営業日始値約定 / 手数料3bps + スリッページ5bps";

const pct = (v: number, d = 1) =>
    Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—",
  num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—"),
  usd = (v: number) => (Number.isFinite(v) ? `$${v.toFixed(2)}` : "—");
const TABS = [
  ["signal", "今日のシグナル"],
  ["compare", "戦略比較"],
  ["walk", "Walk-Forward"],
  ["year", "年別成績"],
  ["trades", "取引履歴"],
  ["robust", "頑健性検証"],
  ["data", "データ管理"],
  ["paper", "Paper Trading"],
  ["status", "System Status"],
  ["guide", "初めて使う方へ"],
  ["spec", "計算・戦略仕様"],
] as const;
type Tab = (typeof TABS)[number][0];
const RESEARCH_TABS=new Set<Tab>(["compare","walk","year","trades","robust","data"]);
type Holdings = {
  ratio: string;
  shares: string;
  avgPrice: string;
  cash: string;
  lastTrade: string;
};
const EMPTY: Holdings = {
  ratio: "",
  shares: "",
  avgPrice: "",
  cash: "",
  lastTrade: "",
};

function Metric({
  label,
  value,
  sub,
  title,
  tone = "",
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`} title={title}>
      <span>{label} ⓘ</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Table({
  heads,
  rows,
}: {
  heads: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Curve({
  points,
  label,
}: {
  points: { equity: number }[];
  label: string;
}) {
  if (points.length < 2) return <div className="emptyMini">曲線データなし</div>;
  const sample = points.filter(
      (_, i) => i % Math.max(1, Math.floor(points.length / 600)) === 0,
    ),
    w = 900,
    h = 210,
    lo = Math.min(...sample.map((x) => x.equity)),
    hi = Math.max(...sample.map((x) => x.equity)),
    path = sample
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${(i / (sample.length - 1)) * w},${h - ((v.equity - lo) / (hi - lo || 1)) * (h - 18) - 9}`,
      )
      .join(" ");
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#b6ff4a" stopOpacity=".28" />
          <stop offset="1" stopColor="#b6ff4a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}L${w},${h}L0,${h}Z`} fill="url(#fill)" />
      <path
        d={path}
        fill="none"
        stroke="#b6ff4a"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function Status({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`status ${kind}`}>{children}</span>;
}

export default function Home() {
  const [dataset, setDataset] = useState<Dataset | null>(null),
    [tab, setTab] = useState<Tab>("signal"),
    [key, setKey] = useState<StrategyKey>("defensive"),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("実データを取得しています…"),
    [holdings, setHoldings] = useState<Holdings>(EMPTY),
    [query, setQuery] = useState(""),
    [runtimeStatus,setRuntimeStatus]=useState<RuntimeStatus|null>(null),
    [dailySignal,setDailySignal]=useState<DailySignalFile|null>(null),
    [analysis,setAnalysis]=useState<AnalysisBundle|null>(null),
    [analysisLoading,setAnalysisLoading]=useState(false),
    [liveHistory,setLiveHistory]=useState<LiveSnapshot[]>([]);
  const fileRef = useRef<HTMLInputElement>(null),marketRequested=useRef(false),analysisWorker=useRef<Worker|null>(null),analysisRequest=useRef(0);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setHoldings(
          JSON.parse(localStorage.getItem("tqqq-holdings-v2") || "null") ||
            EMPTY,
        );
      } catch {}
    });
    const staticData=new URL("./data/",document.baseURI),fetchJson=async(url:string|URL)=>{const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error(`${r.status}`);return r.json()};
    Promise.allSettled([
      fetchJson(new URL("signal.json",staticData)).then((value)=>{setDailySignal(value);setMessage("事前計算済みの最新Signalを読み込みました")}),
      fetchJson(new URL("status.json",staticData)).then(setRuntimeStatus),
      fetchJson(new URL("live-history.json",staticData)).then(setLiveHistory),
    ]).then((results)=>{
      if(results[0].status==="rejected")setMessage("最新Signalを取得できません。System Statusを確認してください。");
      setLoading(false);
    });
  }, []);
  useEffect(()=>{
    if(!RESEARCH_TABS.has(tab)||dataset||marketRequested.current)return;
    marketRequested.current=true;setLoading(true);setMessage("検証用の全期間データを読み込んでいます…");
    const staticData=new URL("./data/",document.baseURI),fetchJson=async(url:string|URL)=>{const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error(`${r.status}`);return r.json()};
    (async()=>{let json;try{json=await fetchJson(new URL("market-data.json",staticData))}catch{json=await fetchJson("/api/market-data")}const ds=datasetFromPayload(json);if(ds.issues.some((x)=>x.severity==="error"))throw Error("取得データの検査でエラーが発生しました");setDataset(ds);setMessage("実データを読み込みました")})().catch((e)=>{marketRequested.current=false;setMessage(`${e instanceof Error?e.message:"自動取得に失敗"}。CSVを読み込んでください。`)}).finally(()=>setLoading(false));
  },[tab,dataset]);
  const saveHoldings = (next: Holdings) => {
    setHoldings(next);
    localStorage.setItem("tqqq-holdings-v2", JSON.stringify(next));
  };
  useEffect(()=>{
    if(!dataset||dataset.issues.some((x)=>x.severity==="error")||!["compare","walk","year","trades","robust"].includes(tab))return;
    const id=++analysisRequest.current;
    queueMicrotask(()=>{if(analysisRequest.current===id){setAnalysis(null);setAnalysisLoading(true);setMessage("検証計算をバックグラウンドで実行しています。画面操作は継続できます。")}});
    const worker=analysisWorker.current||(analysisWorker.current=new Worker(new URL("../lib/analysis.worker.ts",import.meta.url),{type:"module"}));
    const receive=(event:MessageEvent<{id:number;result?:AnalysisBundle;error?:string}>)=>{if(event.data.id!==id)return;setAnalysisLoading(false);if(event.data.error){setMessage(`検証計算エラー: ${event.data.error}`);setAnalysis(null)}else{setAnalysis(event.data.result||null);setMessage("検証計算が完了しました")}};
    worker.addEventListener("message",receive);worker.postMessage({id,tab,dataset,key});
    return()=>worker.removeEventListener("message",receive);
  },[dataset,key,tab]);
  useEffect(()=>()=>analysisWorker.current?.terminate(),[]);
  const loadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    try {
      const payload = await Promise.all(
          [...files].map(async (f) => ({ name: f.name, text: await f.text() })),
        ),
        ds = parseMarketCsv(payload);
      setDataset(ds);
      setMessage(
        ds.issues.some((x) => x.severity === "error")
          ? "データエラーがあります。修正するまで計算しません。"
          : "CSV実データを読み込みました",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "CSV読込エラー");
    } finally {
      setLoading(false);
    }
  };
  const useDemo = () => {
    setDataset(demoDataset());
    setMessage("デモモードです。表示成績は実績ではありません");
  };
  const download = (name: string, text: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportOrders = () => {
    if (!analysis?.bt) return;
    const h =
        "SignalDate,ExecutionDate,ExecutionPrice,Before,After,Turnover,Cost,Reason,Regime,TrendScore,MomentumScore,VolatilityScore,MarketScore,TotalScore,SubsequentPnL,MFE,MAE,HoldingDays\n",
      body = analysis.bt.orders
        .map((o) =>
          [
            o.signalDate,
            o.executionDate,
            o.executionPrice,
            o.before,
            o.after,
            o.turnover,
            o.cost,
            `\"${o.reason}\"`,
            o.regime,
            o.components.trend,
            o.components.momentum,
            o.components.volatility,
            o.components.market,
            o.score,
            o.subsequentPnl,
            o.mfe,
            o.mae,
            o.holdingDays,
          ].join(","),
        )
        .join("\n");
    download("tqqq-orders.csv", h + body);
  };
  const exportData = () => {
    if (!dataset) return;
    const h = "Date,Open,High,Low,Close,Adj Close,Volume,Ticker\n",
      body = dataset.days
        .flatMap((d) =>
          (
            [
              ["TQQQ", d.tqqq],
              ["QQQ", d.qqq],
              ["SPY", d.spy],
              ["VIX", d.vix],
            ] as const
          ).map(([t, b]) =>
            [
              b.date,
              b.open,
              b.high,
              b.low,
              b.close,
              b.adjClose,
              b.volume,
              t,
            ].join(","),
          ),
        )
        .join("\n");
    download("tqqq-market-data.csv", h + body);
  };
  const now = new Date(),
    et = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(now),
    jst = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(now);
  const latest = dataset?.days.at(-1),
    latestDate=latest?.date||dailySignal?.dataDate,
    fresh = latestDate ? freshness(latestDate) : null,
    bt = analysis?.bt,
    signal = dailySignal?.signal||bt?.daily.at(-1)?.signal,
    latestClose=dailySignal?.tqqqClose||latest?.tqqq.close,
    target = signal?.target ?? 0,
    actual = holdings.ratio === "" ? null : Number(holdings.ratio) / 100,
    action =
      actual === null
        ? "保有状況未入力：目標のみ表示"
        : Math.abs(actual - target) < 0.001
          ? "変更なし"
          : actual < target
            ? `TQQQ比率を${target * 100}%まで増加`
            : `TQQQ比率を${target * 100}%まで縮小`;
  const sourceLabel =
    dataset?.source === "auto"
      ? "実データ・自動取得"
      : dataset?.source === "csv"
        ? "実データ・CSV"
        : dataset?.source === "demo"
        ? "合成データ・DEMO"
          : dailySignal?"実データ・自動取得":"未検証";
  const holdoutMetrics=dailySignal?.validation?.holdout||analysis?.holdout?.metrics;
  const operationalCandidate=Boolean(dataset?.source!=="demo"&&holdoutMetrics&&holdoutMetrics.cagr>0&&holdoutMetrics.maxDd>-.45&&holdoutMetrics.sharpe>.5);
  const compareAnalysis=analysis?.bt&&analysis.comparison&&analysis.holdout&&analysis.tqqq&&analysis.qqq?{bt:analysis.bt,comparison:analysis.comparison,holdout:analysis.holdout,tqqq:analysis.tqqq,qqq:analysis.qqq}:null;
  const statusKind=runtimeStatus?.state==="failed"?"bad":runtimeStatus?.state==="not_updated"?"warn":runtimeStatus?"ok":"neutral";
  const generatedLabel=runtimeStatus?.generatedAt?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}).format(new Date(runtimeStatus.generatedAt)):"未確認";
  return (
    <main>
      <header className="top">
        <div className="brand">
          <i>TQ</i>
          <div>
            <b>TQQQ Signal Lab</b>
            <small>EXECUTION-AWARE RESEARCH SYSTEM</small>
          </div>
        </div>
        <nav>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="tools">
          <Status
            kind={
              dataset?.source === "demo" ? "warn" : dataset ? "ok" : "neutral"
            }
          >
            {sourceLabel}
          </Status>
          <button onClick={() => fileRef.current?.click()}>CSV読込</button>
          <input
            ref={fileRef}
            hidden
            multiple
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => loadFiles(e.target.files)}
          />
        </div>
      </header>
      <section className="workspace">
        <section className={`freshnessBar ${statusKind}`} aria-label="データ鮮度">
          <div><span>最終データ日</span><strong>{runtimeStatus?.marketDataDate||latestDate||"未取得"}</strong></div>
          <div><span>最終計算日時（日本時間）</span><strong>{generatedLabel}</strong></div>
          <div><span>データ取得状態</span><strong>{runtimeStatus?.message||fresh?.message||"確認中"}</strong></div>
        </section>
        <div className="context">
          <div>
            <em>
              {tab.toUpperCase()} · {latestDate || "NO DATA"}
            </em>
            <h1>{TABS.find((x) => x[0] === tab)?.[1]}</h1>
            <p>{message}</p>
          </div>
          {(dataset||dailySignal) && (
            <div className="contextBadges">
              <Status kind={dataset?.source === "demo" ? "warn" : "ok"}>
                {sourceLabel}
              </Status>
              <Status kind={!dataset||dataset.precision === "next-open" ? "ok" : "warn"}>
                {!dataset||dataset.precision === "next-open"
                  ? "T+1始値約定"
                  : "T+1終値・低精度"}
              </Status>
              {fresh && (
                <Status kind={fresh.stale ? "bad" : "ok"}>
                  {fresh.message}
                </Status>
              )}
              {analysis&&<Status kind={operationalCandidate?"ok":"warn"}>{operationalCandidate?"条件付き運用候補":"検証基準未達"}</Status>}
            </div>
          )}
        </div>
        {!dailySignal&&!dataset && (
          <section className="emptyState">
            <span>REAL DATA REQUIRED</span>
            <h2>
              {loading ? "市場データを確認中" : "実データがまだありません"}
            </h2>
            <p>
              初期画面に合成成績は表示しません。自動取得が失敗した場合は、TQQQ・QQQ・SPY・VIXのOHLCV
              CSVを読み込んでください。
            </p>
            <div>
              <button onClick={() => fileRef.current?.click()}>
                CSVを読み込む
              </button>
              <button className="ghost" onClick={useDemo}>
                デモモードを開く
              </button>
            </div>
          </section>
        )}
        {dailySignal&&!dataset&&RESEARCH_TABS.has(tab)&&(
          <section className="emptyState">
            <span>HISTORICAL RESEARCH</span>
            <h2>{loading?"検証用データを読み込み中":"検証用データを読み込めませんでした"}</h2>
            <p>今日のSignalは取得済みです。全期間バックテストは日常画面と分離し、このタブを開いた時だけ読み込みます。</p>
            {!loading&&<div><button onClick={()=>fileRef.current?.click()}>CSVを読み込む</button><button className="ghost" onClick={useDemo}>デモモードを開く</button></div>}
          </section>
        )}
        {dataset&&analysisLoading&&["compare","walk","year","trades","robust"].includes(tab)&&(
          <section className="emptyState"><span>BACKGROUND CALCULATION</span><h2>検証計算を実行中</h2><p>Signalロジックは変更していません。計算中も「今日のシグナル」「System Status」「Paper Trading」へ移動できます。</p></section>
        )}
        {dataset?.issues.some((x) => x.severity === "error") && (
          <section className="issueBlock">
            <h2>計算を停止しました</h2>
            {dataset.issues
              .filter((x) => x.severity === "error")
              .map((x, i) => (
                <p key={i}>× {x.message}</p>
              ))}
            <button onClick={() => fileRef.current?.click()}>
              修正CSVを読み込む
            </button>
          </section>
        )}
        {signal&&latestClose!==undefined&&fresh&&tab === "signal" && (
          <SignalView
            bt={bt}
            signal={signal}
            latestClose={latestClose}
            sourceLabel={sourceLabel}
            fresh={fresh!}
            action={action}
            actual={actual}
            holdings={holdings}
            saveHoldings={saveHoldings}
            et={et}
            jst={jst}
            operationalCandidate={operationalCandidate}
          />
        )}
        {compareAnalysis && tab === "compare" && (
          <CompareView
            analysis={compareAnalysis}
            keyName={key}
            setKeyName={setKey}
            sourceLabel={sourceLabel}
          />
        )}
        {analysis?.wf && tab === "walk" && (
          <WalkView wf={analysis.wf} sourceLabel={sourceLabel} />
        )}
        {analysis?.bt && tab === "year" && <YearView bt={analysis.bt} />}
        {analysis?.bt && tab === "trades" && (
          <TradesView
            bt={analysis.bt}
            query={query}
            setQuery={setQuery}
            exportOrders={exportOrders}
          />
        )}
        {analysis?.rob && tab === "robust" && <RobustView data={analysis.rob} />}
        {dataset && tab === "data" && (
          <DataView
            dataset={dataset}
            exportData={exportData}
            useDemo={useDemo}
            openFiles={() => fileRef.current?.click()}
          />
        )}
        {tab === "paper" && <PaperView history={liveHistory} latestDate={latestDate} source={dataset?.source||(dailySignal?"auto":undefined)}/>} 
        {tab === "status" && <SystemStatusView status={runtimeStatus} latestDate={latestDate} history={liveHistory}/>} 
        {tab === "guide" && <GuideView/>}
        {tab === "spec" && <SpecView />}
      </section>
      <footer>
        <b>TQQQ Signal Lab v2</b>
        <span>
          研究・検証用途。投資助言ではなく、将来の収益を保証しません。
        </span>
        <span>
          {et} ET / {jst} JST
        </span>
      </footer>
    </main>
  );
}

function SignalView({
  bt,
  signal,
  latestClose,
  sourceLabel,
  fresh,
  action,
  actual,
  holdings,
  saveHoldings,
  et,
  jst,
  operationalCandidate,
}: {
  bt?: Backtest;
  signal: SignalShape;
  latestClose: number;
  sourceLabel: string;
  fresh: ReturnType<typeof freshness>;
  action: string;
  actual: number | null;
  holdings: Holdings;
  saveHoldings: (x: Holdings) => void;
  et: string;
  jst: string;
  operationalCandidate:boolean;
}) {
  const execute = nextExecutionDate(signal.date);
  const assumption=bt?.assumption||EXECUTION_ASSUMPTION;
  const changed=Math.abs(signal.target-signal.previousTarget)>.001,
    direction=signal.target>signal.previousTarget?"増加":"縮小";
  return (
    <>
      <section className="todayCall">
        <span>本日の判断</span>
        <h2>{changed?`${signal.previousTarget*100}% → ${signal.target*100}%`:`${signal.target*100}%維持`}</h2>
        <strong>{changed?`次回始値で${Math.abs(signal.target-signal.previousTarget)*100}%${direction}`:"売買なし"}</strong>
        <Status kind={signal.regime==="急落・危機"?"bad":"ok"}>危機判定：{signal.regime==="急落・危機"?"発動中":"なし"}</Status>
      </section>
      <section className="signal">
        <article className="decision">
          <Status kind={operationalCandidate?"ok":"warn"}>{operationalCandidate?"条件付き運用候補・最終判断は人間":"研究シグナル・売買見送り"}</Status>
          <div className="decisionHead">
            <div>
              <span>現在の目標ポジション</span>
              <strong>{signal.target * 100}%</strong>
            </div>
            <div className="score">
              <b>{signal.score}</b>
              <span>/100</span>
            </div>
          </div>
          <div className="meter">
            <i style={{ width: `${signal.score}%` }} />
          </div>
          <div className="position">
            <div>
              <span>前営業日の目標</span>
              <b>{signal.previousTarget * 100}%</b>
            </div>
            <i>→</i>
            <div>
              <span>推奨アクション</span>
              <b>{action}</b>
            </div>
          </div>
          <p>{signal.reason}</p>
          <div className="stamp">
            判断日 {signal.date} 終値後 → 実行予定 {execute}{" "}
            始値（米国休場日は次の実営業日）
          </div>
        </article>
        <article className="regime">
          <em>MARKET REGIME</em>
          <h2>{signal.regime}</h2>
          <p className="price">TQQQ {usd(latestClose)}</p>
          <div className="next">
            <span>次に変わる主要条件</span>
            <b>{signal.nextChange}</b>
          </div>
          <p>
            {fresh.stale ? fresh.message : `${sourceLabel}・${assumption}`}
          </p>
        </article>
      </section>
      <section className="indicators">
        <Metric
          label="Trend"
          value={num(signal.components.trend, 0)}
          sub={`QQQ SMA200 ${usd(signal.indicators.sma200)}`}
          title="QQQ終値・SMA50・SMA200・SMA200傾き"
          tone={signal.components.trend >= 60 ? "good" : "bad"}
        />
        <Metric
          label="Momentum"
          value={num(signal.components.momentum, 0)}
          sub={`63日 ${pct(signal.indicators.momentum63)}`}
          title="QQQ 63日リターンとRSI(14)"
        />
        <Metric
          label="Volatility"
          value={num(signal.components.volatility, 0)}
          sub={`VIX ${num(signal.indicators.vix, 1)}`}
          title="QQQ実現変動率・ATR・VIX。高いほど安全"
        />
        <Metric
          label="Market"
          value={num(signal.components.market, 0)}
          sub="SPYトレンド確認"
          title="SPYのSMA200と63日モメンタム"
        />
        <Metric
          label="ATR (20)"
          value={`${num(signal.indicators.atrPct, 2)}%`}
          sub={`実現Vol ${num(signal.indicators.realizedVol, 1)}%`}
        />
        <Metric
          label="時刻"
          value="ET / JST"
          sub={`${et} / ${jst}`}
          title="現在時刻。シグナル判定は米国市場の完了済み日足のみ"
        />
      </section>
      {bt&&<article className="panel">
        <div className="panelHead">
          <div>
            <em>BACKTEST PATH · {sourceLabel}</em>
            <h2>選択戦略の資産曲線</h2>
          </div>
          <span>{assumption}</span>
        </div>
        <Curve points={bt.daily} label="選択戦略の資産曲線" />
      </article>}
      <article className="panel holdings">
        <div>
          <em>DEVICE-LOCAL POSITION</em>
          <h2>現在の保有状況</h2>
          <p>
            この端末にのみ保存します。未入力時は売買指示を生成せず、目標ポジションだけ表示します。
          </p>
        </div>
        <div className="holdingInputs">
          {[
            ["ratio", "TQQQ保有比率 (%)"],
            ["shares", "保有株数"],
            ["avgPrice", "平均取得価格 ($)"],
            ["cash", "現金残高 ($)"],
            ["lastTrade", "最終売買日"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                type={k === "lastTrade" ? "date" : "number"}
                value={holdings[k as keyof Holdings]}
                onChange={(e) =>
                  saveHoldings({ ...holdings, [k]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <div className="actualAction">
          <span>実保有 {actual === null ? "未入力" : `${actual * 100}%`}</span>
          <b>{action}</b>
        </div>
      </article>
    </>
  );
}

function CompareView({
  analysis,
  keyName,
  setKeyName,
  sourceLabel,
}: {
  analysis: {
    bt: Backtest;
    comparison: ReturnType<typeof oosComparison>;
    holdout: ReturnType<typeof holdoutForConfig>;
    tqqq: Backtest["metrics"];
    qqq: Backtest["metrics"];
  };
  keyName: StrategyKey;
  setKeyName: (x: StrategyKey) => void;
  sourceLabel: string;
}) {
  const candidate=Boolean(analysis.holdout&&analysis.holdout.metrics.cagr>0&&analysis.holdout.metrics.maxDd>-.45&&analysis.holdout.metrics.sharpe>.5);
  return (
    <>
      <section className="candidates">
        {analysis.comparison.map((x) => (
          <button
            key={x.key}
            className={keyName === x.key ? "selected" : ""}
            onClick={() => setKeyName(x.key)}
          >
            <em>PURE OOS · {x.years} YEARS</em>
            <h3>{x.name}</h3>
            <p>固定ロジックを各OOS年に適用。ホールドアウトは除外。</p>
            <div>
              <b>{pct(x.metrics.cagr)}</b>
              <small>CAGR</small>
              <b>{num(x.metrics.sharpe)}</b>
              <small>Sharpe</small>
              <b>{pct(x.metrics.maxDd)}</b>
              <small>Max DD</small>
            </div>
          </button>
        ))}
      </section>
      <section className="metrics">
        <Metric
          label="CAGR"
          value={pct(analysis.bt.metrics.cagr)}
          sub="全実データ・説明用"
        />
        <Metric label="Sharpe" value={num(analysis.bt.metrics.sharpe)} />
        <Metric label="Sortino" value={num(analysis.bt.metrics.sortino)} />
        <Metric
          label="最大DD"
          value={pct(analysis.bt.metrics.maxDd)}
          tone="bad"
        />
        <Metric label="Calmar" value={num(analysis.bt.metrics.calmar)} />
        <Metric label="新規Entry" value={`${analysis.bt.metrics.entries}回`} />
        <Metric label="全決済" value={`${analysis.bt.metrics.exits}回`} />
        <Metric
          label="往復取引"
          value={`${analysis.bt.metrics.roundTrips}回`}
        />
        <Metric
          label="注文/年"
          value={num(analysis.bt.metrics.ordersPerYear, 1)}
        />
        <Metric
          label="回転率/年"
          value={pct(analysis.bt.metrics.annualTurnover)}
        />
      </section>
      <section className="split">
        <article className="panel">
          <div className="panelHead">
            <div>
              <em>BUY & HOLD · {sourceLabel}</em>
              <h2>リスク調整後比較</h2>
            </div>
          </div>
          <Table
            heads={["対象", "CAGR", "Sharpe", "最大DD", "Sortino"]}
            rows={[
              [
                analysis.bt.config.name,
                pct(analysis.bt.metrics.cagr),
                num(analysis.bt.metrics.sharpe),
                pct(analysis.bt.metrics.maxDd),
                num(analysis.bt.metrics.sortino),
              ],
              [
                "TQQQ Buy & Hold",
                pct(analysis.tqqq.cagr),
                num(analysis.tqqq.sharpe),
                pct(analysis.tqqq.maxDd),
                num(analysis.tqqq.sortino),
              ],
              [
                "QQQ Buy & Hold",
                pct(analysis.qqq.cagr),
                num(analysis.qqq.sharpe),
                pct(analysis.qqq.maxDd),
                num(analysis.qqq.sortino),
              ],
            ]}
          />
        </article>
        <article className="panel verdict">
          <em>VERDICT RULE</em>
          <h2>{candidate?"条件付き運用候補":"改良して再検証"}</h2>
          <p>
            {candidate?"最終ホールドアウトがCAGR>0、Sharpe>0.5、最大DD>-45%を満たしました。まずペーパー運用で日次判断を監視します。":"ホールドアウトを含む実データ結果が隣接パラメータでも安定するまで運用候補にはしません。"}取引回数は選定目的ではなく監査値です。
          </p>
        </article>
      </section>
    </>
  );
}

function WalkView({
  wf,
  sourceLabel,
}: {
  wf: ReturnType<typeof walkForward>;
  sourceLabel: string;
}) {
  return (
    <>
      <article className="panel">
        <div className="panelHead">
          <div>
            <em>PURE WALK-FORWARD · {sourceLabel}</em>
            <h2>連結OOS資産曲線</h2>
          </div>
          <Status kind="ok">ISとOOSを分離</Status>
        </div>
        <Curve points={wf.oosCurve} label="Walk-Forward OOS連結資産曲線" />
        <section className="metrics compact">
          <Metric label="OOS CAGR" value={pct(wf.metrics.cagr)} />
          <Metric label="OOS Sharpe" value={num(wf.metrics.sharpe)} />
          <Metric label="OOS Sortino" value={num(wf.metrics.sortino)} />
          <Metric label="OOS Max DD" value={pct(wf.metrics.maxDd)} tone="bad" />
          <Metric label="OOS Calmar" value={num(wf.metrics.calmar)} />
        </section>
      </article>
      <article className="panel">
        <div className="panelHead">
          <div>
            <em>4Y IS → 1Y OOS</em>
            <h2>各年の採用設定</h2>
          </div>
        </div>
        <Table
          heads={[
            "OOS年",
            "ISで選択",
            "Entry / Exit / Strong",
            "配分",
            "OOS Return",
            "OOS Sharpe",
            "OOS DD",
            "注文",
          ]}
          rows={wf.years.map((x) => [
            x.year,
            x.selected,
            `${x.config.entry} / ${x.config.exit} / ${x.config.strong}`,
            x.config.mode,
            pct(x.oosReturn),
            num(x.oosSharpe),
            pct(x.oosMaxDd),
            x.orders,
          ])}
        />
      </article>
      {wf.holdout && (
        <article className="panel holdout">
          <div>
            <em>FINAL HOLDOUT · 未接触期間</em>
            <h2>{wf.holdout.startYear}年以降</h2>
            <p>
              ホールドアウト結果を見て再最適化しない前提です。選択:{" "}
              {wf.holdout.selected}
            </p>
          </div>
          <section className="metrics compact">
            <Metric label="Holdout CAGR" value={pct(wf.holdout.metrics.cagr)} />
            <Metric label="Sharpe" value={num(wf.holdout.metrics.sharpe)} />
            <Metric label="Sortino" value={num(wf.holdout.metrics.sortino)} />
            <Metric
              label="最大DD"
              value={pct(wf.holdout.metrics.maxDd)}
              tone="bad"
            />
            <Metric
              label="注文/年"
              value={num(wf.holdout.metrics.ordersPerYear, 1)}
            />
          </section>
        </article>
      )}
      <article className="panel formula">
        <em>SELECTION OBJECTIVE</em>
        <h2>複合スコア</h2>
        <code>{OBJECTIVE}</code>
        <p>取引回数10〜40回は目的関数に入れていません。</p>
      </article>
    </>
  );
}

function YearView({ bt }: { bt: Backtest }) {
  return (
    <article className="panel">
      <div className="panelHead">
        <div>
          <em>YEAR BY YEAR · EXECUTION-AWARE</em>
          <h2>年別リターン・DD・取引定義</h2>
        </div>
      </div>
      <Table
        heads={[
          "年",
          "Return",
          "Max DD",
          "新規",
          "全決済",
          "注文日数",
          "回転率",
        ]}
        rows={bt.yearly.map((y) => [
          y.year,
          pct(y.return),
          pct(y.maxDd),
          y.entries,
          y.exits,
          y.orders,
          pct(y.turnover),
        ])}
      />
    </article>
  );
}

function TradesView({
  bt,
  query,
  setQuery,
  exportOrders,
}: {
  bt: Backtest;
  query: string;
  setQuery: (x: string) => void;
  exportOrders: () => void;
}) {
  const rows = bt.orders.filter(
    (o) =>
      !query ||
      `${o.signalDate}${o.executionDate}${o.reason}${o.regime}`.includes(query),
  );
  return (
    <article className="panel">
      <div className="panelHead">
        <div>
          <em>ORDER AUDIT · {bt.orders.length} ORDERS</em>
          <h2>シグナル日と約定日を分離</h2>
        </div>
        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="日付・理由を検索"
          />
          <button onClick={exportOrders}>CSV書出</button>
        </div>
      </div>
      <Table
        heads={[
          "シグナル日",
          "約定日",
          "約定価格",
          "変更前→後",
          "コスト",
          "レジーム",
          "総合",
          "20日後損益",
          "MFE",
          "MAE",
          "観察日数",
          "理由",
        ]}
        rows={rows.map((o) => [
          o.signalDate,
          o.executionDate,
          usd(o.executionPrice),
          `${o.before * 100}% → ${o.after * 100}%`,
          pct(o.cost, 3),
          o.regime,
          o.score,
          pct(o.subsequentPnl),
          pct(o.mfe),
          pct(o.mae),
          o.holdingDays,
          o.reason,
        ])}
      />
    </article>
  );
}

function RobustView({ data }: { data: ReturnType<typeof robustness> }) {
  const block = (
    title: string,
    rows: { label: string; cagr: number; sharpe: number; maxDd: number }[],
  ) => (
    <article className="panel">
      <div className="panelHead">
        <div>
          <em>STRESS TEST</em>
          <h2>{title}</h2>
        </div>
      </div>
      <Table
        heads={["条件", "CAGR", "Sharpe", "Max DD"]}
        rows={rows.map((x) => [
          x.label,
          pct(x.cagr),
          num(x.sharpe),
          pct(x.maxDd),
        ])}
      />
    </article>
  );
  return (
    <>
      <section className="robustGrid">
        {block("パラメータ近傍 ±10〜20%", data.variants)}
        {block("コスト2倍・3倍", data.cost)}
        {block("執行遅延", data.delay)}
        {block("アブレーション", data.ablation)}
        {block("配分段階比較", data.modes)}
        <article className="panel">
          <em>BOOTSTRAP · 500</em>
          <h2>取引リターン再標本化</h2>
          <section className="metrics compact three">
            <Metric label="5%点" value={pct(data.bootstrap.p05)} tone="bad" />
            <Metric label="中央値" value={pct(data.bootstrap.median)} />
            <Metric label="95%点" value={pct(data.bootstrap.p95)} tone="good" />
          </section>
        </article>
      </section>
      <section className="split">
        <article className="panel">
          <em>REGIME PERFORMANCE</em>
          <h2>レジーム別</h2>
          <Table
            heads={["レジーム", "日数", "Return", "Sharpe", "Max DD"]}
            rows={data.regime.map((x) => [
              x.name,
              x.days,
              pct(x.return),
              num(x.sharpe),
              pct(x.maxDd),
            ])}
          />
        </article>
        <article className="panel">
          <em>CRISIS WINDOWS</em>
          <h2>危機局面別</h2>
          <Table
            heads={["局面", "Return", "Max DD", "注文"]}
            rows={data.crises.map((x) => [
              x.name,
              pct(x.return),
              pct(x.maxDd),
              x.orders,
            ])}
          />
        </article>
      </section>
    </>
  );
}

function DataView({
  dataset,
  exportData,
  useDemo,
  openFiles,
}: {
  dataset: Dataset;
  exportData: () => void;
  useDemo: () => void;
  openFiles: () => void;
}) {
  return (
    <>
      <section className="dataActions">
        <button onClick={openFiles}>CSVを読み込む</button>
        <button onClick={exportData}>現在データを書き出す</button>
        <button className="ghost" onClick={useDemo}>
          デモへ切替
        </button>
      </section>
      <article className="panel">
        <div className="panelHead">
          <div>
            <em>DATA VALIDATION</em>
            <h2>品質検査結果</h2>
          </div>
          <Status
            kind={
              dataset.issues.some((x) => x.severity === "error")
                ? "bad"
                : dataset.issues.some((x) => x.severity === "warning")
                  ? "warn"
                  : "ok"
            }
          >
            {dataset.issues.length}件
          </Status>
        </div>
        {dataset.issues.length ? (
          dataset.issues.map((x, i) => (
            <div className={`issue ${x.severity}`} key={i}>
              <b>{x.severity.toUpperCase()}</b>
              <span>{x.message}</span>
            </div>
          ))
        ) : (
          <div className="issue info">
            <b>OK</b>
            <span>重大な問題はありません</span>
          </div>
        )}
      </article>
      <article className="panel">
        <em>DATA COVERAGE</em>
        <h2>銘柄別期間</h2>
        <Table
          heads={["Ticker", "開始日", "終了日", "件数", "調整価格"]}
          rows={Object.entries(dataset.tickers).map(([t, x]) => [
            t,
            x.start,
            x.end,
            x.count,
            x.adjusted ? "あり" : "なし",
          ])}
        />
        <p className="note">
          共通営業日の交差集合のみを計算に使用します。不一致日は警告して除外し、黙って補完しません。
        </p>
      </article>
      <article className="panel formula">
        <em>CSV SCHEMA</em>
        <h2>長形式・複数ファイル対応</h2>
        <code>
          Date,Open,High,Low,Close,Adj Close,Volume,Ticker
          <br />
          2025-01-02,82.1,84.0,80.2,83.5,83.5,45500000,TQQQ
        </code>
        <p>
          Ticker列がない場合はファイル名からTQQQ / QQQ / SPY /
          VIXを判定します。旧形式の横持ち終値CSVも低精度モードで読み込めます。
        </p>
      </article>
    </>
  );
}

const yen=(v:number)=>Number.isFinite(v)?new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(v):"—";

function PaperView({history,latestDate,source}:{history:LiveSnapshot[];latestDate?:string;source?:Dataset["source"]}){
  const [draft,setDraft]=useState<PaperConfig>({initialJpy:1_000_000,startDate:latestDate||"",fxRate:150}),[config,setConfig]=useState<PaperConfig|null>(null);
  useEffect(()=>{queueMicrotask(()=>{try{const saved=JSON.parse(localStorage.getItem("tqqq-paper-v1")||"null");if(saved){setConfig(saved);setDraft(saved)}}catch{}})},[]);
  const effectiveDraft={...draft,startDate:draft.startDate||latestDate||""},result=useMemo(()=>config?simulatePaper(history,config):null,[history,config]),start=()=>{if(!effectiveDraft.startDate||effectiveDraft.initialJpy<=0||effectiveDraft.fxRate<=0)return;localStorage.setItem("tqqq-paper-v1",JSON.stringify(effectiveDraft));setConfig(effectiveDraft)},reset=()=>{if(!window.confirm("この端末のPaper Trading設定を初期化しますか？"))return;localStorage.removeItem("tqqq-paper-v1");setConfig(null)};
  return <>
    <article className="panel paperIntro">
      <div><em>LIVE PAPER TRADING · DEVICE LOCAL</em><h2>実際に公開された日次Signalだけで追跡</h2><p>Historical Backtestとは完全に別です。設定はこの端末だけに保存され、公開履歴の各Signalを翌営業日始値で再現します。固定USD/JPYは為替損益を混ぜないための換算仮定です。</p></div>
      <Status kind={source==="demo"?"bad":history.length?"ok":"warn"}>{source==="demo"?"デモデータでは開始不可":`${history.length}日分の公開履歴`}</Status>
    </article>
    <article className="panel paperSetup">
      <div className="paperFields">
        <label>初期仮想資金（円）<input type="number" min="1" value={draft.initialJpy} onChange={e=>setDraft({...draft,initialJpy:Number(e.target.value)})}/></label>
        <label>開始日<input type="date" value={effectiveDraft.startDate} max={latestDate} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label>
        <label>固定USD/JPY換算レート<input type="number" min="1" value={draft.fxRate} onChange={e=>setDraft({...draft,fxRate:Number(e.target.value)})}/></label>
      </div>
      <div className="paperButtons"><button disabled={source==="demo"||!history.length} onClick={start}>{config?"設定を更新":"Paper Tradingを開始"}</button>{config&&<button className="ghost" onClick={reset}>端末設定を初期化</button>}</div>
      <p className="note">開始後の日次更新は自動です。公開履歴が増えるたびに、この端末で同じ取引を再計算します。サーバーへ資金情報は送信しません。</p>
    </article>
    {result&&<>
      <section className="metrics paperMetrics">
        <Metric label="初期資金" value={yen(config!.initialJpy)}/><Metric label="現在資産" value={yen(result.equityJpy)} tone="good"/><Metric label="TQQQ評価額" value={yen(result.tqqqValueJpy)}/><Metric label="現金" value={yen(result.cashJpy)}/><Metric label="保有口数" value={num(result.shares,4)}/><Metric label="平均取得価格" value={usd(result.avgPrice)}/>
        <Metric label="累積損益" value={yen(result.pnlJpy)}/><Metric label="累積Return" value={pct(result.totalReturn)}/><Metric label="年率換算" value={pct(result.cagr)}/><Metric label="最大DD" value={pct(result.maxDd)} tone="bad"/><Metric label="現在DD" value={pct(result.currentDd)}/><Metric label="売買注文" value={`${result.trades.length}回`}/>
        <Metric label="勝率（売却）" value={pct(result.winRate)}/><Metric label="平均利益" value={yen(result.avgWin)}/><Metric label="平均損失" value={yen(result.avgLoss)} tone="bad"/><Metric label="TQQQ B&H" value={pct(result.tqqqReturn)}/><Metric label="QQQ B&H" value={pct(result.qqqReturn)}/>
      </section>
      <article className="panel"><div className="panelHead"><div><em>LIVE PAPER EQUITY</em><h2>仮想ポートフォリオ資産推移</h2></div><span>開始日以降・未来データ不使用・翌営業日始値約定</span></div><Curve points={result.curve.map(x=>({equity:x.equityJpy}))} label="Live Paper Trading資産推移"/></article>
      <article className="panel"><div className="panelHead"><div><em>PAPER ORDER LOG</em><h2>仮想売買履歴</h2></div></div><Table heads={["判定日","約定日","売買","目標比率","約定価格","数量","手数料","資産額","理由"]} rows={result.trades.map(t=>[t.signalDate,t.executionDate,t.side,`${t.before*100}%→${t.after*100}%`,usd(t.price),num(t.quantity,4),usd(t.commissionUsd),yen(t.equityJpy),`${t.reason} / Score ${t.score}`])}/></article>
    </>}
    {!config&&<article className="panel emptyPaper"><h2>まだ開始していません</h2><p>上の3項目を確認し「Paper Tradingを開始」を押してください。履歴は開始日より後に公開されたSignalだけで増えます。</p></article>}
  </>;
}

function SystemStatusView({status,latestDate,history}:{status:RuntimeStatus|null;latestDate?:string;history:LiveSnapshot[]}){
  const [pwa,setPwa]=useState<boolean|null>(null);useEffect(()=>{const check=()=>"serviceWorker" in navigator?navigator.serviceWorker.getRegistration().then(r=>setPwa(Boolean(r))).catch(()=>setPwa(false)):setPwa(false);if(document.readyState==="complete")check();else{window.addEventListener("load",check,{once:true});return()=>window.removeEventListener("load",check)}},[]);
  const operational=Boolean(status&&status.actionStatus==="success"&&status.jsonValid&&status.paperHistoryValid&&status.state!=="not_updated"),state=(ok?:boolean)=>ok?"正常":"要確認";
  return <>
    <article className={`systemHero ${operational?"ok":"bad"}`}><em>SYSTEM STATUS</em><h2>{operational?"All Systems Operational":"確認が必要です"}</h2><p>{status?.message||"status.jsonをまだ確認できません"}</p></article>
    <section className="statusGrid">
      <Metric label="GitHub Actions最終結果" value={status?.actionStatus==="success"?"成功":status?.actionStatus==="failed"?"失敗":"未確認"} sub={status?.generatedAt||"—"}/>
      <Metric label="最新市場データ日" value={status?.marketDataDate||latestDate||"—"}/>
      <Metric label="最新Signal生成日" value={status?.signalDate||"—"}/>
      <Metric label="JSON" value={state(status?.jsonValid)} tone={status?.jsonValid?"good":"bad"}/>
      <Metric label="PWA対応ブラウザ" value={pwa===null?"確認中":state(pwa)} tone={pwa?"good":"bad"}/>
      <Metric label="Paper Trading履歴" value={status?.paperHistoryValid?`${history.length}日・正常`:"要確認"} tone={status?.paperHistoryValid?"good":"bad"}/>
    </section>
    {status?.errors?.length?<article className="issueBlock"><h2>発生した問題</h2>{status.errors.map((e,i)=><p key={i}>× {e}</p>)}</article>:<article className="panel"><em>NO ACTIVE ERROR</em><h2>エラー記録なし</h2><p className="note">休場日は「米国市場休場・新規判定なし」、平日にデータが変わらなければ「最新データ未更新」と明示します。取得失敗時は以前のSignalを上書きしません。</p></article>}
  </>;
}

const GUIDE_STEPS=[
  ["このツールでできること","米国市場終了後にTQQQ・QQQ・SPY・VIXを検査し、Signalと翌営業日の理論目標を表示します。","最上部の「最終データ日」「最終計算日時」「データ取得状態」を見ます。"],
  ["GitHubアカウントを作る","github.comを開き、Sign upからメールアドレス、パスワード、ユーザー名を登録します。","登録メールに届く確認コードを入力し、GitHubへログインします。"],
  ["プロジェクトを自分のGitHubへ置く","配布元のTQQQ Signal LabリポジトリでForkを押すと、自分専用のコピーができます。","右上のFork → Create forkを押し、完了するまで待ちます。"],
  ["GitHub Pagesを有効にする","作成したリポジトリのSettingsから公開方法を設定します。","Settings → 左のPages → SourceでGitHub Actionsを選びます。選択済み表示になれば成功です。"],
  ["GitHub Actionsを有効にする","上部のActionsを開きます。確認画面が出た場合だけ有効化します。","Actions → I understand my workflows, go ahead and enable them を押します。"],
  ["最初の手動実行","Daily TQQQ Signalを手動で一度動かし、取得・計算・テスト・公開を確認します。","Actions → Daily TQQQ Signal → Run workflow → 緑のRun workflow。数分後に緑のチェックなら成功です。"],
  ["サイトURLを開く","Settings → Pagesに表示される Your site is live at のURLがアプリです。","URLを押して、上部に最新データ日が表示されることを確認します。"],
  ["iPhoneのSafariで開く","LINE等の内蔵ブラウザではなくSafariでサイトを開きます。","URLを長押しまたは共有し「Safariで開く」を選びます。"],
  ["共有を押す","Safari下部の四角から上矢印が出たボタンです。","共有ボタンを1回押します。"],
  ["ホーム画面に追加","共有メニューを下へ動かし「ホーム画面に追加」を選びます。","名前を確認 → 右上の追加を押します。"],
  ["ホーム画面から起動","TQアイコンを押すと、アプリ風の全画面で起動します。","ホーム画面へ戻り、TQQQ Signal Labを1回押します。"],
  ["仮想資金を入力","Paper Tradingタブで初期資金・開始日・固定換算レートを設定します。","例として1,000,000円、今日の日付、USD/JPY 150を入力します。"],
  ["ペーパートレード開始","開始後は公開Signal履歴から毎回同じ約定を再計算します。","Paper Tradingを開始を押し、現在資産が表示されれば成功です。"],
  ["翌日以降に見る場所","原則、朝にホーム画面から開くだけです。","データ取得状態 → 本日の判断 → 目標比率 → Paper資産の順に確認します。"],
  ["Signal変更の意味","75%→50%は、判定日の終値で縮小が確定し、次の米国営業日始値で25%分を減らす意味です。","実行予定日と売買なし／増加／縮小を読み、Signalが同じなら売買しません。"],
] as const;
function GuideView(){return <>
  <article className="guideHero"><em>ZERO-KNOWLEDGE WALKTHROUGH</em><h2>初めて使う方へ</h2><p>上から順番に進めれば、GitHubを初めて使う方でも無料の自動更新とiPhoneアプリ化まで設定できます。</p></article>
  <section className="guideSteps">{GUIDE_STEPS.map((s,i)=><article className="guideStep" key={s[0]}><b>STEP {i+1}</b><h2>{s[0]}</h2><p>{s[1]}</p><div><strong>あなたが今やること</strong><p>{s[2]}</p></div></article>)}</section>
  <article className="panel trouble"><em>TROUBLESHOOTING</em><h2>うまく動かない時</h2><Table heads={["症状","見る場所","初心者向けの意味と操作"]} rows={[["Actionsが赤い","Actions → 最新実行 → 赤い工程","自動処理が途中で止まりました。赤い工程を開き、表示文を確認します。Signalは更新されません。"],["サイトが404","Settings → Pages","SourceがGitHub Actionsか確認。初回実行が緑になってから数分待ちます。"],["データが古い","System Status → Actions","休場なら正常です。平日ならRun workflowを手動実行します。"],["Signalが表示されない","System Status → JSON","ActionsのGenerate signalが成功しているか確認します。推測値への置換はしません。"],["Paperが増えない","Paper Tradingの開始日と履歴日数","Signalが同じ日は売買しません。公開履歴が翌営業日まで増えているか確認します。"]]}/></article>
  <article className="panel formula"><em>COST & PRIVACY</em><h2>想定月額コスト：0円</h2><p>公開リポジトリのGitHub Pages / GitHub Actions無料枠、APIキー不要の公開データ取得、端末内保存を前提にしています。GitHubの利用条件や無料枠が将来変わる可能性はあります。</p><code>市場データ → GitHub Actions → Signal Engine → signal.json → GitHub Pages → iPhone PWA</code></article>
  </>}

function SpecView() {
  return (
    <>
      <section className="auditGrid">
        {Object.values(STRATEGIES).map((s) => (
          <article className="panel rule" key={s.key}>
            <em>{s.key.toUpperCase()}</em>
            <h2>{s.name}</h2>
            <p>
              Trend {s.weights.trend * 100}% / Momentum{" "}
              {s.weights.momentum * 100}% / Volatility{" "}
              {s.weights.volatility * 100}% / Market {s.weights.market * 100}%
            </p>
            <dl>
              <dt>Entry / Exit / Strong</dt>
              <dd>
                {s.entry} / {s.exit} / {s.strong}
              </dd>
              <dt>確認 / 最低保有 / 再Entry待機</dt>
              <dd>
                {s.confirmDays}日 / {s.minHold}日 / {s.cooldown}日
              </dd>
              <dt>Trail Stop</dt>
              <dd>{s.trailStop * 100}%</dd>
              <dt>自由パラメータ</dt>
              <dd>11個（重み4、閾値3、期間3、Stop1）</dd>
            </dl>
          </article>
        ))}
      </section>
      <article className="panel formula">
        <em>NO LOOK-AHEAD EXECUTION</em>
        <h2>標準約定モデル</h2>
        <code>
          t日終値でシグナル確定 → t+1始値まで旧配分 → t+1始値で注文・コスト控除
          → t+1始値以降を新配分
        </code>
        <p>
          Openがない場合のみt+1終値約定へ落とし、「低精度」と表示します。調整係数
          Adj Close / Close をOHLCへ掛けます。
        </p>
      </article>
      <article className="panel">
        <em>INDICATOR AUDIT</em>
        <h2>独立カテゴリーと式</h2>
        <Table
          heads={["カテゴリー", "入力", "計算", "役割"]}
          rows={[
            [
              "Trend",
              "QQQ",
              "終値>SMA200、SMA50>SMA200、SMA200の20日傾き",
              "長期・中期方向",
            ],
            ["Momentum", "QQQ", "63日リターン＋RSI(14)", "上昇速度と過熱"],
            [
              "Volatility",
              "QQQ/VIX",
              "20日実現Vol、ATR(20)、VIX",
              "リスク環境",
            ],
            ["Market", "SPY", "SMA200、63日リターン", "市場全体確認"],
          ]}
        />
        <p className="note">
          TQQQ価格は約定・損益・トレーリングストップに使用。市場レジームの主判断はQQQです。
        </p>
      </article>
      <article className="panel formula">
        <em>SELECTION</em>
        <h2>目的関数</h2>
        <code>{OBJECTIVE}</code>
      </article>
    </>
  );
}
