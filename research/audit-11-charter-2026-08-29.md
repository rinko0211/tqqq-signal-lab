# Audit 11 Charter — Metamorphic / Property-Based Contract Audit

Date: 2026-08-29

## Entry state

Audit 10 is CLOSED — PERMANENTLY NOT CLEAN. The CLEAN streak entering Audit 11 is **0/2**. Production authority remains RESEARCH with `approvedByHuman=false` and no selected Production identity.

Audit 11 is an independent post-Audit10 audit intended to restart the CLEAN streak only if no material defect is discovered. A CLEAN Audit 11 would establish **1/2**, not certification.

## Primary Discovery Mechanism

Audit 11 uses a **seeded metamorphic/property-based contract mechanism**.

This mechanism is intentionally distinct from:

- Audit 7: white-box state-space / transition / discontinuity analysis;
- Audit 8: hand-authored independent black-box adversarial fixtures and differential observable oracle;
- Audit 9: temporal/recovery/chaos sequence simulation;
- Audit 10: meta-audit, evidence-coverage graph, symmetry inventory, and mutation self-test.

Audit 11 does not primarily ask whether one fixture has one expected output. It generates many related inputs and verifies invariant relations among their externally observable outcomes.

## Independence constraints

The Audit 11 oracle must not call product validation/calendar/ledger helpers to compute expected results. Product entrypoints may call their own internals, but the audit relation must be derived independently from fixture construction and the metamorphic relation itself.

Randomness must be deterministic and reproducible from recorded seeds. On failure, the exact seed, transformation set, and minimal reproducible relation must be retained in the finding record before remediation.

## Observable safety domain

Risk-changing primary actions:

- `INCREASE`
- `REDUCE`

Non-risk-changing actions:

- `HOLD`
- `TARGET_ONLY`
- `REENTER_HOLDINGS`
- `WAIT`
- `NO_ACTION_EXPIRED`
- `CHECK_DATA`

A malformed, stale, contradictory, causally impossible, future-authority, cross-generation, or incomplete-authority mutation must never transform an otherwise non-risk-changing safety response into a risk-changing action merely because another independent fault is added or repaired incompletely.

## Required metamorphic properties

### MR-01 — Fault monotonicity

Starting from coherent actionable and non-actionable bundles, progressively add independently generated safety faults. Once a mutation makes the bundle unsafe, adding further independent safety faults may change the exact non-risk code but must not restore `INCREASE` or `REDUCE`.

Minimum mutation families:

- Signal/status/Forward generation mismatch;
- stale Daily data;
- malformed/missing Forward anchors;
- future Production approval/effective/update chronology;
- invalid/mismatched Production identity;
- malformed holdings ratio/identity;
- missed intended execution open;
- contradictory signal/status date/state.

### MR-02 — Partial-repair closure / repair-order independence

For bundles containing two or more independent safety faults, repair the faults in different orders. Every partially repaired state must remain non-risk-changing. Only the fully repaired coherent state may recover the action implied by the valid fixture. Different repair orders must converge to the same final observable action.

### MR-03 — Session-translation relation

Use stored market-session sequences as an external session oracle. Translate a coherent Daily/Forward fixture from one stored session pair to another while preserving relative generation, signal, execution, and observation ordering. The observable action class must be preserved when the semantic relation is unchanged.

No market-calendar helper may be used by the test oracle to choose the translated session pair.

### MR-04 — Mode/incumbent equivalence relation

For otherwise identical coherent authority bundles:

- RESEARCH and no-incumbent DECISION must remain observationally equivalent at the primary-action boundary;
- PRODUCTION and DECISION-with-the-same-incumbent must remain observationally equivalent where the active incumbent is the same and all authority fields are coherent.

Fault mutations applied symmetrically to either equivalent pair must preserve the same fail-closed relation.

### MR-05 — Ledger append/idempotence relation

For Lifecycle, Production Health, Forward, and Phase5 append-only surfaces where the public product API permits repeated evaluation:

- re-evaluating unchanged evidence must not duplicate logical records;
- append must preserve the prior prefix/value history;
- a failed mutation must not modify the supplied prior ledger;
- equivalent peer/subset update orders must converge to the same logical evidence set where order has no semantic meaning.

### MR-06 — Chronology/provenance symmetry relation

Apply equivalent causal-impossibility transformations to Lifecycle, Production Health, and Approval-consumed current-state evidence:

- observation before due/review date;
- whole-ledger generation earlier than newly appended record;
- future current-state generation relative to the consuming observation/approval time.

Equivalent chronology violations must be rejected on all relevant surfaces; correcting only one independent chronology fault must not make a compound-invalid state valid.

### MR-07 — PWA operational-data transport relation

Across generated operational `/data/` URLs, including query-string variants and different required authority artifacts:

- transport remains network-only / `no-store`;
- CacheStorage is not consulted as an authority fallback;
- navigation shell caching may vary independently without changing operational JSON authority semantics;
- a failed operational fetch may fail closed but may not be substituted with stale cached authority.

### MR-08 — Persistence/deployment generation relation

For persisted-vs-deployed generation scenarios, generate ordered states representing validate → persist → deploy and injected failure points. A generation that is merely persisted but not successfully deployed must not become observable through a simulated reload of the deployed surface; after successful coherent deployment, the same generation may become observable. Source-head coherence checks must remain upstream of deploy.

## Case volume

The retained Audit 11 property suite must execute at least:

- **5,000 deterministic metamorphic primary-action cases** across MR-01 through MR-04;
- **1,000 deterministic ledger/chronology/provenance transformations** across MR-05 and MR-06;
- **500 PWA/persistence transport transformations** across MR-07 and MR-08.

Seeds and case counts must be printed or encoded in test names/output so a failure is reproducible.

## Audit 10 F5 inheritance

Audit 11 must explicitly mutate the promoted invariants from A10-M01 through A10-M03:

- generation chronology symmetry across append-only ledgers;
- review-evidence causal chronology;
- current-state evidence provenance consumed by approval/control boundaries.

It must also retain the safety controls inherited from Audits 7–9 rather than replacing them.

## Discovery and remediation rule

If any property exposes a material product/control defect:

1. stop CLEAN accounting immediately;
2. create an A11-Mxx finding record **before** product remediation;
3. record F1 root cause, F2 expanded fault family, F3 promoted invariant, F4 permanent coverage expansion, and F5 mutation for the next independent audit;
4. Audit 11 becomes permanently NOT CLEAN and CLEAN streak remains/resets to 0/2;
5. remediate under a guarded exact-head workflow and retain the minimized failing seed as permanent regression.

Harness/fixture defects do not become product findings, but must be explicitly distinguished and corrected without weakening the property.

## CLEAN criterion

Audit 11 may be declared CLEAN only if:

- no material product/control defect is discovered;
- every required metamorphic relation passes at or above the required deterministic case volume;
- retained Audit 10, Audit 9, and Audit 8 independent regressions pass;
- full core and full operational regressions pass;
- Pages build passes;
- Production remains RESEARCH/unpromoted;
- authoritative operational data are not mutated by the audit;
- the validated exact head is recorded.

If CLEAN, the consecutive CLEAN streak becomes **1/2**.

## Certification boundary

A CLEAN Audit 11 is not certification. A further independent CLEAN audit with a materially different Primary Discovery Mechanism is required for 2/2, and the frozen protocol separately requires at least **10 consecutive NYSE sessions of unattended soak on a materially unchanged control plane** before final certification.

## Governance exclusions

Audit 11 must not:

- retune research strategy parameters;
- promote Production;
- manufacture or rewrite append-only historical evidence;
- relax a previously promoted safety invariant merely to satisfy a generated property.
