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

Audit 7 discovery workflow run `33041266614` failed at the dedicated state-space discovery step after the new fail-closed authority probes were introduced. Existing production/lifecycle regressions did not previously cover this product-state family. The same run's existing full `test:core` suite remained green at 173/173, demonstrating that this defect family was outside the prior regression state space.

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

Status: **MATERIAL / STATICALLY CONFIRMED; DYNAMIC PROBE FAILING**
Fault classes: `FC-01 Temporal Boundary`, `FC-12 Lifecycle Recurrence`
Invariants: `I-02`, `I-08`, `I-12`
Discovery mechanism: discontinuity analysis across quarterly due-date × NYSE holiday × workflow run time.

### Evidence
`lib/production-health-review.ts::updateProductionHealthLedger()` determines due eligibility with a calendar-string test:

`if (asOf >= due)`

It does not use `effectiveReviewSession()` or `nyseReviewBoundaryReached()`.

The existing production-health test uses `2027-11-25` as an ON_TIME quarterly review date. That date is Thanksgiving, an NYSE holiday. Under the autonomous workflow, the health ledger can therefore record the scheduled quarterly review on the holiday using the latest Lifecycle health snapshot rather than waiting for the next legal NYSE-session review boundary.

Audit 7 added a direct state-space probe requiring a holiday due date to remain unrecorded until the next effective NYSE session has crossed the conservative review-close boundary. The second Audit 7 discovery run fails this probe before remediation.

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

---

## A7-M03 — Primary UI does not require cross-artifact generation and Production-identity coherence before action

Status: **MATERIAL CANDIDATE / STATICALLY CONFIRMED**
Fault classes: `FC-13 Cache / Generation Skew`, `FC-08 UI Action Safety`, secondary `FC-02 Authority Integrity`, `FC-15 Contract Divergence`
Invariants: `I-08`, `I-10`, `I-15`
Discovery mechanism: white-box product-state analysis across independently fetched JSON artifacts × Production transition × actionable signal window.

### Evidence
`app/page.tsx` fetches `signal.json`, `status.json`, `forward-ledger.json`, and `production-config.json` independently using `cache:"no-store"`. The primary safety condition is currently equivalent to:

`authorityUnsafe = !dailySignal || !runtimeStatus || !productionConfigIsValid(productionConfig) || !forwardLedger`

followed by stale/failed runtime checks.

This establishes individual presence/validity but does not require a coherent authority bundle. In particular, the primary action path does not explicitly prove all of the following before becoming actionable:
- `dailySignal.platformMode` corresponds to the current Production control state;
- `dailySignal.assetTicker` and `strategyVersion` correspond to the current active Production identity where one is active;
- `runtimeStatus.signalDate` / `marketDataDate` correspond to `dailySignal.dataDate`;
- the fetched artifacts belong to the same persisted operational generation/commit.

`cache:"no-store"` prevents an ordinary browser cache hit but does not itself make several separately fetched static JSON resources transactionally atomic. A deploy or refresh boundary can therefore expose individually valid artifacts from different operational generations unless semantic/generation coherence is checked at the action boundary.

### Why material
A Production transition is exactly the discontinuity where an old valid Signal and a new valid Production config have different authority semantics. If the UI accepts both independently and the old Signal still contains a target change with an upcoming legal execution window, the action calculation can be based on the wrong ticker/version despite every individual file being syntactically valid. The UI is the user-facing execution authority; mixed-generation state must therefore fail closed.

This finding does not assert that the current persisted site is presently mixed. It identifies an uncovered action-safety state that the current UI predicate permits by construction.

### F1 Root Cause
Operational artifacts are validated as independent resources. The action layer lacks a single pure authority-bundle contract tying Signal, runtime status, Production identity, dates, and generation provenance together.

### F2 Fault-Class Expansion — required scope
- Signal × Production config identity;
- Signal × runtime status dates/status;
- Production config × Lifecycle/Health state where surfaced as action authority;
- approval/deploy-only transitions;
- normal Daily deploy transitions;
- PWA/static-page refresh during deployment;
- browser refresh where old and new JSON requests complete in different orders.

### F3 Invariant Promotion
`I-15` is made explicit: **no BUY/SELL/REDUCE or other risk-changing action may be produced unless the complete user-facing operational authority bundle is semantically coherent and, where generation metadata exists, generation-consistent.**

### F4 Coverage Expansion
Audit 7 must add mixed-generation Production-switch cases. Audit 8 must use black-box fixtures that independently vary Signal, status, Production, Lifecycle, and cache generation. Audit 9 must inject deployment/generation skew during multi-session sequences.

### F5 Next-Audit Mutation
Audit 8 must not call the same internal coherence helper as its only oracle. It must define expected finite external actions from an independent fixture contract and verify that every cross-generation mismatch yields `WAIT`, `CHECK_DATA`, `REVIEW_REQUIRED`, or `NO_ACTION`, never a risk-changing action.

## Audit 7 continuation rule

Because material defects are confirmed, Audit 7 is permanently NOT CLEAN. The audit must nevertheless continue through the full state-space/discontinuity scope so that remediation does not terminate discovery early. Findings must be expanded to structural classes before code remediation is considered complete.
