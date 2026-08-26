import { metricSet, runBacktest, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";
import type { Phase15Family } from "./phase1-5.ts";

const CORE_TICKERS: CrossTicker[] = ["TQQQ", "QLD", "UPRO", "SSO"];
const FAMILIES: Phase15Family[] = ["VS13_FIXED", "VS13_LEVERAGE_SCALED_STOP", "SIMPLE_200DMA", "VS13_VOL30"];
const OOS_START = "2020-01-02";

export type Phase2Metrics = Pick<Metrics,
  "cagr" | "totalReturn" | "annualizedVolatility" | "sharpe" | "sortino" |
  "maxDd" | "calmar" | "ulcerIndex" | "exposure" | "timeInCash"
> & { actionDaysPerYear: number };

type Payload = { source?: string; retrievedAt?: string; crossSeries?: Record<string, Bar[]> };

type SeriesRun = {
  metrics: Phase2Metrics;
  daily: { date: string; dailyReturn: number; position: number }[];
};
type Phase2Year={year:number;metrics:Phase2Metrics};
type Phase2Row={
  ticker:CrossTicker;underlying:ScreeningRow["underlying"];leverage:ScreeningRow["leverage"];family:Phase15Family;
  full:Phase2Metrics;oos:Phase2Metrics;walkForwardYears:Phase2Year[];
  costStress:{costBps:number;metrics:Phase2Metrics}[];delayStress:{delay:number;metrics:Phase2Metrics}[];
  regime:{id:string;label:string;start:string;end:string;metrics:Phase2Metrics}[];
  parameterNeighborhood:{label:string;metrics:Phase2Metrics}[];stabilityFloor:number;robust:boolean;operationalCapPassed:boolean;
};

const leverageNumber = (row: ScreeningRow) => row.leverage.startsWith("2") ? 2 : 3;
const subMetrics = (m: Metrics, actionDaysPerYear = m.ordersPerYear): Phase2Metrics => ({
  cagr:m.cagr,totalReturn:m.totalReturn,annualizedVolatility:m.annualizedVolatility,sharpe:m.sharpe,sortino:m.sortino,maxDd:m.maxDd,calmar:m.calmar,ulcerIndex:m.ulcerIndex,exposure:m.exposure,timeInCash:m.timeInCash,actionDaysPerYear,
});

const configFor = (family: Phase15Family, row: ScreeningRow, perturb = 0): StrategyConfig | null => {
  if (family === "SIMPLE_200DMA") return null;
  if (family === "VS13_FIXED") return { ...STRATEGIES.defensive, trailStop: 0.13 * (1 + perturb) };
  if (family === "VS13_LEVERAGE_SCALED_STOP") return { ...STRATEGIES.defensive, trailStop: 0.13 * leverageNumber(row) / 3 * (1 + perturb) };
  return { ...STRATEGIES.defensive, sizing:"volTarget", targetPortfolioVol:0.30 * (1 + perturb) };
};

function simple200Run(ds: Dataset, dma = 200, costBps = 8, delay = 1, activeFrom?: string): SeriesRun {
  const under=ds.days.map(d=>d.qqq.close), returns:number[]=[], positions:number[]=[], dates:string[]=[];
  let equity=1,position=0,changes=0;
  const scheduled=new Map<number,number>();
  for(let i=1;i<ds.days.length;i++){
    const day=ds.days[i],prev=ds.days[i-1],startEq=equity;
    equity*=1+position*(day.tqqq.open/prev.tqqq.close-1);
    const due=scheduled.get(i);
    if(due!==undefined && due!==position){
      equity*=1-Math.abs(due-position)*(costBps/10000);
      position=due;
      if(!activeFrom||day.date>=activeFrom)changes++;
    }
    equity*=1+position*(day.tqqq.close/day.tqqq.open-1);
    const include=!activeFrom||day.date>=activeFrom;
    if(include){returns.push(equity/startEq-1);positions.push(position);dates.push(day.date)}
    if(i>=dma-1){
      let sum=0;for(let j=i-dma+1;j<=i;j++)sum+=under[j];
      const target=under[i]>sum/dma?1:0;
      scheduled.set(i+delay,target);
    } else scheduled.set(i+delay,0);
  }
  const m=metricSet(returns,[],[],dates,positions),years=Math.max(returns.length/252,1/252);
  return{metrics:subMetrics(m,changes/years),daily:dates.map((date,i)=>({date,dailyReturn:returns[i],position:positions[i]}))};
}

function metricsFromDaily(daily:{date:string;dailyReturn:number;position:number}[], actionDaysPerYear=0):Phase2Metrics{
  const m=metricSet(daily.map(x=>x.dailyReturn),[],[],daily.map(x=>x.date),daily.map(x=>x.position));
  return subMetrics(m,actionDaysPerYear);
}

function engineRun(ds: Dataset, family: Phase15Family, row: ScreeningRow, opts?:{costBps?:number;delay?:number;activeFrom?:string;perturb?:number}):SeriesRun{
  const cfg=configFor(family,row,opts?.perturb||0)!;
  if(opts?.activeFrom)cfg.activeFrom=opts.activeFrom;
  const total=opts?.costBps??8;
  const bt=runBacktest(ds,cfg,{commissionBps:3,slippageBps:Math.max(0,total-3),delay:opts?.delay??1});
  const daily=bt.daily.filter(d=>!opts?.activeFrom||d.date>=opts.activeFrom).map(d=>({date:d.date,dailyReturn:d.dailyReturn,position:d.position}));
  const years=Math.max(daily.length/252,1/252);
  const relevantOrders=bt.orders.filter(o=>!opts?.activeFrom||o.executionDate>=opts.activeFrom);
  const actionDaysPerYear=new Set(relevantOrders.map(o=>o.executionDate)).size/years;
  return{metrics:metricsFromDaily(daily,actionDaysPerYear),daily};
}

function runFamily(ds:Dataset,family:Phase15Family,row:ScreeningRow,opts?:{costBps?:number;delay?:number;activeFrom?:string;perturb?:number;dma?:number}):SeriesRun{
  return family==="SIMPLE_200DMA"?simple200Run(ds,opts?.dma??200,opts?.costBps??8,opts?.delay??1,opts?.activeFrom):engineRun(ds,family,row,opts);
}

const windows=[
  {id:"2018_Q4",label:"2018 Q4 correction",start:"2018-09-20",end:"2018-12-31"},
  {id:"COVID",label:"COVID shock/rebound",start:"2020-02-19",end:"2020-06-30"},
  {id:"2022_BEAR",label:"2022 tightening/bear",start:"2022-01-03",end:"2022-12-30"},
  {id:"2023_2024_BULL",label:"2023-2024 recovery/bull",start:"2023-01-03",end:"2024-12-31"},
] as const;

export function phase2Bundle(payload:Payload){
  const datasets=CORE_TICKERS.flatMap(ticker=>{const row=SCREENING.find(x=>x.ticker===ticker);if(!row)return[];const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START);return ds?[{row,ds}]:[]});
  const rows:Phase2Row[]=[];
  for(const {row,ds} of datasets){
    for(const family of FAMILIES){
      const base=runFamily(ds,family,row);
      const oos=runFamily(ds,family,row,{activeFrom:OOS_START});
      const years:Phase2Year[]=[];
      for(let year=2020;year<=2026;year++){
        const start=`${year}-01-01`,end=`${year}-12-31`;
        const d=oos.daily.filter(x=>x.date>=start&&x.date<=end);
        if(d.length>=20)years.push({year,metrics:metricsFromDaily(d)});
      }
      const costStress=[8,15,25,50].map(costBps=>({costBps,metrics:runFamily(ds,family,row,{costBps,activeFrom:OOS_START}).metrics}));
      const delayStress=[1,2,3].map(delay=>({delay,metrics:runFamily(ds,family,row,{delay,activeFrom:OOS_START}).metrics}));
      const regime=windows.map(w=>{const d=base.daily.filter(x=>x.date>=w.start&&x.date<=w.end);return{id:w.id,label:w.label,start:w.start,end:w.end,metrics:metricsFromDaily(d)}});
      const perturbations=family==="SIMPLE_200DMA"
        ? [180,200,220].map(dma=>({label:`DMA${dma}`,metrics:runFamily(ds,family,row,{dma,activeFrom:OOS_START}).metrics}))
        : [-.10,0,.10].map(p=>({label:`${p<0?"-":"+"}${Math.abs(p*100).toFixed(0)}%`,metrics:runFamily(ds,family,row,{perturb:p,activeFrom:OOS_START}).metrics}));
      const neighborhoodCalmars=perturbations.map(x=>x.metrics.calmar),baseCalmar=oos.metrics.calmar;
      const stabilityFloor=baseCalmar===0?0:Math.min(...neighborhoodCalmars)/Math.abs(baseCalmar);
      const cost25=costStress.find(x=>x.costBps===25)!.metrics;
      const delay3=delayStress.find(x=>x.delay===3)!.metrics;
      const robust= oos.metrics.cagr>0 && oos.metrics.calmar>0 && cost25.cagr>0 && delay3.cagr>0 && oos.metrics.actionDaysPerYear<=40 && stabilityFloor>=0.70;
      rows.push({ticker:row.ticker,underlying:row.underlying,leverage:row.leverage,family,full:base.metrics,oos:oos.metrics,walkForwardYears:years,costStress,delayStress,regime,parameterNeighborhood:perturbations,stabilityFloor,robust,operationalCapPassed:oos.metrics.actionDaysPerYear<=40});
    }
  }
  const summary=CORE_TICKERS.map(ticker=>{
    const x=rows.filter(r=>r.ticker===ticker),robustFamilies=x.filter(r=>r.robust).map(r=>r.family);
    const primary=x.filter(r=>["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP"].includes(r.family));
    const bestPrimary=[...primary].sort((a,b)=>b.oos.calmar-a.oos.calmar)[0];
    return{ticker,robustFamilies,bestPrimaryFamily:bestPrimary?.family||null,bestPrimaryOos:bestPrimary?.oos||null,allOperational:x.every(r=>r.operationalCapPassed)};
  });
  return{schemaVersion:1,phase:"PHASE_2_ROBUSTNESS_VALIDATION",generatedAt:new Date().toISOString(),commonStart:PHASE1_COMMON_START,oosStart:OOS_START,policy:"Robustness validation only; no Native tuning, no parameter selection from perturbations, no Forward/Production promotion.",families:FAMILIES,rows,summary,limitations:["Historical evidence is already inspected and is not a pristine holdout.","Rolling yearly tests use fixed rules; the prior context is for chronology/indicator history, not parameter optimization.","Parameter neighborhoods diagnose fragility only and cannot replace pre-registered baseline parameters.","Price returns exclude dividend reinvestment, consistent with current project data model.","Forward evidence remains decisive for any Production change."]};
}
