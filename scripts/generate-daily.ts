import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fetchOfficialData, fetchProductionData } from "../lib/official-data.ts";
import { datasetFromPayload, runBacktest } from "../lib/engine.ts";
import { earliestLegalExecutionDate } from "../lib/execution-integrity.ts";
import {assertPlausibleTransition,corporateActionContinuity} from "../lib/corporate-actions.ts";
import { emptyForwardLedger, summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";
import type { LiveSnapshot } from "../lib/paper.ts";
import {DEFAULT_PRODUCTION_CONFIG,hasActiveProduction,resolveProductionSystem,type ProductionConfig} from "../lib/production.ts";
import {SCREENING,makeCrossTickerDataset} from "../lib/cross-ticker.ts";
import {dailyBarIsComplete,isNyseSession} from "../lib/market-calendar.ts";

const pagesRoot = new URL("../github-pages/public/data/", import.meta.url);
const roots = process.env.GITHUB_ACTIONS === "true" ? [pagesRoot] : [pagesRoot, new URL("../public/data/", import.meta.url)];
const root = roots[0];
const readJson = async <T>(name: string, fallback: T) => { try { return JSON.parse(await readFile(new URL(name, root), "utf8")) as T; } catch { return fallback; } };
const writeJson = (name: string, value: unknown) => Promise.all(roots.map(dir => writeFile(new URL(name, dir), `${JSON.stringify(value, null, 2)}\n`)));

const generatedAt = new Date().toISOString();
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const nyHour = Number(new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", hour:"2-digit", hourCycle:"h23" }).format(new Date()));
await Promise.all(roots.map(dir => mkdir(dir, { recursive:true })));
const priorSignal = await readJson<{dataDate?:string;assetTicker?:string;strategyVersion?:string}|null>("signal.json", null);
const history = await readJson<LiveSnapshot[]>("live-history.json", []);
const priorForward = await readJson<ForwardLedger>("forward-ledger.json", emptyForwardLedger(generatedAt));
const production = await readJson<ProductionConfig>("production-config.json", DEFAULT_PRODUCTION_CONFIG);

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
  const keepCompleteBars=(ds:typeof trackADataset)=>{while(ds.days.length&&!dailyBarIsComplete(ds.days.at(-1)!.date,generatedAt))ds.days.pop();if(ds.days.length<201)throw Error("DATA-003: no sufficiently long completed NYSE daily-bar history is available; no Signal was generated")};
  keepCompleteBars(trackADataset);if(dataset!==trackADataset)keepCompleteBars(dataset);
  const bt = runBacktest(dataset, selected.config),latest = bt.daily.at(-1)!,bar = dataset.days.at(-1)!;
  const updated = priorSignal?.dataDate !== latest.date||priorSignal?.assetTicker!==selected.ticker||priorSignal?.strategyVersion!==selected.version;
  const nyWeekday = new Date(`${nyDate}T12:00:00Z`).getUTCDay(),closed = [0,6].includes(nyWeekday) || !isNyseSession(nyDate),state = updated ? "latest" : closed ? "market_closed" : nyHour < 18 ? "market_pending" : "not_updated";
  const priorSnapshot=[...history].filter(x=>(x.assetTicker||"TQQQ")===selected.ticker&&(x.strategyVersion||"VS13-v1.0")===selected.version).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  let splitFactor:number|undefined;
  if(priorSnapshot){const providerPrior=dataset.days.find(x=>x.date===priorSnapshot.date);if(providerPrior){const continuity=corporateActionContinuity(priorSnapshot.tqqqClose,providerPrior.tqqq.close);assertPlausibleTransition(continuity.adjustedPriorClose,bar.tqqq.open,continuity);if(continuity.kind==="SPLIT"||continuity.kind==="REVERSE_SPLIT")splitFactor=continuity.factor;}}
  const snapshot:LiveSnapshot = { date:latest.date,assetTicker:selected.ticker,strategyVersion:selected.version,tqqqOpen:bar.tqqq.open,tqqqClose:bar.tqqq.close,qqqOpen:bar.qqq.open,qqqClose:bar.qqq.close,target:latest.signal.target,previousTarget:latest.signal.previousTarget,score:latest.signal.score,regime:latest.signal.regime,reason:latest.signal.reason,crisis:latest.signal.regime==="急落・危機",...(splitFactor?{splitFactor}:{}) };
  if (!history.some(x=>x.date===snapshot.date&&(x.assetTicker||"TQQQ")===selected.ticker&&(x.strategyVersion||"VS13-v1.0")===(selected.version))) history.push(snapshot);
  const forward = updateForwardLedger(trackADataset, priorForward, payload.source, generatedAt),forwardSummary = summarizeForward(forward),executionDate=earliestLegalExecutionDate(latest.date,generatedAt);
  const delta=Math.abs(latest.signal.target-latest.signal.previousTarget);
  const signal = { generatedAt,dataDate:latest.date,source:payload.source,platformMode:production.mode,assetTicker:selected.ticker,assetClose:bar.tqqq.close,tqqqClose:bar.tqqq.close,strategy:selected.strategy,strategyVersion:selected.version,state,signal:{...latest.signal,executionDate},suggestion:latest.signal.target===latest.signal.previousTarget?`${latest.signal.target*100}%を維持。売買なし。`:`${latest.signal.previousTarget*100}%から${latest.signal.target*100}%へ変更。実行可能な最初の米国市場始値（${executionDate}）で${delta*100}%分を${latest.signal.target>latest.signal.previousTarget?"増加":"縮小"}。`,warnings:dataset.issues.filter(x=>x.severity==="warning").map(x=>x.message) };
  await Promise.all([writeJson("market-data.json",payload), writeJson("signal.json",signal), writeJson("live-history.json",history),writeJson("forward-ledger.json",forward), writeJson("forward-summary.json",forwardSummary),writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"success",marketDataDate:latest.date,signalDate:latest.date,lastForwardRecord:forward.records.at(-1)?.marketDataDate||null,forwardRecords:forward.records.length,forwardPersistent:true,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"local",dataSource:payload.source,jsonValid:true,pwaExpected:true,paperHistoryValid:true,state,message:state==="latest"?"最新データでSignal・Forward台帳を生成済み":state==="market_closed"?"米国市場休場・新規判定なし":state==="market_pending"?"米国市場終了後の更新待ち・新規判定なし":"最新データ未更新",errors:[]})]);
  await Promise.all(roots.map(dir=>existsSync(new URL(".failed",dir))?writeFile(new URL(".failed",dir),""):Promise.resolve()));
} catch(error) {
  await writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"failed",lastForwardRecord:priorForward.records.at(-1)?.marketDataDate||null,forwardRecords:priorForward.records.length,forwardPersistent:true,jsonValid:Boolean(priorSignal),pwaExpected:true,paperHistoryValid:Array.isArray(history),state:"failed",message:"データ取得失敗。新しいSignal・Forward Recordは生成していません",errors:[error instanceof Error?error.message:String(error)]});
  await Promise.all(roots.map(dir=>writeFile(new URL(".failed",dir),"failed\n")));
}
