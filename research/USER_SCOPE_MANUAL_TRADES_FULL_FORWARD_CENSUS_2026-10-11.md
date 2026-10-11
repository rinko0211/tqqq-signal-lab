# Product intent restoration — manual trades and full TQQQ/Gold Forward census

Effective clarification: **2026-10-11 JST**. This is a forward-looking *scope correction*, not a change to frozen strategies, past research verdicts, immutable Forward observations, or Production authority.

## Non-negotiable final product

1. Automatically **collect validated market data, calculate and display** prospective BUY/SELL/HOLD/WAIT signals, weights, date/time, provenance, and reasons.
2. **The user alone decides whether and when to enter brokerage orders manually.** No application-side broker order submission, automatic rebalancing, unattended account execution, broker credentials for trading, or implied future auto-trading phase.
3. The user's current tolerance is roughly **up to 30–40 manual trades per year** without fabricating actions to meet a target. Count actual brokerage order legs separately from Action Days. Earlier preferred 5–10 or 12–24 intervention days and the legacy <=40 Action Days/year cap are *not* substitutes for the user's trade-count goal.
4. Keep end-of-day signal t and **next legal NYSE opening** as a timing/analysis convention, not a software instruction to place an order. On missed opportunities display explicit expiry/warning, never chase trades.
5. The words `Production`, `execution`, `PAPER`, or `Gateway` in the legacy research code must never imply unattended execution. Gateway v0–v6 were built during an **incorrect assistant-driven auto-trading tangent**. They are currently inert, not user-approved trading infrastructure. **No further automated broker gateway work, no broker connectivity, no order adapters.** Retire/relabel safely in a separate change review; do not disrupt current scheduled Forward research.

## The originally intended Forward *comparison* is NOT fully implemented

The user requires a **broad TQQQ-related and Gold-related research candidate universe**, with each agreed eligible frozen version assessed prospectively over a meaningful common Forward period before selecting the best manual-signal strategy. Existing early narrowing cannot be silently equated with full coverage.

Confirmed current TQQQ research evidence:
- Base Forward series (5): `VS13-v1.0`, `VS12-v1.0`, `VT30-v1.0`, `TQQQ-BH-v1.0`, `QQQ-BH-v1.0` (last two are benchmarks).
- Phase5 frontier additions (3): `UPRO-SPBT-v1.0`, `SSO-SPBT-Scaled-v1.0`, `QLD-VS13-Scaled-v1.0`; VS13 itself is reused, not duplicated.
- Legacy ticker Forward: `UPRO-VS13-v1.0`, `UPRO-Native-v1.0` are present in a separate old Track B status, but their **current continuous Forward activity is not verified**.
- The original Phase1–4 research included multiple underlying/strategy families, such as TQQQ, QLD, UPRO, SSO, TECL/ROM, SOXL/USD research queue, and hierarchical allocators. Historical screening does **not** establish independent prospective Forward enrollment.
- The frozen `research/phase-5-forward-gate-2026-08-26.md` **explicitly limited new Forward registrations to 3** and rejected historical Phase4 allocators. This recorded candidate reduction is preserved as historical fact; it **does not certify** the larger candidate universe requested by the user.
- Current VS13 Forward evidence was 34 observations / 2.86% missing-or-invalid / inadequate regime coverage on 2026-10-10; its status is `Insufficient`. No winner may be presumed from these figures.

Confirmed Gold status (separate repository `rinko0211/gold50-shadow-monitor`): `TQQQ-Gold50-Research-v0.1` has a **single** frozen allocation mapping `TQQQ=w, GLD=CASH=(1-w)/2` and has reached **C10/10 COMPLETE_STOP_GATE** on 2026-09-21. This is **one candidate and a 10-session operational shadow gate**, not a broad Gold-family long-horizon comparative Forward and not Production eligibility. Preserve independent repository/state plane.

### Corrective mandatory work sequence

A. Reconstruct a **complete cross-repository candidate census** from original user requirements, immutable research charters, phase artifacts and archived rejected/deferred records; inventory **ticker × signal logic × stop/weights × version** and original evidence. Do not invent strategy versions or falsely claim that a historical optimization grid was Forward tested. Publish count **only after** the census is auditable.

B. Classify every candidate: `FORWARD_ACTIVE`, `FORWARD_COMPLETED`, `ELIGIBLE_NOT_ENROLLED`, `HISTORICALLY_REJECTED`, `DEFERRED`, `BENCHMARK`, or `CENSUS_UNVERIFIED`. An earlier rejected hypothesis does not re-enter without a **new prospective, preregistered and user-reviewed scope amendment**; do not data-mine arbitrary nearby parameters.

C. Compare desired candidate breadth with legacy **2–4 Phase5 survivors** and explicitly resolve the conflict in a new prospective research scope before creating a new runner. All **agreed eligible** versions will be independently Forward-tested under reproducible frozen rules, with a genuinely prospective start; no backfill, rewritten histories, retrospective winner promotion, or selection merely because VS13 and Gold50 were historically preferred.

D. Compare like-for-like Forward evidence and surviving strategies: common market sessions, completeness (<=1% missing where existing charter applies), market regimes, nonzero action events, risk/DD/recovery, OOS/robustness history, Sharpe/Sortino/Calmar, costs/slippage, delays, *manual transaction count* and Action Days. Document correlation/multiple-comparisons risks. Review dates do not confer a full 12 months of evidence on later-start entrants.

E. Only after **every user-approved eligible candidate group** has a comparable Forward record and enough evidence, propose a winner for user decision; published primary daily signals remain explicitly user-selected and **manual-action only**. Keep a research dashboard for all alternatives.

F. Gold and TQQQ keep independent append-only ledgers; the C10 Gold50 completed gate is NOT retroactively restarted. A broader Gold research cohort must be separately preregistered before new prospective tracking is activated.

## Hard boundary for this correction

Documentation and inventory clarification **only**: no strategy retuning, scheduled workflows, broker integrations, automatic trades, new provider secrets, new candidate launches, existing ledger changes, current `RESEARCH / approvedByHuman=false` authority change, or auto winner promotion. User scope wins over any prior assistant-generated roadmap calling for automatic execution.

**Open gap:** exact claimed 'dozens per family' has not yet been reconciled against authoritative frozen version registries. Current implementation cannot claim complete candidate coverage.