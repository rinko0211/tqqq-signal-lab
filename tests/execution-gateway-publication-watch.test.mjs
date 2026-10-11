import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalPaperEvidence} from '../lib/execution-gateway-evidence.mjs';
import {observeOfficialCalendarPublications,OFFICIAL_PUBLIC_CALENDAR_URLS} from '../lib/execution-gateway-publication-watch.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
  const texts=['<!doctype html><title>NYSE Holidays</title><p>November 27 early close</p>',
    '<html><title>Nasdaq Calendar</title><p>December 24 1pm close</p></html>'];
  const reviewedAt='2026-10-11T00:00:00.000Z';
  const baseline={schemaVersion:1,type:'OFFLINE_CALENDAR_PUBLICATION_BASELINE',
    reviewedAt,validUntil:'2026-10-13T00:00:00.000Z',
    sources:OFFICIAL_PUBLIC_CALENDAR_URLS.map((url,i)=>({url,sha256:sha(texts[i])}))};
  const calls=[];
  let fn=async(url,opts)=>{
    calls.push({url,opts});
    const i=OFFICIAL_PUBLIC_CALENDAR_URLS.indexOf(url);
    if(i<0)throw new Error('forbidden');
    return new Response(texts[i],{status:200,headers:{'Content-Type':'text/html'}});
  };
  const args={observedAt:'2026-10-11T00:30:00.000Z',baseline,
    expectedBaselineSha256:sha(canonicalPaperEvidence(baseline)),fetchImpl:(...xs)=>fn(...xs),halted:false};
  return {args,baseline,texts,calls,setFetch:(f)=>fn=f};
}
const observe=a=>observeOfficialCalendarPublications(a);
test('unchanged two separately captured pages yields RESEARCH observation only',async()=>{
  const x=fixture(),out=await observe(x.args);
  assert.equal(out.status,'UNCHANGED_PUBLICATION_RESEARCH_ONLY');
  assert.equal(out.brokerOrderAllowed,false);assert.equal(out.executionAuthority,'NONE');
  assert.equal(out.officialMachineFeedApproved,false);
  assert.equal(out.observations.length,2);assert.ok(out.observations.every(z=>z.matchesReviewedBaseline));
  assert.deepEqual(x.calls.map(c=>c.url),OFFICIAL_PUBLIC_CALENDAR_URLS);
});
test('all requests use exact public URLs, GET, no redirect and no credentials',async()=>{
  const x=fixture();await observe(x.args);
  for(const c of x.calls){
    assert.equal(c.opts.method,'GET');
    assert.equal(c.opts.redirect,'error');
    assert.equal(c.opts.cache,'no-store');
    assert.equal(JSON.stringify(c.opts).includes('Authorization'),false);
  }
});
test('NYSE content byte change requires independent review, never auto-approval',async()=>{
 const x=fixture();x.texts[0]+='\nnotice updated';
 const r=await observe(x.args);assert.equal(r.status,'SOURCE_CHANGE_REVIEW_REQUIRED');
 assert.equal(r.officialMachineFeedApproved,false);
 assert.equal(r.observations[0].matchesReviewedBaseline,false);
 assert.equal(r.observations[1].matchesReviewedBaseline,true);
});
test('Nasdaq content byte change requires review too',async()=>{
 const x=fixture();x.texts[1]+=' ';
 const r=await observe(x.args);assert.equal(r.status,'SOURCE_CHANGE_REVIEW_REQUIRED');
 assert.equal(r.observations[1].matchesReviewedBaseline,false);
});
test('missing out-of-band baseline digest blocks before fetch',async()=>{
 const x=fixture();delete x.args.expectedBaselineSha256;
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
 assert.equal(x.calls.length,0);
});
test('tampered pinned source hash is rejected',async()=>{
 const x=fixture();x.args.baseline.sources[0].sha256='a'.repeat(64);
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
});
test('self-generated but mismatched baseline scope is rejected',async()=>{
 const x=fixture();x.args.baseline.sources[0].url='https://example.com/evil';
 x.args.expectedBaselineSha256=sha(canonicalPaperEvidence(x.args.baseline));
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
});
test('expired baseline denies without fetching',async()=>{
 const x=fixture();x.args.observedAt='2026-10-13T00:00:00.000Z';
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
 assert.equal(x.calls.length,0);
});
test('future-dated reviewedAt denies',async()=>{
 const x=fixture();x.args.baseline.reviewedAt='2026-10-12T00:00:00.000Z';
 x.args.expectedBaselineSha256=sha(canonicalPaperEvidence(x.args.baseline));
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
});
test('over-long review TTL fails closed',async()=>{
 const x=fixture();x.args.baseline.validUntil='2026-10-21T00:00:00.000Z';
 x.args.expectedBaselineSha256=sha(canonicalPaperEvidence(x.args.baseline));
 assert.equal((await observe(x.args)).reason,'MISSING_STALE_OR_UNPINNED_BASELINE');
});
test('halted true denies by default',async()=>{
 const x=fixture();x.args.halted=true;
 assert.equal((await observe(x.args)).reason,'GLOBAL_RESEARCH_HALT');
 assert.equal(x.calls.length,0);
});
test('omitted HALT evidence also denies',async()=>{
 const x=fixture();delete x.args.halted;
 assert.equal((await observe(x.args)).reason,'GLOBAL_RESEARCH_HALT');
});
test('missing fetch function rejected',async()=>{
 const x=fixture();x.args.fetchImpl=null;
 assert.equal((await observe(x.args)).reason,'HTTP_PROVIDER_UNAVAILABLE');
});
test('network outage does not use other source or cached content',async()=>{
 const x=fixture();x.setFetch(()=>{throw new Error('timeout');});
 assert.equal((await observe(x.args)).reason,'PUBLIC_SOURCE_FETCH_OR_BODY_FAILED');
});
test('HTTP redirect never followed',async()=>{
 const x=fixture();x.setFetch(()=>new Response('',{status:302,headers:{Location:'https://bad.example/'}}));
 assert.equal((await observe(x.args)).reason,'PUBLIC_SOURCE_UNAVAILABLE_OR_REDIRECTED');
});
test('HTTP 503 never falls back',async()=>{
 const x=fixture();x.setFetch(()=>new Response('outage',{status:503}));
 assert.equal((await observe(x.args)).reason,'PUBLIC_SOURCE_UNAVAILABLE_OR_REDIRECTED');
});
test('content-length exceeding cap rejected',async()=>{
 const x=fixture();x.setFetch(()=>new Response('small',{status:200,headers:{'content-length':'2000001'}}));
 assert.equal((await observe(x.args)).reason,'PUBLIC_SOURCE_TOO_LARGE');
});
test('actual response body over cap rejected',async()=>{
 const x=fixture();x.setFetch(()=>new Response('A'.repeat(2000001),{status:200}));
 assert.equal((await observe(x.args)).reason,'PUBLIC_SOURCE_FETCH_OR_BODY_FAILED');
});
test('empty successful page blocked rather than treated as calendar',async()=>{
 const x=fixture();x.setFetch(()=>new Response('',{status:200}));
 assert.equal((await observe(x.args)).reason,'EMPTY_PUBLIC_SOURCE');
});
test('invalid UTC observation time blocked',async()=>{
 const x=fixture();x.args.observedAt='October 11th';
 assert.equal((await observe(x.args)).reason,'INVALID_AUDIT_CLOCK');
});
test('source content matching cannot grant broker authority',async()=>{
 const x=fixture();
 for(const y of [await observe(x.args),await observe({...x.args,halted:true})]){
   assert.equal(y.executionAuthority,'NONE');assert.equal(y.brokerOrderAllowed,false);
 }
});
