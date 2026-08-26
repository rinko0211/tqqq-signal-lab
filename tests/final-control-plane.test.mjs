import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read=(p)=>fs.readFileSync(p,"utf8");
const workflowsDir=".github/workflows";
const workflowFiles=fs.readdirSync(workflowsDir).filter(x=>x.endsWith(".yml")).sort();
const workflow=(name)=>read(path.join(workflowsDir,name));
const daily=workflow("daily-signal.yml");
const phase5=workflow("phase5-forward.yml");
const lifecycle=workflow("lifecycle-review.yml");
const approval=workflow("approve-production.yml");
const approveScript=read("scripts/approve-production.ts");
const production=read("lib/production.ts");
const official=read("lib/official-data.ts");
const generateDaily=read("scripts/generate-daily.ts");
const sw=read("github-pages/public/sw.js");
const superseded=read("research/final-operations-audit-close-2026-08-26.md");

const hasSchedule=(s)=>/\n\s*schedule:\s*\n/.test(s);

test("only the three operational workflows are scheduled",()=>{
  const scheduled=workflowFiles.filter(name=>hasSchedule(workflow(name)));
  assert.deepEqual(scheduled,["daily-signal.yml","lifecycle-review.yml","phase5-forward.yml"]);
});

test("closed research and legacy workflows remain manual-only",()=>{
  for(const name of ["phase1-screening.yml","phase1-5.yml","phase2.yml","phase3.yml","phase4.yml","weekly-research.yml","daily-ticker-forward.yml"]){
    const y=workflow(name);
    assert.match(y,/workflow_dispatch:/,name);
    assert.doesNotMatch(y,/\n\s*schedule:\s*\n/,name);
  }
});

test("Human Approval cannot rely on suppressed GITHUB_TOKEN push recursion",()=>{
  assert.match(daily,/workflow_call:/);
  assert.match(approval,/refresh-live-system:/);
  assert.match(approval,/needs: approve/);
  assert.match(approval,/uses: \.\/\.github\/workflows\/daily-signal\.yml/);
});

test("Production approval remains fresh-lifecycle, formal-stage, eligible-version and exact-confirmation gated",()=>{
  assert.match(approveScript,/confirmation!=="APPROVE PRODUCTION"/);
  assert.match(approveScript,/lifecycleReviewIsFresh/);
  assert.match(approveScript,/stage!=="FORMAL"&&lifecycle\.current\.stage!=="STRONGER"/);
  assert.match(approveScript,/systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED"/);
  assert.match(approveScript,/productionEligibleVersions/);
  assert.match(approveScript,/!eligible\.includes\(version\)/);
  assert.match(production,/current\.mode==="RESEARCH"&&next==="PRODUCTION"/);
  assert.match(production,/Human approval is required/);
  assert.match(production,/Strong Forward evidence and completed Final Selection Review are required/);
});

test("Daily routine path is operational, not historical research",()=>{
  assert.doesNotMatch(generateDaily,/\bwalkForward\b/);
  assert.doesNotMatch(generateDaily,/\bfixedOos\b/);
  assert.match(generateDaily,/runBacktest\(dataset, selected\.config\)/);
});

test("bounded non-TQQQ Production preserves the independent real TQQQ incumbent series",()=>{
  const a=official.indexOf("export async function fetchProductionData");
  const b=official.indexOf("export async function fetchUproForwardData");
  assert.ok(a>=0&&b>a);
  const fn=official.slice(a,b);
  assert.match(fn,/"TQQQ","QQQ","SPY",ticker,proxy/);
  assert.match(fn,/series:\{TQQQ:bySymbol\.TQQQ,QQQ:bySymbol\.QQQ,SPY:bySymbol\.SPY,VIX\}/);
  assert.doesNotMatch(fn,/series:\{TQQQ:bySymbol\[ticker\]/);
});

test("public data JSON bypasses stale PWA cache",()=>{
  assert.match(sw,/url\.pathname\.includes\("\/data\/"\)/);
  assert.match(sw,/fetch\(event\.request,\{cache:"no-store"\}\)/);
});

test("earlier PASS/CLOSED report is visibly superseded after later material findings",()=>{
  assert.match(superseded,/Status: \*\*SUPERSEDED/);
  assert.match(superseded,/DO NOT USE AS CURRENT FINAL RELIABILITY CERTIFICATION/);
  assert.match(superseded,/two consecutive re-audits/);
});

test("current production config is structurally safe",()=>{
  const cfg=JSON.parse(read("github-pages/public/data/production-config.json"));
  assert.ok(["RESEARCH","DECISION","PRODUCTION"].includes(cfg.mode));
  if(cfg.mode==="PRODUCTION"){
    assert.equal(cfg.approvedByHuman,true);
    assert.ok(cfg.selectedTicker&&cfg.selectedStrategy&&cfg.strategyVersion);
  }else{
    assert.equal(cfg.approvedByHuman,false);
  }
});

test("current lifecycle state never auto-writes Production",()=>{
  const led=JSON.parse(read("github-pages/public/data/lifecycle-review.json"));
  assert.equal(led.appendOnly,true);
  assert.deepEqual(led.schedule,{interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"});
  assert.ok(["ACCUMULATING","INTERIM","FORMAL","STRONGER"].includes(led.current.stage));
  if(led.current.stage==="ACCUMULATING"||led.current.stage==="INTERIM"){
    assert.notEqual(led.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");
  }
});
