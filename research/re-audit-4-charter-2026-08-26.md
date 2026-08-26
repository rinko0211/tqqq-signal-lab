# Re-Audit 4 Charter — Complete Clean-Round Candidate

Date: 2026-08-26
Status: **PRE-REGISTERED BEFORE CURRENT-HEAD AUTHORITATIVE AUDIT**

## Purpose
Run a fresh complete reliability re-audit against the current remediated repository. This round supersedes the earlier Re-Audit 3 run as a certification candidate because the repository head changed after that run to permanently register the Phase C/D/E regression tests and strengthen Phase F verification.

Pre-charter baseline inspected before this charter commit: `48403ccc74de3484e60be6606ce5abddc23f3f7a`.
The authoritative audit baseline is this charter commit and subsequent audit-only verification changes, provided no runtime/strategy/operational-state change is made.

## Governing rule
`research/final-re-audit-protocol-2026-08-26.md` remains authoritative.

A round is CLEAN only if no new material defect is found during direct source/config inspection and all permanent regression / workflow / state / Pages checks pass. Any material defect found during this round keeps/resets the clean streak at 0/2 even if fixed immediately.

## Complete direct-inspection scope
The auditor must independently inspect all protocol areas:
1. strategy/version freeze and research lineage;
2. data sourcing and ticker/proxy mapping;
3. execution causality and append-only Forward behavior;
4. Production registry and Human Approval path;
5. Daily / Phase5 / Lifecycle triggers and dependencies;
6. non-TQQQ Production transition behavior;
7. TQQQ incumbent Forward isolation;
8. stale/failed fail-closed UI action;
9. current Pages/PWA data semantics;
10. scheduled workflow inventory and archived/manual research isolation;
11. current lifecycle state and Production-selectable logic;
12. GitHub Actions/platform assumptions that materially affect execution.

## Historical-failure weighted review
In addition to the minimum scope, the auditor must deliberately stress the areas that repeatedly generated material or major findings in prior audits:

### A. Production / Decision / Human Approval state machine
Check all legal and illegal transitions, incumbent preservation during DECISION, cancel paths, same-system reaffirmation, fresh lifecycle evidence, FORMAL/STRONGER gating, Production-selectable frozen version validation, exact human confirmation, preflight, atomic persistence, and post-approval live refresh.

### B. GitHub Actions trigger semantics and write serialization
Check schedules, workflow_call / workflow_dispatch / push assumptions, GITHUB_TOKEN non-recursive behavior, concurrency group consistency, cancel-in-progress policy, failure-state persistence, deploy ordering, and whether any archived/research workflow can accidentally create autonomous observations.

### C. Cross-ticker separation
Check bounded non-TQQQ Production acquisition, selected ticker/proxy mapping, independent TQQQ/QQQ incumbent baseline, local holdings ticker/version binding, Forward ledger ticker identity, and UI/data-source selection after a Production switch.

### D. Authority and fail-closed UI semantics
Check Research/Baseline vs Formal Production labels, DECISION-pending incumbent continuity, eligibility vs Production-selectable distinction, stale/failed Daily and Lifecycle behavior, current ticker/version identity, tiny-sample metric suppression, and modeled-vs-real-account wording.

### E. Append-only / time / market-session integrity
Check no retroactive LIVE backfill, t-close to next legal NYSE open causality, holiday/DST calendar use, corporate-action continuity without rewriting history, upstream session-aware freshness, and unexplained restatement fail-closed behavior.

### F. Historical-research isolation
Check routine Daily/Phase5/Lifecycle paths do not rerun optimizer/WF/OOS mining or fetch closed research-universe symbols, and that verification itself does not mutate Forward or Production state.

## Production safety
This audit must not:
- select or promote Production;
- rewrite Forward history;
- fabricate or backfill missed LIVE observations;
- retune strategy parameters or frozen versions;
- run historical optimization/mining as an operational action;
- weaken a safety gate merely to obtain a PASS.

## Required evidence before a CLEAN decision
- direct source/config inspection completed for all 12 protocol items plus the weighted review above;
- permanent `test:core` and `test:ops` pass;
- focused recurring-failure regression passes;
- current Daily / Phase5 / Lifecycle workflow configuration is healthy;
- current state files are internally coherent and non-promoted;
- Pages build passes;
- verification causes no runtime-state mutation;
- no new material finding is discovered.

## Certification outcome
- CLEAN: clean streak may advance from 0/2 to 1/2.
- MATERIAL FINDING: streak remains/resets to 0/2.

A CLEAN result does not authorize Production and does not shorten the frozen Forward gates.