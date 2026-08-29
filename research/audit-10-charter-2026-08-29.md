# Audit 10 Charter — Meta-Audit / Coverage Closure

Date: 2026-08-29
Repository: `rinko0211/tqqq-signal-lab`
Governing protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Audit 9 close: `research/audit-9-close-2026-08-29.md`
Starting accounting: **C0 / 0-of-2 CLEAN**
Production authority at start: **RESEARCH / no selected identity / approvedByHuman=false**

## 1. Purpose

Audit 10 audits the assurance framework itself. It does not count as independent merely by rerunning Audit 7, 8, or 9 tests. Its primary discovery mechanism is a coverage graph plus mutation testing of the audit framework and evidence registration.

The audit asks whether the accumulated assurance evidence is complete, independent enough, permanently registered, symmetric across equivalent surfaces, and capable of detecting deliberate damage to its own controls.

No strategy retuning, Production promotion, historical evidence rewrite, or performance optimization is permitted.

## 2. Primary discovery mechanism

Build a machine-checkable graph whose required nodes include:

- invariants I01–I18;
- fault classes FC01–FC16;
- discontinuities D01–D22;
- Audit 7 material findings A7-M01–M07;
- Audit 8 material findings A8-M01–M10;
- Audit 9 material findings A9-M01–M03;
- permanent regression test files;
- standard `test:core` and `test:ops` registration;
- close records and F1–F5 inheritance evidence.

Audit 10 must independently check graph closure rather than trusting a close record's statement that coverage exists.

## 3. Mandatory meta-invariants

MTA-01 — Every protocol invariant I01–I18 has permanent executable evidence.

MTA-02 — Every fault class FC01–FC16 has at least one executable negative/fail-closed or equivalent integrity proof; recovery-related classes additionally require recovery evidence.

MTA-03 — Every discontinuity D01–D22 is represented by permanent executable evidence, and high-risk pairwise/three-way rows cannot be represented only by a single correlated source assertion.

MTA-04 — Every material finding from Audit 7–9 remains represented in a close/finding record and has a permanent regression path.

MTA-05 — Every permanent Audit 8/9 regression required by the close records is registered in both `test:core` and `test:ops` unless the charter explicitly documents why one suite is inapplicable.

MTA-06 — Meta-audit must fail when a required permanent regression is synthetically removed from a suite registration.

MTA-07 — Meta-audit must fail when a finding loses required F1–F5 inheritance evidence.

MTA-08 — Meta-audit must fail when a required coverage family is represented only on one symmetric operational surface (for example Forward but not Phase 5 completeness/chronology).

MTA-09 — Forward and Phase 5 completeness/chronology controls are symmetric in intent while preserving legitimate source-gap semantics.

MTA-10 — Lifecycle and Production Health chronology/recurrence controls are symmetric in intent where their contracts overlap.

MTA-11 — observable action authority has independent evidence across pure product entrypoint, UI mapping, cache/network behavior, and temporal sequence behavior.

MTA-12 — deployment/persistence ordering has both source-level workflow evidence and executable fault/recovery evidence.

MTA-13 — audit workflows/tests do not mutate Production authority or frozen strategy parameters as a side effect of validation.

MTA-14 — Audit 8 oracle-independence prohibitions remain enforced; Audit 9 temporal tests remain sequence-based rather than snapshot-only.

MTA-15 — Audit 9 Wave 1/2/3 remain permanently registered and executable after routine operational-data advancement.

MTA-16 — the assurance framework can detect its own deliberately corrupted synthetic manifests/registrations; a meta-audit that only passes the current repository is insufficient.

## 4. Required symmetry review inherited from Audit 9

Audit 10 must explicitly review:

1. Forward vs Phase 5 completeness, including explicit omission/gap evidence rather than duplicate/order checks alone.
2. Forward vs Phase 5 nested-record/artifact chronology.
3. Lifecycle vs Production Health chronology and recurrence.
4. historical evidence classifications reused as future-control flags.
5. pure primary-action vs UI vs PWA/cache vs temporal sequence authority.
6. persistence success/failure vs deploy/reload behavior.
7. all Audit 8 F5 mutations and Audit 9 permanent sequence packs.

## 5. Mutation requirements

At minimum the meta-audit harness must prove that it rejects synthetic variants with:

- one required test removed from `test:core`;
- one required test removed from `test:ops`;
- one material finding omitted from the finding registry;
- one finding with F1–F5 incomplete;
- one D-row without executable evidence;
- one fault class represented only by a correlated duplicate evidence source;
- Forward completeness evidence present while Phase 5 completeness evidence absent;
- chronology evidence present on one append-only surface but absent on a symmetric surface;
- Audit 9 Wave 3 unregistered;
- Production authority changed away from RESEARCH during validation.

The harness itself must have positive and negative self-tests.

## 6. Audit 10 classification

Any material assurance-framework blind spot discovered by this independent meta-audit makes Audit 10 permanently NOT CLEAN, even if remediated.

If no material defect is found and all mandatory coverage/mutation gates pass, Audit 10 may be classified CLEAN.

Because Audit 9 was NOT CLEAN, an Audit 10 CLEAN result would advance the consecutive independent CLEAN streak only to **1/2**. It cannot by itself satisfy the 2/2 requirement.

## 7. Close requirements

Audit 10 cannot close until:

- all MTA-01–MTA-16 are dispositioned;
- the coverage graph is machine-checkable and versioned;
- synthetic mutation self-tests prove the graph checker can fail;
- all inherited Audit 8/9 permanent regressions pass;
- full core and full ops pass;
- Pages build passes;
- authoritative operational data is not mutated by the audit;
- Production remains unpromoted absent explicit Human Approval;
- any discovered material findings are recorded before remediation with F1–F5.

## 8. Certification boundary

Even a CLEAN Audit 10 does not itself certify Production readiness. The separate >=10 consecutive NYSE-session unattended soak requirement remains outstanding, and the CLEAN-streak accounting remains governed by the immutable assurance protocol.