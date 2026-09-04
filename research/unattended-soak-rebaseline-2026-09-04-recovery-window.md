# Unattended soak rebaseline — provider recovery window — 2026-09-04

## Purpose

Freeze a new unattended-soak baseline after aligning the browser freshness
classification with the bounded Daily retry window. A single completed NYSE
session that is still absent from the official provider remains
`UPDATE_PENDING` while recovery attempts are still operationally possible. It
must not be presented as an internal delay merely because the first expected
publication time has passed.

The change does not alter strategy parameters, Signal formulas, Production
authority, or historical operational records. Trading remains fail-closed
throughout the pending interval.

## Prior sequence disposition

- `SOAK-2026-09-03-E` is closed prospectively because the availability
  classification changed before its first eligible post-baseline session was
  processed under a stable control plane.
- Its evidence is retained and is neither rescued nor inherited.
- The already-completed 2026-09-03 NYSE session cannot count for the replacement
  sequence because it completed before the replacement baseline was frozen.

## Replacement sequence

- soakId: `SOAK-2026-09-04-F`
- control-plane baseline: `76d5379ebf4a0e1c8e4c530fa98cd14b5157e7f5`
- initial state: `COUNTING`
- count: `0/10`
- lastAssessedSession: `null`
- first eligible session: the first NYSE session completed after the baseline

## Frozen recovery-window rule

- Zero missing completed sessions is `CURRENT`.
- One missing completed session is `UPDATE_PENDING` until the following NYSE
  session opens at 09:30 ET. This covers every bounded Daily retry, including
  the final 09:00 ET recovery attempt.
- One missing session becomes `DELAYED` at the following NYSE open if it still
  has not arrived.
- Two or more missing completed sessions are immediately `DELAYED`.
- Both `UPDATE_PENDING` and `DELAYED` remain ineligible for trading and cannot
  become a soak PASS.

## Verification before baseline publication

- provider/recovery boundary pack: 48/48 PASS
- operational regression: 299/299 PASS
- full core regression: 335/335 PASS
- GitHub Pages build: PASS
- Production remains `RESEARCH`, `approvedByHuman=false`, with no selected
  Production identity

GitHub Daily run `33820962160` validated the new control plane, retained the
official-provider state as pending, and published Pages successfully.

This record does not certify a session pass or authorize Production.
