# Audit 7 — Live Findings Register

Date: 2026-08-27
Audit: **State-Space & Discontinuity Audit**
Primary discovery mechanism: model-based white-box state-space/discontinuity analysis
Frozen assurance baseline: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Baseline commit: `7cb1495592bfe6d2678c6d5850548131525b0cf8`
Pre-audit authoritative operational head: `aa6059d7dba077356b9aab2efae0f7d5207e3b0a`
Audit accounting status: **PERMANENTLY NOT CLEAN — new material defects discovered**
Clean streak: **0/2**

This register records findings before remediation. Audit 7 remains NOT CLEAN even if all findings are later fixed and all closure gates pass.

## A7-M01 — Production authority validator accepts partial and malformed authority

Status: **MATERIAL / CONFIRMED**
Fault classes: `FC-02 Authority Integrity`, `FC-16 Fault Masking / Silent Default`, secondary `FC-04 State Transition`
Invariants: `I-03`, `I-04`, `I-08`, `I-15`
Discovery mechanism: white-box product-state enumeration across control mode × authority completeness × timestamp validity.

### Evidence
`lib/production.ts::assertProductionConfigIntegrity()` computes:

`selected = Boolean(selectedTicker && selectedStrategy && strategyVersion)`

It therefore rejects a complete unapproved identity but does not reject every **partial** identity. Examples such as `selectedTicker="TQQQ"` with null strategy/version can pass in RESEARCH or DECISION because `selected === false`.

The validator also requires approval/effective dates only by truthiness. Structurally invalid strings such as `approvalDate="not-a-date"` or an impossible `effectiveDate` can therefore pass approved authority validation.

`transitionMode()` itself does not first assert the integrity of its current input, so a malformed partial authority can be carried into DECISION at the library boundary even though the operational approval script currently validates its persisted input before calling it.

Audit 7 discovery workflow run `33041266614` failed at the dedicated state-space discovery step after the new fail-closed authority probes were introduced. Existing production/lifecycle regressions did not previously cover this product-state family.

### Why material
Operational generators rely on `assertProductionConfigIntegrity()` as the fail-closed authority boundary. An approved config with complete registered identity but malformed temporal authority can remain `hasActiveProduction(...) === true` and therefore reach the Production data/signal path. Partial corrupt authority also violates the explicit rule that malformed or contradictory authority must fail closed rather than degrade into an apparently valid baseline/control state.

The currently persisted authoritative Production config is still a coherent RESEARCH/null-identity state; this finding does not mean Production was automatically changed.

### F1 Root Cause
The validator uses aggregate all-three presence as the only selected-identity structural test and does not validate date syntax/semantics. Library transitions assume validated callers instead of enforcing the invariant at the transition boundary.

### F2 Fault-Class Expansion — required scope
- every reader of `production-config.json`;
- Daily generation;
- Lifecycle generation;
- Production Health generation;
- Human Approval script/workflow;
- UI authority/action derivation;
- any library caller of `transitionMode`, `hasActiveProduction`, `resolveProductionSystem`;
- tests that currently assert only complete valid/invalid Production identities.

### F3 Invariant Promotion
Extend `I-08` operationally: **all selected identity fields are all-null or all-present and registered; all authority dates are structurally valid before any mode, action, health, lifecycle or transition logic consumes them.**

### F4 Coverage Expansion
Add state coordinates for partial identity permutations and invalid authority dates to Audit 7 state-space probes, Audit 8 black-box authority fixtures, and Audit 9 corruption/recovery sequences.

### F5 Next-Audit Mutation
Audit 8 must generate malformed authority objects combinatorially rather than replaying only these examples and must assert the external finite action contract never becomes actionable.

---

## A7-M02 — Production Health review can be recorded on an NYSE holiday before a legal review boundary

Status: **MATERIAL CANDIDATE / STATICALLY CONFIRMED; DYNAMIC PROBE ADDED**
Fault classes: `FC-01 Temporal Boundary`, `FC-12 Lifecycle Recurrence`
Invariants: `I-02`, `I-08`, `I-12`
Discovery mechanism: discontinuity analysis across quarterly due-date × NYSE holiday × workflow run time.

### Evidence
`lib/production-health-review.ts::updateProductionHealthLedger()` determines due eligibility with a calendar-string test:

`if (asOf >= due)`

It does not use `effectiveReviewSession()` or `nyseReviewBoundaryReached()`.

The existing production-health test uses `2027-11-25` as an ON_TIME quarterly review date. That date is Thanksgiving, an NYSE holiday. Under the autonomous workflow, the health ledger can therefore record the scheduled quarterly review on the holiday using the latest Lifecycle health snapshot rather than waiting for the next legal NYSE-session review boundary.

Audit 7 has added a direct state-space probe requiring a holiday due date to remain unrecorded until the next effective NYSE session has crossed the conservative review-close boundary.

### Why material
The assurance model explicitly treats review dates and market boundaries as exchange-session semantics, not plain calendar-day semantics. Recording a scheduled operational health review before a legal session boundary can advance review chronology and user-facing review state on stale/pre-boundary evidence. This is the same structural family that produced prior lifecycle holiday-boundary defects, but on a different subsystem/edge.

### F1 Root Cause
Production Health recurrence has its own calendar-day due logic instead of sharing the exchange-session review primitive already used by Lifecycle.

### F2 Fault-Class Expansion — required scope
- quarterly Production Health due dates;
- weekend and all NYSE holiday due dates;
- early-close sessions under the conservative 16:00 ET review gate;
- multiple missed quarterly reviews and recovery;
- same-version re-entry episodes whose first due date lands on a non-session;
- UI display of last/next review dates.

### F3 Invariant Promotion
All scheduled operational reviews that can change review chronology or user action must become eligible only at their defined legal exchange-session boundary.

### F4 Coverage Expansion
Add Production Health due-date discontinuities to Audit 7 matrix and propagate into Audit 9 long-sequence generation.

### F5 Next-Audit Mutation
Audit 8 must compare user-visible health/review action before and after holiday/weekend boundaries without sharing the white-box date oracle implementation.

## Audit 7 continuation rule

Because A7-M01 is confirmed material, Audit 7 is permanently NOT CLEAN. The audit must nevertheless continue through the full state-space/discontinuity scope so that remediation does not terminate discovery early. Findings must be expanded to structural classes before code remediation is considered complete.
