import test from "node:test";
import assert from "node:assert/strict";
import {
  assessSoakSession,
  freezeRemediatedBaseline,
  recordMaterialControlPlaneChange,
  startSoak,
  type SoakSessionEvidence,
} from "../lib/unattended-soak.ts";

const success = { trigger: "schedule" as const, conclusion: "success" as const };
const failure = { trigger: "schedule" as const, conclusion: "failure" as const };
const manualSuccess = {
  trigger: "workflow_dispatch" as const,
  conclusion: "success" as const,
};

function cleanSession(
  sessionDate: string,
  baseline = "baseline-v1",
): SoakSessionEvidence {
  return {
    sessionDate,
    controlPlaneBaseline: baseline,
    daily: { attempts: [success] },
    phase5: { attempts: [success] },
    lifecycle: { attempts: [success] },
    pagesPublished: true,
    appendOnlyIntegrityPassed: true,
    productionRemainsResearch: true,
  };
}

test("a scheduled recovery cannot rescue an earlier scheduled failure for the same session", () => {
  const evidence = cleanSession("2026-08-31");
  evidence.daily.attempts = [failure, success];
  const result = assessSoakSession(startSoak("baseline-v1"), evidence);
  assert.equal(result.disposition, "FAIL");
  assert.equal(result.reason, "FAILED_SCHEDULED_ATTEMPT");
  assert.equal(result.state.consecutivePasses, 0);
  assert.equal(result.state.phase, "RECOVERY_VERIFICATION_REQUIRED");
});

test("a material patch resets the counter and requires a new frozen baseline", () => {
  const state = { ...startSoak("baseline-v1"), consecutivePasses: 4 };
  const reset = recordMaterialControlPlaneChange(state);
  assert.equal(reset.baseline, null);
  assert.equal(reset.consecutivePasses, 0);
  assert.equal(reset.phase, "REBASELINE_REQUIRED");
  const result = assessSoakSession(reset, cleanSession("2026-09-01"));
  assert.equal(result.reason, "CONTROL_PLANE_MISMATCH");
});

test("the first clean scheduled session after rebaseline verifies recovery but does not count", () => {
  const reset = recordMaterialControlPlaneChange(startSoak("baseline-v1"));
  const rebaselined = freezeRemediatedBaseline(reset, "baseline-v2");
  const recovery = assessSoakSession(
    rebaselined,
    cleanSession("2026-09-01", "baseline-v2"),
  );
  assert.equal(recovery.disposition, "NOT_COUNTED");
  assert.equal(recovery.reason, "RECOVERY_BOUNDARY_VERIFIED");
  assert.equal(recovery.state.consecutivePasses, 0);
  assert.equal(recovery.state.phase, "COUNTING");

  const firstCounted = assessSoakSession(
    recovery.state,
    cleanSession("2026-09-02", "baseline-v2"),
  );
  assert.equal(firstCounted.disposition, "PASS");
  assert.equal(firstCounted.state.consecutivePasses, 1);
});

test("manual success cannot prove either a session or the recovery boundary", () => {
  const reset = recordMaterialControlPlaneChange(startSoak("baseline-v1"));
  const state = freezeRemediatedBaseline(reset, "baseline-v2");
  const evidence = cleanSession("2026-09-01", "baseline-v2");
  evidence.daily.attempts = [manualSuccess];
  const result = assessSoakSession(state, evidence);
  assert.equal(result.disposition, "NOT_COUNTED");
  assert.equal(result.reason, "INCOMPLETE_SCHEDULED_EVIDENCE");
  assert.equal(result.state.phase, "RECOVERY_VERIFICATION_REQUIRED");
});

test("missing scheduled evidence creates a recovery boundary before counting resumes", () => {
  const evidence = cleanSession("2026-09-01");
  evidence.lifecycle.attempts = [];
  const missing = assessSoakSession(startSoak("baseline-v1"), evidence);
  assert.equal(missing.disposition, "NOT_COUNTED");
  assert.equal(missing.reason, "INCOMPLETE_SCHEDULED_EVIDENCE");
  assert.equal(missing.state.phase, "RECOVERY_VERIFICATION_REQUIRED");

  const recovery = assessSoakSession(
    missing.state,
    cleanSession("2026-09-02"),
  );
  assert.equal(recovery.disposition, "NOT_COUNTED");
  assert.equal(recovery.reason, "RECOVERY_BOUNDARY_VERIFIED");
});

test("a control-plane mismatch fails closed and demands another rebaseline", () => {
  const result = assessSoakSession(
    startSoak("baseline-v1"),
    cleanSession("2026-09-01", "unexpected-head"),
  );
  assert.equal(result.disposition, "NOT_COUNTED");
  assert.equal(result.reason, "CONTROL_PLANE_MISMATCH");
  assert.equal(result.state.phase, "REBASELINE_REQUIRED");
  assert.equal(result.state.consecutivePasses, 0);
});

test("session evidence cannot be replayed or assessed out of order", () => {
  const first = assessSoakSession(
    startSoak("baseline-v1"),
    cleanSession("2026-09-01"),
  );
  assert.throws(
    () => assessSoakSession(first.state, cleanSession("2026-09-01")),
    /strict date order/,
  );
});
