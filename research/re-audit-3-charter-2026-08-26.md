# Re-Audit 3 Charter

Date: 2026-08-26
Status: PRE-REGISTERED BEFORE AUTHORITATIVE RUN

## Purpose
Run a fresh complete reliability re-audit against the repository after Re-Audit 2 remediation. This round is independent of the prior material-finding round and is eligible to advance the clean-audit streak only if no new material defect is discovered.

## Governing protocol
`research/final-re-audit-protocol-2026-08-26.md` remains authoritative.

## Clean-round rule
This round is CLEAN only if:
- no new material finding is discovered during direct source/config inspection;
- permanent regression tests pass;
- authoritative operational workflow configuration remains healthy;
- current state files are internally consistent;
- Pages builds successfully;
- verification does not mutate runtime state;
- no automatic Production change occurs.

Any material defect found during this round resets/keeps the certification streak at 0/2 even if fixed immediately.

## Direct inspection scope
The auditor must directly inspect, not merely rely on prior reports:
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
12. GitHub Actions assumptions that materially affect execution.

## Current pre-run observations
Direct inspection already confirmed before the authoritative run:
- Human Approval requires DECISION, fresh Lifecycle review, FORMAL/STRONGER stage, `PHASE6_HUMAN_DECISION_REQUIRED`, an eligible frozen version, exact confirmation text, live preflight, and atomic persistence.
- Daily, Phase5, Lifecycle and Human Approval preflight serialize operational writes through `daily-signal-pages` with `cancel-in-progress: false`.
- Production config is currently RESEARCH with no human-approved Production.
- Lifecycle is ACCUMULATING with no Production-selectable candidate and user action NONE.
- Daily status is successful and points to the latest completed market session.
- UI fails closed on stale Lifecycle review and separates operational eligibility from Production-selectable status.
- Formal non-TQQQ data fetch is bounded and preserves independent TQQQ/QQQ incumbent baseline data.

These observations do not themselves make the round CLEAN; the authoritative read-only CI verification must also pass and remaining direct-source inspection must reveal no material issue.

## Production safety
This audit must not:
- select or promote a Production system;
- rewrite Forward history;
- backfill missed Forward observations;
- alter research parameters or frozen versions;
- run historical optimizer/mining work;
- modify operational state files as part of verification.

## Certification outcome
- CLEAN => streak may advance from 0/2 to 1/2.
- MATERIAL FINDING => streak remains/resets to 0/2.

No Production authorization follows from a clean audit; frozen Forward gates and explicit human approval remain mandatory.
