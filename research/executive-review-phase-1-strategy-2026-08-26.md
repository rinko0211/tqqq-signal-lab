# Executive Final Review — Phase 1: Strategy Architecture

Date: 2026-08-26
Role: independent final approver / supervisory review
Mode: read-only strategy audit; no strategy parameter changes
Status: **PASS WITH EXPLICIT CAUTIONS**

## Scope
Reassess the conclusions of Phases 1.5–5 without assuming the implementing analyst was correct. Review whether the surviving strategy architecture is internally coherent, appropriately low-frequency, and sufficiently protected against historical over-interpretation.

## Reviewed evidence
- Phase 0 audit
- Phase 1.5 charter
- Phase 2 charter and close report
- Phase 3 charter and close report
- Phase 4 close report
- Phase 5 Forward Gate charter
- core signal / execution engine
- cross-ticker mapping

## Final frontier under review
1. TQQQ — Common VS13 — 13% trailing stop
2. QLD — Common VS13 — mechanically scaled 8.6667% trailing stop
3. UPRO — SP_BROAD_TREND — 13% trailing stop
4. SSO — SP_BROAD_TREND — mechanically scaled 8.6667% trailing stop

Phase 4 hierarchical / ticker-switching allocator remains rejected.

## Findings by severity

### CRITICAL
**None identified in the strategy architecture.**
No evidence was found that requires stopping Phase 5 or rewriting historical Forward records.

### MAJOR CAUTION 1 — Cross-leverage confirmation is not independent replication
The same SP_BROAD_TREND family improved both UPRO and SSO, which is useful robustness evidence because one rule was shared across two leverage implementations. However, UPRO and SSO share the same S&P 500 underlying and therefore their return paths are highly dependent.

Supervisory interpretation:
- count this as cross-leverage consistency;
- do **not** describe it as two statistically independent confirmations;
- do not allow it to substitute for true Forward evidence.

No parameter change is warranted. The current Phase 5 Forward design is the correct remedy.

### MAJOR CAUTION 2 — Historical evidence is cumulatively inspected
Phase 2, Phase 3 and Phase 4 all reuse market history that had already been inspected in earlier project stages. Within-phase preregistration materially reduces opportunistic tuning, but it does not restore a pristine holdout.

Supervisory interpretation:
- historical OOS/WF results are robustness evidence, not fresh confirmatory evidence;
- no historical result may independently authorize Production;
- Phase 5 true Forward remains mandatory.

The current lifecycle gate correctly enforces this.

### MINOR / MODEL-RISK 1 — 8.6667% is a structural heuristic, not a theoretically exact 2x stop
The rule `13% × leverage / 3` was preregistered and not fitted after the Phase 1.5 result. That is good research governance.

However, daily leveraged ETFs do not scale path risk linearly because of daily reset, realized-volatility drag, gaps, beta variation and compounding. Therefore 8.6667% must be described as a **mechanical leverage-equivalent hypothesis**, not as the mathematically correct stop for a 2x ETF.

Decision: retain the frozen rule in Forward; do not optimize it now.

### MINOR / MODEL-RISK 2 — 13% is an inherited baseline
The 13% stop is embedded in the pre-existing VS13 architecture and predates the newer leverage-neutral research stack. The current audit found no justification for treating 13% as universally optimal.

Decision: retain because changing it now would contaminate the frozen experiment. Production approval must rely on Forward behavior, not a claim that 13% is theoretically optimal.

### MINOR / INTERPRETATION 3 — Five-state target is hysteretic, not continuously score-following
The signal maps scores to 0/25/50/75/100% desired exposure, but downward changes are confirmed using the lower exit threshold while upward changes use the entry threshold. This intentionally suppresses churn and creates strong hysteresis.

Correct interpretation:
- five target states exist;
- the portfolio does **not** mechanically rebalance to a new score bucket every day;
- meaningful deterioration / exit confirmation / crisis controls drive reductions.

This behavior is consistent with the low-frequency objective and is not a defect, but the UI/documentation should never imply smooth daily score tracking.

### ACCEPTABLE RESIDUAL RISK — Low-frequency objective
The original operating intent was limited intervention. The surviving single-system frontier produces approximately:
- UPRO / SSO Native: ~7.85 Action Days/year historically;
- TQQQ / QLD Common: ~11.17 Action Days/year historically.

These are substantially below the hard <=40 Action Days/year cap and are more consistent with the original low-maintenance intent than the rejected Phase 4 allocator (~18 Action Days/year average, up to 25 in a busy year).

Therefore rejection of ticker rotation improves alignment with the user's operating objective.

## Strategy decisions independently reaffirmed

### Phase 2
Reaffirmed: 2x and 3x should be treated as different growth/drawdown frontier points rather than one leverage universally dominating.

### Phase 3
Reaffirmed with caution: Nasdaq Native families did not earn complexity; keeping Common VS13 is the correct simplicity-first outcome. SP_BROAD_TREND is the only S&P Native family worth Forward testing, but its historical strength must not be overstated as independent replication.

### Phase 4
Reaffirmed: reject the dynamic ticker/leverage allocator v1. It is operationally more complex and is dominated by UPRO-SP_BROAD_TREND on the tested primary frontier. Do not rescue the allocator by post-result threshold tuning.

### Phase 5
Reaffirmed: true Forward observation of the four information-efficient frontier points (existing TQQQ plus three new candidates) is the correct next stage.

## Supervisory decision
**PASS WITH EXPLICIT CAUTIONS.**

The current strategy architecture is coherent enough to continue Phase 5 unchanged. No strategy parameter should be modified as a result of this review.

The main protection against the identified model risks is not another historical optimization cycle; it is the already-implemented true Forward / lifecycle / human-approval process.

## Next phase
Phase 2 of this executive review must audit data provenance, adjusted/unadjusted price semantics, split treatment, common-date construction, execution-time causality, cost assumptions, Action-Day definitions, and every numeric gate/parameter used for review or Production eligibility.
