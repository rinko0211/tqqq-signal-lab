# Unified TQQQ PWA Gold50 gaps: matching explicit research segments (2026-10-11)

Companion to Gold50 independent repository PR #6. Gold50 `src/long-forward.mjs` now permits validated future observations **after** an unavailable NYSE session only when the record has `continuity.kind=UNOBSERVED_GAP`, `expectedDate`, and `actualDate`. No missing records are inserted; the new observation is a separate performance segment with manual brokerage order-leg count and Action Day **unknown**.

The preexisting TQQQ integrated panel must:
- accept a valid first new observation after the Oct12 start *only if* initial expected-day gap is explicitly recorded;
- separate later actual gaps with explicit `UNOBSERVED_GAP` metadata; reject forged gap assertions, duplicates and unregistered retrospective starts;
- visibly display post-gap order legs/Action Day as `不明` rather than `0/なし`;
- allow the **non-executable local theoretical share preview** after a **second consecutive valid observation in a recovered segment** and only when fresh TQQQ signal and status date agree with the Gold row; otherwise disable;
- never combine segmented Gold signal observations into one hypothetical wealth curve or assert a finished investment product.

These changes are pure UI/read-only evidence parsing, no changes to ops-state, scheduled TQQQ signal or Phase5 research code, Trading APIs, Production authority, actual user holdings or frozen parameters.
