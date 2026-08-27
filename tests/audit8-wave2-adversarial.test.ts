import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

const G="2026-08-26T21:10:00.000Z";
const BASE={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const UPRO={ticker:"UPRO",strategy:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0"};
const forward={...JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8")),updatedAt:G};
const researchProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const signal=(mode:string,id=BASE)=>({generatedAt:G,dataDate:"2026-08-26",platformMode:mode,assetTicker:id.ticker,strategy:id.strategy,strategyVersion:id.version,state:"latest",signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"}});
const status=()=>({generatedAt:G,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]});
const activeProduction=(mode:"PRODUCTION"|"DECISION"="PRODUCTION",approvalDate="2026-08-25",effectiveDate="2026-08-25")=>({schemaVersion:1,mode,selectedTicker:UPRO.ticker,selectedStrategy:UPRO.strategy,strategyVersion:UPRO.version,approvedByHuman:true,approvalDate,effectiveDate,lastHealthReview:null,nextHealthReview:"2026-11-25",updatedAt:"2026-08-25T12:00:00.000Z"});
const run=(x:{signal:any;status:any;forward?:any;production:any;now?:string;holdings?:any})=>derivePrimaryAction({signal:x.signal,status:x.status,forward:x.forward??structuredClone(forward),production:x.production,now:x.now??"2026-08-27T12:00:00.000Z",holdings:x.holdings??{ratio:"50"}});

// This Wave 2 oracle is intentionally semantic and fixture-local. It does not import
// Production validators, authority helpers, calendar helpers, freshness, or ledger validators.
const expected=(name:string):PrimaryActionCode=>{
  switch(name){
    case "future-production-authority":return "CHECK_DATA";
    case "future-approval-authority":return "CHECK_DATA";
    case "research-baseline":return "INCREASE";
    case "decision-no-incumbent":return "INCREASE";
    case "production-incumbent":return "INCREASE";
    case "decision-incumbent":return "INCREASE";
    case "generation-plus-holdings-corruption":return "CHECK_DATA";
    case "expired-plus-holdings-corruption":return "CHECK_DATA";
    case "old-production-new-signal":return "CHECK_DATA";
    case "new-production-old-signal":return "CHECK_DATA";
    default:throw Error(`unknown oracle fixture ${name}`);
  }
};

test("A8 Wave2: future-dated Production authority cannot authorize current risk change",()=>{
  const p=activeProduction("PRODUCTION","2026-08-28","2026-08-28");
  const got=run({signal:signal("PRODUCTION",UPRO),status:status(),production:p,holdings:{ratio:"50",ticker:UPRO.ticker,version:UPRO.version}}).code;
  assert.equal(got,expected("future-production-authority"));
});

test("A8 Wave2: future approval date cannot authorize current risk change even with current effective date",()=>{
  const p=activeProduction("PRODUCTION","2026-08-28","2026-08-25");
  const got=run({signal:signal("PRODUCTION",UPRO),status:status(),production:p,holdings:{ratio:"50",ticker:UPRO.ticker,version:UPRO.version}}).code;
  assert.equal(got,expected("future-approval-authority"));
});

test("A8 Wave2 differential: equivalent valid mode shapes preserve action semantics",()=>{
  const r=run({signal:signal("RESEARCH"),status:status(),production:structuredClone(researchProduction)}).code;
  const d0={...structuredClone(researchProduction),mode:"DECISION"};
  const d=run({signal:signal("DECISION"),status:status(),production:d0}).code;
  const p=activeProduction("PRODUCTION");
  const ap=run({signal:signal("PRODUCTION",UPRO),status:status(),production:p,holdings:{ratio:"50",ticker:UPRO.ticker,version:UPRO.version}}).code;
  const di=activeProduction("DECISION");
  const ad=run({signal:signal("DECISION",UPRO),status:status(),production:di,holdings:{ratio:"50",ticker:UPRO.ticker,version:UPRO.version}}).code;
  assert.equal(r,expected("research-baseline"));
  assert.equal(d,expected("decision-no-incumbent"));
  assert.equal(ap,expected("production-incumbent"));
  assert.equal(ad,expected("decision-incumbent"));
});

test("A8 Wave2 compound faults: authority corruption dominates holdings/execution branches",()=>{
  const s1=signal("RESEARCH");s1.generatedAt="2026-08-26T21:09:59.000Z";
  const a=run({signal:s1,status:status(),production:structuredClone(researchProduction),holdings:{ratio:"oops"}}).code;
  assert.equal(a,expected("generation-plus-holdings-corruption"));

  const s2=signal("RESEARCH");
  const b=run({signal:s2,status:status(),production:structuredClone(researchProduction),now:"2026-08-27T14:00:00.000Z",holdings:{ratio:"oops"}}).code;
  assert.equal(b,expected("expired-plus-holdings-corruption"));
});

test("A8 Wave2 cache skew: old Production identity with new Signal fails closed",()=>{
  const p=activeProduction("PRODUCTION");
  const got=run({signal:signal("PRODUCTION",BASE),status:status(),production:p,holdings:{ratio:"50",ticker:BASE.ticker,version:BASE.version}}).code;
  assert.equal(got,expected("old-production-new-signal"));
});

test("A8 Wave2 cache skew: new Production identity with old Signal fails closed",()=>{
  const p=activeProduction("PRODUCTION");
  const got=run({signal:signal("RESEARCH",BASE),status:status(),production:p,holdings:{ratio:"50"}}).code;
  assert.equal(got,expected("new-production-old-signal"));
});
