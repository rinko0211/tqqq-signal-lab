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
  "state-plane-shadow-mirror.yml",
]);
const PAGE_OIDC_WRITERS = new Set([
  "daily-signal.yml",
  "phase5-forward.yml",
  "lifecycle-review.yml",
  "approve-production.yml",
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

test("repository write authority is limited to current operational writers", async () => {
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

test("Pages/OIDC write authority is limited to current deployment-capable writers", async () => {
  for (const { name, path } of await workflows()) {
    const text = await readFile(path, "utf8");
    const privileged = /^\s*(pages|id-token):\s*write\s*$/m.test(text);
    if (privileged) assert.ok(PAGE_OIDC_WRITERS.has(name), `${path}: unexpected Pages/OIDC write authority`);
  }
});

test("no workflow implicitly inherits all repository secrets", async () => {
  for (const { path } of await workflows()) {
    const text = await readFile(path, "utf8");
    assert.doesNotMatch(text, /secrets:\s*inherit/, `${path}: implicit secret inheritance is forbidden`);
  }
});
