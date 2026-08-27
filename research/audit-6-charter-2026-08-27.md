# Audit 6 Charter — Independent Complete Re-Audit

Date: 2026-08-27
Baseline head: `317c8e94c827a527b7aac37fd2d91fc2e56c0700`
Candidate status: **Clean 1/2 only if no new material defect is found**
Governing policy: `research/final-reliability-certification-policy-2026-08-27.md`

## Objective
Perform an independent complete re-audit of the current operational repository after Audit 5 remediation. This round must not merely rerun prior tests. It must directly inspect source/configuration, workflow behavior, generated-state contracts, user-facing authority semantics, and current authoritative state.

## Historical failure registry to re-check
1. Corporate-action / split continuity across append-only Forward accounting.
2. NYSE session, timezone, holiday, completed-bar, stale-status and t-close → next-open causality.
3. Regime-family evidence and operational eligibility vs Pareto promotion merit.
4. RESEARCH / DECISION / PRODUCTION state transitions and approved-incumbent continuity.
5. Human Approval freshness, exact eligible version, atomic persistence and exact persisted deployment.
6. Cross-ticker data separation and preservation of the immutable TQQQ reference Forward.
7. Forward canonical freeze integrity, append-only semantics and no retroactive rewrite.
8. UI authority labels, stale/failure fail-closed behavior, missed-open handling, holdings ticker/version binding and no duplicate Production-as-Research presentation.
9. Workflow trigger isolation, scheduled inventory, queued serialization, pending-job retention and validation→persist TOCTOU protection.
10. PWA / Pages freshness and failure visibility.
11. Lifecycle annual-review recurrence, review-event consumption, dynamic incumbent behavior and challenger-failure isolation.
12. Historical-research isolation from routine Forward/Production operations.

## Audit 6 additional adversarial focus
- Interactions between Audit 5 fixes rather than only each fix in isolation.
- Non-session annual review dates and calendar rollover behavior.
- Provider bars carrying impossible/non-session dates.
- Direct or malformed Production configuration states and whether routine Daily can operationalize an unvalidated state.
- Post-approval coherence when a Production ticker is also a Phase 5 frozen candidate.
- Failure and restart paths after missed schedules or concurrent source changes.

## Required evidence
- Direct source/config inspection.
- Current workflow inventory and recent run health.
- Permanent regression registration.
- Full `test:core`, `test:ops`, `npm test`, lint and Pages build in an authoritative Audit 6 verification run.
- Non-persistent live operational preflight with authoritative-data restoration.
- Final authoritative state check proving no Production promotion or Forward rewrite by the audit.

## Accounting rule
If any new material defect is discovered, Audit 6 is **NOT CLEAN**, even if repaired during this round, and the clean streak remains `0/2`. Only a complete round with no new material defect may be recorded as `CLEAN 1/2`.
