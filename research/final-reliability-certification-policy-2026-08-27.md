# Final Reliability Certification Policy v2 — 2026-08-27

## Status
This policy supersedes the earlier interpretation that two clean code audits alone constitute final unattended-operation certification.

## Three-layer certification

### Layer 1 — Independent clean audits
- Require **two consecutive complete independent CLEAN audits**.
- A new material defect resets the clean count to **0/2**.
- A round that discovers and remediates a material defect remains **NOT CLEAN**; successful remediation does not retroactively make that round clean.
- Each round must directly inspect source/configuration and live authoritative state rather than only rerunning the prior audit checklist.

### Layer 2 — Permanent boundary and fault-injection regression
Permanent regression must cover at least: New York review-date/close boundaries, DST, weekends/holidays, delayed or incomplete provider bars, stale/failed upstreams, missed execution opens, append-only Forward behavior, Production approval races, post-approval state coherence, dynamic incumbent transitions, PWA/data fail-closed semantics, and annual review recurrence.

### Layer 3 — Unattended operational soak
Before issuing **Final Unattended Operations Certification**, require at least **10 consecutive NYSE sessions** on the same materially unchanged control-plane implementation with no manual repair. Daily, Phase 5 and Lifecycle must remain coherent; no missing/duplicate/retroactive Forward records, stale actionable UI, automatic Production promotion, or authoritative-ledger rewrite is permitted. Scheduled-run delay alone is not a failure if freshness/SLO controls remain safe and no action is exposed from stale state.

## Certification wording
- Passing Layer 1 only: "CODE/CONTROL-PLANE CLEAN 2/2"
- Passing Layers 1+2 but not soak: "PRE-SOAK RELIABILITY QUALIFIED"
- Passing all three layers: "FINAL UNATTENDED OPERATIONS CERTIFIED"

## Current effect
Audit 5 found new material defects. Therefore the clean streak is reset/remains **0/2**. The next independent audit begins a new candidate clean streak only after Audit 5 remediation is closed and validated.
