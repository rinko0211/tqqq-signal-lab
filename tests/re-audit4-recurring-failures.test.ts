import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {assertForwardFreezeIntegrity,emptyForwardLedger} from "../lib/forward.ts";

const read=(p:string)=>fs.readFileSync(p,"utf8");
const daily=read(".github/workflows/daily-signal.yml");
const phase5=read(".github/workflows/phase5-forward.yml");
const lifecycle=read(".github/workflows/lifecycle-review.yml");
const approval=read(".github/workflows/approve-production.yml");
const phase5Ui=read("app/phase5-ui.tsx");
const lifecycleUi=read("app/lifecycle-ui.tsx");
const control=read("tests/final-control-plane.test.mjs");

test("incumbent Forward rejects canonical freeze drift under the same version",()=>{
  const ledger=structuredClone(emptyForwardLedger("2026-08-26T00:00:00Z"));
  const vs13=ledger.freezes.find(x=>x.id==="VS13")!;
  assert.ok(vs13.config);
  vs13.config!.trailStop=.14;
  assert.throws(()=>assertForwardFreezeIntegrity(ledger),/Forward freeze drift: VS13/);
});

test("fresh empty Forward ledgers do not share mutable canonical freezes",()=>{
  const a=emptyForwardLedger("2026-08-26T00:00:00Z"),b=emptyForwardLedger("2026-08-26T00:00:01Z");
  assert.notEqual(a.freezes,b.freezes);
  assert.notEqual(a.freezes[0],b.freezes[0]);
  a.freezes[0].name="MUTATED";
  assert.notEqual(b.freezes[0].name,"MUTATED");
  assert.throws(()=>assertForwardFreezeIntegrity(a),/Forward freeze drift/);
  assert.doesNotThrow(()=>assertForwardFreezeIntegrity(b));
});

test("IntegratedDashboard has no obsolete formalProduction runtime reference",()=>{
  assert.match(phase5Ui,/const productionStateLabel =/);
  assert.match(phase5Ui,/<em>\{productionStateLabel\}<\/em>/);
  assert.doesNotMatch(phase5Ui,/\bformalProduction\b/);
});

test("Lifecycle UI fails closed for future-dated review timestamps",()=>{
  assert.match(lifecycleUi,/age<0\|\|age>REVIEW_STALE_MS/);
});

test("Decision state regression permits an approved incumbent while review is pending",()=>{
  assert.match(control,/else if\(cfg\.approvedByHuman\)/);
  assert.match(control,/An incumbent remains formally active while a new DECISION review is pending/);
});

test("required operational writers preserve queued runs and never rebase unvalidated source",()=>{
  for(const [name,y] of [["Daily",daily],["Phase5",phase5],["Lifecycle",lifecycle],["Approval",approval]] as const){
    assert.match(y,/concurrency:\s*\n\s*group: daily-signal-pages\s*\n\s*cancel-in-progress: false/,`${name} serialized queue`);
    assert.match(y,/source_main_sha=\$\(git -C source rev-parse HEAD\)/,`${name} validated main head`);
    assert.match(y,/base_state_sha=\$\(git -C state rev-parse HEAD\)/,`${name} validated state head`);
    assert.match(y,/git -C state rev-parse origin\/ops-state/,`${name} state CAS`);
    assert.doesNotMatch(y,/git pull --rebase origin (main|ops-state)/,`${name} rebase`);
  }
  assert.match(approval,/state_sha: \$\{\{ needs\.persist\.outputs\.state_sha \}\}/);
  assert.match(approval,/source_main_sha: \$\{\{ needs\.generate\.outputs\.source_main_sha \}\}/);
  assert.match(daily,/uses: \.\/\.github\/workflows\/state-plane-deploy\.yml/);
  assert.match(daily,/expected_data_sha256: \$\{\{ needs\.generate\.outputs\.data_sha256 \}\}/);
});

test("workflow maintenance pushes cannot create Forward or Lifecycle observations",()=>{
  assert.doesNotMatch(phase5,/\n\s*push:\s*\n/);
  assert.doesNotMatch(lifecycle,/\n\s*push:\s*\n/);
  assert.doesNotMatch(daily,/\n\s*push:\s*\n/);
  assert.doesNotMatch(approval,/\n\s*push:\s*\n/);
  assert.match(approval,/workflow_dispatch:/);
});
