/**
 * Gateway v6 — read-only operational-readiness diagnosis, NEVER a trade gate.
 * No broker, credentials, writes, schedules, orders or Production promotion.
 * Requires independently pinned immutable main/ops-state SHAs.
 */
import {createHash} from 'node:crypto';
import {inspectGitHubReadOnlyEvidence} from './execution-gateway-github-audit.mjs';

const API='https://api.github.com/repos/rinko0211/tqqq-signal-lab';
const SHA40=/^[a-f0-9]{40}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const EXTRA=Object.freeze(['production-config.json','lifecycle-review.json','phase-5-forward-status.json']);
const safeTime=x=>typeof x==='string'&&ISO.test(x)&&Number.isFinite(Date.parse(x));
const safeDate=x=>typeof x==='string'&&DATE.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const fail=(reason)=>({status:'HALT_RESEARCH_OBSERVATION',reasonCodes:[reason],
  brokerOrderAllowed:false,executionAuthority:'NONE',productionPromotionAllowed:false,
  liveTradingAllowed:false,sourceIndependentOfOperator:false});
const gitSha=body=>createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
function validPair(signal,status){
  return signal?.platformMode==='RESEARCH' && signal?.state==='latest' &&
    signal.assetTicker==='TQQQ' && signal.strategyVersion==='VS13-v1.0' &&
    status?.actionStatus==='success'&&status?.state==='latest'&&
    Array.isArray(status.errors)&&status.errors.length===0 &&
    safeDate(signal.dataDate)&&signal.dataDate===signal.signal?.date &&
    signal.dataDate===status.marketDataDate&&status.signalDate===signal.dataDate &&
    safeTime(signal.generatedAt)&&signal.generatedAt===status.generatedAt;
}
function reasonList(candidate){
  return candidate?.reasons?.filter(x=>typeof x==='string'&&x.length>0).slice(0,12)??[];
}
/**
 * Deterministic readiness report. Caller-supplied objects alone are NOT an
 * authenticated source; the wrapper below binds each JSON to pinned Git SHA.
 * Operationally healthy does NOT mean sufficient forward evidence.
 */
export function assessOfflineGatewayReadiness({signal,status,production,lifecycle,phase5,observedAt}={}){
  try{
    if(!safeTime(observedAt))return fail('INVALID_OBSERVATION_TIME');
    const now=Date.parse(observedAt);
    if(!validPair(signal,status))return fail('INVALID_OR_DISAGREEING_TQQQ_SIGNAL_STATUS');
    if(Date.parse(signal.generatedAt)>now||now-Date.parse(signal.generatedAt)>120*3600_000)
      return fail('SOURCE_SIGNAL_STALE_OR_FUTURE');
    if(!production||production.schemaVersion!==1||production.mode!=='RESEARCH'||
       production.approvedByHuman!==false||production.selectedTicker!==null||
       production.selectedStrategy!==null||production.strategyVersion!==null)
      return fail('UNEXPECTED_PRODUCTION_AUTHORITY');
    if(!lifecycle||lifecycle.schemaVersion!==1||lifecycle.current?.stage!=='ACCUMULATING'||
       lifecycle.current?.systemDecision!=='ACCUMULATING'||
       lifecycle.current?.userAction!=='NONE'||
       !safeDate(lifecycle.current.asOf)||
       !Array.isArray(lifecycle.current.candidateReviews))
      return fail('LIFECYCLE_UNVERIFIED_OR_NOT_RESEARCH');
    const candidate=lifecycle.current.candidateReviews.find(x=>
      x?.ticker==='TQQQ'&&x?.version==='VS13-v1.0'&&x.incumbent===true);
    if(!candidate||!Number.isSafeInteger(candidate.observations)||candidate.observations<0||
       !Number.isSafeInteger(candidate.liveObservations)||candidate.liveObservations<0||
       candidate.liveObservations>candidate.observations||
       typeof candidate.missingRatio!=='number'||!Number.isFinite(candidate.missingRatio)||
       candidate.missingRatio<0||candidate.missingRatio>1||
       typeof candidate.eligible!=='boolean'||
       typeof candidate.promotionSelectable!=='boolean'||
       !Array.isArray(candidate.reasons))
      return fail('CANDIDATE_EVIDENCE_INVALID');
    if(!phase5||phase5.status!=='success'||!safeTime(phase5.generatedAt)||
       Date.parse(phase5.generatedAt)>now||now-Date.parse(phase5.generatedAt)>120*3600_000||
       !Array.isArray(phase5.errors)||phase5.errors.length!==0||
       !phase5.latestDates||!Array.isArray(phase5.summary)||
       !['UPRO','SSO','QLD','SPY','QQQ','VIX'].every(k=>
          safeDate(phase5.latestDates[k])&&phase5.latestDates[k]<=signal.dataDate))
      return fail('PHASE5_FORWARD_HEALTH_UNVERIFIED');
    if(lifecycle.current.asOf<signal.dataDate) return fail('LIFECYCLE_BEHIND_TQQQ_SIGNAL');
    const missingRatioPct=Number((candidate.missingRatio*100).toFixed(4));
    const blockers=[];
    if(candidate.missingRatio>0.01)blockers.push('FORWARD_MISSING_RATIO_ABOVE_ONE_PERCENT');
    if(candidate.regimeCoverageOk!==true)blockers.push('REGIME_COVERAGE_NOT_ESTABLISHED');
    if(String(candidate.evidence).toUpperCase()!=='SUFFICIENT'||
       candidate.eligible!==true||candidate.promotionSelectable!==true)
      blockers.push('VS13_FORWARD_EVIDENCE_INSUFFICIENT');
    for(const reason of reasonList(candidate)) {
      if(!blockers.includes('UPSTREAM_CANDIDATE_REASON_RECORDED'))blockers.push('UPSTREAM_CANDIDATE_REASON_RECORDED');
    }
    // These are mandatory independent controls, NOT inferred from healthy
    // signal generation or offline-fixture signature simulations.
    blockers.push('OFFICIAL_CALENDAR_ISSUER_UNAPPROVED');
    blockers.push('OPERATOR_INDEPENDENT_SIGNER_NOT_ENROLLED');
    blockers.push('BROKER_READ_ONLY_RECONCILIATION_NOT_CERTIFIED');
    blockers.push('C4_TEN_SESSION_CERTIFICATION_NOT_ESTABLISHED');
    blockers.push('HUMAN_PRODUCTION_APPROVAL_ABSENT');
    return {
      status:'CONTINUE_FORWARD_RESEARCH_ONLY',
      reasonCodes:blockers,
      operationalSources:'REPORTED_HEALTHY_NOT_INDEPENDENT_MARKET_ATTESTATION',
      signalDate:signal.dataDate,
      generatedAt:signal.generatedAt,
      phase5GeneratedAt:phase5.generatedAt,
      candidate:{
        version:'VS13-v1.0',observations:candidate.observations,
        liveObservations:candidate.liveObservations,missingRatioPct,
        regimeCoverageOk:candidate.regimeCoverageOk===true,
        eligible:candidate.eligible,promotionSelectable:candidate.promotionSelectable,
        evidence:candidate.evidence,upstreamReasons:reasonList(candidate),
        nextFormalReview:lifecycle.current.nextReview??null
      },
      brokerOrderAllowed:false,executionAuthority:'NONE',
      productionPromotionAllowed:false,liveTradingAllowed:false,
      sourceIndependentOfOperator:false
    };
  } catch {return fail('MALFORMED_READINESS_INPUT');}
}
async function fetchPinnedJson(fetchImpl,file,sha){
  const url=API+'/contents/github-pages/public/data/'+file+'?ref='+sha;
  const response=await fetchImpl(url,{
    method:'GET',redirect:'error',cache:'no-store',
    headers:{Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2026-03-10',
      'User-Agent':'TQQQ-ReadOnly-Readiness'}
  });
  if(!response||response.status!==200||response.ok!==true||
     (response.url&&response.url!==url))throw Error('PINNED_CONTENTS_UNAVAILABLE');
  const length=response.headers?.get?.('content-length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>350000))throw Error('BODY_SIZE_REJECTED');
  const raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>350000)throw Error('BODY_SIZE_REJECTED');
  const o=JSON.parse(raw);
  if(o?.type!=='file'||o.path!=='github-pages/public/data/'+file||
     o.encoding!=='base64'||!SHA40.test(o.sha)||typeof o.content!=='string'||
     !Number.isSafeInteger(o.size)||o.size<1||o.size>200000)
    throw Error('UNTRUSTED_CONTENT_METADATA');
  const base64=o.content.replace(/\s/g,'');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('INVALID_CONTENT_ENCODING');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length!==o.size||bytes.toString('base64')!==base64||
     gitSha(bytes)!==o.sha)throw Error('GIT_CONTENTS_HASH_MISMATCH');
  return JSON.parse(bytes.toString('utf8'));
}
/**
 * Manual read-only report, shares the v3 source/status proof. All other
 * files are fetched at the SAME pinned immutable ops-state commit, checked
 * against their advertised actual Git blob hashes.
 */
export async function inspectReadOnlyGatewayReadiness({
  expectedMainSha,expectedStateSha,observedAt,fetchImpl=globalThis.fetch
}={}){
  if(!SHA40.test(expectedMainSha)||!SHA40.test(expectedStateSha))
    return fail('OUT_OF_BAND_SHA_PINS_REQUIRED');
  if(!safeTime(observedAt))return fail('INVALID_OBSERVATION_TIME');
  try{
    const inspector=await inspectGitHubReadOnlyEvidence({
      expectedMainSha,expectedStateSha,fetchImpl
    });
    if(inspector.status!=='READ_ONLY_OBSERVED'||inspector.snapshot?.stateSha!==expectedStateSha)
      return fail('GITHUB_SOURCE_PROVENANCE_UNVERIFIED');
    const [production,lifecycle,phase5]=await Promise.all(
      EXTRA.map(file=>fetchPinnedJson(fetchImpl,file,expectedStateSha))
    );
    const outcome=assessOfflineGatewayReadiness({
      signal:inspector.snapshot.signal,status:inspector.snapshot.status,
      production,lifecycle,phase5,observedAt
    });
    return {...outcome,
      anchoredStateSha:expectedStateSha,anchoredMainSha:expectedMainSha,
      inspectedVia:'PINNED_PUBLIC_GITHUB_READ_ONLY_API',
      independentCalendarAuthority:false,
      brokerOrderAllowed:false,executionAuthority:'NONE',
      productionPromotionAllowed:false,liveTradingAllowed:false
    };
  }catch{return fail('PINNED_GITHUB_READINESS_SNAPSHOT_UNAVAILABLE');}
}
