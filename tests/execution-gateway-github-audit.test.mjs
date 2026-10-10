import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {inspectGitHubReadOnlyEvidence,corroborateReadOnlySourceWithOfflineProof} from '../lib/execution-gateway-github-audit.mjs';
import {canonicalPaperEvidence} from '../lib/execution-gateway-evidence.mjs';

const API='https://api.github.com/repos/rinko0211/tqqq-signal-lab';
const H=s=>s.repeat(40);
const MAIN=H('b'),STATE=H('a'),ROOT=H('1'),PAGES=H('2'),PUBLIC=H('3'),DATA=H('4');
const shaBlob=content=>{
 const b=Buffer.from(JSON.stringify(content),'utf8');
 return {sha:createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex'),
         size:b.length,encoding:'base64',content:b.toString('base64')};
};
function mockGitHub(){
 const now='2026-10-10T01:51:14.625Z';
 const signal={generatedAt:now,dataDate:'2026-10-09',platformMode:'RESEARCH',state:'latest',
  assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',
  signal:{date:'2026-10-09',target:0.25,executionDate:'2026-10-12'}};
 const status={generatedAt:now,marketDataDate:'2026-10-09',signalDate:'2026-10-09',
  actionStatus:'success',state:'latest',errors:[],buildVersion:'7d61b075c96a'};
 const sb=shaBlob(signal),tb=shaBlob(status);
 const map=new Map(Object.entries({
  '/git/ref/heads/main':{ref:'refs/heads/main',object:{type:'commit',sha:MAIN}},
  '/git/ref/heads/ops-state':{ref:'refs/heads/ops-state',object:{type:'commit',sha:STATE}},
  ['/git/commits/'+STATE]:{sha:STATE,tree:{sha:ROOT}},
  ['/git/trees/'+ROOT]:{sha:ROOT,truncated:false,tree:[{path:'github-pages',type:'tree',mode:'040000',sha:PAGES}]},
  ['/git/trees/'+PAGES]:{sha:PAGES,truncated:false,tree:[{path:'public',type:'tree',mode:'040000',sha:PUBLIC}]},
  ['/git/trees/'+PUBLIC]:{sha:PUBLIC,truncated:false,tree:[{path:'data',type:'tree',mode:'040000',sha:DATA}]},
  ['/git/trees/'+DATA]:{sha:DATA,truncated:false,tree:[
    {path:'signal.json',type:'blob',mode:'100644',sha:sb.sha},
    {path:'status.json',type:'blob',mode:'100644',sha:tb.sha}]},
  ['/git/blobs/'+sb.sha]:sb,
  ['/git/blobs/'+tb.sha]:tb
 }));
 const requests=[];
 const fetchImpl=async (url,opts)=>{
   assert.equal(opts.method,'GET');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.cache,'no-store');
   assert.ok(url.startsWith(API+'/'));
   requests.push(url.slice(API.length));
   const entry=map.get(url.slice(API.length));
   if(!entry)return new Response('{}',{status:404});
   return new Response(JSON.stringify(entry),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return {signal,status,sb,tb,map,requests,fetchImpl,expectedMainSha:MAIN,expectedStateSha:STATE};
}
const inspect=m=>inspectGitHubReadOnlyEvidence(m);
test('GitHub API evidence walks exact pinned commit/tree/blob objects, no authority',async()=>{
 const m=mockGitHub(), r=await inspect(m);
 assert.equal(r.status,'READ_ONLY_OBSERVED');assert.equal(r.snapshot.stateSha,STATE);
 assert.equal(r.snapshot.currentMainSha,MAIN);
 assert.equal(r.snapshot.signalBlobSha,m.sb.sha);assert.equal(r.snapshot.statusBlobSha,m.tb.sha);
 assert.deepEqual(r.snapshot.signal,m.signal);assert.deepEqual(r.snapshot.status,m.status);
 assert.equal(r.snapshot.signerAuthority,'NONE');
 assert.equal(r.snapshot.officialExchangeCalendarVerified,false);
 assert.equal(r.brokerOrderAllowed,false);assert.equal(r.executionAuthority,'NONE');
 assert.equal(m.requests.length,9);
});
test('refuse missing external SHA pin before any GitHub call',async()=>{
 const m=mockGitHub();delete m.expectedStateSha;
 const r=await inspect(m);assert.equal(r.reason,'OUT_OF_BAND_SHA_PINS_REQUIRED');
 assert.equal(m.requests.length,0);
});
test('refuse changed main branch even if state data is unchanged',async()=>{
 const m=mockGitHub();
 m.map.set('/git/ref/heads/main',{ref:'refs/heads/main',object:{type:'commit',sha:H('c')}});
 assert.equal((await inspect(m)).reason,'BRANCH_SHA_PIN_MISMATCH');
});
test('refuse changed ops-state ref rather than auto-follow it',async()=>{
 const m=mockGitHub();
 m.map.set('/git/ref/heads/ops-state',{ref:'refs/heads/ops-state',object:{type:'commit',sha:H('c')}});
 assert.equal((await inspect(m)).reason,'BRANCH_SHA_PIN_MISMATCH');
});
test('reject commit tree SHA that is not a full SHA-1',async()=>{
 const m=mockGitHub();m.map.set('/git/commits/'+STATE,{sha:STATE,tree:{sha:'short'}});
 assert.equal((await inspect(m)).reason,'STATE_COMMIT_MISMATCH');
});
test('reject mismatched API tree identifier',async()=>{
 const m=mockGitHub();
 m.map.set('/git/trees/'+ROOT,{sha:H('f'),truncated:false,tree:[{path:'github-pages',type:'tree',mode:'040000',sha:PAGES}]});
 assert.equal((await inspect(m)).reason,'TREE_SHA_MISMATCH');
});
test('reject truncated tree, no fallback or guess',async()=>{
 const m=mockGitHub();
 m.map.get('/git/trees/'+DATA).truncated=true;
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('reject symlinked or wrong-mode signal',async()=>{
 const m=mockGitHub();
 m.map.get('/git/trees/'+DATA).tree[0].mode='120000';
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('reject ambiguous duplicate signal tree entry',async()=>{
 const m=mockGitHub();
 m.map.get('/git/trees/'+DATA).tree.push({...m.map.get('/git/trees/'+DATA).tree[0]});
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('reject fabricated blob even if GitHub metadata claims same SHA',async()=>{
 const m=mockGitHub(),b=m.map.get('/git/blobs/'+m.sb.sha);
 b.content=Buffer.from('{"forged":true}').toString('base64');b.size=15;
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('reject bad upstream status despite intact git object hashes',async()=>{
 const m=mockGitHub();
 const oldSha=m.tb.sha;
 const status={...m.status,actionStatus:'failure'};
 const blob=shaBlob(status);
 m.map.delete('/git/blobs/'+oldSha);
 m.map.set('/git/blobs/'+blob.sha,blob);
 m.map.get('/git/trees/'+DATA).tree[1].sha=blob.sha;
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('fail closed on unavailable public GitHub API',async()=>{
 const m=mockGitHub();m.map.delete('/git/trees/'+PUBLIC);
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('reject network exception without fallback',async()=>{
 const m=mockGitHub();m.fetchImpl=async()=>{throw Error('offline');};
 assert.equal((await inspect(m)).reason,'GITHUB_PROVENANCE_UNVERIFIED');
});
test('no external signed proof means observation is not independently corroborated',async()=>{
 const m=mockGitHub(),ob=await inspect(m);
 const c=corroborateReadOnlySourceWithOfflineProof({inspection:ob});
 assert.equal(c.status,'REJECTED');assert.equal(c.brokerOrderAllowed,false);
});
const key=()=>generateKeyPairSync('ed25519');
const pem=k=>k.export({format:'pem',type:'spki'}).toString();
const fingerprint=k=>createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
const signed=(kind,payload,key)=>({payload,signature:sign(null,Buffer.from(
 'TQQQ-PAPER-GATEWAY-V2:'+kind+':'+canonicalPaperEvidence(payload),'utf8'),key).toString('base64')});
function offlineProof(observation){
 const signer=key(),calendar=key(),{signal,status}=observation.snapshot;
 const session={completedDataDate:'2026-10-09',nextLegalOpenDate:'2026-10-12'};
 const input={observedAt:'2026-10-10T09:00:00.000Z',signal,status,session};
 const origin={repository:'rinko0211/tqqq-signal-lab',branch:'ops-state',
  stateSha:STATE,codeSha:MAIN};
 const sp={schemaVersion:2,mode:'PAPER_ONLY',origin,signal,status,session,
  expiresAt:'2026-10-11T00:00:00.000Z'};
 const cp={schemaVersion:2,mode:'PAPER_ONLY',exchange:'XNYS',
  sourceLabel:'OFFLINE_CALENDAR_FIXTURE',coverageStart:'2026-10-08',coverageEnd:'2026-10-15',
  sessions:['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15'],
  expiresAt:'2026-10-14T00:00:00.000Z'};
 const trust={mode:'PAPER_ONLY',repository:origin.repository,branch:origin.branch,
  expectedStateSha:STATE,expectedCodeSha:MAIN,
  signalKeyPem:pem(signer.publicKey),calendarKeyPem:pem(calendar.publicKey),
  signalKeyFingerprint:fingerprint(signer.publicKey),
  calendarKeyFingerprint:fingerprint(calendar.publicKey)};
 return {input,trust,signalProof:signed('SIGNAL',sp,signer.privateKey),
  calendarProof:signed('CALENDAR',cp,calendar.privateKey)};
}
test('offline signed proof can corroborate verified GitHub blobs but never authorize trading',async()=>{
 const m=mockGitHub(),inspection=await inspect(m);
 const proofArgs=offlineProof(inspection);
 const x=corroborateReadOnlySourceWithOfflineProof({inspection,proofArgs});
 assert.equal(x.status,'CORROBORATED_RESEARCH_ONLY');
 assert.equal(x.brokerOrderAllowed,false);assert.equal(x.executionAuthority,'NONE');
});
test('genuine signed proof bound to a different state cannot corroborate GitHub observation',async()=>{
 const m=mockGitHub(),inspection=await inspect(m),proofArgs=offlineProof(inspection);
 inspection.snapshot.stateSha=H('c'); // test mutates newly allocated snapshot without private authority
 assert.equal(corroborateReadOnlySourceWithOfflineProof({inspection,proofArgs}).reason,'SIGNED_GITHUB_CONTENT_MISMATCH');
});
test('injected changed input with detached proof cannot corroborate',async()=>{
 const m=mockGitHub(),inspection=await inspect(m),proofArgs=offlineProof(inspection);
 proofArgs.input.signal={...proofArgs.input.signal,signal:{...proofArgs.input.signal.signal,target:1}};
 const x=corroborateReadOnlySourceWithOfflineProof({inspection,proofArgs});
 assert.equal(x.status,'REJECTED');assert.equal(x.reason,'SIGNED_SOURCE_INPUT_MISMATCH');
});
