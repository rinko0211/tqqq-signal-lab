import {nextNyseSession as nextExecutionDate} from "./market-calendar.ts";

export const GOLD_FORWARD_FIRST_SESSION="2026-10-12";
export const GOLD_FORWARD_BASELINE="gold50-prospective-forward-v1-20261012";
export const GOLD_STRATEGY_VERSION="gold-overlay-shadow-0.1.0";
export const GOLD_DATA_BASE="https://raw.githubusercontent.com/rinko0211/gold50-shadow-monitor/main/";
export type GoldAllocation={TQQQ:number;GLD:number;CASH:number};
export type GoldForwardRow={
  baseline:string;marketDataDate:string;observedAt:string;sourceCommit:string;
  strategyVersion:string;strategyId:string;mode:string;
  sourceTarget:number;signalSha256:string;statusSha256:string;gldDataSha256:string;
  target:GoldAllocation;status:string;brokerOrderAllowed:boolean;replayVerified:boolean;
  execution:{earliestLegalDate:string;estimatedManualOrderLegs:number;actionDay:boolean;brokerOrderAllowed:boolean};
};
export type GoldResearchStatus={
  baseline:string;startDate:string;state:string;validObservations:number;
  lastRecordedSession:string|null;nextExpectedSession:string;lastAllocation:GoldAllocation|null;
  attempt:string;reasonCode:string|null;evaluatedAt:string;mode:string;authority:string;
  brokerOrderAllowed:boolean;manualUserOrdersOnly:boolean;performanceCertification:string;
};
export type GoldPhaseCStatus={counter:string;phaseCState:string;successfulSessions:number;successfulDates:string[];updatedAt:string};
export type GoldContinuitySegment={from:string;to:string;count:number;startIndex:number;endIndex:number};
export type GoldEvidence={
  ok:boolean;reason:string|null;status:GoldResearchStatus|null;
  phaseC:GoldPhaseCStatus|null;rows:GoldForwardRow[];
  segments:GoldContinuitySegment[];gaps:{after:string;before:string}[];
};
const isoDate=(d:unknown):d is string=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
  !Number.isNaN(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
const isoTime=(s:unknown)=>typeof s==="string"&&Number.isFinite(Date.parse(s));
const sha=(s:unknown,n:number)=>typeof s==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(s);
const unit=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1;
export const goldWeightsValid=(v:unknown):v is GoldAllocation=>{
 if(!v||typeof v!=="object")return false;
 const a=v as GoldAllocation;
 return unit(a.TQQQ)&&unit(a.GLD)&&unit(a.CASH)&&
   Math.abs(a.TQQQ+a.GLD+a.CASH-1)<1e-9&&
   Math.abs(a.GLD-a.CASH)<1e-9&&Math.abs(a.GLD-(1-a.TQQQ)/2)<1e-9;
};
function initial():GoldEvidence{return{ok:false,reason:null,status:null,phaseC:null,rows:[],segments:[],gaps:[]}};
const fail=(reason:string):GoldEvidence=>({...initial(),reason});
export function parseGoldForwardEvidence(statusValue:unknown,phaseCValue:unknown,ledgerText:string):GoldEvidence{
 try{
  if(typeof ledgerText!=="string"||ledgerText.length>500000)return fail("Gold50台帳のサイズが不正です");
  const s=statusValue as GoldResearchStatus, p=phaseCValue as GoldPhaseCStatus;
  if(!s||s.baseline!==GOLD_FORWARD_BASELINE||s.startDate!==GOLD_FORWARD_FIRST_SESSION||
    !["WAITING_FIRST_VALID_SESSION","ACCUMULATING","CHECK_DATA"].includes(s.state)||
    !Number.isSafeInteger(s.validObservations)||s.validObservations<0||
    s.mode!=="SHADOW_RESEARCH"||s.authority!=="NONE_SHADOW_ONLY"||
    s.brokerOrderAllowed!==false||s.manualUserOrdersOnly!==true||
    !isoTime(s.evaluatedAt)||!isoDate(s.nextExpectedSession))
   return fail("長期Forwardの状態・研究権限が一致しません");
  if(!p||p.counter!=="C10/10"||p.phaseCState!=="COMPLETE_STOP_GATE"||
    p.successfulSessions!==10||!Array.isArray(p.successfulDates)||
    p.successfulDates.length!==10||p.successfulDates.at(-1)!=="2026-09-21")
   return fail("終了済みPhase Cの記録が一致しません");
  const lines=ledgerText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const rows=lines.map(x=>JSON.parse(x)) as GoldForwardRow[];
  if(rows.length!==s.validObservations)return fail("Gold50台帳件数と状態が一致しません");
  const segments:GoldContinuitySegment[]=[],gaps:{after:string;before:string}[]=[];
  for(let i=0;i<rows.length;i++){
   const r=rows[i];
   if(r.baseline!==GOLD_FORWARD_BASELINE||r.strategyId!=="TQQQ-Gold50-Research-v0.1"||
     r.strategyVersion!==GOLD_STRATEGY_VERSION||r.mode!=="SHADOW_RESEARCH"||
     r.status!=="VALID_RESEARCH_SIGNAL"||r.brokerOrderAllowed!==false||r.replayVerified!==true||
     !isoDate(r.marketDataDate)||r.marketDataDate<GOLD_FORWARD_FIRST_SESSION||
     !isoTime(r.observedAt)||!sha(r.sourceCommit,40)||!sha(r.signalSha256,64)||
     !sha(r.statusSha256,64)||!sha(r.gldDataSha256,64)||
     !unit(r.sourceTarget)||!goldWeightsValid(r.target)||
     r.sourceTarget!==r.target.TQQQ||
     !r.execution||r.execution.brokerOrderAllowed!==false||
     !Number.isSafeInteger(r.execution.estimatedManualOrderLegs)||
     r.execution.estimatedManualOrderLegs<0||r.execution.estimatedManualOrderLegs>2||
     !isoDate(r.execution.earliestLegalDate)||r.execution.earliestLegalDate!==nextExecutionDate(r.marketDataDate))
    return fail("Gold50観測履歴の整合性を検証できません");
   if(i===0){
    if(r.marketDataDate!==GOLD_FORWARD_FIRST_SESSION)return fail("開始日より後からの暗黙のForward開始を拒否しました");
    segments.push({from:r.marketDataDate,to:r.marketDataDate,count:1,startIndex:0,endIndex:0});
   }else{
    const last=rows[i-1];
    if(r.marketDataDate<=last.marketDataDate)return fail("Gold50履歴に重複または逆行があります");
    if(nextExecutionDate(last.marketDataDate)!==r.marketDataDate){
     gaps.push({after:last.marketDataDate,before:r.marketDataDate});
     segments.push({from:r.marketDataDate,to:r.marketDataDate,count:1,startIndex:i,endIndex:i});
    }else{
     const seg=segments[segments.length-1];
     seg.to=r.marketDataDate;seg.count++;seg.endIndex=i;
    }
   }
  }
  if(rows.length){
   if(s.lastRecordedSession!==rows.at(-1)!.marketDataDate||s.nextExpectedSession!==nextExecutionDate(rows.at(-1)!.marketDataDate)||
      !goldWeightsValid(s.lastAllocation)||rows.at(-1)!.target.TQQQ!==s.lastAllocation.TQQQ)
    return fail("Gold50の最終記録と表示状態が一致しません");
  }else if(s.lastRecordedSession!==null||s.lastAllocation!==null||s.nextExpectedSession!==GOLD_FORWARD_FIRST_SESSION)
   return fail("未開始なのにGold50配分・日付が設定されています");
  return{ok:true,reason:null,rows,status:s,phaseC:p,segments,gaps};
 }catch{return fail("Gold50データの形式が不正です");}
}
/** Never infer executable orders or a recommendation from a shadow Forward row. */
export function manualGoldResearchProjection(params:{
 weights:GoldAllocation;cashUsd:number;tqqqShares:number;gldShares:number;tqqqUsd:number;gldUsd:number
}){
 const {weights,cashUsd,tqqqShares,gldShares,tqqqUsd,gldUsd}=params;
 if(!goldWeightsValid(weights)||![cashUsd,tqqqShares,gldShares,tqqqUsd,gldUsd].every(Number.isFinite)||
   cashUsd<0||tqqqShares<0||gldShares<0||tqqqUsd<=0||gldUsd<=0||
   !Number.isInteger(tqqqShares)||!Number.isInteger(gldShares))return null;
 const total=cashUsd+tqqqShares*tqqqUsd+gldShares*gldUsd;
 if(!Number.isFinite(total)||total<=0)return null;
 const tTarget=Math.floor(total*weights.TQQQ/tqqqUsd);
 const gTarget=Math.floor(total*weights.GLD/gldUsd);
 return{total,targets:{TQQQ:tTarget,GLD:gTarget},delta:{TQQQ:tTarget-tqqqShares,GLD:gTarget-gldShares},
  estimatedCash:total-tTarget*tqqqUsd-gTarget*gldUsd,
  label:"研究用の株数試算のみ（未承認・手動注文限定・約定価格/手数料/税/為替は未反映）",
  brokerOrderAllowed:false as const};
}
