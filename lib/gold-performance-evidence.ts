import {nextNyseSession} from "./market-calendar.ts";
import type {GoldEvidence,GoldAllocation} from "./gold-forward-evidence.ts";

export const GOLD_PERFORMANCE_START="2026-10-14";
export const GOLD_PERFORMANCE_VERSION="gold50-valuation-v1";

export type GoldModelValue={
 version:string;marketDataDate:string;signalDate:string;sourceCommit:string;pricesSha256:string;
 continuity:{kind:"INITIAL"|"CONTIGUOUS"|"GAP_RESET";expectedDate:string};
 appliedTarget:GoldAllocation;shares:{TQQQ:number;GLD:number};cash:number;
 index:number;peak:number;dd:number;maxDd:number;costs:number;turnover:number;orderLegs:number;
 mode:"SHADOW_RESEARCH";performanceCertification:"INDICATIVE_NOT_COMPARABLE";
 brokerOrderAllowed:false;rawTiingoOhlcPersisted:false;
};
export type GoldModelStatus={
 version:string;startDate:string;state:"WAITING"|"ACCUMULATING"|"CHECK_DATA";
 recordCount:number;lastMarketDate:string|null;index:number|null;
 dd:number|null;maxDd:number|null;segments:number;attempt:string;
 reasonCode:string|null;evaluatedAt:string;mode:"SHADOW_RESEARCH";
 brokerOrderAllowed:false;rawTiingoOhlcPersisted:false;
 performanceCertification:"INDICATIVE_NOT_COMPARABLE";
};
export type GoldModelEvidence={ok:boolean;reason:string|null;status:GoldModelStatus|null;rows:GoldModelValue[]};
const failed=(reason:string):GoldModelEvidence=>({ok:false,reason,status:null,rows:[]});
const iso=(d:unknown)=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 !Number.isNaN(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
const valid=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
const positive=(n:unknown)=>valid(n)&&n>0;
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
const sha=(s:unknown,n:number)=>typeof s==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(s);
/** Research DD is displayed only for mutually corroborating Gold50 signals and
 * authenticated prospective model subledger, never from synthetic history. */
export function parseGoldModelEvidence(statusValue:unknown,ledgerText:string,signal:GoldEvidence):GoldModelEvidence{
 try{
  if(!signal.ok||!signal.status||typeof ledgerText!=="string"||ledgerText.length>600000)
   return failed("Gold50観測の安全性が未確認です");
  const st=statusValue as GoldModelStatus;
  if(!st||st.version!==GOLD_PERFORMANCE_VERSION||st.startDate!==GOLD_PERFORMANCE_START||
   !["WAITING","ACCUMULATING","CHECK_DATA"].includes(st.state)||!Number.isSafeInteger(st.recordCount)||
   st.recordCount<0||st.mode!=="SHADOW_RESEARCH"||st.brokerOrderAllowed!==false||
   st.rawTiingoOhlcPersisted!==false||st.performanceCertification!=="INDICATIVE_NOT_COMPARABLE"||
   !Number.isFinite(Date.parse(st.evaluatedAt)))
   return failed("Gold50 DD台帳の安全設定が一致しません");
  const rows=ledgerText.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)) as GoldModelValue[];
  if(rows.length!==st.recordCount)return failed("Gold50 DD台帳件数が一致しません");
  for(let i=0;i<rows.length;i++){
   const r=rows[i],prior=rows[i-1],expected=prior?nextNyseSession(prior.marketDataDate):GOLD_PERFORMANCE_START;
   const kind=!prior?(r.marketDataDate===GOLD_PERFORMANCE_START?"INITIAL":"GAP_RESET"):
    r.marketDataDate===expected?"CONTIGUOUS":"GAP_RESET";
   const signalOnPreviousClose=signal.rows.find(x=>x.marketDataDate===r.signalDate);
   const signalOnValuation=signal.rows.find(x=>x.marketDataDate===r.marketDataDate);
   if(r.version!==GOLD_PERFORMANCE_VERSION||!iso(r.marketDataDate)||r.marketDataDate<GOLD_PERFORMANCE_START||
    !iso(r.signalDate)||nextNyseSession(r.signalDate)!==r.marketDataDate||
    !signalOnPreviousClose||!signalOnValuation||signalOnValuation.continuity?.kind==="UNOBSERVED_GAP"||
    !sha(r.sourceCommit,40)||!sha(r.pricesSha256,64)||
    r.continuity?.kind!==kind||r.continuity?.expectedDate!==expected||
    !positive(r.index)||!positive(r.peak)||r.peak+1e-8<r.index||
    !valid(-r.dd)||!valid(-r.maxDd)||r.dd<r.maxDd-1e-10||
    !valid(r.shares?.TQQQ)||!valid(r.shares?.GLD)||!valid(r.cash)||
    !valid(r.costs)||!valid(r.turnover)||
    !Number.isSafeInteger(r.orderLegs)||r.orderLegs<0||r.orderLegs>2||
    r.mode!=="SHADOW_RESEARCH"||r.brokerOrderAllowed!==false||
    r.rawTiingoOhlcPersisted!==false||
    r.performanceCertification!=="INDICATIVE_NOT_COMPARABLE"||
    !r.appliedTarget||!(["TQQQ","GLD","CASH"] as const).every(x=>close(r.appliedTarget[x],signalOnPreviousClose.target[x])))
    return failed("Gold50 DDとForwardシグナルの整合性を検証できません");
   if(kind==="CONTIGUOUS"&&(r.maxDd>prior.maxDd+1e-10||r.costs+1e-9<prior.costs))
    return failed("Gold50 DDの連続期間が不正です");
  }
  const latest=rows.at(-1);
  if((latest?.marketDataDate??null)!==st.lastMarketDate||
   (latest?!positive(st.index)||!close(st.index!,latest.index)||
    !valid(-st.dd!)||!close(st.dd!,latest.dd)||
    !valid(-st.maxDd!)||!close(st.maxDd!,latest.maxDd):
    st.index!==null||st.dd!==null||st.maxDd!==null))
   return failed("Gold50 DD最新値が記録と一致しません");
  if(st.segments!==rows.filter(x=>x.continuity.kind!=="CONTIGUOUS").length)
   return failed("Gold50 DD不連続区間が一致しません");
  return{ok:true,reason:null,status:st,rows};
 }catch{return failed("Gold50 DDの形式が不正です")}
}
