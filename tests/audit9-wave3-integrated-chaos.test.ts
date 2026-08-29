import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {derivePrimaryAction} from "../lib/primary-action.ts";
import {updatePhase5LedgerSubset,type Phase5Ledger} from "../lib/phase5-forward.ts";
import {updateProductionHealthLedger,type ProductionHealthLedger} from "../lib/production-health-review.ts";

/* Audit 9 Wave 3 — integrated hazardous chaos.
 * Each scenario combines >=3 temporal/state axes and observes fault -> partial
 * recovery -> complete recovery. Expectations are scenario-local and do not
 * import market-calendar or integrity validators as the oracle.
 */

const clone=<T>(x:T):T=>structuredClone(x);
const forward0=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const researchProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const G="2026-08-26T21:10:00.000Z";

function actionFx(opts:{dataDate?:string;generatedAt?:string;now?:string;target?:number;previousTarget?:number;executionDate?:string}={}){
  const dataDate=opts.dataDate??"2026-08-26",generatedAt=opts.generatedAt??G,now=opts.now??"2026-08-27T12:00:00.000Z",target=opts.target??.75,previousTarget=opts.previousTarget??.5,executionDate=opts.executionDate??"2026-08-27";
  return{signal:{generatedAt,dataDate,platformMode:"RESEARCH",assetTicker:"TQQQ",strategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",state:"latest",signal:{date:dataDate,target,previousTarget,executionDate}},status:{generatedAt,actionStatus:"success",marketDataDate:dataDate,signalDate:dataDate,state:"latest",errors:[]},forward:{...clone(forward0),updatedAt:generatedAt},production:clone(researchProduction),now,holdings:{ratio:"50"},freshnessDate:"2099-01-01"} as any;
}
function productionFx(opts:{now?:string;approval?:string;effective?:string;updatedAt?:string;version?:"VS13-v1.0"|"VS12-v1.0";target?:number;previousTarget?:number;dataDate?:string;generatedAt?:string;executionDate?:string}={}){
  const version=opts.version??"VS13-v1.0",strategy=version==="VS13-v1.0"?"Volatility Shield 13%":"Volatility Shield 12%",f=actionFx(opts);
  f.signal.platformMode="PRODUCTION";f.signal.strategy=strategy;f.signal.strategyVersion=version;
  f.production={schemaVersion:1,mode:"PRODUCTION",selectedTicker:"TQQQ",selectedStrategy:strategy,strategyVersion:version,approvedByHuman:true,approvalDate:opts.approval??"2026-08-25",effectiveDate:opts.effective??"2026-08-25",lastHealthReview:null,nextHealthReview:null,updatedAt:opts.updatedAt??"2026-08-25T21:00:00.000Z"};
  f.holdings={ratio:"50",ticker:"TQQQ",version};return f;
}
const action=(x:any)=>derivePrimaryAction(x).code;

function worker(fetchImpl:(request:any,init:any)=>Promise<any>,cacheImpl:(request:any)=>Promise<any>){
  const handlers:Record<string,(e:any)=>void>={},cacheReads:any[]=[],fetches:any[]=[];
  const context={URL,location:{origin:"https://example.test"},fetch:(r:any,i:any)=>{fetches.push({r,i});return fetchImpl(r,i)},caches:{match:(r:any)=>{cacheReads.push(r);return cacheImpl(r)},open:async()=>({addAll:async()=>{},put:async()=>{}}),keys:async()=>[],delete:async()=>true},self:{clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(t:string,h:(e:any)=>void)=>{handlers[t]=h}}};
  vm.runInNewContext(fs.readFileSync("public/sw.js","utf8"),context,{filename:"public/sw.js"});return{handlers,cacheReads,fetches};
}
async function swFetch(w:ReturnType<typeof worker>,request:any){let p:Promise<any>|undefined;w.handlers.fetch({request,respondWith:(x:any)=>{p=Promise.resolve(x)}});assert.ok(p);return p}

test("A9 Wave3 H1: clock rollback × cached shell × future Production authority remains closed through partial recovery",async()=>{
  const shell={kind:"cached-shell"},fresh={kind:"network-json"};const w=worker(async(r)=>r.mode==="navigate"?Promise.reject(new Error("offline shell")):fresh,async(r)=>r==="./"?shell:null);
  assert.equal(await swFetch(w,{url:"https://example.test/tqqq-signal-lab/",mode:"navigate"}),shell);
  assert.equal(await swFetch(w,{url:"https://example.test/tqqq-signal-lab/data/production-config.json",mode:"cors"}),fresh);
  assert.equal(w.cacheReads.filter(x=>String(x).includes("production-config")).length,0,"operational authority must not come from stale CacheStorage");

  const both=productionFx({now:"2026-08-26T20:00:00.000Z",approval:"2026-08-28",effective:"2026-08-28",updatedAt:"2026-08-28T18:00:00.000Z"});
  assert.equal(action(both),"CHECK_DATA","clock rollback + future authority");
  const clockFixed=clone(both);clockFixed.now="2026-08-27T12:00:00.000Z";
  assert.equal(action(clockFixed),"CHECK_DATA","fixing clock alone may not bless future Production authority");
  const fully=productionFx();assert.equal(action(fully),"INCREASE","coherent authority after full recovery");
});

test("A9 Wave3 H2: partial Forward × stale Daily × missed open resolves one fault at a time without late chase",()=>{
  const x=actionFx({dataDate:"2026-08-19",now:"2026-08-27T15:00:00.000Z",executionDate:"2026-08-27"});
  x.status.marketDataDate="2026-08-19";x.status.signalDate="2026-08-19";x.signal.signal.date="2026-08-19";
  x.forward.records=x.forward.records.slice(1);
  assert.equal(action(x),"CHECK_DATA","truncated Forward + stale Daily + passed open");
  const forwardFixed=clone(x);forwardFixed.forward={...clone(forward0),updatedAt:G};
  assert.equal(action(forwardFixed),"CHECK_DATA","stale Daily still dominates after Forward recovery");
  const freshButLate=actionFx({now:"2026-08-27T15:00:00.000Z"});
  assert.equal(action(freshButLate),"NO_ACTION_EXPIRED","fresh authority after the open must not chase the expired execution");
  const next=actionFx({dataDate:"2026-08-27",generatedAt:"2026-08-27T21:10:00.000Z",now:"2026-08-28T12:00:00.000Z",target:.75,previousTarget:.75,executionDate:"2026-08-28"});
  assert.equal(action(next),"HOLD","later clean Daily state is evaluated independently");
});

const healthLifecycle=(version:string)=>({current:{productionHealth:{state:"Healthy",version,reasons:["wave3 healthy"],nextHealthReview:null}}}) as any;
const healthProd=(version:string,strategy:string,effectiveDate:string,nextHealthReview:string)=>({schemaVersion:1 as const,mode:"PRODUCTION" as const,selectedTicker:"TQQQ",selectedStrategy:strategy,strategyVersion:version,approvedByHuman:true,approvalDate:effectiveDate,effectiveDate,lastHealthReview:null,nextHealthReview,updatedAt:`${effectiveDate}T18:00:00.000Z`});

test("A9 Wave3 H3: A→B→A × stale holdings × prior late Health evidence cannot bleed into re-entry",()=>{
  const A="VS13-v1.0",B="VS12-v1.0";
  let ledger:ProductionHealthLedger|undefined;
  const a1=healthProd(A,"Volatility Shield 13%","2027-08-25","2027-11-25");
  ledger=updateProductionHealthLedger({production:a1,lifecycle:healthLifecycle(A),prior:ledger,now:"2027-11-26T21:01:00.000Z"});
  ledger=updateProductionHealthLedger({production:a1,lifecycle:healthLifecycle(A),prior:ledger,now:"2028-08-25T21:01:00.000Z"});
  assert.equal(ledger.events.at(-1)?.timing,"LATE_CURRENT_STATE_ONLY");

  const b=healthProd(B,"Volatility Shield 12%","2028-09-01","2028-12-01");
  ledger=updateProductionHealthLedger({production:b,lifecycle:healthLifecycle(B),prior:ledger,now:"2028-09-05T21:01:00.000Z"});
  const a2=healthProd(A,"Volatility Shield 13%","2028-10-01","2029-01-01");
  ledger=updateProductionHealthLedger({production:a2,lifecycle:healthLifecycle(A),prior:ledger,now:"2029-01-02T21:01:00.000Z"});
  assert.equal(ledger.events.at(-1)?.version,A);assert.equal(ledger.events.at(-1)?.dueDate,"2029-01-01","old late A evidence must not suppress new A episode recurrence");

  const aAction=productionFx({version:"VS13-v1.0",approval:"2028-10-01",effective:"2028-10-01",updatedAt:"2028-10-01T18:00:00.000Z",dataDate:"2029-01-02",generatedAt:"2029-01-02T21:10:00.000Z",executionDate:"2029-01-03",now:"2029-01-03T12:00:00.000Z"});
  aAction.holdings={ratio:"50",ticker:"TQQQ",version:"VS12-v1.0"};assert.equal(action(aAction),"REENTER_HOLDINGS","B local holdings cannot bleed into A re-entry");
  aAction.holdings={ratio:"50",ticker:"TQQQ",version:"VS13-v1.0"};assert.equal(action(aAction),"INCREASE");
});

const market=JSON.parse(fs.readFileSync("github-pages/public/data/market-data.json","utf8"));
const p5=JSON.parse(fs.readFileSync("github-pages/public/data/phase-5-forward-ledger.json","utf8")) as Phase5Ledger;
const UPRO="UPRO-SPBT-v1.0",SSO="SSO-SPBT-Scaled-v1.0",QLD="QLD-VS13-Scaled-v1.0";
const scale=(rows:any[],k:number)=>rows.map(x=>({...x,open:x.open*k,high:x.high*k,low:x.low*k,close:x.close*k,adjClose:(x.adjClose??x.close)*k}));
const prior=(v:string)=>p5.records.find(r=>r.strategyVersion===v&&r.marketDataDate==="2026-08-26")!.assetClose;
const srcClose=(t:"SPY"|"QQQ")=>market.series[t].find((r:any)=>r.date==="2026-08-26").close;
function p5Payload(date="2026-08-27"){const base=Object.fromEntries(Object.entries(market.series).map(([t,rows])=>[t,(rows as any[]).filter(r=>r.date<=date)])) as Record<string,any[]>;base.UPRO=scale(base.SPY,prior(UPRO)/srcClose("SPY"));base.SSO=scale(base.SPY,prior(SSO)/srcClose("SPY"));base.QLD=scale(base.QQQ,prior(QLD)/srcClose("QQQ"));return{source:"A9 Wave3",retrievedAt:`${date}T22:00:00.000Z`,series:base}}

test("A9 Wave3 H4: one-system Phase5 failure × peer update × delayed retry preserves peers and catches failed system exactly once",()=>{
  let ledger=clone(p5);ledger.records=ledger.records.filter(r=>r.marketDataDate<="2026-08-26");ledger.coverageGaps=(ledger.coverageGaps??[]).filter(g=>g.marketDataDate<="2026-08-26");ledger.updatedAt="2026-08-27T04:03:42.439Z";
  const degraded=p5Payload() as any;delete degraded.series.SSO;
  ledger=updatePhase5LedgerSubset(degraded,ledger,[UPRO],"2026-08-28T01:00:00.000Z");ledger=updatePhase5LedgerSubset(degraded,ledger,[QLD],"2026-08-28T01:00:00.000Z");
  const peerSnapshot=clone(ledger.records.filter(r=>r.strategyVersion!==SSO)),gapSnapshot=clone((ledger.coverageGaps??[]).filter(g=>g.strategyVersion!==SSO));
  for(let n=0;n<12;n++)assert.throws(()=>updatePhase5LedgerSubset(degraded,ledger,[SSO],`2026-08-28T02:${String(n).padStart(2,"0")}:00.000Z`),/missing series for SSO/);
  assert.deepEqual(ledger.records.filter(r=>r.strategyVersion!==SSO),peerSnapshot);assert.deepEqual((ledger.coverageGaps??[]).filter(g=>g.strategyVersion!==SSO),gapSnapshot);
  const recovered=p5Payload();ledger=updatePhase5LedgerSubset(recovered,ledger,[SSO],"2026-08-28T03:00:00.000Z");for(let n=0;n<5;n++)ledger=updatePhase5LedgerSubset(recovered,ledger,[SSO],`2026-08-28T04:${String(n).padStart(2,"0")}:00.000Z`);
  assert.deepEqual(ledger.records.filter(r=>r.strategyVersion!==SSO),peerSnapshot);assert.equal(ledger.records.filter(r=>r.strategyVersion===SSO).at(-1)?.marketDataDate,"2026-08-27");assert.equal(new Set(ledger.records.map(r=>r.key)).size,ledger.records.length);
});

test("A9 Wave3 H5: review failure × long outage × holiday boundary remains retryable and future recurrence resumes",()=>{
  const A="VS13-v1.0",prod=healthProd(A,"Volatility Shield 13%","2027-08-25","2027-11-25");let ledger:ProductionHealthLedger|undefined;
  const wrong=healthLifecycle("VS12-v1.0");assert.throws(()=>updateProductionHealthLedger({production:prod,lifecycle:wrong,prior:ledger,now:"2027-11-26T21:01:00.000Z"}),/HEALTH-001/);assert.equal(ledger,undefined,"failed review attempt cannot consume/persist a review");
  ledger=updateProductionHealthLedger({production:prod,lifecycle:healthLifecycle(A),prior:ledger,now:"2028-08-25T21:01:00.000Z"});
  assert.equal(ledger.events.length,1);assert.equal(ledger.events[0].dueDate,"2027-11-25");assert.equal(ledger.events[0].timing,"LATE_CURRENT_STATE_ONLY");assert.equal(ledger.current.nextReview,"2028-11-25");
  ledger=updateProductionHealthLedger({production:prod,lifecycle:healthLifecycle(A),prior:ledger,now:"2028-11-27T21:01:00.000Z"});
  assert.equal(ledger.events.length,2);assert.equal(ledger.events[1].dueDate,"2028-11-25");assert.equal(ledger.events[1].timing,"ON_TIME");
});

test("A9 Wave3 H6: deploy failure × newer persisted generation × reload cannot manufacture the newer action before a successful deploy",async()=>{
  const workflow=fs.readFileSync(".github/workflows/daily-signal.yml","utf8");
  const order=["Run operational regression tests","Save append-only live signal history","Confirm validated source remains authoritative","Build PWA from the persisted validated head","Deploy GitHub Pages"].map(x=>workflow.indexOf(x));
  assert.ok(order.every(x=>x>=0));for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1],"Daily workflow must validate/persist/confirm/build before deploy");
  assert.match(workflow,/origin\/main[^\n]*VALIDATED_MAIN_SHA|VALIDATED_MAIN_SHA[^\n]*origin\/main/s,"source-head coherence must gate deployment");

  const staleDeployed=actionFx({now:"2026-08-31T12:00:00.000Z"});
  assert.equal(action(staleDeployed),"CHECK_DATA","reload after failed deploy sees stale deployed JSON and must not infer the newer persisted action");

  const newPersisted=actionFx({dataDate:"2026-08-28",generatedAt:"2026-08-28T22:10:00.000Z",now:"2026-08-31T12:00:00.000Z",executionDate:"2026-08-31"});
  const w=worker(async(r)=>r.mode==="navigate"?Promise.reject(new Error("deploy unavailable")):{kind:"new-deployed-json"},async(r)=>r==="./"?{kind:"old-cached-shell"}:null);
  assert.deepEqual(await swFetch(w,{url:"https://example.test/tqqq-signal-lab/",mode:"navigate"}),{kind:"old-cached-shell"});
  assert.deepEqual(await swFetch(w,{url:"https://example.test/tqqq-signal-lab/data/signal.json",mode:"cors"}),{kind:"new-deployed-json"});
  assert.equal(action(newPersisted),"INCREASE","only after later successful deploy may the newer coherent generation become actionable");
});
