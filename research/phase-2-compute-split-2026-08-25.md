# Phase 2 Computational Split Addendum

Registered before any Phase 2 result was observed: 2026-08-25 JST.

The first all-in-one Phase 2 job was found to be computationally too large relative to the GitHub Actions job timeout. No Phase 2 result file had been produced or inspected at the time of this change.

Methodological scope is preserved, but computation is split:

## Phase 2A — Core robustness
All four Core tickers and all four pre-registered common families:
- full/common-period diagnostics
- chronological OOS from 2020-01-02
- fixed-rule annual OOS slices
- predefined event/regime windows

Parameter-neighborhood stability is required only for the two production-oriented primary families:
- VS13_FIXED
- VS13_LEVERAGE_SCALED_STOP

SIMPLE_200DMA and VS13_VOL30 remain independent/reference comparators; they are not eligible for direct production promotion from Phase 2 and therefore do not receive additional parameter-neighborhood mining/stress.

## Phase 2B — Execution robustness
Only the two production-oriented primary families across all four Core tickers:
- cost stress: 8 / 15 / 25 / 50 bps
- execution delay: t+1 / t+2 / t+3 open
- <=40 Action Days/year operational constraint

This split reduces compute while preserving the actual decision question. No thresholds, families, tickers, stress values or decision gates were changed after seeing Phase 2 results.
