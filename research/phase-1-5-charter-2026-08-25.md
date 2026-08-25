# Phase 1.5 Charter — Leverage-Neutral Common Strategy Check

Registered before calculation: 2026-08-25 JST

## Question

Did QLD/SSO look weak in Phase 1 because 2x leverage is intrinsically inferior in this universe, or because the frozen VS13 framework is structurally better matched to 3x ETFs?

## Scope lock

Tickers only:
- TQQQ
- QLD
- UPRO
- SSO

Common evaluation period:
- 2016-08-24 onward, ending at the latest common available trading day.
- Actual ETF OHLC only; no synthetic leveraged history.

No Native tuning. No per-ticker parameter search. No post-result threshold adjustment. No Forward or Production promotion in Phase 1.5.

## Pre-registered common families

1. `VS13_FIXED`
   - Existing frozen Volatility Shield / VS13 configuration.
   - 13% fixed leveraged-ETF trailing stop.

2. `SIMPLE_200DMA`
   - Underlying index proxy above its 200-day simple moving average => 100% risk ETF.
   - Otherwise Cash.
   - Decision at t close; assumed execution at t+1 open.
   - 8 bps total one-way turnover cost assumption, matching the project base 3 bps commission + 5 bps slippage.
   - No VIX, score weights, stop optimization, or ticker-specific parameters.

3. `VS13_VOL30`
   - Existing VS13 signal framework with portfolio volatility targeting at 30% annualized target.
   - The 30% target is already present in the project research framework; it is not selected after observing Phase 1.5 results.

4. `VS13_LEVERAGE_SCALED_STOP`
   - Same VS13 framework, but fixed trailing stop is scaled mechanically by leverage:
     `stop = 13% × leverage / 3`.
   - 3x => 13.00%.
   - 2x => 8.67%.
   - This is a leverage-equivalent hypothesis, not a fitted stop.

## Evaluation

For every Ticker × Family pair report:
- CAGR
- Total Return
- Max DD
- Sharpe
- Sortino
- Calmar
- Ulcer Index
- annualized volatility
- exposure / time in cash where available
- Action Days/year

Primary diagnostic is not the single best backtest. It is whether the relative ranking of 2x vs 3x is stable across pre-registered common families.

## Interpretation gates

- If 3x dominates 2x across most/all common families on CAGR and risk-adjusted metrics while respecting <=40 Action Days/year, 2x becomes a defensive comparator rather than a co-equal main candidate.
- If a leverage-neutral family materially improves 2x Calmar/Sortino or produces comparable CAGR at meaningfully lower DD, 2x remains a full Phase 2 Core candidate.
- If results differ by underlying (Nasdaq-100 vs S&P 500), retain the interaction for Phase 2; do not generalize a universal leverage rule.

## Hard constraints

- Production operability: <=40 Action Days/year.
- Existing Production Champion and all existing Forward ledgers remain unchanged.
- No automatic strategy enrollment or promotion.
- Phase 1.5 is diagnostic evidence only and is already conditioned on Phase 1 observations; this contamination must be disclosed in the close report.
