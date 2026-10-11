# Soak-observed Forward candidate census — 2026-10-11 JST

**Authoritative snapshot:** `research/soak-cohort-forward-census-2026-10-11.json` in this PR. Scope explicitly narrowed by the user to **only systems already present in the unattended-soak / Phase C observations**, not every ever-searched historical candidate. This document does **not** start a new test, change strategy logic or authorize automatic brokerage orders.

## Exact monitored cohort

| Soak evidence channel | Candidate / benchmark | Role | Original prospective start | State at 2026-10-11 audit |
|---|---|---|---|---|
| Daily TQQQ append-only ledger | `VS13-v1.0` | Incumbent | 2026-08-21 | Latest 2026-10-09: 34 LIVE + 1 observation-only |
| Daily TQQQ | `VS12-v1.0` | Challenger | 2026-08-21 | Latest 2026-10-09: 34 LIVE + 1 observation-only |
| Daily TQQQ | `VT30-v1.0` | Risk control | 2026-08-21 | Latest 2026-10-09: 34 LIVE + 1 observation-only |
| Daily TQQQ | `TQQQ-BH-v1.0` | Benchmark, NOT winner candidate | 2026-08-21 | Latest 2026-10-09: 34 LIVE + 1 observation-only |
| Daily TQQQ | `QQQ-BH-v1.0` | Benchmark, NOT winner candidate | 2026-08-21 | Latest 2026-10-09: 34 LIVE + 1 observation-only |
| Phase5 append-only ledger | `UPRO-SPBT-v1.0` | Growth challenger | 2026-08-25 | Latest 2026-10-09: 32 LIVE + 1 observation-only |
| Phase5 | `SSO-SPBT-Scaled-v1.0` | S&P lower-leverage comparison | 2026-08-25 | Latest 2026-10-09: 32 LIVE + 1 observation-only |
| Phase5 | `QLD-VS13-Scaled-v1.0` | Nasdaq lower-leverage comparison | 2026-08-25 | Latest 2026-10-09: 32 LIVE + 1 observation-only |
| Gold50 independent Phase C | `TQQQ-Gold50-Research-v0.1` / `gold-overlay-shadow-0.1.0` | Gold tactical overlay | 2026-09-08 first counted session | **C10/10 COMPLETE_STOP_GATE, stopped** after 2026-09-21 |

**Counts: 9 observed series, consisting of 7 research strategies (six non-Gold + one Gold) and 2 explicit buy-and-hold benchmarks.**

Gold50 is a single frozen mapper **`TQQQ=w`, `GLD=0.5 × (1-w)`, `CASH=0.5 × (1-w)`**, where `w` is the frozen VS13 target. This is **not** a set of 50 separate strategies and is not a 50%-weight constant GLD allocation. Phase C collected 10 distinct successful NYSE sessions in 61 attempts (24 blocked, 27 duplicate passing attempts that were not counted); the completed *operational* shadow does NOT establish long-horizon comparative Forward eligibility.

### Deliberately excluded

- Legacy Track B `UPRO-VS13-v1.0` and `UPRO-Native-v1.0`: archived separate ticker ledger, 3 records total with latest data date 2026-08-24. **They were not part of the observed Daily/Phase5 soak candidate cohort.** Do not rename them into UPRO-SPBT or backfill their records.
- Phase4A/B: historically rejected, not registered for Phase5.
- Other historical optimization grids / deferred sectors / ad hoc Gold ratios: no evidence of entry into this soak cohort. The user has narrowed scope so do not add them.

### Source-of-truth hierarchy

TQQQ immutable sources:
- `github-pages/public/data/forward-ledger.json` for Daily 5 series; append-only, 175 total records as of the audited 2026-10-09 generation.
- `github-pages/public/data/forward-summary.json` (5-version current summary; not a complete cross-project candidate register).
- `github-pages/public/data/phase-5-forward-ledger.json` for 3 distinct systems; append-only, 99 total records.
- `github-pages/public/data/phase-5-forward-status.json` for latest Phase5 process and 2026-10-09 market dates.
- `github-pages/public/data/lifecycle-review.json` for official insufficient Forward evidence and selection rule.
- `research/unattended-soak-charter-2026-08-29.md` and `security/P1C_POST_PROTECTION_SOAK_5_SESSION_CLOSE_2026-10-10.md` for operational reliability (distinct 10-session C4 and 5-session P1c migration).
- `research/phase-5-forward-gate-2026-08-26.md` for the frozen non-duplicate incumbent + three Phase5 additions.

Gold immutable sources (separate repo `rinko0211/gold50-shadow-monitor`):
- `src/shadow.mjs` for exact mapper and source validation.
- `phase-c/status.json`, `phase-c/observations.jsonl` for the 10/10 verified stop and original attempt history.
- `DAILY_MONITOR_CONTRACT.md` for one-session-one-count rules.

All data above were read **2026-10-11**; this is an immutable *audit snapshot*, not a live continuously updated manifest. Current ops-state has moved since the charters were frozen; always reread current sources before later decisions.

### Gaps and safe next steps

1. **TQQQ 8 series:** The current ledgers already exist and carry current observations; do not create duplicate systems, restart starts, or overwrite histories. Continue scheduled Daily/Phase5 research. Present source gaps and regime breadth separately for each research strategy; as of the audit, missing-or-invalid was 1/35 Daily and 1/33 Phase5, above the frozen 1% admissibility bar.
2. **Gold50:** Its provider-integrity Phase C concluded properly; a **new, explicitly scoped, long-horizon Forward continuation** under the *same frozen mapping* is still needed for like-for-like strategy comparison. Starting a new version or changing parameters is **not authorized by this inventory**. It must not restart historical C10/10 or fabricate missing 2026-09-22 onward sessions. Ensure independent GLD data source and no stale signal.
3. **No winner yet:** VS13 is provisional incumbent, not conclusively selected. Forward time, sufficiently diverse market regimes, clean gaps, non-zero changes, risk/DD, comparison on common live sessions, and actual annual manual trade **order legs** all matter. Review dates 2027-02-25, 2027-08-25, 2028-08-25 do not shorten a later Gold entry's evidence period.
4. **Manual investor action exclusively:** Signals, dates, target weights and reasons can be calculated/displayed automatically; *the user alone places every trade*. No broker connectivity, unattended orders, broker API, automatically executed rebalance or paper-broker deployment. Legacy Gateway v0–v6 are excluded from the product roadmap and cannot be interpreted as user authorization.

**Audit statement:** ALL nine soak-observed series accounted for: 8 TQQQ (6 strategic + 2 benchmark) and one Gold. Missing production-ready comparative Forward: **Gold50 long-run**; TQQQ incumbents/challengers lack sufficient forward evidence. No hidden promise that every historic research hypothesis is Forward active.

### Security/non-disruption

This census is **documentation/data-inventory only**. No `lib/`, `scripts/`, `tests/`, `.github/workflows/`, deployed app code, runtime state, histories, parameter freezes, branch protection, or Production authority change. It cannot itself modify scheduled behavior or grant order rights.
