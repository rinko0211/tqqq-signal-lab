# Hierarchical Allocation Research Charter

Status: ACTIVE RESEARCH
Baseline date: 2026-08-25

## Purpose

Extend the existing TQQQ Signal Lab without changing or rewriting the existing VS13 / VS12 / VT30 / UPRO forward records. The goal is to determine, with controlled research freedom, which **Underlying × leverage × strategy** combination is most suitable for a low-maintenance production system.

## Production-operability constraints (hard constraints)

- Daily monitoring is allowed; daily trading is not required.
- Target user intervention: **12–24 Action Days/year**.
- Hard production cap: **40 Action Days/year**. A candidate above 40 is normally rejected even if CAGR is higher.
- Track both `Action Days` and raw `Orders`. A switch from one risk ticker to another may be two broker orders but one user Action Day.
- Primary production portfolio should normally hold **one risk ticker + Cash**.
- Inverse products are research-only by default and are not required for Production.
- Emergency risk exits may override the normal turnover target.

## Research hierarchy

### Phase 0 — Freeze and audit
Preserve current append-only forward ledgers, versions, Champion/Challenger labels, production transition rules, health policy, daily workflows, PWA and existing tests.

### Phase 1 — Underlying × leverage screening
Do not brute-force every leveraged ETF. Start with liquid, long-history representative products and use 1x products mainly as benchmarks/reference indices.

Core families:
1. Nasdaq-100: QQQ (1x benchmark), QLD (2x), TQQQ (3x)
2. S&P 500: SPY (1x benchmark), SSO (2x), UPRO (3x)
3. U.S. Technology: XLK (1x benchmark), ROM (2x), TECL (3x)

Research queue only unless evidence justifies promotion:
4. Semiconductors: SOXX (1x benchmark), USD (2x), SOXL (3x)

Currently deprioritized:
5. Russell 2000: IWM / UWM / TNA, because prior 3x results were weak and adding it immediately increases research multiplicity.

### Phase 2 — Common-framework comparison
Apply a common tactical framework first. This isolates the value of the underlying/leverage choice from ticker-specific tuning.

Required comparisons include:
- full available actual ETF history
- common period
- fixed OOS
- walk-forward
- transaction-cost stress
- delayed-execution stress
- parameter stability
- Total Return, CAGR, Max DD, Sharpe, Sortino, Calmar, Ulcer/Recovery where available
- Action Days/year and Orders/year

### Phase 3 — Native strategy research
Only for survivors from Phase 2. Pre-register 2–4 economically defensible strategy families per underlying. Select at most one Native candidate per underlying. Do not mine fine-grained stop/MA/weight combinations. Require parameter plateau and OOS/WF robustness.

### Phase 4 — Winner + Cash hierarchical allocation
Only after candidate reduction. The production-oriented challenger should answer sequentially:
1. Risk-on or Cash?
2. If risk-on, which surviving underlying has the strongest risk-adjusted opportunity?
3. Which leverage level is appropriate?
4. What target allocation is appropriate (0/25/50/75/100 or another pre-registered small grid)?
5. Is the change large/persistent enough to justify an Action Day?

Use hysteresis/confirmation/minimum meaningful change/cooldown only when they improve robustness and reduce turnover without materially weakening emergency exits.

### Phase 5 — Forward gate
Only 2–4 serious new systems should enter independent Forward Test. Existing forward systems are not overwritten or backfilled as if they had existed earlier.

### Phase 6 — Decision and Production
Final evaluation unit: **Ticker × Strategy × Version** (or one winner+cash allocation engine version). Production selection requires sufficient Forward evidence and human approval. Production UI should show only the selected system’s primary daily signal; research history remains archived.

## Bias controls

Always monitor:
- look-ahead bias
- data snooping / multiple testing
- selection and survivorship bias
- holdout contamination
- regime overfitting
- parameter mining
- benchmark gaming
- complexity creep
- unrealistic execution/slippage assumptions

Rejected experiments must remain recorded.

## Decision objective

Do not maximize CAGR alone. Prefer robust compound growth subject to operational feasibility and tolerable drawdown. Key selection metrics are:

- Forward robustness
- OOS / walk-forward stability
- Total Return / CAGR
- Max DD
- Calmar / Sortino
- recovery duration
- trading costs
- Action Days/year
- implementation complexity

A simpler candidate that can realistically be followed for many years may beat a slightly higher-CAGR candidate that requires excessive intervention.

## Existing system protection

This research must not interrupt:
- Daily TQQQ signal generation
- existing VS13/VS12/VT30 forward records
- UPRO forward records
- append-only persistence
- GitHub Pages/PWA
- Production approval safeguards
- current Health Review policy

Heavy historical research must remain separable from lightweight daily signal/forward workflows.
