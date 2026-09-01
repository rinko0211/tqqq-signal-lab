# Unattended Soak Recovery Addendum v1.2 — 2026-09-01

Date frozen: 2026-09-01  
Repository: `rinko0211/tqqq-signal-lab`  
Status: **PROSPECTIVE GOVERNING ADDENDUM**  
Supersedes prospectively: `unattended-soak-recovery-addendum-v1.1-2026-09-01.md`

The 2026-08-29 charter and v1.1 addendum remain immutable historical evidence. Version 1.1 correctly prevented a later recovery from rescuing an earlier failure, but incorrectly required the first clean session of a newly baselined soak to remain uncounted. That would carry the prior soak's failure into the new soak. Version 1.2 removes that cross-soak contamination before any new-session count begins.

## 1. Governing identity rule

Every consecutive-session attempt has a distinct immutable `soakId` and one frozen control-plane baseline.

- Evidence belongs to exactly one `soakId`.
- A failed or incomplete attempt closes only that soak sequence as `CLOSED_FAILED`.
- A material control-plane change closes the old sequence and requires a new baseline and a distinct new `soakId`.
- The new soak starts with `0/10`, `COUNTING`, and no inherited date cursor, failure flag, or counter.
- Evidence carrying an old or different `soakId` is rejected without mutating or poisoning the new soak.

## 2. Failure and recovery boundaries

1. Any relevant scheduled Daily, Phase 5, Lifecycle, persistence, integrity, or Pages failure/cancellation/timeout/skipped result prevents that session from passing in its own soak.
2. A later scheduled recovery for the same NYSE session may verify that service returned, but cannot rescue or rewrite the failed session.
3. A manual run may diagnose or verify a fix but never counts as unattended evidence.
4. If remediation materially changes the control plane, freeze the complete remediated baseline and open a separate new soak ID.
5. The first distinct completed NYSE session that fully passes under the new soak ID and new baseline is `PASS 1/10`. It is not penalized merely because the prior soak failed.
6. If no material control-plane change is needed, a replacement soak may start on the same baseline with a distinct new soak ID. Its first clean later session may likewise become `PASS 1/10`.
7. Session evidence is assessed once in strict NYSE-session order within each soak only. Date ordering does not cross soak IDs.
8. Production remains `RESEARCH`, `approvedByHuman=false`, with no selected Production identity.

## 3. 2026-08-31 old-soak disposition

- Old soak ID: `SOAK-2026-08-29-A`
- Original Daily scheduled run: `33458379838` — failure after signal generation during `test:ops`.
- Later successful generation/publication does not erase the original failure.
- Old soak state: **CLOSED_FAILED — 0/10**.
- Old failure evidence remains immutable and belongs only to the old soak ID.

## 4. New-soak restart

The exact new baseline and new soak ID are recorded separately after main accepts the complete v1.2 implementation and its GitHub validation succeeds.

The restart state is:

- `C4 — UNATTENDED SOAK IN PROGRESS`
- new soak ID distinct from `SOAK-2026-08-29-A`
- `COUNTING`
- `0/10`
- `lastAssessedSession = null`

The first fully successful scheduled completed NYSE session under that identity is eligible to become `1/10`.

## 5. Permanent executable evidence

- State machine: `lib/unattended-soak.ts`
- Regression: `tests/unattended-soak-recovery-boundary.test.ts`
- Permanent registration: imported by `tests/audit5-operational-continuity.test.ts`, registered in both `test:core` and `test:ops`
- GitHub validation: explicit Audit 12 step and push-path triggers

The regression proves:

- failure followed by scheduled recovery in the same session remains failed;
- a material patch requires a distinct new soak ID and baseline;
- the new soak does not inherit the old failure, counter, or date cursor;
- the first clean new-soak session can become `1/10`;
- old-soak evidence is rejected without changing new-soak state;
- manual-only or incomplete evidence closes only its own soak;
- baseline mismatch requires rebaseline;
- duplicate or out-of-order assessment is rejected within one soak.
