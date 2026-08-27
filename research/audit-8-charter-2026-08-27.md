# Audit 8 Charter — Independent Contract & Adversarial Audit

Date: 2026-08-27
Status: **START AUTHORIZED / INDEPENDENT AUDIT BASELINE**
Parent assurance protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Audit 7 close report: `research/audit-7-close-2026-08-27.md`
Audit 7 validated control/test head: `06520b5b76a18be103ba4f7c374426d90d19f313`
Audit 7 report-only descendant at Audit 8 start: `d8c76b715bf39bbd686aea527c1531847c99a169`
Certification state at start: **C0 — 0/2 CLEAN**

## 1. Independence requirement

Audit 8 uses a materially different Primary Discovery Mechanism from Audit 7.

- Audit 7 primary mechanism: model-based white-box state-space / internal discontinuity analysis.
- Audit 8 primary mechanism: **black-box adversarial fixtures + independent observable-action oracle + differential entrypoint testing**.

Audit 8 does **not** count as independent if expected results are computed by calling or restating the same internal implementation helpers being tested. In particular, Audit 8's oracle must not call `operationalAuthorityBundleIsCoherent`, Production validators, market-calendar execution helpers, ledger integrity validators, or Lifecycle selection helpers to decide the expected answer.

The product under test may internally use those helpers. The oracle may not.

## 2. Observable contract

Audit 8 evaluates the product at the user-facing risk-changing decision boundary. Internal reasons may vary; the externally observable normalized action must belong to this finite domain:

- `INCREASE` — user is instructed to add exposure at a valid future execution window.
- `REDUCE` — user is instructed to reduce exposure at a valid future execution window.
- `HOLD` — current exposure is already at the valid changed target or there is explicitly no new target change.
- `TARGET_ONLY` — valid target is displayed but holdings are not entered; no trade instruction is emitted.
- `REENTER_HOLDINGS` — active operational ticker/version changed and stale device-local holdings must not be reused.
- `WAIT` — execution opportunity is not yet/otherwise not valid for an actionable instruction.
- `NO_ACTION_EXPIRED` — an intended open has passed; the product refuses to chase it.
- `CHECK_DATA` — authority/data/generation/integrity cannot be trusted; risk-changing action is prohibited.

For certification purposes only `INCREASE` and `REDUCE` are risk-changing actions. Every malformed, stale, contradictory, cross-generation, missing-authority, expired-open, or otherwise unsafe fixture must produce one of the non-risk-changing states.

## 3. Product black-box entrypoint

Audit 8 will exercise a pure product-level `derivePrimaryAction(...)` entrypoint that represents the same final primary-action contract used by the UI.

The entrypoint must accept raw externally observable inputs rather than precomputed white-box safety booleans:
- Signal artifact;
- runtime status artifact;
- Forward artifact;
- Production config artifact;
- current timestamp;
- holdings state.

The product implementation may delegate to existing internal controls. Audit 8's independent oracle will not.

The UI must consume this same product entrypoint so tests cannot pass against a shadow implementation unused by the actual page.

## 4. Independent oracle rules

The Audit 8 oracle is a test-only implementation defined from this charter. It must determine expected action from fixture semantics directly.

### 4.1 Authority semantics
A risk-changing action is forbidden unless all of the following are true:
1. Signal, status, Forward and Production artifacts are present.
2. Production config is structurally one of the explicitly valid external shapes:
   - RESEARCH: no selected identity, no approval authority;
   - DECISION without incumbent: no selected identity, no approval authority;
   - DECISION with incumbent: complete registered identity and approved authority;
   - PRODUCTION: complete registered identity and approved authority.
3. Complete selected identities are exact known registered ticker/strategy/version triples.
4. Signal operational identity equals the expected active identity; when no active Production exists, expected operational baseline is TQQQ / Volatility Shield 13% / VS13-v1.0.
5. Signal platform mode equals Production mode.
6. Signal generated timestamp, status generated timestamp and Forward updated timestamp are valid and exactly equal.
7. Signal data date equals status signal date and status market-data date.
8. Status indicates success and contains no errors.
9. Signal/status state agrees.
10. Forward claims the expected schema and append-only contract.

Any violation yields `CHECK_DATA` before execution/holdings logic.

### 4.2 Execution semantics
Using fixed adversarial fixture times chosen around known NYSE opens:
- a target change with a clearly future legal open may be actionable;
- a target change whose intended open is already past yields `NO_ACTION_EXPIRED`;
- a target change without a valid future execution window yields `WAIT`;
- no target change yields `HOLD` regardless of holdings difference.

The oracle must encode fixture-local expected boundaries directly. It must not call production market-calendar helpers.

### 4.3 Holdings semantics
After authority/execution safety:
- holdings tagged to a different ticker/version yield `REENTER_HOLDINGS`;
- holdings absent yield `TARGET_ONLY`;
- no signal change yields `HOLD`;
- valid changed target + future execution window + actual approximately target yields `HOLD`;
- valid changed target + actual below target yields `INCREASE`;
- valid changed target + actual above target yields `REDUCE`.

## 5. Adversarial fixture dimensions

Audit 8 must mutate fixture dimensions independently and in combinations rather than replaying only Audit 7 examples.

### Authority corruption family
- each 1-of-3 and 2-of-3 selected identity permutation;
- complete unregistered identity;
- registered ticker with wrong strategy/version pair;
- approved flag contradictions;
- missing approval/effective dates;
- impossible authority dates;
- invalid/missing required Production fields;
- RESEARCH carrying residual approved authority;
- DECISION with and without incumbent.

### Generation / cache family
- Signal older than status/Forward;
- status older than Signal/Forward;
- Forward older than Signal/status;
- missing/malformed generation on each artifact;
- equal generation but divergent data dates;
- old Signal + new Production;
- new Signal + old Production;
- stale cached holdings after ticker/version transition.

### Execution family
- immediately before legal open;
- immediately after legal open;
- delayed run after missed open;
- no target change;
- increased target;
- decreased target;
- already-at-target holdings.

### Ledger / evidence family
Where the product entrypoint consumes ledger authority directly, generate:
- duplicate records;
- out-of-order records;
- impossible dates;
- missing immutable anchor/history truncation;
- stale multi-quarter Health cursor;
- A→B→A/re-entry evidence;
- one Phase 5 system failure while peers remain valid.

If a malformed ledger is rejected upstream before the primary action entrypoint, differential tests must verify that the externally reachable result is still non-risk-changing rather than silently substituting default authority.

## 6. Differential testing requirement

Equivalent operational inputs entering through different supported paths must not produce contradictory external actions.

At minimum compare:
- direct pure primary-action product entrypoint vs the UI's mapped primary action representation;
- RESEARCH baseline vs equivalent no-incumbent DECISION where only mode semantics differ;
- active Production vs DECISION-with-incumbent for the same incumbent identity;
- fresh artifact bundle vs one-field generation mutation;
- valid future-open fixture vs the same fixture observed after the intended open.

Audit 8 should favor property/family generation over isolated examples when practical.

## 7. CLEAN criteria

Audit 8 is `CLEAN` only if all are true:
1. the independent adversarial/black-box mechanism discovers **zero new material defects**;
2. all Audit 8 fixtures and differential checks pass;
3. full core/ops regressions pass;
4. user-facing Pages build passes;
5. current authoritative state remains valid and unchanged by test execution;
6. no strategy retuning or Production promotion occurs.

If any new material defect is discovered, Audit 8 becomes permanently `NOT CLEAN` immediately. Remediation may continue, but this audit can never regain CLEAN status.

If Audit 8 completes with zero new material defects, certification moves from 0/2 to **1/2 CLEAN**. This is still not final certification.

## 8. Audit 8 failure handling

Every new material defect must be recorded before remediation and processed through F1–F5:
- F1 Root Cause
- F2 Fault-Class Expansion
- F3 Invariant Promotion
- F4 Coverage Expansion
- F5 Next-Audit Mutation

Audit 8 findings must mutate Audit 9's sequence/chaos generator rather than merely becoming static replay cases.

## 9. Mutation controls

Audit 8 may add isolated tests, test-only fixtures, pure product decision interfaces, UI wiring to the same interface, and integrity-safe remediation if a defect is found.

Audit 8 must not:
- retune strategy weights/stops/sizing;
- modify frozen research outcomes to improve results;
- rewrite Forward, Phase 5, Lifecycle or Production Health history;
- promote a Production system;
- treat Audit 7 white-box assertions as its expected-value oracle.

This charter is the Audit 8 independence baseline and is not to be edited in place after adversarial execution begins. Any change to the audit method requires a new versioned addendum explaining why the original independent method was insufficient.
