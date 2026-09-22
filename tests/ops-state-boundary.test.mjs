import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const helper = resolve("scripts/ops-state.sh");
const run = (cwd, args, env = {}) =>
  execFileSync("bash", [helper, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

test("ops-state helper overlays and persists state without mutating protected main", () => {
  const root = mkdtempSync(join(tmpdir(), "ops-state-test-"));
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(root, "init", "--bare", origin);
  git(repo, "init");
  git(repo, "config", "user.name", "test");
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "checkout", "-b", "main");
  mkdirSync(join(repo, "github-pages/public/data"), { recursive: true });
  writeFileSync(join(repo, "github-pages/public/data/signal.json"), '{"source":"main"}\n');
  writeFileSync(join(repo, "code.txt"), "protected-code\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "seed");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-u", "origin", "main");
  const mainSha = git(repo, "rev-parse", "HEAD");

  git(repo, "checkout", "-b", "ops-state");
  writeFileSync(join(repo, "github-pages/public/data/signal.json"), '{"source":"ops-state"}\n');
  git(repo, "add", "github-pages/public/data/signal.json");
  git(repo, "commit", "-m", "seed state");
  git(repo, "push", "-u", "origin", "ops-state");
  git(repo, "checkout", "main");

  run(repo, ["overlay"], { OPS_STATE_BRANCH: "ops-state" });
  assert.equal(readFileSync(join(repo, "github-pages/public/data/signal.json"), "utf8"), '{"source":"ops-state"}\n');
  const stateBase = git(repo, "rev-parse", "origin/ops-state");

  writeFileSync(join(repo, "github-pages/public/data/signal.json"), '{"source":"new-state"}\n');
  writeFileSync(join(repo, "code.txt"), "tampered-working-tree\n");
  run(repo, ["persist", "test state update"], {
    OPS_STATE_BRANCH: "ops-state",
    OPS_STATE_BASE_SHA: stateBase,
  });

  git(repo, "fetch", "origin", "main", "ops-state");
  assert.equal(git(repo, "rev-parse", "origin/main"), mainSha, "protected main moved during state persistence");
  assert.notEqual(git(repo, "rev-parse", "origin/ops-state"), stateBase, "ops-state did not advance");
  assert.equal(git(repo, "show", "origin/ops-state:github-pages/public/data/signal.json"), '{"source":"new-state"}');
  assert.equal(git(repo, "show", "origin/ops-state:code.txt"), "protected-code");
});

test("ops-state helper rejects stale compare-and-swap base", () => {
  const root = mkdtempSync(join(tmpdir(), "ops-state-cas-"));
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(root, "init", "--bare", origin);
  git(repo, "init");
  git(repo, "config", "user.name", "test");
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "checkout", "-b", "main");
  mkdirSync(join(repo, "github-pages/public/data"), { recursive: true });
  writeFileSync(join(repo, "github-pages/public/data/status.json"), '{"v":1}\n');
  git(repo, "add", ".");
  git(repo, "commit", "-m", "seed");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-u", "origin", "main");
  git(repo, "checkout", "-b", "ops-state");
  git(repo, "push", "-u", "origin", "ops-state");
  git(repo, "checkout", "main");
  run(repo, ["overlay"], { OPS_STATE_BRANCH: "ops-state" });
  const stale = git(repo, "rev-parse", "origin/ops-state");

  const other = join(root, "other");
  git(root, "clone", origin, other);
  git(other, "config", "user.name", "other");
  git(other, "config", "user.email", "other@example.invalid");
  git(other, "checkout", "ops-state");
  writeFileSync(join(other, "github-pages/public/data/status.json"), '{"v":2}\n');
  git(other, "add", ".");
  git(other, "commit", "-m", "concurrent state");
  git(other, "push", "origin", "ops-state");

  writeFileSync(join(repo, "github-pages/public/data/status.json"), '{"v":3}\n');
  assert.throws(
    () => run(repo, ["persist", "stale write"], { OPS_STATE_BRANCH: "ops-state", OPS_STATE_BASE_SHA: stale }),
    /Command failed/,
  );
});
