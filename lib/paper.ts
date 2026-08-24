export type LiveSnapshot={date:string;tqqqOpen:number;tqqqClose:number;qqqOpen:number;qqqClose:number;target:number;previousTarget:number;score:number;regime:string;reason:string;crisis:boolean;assetTicker?:string;strategyVersion?:string;splitFactor?:number};
export type PaperConfig={initialJpy:number;startDate:string;fxRate:number};
export type PaperTrade={signalDate:string;executionDate:string;side:"BUY"|"SELL";before:number;after:number;price:number;quantity:number;commissionUsd:number;equityJpy:number;reason:string;score:number;realizedPnlUsd:number};
export type PaperPoint={date:string;equityJpy:number;tqqqJpy:number;qqqJpy:number;drawdown:number};

const maxDrawdown=(values:number[])=>{let peak=values[0]||1,dd=0;for(const value of values){peak=Math.max(peak,value);dd=Math.min(dd,value/peak-1)}return dd};

export function simulatePaper(history:LiveSnapshot[],config:PaperConfig){
 const rows=[...history].sort((a,b)=>a.date.localeCompare(b.date));
 let cash=config.initialJpy/config.fxRate,shares=0,avgPrice=0,target=0,tqqqBench=0,qqqBench=0,benchCashT=cash,benchCashQ=cash,benchmarkStarted=false,peak=cash;const trades:PaperTrade[]=[],curve:PaperPoint[]=[];
 for(let i=1;i<rows.length;i++){
  const previous=rows[i-1],current=rows[i];if(previous.date<config.startDate)continue;
  if(current.splitFactor&&current.splitFactor>0){shares*=current.splitFactor;avgPrice/=current.splitFactor;tqqqBench*=current.splitFactor}
  if(!benchmarkStarted){tqqqBench=cash/current.tqqqOpen;qqqBench=cash/current.qqqOpen;benchCashT=0;benchCashQ=0;benchmarkStarted=true}
  const desired=previous.target;
  if(Math.abs(desired-target)>.0001){const before=target,preEquity=cash+shares*current.tqqqOpen,referenceShares=preEquity*desired/current.tqqqOpen,rawDelta=referenceShares-shares,side=rawDelta>0?"BUY":"SELL",price=current.tqqqOpen*(side==="BUY"?1.0005:.9995),quantity=Math.abs(rawDelta),signed=side==="BUY"?quantity:-quantity,commission=Math.abs(quantity*price)*.0003,realized=side==="SELL"?quantity*(price-avgPrice)-commission:0;
   if(side==="BUY"){avgPrice=shares+quantity>0?(shares*avgPrice+quantity*price+commission)/(shares+quantity):0}else if(quantity>=shares-.0000001)avgPrice=0;
   cash-=signed*price+commission;shares+=signed;target=desired;trades.push({signalDate:previous.date,executionDate:current.date,side,before,after:desired,price,quantity,commissionUsd:commission,equityJpy:(cash+shares*current.tqqqClose)*config.fxRate,reason:previous.reason,score:previous.score,realizedPnlUsd:realized});
  }
  const equity=cash+shares*current.tqqqClose;peak=Math.max(peak,equity);curve.push({date:current.date,equityJpy:equity*config.fxRate,tqqqJpy:(benchCashT+tqqqBench*current.tqqqClose)*config.fxRate,qqqJpy:(benchCashQ+qqqBench*current.qqqClose)*config.fxRate,drawdown:equity/peak-1});
 }
 const last=curve.at(-1),equityJpy=last?.equityJpy??config.initialJpy,days=curve.length,years=Math.max(days/252,1/252),returns=equityJpy/config.initialJpy-1,realized=trades.filter(t=>t.side==="SELL").map(t=>t.realizedPnlUsd*config.fxRate),wins=realized.filter(x=>x>0),losses=realized.filter(x=>x<=0),values=curve.map(x=>x.equityJpy);
 return{config,curve,trades,shares,cashJpy:cash*config.fxRate,tqqqValueJpy:shares*(rows.at(-1)?.tqqqClose||0)*config.fxRate,avgPrice,fxRate:config.fxRate,equityJpy,pnlJpy:equityJpy-config.initialJpy,totalReturn:returns,cagr:days?Math.pow(1+returns,1/years)-1:0,maxDd:maxDrawdown(values),currentDd:last?.drawdown||0,winRate:realized.length?wins.length/realized.length:0,avgWin:wins.length?wins.reduce((a,b)=>a+b,0)/wins.length:0,avgLoss:losses.length?losses.reduce((a,b)=>a+b,0)/losses.length:0,tqqqReturn:last?last.tqqqJpy/config.initialJpy-1:0,qqqReturn:last?last.qqqJpy/config.initialJpy-1:0};
}
