import { metricSet, nextExecutionDate, signals, STRATEGIES, type Bar, type Dataset, type Metrics, type Signal, type StrategyConfig } from "./engine.ts";
import { earliestLegalExecutionDate } from "./execution-integrity.ts";
import {assertPlausibleTransition,corporateActionContinuity} from "./corporate-actions.ts";
import {countNyseSessions} from "./market-calendar.ts";

export const PHASE5_FORWARD_SCHEMA = 1;
export const PHASE5_FORWARD_START = "2026-08-25";
export const PHASE5_INITIAL_CAPITAL = 1_000_000;
export const PHASE5_BUILD = "phase5-forward-1.0.1";

export type Phase5Id = "UPRO_SPBT" | "SSO_SPBT_SCALED" | "QLD_VS13_SCALED";
export type Phase5Ticker = "UPRO" | "SSO" | "QLD";
export type Phase5Role = "PRIMARY_CHALLENGER" | "S&P_LEVERAGE_CONTROL" | "NASDAQ_BALANCED_CONTROL";

export type Phase5Freeze = {
  id: Phase5Id;
  ticker: Phase5Ticker;
  proxy: "SPY" | "QQQ";
  name: string;
  version: string;
  role: Phase5Role;
  frozenAt: string;
  startDate: string;
  initialCapital: number;
  config: StrategyConfig;
  assumptions: { signal:string; execution:string; commissionBps:number; slippageBps:number; currency:string };
};

const scaledStop = .13 * 2 / 3;
const spbt = (stop:number):StrategyConfig => ({
  ...STRATEGIES.defensive,
  weights:{trend:.36,momentum:.16,volatility:.28,market:.20},
  confirmDays:3,
  minHold:8,
  trailStop:stop,
});

export const PHASE5_FREEZES: Phase5Freeze[] = [
  {
    id:"UPRO_SPBT", ticker:"UPRO", proxy:"SPY", name:"UPRO + S&P Broad Trend", version:"UPRO-SPBT-v1.0", role:"PRIMARY_CHALLENGER",
    frozenAt:"2026-08-25T15:15:00.000Z", startDate:PHASE5_FORWARD_START, initialCapital:PHASE5_INITIAL_CAPITAL,
    config:spbt(.13),
    assumptions:{signal:"market close t",execution:"next available US market open t+1",commissionBps:3,slippageBps:5,currency:"JPY-normalized; FX return excluded"},
  },
  {
    id:"SSO_SPBT_SCALED", ticker:"SSO", proxy:"SPY", name:"SSO + S&P Broad Trend + scaled stop", version:"SSO-SPBT-Scaled-v1.0", role:"S&P_LEVERAGE_CONTROL",
    frozenAt:"2026-08-25T15:15:00.000Z", startDate:PHASE5_FORWARD_START, initialCapital:PHASE5_INITIAL_CAPITAL,
    config:spbt(scaledStop),
    assumptions:{signal:"market close t",execution:"next available US market open t+1",commissionBps:3,slippageBps:5,currency:"JPY-normalized; FX return excluded"},
  },
  {
    id:"QLD_VS13_SCALED", ticker:"QLD", proxy:"QQQ", name:"QLD + Common VS13 + scaled stop", version:"QLD-VS13-Scaled-v1.0", role:"NASDAQ_BALANCED_CONTROL",
    frozenAt:"2026-08-25T15:15:00.000Z", startDate:PHASE5_FORWARD_START, initialCapital:PHASE5_INITIAL_CAPITAL,
    config:{...STRATEGIES.defensive,trailStop:scaledStop},
    assumptions:{signal:"market close t",execution:"next available US market open t+1",commissionBps:3,slippageBps:5,currency:"JPY-normalized; FX return excluded"},
  },
];

export type Phase5Execution = {
  signalDate:string; intendedDate:string; recordedDate:string; price:number; before:number; after:number; turnover:number;
  commission:number; slippage:number; totalCost:number; status:"ON_TIME"|"SCHEDULED_CATCHUP";
};
export type Phase5Record = {
  key:string; marketDataDate:string; recordedAt:string; recordMode:"LIVE"|"BACKFILLED_OBSERVATION"; strategyId:Phase5Id; ticker:Phase5Ticker;
  strategyName:string; strategyVersion:string; score:number; components:Signal["components"]; regime:string; targetExposure:number; previousExposure:number;
  signal:string; tradeReason:string; intendedExecutionDate:string; execution:Phase5Execution|null; assetClose:number; position:number; quantity:number; cash:number;
  equity:number; dailyReturn:number; currentDrawdown:number; cumulativeCosts:number; corporateActionFactor?:number; corporateActionKind?:"SPLIT"|"REVERSE_SPLIT"; dataSource:string; dataStatus:"VALID"|"BACKFILLED_NO_SIGNAL"; buildVersion:string;
};
export type Phase5Ledger = {
  schemaVersion:1; createdAt:string; updatedAt:string; appendOnly:true; freezes:Phase5Freeze[];
  reviewSchedule:{interim:string;formal:string;stronger:string}; promotionPolicy:string; records:Phase5Record[];
};

type Payload={source?:string;retrievedAt?:string;series:Record<string,Bar[]>};

export function emptyPhase5Ledger(now=new Date().toISOString()):Phase5Ledger{
  return{
    schemaVersion:1,createdAt:now,updatedAt:now,appendOnly:true,freezes:structuredClone(PHASE5_FREEZES),records:[],
    reviewSchedule:{interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"},
    promotionPolicy:"Human approval only. No promotion before 12 months. Require true Forward observations, >=6 executed non-zero-turnover trades/actions where naturally generated, multiple regimes, missing/invalid <=1%, <=40 Action Days/year, no integrity/execution defect, and no unexplained drawdown materially outside historical stress expectations. Phase 6 uses Pareto evidence; Forward robustness outranks historical CAGR.",
  };
}

function meta(bars:Bar[]){return{start:bars[0]?.date||"",end:bars.at(-1)?.date||"",count:bars.length,adjusted:false}}
function datasetFor(payload:Payload,freeze:Phase5Freeze):Dataset{
  const lev=payload.series[freeze.ticker],under=payload.series[freeze.proxy],spy=payload.series.SPY,vix=payload.series.VIX;
  if(!lev||!under||!spy||!vix)throw new Error(`Phase 5 missing series for ${freeze.ticker}`);
  const lm=new Map(lev.map(x=>[x.date,x])),um=new Map(under.map(x=>[x.date,x])),sm=new Map(spy.map(x=>[x.date,x])),vm=new Map(vix.map(x=>[x.date,x]));
  const dates=lev.map(x=>x.date).filter(d=>um.has(d)&&sm.has(d)&&vm.has(d));
  if(dates.length<252)throw new Error(`Phase 5 insufficient common history for ${freeze.ticker}`);
  return{days:dates.map(date=>({date,tqqq:lm.get(date)!,qqq:um.get(date)!,spy:sm.get(date)!,vix:vm.get(date)!})),issues:[],source:"auto",precision:"next-open",retrievedAt:payload.retrievedAt,provider:payload.source,tickers:{TQQQ:meta(lev),QQQ:meta(under),SPY:meta(spy),VIX:meta(vix)}};
}

const keyOf=(version:string,date:string)=>`${version}|${date}`;
const observationSignal=(date:string,target:number,asset:string):Signal=>({
  date,score:0,components:{trend:0,momentum:0,volatility:0,market:0},regime:"Missing live observation",target,previousTarget:target,
  reason:`${asset}: missed live signal; observation only`,nextChange:"No retrospective signal",
  indicators:{sma50:NaN,sma200:NaN,rsi:NaN,momentum63:NaN,realizedVol:NaN,atrPct:NaN,vix:NaN},
});

function appendFreeze(ds:Dataset,ledger:Phase5Ledger,freeze:Phase5Freeze,source:string,generatedAt:string){
  const allRows=()=>ledger.records.filter(r=>r.strategyVersion===freeze.version).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
  const prior=allRows();
  const last=prior.at(-1);
  const startIndex=last?ds.days.findIndex(d=>d.date===last.marketDataDate)+1:ds.days.findIndex(d=>d.date>=freeze.startDate);
  if(startIndex<0)return;
  for(let i=startIndex;i<ds.days.length;i++){
    const day=ds.days[i];
    if(day.date<freeze.startDate)throw new Error(`Phase 5 pre-start write blocked ${freeze.version} ${day.date}`);
    if(ledger.records.some(r=>r.key===keyOf(freeze.version,day.date)))continue;
    const rows=allRows(),previous=rows.at(-1),isLatest=i===ds.days.length-1;
    const asset=day.tqqq,providerPriorDay=previous?ds.days.find(x=>x.date===previous.marketDataDate):undefined,continuity=previous&&providerPriorDay?corporateActionContinuity(previous.assetClose,providerPriorDay.tqqq.close):null;
    if(previous&&continuity)assertPlausibleTransition(continuity.adjustedPriorClose,asset.open,continuity);
    const priorClose=continuity?.adjustedPriorClose??previous?.assetClose??asset.close;
    let equity=previous?.equity??freeze.initialCapital;
    const previousExposure=previous?.position??0;
    let actualExposure=previousExposure,execution:Phase5Execution|null=null,cumulativeCosts=previous?.cumulativeCosts??0;
    if(previous){
      equity*=1+previousExposure*(asset.open/priorClose-1);
      if(previous.targetExposure!==previous.position&&previous.intendedExecutionDate<=day.date){
        const turnover=Math.abs(previous.targetExposure-previous.position),commission=equity*turnover*.0003,slippage=equity*turnover*.0005,totalCost=commission+slippage;
        equity-=totalCost;cumulativeCosts+=totalCost;
        execution={signalDate:previous.marketDataDate,intendedDate:previous.intendedExecutionDate,recordedDate:day.date,price:asset.open*(previous.targetExposure>previous.position?1.0005:.9995),before:previous.position,after:previous.targetExposure,turnover,commission,slippage,totalCost,status:previous.intendedExecutionDate===day.date?"ON_TIME":"SCHEDULED_CATCHUP"};
        actualExposure=previous.targetExposure;
      }
      equity*=1+actualExposure*(asset.close/asset.open-1);
    }
    if(!Number.isFinite(equity)||equity<=0)throw new Error(`Phase 5 invalid equity ${freeze.version} ${day.date}: ${equity}`);
    const peak=Math.max(freeze.initialCapital,...rows.map(r=>r.equity),equity),currentDrawdown=equity/peak-1;
    const sig=isLatest?signals(ds.days.slice(0,i+1),freeze.config).at(-1)!:observationSignal(day.date,actualExposure,freeze.ticker);
    const targetExposure=isLatest?sig.target:actualExposure;
    const record:Phase5Record={
      key:keyOf(freeze.version,day.date),marketDataDate:day.date,recordedAt:generatedAt,recordMode:isLatest?"LIVE":"BACKFILLED_OBSERVATION",strategyId:freeze.id,ticker:freeze.ticker,
      strategyName:freeze.name,strategyVersion:freeze.version,score:sig.score,components:sig.components,regime:sig.regime,targetExposure,previousExposure,
      signal:targetExposure===actualExposure?"HOLD":targetExposure>actualExposure?"INCREASE":"REDUCE",tradeReason:sig.reason,intendedExecutionDate:isLatest?earliestLegalExecutionDate(day.date,generatedAt):nextExecutionDate(day.date),execution,
      assetClose:asset.close,position:actualExposure,quantity:asset.close?equity*actualExposure/asset.close:0,cash:equity*(1-actualExposure),equity,
      dailyReturn:previous?equity/previous.equity-1:0,currentDrawdown,cumulativeCosts,...(continuity&&continuity.kind!=="NONE"&&continuity.kind!=="UNEXPLAINED_RESTATEMENT"?{corporateActionFactor:continuity.factor,corporateActionKind:continuity.kind}:{}),dataSource:source,dataStatus:isLatest?"VALID":"BACKFILLED_NO_SIGNAL",buildVersion:PHASE5_BUILD,
    };
    ledger.records.push(record);
  }
}

function assertPhase5FreezeIntegrity(ledger:Phase5Ledger){for(const frozen of PHASE5_FREEZES){const existing=ledger.freezes.find(x=>x.version===frozen.version);if(!existing)throw new Error(`Phase 5 freeze missing: ${frozen.version}`);if(JSON.stringify(existing)!==JSON.stringify(frozen))throw new Error(`Phase 5 freeze drift blocked: ${frozen.version}`)}if(ledger.freezes.length!==PHASE5_FREEZES.length)throw new Error("Phase 5 unexpected freeze definition")};
export function updatePhase5LedgerSubset(payload:Payload,input:Phase5Ledger|null|undefined,versions:string[],generatedAt=new Date().toISOString()):Phase5Ledger{
  if(input&&(input.schemaVersion!==1||input.appendOnly!==true))throw new Error("Phase 5 prior ledger is invalid; refusing append-only reset");
  const ledger=input?structuredClone(input):emptyPhase5Ledger(generatedAt);assertPhase5FreezeIntegrity(ledger);const wanted=new Set(versions);
  for(const version of wanted)if(!PHASE5_FREEZES.some(f=>f.version===version))throw new Error(`Phase 5 unknown frozen version: ${version}`);
  for(const freeze of ledger.freezes.filter(f=>wanted.has(f.version)))appendFreeze(datasetFor(payload,freeze),ledger,freeze,payload.source||"official",generatedAt);
  if(ledger.records.some(r=>r.marketDataDate<PHASE5_FORWARD_START))throw new Error("Phase 5 ledger contains pre-start record");
  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));ledger.updatedAt=generatedAt;return ledger;
}
export function updatePhase5Ledger(payload:Payload,input?:Phase5Ledger|null,generatedAt=new Date().toISOString()):Phase5Ledger{return updatePhase5LedgerSubset(payload,input,PHASE5_FREEZES.map(f=>f.version),generatedAt)}

export type Phase5Summary={version:string;ticker:Phase5Ticker;role:Phase5Role;observations:number;liveObservations:number;missing:number;executions:number;actionDays:number;currentCapital:number;totalReturn:number;currentDd:number;metrics:Metrics;evidence:"INSUFFICIENT"|"LOW"|"MODERATE"|"FORMAL_READY";status:"FORWARD_ACTIVE"|"AWAITING_FIRST_BAR"|"DATA_REVIEW_REQUIRED"};
export function summarizePhase5(ledger:Phase5Ledger):Phase5Summary[]{return ledger.freezes.map(f=>{const rows=ledger.records.filter(r=>r.strategyVersion===f.version).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)),live=rows.filter(r=>r.dataStatus==="VALID"),expectedSessions=rows.length?countNyseSessions(f.startDate,rows.at(-1)!.marketDataDate):0,missing=Math.max(0,expectedSessions-live.length),missingRatio=missing/Math.max(expectedSessions,1),executions=rows.filter(r=>r.execution&&r.execution.turnover>0),actionDays=new Set(executions.map(r=>r.execution!.recordedDate)).size,m=metricSet(rows.map(r=>r.dailyReturn),[],[],rows.map(r=>r.marketDataDate),rows.map(r=>r.position)),months=live.length/21;let evidence:Phase5Summary["evidence"]="INSUFFICIENT";if(months>=12&&executions.length>=6&&missingRatio<=.01)evidence="FORMAL_READY";else if(months>=6)evidence="MODERATE";else if(months>=3)evidence="LOW";const status:Phase5Summary["status"]=rows.length===0?"AWAITING_FIRST_BAR":missingRatio>.01&&expectedSessions>=20?"DATA_REVIEW_REQUIRED":"FORWARD_ACTIVE";return{version:f.version,ticker:f.ticker,role:f.role,observations:rows.length,liveObservations:live.length,missing,executions:executions.length,actionDays,currentCapital:rows.at(-1)?.equity??f.initialCapital,totalReturn:(rows.at(-1)?.equity??f.initialCapital)/f.initialCapital-1,currentDd:rows.at(-1)?.currentDrawdown??0,metrics:m,evidence,status}})}
