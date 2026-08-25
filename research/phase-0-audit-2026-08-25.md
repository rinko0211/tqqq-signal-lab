# Phase 0 Audit — 2026-08-25

## Scope
Freeze and inspect the existing system before adding Underlying × leverage × Winner+Cash research.

## Existing architecture confirmed

- `lib/engine.ts`: core signal/backtest engine.
- `lib/cross-ticker.ts`: current 3x cross-ticker research for TQQQ / UPRO / SOXL / TECL / TNA.
- `lib/native-research.ts`: hypothesis-first Native research with three families per focus ticker, OOS, cost stress, delayed execution and parameter-neighbor stability checks.
- `lib/forward.ts` and `lib/ticker-forward.ts`: forward-test infrastructure.
- `lib/production.ts`: Research -> Decision -> Production modes, human approval gate and Health Policy.
- `lib/official-data.ts`: Nasdaq historical ETF data + Cboe VIX data; actual ETF prices, no silent synthetic 3x history.
- Daily TQQQ and ticker-forward workflows are separated from weekly research.

## Existing research already implemented before this phase

- 3x cross-ticker comparison exists.
- TQQQ / UPRO / TECL Native research exists.
- UPRO Native candidate registration already exists in `production.ts`.
- Production mode cannot be entered directly from Research and requires human approval plus Strong evidence / final review.
- Hybrid Health Policy is implemented: daily operations, quarterly strategy review, annual formal review, event-driven immediate review.

## Gaps relevant to the new research

1. Current cross-ticker type is hard-coded to 3x products only.
2. 2x products are not part of the current comparison universe.
3. Underlying and leverage are not yet separated as independent research dimensions.
4. `ordersPerYear` is tracked, but user-oriented `Action Days/year` is not yet a first-class hard constraint.
5. Winner+Cash hierarchical allocation is not yet implemented as a standalone challenger.
6. Current Native gate allows 3–20 orders/year, which is not equivalent to the new operational constraint of <=40 Action Days/year and should not be reused blindly for a multi-ticker rotation engine.
7. Inverse ETFs are already excluded from the long tactical universe; this is consistent with the new policy that inverse remains research-only by default.

## Frozen user constraints for future phases

- Daily monitoring: allowed.
- Target Action Days: 12–24/year.
- Hard Production cap: 40 Action Days/year, except clearly classified emergency-risk exceptions.
- Production portfolio: normally one risk ticker + Cash.
- Inverse: research-only by default.
- Existing VS13 / VS12 / VT30 / TQQQ Forward / UPRO Forward records must not be rewritten.
- No automatic Champion promotion.
- No reintroduction of manual upload/installer operation.

## Phase 1 pre-registered universe

Core:
- Nasdaq-100: QQQ / QLD / TQQQ
- S&P 500: SPY / SSO / UPRO
- U.S. Technology: XLK / ROM / TECL

Secondary research queue:
- Semiconductors: SOXX / USD / SOXL

Deprioritized unless a new hypothesis is written first:
- Russell 2000: IWM / UWM / TNA

## Phase 1 acceptance logic

Phase 1 is screening, not strategy optimization. It will compare operational quality, actual data availability/history, and a common tactical framework. It will not tune ticker-specific parameters. Candidates that survive may proceed to Common Framework/OOS/WF analysis; losers remain in the experiment registry.

## Phase 0 conclusion

The existing system does not need to be rebuilt. The correct next step is to extend the research data model from `3x ticker` to `underlying + leverage + representative ticker`, add Action-Day accounting, and run a small pre-registered universe through the common framework before any new Native or hierarchical strategy is tuned.

User action required: none.
