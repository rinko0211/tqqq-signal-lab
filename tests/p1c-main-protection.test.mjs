import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowPath=".github/workflows/p1c-main-protection.yml";

test("P1c guard is a read-only pull-request gate for main", async()=>{
  const y=await readFile(workflowPath,"utf8");
  assert.match(y,/name:\s*P1c Main Protection/);
  assert.match(y,/pull_request:/);
  assert.match(y,/branches:\s*\[main\]/);
  assert.match(y,/merge_group:/);
  assert.match(y,/permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(y,/contents:\s*write/);
  assert.doesNotMatch(y,/pages:\s*write|id-token:\s*write/);
  assert.doesNotMatch(y,/secrets:\s*inherit|secrets\./);
});

test("P1c required job has a stable check name and full regression", async()=>{
  const y=await readFile(workflowPath,"utf8");
  assert.match(y,/name:\s*P1c Main Protection\s*$/m);
  assert.match(y,/npm ci/);
  assert.match(y,/npm run test:core/);
  assert.match(y,/npm run build:pages/);
  assert.match(y,/Reject runtime-state changes on main/);
});

test("P1c guard uses immutable external action pins", async()=>{
  const y=await readFile(workflowPath,"utf8");
  for(const line of y.split(/\r?\n/)){
    const m=line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if(!m) continue;
    const ref=m[1];
    if(ref.startsWith("./")) continue;
    assert.match(ref,/^[^@]+@[0-9a-f]{40}$/i,`mutable action reference: ${ref}`);
  }
});

test("P1c guard rejects main PRs that modify authoritative runtime-state paths", async()=>{
  const y=await readFile(workflowPath,"utf8");
  assert.match(y,/github-pages\/public\/data\//);
  assert.match(y,/runtime state belongs on ops-state/i);
});
