import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyStatePlaneCanary,
  updateStatePlaneCanary,
  assertStatePlaneCanaryIntegrity,
} from "../lib/state-plane-canary.ts";

const sha40 = "a".repeat(40);
const sha64 = "b".repeat(64);
const legacySha40 = "c".repeat(40);
const legacySha64 = "d".repeat(64);
const ok = (date:string) => ({
  actionStatus: "success",
  state: "latest",
  errors: [],
  marketDataDate: date,
  generatedAt: `${date}T22:30:00.000Z`,
});

const authorizedLegacyReset = () => ({
  schemaVersion: 1,
  mode: "P1A_SHADOW_CANARY",
  authoritative: false,
  startAfterMarketDate: "2026-09-22",
  targetSessions: 3,
  successfulDates: [],
  counter: "S0/3",
  canaryState: "RESET_REQUIRED",
  gap: { expected: "2026-09-23", observed: "2026-09-24" },
  lastObservation: {
    sourceMainSha: legacySha40,
    dataTreeSha256: legacySha64,
    marketDataDate: "2026-09-24",
    generatedAt: "2026-09-25T17:45:35.251Z",
    classification: "GAP_DETECTED",
  },
});

test("P1a v2 canary ignores the 2026-09-24 rebaseline session", () => {
  const x = updateStatePlaneCanary({ status: ok("2026-09-24"), sourceMainSha: sha40, dataTreeSha256: sha64 });
  assert.equal(x.baselineId, "p1a-workflow-run-v2");
  assert.equal(x.startAfterMarketDate, "2026-09-24");
  assert.equal(x.counter, "S0/3");
  assert.equal(x.canaryState, "ACTIVE");
  assert.equal(x.lastObservation?.classification, "PRE_CANARY_BASELINE");
});

test("P1a v2 completes only after three consecutive NYSE sessions", () => {
  let x = emptyStatePlaneCanary();
  for (const [date,counter] of [["2026-09-25","S1/3"],["2026-09-28","S2/3"],["2026-09-29","S3/3"]] as const) {
    x = updateStatePlaneCanary({ prior:x, status:ok(date), sourceMainSha:sha40, dataTreeSha256:sha64 });
    assert.equal(x.counter,counter);
  }
  assert.deepEqual(x.successfulDates,["2026-09-25","2026-09-28","2026-09-29"]);
  assert.equal(x.canaryState,"COMPLETE");
  assert.equal(x.lastObservation?.classification,"PASS_COUNTABLE");
  assert.doesNotThrow(()=>assertStatePlaneCanaryIntegrity(x));
});

test("duplicate or older sessions never increment the canary", () => {
  let x = updateStatePlaneCanary({ status:ok("2026-09-25"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  x = updateStatePlaneCanary({ prior:x, status:ok("2026-09-25"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  assert.equal(x.counter,"S1/3");
  assert.equal(x.lastObservation?.classification,"DUPLICATE_OR_OLD");
});

test("a skipped NYSE session fails closed and requires rebaseline", () => {
  let x = updateStatePlaneCanary({ status:ok("2026-09-25"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  x = updateStatePlaneCanary({ prior:x, status:ok("2026-09-29"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  assert.equal(x.counter,"S1/3");
  assert.equal(x.canaryState,"RESET_REQUIRED");
  assert.deepEqual(x.gap,{expected:"2026-09-28",observed:"2026-09-29"});
});

test("non-countable source state is mirrored but not counted", () => {
  const x = updateStatePlaneCanary({
    status:{...ok("2026-09-25"),state:"provider_pending"},
    sourceMainSha:sha40,
    dataTreeSha256:sha64,
  });
  assert.equal(x.counter,"S0/3");
  assert.equal(x.canaryState,"ACTIVE");
  assert.equal(x.lastObservation?.classification,"SOURCE_NOT_COUNTABLE");
});

test("the exact known trigger-defect RESET is rebaselined once without inventing a session", () => {
  const x = updateStatePlaneCanary({
    prior: authorizedLegacyReset(),
    status: ok("2026-09-24"),
    sourceMainSha: sha40,
    dataTreeSha256: sha64,
  });
  assert.equal(x.counter,"S0/3");
  assert.equal(x.canaryState,"ACTIVE");
  assert.equal(x.startAfterMarketDate,"2026-09-24");
  assert.equal(x.lastObservation?.classification,"PRE_CANARY_BASELINE");
  assert.deepEqual(x.successfulDates,[]);
  assert.equal(x.rebaseline?.previousState,"RESET_REQUIRED");
  assert.deepEqual(x.rebaseline?.previousGap,{expected:"2026-09-23",observed:"2026-09-24"});
  assert.equal(x.rebaseline?.previousSourceMainSha,legacySha40);
  assert.equal(x.rebaseline?.previousDataTreeSha256,legacySha64);
  assert.equal(x.rebaseline?.reason,"GITHUB_ACTIONS_PUSH_RECURSION_TRIGGER_DEFECT_FIXED");
  assert.doesNotThrow(()=>assertStatePlaneCanaryIntegrity(x));
});

test("a different RESET cannot be silently normalized", () => {
  const legacy = authorizedLegacyReset();
  legacy.gap = { expected:"2026-09-23", observed:"2026-09-25" };
  assert.throws(
    ()=>updateStatePlaneCanary({ prior:legacy, status:ok("2026-09-25"), sourceMainSha:sha40, dataTreeSha256:sha64 }),
    /STATE_PLANE_CANARY_INVALID/,
  );
});

test("malformed v2 canary history cannot be silently blessed", () => {
  const x = emptyStatePlaneCanary();
  x.successfulDates=["2026-09-28"];
  x.counter="S1/3";
  assert.throws(()=>assertStatePlaneCanaryIntegrity(x),/NON_CONSECUTIVE/);
});
