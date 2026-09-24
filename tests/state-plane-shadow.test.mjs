import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const path = ".github/workflows/state-plane-shadow-mirror.yml";

test("shadow state mirror is non-authoritative and cannot write main", async () => {
  const text = await readFile(path, "utf8");
  assert.match(text, /workflow_run:/);
  for (const writer of ["Daily TQQQ Signal","Phase 5 Forward Gate","Autonomous Lifecycle Review","Human Production Approval"]) {
    assert.match(text, new RegExp(writer.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\test("shadow state mirror is non-authoritative and cannot write main", async () => {
  const text = await readFile(path, "utf8");
  assert.match(text, /branches:\s*\[main\]/);")));
  }
  assert.match(text, /github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(text, /branches:\s*\[main\]/);
  assert.match(text, /ref:\s*ops-state/);
  assert.match(text, /git push origin HEAD:ops-state/);
  assert.doesNotMatch(text, /git push[^\n]*HEAD:main/);
  assert.match(text, /"authoritative":?\s*false|authoritative:\s*false/);
  assert.doesNotMatch(text, /^\s*schedule:\s*$/m);
});

test("shadow state mirror copies only operational data plus its non-authoritative state-plane metadata", async () => {
  const text = await readFile(path, "utf8");
  assert.match(text, /rm -rf state\/github-pages\/public\/data/);
  assert.match(text, /cp -a source\/github-pages\/public\/data\/\. state\/github-pages\/public\/data\//);
  assert.match(text, /git add github-pages\/public\/data state-plane\/mirror-manifest\.json state-plane\/canary\.json/);
  assert.match(text, /updateStatePlaneCanary/);
  assert.match(text, /Unexpected path in ops-state mirror/);
});

test("source checkout is read-only while only ops-state checkout retains write credentials", async () => {
  const text = await readFile(path, "utf8");
  const sourceBlock = text.slice(text.indexOf("Checkout current authoritative main source"), text.indexOf("Checkout isolated ops-state target"));
  const stateBlock = text.slice(text.indexOf("Checkout isolated ops-state target"), text.indexOf("Mirror operational state only"));
  assert.match(sourceBlock, /ref:\s*main/);
  assert.match(sourceBlock, /fetch-depth:\s*0/);
  assert.match(sourceBlock, /persist-credentials:\s*false/);
  assert.match(text, /SOURCE_MAIN_SHA="\$\(git -C source rev-parse HEAD\)"/);
  assert.doesNotMatch(text, /SOURCE_MAIN_SHA:\s*\$\{\{\s*github\.sha\s*\}\}/);
  assert.match(stateBlock, /persist-credentials:\s*true/);
  assert.doesNotMatch(text, /secrets\./);
  assert.doesNotMatch(text, /npm\s+(ci|install)|pnpm|yarn/);
});
