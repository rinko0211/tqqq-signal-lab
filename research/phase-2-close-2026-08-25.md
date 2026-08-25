# Phase 2 Close Report — Robustness Validation

Closed: 2026-08-25 JST

Evidence sources:
- Phase 2A artifact: `phase-2a-core.json`
- Phase 2B artifact: `phase-2b-stress.json`

Status: **PHASE 2 COMPLETE / CLOSED**

## Scope and evidence status

Phase 2 evaluated the four pre-registered Core ETFs:
- TQQQ
- QLD
- UPRO
- SSO

Strategy families were frozen before Phase 2 calculation:
- `VS13_FIXED`
- `VS13_LEVERAGE_SCALED_STOP`
- `SIMPLE_200DMA` benchmark
- `VS13_VOL30` risk-normalized comparator

No Native tuning, no post-result stop search, no automatic Forward enrollment and no Production promotion were allowed.

The historical dataset has already been inspected in earlier research. Therefore the `2020-01-02` fixed-OOS window is a retrospective robustness partition, **not a pristine untouched holdout**. Independent Forward evidence remains the decisive promotion evidence.

## Primary OOS comparison

For the 3x ETFs, `VS13_FIXED` and `VS13_LEVERAGE_SCALED_STOP` are identical because the mechanical scaling formula leaves the stop at 13%.

For 2x ETFs, the pre-registered scaled stop is `13% × 2/3 = 8.67%`.

| Primary candidate | OOS CAGR | Max DD | Sharpe | Sortino | Calmar | Action Days/yr | Stability floor |
|---|---:|---:|---:|---:|---:|---:|---:|
| TQQQ — VS13 Fixed | 27.33% | -38.16% | 0.832 | 1.220 | 0.716 | 11.17 | 0.925 |
| QLD — VS13 Leverage-Scaled Stop | 20.51% | -27.05% | 0.868 | 1.282 | 0.758 | 11.17 | 1.000 |
| UPRO — VS13 Fixed | 23.85% | -37.05% | 0.862 | 1.312 | 0.644 | 8.61 | 0.877 |
| SSO — VS13 Leverage-Scaled Stop | 16.97% | -26.10% | 0.882 | 1.342 | 0.650 | 8.61 | 0.817 |

## Central finding

The clean leverage pairs now show a stable Pareto trade-off rather than simple 3x dominance.

### Nasdaq-100

TQQQ keeps the higher growth rate:
- TQQQ CAGR: 27.33%
- QLD scaled CAGR: 20.51%

QLD scaled materially lowers path risk:
- TQQQ Max DD: -38.16%
- QLD scaled Max DD: -27.05%

In this retrospective OOS partition, QLD scaled is slightly better on all three reported risk-adjusted metrics:
- Sharpe: 0.868 vs 0.832
- Sortino: 1.282 vs 1.220
- Calmar: 0.758 vs 0.716

Interpretation: **TQQQ is the higher-growth point; QLD scaled is the lower-drawdown / slightly stronger risk-adjusted point. Neither dominates the other.**

### S&P 500

UPRO keeps the higher growth rate:
- UPRO CAGR: 23.85%
- SSO scaled CAGR: 16.97%

SSO scaled materially lowers path risk:
- UPRO Max DD: -37.05%
- SSO scaled Max DD: -26.10%

Risk-adjusted metrics are extremely close, with SSO scaled slightly higher in this partition:
- Sharpe: 0.882 vs 0.862
- Sortino: 1.342 vs 1.312
- Calmar: 0.650 vs 0.644

Interpretation: **the S&P leverage pair also forms a growth-vs-drawdown frontier rather than a single universal winner.**

## Why the scaled 2x stop survives

QLD fixed-13% OOS metrics were materially weaker:
- CAGR 12.70%
- Max DD -28.34%
- Calmar 0.448

QLD with the mechanical 8.67% stop improved to:
- CAGR 20.51%
- Max DD -27.05%
- Calmar 0.758

SSO fixed-13% OOS metrics:
- CAGR 15.09%
- Max DD -28.70%
- Calmar 0.526

SSO with the mechanical 8.67% stop improved to:
- CAGR 16.97%
- Max DD -26.10%
- Calmar 0.650

The 8.67% level was not fitted from historical optimization; it follows the pre-registered leverage-equivalent rule. Phase 2 therefore carries the scaled-stop 2x variants forward and retires the fixed-13% 2x variants from the primary candidate set.

## Parameter-neighborhood fragility check

The neighborhood values were diagnostic only; no best neighbor may replace the baseline.

- TQQQ fixed: stability floor 0.925
- QLD scaled: stability floor 1.000
- UPRO fixed: stability floor 0.877
- SSO scaled: stability floor 0.817

All exceed the pre-registered 0.70 floor.

Notably, QLD scaled did not sit on a sharp isolated optimum: its ±10% stop neighborhood remained at least as strong as the baseline Calmar in this diagnostic. This supports robustness but does **not** authorize selecting a different stop.

## Transaction-cost stress

OOS CAGR at 25 bps / 50 bps total one-way cost:

| Candidate | Base 8bps | 25bps | 50bps |
|---|---:|---:|---:|
| TQQQ Fixed | 27.33% | 25.81% | 23.62% |
| QLD Scaled | 20.51% | 19.05% | 16.94% |
| UPRO Fixed | 23.85% | 22.75% | 21.13% |
| SSO Scaled | 16.97% | 15.88% | 14.39% |

All remain positive and economically meaningful under severe cost assumptions.

## Execution-delay stress

At t+3 open execution:

| Candidate | t+1 CAGR | t+3 CAGR | t+3 Max DD |
|---|---:|---:|---:|
| TQQQ Fixed | 27.33% | 22.89% | -34.10% |
| QLD Scaled | 20.51% | 16.54% | -23.80% |
| UPRO Fixed | 23.85% | 20.81% | -36.83% |
| SSO Scaled | 16.97% | 14.63% | -26.02% |

All remain positive through t+3. Delay sensitivity exists, especially for Nasdaq, but no candidate collapses under the pre-registered execution-delay test.

## Operational constraint

All primary candidates remain far below the production hard cap of 40 Action Days/year:
- TQQQ: 11.17
- QLD scaled: 11.17
- UPRO: 8.61
- SSO scaled: 8.61

This is consistent with the low-maintenance operating objective.

## Regime diagnostics

No candidate avoided losses in every stress regime. This is expected and is preferable to claiming a false crash hedge.

Examples:
- 2022 bear period remained negative for all four primary candidates.
- 2x scaled candidates generally reduced loss magnitude relative to 3x counterparts.
- 3x candidates captured materially more upside in strong bull periods.

The system should therefore continue to treat Cash / risk reduction as a regime tool rather than assuming the tactical rule removes all bear-market loss.

## Benchmark observations

`SIMPLE_200DMA` produced very high Nasdaq CAGR in this historical period but with much larger drawdowns (TQQQ OOS Max DD about -57.8%). It remains a low-complexity benchmark, not a promotion candidate.

`VS13_VOL30` materially reduced volatility/drawdown but generally sacrificed too much growth on the 2x products. It remains a defensive comparator, not the main leverage-selection rule.

## Phase 2 decision

### Advance as primary research candidates

1. **TQQQ × VS13_FIXED**
   - Higher-growth Nasdaq candidate.

2. **QLD × VS13_LEVERAGE_SCALED_STOP**
   - Lower-drawdown Nasdaq candidate with slightly stronger retrospective OOS risk-adjusted metrics.

3. **UPRO × VS13_FIXED**
   - Higher-growth S&P 500 candidate.

4. **SSO × VS13_LEVERAGE_SCALED_STOP**
   - Lower-drawdown S&P 500 candidate with roughly comparable/slightly stronger retrospective OOS risk-adjusted metrics.

### Retire from the primary branch

- QLD × fixed 13% stop
- SSO × fixed 13% stop

Reason: the leverage-scaled variants dominate them sufficiently under the pre-registered hypothesis and robustness checks.

### Keep as benchmarks only

- SIMPLE_200DMA
- VS13_VOL30

## What Phase 2 does NOT prove

Phase 2 does not prove that:
- 2x is superior to 3x in the future;
- 3x is superior to 2x in the future;
- the scaled stop is the optimal stop;
- one underlying is permanently superior;
- historical OOS results justify Production switching.

The correct conclusion is that **2x and 3x represent different robust points on a growth/drawdown frontier**. This is precisely the information needed before Native research and later hierarchical allocation.

## Gate to next phase

Phase 3 may perform bounded Native research only on survivors. To control multiplicity:
- no more than 2–4 economically defensible Native families per underlying;
- at most one Native challenger per underlying/leverage branch;
- no dense grid search;
- all hypotheses written before testing;
- existing four primary common candidates remain frozen reference systems;
- no Forward backfill and no automatic Production promotion.

A later hierarchical allocator may test whether regime-dependent choice between 2x and 3x is useful, but that is a separate hypothesis and must not be inferred automatically from the retrospective Phase 2 ranking.

## Production protection

Production Champion: unchanged.
Existing Forward ledgers: unchanged.
Daily signal workflows: unchanged.
Automatic promotion: prohibited.
