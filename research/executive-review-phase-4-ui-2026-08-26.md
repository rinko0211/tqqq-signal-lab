# Executive Final Review — Phase 4: User-Facing Operations / PWA

Date: 2026-08-26
Status: **PASS**

## Scope
Audit the deployed application from the perspective of a user returning after months away. The UI must not require the user to remember research history or infer whether a displayed candidate is actionable.

## Major findings and remediation

### 1. Operational eligibility was visually conflated with Production selection — FIXED
The old Review table could expose every `eligible` challenger as a Production input candidate.

The Lifecycle model already distinguishes:
- `eligible`: enough operational/evidence integrity to enter formal review;
- `promotionSelectable`: eligible and not strictly dominated by the incumbent on the common-period Forward Pareto dimensions.

The UI now uses only `promotionSelectable` for Production input candidates.

It explicitly states:
`Operationally eligible ≠ Production-selectable`.

### 2. Tiny-sample Action/year annualization could mislead — FIXED
A few observations and one action can produce an absurd annualized rate. `Action/y` is now hidden until at least 63 LIVE observations exist. Raw execution/action counts remain visible.

### 3. Raw regime-label counts did not reflect the authoritative semantic gate — FIXED
The Lifecycle table now shows semantic regime families and whether formal coverage is satisfied. Legacy Forward raw-regime evidence is clearly labeled as a legacy/reference track rather than the Production authority.

### 4. Formal Production and the operational TQQQ baseline were visually conflated — FIXED
When `production-config` is not `PRODUCTION` with explicit human approval, the dashboard now says:
- `OPERATIONAL BASELINE · NOT FORMAL PRODUCTION`
- `BASELINE`

Only a human-approved Production configuration renders the formal `PRODUCTION` label.

### 5. Modeled balances looked like realized JPY account performance — FIXED
Forward/Paper balances are now explicitly described as JPY-normalized comparison balances / virtual accounts.

The UI states that the model excludes:
- USD/JPY return;
- tax;
- broker-specific realized execution friction.

Paper display using a fixed FX rate is also labeled as a comparison model, not a real yen-denominated brokerage result.

### 6. Phase 5 subsystem “latest date” used the newest individual input — FIXED
The status card previously used the maximum date across required inputs. It now displays the minimum/common latest date, which is the safer representation when one required series lags.

### 7. 8.67% wording could imply an optimized stop — FIXED
Research Lineage now labels the 2x 8.67% stop as a mechanical scaling hypothesis and explicitly says it is not proven optimal.

### 8. Old Deployment regression expectations no longer matched the current architecture — FIXED
The stale tests were not simply removed. They were replaced with current invariants:
- legacy UPRO Track B must be manual-only and consume no daily schedule;
- the cross-ticker screen must contain the four Core ETFs and preserve `Actual ETF OHLC only` rather than depending on a brittle historical count of five rows;
- Production approval tests now verify Lifecycle freshness, Formal/Stronger stage, Phase 6 human-decision state, allowed-version gating and exact human confirmation.

## Validation

### Main Phase 4 audit
Workflow run: `32927149335`
Job: `98052237082`
Conclusion: **SUCCESS**

Passed:
- guarded UI patch;
- changed-file boundary audit;
- focused lifecycle/control tests;
- full `test:ops` regression;
- full application build;
- Pages build;
- deployment contract tests;
- rendered HTML tests;
- critical wording assertions;
- persistence to main.

### Final label consistency check
Workflow run: `32927274638`
Job: `98052589885`
Conclusion: **SUCCESS**

Passed:
- operational regression;
- Pages build;
- explicit BASELINE / PRODUCTION mode-aware label assertions.

Temporary audit workflows and patch scripts were removed after successful persistence. Permanent production/deployment tests remain in the normal test suite.

## Current user-facing semantics

### Today / ordinary operation
- Daily TQQQ is the operational baseline unless a formal Production mode has been human-approved.
- Phase 5 UPRO / SSO / QLD are research observations, not current trade instructions.
- A stale Lifecycle review invalidates any old “no action required” message.

### Formal review
The Review screen presents:
- operational gate;
- Promotion merit;
- common-period Pareto context;
- LIVE observations;
- executions;
- semantic regime families;
- sample-qualified Action/year;
- Total Return;
- Max DD;
- Sortino;
- Calmar.

### Production decision
Only `promotionSelectable` systems are displayed as Production inputs. The incumbent can remain selected. No automatic winner or automatic strategy replacement exists.

### Modeled performance warning
Displayed Forward/Paper yen amounts are comparison-model values and must not be interpreted as realized after-tax JPY brokerage performance.

## Residual risks
1. The PWA cannot guarantee a user has entered their real holdings accurately; device-local holdings remain a manual input.
2. Actual broker fills, tax, FX, spread/market impact and exceptional ETF structural events require human verification when relevant.
3. Early Forward performance remains too short for annualized ranking; UI suppression reduces but cannot eliminate user anchoring on short-term Total Return.
4. Browser/PWA caching is controlled for data JSON, but a user can still keep an old tab open; visible data dates and Lifecycle freshness must remain the authority.

## Supervisory decision
**PASS.**

The application now distinguishes research, operational baseline, formal Production and user action with materially lower ambiguity.

## Next phase
Executive Phase 5 will perform the final system acceptance audit:
- active workflow inventory / accidental heavy Actions;
- repository cleanup and permanent-test coverage;
- current status / Forward evidence / next required user action;
- Production approval bypass attempts;
- end-to-end fail-safe and recovery path;
- final residual-risk register and operational handoff.
