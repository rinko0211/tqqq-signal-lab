# Unattended Soak Rebaseline Record — 2026-09-01

Repository: `rinko0211/tqqq-signal-lab`  
Status: **C4 — UNATTENDED SOAK IN PROGRESS / 0 OF 10 / COUNTING**  
Governing addendum: `research/unattended-soak-recovery-addendum-v1.2-2026-09-01.md`  
Old soak ID: `SOAK-2026-08-29-A`  
New soak ID: `SOAK-2026-09-01-B`  
Remediated control-plane baseline: `8223bc8c75f87a9714f89c935d45216d72ff5837`  
Baseline validation: Audit 12 run `33564829913` — **SUCCESS**  
Production authority: **RESEARCH / approvedByHuman=false / no selected identity**

## Old soak closure

The 2026-08-31 Daily scheduled run `33458379838` failed during operational regression after generating the session state. A later scheduled recovery and publication do not rescue or rewrite that result.

- soak ID: `SOAK-2026-08-29-A`
- 2026-08-31 disposition: **FAIL — NOT COUNTABLE**
- terminal state: **CLOSED_FAILED**
- terminal count: **0/10**
- historical failure evidence: retained
- retroactive reconstruction: forbidden

## New soak independence

The old soak is closed. Its failure flag, counter, and last-assessed session are not inputs to the new soak.

The new soak starts as:

- soak ID: `SOAK-2026-09-01-B`
- baseline: `8223bc8c75f87a9714f89c935d45216d72ff5837`
- state: **COUNTING**
- count: **0/10**
- last assessed session: **null**

Evidence tagged with the old or any different soak ID must be rejected without mutating the new soak. Date-order checks apply only within one soak ID.

## Counting rule

1. The first distinct completed NYSE session that fully passes under the new soak ID and baseline is eligible for **PASS 1/10**.
2. It is not made non-countable merely because the old soak failed.
3. A failed scheduled attempt within a session cannot be rescued by a later success for the same session.
4. A manual run cannot count.
5. A failure or incomplete required evidence closes only the current soak sequence.
6. Any material control-plane change requires another distinct soak ID and new frozen baseline.
7. Evidence-only records under `research/` and validated append-only operational-data advances do not change the baseline.

This record freezes the new independent soak at **0/10**. It does not certify C5 and does not authorize Production.
