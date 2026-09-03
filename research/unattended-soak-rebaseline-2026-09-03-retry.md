# Unattended soak rebaseline — bounded Daily retries — 2026-09-03

## Purpose

Freeze a new unattended-soak baseline after replacing the single long Daily
recovery gap with bounded three-hour scheduled retries. The change does not
alter strategy parameters, market-data providers, Signal calculations,
execution chronology, append-only ledgers, or Production authority.

## Prior sequence disposition

- `SOAK-2026-09-03-C` is closed prospectively because its Daily workflow
  control plane changed before it completed a countable post-baseline session.
- Its historical evidence is not rewritten, rescued, or inherited.
- The 2026-09-02 provider delay and its original scheduled runs remain visible
  as pre-baseline operational evidence and do not count for the new sequence.

## Replacement sequence

- soakId: `SOAK-2026-09-03-D`
- control-plane baseline: `24ad8f0a68744315fc447f5bea625bfa20bb656e`
- initial state: `COUNTING`
- count: `0/10`
- lastAssessedSession: `null`
- first eligible session: the first NYSE session completed after the baseline

## Bounded retry policy

For every completed Monday-Friday US session, Daily has scheduled attempts at:

- 07:30 JST (primary)
- 10:30 JST
- 13:30 JST
- 16:30 JST
- 19:30 JST
- 22:00 JST (final recovery attempt before the next US open)

GitHub schedule delivery may begin later than the listed cron time. Every run
uses the existing shared serialization and compare-and-swap protections.

At the start of each scheduled run:

- `CURRENT` -> `SKIP_CURRENT`; do not fetch, mutate operational data, run the
  expensive regression suite, commit, or deploy Pages.
- `UPDATE_PENDING`, `DELAYED`, or `INVALID` -> `FETCH_AND_DEPLOY`; retain the
  existing validation, append-only persistence, exact-head, and fail-closed
  deployment pipeline.
- direct/manual refresh -> `FETCH_AND_DEPLOY` but never counts as unattended
  scheduled evidence.
- approved deploy-only workflow call -> `DEPLOY_PERSISTED` and never fetches or
  mutates market data.

Multiple attempts for one market date cannot create duplicate logical Forward
or live-history records. A current-data skip is neither an additional session
pass nor a failure. Any actual failed, cancelled, or timed-out scheduled run
remains visible and is assessed under the existing failure-to-recovery rules.

## Verification frozen before baseline publication

- targeted retry and workflow boundary tests: 26/26 PASS
- operational regression: 293/293 PASS
- full core regression: 329/329 PASS
- GitHub Pages build: PASS
- Production remains `RESEARCH`, `approvedByHuman=false`, with no selected
  Production identity

This record does not certify a session pass or authorize Production.
