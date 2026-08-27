import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction} from "../lib/primary-action.ts";
import {DEFAULT_PRODUCTION_CONFIG} from "../lib/production.ts";

const generatedAt="2026-08-26T21:10:00.000Z";
const baseSignal={
  generatedAt,dataDate:"2026-08-26",platformMode:"RESEARCH",assetTicker:"TQQQ",strategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",state:"latest",
  signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"},
};
const baseStatus={generatedAt,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]};
const baseForward={schemaVersion:1,appendOnly:true,updatedAt:generatedAt};
const production={...DEFAULT_PRODUCTION_CONFIG,updatedAt:"2026-08-26T21:10:00.000Z"};
const run=(ratio:string,now="2026-08-27T12:00:00.000Z",overrides:Record<string,unknown>={})=>derivePrimaryAction({signal:baseSignal,status:baseStatus,forward:baseForward,production,now,holdings:{ratio},...overrides});

test("Audit 8 instrumentation preserves the finite primary action surface",()=>{
  assert.equal(run("50").code,"INCREASE");
  assert.equal(run("90").code,"REDUCE");
  assert.equal(run("75").code,"HOLD");
  assert.equal(run("").code,"TARGET_ONLY");
  assert.equal(run("50","2026-08-27T14:00:00.000Z").code,"NO_ACTION_EXPIRED");
  assert.equal(run("50","2026-08-27T12:00:00.000Z",{forward:{...baseForward,updatedAt:"2026-08-26T21:09:59.000Z"}}).code,"CHECK_DATA");
});

test("actual page is wired to the same product entrypoint and no longer carries a shadow action branch",()=>{
  const page=fs.readFileSync("app/page.tsx","utf8");
  assert.match(page,/import \{derivePrimaryAction\} from "\.\.\/lib\/primary-action"/);
  assert.match(page,/primaryAction=derivePrimaryAction\(/);
  assert.match(page,/action = primaryAction\.message/);
  assert.doesNotMatch(page,/operationalAuthorityBundleIsCoherent/);
  assert.doesNotMatch(page,/signalUnsafe\s*\?\s*"売買しない：データ\/Signal/);
});
