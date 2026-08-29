# Audit 9 M01 Remediation Design Note — Explicit Coverage Evidence

Date: 2026-08-29
Audit: Audit 9 — Temporal, Recovery & Chaos Audit
Finding: A9-M01 — Phase 5 Started-Series History Completeness Is Not Proven Across Retry
Status: **REMEDIATION DESIGN CLARIFICATION — NOT A NEW MATERIAL FINDING**

## Why this clarification is required

The first deterministic A9-M01 remediation interpreted the promoted completeness invariant as requiring one `Phase5Record` for every expected NYSE session from a freeze `startDate` through the latest stored date.

The corrected Audit 9 Wave 2 sequence passed under that implementation, but the full historical regression suite exposed a pre-existing, intentional Phase 5 contract: a session can be genuinely unavailable for one leveraged ticker. In that case the system must not fabricate a price, return, signal or observation record. The missing session is instead counted as missing evidence and reduces Forward readiness.

Therefore an unconditional `records.length === expectedNYSESessionCount` contract is too strong. It would convert legitimate source-data absence into an integrity error and would contradict the established missing-ratio / no-retrospective-signal semantics.

This does not invalidate A9-M01. The original defect remains: after an already-started series has valid evidence, a stored prefix or interior observation can be deleted and repeated retries cannot distinguish that corruption from a legitimately absent market observation.

## Refined remediation invariant

**For every started Phase 5 strategy, every expected NYSE session from the immutable freeze `startDate` through the latest established coverage horizon must be represented by exactly one immutable coverage fact: either (a) a real Phase 5 observation record, or (b) explicit append-only gap evidence stating that the session lacked sufficient source data at the time it became part of the persisted coverage horizon.**

Consequences:

1. a valid observation record and a gap marker for the same version/session are mutually exclusive;
2. deleting a historical record without a corresponding pre-existing gap marker fails integrity validation;
3. deleting a historical gap marker also fails integrity validation;
4. legitimate missing source data is not replaced by a fabricated asset price, return, signal or synthetic observation record;
5. gap evidence is immutable historical evidence and must not later be erased merely because a provider subsequently supplies a historical bar;
6. coverage is complete when `record dates ∪ explicit gap dates` exactly covers the expected NYSE-session set through the strategy's coverage horizon;
7. existing authoritative Phase 5 ledgers that already contain complete per-session records remain valid without retroactive mutation;
8. legal empty/unstarted ledgers remain valid;
9. missing-ratio/evidence-readiness calculations continue to treat non-live evidence and explicit gaps as missing evidence rather than successful live observations.

## Why this is not a new finding

The full-core failures occurred only after applying the candidate remediation and revealed an over-broad remediation formulation. The underlying production defect is still A9-M01: absence of durable completeness evidence across retries. No previously safe production behavior was newly shown unsafe by this interaction.

Accordingly:
- Audit 9 remains permanently NOT CLEAN because A9-M01/M02/M03 already exist;
- no A9-M04 is created for this design clarification;
- the remediation must be revised before persistence;
- the final regression pack must include both corruption rejection and legitimate source-gap preservation.

## Required regression refinement

The corrected A9-M01 remediation must prove all of:

- prefix deletion without gap evidence fails closed;
- interior record deletion without gap evidence fails closed;
- explicit legitimate source gap is accepted and counted as missing evidence;
- gap evidence itself is append-only and duplicate-free;
- record+gap conflict for the same logical session fails closed;
- repeated retry cannot normalize or erase a gap or a missing record;
- one-system missing-data coverage does not contaminate healthy peers;
- corporate-action continuity can be tested with a logically complete prior rather than an impossible silently truncated prior;
- full historical core/ops regressions remain green.

This clarification changes no strategy parameter, Production authority, frozen research result, or authoritative append-only operational data.