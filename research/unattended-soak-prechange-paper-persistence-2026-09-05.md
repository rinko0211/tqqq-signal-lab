# Unattended Soak Pre-Change Determination — Paper Persistence

Date: 2026-09-05 JST
Repository: `rinko0211/tqqq-signal-lab`
Decision: **PRE-CHANGE DETERMINATION — NON-MATERIAL TO SOAK CONTROL PLANE, SUBJECT TO VALIDATION**

## Purpose

This record is created before any executable Paper Trading persistence change is merged to `main`, as required by section 4 of `research/unattended-soak-charter-2026-08-29.md` when an application/runtime change is proposed during the live unattended soak.

The user observed that the device-local Paper Trading setup can occasionally appear reset. The current implementation stores the Paper Trading configuration only under browser `localStorage` key `tqqq-paper-v1`. The proposed remediation adds an independent device-local IndexedDB backup, validates the stored configuration, restores a missing/corrupt primary copy before the Pages React application mounts, and requests persistent browser storage where supported.

## Scope allowed by this determination

The proposed executable delta is limited to:

- a device-local Paper Trading persistence helper;
- Pages bootstrap restoration before React mount;
- permanent regression coverage for Paper configuration validation/persistence.

The proposed change must not modify:

- `.github/workflows/`;
- Daily / Phase 5 / Lifecycle / Production Health writer logic;
- market-data acquisition or provider retry semantics;
- signal calculation, strategy parameters, execution timing, or cost assumptions;
- `live-history.json`, Forward ledgers, lifecycle ledgers, Production authority/configuration, or their persistence semantics;
- `derivePrimaryAction` or any risk-changing action decision;
- Production mode, selected identity, or Human Approval gates.

## Why this is non-material to the unattended-soak gate

The unattended-soak acceptance evidence observes the scheduled Daily, Phase 5 and Lifecycle paths, their persisted authoritative artifacts, deployment generation, Production authority, chronology and append-only integrity. Paper Trading account configuration is explicitly device-local and is not an operational writer or an authority input.

The proposed persistence layer does not alter `simulatePaper` calculation semantics or the immutable published Signal history used by Paper Trading. It only preserves the user's local starting-capital/start-date/fixed-FX display configuration across browser/PWA storage disturbances. No Paper account value is sent to GitHub or introduced into operational authority.

Therefore, if the validated final diff remains within the stated scope and the retained full core/operational regression, Pages build, Production-unpromoted guard, authoritative-state no-mutation guard and exact-head validation all pass, this change is classified as **non-material to the soak control plane** and does **not** reset the current consecutive-session count.

If validation reveals any effect on scheduled writers, authoritative artifacts, risk-action semantics, Production authority, or an existing soak invariant, this determination is void and the change must not be merged under this classification.

## Validation requirement before merge

The exact candidate head must pass at minimum:

- Paper persistence regression tests;
- full `test:core`;
- full `test:ops`;
- retained Audit 8–11 inheritance exercised by the existing audit workflow;
- Pages build;
- Production remains `RESEARCH`, `approvedByHuman=false`, null selected identity;
- authoritative operational data no-mutation guard;
- exact-head guard.

Only after these checks succeed may the executable delta be merged under this pre-change determination.
