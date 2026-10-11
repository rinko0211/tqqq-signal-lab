# Execution Gateway v4 — issuer revocation & 2026 exchange-calendar parity (2026-10-11)

**Status:** RESEARCH / OFFLINE PAPER FIXTURES ONLY. This is a manually run verifier. It is NOT an approved calendar service, licensed feed, approved certificate authority, independent data issuer or broker trading system.

## Public primary references, checked on 2026-10-11

- [NYSE Holidays & Trading Hours](https://www.nyse.com/trade/hours-calendars) — published NYSE-group holidays for 2026, 2027 and 2028; regular core session 09:30–16:00 ET.
- [Nasdaq Trader — Trading Calendar](https://www.nasdaqtrader.com/Trader.aspx?id=Calendar) — published Nasdaq U.S. equity market 2026 closed dates and early closings.
- [2026 NYSE yearly trading-calendar PDF](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf) — explicitly cautions its dates are subject to change.

**Reviewed 2026 closed dates:** 01-01, 01-19, 02-16, 04-03, 05-25, 06-19, 07-03, 09-07, 11-26, 12-25.
**Reviewed early closes:** 2026-11-27 and 2026-12-24, **13:00 ET**. 2026-10-12 (Columbus Day) is **not a closed exchange session**, despite being a US federal holiday. These are frozen publicly documented **human transcription anchors**, NOT automatically received or authenticated NYSE feed data.

A future ad hoc closure, regulator announcement, altered trading session, NYSE Arca-specific rule or revised exchange schedule is **not guaranteed** to be covered by this fixed 2026 snapshot. Do not use it for trading execution authorization.

## Implemented, no authority

`lib/execution-gateway-trust-audit.mjs` provides `auditOfflineIssuerAndCalendar()`, an optional independent inspection alongside v2/v3, **not imported by live code**.

The offline verifier:
1. Requires a caller-supplied `expectedRegistrySha256`, minimum monotonically increasing registry epoch, full 40-digit code and ops-state SHA pins; these pins **must be verified outside the request**. The registry cannot enroll itself by submitting its own digest.
2. Validates a versioned local PAPER-only issuer registry: separate Ed25519 SIGNAL and CALENDAR roles, distinctive public-key fingerprint and issuer ID, explicit validity windows, ACTIVE state, no revocation, no stale registry or epoch rollback.
3. Requires two manually reviewed NYSE and Nasdaq reference records, from their exact URLs, with strictly bounded freshness (7 days), agreeing with the frozen 2026 holiday and early-close dates.
4. Reconstructs **all** expected 2026 sessions within the signed voucher's coverage span and rejects missing, invented or out-of-order sessions, including Columbus Day and weekends.
5. Delegates cryptographic verification to v2's distinct Ed25519 fixture signatures pinned to the registry keys and exact code/ops-state SHAs. No actual signing key is stored in main; tests generate ephemeral keys only.
6. Returns exclusively `RESEARCH_REFERENCE_PARITY_ONLY` or `REJECTED`, with `authorization=NONE`, `executionAuthority=NONE` and `brokerOrderAllowed=false` in every path. `halted` is **default-deny**, and true/unspecified HALT blocks all verification.

No GitHub Actions permissions, runtime-state files, Pages UI, broker adapter, secrets, schedules, real order intents, strategy, Production state or existing v0–v3 code were changed. Production remains `RESEARCH`.

## Critical non-claims and blockers

A recorded source URL and manual-transcribed reference are **not authenticated proof** of the content currently served by that host. They cannot detect an unexpected new closure until a human refreshes and independently verifies source changes. The registry trust root is an **assumed out-of-band pin**; passing a matching digest created by the same potentially malicious caller is not independent trust. The fixture keys are not independently enrolled signers.

The tests do NOT certify market-open status, time synchronization, issuer revocation distribution, an enforceable live global kill switch, signing-key lifecycle in a trusted authority, official exchange machine-data licensing, broker reconciliation, or reliable multi-host exactly-once orders.

**Future admission prerequisites:** official authenticated/contract-approved machine calendar or equivalent independent issuance; published immutable review record and key-enrollment approvals; key rotation and revocation push/poll with maximum time to deny; NYSE/Nasdaq calendar versioning and exact instrument-specific venue trading-hours authority; unscheduled closure outage fail-closed; signed generation/source Git provenance; durable transactional idempotency and broker paper soak. Only then may a separately approved **paper** connectivity phase be proposed. Real orders remain prohibited without sufficient Forward evidence and distinct explicit Human Production Approval.

## Regression

`tests/execution-gateway-trust-audit.test.mjs` covers 31 deterministic positive/negative offline cases and is included in `test:core` and `test:ops` under `P1c Main Protection`. No live exchange or broker access is attempted by CI. Green tests **must not** promote any authority.

**The original 10-session C4 assurance and the five-session post-P1c observation are distinct. This change asserts neither C4 certification nor execution readiness.**
