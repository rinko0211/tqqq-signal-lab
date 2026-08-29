# Audit 9 Finding 003 — Production Health Recurrence After Late Recovery

Date: 2026-08-29
Audit: Audit 9 — Temporal, Recovery & Chaos Audit
Frozen charter: `research/audit-9-charter-2026-08-29.md`
Discovery head: `9d8d2f88f53322221d67248e5797440f57450fb2`
Workflow: `Audit 9 Wave 2 Persistence Chaos`
Workflow run: `33230536336`
Job: `99042456103`

## Classification

**A9-M03 — MATERIAL / DYNAMICALLY CONFIRMED**

**Audit 9 remains permanently NOT CLEAN. CLEAN streak remains 0/2.**

The first Wave 2 Health fixture had incorrectly attempted to consume a quarterly review on Thanksgiving 2027. That initial failure was correctly classified as a harness-date error and is not itself a product finding.

The fixture was then corrected so that the immutable quarterly due date remained `2027-11-25` while review consumption occurred after the next legal NYSE boundary. The corrected sequence subsequently exposed a different product defect:

1. a normal review event was recorded for due date `2027-11-25`;
2. a long outage was simulated until `2028-08-25`;
3. recovery correctly appended only one `LATE_CURRENT_STATE_ONLY` current-state review for due date `2028-02-25`, rather than fabricating one event per missed quarter;
4. the ledger correctly reported the next review as `2028-11-25`;
5. after the next legal NYSE boundary following `2028-11-25`, the expected normal recurring review was **not recorded**;
6. the ledger remained at two events instead of resuming recurrence with a third event for due date `2028-11-25`.

This is a sequence-only defect: the isolated multi-quarter recovery behavior is safe, but the state produced by that recovery suppresses later legitimate recurring reviews.

---

## F1 — Root Cause

`updateProductionHealthLedger()` derives the next due date from the latest episode event. When the latest event has `timing === "LATE_CURRENT_STATE_ONLY"`, it executes:

`while (nyseReviewBoundaryReached(due, now)) due = addMonths(due, 3)`

before deciding whether to append a review.

That logic is correct only while collapsing already-missed historical due dates during the *same late-recovery observation*. It is not scoped to that recovery instant. On every later invocation, the latest event is still permanently labeled `LATE_CURRENT_STATE_ONLY`, so when a genuinely new future quarterly due date eventually reaches its legal boundary, the same loop skips that due date as though it were another historical missed quarter.

The persistent historical label therefore becomes a permanent control flag. Once a late recovery occurs, future recurring reviews can be skipped indefinitely.

This is a structural recurrence-state bug rather than a holiday/calendar bug.

---

## F2 — Fault-Class Expansion

Primary fault classes:
- FC-12 Lifecycle Recurrence
- FC-05 Recovery / Re-entry
- FC-16 Fault Masking / Silent Default

Secondary:
- FC-01 Temporal Boundary
- FC-10 Append-Only Integrity

Expanded family:
- one-quarter late review followed by a future on-time review;
- multi-quarter outage followed by normal recurrence;
- late review around weekend/holiday effective boundaries;
- repeated scheduler recovery runs on the late-recovery day;
- transition from `LATE_CURRENT_STATE_ONLY` back to `ON_TIME` recurrence;
- Production reaffirmation after a late Health event;
- A→B→A episodes where an old late event must not suppress the new episode schedule;
- Decision-with-incumbent while the incumbent Health schedule recovers;
- repeated years after one historical late recovery.

---

## F3 — Invariant Promotion

**A late current-state Health recovery may collapse only the historical review dates that were already missed at that recovery observation. It must not permanently consume future quarterly recurrence. Once the next future review boundary arrives, a normal review event must again be eligible and exactly-once. Historical `LATE_CURRENT_STATE_ONLY` evidence is immutable evidence, not a persistent instruction to skip all later due dates.**

This strengthens Audit 9 T11: transient/long-outage recovery must preserve future review recurrence as well as retryability of the immediate missed review.

---

## F4 — Coverage Expansion

Permanent sequence regression must cover:
1. normal review -> long outage -> one late current-state review -> future normal review;
2. multiple reruns during the late-recovery observation with no duplicate events;
3. multiple reruns at the later normal review with exactly one event;
4. holiday/weekend due dates consumed only after their legal NYSE review boundary;
5. at least two subsequent normal quarterly recurrences after a late recovery;
6. same sequence across Production reaffirmation;
7. episode transition/re-entry so prior late evidence cannot suppress a new episode;
8. no retrospective fabrication of intermediate missed quarters.

Audit 9 Wave 3 must combine this family with another temporal axis, such as holiday boundary, Production re-entry, or transient Lifecycle failure.

---

## F5 — Next-Audit Mutation

Audit 10 meta-audit must distinguish:
- immutable historical event labels (`ON_TIME`, `LATE_CURRENT_STATE_ONLY`), and
- mutable/derived scheduler control state.

It must search for any other place where a historical evidence classification is reused indefinitely as a control flag for future recurrence.

Future sequence generators must always continue beyond the immediate recovery event far enough to verify that ordinary recurrence resumes.

---

## Remediation gate

Remediation may begin only after this record is committed.

Required properties:
1. preserve the no-retrospective-fabrication behavior of late recovery;
2. scope missed-quarter collapsing to the recovery observation rather than the permanent historical label alone;
3. restore later normal quarterly recurrence;
4. preserve exactly-once semantics under repeated retries on both the recovery date and later review dates;
5. preserve holiday/weekend review boundary behavior;
6. preserve episode isolation and same-system reaffirmation semantics;
7. add permanent Audit 9 sequence regression extending at least two normal recurrences beyond a late recovery;
8. rerun corrected Wave 2, Wave 1, prior Audit 8 families, full core, full ops, Pages build and authoritative-state no-mutation gates;
9. perform no strategy retuning, Production promotion, or append-only history rewrite.

After remediation, Audit 9 remains permanently NOT CLEAN and the CLEAN streak remains **0/2**.
