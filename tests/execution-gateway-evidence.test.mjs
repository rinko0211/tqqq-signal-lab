import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {mkdtemp, rm, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  canonicalPaperEvidence, verifyOfflinePaperEvidence, reserveVerifiedOfflinePaperIntent
} from '../lib/execution-gateway-evidence.mjs';
import {initializeOfflinePaperJournal,haltOfflinePaperJournal} from '../lib/execution-gateway-journal.mjs';

const gen=()=>generateKeyPairSync('ed25519');
const pem=k=>k.export({format:'pem',type:'spki'}).toString();
const fingerprint=k=>createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
function signProof(kind,payload,key) {
  return {payload, signature:sign(null,
    Buffer.from('TQQQ-PAPER-GATEWAY-V2:'+kind+':'+canonicalPaperEvidence(payload),'utf8'),
    key).toString('base64')};
}
function fixture(){
  const source=gen(),calendar=gen();
  const generatedAt='2026-10-10T01:51:14.625Z';
  const input={
    observedAt:'2026-10-10T09:00:00.000Z',
    signal:{generatedAt,dataDate:'2026-10-09',platformMode:'RESEARCH',
      state:'latest',assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',
      signal:{date:'2026-10-09',target:0.25,executionDate:'2026-10-12'}},
    status:{generatedAt,marketDataDate:'2026-10-09',signalDate:'2026-10-09',
      actionStatus:'success',state:'latest',errors:[]},
    production:{mode:'RESEARCH',approvedByHuman:false,selectedTicker:null},
    session:{completedDataDate:'2026-10-09',nextLegalOpenDate:'2026-10-12'},
    snapshot:{source:'OFFLINE_PAPER_FIXTURE',accountType:'PAPER',currency:'USD',
      asOf:'2026-10-10T08:00:00.000Z',accountId:'paper-v2-test',
      netLiquidationUSD:10000,settledCashUSD:10000,currentTqqqShares:0,pendingOrders:0},
    quote:{ticker:'TQQQ',priceUSD:81.28,asOf:generatedAt},
    policy:{mode:'PAPER_ONLY',killSwitch:false,allowlist:['TQQQ'],
      maxOrderNotionalUSD:3000,maxPositionNotionalUSD:3000,maxPositionFraction:0.3},
    priorIntentIds:[]
  };
  const origin={repository:'rinko0211/tqqq-signal-lab',
    branch:'ops-state',stateSha:'a'.repeat(40),codeSha:'b'.repeat(40)};
  const sourcePayload={schemaVersion:2,mode:'PAPER_ONLY',origin,
    signal:input.signal,status:input.status,session:input.session,
    expiresAt:'2026-10-11T09:00:00.000Z'};
  const calendarPayload={schemaVersion:2,mode:'PAPER_ONLY',
    exchange:'XNYS',sourceLabel:'OFFLINE_CALENDAR_FIXTURE',
    coverageStart:'2026-10-08',coverageEnd:'2026-10-15',
    sessions:['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15'],
    expiresAt:'2026-10-15T09:00:00.000Z'};
  const trust={mode:'PAPER_ONLY',repository:origin.repository,branch:origin.branch,
    expectedStateSha:origin.stateSha,expectedCodeSha:origin.codeSha,
    signalKeyPem:pem(source.publicKey),calendarKeyPem:pem(calendar.publicKey),
    signalKeyFingerprint:fingerprint(source.publicKey),
    calendarKeyFingerprint:fingerprint(calendar.publicKey)};
  const ctx={input,trust,
    signalProof:signProof('SIGNAL',sourcePayload,source.privateKey),
    calendarProof:signProof('CALENDAR',calendarPayload,calendar.privateKey),
    offlineBrokerSnapshot:{...input.snapshot,source:'OFFLINE_BROKER_FIXTURE'}};
  return {ctx,source,calendar,sourcePayload,calendarPayload};
}
const verify=ctx=>verifyOfflinePaperEvidence(ctx);
async function withJournal(t){
 const parent=await mkdtemp(join(tmpdir(),'gateway-v2-offline-'));
 t.after(()=>rm(parent,{recursive:true,force:true}));
 const directory=join(parent,'journal');
 await initializeOfflinePaperJournal(directory);
 return {...fixture().ctx,directory};
}
test('verified v2 requires two distinct pinned offline Ed25519 authorities',()=>{
 const {ctx}=fixture(),v=verify(ctx);
 assert.equal(v.status,'VERIFIED_PAPER_EVIDENCE');
 assert.equal(v.brokerOrderAllowed,false);
 assert.equal(v.executionAuthority,'NONE');
 assert.equal(v.intent,null);
});
test('canonical serialization ignores property order, not values',()=>{
 assert.equal(canonicalPaperEvidence({b:2,a:[{y:1,x:2}]}),
   canonicalPaperEvidence({a:[{x:2,y:1}],b:2}));
 assert.notEqual(canonicalPaperEvidence({a:2}),canonicalPaperEvidence({a:3}));
});
test('signed data modification is rejected',()=>{
 const {ctx}=fixture();ctx.signalProof.payload.signal.signal.target=1;
 assert.equal(verify(ctx).reason,'INVALID_SIGNAL_SIGNATURE');
});
test('valid signature does not allow substitution of input signal',()=>{
 const {ctx}=fixture();ctx.input.signal.signal.target=1;
 assert.equal(verify(ctx).reason,'SIGNED_SOURCE_INPUT_MISMATCH');
});
test('valid signature does not allow substitution of upstream status',()=>{
 const {ctx}=fixture();ctx.input.status.errors=['provider'];
 assert.equal(verify(ctx).reason,'SIGNED_SOURCE_INPUT_MISMATCH');
});
test('swapping signer keys cannot pass separate pinning',()=>{
 const {ctx}=fixture();
 [ctx.trust.calendarKeyPem,ctx.trust.signalKeyPem]=[ctx.trust.signalKeyPem,ctx.trust.calendarKeyPem];
 assert.equal(verify(ctx).reason,'INVALID_SIGNAL_SIGNATURE');
});
test('attacker-chosen replacement fingerprint cannot override signal trust',()=>{
 const {ctx}=fixture();
 ctx.signalProof.signature=Buffer.alloc(64).toString('base64');
 assert.equal(verify(ctx).reason,'INVALID_SIGNAL_SIGNATURE');
});
test('reject signature missing altogether',()=>{
 const {ctx}=fixture();delete ctx.signalProof.signature;
 assert.equal(verify(ctx).reason,'INVALID_SIGNAL_SIGNATURE');
});
test('reject signature different domain',()=>{
 const {ctx,source,sourcePayload}=fixture();
 ctx.signalProof=signProof('CALENDAR',sourcePayload,source.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_SIGNAL_SIGNATURE');
});
test('reject unexpected signed origin ref',()=>{
 const {ctx,source,sourcePayload}=fixture();
 sourcePayload.origin.branch='main';
 ctx.signalProof=signProof('SIGNAL',sourcePayload,source.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_SIGNED_SOURCE_SCOPE');
});
test('reject unexpected source SHA even with genuine fixture key',()=>{
 const {ctx,source,sourcePayload}=fixture();
 sourcePayload.origin.stateSha='c'.repeat(40);
 ctx.signalProof=signProof('SIGNAL',sourcePayload,source.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_SIGNED_SOURCE_SCOPE');
});
test('reject source code SHA mismatch',()=>{
 const {ctx,source,sourcePayload}=fixture();
 sourcePayload.origin.codeSha='c'.repeat(40);
 ctx.signalProof=signProof('SIGNAL',sourcePayload,source.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_SIGNED_SOURCE_SCOPE');
});
test('reject if trust pins same key for both issuers',()=>{
 const {ctx}=fixture();
 ctx.trust.calendarKeyFingerprint=ctx.trust.signalKeyFingerprint;
 assert.equal(verify(ctx).reason,'UNTRUSTED_OFFLINE_POLICY');
});
test('calendar body tamper invalidates signature',()=>{
 const {ctx}=fixture();ctx.calendarProof.payload.sessions=['2026-10-09','2026-10-12'];
 assert.equal(verify(ctx).reason,'INVALID_CALENDAR_SIGNATURE');
});
test('calendar forged with wrong domain is rejected',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 ctx.calendarProof=signProof('SIGNAL',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_CALENDAR_SIGNATURE');
});
test('calendar cannot omit intervening verified session',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.sessions=['2026-10-08','2026-10-09','2026-10-13','2026-10-14','2026-10-15'];
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'INDEPENDENT_SESSION_MISMATCH');
});
test('calendar cannot treat weekend as session',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.sessions=['2026-10-08','2026-10-09','2026-10-10','2026-10-12',
   '2026-10-13','2026-10-14','2026-10-15'];
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_CALENDAR_COVERAGE');
});
test('invalid coverage window rejected with valid fixture signature',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.coverageStart='2026-10-12';
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_CALENDAR_COVERAGE');
});
test('calendar source not official: require exact fixture source label',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.sourceLabel='OFFICIAL_NYSE';
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'INVALID_SIGNED_CALENDAR_SCOPE');
});
test('reject expired source assertion',()=>{
 const {ctx}=fixture();ctx.input.observedAt='2026-10-12T01:00:00.000Z';
 assert.equal(verify(ctx).reason,'EVIDENCE_EXPIRED_OR_TIME_INVALID');
});
test('reject expired calendar voucher',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.expiresAt='2026-10-10T08:00:00.000Z';
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'EVIDENCE_EXPIRED_OR_TIME_INVALID');
});
test('reject excessively long voucher lifetimes',()=>{
 const {ctx,calendar,calendarPayload}=fixture();
 calendarPayload.expiresAt='2026-12-01T09:00:00.000Z';
 ctx.calendarProof=signProof('CALENDAR',calendarPayload,calendar.privateKey);
 assert.equal(verify(ctx).reason,'EVIDENCE_EXPIRY_UNBOUNDED');
});
test('reject missing explicitly trusted policy',()=>{
 const {ctx}=fixture();delete ctx.trust;
 assert.equal(verify(ctx).reason,'UNTRUSTED_OFFLINE_POLICY');
});
test('reject real trading authority even with valid offline proof',async t=>{
 const ctx=await withJournal(t);ctx.input.production.mode='PRODUCTION';
 const v=await reserveVerifiedOfflinePaperIntent(ctx);
 assert.equal(v.reason,'PRODUCTION_AUTHORITY_NOT_ALLOWED');
 assert.equal(v.brokerOrderAllowed,false);
});
test('verified evidence reserves only OFFLINE PAPER, and dedupe survives repeat',async t=>{
 const ctx=await withJournal(t);
 const a=await reserveVerifiedOfflinePaperIntent(ctx);
 assert.equal(a.status,'PAPER_RESERVED');assert.equal(a.brokerOrderAllowed,false);
 assert.equal(a.executionAuthority,'NONE');
 const b=await reserveVerifiedOfflinePaperIntent(ctx);
 assert.equal(b.reason,'DUPLICATE_PAPER_SESSION');
});
test('parallel v2 signed claims admit one PAPER reservation only',async t=>{
 const ctx=await withJournal(t);
 const out=await Promise.all(Array.from({length:12},()=>reserveVerifiedOfflinePaperIntent(ctx)));
 assert.equal(out.filter(x=>x.status==='PAPER_RESERVED').length,1);
 assert.equal(out.filter(x=>x.status==='REJECTED').length,11);
 const duplicates=new Set(['DUPLICATE_PAPER_SESSION','UNRESOLVED_JOURNAL_SLOT']);
 assert.ok(out.filter(x=>x.status==='REJECTED').every(x=>duplicates.has(x.reason)));
});
test('signed but mismatched offline broker fixture cannot reserve',async t=>{
 const ctx=await withJournal(t);ctx.offlineBrokerSnapshot.currentTqqqShares=15;
 const v=await reserveVerifiedOfflinePaperIntent(ctx);
 assert.equal(v.reason,'MOCK_BROKER_RECONCILIATION_FAILED');
 assert.equal((await readdir(ctx.directory)).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).length,0);
});
test('sticky HALT dominates signed source and calendar approvals',async t=>{
 const ctx=await withJournal(t);
 await haltOfflinePaperJournal(ctx.directory);
 const v=await reserveVerifiedOfflinePaperIntent(ctx);
 assert.equal(v.status,'HALTED');assert.equal(v.reason,'KILL_SWITCH_LATCHED');
 assert.equal(v.intent,null);
});
test('denies alternative gateway trust mode',()=>{
 const {ctx}=fixture();ctx.trust.mode='LIVE';
 assert.equal(verify(ctx).reason,'UNTRUSTED_OFFLINE_POLICY');
});
