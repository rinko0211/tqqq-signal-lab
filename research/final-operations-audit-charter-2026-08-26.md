# Final Autonomous Operations Audit Charter — 2026-08-26

## Objective
Validate that TQQQ Signal Lab can operate unattended, make deterministic review judgments at pre-registered review points, tell the user exactly what to do next, support a guarded Forward→Production transition, remain maintainable without ChatGPT Plus, and preserve causal/append-only integrity across market regimes and operational failures.

## Non-negotiable invariants
- Historical research results, Forward ledgers, and prior records are never rewritten.
- Research/Forward/Paper candidates never become Production automatically.
- Human approval is mandatory for Production.
- A signal cannot execute at an open that occurred before the signal was actually recorded.
- Data failure must be visible; stale data must never masquerade as a current signal.
- Review logic is frozen before review outcomes are observed.
- Production changes require a registered Ticker × Strategy × Version and an eligible lifecycle review state.

## Audit phases
1. Repository / operational inventory.
2. Quant governance audit.
3. Unattended-operation audit.
4. Automated Review Engine.
5. User-action / UI audit.
6. Forward→Production transition audit.
7. Free-operation audit.
8. Regime and failure scenario tests.
9. Repository cleanup.
10. Final acceptance audit.

## Phase 5 review schedule
- Interim: 2027-02-25 — informational only; no promotion.
- Formal: 2027-08-25 — first possible Phase 6 / human decision gate.
- Stronger: 2028-08-25 — stronger evidence gate.

## Automated review rules
For each Phase 5 candidate, review must consider at least:
- true live observations only;
- missing/invalid observations <= 1%;
- execution/integrity defects = 0;
- Action Days <= 40/year;
- multiple observed regimes;
- naturally generated non-zero-turnover executions (formal evidence normally requires >= 6; insufficient activity extends Forward rather than being optimized away);
- Forward Max DD not materially outside the frozen historical envelope (historical Max DD minus an additional 10 percentage-point adverse allowance);
- no automatic parameter changes or post-result threshold tuning.

At Interim the only permitted outcomes are CONTINUE_FORWARD or DATA/INTEGRITY_REVIEW_REQUIRED.
At Formal/Stronger, eligible candidates may become PHASE6_HUMAN_DECISION_REQUIRED, but never Production automatically.

## Frozen historical DD references
- TQQQ VS13-v1.0: -38.16%
- QLD-VS13-Scaled-v1.0: -27.05%
- UPRO-SPBT-v1.0: -34.57%
- SSO-SPBT-Scaled-v1.0: -24.16%

## Acceptance gates
All must pass before declaring operational completion:
- Daily Signal autonomous
- Forward append-only
- execution causality
- automated review judgment
- clear user next action
- Forward→Production path
- human-approval safeguard
- post-Production health/revalidation path
- visible data/workflow failure
- GitHub-Free-compatible routine operation
- Pages/PWA deployment
- regime/failure scenarios

A material FAIL blocks completion.