# Re-Audit 2 — Phase A: Strategy / Research Conclusions

Date: 2026-08-26
Round: second independent reliability re-audit
Status: **CLEAN WITH KNOWN CAUTIONS — NO NEW MATERIAL STRATEGY DEFECT**

## Scope
Re-evaluate the surviving investment architecture without assuming the first executive audit was correct. This phase is strategy/read-only and does not modify weights, thresholds, stops, versions, Forward start dates or existing records.

## Re-reviewed chain
- Phase 1.5 leverage-neutral diagnostic
- Phase 2 robustness validation
- Phase 3 bounded Native research
- Phase 4 hierarchical allocator rejection
- Phase 5 candidate reduction / Forward charter
- frozen Phase 5 configs in code
- core five-state/hysteresis signal behavior
- Action-Day definition

## Findings

### 1. Four-system Forward frontier remains justified
The information-efficient frontier remains:
- TQQQ / VS13 / 13% stop — Nasdaq growth point
- QLD / VS13 / 8.6667% mechanical scaled stop — Nasdaq lower-DD point
- UPRO / SP_BROAD_TREND / 13% stop — S&P higher-growth point
- SSO / SP_BROAD_TREND / 8.6667% mechanical scaled stop — S&P lower-DD point

No additional ticker is needed to answer the currently frozen leverage/underlying questions, and removing any of the four would remove a distinct comparison dimension.

### 2. The 2x stop interpretation remains appropriately limited
`8.6667% = 13% × 2/3` is a first-order leverage-equivalent structural hypothesis, not an optimized or theoretically exact stop. The historical research and current UI/governance correctly avoid claiming optimum status.

No retuning is justified during true Forward.

### 3. SP_BROAD_TREND remains the only S&P Native family worth Forward observation
The same pre-registered underlying-level family improved both UPRO and SSO while using identical underlying-level logic and leverage-scaled stop handling. This supports cross-leverage consistency and implementation simplicity.

It must **not** be interpreted as two statistically independent confirmations because both ETFs share the S&P 500 underlying. That caution was already established in the first executive audit and is not a new finding.

### 4. Nasdaq Common retention remains the correct simplicity decision
No Nasdaq Native family cleared the pre-registered material-value/no-severe-regression hurdles. Retaining Common VS13 avoids adding complexity without demonstrated value.

### 5. Phase 4 allocator rejection remains correct
Phase 4B improved 4A, but UPRO SP_BROAD_TREND was historically stronger on CAGR, Max DD, Calmar/Sortino and operational burden. Advancing the more complex allocator would have violated the simplicity/low-frequency objective.

No later evidence has appeared that warrants reopening or threshold-rescuing the rejected allocator.

### 6. Low-frequency objective remains aligned
Historical surviving-system Action Days are approximately 7.85–11.17/year, far below the <=40/year hard cap and closer to the original limited-intervention intent than the rejected allocator (~17.82/year average, 25 in its busiest year).

Action Days are distinct execution dates, not raw broker-order count.

### 7. Five-state exposure is deliberately hysteretic
The signal has 0/25/50/75/100 target states, but it does not continuously rebalance to every daily score bucket. Entry and reduction confirmation use different thresholds plus min-hold/cooldown/trailing-stop controls. This is consistent with turnover suppression.

## No new material strategy defect
No evidence in this phase requires:
- stopping Forward;
- changing any strategy parameter;
- adding/removing a Phase 5 frontier candidate;
- reopening Phase 4 allocator research;
- rewriting historical results.

## Known non-material / previously documented cautions
- all historical OOS/WF evidence is cumulatively inspected rather than pristine;
- 13% is an inherited frozen baseline, not a universal optimum;
- 8.6667% is mechanical leverage scaling, not an exact path-risk identity;
- leveraged ETF daily-reset/path dependency prevents simple long-horizon linear leverage equivalence;
- Forward remains the decisive evidence layer.

## Phase A decision
**CLEAN for the strategy/research-conclusion dimension.**

This does not yet count the whole re-audit round as clean; all later phases must also discover no new material defect.

## Handoff to Phase B
A potentially material time/calendar inconsistency was discovered while reading the core engine: `engine.ts` retains an older internal NYSE-holiday implementation that appears to treat Juneteenth as an exchange holiday before 2022, while the newer shared market calendar correctly starts the NYSE Juneteenth closure in 2022. Phase B must determine whether this affects historical execution dates/results and whether duplicated calendar logic remains elsewhere.
