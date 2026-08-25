import { metricSet, runBacktest, signals, STRATEGIES, type Bar, type Dataset, type Metrics, type StrategyConfig } from "./engine.ts";
import { makeCrossTickerDataset, SCREENING, type CrossTicker, type ScreeningRow } from "./cross-ticker.ts";
import { PHASE1_COMMON_START } from "./phase1-screening.ts";

export type Phase4Variant = "PHASE_4A_COMMON" | "PHASE_4B_NATIVE_ENHANCED";
type Payload={source?:string;retrievedAt?:string;crossSeries?:Record<string,Bar[]>};
type Underlying="NASDAQ"|"SP500";
type Held={ticker:CrossTicker|null;weight:number};
type PortfolioDay={date:string;dailyReturn:number;weight:number;ticker:CrossTicker|null;underlying:Underlying|null;action:boolean;brokerOrders:number;underlyingSwitch:boolean;leverageSwitch:boolean};
type M=Pick<Metrics,"cagr"|"totalReturn"|"annualizedVolatility"|"sharpe"|"sortino"|"maxDd"|"calmar"|"ulcerIndex"|"exposure"|"timeInCash"|"recoveryDays">&{actionDaysPerYear:number;brokerOrdersPerYear:number};

const OOS_START="2020-01-02";
const CORE:CrossTicker[]=["TQQQ","QLD","UPRO","SSO"];
const VIX_3X=22;
const RV20_3X=.25;
const REL_MOM_DAYS=63;
const REL_MARGIN=.03;
const SWITCH_CONFIRM=3;
const RERISK_CONFIRM=3;

const lev=(r:ScreeningRow)=>r.leverage.startsWith("2")?2:3;
const stopFor=(r:ScreeningRow)=>.13*lev(r)/3;
const commonConfig=(r:ScreeningRow):StrategyConfig=>({...STRATEGIES.defensive,trailStop:stopFor(r)});
const spbtConfig=(r:ScreeningRow):StrategyConfig=>({...STRATEGIES.defensive,weights:{trend:.36,momentum:.16,volatility:.28,market:.20},confirmDays:3,minHold:8,trailStop:stopFor(r)});
const configFor=(variant:Phase4Variant,row:ScreeningRow)=>variant==="PHASE_4B_NATIVE_ENHANCED"&&["UPRO","SSO"].includes(row.ticker)?spbtConfig(row):commonConfig(row);

const stdev=(x:number[])=>{if(x.length<2)return 0;const m=x.reduce((a,b)=>a+b,0)/x.length;return Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1))};
const realized20=(closes:number[],i:number)=>{
  if(i<20)return Infinity;const r:number[]=[];for(let j=i-19;j<=i;j++)r.push(closes[j]/closes[j-1]-1);return stdev(r)*Math.sqrt(252);
};
const mom=(closes:number[],i:number,n=REL_MOM_DAYS)=>i<n?-Infinity:closes[i]/closes[i-n]-1;
const metrics=(days:PortfolioDay[],start=OOS_START,end="9999-12-31"):M=>{
  const d=days.filter(x=>x.date>=start&&x.date<=end),yrs=Math.max(d.length/252,1/252);
  const m=metricSet(d.map(x=>x.dailyReturn),[],[],d.map(x=>x.date),d.map(x=>x.weight));
  return{cagr:m.cagr,totalReturn:m.totalReturn,annualizedVolatility:m.annualizedVolatility,sharpe:m.sharpe,sortino:m.sortino,maxDd:m.maxDd,calmar:m.calmar,ulcerIndex:m.ulcerIndex,exposure:m.exposure,timeInCash:m.timeInCash,recoveryDays:m.recoveryDays,actionDaysPerYear:d.filter(x=>x.action).length/yrs,brokerOrdersPerYear:d.reduce((s,x)=>s+x.brokerOrders,0)/yrs};
};

function prepare(payload:Payload,variant:Phase4Variant){
  const items=CORE.map(ticker=>{const row=SCREENING.find(x=>x.ticker===ticker)!;const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START);if(!ds)throw new Error(`Phase 4 missing dataset: ${ticker}`);const sig=signals(ds.days,configFor(variant,row));return{ticker,row,ds,sig};});
  const commonDates=items[0].ds.days.map(x=>x.date).filter(date=>items.every(x=>x.ds.days.some(d=>d.date===date)));
  const maps=Object.fromEntries(items.map(x=>[x.ticker,{day:new Map(x.ds.days.map(d=>[d.date,d])),sig:new Map(x.sig.map(s=>[s.date,s]))}])) as Record<CrossTicker,{day:Map<string,Dataset["days"][number]>;sig:Map<string,ReturnType<typeof signals>[number]>}>;
  return{items,commonDates,maps};
}

function runAllocator(payload:Payload,variant:Phase4Variant,costBps=8,delay=1){
  const {commonDates,maps}=prepare(payload,variant);
  const qqq=commonDates.map(d=>maps.TQQQ.day.get(d)!.qqq.close),spx=commonDates.map(d=>maps.UPRO.day.get(d)!.qqq.close);
  let held:Held={ticker:null,weight:0},equity=1;
  const scheduled=new Map<number,Held>();
  const levState:Record<Underlying,2|3>={NASDAQ:2,SP500:2},rerisk:Record<Underlying,number>={NASDAQ:0,SP500:0};
  let selected:Underlying|null=null,challenger:Underlying|null=null,challengerCount=0;
  const out:PortfolioDay[]=[];
  const tickerFor=(u:Underlying,l:2|3):CrossTicker=>u==="NASDAQ"?(l===3?"TQQQ":"QLD"):(l===3?"UPRO":"SSO");
  for(let i=1;i<commonDates.length;i++){
    const date=commonDates[i],prevDate=commonDates[i-1],startEq=equity;
    if(held.ticker&&held.weight>0){const cur=maps[held.ticker].day.get(date)!,prev=maps[held.ticker].day.get(prevDate)!;equity*=1+held.weight*(cur.open/prev.close-1)}
    let action=false,brokerOrders=0,underlyingSwitch=false,leverageSwitch=false;
    const due=scheduled.get(i);
    if(due&&(due.ticker!==held.ticker||Math.abs(due.weight-held.weight)>1e-12)){
      action=true;
      if(held.ticker&&due.ticker&&held.ticker!==due.ticker){brokerOrders=2;const oldRow=SCREENING.find(x=>x.ticker===held.ticker)!,newRow=SCREENING.find(x=>x.ticker===due.ticker)!;underlyingSwitch=oldRow.underlying!==newRow.underlying;leverageSwitch=!underlyingSwitch&&lev(oldRow)!==lev(newRow)}
      else brokerOrders=1;
      const turnover=held.ticker===due.ticker?Math.abs(due.weight-held.weight):held.weight+due.weight;
      equity*=1-turnover*(costBps/10000);held=due;
    }
    if(held.ticker&&held.weight>0){const cur=maps[held.ticker].day.get(date)!;equity*=1+held.weight*(cur.close/cur.open-1)}
    const heldRow=held.ticker?SCREENING.find(x=>x.ticker===held.ticker)!:null;
    out.push({date,dailyReturn:equity/startEq-1,weight:held.weight,ticker:held.ticker,underlying:heldRow?(heldRow.underlying==="Nasdaq-100"?"NASDAQ":"SP500"):null,action,brokerOrders,underlyingSwitch,leverageSwitch});

    const vix=maps.TQQQ.day.get(date)!.vix.close;
    const gate3={NASDAQ:vix<VIX_3X&&realized20(qqq,i)<RV20_3X,SP500:vix<VIX_3X&&realized20(spx,i)<RV20_3X};
    for(const u of ["NASDAQ","SP500"] as Underlying[]){
      if(levState[u]===3&&!gate3[u]){levState[u]=2;rerisk[u]=0}
      else if(levState[u]===2&&gate3[u]){rerisk[u]++;if(rerisk[u]>=RERISK_CONFIRM){levState[u]=3;rerisk[u]=0}}
      else if(!gate3[u])rerisk[u]=0;
    }
    const chosenTicker={NASDAQ:tickerFor("NASDAQ",levState.NASDAQ),SP500:tickerFor("SP500",levState.SP500)};
    const eligible={NASDAQ:(maps[chosenTicker.NASDAQ].sig.get(date)?.target??0)>0,SP500:(maps[chosenTicker.SP500].sig.get(date)?.target??0)>0};
    const qMom=mom(qqq,i),sMom=mom(spx,i);
    const stronger=():Underlying=>qMom>=sMom?"NASDAQ":"SP500";
    if(selected&&!eligible[selected]){
      const other:Underlying=selected==="NASDAQ"?"SP500":"NASDAQ";selected=eligible[other]?other:null;challenger=null;challengerCount=0;
    }else if(!selected){
      if(eligible.NASDAQ||eligible.SP500)selected=eligible.NASDAQ&&eligible.SP500?stronger():(eligible.NASDAQ?"NASDAQ":"SP500");
      challenger=null;challengerCount=0;
    }else{
      const other:Underlying=selected==="NASDAQ"?"SP500":"NASDAQ";
      if(eligible[other]){
        const curMom=selected==="NASDAQ"?qMom:sMom,otherMom=other==="NASDAQ"?qMom:sMom;
        if(otherMom-curMom>=REL_MARGIN){if(challenger===other)challengerCount++;else{challenger=other;challengerCount=1}if(challengerCount>=SWITCH_CONFIRM){selected=other;challenger=null;challengerCount=0}}
        else{challenger=null;challengerCount=0}
      }else{challenger=null;challengerCount=0}
    }
    let target:Held={ticker:null,weight:0};
    if(selected){const ticker=chosenTicker[selected],w=maps[ticker].sig.get(date)?.target??0;if(w>0)target={ticker,weight:w};}
    scheduled.set(i+delay,target);
  }
  return out;
}

function comparator(payload:Payload,ticker:CrossTicker,native=false){
  const row=SCREENING.find(x=>x.ticker===ticker)!;const ds=makeCrossTickerDataset(payload,row,PHASE1_COMMON_START)!;const cfg=native&&["UPRO","SSO"].includes(ticker)?spbtConfig(row):commonConfig(row);const bt=runBacktest(ds,{...cfg,activeFrom:OOS_START},{commissionBps:3,slippageBps:5,delay:1});const d=bt.daily.filter(x=>x.date>=OOS_START);const yrs=Math.max(d.length/252,1/252),orders=bt.orders.filter(x=>x.executionDate>=OOS_START);const m=metricSet(d.map(x=>x.dailyReturn),[],[],d.map(x=>x.date),d.map(x=>x.position));return{ticker,logic:native?"SP_BROAD_TREND":"COMMON",metrics:{cagr:m.cagr,totalReturn:m.totalReturn,maxDd:m.maxDd,sharpe:m.sharpe,sortino:m.sortino,calmar:m.calmar,ulcerIndex:m.ulcerIndex,actionDaysPerYear:new Set(orders.map(x=>x.executionDate)).size/yrs,brokerOrdersPerYear:orders.length/yrs}};
}

export function phase4Bundle(payload:Payload){
  const variants=["PHASE_4A_COMMON","PHASE_4B_NATIVE_ENHANCED"] as Phase4Variant[];
  const results=variants.map(variant=>{
    const base=runAllocator(payload,variant,8,1),stress25=runAllocator(payload,variant,25,1),delay2=runAllocator(payload,variant,8,2);
    const oos=metrics(base),full=metrics(base,PHASE1_COMMON_START),stress=metrics(stress25),delay=metrics(delay2);
    const yearly=[] as any[];for(let y=2020;y<=2026;y++){const a=`${y}-01-01`,b=`${y}-12-31`,d=base.filter(x=>x.date>=a&&x.date<=b);if(d.length>=20)yearly.push({year:y,metrics:metrics(base,a,b),actionDays:d.filter(x=>x.action).length});}
    const maxYearActionDays=Math.max(0,...yearly.map(x=>x.actionDays));
    const riskDays=base.filter(x=>x.date>=OOS_START&&x.ticker),alloc=Object.fromEntries(CORE.map(t=>[t,riskDays.length?riskDays.filter(x=>x.ticker===t).length/riskDays.length:0]));
    const regimes=[{id:"COVID",start:"2020-02-19",end:"2020-06-30"},{id:"2022_BEAR",start:"2022-01-03",end:"2022-12-30"},{id:"2023_2024_BULL",start:"2023-01-03",end:"2024-12-31"}].map(w=>({...w,metrics:metrics(base,w.start,w.end)}));
    const oosDays=base.filter(x=>x.date>=OOS_START),underlyingSwitches=oosDays.filter(x=>x.underlyingSwitch).length,leverageSwitches=oosDays.filter(x=>x.leverageSwitch).length;
    const gatePassed=oos.cagr>0&&oos.calmar>0&&stress.cagr>0&&delay.cagr>0&&oos.actionDaysPerYear<=40&&maxYearActionDays<=40;
    return{variant,full,oos,stress25:stress,delay2:delay,yearly,maxYearActionDays,underlyingSwitches,leverageSwitches,riskOnAllocationShare:alloc,regimes,gatePassed};
  });
  const a=results[0].oos,b=results[1].oos;
  const attribution={cagrDelta:b.cagr-a.cagr,maxDdDelta:b.maxDd-a.maxDd,calmarDelta:b.calmar-a.calmar,sortinoDelta:b.sortino-a.sortino,actionDaysDelta:b.actionDaysPerYear-a.actionDaysPerYear,brokerOrdersDelta:b.brokerOrdersPerYear-a.brokerOrdersPerYear};
  const comparators=[comparator(payload,"TQQQ"),comparator(payload,"QLD"),comparator(payload,"UPRO"),comparator(payload,"SSO"),comparator(payload,"UPRO",true),comparator(payload,"SSO",true)];
  return{schemaVersion:1,phase:"PHASE_4_HIERARCHICAL_WINNER_CASH",generatedAt:new Date().toISOString(),oosStart:OOS_START,allocator:{vix3x:VIX_3X,rv20_3x:RV20_3X,relativeMomentumDays:REL_MOM_DAYS,relativeMargin:REL_MARGIN,switchConfirm:SWITCH_CONFIRM,reriskConfirm:RERISK_CONFIRM},results,attribution,comparators,policy:"One pre-registered allocator only. 4A uses Phase-2 Common systems. 4B changes only S&P systems to Phase-3 SP_BROAD_TREND. One risk ETF + Cash maximum. No post-result tuning, no automatic Forward/Production promotion.",limitations:["Historical data has been inspected in prior phases and is not pristine confirmatory evidence.","VIX/realized-volatility leverage thresholds and relative-momentum switching rules are hypothesis-level choices, not optimized values.","Dividend reinvestment is not included in the current price-return data model.","Action Days count portfolio target-change days; an ETF-to-ETF switch may create two broker orders on one Action Day.","Forward evidence remains required before Production promotion."]};
}
