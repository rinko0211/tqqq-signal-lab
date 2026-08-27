import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");
const daily=read(".github/workflows/daily-signal.yml");
const phase5=read(".github/workflows/phase5-forward.yml");
const lifecycle=read(".github/workflows/lifecycle-review.yml");
const approval=read(".github/workflows/approve-production.yml");
const generator=read("scripts/generate-daily.ts");

const writerWorkflows=[daily,phase5,lifecycle];

test("all autonomous operational writers serialize through one concurrency group",()=>{
  for(const y of writerWorkflows)assert.match(y,/concurrency:\s*\n\s*group: daily-signal-pages\s*\n\s*cancel-in-progress: false/);
  assert.match(approval,/approve:[\s\S]*concurrency:[\s\S]*group: daily-signal-pages/);
});

test("Daily failure publishes failed status without fabricating a new signal",()=>{
  assert.match(generator,/catch\(error\)/);
  assert.match(generator,/actionStatus:"failed"/);
  assert.match(generator,/state:"failed"/);
  assert.match(generator,/データ取得失敗。新しいSignal・Forward Recordは生成していません/);
  assert.match(generator,/writeFile\(new URL\("\.failed",dir\),"failed\\n"\)/);
  const catchStart=generator.indexOf("} catch(error)");
  assert.ok(catchStart>=0);
  const failurePath=generator.slice(catchStart);
  assert.doesNotMatch(failurePath,/writeJson\("signal\.json"/);
  assert.doesNotMatch(failurePath,/updateForwardLedger\(/);
});

test("Daily deploys failure status before deliberately failing the workflow",()=>{
  const deploy=daily.indexOf("Deploy GitHub Pages");
  const finalFail=daily.indexOf("Mark data failure after publishing status");
  assert.ok(deploy>=0&&finalFail>deploy);
  assert.match(daily,/git add github-pages\/public\/data/);
  assert.match(daily,/test ! -s github-pages\/public\/data\/\.failed/);
});

test("Phase 5 persists status on generation failure and then reports red",()=>{
  assert.match(phase5,/Update true Forward ledger[\s\S]*continue-on-error: true/);
  assert.match(phase5,/Persist append-only Phase 5 ledger\/status[\s\S]*if: always\(\)/);
  assert.match(phase5,/phase-5-forward-ledger\.json github-pages\/public\/data\/phase-5-forward-status\.json/);
  assert.match(phase5,/Enforce Phase 5 generation, persistence, authority and build success[\s\S]*test "\$\{\{ steps\.generate\.outcome \}\}" = "success"/);
  assert.match(phase5,/id: persist/);assert.match(phase5,/id: authority/);
  assert.match(phase5,/Build integrated PWA[\s\S]*steps\.persist\.outcome == 'success'[\s\S]*steps\.authority\.outcome == 'success'/);
});

test("Human Approval preflight is serialized and deploys persisted validated state explicitly",()=>{
  assert.match(approval,/group: daily-signal-pages/);
  assert.match(approval,/Preflight the exact resulting operational state/);
  assert.match(approval,/Atomically persist decision and validated live state/);
  assert.match(approval,/deploy-validated-state:/);
  assert.match(approval,/deploy_persisted_only: true/);
});

test("only Daily Lifecycle and Phase5 retain schedules",()=>{
  const dir=".github/workflows";
  const scheduled=fs.readdirSync(dir).filter(x=>x.endsWith(".yml")).filter(x=>/\n\s*schedule:\s*\n/.test(read(`${dir}/${x}`))).sort();
  assert.deepEqual(scheduled,["daily-signal.yml","lifecycle-review.yml","phase5-forward.yml"]);
});

test("closed research workflows cannot create autonomous observations",()=>{
  for(const name of ["phase1-screening.yml","phase1-5.yml","phase2.yml","phase3.yml","phase4.yml","weekly-research.yml","daily-ticker-forward.yml"]){
    const y=read(`.github/workflows/${name}`);
    assert.match(y,/workflow_dispatch:/,name);
    assert.doesNotMatch(y,/\n\s*schedule:\s*\n/,name);
  }
});
