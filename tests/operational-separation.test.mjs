import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const daily=fs.readFileSync("scripts/generate-daily.ts","utf8"),official=fs.readFileSync("lib/official-data.ts","utf8"),page=fs.readFileSync("app/page.tsx","utf8");
const dailyWorkflow=fs.readFileSync(".github/workflows/daily-signal.yml","utf8"),approvalWorkflow=fs.readFileSync(".github/workflows/approve-production.yml","utf8"),lifecycleWorkflow=fs.readFileSync(".github/workflows/lifecycle-review.yml","utf8");

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

test("bounded Production fetch preserves the independent TQQQ incumbent baseline",()=>{
  const start=official.indexOf("export async function fetchProductionData");
  const end=official.indexOf("export async function fetchUproForwardData");
  assert.ok(start>=0&&end>start);
  const fn=official.slice(start,end);
  assert.match(fn,/"TQQQ","QQQ","SPY",ticker,proxy/);
  assert.match(fn,/series:\{TQQQ:bySymbol\.TQQQ,QQQ:bySymbol\.QQQ,SPY:bySymbol\.SPY,VIX\}/);
  assert.match(fn,/crossSeries/);
  assert.doesNotMatch(fn,/series:\{TQQQ:crossSeries\[ticker\]/);
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

test("Human Approval explicitly refreshes Daily instead of relying on GITHUB_TOKEN push recursion",()=>{
  assert.match(dailyWorkflow,/workflow_call:/);
  assert.match(approvalWorkflow,/refresh-live-system:/);
  assert.match(approvalWorkflow,/uses: \.\/\.github\/workflows\/daily-signal\.yml/);
  assert.match(approvalWorkflow,/needs: approve/);
  assert.doesNotMatch(approvalWorkflow,/production-config\.json triggers Daily/);
});

test("Lifecycle retains an autonomous scheduled path",()=>{
  assert.match(lifecycleWorkflow,/cron: "15 1 \* \* \*"/);
  assert.match(lifecycleWorkflow,/workflow_dispatch:/);
});
