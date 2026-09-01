import test from "node:test";
import assert from "node:assert/strict";
import {
  assessSoakSession,
  freezeRemediatedBaseline,
  recordMaterialControlPlaneChange,
  restartSoakAfterFailure,
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
  soakId = "soak-a",
  baseline = "baseline-v1",
): SoakSessionEvidence {
  return {
    soakId,
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
  const result = assessSoakSession(startSoak("soak-a", "baseline-v1"), evidence);
  assert.equal(result.disposition, "FAIL");
  assert.equal(result.reason, "FAILED_SCHEDULED_ATTEMPT");
  assert.equal(result.state.consecutivePasses, 0);
  assert.equal(result.state.phase, "CLOSED_FAILED");
});

test("a material patch closes the old sequence and requires a distinct new soak id", () => {
  const state = {
    ...startSoak("soak-a", "baseline-v1"),
    consecutivePasses: 4,
  };
  const reset = recordMaterialControlPlaneChange(state);
  assert.equal(reset.soakId, "soak-a");
  assert.equal(reset.baseline, null);
  assert.equal(reset.consecutivePasses, 0);
  assert.equal(reset.phase, "REBASELINE_REQUIRED");
  assert.throws(
    () => freezeRemediatedBaseline(reset, "soak-a", "baseline-v2"),
    /distinct new soak id/,
  );
});

test("a new soak does not inherit the prior soak failure, date cursor, or counter", () => {
  const oldEvidence = cleanSession("2026-08-31");
  oldEvidence.daily.attempts = [failure, success];
  const oldFailed = assessSoakSession(
    startSoak("soak-a", "baseline-v1"),
    oldEvidence,
  ).state;
  assert.equal(oldFailed.phase, "CLOSED_FAILED");

  const needsBaseline = recordMaterialControlPlaneChange(oldFailed);
  const newSoak = freezeRemediatedBaseline(
    needsBaseline,
    "soak-b",
    "baseline-v2",
  );
  assert.deepEqual(newSoak, {
    soakId: "soak-b",
    baseline: "baseline-v2",
    consecutivePasses: 0,
    phase: "COUNTING",
    lastAssessedSession: null,
  });

  const firstNewSession = assessSoakSession(
    newSoak,
    cleanSession("2026-09-01", "soak-b", "baseline-v2"),
  );
  assert.equal(firstNewSession.disposition, "PASS");
  assert.equal(firstNewSession.state.consecutivePasses, 1);
  assert.equal(oldFailed.phase, "CLOSED_FAILED");
});

test("a replacement soak on the same unchanged baseline starts independently at one", () => {
  const evidence = cleanSession("2026-09-01");
  evidence.lifecycle.attempts = [];
  const failed = assessSoakSession(
    startSoak("soak-a", "baseline-v1"),
    evidence,
  );
  assert.equal(failed.disposition, "NOT_COUNTED");
  assert.equal(failed.state.phase, "CLOSED_FAILED");

  const replacement = restartSoakAfterFailure(failed.state, "soak-b");
  const first = assessSoakSession(
    replacement,
    cleanSession("2026-09-02", "soak-b", "baseline-v1"),
  );
  assert.equal(first.disposition, "PASS");
  assert.equal(first.state.consecutivePasses, 1);
});

test("evidence from an old soak is rejected without poisoning the new soak", () => {
  const newSoak = startSoak("soak-b", "baseline-v2");
  const oldEvidence = cleanSession("2026-08-31", "soak-a", "baseline-v1");
  oldEvidence.daily.attempts = [failure];
  const result = assessSoakSession(newSoak, oldEvidence);
  assert.equal(result.disposition, "NOT_COUNTED");
  assert.equal(result.reason, "SOAK_ID_MISMATCH");
  assert.deepEqual(result.state, newSoak);
});

test("manual success cannot count and closes only its own soak sequence", () => {
  const evidence = cleanSession("2026-09-01");
  evidence.daily.attempts = [manualSuccess];
  const result = assessSoakSession(
    startSoak("soak-a", "baseline-v1"),
    evidence,
  );
  assert.equal(result.disposition, "NOT_COUNTED");
  assert.equal(result.reason, "INCOMPLETE_SCHEDULED_EVIDENCE");
  assert.equal(result.state.phase, "CLOSED_FAILED");
});

test("a control-plane mismatch fails closed and demands rebaseline", () => {
  const result = assessSoakSession(
    startSoak("soak-a", "baseline-v1"),
    cleanSession("2026-09-01", "soak-a", "unexpected-head"),
  );
  assert.equal(result.disposition, "NOT_COUNTED");
  assert.equal(result.reason, "CONTROL_PLANE_MISMATCH");
  assert.equal(result.state.phase, "REBASELINE_REQUIRED");
  assert.equal(result.state.consecutivePasses, 0);
});

test("session evidence cannot be replayed or assessed out of order within one soak", () => {
  const first = assessSoakSession(
    startSoak("soak-a", "baseline-v1"),
    cleanSession("2026-09-01"),
  );
  assert.throws(
    () => assessSoakSession(first.state, cleanSession("2026-09-01")),
    /strict date order/,
  );
});
