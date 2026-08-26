import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("app/page.tsx","utf8"),p5=fs.readFileSync("app/phase5-ui.tsx","utf8"),life=fs.readFileSync("app/lifecycle-ui.tsx","utf8");

test("holdings action uses the selected live ticker rather than hardcoded TQQQ",()=>{
  assert.match(page,/dailySignal\?\.assetTicker\|\|"TQQQ"/);
  assert.doesNotMatch(page,/`TQQQ比率を\$\{target \* 100\}%まで(?:増加|縮小)`/);
});

test("dashboard distinguishes Research baseline from human-approved Production",()=>{
  assert.match(p5,/OPERATIONAL BASELINE · RESEARCH/);
  assert.match(p5,/PRODUCTION · HUMAN APPROVED/);
  assert.match(p5,/platformMode === "PRODUCTION" && humanApproved/);
});

test("Forward displays model index instead of presenting model capital as actual JPY balance",()=>{
  assert.match(page,/Forward Model指数/);
  assert.match(p5,/Forward Model指数/);
  assert.match(page,/FX・税・実brokerコスト除外/);
  assert.match(p5,/実円口座残高ではありません/);
});

test("integrated frontier uses Lifecycle formal gate, not the legacy TQQQ checkpoint, as approval review date",()=>{
  assert.match(p5,/ledger\.reviewSchedule\.formal/);
  assert.match(p5,/Lifecycle Formal Gate/);
  assert.match(page,/Legacy checkpoint/);
});

test("Phase 6 UI separates operational eligibility from Production selection and shows human approval steps",()=>{
  assert.match(life,/Operationally eligible ≠ Production-selectable/);
  assert.match(life,/Human Production Approval/);
  assert.match(life,/APPROVE PRODUCTION/);
  assert.match(life,/実brokerコスト・税・FX/);
});
