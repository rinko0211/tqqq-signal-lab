/**
 * Gateway v4: offline PAPER fixture trust and published 2026 calendar parity.
 * This is a RESEARCH OBSERVER. It cannot authorize orders or certify any
 * actual NYSE/Nasdaq signed feed, account, broker, or issuer enrollment.
 */
import {createHash,createPublicKey,timingSafeEqual} from 'node:crypto';
import {canonicalPaperEvidence,verifyOfflinePaperEvidence} from './execution-gateway-evidence.mjs';

const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA=/^[a-f0-9]{64}$/;
const HEX40=/^[a-f0-9]{40}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const fail=reason=>({status:'REJECTED',reason,executionAuthority:'NONE',brokerOrderAllowed:false,authorization:'NONE'});
const validTime=s=>typeof s==='string'&&ISO.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString()===s;
const validDate=s=>typeof s==='string'&&DATE.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const exact=(a,b)=>timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const orderedUnique=arr=>Array.isArray(arr)&&arr.every((d,i)=>validDate(d)&&(i===0||d>arr[i-1]));
const CLOSED_2026=Object.freeze([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25'
]);
const EARLY_2026=Object.freeze([
  Object.freeze({date:'2026-11-27',close:'13:00'}),
  Object.freeze({date:'2026-12-24',close:'13:00'})
]);
export const PUBLIC_2026_REVIEW_ANCHORS=Object.freeze({
  year:2026,
  closed:CLOSED_2026,
  earlyCloses:EARLY_2026,
  nyseUrl:'https://www.nyse.com/trade/hours-calendars',
  nasdaqUrl:'https://www.nasdaqtrader.com/Trader.aspx?id=Calendar'
});
const ymdAdd=(date,n=1)=>{
  const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
};
function expectedSessions(start,end){
  const result=[];
  let day=start;
  for(let i=0;i<368&&day<=end;i++,day=ymdAdd(day)){
    const weekday=new Date(day+'T12:00:00Z').getUTCDay();
    if(weekday!==0&&weekday!==6&&!CLOSED_2026.includes(day))result.push(day);
  }
  return result;
}
function verifiedRef(r,source,link,now) {
  if(!r||r.source!==source||r.url!==link||r.year!==2026||
     !validTime(r.reviewedAt)||!validTime(r.validUntil)||
     Date.parse(r.reviewedAt)>Date.parse(now)||
     Date.parse(r.validUntil)<=Date.parse(now)||
     Date.parse(r.validUntil)-Date.parse(r.reviewedAt)>7*86400000||
     !orderedUnique(r.closed)||!Array.isArray(r.earlyCloses)||
     r.earlyCloses.some(x=>!x||!validDate(x.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.close))||
     r.earlyCloses.some((x,i)=>i>0&&x.date<=r.earlyCloses[i-1].date))return false;
  // Reviewed 2026 schedule is pinned to sources, not dynamically fetched.
  return canonicalPaperEvidence(r.closed)===canonicalPaperEvidence(CLOSED_2026) &&
    canonicalPaperEvidence(r.earlyCloses)===canonicalPaperEvidence(EARLY_2026);
}
function validIssuer(issuer,role,now){
  if(!issuer||issuer.role!==role||issuer.status!=='ACTIVE'||issuer.revokedAt!==null||
     typeof issuer.issuerId!=='string'||!/^OFFLINE_[A-Z_]{2,60}$/.test(issuer.issuerId)||
     typeof issuer.publicKeyPem!=='string'||issuer.publicKeyPem.length>2000||
     typeof issuer.fingerprint!=='string'||!SHA.test(issuer.fingerprint)||
     !validTime(issuer.notBefore)||!validTime(issuer.notAfter)||
     Date.parse(issuer.notBefore)>Date.parse(now)||Date.parse(issuer.notAfter)<=Date.parse(now))return false;
  try{
    const key=createPublicKey(issuer.publicKeyPem);
    if(key.asymmetricKeyType!=='ed25519')return false;
    const fingerprint=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
    return exact(fingerprint,issuer.fingerprint);
  }catch{return false;}
}

/**
 * Every input is supplied offline. The registry digest, version floor, exact
 * main+state SHAs MUST come from separate, non-request trust distribution.
 * A request supplying its own matching digest is NOT an enrollment mechanism.
 */
export function auditOfflineIssuerAndCalendar({
  input, signalProof,calendarProof,registry,expectedRegistrySha256,
  minimumRegistryEpoch,expectedMainSha,expectedStateSha,
  nyseReview,nasdaqReview,observedAt,halted
}={}){
  try{
    if(halted!==false)return fail('GLOBAL_RESEARCH_HALT');
    if(!validTime(observedAt)||!input||input.observedAt!==observedAt)
      return fail('INVALID_AUDIT_CLOCK');
    if(typeof expectedRegistrySha256!=='string'||!SHA.test(expectedRegistrySha256)||
       !Number.isSafeInteger(minimumRegistryEpoch)||minimumRegistryEpoch<1||
       typeof expectedMainSha!=='string'||!HEX40.test(expectedMainSha)||
       typeof expectedStateSha!=='string'||!HEX40.test(expectedStateSha))
      return fail('OUT_OF_BAND_TRUST_PINS_REQUIRED');
    const digest=hash(canonicalPaperEvidence(registry));
    if(!exact(digest,expectedRegistrySha256))return fail('ISSUER_REGISTRY_PIN_MISMATCH');
    if(registry.schemaVersion!==1||registry.mode!=='OFFLINE_PAPER_FIXTURE'||
       registry.executionAuthority!=='NONE'||registry.brokerOrderAllowed!==false||
       !Number.isSafeInteger(registry.epoch)||registry.epoch<minimumRegistryEpoch||
       !validTime(registry.validUntil)||Date.parse(registry.validUntil)<=Date.parse(observedAt)||
       !Array.isArray(registry.issuers)||registry.issuers.length!==2)
      return fail('ISSUER_REGISTRY_UNTRUSTED_OR_ROLLED_BACK');
    const [signalIssuer,calendarIssuer]=['SIGNAL','CALENDAR'].map(role=>
      registry.issuers.find(x=>x?.role===role));
    if(!validIssuer(signalIssuer,'SIGNAL',observedAt)||
       !validIssuer(calendarIssuer,'CALENDAR',observedAt)||
       signalIssuer.issuerId===calendarIssuer.issuerId||
       signalIssuer.fingerprint===calendarIssuer.fingerprint)
      return fail('ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
    // These are the reviewed, human-transcribed 2026 public web references,
    // not authenticated issuer-supplied data or proof of unscheduled closures.
    if(!verifiedRef(nyseReview,'NYSE_PUBLIC_REVIEW',PUBLIC_2026_REVIEW_ANCHORS.nyseUrl,observedAt)||
       !verifiedRef(nasdaqReview,'NASDAQ_PUBLIC_REVIEW',PUBLIC_2026_REVIEW_ANCHORS.nasdaqUrl,observedAt))
      return fail('PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
    if(!validDate(input.signal?.dataDate)||!validDate(input.signal?.signal?.executionDate)||
       !input.signal.dataDate.startsWith('2026-')||
       !input.signal.signal.executionDate.startsWith('2026-'))
      return fail('CALENDAR_YEAR_OUTSIDE_REVIEW');
    const calendar=calendarProof?.payload;
    const expected=calendar&&validDate(calendar.coverageStart)&&validDate(calendar.coverageEnd)&&
       calendar.coverageStart.startsWith('2026-')&&calendar.coverageEnd.startsWith('2026-')&&
       calendar.coverageEnd>=calendar.coverageStart&&
       (Date.parse(calendar.coverageEnd+'T12:00:00Z')-Date.parse(calendar.coverageStart+'T12:00:00Z'))<=45*86400000
       ?expectedSessions(calendar.coverageStart,calendar.coverageEnd):null;
    if(!expected||canonicalPaperEvidence(calendar.sessions)!==canonicalPaperEvidence(expected)||
       input.signal.signal.executionDate!==expected[expected.indexOf(input.signal.dataDate)+1])
      return fail('PUBLIC_CALENDAR_SESSION_PARITY_FAILED');
    const trust={
      mode:'PAPER_ONLY',repository:'rinko0211/tqqq-signal-lab',branch:'ops-state',
      expectedStateSha,expectedCodeSha:expectedMainSha,
      signalKeyPem:signalIssuer.publicKeyPem,calendarKeyPem:calendarIssuer.publicKeyPem,
      signalKeyFingerprint:signalIssuer.fingerprint,
      calendarKeyFingerprint:calendarIssuer.fingerprint
    };
    const proof=verifyOfflinePaperEvidence({input,signalProof,calendarProof,trust});
    if(proof.status!=='VERIFIED_PAPER_EVIDENCE')return fail('INVALID_DUAL_OFFLINE_SIGNATURES:'+proof.reason);
    return {status:'RESEARCH_REFERENCE_PARITY_ONLY',reason:'FIXTURE_SIGNATURES_MATCH_REVIEWED_2026_PUBLIC_DATES',
      registryEpoch:registry.epoch,registryDigest:digest,
      officialMachineFeedApproved:false,issuerIndependentOfOperator:false,
      executionAuthority:'NONE',brokerOrderAllowed:false,authorization:'NONE'};
  }catch{return fail('INVALID_OR_UNPARSEABLE_AUDIT_INPUT');}
}
