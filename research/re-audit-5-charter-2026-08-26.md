# Re-Audit 5 Charter — Unattended Annual Operations and Review Continuity

Date: 2026-08-26
Status: **PRE-REGISTERED BEFORE AUTHORITATIVE AUDIT**

Pre-charter baseline: `01f8828d3e0951e381ca0812bd4f00269d4d1784`.
Governing reliability protocol at start: `research/final-re-audit-protocol-2026-08-26.md`.

## Purpose
Run a fresh independent reliability audit with a different emphasis from Re-Audit 4. The target is not only control-plane correctness at a point in time, but whether the system can remain a trustworthy, free/unattended operating aid across normal market days, exchange closures, review boundaries, year boundaries, data discontinuities, and future Production review cycles.

This round must not be declared CLEAN merely because prior regression suites pass. Direct source/config/state inspection and boundary-focused tests are required.

## User-outcome questions
The audit must answer, with evidence:
1. Can the user leave the system unattended between expected review/action points without silent degradation?
2. Does paper/Forward trading continue to record causally valid observations without retroactive fabrication or duplication?
3. Do interim/formal/stronger reviews actually occur, remain usable before/during/after review, and preserve the incumbent correctly?
4. Can the system operate on the intended free GitHub/Pages architecture without hidden paid-service dependence or unbounded scheduled compute?
5. After a review or eventual human-approved Production change, does the operating guidance remain coherent and continue to use the correct ticker/version/data source?
6. Does the system handle weekends, US exchange holidays, observed holidays, year transitions, DST transitions, and early-close sessions without treating a closed market as missing/stale or creating an illegal execution date?

## Independent inspection scope
In addition to all 12 minimum areas in the governing protocol, Re-Audit 5 adds the following boundary-oriented review.

### A. Review-boundary UI state machine
Inspect the UI immediately before, during, and after INTERIM / FORMAL / STRONGER review states, including:
- current Production incumbent remains distinguishable from a review candidate;
- DECISION does not visually deactivate an incumbent;
- no candidate becomes actionable merely because a review date has arrived;
- stale/failed lifecycle data suppresses action;
- post-review instructions remain meaningful when no candidate is eligible;
- post-approval UI switches all authoritative identity/data-source/holdings guidance to the selected ticker/version;
- cancelled Decision and same-system reaffirmation do not create contradictory labels or reset history unnecessarily.

### B. Data acquisition, continuity, and discontinuities
Inspect:
- provider timestamp/date semantics and latest-bar completeness;
- selected ticker versus proxy/underlying mapping;
- missing symbol, partial multi-symbol update, stale one-leg update, duplicate day, out-of-order day, and provider restatement behavior;
- split/reverse-split handling without history rewrite;
- gaps around long weekends and exchange closures;
- first observation after a closure or data outage;
- forward ledgers never relabel historical BACKFILLED rows as LIVE;
- recovery does not duplicate executions or observations.

### C. Annual market-calendar behavior
Check at minimum:
- weekends;
- standard NYSE holidays and observed dates;
- cross-year New Year handling;
- Good Friday and other non-federal exchange closures;
- Juneteenth historical applicability;
- Thanksgiving/Christmas adjacency;
- DST transitions;
- early-close sessions (for freshness/execution semantics even if intraday timestamps are not traded);
- next legal execution open after consecutive closures.

### D. Unattended workflow survivability
Inspect:
- only bounded operational workflows are scheduled;
- cron timing is appropriate around US market-close/data availability;
- one failed run cannot silently prevent future scheduled runs;
- queue/concurrency rules cannot starve or overwrite authoritative writers;
- retries/reruns remain idempotent;
- expected-SHA protections do not permanently deadlock after legitimate repository changes;
- Pages deployment remains bound to validated state;
- runtime status exposes actionable failure instead of leaving stale green UI.

### E. Paper-trade end-to-end continuity
Trace a complete lifecycle:
market close -> data acquisition -> signal -> intended t+1 legal open -> execution recording -> Forward append -> UI display -> subsequent review aggregation.
Check both no-trade days and target-change days, plus ticker switch semantics where applicable.

### F. Free-operation budget and external dependencies
Inventory scheduled Actions, artifact/deployment behavior, data-provider dependence, Pages/PWA behavior, repository write volume, and any dependency that can invalidate a "free unattended" claim. Distinguish code-guaranteed facts from GitHub/provider policy risks that require monitoring.

### G. Review-after-review continuity
Inspect whether the system remains a usable operating guide after INTERIM, FORMAL, STRONGER, Decision cancellation, Production approval, and subsequent health review. The review mechanism must not be a one-shot terminal state.

### H. Reliability-certification rule review
Evaluate whether "two consecutive clean audits" is a sound software-engineering release criterion for this system. Consider independence, temporal coverage, boundary coverage, operational soak time, fault injection, and external-platform risks. Any proposed governance change must not retroactively convert a dirty round into a clean round or weaken Production/Forward gates.

## Material-finding rule
A finding is material if it can reasonably cause wrong action/guidance, invalid Forward evidence, silent loss/duplication of paper observations, incorrect review timing/state, unsafe behavior around market closures/data gaps, failure of unattended operation, hidden non-free dependence, or loss of correct operation after review/Production transition.

If a material defect is discovered and fixed during this round, Re-Audit 5 remains **NOT CLEAN** and the clean streak is 0/2 under the starting protocol unless a stricter revised protocol is adopted prospectively.

## Required close evidence
Before any CLEAN decision:
- direct inspection of all governing-protocol areas plus A-H above;
- focused new boundary/failure tests added for newly inspected risks where coverage is absent;
- `test:core`, `test:ops`, full application/deployment suite, and lint all pass;
- Pages build passes;
- current Production/Lifecycle/Daily/Forward state remains coherent and non-promoted;
- operational verification causes no ledger/state mutation;
- scheduled workflow inventory remains bounded;
- no new material defect is discovered.

No audit action may promote Production, rewrite Forward history, fabricate LIVE observations, retune frozen strategies, or weaken safety gates to obtain PASS.
