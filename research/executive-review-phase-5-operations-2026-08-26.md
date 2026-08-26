# Executive Final Review — Phase 5: Unattended / Free Operation / Maintenance

Date: 2026-08-26
Status: **PASS FOR FORWARD OPERATION — MATERIAL REMEDIATIONS APPLIED; FINAL CERTIFICATION DEFERRED TO RE-AUDIT**

## Scope
Audit the system as an unattended public GitHub Pages + Actions application, with emphasis on:
- recurring workflow surface and accidental Actions load;
- separation of historical research from routine operations;
- data-provider scope and failure visibility;
- Forward append-only integrity;
- future non-TQQQ Production operation;
- workflow chaining and GitHub `GITHUB_TOKEN` behavior;
- Pages/PWA deployment;
- maintainability without ChatGPT Plus or paid APIs.

## Current recurring surface
Only three workflows are scheduled:
1. Daily Signal — post-close and pre-open recovery.
2. Phase 5 Forward — post-close and pre-open recovery.
3. Autonomous Lifecycle Review — once daily.

Phase 1, Phase 1.5, Phase 2, Phase 3, Phase 4, Historical Quant Research and Legacy UPRO Forward are `workflow_dispatch` only.

## Material issues found and remediated

### 1. Daily operation was re-running historical WF/OOS research — FIXED
`generate-daily.ts` previously ran Walk-Forward and fixed OOS calculations on every routine Daily invocation even though those outputs do not determine the frozen live signal.

Remediation:
- removed `walkForward()` and `fixedOos()` from Daily generation;
- Daily now performs frozen signal calculation, append-only live/Forward update and operational state generation only;
- historical research remains available in research paths and full core tests.

This reduces routine compute and avoids continuing to mine the same history during true Forward observation.

### 2. Future non-TQQQ Production would fetch the entire historical research universe — FIXED
The prior Daily path used `includeCross=true` for a non-TQQQ Production ticker, which also fetched SOXL/USD/TECL/ROM/TNA and other closed research-universe series.

Remediation:
- added bounded Formal Production data acquisition;
- Daily fetches only the TQQQ/QQQ incumbent baseline plus the selected Production ticker/proxy, SPY and VIX;
- closed research-universe tickers are not fetched in routine Production operation.

### 3. Initial bounded-fetch design could have contaminated the immutable TQQQ incumbent Forward after a Production ticker switch — FOUND BEFORE ACTIVATION AND FIXED
A first bounded implementation mapped the selected Production ETF into the generic TQQQ series. If UPRO/SSO/QLD had already been Formal Production, the legacy TQQQ incumbent Forward could then have been updated with the wrong ETF price series.

No live contamination occurred because platform mode remained `RESEARCH` and the bounded non-TQQQ path was never active.

Remediation:
- bounded Production payload always retains real TQQQ and QQQ baseline series;
- selected Production ticker/proxy are carried separately in `crossSeries`;
- Daily Production signal uses the selected ticker dataset;
- incumbent TQQQ Forward remains sourced from actual TQQQ.

A permanent regression test now guards this separation.

### 4. Human Approval incorrectly relied on a `GITHUB_TOKEN` push recursively triggering Daily — FIXED
The prior approval workflow committed `production-config.json` with `GITHUB_TOKEN` and assumed that push would trigger `Daily TQQQ Signal`.

GitHub documents that, except for explicit dispatch events, events created by a repository `GITHUB_TOKEN` do not create new workflow runs. Therefore the old assumption could leave the configuration in Production while the live Signal still represented the old ticker until the next scheduled Daily run.

Remediation:
- `daily-signal.yml` is now a reusable `workflow_call` workflow;
- `approve-production.yml` explicitly calls Daily after the approval commit;
- the called Daily workflow re-fetches data, resolves the approved frozen Ticker × Strategy × Version, runs operational tests, persists live state, builds Pages and deploys;
- no PAT, paid service or extra external secret is required.

Reference: https://docs.github.com/en/actions/concepts/security/github_token

### 5. Lifecycle push chaining also relied on behavior that bot commits do not provide — FIXED
Lifecycle no longer describes bot-created data-file pushes as its authoritative immediate path.

Remediation:
- the once-daily schedule is explicitly the authoritative autonomous review path;
- manual `workflow_dispatch` remains available;
- workflow-file push exists only as a maintenance self-test trigger.

### 6. Routine workflow trigger surfaces were too broad — FIXED
Code, tests and historical research file changes could trigger Daily/Phase5 work that should be schedule-driven.

Remediation:
- Daily push trigger is limited to manual/user-authored Production config changes and workflow maintenance;
- Human Approval uses explicit workflow call rather than relying on push;
- Phase 5 true-Forward observations are schedule-driven; research/code pushes do not create Forward observations;
- Lifecycle is schedule-driven.

### 7. Recurring GitHub Actions used older Node-action majors — FIXED FOR ROUTINE PATHS
Recurring Daily, Phase5, Lifecycle and Human Approval now use current `checkout@v7` and `setup-node@v7`. Routine Pages paths use `configure-pages@v6`, `upload-pages-artifact@v5`, and `deploy-pages@v5`.

Closed manual-only historical workflows still use older majors. This is a maintenance item only when those archived research workflows are intentionally rerun and is not part of routine unattended operation.

## Permanent regression guards added
`tests/operational-separation.test.mjs` is included in both `test:core` and `test:ops` and guards at least:
- no Daily Walk-Forward/fixed-OOS rerun;
- bounded non-TQQQ Production data fetch;
- independent real-TQQQ incumbent series after ticker transition;
- shared NYSE calendar use;
- Production UI state based on explicit mode + human approval;
- Human Approval explicitly invoking Daily rather than relying on recursive push;
- autonomous Lifecycle schedule remaining present.

## Authoritative final Phase 5 evidence

### Daily
Run **32939003892** — **SUCCESS**
- checkout/setup-node current majors;
- data fetch and signal generation;
- operational regression;
- append-only persistence;
- Pages build/deploy;
- failure-marker enforcement.

### Lifecycle
Run **32939095985** — **SUCCESS**
- hardened lifecycle/regime/health acceptance tests;
- lifecycle judgment generation;
- Production health generation;
- append-only persistence;
- Pages build/deploy with current Pages actions.

### Phase 5 Forward
Run **32939281005** — **SUCCESS**
- updated `test:ops`, including explicit Production-refresh and bounded-data guards;
- true Forward generation;
- append-only persistence;
- integrated Pages build/deploy;
- final success enforcement.

## Current operational state
At Phase 5 close:
- platform mode: `RESEARCH`;
- human-approved Production: `false`;
- Lifecycle stage: `ACCUMULATING`;
- system decision: `ACCUMULATING`;
- user action: `NONE`;
- next review: `2027-02-25`;
- Phase 5 candidate observations: 1 each as of the current common Forward date;
- candidate evidence: `INSUFFICIENT`;
- no candidate is Production-selectable.

This is the correct state. No Production promotion was attempted.

## Free-operation assessment
The repository is public and uses standard GitHub-hosted runners. GitHub documentation states standard GitHub-hosted runners are free and unlimited for public repositories. GitHub Pages is available for public repositories on GitHub Free.

References:
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

No ChatGPT Plus, paid market-data API, server or database is required for routine operation.

## Residual unattended-operation risks
1. Nasdaq/Cboe public endpoints can change format, throttle or fail.
2. GitHub scheduled workflows are best-effort and can be delayed under load.
3. GitHub documents that scheduled workflows in a public repository may be disabled after 60 days without repository activity. A fully disabled scheduler cannot self-repair; manual re-enable is an external platform limitation.
4. GitHub Pages/Actions can have outages.
5. Archived manual-only research workflows still use older action majors and may require maintenance before a future intentional rerun.
6. Broker fills, tax, FX and exceptional ETF structural events remain outside fully autonomous observation.

References:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows

## Supervisory decision
**PASS FOR CONTINUED PHASE 5 TRUE-FORWARD OPERATION.**

There is no current operational blocker after remediation. However, this audit found multiple material control-plane defects, including one that could have caused cross-ticker Forward contamination after a future Production transition and one that could have left approved Production configuration out of sync with the live Signal.

Therefore this PASS is **not a final reliability certification**. Final certification is explicitly deferred until the requested repeated re-audit protocol is completed with two consecutive audits that discover no new material file/control defect.

## Next phase
Proceed to Executive Phase 6 final-responsibility acceptance. Phase 6 may approve continued Forward operation and the architecture of the future human-gated Production path, but it must not override the re-audit requirement or promote any current candidate.
