# Gateway v5 — Official-publication drift and offline two-reviewer change control

Date: 2026-10-11. State: **RESEARCH_ONLY; not approved for market execution or broker PAPER connectivity.**

## Scope

This PR adds **two standalone, manually invoked** Node modules. They are not imported into the PWA, schedules, approved state writers, brokerage apps or order-routing code. They do not write to GitHub, the filesystem, market data, or any broker. They grant no authority.

### 1. Public-source byte-change detector

`lib/execution-gateway-publication-watch.mjs` allows exactly two public HTTP(S) GET URLs, redirects disabled:

- https://www.nyse.com/trade/hours-calendars
- https://www.nasdaqtrader.com/Trader.aspx?id=Calendar

Its only objective is to flag **any raw-byte change** relative to a previously reviewed SHA-256 pair in an **externally pinned baseline**. The baseline includes exact source URLs, reviewed timestamp and a seven-day maximum lifetime. It rejects stale, absent and modified baseline pins; network errors, HTTP non-200, redirected responses, empty pages and bodies exceeding 2 MB. The returned classifications are `UNCHANGED_PUBLICATION_RESEARCH_ONLY`, `SOURCE_CHANGE_REVIEW_REQUIRED`, or `REJECTED` with **`executionAuthority=NONE` and `brokerOrderAllowed=false`** in all cases. HALT is default-deny.

A changed page MUST require human verification against the venue's official schedule and any announcements. It does not mean a trading-day change; normal HTML content, ads, analytics or a redesigned page may produce a **false-positive alert**. An unchanged page proves only matching bytes, **not** that official emergency closures, exchange instruments, or broker sessions are safe. The module does not scrape or parse HTML to extract holidays. No source fingerprint is auto-baselined; an independently vetted new pin is mandatory.

No background scheduler, monitor, alert delivery or credential-based API is installed. Real-site fetches are only possible if a caller explicitly invokes the module. Tests use mocked fetch streams only.

Published facts: NYSE and Nasdaq list ten 2026 U.S. equity market closed dates and the early closes November 27 / December 24, 2026, at 13:00 ET. Nasdaq explicitly warns that subsequent alerts can amend systems and closing times. Sources are public informational pages, **not signed machine-readable market-authority feeds**.

### 2. Two-reviewer change proposal

`lib/execution-gateway-change-review.mjs` records a **TEST-ONLY proposal review** for issuer revocation, offline test-key rotation or source-baseline review. It is NOT key activation, revocation distribution, source acceptance, or a production authorization service.

The proposal cryptographically binds the expected SHA-256 of the current and next PAPER-only issuer-registry fixtures, exactly consecutive registry epochs, change type, explanation, proposedAt and maximum 24-hour expiry. Independently pinned SHA-256 trust roots for the current registry **and reviewer roster** are mandatory and cannot be self-issued in a production security interpretation.

Two detached domain-separated Ed25519 signatures are verified for distinct active, unrevoked, unexpired `SECURITY_REVIEWER` and `DATA_REVIEWER` roles with distinct public-key fingerprints and key IDs. Missing, forged, replayed-on-altered-proposal, swapped or expired approvals are rejected. All results, even successful review, are `approvedForActivation=false`, `executionAuthority=NONE`, `brokerOrderAllowed=false`. No private keys are stored in the repository; all tests use freshly generated temporary keys.

This is an isolated **simulation** of a multi-person control. No actual humans, approvals, identity provider, secure key custody, external certificates or operator-independent roots have been enrolled. A malicious actor who controls the *out-of-band trust pins* can choose their own approvers; this code does not resolve that trust-bootstrapping problem. A proposal with two valid signatures still changes **nothing**.

### Required future work, not authorized by this PR

1. Independent operator-approved trust registry and reviewer onboarding, secure private-key custody, revocation propagation, audit retention and key rotation.
2. Authenticated official calendar issuer or contract-approved machine-readable venue data; tested one-off closures and early closes; venue-specific instrument authority and safe outage policy.
3. Actual manual source review evidence with immutable signed baseline and a time-stamped change/alert trail; production-grade robust bounded-time fetch path and required change notification.
4. Authenticated read-only broker test account and real balance/positions/orders reconciliation **as separate future PAPER approval**, not now.
5. Multi-worker ledger, order-state reconciliation, HALT linearizability, paper soak and independent security certification.
6. VS13 Forward evidence sufficiency and explicit separate human Production Approval before even evaluating live execution.

### Regression and merge conditions

`tests/execution-gateway-publication-watch.test.mjs` and `tests/execution-gateway-change-review.test.mjs` are deterministic offline tests with mocked HTML responses and ephemeral test keys. Both are included under `test:core` and `test:ops` in `P1c Main Protection`. No live requests are made by CI. Nothing in v0–v4 or the authoritative `ops-state` writers is altered. The original 10-session C4 requirement remains separate and is NOT certified by this PR.

**Stop / fail closed** if publication changes, a reviewer is revoked, source capture fails, baseline expires, registry epoch rolls back, or out-of-band pin verification is unavailable. No automatic fallback or authorization.
