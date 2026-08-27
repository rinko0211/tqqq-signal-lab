import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {demoDataset} from "../lib/engine.ts";
import {emptyForwardLedger,updateForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,updatePhase5LedgerSubset} from "../lib/phase5-forward.ts";
import {DEFAULT_PRODUCTION_CONFIG,assertProductionConfigIntegrity} from "../lib/production.ts";
import {emptyLifecycleLedger,updateLifecycleReview} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
const r=p=>fs.readFileSync(p,"utf8");

test("operational authority files cannot silently bootstrap empty/default state",()=>{
 const d=r("scripts/generate-daily.ts"),p5=r("scripts/generate-phase5-forward.ts"),l=r("scripts/generate-lifecycle-review.ts"),h=r("scripts/generate-production-health-review.ts"),a=r("scripts/approve-production.ts");
 assert.match(d,/readRequiredJson/);assert.doesNotMatch(d,/emptyForwardLedger|DEFAULT_PRODUCTION_CONFIG/);
 assert.match(p5,/STATE-004/);assert.doesNotMatch(p5,/prior=emptyPhase5Ledger/);
 assert.match(l,/STATE-006/);assert.doesNotMatch(l,/emptyForwardLedger|emptyPhase5Ledger|emptyLifecycleLedger|DEFAULT_PRODUCTION_CONFIG/);
 assert.match(h,/STATE-008/);assert.doesNotMatch(h,/emptyProductionHealthLedger|DEFAULT_PRODUCTION_CONFIG/);
 assert.match(a,/STATE-010/);assert.doesNotMatch(a,/DEFAULT_PRODUCTION_CONFIG/);
});

test("invalid supplied append-only prior ledgers are rejected at library boundaries",()=>{
 const f={...emptyForwardLedger(),schemaVersion:999};assert.throws(()=>updateForwardLedger(demoDataset(),f,"test"),/invalid/);
 const p={...emptyPhase5Ledger(),schemaVersion:999};assert.throws(()=>updatePhase5LedgerSubset({series:{}},p,[],"2026-08-27T00:00:00Z"),/invalid/);
 const ph={...emptyProductionHealthLedger(),schemaVersion:999};assert.throws(()=>updateProductionHealthLedger({production:DEFAULT_PRODUCTION_CONFIG,lifecycle:{},prior:ph}),/invalid/);
 const base5=emptyPhase5Ledger(),schedule={interim:base5.reviewSchedule.interim,formal:base5.reviewSchedule.formal,stronger:base5.reviewSchedule.stronger},badLife={...emptyLifecycleLedger(schedule),schemaVersion:999};assert.throws(()=>updateLifecycleReview({phase5:base5,forward:emptyForwardLedger(),production:DEFAULT_PRODUCTION_CONFIG,prior:badLife}),/invalid/);
});

test("Production config validator rejects malformed or contradictory authority",()=>{
 assert.doesNotThrow(()=>assertProductionConfigIntegrity(DEFAULT_PRODUCTION_CONFIG));
 assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,mode:"PRODUCTION"}),/CONFIG-005/);
 assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,mode:"DECISION",selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"}),/CONFIG-007/);
});

test("primary action requires authority plus a new signal change before its legal open",()=>{
 const ui=r("app/page.tsx");
 assert.ok(ui.includes('authorityUnsafe=Boolean(!dailySignal||!runtimeStatus||!productionConfigIsValid(productionConfig)||!forwardLedger)'));
 assert.ok(ui.includes('executionActionable=Boolean(signalChange&&executionWindow==="UPCOMING_OPEN")'));
 assert.match(ui,/!signalChange[\s\S]*現在Signalに新規売買指示はありません/);
 assert.match(ui,/!executionActionable[\s\S]*有効な次回始値の実行ウィンドウ/);
});
