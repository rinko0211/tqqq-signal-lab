import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRODUCTION_CONFIG, PRODUCTION_SYSTEMS, resolveProductionSystem, transitionMode } from "../lib/production.ts";
import { PHASE5_FREEZES } from "../lib/phase5-forward.ts";

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
