# Audit 7 Finding 006 — Stale Forward Generation Is Accepted by the UI Authority Bundle

Date: 2026-08-27
Audit: Audit 7 — State-Space & Discontinuity Audit
Baseline protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Classification: **MATERIAL / DYNAMICALLY CONFIRMED**
Audit accounting: Audit 7 remains permanently NOT CLEAN; clean streak 0/2.

## Discovery mechanism

F2 expansion of A7-M03 across the complete user-facing authority bundle. The original M03 remediation proved generation equality for Daily Signal and runtime status plus semantic Production identity, but Forward remained modeled only as `{schemaVersion, appendOnly}`.

Audit 7 added a black-box-style helper probe with current Signal/status and an otherwise valid Forward ledger whose `updatedAt` belongs to an older generation. The dedicated Audit 7 discovery step fails this probe in workflow run `33061206282`.

## Observed defect

`lib/operational-authority.ts::OperationalForwardAuthority` contains only `schemaVersion` and `appendOnly`. `operationalAuthorityBundleIsCoherent()` therefore verifies that Forward authority exists structurally but does not prove it was generated with the current Signal/status bundle.

The Daily generator already provides a usable generation invariant:
- `signal.generatedAt = generatedAt`
- `status.generatedAt = generatedAt`
- `updateForwardLedger(..., generatedAt)` sets `forward.updatedAt = generatedAt`

Thus a current Signal/status paired with stale Forward is an invalid operational bundle, but the current helper can return `ok === true`.

## Why material

Forward is part of the primary UI authority gate. Individually valid static artifacts may cross during a deployment or partial retrieval. Accepting an old Forward ledger alongside a newer Signal/status creates a cross-generation authority state at the user-facing execution boundary. A risk-changing action must never be authorized from a bundle whose claimed operational evidence does not belong to the same Daily generation.

## F1 — Root Cause

The M03 authority contract was strengthened around Signal/status/Production semantics but Forward was left as a presence/schema predicate. Generation provenance existed in the artifact (`updatedAt`) but was not promoted into the authority type or invariant.

## F2 — Fault-Class Expansion

Primary: `FC-13 Cache / Generation Skew`.
Secondary: `FC-08 UI Action Safety`, `FC-15 Contract Divergence`, `FC-16 Fault Masking / Silent Default`.

Expanded search family:
- current Signal + stale Forward;
- stale Signal + current Forward;
- same date but different generation timestamp;
- Forward `updatedAt` missing/malformed;
- Forward current generation but status dates diverge;
- deploy transition where one static JSON request resolves from an older Pages generation;
- future operational artifacts added to the primary action bundle must expose comparable provenance or fail closed.

## F3 — Invariant Promotion

**Every artifact included in the primary risk-changing authority bundle must prove generation coherence where that artifact already carries generation metadata. For the current Daily bundle, Signal `generatedAt`, runtime status `generatedAt`, and Forward `updatedAt` must be valid timestamps and exactly equal. Missing or divergent provenance fails closed.**

## F4 — Coverage Expansion

Permanent Audit 7 regression must cover:
1. coherent three-way generation accepted;
2. stale Forward rejected;
3. missing Forward generation rejected;
4. malformed Forward generation rejected;
5. Signal/status date divergence remains rejected independently of generation equality.

Audit 9 must inject static-file retrieval skew during deployment and browser refresh sequences.

## F5 — Next-Audit Mutation

Audit 8 must vary each user-facing artifact generation independently and use an external finite-action oracle. Any generation mismatch must yield a non-risk-changing result (`WAIT`, `CHECK_DATA`, `NO_ACTION`, or equivalent), never BUY/SELL/REDUCE.

## Remediation requirements

1. Promote `updatedAt` into `OperationalForwardAuthority`.
2. Require valid and exact equality with Signal/status generation.
3. Keep current Signal/status semantic and Production identity checks unchanged.
4. Add malformed/missing Forward generation regressions.
5. Run dedicated Audit 7 probes, full core/ops, Pages build, and protected-authority validation before persistence.
