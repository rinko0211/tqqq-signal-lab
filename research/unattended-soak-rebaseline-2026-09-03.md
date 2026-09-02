# Unattended soak rebaseline — 2026-09-03

## Purpose

Start a fresh unattended-soak sequence after correcting the post-close freshness classification. This change does not alter strategy parameters, market data, Signal calculations, execution chronology, append-only ledgers, or Production authority. It changes the monitored control-plane/UI distinction between a normal scheduled publication window and a real missed update.

## Prior sequences

- `SOAK-2026-08-29-A` remains permanently closed with its recorded 2026-08-31 failure.
- `SOAK-2026-09-01-B` is not amended or rescued by this rebaseline. Its evidence and verdict remain isolated.
- No prior count, failure, or date cursor is inherited by the replacement sequence.

## Replacement sequence

- soakId: `SOAK-2026-09-03-C`
- control-plane baseline: `8be45bd9d2687c80fa10af4069e3469144bfb188`
- initial state: `COUNTING`
- count: `0/10`
- lastAssessedSession: `null`

## Freshness classification fixed at this baseline

- `CURRENT`: latest completed NYSE session is present.
- `UPDATE_PENDING`: exactly one newly completed session is missing, the current New York date is a real NYSE session, and the normal Daily publication deadline has not passed.
- `DELAYED`: the deadline has passed with a session still missing, or two or more completed sessions are missing.
- `INVALID`: malformed or impossible market-date evidence.

The browser banner must prioritize the live freshness state. During the normal publication window it displays `PENDING FOR UPDATE` and explicitly says it is not delayed, even if the previously persisted Daily run was successful.

`UPDATE_PENDING` is not a workflow failure and must not close or fail the soak. The prior Signal remains unusable during the pending window, so trading authority remains fail-closed. A real `DELAYED`, failed/cancelled/timed-out required workflow, missing persisted data, failed Pages deployment, authority mismatch, or append-only violation remains a soak failure.

## Evidence rules

Only original scheduled GitHub runs and persisted commits count. Manual runs and later recovery cannot rewrite an earlier failure. A prior soak's evidence cannot alter this soak. The first distinct completed NYSE session after this baseline may count directly as 1/10 when all required Daily, Phase 5, Lifecycle, Pages, authority, and persistence checks pass.
