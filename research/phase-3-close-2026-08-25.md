# Phase 3 Close Report — Bounded Native Strategy Research

Closed: 2026-08-25 JST

Source artifacts:
- `github-pages/public/data/phase-3-nasdaq.json`
- `github-pages/public/data/phase-3-sp500.json`

Phase 3 is CLOSED.

## Pre-registered design honored

- Core tickers only: TQQQ / QLD / UPRO / SSO
- Three Native families per underlying plus frozen Common incumbent
- Same Native family parameters shared by 2x/3x versions of the same underlying
- Leverage-specific stop difference only through the mechanical rule `13% × leverage / 3`
- No fine grid, optimizer, ML search, inverse ETF, TECL/ROM branch, hierarchical allocator, Forward enrollment or Production change
- At most one Native candidate per ticker
- `NO NATIVE CANDIDATE` explicitly allowed

## Decisions

### Nasdaq-100

- TQQQ: **NO NATIVE CANDIDATE** — retain Phase 2 Common incumbent (VS13 Fixed, 13% stop)
- QLD: **NO NATIVE CANDIDATE** — retain Phase 2 Common incumbent (VS13 with 8.67% leverage-scaled stop)

All three Nasdaq Native families were absolutely executable/robust enough to calculate, but none cleared the pre-registered combination of no-severe-regression and material-value hurdles. This is positive evidence for Common simplicity rather than a research failure.

### S&P 500

- UPRO: **NATIVE RESEARCH CANDIDATE — SP_BROAD_TREND**
- SSO: **NATIVE RESEARCH CANDIDATE — SP_BROAD_TREND**

The same underlying-level family passed independently at both 3x and 2x leverage, which is stronger evidence than a ticker-specific win because the rule was shared across the leverage pair.

## Main OOS comparison (2020-01-02 onward)

| Ticker | Incumbent CAGR | Candidate CAGR | Incumbent DD | Candidate DD | Incumbent Sortino | Candidate Sortino | Incumbent Calmar | Candidate Calmar | Action days/yr candidate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| TQQQ | 27.33% | — | -38.16% | — | 1.220 | — | 0.716 | — | — |
| QLD | 20.51% | — | -27.05% | — | 1.282 | — | 0.758 | — | — |
| UPRO | 23.85% | **27.71%** | -37.05% | **-34.57%** | 1.312 | **1.464** | 0.644 | **0.802** | **7.85** |
| SSO | 16.97% | **19.36%** | -26.10% | **-24.16%** | 1.342 | **1.491** | 0.650 | **0.801** | **7.85** |

Interpretation:
- UPRO Broad Trend improves CAGR by about 3.86 percentage points while improving drawdown by about 2.48 points; Calmar rises from ~0.644 to ~0.802.
- SSO Broad Trend improves CAGR by about 2.40 percentage points while improving drawdown by about 1.94 points; Calmar rises from ~0.650 to ~0.801.
- Both candidates also improve Sharpe/Sortino and reduce Action Days from the Common baseline (~8.61/year) to ~7.85/year.

## Robustness checks

### UPRO × SP_BROAD_TREND
- OOS CAGR: 27.71%
- Max DD: -34.57%
- Calmar: 0.802
- Sortino: 1.464
- Action Days/year: 7.85
- 25 bps stress CAGR: 26.59%
- t+2 open delay CAGR: 27.89%
- parameter-neighborhood stability floor: 0.980

### SSO × SP_BROAD_TREND
- OOS CAGR: 19.36%
- Max DD: -24.16%
- Calmar: 0.801
- Sortino: 1.491
- Action Days/year: 7.85
- 25 bps stress CAGR: 18.31%
- t+2 open delay CAGR: 20.20%
- parameter-neighborhood stability floor: 0.955

Both pass the <=40 Action Days/year Operational Gate with large margin.

## Secondary S&P finding

`SP_SMOOTH_POSITION` also cleared the material gate for UPRO, but not for SSO. `SP_BROAD_TREND` is preferred because:
1. it has the stronger bounded robustness-first score for UPRO;
2. it passes at both UPRO and SSO with the exact same underlying-level family definition;
3. cross-leverage consistency is stronger evidence against ticker-specific overfit;
4. one shared S&P family is simpler to carry into later allocator research.

This does not prove SP_BROAD_TREND is superior out of sample in the future; it only makes it the one S&P Native candidate worth preserving.

## Research candidate versions

Freeze for future reference only:
- `UPRO-SPBT-Research-v1.0`
- `SSO-SPBT-Research-v1.0`

These are **Research candidates, not Forward systems and not Production systems**. Their logic may not be retuned under the same version.

## Bias / evidence statement

Phase 3 uses historically inspected data and is not pristine confirmatory evidence. The Native family set was pre-registered before Phase 3 calculation, which controls but does not eliminate data-snooping risk accumulated across the project.

The notable positive evidence is not merely that one UPRO backtest improved; it is that the same pre-registered S&P Broad Trend family improved both the 3x and 2x S&P products while surviving cost, delay, operational and neighborhood-stability gates.

Forward evidence remains necessary before any Native promotion.

## Phase 3 final funnel

Preserve as primary Common candidates:
- TQQQ × VS13 Fixed
- QLD × VS13 leverage-scaled stop

Preserve as S&P Common comparators:
- UPRO × VS13 Fixed
- SSO × VS13 leverage-scaled stop

Preserve as Native Research candidates:
- UPRO × SP_BROAD_TREND
- SSO × SP_BROAD_TREND

Rejected Native experiments remain in the Phase 3 JSON registry.

## Production / Forward status

- Existing Production Champion: unchanged
- Existing Forward ledgers: unchanged
- Daily Signal workflows: unchanged
- New Phase 3 Native Forward enrollment: **none**
- Automatic promotion: prohibited

## Next stage

Phase 4 should address the Hierarchical / Winner + Cash allocation question using the reduced candidate set. Any dynamic 2x/3x selection hypothesis must be pre-registered before calculation, because Phase 2 already suggested the idea that 3x may suit lower-volatility growth regimes while 2x may suit higher-volatility risk-on regimes.
