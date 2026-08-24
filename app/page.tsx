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
import {researchBundle} from "../lib/research";
import type {DeepResearchBundle} from "../lib/research";
import {summarizeForward,type ForwardLedger} from "../lib/forward";
import type {CrossBundle} from "../lib/cross-ticker";
import type {TickerForwardLedger} from "../lib/ticker-forward";
import type {NativeResearchBundle} from "../lib/native-research";
import {HEALTH_POLICY,DEGRADATION_RULES,PRODUCTION_SYSTEMS,type ProductionConfig} from "../lib/production";

type RuntimeStatus={generatedAt?:string;actionRunId?:string;actionStatus?:"success"|"failed";marketDataDate?:string;signalDate?:string;lastForwardRecord?:string;forwardRecords?:number;forwardPersistent?:boolean;buildVersion?:string;dataSource?:string;jsonValid?:boolean;pwaExpected?:boolean;paperHistoryValid?:boolean;state?:"latest"|"market_closed"|"market_pending"|"not_updated"|"failed";message?:string;errors?:string[]};
type SignalShape=Backtest["daily"][number]["signal"];
type DailySignalFile={generatedAt:string;dataDate:string;source:string;platformMode?:string;assetTicker?:string;assetClose?:number;tqqqClose:number;strategy:string;strategyVersion?:string;state:RuntimeStatus["state"];signal:SignalShape&{executionDate?:string};suggestion:string;validation?:{holdout?:Backtest["metrics"]|null};warnings?:string[]};
type AnalysisBundle={bt?:Backtest;wf?:ReturnType<typeof walkForward>;rob?:ReturnType<typeof robustness>;research?:ReturnType<typeof researchBundle>;comparison?:ReturnType<typeof oosComparison>;holdout?:ReturnType<typeof holdoutForConfig>;tqqq?:Backtest["metrics"];qqq?:Backtest["metrics"]};
const EXECUTION_ASSUMPTION="t日終値判定 → t+1営業日始値約定 / 手数料3bps + スリッページ5bps";

const pct = (v: number, d = 1) =>
    Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—",
  num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—"),
  usd = (v: number) => (Number.isFinite(v) ? `$${v.toFixed(2)}` : "—");
const TABS = [
  ["signal", "今日のシグナル"],
  ["forward", "Forward Test"],
  ["compare", "戦略比較"],
  ["walk", "Walk-Forward"],
  ["year", "年別成績"],
  ["trades", "取引履歴"],
  ["robust", "頑健性検証"],
  ["research", "研究監査"],
  ["deep", "Challenger研究"],
  ["universe", "ETF横断研究"],
  ["native", "Native戦略研究"],
  ["production", "Production"],
  ["data", "データ管理"],
  ["paper", "Paper Trading"],
  ["status", "System Status"],
  ["guide", "初めて使う方へ"],
  ["roadmap", "Roadmap"],
  ["glossary", "用語集"],
  ["spec", "計算・戦略仕様"],
] as const;
type Tab = (typeof TABS)[number][0];
const RESEARCH_TABS=new Set<Tab>(["compare","walk","year","trades","robust","research","data"]);
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
const HELP:Record<string,string>={
  "Total Return":"開始から終了まで資産が合計で何%増減したか。実際の資産曲線の最終値から計算します。",
  "CAGR":"複利でならした年平均成長率です。Total Returnと期間の両方を反映します。",
  "Sharpe":"値動き全体に対して得られた収益の効率。一般に高いほど安定的ですが、将来を保証しません。",
  "Sortino":"下落方向の値動きだけをリスクとして測る収益効率です。",
  "最大DD":"過去の最高資産から最大で何%減ったか。−30%なら100万円が一時70万円になった規模です。",
  "Calmar":"CAGR÷最大DDの絶対値。成長と深い下落のバランスを重視する指標です。",
  "年率Vol":"日々の変動の大きさを年率換算した値です。小さいほど値動きが穏やかです。",
  "Ulcer Index":"下落の深さと長さを同時に測ります。小さいほど回復しやすい資産曲線です。",
  "Exposure":"平均して資金の何%をTQQQへ配分していたかです。",
  "回復日数":"最大DD前の資産最高値へ戻るまでの営業日数です。未回復なら未回復と表示します。",
};
const metricHelp=(label:string)=>HELP[label]||`${label}の計算期間・データ・約定仮定は、この画面のラベルと計算仕様で確認できます。`;

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
    <div className={`metric ${tone}`}>
      <details className="metricHelp"><summary>{label} ⓘ</summary><p>{title||metricHelp(label)}</p></details>
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
    [liveHistory,setLiveHistory]=useState<LiveSnapshot[]>([]),
    [forwardLedger,setForwardLedger]=useState<ForwardLedger|null>(null),
    [crossResearch,setCrossResearch]=useState<CrossBundle|null>(null),
    [tickerForward,setTickerForward]=useState<TickerForwardLedger|null>(null),
    [nativeResearch,setNativeResearch]=useState<NativeResearchBundle|null>(null),
    [productionConfig,setProductionConfig]=useState<ProductionConfig|null>(null),
    [tickerForwardStatus,setTickerForwardStatus]=useState<{status:string;marketDataDate:string|null;records:number;version:string;errors:string[]}|null>(null);
  const [deepResearch,setDeepResearch]=useState<DeepResearchBundle|null>(null),[deepLoading,setDeepLoading]=useState(false);
  const fileRef = useRef<HTMLInputElement>(null),marketRequested=useRef(false),deepRequested=useRef(false),analysisWorker=useRef<Worker|null>(null),analysisRequest=useRef(0);
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
      fetchJson(new URL("forward-ledger.json",staticData)).then(setForwardLedger),
      fetchJson(new URL("production-config.json",staticData)).then(setProductionConfig),
    ]).then((results)=>{
      if(results[0].status==="rejected")setMessage("最新Signalを取得できません。System Statusを確認してください。");
      setLoading(false);
    });
  }, []);
  useEffect(()=>{
    if(tab!=="universe"||(crossResearch&&tickerForward))return;
    const load=(name:string)=>fetch(new URL(`./data/${name}`,document.baseURI),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(`${r.status}`);return r.json()});
    Promise.allSettled([load("cross-ticker.json").then(setCrossResearch),load("ticker-forward-ledger.json").then(setTickerForward),load("ticker-forward-status.json").then(setTickerForwardStatus)]).then(results=>{if(results[0].status==="rejected")setMessage("ETF横断研究は初回Weekly Quant Researchの完了後に表示されます。");});
  },[tab,crossResearch,tickerForward]);
  useEffect(()=>{
    if(tab!=="native"||nativeResearch)return;
    fetch(new URL("./data/native-research.json",document.baseURI),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(String(r.status));return r.json()}).then(setNativeResearch).catch(()=>setMessage("Native研究はWeekly Quant Researchの実行後に表示されます。"));
  },[tab,nativeResearch]);
  useEffect(()=>{
    if(tab!=="deep"||deepResearch||deepRequested.current)return;
    deepRequested.current=true;queueMicrotask(()=>setDeepLoading(true));const url=new URL("./data/deep-research.json",document.baseURI);
    fetch(url,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(`${r.status}`);return r.json()}).then(setDeepResearch).catch(()=>setMessage("週次研究レポートがまだありません。GitHub ActionsのWeekly Quant Researchを手動実行してください。" )).finally(()=>setDeepLoading(false));
  },[tab,deepResearch]);
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
    if(!dataset||dataset.issues.some((x)=>x.severity==="error")||!["compare","walk","year","trades","robust","research"].includes(tab))return;
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
    latestClose=dailySignal?.assetClose||dailySignal?.tqqqClose||latest?.tqqq.close,
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
  const statusKind=runtimeStatus?.state==="failed"?"bad":["not_updated","market_pending"].includes(runtimeStatus?.state||"")?"warn":runtimeStatus?"ok":"neutral";
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
        {dataset&&analysisLoading&&["compare","walk","year","trades","robust","research"].includes(tab)&&(
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
        {signal&&latestClose!==undefined&&fresh&&tab === "signal" && (<>
          {forwardLedger&&<ForwardMini ledger={forwardLedger}/>}
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
            ticker={dailySignal?.assetTicker||"TQQQ"}
          />
        </>)}
        {tab==="forward" && (forwardLedger?<ForwardView ledger={forwardLedger}/>:<section className="emptyState"><span>FORWARD RECORD</span><h2>Forward台帳を確認できません</h2><p>System StatusでFORWARD-001を確認してください。</p></section>)}
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
        {analysis?.research && tab === "research" && <ResearchView data={analysis.research}/>} 
        {tab === "deep" && (deepResearch?<DeepResearchView data={deepResearch}/>:<section className="emptyState"><span>WEEKLY DEEP RESEARCH</span><h2>{deepLoading?"事前計算レポートを読込中":"レポート未生成"}</h2><p>日常Signalを遅くしないため、複数Walk-Forward窓とChallenger比較は週次Actionsで事前計算します。</p></section>)}
        {tab === "universe" && (crossResearch?<CrossTickerView data={crossResearch} forward={tickerForward} forwardStatus={tickerForwardStatus}/>:<section className="emptyState"><span>TRACK B</span><h2>ETF横断研究を読込中</h2><p>Track Aの日次Signalとは分離した週次研究です。初回Weekly Quant Research完了後に表示されます。</p></section>)}
        {tab === "native" && (nativeResearch?<NativeResearchView data={nativeResearch}/>:<section className="emptyState"><span>TRACK B2</span><h2>Native戦略研究を読込中</h2><p>各Ticker最大3系統、最終候補1本という研究予算で計算します。</p></section>)}
        {tab === "production" && <ProductionView config={productionConfig}/>} 
        {dataset && tab === "data" && (
          <DataView
            dataset={dataset}
            exportData={exportData}
            useDemo={useDemo}
            openFiles={() => fileRef.current?.click()}
          />
        )}
        {tab === "paper" && <PaperView
          history={liveHistory.filter(x=>(x.assetTicker||"TQQQ")===(dailySignal?.assetTicker||"TQQQ")&&(x.strategyVersion||"VS13-v1.0")===(dailySignal?.strategyVersion||"VS13-v1.0"))}
          latestDate={latestDate}
          source={dataset?.source||(dailySignal?"auto":undefined)}
          ticker={dailySignal?.assetTicker||"TQQQ"}
        />}
        {tab === "status" && <SystemStatusView status={runtimeStatus} latestDate={latestDate} history={liveHistory} forward={forwardLedger}/>}
        {tab === "guide" && <><GuideView/><LifecycleGuide/><RecoveryPromptPack/></>}
        {tab === "roadmap" && <RoadmapV2/>}
        {tab === "glossary" && <GlossaryView/>}
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
  ticker,
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
  ticker:string;
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
          <p className="price">{ticker} {usd(latestClose)}</p>
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
            ["ratio", `${ticker}保有比率 (%)`],
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
        <Metric label="Total Return" value={pct(analysis.bt.metrics.totalReturn)} sub="資産曲線から直接計算" />
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
        <Metric label="年率Vol" value={pct(analysis.bt.metrics.annualizedVolatility)} />
        <Metric label="Ulcer Index" value={pct(analysis.bt.metrics.ulcerIndex)} />
        <Metric label="Exposure" value={pct(analysis.bt.metrics.exposure)} />
        <Metric label="回復日数" value={analysis.bt.metrics.recoveryDays===null?"未回復":`${analysis.bt.metrics.recoveryDays}営業日`} />
        <Metric label="初期資金" value="¥1,000,000" />
        <Metric label="最終資産" value={`¥${Math.round(1_000_000*(1+analysis.bt.metrics.totalReturn)).toLocaleString("ja-JP")}`} sub={`累積利益 ¥${Math.round(1_000_000*analysis.bt.metrics.totalReturn).toLocaleString("ja-JP")}`} />
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
            <em>DIAGNOSTIC HOLDOUT · 固定期間</em>
            <h2>{wf.holdout.startYear}年以降</h2>
            <p>
              過去の開発ですでに結果を閲覧済みのため、純粋な未接触Holdoutとは呼びません。今後の変更判断には使わず固定します。選択:{" "}
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

function ForwardMini({ledger}:{ledger:ForwardLedger}){
  const rows=summarizeForward(ledger),champ=rows.find(x=>x.id==="VS13")!;
  return <article className="panel health"><div className="panelHead"><div><em>FORWARD VALIDATION · IMMUTABLE</em><h2>現在のChampion：VS13-v1.0</h2></div><Status kind="warn">{champ.evidence} Evidence</Status></div><section className="metrics compact"><Metric label="Forward資産" value={yen(champ.currentCapital)} sub={pct(champ.totalReturn)}/><Metric label="現在DD" value={pct(champ.currentDd)}/><Metric label="注文" value={String(champ.orders)+"回"}/><Metric label="次の正式Review" value={ledger.reviewSchedule.sixMonth}/></section><p className="note">まだForward期間が短いため順位は確定していません。Championの自動変更は行いません。</p></article>;
}

function ForwardView({ledger}:{ledger:ForwardLedger}){
  const rows=summarizeForward(ledger),champ=rows.find(x=>x.id==="VS13")!;
  return <>
    <article className="guideHero"><em>STRATEGY FORWARD TEST · APPEND ONLY</em><h2>未来データで戦略を正式比較</h2><p>2026-08-21以降、その日に公開されたSignalだけを保存します。後日の再計算で当時のSignalを上書きしません。</p></article>
    <section className="glossaryGrid">
      <article className="panel"><em>BALANCED CHAMPION</em><h2>VS13 — バランス型</h2><p>相場が悪化した時、保有後のTQQQ高値から13%下がることを防御条件の一つにします。成長力と下落抑制の釣り合いが最も安定していたため、現在の基準戦略です。</p><p className="note">平易に言えば「上昇には参加し、危険が強まれば段階的に現金へ逃げる」戦略です。</p></article>
      <article className="panel"><em>GROWTH CHALLENGER</em><h2>VS12 — やや早く守る成長候補</h2><p>基本ロジックはVS13と同じですが、高値から12%下がった段階で防御を強めます。過去成績は少し良好でも、12%を過去データを見て選んだ影響を否定できません。</p><p className="note">数字だけで昇格させず、これからの日々で本当に再現するか競わせます。</p></article>
      <article className="panel"><em>DEFENSIVE CANDIDATE</em><h2>VT30 — 値動きを抑える守備型</h2><p>危険な相場ではTQQQの比率をより細かく落とし、ポートフォリオ全体の年率変動を約30%へ近づけます。上昇利益は減りやすい一方、大きな下落を抑える目的です。</p><p className="note">VS13の単純な敗者ではなく「眠りやすさを重視する別目的の候補」です。</p></article>
    </section>
    <section className="metrics"><Metric label="Balanced Champion" value="VS13-v1.0"/><Metric label="開始資金" value={yen(1_000_000)}/><Metric label="開始日" value={ledger.freezes[0]?.startDate||"—"}/><Metric label="6か月Review" value={ledger.reviewSchedule.sixMonth}/><Metric label="12か月Review" value={ledger.reviewSchedule.twelveMonth}/><Metric label="24か月Review" value={ledger.reviewSchedule.twentyFourMonth}/></section>
    <article className="panel"><em>FORWARD LEADERBOARD</em><h2>Historicalとは分離した現在順位</h2><Table heads={["Strategy","Version","区分","現在資産","Total Return","Max DD","Sortino","Calmar","注文","Evidence","判定"]} rows={rows.map(x=>[x.name,x.version,x.category,yen(x.currentCapital),pct(x.totalReturn),pct(x.metrics.maxDd),x.observations<20?"—":num(x.metrics.sortino),x.observations<63?"—":num(x.metrics.calmar),x.orders,x.evidence,x.status])}/><p className="warningNote">1年未満は年率値を強調しません。Total Return・DD・実注文・経験Regimeを優先します。</p></article>
    <section className="split"><article className="panel"><em>FORWARD EQUITY CURVES</em><h2>100万円を同時スタート</h2>{ledger.freezes.map(f=>{const points=ledger.records.filter(r=>r.strategyVersion===f.version).map(r=>({equity:r.equity}));return <div key={f.version}><strong>{f.version}</strong><Curve points={points} label={f.version+" Forward Equity"}/></div>})}</article><article className="panel"><em>UNDERWATER STATUS</em><h2>最高値からの下落</h2><Table heads={["Version","現在DD","最大DD","回復日数"]} rows={rows.map(x=>[x.version,pct(x.currentDd),pct(x.metrics.maxDd),x.metrics.recoveryDays===null?"未回復":String(x.metrics.recoveryDays)+"日"])}/></article></section>
    <article className="panel"><em>EVIDENCE METER</em><h2>期間だけで昇格させない</h2><Table heads={["Strategy","経過観測","注文","Regime数","欠測","Evidence","現在DD","累積コスト"]} rows={rows.map(x=>[x.version,x.observations,x.orders,x.regimes,x.missing,x.evidence,pct(x.currentDd),yen(x.transactionCosts)])}/><p className="note">Strong条件：252観測以上・6注文以上・4 Regime以上・欠測1%以下。12か月経過しても条件不足ならEvidence Insufficientのままです。</p></article>
    <article className="panel formula"><em>PRE-REGISTERED PROMOTION RULE</em><h2>Champion昇格条件</h2><code>{ledger.promotionRule}</code><p>GitHub Actionsは候補を表示するだけです。最終変更には人間の承認が必要です。</p></article>
    <article className="panel"><em>RESEARCH FREEZE</em><h2>固定Versionと約定仮定</h2><Table heads={["Version","役割","Stop / Sizing","判定","約定","費用"]} rows={ledger.freezes.map(x=>[x.version,x.role,x.config?(x.config.sizing==="volTarget"?"30% Vol Target":String(Math.round(x.config.trailStop*100))+"% Stop"):"Buy & Hold",x.assumptions.signal,x.assumptions.execution,String(x.assumptions.commissionBps+x.assumptions.slippageBps)+" bps"])}/></article>
    <article className="panel"><em>HISTORICAL vs FORWARD</em><h2>再現性判定</h2><p>{champ.observations<63?"Forward観測が63営業日未満のため、Historical performance has not replicatedという判定はまだ行いません。":"ForwardとHistorical OOSの乖離を確認できる期間に入りました。週次研究のDegradation警告を確認してください。"}</p></article>
  </>;
}

function CrossTickerView({data,forward,forwardStatus}:{data:CrossBundle;forward:TickerForwardLedger|null;forwardStatus:{status:string;marketDataDate:string|null;records:number;version:string;errors:string[]}|null}){
  return <>
    <article className="guideHero"><em>TRACK B · LEVERAGED ETF SELECTION</em><h2>そもそもTQQQが最適かを別Trackで検証</h2><p>Track AのForwardは変更せず、実ETF価格と共通ルールで比較します。Synthetic値は混ぜません。</p></article>
    <article className="panel"><em>ONLINE MARKET SCREENING · {data.asOf}</em><h2>Shortlist 5銘柄</h2><Table heads={["Ticker","Issuer","Underlying","Proxy","設定日","費用","AUM","公式出来高","Spread","Operational","理由"]} rows={data.screening.map(x=>[x.ticker,x.issuer,x.underlying,x.proxy,x.inception,pct(x.expenseRatio,2),x.aumUsd?"$"+(x.aumUsd/1e9).toFixed(1)+"B":"公式HTML未確認",x.dailyVolume.toLocaleString(),x.medianSpread===null?"公式HTML未確認":pct(x.medianSpread,2),x.operationalQuality,x.reason])}/><p className="note">未確認値を推測で埋めていません。TQQQ/UPROのAUMとmedian spreadはProShares公表値です。</p></article>
    {data.results.length>0&&<><article className="panel"><em>COMMON FRAMEWORK · ACTUAL ETF DATA</em><h2>同じVS13ルールによるOOS・共通期間比較</h2><Table heads={["Ticker","実データ期間","OOS CAGR","OOS Max DD","OOS Sortino","OOS Calmar","共通期間CAGR","共通期間DD","30%Vol DD","Operational","Score","Pareto"]} rows={data.results.map(x=>[x.ticker,x.dataStart+"〜"+x.dataEnd,pct(x.oos.cagr),pct(x.oos.maxDd),num(x.oos.sortino),num(x.oos.calmar),pct(x.common.cagr),pct(x.common.maxDd),pct(x.normalized.maxDd),x.operationalQuality,num(x.researchScore,3),x.pareto?"YES":"NO"])}/><p className="note">Common period開始：{data.commonStart||"未計算"}。Ticker別の一点最適化は行いません。</p></article><article className="panel health"><em>FORWARD CANDIDATE GATE</em><h2>{data.forwardCandidates.length?data.forwardCandidates.join(" / "):"Evidence不足"}</h2><p>{data.selectionRule}</p><p className="warningNote">Forward候補であり、TQQQ Championを自動で置き換える判断ではありません。</p></article></>}
    <article className="panel"><div className="panelHead"><div><em>TICKER FORWARD · ISOLATED TRACK</em><h2>UPRO Common / Native</h2></div><Status kind={forwardStatus?.status==="success"?"ok":"warn"}>{forwardStatus?.status||"初回実行待ち"}</Status></div><section className="metrics compact"><Metric label="Common" value="UPRO-VS13-v1.0"/><Metric label="Native" value={forward?.freezes.find(x=>x.id==="UPRO_NATIVE")?.version||"初回実行待ち"}/><Metric label="最終市場日" value={forwardStatus?.marketDataDate||"初回実行待ち"}/><Metric label="Immutable records" value={String(forwardStatus?.records??forward?.records.length??0)}/></section><p className="note">UPRO取得・記録は独立Workflowです。失敗してもTQQQの日次Signalや既存Forward台帳を変更しません。</p>{forwardStatus?.errors?.length?<p className="warningNote">{forwardStatus.errors.join(" / ")}</p>:null}</article>
    <article className="panel"><em>EXCLUDED REGISTRY</em><h2>除外結果も保存</h2><Table heads={["候補","除外理由"]} rows={data.excluded.map(x=>[x.ticker,x.reason])}/></article>
    <section className="glossaryGrid">{data.screening.map(x=><article className="panel" key={x.ticker}><em>OFFICIAL SOURCE</em><h2>{x.ticker}</h2><p>{x.underlying} / {x.leverage}</p><a href={x.officialUrl} target="_blank" rel="noreferrer">発行会社公式ページを開く</a></article>)}</section>
    <article className="issueBlock"><em>LIMITATIONS</em><h2>研究上の未解決点</h2>{data.limitations.map((x,i)=><p key={i}>• {x}</p>)}</article>
  </>;
}

function NativeResearchView({data}:{data:NativeResearchBundle}){return <>
  <article className="guideHero"><em>TRACK B2 · HYPOTHESIS FIRST</em><h2>Tickerごとの専用戦略を1本だけ選ぶ</h2><p>共通戦略との公平比較を残し、各Ticker最大3系統・候補1本・Forward全体6本以内に制限します。</p></article>
  <article className="panel formula"><em>ANTI-OVERFITTING BUDGET</em><h2>事前固定した研究ルール</h2><code>{data.policy}</code><p>{data.forwardCap}</p></article>
  {data.results.map(r=><article className="panel" key={r.ticker}><div className="panelHead"><div><em>{r.ticker} · {r.families} FAMILIES</em><h2>{r.nativeCandidate||"NO NATIVE CANDIDATE"}</h2></div><Status kind={r.status==="CANDIDATE SELECTED"?"ok":"warn"}>{r.status}</Status></div><Table heads={["区分","戦略","Parameter","OOS CAGR","OOS DD","Sortino","Calmar","注文/年","25bps CAGR","T+2 CAGR","勝越年","Plateau","Gate","判断"]} rows={r.experiments.map(x=>[x.family==="shield"?"Common基準":"Native",x.name,x.parameter,pct(x.oos.cagr),pct(x.oos.maxDd),num(x.oos.sortino),num(x.oos.calmar),num(x.oos.ordersPerYear,1),pct(x.stress25.cagr),pct(x.delay2.cagr),pct(x.positiveYearShare),x.stable?"PASS":"FAIL",x.gatePassed?"PASS":"FAIL",x.decision+" — "+x.reason])}/><p className="note">仮説：{r.hypothesis}</p>{r.version&&<p><strong>固定候補Version：</strong> {r.version}</p>}</article>)}
  <article className="panel"><em>REJECTED EXPERIMENTS</em><h2>不採用結果も保存</h2><Table heads={["Ticker","Family","理由"]} rows={data.results.flatMap(r=>r.experiments.filter(x=>x.decision==="REJECT").map(x=>[r.ticker,x.name,x.reason]))}/></article>
  <article className="issueBlock"><em>RESEARCH LIMITATIONS</em><h2>まだProduction判断には使えません</h2>{data.limitations.map((x,i)=><p key={i}>• {x}</p>)}</article>
 </>}

function ProductionView({config}:{config:ProductionConfig|null}){const c=config;return <>
  <article className="guideHero"><em>PLATFORM MODE</em><h2>{c?.mode||"設定確認中"}</h2><p>{c?.mode==="PRODUCTION"?"Human Approval済みの1システムだけをPrimary Signalとして日次運用します。":"現在は研究中です。Evidenceが揃うまでProduction Systemは選びません。"}</p></article>
  <section className="metrics"><Metric label="Selected Ticker" value={c?.selectedTicker||"NO FINAL SELECTION YET"}/><Metric label="Strategy" value={c?.selectedStrategy||"未選定"}/><Metric label="Version" value={c?.strategyVersion||"—"}/><Metric label="Human Approval" value={c?.approvedByHuman?"記録済み":"未承認"}/><Metric label="次回Health Review" value={c?.nextHealthReview||"Production開始後に設定"}/></section>
  <article className="panel"><em>MODE GATES</em><h2>Research → Decision → Production</h2><Table heads={["Mode","意味","移行条件"]} rows={[["RESEARCH","Historical/OOS/Forwardを蓄積","現在地"],["DECISION","候補2〜3本のFinal Selection Review","十分なEvidenceとデータ品質"],["PRODUCTION","承認済み1本だけをPrimary表示","Actionsで明示承認文字を入力"]]}/><p className="warningNote">GitHub Actionsは自動昇格しません。PRODUCTIONへ直接飛ぶこともできません。</p></article>
  <article className="panel"><em>FINAL SELECTION FRAMEWORK</em><h2>勝者を無理に作らない</h2><p>Historical、OOS、Walk-Forward、汚染状況、Forward、DD、Total Return、Sharpe、Sortino、Calmar、回復時間、回転率、コスト、Regime、Operational Quality、複雑性、データ品質をTicker × Strategy × Version単位で比較します。</p><strong>{c?.mode==="PRODUCTION"?`${c.selectedTicker} × ${c.selectedStrategy} × ${c.strategyVersion}`:"NO FINAL SELECTION YET"}</strong></article>
  <article className="panel"><em>PRODUCTION REGISTRY</em><h2>承認可能な固定Version</h2><Table heads={["Track","Ticker","Strategy","Version","追加条件"]} rows={PRODUCTION_SYSTEMS.map(x=>[x.track,x.ticker,x.strategy,x.version,"Strong Forward Evidence + Final Review + Human Approval"])}/><p className="note">表にないTicker・Strategy・Versionは入力しても拒否されます。現在は全候補がEvidence不足のためProduction承認できません。</p></article>
  <article className="panel"><em>HEALTH REVIEW FREQUENCY STUDY</em><h2>Recommended Production Health Review Policy：Hybrid</h2><Table heads={["頻度","利点","弱点","採用"]} rows={HEALTH_POLICY.alternatives.map(x=>[x.frequency,x.benefit,x.cost,x.adopt?"YES":"NO"])}/><p>{HEALTH_POLICY.reason}</p><code>Operational: daily automated · Strategy health: quarterly · Formal revalidation: annual · Event-driven: immediate</code></article>
  <article className="panel"><em>PRE-REGISTERED DEGRADATION RULES</em><h2>Healthy → Watch → Revalidation Required → Critical</h2>{DEGRADATION_RULES.map((x,i)=><p key={i}>• {x}</p>)}<p className="note">検出しても戦略は自動変更しません。Research → Challenger → Forward → Review → Human Approvalを再度通します。</p></article>
  <article className="panel trouble"><em>将来Productionへ切り替える操作</em><h2>知識ゼロ向け</h2><ol><li>GitHubでActionsを押します。</li><li>Human Production Approvalを押します。</li><li>まずmodeをDECISIONにしてRun workflowを押します。</li><li>Final Selection Review後、同じ画面でPRODUCTIONを選びます。</li><li>Ticker・Strategy・Versionを入力します。</li><li>confirmationへ <code>APPROVE PRODUCTION</code> と正確に入力します。</li><li>緑のチェック後、サイトのProductionタブを確認します。</li></ol></article>
 </>}

function PaperView({history,latestDate,source,ticker}:{history:LiveSnapshot[];latestDate?:string;source?:Dataset["source"];ticker:string}){
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
        <Metric label="初期資金" value={yen(config!.initialJpy)}/><Metric label="現在資産" value={yen(result.equityJpy)} tone="good"/><Metric label={`${ticker}評価額`} value={yen(result.tqqqValueJpy)}/><Metric label="現金" value={yen(result.cashJpy)}/><Metric label="保有口数" value={num(result.shares,4)}/><Metric label="平均取得価格" value={usd(result.avgPrice)}/>
        <Metric label="累積損益" value={yen(result.pnlJpy)}/><Metric label="累積Return" value={pct(result.totalReturn)}/><Metric label="年率換算" value={pct(result.cagr)}/><Metric label="最大DD" value={pct(result.maxDd)} tone="bad"/><Metric label="現在DD" value={pct(result.currentDd)}/><Metric label="売買注文" value={`${result.trades.length}回`}/>
        <Metric label="勝率（売却）" value={pct(result.winRate)}/><Metric label="平均利益" value={yen(result.avgWin)}/><Metric label="平均損失" value={yen(result.avgLoss)} tone="bad"/><Metric label="TQQQ B&H" value={pct(result.tqqqReturn)}/><Metric label="QQQ B&H" value={pct(result.qqqReturn)}/>
      </section>
      <article className="panel"><div className="panelHead"><div><em>LIVE PAPER EQUITY</em><h2>仮想ポートフォリオ資産推移</h2></div><span>開始日以降・未来データ不使用・翌営業日始値約定</span></div><Curve points={result.curve.map(x=>({equity:x.equityJpy}))} label="Live Paper Trading資産推移"/></article>
      <article className="panel"><div className="panelHead"><div><em>PAPER ORDER LOG</em><h2>仮想売買履歴</h2></div></div><Table heads={["判定日","約定日","売買","目標比率","約定価格","数量","手数料","資産額","理由"]} rows={result.trades.map(t=>[t.signalDate,t.executionDate,t.side,`${t.before*100}%→${t.after*100}%`,usd(t.price),num(t.quantity,4),usd(t.commissionUsd),yen(t.equityJpy),`${t.reason} / Score ${t.score}`])}/></article>
    </>}
    {!config&&<article className="panel emptyPaper"><h2>まだ開始していません</h2><p>上の3項目を確認し「Paper Tradingを開始」を押してください。履歴は開始日より後に公開されたSignalだけで増えます。</p></article>}
  </>;
}

function SystemStatusView({status,latestDate,history,forward}:{status:RuntimeStatus|null;latestDate?:string;history:LiveSnapshot[];forward:ForwardLedger|null}){
  const [pwa,setPwa]=useState<boolean|null>(null);useEffect(()=>{const check=()=>"serviceWorker" in navigator?navigator.serviceWorker.getRegistration().then(r=>setPwa(Boolean(r))).catch(()=>setPwa(false)):setPwa(false);if(document.readyState==="complete")check();else{window.addEventListener("load",check,{once:true});return()=>window.removeEventListener("load",check)}},[]);
  const operational=Boolean(status&&status.actionStatus==="success"&&status.jsonValid&&status.paperHistoryValid&&status.forwardPersistent&&forward),delayed=status?.state==="not_updated",state=(ok?:boolean)=>ok?"正常":"要確認",errorCode=!status?"SIGNAL-002":status.actionStatus==="failed"?"ACTION-003":!status.jsonValid?"SIGNAL-002":!status.forwardPersistent||!forward?"FORWARD-001":!status.paperHistoryValid?"PAPER-004":pwa===false?"PWA-005":null;
  const copyPrompt=()=>{const prompt=`私はGitHub・プログラミング初心者です。TQQQ Signal Labで${errorCode||"状態確認"}が発生しました。\n\nRepository: rinko0211/tqqq-signal-lab\nSystem Status:\nActions: ${status?.actionStatus||"未確認"}\n最新市場データ: ${status?.marketDataDate||latestDate||"不明"}\nSignal生成日: ${status?.signalDate||"不明"}\nForward最終記録: ${status?.lastForwardRecord||"不明"}\nForward件数: ${status?.forwardRecords??"不明"}\nBuild: ${status?.buildVersion||"不明"}\nData source: ${status?.dataSource||"不明"}\nJSON: ${state(status?.jsonValid)}\nPaper: ${state(status?.paperHistoryValid)}\nMessage: ${status?.message||"なし"}\nError: ${(status?.errors||[]).join(" / ")||"なし"}\n\n期待動作は、日次データ取得→Signal→Forward追記→Pages更新です。秘密情報はありません。専門用語を使わず、一度に1操作ずつ、どこを押すか説明してください。`;navigator.clipboard.writeText(prompt).catch(()=>window.prompt("この内容をコピーしてください",prompt))};
  return <>
    <article className={`systemHero ${operational?"ok":"bad"}`}><em>SYSTEM STATUS</em><h2>{operational?(delayed?"System Operational · Data Update Pending":"All Systems Operational"):"確認が必要です"}</h2><p>{delayed?"自動処理は成功しています。データ提供元が新しい日足を返すまで、最後の有効Signalを保持します。":status?.message||"status.jsonをまだ確認できません"}</p></article>
    <section className="statusGrid">
      <Metric label="GitHub Actions最終結果" value={status?.actionStatus==="success"?"成功":status?.actionStatus==="failed"?"失敗":"未確認"} sub={status?.generatedAt||"—"}/>
      <Metric label="最新市場データ日" value={status?.marketDataDate||latestDate||"—"}/>
      <Metric label="最新Signal生成日" value={status?.signalDate||"—"}/>
      <Metric label="JSON" value={state(status?.jsonValid)} tone={status?.jsonValid?"good":"bad"}/>
      <Metric label="PWA対応ブラウザ" value={pwa===null?"確認中":state(pwa)} tone={pwa?"good":"bad"}/>
      <Metric label="Paper Trading履歴" value={status?.paperHistoryValid?`${history.length}日・正常`:"要確認"} tone={status?.paperHistoryValid?"good":"bad"}/>
      <Metric label="Forward永続台帳" value={status?.forwardPersistent&&forward?`${status.forwardRecords||forward.records.length}件・正常`:"要確認"} tone={status?.forwardPersistent&&forward?"good":"bad"}/>
      <Metric label="Forward最終日" value={status?.lastForwardRecord||forward?.records.at(-1)?.marketDataDate||"—"}/>
      <Metric label="Build version" value={status?.buildVersion||"—"}/>
      <Metric label="Data source" value={status?.dataSource||"—"}/>
    </section>
    {errorCode&&<article className="issueBlock"><em>ERROR {errorCode}</em><h2>{errorCode==="DATA-001"?"最新市場データを確認できません":errorCode==="ACTION-003"?"GitHub Actionsが失敗しました":errorCode==="FORWARD-001"?"Forward永続台帳を確認できません":errorCode==="PAPER-004"?"Paper Trading履歴を確認できません":errorCode==="PWA-005"?"PWA登録を確認できません":"Signal JSONを確認できません"}</h2><button onClick={copyPrompt}>ChatGPTに相談する内容をコピー</button></article>}
    {delayed&&!errorCode&&<article className="panel"><em>WARNING DATA-002</em><h2>市場データ更新待ち</h2><p>取得処理は成功していますが、データ提供元の最終日は{status?.marketDataDate||latestDate||"未確認"}です。新しいSignalを推測生成せず、最後の有効Signalを維持しています。</p></article>}
    {status?.errors?.length?<article className="issueBlock"><h2>発生した問題</h2>{status.errors.map((e,i)=><p key={i}>× {e}</p>)}</article>:<article className="panel"><em>NO ACTIVE ERROR</em><h2>エラー記録なし</h2><p className="note">休場日は「米国市場休場・新規判定なし」、平日にデータが変わらなければ「最新データ未更新」と明示します。取得失敗時は以前のSignalを上書きしません。</p></article>}
  </>;
}

function LifecycleGuide(){return <article className="panel"><em>SIX-MONTH OPERATING LIFE CYCLE</em><h2>設定後は、原則何もしません</h2><Table heads={["時期","あなたがすること","判断しないこと"]} rows={[["普段","朝に開くなら、最終データ日・本日の判断・目標比率だけ確認。開かなくても記録はGitHub側で続きます。","短期損益だけで戦略を変更しない"],["月1回（任意）","System Statusが正常、Forward最終日が最新市場日であることを確認。","過去のForward記録を再計算で置換しない"],["6か月後",`Forward Test → Evidence → 6か月Review（${"2027-02-22"}）を見る。`,`原則Championを変更しない`],["12か月後",`Forward LeaderboardとPromotion Ruleを確認（${"2027-08-23"}）。`,`単一のReturnだけで昇格させない`],["エラー時","System Status → エラーCode →「ChatGPTに相談する内容をコピー」。","推測Signalで穴埋めしない"]]}/></article>}

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

function ResearchView({data}:{data:ReturnType<typeof researchBundle>}){
  const m=data.bt.metrics;
  return <>
    <article className="panel health"><div className="panelHead"><div><em>CHAMPION / CHALLENGER</em><h2>Strategy Health — {data.audit.champion}</h2></div><Status kind={data.audit.decision==="KEEP"?"ok":"warn"}>{data.audit.decision}</Status></div>
      <section className="metrics compact"><Metric label="Return" value={data.health.return}/><Metric label="Drawdown" value={data.health.drawdown}/><Metric label="Robustness" value={data.health.robustness}/><Metric label="Overall" value={data.health.overall}/><Metric label="Champion" value="維持" sub="OOS優位なしに変更しない"/></section>
      <p className="note">{data.audit.reason}</p><p className="warningNote">Holdout監査: {data.audit.holdoutStatus}</p>
    </article>
    <section className="metrics">
      <Metric label="Total Return" value={pct(m.totalReturn)} sub={`100万円 → ${Math.round(1_000_000*(1+m.totalReturn)).toLocaleString("ja-JP")}円`}/>
      <Metric label="CAGR" value={pct(m.cagr)}/><Metric label="年率Vol" value={pct(m.annualizedVolatility)}/><Metric label="最大DD" value={pct(m.maxDd)} tone="bad"/><Metric label="Calmar" value={num(m.calmar)}/>
      <Metric label="Ulcer Index" value={pct(m.ulcerIndex)}/><Metric label="Expectancy" value={pct(m.expectancy)}/><Metric label="平均保有" value={`${num(m.avgHold,1)}日`}/><Metric label="中央値保有" value={`${num(m.medianHold,1)}日`}/><Metric label="Exposure" value={pct(m.exposure)}/>
    </section>
    <article className="panel"><em>PARETO FRONTIER · PURE OOS</em><h2>CAGRと最大DDのトレードオフ</h2><Table heads={["候補","タイプ","OOS CAGR","OOS Max DD","Calmar","Pareto"]} rows={data.frontier.map(x=>[x.name,x.type||"—",pct(x.metrics.cagr),pct(x.metrics.maxDd),num(x.metrics.calmar),x.frontier?"Frontier":"Dominated"] )}/><p className="note">Balancedを原則候補としますが、Champion置換には頑健性・複雑性・Live確認も必要です。</p></article>
    <article className="panel"><em>EXPERIMENT AUDIT LOG · 2026-08-24</em><h2>Champion / Rejected Experiments</h2><Table heads={["候補","判定","定量的理由","扱い"]} rows={data.frontier.map(x=>[x.name,x.key==="defensive"?"Champion維持":"Reject",`OOS CAGR ${pct(x.metrics.cagr)} / DD ${pct(x.metrics.maxDd)} / Calmar ${num(x.metrics.calmar)}`,x.key==="defensive"?"Signalルール変更なし":"Paretoで劣後。CAGRだけを理由に採用しない"])}/><p className="note">不採用結果も隠さず保存します。Volatility targeting、ATR Stop、Rotationは今回まだ実験していないため、結果を捏造せずResearch backlogに留めます。</p></article>
    <article className="panel"><em>DRAWDOWN ATTRIBUTION · TOP 10</em><h2>大きな下落が起きた理由</h2><Table heads={["#","Peak","Trough","Recovery","DD","Position","Score","Regime","VIX","QQQ trend","原因仮説"]} rows={data.dd.map(x=>[x.rank,x.peak,x.trough,x.recovery||"未回復",pct(x.drawdown),pct(x.position,0),x.score,x.regime,num(x.vix,1),x.qqqTrend,x.cause])}/></article>
    <section className="split"><article className="panel"><em>REGIME ATTRIBUTION</em><h2>市場環境別の寄与</h2><Table heads={["Regime","日数","Return","CAGR","DD","Sharpe","Exposure","注文"]} rows={data.regime.map(x=>[x.name,x.days,pct(x.return),pct(x.cagr),pct(x.maxDd),num(x.sharpe),pct(x.exposure),x.orders])}/></article>
      <article className="panel"><em>BLOCK BOOTSTRAP</em><h2>経路リスク推定</h2><section className="metrics compact three"><Metric label="5%点" value={pct(data.mc.p05)} tone="bad"/><Metric label="中央値" value={pct(data.mc.median)}/><Metric label="95%点" value={pct(data.mc.p95)} tone="good"/><Metric label=">30% DD確率" value={pct(data.mc.prob30)}/><Metric label=">40% DD確率" value={pct(data.mc.prob40)}/><Metric label=">50% DD確率" value={pct(data.mc.prob50)}/></section><p className="note">{data.mc.method}・{data.mc.iterations}回。確率はモデル仮定に依存し、予測値ではありません。</p></article></section>
    <section className="split"><article className="panel"><em>TRANSACTION COST STRESS</em><h2>約定コスト耐性</h2><Table heads={["往復ではなく注文時総bps","CAGR","Sharpe","Max DD"]} rows={data.stress.map(x=>[`${x.totalBps} bps`,pct(x.metrics.cagr),num(x.metrics.sharpe),pct(x.metrics.maxDd)])}/></article>
      <article className="panel"><em>WHIPSAW</em><h2>売却後の早期再Entry</h2><section className="metrics compact"><Metric label="回数" value={`${data.whipsaw.count}回`}/><Metric label="コスト" value={pct(data.whipsaw.cost,3)}/><Metric label="平均取り逃し反発" value={pct(data.whipsaw.missedRebound)}/></section><p className="note">定義: {data.whipsaw.definition}</p></article></section>
    <article className="panel"><em>HONEST BENCHMARK</em><h2>複雑な戦略を単純ルールと比較</h2><Table heads={["対象","Total Return","CAGR","Sharpe","Max DD","Calmar"]} rows={[["Volatility Shield",m],["TQQQ Buy & Hold",data.benchmarks.tqqq],["QQQ Buy & Hold",data.benchmarks.qqq],["SPY Buy & Hold",data.benchmarks.spy],["TQQQ / QQQ 200DMA",data.simple]].map(([name,x])=>{const z=x as Backtest["metrics"];return[name as string,pct(z.totalReturn),pct(z.cagr),num(z.sharpe),pct(z.maxDd),num(z.calmar)]})}/><p className="note">60/40は債券データを現在取得していないため、推測値で追加していません。</p></article>
  </>;
}

function DeepResearchView({data}:{data:DeepResearchBundle}){
  return <>
    <article className="guideHero"><em>BOUNDED WEEKLY RESEARCH · {data.dataEnd}</em><h2>Challenger研究</h2><p>毎日のSignalとは分離した週次事前計算です。Championのルールは、下の採用基準を満たすChallengerが出るまで変更しません。</p></article>
    <article className="panel formula"><em>ADOPTION GATE</em><h2>採用基準</h2><code>{data.adoptionRule}</code><p>{data.boundaryPolicy}</p></article>
    <article className="panel"><em>MULTI-WINDOW WALK-FORWARD</em><h2>学習窓を変えても再現するか</h2><Table heads={["学習","検証","OOS年","Total Return","CAGR","Sharpe","Sortino","Max DD","Calmar","注文/年"]} rows={data.windows.map(x=>[x.training,x.testing,x.years.length,pct(x.metrics.totalReturn),pct(x.metrics.cagr),num(x.metrics.sharpe),num(x.metrics.sortino),pct(x.metrics.maxDd),num(x.metrics.calmar),num(x.metrics.ordersPerYear,1)])}/><p className="note">候補は既存3戦略だけに限定し、3年・5年・Expandingの代表ケースのみ比較します。無制限なWindow探索は行いません。</p></article>
    <article className={`panel ${data.stopPlateau.stable?"health":"holdout"}`}><div className="panelHead"><div><em>TRAILING STOP PLATEAU</em><h2>13%は孤立した最良点か</h2></div><Status kind={data.stopPlateau.stable?"ok":"bad"}>{data.stopPlateau.stable?"Plateau確認":"不安定"}</Status></div><Table heads={["Stop","OOS CAGR","OOS Sharpe","OOS DD","OOS Calmar","注文/年","全期間CAGR"]} rows={data.stops.map(x=>[pct(x.stop,0),pct(x.oos.cagr),num(x.oos.sharpe),pct(x.oos.maxDd),num(x.oos.calmar),num(x.oos.ordersPerYear,1),pct(x.full.cagr)])}/><p className="note">判定規則: {data.stopPlateau.rule}</p></article>
    <article className="panel"><em>CHAMPION / CHALLENGER</em><h2>固定Stop、Volatility Targeting、ATR Stop</h2><Table heads={["候補","自由度追加","判定","OOS CAGR","OOS Sortino","OOS DD","OOS Calmar","注文/年","Exposure"]} rows={data.challengers.map(x=>[x.name,x.complexity,x.decision,pct(x.oos.cagr),num(x.oos.sortino),pct(x.oos.maxDd),num(x.oos.calmar),num(x.oos.ordersPerYear,1),pct(x.oos.exposure)])}/><p className="warningNote">ACCEPT CANDIDATEでも即時置換しません。次のPseudo-Live期間でChampionと並行記録してから昇格判断します。</p></article>
  </>;
}

const RECOVERY_PROMPTS=[
  ["ACTION-003","GitHub Actions failed","Actionsの最新実行が赤くなりました。赤い工程名と表示されたエラーを使い、1回に1操作ずつ復旧方法を教えてください。"],
  ["PAGES-404","Pages 404","GitHub Pagesが404です。Settings → PagesとActionsのどこを確認するか、押す順番で教えてください。"],
  ["DATA-001","Signal old","最終市場データ日が古いです。休場か取得失敗かを区別する確認方法を教えてください。"],
  ["DATA-002","Market data unavailable","TQQQ・QQQ・SPY・VIXの市場データ取得に失敗しました。推測Signalを作らず復旧する手順を教えてください。"],
  ["PAPER-004","Paper Trading stopped","Live Paper Trading履歴が増えません。開始日、公開履歴、二重約定防止を順番に確認してください。"],
  ["PWA-005","PWA not updating","iPhoneホーム画面の表示が古いです。最終データ日を守りながらPWAを更新する操作を教えてください。"],
  ["SIGNAL-002","JSON error","signal.jsonを読めません。Actionsの生成、ファイル存在、JSON形式を初心者向けに確認してください。"],
  ["GIT-006","Git merge conflict","GitHubでmerge conflictが表示されました。データ履歴を消さず、画面上で安全に解決する方法を教えてください。"],
  ["FORK-007","Fork sync problem","Forkが元プロジェクトより遅れています。Sync forkを使う操作と、変更を失わない注意点を教えてください。"],
  ["FORWARD-001","Forward record missing","Forward台帳が見つからない、または最新市場日まで追記されていません。当時の記録を再計算で上書きせず確認する手順を教えてください。"],
  ["PERSIST-001","Persistence failed","Forward台帳をGitHubへ保存できませんでした。Actionsの権限、commit、pushを履歴を消さず確認してください。"],
] as const;
function RecoveryPromptPack(){const copy=(code:string,title:string,body:string)=>{const prompt=`私はGitHub初心者です。TQQQ Signal Labで${code}（${title}）が発生しました。\n\n${body}\n\n専門用語を使わず、1回に1操作ずつ、どこを押すか、正常なら何が見えるか、失敗時に次に見る場所を教えてください。`;navigator.clipboard.writeText(prompt).catch(()=>window.prompt("この内容をコピーしてください",prompt))};return <article className="panel trouble"><em>FREE GPT RECOVERY PROMPT PACK</em><h2>無料版ChatGPTへそのまま貼る文</h2><Table heads={["Code","症状","操作"]} rows={RECOVERY_PROMPTS.map(([code,title,body])=>[code,title,<button key={code} onClick={()=>copy(code,title,body)}>相談文をコピー</button>]) as unknown as (string|number)[][]}/></article>}

const GLOSSARY=[
 ["CAGR","複利でならした年平均成長率。高くても最大DDとセットで確認します。"],["Total Return","開始から終了までの累積リターン。資産曲線から直接計算します。"],["Sharpe Ratio","総変動に対する収益効率。高いほど効率的ですが将来保証ではありません。"],["Sortino Ratio","悪い方向の変動だけに対する収益効率です。"],["Maximum Drawdown","過去最高から最大で減った割合。−30%なら100万円が一時70万円です。"],["Calmar Ratio","CAGR÷最大DD。成長と深い下落の効率です。"],["Volatility / VIX","値動きの大きさ / 米国株の予想変動を表す指数です。"],["Momentum / Trend","上昇の勢い / 中長期の方向です。"],["OOS","パラメータ選択に使っていない未来側の検証期間です。"],["Walk-Forward","過去で選び、その直後の未来で試すことを繰り返します。"],["Holdout","最終候補まで触らない検証期間。一度見て調整すると純粋ではありません。"],["Backtest","過去データを使った仮想検証です。実運用成績ではありません。"],["Live Paper Trading","その時点で利用可能だったSignalだけを記録する仮想運用です。"],["Slippage","想定価格より不利に約定する差です。"],["Position Size / Exposure","資産のうちTQQQへ配分する割合 / 平均配分です。"],["Trailing Stop","保有後のTQQQ高値から一定以上下がった時に縮小・撤退する規則です。"],["Volatility Drag / Daily Reset","日次レバレッジ再調整により、長期成績が指数×3と一致しない性質です。"],["Look-Ahead Bias","その時点で知らない未来情報を使ってしまう誤りです。"],["Overfitting","過去だけに合い、未来で再現しにくい複雑化です。"],
 ["Champion","現在の運用基準として固定された戦略。自動では変更しません。"],["Challenger","Championより良い可能性を未来データで検証する候補です。"],["Forward Test","実際の日々の時点で生成したSignalだけを追記する未来向き検証です。"],["Forward Evidence","期間、注文数、経験相場、欠測から見た証拠の強さです。"],["Promotion","十分な証拠を確認し、人間の承認でChampionへ昇格させることです。"],["Strategy Version","途中変更を区別する固定番号。新Versionを過去へ遡及適用しません。"],["Research Freeze","Forward開始前に式・閾値・費用・約定方法を固定することです。"],["Regime","その時点までの情報で分類した市場環境です。"],["Annualized Return","短期Returnを年率換算した参考値。1年未満では過信しません。"],["Equity Curve","資産額の時間推移です。"],["Drawdown Curve / Underwater","過去最高額から現在どれだけ下にいるかの推移です。"],["Recovery Time","下落前の最高資産額へ戻るまでの日数です。"],["Parameter Stability","少し違う設定でも結果が大崩れしない性質です。"],["Selection Bias","後から成功商品を選んだことで過去成績が良く見える偏りです。"],["Multiple Testing","多数の候補を試すほど偶然の当たりが出やすくなる問題です。"],["Common Period","比較銘柄すべてにデータがある同じ期間です。"],["Common Strategy","複数ETFへ同じFrameworkを適用し、Ticker自体を公平に比べる戦略です。"],["Native Strategy","Ticker固有の構造に基づき、限定した少数候補から選ぶ専用戦略です。"],["Production Champion","十分なForward証拠と人間承認を経た1つのTicker × Strategy × Versionです。"],["Production Mode","選定済み1戦略だけをPrimary Signalとして日次表示する状態です。"],["Health Review","再最適化せず、データ・実行・成績劣化・商品変更を監視する点検です。"],["Revalidation","Productionを即変更せず研究手順へ戻して再検証することです。"],["Event-driven Review","商品変更、データ障害、想定外DD等の重大事象時に行う点検です。"],["Forward Overfitting","短期Forward結果を見てルールを微調整し、未来検証まで過学習させる誤りです。"],["Structural Change","指数、商品設計、流動性など戦略の前提そのものが変わることです。"],["Strategy Degradation","将来成績・実行品質が事前の許容範囲から継続的に悪化することです。"]
] as const;
function GlossaryView(){return <><article className="guideHero"><em>BEGINNER GLOSSARY</em><h2>用語集</h2><p>各指標は単独で良し悪しを決めず、OOS・DD・コスト・Live成績と組み合わせて見ます。</p></article><section className="glossaryGrid">{GLOSSARY.map(([term,body])=><article className="panel" key={term}><em>{term}</em><h2>{term}</h2><p className="note">{body}</p></article>)}</section></>}

function RoadmapV2(){const phases=[["Phase 1","Core TQQQ Research","COMPLETE","VS13をBalanced Championとして固定"],["Phase 2","TQQQ Forward Validation","ACTIVE","6・12・24か月の未来記録を蓄積"],["Phase 3","Cross-Ticker Common Research","ACTIVE","同一Framework・共通期間で比較"],["Phase 4","Ticker-Native Strategy Research","ACTIVE","各Ticker最大3系統、候補1本"],["Phase 5","Native Forward Validation","NEXT","承認したNative候補だけVersion固定"],["Phase 6","Final Candidate Selection","WAIT","十分なForward Evidence"],["Phase 7","Production Champion Approval","WAIT","Human Approval必須"],["Phase 8","Production Signal Operation","READY","選定1本の日次Signal"],["Phase 9","Health Review / Revalidation","READY","日次・四半期・年次・Event駆動"]];return <><article className="guideHero"><em>ROBUST LEVERAGED ETF PLATFORM</em><h2>Research → Decision → Production</h2><p>十分な証拠が揃えば1つのProduction Systemへ人間の承認で移行します。</p></article><article className="panel"><Table heads={["段階","テーマ","状態","完了条件"]} rows={phases}/></article><article className="panel formula"><em>RESEARCH BOUNDARY</em><h2>現在地</h2><code>Track A: TQQQ Strategy · Track B1: Common Ticker · Track B2: Native Strategy · Mode: RESEARCH</code><p>Production移行後もResearch ArchiveとRejected Experimentは削除しません。</p></article></>}

function RoadmapView(){const phases=[["Phase 1","TQQQ strategy stabilization","進行中","現行Championの監査・計測・Pseudo-Live蓄積"],["Phase 2","Leveraged ETF market screening","調査準備","公式情報でAUM・流動性・費用・構造を確認"],["Phase 3","Shortlist 4–8 tickers","未着手","大量総当たりを避け候補を限定"],["Phase 4","Parallel robust backtesting","未着手","共通FrameworkでOOS比較"],["Phase 5","Ticker selection","未着手","CAGRだけでなくDD・流動性・再現性で選択"],["Phase 6","Optional rotation research","保留","単一Ticker研究が安定してから検討"],["Phase 7","Live Paper Trading","稼働中","未来情報なしの日次記録"],["Phase 8","Real-capital decision","未判断","十分なLive期間と運用者判断が必要"]];return <><article className="guideHero"><em>ROBUST LEVERAGED ETF PLATFORM</em><h2>Research Roadmap</h2><p>現在はTQQQ戦略の安定化が最優先です。マルチTickerは先入観なく、公式情報で候補を絞ってから検証します。</p></article><article className="panel"><Table heads={["段階","テーマ","状態","完了条件"]} rows={phases}/></article><article className="panel formula"><em>SHORTLIST POLICY</em><h2>将来の候補カテゴリー</h2><code>NASDAQ-100 / S&amp;P 500 / Semiconductor / Technology / Small Cap — 4〜8銘柄へ限定</code><p>TQQQ、UPRO、SOXL、TECLは調査対象候補であり採用決定ではありません。いずれも日次目標商品で、長期成績は指数×3と一致しません。</p><p><a href="https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq" target="_blank" rel="noreferrer">TQQQ公式</a> · <a href="https://www.proshares.com/our-etfs/leveraged-and-inverse/upro" target="_blank" rel="noreferrer">UPRO公式</a> · <a href="https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs" target="_blank" rel="noreferrer">SOXL公式</a> · <a href="https://www.direxion.com/product/daily-technology-bull-bear-3x-etfs" target="_blank" rel="noreferrer">TECL公式</a></p><p className="note">2026-08-24調査。次段階でAUM、平均出来高、spread、運用年数、費用、tracking、split、閉鎖リスクを同一基準で確認し、4〜8銘柄へ限定します。</p></article></>}
