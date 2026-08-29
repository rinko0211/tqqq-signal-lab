# Audit 12 Charter — Concurrency / Linearizability Interleaving Audit

Date: 2026-08-29
Audit: Audit 12 — Concurrency / Linearizability Interleaving Audit
Entry CLEAN streak: **1/2**
Entry certification state: **C1 — CLEAN 1-of-2**
Production authority: **RESEARCH / approvedByHuman=false / no selected identity**
Immediate predecessor: `research/audit-11-close-2026-08-29.md`
Governing baseline: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`

## 1. Primary Discovery Mechanism

Audit 12 uses **bounded exhaustive concurrent-history exploration with an independent linearizability/serializability oracle**.

This is materially distinct from:
- Audit 7 white-box state-space/discontinuity analysis;
- Audit 8 snapshot black-box/adversarial differential testing;
- Audit 9 temporal/recovery/chaos session sequencing;
- Audit 10 meta-audit/coverage graph/mutation self-test;
- Audit 11 seeded metamorphic/property-based relation testing.

Audit 12 treats routine writers and deployment paths as concurrent operations. It enumerates legal and hazardous interleavings at validation, local generation, compare-and-swap persistence, authority confirmation, build, and deployment boundaries. Successful concurrent histories must be observationally equivalent to at least one allowed safe serial history. Histories that cannot be safely serialized must abort/fail closed before publishing unsafe state.

## 2. Independent oracle

The Audit 12 oracle is a small audit-only reference scheduler/state machine. It must not call product workflow helpers, production validators, ledger validators, or product calendar functions to determine expected outcomes.

The oracle represents only external resources and effects:
- authoritative `main` generation/head;
- validated workspace generation;
- logical append-only artifact updates;
- Production authority generation;
- deployed Pages generation;
- operation success/abort;
- whether a deployment corresponds to a validated persisted generation.

An accepted history must satisfy linearizability: there must exist a serial ordering of successful logical operations that preserves real-time precedence and produces the same externally visible authoritative/deployed state.

## 3. Concurrent operation families

At minimum model and bind to the actual workflow contracts for:

### W1 — Daily operational update
`daily-signal.yml`
- capture validated `main` head;
- generate Daily state;
- operational validation;
- compare authoritative head before persistence;
- persist or abort;
- confirm persisted head remains authoritative;
- build/deploy only the validated persisted head.

### W2 — Phase 5 Forward update
`phase5-forward.yml`
- capture validated head;
- validate;
- generate subset/full Phase5 evidence/status;
- persist append-only state or failure status under head coherence;
- confirm authority;
- deploy only coherent persisted state.

### W3 — Lifecycle / Production Health update
`lifecycle-review.yml`
- capture validated head;
- validate review inputs;
- generate Lifecycle/Health evidence;
- compare authoritative head before persistence;
- persist or abort;
- confirm authority;
- deploy only coherent persisted state.

### W4 — Human control transition
`approve-production.yml`
- capture validated head;
- refresh authoritative inputs where required;
- apply local human decision in the test model only;
- full preflight;
- compare authoritative head before atomic persistence;
- persist or abort;
- deploy only the exact persisted SHA.

No Audit 12 test may invoke a real Production promotion. Approval is modeled only as an isolated test operation.

### W5 — deploy-only validated state
Reusable `daily-signal.yml` deploy-persisted-only path:
- checkout exact expected persisted SHA;
- require `origin/main` still equals that SHA;
- never fetch/regenerate operational data;
- deploy only if exact persisted generation remains authoritative.

## 4. Required linearizability properties

### LZ-01 — Single authoritative writer effect
Two operations that both begin from the same `main` generation may not both persist divergent child states as if each were based on the same authoritative parent. At most one wins; the other must revalidate or abort.

### LZ-02 — No lost append-only update
Concurrent Daily/Phase5/Lifecycle writes may not silently erase or overwrite a previously persisted logical observation. A stale workspace cannot be rebased into `main` without revalidation.

### LZ-03 — Persist-before-deploy
No workflow may deploy an operational generation that has not first become authoritative persisted state.

### LZ-04 — Exact generation deploy
A deploy-only approval path may deploy only its exact persisted SHA. If `main` advances before deployment, deployment must abort rather than deploy the old approved workspace or a newer unapproved workspace.

### LZ-05 — Validation-to-persistence TOCTOU closure
If `main` advances after validation but before persistence, the stale operation must not persist its locally generated state.

### LZ-06 — Persistence-to-deploy TOCTOU closure
If `main` advances after persistence/confirmation but before deploy, any path that promises exact-generation deployment must detect the change or otherwise be protected by the common serialization contract; it may not label a different generation as the validated one.

### LZ-07 — Cross-workflow serializability
Successful observable histories involving W1/W2/W3/W4/W5 must correspond to a safe serial ordering; non-serializable outcomes are defects.

### LZ-08 — Failure isolation
A generation/persistence/deploy failure in one operation may not partially commit its local state into another operation's authoritative result.

### LZ-09 — No authority mutation by non-approval writers
Daily, Phase5 and Lifecycle operations may observe Production authority but may not create or replace Human Production authority.

### LZ-10 — Retry exactly-once logical effects
An aborted stale writer followed by a clean retry must produce at most one logical append/update for the retried observation and must preserve already authoritative evidence.

### LZ-11 — Common serialization lock contract
All workflows that write the integrated authoritative operational state or deploy integrated Pages must participate in the intended shared serialization boundary, or possess an independently proven equivalent CAS/linearizability mechanism.

### LZ-12 — Real-time precedence
If operation A completes authoritative persistence before operation B begins validation, an accepted history may not serialize B before A.

## 5. Required exploration volume

The retained Audit 12 suite must exhaustively enumerate or partial-order-reduce at least:
- every pairwise interleaving among W1–W5 at the critical read/validate/persist/confirm/deploy boundaries;
- selected hazardous triple-operation families involving W4 approval plus at least two routine writers;
- persistence failure, push/head advance, confirmation failure, build failure and deploy failure injection points;
- clean retry after stale-head abort.

The suite must evaluate at least **10,000 distinct bounded operation histories** after canonical de-duplication. The exact count and scenario-family counts must be printed for reproducibility.

## 6. Workflow binding requirement

The model checker must be bound to the actual repository workflow contracts. It must independently verify, from the workflow source, the presence/order of the critical primitives on which the model relies, including:
- common concurrency/serialization groups;
- captured validated head;
- `origin/main` coherence check before stale-workspace persistence;
- authority confirmation after persistence where required;
- build/deploy after persistence/confirmation;
- exact persisted SHA enforcement for deploy-only approval calls.

If actual workflow structure diverges from the modeled protocol, the audit must fail rather than silently model the desired behavior.

## 7. Audit 10/11 inheritance

Audit 12 must retain:
- A10 chronology/provenance controls;
- Audit 10 coverage/mutation pack;
- Audit 9 temporal/fault-injection pack;
- Audit 8 independent black-box pack;
- Audit 11 metamorphic pack.

The new PDM is concurrency-history linearizability, not another replay of those mechanisms.

## 8. Material finding rule

Any newly discovered safety-relevant non-linearizable workflow behavior, stale-writer acceptance, lost update, authority-generation mismatch, unsafe deployment race, or missing required serialization primitive is an Audit 12 material finding.

On a material finding:
1. record `A12-Mxx` before remediation;
2. identify F1 structural root cause;
3. expand the concurrency/fault family under F2;
4. promote the corrected linearizability invariant under F3;
5. retain minimized failing history and permanent regression under F4;
6. mutate the next independent audit under F5;
7. Audit 12 becomes permanently NOT CLEAN and the CLEAN streak resets to 0/2.

Harness/model errors must be distinguished explicitly and corrected without weakening the linearizability property.

## 9. CLEAN criterion

Audit 12 is CLEAN only if:
- zero new material product/control defects are discovered;
- LZ-01 through LZ-12 pass;
- >=10,000 distinct bounded histories are evaluated;
- workflow-binding checks pass;
- Audit 11, Audit 10, Audit 9 and Audit 8 retained evidence passes;
- full core and full ops pass;
- Pages build passes;
- Production remains RESEARCH/unpromoted;
- authoritative operational data are not mutated by the audit;
- exact validated head is recorded.

If CLEAN, the consecutive independent CLEAN streak becomes **2/2** and the code-control gate may reach **C2**. This still does not satisfy final unattended-operations certification.

## 10. Certification boundary

Even a CLEAN Audit 12 and resulting 2/2 CLEAN streak do not authorize Production automatically. Final certification remains separately blocked by the frozen requirement for at least **10 consecutive NYSE sessions of unattended soak on a materially unchanged control plane**, plus retention of permanent boundary/fault-injection/temporal protections.

## 11. Governance exclusions

Audit 12 must not:
- promote Production;
- perform a real Human Approval transition;
- retune frozen research strategy parameters;
- rewrite append-only historical operational evidence;
- weaken a prior safety invariant to make an interleaving linearizable;
- count a simulated serialization result as proof of real-session unattended soak.
