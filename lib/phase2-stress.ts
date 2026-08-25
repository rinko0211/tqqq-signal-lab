import { metricSet, runBacktest, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";
import type { Phase15Family } from "./phase1-5.ts";

const CORE_TICKERS:CrossTicker[]=["TQQQ","QLD","UPRO","SSO"];
const FAMILIES:Phase15Family[]=["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP"];
const OOS_START="2020-01-02";
type Payload={source?:string;retrievedAt?:string;crossSeries?:Record<string,Bar[]>};
type M=Pick<Metrics,"cagr"|"totalReturn"|"annualizedVolatility"|"sharpe"|"sortino"|"maxDd"|"calmar"|"ulcerIndex"|"exposure"|"timeInCash">&{actionDaysPerYear:number};
const lev=(r:ScreeningRow)=>r.leverage.startsWith("2")?2:3;
const cfg=(f:Phase15Family,r:ScreeningRow):StrategyConfig=>f==="VS13_FIXED"?{...STRATEGIES.defensive}:{...STRATEGIES.defensive,trailStop:.13*lev(r)/3};
const out=(m:Metrics,a:number):M=>({cagr:m.cagr,totalReturn:m.totalReturn,annualizedVolatility:m.annualizedVolatility,sharpe:m.sharpe,sortino:m.sortino,maxDd:m.maxDd,calmar:m.calmar,ulcerIndex:m.ulcerIndex,exposure:m.exposure,timeInCash:m.timeInCash,actionDaysPerYear:a});
function run(ds:Dataset,f:Phase15Family,r:ScreeningRow,costBps=8,delay=1){
  const c=cfg(f,r);c.activeFrom=OOS_START;
  const bt=runBacktest(ds,c,{commissionBps:3,slippageBps:Math.max(0,costBps-3),delay});
  const daily=bt.daily.filter(x=>x.date>=OOS_START),years=Math.max(daily.length/252,1/252),orders=bt.orders.filter(x=>x.executionDate>=OOS_START),a=new Set(orders.map(x=>x.executionDate)).size/years;
  const m=metricSet(daily.map(x=>x.dailyReturn),[],[],daily.map(x=>x.date),daily.map(x=>x.position));
  return out(m,a);
}
export function phase2StressBundle(payload:Payload){
  const datasets=CORE_TICKERS.flatMap(t=>{const row=SCREENING.find(x=>x.ticker===t);if(!row)return[];const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START);return ds?[{row,ds}]:[]});
  const rows:any[]=[];
  for(const {row,ds} of datasets)for(const family of FAMILIES){
    const base=run(ds,family,row,8,1);
    const costStress=[8,15,25,50].map(costBps=>({costBps,metrics:costBps===8?base:run(ds,family,row,costBps,1)}));
    const delayStress=[1,2,3].map(delay=>({delay,metrics:delay===1?base:run(ds,family,row,8,delay)}));
    const c25=costStress.find(x=>x.costBps===25)!.metrics,d3=delayStress.find(x=>x.delay===3)!.metrics;
    const robust=base.cagr>0&&base.calmar>0&&c25.cagr>0&&d3.cagr>0&&base.actionDaysPerYear<=40;
    rows.push({ticker:row.ticker,underlying:row.underlying,leverage:row.leverage,family,base,costStress,delayStress,robust,operationalCapPassed:base.actionDaysPerYear<=40});
  }
  return{schemaVersion:1,phase:"PHASE_2B_EXECUTION_STRESS",generatedAt:new Date().toISOString(),oosStart:OOS_START,rows,summary:CORE_TICKERS.map(t=>({ticker:t,rows:rows.filter(x=>x.ticker===t).map(x=>({family:x.family,base:x.base,robust:x.robust,operationalCapPassed:x.operationalCapPassed}))})),limitations:["Execution stress is limited to the two production-oriented primary families.","Historical evidence is already inspected; Forward remains decisive.","No parameter selection or promotion occurs in this phase."]};
}
