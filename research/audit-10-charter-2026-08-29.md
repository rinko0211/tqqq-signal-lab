# Audit 10 Charter — Meta-Audit & Coverage Closure

Date: 2026-08-29
Status: **START AUTHORIZED — META-AUDIT / COVERAGE CLOSURE**
Repository: `rinko0211/tqqq-signal-lab`
Governing protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Prior audit close: `research/audit-9-close-2026-08-29.md`
Audit accounting at start: **C0 / 0-of-2 CLEAN**
Production authority at start: **RESEARCH / no selected identity / no Human Approval**

## 1. Purpose

Audit 10 audits the assurance system itself. It is not another product regression pass and must not count as independent if reduced to rerunning Audit 7, Audit 8 or Audit 9 tests.

Primary question:

> Are the State Model, invariants, fault classes, discontinuities, independent oracles, sequence generators, material-finding inheritance, permanent regressions and CLEAN accounting collectively complete and independent enough that known classes cannot be silently omitted, double-counted, or declared closed by correlated evidence?

## 2. Primary discovery mechanism

**Meta-audit / coverage closure over the assurance model and historical audit evidence.**

The mechanism must construct an explicit machine-checkable evidence graph containing at least:
- I-01 through I-18;
- FC-01 through FC-16;
- D01 through D22;
- Audit 7 material findings M01–M07;
- Audit 8 material findings M01–M10;
- Audit 9 material findings M01–M03;
- Audit 7/8/9 primary discovery mechanisms and their oracle-independence restrictions;
- permanent regression families and standard-suite registration;
- F1–F5 inheritance obligations;
- certification accounting and unattended-soak prerequisites.

The primary oracle is **coverage completeness and evidence independence**, not whether product functions return expected trading actions.

## 3. Meta-invariants

### MTA-01 — Inventory completeness
Every frozen invariant, fault class, discontinuity and material finding must appear exactly once in the assurance inventory with a non-empty evidence mapping.

### MTA-02 — Material-finding traceability
Every material finding must map to:
1. a persisted finding record;
2. F1 root cause;
3. F2 fault-class expansion;
4. F3 promoted invariant;
5. F4 permanent regression/coverage expansion;
6. F5 next-audit mutation;
7. remediation evidence;
8. permanent standard regression when applicable.

### MTA-03 — No correlated-evidence double counting
A coverage item may cite multiple tests, but evidence does not become independent merely because it appears in multiple files. Counted independence must come from materially distinct discovery mechanisms/oracles/generators.

### MTA-04 — Audit-mechanism independence
Audit 7, Audit 8, Audit 9 and Audit 10 must retain distinct Primary Discovery Mechanisms. A renamed replay of an earlier mechanism cannot contribute to a CLEAN streak.

### MTA-05 — Oracle independence closure
Audit 8 black-box expected actions and Audit 9 sequence expectations must not derive their expected results by importing the same product validators/helpers they are supposed to challenge.

### MTA-06 — Generator mutation closure
Every material finding's F5 mutation must be represented in the next applicable audit mechanism or explicitly documented as non-applicable with evidence.

### MTA-07 — Registration closure
Permanent regressions required by findings must be registered in standard core/ops suites where operationally relevant, not only executable through one-off audit workflows.

### MTA-08 — Symmetry closure
Equivalent assurance contracts across Forward, Phase5, Lifecycle, Production Health, Daily authority and Production authority must be compared for asymmetry. Duplicate/order/date validation alone must not be mistaken for completeness/chronology/episode guarantees.

### MTA-09 — Evidence before remediation
Material finding records must precede remediation evidence in the audit history. Harness errors must remain distinguishable from product/material findings.

### MTA-10 — Accounting integrity
Any audit that discovered a material defect remains permanently NOT CLEAN. CLEAN streak arithmetic must follow the frozen protocol and cannot be reset by remediation success.

### MTA-11 — Production authority containment
Meta-audit activity may not approve, select, promote or retune Production authority and may not mutate authoritative append-only evidence.

### MTA-12 — Certification prerequisite separation
CLEAN-audit accounting, permanent regression closure and the >=10 consecutive NYSE-session unattended soak are separate prerequisites. Passing one may not be represented as satisfying the others.

## 4. Mandatory inherited Audit 9 mutations

Audit 10 must explicitly inspect:

### A9-M01
Compare Forward and Phase5 history-completeness semantics. Verify Phase5 explicit `coverageGaps` closes legitimate source absence without fabricating observations, while deletion without evidence remains invalid. Search other append-only ledgers for the same omission-blindness class.

### A9-M02
Compare nested-record vs artifact-generation chronology guarantees across Forward, Phase5, Lifecycle and Production Health. Identify asymmetric `recordedAt <= updatedAt` or equivalent temporal guarantees.

### A9-M03
Search for historical evidence labels being reused indefinitely as scheduler/control flags. Distinguish immutable evidence classification from future recurrence control state.

## 5. Required historical closure inventory

Audit 10 must inventory and map:
- Audit 7 M01–M07;
- Audit 8 M01–M10;
- Audit 9 M01–M03;
- I-01–I-18;
- FC-01–FC-16;
- D01–D22;
- all Audit 8 F5 → Audit 9 sequence mutations;
- all Audit 9 F5 → Audit 10 meta-audit mutations.

A missing or contradictory mapping is a discovery result, not something to silently repair in the initial inventory.

## 6. Discovery waves

### Wave 1 — Evidence graph construction
Build a machine-checkable assurance inventory from frozen protocol IDs, persisted finding records, permanent tests and package registration. Do not auto-fill missing evidence.

### Wave 2 — Independence and symmetry analysis
Analyze import/dependency/oracle relationships and compare equivalent ledger/authority contracts for asymmetric guarantees.

### Wave 3 — Coverage mutation / omission challenge
Deliberately remove or mis-map one inventory edge at a time in isolated fixtures and prove the meta-audit detects missing findings, unregistered tests, missing F5 inheritance and false independent-evidence claims.

## 7. Material-finding discipline

If Audit 10 discovers a new material assurance blind spot or a new material product class through meta-analysis:
1. stop remediation of that defect/blind spot;
2. persist an Audit 10 finding record first;
3. classify whether the failure is product-level, assurance-framework-level, or both;
4. apply F1–F5;
5. permanently classify Audit 10 NOT CLEAN;
6. if the finding exposes a new assurance-framework class, create a new versioned assurance protocol rather than editing v1.0 in place;
7. remediate only after the record exists;
8. add permanent meta-regression/mutation coverage.

A framework-level material finding triggers assurance-framework redesign; it must not be treated as a mechanical reason to proceed directly to Audit 11.

## 8. CLEAN criteria

Audit 10 is CLEAN only if all are true:
- zero new material defects/blind spots are discovered;
- the explicit evidence graph covers every required invariant/fault/discontinuity/finding;
- F1–F5 inheritance is complete;
- independence analysis finds no correlated-evidence false counting;
- symmetry analysis finds no material unguarded asymmetry;
- mutation tests prove missing coverage edges are detected;
- required permanent tests are registered in standard suites;
- full core/ops regressions and Pages remain green as secondary closure gates;
- authoritative operational state is unchanged;
- no strategy retuning or Production promotion occurs.

If Audit 10 is CLEAN, certification accounting moves from **0/2 to 1/2 CLEAN** because Audit 9 was NOT CLEAN. Another independent CLEAN audit is then required for 2/2 under protocol v1.0.

## 9. Restrictions

Audit 10 must not:
- redefine missing evidence as PASS;
- edit the frozen v1.0 assurance protocol in place;
- use code-regression success alone as proof of meta-audit completeness;
- retune strategy parameters;
- promote Production;
- rewrite authoritative Forward, Phase5, Lifecycle or Health history;
- treat the unattended-soak requirement as satisfied by synthetic/meta testing.
