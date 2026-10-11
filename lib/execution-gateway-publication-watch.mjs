/**
 * Gateway v5: manual, read-only PUBLICATION CHANGE WATCH.
 * Compare exact HTTP response bytes for two official public URLs with a
 * separately pinned, previously reviewed baseline. No HTML scraping/parsing.
 *
 * A byte change is a research ALERT, never permission to update a calendar,
 * approve an issuer, or issue a PAPER/real broker order.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {canonicalPaperEvidence} from './execution-gateway-evidence.mjs';

const URLS=Object.freeze([
  'https://www.nyse.com/trade/hours-calendars',
  'https://www.nasdaqtrader.com/Trader.aspx?id=Calendar'
]);
export const OFFICIAL_PUBLIC_CALENDAR_URLS=URLS;
const SHA=/^[a-f0-9]{64}$/;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_BYTES=2_000_000;
const digest=s=>createHash('sha256').update(s).digest('hex');
const time=s=>typeof s==='string'&&ISO.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const reject=reason=>({status:'REJECTED',reason,executionAuthority:'NONE',brokerOrderAllowed:false,
  officialMachineFeedApproved:false,observations:[]});
const sameHash=(a,b)=>SHA.test(a)&&SHA.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const equalKeys=(a,keys)=>a&&typeof a==='object'&&!Array.isArray(a)&&
  Object.keys(a).length===keys.length&&keys.every(k=>Object.hasOwn(a,k));

async function readBounded(stream) {
  if(!stream||typeof stream.getReader!=='function')throw new Error('NO_BODY_STREAM');
  const reader=stream.getReader();
  let n=0;const parts=[];
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw new Error('BAD_STREAM_CHUNK');
      n+=value.byteLength;
      if(n>MAX_BYTES)throw new Error('SOURCE_TOO_LARGE');
      parts.push(Buffer.from(value));
    }
  } finally {reader.releaseLock();}
  return Buffer.concat(parts,n);
}
function validBaseline(b,now,pin){
  try{
    if(!SHA.test(pin)||!b||!equalKeys(b,['schemaVersion','type','reviewedAt','validUntil','sources'])||
       b.schemaVersion!==1||b.type!=='OFFLINE_CALENDAR_PUBLICATION_BASELINE'||
       !time(b.reviewedAt)||!time(b.validUntil)||
       Date.parse(b.reviewedAt)>Date.parse(now)||Date.parse(b.validUntil)<=Date.parse(now)||
       Date.parse(b.validUntil)-Date.parse(b.reviewedAt)>7*86400_000||
       !Array.isArray(b.sources)||b.sources.length!==2 ||
       !b.sources.every((x,i)=>equalKeys(x,['url','sha256'])&&x.url===URLS[i]&&SHA.test(x.sha256)))return false;
    const hash=digest(canonicalPaperEvidence(b));
    return sameHash(hash,pin);
  }catch{return false;}
}
/** Strictly manual, no timer, no GitHub Actions workflow, no polling. */
export async function observeOfficialCalendarPublications({
  observedAt,baseline,expectedBaselineSha256,fetchImpl=globalThis.fetch,halted
}={}){
  if(halted!==false)return reject('GLOBAL_RESEARCH_HALT');
  if(!time(observedAt))return reject('INVALID_AUDIT_CLOCK');
  if(!validBaseline(baseline,observedAt,expectedBaselineSha256))
    return reject('MISSING_STALE_OR_UNPINNED_BASELINE');
  if(typeof fetchImpl!=='function')return reject('HTTP_PROVIDER_UNAVAILABLE');
  const observations=[];
  try{
    for(const source of baseline.sources){
      // Exactly two hard-coded hosts. Reject all HTTP redirects, no fallback,
      // no credentials, and no transitive URL fetching.
      const r=await fetchImpl(source.url,{
        method:'GET',redirect:'error',cache:'no-store',
        headers:{'Accept':'text/html','User-Agent':'TQQQ-Paper-Research-Calendar-Watch'}
      });
      if(!r||r.status!==200||r.ok!==true||(r.url&&r.url!==source.url))
        return reject('PUBLIC_SOURCE_UNAVAILABLE_OR_REDIRECTED');
      const len=r.headers?.get?.('content-length');
      if(len!=null&&(!/^\d+$/.test(len)||Number(len)>MAX_BYTES))
        return reject('PUBLIC_SOURCE_TOO_LARGE');
      const bytes=await readBounded(r.body);
      if(bytes.length===0)return reject('EMPTY_PUBLIC_SOURCE');
      observations.push(Object.freeze({url:source.url,size:bytes.length,sha256:digest(bytes),
        matchesReviewedBaseline:sameHash(digest(bytes),source.sha256)}));
    }
    if(observations.some(x=>!x.matchesReviewedBaseline))
      return {status:'SOURCE_CHANGE_REVIEW_REQUIRED',reason:'PUBLIC_CONTENT_BYTES_CHANGED',
        observations,executionAuthority:'NONE',brokerOrderAllowed:false,officialMachineFeedApproved:false};
    return {status:'UNCHANGED_PUBLICATION_RESEARCH_ONLY',reason:'BOTH_PUBLIC_BYTES_MATCH_PINNED_BASELINE',
      observations,executionAuthority:'NONE',brokerOrderAllowed:false,officialMachineFeedApproved:false};
  }catch{return reject('PUBLIC_SOURCE_FETCH_OR_BODY_FAILED');}
}
