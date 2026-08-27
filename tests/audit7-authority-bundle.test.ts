import test from "node:test";
import assert from "node:assert/strict";
import {operationalAuthorityBundleIsCoherent} from "../lib/operational-authority.ts";
import {DEFAULT_PRODUCTION_CONFIG,transitionMode} from "../lib/production.ts";

const status={generatedAt:"2027-08-25T21:00:00.000Z",actionStatus:"success",marketDataDate:"2027-08-25",signalDate:"2027-08-25",state:"latest",errors:[]};
const forward={schemaVersion:1,appendOnly:true,updatedAt:status.generatedAt};
const baselineSignal={generatedAt:status.generatedAt,dataDate:"2027-08-25",platformMode:"RESEARCH",assetTicker:"TQQQ",strategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",state:"latest"};

test("A7 FC-13/08: coherent RESEARCH baseline authority is accepted",()=>{
  assert.equal(operationalAuthorityBundleIsCoherent({signal:baselineSignal,status,production:DEFAULT_PRODUCTION_CONFIG,forward}).ok,true);
});

test("A7 FC-13: old Signal/status plus new Production authority fails closed",()=>{
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  const r=operationalAuthorityBundleIsCoherent({signal:baselineSignal,status,production:p,forward});
  assert.equal(r.ok,false);assert.ok(r.reasons.some(x=>x.includes("control modes")||x.includes("identity")));
});

test("A7 FC-13: new Signal with old runtime generation fails closed",()=>{
  const signal={...baselineSignal,generatedAt:"2027-08-26T21:00:00.000Z",dataDate:"2027-08-26"};
  const r=operationalAuthorityBundleIsCoherent({signal,status,production:DEFAULT_PRODUCTION_CONFIG,forward});
  assert.equal(r.ok,false);assert.ok(r.reasons.some(x=>x.includes("generations")));
});

test("A7 FC-13: current Signal/status plus stale Forward generation fails closed",()=>{
  const staleForward={...forward,updatedAt:"2027-08-24T21:00:00.000Z"};
  const r=operationalAuthorityBundleIsCoherent({signal:baselineSignal,status,production:DEFAULT_PRODUCTION_CONFIG,forward:staleForward});
  assert.equal(r.ok,false);assert.ok(r.reasons.some(x=>x.includes("Forward")&&x.includes("generation")));
});

test("A7 FC-13/15: identical timestamps cannot mask date divergence",()=>{
  const signal={...baselineSignal,dataDate:"2027-08-24"};
  const r=operationalAuthorityBundleIsCoherent({signal,status,production:DEFAULT_PRODUCTION_CONFIG,forward});
  assert.equal(r.ok,false);assert.ok(r.reasons.some(x=>x.includes("market-data dates")));
});

test("A7 FC-08: malformed Forward authority blocks an otherwise coherent bundle",()=>{
  assert.equal(operationalAuthorityBundleIsCoherent({signal:baselineSignal,status,production:DEFAULT_PRODUCTION_CONFIG,forward:{schemaVersion:1,appendOnly:false,updatedAt:status.generatedAt}}).ok,false);
});

test("A7 FC-13/02: DECISION with active incumbent requires Signal mode DECISION and incumbent identity",()=>{
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  const review=transitionMode(p,"DECISION");
  const signal={...baselineSignal,platformMode:"DECISION",assetTicker:"UPRO",strategy:"UPRO + S&P Broad Trend",strategyVersion:"UPRO-SPBT-v1.0"};
  assert.equal(operationalAuthorityBundleIsCoherent({signal,status,production:review,forward}).ok,true);
});
