# Audit 8 Preflight Close — Product Entrypoint Instrumentation

Date: 2026-08-27
Status: **PRE-AUDIT-8 PREREQUISITES CLOSED / FORMAL ADVERSARIAL DISCOVERY NOT YET STARTED**
Parent charter: `research/audit-8-charter-2026-08-27.md`
Certification state: **C0 — 0/2 CLEAN**

## 1. Purpose

This record closes the prerequisite instrumentation needed before Audit 8 can begin its independent black-box/adversarial discovery. It does not count as an Audit 8 CLEAN result and it does not advance the clean streak.

The objective was to expose the actual user-facing risk-changing decision boundary through one pure product entrypoint while preserving all pre-existing fail-closed behavior, then prove that the real UI consumes that same entrypoint rather than a test-only shadow implementation.

## 2. Validated product wiring

Validated source head before persistence:
- `3c84840cd081b3dde9314bdba5fd853330e72757`

Validated persisted product head:
- `43dcfef9fb713dcc06e5923b9f892e4b567e36e1`
- Commit: `Wire UI to Audit 8 primary action entrypoint`

The persisted product diff from the validated source head contains exactly one product file:
- `app/page.tsx`

The UI now consumes `derivePrimaryAction(...)` from `lib/primary-action.ts` for the primary operational action. The previous duplicate/shadow final-action branch in `app/page.tsx` was removed.

Permanent instrumentation guard retained:
- `tests/audit8-instrumentation.test.ts`

The guard verifies both the finite primary-action surface and that the actual page is wired to the same product entrypoint.

## 3. Guarded verification evidence

GitHub Actions run:
- Run: `33076043341`
- Job: `98530373338`
- Conclusion: **SUCCESS**

Validated gates:
- immutable Audit 8 charter verification: PASS
- one-shot product entrypoint wiring: PASS
- dedicated Audit 8 instrumentation tests: **2/2 PASS**
- full core regression: **212/212 PASS**
- full operational regression: **176/176 PASS**
- user-facing Pages production build: PASS
- instrumentation-only product diff enforcement: PASS
- authoritative public-data diff guard: PASS
- source-head race guard before persistence: PASS
- validated UI wiring persistence: PASS

## 4. Authoritative-state preservation

The guarded run explicitly required no diff under the authoritative public-data path before persistence. The persisted commit comparison confirms that only `app/page.tsx` changed between the validated source head and the persisted product head.

Current Production authority after persistence remains:
- mode: `RESEARCH`
- `selectedTicker: null`
- `selectedStrategy: null`
- `strategyVersion: null`
- `approvedByHuman: false`
- no approval/effective date
- no active Production health schedule

No strategy weights, stops, sizing, research outcomes, frozen Forward history, Phase 5 history, Lifecycle history, or Production Health history were changed by this preflight.

## 5. One-shot workflow cleanup

After successful persistence, the temporary self-writing instrumentation workflow was removed so that future ordinary changes cannot accidentally re-run the one-shot wiring procedure.

Cleanup commit:
- `0db833464323cd92418f11ebc96b543a34759e09`
- Removed only `.github/workflows/audit8-instrument-primary-action.yml`

The permanent product entrypoint and its regression guard remain in the repository.

## 6. Audit accounting

This preflight is not an independent complete audit and therefore does not count toward the 2/2 CLEAN certification requirement.

State remains:
- Audit 7: NOT CLEAN
- clean streak: **0/2**
- Audit 8 formal discovery: **NOT YET EXECUTED**

Audit 8 may now begin only under its frozen charter using:
- independent observable-action oracle;
- black-box adversarial fixtures;
- differential entrypoint testing;
- no Audit 7 white-box helper as expected-value oracle.

If Audit 8 discovers any new material defect, Audit 8 becomes permanently NOT CLEAN immediately and F1–F5 failure inheritance applies before remediation.

## 7. Next authorized step

The next step is the actual Audit 8 Independent Contract & Adversarial Audit. No Production promotion, strategy retuning, Forward rewrite, Lifecycle rewrite, or Health-history rewrite is authorized by this close record.
