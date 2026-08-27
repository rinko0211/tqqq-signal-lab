# Audit 7 Finding 004 — Append-only Internal Integrity and Missing-Anchor Fail-Open

Date: 2026-08-27
Audit: Audit 7 — State-Space & Discontinuity Audit
Baseline protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Classification: **MATERIAL / CONFIRMED BY WHITE-BOX STATE ANALYSIS**
Audit accounting: Audit 7 remains permanently NOT CLEAN; clean streak 0/2.

## Discovery mechanism

Model-based white-box expansion of the Ledger axis (`valid append-only`, `duplicate`, `out-of-order`, `malformed schema`, `retroactive mutation`) crossed with data-source discontinuity (`prior anchor present` versus `prior anchor missing from the newly fetched provider dataset`).

## Observed defects

### 1. Forward prior-anchor disappearance can fall back to dataset index 0

`lib/forward.ts::appendForFreeze()` computes the incremental start as:

`ds.days.findIndex(d => d.date === last.marketDataDate) + 1`

When the prior immutable ledger's last market-data date is absent from the newly fetched provider dataset, `findIndex()` returns `-1`, and adding one produces `0`. The function therefore does not distinguish “the prior anchor is missing” from “start at the beginning.” Unlike the Phase 5 path, the Forward path has no explicit pre-start write guard inside that loop.

This creates a state where a provider window change, source omission, or corrupted/mismatched dataset can cause the updater to re-scan from the beginning and append observations earlier than the frozen Forward start. The append-only historical ledger would then be polluted rather than failing closed.

### 2. Internal append-only record integrity is not validated at library boundaries

Audit 6 added top-level checks such as `schemaVersion` and `appendOnly`, but the current library boundaries do not comprehensively reject already-corrupt internal history:

- Forward: freeze definitions are validated, but duplicate record keys/date-version pairs are not rejected before update.
- Phase 5: freeze definitions and pre-start writes are guarded, but a prior ledger containing duplicate frozen-system records can remain accepted.
- Lifecycle: prior validation checks only top-level schema/appendOnly before cloning; duplicate/out-of-order event keys are not structurally rejected.
- Production Health: prior validation checks only top-level schema/appendOnly; duplicate due-date/version events can influence episode scheduling without a boundary integrity rejection.

The existing Audit 6 regression named “invalid supplied append-only prior ledgers are rejected” exercises only a `schemaVersion=999` mutation and therefore does not cover this internal state family.

## Why material

These ledgers are the immutable evidence and control-history layer used to justify future Production decisions. Silent acceptance of duplicate or anchor-incoherent prior history weakens exactly-once semantics, can alter counts/review chronology, and can make future state depend on corrupt historical structure. A missing provider anchor must never be interpreted as authorization to rebuild or backfill immutable history from an earlier point.

## F1 — Root Cause

Integrity is distributed across update logic and freeze checks rather than represented by explicit complete ledger validators. Incremental update code assumes the prior anchor is present in the newly fetched dataset and encodes that assumption through arithmetic on `findIndex()` without checking the sentinel `-1` result first.

## F2 — Fault-Class Expansion

Primary: `FC-10 Append-Only Integrity`.
Secondary: `FC-09 Data Completeness`, `FC-16 Fault Masking / Silent Default`.

Repository-wide expansion must cover:
- duplicate keys;
- duplicate logical date/version pairs;
- out-of-order chronology where order is semantically required;
- records earlier than frozen start;
- future-dated records;
- malformed event/record shape at minimum authority fields;
- prior anchor missing from new provider data;
- provider history truncation;
- one-system anchor loss under Phase 5 subset updating;
- re-entry/episode histories in Production Health.

## F3 — Invariant Promotion

I-06 and I-08 are concretized as:

**Every append-only operational ledger must validate its internal identity/chronology invariants before update. An incremental updater must prove the immutable prior anchor exists in the new source view before appending. Missing-anchor state fails closed and never triggers an implicit rebuild or earlier backfill.**

## F4 — Coverage Expansion

Audit 7 adds behavioral probes for:
1. Forward missing-anchor update;
2. duplicate Forward key;
3. duplicate Phase 5 key;
4. duplicate Lifecycle event key;
5. duplicate Production Health version/dueDate key.

Audit 9 must inject provider-history truncation and persisted-ledger duplication during long sequences and verify that recovery requires explicit operator/data remediation rather than history reconstruction.

## F5 — Next-Audit Mutation

Audit 8 black-box fixtures must include individually well-formed but internally duplicated/out-of-order authority histories and provider payloads missing the current immutable anchor. The external oracle must require non-actionable/fail-closed behavior.

## Remediation requirements

1. Introduce explicit internal validators at each append-only library boundary.
2. Reject duplicate logical identity keys and invalid chronology before mutation.
3. Forward must explicitly reject a missing prior anchor instead of allowing `-1 + 1 => 0` fallback.
4. Preserve all existing legitimate immutable records; do not rewrite current authoritative history.
5. Add permanent behavioral regressions and fault-injection fixtures.
6. Verify current authoritative ledgers already satisfy the new validators before persisting remediation.
