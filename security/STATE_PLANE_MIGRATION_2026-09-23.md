# State Plane Migration — Security P1

Date: 2026-09-23
Status: P1a SHADOW ONLY

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

Before cutover, observe at least three consecutive completed NYSE sessions after deployment. The canary starts strictly after market date `2026-09-22`, counts only `success/latest/errors=[]` source states, rejects duplicates, and enters `RESET_REQUIRED` if a NYSE session is skipped. Require all of the following:

1. every triggering main operational-state generation is mirrored successfully;
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
