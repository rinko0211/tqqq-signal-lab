import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRODUCTION_CONFIG, PRODUCTION_SYSTEMS, resolveProductionSystem, transitionMode } from "../lib/production.ts";
import { PHASE5_FREEZES, emptyPhase5Ledger } from "../lib/phase5-forward.ts";
import { emptyLifecycleLedger } from "../lib/lifecycle-review.ts";
import { lifecycleReviewIsFresh } from "../lib/lifecycle-approval.ts";

test("all Phase 5 frontier systems are registered without configuration drift",()=>{
  for(const freeze of PHASE5_FREEZES){
    const p=resolveProductionSystem(freeze.ticker,freeze.version,freeze.name);
    assert.equal(p.track,"P5");
    assert.deepEqual(p.config,freeze.config);
  }
});

test("registered frontier is exactly incumbent plus three Phase 5 finalist versions",()=>{
  const versions=PRODUCTION_SYSTEMS.filter(x=>x.version==="VS13-v1.0"||x.track==="P5").map(x=>x.version).sort();
  assert.deepEqual(versions,["QLD-VS13-Scaled-v1.0","SSO-SPBT-Scaled-v1.0","UPRO-SPBT-v1.0","VS13-v1.0"]);
});

test("Production can never skip DECISION and human evidence gate",()=>{
  assert.throws(()=>transitionMode(DEFAULT_PRODUCTION_CONFIG,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true}),/DECISION/);
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  assert.throws(()=>transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Low",finalReviewComplete:true}),/Strong Forward evidence/);
  const p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  assert.equal(p.mode,"PRODUCTION");assert.equal(p.approvedByHuman,true);assert.equal(p.selectedTicker,"UPRO");
});

test("Production approval requires a lifecycle review no older than 48 hours",()=>{
  const schedule=emptyPhase5Ledger().reviewSchedule;
  const l=emptyLifecycleLedger(schedule,"2027-08-25T00:00:00Z");
  assert.equal(lifecycleReviewIsFresh(l,"2027-08-26T23:59:59Z"),true);
  assert.equal(lifecycleReviewIsFresh(l,"2027-08-27T00:00:01Z"),false);
  assert.equal(lifecycleReviewIsFresh({...l,updatedAt:"invalid"},"2027-08-25T01:00:00Z"),false);
  assert.equal(lifecycleReviewIsFresh(l,"2027-08-24T23:59:59Z"),false);
});
