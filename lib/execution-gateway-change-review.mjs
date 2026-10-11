/**
 * Gateway v5 — OFFLINE TWO-REVIEWER CHANGE PROPOSAL, NOT ACTIVATION.
 * Detached Ed25519 signatures are from ephemerally generated TEST principals.
 * No issuer may become trusted and no source baseline may be changed by this
 * evaluator; no key storage, network, broker, orders or Production approval.
 */
import {createHash,createPublicKey,verify,timingSafeEqual} from 'node:crypto';
import {canonicalPaperEvidence} from './execution-gateway-evidence.mjs';

const SHA=/^[a-f0-9]{64}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const validTime=s=>typeof s==='string'&&ISO.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const digest=o=>createHash('sha256').update(canonicalPaperEvidence(o),'utf8').digest('hex');
const same=(a,b)=>SHA.test(a)&&SHA.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const fail=reason=>({status:'REJECTED',reason,approvedForActivation:false,executionAuthority:'NONE',brokerOrderAllowed:false});
const keyid=s=>typeof s==='string'&&/^OFFLINE_[A-Z0-9_]{3,64}$/.test(s);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const ROLE_IDS=['SECURITY_REVIEWER','DATA_REVIEWER'];

function verifyReviewer(record,now) {
  if(!record||!ROLE_IDS.includes(record.role)||!keyid(record.keyId)||
     record.status!=='ACTIVE'||record.revokedAt!==null||
     !validTime(record.notBefore)||!validTime(record.notAfter)||
     Date.parse(record.notBefore)>Date.parse(now)||Date.parse(record.notAfter)<=Date.parse(now)||
     typeof record.publicKeyPem!=='string'||record.publicKeyPem.length>2000||
     typeof record.fingerprint!=='string'||!SHA.test(record.fingerprint))return false;
  try {
    const k=createPublicKey(record.publicKeyPem);
    if(k.asymmetricKeyType!=='ed25519')return false;
    const fingerprint=createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
    return same(fingerprint,record.fingerprint);
  }catch{return false;}
}
function registryValid(r) {
  return r && r.schemaVersion===1&&r.mode==='OFFLINE_PAPER_FIXTURE'&&
    r.executionAuthority==='NONE'&&r.brokerOrderAllowed===false&&
    Number.isSafeInteger(r.epoch)&&r.epoch>0&&Array.isArray(r.issuers)&&r.issuers.length===2&&
    r.issuers.some(x=>x.role==='SIGNAL')&&r.issuers.some(x=>x.role==='CALENDAR')&&
    r.issuers.every(x=>typeof x.issuerId==='string'&&keyid(x.issuerId)&&
     ['ACTIVE','REVOKED'].includes(x.status)&&typeof x.fingerprint==='string'&&SHA.test(x.fingerprint));
}
function validReviewRoster(roster,now){
  if(!roster||roster.schemaVersion!==1||roster.type!=='OFFLINE_REVIEWER_TEST_KEYS'||
     !validTime(roster.validUntil)||Date.parse(roster.validUntil)<=Date.parse(now)||
     !Array.isArray(roster.reviewers)||roster.reviewers.length!==2)return false;
  const [security,data]=ROLE_IDS.map(role=>roster.reviewers.find(x=>x?.role===role));
  return security&&data&&security!==data&&security.keyId!==data.keyId&&
    security.fingerprint!==data.fingerprint&&verifyReviewer(security,now)&&verifyReviewer(data,now);
}
function verifyApproval(proposal,approval,reviewer){
  if(!exact(approval,['role','keyId','signature'])||
     approval.role!==reviewer.role||approval.keyId!==reviewer.keyId||
     typeof approval.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(approval.signature))return false;
  try{
    const sig=Buffer.from(approval.signature,'base64');
    if(sig.length!==64||sig.toString('base64')!==approval.signature)return false;
    const key=createPublicKey(reviewer.publicKeyPem);
    const body=Buffer.from('TQQQ-GATEWAY-V5:OFFLINE-CHANGE-REVIEW:'+canonicalPaperEvidence(proposal),'utf8');
    return verify(null,body,key,sig);
  }catch{return false;}
}
/**
 * Review result is a *non-binding* evidence artifact. A future separate
 * authorization path must validate out-of-band pins and perform controlled
 * changes; this function CANNOT activate/revoke keys or accept source dates.
 */
export function evaluateOfflineTwoPersonChange({
  currentRegistry,nextRegistry,expectedCurrentRegistrySha256,
  reviewerRoster,expectedReviewerRosterSha256,
  proposal,approvals,observedAt,halted
}={}){
  try{
    if(halted!==false)return fail('GLOBAL_RESEARCH_HALT');
    if(!validTime(observedAt))return fail('INVALID_AUDIT_CLOCK');
    if(!SHA.test(expectedCurrentRegistrySha256)||!SHA.test(expectedReviewerRosterSha256))
      return fail('OUT_OF_BAND_REGISTRY_AND_REVIEWER_PINS_REQUIRED');
    if(!same(digest(currentRegistry),expectedCurrentRegistrySha256)||
       !same(digest(reviewerRoster),expectedReviewerRosterSha256))
      return fail('EXTERNAL_TRUST_PIN_MISMATCH');
    if(!registryValid(currentRegistry)||!registryValid(nextRegistry)||
       nextRegistry.epoch!==currentRegistry.epoch+1||
       !validReviewRoster(reviewerRoster,observedAt))return fail('REGISTRY_OR_REVIEWER_POLICY_INVALID');

    const fields=['schemaVersion','mode','changeId','changeType','previousRegistrySha256',
      'nextRegistrySha256','previousEpoch','nextEpoch','proposedAt','expiresAt','reason'];
    if(!exact(proposal,fields)||proposal.schemaVersion!==1||
       proposal.mode!=='OFFLINE_PAPER_CHANGE_REVIEW_ONLY'||
       !keyid(proposal.changeId)||typeof proposal.reason!=='string'||
       proposal.reason.length<10||proposal.reason.length>300||
       !['ISSUER_REVOCATION','TEST_KEY_ROTATION','PUBLIC_SOURCE_BASELINE_REVIEW'].includes(proposal.changeType)||
       proposal.previousRegistrySha256!==expectedCurrentRegistrySha256||
       proposal.nextRegistrySha256!==digest(nextRegistry)||
       proposal.previousEpoch!==currentRegistry.epoch||
       proposal.nextEpoch!==nextRegistry.epoch||
       !validTime(proposal.proposedAt)||!validTime(proposal.expiresAt)||
       Date.parse(proposal.proposedAt)>Date.parse(observedAt)||
       Date.parse(proposal.expiresAt)<=Date.parse(observedAt)||
       Date.parse(proposal.expiresAt)-Date.parse(proposal.proposedAt)>24*3600_000||
       proposal.previousRegistrySha256===proposal.nextRegistrySha256)
      return fail('INVALID_OR_STALE_CHANGE_PROPOSAL');

    if(!Array.isArray(approvals)||approvals.length!==2||
       !ROLE_IDS.every(role=>approvals.filter(a=>a?.role===role).length===1))
      return fail('TWO_DISTINCT_REVIEWERS_REQUIRED');

    for(const reviewer of reviewerRoster.reviewers) {
      const approval=approvals.find(a=>a.role===reviewer.role);
      if(!verifyApproval(proposal,approval,reviewer))return fail('INVALID_REVIEW_SIGNATURE');
    }
    return {status:'DUAL_REVIEW_RECORDED_NO_ACTIVATION',reason:'TEST_ONLY_APPROVAL_EVIDENCE',
      proposedRegistryDigest:proposal.nextRegistrySha256,
      proposedEpoch:proposal.nextEpoch,
      approvedForActivation:false,executionAuthority:'NONE',brokerOrderAllowed:false};
  }catch{return fail('INVALID_OR_UNSERIALIZABLE_REVIEW');}
}
