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
  assert.match(approval,/concurrency:\s*\n\s*group: daily-signal-pages\s*\n\s*cancel-in-progress: false/);
});

test("Daily separates external pending from internal failure without fabricating a new signal",()=>{
  assert.match(generator,/catch\(error\)/);
  assert.match(generator,/error instanceof ExternalDataUnavailableError/);
  assert.match(generator,/unavailableProviderAttempt/);
  assert.match(generator,/actionStatus:"failed"/);
  assert.match(generator,/state:"failed"/);
  assert.match(generator,/データ取得後の検証または内部処理に失敗しました。新しいSignal・Forward Recordは生成していません/);
  assert.match(generator,/writeFile\(new URL\("\.failed",dir\),"failed\\n"\)/);
  const catchStart=generator.indexOf("} catch(error)");
  assert.ok(catchStart>=0);
  const failurePath=generator.slice(catchStart);
  assert.doesNotMatch(failurePath,/writeJson\("signal\.json"/);
  assert.doesNotMatch(failurePath,/updateForwardLedger\(/);
});

test("Daily deploys failure status before deliberately failing the workflow",()=>{
  const persist=daily.indexOf("CAS verify and persist state only");
  const deploy=daily.indexOf("\n  deploy:");
  const finalFail=daily.indexOf("\n  enforce:");
  assert.ok(persist>=0&&deploy>persist&&finalFail>deploy);
  assert.match(daily,/git -C state add github-pages\/public\/data state-plane\/runtime-manifest\.json/);
  assert.match(daily,/data_failure=true/);
  assert.match(daily,/test "\$DATA_FAILURE" != "true"/);
  assert.match(daily,/uses: \.\/\.github\/workflows\/state-plane-deploy\.yml/);
});

test("Phase 5 persists status on generation failure and then reports red",()=>{
  assert.match(phase5,/Update true Forward ledger[\s\S]*continue-on-error: true/);
  assert.match(phase5,/Stage validated operational state candidate/);
  assert.match(phase5,/CAS verify and persist Phase 5 state only/);
  assert.match(phase5,/git -C state add github-pages\/public\/data\/phase-5-forward-ledger\.json github-pages\/public\/data\/phase-5-forward-status\.json state-plane\/runtime-manifest\.json/);
  assert.match(phase5,/uses: \.\/\.github\/workflows\/state-plane-deploy\.yml/);
  assert.match(phase5,/Enforce Phase 5 generation, persistence and deployment success/);
  assert.match(phase5,/GENERATE_OUTCOME: \$\{\{ needs\.generate\.outputs\.generate_outcome \}\}/);
  assert.match(phase5,/test "\$GENERATE_OUTCOME" = "success"/);
});

test("Human Approval preflight is serialized and deploys persisted validated state explicitly",()=>{
  assert.match(approval,/group: daily-signal-pages/);
  assert.match(approval,/Preflight the exact resulting operational state/);
  assert.match(approval,/CAS verify and atomically persist approved state/);
  assert.match(approval,/git -C state push origin HEAD:ops-state/);
  assert.match(approval,/uses: \.\/\.github\/workflows\/state-plane-deploy\.yml/);
  assert.match(approval,/state_sha: \$\{\{ needs\.persist\.outputs\.state_sha \}\}/);
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
