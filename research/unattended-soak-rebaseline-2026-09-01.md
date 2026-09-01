# Unattended Soak Rebaseline Record — 2026-09-01

Repository: `rinko0211/tqqq-signal-lab`  
Status: **C4 — RECOVERY VERIFICATION REQUIRED / 0 OF 10**  
Governing addendum: `research/unattended-soak-recovery-addendum-v1.1-2026-09-01.md`  
Remediated control-plane baseline: `198c0f94e589c2c488fa7cea3b1264ecd9c71e66`  
Production authority: **RESEARCH / approvedByHuman=false / no selected identity**

## Historical discontinuity

The 2026-08-31 Daily scheduled run `33458379838` failed during operational regression after generating the session state. The later scheduled recovery and publication do not rescue that session.

- 2026-08-31 disposition: **FAIL — NOT COUNTABLE**
- old soak sequence: terminated
- retained count: **0/10**
- historical failure evidence: retained
- retroactive reconstruction: forbidden

## Baseline transition

Material control-plane changes after the failure included the Audit 11 fixture remediation and the recovery-boundary hardening. The complete remediated baseline is the commit above.

Commits after the baseline may be ignored for baseline identity only when every changed path is evidence-only under `research/` or validated append-only operational data. Any executable, workflow, test, dependency, strategy, validation, persistence, deployment, calendar, lifecycle, ledger, Production-authority, or UI-action semantic change requires another reset and rebaseline.

## Restart rule

1. The first fully successful scheduled NYSE session after this baseline is `RECOVERY_BOUNDARY_VERIFIED / NOT COUNTED`.
2. It must include Daily, Phase 5, Lifecycle, Pages, append-only integrity, Production-unpromoted, and control-plane-diff evidence.
3. A manual run cannot satisfy the recovery boundary.
4. A scheduled failure or incomplete evidence keeps `RECOVERY_VERIFICATION_REQUIRED`.
5. Only the following distinct completed NYSE session may become `PASS 1/10`.

This record freezes the restart at **0/10**. It does not certify C5 and does not authorize Production.
