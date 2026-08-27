# Audit 8 Findings — Wave 1 Independent Black-Box Discovery

Date: 2026-08-27
Audit: Audit 8 — Independent Contract & Adversarial Audit
Frozen charter: `research/audit-8-charter-2026-08-27.md`
Formal discovery head: `6b4bc5fa1411552e645733c276223ae7b4ffb291`
Workflow run: `33078555729`
Job: `98539168904`

## Audit accounting

**Audit 8 is permanently NOT CLEAN. CLEAN streak remains 0/2.**

This status is irreversible for Audit 8 even after remediation. The formal independent discovery executed 7 black-box tests: 3 passed and 4 failed. In the same workflow, legacy/full-system controls remained green:

- full core regression: 212/212 PASS
- full operational regression: 176/176 PASS
- Pages production build: PASS
- authoritative-state mutation guard: PASS
- Production remained RESEARCH / unapproved / no selected identity

The mismatch therefore represents new externally observable contract failures rather than a broad regression introduced by the Audit 8 harness.

---

# A8-M01 — Unvalidated Numeric Action Inputs Can Emit Risk-Changing Advice

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

## Dynamic evidence

The independent oracle supplied coherent authority, a valid future execution window, and deliberately corrupted numeric action inputs.

Observed product behavior included:
- holdings ratio `"oops"` → **REDUCE**
- signal target `-0.25` → **REDUCE**

Both are invalid inputs and must be non-risk-changing. The finite observable contract requires `CHECK_DATA` for malformed or unsafe input state.

## F1 — Root Cause

`derivePrimaryAction()` converts browser-local holdings with `Number(ratio)/100` without checking finite/range semantics. `NaN` then survives to the final comparison chain: `actual < target` is false and execution falls through to `REDUCE`.

Signal `target` and `previousTarget` are likewise consumed without a finite `[0,1]` contract check. Out-of-range target values can therefore generate valid-looking increase/reduce instructions.

The defect is a boundary-validation failure at the last user-facing risk-changing decision point.

## F2 — Fault-Class Expansion

Primary classes:
- UI Action Safety
- Data Completeness / Semantic Integrity
- Fault Masking / Silent Default

Expanded family:
- nonnumeric holdings strings;
- `NaN` / Infinity-like values;
- negative holdings;
- holdings >100%;
- negative target / previousTarget;
- target / previousTarget >1;
- non-finite signal numeric fields;
- exact-boundary 0 and 1 values;
- malformed values combined with ticker/version transitions and expired-open states.

## F3 — Invariant Promotion

**No risk-changing action may be emitted unless every numeric input used to calculate exposure is finite and within its externally valid domain. Holdings must be within 0–100%; signal target and previousTarget must be within 0–1. Any violation yields CHECK_DATA before action comparison.**

## F4 — Coverage Expansion

Permanent independent regression must cover the entire malformed/boundary family and assert exact `CHECK_DATA`, not merely “not INCREASE/REDUCE”.

Audit 9 mutation: inject browser-local holdings corruption and malformed signal target fields before/after reload, ticker changes, cache restoration, and execution-window transitions.

## F5 — Next-Audit Mutation

Audit 9 sequence generator must include corrupted local holdings and malformed target artifacts as recoverable faults, verifying:
1. no risk-changing action while corrupted;
2. no stale unsafe action survives after recovery;
3. recovery to a valid value produces only the action justified by the newly coherent state.

---

# A8-M02 — Research Freshness Can Mask Stale Operational Authority

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

## Dynamic evidence

Fixture:
- operational Signal/status/Forward remained mutually generation-coherent but stale at market-data date `2026-08-19`;
- a separate fresher research/dataset date `2026-08-20` was supplied through the UI-compatible freshness input;
- observation occurred before the nominal execution open.

Independent expected result: `CHECK_DATA`.
Observed product result: **INCREASE**.

## F1 — Root Cause

The product action boundary accepts `freshnessDate` as an override and computes freshness from that date instead of the authoritative operational Signal data date when the override is present. The actual UI supplies its broader `latestDate`, which may come from a research/historical dataset rather than the Daily operational artifact.

This permits non-authoritative research freshness to upgrade stale operational authority.

## F2 — Fault-Class Expansion

Primary classes:
- Authority Integrity
- Cache / Generation Skew
- Cross-System Isolation
- UI Action Safety

Expanded family:
- stale Daily + fresh research dataset;
- stale Daily + freshly uploaded CSV;
- stale Daily + fresh cached analysis tab;
- old Signal/status/Forward bundle with newer research date;
- fresh Daily with older research dataset (must not incorrectly downgrade authority either);
- tab navigation/reload order affecting `latestDate` source.

## F3 — Invariant Promotion

**Risk-changing operational freshness may only be derived from the authoritative operational bundle itself. Research, uploaded CSV, analysis, cached research, or display-only dates may neither upgrade nor downgrade Daily trading authority.**

## F4 — Coverage Expansion

Permanent black-box differential checks must compare identical operational bundles under different research-dataset dates and require identical primary-action authority.

Audit 9 mutation: independently delay Daily and research fetches, reorder cache hydration, and switch tabs/reload timing while asserting the operational action depends only on operational authority.

## F5 — Next-Audit Mutation

Audit 9 chaos sequences must inject stale Daily + fresh research and fresh Daily + stale research combinations before and after intended execution opens and browser reloads.

---

# A8-M03 — Malformed Forward History Is Not Enforced at the Primary Action Boundary

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

## Dynamic evidence

The independent fixture supplied a Forward artifact with valid top-level metadata (`schemaVersion`, `appendOnly`, `updatedAt`) but duplicate logical/history records.

Independent expected result: `CHECK_DATA`.
Observed product result: **INCREASE**.

## F1 — Root Cause

The final action authority path consumes a narrowed Forward authority projection and checks only top-level metadata/generation. It does not establish full Forward ledger integrity before allowing a risk-changing action. The actual UI loads the Forward JSON and passes it to `derivePrimaryAction()` without a full append-only integrity assertion at that boundary.

Audit 7 hardened ledger writers/read-update boundaries, but Audit 8 independently demonstrated a contract gap between ledger integrity and user-facing action authority.

## F2 — Fault-Class Expansion

Primary classes:
- Append-Only Integrity
- UI Action Safety
- Contract Divergence
- Fault Masking / Silent Default

Expanded family:
- duplicate Forward keys;
- out-of-order records;
- impossible record dates;
- unknown/freeze-drift versions;
- truncated prior history;
- malformed immutable anchor;
- valid top-level metadata with corrupt nested history;
- cached malformed Forward artifact while Signal/status remain fresh.

## F3 — Invariant Promotion

**A Forward artifact can participate in risk-changing authority only after its complete append-only/history integrity has been established. Top-level schema/generation metadata alone is insufficient. Any full-ledger integrity failure yields CHECK_DATA at the user-facing action boundary.**

## F4 — Coverage Expansion

Audit 8 permanent black-box fixtures must pass full malformed Forward artifacts through the same product entrypoint used by the UI and require `CHECK_DATA`.

Audit 9 mutation: inject partial/truncated/duplicate Forward persistence immediately before UI fetch and between Signal/status publication and page refresh.

## F5 — Next-Audit Mutation

Audit 9 chaos must model partial persistence and cache skew where a top-level-coherent but internally malformed Forward artifact reaches the page. Recovery must never reuse an unsafe action computed from the corrupt generation.

---

## Required remediation gate

Remediation may begin only after this finding record. It must:
1. validate holdings and signal target semantics before any risk-changing action;
2. bind operational freshness to operational Signal authority, not research/display dates;
3. require full Forward ledger integrity at the actual product action boundary;
4. preserve the frozen Audit 8 independent oracle as the expected-value mechanism;
5. register Audit 8 regression permanently after remediation;
6. run independent discovery, full core, full ops, Pages build, and authoritative-state no-mutation checks;
7. make no Production promotion, strategy retuning, or append-only history rewrite.

After remediation, Audit 8 remains NOT CLEAN and must continue its remaining independent scope.