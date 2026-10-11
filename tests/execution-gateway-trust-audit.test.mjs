import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {canonicalPaperEvidence} from '../lib/execution-gateway-evidence.mjs';
import {auditOfflineIssuerAndCalendar,PUBLIC_2026_REVIEW_ANCHORS} from '../lib/execution-gateway-trust-audit.mjs';

const SHA40=s=>s.repeat(40);
const kp=()=>generateKeyPairSync('ed25519');
const fp=k=>createHash('sha256').update(k.export({type:'spki',format:'der'})).digest('hex');
const pem=k=>k.export({type:'spki',format:'pem'}).toString();
const digest=o=>createHash('sha256').update(canonicalPaperEvidence(o)).digest('hex');
const signed=(role,payload,k)=>({payload,signature:sign(null,Buffer.from(
  'TQQQ-PAPER-GATEWAY-V2:'+role+':'+canonicalPaperEvidence(payload),'utf8'),k).toString('base64')});
const review=(source,url)=>({
 source,url,year:2026,reviewedAt:'2026-10-10T00:00:00.000Z',validUntil:'2026-10-14T00:00:00.000Z',
 closed:[...PUBLIC_2026_REVIEW_ANCHORS.closed],
 earlyCloses:PUBLIC_2026_REVIEW_ANCHORS.earlyCloses.map(x=>({...x}))
});
function fixture(){
 const a=kp(),b=kp(),generatedAt='2026-10-10T01:51:14.625Z',now='2026-10-11T00:00:00.000Z';
 const input={
  observedAt:now,
  signal:{generatedAt,dataDate:'2026-10-09',platformMode:'RESEARCH',state:'latest',
   assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',
   signal:{date:'2026-10-09',target:0.25,executionDate:'2026-10-12'}},
  status:{generatedAt,marketDataDate:'2026-10-09',signalDate:'2026-10-09',actionStatus:'success',
   state:'latest',errors:[]},
  session:{completedDataDate:'2026-10-09',nextLegalOpenDate:'2026-10-12'}
 };
 const source={schemaVersion:2,mode:'PAPER_ONLY',
  origin:{repository:'rinko0211/tqqq-signal-lab',branch:'ops-state',
   codeSha:SHA40('b'),stateSha:SHA40('a')},
  signal:structuredClone(input.signal),status:structuredClone(input.status),
  session:structuredClone(input.session),expiresAt:'2026-10-12T00:00:00.000Z'};
 const calendar={schemaVersion:2,mode:'PAPER_ONLY',exchange:'XNYS',
  sourceLabel:'OFFLINE_CALENDAR_FIXTURE',coverageStart:'2026-10-08',coverageEnd:'2026-10-15',
  sessions:['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15'],
  expiresAt:'2026-10-14T00:00:00.000Z'};
 const registry={schemaVersion:1,mode:'OFFLINE_PAPER_FIXTURE',epoch:4,
  validUntil:'2026-10-14T00:00:00.000Z',executionAuthority:'NONE',brokerOrderAllowed:false,
  issuers:[
   {role:'SIGNAL',issuerId:'OFFLINE_SIGNAL_SIGNER',status:'ACTIVE',revokedAt:null,
    publicKeyPem:pem(a.publicKey),fingerprint:fp(a.publicKey),
    notBefore:'2026-10-10T00:00:00.000Z',notAfter:'2026-10-14T00:00:00.000Z'},
   {role:'CALENDAR',issuerId:'OFFLINE_CALENDAR_SIGNER',status:'ACTIVE',revokedAt:null,
    publicKeyPem:pem(b.publicKey),fingerprint:fp(b.publicKey),
    notBefore:'2026-10-10T00:00:00.000Z',notAfter:'2026-10-14T00:00:00.000Z'}
  ]};
 const ctx={input,observedAt:now,registry,expectedRegistrySha256:digest(registry),
  minimumRegistryEpoch:4,expectedMainSha:SHA40('b'),expectedStateSha:SHA40('a'),
  nyseReview:review('NYSE_PUBLIC_REVIEW',PUBLIC_2026_REVIEW_ANCHORS.nyseUrl),
  nasdaqReview:review('NASDAQ_PUBLIC_REVIEW',PUBLIC_2026_REVIEW_ANCHORS.nasdaqUrl),
  signalProof:signed('SIGNAL',source,a.privateKey),
  calendarProof:signed('CALENDAR',calendar,b.privateKey),halted:false};
 return {ctx,a,b,source,calendar};
}
const audited=ctx=>auditOfflineIssuerAndCalendar(ctx);
test('fixture issuer and two manually reviewed 2026 sources can only yield RESEARCH parity',()=>{
 const r=audited(fixture().ctx);assert.equal(r.status,'RESEARCH_REFERENCE_PARITY_ONLY');
 assert.equal(r.brokerOrderAllowed,false);assert.equal(r.authorization,'NONE');
 assert.equal(r.executionAuthority,'NONE');assert.equal(r.officialMachineFeedApproved,false);
 assert.equal(r.issuerIndependentOfOperator,false);assert.equal(r.registryEpoch,4);
});
test('Columbus Day 2026-10-12 remains an exchange session despite federal holiday',()=>{
 const r=audited(fixture().ctx);assert.equal(r.status,'RESEARCH_REFERENCE_PARITY_ONLY');
});
test('2026 official holiday fixture contains all ten closure dates and two early closes',()=>{
 assert.equal(PUBLIC_2026_REVIEW_ANCHORS.closed.length,10);
 assert.deepEqual(PUBLIC_2026_REVIEW_ANCHORS.earlyCloses,[
  {date:'2026-11-27',close:'13:00'},{date:'2026-12-24',close:'13:00'}]);
});
test('registry digest pin must be independent, not self-accepted',()=>{
 const {ctx}=fixture();delete ctx.expectedRegistrySha256;
 assert.equal(audited(ctx).reason,'OUT_OF_BAND_TRUST_PINS_REQUIRED');
});
test('tampered signer registry rejected even if internally valid',()=>{
 const {ctx}=fixture();ctx.registry.issuers[0].status='REVOKED';
 assert.equal(audited(ctx).reason,'ISSUER_REGISTRY_PIN_MISMATCH');
});
test('signed revoked-issuer state is NOT allowed after pinned registry refresh',()=>{
 const {ctx}=fixture();ctx.registry.issuers[0].status='REVOKED';
 ctx.registry.issuers[0].revokedAt='2026-10-10T22:00:00.000Z';
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
});
test('revoking calendar issuer blocks research verification',()=>{
 const {ctx}=fixture();ctx.registry.issuers[1].status='REVOKED';
 ctx.registry.issuers[1].revokedAt='2026-10-10T22:00:00.000Z';
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
});
test('registry rollback below pinned epoch floor is rejected',()=>{
 const {ctx}=fixture();ctx.minimumRegistryEpoch=5;
 assert.equal(audited(ctx).reason,'ISSUER_REGISTRY_UNTRUSTED_OR_ROLLED_BACK');
});
test('registry expired at observed timestamp is rejected',()=>{
 const {ctx}=fixture();ctx.registry.validUntil=ctx.observedAt;
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REGISTRY_UNTRUSTED_OR_ROLLED_BACK');
});
test('calendar issuer certificate expired independently of registry',()=>{
 const {ctx}=fixture();ctx.registry.issuers[1].notAfter=ctx.observedAt;
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
});
test('wrong public PEM that does not match pinned fingerprint is rejected',()=>{
 const {ctx}=fixture();ctx.registry.issuers[0].publicKeyPem=pem(kp().publicKey);
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
});
test('duplicate signer fingerprint is rejected',()=>{
 const {ctx}=fixture();ctx.registry.issuers[1].publicKeyPem=ctx.registry.issuers[0].publicKeyPem;
 ctx.registry.issuers[1].fingerprint=ctx.registry.issuers[0].fingerprint;
 ctx.expectedRegistrySha256=digest(ctx.registry);
 assert.equal(audited(ctx).reason,'ISSUER_REVOKED_EXPIRED_OR_UNENROLLED');
});
test('kill switch is default deny',()=>{
 const {ctx}=fixture();delete ctx.halted;
 assert.equal(audited(ctx).reason,'GLOBAL_RESEARCH_HALT');
});
test('kill switch true denies even valid offline signed references',()=>{
 const {ctx}=fixture();ctx.halted=true;
 assert.equal(audited(ctx).reason,'GLOBAL_RESEARCH_HALT');
});
test('reviewed NYSE holiday missing from reference blocks',()=>{
 const {ctx}=fixture();ctx.nyseReview.closed=ctx.nyseReview.closed.filter(d=>d!=='2026-11-26');
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('Nasdaq mismatch to NYSE blocked',()=>{
 const {ctx}=fixture();ctx.nasdaqReview.closed.push('2026-12-31');
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('NYSE early close 2026-11-27 incorrectly listed as ordinary blocks',()=>{
 const {ctx}=fixture();ctx.nyseReview.earlyCloses=[];
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('NYSE early close at 16:00 instead of 13:00 is rejected',()=>{
 const {ctx}=fixture();ctx.nyseReview.earlyCloses[0].close='16:00';
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('unsigned copy of exchange URL is not sufficient',()=>{
 const {ctx}=fixture();ctx.nyseReview.source='UNTRUSTED_SOURCE';
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('reviewed source expires and MUST be manually refreshed',()=>{
 const {ctx}=fixture();ctx.nasdaqReview.validUntil=ctx.observedAt;
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('never accept review TTL over seven days',()=>{
 const {ctx}=fixture();ctx.nyseReview.validUntil='2026-11-01T00:00:00.000Z';
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('review timestamp from the future is rejected',()=>{
 const {ctx}=fixture();ctx.nyseReview.reviewedAt='2026-10-12T00:00:00.000Z';
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_REVIEW_STALE_OR_MISMATCHED');
});
test('fabricated Monday closure in signed fixture is rejected by full-week parity',()=>{
 const {ctx,calendar,b}=fixture();
 calendar.sessions=calendar.sessions.filter(d=>d!=='2026-10-12');
 ctx.calendarProof=signed('CALENDAR',calendar,b.privateKey);
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_SESSION_PARITY_FAILED');
});
test('intermediate missing session beyond next open is rejected',()=>{
 const {ctx,calendar,b}=fixture();calendar.sessions=calendar.sessions.filter(d=>d!=='2026-10-14');
 ctx.calendarProof=signed('CALENDAR',calendar,b.privateKey);
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_SESSION_PARITY_FAILED');
});
test('forged weekend trading day in signed list is rejected',()=>{
 const {ctx,calendar,b}=fixture();calendar.sessions.splice(2,0,'2026-10-10');
 ctx.calendarProof=signed('CALENDAR',calendar,b.privateKey);
 assert.equal(audited(ctx).reason,'PUBLIC_CALENDAR_SESSION_PARITY_FAILED');
});
test('different expected ops-state SHA cannot verify source',()=>{
 const {ctx}=fixture();ctx.expectedStateSha=SHA40('c');
 assert.equal(audited(ctx).reason,'INVALID_DUAL_OFFLINE_SIGNATURES:INVALID_SIGNED_SOURCE_SCOPE');
});
test('calendar signature tampering is rejected',()=>{
 const {ctx}=fixture();ctx.calendarProof.signature='INVALID';
 assert.equal(audited(ctx).reason,'INVALID_DUAL_OFFLINE_SIGNATURES:INVALID_CALENDAR_SIGNATURE');
});
test('signal target corruption against signed input is rejected',()=>{
 const {ctx}=fixture();ctx.input.signal.signal.target=1;
 assert.equal(audited(ctx).reason,'INVALID_DUAL_OFFLINE_SIGNATURES:SIGNED_SOURCE_INPUT_MISMATCH');
});
test('replay after v2 proof expiry still blocked',()=>{
 const {ctx}=fixture();
 ctx.observedAt='2026-10-12T01:00:00.000Z';ctx.input.observedAt=ctx.observedAt;
 assert.equal(audited(ctx).reason,'INVALID_DUAL_OFFLINE_SIGNATURES:EVIDENCE_EXPIRED_OR_TIME_INVALID');
});
test('calendar dates outside reviewed year always blocked',()=>{
 const {ctx}=fixture();ctx.input.signal.signal.executionDate='2027-01-04';
 assert.equal(audited(ctx).reason,'CALENDAR_YEAR_OUTSIDE_REVIEW');
});
test('audit cannot issue executable or broker-allowed state under any input',()=>{
 const f=fixture().ctx;
 for(const ctx of [f,{...f,halted:true},{...f,expectedRegistrySha256:'0'.repeat(64)}]){
  const r=audited(ctx);
  assert.equal(r.executionAuthority,'NONE');assert.equal(r.brokerOrderAllowed,false);
  assert.equal(r.authorization,'NONE');
 }
});
