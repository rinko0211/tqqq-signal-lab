# Audit 7 Finding 001 — Production Authority Boundary Integrity

Date: 2026-08-27
Audit: Audit 7 — State-Space & Discontinuity Audit
Baseline protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Protocol commit: `7cb1495592bfe6d2678c6d5850548131525b0cf8`
Classification: **MATERIAL**
Audit accounting effect: **Audit 7 is permanently NOT CLEAN; clean streak remains 0/2**

## Discovery mechanism

This finding was discovered by the Audit 7 model-based white-box state-space probe, not by replaying an Audit 5/6 regression. The probe enumerated partial Production authority states that are absent from the nominal RESEARCH/DECISION/PRODUCTION happy-path tests.

## Observed defect

`assertProductionConfigIntegrity()` computes complete selection with a single conjunction:

`Boolean(selectedTicker && selectedStrategy && strategyVersion)`

A configuration containing only one or two of the three identity fields therefore becomes `selected === false`. In RESEARCH or an unapproved DECISION state, that partial identity is not rejected even though it is malformed persisted authority.

Separately, approved authority requires non-null `approvalDate` and `effectiveDate`, but the validator does not verify that these are valid ISO market dates. Values such as `not-a-date` or impossible dates can therefore satisfy the presence-only test.

Finally, `transitionMode()` accepts a caller-supplied current configuration and does not independently validate it at the transition boundary. A malformed partial current authority can therefore be carried into DECISION when a caller omits a prior validator.

## Why material

Production configuration is an operational authority boundary. The governing protocol requires missing, malformed, contradictory, stale, cross-generation, or unverifiable authority to fail closed. Accepting partial identity or malformed authority dates converts a structural authority corruption into an apparently valid control state. Today’s persisted Production configuration is not corrupted; this is a latent control-plane defect under malformed-state injection.

## F1 — Root Cause

Authority integrity is encoded as a small set of positive happy-path predicates instead of a complete state-shape invariant. The implementation asks whether a complete triple exists, but does not ask whether the triple is **all-null or all-complete**, and it relies on callers to validate before transitions. Date fields are checked for presence rather than semantic format.

## F2 — Fault-Class Expansion

Primary classes:
- `FC-02 Authority Integrity`
- `FC-16 Fault Masking / Silent Default`
- secondary: `FC-04 State Transition`

Expanded search family for Audit 7:
1. every persisted Production identity must be all-null or an exact registered triple;
2. approved authority dates must be semantically valid, not merely truthy;
3. state transition entry points must reject malformed current authority themselves;
4. DECISION-with-incumbent must remain valid because it intentionally carries a complete approved incumbent;
5. RESEARCH may not carry residual identity or approval fields;
6. unapproved DECISION may not carry partial or complete selected Production identity;
7. registered ticker/version/strategy must remain a coherent triple.

## F3 — Invariant Promotion

This finding concretizes protocol invariants:
- I-03 Human Production authority
- I-04 Research / Decision / Production segregation
- I-05 Frozen Production identity
- I-08 Fail closed on authority or data uncertainty

Permanent behavioral regression must exercise malformed partial authority, malformed dates, and transition-boundary validation rather than only source-text assertions.

## F4 — Coverage Expansion

Add state-space coverage for:
- each 1-of-3 and 2-of-3 identity combination;
- RESEARCH, DECISION and PRODUCTION modes;
- approved/unapproved combinations;
- invalid approval/effective dates;
- malformed current authority passed directly into every transition mode;
- valid DECISION with active incumbent as a non-regression control.

Audit 8 must treat malformed Production authority as black-box input and require a non-actionable/fail-closed observable result. Audit 9 must inject authority corruption between successful sessions and verify recovery without mutation or accidental promotion.

## F5 — Next-Audit Mutation

Audit 8’s adversarial fixture generator must no longer model Production config as either valid or missing. It must generate partial triples, contradictory approval flags, unknown registered identities, malformed dates, and mixed-generation authority. The observable oracle must reject all malformed variants before any BUY/SELL/REDUCE instruction can be emitted.

## Remediation requirements

1. Change Production identity validation from truthy-complete detection to an exact all-null/all-complete shape invariant.
2. Validate approval/effective and health-review date fields semantically where present.
3. Validate the current Production config at the start of `transitionMode()` and `cancelDecision()` so library boundaries do not depend on caller discipline.
4. Preserve the intentional DECISION-with-active-incumbent state.
5. Add permanent behavioral regression.
6. Run Audit 7 discovery probes plus full `test:core` and `test:ops` after remediation.
7. Do not alter strategy parameters, Forward history, Lifecycle history, Production selection, or current persisted authority as part of this remediation.
