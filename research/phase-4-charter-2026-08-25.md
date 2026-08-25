# Phase 4 Charter — Hierarchical Winner + Cash Allocation

Registered before Phase 4 calculation: 2026-08-25 JST

## Purpose

Test whether the reduced Phase 2/3 candidate set creates additional value when combined into one low-maintenance portfolio that holds at most one risk ETF plus Cash.

Phase 4 must separate two sources of value:

- **Phase 4A — Common Allocator:** asset/leverage selection value using only Phase 2 Common systems.
- **Phase 4B — Native-Enhanced Allocator:** the identical allocator, with only the S&P 500 signal logic replaced by the Phase 3 `SP_BROAD_TREND` Native candidate.

`Phase 4B - Phase 4A` is the attribution for the Phase 3 Native layer. No other allocator rule may differ between A and B.

## Frozen candidate systems

### Nasdaq-100
- TQQQ 3x: VS13 Common, 13% stop.
- QLD 2x: VS13 Common, leverage-scaled stop = 13% × 2/3 = 8.67%.

Phase 3 found no Nasdaq Native candidate, so these remain unchanged in both 4A and 4B.

### S&P 500 — Phase 4A
- UPRO 3x: VS13 Common, 13% stop.
- SSO 2x: VS13 Common, leverage-scaled stop = 8.67%.

### S&P 500 — Phase 4B
- UPRO 3x: `SP_BROAD_TREND`, 13% stop.
- SSO 2x: `SP_BROAD_TREND`, leverage-scaled stop = 8.67%.

No ticker-specific retuning is allowed.

## Single pre-registered allocator

There is only one allocator rule. Phase 4 will not run multiple competing allocator families.

### Step 1 — Build each underlying's preferred leverage candidate

At each close, determine the desired leverage separately for Nasdaq-100 and S&P 500 from the underlying's own volatility environment:

- prefer **3x** only when both:
  - VIX < 22, and
  - 20-day annualized realized volatility of the underlying proxy < 25%.
- otherwise prefer **2x**.

This is a hypothesis-level risk-budget rule, not an optimized threshold. The 3x → 2x de-risking transition does not require persistence. The 2x → 3x re-risking transition requires three consecutive qualifying closes.

### Step 2 — Risk-on eligibility

For each underlying, inspect the frozen strategy target of its currently preferred leverage candidate.

- target > 0 => underlying is eligible for risk-on allocation.
- target = 0 => underlying is ineligible.

If no underlying is eligible, target Cash immediately.

### Step 3 — Choose the winning underlying

If both are eligible, compare 63-trading-day total return of QQQ versus SPY.

- a challenger underlying must exceed the currently selected underlying by at least **3 percentage points** in 63-day return;
- the superiority must persist for **3 consecutive closes** before switching underlying;
- if the current underlying becomes ineligible, it may be dropped immediately and the other eligible underlying may be selected without waiting for the normal switch confirmation;
- if starting from Cash with eligible assets, select the stronger eligible underlying immediately.

The 3-point margin and 3-day confirmation are pre-registered anti-churn rules, not fitted values.

### Step 4 — Target portfolio weight

Use the selected frozen system's own discrete target directly:

- 0 / 25 / 50 / 75 / 100% risk ETF
- remaining weight = Cash

No new allocation grid is optimized in Phase 4.

### Step 5 — Execution and Action Days

- Signal is determined from information available at trading day `t` close.
- Base execution is at `t+1` open.
- One day on which any portfolio target changes = one **Action Day**, even if an ETF-to-ETF switch requires two broker orders.
- Track Action Days and broker Orders separately.
- Emergency transition to Cash is not delayed to satisfy turnover constraints.

## Validation

Primary evaluation begins 2020-01-02 to remain consistent with Phase 2/3 robustness views. Also report the common-history diagnostic from 2016-08-24 when available.

For Phase 4A and 4B report:
- CAGR / Total Return
- Max DD / Ulcer Index / recovery where available
- Sharpe / Sortino / Calmar
- exposure / cash time
- Action Days/year
- broker Orders/year
- maximum Action Days in any calendar year
- number of underlying switches
- number of leverage switches
- percentage of risk-on days allocated to each ticker
- fixed regime diagnostics: COVID, 2022 bear, 2023-2024 bull
- 25 bps cost stress
- t+2-open execution-delay stress

## Comparator set

Keep these fixed single-system comparators visible:
- TQQQ Common
- QLD Common
- UPRO Common
- SSO Common
- UPRO `SP_BROAD_TREND`
- SSO `SP_BROAD_TREND`

Do not claim allocator value merely because it beats a weak comparator. Phase 4A must be compared with the strongest relevant Common single-system frontier; Phase 4B must be compared with both Phase 4A and the Native S&P candidates.

## Hard gates

A hierarchical allocator is operationally admissible only if:
- CAGR > 0
- Calmar > 0
- 25 bps stress CAGR > 0
- t+2 delay CAGR > 0
- Action Days/year <= 40
- every calendar year's Action Days <= 40, except an explicitly documented emergency anomaly
- no look-ahead or synthetic return mixing

Preferred operating range remains approximately 12–24 Action Days/year. Values below 12 are acceptable if the strategy is otherwise robust; values above 24 require material benefit and values above 40 normally reject Production use.

## Material-value interpretation

Phase 4 is not required to beat every single-system CAGR. A Winner + Cash allocator may be valuable if it creates a better robust frontier. Material value should be judged by Pareto behavior across:
- CAGR
- Max DD
- Calmar / Sortino
- Action Days
- simplicity

For 4B specifically, Native enhancement should be considered useful only if it improves 4A materially without adding operational burden or fragility.

## Anti-overfitting controls

- One allocator only; no best-of-many selection.
- No post-result tuning of VIX 22, realized-volatility 25%, 63-day momentum, 3-point switching margin, or 3-day confirmation.
- If a rule looks poor, record the failure; do not rescue it in Phase 4 under a new threshold.
- Any threshold-neighborhood analysis performed later is fragility diagnosis only and cannot redefine this version.
- Phase 4 uses historically inspected data and is not pristine confirmatory evidence.
- No automatic Forward enrollment or Production promotion.

## Output

Phase 4 must end with:
1. Phase 4A result.
2. Phase 4B result.
3. explicit `4B - 4A` attribution.
4. single-system comparator table.
5. Action Day / broker-order accounting.
6. regime and stress diagnostics.
7. rejected/failed interpretation if either allocator does not clear hard gates.
8. frozen candidate version name only if worthy of future Forward Gate consideration.

Existing Production, Forward ledgers, daily workflows, and Champion remain unchanged throughout Phase 4.
