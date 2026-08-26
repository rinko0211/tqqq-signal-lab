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

test("Human Approval validates config plus live state before one atomic persistence commit",()=>{
  assert.match(approvalWorkflow,/Record explicit human decision locally/);
  assert.match(approvalWorkflow,/Preflight the exact approved operational state/);
  assert.match(approvalWorkflow,/npm run generate:daily/);
  assert.match(approvalWorkflow,/test ! -s github-pages\/public\/data\/\.failed/);
  assert.match(approvalWorkflow,/npm run test:ops/);
  assert.match(approvalWorkflow,/npm run build:pages/);
  assert.match(approvalWorkflow,/Atomically persist approval and validated live state/);
  assert.match(approvalWorkflow,/git add github-pages\/public\/data/);
  assert.doesNotMatch(approvalWorkflow,/git add github-pages\/public\/data\/production-config\.json\s*$/m);
});

test("Human Approval deploys persisted state explicitly instead of relying on GITHUB_TOKEN push recursion",()=>{
  assert.match(dailyWorkflow,/workflow_call:/);
  assert.match(dailyWorkflow,/deploy_persisted_only:/);
  assert.match(approvalWorkflow,/deploy-validated-state:/);
  assert.match(approvalWorkflow,/uses: \.\/\.github\/workflows\/daily-signal\.yml/);
  assert.match(approvalWorkflow,/deploy_persisted_only: true/);
  assert.match(approvalWorkflow,/needs: approve/);
});

test("Approval preflight serializes with operational writers",()=>{
  assert.match(approvalWorkflow,/approve:[\s\S]*concurrency:[\s\S]*group: daily-signal-pages/);
  for(const y of [dailyWorkflow,lifecycleWorkflow,fs.readFileSync(".github/workflows/phase5-forward.yml","utf8")])assert.match(y,/group: daily-signal-pages/);
});

test("Lifecycle retains an autonomous scheduled path",()=>{
  assert.match(lifecycleWorkflow,/cron: "15 1 \* \* \*"/);
  assert.match(lifecycleWorkflow,/workflow_dispatch:/);
});
