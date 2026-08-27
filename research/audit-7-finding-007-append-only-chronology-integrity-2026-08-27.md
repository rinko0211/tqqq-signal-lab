# Audit 7 Finding 007 — Append-Only Chronology and Semantic-Date Integrity Are Not Enforced

Date: 2026-08-27
Audit: Audit 7 — State-Space & Discontinuity Audit
Baseline protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Classification: **MATERIAL / DYNAMICALLY CONFIRMED**
Audit accounting: Audit 7 remains permanently NOT CLEAN; clean streak 0/2.

## Discovery mechanism

F2 continuation of A7-M04 against the protocol's explicit S9 Ledger states `out-of-order record` and malformed temporal authority. Audit 7 injected out-of-order and impossible-date priors into Forward, Phase 5, Lifecycle, and Production Health boundaries.

The dedicated Audit 7 discovery step fails these new probes in workflow run `33062087716`.

## Observed defects

### Forward / Phase 5

The internal validators reject duplicate logical keys and pre-start rows but do not require canonical record order or semantic market dates. The updater subsequently sorts records by `marketDataDate` and strategy version.

Therefore an already out-of-order append-only prior can be accepted and silently normalized by update. That rewrites the serialized historical sequence rather than failing closed. A structurally impossible date can also pass the validator if its key is internally self-consistent and it is not lexically earlier than the freeze start.

### Lifecycle

The internal validator checks unique keys, a `YYYY-MM-DD` regex, and parseable `recordedAt`, but does not verify that `reviewDate` is a real calendar date or that append order follows observation chronology. Runtime logic uses array tail semantics (`at(-1)`) to select the current review/recovery event, so an out-of-order prior can change authority behavior rather than merely presentation.

### Production Health

The internal validator checks duplicate `version|dueDate` identities and parseable `recordedAt`, but does not semantically validate `dueDate` or chronological append order. Runtime logic selects `episodeEvents.at(-1)` as the last review, so an out-of-order prior can alter recurrence state.

## Why material

Protocol invariant I-06 defines these histories as append-only evidence. A library boundary must not treat reordering as harmless normalization because persisted sequence is part of operational evidence and, for Lifecycle/Health, directly affects current authority and recurrence derivation. Invalid calendar dates are also malformed authority under I-08.

## F1 — Root Cause

The M04 remediation modeled append-only integrity primarily as identity uniqueness and anchor continuity. It did not encode the complete canonical-history invariant: semantic dates plus monotonic/canonical sequence. Downstream `.sort()` calls masked malformed prior order instead of proving prior integrity.

## F2 — Fault-Class Expansion

Primary: `FC-10 Append-Only Integrity`.
Secondary: `FC-01 Temporal Boundary`, `FC-16 Fault Masking / Silent Default`.

Expanded family:
- out-of-order Forward rows;
- out-of-order Phase 5 rows;
- out-of-order Lifecycle events;
- out-of-order Production Health events;
- impossible record/review/due dates;
- malformed recorded timestamps;
- non-session Forward/Phase 5 market dates;
- equal-timestamp batch ordering;
- cross-version/interleaved event chronology;
- retries that would otherwise sort or normalize corrupt prior state.

## F3 — Invariant Promotion

**Every append-only ledger must prove its persisted prior is already in the canonical sequence expected by that ledger before any update. Update code may sort newly constructed output only after prior canonicality is proven; it must never use sorting to repair persisted corruption. Every ledger temporal identity must be a semantically valid date/timestamp under that ledger's contract.**

For Forward/Phase 5, canonical persisted order is market-data date then strategy version, and market-data dates must be valid NYSE sessions. For Lifecycle/Production Health, observation append chronology is governed by monotonic `recordedAt`; scheduled review/due dates may legitimately be holidays/weekends but must be real ISO calendar dates.

## F4 — Coverage Expansion

Permanent regression must cover:
1. canonical valid priors remain accepted;
2. one adjacent record swap fails closed;
3. impossible market/review/due dates fail closed;
4. invalid `recordedAt` fails closed;
5. valid same-batch Forward/Phase5 rows remain accepted under deterministic tie ordering;
6. valid Lifecycle recovery events with the same review date but later `recordedAt` remain accepted.

Audit 9 must mutate persisted sequence order and dates between sessions and verify recovery does not silently rewrite history.

## F5 — Next-Audit Mutation

Audit 8 must include authority artifacts that are individually schema-valid and key-consistent but chronologically noncanonical. The external oracle must remain non-actionable and must not accept a silently normalized history.

## Remediation requirements

1. Add semantic date/timestamp validation to all four ledger boundaries.
2. Require Forward/Phase5 prior records to already match canonical market-date/version order.
3. Require Lifecycle/Health observation events to be monotonic by `recordedAt` while allowing legitimate repeated scheduled review dates/re-entry patterns.
4. Verify current authoritative ledgers already satisfy the stronger validators.
5. Preserve all authoritative files byte-for-byte during remediation validation.
6. Run Audit 7 probes, full core/ops, Pages build, authority validation, hash guard, and exact-head guard before persistence.
