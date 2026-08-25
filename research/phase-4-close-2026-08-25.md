# Phase 4 Close Report — Hierarchical Winner + Cash Allocation

Closed: 2026-08-25 JST

Source artifact:
- `github-pages/public/data/phase-4-hierarchical.json`

Phase 4 is CLOSED for the pre-registered allocator version.

## Design integrity

The Phase 4 charter was registered before the first successful real-data calculation.

The experiment used one allocator only:
- 4A = Phase 2 Common systems
- 4B = identical allocator, replacing only UPRO/SSO signal logic with Phase 3 `SP_BROAD_TREND`

Frozen allocator rules:
- 3x preferred only when VIX < 22 and underlying 20-day realized volatility < 25%
- 3x -> 2x de-risk immediately; 2x -> 3x requires 3 qualifying closes
- risk-on eligibility comes from the frozen candidate system target
- QQQ vs SPY 63-day relative momentum selects underlying
- challenger requires >=3 percentage-point advantage for 3 closes
- selected system's existing 0/25/50/75/100% target is used directly
- t close -> t+1 open base execution
- one risk ETF + Cash maximum
- ETF-to-ETF switch = one Action Day, normally two broker orders

No thresholds were changed after seeing the result.

## Main OOS result — 2020-01-02 onward

| System | CAGR | Max DD | Sharpe | Sortino | Calmar | Action Days/yr | Broker orders/yr |
|---|---:|---:|---:|---:|---:|---:|---:|
| Phase 4A Common Allocator | 20.26% | -36.23% | 0.701 | 1.056 | 0.559 | 19.18 | 29.29 |
| Phase 4B Native-Enhanced Allocator | **22.82%** | **-35.76%** | **0.759** | **1.146** | **0.638** | **17.82** | **27.63** |

Both clear the Phase 4 hard operational/robustness gate.

## 4B - 4A attribution

Replacing only the S&P Common layer with `SP_BROAD_TREND` produced:
- CAGR: **+2.56 percentage points**
- Max DD: **+0.47 points** improvement (less negative)
- Calmar: **+0.079**
- Sortino: **+0.091**
- Action Days: **-1.36/year**
- Broker orders: **-1.66/year**

Therefore Phase 3's S&P Native finding survives inside the portfolio allocator. The Native layer adds value; this is not the reason the final hierarchical system is rejected.

## Execution stress

### Phase 4A
- 25 bps stress CAGR: 15.45%
- t+2 open delay CAGR: 18.10%
- max calendar-year Action Days: 25
- underlying switches OOS: 28
- leverage switches OOS: 39

### Phase 4B
- 25 bps stress CAGR: 17.97%
- t+2 open delay CAGR: 20.43%
- max calendar-year Action Days: 25
- underlying switches OOS: 28
- leverage switches OOS: 37

Both remain positive under cost and delayed-execution stress and remain below the 40 Action Days/year hard cap. 4B lies within the preferred low-maintenance range on average, though 25 Action Days occurred in the busiest calendar year.

## 4B risk-on allocation mix

Approximate share of risk-on days:
- TQQQ: 50.66%
- QLD: 10.25%
- UPRO: 27.02%
- SSO: 12.07%

The allocator therefore used all four intended states rather than collapsing trivially to one ticker.

## Critical comparator result

The allocator must be judged against the strongest surviving single-system frontier, not merely against 4A.

Relevant OOS single-system comparators from the same research stack include:

| System | CAGR | Max DD | Calmar | Action Days/yr |
|---|---:|---:|---:|---:|
| TQQQ Common | 27.33% | -38.16% | 0.716 | ~11.17 |
| QLD Common scaled-stop | 20.51% | -27.05% | 0.758 | ~11.17 |
| UPRO `SP_BROAD_TREND` | **27.71%** | **-34.57%** | **0.802** | **~7.85** |
| SSO `SP_BROAD_TREND` | 19.36% | -24.16% | 0.801 | ~7.85 |

The decisive result is that **UPRO × SP_BROAD_TREND dominates Phase 4B on the primary OOS frontier**:
- higher CAGR: 27.71% vs 22.82%
- lower drawdown magnitude: -34.57% vs -35.76%
- higher Calmar: 0.802 vs 0.638
- higher Sortino
- substantially fewer Action Days: ~7.85 vs 17.82/year
- simpler implementation

QLD and SSO also remain relevant lower-drawdown frontier points even though their CAGR is lower.

## Decision

### Phase 4A
**REJECT as a future Forward candidate.**

It passes absolute hard gates but does not add enough value over the strong single-system frontier to justify underlying/leverage switching complexity.

### Phase 4B
**REJECT as a future Forward candidate in its registered v1 form.**

4B clearly improves 4A and validates the Phase 3 Native attribution. However, it is economically dominated by UPRO `SP_BROAD_TREND` on CAGR, drawdown, Calmar and operational burden. A more complex allocator should not be advanced merely because it is valid and profitable.

No post-result threshold tuning is permitted under Phase 4. The registered VIX/realized-volatility/relative-momentum/hysteresis rule will not be rescued by searching neighboring values in this phase.

## What Phase 4 taught us

1. S&P Native `SP_BROAD_TREND` is a real contributor within the historical research sample; its benefit survives portfolio integration.
2. Dynamic Underlying × Leverage switching is **not automatically additive**. Combining several individually sensible decisions can dilute a stronger standalone edge.
3. The selected allocator spends roughly half of risk-on days in TQQQ, but switches enough that it sacrifices return without achieving a commensurate drawdown reduction.
4. Complexity has an observable cost: more Action Days, more broker orders, more moving parts, and weaker frontier metrics than the best simple candidate.
5. The correct research outcome is therefore to preserve the strong single-system frontier rather than force a hierarchical winner.

## Phase 4 final funnel

Preserve for the next Forward-gate decision:
- TQQQ × VS13 Common / 13% stop — Growth comparator
- QLD × VS13 Common / 8.67% scaled stop — Nasdaq balanced comparator
- UPRO × `SP_BROAD_TREND` / 13% stop — strongest Phase 3 growth/risk-adjusted candidate
- SSO × `SP_BROAD_TREND` / 8.67% scaled stop — S&P balanced comparator

Do not advance:
- Phase 4A Common Allocator
- Phase 4B Native-Enhanced Allocator v1

## Bias / evidence statement

All Phase 4 historical data has been inspected in prior research stages. The allocator rule was pre-registered before successful calculation, which limits within-Phase-4 tuning but does not create a pristine holdout. Any system considered for Production still requires independent Forward evidence.

## Production / Forward status

- Existing Production Champion: unchanged
- Existing Forward ledgers: unchanged
- Daily signal workflows: unchanged
- Phase 4 allocator Forward enrollment: none
- Automatic promotion: prohibited

## Next stage

Phase 5 should be a **Forward Gate / candidate-reduction stage**, not another historical optimizer. It should decide which 2–4 frozen systems from the surviving single-system frontier deserve independent Forward tracking, while avoiding redundant highly correlated systems and preserving existing immutable Forward records.
