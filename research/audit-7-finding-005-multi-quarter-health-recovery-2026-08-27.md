# Audit 7 Finding 005 — Multi-Quarter Production Health Recovery Replays Missed Reviews

Date: 2026-08-27
Audit: Audit 7 — State-Space & Discontinuity Audit
Baseline protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Classification: **MATERIAL / DYNAMICALLY CONFIRMED**
Audit accounting: Audit 7 remains permanently NOT CLEAN; clean streak 0/2.

## Discovery mechanism

Model-based discontinuity analysis across Production Health recurrence × long scheduler outage × recovery cadence. The new Audit 7 probe simulates a Production system whose quarterly Health updater has not run for multiple quarters, then resumes daily.

Audit 7 workflow run `33060471287` fails at the dedicated discovery step on this state.

## Observed defect

`updateProductionHealthLedger()` appends at most one due review per invocation, then advances `due` by exactly three months. For a very late recovery, the appended event is correctly marked `LATE_CURRENT_STATE_ONLY`, but the returned `nextReview` can still be another already-expired historical quarter.

Because the autonomous workflow runs daily, the next invocation can append another historical due date using the same current Lifecycle health snapshot. Repeated daily recovery runs therefore walk through the outage period quarter by quarter and create several append-only review events that were never actually observed at those historical boundaries.

Example state:
- Production effective: 2027-08-25
- first quarterly due: 2027-11-25
- updater resumes: 2028-08-30

Current behavior can append 2027-11-25 on the first recovery run, then 2028-02-25 on the next daily run, then 2028-05-25, etc., even though every appended state is derived from current 2028-08 health evidence.

## Why material

The Health ledger is append-only operational evidence. `LATE_CURRENT_STATE_ONLY` is intended to prevent retrospective fabrication, but a sequence of current-state observations attached to several missed historical due dates recreates the appearance of multiple reviews during an outage. This can distort review chronology, user-visible last/next review state, and downstream evidence about operational continuity.

## F1 — Root Cause

Recovery logic advances recurrence by one period per invocation instead of distinguishing:
1. one observed late recovery event, from
2. zero-observation missed schedule boundaries.

The recurrence cursor is tied to persisted events rather than advanced directly across unobserved historical quarters after a late recovery.

## F2 — Fault-Class Expansion

Primary: `FC-12 Lifecycle Recurrence`.
Secondary: `FC-16 Fault Masking / Silent Default`, `FC-01 Temporal Boundary`, `FC-10 Append-Only Integrity`.

Expanded state family:
- one missed quarter;
- two or more missed quarters;
- outage spanning year boundary;
- outage where one or more missed due dates are NYSE holidays/weekends;
- outage followed by Watch/Revalidation Required/Critical state;
- same-version re-entry episode after historical prior events;
- repeated daily invocations after the first late recovery.

## F3 — Invariant Promotion

**A recovery invocation may append at most one current-state Health observation. If that observation is late, all additional unobserved historical recurrence boundaries must be skipped without events, and `nextReview` must advance to the first future legal quarterly boundary. No later invocation may manufacture additional missed-quarter events from the same outage.**

## F4 — Coverage Expansion

Permanent Audit 7 regression must verify:
1. exactly one `LATE_CURRENT_STATE_ONLY` event after a multi-quarter outage;
2. `nextReview` is strictly in the future after that recovery;
3. a subsequent daily run does not append another historical event;
4. holiday/weekend rolling still governs the future eligibility boundary;
5. Critical/Revalidation user action remains based on current health, not skipped historical quarters.

Audit 9 must inject scheduler outages of 1–8 quarters into long-running state sequences and verify exactly-once recovery semantics.

## F5 — Next-Audit Mutation

Audit 8 black-box fixtures must include stale Health ledgers whose next due date is several quarters behind current time. The external oracle must observe one late recovery state and a future next-review date, never a cascade of historical review records.

## Remediation requirements

1. Preserve the first late recovery event as `LATE_CURRENT_STATE_ONLY`.
2. After that event, advance recurrence across every already-passed quarterly boundary without appending synthetic events.
3. Stop at the first future quarterly boundary under the existing NYSE session semantics.
4. Preserve existing append-only events and current authoritative data unchanged.
5. Add permanent behavioral regression and run Audit 7 probes plus full core/ops before closure.
