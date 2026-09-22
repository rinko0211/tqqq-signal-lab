# Ops-State Security Cutover — 2026-09-23

## Purpose

Separate immutable/reviewed application code from mutable operational market/signal state so that `main` can be branch-protected without stopping unattended observations.

## Authority model

- `main`: code/control plane. No unattended workflow may commit or push to it.
- `ops-state`: operational data plane. Only the four current operational workflows may persist the explicit state allowlist.
- GitHub Pages: built from protected `main` code after overlaying the exact persisted `ops-state` snapshot.
- Production/Broker authority: unchanged. This cutover does not create broker credentials or order authority.

## State allowlist

- forward-ledger.json
- forward-summary.json
- live-history.json
- market-data.json
- provider-attempt.json
- signal.json
- status.json
- phase-5-forward-ledger.json
- phase-5-forward-status.json
- lifecycle-review.json
- production-health-review.json
- production-config.json
- transient .failed marker

All other paths are forbidden from operational-state persistence.

## Integrity controls

1. Code SHA is captured from `main` before state overlay.
2. Operational state is overlaid only from `ops-state`.
3. Persistence uses compare-and-swap against the exact state SHA observed before calculation.
4. The persistence helper stages only the explicit state allowlist.
5. Before persistence and deployment, the workflow confirms `main` has not advanced from the validated code SHA.
6. After persistence, the workflow confirms the remote `ops-state` SHA equals the exact persisted SHA.
7. Human Production Approval binds both the exact protected code SHA and exact persisted state SHA into its deploy-only handoff.

## Certification impact

The previous TQQQ unattended 10/10 soak remains valid historical evidence for the pre-cutover control plane. This change is materially operational, so it does **not** inherit that certification for live broker use.

After merge/cutover:
- start a new 10 consecutive NYSE-session post-security soak;
- weekends/NYSE holidays do not increment or reset;
- no reconstruction/backfill may count;
- any material control-plane change during the new soak resets that new counter;
- broker order authority remains prohibited until the new soak and final security review both pass.

Gold50 C10/10 remains valid evidence for its completed shadow mapper/provider validation, but any future Gold execution integration must consume authoritative TQQQ state from `ops-state` (or the deployed validated Pages state), not stale state frozen on `main`.

## Required repository setting after cutover

Once operational writers have proven they no longer push to `main`, enable a GitHub ruleset/branch protection for `main`:
- require pull requests;
- require the security/operational CI checks selected for protected code changes;
- block force pushes and branch deletion;
- do not grant unattended state workflows a bypass to `main`.

The state branch may remain writable by the operational GitHub Actions token, because it contains no authoritative source code.
