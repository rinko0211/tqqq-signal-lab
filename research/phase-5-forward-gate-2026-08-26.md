# Phase 5 Charter — Forward Gate / Candidate Reduction

Registered: 2026-08-26 JST, while the 2026-08-25 U.S. session was still in progress.

## Purpose

Stop historical optimization and move only the highest-information surviving systems into true append-only Forward observation.

Phase 5 is not a new backtest phase. No new thresholds, strategy families, allocator variants, stop search, or post-result optimization are permitted.

## Evidence inherited from Phases 2–4

Historical frontier entering Phase 5:
- TQQQ × VS13 Common × 13% stop — Nasdaq Growth
- QLD × VS13 Common × mechanically scaled 8.67% stop — Nasdaq Balanced
- UPRO × SP_BROAD_TREND × 13% stop — strongest historical Growth / risk-adjusted candidate
- SSO × SP_BROAD_TREND × mechanically scaled 8.67% stop — S&P Balanced

Phase 4 hierarchical allocators are rejected and will not enter Forward.

## Existing Forward protection

Existing append-only records remain authoritative and immutable:
- TQQQ VS13 / VS12 / VT30
- TQQQ and QQQ buy-and-hold benchmarks
- existing UPRO Common VS13 Track B
- existing legacy UPRO Native 25% volatility-target Track B

No existing record may be rewritten, deleted, or relabeled as if a new Phase 5 system existed earlier.

## Candidate-reduction decision

### Existing comparison system — no duplicate enrollment

`TQQQ-VS13-v1.0` is already in independent Forward and therefore covers the Nasdaq 3x Growth point. Do not create a duplicate Phase 5 TQQQ ledger.

### New Phase 5 Forward candidates

1. `UPRO-SPBT-v1.0`
   - Asset: UPRO
   - Logic: Phase 3 `SP_BROAD_TREND`
   - Stop: 13%
   - Role: PRIMARY_CHALLENGER
   - Rationale: strongest Phase 2–4 historical frontier point; required for independent confirmation.

2. `SSO-SPBT-Scaled-v1.0`
   - Asset: SSO
   - Logic: same frozen `SP_BROAD_TREND`
   - Stop: 13% × 2/3 = 8.6666667%
   - Role: S&P_LEVERAGE_CONTROL
   - Rationale: isolates 2x vs 3x under exactly the same underlying-level Native logic.

3. `QLD-VS13-Scaled-v1.0`
   - Asset: QLD
   - Logic: frozen Common VS13
   - Stop: 13% × 2/3 = 8.6666667%
   - Role: NASDAQ_BALANCED_CONTROL
   - Rationale: preserves the Nasdaq 2x balanced frontier and complements the already-running TQQQ VS13 Forward.

This yields four informative frontier systems when combined with existing `TQQQ-VS13-v1.0`, without duplicating it.

## True Forward start

Freeze time occurs during the 2026-08-25 U.S. trading session.

- `startDate = 2026-08-25`
- No 2026-08-24 or earlier record may be inserted for a Phase 5 candidate.
- If the data source has not yet published the completed 2026-08-25 bar, the correct state is zero Phase 5 observations.
- The first record is created only once a completed market bar on or after 2026-08-25 is available.
- No historical signals are backfilled as `LIVE`.

## Frozen execution assumptions

For every Phase 5 candidate:
- signal: U.S. market close t
- intended execution: next available U.S. market open t+1
- commission: 3 bps
- slippage: 5 bps
- actual ETF OHLC only
- no synthetic leveraged history
- Cash return modeled as 0% in the existing project convention
- FX return excluded, consistent with existing Forward methodology

## Review schedule

- Interim information review: 2027-02-25
- First formal Forward Gate: 2027-08-25
- Stronger evidence review: 2028-08-25

The six-month review cannot promote a system to Production.

## Minimum evidence before Phase 6 Production consideration

No automatic promotion. Human approval is mandatory.

At the first formal review, require at minimum:
- at least 12 months since true Forward start;
- sufficient LIVE observations with no synthetic backfill;
- >= 6 executed non-zero-turnover trades / actions where the strategy naturally generates them;
- multiple observed market regimes rather than one uninterrupted bull trend;
- missing/invalid observations <= 1%;
- no integrity, data, or execution defect;
- realized Action Days consistent with <= 40/year hard cap;
- no unexplained drawdown materially outside historical stress expectations;
- costs and execution behavior consistent with the frozen assumptions.

Comparative Production selection in Phase 6 should use Pareto evidence rather than one score. Forward robustness and implementation integrity outrank historical CAGR.

## Version discipline

The following are immutable under v1.0:
- ticker
- weights
- thresholds
- stop rule
- confirm/min-hold/cooldown
- execution assumption
- cost assumption

Any logic change requires a new version and a new true Forward start date. Old records remain append-only.

## Rejected / not enrolled

- Phase 4A hierarchical allocator — rejected historically
- Phase 4B Native-enhanced hierarchical allocator — rejected historically
- duplicate TQQQ Phase 5 enrollment — unnecessary because `TQQQ-VS13-v1.0` already supplies the required independent Forward evidence
- legacy `UPRO-Native-v1.0` is not renamed or converted into SP_BROAD_TREND; it remains a separate historical Forward experiment

## Phase 5 success criterion

Phase 5 succeeds when:
1. the three new candidate versions are frozen;
2. append-only true Forward tracking is operational and isolated from the main Daily TQQQ workflow;
3. no pre-start records are created;
4. existing Forward ledgers remain unchanged;
5. review dates and Phase 6 evidence rules are fixed before Forward results accumulate.
