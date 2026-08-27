# Multi-Audit Assurance Protocol v1.0

Date: 2026-08-27
Repository: `rinko0211/tqqq-signal-lab`
Status: **IMMUTABLE BASELINE FOR AUDIT 7–10**
Pre-baseline authoritative head: `aa6059d7dba077356b9aab2efae0f7d5207e3b0a`
Governing source: `投資最適化ツール_監査進捗とAudit7-10戦略_2026-08-27`
Audit accounting at freeze: **0/2 consecutive independent CLEAN audits**
Production authority at freeze: **no automatic promotion permitted; Human Approval remains mandatory**

## 1. Purpose and scope

This protocol freezes the assurance method that governs Audit 7 and all subsequent certification work. It exists because Audit 5 and Audit 6 each discovered new material defects after earlier broad remediation. Repeating the same checklist is therefore not sufficient. The assurance system must separately attack state space, discontinuities, observable contracts, long temporal sequences, recovery behavior, and the audit framework itself.

This file is intentionally versioned and is not to be edited in place after Audit 7 begins. If the assurance framework itself must change because a later finding exposes a blind spot, create a new versioned protocol and record why the old baseline was insufficient. The historical baseline remains immutable.

This protocol changes no strategy weights, stop parameters, frozen research result, Production selection, Forward history, Lifecycle history, or Production Health history.

## 2. Non-negotiable operational invariants

The following system-level invariants govern all audits and all remediation.

### I-01 — Signal causality
A signal is determined from completed US-market close information at `t`. Any modeled execution must occur no earlier than the first legal NYSE core open after that decision. No same-close execution, future data use, retroactive fill, or hindsight reconstruction is permitted.

### I-02 — Completed-session data only
Operational Daily and Phase 5 calculations may consume only valid, completed NYSE sessions. Impossible dates, non-session dates, future bars, and not-yet-completed sessions are fail-closed inputs.

### I-03 — Human Production authority
No automated audit, scheduled workflow, research result, lifecycle process, UI action, or health process may promote, select, or replace a Production system without the exact Human Approval path and all required eligibility/freshness gates.

### I-04 — Research / Decision / Production segregation
`RESEARCH`, `DECISION`, and `PRODUCTION` are distinct control states. Entry into Production requires an immediately preceding valid Decision state. Decision review must not silently destroy or replace an existing active Production authority.

### I-05 — Frozen Production identity
A Production authority is defined by the complete registered ticker + signal logic + risk-control + version identity. Health review may evaluate it but must never auto-replace it.

### I-06 — Append-only evidence
Forward, Phase 5, Lifecycle, Production Health, and other designated operational histories are append-only. Past observations, decisions, executions, review events, and episodes must not be rewritten to improve apparent results.

### I-07 — No late execution chase
If a legal execution open has passed without a valid actionable instruction, the system must not retroactively tell the user to execute at that expired open. A later action is legal only if a new current signal/target change creates a new future execution window.

### I-08 — Fail closed on authority or data uncertainty
Missing, malformed, contradictory, stale, cross-generation, or unverifiable authority/data must result in non-actionable behavior such as `WAIT`, `CHECK_DATA`, `REVIEW_REQUIRED`, or `NO_ACTION`, never an inferred trade.

### I-09 — Atomic operational persistence
A Production approval or other atomic authority transition must not persist a partially validated state. Required configuration and generated operational state must be coherently validated before a single persistence boundary is crossed.

### I-10 — Deployment coherence
Pages or other user-facing deployment must not publish a state that is stale relative to failed persistence, failed authority validation, failed integrity validation, or an unvalidated workspace generation.

### I-11 — Cross-system isolation
Failure of one frozen candidate, one ticker, one research family, or one non-authoritative subsystem must not corrupt, mutate, or dead-end unrelated valid candidates or the healthy incumbent unless the shared dependency itself is invalid.

### I-12 — Review recurrence and retryability
Scheduled Lifecycle and Production Health reviews must roll to legal NYSE-session boundaries, recur as designed, remain retryable after transient failure, and never be permanently consumed by an unsuccessful review attempt.

### I-13 — Episode integrity
Re-entry into a Production version creates the correct new operational episode when required; old health state may not bleed into a logically new episode.

### I-14 — Corporate-action continuity
Share splits and other supported corporate-action transitions must preserve economic continuity without rewriting immutable Forward history. Transition accounting must not compare incompatible pre/post-action price scales.

### I-15 — Common-generation action authority
An actionable primary UI state must be based on a coherent authority bundle. Cross-artifact generation skew, stale cache, or mixed-generation state cannot produce an actionable trade.

### I-16 — No strategy retuning through audit
Audits may repair integrity, causality, lifecycle, persistence, workflow, data, and UI safety defects, but may not silently retune frozen strategy parameters or historical research to make performance appear better.

### I-17 — Cost and return semantics remain explicit
The frozen modeled friction convention remains commission 3 bps + slippage 5 bps unless a separately governed research change is approved. Modeled ETF price-return paths must not be presented as guaranteed, after-tax, FX-inclusive real JPY account results.

### I-18 — Operational scheduling containment
Routine scheduled workflows are limited to the intended operational jobs. Closed research workflows remain manual-only unless explicitly reopened under research governance.

## 3. System State Model

Audit 7 treats the system as a product state space rather than a flat checklist. Every test fixture or manual proof must identify the relevant coordinates.

### S1 — Market-time axis
- valid completed NYSE session close
- pre-open before legal execution
- legal core open boundary
- post-open / missed-open
- intraday incomplete session
- weekend
- NYSE holiday
- early-close session
- daylight-saving transition
- delayed scheduled run
- manual/off-schedule run
- multi-day outage/recovery

### S2 — Daily data axis
- complete/current
- stale
- missing required source
- malformed source
- impossible/non-session date
- future bar
- incomplete bar
- interior invalid bar
- source partial success
- corporate-action transition

### S3 — Phase 5 data axis
- complete/current
- one frozen system unavailable
- subset acquisition success
- stale authority
- malformed prior ledger
- multiple-session catch-up
- observation-only backfill
- persistence failure
- deploy failure

### S4 — Production control-state axis
- RESEARCH with no prior Production
- RESEARCH after prior Production episode
- DECISION with no incumbent
- DECISION while incumbent remains active
- PRODUCTION active
- Production reaffirmation
- Production A→B
- Production A→B→A re-entry
- cancelled Decision with prior Production
- cancelled Decision without prior Production

### S5 — Production identity axis
- no selected identity
- registered TQQQ version
- registered QLD version
- registered UPRO version
- registered SSO version
- unregistered ticker
- registered ticker with wrong strategy/version pair
- malformed/contradictory identity

### S6 — Lifecycle / review axis
- ACCUMULATING
- interim checkpoint
- formal review pending
- formal review eligible
- stronger review pending
- annual recurrence
- review date on valid session
- review date on weekend/holiday
- transient incumbent failure
- challenger-only failure
- recovery after failed review attempt
- fresh review
- stale review

### S7 — Execution axis
- no target change
- target increase
- target decrease
- exit to cash
- legal upcoming open
- expired open
- delayed observation before open
- delayed observation after open
- repeated identical signal
- execution already recorded

### S8 — Authority axis
- complete coherent authority bundle
- missing Production config
- malformed Production config
- stale Daily runtime status
- stale Phase 5 status
- stale Lifecycle state
- mismatched generation
- incomplete Forward authority
- Human Approval absent
- Human Approval exact confirmation present

### S9 — Ledger axis
- valid empty/new ledger where creation is legal
- valid append-only ledger
- duplicate record
- out-of-order record
- malformed schema
- retroactive mutation
- future-dated record
- corporate-action boundary
- episode boundary

### S10 — Workflow / persistence axis
- scheduled Daily
- manual Daily
- approval preflight Daily
- Phase 5 scheduled update
- Lifecycle scheduled review
- Production Health scheduled review
- before persistence
- persistence success
- persistence failure
- source-head advancement/concurrent writer
- pull/rebase conflict
- push failure
- retry/rerun

### S11 — Deployment / UI / cache axis
- fresh load + fresh JSON
- fresh page + stale JSON
- cached PWA + new JSON
- stale page + new JSON
- mixed-generation artifacts
- deployment success
- deployment skipped due to failure
- missing artifact
- malformed artifact

### S12 — Recovery axis
- clean retry after fetch failure
- retry after ledger generation failure
- retry after persistence failure
- retry after deploy failure
- recovery after missed schedule
- recovery after authority corruption
- recovery after one-system failure
- re-entry after prior Production episode

## 4. Transition Graph

The following transitions are authoritative model edges for Audit 7 coverage.

### Production control transitions
- RESEARCH → DECISION
- DECISION → PRODUCTION
- DECISION → RESEARCH when no prior Production exists
- DECISION → prior PRODUCTION on cancellation when prior Production exists
- PRODUCTION → DECISION while incumbent remains active
- PRODUCTION(A) → DECISION → PRODUCTION(B)
- PRODUCTION(A) → DECISION → PRODUCTION(A) reaffirmation
- PRODUCTION(A) → PRODUCTION(B) direct transition: **forbidden**
- RESEARCH → PRODUCTION direct transition: **forbidden**

### Evidence/review transitions
- ACCUMULATING → interim observation
- ACCUMULATING → formal review eligibility
- failed scheduled review → retryable pending review
- formal review → Decision only through valid human-governed selection path
- Decision → Production only through Human Approval and valid current authority
- active Production → recurring Health review → same Production or human-required review state; never auto-replacement

### Operational execution transitions
- completed close decision → future legal NYSE open actionable window
- future legal open → execution record at legal observation path
- expired open → non-actionable/no chase
- new later target change → a new future legal execution window

### Persistence/deployment transitions
- validated workspace → atomic persistence → current authority validation → deploy
- validation failure → no persistence/deploy
- persistence failure → no deploy
- authority/integrity failure after persistence attempt → fail closed
- retry must preserve append-only and exactly-once logical effects

## 5. Fault-Class Registry

Every material finding must be classified by structural root cause, not merely by failing file or test.

### FC-01 Temporal Boundary
Incorrect behavior at close/open/session/holiday/early-close/DST/review-time/missed-open boundaries.

### FC-02 Authority Integrity
Missing, malformed, contradictory, stale, or incomplete operational authority accepted as valid.

### FC-03 Persistence / Atomicity
Partial, incoherent, stale-workspace, or non-atomic persistence; deploy proceeding without authoritative persistence.

### FC-04 State Transition
Illegal or ambiguous RESEARCH/DECISION/PRODUCTION or Lifecycle transitions, including unsafe cancel/reaffirmation paths.

### FC-05 Recovery / Re-entry
Retry, recovery, A→B→A, same-version re-entry, or failed-review recovery produces stale or duplicated state.

### FC-06 Cross-System Isolation
Failure or mutation in one candidate/ticker/subsystem contaminates unrelated frozen systems or incumbent authority.

### FC-07 Deployment Coherence
User-facing deployment does not correspond to the validated persisted operational generation.

### FC-08 UI Action Safety
UI produces BUY/SELL/REDUCE or other actionable guidance without the full valid authority bundle or during stale/failed state.

### FC-09 Data Completeness
Invalid, incomplete, non-session, future, stale, or semantically incomplete data reaches operational calculations.

### FC-10 Append-Only Integrity
Historical operational evidence is rewritten, reordered, duplicated, retrofilled, or future-filled.

### FC-11 Concurrency / TOCTOU
State changes between validation and persistence/deploy, concurrent writers race, source-head changes, or stale snapshots are accepted.

### FC-12 Lifecycle Recurrence
Review schedules, rolling dates, recurring annual review, retryability, or cycle consumption are incorrect.

### FC-13 Cache / Generation Skew
PWA/browser/server artifacts from different generations combine into unsafe behavior.

### FC-14 Corporate-Action Continuity
Price/share-scale discontinuity causes artificial P&L or invalid execution accounting across immutable records.

### FC-15 Contract Divergence
Different entry points that should be behaviorally equivalent produce different external actions under equivalent authoritative inputs.

### FC-16 Fault Masking / Silent Default
Missing or invalid required state is silently replaced by empty/default data, converting an integrity failure into apparently valid behavior.

New material findings may create a new fault class or expand an existing class. The reason must be explicit.

## 6. Discontinuity Coverage Matrix

Audit 7 coverage is staged: all high-risk single discontinuities, selected pairwise interactions, then selected hazardous three-way interactions.

| ID | Discontinuity / interaction | Invariants at risk | Primary fault classes | Audit 7 requirement |
|---|---|---|---|---|
| D01 | session close → legal next open | I-01,I-02 | FC-01,FC-09 | mandatory |
| D02 | legal open → expired/missed open | I-07 | FC-01,FC-08 | mandatory |
| D03 | weekday → NYSE holiday | I-02,I-12 | FC-01,FC-12 | mandatory |
| D04 | regular close → early close | I-02,I-12 | FC-01 | mandatory |
| D05 | complete data → incomplete/interior-invalid data | I-02,I-08 | FC-09,FC-16 | mandatory |
| D06 | valid authority → missing/malformed authority | I-08,I-15 | FC-02,FC-16 | mandatory |
| D07 | RESEARCH → DECISION → PRODUCTION | I-03,I-04 | FC-04 | mandatory |
| D08 | Production A → B → A | I-05,I-13 | FC-04,FC-05 | mandatory |
| D09 | append → retry/rerun | I-06,I-09 | FC-10,FC-11 | mandatory |
| D10 | pre-split → post-split | I-14 | FC-14 | mandatory |
| D11 | persist success/failure → deploy | I-09,I-10 | FC-03,FC-07 | mandatory |
| D12 | fresh artifacts → mixed generation/cache | I-08,I-15 | FC-07,FC-13 | mandatory |
| D13 | scheduled Daily ↔ manual/approval-preflight Daily | I-01,I-02 | FC-15 | mandatory |
| D14 | healthy incumbent ↔ challenger failure | I-11 | FC-06 | mandatory |
| D15 | scheduled review ↔ transient incumbent failure ↔ recovery | I-12 | FC-05,FC-12 | mandatory |
| D16 | formal review × holiday × incumbent failure | I-02,I-11,I-12 | FC-01,FC-06,FC-12 | high-risk 3-way |
| D17 | A→B→A × Health ledger × annual review | I-05,I-12,I-13 | FC-04,FC-05,FC-12 | high-risk 3-way |
| D18 | partial Daily × delayed schedule × missed open | I-01,I-02,I-07 | FC-01,FC-09 | high-risk 3-way |
| D19 | persist failure × source-head advance × deploy | I-09,I-10 | FC-03,FC-07,FC-11 | high-risk 3-way |
| D20 | one-system data failure × subset update × retry | I-06,I-11 | FC-06,FC-10 | high-risk pairwise |
| D21 | stale Lifecycle × fresh Daily/Phase5 × approval | I-03,I-08 | FC-02,FC-11 | high-risk pairwise |
| D22 | PWA cached page × new JSON × Production action | I-08,I-15 | FC-08,FC-13 | high-risk 3-way |

Audit 7 is not complete merely because these named rows pass. The auditor must use the System State Model to discover uncovered pairwise or hazardous three-way combinations and add them to the Audit 7 evidence record.

## 7. Audit Independence Matrix

| Audit | Primary discovery mechanism | Primary oracle | Must not count as independent if reduced to |
|---|---|---|---|
| Audit 7 | Model-based white-box state-space and discontinuity analysis | Invariants + transition legality + internal boundary proofs | rerunning existing regression tests/checklists only |
| Audit 8 | Black-box adversarial and differential testing | Observable finite action contract (`BUY/SELL/REDUCE/HOLD/WAIT/CHECK_DATA/REVIEW_REQUIRED/NO_ACTION`) | directly reusing Audit 7 internal assertions as the oracle |
| Audit 9 | Temporal, recovery and chaos sequence simulation | Sequence invariants across hundreds of sessions/years | snapshot fixtures equivalent to Audit 7/8 |
| Audit 10 | Meta-audit and coverage closure | completeness/independence of models, oracles, generators and prior findings | another code-level regression pass |

Two audits count toward the CLEAN streak only when their Primary Discovery Mechanisms remain materially distinct.

## 8. Failure Escalation Protocol

Every material finding triggers all five steps before the audit can close remediation.

### F1 — Root Cause
Identify the structural reason the failure was possible. A line-level bug description is insufficient.

### F2 — Fault-Class Expansion
Search the entire repository, all callers, all generated artifacts, all equivalent entry points, and all persisted-state paths for the same structural failure.

### F3 — Invariant Promotion
Convert the corrected behavior into a named invariant or explicitly link it to an existing invariant. Add permanent regression coverage at the correct boundary.

### F4 — Coverage Expansion
Add the failure to the System State Model, Discontinuity Coverage Matrix, black-box oracle plan, and/or temporal sequence generator as appropriate.

### F5 — Next-Audit Mutation
Change the next audit's discovery plan so that it does not inherit the blind spot that permitted the finding. A known bug must become a broader adversarial family, not just a replay fixture.

Example: a mixed-generation UI defect is promoted to the fault class `Cache / Generation Skew`, expanded across Daily×Lifecycle, Daily×Production, Phase5×Lifecycle, Health×Production, PWA cache×server, then inserted into Audit 8 black-box fixtures and Audit 9 sequence simulations.

## 9. CLEAN accounting

A complete audit is `CLEAN` only when it discovers **zero new material defects** using its independent primary discovery mechanism and passes all required validation.

If an audit discovers one or more material defects, that audit is permanently `NOT CLEAN`, even if all defects are remediated and all closure tests later pass.

Accounting examples:
- Audit 7 CLEAN → streak 1/2; Audit 8 independently CLEAN → streak 2/2.
- Audit 7 NOT CLEAN → 0/2; Audit 8 CLEAN → 1/2; Audit 9 CLEAN → 2/2.
- Audit 8 NOT CLEAN → 0/2; Audit 9 CLEAN → 1/2; Audit 10 CLEAN → 2/2.
- Audit 9 NOT CLEAN → 0/2; Audit 10 CLEAN → 1/2; another independent audit is required.

A renamed audit with substantially the same discovery mechanism does not count as independent.

## 10. Certification State Machine

Certification state is separate from Production state.

### C0 — REMEDIATION BASELINE / 0-of-2 CLEAN
Current state at this freeze. Known Audit 6 defects are remediated, but Audit 6 is permanently NOT CLEAN.

### C1 — CLEAN 1-of-2
Exactly one independent complete audit on a materially unchanged control plane has discovered zero new material defects and passed all validation.

### C2 — CLEAN 2-of-2 / CODE-CONTROL GATE SATISFIED
Two consecutive independent complete audits with materially distinct discovery mechanisms are CLEAN on a materially unchanged control plane.

### C3 — CHAOS / FAULT-INJECTION GATE SATISFIED
Permanent boundary/fault-injection regression exists and temporal/chaos verification has passed. This may overlap chronologically with C2 but is a separate requirement.

### C4 — UNATTENDED SOAK IN PROGRESS
At least 10 consecutive NYSE sessions are observed unattended on a materially unchanged control plane. Any material control-plane change resets the soak unless explicitly proven non-material under this protocol.

### C5 — FINAL UNATTENDED OPERATIONS CERTIFIED
Requires all of:
1. C2: two consecutive independent CLEAN audits;
2. permanent boundary/fault-injection regression pack;
3. temporal/chaos verification;
4. at least 10 consecutive NYSE sessions of unattended operational soak;
5. no material control-plane change invalidating the evidence.

C2 alone must never be labeled final unattended-operations certification.

## 11. Audit 7 charter frozen by this baseline

Audit 7 name: **State-Space & Discontinuity Audit**.

Primary discovery mechanism: **model-based white-box analysis**.

Audit 7 must:
1. map actual implementation paths to the System State Model;
2. verify every invariant against code, persistence boundary, workflow and generated/user-facing authority;
3. inspect each Transition Graph edge and forbidden edge;
4. cover mandatory discontinuities plus newly discovered pairwise and hazardous three-way combinations;
5. inspect every current Fault Class for untested or structurally uncovered callers/artifacts;
6. distinguish source-contract assertions from behavioral tests and reject weak source-regex evidence where behavior can be exercised;
7. record every material finding before remediation;
8. if a material finding exists, classify Audit 7 permanently NOT CLEAN and apply F1–F5 before moving to the next independent audit;
9. avoid strategy retuning and preserve authoritative Forward/Production/Lifecycle data during audit preflight;
10. use non-persistent live preflight where live execution is necessary, restore authoritative state, and prove no mutation before persisting only validated audit remediation.

### Audit 7 minimum white-box interaction set
- formal review × incumbent failure × review-date holiday;
- Production A→B→A × Health episode × annual review recurrence;
- partial Daily data × delayed run × missed execution open;
- persistence failure × source-head advance/concurrent writer × deployment;
- stale Lifecycle × fresh upstream state × Human Approval;
- one frozen candidate failure × Phase 5 subset update × retry;
- corporate action × append-only prior close × next execution/accounting transition;
- cached PWA generation × newly deployed JSON × Production action authority.

## 12. Audit 8–10 role freeze

### Audit 8 — Independent Contract & Adversarial Audit
Use an external observable-action oracle and black-box/differential fixtures. Do not simply replay Audit 7's white-box model.

### Audit 9 — Temporal, Recovery & Chaos Audit
Simulate hundreds of NYSE sessions to multi-year sequences with fault injection before/after fetch, ledger generation, persistence, deployment and approval. Verify no duplicates, retrofills, future data, rewrites, stale Production, old Health episode bleed, or expired-open chase.

### Audit 10 — Meta-Audit & Coverage Closure
Audit the completeness and independence of the State Model, observable oracle, sequence generator, historical fault classification, coverage assertions and audit mechanisms. A new material class discovered here triggers assurance-framework redesign, not a mechanical Audit 11 continuation.

## 13. Immutable-baseline rule

This exact version is the Audit 7 start baseline. Do not edit this file in place after Audit 7 begins. Corrections or framework changes require a new versioned protocol and must identify the finding that forced the change.

The user's explicit authorization on 2026-08-27 to begin Audit 7 satisfies the required human authorization to proceed after this baseline is persisted. It is not Production approval and does not permit any Production strategy promotion.
