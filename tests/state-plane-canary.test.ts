import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyStatePlaneCanary,
  updateStatePlaneCanary,
  assertStatePlaneCanaryIntegrity,
} from "../lib/state-plane-canary.ts";

const sha40 = "a".repeat(40);
const sha64 = "b".repeat(64);
const ok = (date:string) => ({
  actionStatus: "success",
  state: "latest",
  errors: [],
  marketDataDate: date,
  generatedAt: `${date}T22:30:00.000Z`,
});

test("P1a canary ignores the pre-canary baseline session", () => {
  const x = updateStatePlaneCanary({ status: ok("2026-09-22"), sourceMainSha: sha40, dataTreeSha256: sha64 });
  assert.equal(x.counter, "S0/3");
  assert.equal(x.canaryState, "ACTIVE");
  assert.equal(x.lastObservation?.classification, "PRE_CANARY_BASELINE");
});

test("P1a canary completes only after three consecutive NYSE sessions", () => {
  let x = emptyStatePlaneCanary();
  for (const [date,counter] of [["2026-09-23","S1/3"],["2026-09-24","S2/3"],["2026-09-25","S3/3"]] as const) {
    x = updateStatePlaneCanary({ prior:x, status:ok(date), sourceMainSha:sha40, dataTreeSha256:sha64 });
    assert.equal(x.counter,counter);
  }
  assert.deepEqual(x.successfulDates,["2026-09-23","2026-09-24","2026-09-25"]);
  assert.equal(x.canaryState,"COMPLETE");
  assert.equal(x.lastObservation?.classification,"PASS_COUNTABLE");
  assert.doesNotThrow(()=>assertStatePlaneCanaryIntegrity(x));
});

test("duplicate or older sessions never increment the canary", () => {
  let x = updateStatePlaneCanary({ status:ok("2026-09-23"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  x = updateStatePlaneCanary({ prior:x, status:ok("2026-09-23"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  assert.equal(x.counter,"S1/3");
  assert.equal(x.lastObservation?.classification,"DUPLICATE_OR_OLD");
});

test("a skipped NYSE session fails closed and requires rebaseline", () => {
  let x = updateStatePlaneCanary({ status:ok("2026-09-23"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  x = updateStatePlaneCanary({ prior:x, status:ok("2026-09-25"), sourceMainSha:sha40, dataTreeSha256:sha64 });
  assert.equal(x.counter,"S1/3");
  assert.equal(x.canaryState,"RESET_REQUIRED");
  assert.deepEqual(x.gap,{expected:"2026-09-24",observed:"2026-09-25"});
});

test("non-countable source state is mirrored but not counted", () => {
  const x = updateStatePlaneCanary({
    status:{...ok("2026-09-23"),state:"provider_pending"},
    sourceMainSha:sha40,
    dataTreeSha256:sha64,
  });
  assert.equal(x.counter,"S0/3");
  assert.equal(x.canaryState,"ACTIVE");
  assert.equal(x.lastObservation?.classification,"SOURCE_NOT_COUNTABLE");
});

test("malformed canary history cannot be silently blessed", () => {
  const x = emptyStatePlaneCanary();
  x.successfulDates=["2026-09-24"];
  x.counter="S1/3";
  assert.throws(()=>assertStatePlaneCanaryIntegrity(x),/NON_CONSECUTIVE/);
});
