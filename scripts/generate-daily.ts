import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fetchOfficialData } from "../lib/official-data.ts";
import { datasetFromPayload, nextExecutionDate, runBacktest, walkForward } from "../lib/engine.ts";
import { emptyForwardLedger, summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";
import type { LiveSnapshot } from "../lib/paper.ts";
import {DEFAULT_PRODUCTION_CONFIG,resolveProductionSystem,type ProductionConfig} from "../lib/production.ts";
import {SCREENING,makeCrossTickerDataset} from "../lib/cross-ticker.ts";
import {fixedOos} from "../lib/research.ts";

const pagesRoot = new URL("../github-pages/public/data/", import.meta.url);
const roots = process.env.GITHUB_ACTIONS === "true"
  ? [pagesRoot]
  : [pagesRoot, new URL("../public/data/", import.meta.url)];
const root = roots[0];
const readJson = async <T>(name: string, fallback: T) => {
  try { return JSON.parse(await readFile(new URL(name, root), "utf8")) as T; } catch { return fallback; }
};
const writeJson = (name: string, value: unknown) => Promise.all(roots.map(dir => writeFile(new URL(name, dir), `${JSON.stringify(value, null, 2)}\n`)));

const nthWeekday=(year:number,month:number,weekday:number,n:number)=>{const d=new Date(Date.UTC(year,month,1));while(d.getUTCDay()!==weekday)d.setUTCDate(d.getUTCDate()+1);d.setUTCDate(d.getUTCDate()+7*(n-1));return d.toISOString().slice(0,10)};
const lastWeekday=(year:number,month:number,weekday:number)=>{const d=new Date(Date.UTC(year,month+1,0));while(d.getUTCDay()!==weekday)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)};
const observed=(year:number,month:number,day:number)=>{const d=new Date(Date.UTC(year,month,day)),w=d.getUTCDay();if(w===6)d.setUTCDate(d.getUTCDate()-1);if(w===0)d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
const easter=(year:number)=>{const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month,day))};
const isNyseHoliday=(date:string)=>{const y=+date.slice(0,4),goodFriday=easter(y);goodFriday.setUTCDate(goodFriday.getUTCDate()-2);return new Set([observed(y,0,1),nthWeekday(y,0,1,3),nthWeekday(y,1,1,3),goodFriday.toISOString().slice(0,10),lastWeekday(y,4,1),observed(y,5,19),observed(y,6,4),nthWeekday(y,8,1,1),nthWeekday(y,10,4,4),observed(y,11,25)]).has(date)};

const generatedAt = new Date().toISOString();
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const nyHour = Number(new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", hour:"2-digit", hourCycle:"h23" }).format(new Date()));
await Promise.all(roots.map(dir => mkdir(dir, { recursive:true })));
const priorSignal = await readJson<{dataDate?:string;assetTicker?:string;strategyVersion?:string}|null>("signal.json", null);
const history = await readJson<LiveSnapshot[]>("live-history.json", []);
const priorForward = await readJson<ForwardLedger>("forward-ledger.json", emptyForwardLedger(generatedAt));
const production = await readJson<ProductionConfig>("production-config.json", DEFAULT_PRODUCTION_CONFIG);

try {
  const productionTicker=production.mode==="PRODUCTION"&&production.approvedByHuman?production.selectedTicker:null;
  const selected=productionTicker?resolveProductionSystem(productionTicker,production.strategyVersion||"",production.selectedStrategy):resolveProductionSystem("TQQQ","VS13-v1.0");
  const payload = await fetchOfficialData(Boolean(productionTicker&&productionTicker!=="TQQQ"));
  const trackADataset = datasetFromPayload(payload);
  const productionRow=productionTicker?SCREENING.find(x=>x.ticker===productionTicker):null;
  const dataset = productionRow&&productionTicker!=="TQQQ"?makeCrossTickerDataset(payload,productionRow):trackADataset;
  if(!dataset)throw Error(`CONFIG-001: selected ticker ${productionTicker} data unavailable`);
  const errors = dataset.issues.filter(x=>x.severity==="error");
  if (errors.length) throw Error(errors.map(x=>x.message).join("; "));
  const bt = runBacktest(dataset, selected.config);
  const latest = bt.daily.at(-1)!;
  const bar = dataset.days.at(-1)!;
  const priorBar = dataset.days.at(-2)!;
  const wf = walkForward(dataset);
  const oos = fixedOos(dataset,selected.config);
  const updated = priorSignal?.dataDate !== latest.date||priorSignal?.assetTicker!==selected.ticker||priorSignal?.strategyVersion!==selected.version;
  const nyWeekday = new Date(`${nyDate}T12:00:00Z`).getUTCDay();
  const closed = [0,6].includes(nyWeekday) || isNyseHoliday(nyDate);
  const state = updated ? "latest" : closed ? "market_closed" : nyHour < 18 ? "market_pending" : "not_updated";
  const splitRatio = priorBar.tqqq.close / bar.tqqq.open;
  const splitFactor = [2,3,4,5,10].find(x=>Math.abs(splitRatio-x)/x<.08);
  const snapshot:LiveSnapshot = { date:latest.date,assetTicker:selected.ticker,strategyVersion:selected.version,tqqqOpen:bar.tqqq.open,tqqqClose:bar.tqqq.close,qqqOpen:bar.qqq.open,qqqClose:bar.qqq.close,target:latest.signal.target,previousTarget:latest.signal.previousTarget,score:latest.signal.score,regime:latest.signal.regime,reason:latest.signal.reason,crisis:latest.signal.regime==="急落・危機",...(splitFactor?{splitFactor}:{}) };
  if (!history.some(x=>x.date===snapshot.date&&(x.assetTicker||"TQQQ")===selected.ticker&&(x.strategyVersion||"VS13-v1.0")===selected.version)) history.push(snapshot);
  // Track A is permanently TQQQ-only. A future UPRO Production selection must
  // never rewrite or append UPRO returns into the TQQQ strategy ledger.
  const forward = updateForwardLedger(trackADataset, priorForward, payload.source, generatedAt);
  const forwardSummary = summarizeForward(forward);
  const signal = { generatedAt,dataDate:latest.date,source:payload.source,platformMode:production.mode,assetTicker:selected.ticker,assetClose:bar.tqqq.close,tqqqClose:bar.tqqq.close,strategy:selected.strategy,strategyVersion:selected.version,state,signal:{...latest.signal,executionDate:nextExecutionDate(latest.date)},suggestion:latest.signal.target===latest.signal.previousTarget?`${latest.signal.target*100}%を維持。売買なし。`:`${latest.signal.previousTarget*100}%から${latest.signal.target*100}%へ変更。次営業日始値で${Math.abs(latest.signal.target-latest.signal.previousTarget)*100}%分を${latest.signal.target>latest.signal.previousTarget?"増加":"縮小"}。`,validation:{oos:oos.metrics,walkForward:wf.metrics,holdout:wf.holdout?.metrics||null},warnings:dataset.issues.filter(x=>x.severity==="warning").map(x=>x.message) };
  await Promise.all([
    writeJson("market-data.json",payload), writeJson("signal.json",signal), writeJson("live-history.json",history),
    writeJson("forward-ledger.json",forward), writeJson("forward-summary.json",forwardSummary),
    writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"success",marketDataDate:latest.date,signalDate:latest.date,lastForwardRecord:forward.records.at(-1)?.marketDataDate||null,forwardRecords:forward.records.length,forwardPersistent:true,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"local",dataSource:payload.source,jsonValid:true,pwaExpected:true,paperHistoryValid:true,state,message:state==="latest"?"最新データでSignal・Forward台帳を生成済み":state==="market_closed"?"米国市場休場・新規判定なし":state==="market_pending"?"米国市場終了後の更新待ち・新規判定なし":"最新データ未更新",errors:[]})
  ]);
  await Promise.all(roots.map(dir=>existsSync(new URL(".failed",dir))?writeFile(new URL(".failed",dir),""):Promise.resolve()));
} catch(error) {
  await writeJson("status.json",{generatedAt,actionRunId:process.env.GITHUB_RUN_ID||"local",actionStatus:"failed",lastForwardRecord:priorForward.records.at(-1)?.marketDataDate||null,forwardRecords:priorForward.records.length,forwardPersistent:true,jsonValid:Boolean(priorSignal),pwaExpected:true,paperHistoryValid:Array.isArray(history),state:"failed",message:"データ取得失敗。新しいSignal・Forward Recordは生成していません",errors:[error instanceof Error?error.message:String(error)]});
  await Promise.all(roots.map(dir=>writeFile(new URL(".failed",dir),"failed\n")));
}
