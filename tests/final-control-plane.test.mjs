import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read=(p)=>fs.readFileSync(p,"utf8");
const workflowsDir=".github/workflows";
const workflowFiles=fs.readdirSync(workflowsDir).filter(x=>x.endsWith(".yml")).sort();
const workflow=(name)=>read(path.join(workflowsDir,name));
const daily=workflow("daily-signal.yml");
const approval=workflow("approve-production.yml");
const approveScript=read("scripts/approve-production.ts");
const production=read("lib/production.ts");
const official=read("lib/official-data.ts");
const generateDaily=read("scripts/generate-daily.ts");
const sw=read("github-pages/public/sw.js");
const superseded=read("research/final-operations-audit-close-2026-08-26.md");
const historicalAddendum=read("research/final-operations-audit-addendum-2026-08-26.md");
const reAuditProtocol=read("research/final-re-audit-protocol-2026-08-26.md");

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
  assert.match(daily,/deploy_persisted_only:/);
  assert.match(approval,/deploy-validated-state:/);
  assert.match(approval,/needs: approve/);
  assert.match(approval,/uses: \.\/\.github\/workflows\/daily-signal\.yml/);
  assert.match(approval,/deploy_persisted_only: true/);
});

test("Human Approval atomically persists validated config and live state",()=>{
  assert.match(approval,/Record explicit human decision locally/);
  assert.match(approval,/Preflight the exact resulting operational state/);
  assert.match(approval,/npm run generate:daily/);
  assert.match(approval,/test ! -s github-pages\/public\/data\/\.failed/);
  assert.match(approval,/npm run test:ops/);
  assert.match(approval,/npm run build:pages/);
  assert.match(approval,/Atomically persist decision and validated live state/);
  assert.match(approval,/git add github-pages\/public\/data/);
  assert.match(approval,/approve:[\s\S]*concurrency:[\s\S]*group: daily-signal-pages/);
});

test("Production approval remains fresh-lifecycle, formal-stage, eligible-version and exact-confirmation gated",()=>{
  assert.match(approveScript,/confirmation!=="APPROVE PRODUCTION"/);
  assert.match(approveScript,/lifecycleReviewIsFresh/);
  assert.match(approveScript,/stage!=="FORMAL"&&lifecycle\.current\.stage!=="STRONGER"/);
  assert.match(approveScript,/systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED"/);
  assert.match(approveScript,/productionEligibleVersions/);
  assert.match(approveScript,/!eligible\.includes\(version\)/);
  assert.match(production,/if\(current\.mode!=="DECISION"\)throw Error\("DECISION review is required immediately before PRODUCTION"\)/);
  assert.match(production,/Human approval is required/);
  assert.match(production,/Strong Forward evidence and completed Final Selection Review are required/);
  assert.match(production,/if\(next==="DECISION"\)return\{\.\.\.current,mode:"DECISION"/);
  assert.match(production,/cancelDecision/);
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

test("historical approval addendum preserves the safeguard but not an obsolete final-PASS claim",()=>{
  assert.match(historicalAddendum,/SAFEGUARD REMAINS ACTIVE/);
  assert.match(historicalAddendum,/EARLIER FINAL-PASS CONTEXT SUPERSEDED/);
  assert.match(historicalAddendum,/does not by itself constitute final reliability certification/);
});

test("final certification requires two consecutive clean re-audit rounds",()=>{
  assert.match(reAuditProtocol,/two consecutive complete re-audit rounds discover no new material defect/);
  assert.match(reAuditProtocol,/resets the consecutive-clean count to \*\*0\*\*/);
  assert.match(reAuditProtocol,/If a material issue is found and fixed during the round, that round is \*\*NOT CLEAN\*\*/);
});

test("current production config is structurally safe across Research Decision and Production",()=>{
  const cfg=JSON.parse(read("github-pages/public/data/production-config.json"));
  assert.ok(["RESEARCH","DECISION","PRODUCTION"].includes(cfg.mode));
  const selected=Boolean(cfg.selectedTicker&&cfg.selectedStrategy&&cfg.strategyVersion);
  if(cfg.mode==="RESEARCH"){
    assert.equal(cfg.approvedByHuman,false);
    assert.equal(selected,false);
  }else if(cfg.mode==="PRODUCTION"){
    assert.equal(cfg.approvedByHuman,true);
    assert.equal(selected,true);
  }else if(cfg.approvedByHuman){
    // An incumbent remains formally active while a new DECISION review is pending.
    assert.equal(selected,true);
  }else{
    // First Production decision: no incumbent exists yet.
    assert.equal(selected,false);
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
