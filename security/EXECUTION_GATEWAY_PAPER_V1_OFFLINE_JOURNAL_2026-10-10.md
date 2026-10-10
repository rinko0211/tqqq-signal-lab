# Execution Gateway v1 — Local offline PAPER journal threat model

Date: 2026-10-10
Status: **RESEARCH, PAPER ONLY, isolated prototype — never a live execution gateway**.

## Purpose and implementation boundary

`lib/execution-gateway-journal.mjs` is an optional, Node-only harness behind the previously merged `evaluatePaperOrderIntent` v0 evaluator. It is **not** imported by the web application or any scheduled workflow. It has no network I/O, broker SDK, credentials, order submission, fill handling, exchange time API or Production approval path.

A newly created *private absolute directory* with `PAPER_ONLY_MANIFEST.json` is required. The manifest pins `PAPER_ONLY`, `brokerOrderAllowed=false` and `executionAuthority=NONE`. A failed storage read/write fails closed.

`reserveOfflinePaperIntent({directory,input,offlineBrokerSnapshot})`:
1. checks the store, sticky HALT marker and v0 source/status/strategy/position/risk gates;
2. checks a *second synthetic mock-broker fixture* for account ID, time, currency, cash, NAV, TQQQ shares and absence of pending orders (this is **not actual broker reconciliation**);
3. generates a deterministic reservation slot from `accountId + strategy + ticker + planned NYSE execution date`, deliberately **excluding target/price** to reject conflicting same-session intents;
4. claims that slot through filesystem `O_EXCL` (`open('wx')`), syncs the file and directory and never deletes the reservation;
5. on an existing slot, verifies digest and structure; exact replay is rejected, conflicting target is rejected, and any corrupt/partially written slot is `UNRESOLVED_JOURNAL_SLOT` (fail closed);
6. rechecks the sticky HALT file and never emits a broker-executable result. Any successful return is `PAPER_RESERVED` with `brokerOrderAllowed=false` and `executionAuthority=NONE`.

`haltOfflinePaperJournal(directory, reason)` writes an irreversible HALT marker with exclusive creation and fsync. There is deliberately **no programmatic unhalt**. A fresh, separately authorized PAPER journal is needed for future tests.

`initializeOfflinePaperJournal` refuses preexisting directories to prevent silent reuse/reset. The journal is intentionally not exposed in the live UI.

## Evidence and tests

`tests/execution-gateway-journal.test.mjs` covers:
- durable dedupe across repeated calls, restart and same-session target changes;
- concurrent multi-promise and independent Node-process claims;
- truncated/tampered records, invalid manifest/storage and no-claim NO_ACTION;
- permanent HALT, invalid/Production authority, stale signal and invalid ticker;
- mismatch in mock broker account, share count, pending order, settled cash, timestamp and provenance.

Tests are included under `test:core` and `test:ops` and must pass the existing `P1c Main Protection` CI.

## Security limitations / non-claims (mandatory)

- This is **single-host, trusted-local-filesystem** admission only. It is **not** distributed exactly-once, independent authentication, signed-order-intent, multi-host consensus, secure enclave, transaction ledger or broker-level idempotency.
- A synthetic mock snapshot is **not** broker-reported cash/order/fill reconciliation. Matching two fixtures is not independent source-of-truth evidence.
- `O_EXCL` supports per-session claim exclusion on a trusted local filesystem, but a concurrently opened unfinished file is **uncertain** until completed. Never treat uncertainty as approval.
- A HALT race can allow a reservation already completed before HALT's visibility; there is **no downstream dispatch at all**, and a final HALT check prevents issuance when observed. This prototype does not prove fully linearizable emergency stopping for future broker orders.
- A local privileged attacker can alter stored records/digests or filesystem contents. A SHA-256 digest detects accidental corruption, **not adversarial tampering**.
- Store corruption, I/O failure or crash during claim creation leaves a durable barrier requiring investigation, not automatic repair or stale-lock deletion.
- No account secrets, no API endpoints, no access tokens, no orders, no auto-FX, no margin or production strategy changes.
- The v0 model clock/calendar evidence remains injected; no independent NYSE trading-calendar authority has yet been implemented.

## Further preconditions before even PAPER broker connectivity

Independent source provenance/signatures bound to `ops-state` SHA, trusted market calendar/open clock, tamper-evident server-side ledger with atomic cross-worker transition state, queued open orders/fills and portfolio reconciliation, authenticated broker read-only connectivity in a separate service, chaos/replay testing and human-controlled global halt are all future separate gated phases.

This work neither satisfies the original 10-session C4 certification nor changes the Lifecycle's `ACCUMULATING / CONTINUE_FORWARD` state. Production remains RESEARCH, `approvedByHuman=false`, and all previously approved autonomous state writers remain unchanged.
