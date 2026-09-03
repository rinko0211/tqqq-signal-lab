# Unattended soak rebaseline — external provider pending and ordered catch-up — 2026-09-03

## Purpose

Freeze a new unattended-soak baseline after separating an unavailable or stale
official market-data provider from an internal Daily pipeline failure, and after
making permanent missing-session evidence explicit in the incumbent Forward
ledger.

The change does not alter strategy parameters, Signal formulas, Production
authority, or historical operational records.

## Prior sequence disposition

- `SOAK-2026-09-03-D` is closed prospectively because the Daily availability
  and Forward coverage control plane changed before the new baseline.
- Its evidence is retained and is neither rescued nor inherited.
- A session completed before this baseline cannot count merely because its data
  is retrieved after this baseline.

## Replacement sequence

- soakId: `SOAK-2026-09-03-E`
- control-plane baseline: `07f014f0a5d62a2d0906c5aa3a64048377602532`
- initial state: `COUNTING`
- count: `0/10`
- lastAssessedSession: `null`
- first eligible session: the first NYSE session completed after the baseline

## External-data classification

- A successful official response whose common TQQQ/QQQ/SPY/VIX date is stale
  is `PROVIDER_PENDING`, not an internal Daily failure.
- An explicit official endpoint timeout, connection error, HTTP failure, or
  insufficient response is also `PROVIDER_PENDING`.
- Provider-pending state remains fail-closed for trading and is not a soak PASS.
  It is retained as `NOT_COUNTED_EXTERNAL_PENDING`, rather than being silently
  converted to PASS or product failure.
- Malformed parsed data, impossible chronology, ledger corruption, test
  failure, persistence failure, or deployment failure remains a real failure.

## Ordered catch-up

When more than one completed common session becomes available in one later
response, the missing dates are processed once in chronological order. Older
recovered dates are append-only observation evidence and never become
retrospective actionable Signals. Only the newest complete common date is the
displayed Signal candidate. Any permanent interior provider gap is retained as
immutable `SOURCE_DATA_MISSING` evidence so a later real session can still be
processed without fabricating a price or rewriting history.

## Verification before baseline publication

- provider/catch-up boundary pack: 48/48 PASS
- operational regression: 298/298 PASS
- full core regression: 334/334 PASS
- GitHub Pages build: PASS
- Production remains `RESEARCH`, `approvedByHuman=false`, with no selected
  Production identity

This record does not certify a session pass or authorize Production.
