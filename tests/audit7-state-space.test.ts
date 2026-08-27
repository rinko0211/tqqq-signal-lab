import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRODUCTION_CONFIG,
  assertProductionConfigIntegrity,
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

/**
 * Audit 7 — State-Space & Discontinuity discovery probes.
 *
 * These are audit assertions derived from the frozen Multi-Audit Assurance
 * Protocol v1.0, not regression replays from Audit 5/6. A failure is evidence
 * to investigate and classify before any remediation.
 */

test("A7 FC-02/16: partial Production identity is malformed authority in every control mode",()=>{
  const partials:ProductionConfig[]=[
    {...DEFAULT_PRODUCTION_CONFIG,selectedTicker:"TQQQ"},
    {...DEFAULT_PRODUCTION_CONFIG,selectedStrategy:"Volatility Shield 13%"},
    {...DEFAULT_PRODUCTION_CONFIG,strategyVersion:"VS13-v1.0"},
    {...DEFAULT_PRODUCTION_CONFIG,mode:"DECISION",selectedTicker:"TQQQ"},
    {...DEFAULT_PRODUCTION_CONFIG,mode:"DECISION",selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%"},
  ];
  for(const p of partials){
    assert.equal(productionConfigIsValid(p),false,`partial authority must fail closed: ${JSON.stringify(p)}`);
    assert.throws(()=>assertProductionConfigIntegrity(p),/CONFIG-/);
  }
});

test("A7 FC-02: approved authority requires structurally valid approval/effective timestamps",()=>{
  const validDecision=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  const approved=transitionMode(validDecision,"PRODUCTION",{
    ticker:"TQQQ",system:"Volatility Shield 13%",version:"VS13-v1.0",
    date:"2027-08-25",evidence:"Strong",finalReviewComplete:true,
  });
  assert.doesNotThrow(()=>assertProductionConfigIntegrity(approved));
  assert.throws(()=>assertProductionConfigIntegrity({...approved,approvalDate:"not-a-date"}),/CONFIG-/);
  assert.throws(()=>assertProductionConfigIntegrity({...approved,effectiveDate:"2027-99-99"}),/CONFIG-/);
});

test("A7 FC-02/04: transition library refuses malformed current authority rather than carrying it forward",()=>{
  const malformed={...DEFAULT_PRODUCTION_CONFIG,selectedTicker:"TQQQ"} as ProductionConfig;
  assert.throws(()=>transitionMode(malformed,"DECISION"),/CONFIG-/);
});

test("A7 FC-01: formal review holiday boundary rolls to the next legal session close",()=>{
  assert.equal(effectiveReviewSession("2027-07-04"),"2027-07-06");
  assert.equal(nyseReviewBoundaryReached("2027-07-04","2027-07-06T19:59:00Z"),false);
  assert.equal(nyseReviewBoundaryReached("2027-07-04","2027-07-06T20:01:00Z"),true);
});

test("A7 FC-01/09: partial Daily data cannot become complete or actionable before close+grace",()=>{
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T19:59:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T20:14:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-27","2026-08-27T20:16:00Z"),true);
});

test("A7 FC-01/08: delayed observation after theoretical open never authorizes the expired open",()=>{
  const legal=earliestLegalNyseOpen("2026-08-26","2026-08-27T14:00:00Z"); // 10:00 ET, after 09:30 open
  assert.equal(legal,"2026-08-28");
  assert.equal(nyseExecutionWindow("2026-08-27","2026-08-27T14:00:00Z"),"OPEN_PASSED");
  assert.equal(nyseExecutionWindow(legal,"2026-08-27T14:00:00Z"),"UPCOMING_OPEN");
});
