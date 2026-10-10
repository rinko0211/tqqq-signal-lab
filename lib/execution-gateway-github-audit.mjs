/**
 * Execution Gateway v3 — manually invoked read-only GitHub provenance inspection.
 *
 * Reads only fixed, public GitHub REST endpoints. No repository writes,
 * scheduling, wallet, broker I/O, secrets, Production promotion or orders.
 * GitHub is an independent API observer of *this repository's state*, not a
 * separate market-data issuer and not a cryptographic assertion by Nasdaq/NYSE.
 */
import { createHash } from 'node:crypto';
import { canonicalPaperEvidence, verifyOfflinePaperEvidence } from './execution-gateway-evidence.mjs';

const API='https://api.github.com/repos/rinko0211/tqqq-signal-lab';
const REPO='rinko0211/tqqq-signal-lab';
const SHA=/^[a-f0-9]{40}$/;
const PATH='github-pages/public/data';
const HEADERS=Object.freeze({
  'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2026-03-10',
  'User-Agent':'TQQQ-Gateway-ReadOnly-Audit'
});
const deny=reason=>({status:'REJECTED',reason,brokerOrderAllowed:false,executionAuthority:'NONE',snapshot:null});

const blobSha=body=>{
  const header=Buffer.from('blob '+body.length+'\0','utf8');
  return createHash('sha1').update(header).update(body).digest('hex');
};
const basicSha=x=>typeof x==='string'&&SHA.test(x);
async function request(fetchImpl,path){
  if(typeof fetchImpl!=='function')throw Error('MISSING_FETCH');
  if(!/^\/(git\/ref\/heads\/(main|ops-state)|git\/commits\/[a-f0-9]{40}|git\/trees\/[a-f0-9]{40}|git\/blobs\/[a-f0-9]{40})$/.test(path))throw Error('FORBIDDEN_API_PATH');
  const url=API+path;
  const response=await fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',headers:HEADERS});
  if(!response||response.status!==200||response.ok!==true||(response.url&&response.url!==url))
    throw Error('READ_ONLY_GITHUB_API_UNAVAILABLE');
  const raw=await response.text();
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>1_000_000)throw Error('API_RESPONSE_TOO_LARGE');
  const obj=JSON.parse(raw);
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('UNEXPECTED_RESPONSE');
  return obj;
}
const treeNode=(obj,name,type,mode)=>{
  if(!obj||obj.truncated!==false||!Array.isArray(obj.tree)||obj.tree.length>5000)throw Error('TRUNCATED_OR_BAD_TREE');
  const entries=obj.tree.filter(x=>x?.path===name);
  if(entries.length!==1 || entries[0]?.type!==type || entries[0]?.mode!==mode||!basicSha(entries[0]?.sha))
    throw Error('INVALID_TREE_ENTRY');
  return entries[0].sha;
};
async function loadBlob(fetchImpl,sha){
  const b=await request(fetchImpl,'/git/blobs/'+sha);
  if(b.sha!==sha || b.encoding!=='base64'||typeof b.content!=='string'||
     !Number.isSafeInteger(b.size)||b.size<0||b.size>128_000)throw Error('INVALID_BLOB_METADATA');
  const raw=b.content.replace(/\s/g,'');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error('INVALID_BASE64');
  const bytes=Buffer.from(raw,'base64');
  if(bytes.length!==b.size||bytes.toString('base64')!==raw||blobSha(bytes)!==sha)
    throw Error('GIT_BLOB_INTEGRITY_FAIL');
  return JSON.parse(bytes.toString('utf8'));
}
function checkPair(signal,status) {
  if(!signal||!status||signal.platformMode!=='RESEARCH'||signal.state!=='latest'||
     status.actionStatus!=='success'||status.state!=='latest'||
     !Array.isArray(status.errors)||status.errors.length!==0||
     typeof signal.generatedAt!=='string'||!Number.isFinite(Date.parse(signal.generatedAt))||
     signal.generatedAt!==status.generatedAt||
     signal.dataDate!==status.marketDataDate||signal.signal?.date!==status.signalDate||
     signal.assetTicker!=='TQQQ'||signal.strategyVersion!=='VS13-v1.0'||
     typeof signal.signal?.executionDate!=='string')throw Error('SIGNAL_STATUS_PAIR_INVALID');
}

/**
 * expectedMainSha and expectedStateSha MUST be pinned independently, out of
 * band, before this call; not obtained from returned request data.
 * A changed ref is rejected rather than automatically accepted.
 */
export async function inspectGitHubReadOnlyEvidence({expectedMainSha,expectedStateSha,fetchImpl=globalThis.fetch}={}) {
  if(!basicSha(expectedMainSha)||!basicSha(expectedStateSha))
    return deny('OUT_OF_BAND_SHA_PINS_REQUIRED');
  try {
    const main=await request(fetchImpl,'/git/ref/heads/main');
    const state=await request(fetchImpl,'/git/ref/heads/ops-state');
    if(main.ref!=='refs/heads/main'||main.object?.type!=='commit'||
       main.object.sha!==expectedMainSha||
       state.ref!=='refs/heads/ops-state'||state.object?.type!=='commit'||
       state.object.sha!==expectedStateSha)return deny('BRANCH_SHA_PIN_MISMATCH');

    const commit=await request(fetchImpl,'/git/commits/'+expectedStateSha);
    if(commit.sha!==expectedStateSha||!basicSha(commit.tree?.sha))return deny('STATE_COMMIT_MISMATCH');
    let tree=commit.tree.sha;
    for(const segment of ['github-pages','public','data']){
      const t=await request(fetchImpl,'/git/trees/'+tree);
      if(t.sha!==tree)return deny('TREE_SHA_MISMATCH');
      tree=treeNode(t,segment,'tree','040000');
    }
    const dataTree=await request(fetchImpl,'/git/trees/'+tree);
    if(dataTree.sha!==tree)return deny('TREE_SHA_MISMATCH');
    const signalBlobSha=treeNode(dataTree,'signal.json','blob','100644');
    const statusBlobSha=treeNode(dataTree,'status.json','blob','100644');
    const signal=await loadBlob(fetchImpl,signalBlobSha);
    const status=await loadBlob(fetchImpl,statusBlobSha);
    checkPair(signal,status);
    const snapshot=Object.freeze({
      schemaVersion:1,source:'READ_ONLY_PUBLIC_GITHUB_API',repository:REPO,
      stateBranch:'ops-state',stateSha:expectedStateSha,
      currentMainSha:expectedMainSha,signalBlobSha,statusBlobSha,
      signal,status,
      // Recording this is NOT a proof that current main generated the signal:
      reportedGenerationCodePrefix:status.buildVersion??null,
      signerAuthority:'NONE',officialExchangeCalendarVerified:false,
      brokerOrderAllowed:false,executionAuthority:'NONE'
    });
    return {status:'READ_ONLY_OBSERVED',reason:'GIT_OBJECTS_AND_BLOBS_CROSS_CHECKED',
      brokerOrderAllowed:false,executionAuthority:'NONE',snapshot};
  } catch {
    return deny('GITHUB_PROVENANCE_UNVERIFIED');
  }
}
/**
 * Cross-check the read-only GitHub observations with TWO independently
 * pinned signed PAPER fixture assertions in v2. No key enrollment occurs here.
 * This is still not an official vendor attestation or tradable instruction.
 */
export function corroborateReadOnlySourceWithOfflineProof({inspection,proofArgs}={}) {
  const fail=reason=>({status:'REJECTED',reason,brokerOrderAllowed:false,executionAuthority:'NONE'});
  try {
    const s=inspection?.snapshot;
    if(inspection?.status!=='READ_ONLY_OBSERVED'||s?.source!=='READ_ONLY_PUBLIC_GITHUB_API'||
       s.signerAuthority!=='NONE'||s.brokerOrderAllowed!==false||
       s.officialExchangeCalendarVerified!==false)return fail('UNVERIFIED_GITHUB_INSPECTION');
    const proof=verifyOfflinePaperEvidence(proofArgs);
    if(proof.status!=='VERIFIED_PAPER_EVIDENCE')return fail(proof.reason);
    const p=proofArgs.signalProof.payload;
    if(p.origin.stateSha!==s.stateSha||p.origin.codeSha!==s.currentMainSha||
       canonicalPaperEvidence(p.signal)!==canonicalPaperEvidence(s.signal)||
       canonicalPaperEvidence(p.status)!==canonicalPaperEvidence(s.status))
      return fail('SIGNED_GITHUB_CONTENT_MISMATCH');
    return {status:'CORROBORATED_RESEARCH_ONLY',reason:'GITHUB_OBSERVATION_MATCHES_OFFLINE_SIGNED_FIXTURE',
      brokerOrderAllowed:false,executionAuthority:'NONE'};
  } catch {return fail('CORROBORATION_UNVERIFIED');}
}
