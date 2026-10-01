import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const archivePath = ".github/workflows/state-plane-shadow-mirror.yml";
const deployPath = ".github/workflows/state-plane-deploy.yml";
const writers = [
  ".github/workflows/daily-signal.yml",
  ".github/workflows/phase5-forward.yml",
  ".github/workflows/lifecycle-review.yml",
  ".github/workflows/approve-production.yml",
];

test("completed P1a mirror is archived read-only and cannot mutate either branch", async () => {
  const text = await readFile(archivePath, "utf8");
  assert.match(text, /name:\s*State Plane P1a Archive Verification/);
  assert.match(text, /workflow_dispatch:/);
  assert.doesNotMatch(text, /workflow_run:/);
  assert.doesNotMatch(text, /^\s*schedule:\s*$/m);
  assert.match(text, /contents:\s*read/);
  assert.doesNotMatch(text, /contents:\s*write/);
  assert.doesNotMatch(text, /git\s+(?:-C\s+\S+\s+)?push/);
  assert.doesNotMatch(text, /npm\s+(ci|install|run)|secrets\./);
  assert.match(text, /"S3\/3"/);
  assert.match(text, /"COMPLETE"/);
  assert.match(text, /"2026-09-25","2026-09-28","2026-09-29"/);
});

test("P1b operational writers read code from main and persist state only to ops-state", async () => {
  for (const path of writers) {
    const text = await readFile(path, "utf8");
    assert.match(text, /ref:\s*main/);
    assert.match(text, /ref:\s*ops-state/);
    assert.match(text, /path:\s*source/);
    assert.match(text, /path:\s*state/);
    assert.match(text, /OPS_STATE_AUTHORITATIVE/);
    assert.match(text, /"authoritative":True/);
    assert.match(text, /baseOpsStateSha/);
    assert.match(text, /EXPECTED_BASE_STATE_SHA/);
    assert.match(text, /git -C state fetch origin ops-state/);
    assert.match(text, /git -C state push origin HEAD:ops-state/);
    assert.doesNotMatch(text, /git[^\n]*push[^\n]*HEAD:main/);
  }
});

test("P1b state persistence uses CAS and a validated candidate hash", async () => {
  for (const path of writers) {
    const text = await readFile(path, "utf8");
    assert.match(text, /EXPECTED_DATA_SHA/);
    assert.match(text, /dataTreeSha256/);
    assert.match(text, /sha256sum/);
    assert.match(text, /git -C state rev-parse origin\/ops-state/);
    assert.match(text, /Unexpected path in .*ops-state writer|Unexpected path in approval ops-state writer/);
    assert.match(text, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
    assert.match(text, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/);
    assert.match(text, /include-hidden-files:\s*true/);
  }
});

test("Pages deployment overlays an exact validated main/state pair", async () => {
  const text = await readFile(deployPath, "utf8");
  assert.match(text, /source_main_sha:/);
  assert.match(text, /state_sha:/);
  assert.match(text, /expected_data_sha256:/);
  assert.match(text, /ref:\s*\$\{\{ inputs\.source_main_sha \}\}/);
  assert.match(text, /ref:\s*\$\{\{ inputs\.state_sha \}\}/);
  assert.match(text, /persist-credentials:\s*false/g);
  assert.match(text, /runtime-manifest\.json/);
  assert.match(text, /OPS_STATE_AUTHORITATIVE/);
  assert.match(text, /rm -rf source\/github-pages\/public\/data/);
  assert.match(text, /cp -a state\/github-pages\/public\/data\/\. source\/github-pages\/public\/data\//);
  assert.match(text, /npm run build:pages/);
  assert.match(text, /actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9/);
  assert.match(text, /actions\/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346/);

  const deployStart=text.indexOf("\n  deploy:");
  assert.ok(deployStart>=0);
  const deploy=text.slice(deployStart);
  assert.match(deploy,/pages:\s*write/);
  assert.match(deploy,/id-token:\s*write/);
  assert.doesNotMatch(deploy,/npm\s+(ci|run|install)|scripts\//);
  assert.doesNotMatch(deploy,/contents:\s*write/);
});
