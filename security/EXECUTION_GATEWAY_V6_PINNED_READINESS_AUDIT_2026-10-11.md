# Gateway v6 — pinned operational readiness diagnosis (2026-10-11)

Status: **RESEARCH and read-only only.** This is a diagnostic report, not a signal that PAPER brokerage or live trading has become approved.

## What this adds

`lib/execution-gateway-readiness.mjs` combines existing v3 **read-only public GitHub object verification** of Signal/Status with additional GitHub Contents API reads of three fixed files at the **same immutable, caller-pinned `ops-state` commit**:

- `production-config.json`
- `lifecycle-review.json`
- `phase-5-forward-status.json`

Each file is read by its immutable commit SHA and its decoded bytes are checked against Git blob SHA-1, size, encoding and exact repository path. The v3 source check first requires `main` and `ops-state` ref heads to match **separately supplied, out-of-band pinned SHAs**. No moved branch ref or undocumented fallback is accepted. Failures produce `HALT_RESEARCH_OBSERVATION` and retain `executionAuthority=NONE`.

The pure `assessOfflineGatewayReadiness` evaluates *reported operational consistency*, not trusted market prices: paired VS13 Signal and Status generation; freshness; Research-only Production config; lifecycle stage `ACCUMULATING`; incumbent TQQQ VS13 candidate metrics and explicit upstream reasons; Phase5 forward status and per-ticker date consistency.

When source objects are coherent, it reports **`CONTINUE_FORWARD_RESEARCH_ONLY`** with reasons for missing evidence, regime coverage and the separately outstanding execution prerequisites. **Even if all Forward performance metrics hypothetically become favorable, this module NEVER returns READY/APPROVED or any executable order authority.**

The only possible top-level statuses are `CONTINUE_FORWARD_RESEARCH_ONLY` and `HALT_RESEARCH_OBSERVATION`, both containing `brokerOrderAllowed=false`, `productionPromotionAllowed=false`, `liveTradingAllowed=false` and `executionAuthority=NONE`. No mutable Production state or trading gateway is modified.

## Current real-world context (read from 2026-10-11 ops-state)

`VS13-v1.0` is incumbent TQQQ but **34 Forward observations, 2.86% missing/invalid**, above its existing 1% acceptance bound, and **regimeCoverageOk=false**. Candidate evidence remains `Insufficient`, `eligible=false` and `promotionSelectable=false`. The operational lifecycle is `ACCUMULATING` and `userAction=NONE`. Next interim review: **2027-02-25**.

Normal daily Signal/Phase5 `success` is useful research evidence but **not** sufficient promotion evidence. The original independent C4 ten-NYSE-session unattended test cannot be replaced by P1c's five-session migration observation.

## Manual use

Run in a trusted checkout, without credentials:

```sh
node scripts/gateway-readiness-report.mjs --main-sha=<independently reviewed immutable main SHA> --state-sha=<independently reviewed immutable ops-state SHA>
```

The process uses GET requests to the public GitHub REST API. This is **not a scheduled task**. Do not insert an unverified current SHA as a replacement for independently reviewed trust pins. A scheduled future monitor must have a separately approved source for distributing pins, alert delivery, watchdog and failure policy; this PR does not provide that.

**Important security distinction:** GitHub read-only object verification can confirm the repository's stored bytes, but does NOT independently authenticate upstream Nasdaq/Cboe price history, prove that the VS13 signal's `buildVersion` was produced by today's main commit, or certify NYSE official calendars. C5/v5 signed fixture tests remain non-authoritative. Git SHA-1 here verifies bytes match Git object IDs; it is not an anti-malicious-operator cryptographic trust anchor.

## Blocking external approvals

- Approved and independently authenticated NYSE trading calendar and special closures, with fallback `BLOCK`, not infer.
- Independent issuer identity/root enrollment and expiry/revocation distribution, not local ephemeral fixture signatures.
- Independent paper brokerage **read-only** account, order/position/cash reconciliation and separate authorization.
- Actual multi-worker transactional idempotency/HALT validation; independent ten-session C4 assurance.
- VS13 eligible forward evidence and distinct affirmative Human Production Approval before any live trading discussion.

The report intentionally does not allow these controls to be marked `PASS` via caller-provided flags. Each requires its own reviewed source and release gate.

## Scope and regression

No existing scheduled workflows, PWA, Pages UI, branch protection, Production config, state-plane writers, actual trades, accounts, broker API, data-source contract, or Gold50 Phase C are changed. The only added data path is a standalone read-only inspector.

`tests/execution-gateway-readiness.test.mjs` exercises a test-only mocked GitHub read-only API, immutable pin mismatch, Git blob tampering, incomplete lifecycle, abnormal Production promotion, data freshness and candidate regression, and ensures **no test path ever permits broker orders or Production promotion**.

The tests must pass the existing `P1c Main Protection` full regression and Pages build before merge. Green tests mean only that this **research diagnostic** passes—not that current or future trading is approved.
