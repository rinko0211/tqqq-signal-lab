# Audit 8 Finding 010 — Production Authority Chronology

Date: 2026-08-28
Audit: Audit 8 — Independent Contract & Adversarial Audit
Frozen charter: `research/audit-8-charter-2026-08-27.md`
Independent discovery head: `88335e651f5c96dc0087de797c09bd052efd2513`
Workflow run: `33115744530`
Job: `98669807586`

## Classification

**A8-M10 — MATERIAL / DYNAMICALLY CONFIRMED**

**Audit 8 remains permanently NOT CLEAN. CLEAN streak remains 0/2.**

A post-remediation independent Wave 2 adversarial fixture exercised Production authority chronology without importing Production validators, authority helpers, calendar helpers, freshness helpers, or ledger validators.

Six independent fixtures executed: **4 PASS / 2 FAIL**. The two failures shared one root-cause family:

1. `approvalDate=2026-08-28`, `effectiveDate=2026-08-28`, observation `2026-08-27T12:00:00Z` — expected `CHECK_DATA`, observed **INCREASE**.
2. `approvalDate=2026-08-28`, `effectiveDate=2026-08-25`, observation `2026-08-27T12:00:00Z` — expected `CHECK_DATA`, observed **INCREASE**.

The second fixture is invalid because the approval itself is in the future. It does **not** imply that `approvalDate > effectiveDate` is always invalid: same-system reaffirmation intentionally preserves the original Production episode `effectiveDate` while recording a later human re-approval date.

The same exact head simultaneously passed:

- full core regression: **229/229 PASS**
- full operational regression: **193/193 PASS**
- Pages build: **PASS**
- authoritative public-data mutation guard: **PASS**

This isolates the failure to Production authority chronology rather than a broad regression, environment problem, or test contamination.

---

## F1 — Root Cause

`assertProductionConfigIntegrity` validates Production authority date syntax and structural completeness, but the user-facing action boundary does not prove that `approvalDate` and `effectiveDate` are temporally possible relative to the observation clock.

Consequently a structurally complete, registered, human-approved Production identity can be accepted as current authority even when its approval and/or effective date lies in the future. Cross-artifact Signal/status/Forward chronology guards do not cover this separate Production authority clock.

The same boundary family also requires explicit protection against a future `Production.updatedAt`, because current authority metadata may not claim a write that has not yet occurred.

---

## F2 — Fault-Class Expansion

Primary fault classes:

- FC-02 authority integrity
- FC-04 Production transition / Human Approval boundary
- FC-13 cross-artifact authority coherence
- FC-16 malformed or contradictory state

Temporal expansions:

- future `approvalDate`
- future `effectiveDate`
- both future while mutually equal
- future approval with an earlier preserved episode `effectiveDate`
- future `Production.updatedAt`
- DECISION retaining an incumbent with impossible Production chronology
- same-system reaffirmation with later valid approval and earlier preserved effective date
- same-date valid authority around UTC/New-York date boundaries
- clock rollback and later recovery

---

## F3 — Invariant Promotion

**A user-facing risk-changing action may rely on approved Production authority only when that authority is temporally possible at the observation time. `approvalDate` and `effectiveDate` must not be later than the current New York market date, and Production metadata used as current authority may not claim an `updatedAt` later than the observation timestamp. Any such contradiction yields `CHECK_DATA`.**

Date-only Human Approval fields are interpreted as New York market dates because the operational contract is NYSE-session based. Equality with the current New York date is allowed; a strictly later market date is not.

A later valid `approvalDate` with an earlier preserved `effectiveDate` remains allowed for same-system reaffirmation, because `effectiveDate` denotes the start of the continuing Production episode rather than the timestamp of the latest approval event.

---

## F4 — Coverage Expansion

Permanent Audit 8 regression must independently cover:

1. future approval + future effective date => `CHECK_DATA`;
2. future approval + preserved past effective date => `CHECK_DATA`;
3. current approval + future effective date => `CHECK_DATA`;
4. future `Production.updatedAt` => `CHECK_DATA`;
5. valid current-date approval/effective chronology => normal observable action preserved;
6. valid same-system reaffirmation with later approval and earlier preserved effective date => normal observable action preserved;
7. DECISION with active incumbent obeys the same future-date chronology gate;
8. New-York date boundary cases do not use UTC-date shortcuts.

The independent oracle must remain fixture-local and must not import the implementation helper used for remediation.

---

## F5 — Next-Audit Mutation

Audit 9 temporal/chaos sequences must include:

- browser/system clock rollback after a valid Production approval;
- clock jump forward and restoration;
- cached Production authority dated ahead of Signal/status/Forward;
- DECISION review while an incumbent authority becomes temporally impossible;
- same-system reaffirmation followed by reload/clock skew;
- reload before/after the New York date boundary;
- recovery from invalid chronology without retaining a previously derived risk-changing action.

Audit 10 must verify this family is represented in the final invariant/fault/coverage closure matrix.

---

## Remediation gate

Remediation may begin only after this finding record exists.

Required remediation properties:

1. enforce Production authority chronology at the actual primary action boundary;
2. use the New York market date rather than raw UTC date for date-only authority fields;
3. fail closed on future active Production authority without breaking same-system reaffirmation semantics;
4. preserve valid RESEARCH and valid approved Production/DECISION behavior;
5. register the independent adversarial fixture permanently in core/operational regression;
6. run the independent fixture, full core, full ops, Pages build, authoritative-state no-mutation, and exact-head persistence guard;
7. perform no Production promotion, strategy retuning, or append-only history rewrite.
