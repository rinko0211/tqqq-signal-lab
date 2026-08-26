# Final Reliability Re-Audit Protocol

Date established: 2026-08-26
Status: **ACTIVE GOVERNANCE RULE**

## Purpose
A single successful CI/acceptance run is not sufficient for final reliability certification because later code and file inspection in the first executive audit round found material control-plane defects after earlier PASS conclusions.

Final certification therefore requires repeated independent re-audit.

## Certification rule
Final Reliability Certification may be issued only after **two consecutive complete re-audit rounds discover no new material defect**.

A material finding in any round resets the consecutive-clean count to **0**.

## Current streak
**0 / 2 clean audits**

Reason: the current executive audit round discovered multiple material defects before remediation, including Production-transition and workflow-trigger issues. Successful remediation does not retroactively make the discovery round clean.

## What counts as one complete re-audit round
A round must independently inspect, at minimum:
1. strategy/version freeze and research lineage;
2. data sourcing and ticker/proxy mapping;
3. execution causality and append-only Forward behavior;
4. Production registry and Human Approval path;
5. Daily / Phase5 / Lifecycle workflow triggers and dependencies;
6. non-TQQQ Production transition behavior;
7. TQQQ incumbent Forward isolation;
8. stale/failed fail-closed UI action;
9. current Pages/PWA data semantics;
10. scheduled workflow inventory and archived/manual research isolation;
11. current lifecycle state and Production-selectable logic;
12. current GitHub platform assumptions that materially affect workflow execution.

The auditor must inspect source/configuration files directly and not rely only on earlier audit reports or passing tests.

## Material finding definition
A finding is material when it could reasonably cause one or more of:
- wrong ticker/strategy/version being traded or displayed;
- look-ahead, retroactive fill or rewritten Forward evidence;
- cross-ticker data contamination;
- automatic or insufficiently gated Production promotion;
- stale/failed data appearing actionable;
- Human Approval not actually refreshing the live system;
- recurring historical mining during Forward observation;
- silent failure of a required autonomous workflow;
- a misleading authoritative report that could cause an incorrect operational decision;
- violation of the bounded free/unattended operating design.

Pure formatting, naming or non-operational archive maintenance is not material unless it can change a user or system decision.

## Clean-round rule
A round is CLEAN only if:
- no new material finding is discovered;
- all permanent regression tests pass;
- Daily, Phase5 and Lifecycle authoritative workflows are healthy;
- current state files are internally consistent;
- no automatic Production change occurs;
- any non-material observations are recorded without requiring an operational safety change.

If a material issue is found and fixed during the round, that round is **NOT CLEAN**.

## Certification outcome
- 0/2: continue Forward, no final reliability certification.
- 1/2: continue Forward, one additional independent clean re-audit required.
- 2/2: final reliability certification may be issued, subject to external-platform and market risks that software cannot eliminate.

This protocol does not shorten the frozen Forward evidence gates of 2027-02-25 / 2027-08-25 / 2028-08-25 and does not itself authorize Production.
