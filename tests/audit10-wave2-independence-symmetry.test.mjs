import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {emptyLifecycleLedger,assertLifecycleLedgerInternalIntegrity,productionEligibleVersions} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,assertProductionHealthLedgerInternalIntegrity} from "../lib/production-health-review.ts";
import {lifecycleReviewIsFresh,lifecycleReviewCoversUpstreams} from "../lib/lifecycle-approval.ts";

/* Audit 10 Wave 2 — independence and semantic-symmetry discovery.
 * Expected relations are fixture-local temporal/evidence invariants. The test
 * intentionally does not import the market calendar or generation functions.
 */

const src=(p)=>fs.readFileSync(p,"utf8");
const schedule={interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"};

const reviewEvent=(reviewDate,recordedAt)=>({key:`FORMAL|${reviewDate}`,stage:"FORMAL",reviewDate,recordedAt,systemDecision:"CONTINUE_FORWARD_INSUFFICIENT_EVIDENCE",userAction:"NONE",candidateReviews:[]});
const healthEvent=(dueDate,recordedAt)=>({key:`VS13-v1.0|${dueDate}`,dueDate,recordedAt,version:"VS13-v1.0",state:"Healthy",timing:"ON_TIME",reasons:["Audit10 Wave2 fixture"]});

test("A10 Wave2 mechanism does not derive semantic expectations from product calendar helpers",()=>{
  const imports=src("tests/audit10-wave2-independence-symmetry.test.mjs").split("\n").filter(x=>x.startsWith("import ")).join("\n");
  assert.doesNotMatch(imports,/market-calendar|nyseReviewBoundaryReached|marketDate/);
});

test("A10 Wave2 S1: Lifecycle rejects a review event recorded before its claimed review date",()=>{
  const ledger=emptyLifecycleLedger(schedule,"2027-02-24T22:00:00.000Z");
  ledger.events.push(reviewEvent("2027-02-25","2027-02-24T21:00:00.000Z"));
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(ledger),/chronology|review|future|causal/i);
});

test("A10 Wave2 S2: Production Health rejects a review event recorded before its claimed due date",()=>{
  const ledger=emptyProductionHealthLedger("2027-11-24T22:00:00.000Z");
  ledger.events.push(healthEvent("2027-11-25","2027-11-24T21:00:00.000Z"));
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(ledger),/chronology|review|due|future|causal/i);
});

function forgedLifecycleCurrent(){
  const ledger=emptyLifecycleLedger(schedule,"2029-01-10T21:00:00.000Z");
  ledger.current={
    ...ledger.current,
    asOf:"2029-01-10",stage:"FORMAL",systemDecision:"PHASE6_HUMAN_DECISION_REQUIRED",userAction:"RUN_PHASE6_HUMAN_REVIEW",
    candidateReviews:[{version:"VS13-v1.0",ticker:"TQQQ",incumbent:true,eligible:true,promotionSelectable:true,promotionMerit:"INCUMBENT",reasons:[],observations:300,liveObservations:300,missingRatio:0,executions:10,actionDaysPerYear:10,regimes:3,regimeFamilies:["RISK_ON","RISK_OFF","STRESS"],regimeCoverageOk:true,totalReturn:.5,sortino:2,calmar:1,maxDd:-.2,historicalDd:-.3816,adverseDdFloor:-.4816,evidence:"Strong",paretoCommonDays:300,decision:"ELIGIBLE"}],
    nextReview:"2029-01-10",reviewCycleDate:"2029-01-10",reviewResolved:false,reviewResolvedAt:null,
  };
  return ledger;
}

test("A10 Wave2 S3: fresh Lifecycle current cannot claim a human-review authority state without supporting event history",()=>{
  const ledger=forgedLifecycleCurrent();
  assert.equal(ledger.events.length,0,"fixture deliberately has no scheduled-review evidence");
  assert.equal(lifecycleReviewIsFresh(ledger,"2029-01-10T22:00:00.000Z"),true,"freshness alone accepts fixture");
  assert.equal(lifecycleReviewCoversUpstreams(ledger,["2029-01-10T20:00:00.000Z","2029-01-10T20:30:00.000Z"]),true,"upstream-age gate alone accepts fixture");
  assert.throws(()=>productionEligibleVersions(ledger),/current|history|review|evidence|coherence/i,"approval selector must fail closed on unsupported current authority");
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(ledger),/current|history|review|evidence|coherence/i,"ledger integrity must reject unsupported current authority before approval consumers can use it");
});

test("A10 Wave2 S4: Production Health current lastReview cannot point to nonexistent event evidence",()=>{
  const ledger=emptyProductionHealthLedger("2029-01-10T21:00:00.000Z");
  ledger.current={active:true,version:"VS13-v1.0",lastReview:"2029-01-10",nextReview:"2029-04-10",state:"Healthy",userAction:"NONE",message:"forged fresh current"};
  assert.equal(ledger.events.length,0);
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(ledger),/current|history|review|evidence|coherence/i);
});

test("A10 Wave2 S5: user-facing and approval surfaces consume Lifecycle/Health current directly",()=>{
  const ui=src("app/lifecycle-ui.tsx"),approve=src("scripts/approve-production.ts");
  assert.match(ui,/health\?\.current\.userAction/);assert.match(ui,/review\.current/);
  assert.match(approve,/lifecycle\.current\.systemDecision/);assert.match(approve,/productionEligibleVersions\(lifecycle\)/);
  assert.ok(approve.includes("assertLifecycleLedgerInternalIntegrity(lifecycle)"),"Production approval must validate Lifecycle provenance before consuming current authority");
});
