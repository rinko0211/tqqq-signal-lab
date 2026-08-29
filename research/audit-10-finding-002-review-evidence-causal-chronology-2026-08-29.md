# Audit 10 Finding 002 — Review Evidence Causal Chronology

Date: 2026-08-29
Audit: Audit 10 — Meta-Audit / Coverage Closure
Finding: **A10-M02 — Lifecycle and Production Health accept review evidence recorded before the review/due date it claims to evidence**
Classification: **MATERIAL / DYNAMICALLY CONFIRMED / CROSS-LEDGER CAUSALITY ASYMMETRY**
Formal discovery head: `47552ee2e05273411aa209c974eb3fdf2485757f`
Workflow run: `33238412350`
Job: `99063399896`

## Audit accounting

Audit 10 remains permanently **NOT CLEAN / 0-of-2**. This finding is independent of A10-M01: M01 bounded nested evidence above by artifact generation; M02 exposes the missing lower causal bound between a review event and the review/due date it claims to represent.

## Dynamic evidence

Wave 2 applied literal causal contradictions without importing market-calendar helpers into the oracle:

- Lifecycle event: `reviewDate=2027-02-25`, `recordedAt=2027-02-24T21:00:00Z` — **accepted**.
- Production Health event: `dueDate=2027-11-25`, `recordedAt=2027-11-24T21:00:00Z` — **accepted**.

Both should fail closed because evidence cannot be recorded before the review date whose state it claims to capture.

## Why material

These append-only events are operational review evidence. Accepting an event before its claimed review/due date permits future-state evidence to be persisted early and later treated as historical truth. This can affect recurrence, approval eligibility, recovery sequencing, and audit provenance even when top-level generation chronology is otherwise valid.

## F1 — Root Cause

`assertLifecycleLedgerInternalIntegrity()` validates reviewDate syntax, recordedAt syntax, event ordering, and `recordedAt <= ledger.updatedAt`, but does not require `recordedAt` to be on or after the claimed review date.

`assertProductionHealthLedgerInternalIntegrity()` has the same omission for `dueDate`.

The root cause is a missing causal lower bound on nested review evidence.

## F2 — Fault-Class Expansion

Primary:
- FC-01 Temporal Boundary
- FC-10 Append-Only Integrity
- FC-12 Lifecycle Recurrence

Secondary:
- FC-05 Recovery / Re-entry
- FC-11 Concurrency / TOCTOU
- FC-16 Fault Masking / Silent Default

Mutations include one-day/one-second early evidence, multi-day future review evidence, recovery events, holiday/weekend review boundaries, and mixed valid/early prefixes.

## F3 — Invariant Promotion

**A persisted Lifecycle or Production Health review event may not be recorded before the market date of the review/due date it claims to evidence. Review evidence must be causally possible at both bounds: not earlier than its claimed review date and not later than the containing artifact generation.**

## F4 — Coverage Expansion

Permanent regression must cover Lifecycle and Production Health independently for:
1. recordedAt before review/due date — reject;
2. same market date — accept;
3. after review/due date but <= ledger generation — accept;
4. nested evidence after ledger generation — reject (A10-M01 retained);
5. mixed valid + early event — reject before mutation;
6. repeated retry against corrupt prior — reject without normalization;
7. late-recovery semantics remain valid;
8. cross-ledger symmetry meta-test.

## F5 — Next-Audit Mutation

Any later independent audit restarting the CLEAN streak must vary event clocks, claimed review dates, artifact-generation clocks, recovery timing, and holiday/session boundaries independently. It must not count as independent if it merely reruns this exact fixture.

## Remediation gate

Remediation may begin only after this finding record is persisted. No strategy retuning, Production promotion, Human Approval, or authoritative-history rewrite is permitted.