# Audit 9 Charter — Temporal, Recovery & Chaos Audit

Date: 2026-08-29
Status: **START AUTHORIZED — TEMPORAL / RECOVERY / CHAOS BASELINE**
Repository: `rinko0211/tqqq-signal-lab`
Governing assurance protocol: `research/multi-audit-assurance-protocol-v1.0-2026-08-27.md`
Prior audit close: `research/audit-8-close-2026-08-29.md`
Audit accounting at start: **C0 / 0-of-2 CLEAN**
Production authority at start: **RESEARCH / no selected identity / no Human Approval**

## 1. Purpose

Audit 9 is the independent temporal, recovery and chaos audit required by the frozen Multi-Audit Assurance Protocol. It must not collapse into another snapshot-fixture or white-box regression pass.

Its primary question is:

> When valid operation, faults, retries, partial failures, clock changes, cache changes, authority transitions and recoveries occur in long sequences, does the externally observable system remain fail-closed, append-only, causally legal and free of stale state bleed?

Audit 9 is independent from:
- Audit 7: model-based white-box state-space/discontinuity analysis;
- Audit 8: black-box snapshot adversarial/differential observable-contract testing.

## 2. Primary discovery mechanism

**Deterministic temporal / recovery / chaos sequence simulation across hundreds of market sessions to multi-year windows.**

Required characteristics:
- minimum primary sequence length: **500 market sessions**;
- at least one multi-year sequence using repository-stored market-session observations as the external session source;
- deterministic seeds recorded in the test output/source;
- faults injected before/after fetch, generation, persistence, UI read, execution-window transition, review, approval and recovery boundaries;
- repeated fault → recovery → recurrence cycles, not one-shot mutation only;
- independent sequence-level invariants evaluated after every step or recovery checkpoint;
- no strategy retuning and no Production promotion.

## 3. Primary oracle

Audit 9's primary oracle is **sequence invariants over externally observable and persisted state**, not reuse of Audit 7 internal assertions and not replay of Audit 8 expected-action snapshots.

The sequence oracle may inspect product outputs and persisted artifacts, but expected temporal behavior must be derived from fixture-local rules and prior observed valid state.

Core sequence invariants:

### T01 — No unsafe action during corrupted authority
While any required action authority is missing, malformed, temporally impossible, stale or generation-incoherent, no risk-changing action may be observable.

### T02 — Recovery does not retain stale unsafe action
After a fault clears, the first legal action must be derived from the newly coherent state. No action calculated from the corrupted interval may survive through cache/local state/reload.

### T03 — Execution causality survives delay and recovery
A target decision at completed close may execute only at the first legal still-available NYSE open. A missed/expired open is never chased or silently shifted to an arbitrary later date.

### T04 — Append-only history remains prefix-stable
Valid historical Forward, Phase5, Lifecycle and Production Health evidence may grow only by legal append/recovery effects. Retry, failure, re-entry and catch-up may not mutate validated historical prefixes.

### T05 — Exactly-once logical effects under retry
A logical observation/review/transition may appear at most once even when the same operation is retried, rerun or recovered after interruption.

### T06 — Fault isolation persists across time
Failure of one candidate/ticker/subsystem may not mutate valid peer history or incumbent authority. Recovery may catch up the failed subsystem without rewriting peers.

### T07 — Episode isolation survives A→B→A and long gaps
Old Production/Health/local-holdings state from an earlier episode may not bleed into a later logically distinct episode.

### T08 — Production authority is temporally possible
Human approval/effective/update chronology used as current authority must be possible relative to the observation clock throughout clock rollback/forward and reload sequences.

### T09 — Cache / shell age cannot upgrade authority
Cached shell/research/analysis state may not upgrade stale or missing operational authority; new operational JSON with the same product code must produce the same action independent of shell age.

### T10 — Recovery from partial persistence is fail-closed
A partially written/truncated/corrupt operational artifact may not authorize action. Recovery must restore a coherent new generation without rewriting immutable valid history.

### T11 — Review recurrence is not consumed by failure
Transient review failures must remain retryable. Long outages may not fabricate historical review states from one current snapshot.

### T12 — No silent defaults after partial JSON
Missing nested operational payloads or malformed numeric/local state remain explicit fail-closed conditions across reload/recovery.

## 4. Mandatory inherited mutations from Audit 8 F5

Audit 9 must transform every Audit 8 material finding into a sequence family.

### A8-M01 numeric action-input corruption
Inject malformed/out-of-range holdings and signal target fields before/after reload, target changes and recovery. Verify T01/T02/T12.

### A8-M02 research freshness masking stale operational authority
Independently delay operational and research/cache freshness across tab/reload sequences. Verify research/display state never upgrades/downgrades operational authority. Verify T01/T02/T09.

### A8-M03 malformed Forward history at action boundary
Inject duplicate/truncated/partial Forward persistence between generation and UI read; recover with a coherent artifact. Verify T01/T02/T04/T10.

### A8-M04 future-dated operational generation
Inject coherent future generations and single-artifact future clocks, browser/system clock rollback, restoration and reload. Verify T01/T02/T08.

### A8-M05 explicit execution-date legality
Mutate execution dates around normal open, holiday/weekend roll, delayed signal availability, missed open and later recovery. Verify T03.

### A8-M06 local holdings identity across Production changes
Carry stale/missing identity tags across Production A→B→A, reload and restored local snapshots. Verify T01/T02/T07.

### A8-M07 Forward prefix/middle truncation
Remove historical prefix/middle/per-version records during publication/reload, then recover. Verify T01/T02/T04/T10.

### A8-M08 record chronology vs artifact generation
Inject record timestamps after ledger generation, clock jumps and corrected replacement artifacts. Verify T01/T02/T04/T08/T10.

### A8-M09 missing/partial nested Daily signal
Inject wrapper-only, null/partial payload and wrapper-new/payload-old publication sequences. Verify T01/T02/T12.

### A8-M10 Production authority chronology
Inject future approval/effective/updatedAt, clock rollback, DECISION-with-incumbent, valid reaffirmation and recovery across New York date boundaries. Verify T01/T02/T07/T08.

## 5. Mandatory additional chaos families

Beyond inherited F5 mutations, Audit 9 must include:
- fetch failure before generation;
- one-subsystem data failure;
- ledger generation failure;
- persistence failure before/after temporary workspace mutation;
- source-head advance / retry boundary where testable without mutating authority;
- deploy failure after valid persistence, and successful later deploy;
- missed scheduled run and multi-session recovery;
- Production Health multi-quarter outage/recovery;
- Lifecycle review transient failure/retry;
- corporate-action boundary with pending execution/accounting continuity;
- cached PWA shell + new operational JSON;
- stale operational JSON + fresh research/display state;
- repeated identical signal and execution deduplication.

## 6. Discovery waves

### Wave 1 — Sequence engine and inherited action-authority chaos
Build the deterministic session/step simulator and exercise M01, M02, M04, M05, M06, M09, M10 in long action-authority sequences.

### Wave 2 — Append-only / persistence / recovery chaos
Exercise M03, M07, M08 plus Forward/Phase5/Lifecycle/Health retry, partial persistence, truncation, one-system failure and catch-up.

### Wave 3 — Integrated hazardous sequences
Combine at least three simultaneous axes per scenario, including:
- clock rollback × cached shell × future Production authority;
- partial Forward persistence × stale Daily × missed open;
- A→B→A × stale local holdings × Health recurrence;
- one-system Phase5 failure × delayed recovery × peer update;
- review failure × long outage × holiday/session boundary;
- deploy failure × newer valid persisted generation × reload.

## 7. Material-finding discipline

If a new material defect is discovered:
1. stop remediation of that defect;
2. create a formal Audit 9 finding record first;
3. classify root cause and fault class;
4. apply F1–F5;
5. permanently mark Audit 9 **NOT CLEAN**;
6. remediate only after the finding record is persisted;
7. add permanent sequence regression;
8. mutate Audit 10 coverage/meta-audit plan.

Harness defects, invalid fixture assumptions and intentionally triggered existing safety guards are not product findings. They must be explicitly distinguished from product defects.

## 8. CLEAN criteria

Audit 9 is CLEAN only if all are true:
1. zero new material defects are discovered by the temporal/recovery/chaos mechanism;
2. all inherited M01–M10 sequence mutations pass;
3. all mandatory additional chaos families pass or are explicitly shown non-applicable with evidence;
4. integrated hazardous sequences pass;
5. permanent temporal/fault-injection regression is registered in standard regression;
6. full core regression passes;
7. full operational regression passes;
8. user-facing Pages build passes;
9. authoritative persisted state is unchanged by the audit;
10. no strategy retuning or Production promotion occurs.

If CLEAN, Audit 9 moves certification accounting from **0/2 to 1/2 CLEAN**. It does not by itself satisfy final certification or unattended-soak requirements.

## 9. Production / research restrictions

Audit 9 must not:
- approve or promote any Production system;
- change frozen strategy weights/stops/versions for performance reasons;
- rewrite Forward, Phase5, Lifecycle or Production Health history;
- use audit-generated synthetic results as research-performance evidence;
- label successful chaos testing as final unattended-operations certification.

All destructive/fault scenarios must execute against isolated in-memory/test fixtures or non-authoritative branches/workspaces.

## 10. Start authorization

The user's explicit instruction on 2026-08-29 to proceed to Audit 9 authorizes this audit phase under this charter. It does **not** constitute Production approval.
