# Unified 9-Series PWA UX — 2026-10-11

## User-reported problem

Previously the TQQQ PWA had 21 exposed navigation buttons plus separate Gold50, Phase5, Native and ETF-research panels with inconsistent presentation. The user requested **one unified comparison and uncluttered UI**, not a new strategy or changed investment rule.

## New information architecture

The **original existing app and URL** remain the entry point, with exactly five primary navigation choices:

1. **今日の判断** — authoritative daily TQQQ baseline/manual-only holdings flow, unchanged.
2. **総合ダッシュボード** — common 9-series evidence overview first, with original detailed operations dashboard behind an optional disclosure.
3. **9系列 Forward** — same 9-series table first. Deep technical detail is organized as three collapsed sections: VS13/TQQQ & benchmarks, Phase5 ETF/Native, and Gold50.
4. **研究・戦略詳細** — secondary dropdown groups Historical, Walk-Forward, annual returns, robustness, Native research, cross-ETF and weekly studies. These are *research views*, **not** additional concurrent Forward strategies.
5. **運用・設定** — secondary dropdown groups human lifecycle review, operational status, Production authorization, Paper Trading, CSV, user guide, roadmap and calculation specification.

All original detailed views remain in the code and are reachable via secondary nav; the prior top-level clutter is not visible.

## Data provenance & honest performance comparison

The unified scorecard displays **exactly nine actually-soaked Forward lines**:
- VS13, VS12, VT30, TQQQ buy-and-hold and QQQ buy-and-hold (five).
- UPRO-SPBT, SSO-SPBT-Scaled, QLD-VS13-Scaled (three).
- Gold50 frozen research mapper (one).

The same columns — strategy, date, valid observations, model return, DD, model transactions, allocation, evidence/status — are used for all rows. The status text is descriptive, not a cross-strategy performance rank. The existing TQQQ/Phase5 model equity and missing-day records remain independent, unchanged and available. Their start dates, signal definitions and portfolio currencies are **not** equated by visual alignment.

Gold50 uses the already audited read-only public source, strict `parseGoldForwardEvidence` including C10/10 and gap boundaries, and independently shows signal observation count and current TQQQ/GLD/Cash allocation. Gold50 **does not yet have a certified comparable portfolio P&L**; its return/DD/execution count cells remain unavailable `—` rather than invented zeros. No interpolation, 2026-09 soak inclusion, normalization trick or retrospective backfill is permitted.

## Immutability & trading safety

No changes to `ops-state` data, frozen strategies, signal scoring, trade directives, broker-order permissions, data-fetch schedules, PR protection, Phase5 strategy selection, or Gold50 collection pipeline. No auto buy/sell and no broker API or account access. Client research dashboard only.

Existing Google/desktop/mobile PWA entry is preserved; no new separate website. Main protection should run the full core regression and integrated Pages build. This UI-only merge does not directly publish Pages (authoritative main+ops-state deployment is still required), and success should not be claimed as live until browser verification.

## User acceptance

- Top navigation shows five primary sections and secondary dropdown (not 21 flat tabs).
- Unified 9-row scorecard appears in dashboard and Forward sections.
- All original technical detail remains accessible and correctly labeled.
- Gold50 first-session 0 row is not misrepresented as a return zero.
- No direct broker order controls or unapproved strategy promotion.
- Responsive on narrow iPhone width.
