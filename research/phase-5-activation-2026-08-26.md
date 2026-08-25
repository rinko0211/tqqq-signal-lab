# Phase 5 Activation Report — Forward Gate

Activated: 2026-08-26 JST

Phase 5 is now ACTIVE. It is intentionally not CLOSED because its evidence must accumulate prospectively.

## Candidate reduction completed

New true-Forward candidates:
- `UPRO-SPBT-v1.0` — PRIMARY_CHALLENGER
- `SSO-SPBT-Scaled-v1.0` — S&P_LEVERAGE_CONTROL
- `QLD-VS13-Scaled-v1.0` — NASDAQ_BALANCED_CONTROL

Existing `TQQQ-VS13-v1.0` remains the Nasdaq 3x Growth comparison system and was not duplicated.

Not enrolled:
- Phase 4A allocator
- Phase 4B allocator
- duplicate TQQQ VS13

Legacy `UPRO-Native-v1.0` remains unchanged and separate; it is not reinterpreted as SP_BROAD_TREND.

## Frozen logic

### UPRO-SPBT-v1.0
- S&P Broad Trend weights: Trend 36 / Momentum 16 / Volatility 28 / Market 20
- entry / exit / strong: 70 / 48 / 82
- confirm / minHold / cooldown: 3 / 8 / 8
- stop: 13%

### SSO-SPBT-Scaled-v1.0
- same S&P Broad Trend logic
- stop: 8.6666667% mechanically scaled from 13% × 2/3

### QLD-VS13-Scaled-v1.0
- frozen Common VS13 weights: 27 / 16 / 37 / 20
- entry / exit / strong: 70 / 48 / 82
- confirm / minHold / cooldown: 2 / 6 / 8
- stop: 8.6666667% mechanically scaled

All versions use t-close signal, next-open execution, 3 bps commission and 5 bps slippage.

## True start / no-backfill result

Forward start is `2026-08-25` U.S. market date because the Phase 5 decision was frozen while that U.S. session was still in progress.

Initial Phase 5 workflow ran successfully at 2026-08-25T15:36Z. Official source data were only available through `2026-08-24` for UPRO, SSO, QLD, SPY, QQQ and VIX.

Therefore the correct initial state is:
- records: 0
- all three candidates: `AWAITING_FIRST_BAR`
- no pre-start observation created
- no historical Forward signal backfilled

This is an integrity success, not missing research output.

## Operational safeguards implemented

- isolated `.github/workflows/phase5-forward.yml`
- weekday scheduled run after the U.S. close
- independent from Daily TQQQ and legacy UPRO Track B
- append-only ledger
- immutable freeze-drift blocker
- pre-start-record blocker
- New York market-hours guard: same-day data are ignored before 16:15 ET
- data-fetch failure persists a failed status without rewriting existing ledger
- actual ETF OHLC only

Integrity tests passed before the first live update.

## Files

- `research/phase-5-forward-gate-2026-08-26.md`
- `research/phase-5-activation-2026-08-26.md`
- `lib/phase5-forward.ts`
- `scripts/generate-phase5-forward.ts`
- `tests/phase5-forward.test.ts`
- `.github/workflows/phase5-forward.yml`
- `github-pages/public/data/phase-5-forward-ledger.json`
- `github-pages/public/data/phase-5-forward-status.json`

## Review schedule

- Interim: 2027-02-25 — information only, no Production promotion
- Formal: 2027-08-25 — first Phase 6 eligibility review
- Stronger evidence: 2028-08-25

## Phase 6 rule

No Production decision is made now. Phase 6 requires sufficient true Forward evidence and explicit human approval. Historical ranking cannot substitute for Forward robustness.
