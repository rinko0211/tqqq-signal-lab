# Audit 9 Findings — Wave 2 Persistence / Recovery Chaos

Date: 2026-08-29
Audit: Audit 9 — Temporal, Recovery & Chaos Audit
Frozen charter: `research/audit-9-charter-2026-08-29.md`
Formal discovery head: `eec7d0e68e1b6dd232e60e8f7aa67a4f29a0db40`
Workflow: `Audit 9 Wave 2 Persistence Chaos`
Workflow run: `33230373453`
Job: `99042024993`

## Audit accounting

**Audit 9 is permanently NOT CLEAN. CLEAN streak remains 0/2.**

This status is irreversible even after successful remediation. Audit 9 Wave 1 had completed its 500-session temporal/action-authority discovery without a new material defect, but Wave 2 independently discovered two new material persistence/recovery defects in Phase 5 append-only authority.

The initial Wave 2 discovery executed six sequence tests. Two Phase 5 tests dynamically confirmed product defects. Two other failures were test-fixture assumptions and are explicitly excluded from material finding accounting:

- Forward recovery fixture incorrectly required the ledger to remain byte-for-byte the same even though newer valid market sessions were supplied. The product correctly appended/backfilled legal new observations; its corruption-rejection assertions had already passed.
- Production Health fixture attempted its first review on `2027-11-25`, Thanksgiving Day, an NYSE full-day closure. The product correctly did not consume the review on that closed session.

Those harness corrections may be made without changing product behavior. The two Phase 5 findings below must be remediated only after this finding record is persisted.

---

# A9-M01 — Phase 5 Started-Series History Completeness Is Not Proven Across Retry

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

## Dynamic evidence

A valid authoritative Phase 5 ledger was cloned and the first record of the already-started `UPRO-SPBT-v1.0` series was removed while preserving:
- schemaVersion and appendOnly metadata;
- remaining record keys;
- canonical ordering of the surviving records;
- known registered strategy identity;
- all later records and current metadata.

The corrupted ledger was then passed repeatedly through the actual `updatePhase5LedgerSubset()` product entrypoint with otherwise valid data. Five consecutive retry attempts accepted the truncated suffix rather than rejecting the prior ledger.

Expected sequence invariant: **T04/T10 — reject incomplete started history before any retry can normalize/bless it.**
Observed: the prefix-truncated history survived all retry attempts.

## F1 — Root Cause

`assertPhase5LedgerInternalIntegrity()` validates schema, append-only flag, known registered strategy versions, valid session dates, parseable timestamps, logical keys, duplicate keys and canonical order. It does **not** establish history completeness for each started frozen strategy from its immutable `startDate` through that strategy's latest record.

`appendFreeze()` anchors only from the latest surviving record. Therefore a missing prefix or interior historical session can become invisible to subsequent retries: the update resumes after the surviving tail and never proves that all prior required sessions still exist.

This is a structural append-only completeness gap, not a one-line retry bug.

## F2 — Fault-Class Expansion

Primary fault classes:
- FC-10 Append-Only Integrity
- FC-05 Recovery / Re-entry
- FC-16 Fault Masking / Silent Default

Secondary:
- FC-06 Cross-System Isolation
- FC-09 Data Completeness

Expanded family:
- one-record prefix loss after series start;
- multi-record prefix loss;
- interior session deletion;
- per-version truncation while peers remain complete;
- partial persistence after valid generation;
- cached/truncated Phase 5 file followed by repeated scheduled retry;
- truncation immediately before formal Lifecycle review;
- truncation followed by one-system recovery/catch-up;
- recovery after corruption without retroactively reconstructing immutable evidence.

## F3 — Invariant Promotion

**A started Phase 5 strategy may participate in persistence, review, recovery, or user-facing authority only when its stored record sequence proves contiguous expected NYSE-session coverage from the immutable registered `startDate` through that strategy's latest stored market date. A structurally valid surviving suffix is not sufficient. Missing historical sessions must fail closed before append/retry.**

This promotes Audit 9 T04/T10 specifically to Phase 5, parallel to the already-hardened Forward completeness contract.

## F4 — Coverage Expansion

Permanent regression must cover at least:
1. first-record/prefix deletion for one Phase 5 version;
2. multi-record prefix deletion;
3. interior session deletion;
4. one-version-only truncation with healthy peers;
5. repeated retry against a truncated prior;
6. clean unstarted/empty states where creation is legal;
7. clean complete started histories;
8. one-system recovery without peer rewrites.

Audit 9 Wave 3 must combine Phase 5 truncation with delayed recovery and at least one other temporal axis (e.g. Lifecycle review boundary or one-system feed failure).

## F5 — Next-Audit Mutation

Audit 10 meta-audit must explicitly verify that append-only completeness is represented symmetrically across Forward and Phase 5 rather than assuming duplicate/order/date validation implies completeness.

Any future sequence generator must mutate omission patterns (prefix, middle, per-version) independently from duplicates/order corruption.

---

# A9-M02 — Phase 5 Record Chronology Can Exceed Its Ledger Generation Across Recovery

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

## Dynamic evidence

A valid Phase 5 ledger was cloned and one historical record's `recordedAt` was changed to `2030-01-02T21:00:00.000Z` while the containing ledger `updatedAt` remained in 2026.

The corrupted ledger was then passed through five repeated `updatePhase5LedgerSubset()` recovery attempts using otherwise valid Phase 5 data and 2026 generation timestamps.

Expected sequence invariant: **T04/T08/T10 — an observation cannot occur after its containing artifact generation; impossible chronology must fail closed and cannot be normalized by retry.**
Observed: the impossible record chronology was accepted through all retries.

## F1 — Root Cause

`assertPhase5LedgerInternalIntegrity()` checks that `recordedAt` is parseable but does not enforce `recordedAt <= ledger.updatedAt`.

Consequently a Phase 5 prior can claim that a historical observation was recorded after the artifact containing it was generated. Subsequent updates overwrite the top-level `updatedAt` with the retry generation while preserving the impossible historical `recordedAt`, allowing the contradiction to persist or become even more pronounced.

This is a temporal integrity gap at the append-only persistence boundary.

## F2 — Fault-Class Expansion

Primary fault classes:
- FC-10 Append-Only Integrity
- FC-01 Temporal Boundary
- FC-05 Recovery / Re-entry

Secondary:
- FC-11 Concurrency / TOCTOU
- FC-16 Fault Masking / Silent Default

Expanded family:
- record timestamp strictly after ledger.updatedAt;
- far-future historical record timestamp;
- equal-boundary timestamp (valid);
- mixed valid and impossible per-version timestamps;
- retry with a generation earlier than an already-stored record;
- partial persistence where record and top-level metadata come from different generations;
- clock rollback after a valid record is persisted;
- recovery after impossible chronology without rewriting valid historical evidence.

## F3 — Invariant Promotion

**Every Phase 5 record must be temporally possible within its containing append-only artifact: each `recordedAt` must be a valid timestamp no later than the ledger `updatedAt`. Retry or recovery may not legitimize a record whose observation time lies after the artifact generation.**

Equality is valid. A strict `recordedAt > updatedAt` contradiction fails closed before append/retry.

## F4 — Coverage Expansion

Permanent Phase 5 regression must cover:
1. record before updatedAt;
2. record equal to updatedAt;
3. record after updatedAt;
4. far-future record;
5. one corrupted record among valid peers;
6. repeated retry while corrupted;
7. clean recovery using a coherent ledger;
8. interaction with subset update and one-system failure.

Audit 9 Wave 3 must combine impossible Phase 5 chronology with another temporal/recovery fault.

## F5 — Next-Audit Mutation

Audit 10 must compare chronology contracts across Forward, Phase 5, Lifecycle and Production Health and identify any asymmetric artifact-level timestamp guarantees.

Future chaos generators must independently mutate top-level generation clocks and nested record clocks, including rollback/forward jumps and cross-generation partial persistence.

---

## Remediation gate

Remediation may begin only after this record is committed.

Required properties:
1. harden the actual Phase 5 prior-ledger boundary, not only a test/helper path;
2. prove contiguous started-series NYSE-session completeness from immutable freeze start to latest stored date;
3. enforce `recordedAt <= ledger.updatedAt` for every Phase 5 record;
4. preserve legal empty/unstarted ledger creation;
5. preserve one-system subset update and peer isolation semantics;
6. preserve append-only history; do not reconstruct or rewrite authoritative historical evidence to make a corrupted ledger appear valid;
7. add permanent Audit 9 sequence regressions for both fault families;
8. rerun Wave 1, corrected Wave 2, prior Audit 8 independent regressions, full core, full ops, Pages build and authoritative-state no-mutation gates;
9. perform no strategy retuning or Production promotion.

After remediation, Audit 9 remains permanently NOT CLEAN and the CLEAN streak remains **0/2**. Audit 9 must continue Wave 3 integrated chaos before closure.
