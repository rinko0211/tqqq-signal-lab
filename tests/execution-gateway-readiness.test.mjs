import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessOfflineGatewayReadiness,inspectReadOnlyGatewayReadiness} from '../lib/execution-gateway-readiness.mjs';

const MAIN='b'.repeat(40),STATE='a'.repeat(40);
const ROOT='1'.repeat(40),PAGES='2'.repeat(40),PUBLIC='3'.repeat(40),DATA='4'.repeat(40);
const API='https://api.github.com/repos/rinko0211/tqqq-signal-lab';
const gitBlob = obj=>{
  const bytes=Buffer.from(JSON.stringify(obj));
  return {sha:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),
    content:bytes.toString('base64'),size:bytes.length};
};
const minimal=()=>{
  const generatedAt='2026-10-10T01:51:14.625Z';
  const signal={platformMode:'RESEARCH',state:'latest',assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',
    generatedAt,dataDate:'2026-10-09',
    signal:{date:'2026-10-09',target:1,executionDate:'2026-10-12'}};
  const status={actionStatus:'success',state:'latest',errors:[],generatedAt,
    marketDataDate:'2026-10-09',signalDate:'2026-10-09'};
  const production={schemaVersion:1,mode:'RESEARCH',selectedTicker:null,selectedStrategy:null,
    strategyVersion:null,approvedByHuman:false};
  const lifecycle={schemaVersion:1,current:{stage:'ACCUMULATING',systemDecision:'ACCUMULATING',
    userAction:'NONE',asOf:'2026-10-10',nextReview:'2027-02-25',
    candidateReviews:[{ticker:'TQQQ',version:'VS13-v1.0',incumbent:true,
      eligible:false,promotionSelectable:false,observations:34,liveObservations:34,
      missingRatio:0.02857142857142857,regimeCoverageOk:false,
      evidence:'Insufficient',reasons:['Missing/invalid ratio 2.86% > 1%']}]}};
  const phase5={status:'success',errors:[],generatedAt:'2026-10-10T17:50:20.745Z',
    summary:[],latestDates:{UPRO:'2026-10-09',SSO:'2026-10-09',QLD:'2026-10-09',
      SPY:'2026-10-09',QQQ:'2026-10-09',VIX:'2026-10-09'}};
  return {signal,status,production,lifecycle,phase5,observedAt:'2026-10-11T00:30:00.000Z'};
};
function mockServer(){
 const input=minimal();
 const files={
   'signal.json':input.signal,'status.json':input.status,
   'production-config.json':input.production,'lifecycle-review.json':input.lifecycle,
   'phase-5-forward-status.json':input.phase5
 };
 const map=new Map([
  ['/git/ref/heads/main',{ref:'refs/heads/main',object:{type:'commit',sha:MAIN}}],
  ['/git/ref/heads/ops-state',{ref:'refs/heads/ops-state',object:{type:'commit',sha:STATE}}],
  ['/git/commits/'+STATE,{sha:STATE,tree:{sha:ROOT}}],
  ['/git/trees/'+ROOT,{sha:ROOT,truncated:false,tree:[{path:'github-pages',type:'tree',mode:'040000',sha:PAGES}]}],
  ['/git/trees/'+PAGES,{sha:PAGES,truncated:false,tree:[{path:'public',type:'tree',mode:'040000',sha:PUBLIC}]}],
  ['/git/trees/'+PUBLIC,{sha:PUBLIC,truncated:false,tree:[{path:'data',type:'tree',mode:'040000',sha:DATA}]}]
 ]);
 const blobs=Object.fromEntries(Object.entries(files).map(([name,obj])=>[name,gitBlob(obj)]));
 map.set('/git/trees/'+DATA,{sha:DATA,truncated:false,tree:[
  {path:'signal.json',mode:'100644',type:'blob',sha:blobs['signal.json'].sha},
  {path:'status.json',mode:'100644',type:'blob',sha:blobs['status.json'].sha}
 ]});
 for(const name of ['signal.json','status.json']){
  map.set('/git/blobs/'+blobs[name].sha,{...blobs[name],encoding:'base64'});
 }
 for(const name of ['production-config.json','lifecycle-review.json','phase-5-forward-status.json']){
  const path='github-pages/public/data/'+name;
  map.set('/contents/'+path+'?ref='+STATE,{...blobs[name],type:'file',encoding:'base64',path});
 }
 const requests=[];
 const fetchImpl=async (url,opt)=>{
  assert.equal(opt.method,'GET');assert.equal(opt.redirect,'error');
  assert.equal(opt.cache,'no-store');assert.ok(url.startsWith(API+'/'));
  requests.push(url.slice(API.length));
  const obj=map.get(url.slice(API.length));
  return new Response(JSON.stringify(obj??{}),{status:obj?200:404,headers:{'Content-Type':'application/json'}});
 };
 return {input,files,blobs,map,requests,fetchImpl,expectedMainSha:MAIN,expectedStateSha:STATE,observedAt:input.observedAt};
}
const evaluate=input=>assessOfflineGatewayReadiness(input);
test('34 VS13 Forward observations cannot override 2.86% missing and regime gap',()=>{
  const r=evaluate(minimal());
  assert.equal(r.status,'CONTINUE_FORWARD_RESEARCH_ONLY');
  assert.equal(r.candidate.observations,34);
  assert.equal(r.candidate.missingRatioPct,2.8571);
  assert.equal(r.candidate.evidence,'Insufficient');
  assert.ok(r.reasonCodes.includes('FORWARD_MISSING_RATIO_ABOVE_ONE_PERCENT'));
  assert.ok(r.reasonCodes.includes('REGIME_COVERAGE_NOT_ESTABLISHED'));
  assert.ok(r.reasonCodes.includes('VS13_FORWARD_EVIDENCE_INSUFFICIENT'));
  assert.equal(r.brokerOrderAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.productionPromotionAllowed,false);
  assert.equal(r.executionAuthority,'NONE');
});
test('apparently sufficient strategy evidence NEVER turns into trade authority',()=>{
  const x=minimal(),c=x.lifecycle.current.candidateReviews[0];
  c.missingRatio=0;c.regimeCoverageOk=true;c.eligible=true;
  c.promotionSelectable=true;c.evidence='SUFFICIENT';c.reasons=[];
  const r=evaluate(x);
  assert.equal(r.status,'CONTINUE_FORWARD_RESEARCH_ONLY');
  assert.equal(r.reasonCodes.includes('FORWARD_MISSING_RATIO_ABOVE_ONE_PERCENT'),false);
  assert.ok(r.reasonCodes.includes('OFFICIAL_CALENDAR_ISSUER_UNAPPROVED'));
  assert.ok(r.reasonCodes.includes('C4_TEN_SESSION_CERTIFICATION_NOT_ESTABLISHED'));
  assert.equal(r.liveTradingAllowed,false);
});
test('unexpected human/Production promotion stops reporting as healthy',()=>{
  const x=minimal();x.production.approvedByHuman=true;
  assert.equal(evaluate(x).reasonCodes[0],'UNEXPECTED_PRODUCTION_AUTHORITY');
});
test('Production ticker selection without verified approval also blocks',()=>{
  const x=minimal();x.production.selectedTicker='TQQQ';
  assert.equal(evaluate(x).status,'HALT_RESEARCH_OBSERVATION');
});
test('disagreeing signal/status generation timestamps fail closed',()=>{
  const x=minimal();x.status.generatedAt='2026-10-09T01:00:00.000Z';
  assert.equal(evaluate(x).reasonCodes[0],'INVALID_OR_DISAGREEING_TQQQ_SIGNAL_STATUS');
});
test('missing upstream errors array fails closed',()=>{
  const x=minimal();delete x.status.errors;
  assert.equal(evaluate(x).reasonCodes[0],'INVALID_OR_DISAGREEING_TQQQ_SIGNAL_STATUS');
});
test('source errors fail closed',()=>{
  const x=minimal();x.status.errors.push('no data');
  assert.equal(evaluate(x).status,'HALT_RESEARCH_OBSERVATION');
});
test('future timestamp fails closed',()=>{
  const x=minimal();x.observedAt='2026-10-09T00:00:00.000Z';
  assert.equal(evaluate(x).reasonCodes[0],'SOURCE_SIGNAL_STALE_OR_FUTURE');
});
test('stale generation older than 120 hours fails closed',()=>{
  const x=minimal();x.observedAt='2026-10-20T00:00:00.000Z';
  assert.equal(evaluate(x).reasonCodes[0],'SOURCE_SIGNAL_STALE_OR_FUTURE');
});
test('candidate promotion fraud with missing lifecycle is not interpreted as ready',()=>{
  const x=minimal();x.lifecycle.current.stage='PRODUCTION';
  assert.equal(evaluate(x).reasonCodes[0],'LIFECYCLE_UNVERIFIED_OR_NOT_RESEARCH');
});
test('invalid negative or NaN missing ratio is rejected',()=>{
  for(const bad of [-1,Number.NaN,1.1]){
   const x=minimal();x.lifecycle.current.candidateReviews[0].missingRatio=bad;
   assert.equal(evaluate(x).reasonCodes[0],'CANDIDATE_EVIDENCE_INVALID');
  }
});
test('phase5 failure not hidden by successful daily signal',()=>{
  const x=minimal();x.phase5.status='failure';
  assert.equal(evaluate(x).reasonCodes[0],'PHASE5_FORWARD_HEALTH_UNVERIFIED');
});
test('phase5 future market dates fail closed',()=>{
  const x=minimal();x.phase5.latestDates.UPRO='2026-10-12';
  assert.equal(evaluate(x).reasonCodes[0],'PHASE5_FORWARD_HEALTH_UNVERIFIED');
});
test('lagging lifecycle not silently promoted',()=>{
  const x=minimal();x.lifecycle.current.asOf='2026-10-08';
  assert.equal(evaluate(x).reasonCodes[0],'LIFECYCLE_BEHIND_TQQQ_SIGNAL');
});
test('missing observation clock rejected',()=>{
  const x=minimal();delete x.observedAt;
  assert.equal(evaluate(x).reasonCodes[0],'INVALID_OBSERVATION_TIME');
});
test('pinned public GitHub object graph yields research report only',async()=>{
  const m=mockServer();
  const r=await inspectReadOnlyGatewayReadiness(m);
  assert.equal(r.status,'CONTINUE_FORWARD_RESEARCH_ONLY');
  assert.equal(r.inspectedVia,'PINNED_PUBLIC_GITHUB_READ_ONLY_API');
  assert.equal(r.anchoredStateSha,STATE);
  assert.equal(r.anchoredMainSha,MAIN);
  assert.equal(r.brokerOrderAllowed,false);
  assert.equal(m.requests.length,12);
  assert.ok(m.requests.every(x=>!x.includes('token')));
});
test('missing independent main pin makes zero HTTP requests',async()=>{
  const m=mockServer();delete m.expectedMainSha;
  const r=await inspectReadOnlyGatewayReadiness(m);
  assert.equal(r.reasonCodes[0],'OUT_OF_BAND_SHA_PINS_REQUIRED');
  assert.equal(m.requests.length,0);
});
test('drifting ops-state ref rejects pinned read-only report',async()=>{
  const m=mockServer();
  m.map.set('/git/ref/heads/ops-state',{ref:'refs/heads/ops-state',
    object:{type:'commit',sha:'c'.repeat(40)}});
  const r=await inspectReadOnlyGatewayReadiness(m);
  assert.equal(r.reasonCodes[0],'GITHUB_SOURCE_PROVENANCE_UNVERIFIED');
});
test('missing pinned lifecycle file returns HALT rather than claiming sufficient evidence',async()=>{
  const m=mockServer();m.map.delete('/contents/github-pages/public/data/lifecycle-review.json?ref='+STATE);
  assert.equal((await inspectReadOnlyGatewayReadiness(m)).reasonCodes[0],
    'PINNED_GITHUB_READINESS_SNAPSHOT_UNAVAILABLE');
});
test('tampered production blob with asserted old sha blocks provenance',async()=>{
  const m=mockServer();
  const path='/contents/github-pages/public/data/production-config.json?ref='+STATE;
  const body=m.map.get(path);
  body.content=Buffer.from('{"mode":"PRODUCTION"}').toString('base64');
  body.size=Buffer.from('{"mode":"PRODUCTION"}').length;
  assert.equal((await inspectReadOnlyGatewayReadiness(m)).reasonCodes[0],
    'PINNED_GITHUB_READINESS_SNAPSHOT_UNAVAILABLE');
});
test('actual Git SHA of forged unsafe Production still causes observation HALT',async()=>{
  const m=mockServer();
  const path='/contents/github-pages/public/data/production-config.json?ref='+STATE;
  const unsafe={...m.files['production-config.json'],approvedByHuman:true};
  m.map.set(path,{...gitBlob(unsafe),type:'file',encoding:'base64',
    path:'github-pages/public/data/production-config.json'});
  assert.equal((await inspectReadOnlyGatewayReadiness(m)).reasonCodes[0],
    'UNEXPECTED_PRODUCTION_AUTHORITY');
});
test('HTTP 503 on pinned JSON fails closed',async()=>{
  const m=mockServer();
  const orig=m.fetchImpl;
  m.fetchImpl=(u,o)=>u.includes('lifecycle-review.json')?
    new Response('outage',{status:503}):orig(u,o);
  assert.equal((await inspectReadOnlyGatewayReadiness(m)).reasonCodes[0],
    'PINNED_GITHUB_READINESS_SNAPSHOT_UNAVAILABLE');
});
test('all statuses prohibit orders and Promotion even on untrusted input',async()=>{
  const reports=[evaluate(minimal()),evaluate({}),await inspectReadOnlyGatewayReadiness(mockServer())];
  for(const r of reports){
    assert.equal(r.executionAuthority,'NONE');
    assert.equal(r.brokerOrderAllowed,false);
    assert.equal(r.productionPromotionAllowed,false);
    assert.equal(r.liveTradingAllowed,false);
  }
});
