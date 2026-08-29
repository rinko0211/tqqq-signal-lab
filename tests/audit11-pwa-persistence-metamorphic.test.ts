import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

/* Audit 11 MR-07/MR-08. The service worker is executed in a VM and workflow
 * ordering is observed from the deployed workflow source. Expected relations
 * do not call product cache, calendar, or authority helpers. */

const SEED=0xA1120263;
const CASES={transport:300,persistence:200};
const TOTAL=500;
function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s}}
const rnd=rng(SEED);
const clone=<T>(x:T):T=>structuredClone(x);
const forward0=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const production={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const risk=(c:PrimaryActionCode)=>c==="INCREASE"||c==="REDUCE";

function worker(fetchImpl:(request:any,init:any)=>Promise<any>,cacheImpl:(request:any)=>Promise<any>){const handlers:Record<string,(e:any)=>void>={},cacheReads:any[]=[],fetches:any[]=[];const context={URL,location:{origin:"https://example.test"},fetch:(r:any,i:any)=>{fetches.push({r,i});return fetchImpl(r,i)},caches:{match:(r:any)=>{cacheReads.push(r);return cacheImpl(r)},open:async()=>({addAll:async()=>{},put:async()=>{}}),keys:async()=>[],delete:async()=>true},self:{clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(t:string,h:(e:any)=>void)=>{handlers[t]=h}}};vm.runInNewContext(fs.readFileSync("public/sw.js","utf8"),context,{filename:"public/sw.js"});return{handlers,cacheReads,fetches}}
async function swFetch(w:ReturnType<typeof worker>,request:any){let p:Promise<any>|undefined;w.handlers.fetch({request,respondWith:(x:any)=>{p=Promise.resolve(x)}});assert.ok(p);return p}

const artifacts=["signal.json","status.json","forward-ledger.json","production-config.json","phase-5-forward-status.json","lifecycle-review.json","production-health-review.json"];

test(`Audit 11 PWA/persistence mechanism volume seed=${SEED}`,()=>{const src=fs.readFileSync("tests/audit11-pwa-persistence-metamorphic.test.ts","utf8"),imports=src.split("\n").filter(x=>x.startsWith("import ")).join("\n");assert.doesNotMatch(imports,/market-calendar|operational-authority|production\.ts/);assert.equal(CASES.transport+CASES.persistence,TOTAL)});

test(`MR-07 operational data transport ${CASES.transport} transformations seed=${SEED}`,async()=>{for(let i=0;i<CASES.transport;i++){const name=artifacts[rnd()%artifacts.length],q=`?audit=${rnd().toString(16)}&v=${i}`,request={url:`https://example.test/tqqq-signal-lab/data/${name}${q}`,mode:"cors"};const cached={kind:"stale",case:i},network={kind:"network",case:i};if(i%3!==0){const w=worker(async()=>network,async()=>cached);const out=await swFetch(w,request);assert.equal(out,network,`seed=${SEED} case=${i} ${name}`);assert.equal(w.fetches.length,1);assert.equal(w.fetches[0].i?.cache,"no-store",`seed=${SEED} case=${i} must no-store`);assert.equal(w.cacheReads.length,0,`seed=${SEED} case=${i} operational data cannot consult CacheStorage`)}else{const w=worker(async()=>{throw new Error(`network-down-${i}`)},async()=>cached);await assert.rejects(swFetch(w,request),new RegExp(`network-down-${i}`));assert.equal(w.cacheReads.length,0,`seed=${SEED} case=${i} failed data fetch cannot fall back to cache`)}}});

function bundle(newer:boolean,up:boolean){const date=newer?"2026-08-28":"2026-08-26",next=newer?"2026-08-31":"2026-08-27",g=`${date}T22:10:00.000Z`,target=up?.75:.25;return{signal:{generatedAt:g,dataDate:date,platformMode:"RESEARCH",assetTicker:"TQQQ",strategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",state:"latest",signal:{date,target,previousTarget:.5,executionDate:next}},status:{generatedAt:g,actionStatus:"success",marketDataDate:date,signalDate:date,state:"latest",errors:[]},forward:{...clone(forward0),updatedAt:g},production:clone(production),now:newer?"2026-08-31T12:00:00.000Z":"2026-08-31T12:00:00.000Z",holdings:{ratio:"50"}} as any}

test(`MR-08 persisted/deployed generation visibility ${CASES.persistence} transformations seed=${SEED}`,async()=>{const workflow=fs.readFileSync(".github/workflows/daily-signal.yml","utf8");const labels=["Run operational regression tests","Save append-only live signal history","Confirm validated source remains authoritative","Build PWA from the persisted validated head","Deploy GitHub Pages"];const positions=labels.map(x=>workflow.indexOf(x));assert.ok(positions.every(x=>x>=0));for(let j=1;j<positions.length;j++)assert.ok(positions[j]>positions[j-1],`workflow order ${labels[j-1]} -> ${labels[j]}`);const deployBlock=workflow.slice(positions[4]-200,positions[4]+300);assert.doesNotMatch(deployBlock,/if:\s*\$\{\{\s*always\(\)/,"deploy must not run after a failed upstream step");
  for(let i=0;i<CASES.persistence;i++){const up=Boolean(rnd()&1),deploySucceeded=Boolean(rnd()&1),old=bundle(false,up),newer=bundle(true,up);assert.equal(risk(derivePrimaryAction(old).code),false,`seed=${SEED} case=${i} stale deployed generation must be closed`);assert.equal(risk(derivePrimaryAction(newer).code),true,`seed=${SEED} case=${i} coherent newer generation must be actionable`);const shell={kind:"cached-shell",case:i},wire=deploySucceeded?{kind:"new-generation"}:{kind:"old-generation"};const w=worker(async(r)=>r.mode==="navigate"?Promise.reject(new Error("shell-network-unavailable")):wire,async(r)=>r==="./"?shell:null);assert.equal(await swFetch(w,{url:"https://example.test/tqqq-signal-lab/",mode:"navigate"}),shell);const seen=await swFetch(w,{url:`https://example.test/tqqq-signal-lab/data/signal.json?case=${i}`,mode:"cors"});assert.equal(seen,wire);const observable=seen.kind==="new-generation"?newer:old;const code=derivePrimaryAction(observable).code;assert.equal(risk(code),deploySucceeded,`seed=${SEED} case=${i} deploySucceeded=${deploySucceeded} code=${code}`);assert.equal(w.cacheReads.filter(x=>String(x).includes("/data/")).length,0,`seed=${SEED} case=${i} persisted-but-not-deployed data cannot leak from CacheStorage`)}});
