import { metricSet, runBacktest, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";
import type { Phase15Family } from "./phase1-5.ts";

const CORE_TICKERS: CrossTicker[]=["TQQQ","QLD","UPRO","SSO"];
const FAMILIES: Phase15Family[]=["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP","SIMPLE_200DMA","VS13_VOL30"];
const PRIMARY=new Set<Phase15Family>(["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP"]);
const OOS_START="2020-01-02";

type Payload={source?:string;retrievedAt?:string;crossSeries?:Record<string,Bar[]>};
type M=Pick<Metrics,"cagr"|"totalReturn"|"annualizedVolatility"|"sharpe"|"sortino"|"maxDd"|"calmar"|"ulcerIndex"|"exposure"|"timeInCash">&{actionDaysPerYear:number};
type D={date:string;dailyReturn:number;position:number};
type YearRow={year:number;metrics:M};
type RegimeRow={id:string;start:string;end:string;metrics:M};
type NeighborhoodRow={label:string;metrics:M};
type CoreRow={ticker:CrossTicker;underlying:string;leverage:string;family:Phase15Family;full:M;oos:M;yearly:YearRow[];regimes:RegimeRow[];parameterNeighborhood:NeighborhoodRow[];stabilityFloor:number|null;operationalCapPassed:boolean};
const lev=(r:ScreeningRow)=>r.leverage.startsWith("2")?2:3;
const out=(m:Metrics,a=m.ordersPerYear):M=>({cagr:m.cagr,totalReturn:m.totalReturn,annualizedVolatility:m.annualizedVolatility,sharpe:m.sharpe,sortino:m.sortino,maxDd:m.maxDd,calmar:m.calmar,ulcerIndex:m.ulcerIndex,exposure:m.exposure,timeInCash:m.timeInCash,actionDaysPerYear:a});
const fromDaily=(d:D[],a=0)=>out(metricSet(d.map(x=>x.dailyReturn),[],[],d.map(x=>x.date),d.map(x=>x.position)),a);

function cfg(f:Phase15Family,r:ScreeningRow,p=0):StrategyConfig|null{
  if(f==="SIMPLE_200DMA")return null;
  if(f==="VS13_FIXED")return{...STRATEGIES.defensive,trailStop:.13*(1+p)};
  if(f==="VS13_LEVERAGE_SCALED_STOP")return{...STRATEGIES.defensive,trailStop:.13*lev(r)/3*(1+p)};
  return{...STRATEGIES.defensive,sizing:"volTarget",targetPortfolioVol:.30};
}
function simple(ds:Dataset,active?:string){
  const u=ds.days.map(x=>x.qqq.close),ret:number[]=[],pos:number[]=[],dates:string[]=[];let equity=1,p=0,next=0,changes=0;
  for(let i=1;i<ds.days.length;i++){
    const d=ds.days[i],pr=ds.days[i-1],start=equity;equity*=1+p*(d.tqqq.open/pr.tqqq.close-1);
    if(next!==p){equity*=1-Math.abs(next-p)*.0008;p=next;if(!active||d.date>=active)changes++;}
    equity*=1+p*(d.tqqq.close/d.tqqq.open-1);
    if(!active||d.date>=active){ret.push(equity/start-1);pos.push(p);dates.push(d.date)}
    if(i>=199){let s=0;for(let j=i-199;j<=i;j++)s+=u[j];next=u[i]>s/200?1:0}else next=0;
  }
  const years=Math.max(ret.length/252,1/252),daily=dates.map((date,i)=>({date,dailyReturn:ret[i],position:pos[i]}));
  return{metrics:fromDaily(daily,changes/years),daily};
}
function eng(ds:Dataset,f:Phase15Family,r:ScreeningRow,active?:string,p=0){
  const c=cfg(f,r,p)!;if(active)c.activeFrom=active;
  const bt=runBacktest(ds,c,{commissionBps:3,slippageBps:5,delay:1});
  const daily=bt.daily.filter(x=>!active||x.date>=active).map(x=>({date:x.date,dailyReturn:x.dailyReturn,position:x.position}));
  const yrs=Math.max(daily.length/252,1/252),orders=bt.orders.filter(x=>!active||x.executionDate>=active),a=new Set(orders.map(x=>x.executionDate)).size/yrs;
  return{metrics:fromDaily(daily,a),daily};
}
const run=(ds:Dataset,f:Phase15Family,r:ScreeningRow,active?:string,p=0)=>f==="SIMPLE_200DMA"?simple(ds,active):eng(ds,f,r,active,p);
const windows=[
{id:"2018_Q4",start:"2018-09-20",end:"2018-12-31"},
{id:"COVID",start:"2020-02-19",end:"2020-06-30"},
{id:"2022_BEAR",start:"2022-01-03",end:"2022-12-30"},
{id:"2023_2024_BULL",start:"2023-01-03",end:"2024-12-31"},
] as const;

export function phase2CoreBundle(payload:Payload){
  const datasets=CORE_TICKERS.flatMap(t=>{const row=SCREENING.find(x=>x.ticker===t);if(!row)return[];const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START);return ds?[{row,ds}]:[]});
  const rows:CoreRow[]=[];
  for(const {row,ds} of datasets)for(const family of FAMILIES){
    const full=run(ds,family,row),oos=run(ds,family,row,OOS_START);
    const yearly:YearRow[]=[];for(let y=2020;y<=2026;y++){const a=`${y}-01-01`,b=`${y}-12-31`,d=oos.daily.filter(x=>x.date>=a&&x.date<=b);if(d.length>=20)yearly.push({year:y,metrics:fromDaily(d)});}
    const regimes:RegimeRow[]=windows.map(w=>({id:w.id,start:w.start,end:w.end,metrics:fromDaily(full.daily.filter(x=>x.date>=w.start&&x.date<=w.end))}));
    const neighborhood:NeighborhoodRow[]=PRIMARY.has(family)?[-.10,0,.10].map(p=>({label:p===0?"BASE":p<0?"-10%":"+10%",metrics:p===0?oos.metrics:run(ds,family,row,OOS_START,p).metrics})):[];
    const floor=neighborhood.length?Math.min(...neighborhood.map(x=>x.metrics.calmar))/Math.max(Math.abs(oos.metrics.calmar),1e-9):null;
    rows.push({ticker:row.ticker,underlying:row.underlying,leverage:row.leverage,family,full:full.metrics,oos:oos.metrics,yearly,regimes,parameterNeighborhood:neighborhood,stabilityFloor:floor,operationalCapPassed:oos.metrics.actionDaysPerYear<=40});
  }
  return{schemaVersion:1,phase:"PHASE_2A_CORE_ROBUSTNESS",generatedAt:new Date().toISOString(),oosStart:OOS_START,rows,summary:CORE_TICKERS.map(t=>({ticker:t,rows:rows.filter(x=>x.ticker===t).map(x=>({family:x.family,oos:x.oos,stabilityFloor:x.stabilityFloor,operationalCapPassed:x.operationalCapPassed}))})),limitations:["Historical data is already inspected; this is robustness evidence, not pristine holdout evidence.","Parameter neighborhoods apply only to production-oriented primary families and are fragility diagnostics, not parameter selection.","No Forward or Production promotion is performed here."]};
}
