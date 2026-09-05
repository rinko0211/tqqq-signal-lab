import test from "node:test";
import assert from "node:assert/strict";
import { makePaperBackup, normalizePaperConfig, validatePaperBackup } from "../lib/paper-persistence.ts";

const config = { initialJpy: 1_000_000, startDate: "2026-09-04", fxRate: 150 };

test("Paper config accepts only positive values and an exact calendar date", () => {
  assert.deepEqual(normalizePaperConfig(config), config);
  assert.equal(normalizePaperConfig({ ...config, initialJpy: 0 }), null);
  assert.equal(normalizePaperConfig({ ...config, fxRate: 0 }), null);
  assert.equal(normalizePaperConfig({ ...config, startDate: "2026-02-31" }), null);
  assert.equal(normalizePaperConfig({ ...config, startDate: "not-a-date" }), null);
});

test("Paper backup round-trips a validated config", () => {
  const backup = makePaperBackup(config, 1_800_000_000_000);
  const restored = validatePaperBackup(backup);
  assert.ok(restored);
  assert.deepEqual(restored.config, config);
  assert.equal(restored.updatedAt, 1_800_000_000_000);
});

test("Paper backup rejects config or checksum tampering", () => {
  const backup = makePaperBackup(config, 1_800_000_000_000);
  assert.equal(validatePaperBackup({ ...backup, config: { ...config, fxRate: 151 } }), null);
  assert.equal(validatePaperBackup({ ...backup, checksum: "00000000" }), null);
  assert.equal(validatePaperBackup({ ...backup, schema: 2 }), null);
});

test("Paper backup creation rejects invalid config", () => {
  assert.throws(() => makePaperBackup({ ...config, initialJpy: -1 }), /Invalid Paper Trading configuration/);
});
