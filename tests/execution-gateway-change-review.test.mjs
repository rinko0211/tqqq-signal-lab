import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {canonicalPaperEvidence} from '../lib/execution-gateway-evidence.mjs';
import {evaluateOfflineTwoPersonChange} from '../lib/execution-gateway-change-review.mjs';

const sha=x=>createHash('sha256').update(canonicalPaperEvidence(x)).digest('hex');
const fp=k=>createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
const pem=k=>k.export({format:'pem',type:'spki'}).toString();
const sig=(proposal,key)=>sign(null,Buffer.from(
  'TQQQ-GATEWAY-V5:OFFLINE-CHANGE-REVIEW:'+canonicalPaperEvidence(proposal),'utf8'),
  key).toString('base64');
const signers=()=>generateKeyPairSync('ed25519');
function fixture(){
 const sec=signers(),data=signers();
 const stamp='2026-10-11T00:00:00.000Z',end='2026-10-14T00:00:00.000Z';
 const currentRegistry={
  schemaVersion:1,mode:'OFFLINE_PAPER_FIXTURE',epoch:8,
  executionAuthority:'NONE',brokerOrderAllowed:false,validUntil:end,
  issuers:[
   {role:'SIGNAL',issuerId:'OFFLINE_SIGNAL_A',status:'ACTIVE',fingerprint:'a'.repeat(64),revokedAt:null},
   {role:'CALENDAR',issuerId:'OFFLINE_CALENDAR_A',status:'ACTIVE',fingerprint:'b'.repeat(64),revokedAt:null}
  ]};
 const nextRegistry=structuredClone(currentRegistry);
 nextRegistry.epoch=9;
 nextRegistry.issuers[0].status='REVOKED';
 nextRegistry.issuers[0].revokedAt='2026-10-11T00:15:00.000Z';
 const reviewerRoster={schemaVersion:1,type:'OFFLINE_REVIEWER_TEST_KEYS',validUntil:end,
  reviewers:[
   {role:'SECURITY_REVIEWER',keyId:'OFFLINE_SECURITY_A',status:'ACTIVE',revokedAt:null,
     notBefore:stamp,notAfter:end,publicKeyPem:pem(sec.publicKey),fingerprint:fp(sec.publicKey)},
   {role:'DATA_REVIEWER',keyId:'OFFLINE_DATA_A',status:'ACTIVE',revokedAt:null,
     notBefore:stamp,notAfter:end,publicKeyPem:pem(data.publicKey),fingerprint:fp(data.publicKey)}
  ]};
 const proposal={schemaVersion:1,mode:'OFFLINE_PAPER_CHANGE_REVIEW_ONLY',
  changeId:'OFFLINE_CHANGE_0001',changeType:'ISSUER_REVOCATION',
  previousRegistrySha256:sha(currentRegistry),nextRegistrySha256:sha(nextRegistry),
  previousEpoch:8,nextEpoch:9,proposedAt:'2026-10-11T00:15:00.000Z',
  expiresAt:'2026-10-11T20:00:00.000Z',
  reason:'Revoke compromised offline test fixture key and block research evidence'};
 const approvals=[
  {role:'SECURITY_REVIEWER',keyId:'OFFLINE_SECURITY_A',signature:sig(proposal,sec.privateKey)},
  {role:'DATA_REVIEWER',keyId:'OFFLINE_DATA_A',signature:sig(proposal,data.privateKey)}
 ];
 const ctx={currentRegistry,nextRegistry,expectedCurrentRegistrySha256:sha(currentRegistry),
  reviewerRoster,expectedReviewerRosterSha256:sha(reviewerRoster),
  proposal,approvals,observedAt:'2026-10-11T00:30:00.000Z',halted:false};
 return {ctx,sec,data};
}
const approve=c=>evaluateOfflineTwoPersonChange(c);
test('two independently pinned signed offline reviewers record proposal, no activation',()=>{
 const {ctx}=fixture(),r=approve(ctx);
 assert.equal(r.status,'DUAL_REVIEW_RECORDED_NO_ACTIVATION');
 assert.equal(r.approvedForActivation,false);
 assert.equal(r.brokerOrderAllowed,false);
 assert.equal(r.executionAuthority,'NONE');
 assert.equal(r.proposedEpoch,9);
});
test('missing security review denied',()=>{
 const {ctx}=fixture();ctx.approvals=ctx.approvals.slice(1);
 assert.equal(approve(ctx).reason,'TWO_DISTINCT_REVIEWERS_REQUIRED');
});
test('missing data review denied',()=>{
 const {ctx}=fixture();ctx.approvals=ctx.approvals.slice(0,1);
 assert.equal(approve(ctx).reason,'TWO_DISTINCT_REVIEWERS_REQUIRED');
});
test('duplicate one role cannot substitute for two distinct reviewers',()=>{
 const {ctx}=fixture();ctx.approvals[1]={...ctx.approvals[0]};
 assert.equal(approve(ctx).reason,'TWO_DISTINCT_REVIEWERS_REQUIRED');
});
test('replaced approval signature fails',()=>{
 const {ctx}=fixture();ctx.approvals[1].signature=Buffer.alloc(64).toString('base64');
 assert.equal(approve(ctx).reason,'INVALID_REVIEW_SIGNATURE');
});
test('approval cannot be reused for a different change type',()=>{
 const {ctx}=fixture();ctx.proposal.changeType='TEST_KEY_ROTATION';
 assert.equal(approve(ctx).reason,'INVALID_REVIEW_SIGNATURE');
});
test('approval cannot be reused for changed proposal justification',()=>{
 const {ctx}=fixture();ctx.proposal.reason+=' edited';
 assert.equal(approve(ctx).reason,'INVALID_REVIEW_SIGNATURE');
});
test('change proposal must bind next registry digest',()=>{
 const {ctx}=fixture();ctx.nextRegistry.issuers[1].fingerprint='c'.repeat(64);
 assert.equal(approve(ctx).reason,'INVALID_OR_STALE_CHANGE_PROPOSAL');
});
test('next registry cannot have skip-epoch upgrade',()=>{
 const {ctx}=fixture();ctx.nextRegistry.epoch=10;
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('next registry cannot rollback or keep same epoch',()=>{
 const {ctx}=fixture();ctx.nextRegistry.epoch=8;
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('untrusted current registry SHA pin fails',()=>{
 const {ctx}=fixture();ctx.expectedCurrentRegistrySha256='c'.repeat(64);
 assert.equal(approve(ctx).reason,'EXTERNAL_TRUST_PIN_MISMATCH');
});
test('untrusted reviewer roster SHA pin fails',()=>{
 const {ctx}=fixture();ctx.expectedReviewerRosterSha256='c'.repeat(64);
 assert.equal(approve(ctx).reason,'EXTERNAL_TRUST_PIN_MISMATCH');
});
test('missing out-of-band reviewer root is denied',()=>{
 const {ctx}=fixture();delete ctx.expectedReviewerRosterSha256;
 assert.equal(approve(ctx).reason,'OUT_OF_BAND_REGISTRY_AND_REVIEWER_PINS_REQUIRED');
});
test('revoked security approver cannot sign valid transition',()=>{
 const {ctx}=fixture();ctx.reviewerRoster.reviewers[0].status='REVOKED';
 ctx.reviewerRoster.reviewers[0].revokedAt='2026-10-11T00:01:00.000Z';
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('revoked data approver cannot sign',()=>{
 const {ctx}=fixture();ctx.reviewerRoster.reviewers[1].status='REVOKED';
 ctx.reviewerRoster.reviewers[1].revokedAt='2026-10-11T00:01:00.000Z';
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('expired reviewer cannot sign',()=>{
 const {ctx}=fixture();ctx.reviewerRoster.reviewers[0].notAfter=ctx.observedAt;
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('swapped public reviewer PEM invalidates pin',()=>{
 const {ctx}=fixture();
 ctx.reviewerRoster.reviewers[0].publicKeyPem=ctx.reviewerRoster.reviewers[1].publicKeyPem;
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('duplicate fingerprint reviewers are refused',()=>{
 const {ctx}=fixture();
 ctx.reviewerRoster.reviewers[0].fingerprint=ctx.reviewerRoster.reviewers[1].fingerprint;
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('change proposal expiry blocks old signatures',()=>{
 const {ctx}=fixture();ctx.observedAt='2026-10-11T20:00:00.000Z';
 assert.equal(approve(ctx).reason,'INVALID_OR_STALE_CHANGE_PROPOSAL');
});
test('change proposal future timestamp not accepted',()=>{
 const {ctx}=fixture();ctx.observedAt='2026-10-11T00:10:00.000Z';
 assert.equal(approve(ctx).reason,'INVALID_OR_STALE_CHANGE_PROPOSAL');
});
test('proposal lifetime greater than a day denied',()=>{
 const {ctx}=fixture();ctx.proposal.expiresAt='2026-10-13T00:00:00.000Z';
 assert.equal(approve(ctx).reason,'INVALID_OR_STALE_CHANGE_PROPOSAL');
});
test('unknown change category is refused',()=>{
 const {ctx}=fixture();ctx.proposal.changeType='AUTHORIZE_LIVE';
 assert.equal(approve(ctx).reason,'INVALID_OR_STALE_CHANGE_PROPOSAL');
});
test('attempt to give proposed registry broker authority fails',()=>{
 const {ctx}=fixture();ctx.nextRegistry.brokerOrderAllowed=true;
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('attempt to promote LIVE issuer registry fails',()=>{
 const {ctx}=fixture();ctx.nextRegistry.mode='LIVE';
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('kill switch true blocks all, even both valid approvals',()=>{
 const {ctx}=fixture();ctx.halted=true;
 assert.equal(approve(ctx).reason,'GLOBAL_RESEARCH_HALT');
});
test('missing HALT evidence defaults to denial',()=>{
 const {ctx}=fixture();delete ctx.halted;
 assert.equal(approve(ctx).reason,'GLOBAL_RESEARCH_HALT');
});
test('reviewer roster expiry blocks even valid signatures',()=>{
 const {ctx}=fixture();ctx.reviewerRoster.validUntil=ctx.observedAt;
 ctx.expectedReviewerRosterSha256=sha(ctx.reviewerRoster);
 assert.equal(approve(ctx).reason,'REGISTRY_OR_REVIEWER_POLICY_INVALID');
});
test('all outcomes always have executionAuthority NONE and brokerOrderAllowed false',()=>{
 const ctx=fixture().ctx;
 for(const x of [ctx,{...ctx,halted:true},{...ctx,approvals:[]}]) {
  const r=approve(x);assert.equal(r.executionAuthority,'NONE');
  assert.equal(r.brokerOrderAllowed,false);assert.equal(r.approvedForActivation,false);
 }
});
