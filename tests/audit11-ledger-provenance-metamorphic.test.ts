import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {emptyLifecycleLedger,assertLifecycleLedgerInternalIntegrity,updateLifecycleReview,type LifecycleLedger} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,assertProductionHealthLedgerInternalIntegrity,updateProductionHealthLedger,type ProductionHealthLedger} from "../lib/production-health-review.ts";
import {assertForwardLedgerInternalIntegrity,updateForwardLedger,type ForwardLedger} from "../lib/forward.ts";
import {assertPhase5LedgerInternalIntegrity,updatePhase5LedgerSubset,type Phase5Ledger} from "../lib/phase5-forward.ts";
import type {ProductionConfig} from "../lib/production.ts";

/* Audit 11 MR-05/MR-06. Product integrity/update entrypoints are subjects,
 * not oracle helpers. Expected relations are independently constructed causal
 * and append-only relations. No calendar helper is imported. */

const SEED=0xA1120262;
const CASES={generation:300,causal:300,provenance:200,purity:200};
const TOTAL=Object.values(CASES).reduce((a,b)=>a+b,0);
const clone=<T>(x:T):T=>structuredClone(x);
const schedule={interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"};
const forward=JSON.parse(fs.readFileSync("github-pages/public/data/forward-ledger.json","utf8")) as ForwardLedger;
const phase5=JSON.parse(fs.readFileSync("github-pages/public/data/phase-5-forward-ledger.json","utf8")) as Phase5Ledger;
const lifecycle=JSON.parse(fs.readFileSync("github-pages/public/data/lifecycle-review.json","utf8")) as LifecycleLedger;
const health=JSON.parse(fs.readFileSync("github-pages/public/data/production-health-review.json","utf8")) as ProductionHealthLedger;
const production=JSON.parse(fs.readFileSync("github-pages/public/data/production-config.json","utf8")) as ProductionConfig;
const market=JSON.parse(fs.readFileSync("github-pages/public/data/market-data.json","utf8"));

/* The operational ledgers advance on their own schedules.  MR-05 must test the
 * product entrypoints against a coherent persisted prefix, not assume that the
 * checked-in market snapshot and every ledger have the same latest session.
 * Generation time is deliberately derived from the evidence under test: a
 * fixed timestamp becomes causally stale as soon as a normal Daily run adds a
 * later record. */
const marketDates=(ticker:string)=>new Set((market.series[ticker] as any[]).map(x=>x.date as string));
const sharedMarketDates=[...marketDates("TQQQ")].filter(date=>["QQQ","SPY","VIX"].every(ticker=>marketDates(ticker).has(date))).sort();
const fixtureHorizon=sharedMarketDates.at(-1);
if(!fixtureHorizon)throw new Error("Audit 11 MR-05 fixture has no common market session");
const timestamp=(value:unknown)=>typeof value==="string"?Date.parse(value):NaN;
const observedTimestamps=[
  forward.updatedAt,phase5.updatedAt,lifecycle.updatedAt,health.updatedAt,market.retrievedAt,
  ...forward.records.map(r=>r.recordedAt),...phase5.records.map(r=>r.recordedAt),
  ...lifecycle.events.map(e=>e.recordedAt),...health.events.map(e=>e.recordedAt),
].map(timestamp).filter(Number.isFinite);
if(!observedTimestamps.length)throw new Error("Audit 11 MR-05 fixture has no valid evidence timestamp");
const fixtureGeneration=new Date(Math.max(...observedTimestamps)+1).toISOString();
const forwardPrefix=()=>{const x=clone(forward);x.records=x.records.filter(r=>r.marketDataDate<fixtureHorizon);x.updatedAt=fixtureGeneration;assertForwardLedgerInternalIntegrity(x);return x};
const phase5Prefix=()=>{const x=clone(phase5);x.records=x.records.filter(r=>r.marketDataDate<fixtureHorizon);x.coverageGaps=(x.coverageGaps??[]).filter(g=>g.marketDataDate<fixtureHorizon);x.updatedAt=fixtureGeneration;assertPhase5LedgerInternalIntegrity(x);return x};
const lifecycleFixture=()=>{const x=clone(lifecycle);x.updatedAt=fixtureGeneration;assertLifecycleLedgerInternalIntegrity(x);return x};
const healthFixture=()=>{const x=clone(health);x.updatedAt=fixtureGeneration;assertProductionHealthLedgerInternalIntegrity(x);return x};

const reviewEvent=(reviewDate:string,recordedAt:string)=>({key:`INTERIM|${reviewDate}`,stage:"INTERIM" as const,reviewDate,recordedAt,systemDecision:"fixture",userAction:"NONE" as const,candidateReviews:[]});
const healthEvent=(dueDate:string,recordedAt:string)=>({key:`VS13-v1.0|${dueDate}`,dueDate,recordedAt,version:"VS13-v1.0",state:"Healthy" as const,timing:"ON_TIME" as const,reasons:["Audit11 metamorphic fixture"]});
const lWith=(updatedAt:string,reviewDate:string,recordedAt:string)=>{const x=emptyLifecycleLedger(schedule,updatedAt);x.events.push(reviewEvent(reviewDate,recordedAt));return x};
const hWith=(updatedAt:string,dueDate:string,recordedAt:string)=>{const x=emptyProductionHealthLedger(updatedAt);x.events.push(healthEvent(dueDate,recordedAt));return x};
const mm=(i:number)=>String(i%60).padStart(2,"0");

test(`Audit 11 ledger/provenance mechanism volume seed=${SEED}`,()=>{const src=fs.readFileSync("tests/audit11-ledger-provenance-metamorphic.test.ts","utf8"),imports=src.split("\n").filter(x=>x.startsWith("import ")).join("\n");assert.doesNotMatch(imports,/market-calendar/);assert.equal(TOTAL,1000)});

test(`MR-06 generation chronology symmetry ${CASES.generation} transformations seed=${SEED}`,()=>{for(let i=0;i<CASES.generation;i++){const m=mm(i);const lv=lWith(`2027-03-01T22:${m}:00.000Z`,`2027-02-25`,`2027-03-01T21:${m}:00.000Z`);const hv=hWith(`2027-11-26T22:${m}:00.000Z`,`2027-11-25`,`2027-11-26T21:${m}:00.000Z`);assert.doesNotThrow(()=>assertLifecycleLedgerInternalIntegrity(lv),`seed=${SEED} case=${i} lifecycle valid chronology`);assert.doesNotThrow(()=>assertProductionHealthLedgerInternalIntegrity(hv),`seed=${SEED} case=${i} health valid chronology`);const lb=clone(lv),hb=clone(hv);lb.updatedAt=`2027-03-01T20:${m}:00.000Z`;hb.updatedAt=`2027-11-26T20:${m}:00.000Z`;assert.throws(()=>assertLifecycleLedgerInternalIntegrity(lb),/chronology|generation|updatedAt/i,`seed=${SEED} case=${i} lifecycle generation reversal`);assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(hb),/chronology|generation|updatedAt/i,`seed=${SEED} case=${i} health generation reversal`)}});

test(`MR-06 review causal chronology symmetry ${CASES.causal} transformations seed=${SEED}`,()=>{for(let i=0;i<CASES.causal;i++){const m=mm(i);const lv=lWith(`2027-02-26T23:${m}:00.000Z`,`2027-02-25`,`2027-02-25T21:${m}:00.000Z`);const hv=hWith(`2027-11-26T23:${m}:00.000Z`,`2027-11-25`,`2027-11-25T21:${m}:00.000Z`);assert.doesNotThrow(()=>assertLifecycleLedgerInternalIntegrity(lv));assert.doesNotThrow(()=>assertProductionHealthLedgerInternalIntegrity(hv));const lb=lWith(`2027-02-26T23:${m}:00.000Z`,`2027-02-25`,`2027-02-24T21:${m}:00.000Z`);const hb=hWith(`2027-11-26T23:${m}:00.000Z`,`2027-11-25`,`2027-11-24T21:${m}:00.000Z`);assert.throws(()=>assertLifecycleLedgerInternalIntegrity(lb),/chronology|review|causal|future/i,`seed=${SEED} case=${i}`);assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(hb),/chronology|review|due|causal|future/i,`seed=${SEED} case=${i}`)}});

test(`MR-06 current-state provenance symmetry ${CASES.provenance} transformations seed=${SEED}`,()=>{for(let i=0;i<CASES.provenance;i++){const l=clone(lifecycle),h=clone(health);assert.doesNotThrow(()=>assertLifecycleLedgerInternalIntegrity(l),`seed=${SEED} case=${i} live lifecycle baseline`);assert.doesNotThrow(()=>assertProductionHealthLedgerInternalIntegrity(h),`seed=${SEED} case=${i} live health baseline`);const cycle=`2029-01-${String(10+i%10).padStart(2,"0")}`;l.current={...l.current,asOf:cycle,stage:"FORMAL",systemDecision:"PHASE6_HUMAN_DECISION_REQUIRED",userAction:"RUN_PHASE6_HUMAN_REVIEW",reviewCycleDate:cycle,reviewResolved:false,reviewResolvedAt:null};h.current={active:true,version:"VS13-v1.0",lastReview:cycle,nextReview:"2029-04-10",state:"Healthy",userAction:"NONE",message:"forged current"};assert.throws(()=>assertLifecycleLedgerInternalIntegrity(l),/current|history|review|evidence|coherence/i,`seed=${SEED} case=${i} lifecycle unsupported current`);assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(h),/current|history|review|evidence|coherence/i,`seed=${SEED} case=${i} health unsupported current`)}});

test(`MR-05 validator purity / failed-input non-mutation ${CASES.purity} transformations seed=${SEED}`,()=>{const subjects=[
  {name:"forward",value:forward,check:(x:any)=>assertForwardLedgerInternalIntegrity(x)},
  {name:"phase5",value:phase5,check:(x:any)=>assertPhase5LedgerInternalIntegrity(x)},
  {name:"lifecycle",value:lifecycle,check:(x:any)=>assertLifecycleLedgerInternalIntegrity(x)},
  {name:"health",value:health,check:(x:any)=>assertProductionHealthLedgerInternalIntegrity(x)},
];for(let i=0;i<CASES.purity;i++){const s=subjects[i%subjects.length],x=clone(s.value),before=clone(x);s.check(x);s.check(x);assert.deepEqual(x,before,`seed=${SEED} case=${i} ${s.name} validator mutated valid input`);const bad=clone(x) as any,badBefore=clone(bad);bad.updatedAt="not-a-time";badBefore.updatedAt="not-a-time";assert.throws(()=>s.check(bad),/generation|updatedAt|invalid|integrity/i,`seed=${SEED} case=${i} ${s.name} invalid generation`);assert.deepEqual(bad,badBefore,`seed=${SEED} case=${i} ${s.name} validator mutated failed input`)}});

function dataset(){const names=["TQQQ","QQQ","SPY","VIX"] as const,maps=Object.fromEntries(names.map(t=>[t,new Map((market.series[t] as any[]).map(x=>[x.date,x]))])) as any;const dates=(market.series.TQQQ as any[]).map(x=>x.date).filter((d:string)=>names.every(t=>maps[t].has(d)));const meta=(t:string)=>({start:dates[0],end:dates.at(-1),count:dates.length,adjusted:false});return{days:dates.map((date:string)=>({date,tqqq:maps.TQQQ.get(date),qqq:maps.QQQ.get(date),spy:maps.SPY.get(date),vix:maps.VIX.get(date)})),issues:[],source:"auto" as const,precision:"next-open" as const,retrievedAt:fixtureGeneration,provider:"Audit11 stored market fixture",tickers:{TQQQ:meta("TQQQ"),QQQ:meta("QQQ"),SPY:meta("SPY"),VIX:meta("VIX")}}}
const scaleBars=(rows:any[],k:number)=>rows.map(x=>({...x,open:x.open*k,high:x.high*k,low:x.low*k,close:x.close*k,adjClose:(x.adjClose??x.close)*k}));
function phase5Payload(){const base=Object.fromEntries(Object.entries(market.series).map(([t,rows])=>[t,clone(rows)])) as Record<string,any[]>;const source=(t:"SPY"|"QQQ",date:string)=>base[t].find(x=>x.date===date)?.close;for(const [ticker,version,proxy] of [["UPRO","UPRO-SPBT-v1.0","SPY"],["SSO","SSO-SPBT-Scaled-v1.0","SPY"],["QLD","QLD-VS13-Scaled-v1.0","QQQ"]] as const){const basis=phase5.records.filter(r=>r.strategyVersion===version&&r.marketDataDate<=fixtureHorizon).at(-1);const proxyClose=basis&&source(proxy,basis.marketDataDate);if(!basis||!proxyClose)throw new Error(`Audit 11 MR-05 fixture lacks a coherent ${version} basis`);base[ticker]=scaleBars(base[proxy],basis.assetClose/proxyClose)}return{source:"Audit11 stored market fixture",retrievedAt:fixtureGeneration,series:base}}

test("MR-05 actual update idempotence across Forward, Phase5, Lifecycle and Production Health",()=>{const f1=updateForwardLedger(dataset() as any,forwardPrefix(),"Audit11",fixtureGeneration),f2=updateForwardLedger(dataset() as any,clone(f1),"Audit11",fixtureGeneration);assert.equal(f1.records.filter(r=>r.marketDataDate===fixtureHorizon).length,f1.freezes.length,"Forward fixture must exercise a fresh append");assert.deepEqual(f2,f1,"Forward unchanged evidence must be idempotent");let p1=phase5Prefix();for(const v of ["UPRO-SPBT-v1.0","SSO-SPBT-Scaled-v1.0","QLD-VS13-Scaled-v1.0"])p1=updatePhase5LedgerSubset(phase5Payload() as any,p1,[v],fixtureGeneration);let p2=clone(p1);for(const v of ["QLD-VS13-Scaled-v1.0","SSO-SPBT-Scaled-v1.0","UPRO-SPBT-v1.0"])p2=updatePhase5LedgerSubset(phase5Payload() as any,p2,[v],fixtureGeneration);assert.equal(p1.records.filter(r=>r.marketDataDate===fixtureHorizon).length,p1.freezes.length,"Phase5 fixture must exercise a fresh append");assert.deepEqual(p2,p1,"Phase5 repeated peer/subset updates must converge without duplicates");const l1=updateLifecycleReview({phase5:clone(p1),forward:clone(f1),production:clone(production),prior:lifecycleFixture(),now:fixtureGeneration}),l2=updateLifecycleReview({phase5:clone(p1),forward:clone(f1),production:clone(production),prior:clone(l1),now:fixtureGeneration});assert.deepEqual(l2,l1,"Lifecycle unchanged review evaluation must be idempotent");const h1=updateProductionHealthLedger({production:clone(production),lifecycle:clone(l1),prior:healthFixture(),now:fixtureGeneration}),h2=updateProductionHealthLedger({production:clone(production),lifecycle:clone(l1),prior:clone(h1),now:fixtureGeneration});assert.deepEqual(h2,h1,"Production Health unchanged review evaluation must be idempotent")});
