# Audit 8 Close — Independent Contract & Adversarial Audit

Date: 2026-08-29
Status: **CLOSED — PERMANENTLY NOT CLEAN**
Clean streak after closure: **0/2**
Certification state after closure: **C0 — REMEDIATION BASELINE / 0-of-2 CLEAN**
Primary discovery mechanism: **Independent black-box adversarial fixtures + observable-action oracle + differential entrypoint testing**
Frozen assurance protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Frozen Audit 8 charter: `research/audit-8-charter-2026-08-27.md`
Charter blob: `a58a9373516028d5e2add08dbb2e134a0ec4ca17`
Final validated control/test head before this close record: `81d89247786856a6b31c756005e0372ac0f5e6ff`
Final closure validation workflow: `Audit 8 PWA Cache Differential` run `33228181189`, job `99035882635`

## 1. Audit accounting decision

Audit 8 discovered new material defects under its independent primary discovery mechanism. Under the frozen Multi-Audit Assurance Protocol, an audit that discovers even one new material defect is permanently **NOT CLEAN**, regardless of subsequent remediation success.

Therefore:
- Audit 8 result: **NOT CLEAN**
- consecutive independent CLEAN count: **0/2**
- certification state remains **C0**
- successful remediation and permanent regression do **not** retroactively convert Audit 8 into CLEAN
- Audit 9, if independently CLEAN, can raise the streak only to **1/2**
- Audit 10, if Audit 9 is CLEAN and Audit 10 is independently CLEAN, can then raise the streak to **2/2**, subject to the separate chaos/fault-injection and unattended-soak gates

This accounting is separate from current Production safety. The persisted Production authority remains RESEARCH, unapproved, with no selected Production identity.

## 2. Independence statement

Audit 8 remained materially independent from Audit 7.

Audit 7 primary discovery mechanism:
- model-based white-box state-space and discontinuity analysis;
- internal invariant and transition proofs.

Audit 8 primary discovery mechanism:
- black-box adversarial fixtures;
- fixture-local observable-action expectations;
- differential testing across action entrypoints, authority mutations, browser/UI paths and cache/PWA states.

The Audit 8 expected-value oracle did not use Production validators, market-calendar helpers, ledger-integrity validators, Lifecycle selection helpers, or the product authority helper to calculate expected actions. Product code under test was allowed to use those internals; the oracle was not.

The actual user-facing action path was exercised through the same `derivePrimaryAction(...)` product entrypoint used by the UI rather than through a shadow implementation.

## 3. Material findings discovered during Audit 8

Audit 8 discovered ten material defect families. All were recorded before remediation and all are remediated with permanent regression at close. Their discovery still makes Audit 8 permanently NOT CLEAN.

### A8-M01 — Unvalidated numeric action inputs can emit risk-changing advice

Malformed or out-of-range holdings/target values could reach exposure comparison and emit `INCREASE`/`REDUCE` rather than fail closed.

Primary classes: FC-08 UI Action Safety, FC-09 Data Completeness, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave1-2026-08-27.md`, `tests/audit8-independent-blackbox.test.ts`.

### A8-M02 — Research freshness can mask stale operational authority

A fresher research/display dataset date could upgrade stale Daily operational authority and permit a risk-changing action.

Primary classes: FC-02 Authority Integrity, FC-13 Cache / Generation Skew, FC-06 Cross-System Isolation, FC-08 UI Action Safety.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave1-2026-08-27.md`, `tests/audit8-independent-blackbox.test.ts`.

### A8-M03 — Malformed Forward history not enforced at the primary action boundary

Top-level-valid Forward metadata could conceal duplicate/corrupt nested history and still participate in action authority.

Primary classes: FC-10 Append-Only Integrity, FC-08 UI Action Safety, FC-15 Contract Divergence, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave1-2026-08-27.md`, `tests/audit8-independent-blackbox.test.ts`.

### A8-M04 — Coherent future-dated operational generation can authorize risk

Signal/status/Forward could agree on a generation timestamp that was still in the future relative to observation time and be accepted as authority.

Primary classes: FC-01 Temporal Boundary, FC-02 Authority Integrity, FC-13 Cache / Generation Skew, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M05 — Explicit execution date not bound to the first legal execution open

A mutated later execution date could remain actionable even though it did not equal the earliest legal NYSE open justified by signal causality and availability.

Primary classes: FC-01 Temporal Boundary, FC-08 UI Action Safety, FC-15 Contract Divergence, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M06 — Untagged/partially tagged holdings can survive Production version change

Browser-local holdings without exact active ticker+strategy-version identity could be reused across a Production strategy/version change.

Primary classes: FC-05 Recovery / Re-entry, FC-08 UI Action Safety, FC-13 Cache / Generation Skew, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M07 — Prefix-truncated Forward history can still act as trading authority

A surviving Forward suffix could remain structurally valid after loss of its immutable historical prefix.

Primary classes: FC-10 Append-Only Integrity, FC-03 Persistence / Atomicity, FC-13 Cache / Generation Skew, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M08 — Forward record chronology may contradict ledger generation

A record observation timestamp later than the containing Forward artifact generation could pass structural validation and still authorize action.

Primary classes: FC-01 Temporal Boundary, FC-10 Append-Only Integrity, FC-13 Cache / Generation Skew.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M09 — Missing nested Daily signal silently presented as HOLD

A wrapper with top-level authority fields but no complete nested operational signal could be translated into ordinary `HOLD` semantics instead of `CHECK_DATA`.

Primary classes: FC-09 Data Completeness, FC-16 Fault Masking / Silent Default, FC-08 UI Action Safety.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-findings-wave2-2026-08-27.md`, `tests/audit8-wave2-blackbox.test.ts`.

### A8-M10 — Production authority chronology can be impossible relative to observation time

Future `approvalDate`, `effectiveDate`, or Production authority metadata could remain structurally valid and authorize risk.

Primary classes: FC-02 Authority Integrity, FC-04 State Transition / Human Approval boundary, FC-13 Cache / Generation Skew, FC-16 Fault Masking / Silent Default.
Status at close: **REMEDIATED + PERMANENT REGRESSION**.
Evidence: `research/audit-8-finding-010-production-authority-chronology-2026-08-28.md`, `tests/audit8-m10-production-authority-chronology.test.ts`.

No material finding beyond A8-M10 was discovered in the final independent closure sweep.

## 4. Final independent closure scope

After M01–M10 remediation, Audit 8 continued independent discovery rather than stopping at replay of known defects.

The final closure scope additionally covered:
- pure `derivePrimaryAction(...)` vs actual UI mapped action equivalence;
- RESEARCH vs DECISION-without-incumbent observable equivalence where authority semantics are equivalent;
- PRODUCTION vs DECISION-with-incumbent behavior where the approved incumbent remains active;
- fresh authority vs one-generation mutation;
- future valid execution window vs the same fixture after the legal open has expired;
- holdings absent / at target / below target / above target / mismatched identity;
- full Forward malformed-history families and chronology/completeness boundaries;
- stale multi-quarter Production Health cursor behavior;
- Production A→B→A evidence retention and fresh episode cursor behavior;
- one Phase5 system failure with peer isolation and subset-only recovery;
- cached PWA shell with new operational JSON;
- operational `/data/` network-only/no-store behavior;
- operational fetch failure without stale CacheStorage fallback;
- identical observable action for fresh shell and cached shell when the same authoritative JSON generation is supplied.

The final additional ledger/evidence black-box suite and PWA/cache differential suite discovered **no new material defect**.

## 5. Permanent Audit 8 regression surface

The following Audit 8 independent regression families are permanently present in the standard test surface:
- `tests/audit8-independent-blackbox.test.ts`
- `tests/audit8-wave2-blackbox.test.ts`
- `tests/audit8-m10-production-authority-chronology.test.ts`
- `tests/audit8-ui-differential.test.ts`
- `tests/audit8-ledger-evidence-blackbox.test.ts`
- `tests/audit8-pwa-cache-differential.test.ts`

They are registered in the repository's standard core/operational regression commands where applicable.

Dedicated retained verification workflows include:
- `.github/workflows/audit8-ui-differential.yml`
- `.github/workflows/audit8-ledger-evidence-blackbox.yml`
- `.github/workflows/audit8-pwa-cache-differential.yml`

These remain verification mechanisms only. They do not constitute Production approval or strategy selection authority.

## 6. Final validation evidence

Final validated control/test head before this close record:
`81d89247786856a6b31c756005e0372ac0f5e6ff`

Final closure validation:
- workflow: `Audit 8 PWA Cache Differential`
- run: `33228181189`
- job: `99035882635`
- result: **SUCCESS**

All final gate steps passed:
1. frozen Audit 8 charter verification;
2. independent PWA/cache differential discovery;
3. re-run of prior Audit 8 independent families;
4. full core regression;
5. full operational regression;
6. user-facing Pages build;
7. authoritative-state no-mutation guard.

Separate final ledger/evidence main validation also passed:
- workflow: `Audit 8 Ledger Evidence Black-Box`
- run: `33227923097`
- result: **SUCCESS**
- independent ledger/evidence discovery: PASS
- prior Audit 8 family replay: PASS
- full core: PASS
- full ops: PASS
- Pages build: PASS
- authoritative-state no-mutation: PASS

The UI differential path was also revalidated on main before closure and remained green.

## 7. Harness failures excluded from material finding count

Two late ledger/evidence discovery failures were explicitly classified as fixture-construction errors, not product defects:

1. the first Phase5 recovery fixture used a market-data artifact without UPRO/SSO/QLD series;
2. the next fixture aliased raw SPY/QQQ prices directly to leveraged tickers, causing the existing corporate-action continuity guard to correctly reject the artificial price-scale discontinuity.

After the fixture was anchored to each system's stored prior close, the independent Phase5 isolation/recovery probe passed. These events therefore do not create A8-M11 or alter material-defect accounting.

## 8. No-retuning / Production-state verification

Audit 8 did not retune frozen strategy parameters, rewrite historical research, or grant Production authority.

Authoritative Production state at close remains:
- `mode`: `RESEARCH`
- `selectedTicker`: `null`
- `selectedStrategy`: `null`
- `strategyVersion`: `null`
- `approvedByHuman`: `false`
- `approvalDate`: `null`
- `effectiveDate`: `null`

No Audit 8 workflow, remediation, regression, or close action constitutes Human Production Approval.

Forward, Phase5, Lifecycle and Production Health evidence remain governed by append-only semantics. The closure process does not retrofill or rewrite them.

## 9. F5 mutations carried into Audit 9

Audit 9 must not reduce M01–M10 to snapshot replay. Under the frozen F5 requirement, it must convert them into temporal/recovery/chaos sequence families across hundreds of sessions to multi-year simulations.

Required mutation families include at minimum:
- malformed local holdings and target corruption before/after reload and recovery;
- stale Daily + fresh research and fresh Daily + stale research under reordered fetch/cache timing;
- partial/truncated/duplicate Forward persistence before UI fetch and during recovery;
- future artifact generations and browser/system clock rollback/forward restoration;
- execution-date mutation around close/open, holidays, provider delay, missed-open and later target changes;
- localStorage holdings across Production A→B→A, DECISION-with-incumbent, stale tabs and restored device state;
- Forward prefix/middle/per-version truncation and impossible per-record chronology;
- partial Daily wrapper/payload publication and false-HOLD prevention;
- future Production approval/effective/update chronology around New York date boundaries and same-system reaffirmation;
- stale multi-quarter Production Health recovery without retrospective fabrication;
- Production A→B→A Health evidence and episode cursor isolation;
- one-system Phase5 failure, subset retry and peer-history immutability;
- PWA cached shell / new JSON / failed data fetch / recovery sequences;
- persistence or deployment interruption at each relevant sequence boundary, proving no unsafe previously derived action survives recovery.

Audit 9's oracle must operate on sequence invariants across time rather than merely invoking Audit 8 snapshot expectations.

## 10. Next certification state

Audit 8 is formally closed but **PERMANENTLY NOT CLEAN**.

Certification remains:

**C0 — REMEDIATION BASELINE / 0-of-2 CLEAN**

The next authorized independent audit is:

**Audit 9 — Temporal, Recovery & Chaos Audit**

Primary discovery mechanism must remain materially distinct from Audit 8: temporal/recovery/chaos sequence simulation across hundreds of NYSE sessions to multi-year state histories with injected faults before/after fetch, generation, persistence, deployment, approval, execution and recovery boundaries.

If Audit 9 discovers zero new material defects and passes its complete independent validation, the CLEAN streak becomes **1/2**. Because Audit 8 is permanently NOT CLEAN, Audit 9 alone cannot satisfy the two-consecutive-CLEAN code-control gate.

Even a later 2/2 CLEAN result is not final unattended-operations certification. Final certification still separately requires the permanent fault-injection gate, temporal/chaos verification and at least 10 consecutive NYSE sessions of unattended operational soak on a materially unchanged control plane.
