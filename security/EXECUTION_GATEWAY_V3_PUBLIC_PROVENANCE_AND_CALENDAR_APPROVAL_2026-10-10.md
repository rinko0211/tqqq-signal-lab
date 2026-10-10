# Execution Gateway v3 — Public GitHub provenance observer and issuer enrollment plan

Assessment date: 2026-10-10
Authority: **RESEARCH / READ-ONLY**, not a live/paper broker, not a production execution gateway.

## What's implemented

`lib/execution-gateway-github-audit.mjs` is a **manually invoked standalone Node module**, not imported into the PWA, any scheduled workflow, or any broker adapter.

With both the `main` and `ops-state` 40-character commit SHAs **pinned independently before the check**, `inspectGitHubReadOnlyEvidence` makes allowlisted, unauthenticated HTTP **GET** requests only to the public GitHub REST API at `api.github.com/repos/rinko0211/tqqq-signal-lab`:

1. Read fixed `main` and `ops-state` branch refs; fail if either has changed from independently supplied pins.
2. Read the `ops-state` immutable Git commit and its tree.
3. Walk `github-pages/public/data` using immutable Git tree object IDs; reject missing, duplicate, truncated or symlinked entries.
4. Read `signal.json` and `status.json` by their immutable **Git blob hashes**, recomputing Git's `SHA-1("blob <len>\0" + bytes)`. Reject altered Base64 data, bad sizes and mismatched hashes.
5. Validate the paired timestamps, market-data date, strategy, ticker, RESEARCH state, latest status and absence of declared operational errors.
6. Return only `READ_ONLY_OBSERVED`, with both code/state refs and exact blob hashes, and hard-coded `executionAuthority=NONE` and `brokerOrderAllowed=false`. No order-intent issuance occurs.

The optional `corroborateReadOnlySourceWithOfflineProof` checks this GitHub observation against the **existing v2, separately pinned, dual-signed offline-fixture proofs**. Only `CORROBORATED_RESEARCH_ONLY` may result; this is not order authority and does **not** authenticate a real third-party calendar issuer.

**Important distinction:** GitHub validates its own repository object graph and supplies a historical snapshot of the Signal Lab project's state. It is **not a source independent of the project's code owner for trading decisions**, and its data are not signed by Nasdaq, Cboe or the NYSE. Public Git SHA-1 integrity checks do not solve the separate issue of who authorized a price, date, strategy or order. The optional v2 signing keys are locally generated fixtures, not deployed trusted issuer keys.

The `status.json` `buildVersion` is a historical generation-code **prefix**, not necessarily today's `main` commit. The observer reports it without falsely treating current main as the code that generated that signal. Historical generation-code ancestry/provenance requires a future separate review.

### Manual audit example

A standalone read-only consumer can import `inspectGitHubReadOnlyEvidence` and supply previously verified exact SHAs from an independent review. Do **not** obtain SHA pins solely from the same untrusted request and then claim they were independently trusted. If refs change, the inspection must fail closed; no automatic pin update or silently accepted fallback is permitted.

The module contains a fixed URL/path allowlist, uses no authentication header, disables redirects, and never writes Git objects. GitHub API rate limits or provider errors produce `GITHUB_PROVENANCE_UNVERIFIED` rather than synthesized data.

## NYSE calendar sourcing: approval is still BLOCKED

Authoritative published source for market holidays, hours and early closures:

- <https://www.nyse.com/trade/hours-calendars>
- NYSE's annual public trading calendar: <https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf>

This provides useful **publicly documented human-verifiable reference data**, but a verified official schedule webpage or PDF is **not** by itself an authenticated, machine-readable, continuously synchronized calendar feed or a signed issuance channel for the gateway. Dates may be revised, including unscheduled full-market closures. No scraping, HTML parsing, implicit holiday formula, estimated hours or fixture-to-real auto-promotion may be used to authorize trades.

Before switching the v2 calendar proof from `OFFLINE_CALENDAR_FIXTURE`, require documented issuer/license review, an approved stable authoritative machine-readable endpoint or explicit authenticated issuance workflow, cache/TTL policy, current full/early-close/one-off-closure coverage, reconciliation against the internal NYSE calendar, revocation/reissue procedure, and outage behavior `BLOCK`. This is not yet approved or implemented.

## Trust and key enrollment for future phases (not implemented)

- Establish independent out-of-band trust registry for issuer keys and SHA pin publication, approval dates, expiration, rotation, revocation and audit trail.
- Implement and independently test authoritative GitHub data collection (code/data generation lineage) before producing any signature; no trusted private keys in Signal Lab repository or Actions secrets without separate authorization.
- For actual exchange calendars, issuer authentication must be independent of the Signal Lab operator; merely signing a manually supplied fixture proves only that fixture's integrity.
- A multi-worker transactional gateway/order journal, actual read-only brokerage position reconciliation, signed broker intent and emergency HALT linearization are separate future phases.

## Tests and merge restrictions

`tests/execution-gateway-github-audit.test.mjs` covers changed refs, bad commit/tree/blob objects, fake content, bad upstream status, missing pins, unavailable API, absence of signed proof, mismatched proofs and a valid **synthetic** corroboration. The test suite uses injected mocked HTTP responses only; CI does **not** access a real data provider or broker.

`P1c Main Protection` must pass before Squash Merge. **No new workflows**, no state plane writes, no production authorities, no trading secrets, no calendar feed switch, no code changes to existing v0/v1/v2 evaluators and no C4 10-session certification claim.
