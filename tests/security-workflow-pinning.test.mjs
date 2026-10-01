import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
const CONTENT_WRITERS = new Set([
  "daily-signal.yml",
  "phase5-forward.yml",
  "lifecycle-review.yml",
  "approve-production.yml",
]);
const PAGE_OIDC_WORKFLOWS = new Set([
  "daily-signal.yml",
  "phase5-forward.yml",
  "lifecycle-review.yml",
  "approve-production.yml",
  "state-plane-deploy.yml",
]);

async function workflows() {
  return (await readdir(WORKFLOW_DIR))
    .filter((name) => name.endsWith(".yml"))
    .map((name) => ({ name, path: join(WORKFLOW_DIR, name) }));
}

test("all external GitHub Actions are pinned to immutable SHAs", async () => {
  for (const { path } of await workflows()) {
    const text = await readFile(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
      if (!m) continue;
      const ref = m[1];
      if (ref.startsWith("./")) continue;
      assert.match(ref, /^[^@]+@[0-9a-f]{40}$/i, `${path}: mutable or non-SHA action reference: ${ref}`);
    }
  }
});

test("repository write authority is limited to isolated ops-state persist jobs", async () => {
  for (const { name, path } of await workflows()) {
    const text = await readFile(path, "utf8");
    const hasContentsWrite = /^\s*contents:\s*write\s*$/m.test(text);
    assert.equal(
      hasContentsWrite,
      CONTENT_WRITERS.has(name),
      `${path}: unexpected contents:write authority boundary`,
    );
  }
});

test("Pages/OIDC authority is limited to state-plane deployment paths", async () => {
  for (const { name, path } of await workflows()) {
    const text = await readFile(path, "utf8");
    const privileged = /^\s*(pages|id-token):\s*write\s*$/m.test(text);
    if (privileged) assert.ok(PAGE_OIDC_WORKFLOWS.has(name), `${path}: unexpected Pages/OIDC write authority`);
  }
});

test("no workflow implicitly inherits all repository secrets", async () => {
  for (const { path } of await workflows()) {
    const text = await readFile(path, "utf8");
    assert.doesNotMatch(text, /secrets:\s*inherit/, `${path}: implicit secret inheritance is forbidden`);
  }
});

test("operational writers never push autonomous state to main", async () => {
  for (const name of CONTENT_WRITERS) {
    const text = await readFile(join(WORKFLOW_DIR, name), "utf8");
    assert.match(text, /ref:\s*ops-state/);
    assert.match(text, /git -C state push origin HEAD:ops-state/);
    assert.doesNotMatch(text, /git push[^\n]*HEAD:main|git -C state push[^\n]*HEAD:main/);
  }
});

test("privileged persist jobs do not execute package or provider code", async () => {
  for (const name of CONTENT_WRITERS) {
    const text = await readFile(join(WORKFLOW_DIR, name), "utf8");
    const start = text.indexOf("\n  persist:");
    assert.ok(start >= 0, `${name}: persist job missing`);
    const nextDeploy = text.indexOf("\n  deploy:", start);
    assert.ok(nextDeploy > start, `${name}: deploy boundary missing`);
    const persist = text.slice(start, nextDeploy);
    assert.match(persist, /contents:\s*write/);
    assert.match(persist, /ref:\s*ops-state/);
    assert.doesNotMatch(persist, /npm\s+(ci|run|install)|node\s+--experimental-strip-types|scripts\//);
  }
});

test("generation jobs use read-only checkouts for both code and state", async () => {
  for (const name of CONTENT_WRITERS) {
    const text = await readFile(join(WORKFLOW_DIR, name), "utf8");
    const start = text.indexOf("\n  generate:");
    const end = text.indexOf("\n  persist:", start);
    assert.ok(start >= 0 && end > start, `${name}: generate/persist boundary missing`);
    const generate = text.slice(start, end);
    assert.doesNotMatch(generate, /contents:\s*write/);
    assert.match(generate, /persist-credentials:\s*false/g);
  }
});
