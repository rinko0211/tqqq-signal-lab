# Executive Final Review — Phase 2: Data, Calculations & Control Thresholds

Date: 2026-08-26
Role: independent final approver / supervisory review
Mode: audit-first; strategy parameters remain frozen
Status: **REMEDIATION REQUIRED BEFORE PRODUCTION**

## Scope
Audit the data sources, split/dividend semantics, common-date construction, t-close → next-open causality, cost conventions, Action-Day definitions, Review thresholds, Forward evidence rules, and the meaning of reported performance.

## Positive findings

### 1. Core historical execution ordering is causally correct
`runBacktest()` applies:
1. prior close → current open using the old exposure;
2. turnover cost at the current open;
3. current open → close using the new exposure.

This is consistent with `t close → t+1 open` and no same-close execution defect was found.

### 2. Common-date construction is conservative
The research/Forward datasets intersect leveraged ETF, underlying/proxy, SPY and VIX dates before calculation. Non-common dates are excluded rather than forward-filled into signals.

### 3. Phase 5 missed signals are not reconstructed as LIVE
When multiple historical bars appear after a missed run, older unobserved days are stored as observation-only backfill. They do not receive hindsight-generated LIVE signals.

### 4. Action Days are explicitly distinct from executions in the Phase 5 lifecycle gate
The latest lifecycle implementation uses the distinct set of execution record dates for Phase 5 `actionDays`, and annualizes this value for the <=40 Action Days/year hard cap.

### 5. Cost arithmetic is not double-counting slippage
The backtest/Forward exposure accounting subtracts the 3bps commission + 5bps slippage convention as turnover cost. The displayed slippage-adjusted execution price is informational rather than being used again for return accrual.

## Findings by severity

### MAJOR 1 — Corporate-action / split continuity is not robust for append-only Forward ledgers
The external historical provider may rewrite earlier prices after a split. That is compatible with a fresh historical backtest, but an append-only Forward ledger preserves the price that was actually observed before the split.

Current Forward logic carries prior equity across sessions using:
`current open / previous stored assetClose`.

If a 2:1 split occurs between those records, a stored pre-split close can be compared with a post-split open and create an artificial loss near 50%, despite no economic loss to the shareholder.

ProShares explicitly states that a forward split changes share count and per-share price proportionally without changing investment value. TQQQ/UPRO/SSO and QLD have all had historical share splits.

Current Paper code contains a heuristic `splitFactor`, but the live generator's split detection is not a sufficient corporate-action ledger protocol and Phase 5 Forward has no equivalent formal adjustment.

**Required remediation before Production:** add a shared corporate-action continuity layer for Daily / existing Forward / Phase 5 / Paper. The solution must preserve old append-only records and adjust only the transition calculation / virtual share count using a verifiable split factor. It must be tested with 2:1, 3:1, reverse split, no-split gap, and provider-back-adjustment scenarios.

### MAJOR 2 — “Multiple regimes” gate is semantically weaker than the charter
The Phase 5 charter requires multiple market regimes rather than one uninterrupted bull trend.

Current code counts unique signal labels and requires `>=3` labels for new candidates. A path containing only:
- 強い上昇
- 弱い上昇
- レンジ

could satisfy the numeric count without a genuine risk-off / high-volatility episode.

The incumbent also uses a different minimum (`>=4`) from the challengers (`>=3`), making the comparison asymmetric.

**Required remediation before Formal Review:** replace raw string-count gating with preregistered semantic regime families applied identically to incumbent and challengers. The rule must make uninterrupted risk-on history insufficient. This is a governance correction, not strategy retuning.

### MAJOR 3 — Lifecycle eligibility does not yet measure Promotion merit versus the incumbent
Current Formal/Stronger lifecycle logic checks operational evidence, missingness, turnover, DD and integrity, but does not compare candidate Forward performance against incumbent TQQQ.

Therefore a materially underperforming candidate could become `PHASE6_ELIGIBLE` merely because it remained operationally valid.

The Phase 5 charter instead requires Phase 6 comparative selection using Pareto evidence, with Forward robustness and integrity outranking historical CAGR.

**Required remediation before Formal Review:** explicitly separate:
- `OPERATIONALLY_ELIGIBLE_FOR_REVIEW`, and
- `PROMOTION_MERIT` / Pareto comparison.

At Phase 6 the UI must compare at minimum Forward total return, Max DD, current DD, Sortino/Calmar where sample size is adequate, Action Days, missingness, execution count, regime coverage and implementation integrity versus the incumbent. Human approval remains mandatory; no scalar auto-winner should be created.

### MAJOR 4 — Upstream status freshness is not enforced inside lifecycle health logic
The Lifecycle workflow itself can run every day. However, the current candidate/Production health checks largely test whether the stored Daily/Phase5 status says `success`, not whether that success is recent enough relative to expected market sessions.

If Daily/Phase5 stopped while Lifecycle continued, a newly generated Lifecycle JSON could repeatedly consume an old successful upstream status. The existing 48-hour Lifecycle-JSON stale UI guard would not detect this because the Lifecycle file itself would remain fresh.

**Required remediation:** introduce a shared NYSE-session-aware freshness check for upstream Daily and Phase 5 status. A stale upstream feed must force data/integrity review and must block Production approval.

### MAJOR 5 — Earliest legal execution date can name a market holiday in one delayed-data branch
`nextExecutionDate()` correctly knows NYSE holidays. But `earliestLegalExecutionDate()` can return `localDate` directly when the signal was first observed after its theoretical date and before 09:30 ET, provided only that `localDate` is a weekday.

If that weekday is an NYSE holiday, the ledger executor conservatively waits for a real subsequent dataset bar, so accounting does not retroactively trade. However, the user-facing `executionDate` can temporarily name a day on which no core open exists.

**Required remediation:** share one NYSE-session calendar primitive and require the returned legal execution date itself to be an actual scheduled market session. UI and ledger must use the same function.

## Control-threshold review

### 252 LIVE observations
**Acceptable.**
Treat as a minimum operational-year sample, not a statistical proof of superiority. A formal calendar date alone cannot substitute for sufficient true LIVE observations.

### >=6 non-zero-turnover executions
**Acceptable only as a minimum operational-exercise condition.**
Six executions are not enough to establish statistical superiority in a low-frequency system. They must never be described as such. Promotion merit must be evaluated through the broader Forward Pareto review and, when necessary, Forward should continue.

### Missing/invalid <=1%
**Reasonable operational tolerance.**
Missing signals remain penalized rather than silently reconstructed. The ratio should continue to use all expected Forward observation rows.

### <=40 Action Days/year
**Acceptable hard cap.**
This is a rejection boundary, not the desired operating frequency. The expected frontier remains approximately 8–11 Action Days/year historically; materially higher realized frequency should be visible even before 40 is breached.

### Historical Max DD minus another 10 percentage points
**Acceptable only as a hard revalidation trigger.**
The 10-point allowance is not a theoretically derived acceptable-DD target and should not be used to claim Production quality. It is a fail-safe threshold meaning “the Forward drawdown is materially outside the frozen historical baseline; stop and revalidate.”

### 48-hour Lifecycle approval freshness
**Acceptable for the Lifecycle judgment itself.**
This was separately hardened at the approval-script layer. It does not replace the required upstream market-data/status freshness check described above.

## Data-return semantics and model limitations

### Price return, not total return
The official-data adapter sets `adjClose = close` for the Nasdaq Historical feed. The project explicitly warns that dividend reinvestment is not represented. Therefore Buy & Hold and strategy metrics are price-return comparisons, not total-return comparisons.

### Split-adjustment semantics are not a sufficient operational contract
Current historical series appear consistent with split-adjusted history, and public historical displays around known TQQQ splits show continuity after adjustment. But Forward cannot depend on a provider's future retroactive rewrite semantics. Corporate actions must be handled explicitly at the immutable-ledger boundary.

### Cash return = 0%
This is a frozen comparison convention, not a forecast of real cash yield.

### FX excluded
`JPY-normalized` means the initial number is expressed like JPY but the return path is effectively the USD ETF price-return path. USD/JPY return is excluded.

### Taxes and broker-specific friction excluded
The 8bps execution model is a model assumption. It is not evidence of realized Japanese taxable-account results, FX conversion cost, or future broker slippage. Historical 25/50bps stress gives useful robustness context but does not remove this limitation.

**UI/Phase 6 requirement:** never label modeled Forward/Paper CAGR as guaranteed or actual after-tax JPY account performance.

## External specification checks
- ProShares states leveraged ETFs target a multiple of a benchmark for a single day; multi-day returns can differ because of compounding.
- ProShares publishes split history and has documented forward splits where investment value is unchanged while share count and per-share price change proportionally.
- NYSE's official 2026–2028 calendar confirms a 09:30 ET core open and explicit holiday closures, supporting use of an exchange-session-aware execution calendar.

## Supervisory decision
**REMEDIATION REQUIRED BEFORE PRODUCTION.**

Phase 5 may continue accumulating untouched Forward evidence because none of the identified issues requires rewriting existing strategy rules or historical records. However, no candidate should be allowed to pass a future Production decision until the five Major control issues above are corrected and regression-tested.

## Next phase
Phase 3 of the executive review will audit the full lifecycle state machine and will implement only the control-plane remediations necessary to remove dead-ends / unsafe transitions:
1. corporate-action continuity,
2. semantic regime coverage,
3. operational eligibility vs Promotion merit separation,
4. upstream freshness enforcement,
5. exchange-session-safe execution dates.

No strategy weights, thresholds, stops or historical research results will be changed.
