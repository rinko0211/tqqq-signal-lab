import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("app/page.tsx","utf8"),p5=fs.readFileSync("app/phase5-ui.tsx","utf8"),life=fs.readFileSync("app/lifecycle-ui.tsx","utf8");

test("holdings action uses selected live ticker and never hardcodes TQQQ trade instruction",()=>{
  assert.match(page,/currentTicker=dailySignal\?\.assetTicker\|\|"TQQQ"/);
  assert.doesNotMatch(page,/`TQQQ比率を\$\{target \* 100\}%まで(?:増加|縮小)`/);
});

test("device-local holdings are tagged and invalidated across ticker/version transitions",()=>{
  assert.match(page,/ticker\?: string/);assert.match(page,/version\?: string/);
  assert.match(page,/holdingsMatch=/);assert.match(page,/旧Tickerの保有値は流用しません/);
  assert.match(page,/ticker:dailySignal\?\.assetTicker\|\|"TQQQ"/);
});

test("unsafe stale or failed signal fails closed at the primary action",()=>{
  assert.match(page,/authorityUnsafe=Boolean\(!dailySignal\|\|!runtimeStatus\|\|!productionConfigIsValid\(productionConfig\)\|\|!forwardLedger\)/);
  assert.match(page,/signalUnsafe=Boolean\(authorityUnsafe\|\|runtimeStatus\?\.state==="failed"\|\|fresh\?\.stale\)/);
  assert.match(page,/売買しない：データ\/Signalが安全確認できません/);
  assert.match(page,/売買しない・System Status確認/);
});

test("primary UI distinguishes Research operational baseline from human-approved Production",()=>{
  assert.match(page,/Operational Baseline · Research/);
  assert.match(page,/正式Production · Human Approved/);
  assert.match(p5,/OPERATIONAL BASELINE · NOT FORMAL PRODUCTION/);
  assert.match(p5,/FORMAL PRODUCTION · HUMAN APPROVED/);
});

test("Forward uses a model index and explicitly rejects actual-JPY interpretation",()=>{
  assert.match(page,/Forward Model指数/);assert.match(page,/Model指数開始/);
  assert.match(p5,/Forward Model指数/);assert.match(p5,/Model指数\/Return/);
  assert.match(page,/FX・税・実brokerコスト/);assert.match(p5,/実円口座残高ではありません/);
});

test("integrated frontier uses Lifecycle formal gate and labels legacy checkpoints separately",()=>{
  assert.match(p5,/Lifecycle Formal Gate/);assert.match(p5,/ledger\.reviewSchedule\.formal/);
  assert.match(page,/Legacy checkpoint/);assert.match(page,/Legacy 12M checkpoint/);
});

test("user lifecycle guide uses authoritative 6 12 and 24 month dates",()=>{
  assert.match(page,/2027-02-25/);assert.match(page,/2027-08-25/);assert.match(page,/2028-08-25/);
  assert.match(page,/Review \/ 次のAction → Formal Gate/);
});

test("Phase 6 UI separates operational eligibility from Production selection and shows human approval steps",()=>{
  assert.match(life,/Operationally eligible ≠ Production-selectable/);
  assert.match(life,/Human Production Approval/);assert.match(life,/APPROVE PRODUCTION/);
  assert.match(life,/実brokerコスト・税・FX/);
});

test("Production registry does not imply present eligibility",()=>{
  assert.match(page,/Registryは技術的に登録済みのVersion一覧/);
  assert.match(page,/Production-selectableとして表示されたVersionだけ/);
});
