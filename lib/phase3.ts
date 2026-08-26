import { metricSet, runBacktest, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";

export type Phase3Group = "NASDAQ" | "SP500";
export type Phase3Family =
  | "COMMON"
  | "NQ_MOMENTUM_TILT" | "NQ_TREND_CONFIRM" | "NQ_VOL_CONTROL"
  | "SP_BROAD_TREND" | "SP_VOL_BALANCE" | "SP_SMOOTH_POSITION";

type Payload={source?:string;retrievedAt?:string;crossSeries?:Record<string,Bar[]>};
type M=Pick<Metrics,"cagr"|"totalReturn"|"annualizedVolatility"|"sharpe"|"sortino"|"maxDd"|"calmar"|"ulcerIndex"|"exposure"|"timeInCash">&{actionDaysPerYear:number};
type D={date:string;dailyReturn:number;position:number};
type FamilyDef={id:Phase3Family;name:string;hypothesis:string;complexity:number;config:(row:ScreeningRow)=>StrategyConfig;neighbors:(row:ScreeningRow)=>StrategyConfig[]};
type Phase3Year={year:number;metrics:M};
type Phase3Row={
  ticker:CrossTicker;underlying:ScreeningRow["underlying"];leverage:ScreeningRow["leverage"];family:Phase3Family;name:string;hypothesis:string;complexity:number;incumbent:boolean;
  oos:M;stress25:M;delay2:M;parameterNeighborhood:{label:string;metrics:M}[];stabilityFloor:number;yearly:Phase3Year[];maxYearActionDays:number;
  regimes:{id:string;start:string;end:string;metrics:M}[];absoluteRobustness:boolean;noSevereRegression:boolean;materialValue:boolean;gatePassed:boolean;score:number;
};

const OOS_START="2020-01-02";
const lev=(r:ScreeningRow)=>r.leverage.startsWith("2")?2:3;
const stopFor=(r:ScreeningRow)=>.13*lev(r)/3;
const normalize=(w:StrategyConfig["weights"])=>{const s=w.trend+w.momentum+w.volatility+w.market;return{trend:w.trend/s,momentum:w.momentum/s,volatility:w.volatility/s,market:w.market/s}};
const tilt=(w:StrategyConfig["weights"],k:keyof StrategyConfig["weights"],factor:number)=>normalize({...w,[k]:w[k]*factor});
const out=(m:Metrics,a:number):M=>({cagr:m.cagr,totalReturn:m.totalReturn,annualizedVolatility:m.annualizedVolatility,sharpe:m.sharpe,sortino:m.sortino,maxDd:m.maxDd,calmar:m.calmar,ulcerIndex:m.ulcerIndex,exposure:m.exposure,timeInCash:m.timeInCash,actionDaysPerYear:a});
const fromDaily=(d:D[],a=0)=>out(metricSet(d.map(x=>x.dailyReturn),[],[],d.map(x=>x.date),d.map(x=>x.position)),a);
const sliceMetrics=(full:D[],start:string,end:string):M=>{
  const selected:D[]=[];let changes=0;
  for(let i=0;i<full.length;i++)if(full[i].date>=start&&full[i].date<=end){selected.push(full[i]);if(i>0&&full[i].position!==full[i-1].position)changes++;}
  const years=Math.max(selected.length/252,1/252);
  return fromDaily(selected,changes/years);
};
const baseConfig=(r:ScreeningRow):StrategyConfig=>({...STRATEGIES.defensive,trailStop:stopFor(r)});
const mk=(r:ScreeningRow,weights:StrategyConfig["weights"],patch:Partial<StrategyConfig>={}):StrategyConfig=>({...baseConfig(r),weights,...patch});

const familyDefs=(group:Phase3Group):FamilyDef[]=>{
  if(group==="NASDAQ"){
    const momW={trend:.30,momentum:.24,volatility:.28,market:.18};
    const trW={trend:.40,momentum:.25,volatility:.20,market:.15};
    const volW={trend:.27,momentum:.15,volatility:.42,market:.16};
    return[
      {id:"COMMON",name:"Phase 2 Common incumbent",hypothesis:"Frozen incumbent baseline.",complexity:0,config:r=>baseConfig(r),neighbors:r=>[{...baseConfig(r),trailStop:stopFor(r)*.9},{...baseConfig(r),trailStop:stopFor(r)*1.1}]},
      {id:"NQ_MOMENTUM_TILT",name:"Nasdaq Momentum Tilt",hypothesis:"Nasdaq-100 medium-term momentum persistence may justify a moderate momentum tilt.",complexity:1,config:r=>mk(r,momW),neighbors:r=>[mk(r,tilt(momW,"momentum",.9)),mk(r,tilt(momW,"momentum",1.1))]},
      {id:"NQ_TREND_CONFIRM",name:"Nasdaq Trend Confirmation",hypothesis:"Stronger trend confirmation may reduce whipsaw and premature crash re-entry.",complexity:1,config:r=>mk(r,trW,{confirmDays:3,minHold:8}),neighbors:r=>[mk(r,tilt(trW,"trend",.9),{confirmDays:3,minHold:8}),mk(r,tilt(trW,"trend",1.1),{confirmDays:3,minHold:8})]},
      {id:"NQ_VOL_CONTROL",name:"Nasdaq Volatility Control",hypothesis:"Greater volatility emphasis may improve geometric risk-adjusted return under leverage.",complexity:1,config:r=>mk(r,volW),neighbors:r=>[mk(r,tilt(volW,"volatility",.9)),mk(r,tilt(volW,"volatility",1.1))]},
    ];
  }
  const trendW={trend:.36,momentum:.16,volatility:.28,market:.20};
  const volW={trend:.30,momentum:.14,volatility:.36,market:.20};
  const baseW={...STRATEGIES.defensive.weights};
  return[
    {id:"COMMON",name:"Phase 2 Common incumbent",hypothesis:"Frozen incumbent baseline.",complexity:0,config:r=>baseConfig(r),neighbors:r=>[{...baseConfig(r),trailStop:stopFor(r)*.9},{...baseConfig(r),trailStop:stopFor(r)*1.1}]},
    {id:"SP_BROAD_TREND",name:"S&P Broad Trend",hypothesis:"Broad-market trend persistence may be more useful than aggressive momentum emphasis.",complexity:1,config:r=>mk(r,trendW,{confirmDays:3,minHold:8}),neighbors:r=>[mk(r,tilt(trendW,"trend",.9),{confirmDays:3,minHold:8}),mk(r,tilt(trendW,"trend",1.1),{confirmDays:3,minHold:8})]},
    {id:"SP_VOL_BALANCE",name:"S&P Volatility Balance",hypothesis:"Moderately stronger volatility control may improve broad-market leverage efficiency.",complexity:1,config:r=>mk(r,volW),neighbors:r=>[mk(r,tilt(volW,"volatility",.9)),mk(r,tilt(volW,"volatility",1.1))]},
    {id:"SP_SMOOTH_POSITION",name:"S&P Smooth Position",hypothesis:"Longer confirmation and holding constraints may reduce broad-market churn without losing most edge.",complexity:1,config:r=>mk(r,baseW,{confirmDays:3,minHold:10,cooldown:10}),neighbors:r=>[mk(r,baseW,{confirmDays:2,minHold:8,cooldown:10}),mk(r,baseW,{confirmDays:4,minHold:12,cooldown:10})]},
  ];
};

function run(ds:Dataset,cfg:StrategyConfig,costBps=8,delay=1,active=OOS_START){
  const c={...cfg,activeFrom:active};
  const bt=runBacktest(ds,c,{commissionBps:3,slippageBps:Math.max(0,costBps-3),delay});
  const daily=bt.daily.filter(x=>x.date>=active).map(x=>({date:x.date,dailyReturn:x.dailyReturn,position:x.position}));
  const yrs=Math.max(daily.length/252,1/252),orders=bt.orders.filter(x=>x.executionDate>=active),actionDays=new Set(orders.map(x=>x.executionDate)).size/yrs;
  return{metrics:fromDaily(daily,actionDays),daily};
}

const windows=[
  {id:"COVID",start:"2020-02-19",end:"2020-06-30"},
  {id:"2022_BEAR",start:"2022-01-03",end:"2022-12-30"},
  {id:"2023_2024_BULL",start:"2023-01-03",end:"2024-12-31"},
] as const;

const material=(m:M,b:M)=>
  m.calmar>=b.calmar*1.10 ||
  m.sortino>=b.sortino*1.08 ||
  (m.cagr>=b.cagr*1.08 && m.maxDd>=b.maxDd-.03) ||
  (m.maxDd>=b.maxDd+.05 && m.cagr>=b.cagr*.90);
const noRegression=(m:M,b:M)=>m.cagr>=b.cagr*.85&&m.calmar>=b.calmar*.90&&m.sortino>=b.sortino*.90&&m.maxDd>=b.maxDd-.03;
const score=(m:M,stability:number,complexity:number)=>.32*m.calmar+.24*m.sortino+.12*m.sharpe+.16*m.cagr-.10*Math.abs(m.maxDd)+.08*Math.min(1.25,stability)-.05*complexity;

export function phase3Bundle(payload:Payload,group:Phase3Group){
  const tickers:CrossTicker[]=group==="NASDAQ"?["TQQQ","QLD"]:["UPRO","SSO"];
  const defs=familyDefs(group),rows:Phase3Row[]=[];
  for(const ticker of tickers){
    const row=SCREENING.find(x=>x.ticker===ticker)!;
    const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START);
    if(!ds)continue;
    const commonDef=defs[0],commonRun=run(ds,commonDef.config(row)),common=commonRun.metrics;
    for(const f of defs){
      const r=run(ds,f.config(row)),stress25=run(ds,f.config(row),25,1),delay2=run(ds,f.config(row),8,2);
      const neigh=f.neighbors(row).map((c,i)=>({label:i===0?"LOW":"HIGH",metrics:run(ds,c).metrics}));
      const stabilityFloor=Math.min(...neigh.map(x=>x.metrics.calmar))/Math.max(Math.abs(r.metrics.calmar),1e-9);
      const yearly:Phase3Year[]=[];for(let y=2020;y<=2026;y++){const a=`${y}-01-01`,b=`${y}-12-31`,m=sliceMetrics(r.daily,a,b);const n=r.daily.filter(x=>x.date>=a&&x.date<=b).length;if(n>=20)yearly.push({year:y,metrics:m});}
      const maxYearActionDays=Math.max(0,...yearly.map(x=>x.metrics.actionDaysPerYear));
      const regimes=windows.map(w=>({id:w.id,start:w.start,end:w.end,metrics:sliceMetrics(r.daily,w.start,w.end)}));
      const absolute=r.metrics.cagr>0&&r.metrics.calmar>0&&stress25.metrics.cagr>0&&delay2.metrics.cagr>0&&r.metrics.actionDaysPerYear<=40&&maxYearActionDays<=40&&stabilityFloor>=.75;
      const regression=f.id==="COMMON"?true:noRegression(r.metrics,common);
      const materialValue=f.id==="COMMON"?false:material(r.metrics,common);
      const gatePassed=f.id!=="COMMON"&&absolute&&regression&&materialValue;
      rows.push({ticker,underlying:row.underlying,leverage:row.leverage,family:f.id,name:f.name,hypothesis:f.hypothesis,complexity:f.complexity,incumbent:f.id==="COMMON",oos:r.metrics,stress25:stress25.metrics,delay2:delay2.metrics,parameterNeighborhood:neigh,stabilityFloor,yearly,maxYearActionDays,regimes,absoluteRobustness:absolute,noSevereRegression:regression,materialValue,gatePassed,score:score(r.metrics,stabilityFloor,f.complexity)});
    }
  }
  const decisions=tickers.map(ticker=>{
    const x=rows.filter(r=>r.ticker===ticker),common=x.find(r=>r.family==="COMMON"),eligible=x.filter(r=>r.gatePassed).sort((a,b)=>b.score-a.score),winner=eligible[0];
    return{ticker,status:winner?"NATIVE CANDIDATE":"NO NATIVE CANDIDATE",incumbent:"COMMON",candidate:winner?.family??null,candidateName:winner?.name??null,reason:winner?"Passed absolute robustness, no-regression, yearly operational-cap and pre-registered material-value hurdles; highest robustness-first bounded score among passing Native families.":"No Native family cleared all pre-registered robustness, yearly operational-cap and material-value hurdles; retain Phase 2 Common incumbent.",incumbentMetrics:common?.oos??null,candidateMetrics:winner?.oos??null,candidateMaxYearActionDays:winner?.maxYearActionDays??null};
  });
  return{schemaVersion:1,phase:"PHASE_3_BOUNDED_NATIVE_RESEARCH",group,generatedAt:new Date().toISOString(),oosStart:OOS_START,policy:"Underlying-level Native families only; leverage-specific difference limited to mechanical stop scaling; <=40 Action Days/year required both overall and in each yearly slice; max one Native candidate per ticker; NO NATIVE CANDIDATE is valid; no Forward or Production promotion.",families:defs.map(x=>({id:x.id,name:x.name,hypothesis:x.hypothesis,complexity:x.complexity})),rows,decisions,limitations:["Historical data is already inspected and cannot serve as pristine confirmatory evidence.","Native families are deliberately few but were motivated by known market structure; Forward evidence remains required.","Selection score only orders families that already pass hard gates; it cannot rescue a failed family.","Yearly Action Days are reconstructed from executed daily position changes and are used only as an operational-cap diagnostic.","No ticker-specific fine tuning, optimization grid, inverse ETF, hierarchical switching or automatic promotion is allowed in Phase 3."]};
}
