# Phase 2 Charter — Robustness Validation

Registered before Phase 2 calculation: 2026-08-25 JST

## Purpose

Validate whether the four Core candidates from Phase 1 / 1.5 remain robust under chronology, cost, execution-delay and regime stress without introducing Native tuning or parameter mining.

Core tickers only:
- TQQQ
- QLD
- UPRO
- SSO

Pre-registered families only:
- VS13_FIXED
- VS13_LEVERAGE_SCALED_STOP
- SIMPLE_200DMA
- VS13_VOL30

No new strategy family may be added after results are observed in this phase.

## Evidence status

Historical data through 2026-08-24 has already been inspected in prior research. Phase 2 is therefore robustness evidence, not a pristine untouched holdout. Existing independent Forward tests remain the decisive future evidence for Production changes.

## Required tests

### 1. Chronological fixed OOS
- Common actual-ETF history only.
- Warm-up / in-sample segment precedes OOS chronologically.
- Fixed rules; no parameter fitting inside OOS.
- Primary OOS begins 2020-01-02 after using prior history only as indicator warm-up/context.

### 2. Rolling walk-forward stability
- Fixed-rule rolling evaluation, not strategy selection.
- Train/context window: prior 3 calendar years.
- Test window: next 1 calendar year.
- No parameter optimization from train results.
- Report yearly OOS CAGR/return, Max DD, Sharpe/Sortino/Calmar and Action Days where available.

### 3. Trading-cost stress
Total one-way turnover cost scenarios:
- 8 bps base
- 15 bps
- 25 bps
- 50 bps

A candidate should remain economically viable at 25 bps; 50 bps is an adverse stress, not a normal assumption.

### 4. Execution-delay stress
Signal remains based on t close.
Evaluate execution at:
- t+1 open (base)
- t+2 open
- t+3 open

No same-close execution.

### 5. Predefined regime / event windows
Use fixed historical windows for diagnostics only:
- 2018 Q4 correction: 2018-09-20 to 2018-12-31
- COVID shock/rebound: 2020-02-19 to 2020-06-30
- 2022 tightening/bear: 2022-01-03 to 2022-12-30
- 2023–2024 recovery/bull: 2023-01-03 to 2024-12-31

Do not create new event windows after seeing results.

### 6. Parameter / rule stability
No grid search. Use only small mechanical perturbations to test fragility:
- VS13 fixed stop: 13% baseline with ±10% relative perturbation (11.7%, 14.3%) for diagnostic stability only.
- Leverage-scaled stop: baseline `13% × leverage/3` with the same ±10% relative perturbation.
- VS13_VOL30: target vol 30% baseline with 27% and 33% diagnostic perturbations.
- SIMPLE_200DMA: 180 / 200 / 220 DMA diagnostic perturbation.

Perturbations cannot be used to choose a new production parameter in Phase 2. The question is whether nearby settings behave similarly.

## Operational constraint

- Production-oriented candidates must remain <=40 Action Days/year.
- Preferred operating region remains roughly 12–24 Action Days/year, but lower frequency is acceptable if performance/robustness is strong.
- Emergency exits may override normal turnover preferences.

## Phase 2 decision framework

Do not rank by CAGR alone. Evaluate:
1. chronological OOS stability
2. walk-forward consistency
3. Max DD / recovery behavior
4. Calmar / Sortino
5. cost and delay resilience
6. parameter-neighborhood stability
7. Action Days/year
8. implementation simplicity

Possible outcomes:
- CORE ROBUST: retain as full Phase 3 / later allocation candidate
- DEFENSIVE COMPARATOR: retain mainly as lower-drawdown benchmark / possible regime tool
- WATCH: mixed robustness; no promotion
- REJECT FOR CURRENT PIPELINE: fails robustness or operability

## Protection rules

- Existing Production Champion unchanged.
- Existing Forward ledgers unchanged and append-only.
- No automatic Forward enrollment.
- No automatic Production promotion.
- TECL / ROM remain outside Phase 2 Core branch.
