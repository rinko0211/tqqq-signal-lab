# Execution Gateway v0 — PAPER-only boundary (2026-10-10)

Status: **RESEARCH / OFFLINE PAPER HARNESS ONLY**. This is an isolated prototype, not a deployed gateway and not brokerage connectivity.

## Authorized topology (future)
\`\`\`
TQQQ Signal Lab (read-only authoritative ops-state)
    -> canonical signed order-intent / freshness / exchange calendar (NOT YET IMPLEMENTED)
    -> separate Execution Gateway (independent enforcement and persistent idempotency; NOT YET IMPLEMENTED)
    -> broker account reconciliation (NOT YET IMPLEMENTED)
    -> human-approved canary gate (NOT AUTHORIZED)
    -> live broker order (NOT AUTHORIZED)
\`\`\`

The present code implements only the offline deterministic **PAPER intent evaluator** in \`lib/execution-gateway-paper.mjs\`. It has **no** network adapter, order endpoint, API token, broker dependency, scheduler, secret access, persistence, browser-local trading authority, or production/PWA import. This module intentionally cannot issue orders.

## Gate v0 implemented
- Default deny: \`policy.mode=PAPER_ONLY\`, explicit \`killSwitch=false\`, \`production.mode=RESEARCH\`, \`approvedByHuman=false\`, and no selected Production ticker.
- Upstream paired \`signal.json\` / \`status.json\` validation: successful, latest, same generation timestamp, same market data date, VS13-v1.0, TQQQ only, discrete target 0/25/50/75/100%.
- Session evidence: injected completed-session date and next-legal-open date must match signal. Intent is rejected when the **UTC** execution date is reached, more conservative than NYSE local open; this is intentionally fail-closed and not yet an independently verified market-calendar oracle.
- Generated signal age limited to 96 hours; stale/invalid/future paper quotes and account snapshots rejected, with tighter 24-hour bounds.
- Offline fixtures only: USD denominated PAPER account, valid NAV, available settled cash, current TQQQ integer shares, zero pending orders. Broker balances are **not** yet fetched or independently reconciled.
- Fixed explicit allowlist, maximum order notional, maximum target position notional and NAV fraction; no margin, leverage, negative cash, fractional quantity or auto-FX. A conservative 8-bps BUY reserve is an example paper-cost allowance, not a live execution guarantee.
- Dedupe: deterministic SHA-256 logical paper intent ID and explicit prior-ID rejection. Prior IDs are caller-provided test evidence; **there is no durable transactional exactly-once store**.
- Results are \`REJECTED\`, \`NO_ACTION\`, or \`PAPER_INTENT\`. In every case \`brokerOrderAllowed=false\` and \`executionAuthority=NONE\`. This result is **never** an instruction to place an order.

## Non-goals / blocked until a separately approved later phase
- No interactive or scheduled real-time monitoring; existing Daily, Phase5, Lifecycle and Approval state writers remain the only authorized writers.
- No changes to Forward ledger, Production config, risk strategy, PWA UI, or historical operational records.
- No external authenticated broker source of truth, fill records, partial-fill lifecycle, order-cancel/retry arbitration, market-hours oracle, atomic CAS, HMAC/signature provenance, or actual failover/kill switch mechanism.
- No broker account creation, no permissions/secret grants, no investment transactions.
- No Production promotion, including after a green paper test; forward evidence remains insufficient as of 2026-10-10.

## Future stage gates (all mandatory)
1. Independent threat model and immutable canonically signed upstream provenance bound to the exact validated state SHA/generation.
2. Independent authoritative NYSE calendar, stale/passed-open rules, split/corporate-action continuity and explicit market-data failure states.
3. Persistent multi-worker intent/idempotency ledger with CAS/serializability and replay/chaos regression; broker-reported open orders, fills, settled funds and held shares reconciled independently.
4. Broker-specific read-only API access first, separate paper API only after review; secrets never committed or exposed to the Signal Lab/PWA.
5. End-to-end long-running paper soak, duplicate/late signal injections, kill-switch failure, broker outage, stale account snapshot and conflicting-order tests.
6. Independent approval of risk limits and Human Production Approval **only** after sufficient lifecycle/Forward evidence. Live canary, if ever authorized, requires a further separate explicit approval.

## Test invocation
\`node --test tests/execution-gateway-paper.test.mjs\`

Also register this suite under normal \`test:core\` and \`test:ops\` so the required P1c Main Protection check runs it. This change only modifies tests and adds an unreferenced offline module/document; it grants no workflow write permission.
