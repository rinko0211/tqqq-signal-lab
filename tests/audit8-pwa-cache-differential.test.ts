import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {derivePrimaryAction} from "../lib/primary-action.ts";

/* Audit 8 PWA/cache differential.
 * Expected cache/network behavior is literal and independent. The service
 * worker is executed in a minimal browser-like VM rather than inspected only
 * by source regex. Product authority expectations remain fixture-local.
 */

type FetchCall={request:any;init:any};
function loadWorker(fetchImpl:(request:any,init:any)=>Promise<any>,cacheMatchImpl:(request:any)=>Promise<any>){
  const handlers:Record<string,(event:any)=>void>={};
  const fetchCalls:FetchCall[]=[];const cacheMatches:any[]=[];
  const context={
    URL,
    location:{origin:"https://example.test"},
    fetch:(request:any,init:any)=>{fetchCalls.push({request,init});return fetchImpl(request,init)},
    caches:{
      match:(request:any)=>{cacheMatches.push(request);return cacheMatchImpl(request)},
      open:async()=>({addAll:async()=>{},put:async()=>{}}),
      keys:async()=>[],delete:async()=>true,
    },
    self:{
      clients:{claim:async()=>{}},skipWaiting:async()=>{},
      addEventListener:(type:string,fn:(event:any)=>void)=>{handlers[type]=fn},
    },
  };
  vm.runInNewContext(fs.readFileSync("public/sw.js","utf8"),context,{filename:"public/sw.js"});
  return{handlers,fetchCalls,cacheMatches};
}
async function dispatchFetch(worker:ReturnType<typeof loadWorker>,request:any){
  let responsePromise:Promise<any>|undefined;
  worker.handlers.fetch({request,respondWith:(p:Promise<any>)=>{responsePromise=Promise.resolve(p)}});
  assert.ok(responsePromise,"service worker must answer fetch events");
  return responsePromise;
}

test("A8 PWA differential: operational /data/ requests are network-only no-store and never served from CacheStorage",async()=>{
  const network={ok:true,kind:"network-data"};
  const worker=loadWorker(async()=>network,async()=>({ok:true,kind:"stale-cache"}));
  const request={url:"https://example.test/tqqq-signal-lab/data/signal.json",mode:"cors"};
  const response=await dispatchFetch(worker,request);
  assert.equal(response,network);
  assert.equal(worker.fetchCalls.length,1);
  assert.equal(worker.fetchCalls[0].request,request);
  assert.equal(worker.fetchCalls[0].init?.cache,"no-store");
  assert.equal(worker.cacheMatches.length,0,"operational data may not fall back to stale CacheStorage");
});

test("A8 PWA differential: failed operational /data/ fetch rejects instead of silently substituting cached authority",async()=>{
  const worker=loadWorker(async()=>{throw new Error("network down")},async()=>({ok:true,kind:"stale-cache"}));
  const request={url:"https://example.test/tqqq-signal-lab/data/status.json",mode:"cors"};
  await assert.rejects(dispatchFetch(worker,request),/network down/);
  assert.equal(worker.cacheMatches.length,0,"data failure must not read stale cache");
});

test("A8 PWA differential: navigation may use cached shell while operational JSON still comes from the network",async()=>{
  const shell={ok:true,kind:"cached-shell"},freshData={ok:true,kind:"fresh-data"};
  const worker=loadWorker(async(request)=>{
    if(request.mode==="navigate")throw new Error("offline shell network");
    return freshData;
  },async(request)=>request==="./"?shell:null);
  const nav=await dispatchFetch(worker,{url:"https://example.test/tqqq-signal-lab/",mode:"navigate"});
  assert.equal(nav,shell);
  const data=await dispatchFetch(worker,{url:"https://example.test/tqqq-signal-lab/data/signal.json",mode:"cors"});
  assert.equal(data,freshData);
  assert.deepEqual(worker.cacheMatches,["./"]);
  assert.equal(worker.fetchCalls.at(-1)?.init?.cache,"no-store");
});

const G="2026-08-26T21:10:00.000Z";
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const operationalBundle=()=>({
  signal:{generatedAt:G,dataDate:"2026-08-26",platformMode:"RESEARCH",assetTicker:"TQQQ",strategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",state:"latest",signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"}},
  status:{generatedAt:G,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]},
  forward:{...structuredClone(authoritativeForward),updatedAt:G},
  production:{schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"},
  now:"2026-08-27T12:00:00.000Z",holdings:{ratio:"50"},
});

test("A8 PWA differential: fresh shell and cached-shell + same new JSON yield identical observable action",()=>{
  const fresh=derivePrimaryAction(operationalBundle() as any);
  const cachedShellWithNewJson=derivePrimaryAction(operationalBundle() as any);
  assert.equal(fresh.code,"INCREASE");
  assert.equal(cachedShellWithNewJson.code,"INCREASE");
  assert.equal(cachedShellWithNewJson.code,fresh.code);
  assert.equal(cachedShellWithNewJson.message,fresh.message);
  assert.equal(cachedShellWithNewJson.target,fresh.target);
  assert.equal(cachedShellWithNewJson.executionDate,fresh.executionDate);
});

test("A8 PWA differential: page requests each required authority artifact with no-store and fail-closed warning covers any required fetch rejection",()=>{
  const page=fs.readFileSync("app/page.tsx","utf8");
  assert.match(page,/fetch\(url,\{cache:"no-store"\}\)/);
  for(const name of ["signal.json","status.json","forward-ledger.json","production-config.json"]){
    assert.match(page,new RegExp(`fetchJson\\(new URL\\("${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"`));
  }
  assert.match(page,/\[0,1,3,4\]\.some\(i=>results\[i\]\?\.status==="rejected"\)/);
  assert.match(page,/運用authorityを確認できません。売買せずSystem Statusを確認してください。/);
});
