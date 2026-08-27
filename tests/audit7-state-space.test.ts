import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRODUCTION_CONFIG,
  assertProductionConfigIntegrity,
  cancelDecision,
  productionConfigIsValid,
  transitionMode,
  type ProductionConfig,
} from "../lib/production.ts";
import {
  dailyBarIsComplete,
  earliestLegalNyseOpen,
  effectiveReviewSession,
  nyseExecutionWindow,
  nyseReviewBoundaryReached,
} from "../lib/market-calendar.ts";
import {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
import {emptyLifecycleLedger,type LifecycleLedger} from "../lib/lifecycle-review.ts";
import {emptyPhase5Ledger} from "../lib/phase5-forward.ts";

/**
 * Audit 7 — State-Space & Discontinuity discovery probes.
 * Derived from the frozen assurance model, not replayed from Audit 5/6.
 */

test("A7 FC-02/16: every 1-of-3 and 2-of-3 Production identity is malformed in every mode",()=>{
  const fields=["selectedTicker","selectedStrategy","strategyVersion"] as const;
  const values={selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"};
  for(const mode of ["RESEARCH","DECISION","PRODUCTION"] as const){
    for(let mask=1;mask<7;mask++){
      const p={...DEFAULT_PRODUCTION_CONFIG,mode} as ProductionConfig;
      fields.forEach((field,i)=>{if(mask&(1<<i))(p as any)[field]=values[field]});
      assert.equal(productionConfigIsValid(p),false,`${mode} partial mask ${mask} must fail closed`);
      assert.throws(()=>assertProductionConfigIntegrity(p),/CONFIG-/);
    }
  }
});

test("A7 FC-02/16: incomplete schema and malformed authority/review dates fail closed",()=>{
  const missingUpdatedAt={...DEFAULT_PRODUCTION_CONFIG} as any;delete missingUpdatedAt.updatedAt;
  assert.throws(()=>assertProductionConfigIntegrity(missingUpdatedAt),/CONFIG-003/);
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const p=transitionMode(d,"PRODUCTION",{ticker:"TQQQ",system:"Volatility Shield 13%",version:"VS13-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  for(const bad of [
    {...p,approvalDate:"not-a-date"},
    {...p,effectiveDate:"2027-99-99"},
    {...p,lastHealthReview:"2027-02-31"},
    {...p,nextHealthReview:"bad"},
    {...p,updatedAt:"bad"},
  ])assert.throws(()=>assertProductionConfigIntegrity(bad),/CONFIG-/);
});

test("A7 FC-02/04: transition and cancel boundaries independently reject malformed current authority",()=>{
  const malformed={...DEFAULT_PRODUCTION_CONFIG,mode:"DECISION",selectedTicker:"TQQQ"} as ProductionConfig;
  assert.throws(()=>transitionMode(malformed,"DECISION"),/CONFIG-/);
  assert.throws(()=>cancelDecision(malformed),/CONFIG-/);
  const missing={...DEFAULT_PRODUCTION_CONFIG} as any;delete missing.selectedStrategy;
  assert.throws(()=>transitionMode(missing,"RESEARCH"),/CONFIG-/);
});

test("A7 FC-04: DECISION may intentionally retain one complete approved incumbent and cancel restores it",()=>{
  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  const review=transitionMode(p,"DECISION");
  assert.doesNotThrow(()=>assertProductionConfigIntegrity(review));
  assert.equal(review.mode,"DECISION");assert.equal(review.approvedByHuman,true);assert.equal(review.selectedTicker,"UPRO");
  const restored=cancelDecision(review);assert.equal(restored.mode,"PRODUCTION");assert.equal(restored.selectedTicker,"UPRO");assert.equal(restored.effectiveDate,p.effectiveDate);
});

test("A7 FC-01: formal review holiday boundary rolls to the next legal session close",()=>{
  assert.equal(effectiveReviewSession("2027-07-04"),"2027-07-06");
  assert.equal(nyseReviewBoundaryReached("2027-07-04","2027-07-06T19:59:00Z"),false);
  assert.equal(nyseReviewBoundaryReached("2027-07-04","2027-07-06T20:01:00Z"),true);
});

test("A7 FC-01/12: quarterly Production Health due on an NYSE holiday waits for the next legal session close",()=>{
  const decision=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const production=transitionMode(decision,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});
  const lifecycle=emptyLifecycleLedger(emptyPhase5Ledger().reviewSchedule,"2027-11-24T22:00:00Z") as LifecycleLedger;
  lifecycle.current.productionHealth={state:"Healthy",version:"UPRO-SPBT-v1.0",reasons:["ok"],nextHealthReview:"2027-11-25"};
  const before=updateProductionHealthLedger({production,lifecycle,prior:emptyProductionHealthLedger(),now:"2027-11-25T12:00:00Z"});
  assert.equal(before.events.length,0,"Thanksgiving must not be recorded as an ON_TIME NYSE review session");
  const preClose=updateProductionHealthLedger({production,lifecycle,prior:before,now:"2027-11-26T20:59:00Z"});
  assert.equal(preClose.events.length,0,"review boundary remains closed until the conservative 16:00 ET boundary");
  const afterClose=updateProductionHealthLedger({production,lifecycle,prior:preClose,now:"2027-11-26T21:01:00Z"});
  assert.equal(afterClose.events.length,1);assert.equal(afterClose.events[0].dueDate,"2027-11-25");
});

test("A7 FC-01/09: partial Daily data cannot become complete before close+grace",()=>{
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T19:59:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T20:14:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T20:16:00Z"),true);
});

test("A7 FC-01/08: delayed observation after theoretical open never authorizes the expired open",()=>{
  const legal=earliestLegalNyseOpen("2026-08-26","2026-08-27T14:00:00Z");
  assert.equal(legal,"2026-08-28");
  assert.equal(nyseExecutionWindow("2026-08-27","2026-08-27T14:00:00Z"),"OPEN_PASSED");
  assert.equal(nyseExecutionWindow(legal,"2026-08-27T14:00:00Z"),"UPCOMING_OPEN");
});
