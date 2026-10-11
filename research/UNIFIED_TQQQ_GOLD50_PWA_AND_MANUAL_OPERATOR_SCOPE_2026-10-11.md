# Unified TQQQ + Gold50 PWA, manual-order workflow — 2026-10-11

## Approved user interface target

**Modify the existing TQQQ Signal Lab PWA itself**, not a separate standalone Gold app. The user requested one UI showing TQQQ's existing Forward records plus the previously soaked frozen Gold50. Keep all preexisting TQQQ actions, primary signal, local holdings, lifecycle, candidate panels, charts and simulation history.

This PR adds:
- a new **Gold50 / Forward tab inside TQQQ's existing navigation**;
- an embedded Gold50 summary and its detailed Forward history in the existing **Forward Test tab**, next to TQQQ's main and Phase5 ledgers;
- completed Phase C C10/10, historical endpoint **2026-09-21**, a separately labeled **non-observation interval 2026-09-22–10-09**, and prospective Gold50 start **2026-10-12**; additional missing intervals are displayed as split segments, not fabricated continuous signals;
- read-only public data intake from `rinko0211/gold50-shadow-monitor/main/forward/{status.json,ledger.jsonl}` plus `phase-c/status.json`, validated against frozen mapping, expected dates, SHA digest syntax, row count, duplicated/out-of-order entries, Phase C completion and always-on `brokerOrderAllowed=false`;
- a **local-only, explicitly non-executable worksheet** using *user-entered actual USD cash, TQQQ/GLD shares and prices*, producing fractional-allocation whole-share research estimates only when the saved Gold50 observation matches the same market date as the existing TQQQ signal and status, has not aged beyond the conservative guard, and has no unaccounted discontinuity. This neither loads broker credentials nor calls account APIs.
- a PWA shell cache version bump to ensure existing home-screen installs refresh.

## Strict limitations

- **NO automatic trading**, order routing, brokerage integration, storage of user-entered account values, changes in selected strategy, Production promotion or alteration of the VS13/Gold frozen parameters.
- **NO Gold capital curve or invented P&L**: the Gold long-run source currently stores signal-level observations and hashes, not the licensed GLD/TQQQ execution prices necessary for a validated portfolio equity path. The TQQQ Forward Model Index is not to be compared as if Gold had commensurate wealth-path statistics.
- The UI reads public cross-repo JSON/JSONL only. Since the Gold repo's raw GitHub URL is a moving `main` ref, the browser's response-level cross-file snapshot is **not cryptographically atomic**; strict mismatch and row-count validation fail closed. It is **not a suitable authenticated feed or trade trigger**. The independent Gold observer itself binds underlying TQQQ `ops-state` Signal + Status to a single pinned commit.
- A safe UI handles closure/gaps by **showing segmented evidence or unavailable state**, not silently continuing the previous target or assuming that an absent bar constitutes HOLD/SELL. When reopened after a gap, a separate verified data/restart procedure must govern new prospective records.
- The main TQQQ historical candidate cohort (six strategies and two benchmarks) and the distinct Gold one are unmodified. Phase C historical research archive remains in its own repo. Future comparison must use valid common Forward observations, regimes, transaction cost and actual human action burden. The user's objective remains <=30–40 manually executed order legs/year.

## Data/operations separation

The checked-in `github-pages/public/data/` files in `main` are placeholders, not the authority. The Pages production workflow overlays the independently managed `ops-state` branch's data at build time. This PR **changes only application/UI code, CSS, public service-worker shell, 13 new regression tests, and test command**, never `ops-state` or a runtime data JSON.

After P1c gate completion, the Pages state-plane deployment still must build an exact `main+ops-state` pair before users receive the new PWA. The Gold research repo has its own scheduled data writer. **Neither pipeline can place orders.**

## Remaining decision gate

Gold Forward has not accumulated sufficient forward market regimes and validated price/wealth path to be eligible for strategy selection. The preview is a calculator, **not** a trade-ready approval. Do not say the entire manual-trading program has passed performance/production tests as a result of passing UI regression checks.
