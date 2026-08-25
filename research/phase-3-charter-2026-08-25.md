# Phase 3 Charter — Bounded Native Strategy Research

Registered before Phase 3 calculation: 2026-08-25 JST

## Purpose

Test whether an economically motivated underlying-specific strategy family adds material value beyond the strong Phase 2 Common baseline. Native research is optional: `NO NATIVE CANDIDATE` is a valid and preferred result when improvement is weak or fragile.

## Incumbent baselines frozen from Phase 2

- TQQQ: VS13 Fixed, 13% stop
- QLD: VS13 with leverage-scaled stop = 13% × 2/3 = 8.67%
- UPRO: VS13 Fixed, 13% stop
- SSO: VS13 with leverage-scaled stop = 8.67%

The fixed-13% QLD/SSO variants are not eligible incumbents after Phase 2.

## Hard scope

Core tickers only:
- Nasdaq-100: TQQQ 3x, QLD 2x
- S&P 500: UPRO 3x, SSO 2x

No TECL/ROM/SOXL/USD/TNA branch in Phase 3 Core.
No inverse ETF.
No hierarchical allocator yet.
No Forward/Production promotion.

## Anti-overfitting structure

1. Native parameters are defined at the **underlying family level**, not independently per ticker.
2. TQQQ and QLD receive the same Nasdaq-specific weights/threshold family; UPRO and SSO receive the same S&P-specific family.
3. Leverage-specific stop difference is mechanical only: `13% × leverage / 3`.
4. No fine parameter grid, optimizer, random search, Bayesian search, ML search, or best-of-thousands sweep.
5. Maximum three Native families per underlying plus the frozen Common incumbent.
6. Neighborhood checks are fragility tests only and cannot change the registered parameter.
7. At most one Native candidate per ticker; zero is acceptable.

## Pre-registered Nasdaq-100 Native families

### NQ_MOMENTUM_TILT
Hypothesis: Nasdaq-100 exhibits stronger medium-term trend/momentum persistence than broad equities, so a moderate shift from volatility weight toward momentum can capture sustained growth regimes without abandoning the existing risk shield.

- weights: Trend 30%, Momentum 24%, Volatility 28%, Market 18%
- entry/exit/strong: unchanged VS13 thresholds 70 / 48 / 82
- confirm/minHold/cooldown: unchanged 2 / 6 / 8
- position mode: five-state
- stop: leverage-scaled mechanically

### NQ_TREND_CONFIRM
Hypothesis: requiring stronger trend confirmation can reduce Nasdaq whipsaw and crash re-entry risk.

- weights: Trend 40%, Momentum 25%, Volatility 20%, Market 15%
- entry/exit/strong: 70 / 48 / 82
- confirm/minHold/cooldown: 3 / 8 / 8
- position mode: five-state
- stop: leverage-scaled mechanically

### NQ_VOL_CONTROL
Hypothesis: Nasdaq leverage suffers disproportionately during volatility clustering, so a somewhat stronger volatility shield may improve geometric risk-adjusted returns.

- weights: Trend 27%, Momentum 15%, Volatility 42%, Market 16%
- entry/exit/strong: 70 / 48 / 82
- confirm/minHold/cooldown: 2 / 6 / 8
- position mode: five-state
- stop: leverage-scaled mechanically

## Pre-registered S&P 500 Native families

### SP_BROAD_TREND
Hypothesis: S&P 500 breadth and sector diversification make slower broad-market trend confirmation more informative than aggressive momentum chasing.

- weights: Trend 36%, Momentum 16%, Volatility 28%, Market 20%
- entry/exit/strong: 70 / 48 / 82
- confirm/minHold/cooldown: 3 / 8 / 8
- position mode: five-state
- stop: leverage-scaled mechanically

### SP_VOL_BALANCE
Hypothesis: broad-market leverage may benefit from moderately stronger volatility control while retaining enough trend participation.

- weights: Trend 30%, Momentum 14%, Volatility 36%, Market 20%
- entry/exit/strong: 70 / 48 / 82
- confirm/minHold/cooldown: 2 / 6 / 8
- position mode: five-state
- stop: leverage-scaled mechanically

### SP_SMOOTH_POSITION
Hypothesis: S&P 500's lower underlying volatility permits reducing allocation churn without sacrificing most of the common strategy edge.

- weights: unchanged VS13 27 / 16 / 37 / 20
- entry/exit/strong: 70 / 48 / 82
- confirm/minHold/cooldown: 3 / 10 / 10
- position mode: five-state
- stop: leverage-scaled mechanically

## Validation sample and stress

Use actual ETF OHLC only. Common research history starts 2016-08-24. Robustness/OOS view begins 2020-01-02, matching Phase 2.

For every incumbent and Native family report:
- CAGR / Total Return
- Max DD / Ulcer
- Sharpe / Sortino / Calmar
- exposure / cash time
- Action Days/year
- yearly behavior
- fixed regime diagnostics
- 25 bps execution-cost stress
- t+2 open execution-delay stress
- parameter-neighborhood fragility

## Neighborhood policy

Only small, symmetric hypothesis-preserving perturbations:
- family weight tilt magnitude approximately ±10% toward/away from the defining Native component, re-normalized
- confirmation/min-hold family: ±1 confirmation day and ±2 hold days, bounded to sensible integers
- incumbent stop: ±10% only as already used in Phase 2

Neighborhoods diagnose cliffs; they do not select a new parameter.

## Native promotion gate within Research

A Native family may be named `CANDIDATE` only if all of the following hold:

### Absolute robustness
- OOS CAGR > 0
- OOS Calmar > 0
- 25 bps stress CAGR > 0
- t+2 delay CAGR > 0
- Action Days/year <= 40
- parameter-neighborhood stability floor >= 0.75
- no impossible execution or data-quality failure

### No severe regression vs incumbent
- OOS CAGR >= 85% of incumbent
- OOS Calmar >= 90% of incumbent
- OOS Sortino >= 90% of incumbent
- Max DD no worse than incumbent by more than 3 percentage points

### Material value hurdle
At least one must hold:
- Calmar >= incumbent × 1.10; or
- Sortino >= incumbent × 1.08; or
- CAGR >= incumbent × 1.08 while Max DD is no worse by >3 percentage points; or
- Max DD improves by >=5 percentage points while CAGR remains >=90% of incumbent.

For the more complex risk-scaling family, prefer a stronger improvement margin; a tiny numerical win is insufficient.

If multiple Native families pass, select at most one per ticker by robustness-first ordering: material risk-adjusted improvement, drawdown, stability, CAGR, operational burden, simplicity. Do not choose by full-history CAGR alone.

## Interpretation

- A strong Common incumbent surviving Phase 3 unchanged is a successful result.
- Native value must be clearly larger than implementation and overfitting cost.
- Historical Phase 3 evidence is not pristine because earlier phases inspected the same market history. Any selected Native remains Research-only until an independently frozen Forward period supports it.

## Output

Phase 3 must produce:
- complete experiment registry including rejects
- one result per ticker: `NATIVE CANDIDATE` or `NO NATIVE CANDIDATE`
- explicit reasons for rejection
- no automatic Forward enrollment
- no Production changes
