import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

/*
 * Audit 8 Wave 2 — independent black-box / differential fixtures.
 * Expected answers below are literal external-contract outcomes.  This file
 * intentionally imports no Production validator, authority helper, calendar
 * helper, freshness helper, or ledger-integrity helper.
 */

type Fx={
  signal:any;status:any;forward:any;production:any;now:string;
  holdings:{ratio?:string;ticker?:string;version?:string};freshnessDate?:string;
};
const G="2026-08-26T21:10:00.000Z";
const BASE={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const clone=<T>(x:T):T=>structuredClone(x);
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const researchProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const base=():Fx=>({
  signal:{generatedAt:G,dataDate:"2026-08-26",platformMode:"RESEARCH",assetTicker:BASE.ticker,strategy:BASE.strategy,strategyVersion:BASE.version,state:"latest",signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"}},
  status:{generatedAt:G,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]},
  forward:{...clone(authoritativeForward),updatedAt:G},production:clone(researchProduction),now:"2026-08-27T12:00:00.000Z",holdings:{ratio:"50"},freshnessDate:"2026-08-26"
});
const act=(f:Fx)=>derivePrimaryAction(f).code;
const expect=(f:Fx,code:PrimaryActionCode,label:string)=>assert.equal(act(f),code,label);

function setMode(f:Fx,mode:"RESEARCH"|"DECISION"|"PRODUCTION",identity?:{ticker:string;strategy:string;version:string}){
  f.production.mode=mode;
  f.signal.platformMode=mode;
  if(identity){
    f.production.selectedTicker=identity.ticker;f.production.selectedStrategy=identity.strategy;f.production.strategyVersion=identity.version;
    f.production.approvedByHuman=true;f.production.approvalDate="2026-08-25";f.production.effectiveDate="2026-08-25";
    f.signal.assetTicker=identity.ticker;f.signal.strategy=identity.strategy;f.signal.strategyVersion=identity.version;
  }
}

test("A8 wave2 oracle independence: no white-box oracle imports",()=>{
  const imports=fs.readFileSync("tests/audit8-wave2-blackbox.test.ts","utf8").split("\n").filter(x=>x.startsWith("import ")).join("\n");
  assert.match(imports,/primary-action\.ts/);
  for(const forbidden of ["operational-authority","production.ts","market-calendar","engine.ts","forward.ts","lifecycle-review","production-health-review"])
    assert.doesNotMatch(imports,new RegExp(`from [\\"'].*${forbidden}`));
});

test("A8 wave2 differential: equivalent valid mode paths preserve the observable action",()=>{
  const r=base();expect(r,"INCREASE","RESEARCH baseline");
  const d=base();setMode(d,"DECISION");expect(d,"INCREASE","DECISION without incumbent must preserve baseline operational action when all authority is coherent");

  const id={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
  const p=base();setMode(p,"PRODUCTION",id);p.holdings={ratio:"50",ticker:id.ticker,version:id.version};expect(p,"INCREASE","active Production");
  const di=clone(p);di.production.mode="DECISION";di.signal.platformMode="DECISION";expect(di,"INCREASE","DECISION with the same approved incumbent must not silently switch identity");
});

test("A8 wave2 authority mutations: complete but invalid Production authority fails closed",()=>{
  const cases:Fx[]=[];
  let f=base();setMode(f,"PRODUCTION",{ticker:"TQQQ",strategy:"Unknown",version:"UNKNOWN-v1"});cases.push(f);
  f=base();setMode(f,"PRODUCTION",{ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS13-v1.0"});cases.push(f);
  f=base();setMode(f,"PRODUCTION",{ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"});f.production.approvalDate=null;cases.push(f);
  f=base();f.production.mode="RESEARCH";f.production.approvedByHuman=true;f.production.selectedTicker="TQQQ";f.production.selectedStrategy=BASE.strategy;f.production.strategyVersion=BASE.version;f.production.approvalDate="2026-08-25";f.production.effectiveDate="2026-08-25";cases.push(f);
  for(const [i,x] of cases.entries())expect(x,"CHECK_DATA",`authority mutation ${i}`);
});

test("A8 wave2 impossible future artifact generation cannot authorize risk",()=>{
  const f=base();
  const future="2026-08-28T21:10:00.000Z";
  f.signal.generatedAt=future;f.status.generatedAt=future;f.forward.updatedAt=future;
  // Observation is 2026-08-27 08:00 ET: an artifact claiming generation on the next day cannot be authoritative.
  expect(f,"CHECK_DATA","future generatedAt must fail closed even when all three artifacts agree with each other");
});

test("A8 wave2 execution contract: explicit execution date cannot drift away from first legal t+1 open",()=>{
  const f=base();
  // 2026-08-26 signal -> first legal NYSE open is 2026-08-27.  An artifact moving it to 2026-08-28 is contradictory, not a new valid recommendation.
  f.signal.signal.executionDate="2026-08-28";
  expect(f,"CHECK_DATA","arbitrarily delayed explicit execution date must not emit INCREASE/REDUCE");
});

test("A8 wave2 stale-device differential: active non-baseline Production requires explicit holdings identity",()=>{
  const id={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
  const missingBoth=base();setMode(missingBoth,"PRODUCTION",id);missingBoth.holdings={ratio:"50"};
  expect(missingBoth,"REENTER_HOLDINGS","untagged legacy TQQQ holdings cannot be reused after a Production strategy-version transition");
  const missingVersion=base();setMode(missingVersion,"PRODUCTION",id);missingVersion.holdings={ratio:"50",ticker:"TQQQ"};
  expect(missingVersion,"REENTER_HOLDINGS","ticker-only holdings cannot prove the active strategy version");
});

test("A8 wave2 Forward truncation cannot authorize a trade",()=>{
  const f=base();
  assert.ok(f.forward.records.length>1,"authoritative fixture must contain a prefix to truncate");
  f.forward.records=f.forward.records.slice(1);
  expect(f,"CHECK_DATA","a history-truncated append-only artifact must not remain trading authority");
});

test("A8 wave2 Forward chronology cannot contain observations recorded after its own generation",()=>{
  const f=base();
  assert.ok(f.forward.records.length>0);
  f.forward.records[0].recordedAt="2030-01-02T21:00:00.000Z";
  expect(f,"CHECK_DATA","future record chronology inside an otherwise coherent Forward artifact must fail closed");
});

test("A8 wave2 missing nested Daily signal is data failure, not HOLD/TARGET_ONLY",()=>{
  const f=base();delete f.signal.signal;
  expect(f,"CHECK_DATA","present wrapper with missing operational signal payload must be surfaced as CHECK_DATA");
});

test("A8 wave2 research/display freshness is observationally irrelevant after M02 remediation",()=>{
  const a=base(),b=base();
  a.freshnessDate="2026-01-01";b.freshnessDate="2030-01-01";
  assert.equal(act(a),act(b));assert.equal(act(a),"INCREASE");
});
