# Post-Soak Security Baseline — 2026-09-23

## Frozen evidence boundary

- TQQQ repository: `rinko0211/tqqq-signal-lab`
- Verified pre-hardening parent commit: `fa77469d85ac7f37b74500e15afc6793eca6e432`
- TQQQ operational soak: complete; latest verified session at the security handoff was 2026-09-21.
- Strategy/version remains `VS13-v1.0`.
- Platform authority remains `RESEARCH`; no broker order authority is introduced by this branch.

## Gold50 evidence

- Gold50 repository pre-hardening parent commit: `5eb76b835e211a8c5aeabe6a596914a778b83422`
- Phase C: `C10/10`, `COMPLETE_STOP_GATE`.
- Gold50 rate-regime replay was executed separately on `audit/rate-regime-2026-09-23` using Tiingo EOD and pinned TQQQ baseline commit `fa77469d85ac7f37b74500e15afc6793eca6e432`.
- The replay's VS13 reference check matched published Phase 2 annual returns for 2022, 2023 and 2024.

## P0 hardening scope

This branch is intentionally non-strategic. It may change workflow security controls and security tests only.

It must not:
- retune VS13 or Gold50;
- alter mapping, target logic, market-data semantics, Forward history, or Production eligibility;
- create Production or broker authority;
- rewrite soak or Phase C evidence.

P0 controls:
- immutable SHA pinning for security-sensitive GitHub Actions;
- removal of implicit `secrets: inherit` from Production approval;
- regression tests that prevent these controls from silently regressing.

State-plane separation, branch protection activation, dependency remediation and execution-gateway work are separate gated changes.
