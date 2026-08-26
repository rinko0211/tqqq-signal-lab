# Executive Final Review — Phase 4: User-Facing Operations / PWA

Date: 2026-08-26
Status: **PASS — FINAL UI SAFETY CONTROLS ACCEPTED**

## Scope
Audit the application from the perspective of a user returning after weeks or months. The operational UI must make five things unambiguous:
1. what to do now;
2. whether the system is healthy;
3. which ticker/version the instruction applies to;
4. when the next human decision is required;
5. whether performance is modeled Forward/Paper evidence or real brokerage-account performance.

## Major findings and remediation

### 1. Operational eligibility was visually conflated with Production selection — FIXED
Lifecycle distinguishes:
- `eligible`: enough operational/evidence integrity to enter formal review;
- `promotionSelectable`: eligible and not strictly dominated by the incumbent on frozen common-period Forward Pareto dimensions.

The Review UI uses `promotionSelectable` for Production input candidates and explicitly states:
`Operationally eligible ≠ Production-selectable`.

### 2. Tiny-sample Action/year annualization could mislead — FIXED
`Action/y` is hidden until at least 63 LIVE observations exist. Raw executions/actions remain visible.

### 3. Raw regime-label counts did not reflect the authoritative semantic gate — FIXED
The Lifecycle table shows semantic regime families and formal coverage. Legacy raw-regime evidence is labeled as a reference track, not the Production authority.

### 4. Formal Production and the operational TQQQ baseline were visually conflated — FIXED
Before explicit Human Approval the UI says Operational Baseline / Research. Only a valid human-approved `PRODUCTION` configuration renders Formal Production / Human Approved.

### 5. Modeled Forward balances looked like realized JPY account performance — FIXED
Primary Forward comparisons now use a **Model Index with start = 100** rather than presenting normalized model capital as a real yen balance.

The UI explicitly states that Forward excludes:
- USD/JPY return;
- tax;
- broker-specific realized execution friction.

Paper Trading can retain JPY display because it is a user-configured virtual account with a fixed FX rate, but the UI labels it as a fixed-FX comparison model, not actual after-tax brokerage P/L.

### 6. Future Production ticker switches could reuse a TQQQ holding ratio — FIXED
Device-local holdings were originally not bound to ticker/version. A future TQQQ → UPRO/SSO/QLD Production transition could therefore misinterpret a stored TQQQ ratio as the new ticker's holding ratio.

Remediation:
- saved holdings are tagged with active ticker and strategy version;
- ticker/version mismatch invalidates the old holding input for action sizing;
- the UI explicitly says old-ticker holdings are not reused;
- the user is instructed to enter the new ticker's current holding state;
- no cross-ticker sell/buy quantity is automatically invented.

### 7. Primary action could remain actionable when Daily data was stale/failed — FIXED
A warning banner alone is insufficient.

Remediation:
- stale market data or failed Daily state makes the primary instruction fail closed;
- the main action becomes `売買しない・System Status確認`;
- increase/reduce instructions are suppressed until safe data is available.

### 8. Integrated dashboard could continue showing TQQQ Forward evidence after a future Production switch — FIXED
The dashboard now uses the matching Phase 5 Forward summary when a Phase 5 finalist becomes Formal Production. Before that, TQQQ VS13 remains the Operational Baseline reference.

### 9. Legacy TQQQ review dates could be mistaken for the integrated approval gate — FIXED
Authoritative user-decision dates are Lifecycle dates:
- 2027-02-25: Interim, no Production promotion;
- 2027-08-25: Formal, first possible Phase 6 human decision;
- 2028-08-25: Stronger review.

Older TQQQ-track dates are labeled `Legacy checkpoint` and are not Production approval gates.

### 10. Production Registry could be mistaken for current eligibility — FIXED
The Registry is explicitly described as the technical set of registered frozen versions. Only versions shown as `Production-selectable` in `Review / 次のAction` may be used for a current Phase 6 Production decision.

### 11. Phase 5 subsystem “latest date” used the newest individual input — FIXED
The status card uses the minimum/common latest date across required inputs so one lagging required series cannot be hidden by a newer unrelated input.

### 12. 8.67% wording could imply an optimized stop — FIXED
Research Lineage identifies the 2x 8.67% stop as a mechanical leverage-scaling hypothesis and not a proven optimum.

## Production decision UX
At a valid Formal/Stronger gate:
1. Lifecycle automatically checks operational eligibility;
2. common-period Pareto evidence determines whether a challenger is Production-selectable or strictly incumbent-dominated;
3. the user opens `Review / 次のAction`;
4. enters DECISION;
5. selects one Production-selectable system, including retaining the incumbent;
6. enters the exact Ticker / Strategy / Version and `APPROVE PRODUCTION`;
7. the approval script rechecks fresh Lifecycle evidence and the frozen version;
8. only then can Daily Signal enter Formal Production mode.

No automatic Champion or strategy replacement exists.

## Validation evidence

### Main Phase 4 audit
Run `32927149335`, job `98052237082`: **SUCCESS**.

### Baseline/Production label consistency
Run `32927274638`, job `98052589885`: **SUCCESS**.

### Final UI safety acceptance
Run `32927856535`, job `98054229958`: **SUCCESS**.

The final acceptance successfully completed:
- guarded/idempotent migration;
- changed-file boundary audit;
- UI safety assertions plus full operational regression;
- normal application build;
- GitHub Pages build;
- rendered/deployment contract tests;
- persistence of only tested UI changes.

`tests/executive-ui-semantics.test.mjs` is permanently included in `test:core` and `test:ops`.

Temporary audit/migration workflows and scripts are removed after successful persistence; permanent safety assertions remain in the normal regression suite.

## Current ordinary-operation semantics
- Current TQQQ VS13 is the Operational Baseline while platform mode remains RESEARCH.
- Phase 5 UPRO / SSO / QLD are research observations, not current trade instructions.
- Normal healthy periods can require no user action.
- Stale/failed data produce an explicit no-trade instruction.
- Ticker changes force holdings re-entry rather than reusing a previous ticker's local value.
- The Review tab is the authority for 6/12/24-month user decisions.

## Residual UI limitations
1. The app is not connected to a broker; actual shares, tax lots, cash, FX and fills remain manual inputs/verification.
2. Exceptional ETF structural events can require manual review even when market data is technically available.
3. Early Forward performance remains too short for meaningful ranking; visual guardrails reduce but cannot eliminate user anchoring on short-term return.
4. A browser can keep an old tab open; visible data dates, stale checks and Lifecycle status remain the authority.

## Supervisory decision
**PASS.**

The application now provides a sufficiently clear and fail-closed user path for unattended operation, review-time human control and eventual Production ticker transition without silently reusing incompatible holdings.

## Next phase
Executive Phase 5 will audit unattended/free operation and maintenance burden:
- scheduled workflow surface / Actions load;
- trigger loops and concurrency;
- data-source and paid-service dependencies;
- Pages/PWA resilience;
- timeout / retry / failure visibility;
- unnecessary historical computations in the daily path;
- realistic maintenance requirements without ChatGPT Plus.
