# Audit 10 Finding 003 — Current State Evidence Provenance

Date: 2026-08-29
Audit: Audit 10 — Meta-Audit / Coverage Closure
Finding: **A10-M03 — Lifecycle and Production Health current authority can claim review state not supported by append-only event history**
Classification: **MATERIAL / DYNAMICALLY CONFIRMED / AUTHORITY-PROVENANCE GAP**
Formal discovery head: `47552ee2e05273411aa209c974eb3fdf2485757f`
Workflow run: `33238412350`
Job: `99063399896`

## Audit accounting

Audit 10 remains permanently **NOT CLEAN / 0-of-2**. This is distinct from A10-M01/M02: those validate timestamps of stored events; M03 concerns whether the mutable-looking `current` summary is actually derivable from immutable event evidence before approval/UI consumers trust it.

## Dynamic evidence

Wave 2 constructed two fresh, syntactically valid ledgers with no supporting review events:

1. Lifecycle `current` claimed `PHASE6_HUMAN_DECISION_REQUIRED`, contained an eligible/selectable VS13 review, and passed both freshness and upstream-age gates. `productionEligibleVersions()` returned `VS13-v1.0`. `assertLifecycleLedgerInternalIntegrity()` nevertheless accepted the unsupported state.
2. Production Health `current` claimed `lastReview=2029-01-10` and Healthy active state with an empty event history. `assertProductionHealthLedgerInternalIntegrity()` accepted it.

The approval script reads Lifecycle freshness/upstream coverage and then consumes `lifecycle.current.systemDecision` plus `productionEligibleVersions(lifecycle)` without first calling `assertLifecycleLedgerInternalIntegrity()`.

## Why material

A forged or partially persisted `current` object can become more authoritative than append-only history. In Lifecycle, that can surface a human Production approval path with no supporting scheduled-review event. In Production Health, it can report a last review that never occurred. This breaks provenance, auditability, recovery semantics, and authority integrity.

## F1 — Root Cause

Lifecycle and Production Health integrity validators validate event-internal structure but do not enforce semantic coherence between `current` and the event history from which `current` is supposed to be derived.

Additionally, the Production approval entrypoint relies on Lifecycle freshness and current fields but does not explicitly validate Lifecycle ledger internal integrity before using those fields.

## F2 — Fault-Class Expansion

Primary:
- FC-02 Authority Integrity
- FC-10 Append-Only Integrity
- FC-16 Fault Masking / Silent Default
- FC-04 State Transition

Secondary:
- FC-03 Persistence / Atomicity
- FC-05 Recovery / Re-entry
- FC-11 Concurrency / TOCTOU
- FC-15 Contract Divergence

Mutations include empty history + authoritative current, current lastReview not found in events, current reviewCycleDate not represented by a cycle event, current selectable candidate not present in frozen cycle evidence, stale old-episode event backing a new current episode, and approval consumers called without an integrity gate.

## F3 — Invariant Promotion

**Operational `current` summary state is not an independent authority source. Any current field that asserts a completed review, review cycle, human-decision eligibility, selectable candidate, or lastReview must be provably backed by the corresponding immutable append-only event evidence for the active episode/cycle. Consumers that can change Production authority must validate that provenance before reading `current` as authority.**

## F4 — Coverage Expansion

Permanent regression must independently cover:
1. Lifecycle human-review current with no event — reject;
2. Lifecycle reviewCycleDate with no matching event — reject;
3. selectable current candidate absent from frozen cycle event — reject;
4. valid pending human-review current backed by matching event — accept;
5. Production Health lastReview with no matching event — reject;
6. valid lastReview backed by active-episode event — accept;
7. A→B→A old episode evidence cannot back new current episode;
8. approval entrypoint validates Lifecycle integrity/provenance before eligibility consumption;
9. UI remains display-only and cannot manufacture authority from unsupported current;
10. recovery/retry preserves append-only evidence and rebuilds coherent current without retroactive fabrication.

## F5 — Next-Audit Mutation

Any later independent audit restarting the CLEAN streak must mutate current summaries and immutable histories independently across approval, UI, retry, episode transition, cache/reload, and long-outage recovery paths. It must not derive expected state from the same product helper being tested.

## Remediation gate

Remediation may begin only after this finding record is persisted. Required remediation must harden actual validators and the Production approval boundary, preserve valid review/recurrence behavior, and add permanent provenance regressions. No strategy retuning, Production promotion, Human Approval, or authoritative-history rewrite is permitted.