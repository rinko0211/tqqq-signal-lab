import test from "node:test";
import assert from "node:assert/strict";
import { SCREENING } from "../lib/cross-ticker.ts";
import { PHASE1_COMMON_START } from "../lib/phase1-screening.ts";

const core = ["TQQQ", "QLD", "UPRO", "SSO"];
const families = ["VS13_FIXED", "SIMPLE_200DMA", "VS13_VOL30", "VS13_LEVERAGE_SCALED_STOP"];

test("phase 1.5 universe is exactly the four pre-registered core tickers", () => {
  for (const ticker of core) assert.ok(SCREENING.some((x) => x.ticker === ticker && x.researchPhase === "CORE"));
  assert.equal(core.length, 4);
});

test("phase 1.5 family budget stays capped at four", () => {
  assert.deepEqual(families, ["VS13_FIXED", "SIMPLE_200DMA", "VS13_VOL30", "VS13_LEVERAGE_SCALED_STOP"]);
  assert.equal(families.length, 4);
});

test("phase 1.5 common period remains locked", () => {
  assert.equal(PHASE1_COMMON_START, "2016-08-22");
});

test("mechanical leverage-scaled stop is pre-determined, not fitted", () => {
  const stop = (lev: number) => 0.13 * lev / 3;
  assert.ok(Math.abs(stop(3) - 0.13) < 1e-12);
  assert.ok(Math.abs(stop(2) - 0.08666666666666667) < 1e-12);
});
