# State Plane Migration — Security P1

Date: 2026-09-23
Status: P1b CUTOVER CANDIDATE

## Objective

Remove autonomous operational-state writes from `main` before branch protection is enabled, without changing strategy behavior, signal semantics, execution timing, or user-visible authority.

## P1a — Shadow mirror

Authoritative runtime remains unchanged:

- code/config authority: `main`
- operational state authority: still `main/github-pages/public/data`
- shadow copy: `ops-state/github-pages/public/data`
- `ops-state` is explicitly non-authoritative
- `state-plane/canary.json` is a non-authoritative migration canary only
- no broker or Production authority is created

The mirror runs after the operational writer workflows (Daily, Phase 5, Lifecycle, or Human Production Approval) complete successfully. This uses `workflow_run` rather than relying on a second push-triggered workflow, because commits pushed by GitHub Actions with `GITHUB_TOKEN` do not recursively start another push workflow. The mirror then checks out the current authoritative `main` head without write credentials, records that exact checked-out SHA, copies only `github-pages/public/data`, writes a non-authoritative manifest plus fail-closed canary metadata, rejects unexpected staged paths, and pushes only to `ops-state`. A limited push trigger is retained only for mirror/canary code changes so a deployment change can self-bootstrap.

No npm install, strategy evaluation, provider fetch, broker secret, Pages deployment, or Production decision occurs in the mirror.

## P1a acceptance gate

Before cutover, observe at least three consecutive completed NYSE sessions after deployment. The original canary baseline after `2026-09-22` correctly entered `RESET_REQUIRED` because the first mirror trigger design could not observe the 2026-09-23 session. After the trigger defect was fixed and workflow-run mirroring was proven operational, the canary is explicitly rebaselined once after market date `2026-09-24` under baseline `p1a-workflow-run-v2`. The prior RESET gap, source SHA and data-tree hash remain embedded in the new canary as rebaseline evidence. No missed session is backfilled or counted. The v2 canary counts only `success/latest/errors=[]` source states, rejects duplicates, and enters `RESET_REQUIRED` again if any later NYSE session is skipped. Require all of the following:

1. every triggering main operational-state generation is mirrored successfully under the workflow-run trigger;
2. mirror manifest `sourceMainSha` identifies the exact source commit;
3. mirrored data tree hash matches the source data tree for that commit;
4. no file outside `github-pages/public/data/**`, `state-plane/mirror-manifest.json`, and `state-plane/canary.json` is changed by the mirror;
5. no strategy/version/mapping or authority field changes as a consequence of mirroring;
6. Daily, Phase 5, Lifecycle, Pages, and existing operational regression remain green;
7. `platformMode=RESEARCH` and broker order authority remains absent.

A mirror failure does not alter or invalidate the current authoritative state; P1a is fail-isolated.

## P1b — Writer cutover

Only after the P1a gate passes:

- Daily / Phase 5 / Lifecycle state commits move from `main` to `ops-state`;
- code remains read from protected `main`;
- Pages build overlays the exact validated `ops-state` snapshot onto the exact validated `main` code snapshot;
- approval flow records authority through the state plane rather than by modifying code branch history;
- cross-branch generation hashes and CAS checks replace the current same-branch checks.

This cutover is a separate PR and must pass the full operational regression suite before merge.

## P1c — Main protection

After P1b demonstrates that no autonomous workflow needs to push to `main`:

- require PRs for `main`;
- require the relevant security/operational CI checks;
- block force push and deletion;
- restrict workflow-file changes to reviewed PRs;
- preserve the existing explicit human Production gate.

Repository administration controls are not changed during P1a.


## P1a rebaseline record — 2026-09-26

The first canary failure is retained as a valid fail-closed result, not erased:

- old baseline: `p1a-initial-push-trigger-v1`
- old start-after date: `2026-09-22`
- detected gap: expected `2026-09-23`, observed `2026-09-24`
- prior state: `RESET_REQUIRED`
- root cause: GitHub Actions `GITHUB_TOKEN` push recursion suppression prevented the original push-trigger mirror from following autonomous writer commits
- remediation: mirror now triggers from successful `workflow_run` completion and has already mirrored live writer output successfully
- new baseline: `p1a-workflow-run-v2`
- new start-after date: `2026-09-24`
- counter restarts at `S0/3`; 2026-09-23 and 2026-09-24 are not retroactively counted

Only the exact historical RESET signature above is authorized for this one-time normalization. Any different or future RESET remains fail-closed and requires a separate explicit review.


## P1a acceptance completion — 2026-10-01

The rebaselined P1a canary completed the required three consecutive NYSE sessions:

- 2026-09-25
- 2026-09-28
- 2026-09-29
- counter: `S3/3`
- state: `COMPLETE`
- gap: `null`

Daily, Phase 5, Lifecycle, and the shadow mirror remained green through completion. The P1a shadow workflow is therefore retired from autonomous execution and retained only as a manual, read-only archive verifier.

## P1b cutover design

After merge, operational authority changes as follows:

- `main`: code/config/policy source only; autonomous workflows do not commit runtime state to it.
- `ops-state`: authoritative operational state under `github-pages/public/data/**`.
- `state-plane/runtime-manifest.json`: authoritative generation metadata for the latest persisted state generation.
- archived `state-plane/canary.json` and `state-plane/mirror-manifest.json`: retained P1a evidence only and remain non-authoritative.

Each operational writer is split into three security domains:

1. **Read-only generation** — exact `main` plus exact `ops-state` are checked out without persisted credentials. Provider access, npm, strategy logic, regression tests, and candidate generation run only here.
2. **Minimal state persistence** — a separate `contents:write` job downloads the validated artifact, independently checks the data-tree hash and runtime manifest, verifies the base `ops-state` SHA with compare-and-swap semantics, and pushes only to `ops-state`. It does not run npm, provider code, or repository scripts.
3. **Exact Pages deployment** — a reusable deployment workflow checks out the exact validated `main` SHA and exact persisted `ops-state` SHA, verifies the authoritative runtime manifest/data hash, overlays state onto code, builds with read-only repository permission, and delegates actual Pages/OIDC authority to a package-free deploy job.

The writer concurrency group remains `daily-signal-pages`. Persistence re-checks both the current `main` head and the current `ops-state` head before commit and again before push; Pages deployment also refuses to run if either branch head no longer equals the validated SHA. This prevents both stale-state commits and deployment of an older code/state pair after a concurrent code update.

The Human Production Approval workflow follows the same split. The human decision and its refreshed validated live state are committed atomically to `ops-state`; it no longer depends on a state commit to `main` or on GitHub Actions push recursion.

## P1b acceptance gate

Before P1c branch protection, require:

1. migration CI is green on the P1b branch;
2. PR diff contains only intended state-plane/workflow/test/documentation changes;
3. after merge, at least one real Daily writer run persists to `ops-state` and never changes `main`;
4. the persisted `runtime-manifest.json` records `mode=OPS_STATE_AUTHORITATIVE`, `authoritative=true`, the exact source `main` SHA, prior `ops-state` SHA, and matching data-tree hash;
5. Pages is built from that exact main/state pair and deploys successfully;
6. Phase 5 and Lifecycle also complete successfully against authoritative `ops-state`;
7. archived P1a evidence remains unchanged and non-authoritative;
8. `platformMode=RESEARCH` and no broker authority is introduced.

Only after this gate is satisfied should P1c protect `main`.
