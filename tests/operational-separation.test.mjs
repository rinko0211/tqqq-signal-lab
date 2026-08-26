import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const daily=fs.readFileSync("scripts/generate-daily.ts","utf8"),official=fs.readFileSync("lib/official-data.ts","utf8"),page=fs.readFileSync("app/page.tsx","utf8");

test("Daily generator does not rerun historical WF/OOS research",()=>{
  assert.doesNotMatch(daily,/\bwalkForward\b/);
  assert.doesNotMatch(daily,/\bfixedOos\b/);
  assert.doesNotMatch(daily,/validation:\s*\{/);
});

test("non-TQQQ Formal Production uses bounded data fetch instead of research cross universe",()=>{
  assert.match(daily,/fetchProductionData/);
  assert.doesNotMatch(daily,/fetchOfficialData\(Boolean\(productionTicker/);
  assert.match(official,/Formal Production data is bounded/);
});

test("Daily uses shared NYSE calendar",()=>{
  assert.match(daily,/isNyseSession/);
  assert.doesNotMatch(daily,/const nthWeekday=/);
});

test("primary Production state is driven by platform mode and human approval",()=>{
  const start=page.indexOf("function SignalView(");
  assert.ok(start>=0,"SignalView must exist");
  const signalView=page.slice(start);
  assert.match(signalView,/platformMode==="PRODUCTION"&&humanApproved/);
  assert.doesNotMatch(signalView,/holdoutMetrics/);
});
