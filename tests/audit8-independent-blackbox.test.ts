import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

type Fixture={
  name:string;
  signal:any;
  status:any;
  forward:any;
  production:any;
  now:string;
  latestCompletedDate:string;
  freshnessDate?:string;
  holdings:{ratio?:string;ticker?:string;version?:string};
  expected?:PrimaryActionCode;
};

const G="2026-08-26T21:10:00.000Z";
const BASE_ID={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const baseSignal={generatedAt:G,dataDate:"2026-08-26",platformMode:"RESEARCH",assetTicker:BASE_ID.ticker,strategy:BASE_ID.strategy,strategyVersion:BASE_ID.version,state:"latest",signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"}};
const baseStatus={generatedAt:G,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]};
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const baseForward={...authoritativeForward,updatedAt:G};
const baseProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const clone=<T>(v:T):T=>structuredClone(v);
const base=(name:string):Fixture=>({name,signal:clone(baseSignal),status:clone(baseStatus),forward:clone(baseForward),production:clone(baseProduction),now:"2026-08-27T12:00:00.000Z",latestCompletedDate:"2026-08-26",freshnessDate:"2026-08-26",holdings:{ratio:"50"}});

// Independent external-contract oracle. It intentionally does not import or call
// production validators, authority helpers, market-calendar helpers, freshness,
// or ledger-integrity helpers.
function oracle(f:Fixture):PrimaryActionCode{
  const {signal:s,status:r,forward:w,production:p}=f;
  if(!s||!r||!w||!p)return "CHECK_DATA";
  const validTs=(x:any)=>typeof x==="string"&&!Number.isNaN(Date.parse(x));
  const noIdentity=p.selectedTicker==null&&p.selectedStrategy==null&&p.strategyVersion==null;
  const baselineResearch=p.schemaVersion===1&&p.mode==="RESEARCH"&&p.approvedByHuman===false&&noIdentity&&p.approvalDate==null&&p.effectiveDate==null;
  if(!baselineResearch)return "CHECK_DATA";
  if(s.assetTicker!==BASE_ID.ticker||s.strategy!==BASE_ID.strategy||s.strategyVersion!==BASE_ID.version||s.platformMode!=="RESEARCH")return "CHECK_DATA";
  if(!validTs(s.generatedAt)||!validTs(r.generatedAt)||!validTs(w.updatedAt)||s.generatedAt!==r.generatedAt||s.generatedAt!==w.updatedAt)return "CHECK_DATA";
  if(s.dataDate!==r.signalDate||s.dataDate!==r.marketDataDate)return "CHECK_DATA";
  if(s.state!==r.state||r.actionStatus!=="success"||(Array.isArray(r.errors)&&r.errors.length))return "CHECK_DATA";
  if(w.schemaVersion!==1||w.appendOnly!==true)return "CHECK_DATA";
  if(s.dataDate!==f.latestCompletedDate)return "CHECK_DATA";
  if(!s.signal||typeof s.signal!=="object")return "CHECK_DATA";
  const q=s.signal;
  if(q.date!==s.dataDate||!Number.isFinite(q.target)||!Number.isFinite(q.previousTarget)||q.target<0||q.target>1||q.previousTarget<0||q.previousTarget>1)return "CHECK_DATA";
  if(Array.isArray(w.records)){
    const keys=new Set<string>();
    let prior="";
    for(const rec of w.records){
      if(!rec||typeof rec.key!=="string"||keys.has(rec.key))return "CHECK_DATA";
      keys.add(rec.key);
      if(typeof rec.marketDataDate!=="string"||rec.marketDataDate<prior)return "CHECK_DATA";
      prior=rec.marketDataDate;
    }
  }
  const changed=Math.abs(q.target-q.previousTarget)>=.001;
  const window=(q.executionDate==="2026-08-27"&&f.now==="2026-08-27T12:00:00.000Z")?"FUTURE":(q.executionDate==="2026-08-27"&&f.now==="2026-08-27T14:00:00.000Z")?"PAST":q.executionDate==="2026-08-29"?"INVALID":"UNKNOWN";
  if(changed&&window==="PAST")return "NO_ACTION_EXPIRED";
  const tagMismatch=Boolean(f.holdings.ticker&&(f.holdings.ticker!==BASE_ID.ticker||(f.holdings.version&&f.holdings.version!==BASE_ID.version)));
  if(tagMismatch)return "REENTER_HOLDINGS";
  const raw=f.holdings.ratio??"";
  if(raw==="")return "TARGET_ONLY";
  const pct=Number(raw);
  if(!Number.isFinite(pct)||pct<0||pct>100)return "CHECK_DATA";
  if(!changed)return "HOLD";
  if(window!=="FUTURE")return "WAIT";
  const actual=pct/100;
  if(Math.abs(actual-q.target)<.001)return "HOLD";
  return actual<q.target?"INCREASE":"REDUCE";
}

const run=(f:Fixture)=>derivePrimaryAction({signal:f.signal,status:f.status,forward:f.forward,production:f.production,now:f.now,holdings:f.holdings,freshnessDate:f.freshnessDate});

test("Audit 8 oracle remains independent from white-box implementation imports",()=>{
  const src=fs.readFileSync("tests/audit8-independent-blackbox.test.ts","utf8");
  const imports=src.split("\n").filter(line=>line.startsWith("import ")).join("\n");
  assert.match(imports,/from "\.\.\/lib\/primary-action\.ts"/);
  for(const forbiddenModule of ["operational-authority","production.ts","market-calendar","engine.ts","forward.ts","lifecycle-review","production-health-review"]){
    assert.doesNotMatch(imports,new RegExp(`from [\\"'].*${forbiddenModule}`));
  }
});

test("Audit 8 independent oracle agrees on the normal finite action surface",()=>{
  const fixtures:Fixture[]=[];
  let f=base("increase");f.expected="INCREASE";fixtures.push(f);
  f=base("reduce");f.holdings.ratio="90";f.expected="REDUCE";fixtures.push(f);
  f=base("at target");f.holdings.ratio="75";f.expected="HOLD";fixtures.push(f);
  f=base("no holdings");f.holdings.ratio="";f.expected="TARGET_ONLY";fixtures.push(f);
  f=base("expired");f.now="2026-08-27T14:00:00.000Z";f.expected="NO_ACTION_EXPIRED";fixtures.push(f);
  f=base("re-enter holdings");f.holdings={ratio:"50",ticker:"UPRO",version:"UPRO-SPBT-v1.0"};f.expected="REENTER_HOLDINGS";fixtures.push(f);
  f=base("invalid session wait");f.signal.signal.executionDate="2026-08-29";f.expected="WAIT";fixtures.push(f);
  f=base("no target change");f.signal.signal.previousTarget=.75;f.expected="HOLD";fixtures.push(f);
  for(const x of fixtures){assert.equal(oracle(x),x.expected,x.name);assert.equal(run(x).code,x.expected,x.name)}
});

test("Audit 8 authority corruption and generation mutations all fail closed",()=>{
  const fixtures:Fixture[]=[];
  for(const key of ["signal","status","forward","production"] as const){const f=base(`missing ${key}`);(f as any)[key]=null;fixtures.push(f)}
  for(const field of ["selectedTicker","selectedStrategy","strategyVersion"]){const f=base(`partial production ${field}`);f.production.mode="DECISION";f.production[field]=field==="selectedTicker"?"TQQQ":field==="selectedStrategy"?BASE_ID.strategy:BASE_ID.version;fixtures.push(f)}
  for(const key of ["signal","status","forward"] as const){const f=base(`generation skew ${key}`);if(key==="signal")f.signal.generatedAt="2026-08-26T21:09:59.000Z";if(key==="status")f.status.generatedAt="2026-08-26T21:09:59.000Z";if(key==="forward")f.forward.updatedAt="2026-08-26T21:09:59.000Z";fixtures.push(f)}
  let f=base("date divergence");f.status.marketDataDate="2026-08-25";fixtures.push(f);
  f=base("failed status");f.status.actionStatus="failed";f.status.state="failed";f.signal.state="failed";fixtures.push(f);
  f=base("runtime errors");f.status.errors=["provider error"];fixtures.push(f);
  for(const x of fixtures){assert.equal(oracle(x),"CHECK_DATA",x.name);assert.equal(run(x).code,"CHECK_DATA",x.name)}
});

test("Audit 8 malformed holdings require CHECK_DATA",()=>{
  for(const raw of ["oops","NaN","Infinity","-1","101"]){
    const f=base(`holdings=${raw}`);f.holdings.ratio=raw;
    assert.equal(oracle(f),"CHECK_DATA",f.name);
    assert.equal(run(f).code,"CHECK_DATA",f.name);
  }
});

test("Audit 8 malformed or out-of-range target requires CHECK_DATA",()=>{
  for(const target of [-.25,1.25]){
    const f=base(`target=${target}`);f.signal.signal.target=target;
    assert.equal(oracle(f),"CHECK_DATA",f.name);
    assert.equal(run(f).code,"CHECK_DATA",f.name);
  }
});

test("Audit 8 stale operational authority cannot be masked by a fresher research dataset date",()=>{
  const f=base("stale operational bundle masked by research freshness");
  f.signal.generatedAt="2026-08-20T21:10:00.000Z";f.status.generatedAt=f.signal.generatedAt;f.forward.updatedAt=f.signal.generatedAt;
  f.signal.dataDate="2026-08-19";f.status.signalDate="2026-08-19";f.status.marketDataDate="2026-08-19";f.signal.signal.date="2026-08-19";f.signal.signal.executionDate="2026-08-21";
  f.now="2026-08-21T12:00:00.000Z";f.latestCompletedDate="2026-08-20";f.freshnessDate="2026-08-20";
  assert.equal(oracle(f),"CHECK_DATA");
  assert.equal(run(f).code,"CHECK_DATA");
});

test("Audit 8 malformed Forward history cannot authorize a trade merely from valid top-level metadata",()=>{
  const f=base("duplicate Forward history");
  const row=clone(f.forward.records[0]);
  f.forward.records=[row,clone(row),...f.forward.records.slice(1)];
  assert.equal(oracle(f),"CHECK_DATA");
  assert.equal(run(f).code,"CHECK_DATA");
});
