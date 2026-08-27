# Audit 8 Findings — Wave 2 Independent Black-Box Discovery

Date: 2026-08-27
Audit: Audit 8 — Independent Contract & Adversarial Audit
Frozen charter: `research/audit-8-charter-2026-08-27.md`
Formal discovery head: `c8de087dac115c2f5ae3437ec8918f3751f1e34b`
Workflow run: `33089699331`
Job: `98578875783`

## Audit accounting

**Audit 8 remains permanently NOT CLEAN. CLEAN streak remains 0/2.**

Wave 2 executed the permanent Wave 1 independent regression plus new adversarial/differential fixtures. Across the 17 independent tests, 11 passed and 6 failed. The same exact discovery head then passed:

- full core regression: **219/219 PASS**
- full operational regression: **183/183 PASS**
- Pages production build: **PASS**
- authoritative public-data mutation guard: **PASS**
- Production authority remained `RESEARCH / approvedByHuman=false / null identity`

The six failures are therefore independent observable-contract gaps rather than broad regressions or test-environment contamination.

---

# A8-M04 — Coherent Future-Dated Operational Generation Can Authorize Risk

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: Signal `generatedAt`, runtime `generatedAt`, and Forward `updatedAt` all claimed `2026-08-28T21:10:00Z` while observation time was `2026-08-27T12:00:00Z`.

Expected: `CHECK_DATA`.
Observed: **INCREASE**.

## F1 — Root Cause

The authority bundle establishes timestamp syntax and cross-artifact equality, but does not establish that the claimed generation is temporally possible relative to the observation clock. A mutually consistent future generation is therefore treated as current authority.

## F2 — Fault-Class Expansion

Temporal boundary; authority integrity; clock skew/rollback; fault masking. Expanded cases include all-artifact future timestamps, one-artifact future timestamps, browser clock rollback, workflow clock skew, future timestamps around DST/open/close boundaries, and recovery after the clock becomes coherent again.

## F3 — Invariant Promotion

**No operational artifact generation used for a user-facing action may occur after the observation time. Cross-artifact agreement is necessary but not sufficient; generation chronology must also be possible. Impossible future authority yields `CHECK_DATA`.**

## F4 — Coverage Expansion

Audit 8 permanent regression must independently mutate all generation fields into the future and verify `CHECK_DATA`. Audit 9 must inject clock rollback/forward jumps before and after fetch, reload, execution-open transitions, and recovery.

## F5 — Next-Audit Mutation

Audit 9 sequences must include coherent future generations, single-artifact future generation, browser clock rollback, and restoration, proving that no unsafe action survives the invalid interval or cache recovery.

---

# A8-M05 — Explicit Execution Date Is Not Bound to the First Legal Execution Open

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: Signal date `2026-08-26`; normal first legal NYSE open was `2026-08-27`; the artifact was mutated to explicit `executionDate=2026-08-28`.

Expected: `CHECK_DATA`.
Observed: **INCREASE**.

## F1 — Root Cause

The primary action boundary trusts an explicit execution date as long as that date itself is an upcoming NYSE session. It does not prove that the explicit date equals the earliest legal open implied by the signal date and signal availability time. A corrupted or delayed action date can therefore remain actionable.

## F2 — Fault-Class Expansion

Execution timing; temporal discontinuity; contract divergence; fault masking. Expanded cases include one-day delay, multi-day delay, holiday/weekend roll, generation after theoretical t+1 open, already-passed open, malformed date, and explicit date earlier than legal availability.

## F3 — Invariant Promotion

**Every explicit user-facing execution date must equal the earliest legal NYSE open justified by the signal date and the time at which that signal became available. An earlier or arbitrarily later date is contradictory authority and yields `CHECK_DATA`.**

## F4 — Coverage Expansion

Permanent regression must cover ordinary t+1, holiday/weekend roll, late-discovered signal shifting to the next still-available legal open, arbitrary future delay, and retroactive earlier execution.

## F5 — Next-Audit Mutation

Audit 9 must mutate execution dates across close/open boundaries and provider delays, including repeated reloads before/after the intended open, and prove that a missed open is never silently replaced by an arbitrary later trade date.

---

# A8-M06 — Untagged or Partially Tagged Local Holdings Can Survive a Production Strategy-Version Change

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: active Production authority changed to TQQQ / Volatility Shield 12% / `VS12-v1.0`, while browser-local holdings contained only `ratio=50` and no identity tags.

Expected: `REENTER_HOLDINGS`.
Observed: **INCREASE** using the unproven legacy holding ratio.

The first assertion failed before the same test could exercise the ticker-only/missing-version branch; that branch is included in the expanded family and must be independently covered after remediation.

## F1 — Root Cause

The product boundary treats missing holdings ticker as matching any TQQQ operational identity. If ticker is present, a missing version is also accepted. This backward-compatibility shortcut is unsafe once active Production can change strategy versions while retaining the same ticker.

## F2 — Fault-Class Expansion

Local-state/cache identity; Production transition; cross-version contamination; stale device state. Expanded cases include no tags, ticker-only, version-only, old version, old ticker, A→B→A, browser restore, multiple devices, and DECISION-with-incumbent transitions.

## F3 — Invariant Promotion

**When an approved Production incumbent is active, a browser-local holdings ratio may influence action only if its ticker and strategy-version tags both exactly match the active operational identity. Missing or mismatched identity requires `REENTER_HOLDINGS` before any exposure comparison.**

## F4 — Coverage Expansion

Permanent Audit 8 tests must independently cover no tags, ticker-only, version-only, wrong version, wrong ticker, matching identity, Research baseline compatibility, and DECISION retaining an approved incumbent.

## F5 — Next-Audit Mutation

Audit 9 must mutate localStorage across Production A→B→A, reload, stale tab restoration, and multi-device-like state snapshots, proving old holdings are never reused without exact active identity.

---

# A8-M07 — Prefix-Truncated Forward History Can Still Act as Trading Authority

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: a previously valid authoritative Forward ledger had its first record removed while preserving valid schema, freezes, remaining canonical order, and generation metadata.

Expected: `CHECK_DATA`.
Observed: **INCREASE**.

## F1 — Root Cause

The full-ledger validator proves local structure of records that are present, but does not prove completeness from each frozen strategy's immutable start through the last recorded session. A truncated prefix can therefore remain structurally valid.

## F2 — Fault-Class Expansion

Append-only completeness; partial persistence; truncation; immutable-anchor loss; cache/publish corruption. Expanded cases include first-record loss, multi-record prefix loss, middle-session loss, one-version-only truncation, post-write partial file, and recovery from a previously complete ledger.

## F3 — Invariant Promotion

**An append-only Forward artifact participating in action authority must prove contiguous expected NYSE-session coverage from its immutable frozen start through its last observation for every series that has begun. Structural validity of only the surviving suffix is insufficient.**

## F4 — Coverage Expansion

Permanent regression must cover prefix, middle, and per-version omissions while preserving otherwise valid metadata/order. Empty pre-start ledgers remain valid; once a series has begun, missing historical sessions must fail closed.

## F5 — Next-Audit Mutation

Audit 9 must inject partial persistence/truncation before UI fetch, between generation and publication, after cache hydration, and during recovery. The page must never reuse a previously derived unsafe action from the truncated artifact.

---

# A8-M08 — Forward Record Chronology May Contradict the Ledger Generation

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: a Forward record `recordedAt` was set to `2030-01-02T21:00:00Z` while the ledger `updatedAt` and current operational generation remained in 2026.

Expected: `CHECK_DATA`.
Observed: **INCREASE**.

## F1 — Root Cause

Forward integrity checks require only that each `recordedAt` is parseable. They do not require a record observation to be no later than the ledger's own generation/update time. An internally impossible chronology can therefore pass full-ledger validation.

## F2 — Fault-Class Expansion

Temporal chronology; append-only integrity; clock skew; partial/corrupt persistence. Expanded cases include future record timestamps, record after ledger update, future corrections, equal-boundary timestamps, and recovery after a corrupted timestamp is removed by a new valid artifact.

## F3 — Invariant Promotion

**Every persisted Forward observation must be temporally possible within its containing artifact: `recordedAt <= ledger.updatedAt`, and an operationally authoritative ledger generation must itself not be in the future relative to observation time.**

## F4 — Coverage Expansion

Permanent regression must cover record-before/equal/after updatedAt, malformed timestamps, future generation, and mixed valid/invalid histories.

## F5 — Next-Audit Mutation

Audit 9 must inject per-record clock jumps, partial-write timestamp corruption, and recovery while asserting no risk-changing action can be cached or retained through an impossible chronology.

---

# A8-M09 — Missing Nested Daily Signal Is Silently Presented as HOLD

Classification: **MATERIAL / DYNAMICALLY CONFIRMED**

Observed fixture: the Daily Signal wrapper and all top-level authority fields were present, but the nested operational `signal` payload was absent.

Expected: `CHECK_DATA`.
Observed: **HOLD** (`変更なし`).

Although HOLD is non-risk-changing, this is material because it falsely represents absence of operational decision data as an affirmative valid no-change decision. The charter requires missing/malformed authority to be visibly fail-closed, not silently defaulted.

## F1 — Root Cause

Missing nested signal defaults target to zero, leaves numeric-validation false, and makes `signalChange=false`. Once top-level authority passes, control reaches the ordinary HOLD branch instead of treating the operational payload as missing authority.

## F2 — Fault-Class Expansion

Data completeness; silent default; UI action semantics; partial JSON/cache fetch. Expanded cases include missing nested signal, null signal, partial signal fields, empty object, missing date/target/previousTarget, and wrapper-new/payload-old combinations.

## F3 — Invariant Promotion

**A valid primary action requires a complete operational signal payload. Absence or semantic incompleteness of that payload is `CHECK_DATA`; it may never be translated into HOLD, TARGET_ONLY, or another ordinary operational state.**

## F4 — Coverage Expansion

Permanent regression must exercise absent/null/partial nested payloads and require exact `CHECK_DATA`, including combinations with holdings missing, expired opens, and coherent top-level generations.

## F5 — Next-Audit Mutation

Audit 9 must inject partial JSON publication/fetch, wrapper-before-payload cache states, reload ordering, and recovery, proving that no false HOLD remains after authority becomes incomplete or later recovers.

---

## Required remediation gate

Remediation may begin only after this record and must not alter Audit 8's frozen charter or independent expected-value oracle.

Required properties:
1. reject operational generations later than observation time;
2. prove explicit execution date equals the earliest legal open justified by signal date and signal availability time;
3. require exact ticker+version holdings identity whenever an approved Production incumbent is active;
4. prove Forward session-history completeness after each frozen series has begun;
5. enforce Forward record chronology against ledger generation;
6. treat missing/partial nested Daily signal as `CHECK_DATA`;
7. permanently register Wave 2 independent tests after remediation;
8. run Wave 1 + Wave 2 independent regressions, full core, full ops, Pages build, authoritative-state no-mutation, and exact-head persistence guards;
9. perform no Production promotion, strategy retuning, or append-only history rewrite.

After remediation, Audit 8 remains permanently NOT CLEAN and the remaining independent scope must continue.