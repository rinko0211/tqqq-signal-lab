# Re-Audit 2 — Phase B: Data / Time / Price Semantics

Date: 2026-08-26
Round: second independent reliability re-audit
Status: **NOT CLEAN — MATERIAL FINDINGS REMEDIATED AND ACCEPTED**

## Scope
Re-audit data sourcing, exchange-session semantics, execution dates, provider revisions, missing-session accounting, corporate actions, Forward/Paper price meaning and comparative Forward alignment.

## New material findings

### B1 — Primary UI stale detection used calendar age rather than completed NYSE sessions
The primary signal UI relied on `freshness()` with a >4-calendar-day threshold. A stopped Daily workflow could therefore leave a Monday signal actionable on Thursday even though several NYSE sessions had completed.

Remediation:
- `engine.ts` freshness now uses the shared NYSE-session calendar;
- any completed NYSE session missing after the displayed market-data date marks the primary signal stale;
- stale data suppresses the normal trade instruction through the existing fail-closed UI path.

### B2 — Fully omitted required-series sessions were not counted in Forward missing ratio
Phase 5 and incumbent Forward summaries counted only rows that existed in the ledger. If one required market series was absent, the common-date intersection could drop an entire NYSE session and that missing session could disappear from the missing-rate denominator.

Remediation:
- added inclusive expected-NYSE-session counting;
- missing observations are now `expected sessions - valid live observations`;
- Phase 5 and incumbent evidence gates use expected-session denominators;
- Lifecycle missing ratio uses `live + missing`, not only rows that happened to exist.

### B3 — Incumbent catch-up execution metadata could record the wrong date
In existing `forward.ts`, catch-up economics used the processed day's open, but `execution.recordedDate` was set to the dataset's latest date. This could distort incumbent Action Days and later common-period comparison.

A related displayed execution-price direction test compared against the wrong prior exposure field.

Remediation:
- catch-up `recordedDate = day.date`;
- slippage direction compares target against the actual previous position.

Existing real ledgers were inspected and contain no `SCHEDULED_CATCHUP` execution requiring historical correction. No append-only record was rewritten.

### B4 — Pareto comparison could align unequal return intervals after a missing session
The prior comparator intersected record dates but reused each row's stored `dailyReturn`. If one ledger missed a session, its next row could represent a multi-session return while the other ledger's same-date row represented one session.

Remediation:
- Pareto evaluation uses only the consecutive clean common NYSE-session suffix after the latest missing session in either ledger;
- at least 63 consecutive clean common sessions are required before Promotion merit is evaluated;
- after a missing session, enough new clean evidence can restore comparison without rewriting earlier Forward history.

## Non-material finding — duplicated historical holiday helper
`engine.ts` retained an older NYSE holiday implementation that treated Juneteenth as a closure before NYSE first observed it in 2022. The main backtest return path executes over actual dataset rows, so this did not alter the historical return sequence itself; it affected helper/diagnostic date semantics.

Remediation:
- `engine.ts` now delegates execution-date calculation to the shared NYSE calendar;
- 2021-06-18 is explicitly regression-tested as an open session.

## Early-close treatment
The shared calendar currently models a standard 16:00 ET session completion rather than the 13:00 ET scheduled early-close clock. This is conservative for freshness: on an early-close day it can delay recognition that the session has completed by up to three hours rather than falsely authorizing stale data. Routine post-close runs occur later than both times. This is recorded as a non-material residual, not a reason to alter Forward history.

## Price / model semantics rechecked
- Nasdaq OHLC is used as price-return data; dividend-reinvested total return is not claimed.
- VIX is sourced separately from Cboe.
- FX, tax and broker-specific realized friction remain outside Forward model returns.
- Paper JPY values remain fixed-FX virtual-account values, not realized after-tax brokerage P/L.
- corporate-action continuity remains append-only and fail-closed for unverified split-like discontinuities.

## Acceptance evidence
### Remediation run
Run **32945247584**: SUCCESS after corrected Phase 5 start-date test.

### Authoritative read-only Phase B acceptance
Run **32945419813**
Head SHA: **ebdb7c35fc528a0fe981ef5e5049f9a29d17c2c4**
Conclusion: **SUCCESS**

Passed:
- permanent operational regression suite;
- Phase B missing-session/catch-up tests;
- session-aware freshness and historical holiday tests;
- clean-suffix Pareto tests;
- current incumbent and Phase 5 ledger assertions showing no historical catch-up record requiring correction;
- integrated Pages build.

## Audit-round implication
This phase found new material defects. Therefore the second re-audit round is **NOT CLEAN**, even though all identified issues were remediated.

Current final-reliability clean streak remains:

**0 / 2**

The remaining phases must still be completed because additional defects may exist and should be found now rather than deferred.

## Next phase
Phase C: independently re-audit the full state machine / Human Approval / Production transition, including atomicity, failure rollback, concurrent writers, incumbent retention, version change and stale-review cases.
