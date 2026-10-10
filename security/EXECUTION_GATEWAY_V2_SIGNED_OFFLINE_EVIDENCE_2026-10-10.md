# Execution Gateway v2 — Signed offline evidence boundary

Date: 2026-10-10
Disposition: **RESEARCH / OFFLINE PAPER FIXTURE ONLY**, no orders, no broker authority, no deployment.

## Purpose and limitations

`lib/execution-gateway-evidence.mjs` introduces two separately pinned, detached Ed25519 **verification-only** channels in front of the unchanged v1 local PAPER reservation journal.

**Neither signature is issued by GitHub, the NYSE, nor a licensed market-data provider.** The test harness generates ephemeral keypairs; no persistent signing key, brokerage secret, trusted certificate or production authority is committed. This module must **not** be described as verifying live GitHub provenance, official NYSE calendars or actual order eligibility.

### Source evidence

The Signal proof signs, with explicit domain separation (`TQQQ-PAPER-GATEWAY-V2:SIGNAL:`), the canonical JSON including:

- Strict `PAPER_ONLY` schema version and unambiguous `origin` identity;
- Frozen repository `rinko0211/tqqq-signal-lab`, branch `ops-state`, asserted 40-digit state and code SHAs (caller must pin expected hashes **out of band**);
- Full Signal/Status/session objects, matched exactly to the consumer input;
- Signed expiration time.

These SHAs are **signed claims, not independently fetched git object proofs**. A later phase must independently fetch authoritative objects and verify the signed immutable generation, status, hash provenance, full DAG, and issuer enrollment. A public key delivered in the same untrusted request provides no security; the root must be independently pinned.

### Calendar evidence

A **different Ed25519 key** signs the domain-separated `TQQQ-PAPER-GATEWAY-V2:CALENDAR:` voucher: XNYS, fixture source label, inclusive coverage, a strictly increasing session list, and expiration. The gate rejects weekend entries, nonsensical/missing coverage, expiry, and any proposed execution date that is not **immediately after** the source Signal date in the signed session list.

This is a useful independence and tampering test, **not** an authoritative calendar. There is no independently contracted provider, authenticated real-world holiday/early-close proof, exchange clock, time-sync or key lifecycle. The v0 UTC execution-date cutoff remains deliberately more restrictive than NYSE 09:30. Early-close calendar and live time windows are not yet certified.

### Local CAS and PAPER scope

Only after both proofs are validated does `reserveVerifiedOfflinePaperIntent` call the unchanged `reserveOfflinePaperIntent`:

- re-enforces v0 source/status generation, freshness and risk/allowlist constraints;
- re-enforces v1 synthetic broker-fixture reconciliation;
- retains v1 per-account/session atomic exclusive local-file slot and sticky HALT;
- preserves all v1 fail-closed uncertainty behavior.

Every outcome, including successful PAPER reservation, has `brokerOrderAllowed=false` and `executionAuthority=NONE`. No orders can be placed.

### Fault and abuse tests

`tests/execution-gateway-evidence.test.mjs` uses **ephemeral test-only Ed25519 signers** and covers genuine vs forged proofs, payload mutation, mismatched source generation, wrong branch/SHA, signer/key substitution, domain separation, calendar weekend omission/insertion, bogus source claims, excessive/expired vouchers, incompatible trust policy, replay, parallel reservation claims, fake-broker mismatch and HALT. It runs under `test:core` and `test:ops` and is required by the existing P1c PR check.

### Remaining mandatory preconditions

1. Independent trusted issuer onboarding, secure key rotation/revocation and an authenticated GitHub `ops-state` code/state object verifier anchored by pinned source provenance.
2. Independent NYSE calendar source and verified market-open/early-close clock with delay/outage fail-closed behavior.
3. Production-grade strongly consistent, tamper-evident multi-worker transactional journal with complete recovery state and verified kill-switch linearization.
4. Real broker **read-only** reconciliation of settled cash, holdings, open/partially filled/cancelled orders, account identity and pending FX. Current fixture equality is not that.
5. A long-running PAPER end-to-end soak and formal security review before any separate paper broker integration.
6. Sufficient Forward evidence and explicit Human Production Approval before even considering a separately approved small live canary.

This PR does not change the existing workflow allowlist, `main` branch ruleset, Pages app, deployed order routing, `ops-state`, strategy selection, or `Production=RESEARCH`. It does not claim C4 ten-session certification.

## CI

`node --test tests/execution-gateway-evidence.test.mjs`

`P1c Main Protection` runs the full core regression including the above test and the existing v0/v1 suites.
