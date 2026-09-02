import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("app/page.tsx","utf8"),p5=fs.readFileSync("app/phase5-ui.tsx","utf8"),life=fs.readFileSync("app/lifecycle-ui.tsx","utf8"),authority=fs.readFileSync("lib/operational-authority.ts","utf8"),primary=fs.readFileSync("lib/primary-action.ts","utf8");

test("browser freshness banner prioritizes pending or delayed live state over a prior persisted success message",()=>{
  assert.match(page,/fresh\?\.pending\|\|fresh\?\.state==="DELAYED"\|\|fresh\?\.state==="INVALID"\?fresh\.message:runtimeStatus\?\.message/);
  assert.match(page,/fresh\?\.pending\|\|\["not_updated","market_pending"\]/);
});

test("holdings action uses selected live ticker and never hardcodes TQQQ trade instruction",()=>{
  assert.match(primary,/currentTicker=args\.signal\?\.assetTicker\|\|"TQQQ"/);
  assert.doesNotMatch(primary,/`TQQQ比率を\$\{target\*100\}%まで(?:増加|縮小)`/);
});

test("device-local holdings are tagged and invalidated across ticker/version transitions",()=>{
  assert.match(page,/ticker\?: string/);assert.match(page,/version\?: string/);
  assert.match(primary,/holdingsMatch=/);assert.match(primary,/旧Tickerの保有値は流用しません/);
  assert.match(page,/ticker:dailySignal\?\.assetTicker\|\|"TQQQ"/);
});

test("unsafe stale, failed, cross-generation, malformed numeric, or malformed Forward authority fails closed at the primary action",()=>{
  assert.match(primary,/operationalAuthorityBundleIsCoherent/);
  assert.match(primary,/authorityUnsafe=!authorityBundle\.ok/);
  assert.match(authority,/Signal and runtime generations do not match/);
  assert.match(authority,/Signal and runtime market-data dates do not match/);
  assert.match(authority,/Signal and Production control modes do not match/);
  assert.match(authority,/Signal identity does not match current operational authority/);
  assert.match(primary,/assertForwardLedgerInternalIntegrity/);
  assert.match(primary,/forwardIntegrityUnsafe/);
  assert.match(primary,/signalNumericUnsafe/);
  assert.match(primary,/holdingsNumericUnsafe/);
  assert.match(primary,/freshnessDate=args\.signal\?\.dataDate/);
  assert.match(primary,/signalPayloadUnsafe/);
  assert.match(primary,/futureGenerationUnsafe/);
  assert.match(primary,/productionAuthorityChronologyUnsafe/);
  assert.match(primary,/marketDate\(args\.now\)/);
  assert.match(primary,/executionContractUnsafe/);
  assert.match(primary,/approvedIncumbent/);
  assert.match(primary,/signalUnsafe=Boolean\(authorityUnsafe\|\|forwardIntegrityUnsafe\|\|signalPayloadUnsafe\|\|signalNumericUnsafe\|\|holdingsNumericUnsafe\|\|futureGenerationUnsafe\|\|productionAuthorityChronologyUnsafe\|\|executionContractUnsafe\|\|args\.status\?\.state==="failed"\|\|fresh\?\.stale\)/);
  assert.match(primary,/売買しない：データ\/Signalが安全確認できません/);
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
