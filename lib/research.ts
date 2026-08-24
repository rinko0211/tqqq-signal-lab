import {benchmark,maxDrawdown,metricSet,oosComparison,runBacktest,STRATEGIES,type Backtest,type DailyResult,type Dataset,type Metrics,type StrategyConfig} from "./engine.ts";

const q=(a:number[],p:number)=>a.length?a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))]:0;
const compound=(r:number[])=>r.reduce((e,x)=>e*(1+x),1)-1;

export type DrawdownEpisode={rank:number;peak:string;trough:string;recovery:string|null;drawdown:number;position:number;score:number;regime:string;vix:number;qqqTrend:string;cause:string};
export function drawdownEpisodes(bt:Backtest,limit=10):DrawdownEpisode[]{
  const x=bt.daily,episodes:{peakIndex:number;troughIndex:number;recoveryIndex:number|null;drawdown:number}[]=[];
  let peak=1,peakIndex=0,troughIndex=0,worst=0,inDrawdown=false;
  for(let i=0;i<x.length;i++){
    if(x[i].equity>=peak){if(inDrawdown&&worst<0)episodes.push({peakIndex,troughIndex,recoveryIndex:i,drawdown:worst});peak=x[i].equity;peakIndex=i;troughIndex=i;worst=0;inDrawdown=false}
    else{inDrawdown=true;const dd=x[i].equity/peak-1;if(dd<worst){worst=dd;troughIndex=i}}
  }
  if(inDrawdown&&worst<0)episodes.push({peakIndex,troughIndex,recoveryIndex:null,drawdown:worst});
  return episodes.sort((a,b)=>a.drawdown-b.drawdown).slice(0,limit).map((e,i)=>{
    const d=x[e.troughIndex],p=x[e.peakIndex],sig=d.signal;
    const cause=sig.regime==="急落・危機"?"急落・ギャップと危機判定までの残存Exposure":d.position>=.75?"高いExposureが残る中でトレンドが弱化":sig.indicators.vix>=28?"高VIX局面での価格変動":sig.score>=STRATEGIES.defensive.exit?"Score低下がExit閾値へ届く前の下落":"Signal反応と翌日約定の時間差";
    return{rank:i+1,peak:p.date,trough:d.date,recovery:e.recoveryIndex===null?null:x[e.recoveryIndex].date,drawdown:e.drawdown,position:d.position,score:sig.score,regime:sig.regime,vix:sig.indicators.vix,qqqTrend:sig.indicators.sma200&&sig.indicators.sma50>sig.indicators.sma200?"SMA50>SMA200":"SMA50≤SMA200",cause};
  });
}

export function regimeAttribution(bt:Backtest){
  const map=new Map<string,DailyResult[]>();
  for(const d of bt.daily)map.set(d.signal.regime,[...(map.get(d.signal.regime)||[]),d]);
  return [...map].map(([name,days])=>{const returns=days.map(d=>d.dailyReturn),m=metricSet(returns,[],days.flatMap(d=>d.execution?[d.execution]:[]),days.map(d=>d.date),days.map(d=>d.position));return{name,days:days.length,return:compound(returns),cagr:m.cagr,maxDd:m.maxDd,sharpe:m.sharpe,exposure:m.exposure,orders:m.changeDays}}).sort((a,b)=>b.days-a.days);
}

export function blockBootstrap(bt:Backtest,iterations=750,block=20){
  const r=bt.daily.map(d=>d.dailyReturn),n=r.length;let seed=20260824;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},out:{total:number;dd:number}[]=[];
  for(let k=0;k<iterations;k++){const sample:number[]=[];while(sample.length<n){const start=Math.floor(rand()*Math.max(1,n-block));sample.push(...r.slice(start,start+block))}const use=sample.slice(0,n),curve:number[]=[];use.reduce((e,v)=>{const z=e*(1+v);curve.push(z);return z},1);out.push({total:compound(use),dd:maxDrawdown(curve)})}
  const totals=out.map(x=>x.total).sort((a,b)=>a-b),dds=out.map(x=>x.dd).sort((a,b)=>a-b);
  return{method:`${block}営業日Block Bootstrap`,iterations,median:q(totals,.5),p05:q(totals,.05),p95:q(totals,.95),medianMaxDd:q(dds,.5),prob30:out.filter(x=>x.dd<=-.30).length/iterations,prob40:out.filter(x=>x.dd<=-.40).length/iterations,prob50:out.filter(x=>x.dd<=-.50).length/iterations};
}

export function simpleTrendBenchmark(ds:Dataset):Metrics{
  const qqq=ds.days.map(d=>d.qqq.close);let position=0,equity=1;const returns:number[]=[],positions:number[]=[];
  for(let i=1;i<ds.days.length;i++){const start=equity,d=ds.days[i],p=ds.days[i-1];equity*=1+position*(d.tqqq.open/p.tqqq.close-1);let desired=0;if(i-1>=199){const avg=qqq.slice(i-200,i).reduce((a,b)=>a+b,0)/200;desired=qqq[i-1]>avg?1:0}if(desired!==position){equity*=1-Math.abs(desired-position)*.0008;position=desired}equity*=1+position*(d.tqqq.close/d.tqqq.open-1);returns.push(equity/start-1);positions.push(position)}
  return metricSet(returns,[],[],ds.days.slice(1).map(d=>d.date),positions);
}

export function pareto(ds:Dataset){
  const rows=oosComparison(ds).map(x=>({...x,dd:Math.abs(x.metrics.maxDd),frontier:false,type:""}));
  for(const a of rows)a.frontier=!rows.some(b=>b!==a&&b.metrics.cagr>=a.metrics.cagr&&b.dd<=a.dd&&(b.metrics.cagr>a.metrics.cagr||b.dd<a.dd));
  const f=rows.filter(x=>x.frontier).sort((a,b)=>b.metrics.cagr-a.metrics.cagr);if(f.length){f[0].type="リターン重視";f[f.length-1].type="DD重視";f[Math.floor((f.length-1)/2)].type="Balanced"}
  return rows;
}

export function whipsaw(bt:Backtest,ds:Dataset){
  let count=0,cost=0,missed=0;const map=new Map(ds.days.map(d=>[d.date,d.tqqq.close]));
  for(let i=0;i<bt.orders.length-1;i++){const a=bt.orders[i],b=bt.orders[i+1];if(a.after===0&&b.after>0){const ai=bt.daily.findIndex(d=>d.date===a.executionDate),bi=bt.daily.findIndex(d=>d.date===b.executionDate);if(ai>=0&&bi>ai&&bi-ai<=15){count++;cost+=a.cost+b.cost;const pa=map.get(a.executionDate)||a.executionPrice,pb=map.get(b.executionDate)||b.executionPrice;missed+=pb/pa-1}}}
  return{count,cost,missedRebound:count?missed/count:0,definition:"全決済後15営業日以内の再Entry"};
}

export function researchBundle(ds:Dataset,config:StrategyConfig){
  const bt=runBacktest(ds,config),mc=blockBootstrap(bt),dd=drawdownEpisodes(bt),regime=regimeAttribution(bt),frontier=pareto(ds),simple=simpleTrendBenchmark(ds);
  const stress=[8,15,25,50].map(totalBps=>{const r=runBacktest(ds,config,{commissionBps:3,slippageBps:Math.max(0,totalBps-3),delay:1});return{totalBps,metrics:r.metrics}});
  const health={return:bt.metrics.cagr>=.2?"Good":bt.metrics.cagr>0?"Moderate":"Weak",drawdown:bt.metrics.maxDd>=-.3?"Good":bt.metrics.maxDd>=-.45?"Moderate":"High",robustness:stress.at(-1)!.metrics.cagr>0&&mc.p05>-.5?"Moderate":"Weak",overall:bt.metrics.maxDd>-.45&&bt.metrics.sharpe>.5?"Paper Trading Recommended":"Research Only"};
  return{bt,dd,regime,mc,frontier,simple,benchmarks:{tqqq:benchmark(ds,"tqqq"),qqq:benchmark(ds,"qqq"),spy:benchmark(ds,"spy")},stress,whipsaw:whipsaw(bt,ds),health,audit:{champion:"Volatility Shield",decision:"KEEP",reason:"今回のRefineではSignalルールを変更せず、監査・計測基盤を拡張。ChallengerはOOS優位が確認されるまで昇格させない。",holdoutStatus:"既に結果を閲覧済みのため純粋な未接触Holdoutとは呼ばず、診断用Holdoutとして固定。以後はLive Paper TradingをPseudo-Live期間とする。"}};
}
