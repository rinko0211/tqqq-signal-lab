/**
 * Gateway v2: independent OFFLINE PAPER evidence admission.
 *
 * Two separately pinned Ed25519 PUBLIC trust roots are required:
 * signed Signal/Status source assertion and signed NYSE-calendar FIXTURE.
 * No private key, broker client, network access or order execution.
 *
 * This is NOT a signature issued by GitHub or an authorized NYSE data vendor:
 * both proofs are test fixtures until real, independent issuers are approved.
 */
import { createHash, createPublicKey, verify as edVerify, timingSafeEqual } from 'node:crypto';
import { reserveOfflinePaperIntent } from './execution-gateway-journal.mjs';

const RESULT=(status,reason,intent=null)=>({status,reason,intent,brokerOrderAllowed:false,executionAuthority:'NONE'});
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const exactKeys=(o,keys)=> o && typeof o==='object' && !Array.isArray(o) &&
  Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
const dateOK=s=>{
  if(typeof s!=='string'||!DATE.test(s)) return false;
  const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;
};
const timeOK=s=>typeof s==='string' && ISO.test(s) && Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString()===s.replace(/\.000Z$/,'Z').replace(/Z$/,s.includes('.')?'Z': 'Z');
const sha = s=>createHash('sha256').update(s).digest('hex');

// Reject non-JSON or ambiguous values. Canonicalization is deterministic across
// property-order changes; there are no implicit string conversions.
function canonical(x,depth=0) {
  if(depth>20) throw new Error('NESTED_PAYLOAD');
  if(x===null) return 'null';
  if(typeof x==='string'||typeof x==='boolean') return JSON.stringify(x);
  if(typeof x==='number' && Number.isFinite(x) && !Object.is(x,-0)) return JSON.stringify(x);
  if(Array.isArray(x)) {
    if(x.length>400) throw new Error('OVERSIZE_ARRAY');
    return '['+x.map(v=>canonical(v,depth+1)).join(',')+']';
  }
  if(typeof x==='object' && (Object.getPrototypeOf(x)===Object.prototype || Object.getPrototypeOf(x)===null)) {
    const keys=Object.keys(x).sort();
    if(keys.length>100) throw new Error('OVERSIZE_OBJECT');
    return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(x[k],depth+1)).join(',')+'}';
  }
  throw new Error('NON_JSON_VALUE');
}
export function canonicalPaperEvidence(x) {
  const body=canonical(x);
  if(Buffer.byteLength(body)>100_000) throw new Error('OVERSIZE_PAYLOAD');
  return body;
}
const fingerprintsEqual=(actual,expected)=>{
  if(typeof expected!=='string'||!SHA64.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));
};
function verifyDetached(kind,proof,keyPem,expectedFingerprint){
  if(!exactKeys(proof,['payload','signature'])||
     typeof proof.signature!=='string'||!(/^[A-Za-z0-9+/]{86}==$/.test(proof.signature))) return false;
  try {
    const key=createPublicKey(keyPem);
    if(key.asymmetricKeyType!=='ed25519') return false;
    const fingerprint=sha(key.export({format:'der',type:'spki'}));
    if(!fingerprintsEqual(fingerprint,expectedFingerprint)) return false;
    const signature=Buffer.from(proof.signature,'base64');
    if(signature.length!==64||signature.toString('base64')!==proof.signature) return false;
    const data=Buffer.from('TQQQ-PAPER-GATEWAY-V2:'+kind+':'+canonicalPaperEvidence(proof.payload),'utf8');
    return edVerify(null,data,key,signature);
  } catch {return false;}
}
/** Detached signature verifier, not a signer. Tests use ephemeral keypairs. */
export function verifyOfflinePaperEvidence({input,signalProof,calendarProof,trust}={}) {
  const no=reason=>RESULT('REJECTED',reason);
  try {
    if(!trust||!input||typeof input!=='object'||
       trust.mode!=='PAPER_ONLY'||
       typeof trust.repository!=='string'||trust.repository!=='rinko0211/tqqq-signal-lab'||
       trust.branch!=='ops-state'||!SHA40.test(trust.expectedStateSha)||
       !SHA40.test(trust.expectedCodeSha)||
       typeof trust.signalKeyPem!=='string'||typeof trust.calendarKeyPem!=='string'||
       !SHA64.test(trust.signalKeyFingerprint)||!SHA64.test(trust.calendarKeyFingerprint)||
       trust.signalKeyFingerprint===trust.calendarKeyFingerprint) return no('UNTRUSTED_OFFLINE_POLICY');

    const a=signalProof?.payload, c=calendarProof?.payload;
    if(!exactKeys(a,['schemaVersion','mode','origin','signal','status','session','expiresAt'])||
       a.schemaVersion!==2||a.mode!=='PAPER_ONLY'||
       !exactKeys(a.origin,['repository','branch','stateSha','codeSha'])||
       a.origin.repository!==trust.repository||a.origin.branch!==trust.branch||
       a.origin.stateSha!==trust.expectedStateSha||a.origin.codeSha!==trust.expectedCodeSha ||
       !timeOK(a.expiresAt)) return no('INVALID_SIGNED_SOURCE_SCOPE');
    if(!verifyDetached('SIGNAL',signalProof,trust.signalKeyPem,trust.signalKeyFingerprint)) return no('INVALID_SIGNAL_SIGNATURE');
    const bound=['signal','status','session'].every(k=>
       canonicalPaperEvidence(a[k])===canonicalPaperEvidence(input[k]));
    if(!bound) return no('SIGNED_SOURCE_INPUT_MISMATCH');

    if(!exactKeys(c,['schemaVersion','mode','exchange','sourceLabel','coverageStart','coverageEnd','sessions','expiresAt'])||
       c.schemaVersion!==2||c.mode!=='PAPER_ONLY'||c.exchange!=='XNYS'||
       c.sourceLabel!=='OFFLINE_CALENDAR_FIXTURE'||!timeOK(c.expiresAt)||
       !dateOK(c.coverageStart)||!dateOK(c.coverageEnd)||
       c.coverageStart>c.coverageEnd||!Array.isArray(c.sessions)||
       c.sessions.length<2||c.sessions.length>45) return no('INVALID_SIGNED_CALENDAR_SCOPE');
    if(!verifyDetached('CALENDAR',calendarProof,trust.calendarKeyPem,trust.calendarKeyFingerprint))
      return no('INVALID_CALENDAR_SIGNATURE');

    const now=input.observedAt;
    if(!timeOK(now)||Date.parse(a.expiresAt)<=Date.parse(now)||
       Date.parse(c.expiresAt)<=Date.parse(now)) return no('EVIDENCE_EXPIRED_OR_TIME_INVALID');
    // A calendar voucher cannot be made arbitrarily long-lived.
    if(Date.parse(c.expiresAt)-Date.parse(now)>15*86400_000 ||
       Date.parse(a.expiresAt)-Date.parse(now)>4*86400_000) return no('EVIDENCE_EXPIRY_UNBOUNDED');

    const signalDate=input.signal?.dataDate,executionDate=input.signal?.signal?.executionDate;
    if(!dateOK(signalDate)||!dateOK(executionDate) ||
       c.coverageStart>signalDate||c.coverageEnd<executionDate||
       c.sessions[0]!==c.coverageStart||c.sessions.at(-1)!==c.coverageEnd ||
       !c.sessions.every((date,i)=>dateOK(date)&&date>=c.coverageStart&&date<=c.coverageEnd &&
          (i===0||date>c.sessions[i-1]) &&
          ![0,6].includes(new Date(date+'T12:00:00Z').getUTCDay()))) return no('INVALID_CALENDAR_COVERAGE');
    const index=c.sessions.indexOf(signalDate);
    if(index<0||c.sessions[index+1]!==executionDate||
       input.session?.completedDataDate!==signalDate ||
       input.session?.nextLegalOpenDate!==executionDate) return no('INDEPENDENT_SESSION_MISMATCH');
    return {status:'VERIFIED_PAPER_EVIDENCE',reason:'TWO_OFFLINE_FIXTURE_SIGNATURES',intent:null,
      brokerOrderAllowed:false,executionAuthority:'NONE'};
  } catch {return no('INVALID_OR_UNPARSABLE_EVIDENCE');}
}
/**
 * v2 reservation always delegates the actual session slot CAS, HALT and risk
 * checks to v1 AFTER verifying both detached PAPER-only attestations.
 */
export async function reserveVerifiedOfflinePaperIntent(args={}) {
  const verdict=verifyOfflinePaperEvidence(args);
  if(verdict.status!=='VERIFIED_PAPER_EVIDENCE') return verdict;
  return reserveOfflinePaperIntent({
    directory:args.directory, input:args.input, offlineBrokerSnapshot:args.offlineBrokerSnapshot
  });
}
