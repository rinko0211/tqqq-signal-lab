# Phase 1 Close Report — Underlying × Leverage Screening

Closed: 2026-08-25 JST
Source artifact: `github-pages/public/data/phase-1-bounded-screening.json`
Common period policy: actual ETF OHLC only, frozen Common VS13, no Native tuning, no parameter search, no new Forward enrollment.

## Decision

Phase 1 is CLOSED.

Advance to Phase 2:
- TQQQ — Nasdaq-100 3x
- QLD — Nasdaq-100 2x
- UPRO — S&P 500 3x
- SSO — S&P 500 2x

Conditional / do not enter Core Phase 2 automatically:
- TECL — Technology 3x
- ROM — Technology 2x

Research Queue only:
- SOXL — Semiconductor 3x
- USD — Semiconductor 2x

USD and SOXL do not form a clean leverage pair because they track different semiconductor indexes. They must not be interpreted as a causal 2x-vs-3x comparison.

## Common-period sanity-check results

Common usable sample: 2016-08-24 through 2026-08-24, 2,513 observations per evaluated ETF.

| Ticker | Lev | CAGR | Total Return | Max DD | Sharpe | Sortino | Calmar | Ulcer | Action days/yr | Operational | Phase 1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| TQQQ | 3x | 23.04% | +690.00% | -38.16% | 0.767 | 1.112 | 0.604 | 0.198 | 9.73 | 98 | ADVANCE |
| QLD | 2x | 13.90% | +266.06% | -28.34% | 0.648 | 0.934 | 0.491 | 0.133 | 7.72 | 98 | ADVANCE |
| UPRO | 3x | 22.20% | +637.63% | -37.05% | 0.855 | 1.268 | 0.599 | 0.155 | 7.42 | 94 | ADVANCE |
| SSO | 2x | 13.58% | +255.86% | -28.70% | 0.728 | 1.071 | 0.473 | 0.129 | 5.12 | 97 | ADVANCE |
| TECL | 3x | 27.48% | +1,024.90% | -53.16% | 0.823 | 1.206 | 0.517 | 0.241 | 10.93 | 75 | CONDITIONAL |
| ROM | 2x | 21.69% | +607.56% | -27.25% | 0.843 | 1.241 | 0.796 | 0.137 | 8.63 | 72 | CONDITIONAL |

## Pair interpretation

### Nasdaq-100: TQQQ 3x vs QLD 2x

The 2x product reduced max drawdown by about 9.82 percentage points (-38.16% to -28.34%) and lowered Ulcer Index materially, but CAGR fell by about 9.14 percentage points (23.04% to 13.90%). Under this frozen Common VS13 framework, the lower leverage did not improve Sharpe, Sortino, or Calmar.

Interpretation: 2x is a valid defensive candidate, but Phase 1 does not show a superior risk-adjusted replacement for TQQQ.

### S&P 500: UPRO 3x vs SSO 2x

The 2x product reduced max drawdown by about 8.34 percentage points (-37.05% to -28.70%) and lowered Ulcer Index, but CAGR fell by about 8.62 percentage points (22.20% to 13.58%). Sharpe, Sortino, and Calmar were also lower for SSO in this fixed framework.

Interpretation: same trade-off as Nasdaq-100. SSO materially reduces drawdown but does not dominate UPRO on risk-adjusted return in this Phase 1 screen.

## Technology pair

TECL produced the highest CAGR in this diagnostic but also the worst max drawdown (-53.16%) and has lower operational quality. ROM is the numerically most interesting defensive result in the screen: CAGR 21.69%, max DD -27.25%, Calmar 0.796. However, ROM was pre-classified Conditional due to operational quality / trading-volume concerns. It is therefore not promoted to Core based on attractive historical metrics.

This is deliberate anti-selection-bias discipline: historical performance cannot override the operational gate after results are observed.

## Phase 1 conclusions

1. 2x leverage meaningfully lowers drawdown and path stress.
2. In the two clean same-index pairs, the 2x versions lose substantial CAGR and do not improve the reported Sharpe/Sortino/Calmar under frozen Common VS13.
3. Therefore 3x remains viable and cannot be rejected merely because 2x has lower drawdown.
4. QLD and SSO remain important Phase 2 comparators because they quantify the return-vs-drawdown frontier with the same underlying index.
5. ROM is interesting enough to preserve as Conditional evidence, but not strong enough operationally to bypass the predefined gate.
6. TECL's high CAGR is not sufficient to compensate for its -53% diagnostic drawdown and lower operational quality at this stage.
7. SOXL/USD stay out of causal leverage-pair analysis because the underlying indexes differ.

## Phase 2 scope lock

Phase 2 must evaluate only the four Core candidates first:
- TQQQ
- QLD
- UPRO
- SSO

Required Phase 2 tests before any conclusion:
- fixed OOS evaluation
- Walk-Forward stability
- cost stress
- execution-delay stress
- parameter / threshold stability without mining
- crash / rebound / sideways regime diagnostics
- common-period and maximum-history views kept separate
- explicit multiple-testing / selection-bias audit
- no automatic Production or Forward promotion

TECL/ROM may only enter a secondary Phase 2 branch if the Core comparison is completed first and their inclusion is justified by a pre-written hypothesis.

## Status

Phase 1: COMPLETE / CLOSED
Production Champion: unchanged
Existing Forward tracks: unchanged
Automatic strategy promotion: prohibited
Next research stage: Phase 2 Robustness Validation
