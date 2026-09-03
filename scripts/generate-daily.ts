import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ExternalDataUnavailableError, fetchOfficialData, fetchProductionData } from "../lib/official-data.ts";
import { datasetFromPayload, runBacktest } from "../lib/engine.ts";
import { earliestLegalExecutionDate } from "../lib/execution-integrity.ts";
import {assertPlausibleTransition,corporateActionContinuity} from "../lib/corporate-actions.ts";
import { summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";
import type { LiveSnapshot } from "../lib/paper.ts";
import {assertProductionConfigIntegrity,hasActiveProduction,resolveProductionSystem,type ProductionConfig} from "../lib/production.ts";
import {SCREENING,makeCrossTickerDataset} from "../lib/cross-ticker.ts";
import {dailyBarIsComplete,isNyseSession} from "../lib/market-calendar.ts";
import {assessProviderAttempt,failedProviderAttempt,unavailableProviderAttempt} from "../lib/provider-attempt.ts";

const pagesRoot = new URL("../github-pages/public/data/", import.meta.url);
const roots = process.env.GITHUB_ACTIONS === "true" ? [pagesRoot] : [pagesRoot, new URL("../public/data/", import.meta.url)];
const root = roots[0];
const readRequiredJson=async<T>(name:string):Promise<T>=>{try{return JSON.parse(await readFile(new URL(name,root),"utf8")) as T}catch(error){throw Error(`STATE-001: required ${name} is missing/corrupt; refusing operational state reset (${error instanceof Error?error.message:String(error)})`)}};
const writeJson = (name: string, value: unknown) => Promise.all(roots.map(dir => writeFile(new URL(name, dir), `${JSON.stringify(value, null, 2)}\n`)));

const generatedAt = new Date().toISOString();
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const nyHour = Number(new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", hour:"2-digit", hourCycle:"h23" }).format(new Date()));
await Promise.all(roots.map(dir => mkdir(dir, { recursive:true })));
const priorSignal=await readRequiredJson<{dataDate?:string;assetTicker?:string;strategyVersion?:string}>("signal.json");
const history=await readRequiredJson<LiveSnapshot[]>("live-history.json");
const priorForward=await readRequiredJson<ForwardLedger>("forward-ledger.json");
const production=await readRequiredJson<ProductionConfig>("production-config.json");
if(priorForward.schemaVersion!==1||priorForward.appendOnly!==true)throw Error("STATE-002: Forward ledger authority is invalid");if(!Array.isArray(history))throw Error("STATE-003: live history is invalid");assertProductionConfigIntegrity(production);

try {
  const productionTicker=hasActiveProduction(production)?production.selectedTicker:null;
  const selected=productionTicker?resolveProductionSystem(productionTicker,production.strategyVersion||"",production.selectedStrategy):resolveProductionSystem("TQQQ","VS13-v1.0");
  const productionRow=productionTicker?SCREENING.find(x=>x.ticker===productionTicker):null;
  const payload=productionRow&&productionTicker!=="TQQQ"
    ? await fetchProductionData(productionTicker as "UPRO"|"SSO"|"QLD",productionRow.proxy as "SPY"|"QQQ")
    : await fetchOfficialData(false);
  const trackADataset = datasetFromPayload(payload as Parameters<typeof datasetFromPayload>[0]);
  const dataset = productionRow&&productionTicker!=="TQQQ"?makeCrossTickerDataset(payload as Parameters<typeof makeCrossTickerDataset>[0],productionRow):trackADataset;
  if(!dataset)throw Error(`CONFIG-001: selected ticker ${productionTicker} data unavailable`);
  const errors = dataset.issues.filter(x=>x.severity==="error"); if (errors.length) throw Error(errors.map(x=>x.message).join("; "));
  const keepCompleteBars=(ds:typeof trackADataset)=>{const complete=ds.days.filter(d=>dailyBarIsComplete(d.date,generatedAt));ds.days.splice(0,ds.days.length,...complete);if(ds.days.length<201)throw Error("DATA-003: no sufficiently long completed NYSE daily-bar history is available; no Signal was generated")};
  keepCompleteBars(trackADataset);if(dataset!==trackADataset)keepCompleteBars(dataset);
  const completedSeries=Object.fromEntries(Object.entries(payload.series).map(([ticker,rows])=>[ticker,rows.filter(row=>dailyBarIsComplete(row.date,generatedAt))]));
  const providerAttempt=assessProviderAttempt({series:completedSeries,priorDataDate:priorSignal?.dataDate,attemptedAt:generatedAt,source:payload.source});
  const bt = runBacktest(dataset, selected.config),latest = bt.daily.at(-1)!,bar = dataset.days.at(-1)!;
  const updated = priorSignal?.dataDate !== latest.date||priorSignal?.assetTicker!==selected.ticker||priorSignal?.strategyVersion!==selected.version;
  const nyWeekday = new Date(`${nyDate}T12:00:00Z`).getUTCDay(),closed = [0,6].includes(nyWeekday) || !isNyseSession(nyDate),state = providerAttempt.state==="PROVIDER_PENDING" ? "provider_pending" : updated ? "latest" : closed ? "market_closed" : nyHour < 18 ? "market_pending" : "not_updated";
  const priorSnapshot=[...history].filter(x=>(x.assetTicker||"TQQQ")===selected.ticker&&(x.strategyVersion||"VS13-v1.0")===selected.version).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  let splitFactor:number|undefined;
  if(priorSnapshot){const providerPrior=dataset.days.find(x=>x.date===priorSnapshot.date);if(providerPrior){const continuity=corporateActionContinuity(priorSnapshot.tqqqClose,providerPrior.tqqq.close);assertPlausibleTransition(continuity.adjustedPriorClose,bar.tqqq.open,continuity);if(continuity.kind==="SPLIT"||continuity.kind==="REVERSE_SPLIT")splitFactor=continuity.factor;}}
  const snapshot:LiveSnapshot = { date:latest.date,assetTicker:selected.ticker,strategyVersion:selected.version,tqqqOpen:bar.tqqq.open,tqqqClose:bar.tqqq.close,qqqOpen:bar.qqq.open,qqqClose:bar.qqq.close,target:latest.signal.target,previousTarget:latest.signal.previousTarget,score:latest.signal.score,regime:latest.signal.regime,reason:latest.signal.reason,crisis:latest.signal.regime==="急落・危機",...(splitFactor?{splitFactor}:{}) };
  if (!history.some(x=>x.date===snapshot.date&&(x.assetTicker||"TQQQ")===selected.ticker&&(x.strategyVersion||"VS13-v1.0")===(selected.version))) history.push(snapshot);
  const forward = updateForwardLedger(trackADataset, priorForward, payload.source, generatedAt),forwardSummary = summarizeForward(forward),executionDate=earliestLegalExecutionDate(latest.date,generatedAt);
  const delta=Math.abs(latest.signal.target-latest.signal.previousTarget);
  const signal = { generatedAt,dataDate:latest.date,source:payload.source,platformMode:production.mode,assetTicker:selected.ticker,assetClose:bar.tqqq.close,tqqqClose:bar.tqqq.close,strategy:selected.strategy,strategyVersion:selected.version,state,signal:{...latest.signal,executionDate},suggestion:latest.signal.target===latest.signal.previousTarget?`${latest.signal.target*100}%を維持。売買なし。`:`${latest.signal.previousTarget*100}%から${latest.signal.target*100}%へ変更。実行可能な最初の米国市場始値（${executionDate}）で${delta*100}%分を${latest.signal.target>latest.signal.previousTarget?"増加":"縮小"}。`,warnings:dataset.issues.filter(x=>x.severity==="warning").map(x=>x.message) };
  await Promise.all([writeJson("market-data.json",payload), writeJson("signal.json",signal), writeJson("live-history.json",history),writeJson("forward-ledger.json",forward), writeJson("forward-summary.json",forwardSummary),writeJson("provider-attempt.json",providerAttempt),writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"success",marketDataDate:latest.date,signalDate:latest.date,lastForwardRecord:forward.records.at(-1)?.marketDataDate||null,forwardRecords:forward.records.length,forwardPersistent:true,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"local",dataSource:payload.source,jsonValid:true,pwaExpected:true,paperHistoryValid:true,state,catchup:{priorDataDate:providerAttempt.priorDataDate,processedDates:providerAttempt.catchupDates,observationOnlyDates:providerAttempt.observationOnlyDates,displayedSignalDate:providerAttempt.displayedSignalDate},message:state==="latest"?"最新データでSignal・Forward台帳を生成済み":state==="provider_pending"?providerAttempt.message:state==="market_closed"?"米国市場休場・新規判定なし":state==="market_pending"?"米国市場終了後の更新待ち・新規判定なし":"最新データ未更新",errors:[]})]);
  await Promise.all(roots.map(dir=>existsSync(new URL(".failed",dir))?writeFile(new URL(".failed",dir),""):Promise.resolve()));
} catch(error) {
  if(error instanceof ExternalDataUnavailableError){
    await writeJson("provider-attempt.json",unavailableProviderAttempt({error,priorDataDate:priorSignal?.dataDate,attemptedAt:generatedAt,source:"Nasdaq Historical + Cboe VIX History"}));
    await Promise.all(roots.map(dir=>writeFile(new URL(".failed",dir),"")));
  }else{
    await Promise.all([writeJson("provider-attempt.json",failedProviderAttempt({error,priorDataDate:priorSignal?.dataDate,attemptedAt:generatedAt,source:"Nasdaq Historical + Cboe VIX History"})),writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"failed",lastForwardRecord:priorForward.records.at(-1)?.marketDataDate||null,forwardRecords:priorForward.records.length,forwardPersistent:true,jsonValid:Boolean(priorSignal),pwaExpected:true,paperHistoryValid:Array.isArray(history),state:"failed",message:"データ取得後の検証または内部処理に失敗しました。新しいSignal・Forward Recordは生成していません",errors:[error instanceof Error?error.message:String(error)]})]);
    await Promise.all(roots.map(dir=>writeFile(new URL(".failed",dir),"failed\n")));
  }
}
