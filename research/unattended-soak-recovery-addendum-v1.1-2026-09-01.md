# Unattended Soak Recovery Addendum v1.1 — 2026-09-01

Date frozen: 2026-09-01  
Repository: `rinko0211/tqqq-signal-lab`  
Status: **PROSPECTIVE GOVERNING ADDENDUM**  
Supersedes prospectively: Sections 3 and 5 of `unattended-soak-charter-2026-08-29.md` where their wording could allow a later recovery success to rescue an earlier failure.

The 2026-08-29 charter remains immutable historical evidence. This addendum closes a recovery-boundary ambiguity discovered by the 2026-08-31 Daily failure.

## 1. Finding

The original acceptance rule required failed runs to remain visible, but also allowed a session when at least one scheduled post-close/recovery path succeeded. Read literally, that could allow a later scheduled recovery to convert a session with an earlier scheduled failure into a PASS.

That interpretation is forbidden. A fail-closed stop and the later return to normal operation are separate discontinuity evidence.

## 2. Governing transition rules

1. Any relevant scheduled Daily, Phase 5, Lifecycle, persistence, integrity, or Pages failure/cancellation/timeout makes that NYSE session `FAIL` or `NOT COUNTED`; a later success for the same session cannot rescue it.
2. A manual run may diagnose or verify a fix but never establishes unattended recovery and never counts.
3. A material control-plane change immediately resets the consecutive counter to `0/10` and requires a new frozen baseline.
4. After the remediated baseline is frozen, the first fully successful scheduled session is classified `RECOVERY_BOUNDARY_VERIFIED / NOT COUNTED`. It proves the failed→normal transition but does not begin the consecutive count.
5. Only the next distinct completed NYSE session may become `PASS 1/10`, provided every original scheduled evidence requirement passes and the control plane still matches the new baseline.
6. Any failure or incomplete scheduled evidence creates or preserves `RECOVERY_VERIFICATION_REQUIRED`; it cannot advance to counting.
7. Session evidence is assessed once in strict NYSE-session order. Replays, duplicate assessment, retroactive synthesis, timestamp correction, and historical rewriting are forbidden.
8. Production remains `RESEARCH`, `approvedByHuman=false`, with no selected Production identity throughout remediation and soak.

## 3. 2026-08-31 disposition

- Original Daily scheduled run: `33458379838` — failure after signal generation during `test:ops`.
- Later successful generation/publication does not erase the original failure.
- Session disposition: **FAIL — NOT COUNTABLE**.
- Consecutive soak count: **0/10**.
- Audit 12 CLEAN records remain historical, but the material test/control-plane changes break the old soak baseline.

## 4. New baseline and restart

The new baseline is the final commit containing this addendum, the executable recovery-boundary state machine, its permanent regression tests, and test registration. The exact commit is recorded separately after main accepts the complete change.

Restart state after that baseline is frozen:

- `C4 — UNATTENDED SOAK IN PROGRESS`
- `0/10`
- `RECOVERY_VERIFICATION_REQUIRED`

The first clean scheduled session after the new baseline is evidence of recovery only. Counting begins no earlier than the following distinct completed NYSE session.

## 5. Permanent executable evidence

- State machine: `lib/unattended-soak.ts`
- Regression: `tests/unattended-soak-recovery-boundary.test.ts`
- Required permanent registration: imported by `tests/audit5-operational-continuity.test.ts`, which is already registered in both `test:core` and `test:ops`

The regression must prove at least:

- failure followed by scheduled success in the same session remains FAIL;
- a material patch clears the counter and requires rebaseline;
- the first clean session after rebaseline is recovery-only and not countable;
- a manual success cannot establish recovery;
- incomplete scheduled evidence creates a recovery boundary before counting resumes;
- a baseline mismatch fails closed;
- duplicate or out-of-order session assessment is rejected.
