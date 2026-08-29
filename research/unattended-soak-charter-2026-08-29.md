# Unattended Operational Soak Charter — 2026-08-29

Date frozen: 2026-08-29
Repository: `rinko0211/tqqq-signal-lab`
State: **C4 — UNATTENDED SOAK IN PROGRESS**
Code-control prerequisite: **C2 satisfied by Audit 11 CLEAN + Audit 12 CLEAN**
Soak control-plane baseline head: `d4ed3a3027549260769f1c3b2a5b5b19a8f4d17c`
Audit 12 post-close workflow: run `33246636086`, job `99085127120`, result **SUCCESS**
Production authority: **RESEARCH / approvedByHuman=false / no selected identity**

## 1. Purpose

This charter starts the separate live unattended-operational-soak gate required by the frozen assurance protocol. It does not reopen strategy research, authorize Production, or treat simulation as live evidence.

The soak begins with the first NYSE session after this charter is frozen and requires at least **10 consecutive NYSE sessions** on a materially unchanged control plane.

Expected initial session sequence:

1. 2026-08-31
2. 2026-09-01
3. 2026-09-02
4. 2026-09-03
5. 2026-09-04
6. 2026-09-08
7. 2026-09-09
8. 2026-09-10
9. 2026-09-11
10. 2026-09-14

2026-09-07 is excluded because NYSE is closed for Labor Day. Actual evidence must still use the authoritative NYSE calendar and observed workflow/session data; this list cannot manufacture a session.

## 2. Existing unattended writers under observation

No new operational writer is introduced for the soak.

Observed scheduled workflows:

- `Daily TQQQ Signal`
  - scheduled post-close run;
  - scheduled recovery run before the next US open.
- `Phase 5 Forward Gate`
  - scheduled post-close run;
  - scheduled recovery run.
- `Autonomous Lifecycle Review`
  - daily scheduled autonomous review.
- Production Health generation executed through the Lifecycle workflow where due.

All share the retained operational serialization/CAS/deployment controls already validated by Audit 12.

## 3. Session acceptance rule

A NYSE session counts only when all of the following are demonstrated from immutable GitHub evidence:

1. the relevant Daily and Phase 5 runs were triggered by `schedule`, not `workflow_dispatch`;
2. at least one scheduled post-close/recovery path for the session completed successfully for Daily and Phase 5;
3. the associated autonomous Lifecycle run completed successfully;
4. any failed, cancelled, timed-out, skipped, or superseded run remains recorded and is assessed rather than hidden by a later rerun;
5. persisted operational data, if changed, was committed by the existing bot path after validation;
6. the deployed Pages generation corresponds to the validated persisted generation;
7. Production remains `RESEARCH` with `approvedByHuman=false` and null Production identity;
8. no expired-open chase, silent retrofill, duplicate logical record, impossible chronology, or historical rewrite is detected;
9. provider no-bar events are represented only by the governed explicit gap evidence, never by fabricated prices or signals;
10. the control plane remains materially unchanged.

A manual rerun may diagnose a failure but cannot erase it or convert an otherwise invalid unattended session into a passing session.

## 4. Materially unchanged control-plane rule

The baseline is the source/control state at `d4ed3a3027549260769f1c3b2a5b5b19a8f4d17c`.

Expected non-material main advances during the soak are limited to:

- existing bot-generated append-only operational data under `github-pages/public/data/`;
- equivalent generated user-facing data copies produced by the already validated workflows;
- evidence-only soak records under `research/` that do not change executable code, workflow logic, tests, strategy parameters, or operational authority.

Any change to the following resets the soak unless a documented pre-change determination proves it non-material:

- `.github/workflows/`;
- `lib/`;
- `scripts/`;
- `tests/`;
- application/runtime source;
- `package.json` or dependency lock state;
- Production authority/configuration;
- frozen strategy parameters;
- validation, persistence, deployment, calendar, ledger, lifecycle, or UI-action semantics.

Operational data commits do not reset the soak merely because the repository HEAD advances, provided their path, author, parent relation, and append-only semantics are valid.

## 5. Failure handling

A failed unattended session is evidence, not disposable noise.

On any possible failure:

1. retain the original run/job/step IDs and logs;
2. classify product/control defect vs provider/data event vs harness/infrastructure event;
3. do not edit historical evidence to force continuity;
4. if a material product/control defect is found, record it before remediation;
5. apply F1–F5;
6. reset the consecutive-session counter after the materially changed remediated control plane is frozen;
7. keep Production in RESEARCH.

A GitHub/provider outage does not become a pass merely because a later run succeeds. Whether continuity can resume or must restart is decided from the frozen protocol and recorded evidence, not convenience.

## 6. Evidence ledger requirements

For each counted session, record at minimum:

- NYSE session date;
- Daily scheduled run IDs and conclusions;
- Phase 5 scheduled run IDs and conclusions;
- nearest required Lifecycle run ID and conclusion;
- source and resulting main SHA(s);
- whether operational data changed;
- append-only/integrity result;
- Pages deployment result;
- Production authority result;
- control-plane-diff result;
- anomalies and classification;
- session disposition: PASS / FAIL / NOT COUNTED.

Evidence may be assembled after execution, but it must come from the immutable original runs and commits. No retrospective synthetic run may stand in for an unattended scheduled run.

## 7. Completion rule

The soak reaches its live-session requirement only after 10 consecutive accepted NYSE sessions.

Completion does not itself mutate Production authority. A separate final certification record must verify:

- C2 remains valid;
- permanent fault/boundary regressions remain intact;
- temporal/chaos assurance remains intact;
- all 10 session records are complete;
- the control plane remained materially unchanged;
- no hidden or overwritten failure exists;
- Production remains unpromoted unless separately approved by the exact Human Approval path.

Until that record exists, status remains **C4 — UNATTENDED SOAK IN PROGRESS** and not C5.
