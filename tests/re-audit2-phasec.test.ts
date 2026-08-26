import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PRODUCTION_CONFIG,cancelDecision,hasActiveProduction,transitionMode} from "../lib/production.ts";
import {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
import type {LifecycleLedger} from "../lib/lifecycle-review.ts";
import fs from "node:fs";

const approve={ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true};
const lifecycle=(version:string):LifecycleLedger=>({schemaVersion:1,createdAt:"2027-08-25T00:00:00Z",updatedAt:"2027-08-25T00:00:00Z",appendOnly:true,schedule:{interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"},events:[],current:{asOf:"2027-08-25",stage:"FORMAL",systemDecision:"PHASE6_HUMAN_DECISION_REQUIRED",userAction:"RUN_PHASE6_HUMAN_REVIEW",message:"test",candidateReviews:[],productionHealth:{state:"Healthy",version,reasons:[],nextHealthReview:"2027-11-25"},nextReview:"2028-08-25"}});

test("Production can only be entered immediately from DECISION",()=>{
  assert.throws(()=>transitionMode(DEFAULT_PRODUCTION_CONFIG,"PRODUCTION",approve),/DECISION review/);
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const p=transitionMode(d,"PRODUCTION",approve);
  assert.equal(p.mode,"PRODUCTION");assert.equal(hasActiveProduction(p),true);
  assert.throws(()=>transitionMode(p,"PRODUCTION",approve),/DECISION review/);
});

test("Decision from active Production preserves the active approved system",()=>{
  const p=transitionMode(transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),"PRODUCTION",approve);
  const d=transitionMode(p,"DECISION");
  assert.equal(d.mode,"DECISION");assert.equal(d.approvedByHuman,true);assert.equal(d.selectedTicker,"UPRO");assert.equal(hasActiveProduction(d),true);
  const back=cancelDecision(d);assert.equal(back.mode,"PRODUCTION");assert.equal(back.selectedTicker,"UPRO");assert.equal(back.strategyVersion,"UPRO-SPBT-v1.0");
});

test("Decision without prior Production cancels back to Research",()=>{
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");assert.equal(hasActiveProduction(d),false);
  const back=cancelDecision(d);assert.equal(back.mode,"RESEARCH");assert.equal(back.approvedByHuman,false);assert.equal(back.selectedTicker,null);
});

test("same-system reaffirmation preserves effective date and quarterly health schedule",()=>{
  const p=transitionMode(transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),"PRODUCTION",approve);
  const withSchedule={...p,effectiveDate:"2027-08-25",nextHealthReview:"2028-02-25"};
  const d=transitionMode(withSchedule,"DECISION");
  const reaffirm=transitionMode(d,"PRODUCTION",{...approve,date:"2028-08-25"});
  assert.equal(reaffirm.effectiveDate,"2027-08-25");assert.equal(reaffirm.nextHealthReview,"2028-02-25");assert.equal(reaffirm.approvalDate,"2028-08-25");
});

test("Production health remains active while human Decision is pending",()=>{
  const p=transitionMode(transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),"PRODUCTION",approve),d=transitionMode(p,"DECISION");
  const out=updateProductionHealthLedger({production:d,lifecycle:lifecycle("UPRO-SPBT-v1.0"),prior:emptyProductionHealthLedger("2027-08-25T00:00:00Z"),now:"2027-08-26T00:00:00Z"});
  assert.equal(out.current.active,true);assert.equal(out.current.version,"UPRO-SPBT-v1.0");
});

test("approval workflow exposes cancel and explicit baseline exit actions",()=>{
  const y=fs.readFileSync(".github/workflows/approve-production.yml","utf8"),s=fs.readFileSync("scripts/approve-production.ts","utf8"),d=fs.readFileSync("scripts/generate-daily.ts","utf8");
  assert.match(y,/CANCEL_DECISION/);assert.match(y,/RESEARCH/);assert.match(y,/EXIT PRODUCTION/);
  assert.match(s,/cancelDecision/);assert.match(s,/EXIT PRODUCTION/);
  assert.match(d,/hasActiveProduction\(production\)/);
});
