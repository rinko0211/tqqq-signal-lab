"use client";

import { useEffect, useMemo, useState } from "react";
import { summarizeForward, type ForwardLedger } from "../lib/forward";
import { summarizePhase5, type Phase5Ledger } from "../lib/phase5-forward";
import { phase5PaperAccounts } from "../lib/phase5-paper";

export type Phase5StatusFile = {
  generatedAt?: string;
  status: string;
  forwardStart?: string;
  latestDates?: Record<string, string>;
  records?: number;
  errors?: string[];
};

export type ProductionSnapshot = {
  ticker: string;
  strategy: string;
  version?: string;
  date?: string;
  target: number;
  previousTarget: number;
  executionDate?: string;
  regime?: string;
  score?: number;
  state?: string;
};

const pct = (v: number, d = 1) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—";
const yen = (v: number) =>
  Number.isFinite(v)
    ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v)
    : "—";
const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

function Chip({ tone = "neutral", children }: { tone?: "ok" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

function SimpleTable({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table">
      <table>
        <thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const roleLabel: Record<string, string> = {
  PRIMARY_CHALLENGER: "最有力候補",
  "S&P_LEVERAGE_CONTROL": "S&P 2x比較",
  NASDAQ_BALANCED_CONTROL: "Nasdaq 2x比較",
};

const systemDescription: Record<string, string> = {
  "UPRO-SPBT-v1.0": "S&P500 3x。Phase 3でCommonを明確に上回ったBroad Trend Native。",
  "SSO-SPBT-Scaled-v1.0": "S&P500 2x。同じBroad Trendロジックでレバレッジ差を比較。",
  "QLD-VS13-Scaled-v1.0": "Nasdaq-100 2x。Common VS13に倍率換算8.67% Stop。",
};

export function ResearchLineage() {
  const rows = [
    ["Phase 2", "Leverage Risk Control", "3x=13% / 2x=8.67%（機械換算仮説）", "2xは単純な劣化版ではない。8.67%は最適値とは未証明"],
    ["Phase 3", "Native Research", "S&P: SP_BROAD_TREND採用", "NasdaqはCommon維持"],
    ["Phase 4", "Ticker Swing / Allocator", "REJECT", "複雑化がUPRO Native単体を上回らず"],
    ["Phase 5", "True Forward Gate", "ACTIVE", "UPRO / SSO / QLDを凍結して未来観測"],
  ];
  return (
    <article className="panel researchLineage">
      <div className="panelHead"><div><em>RESEARCH LINEAGE</em><h2>なぜ今この4系統を見ているか</h2></div><Chip tone="ok">Historical探索は停止</Chip></div>
      <SimpleTable heads={["段階", "問い", "結論", "運用への意味"]} rows={rows} />
    </article>
  );
}

export function IntegratedDashboard({ production, productionForward, phase5, phase5Status, platformMode, humanApproved }: {
  production: ProductionSnapshot | null;
  productionForward: ForwardLedger | null;
  phase5: Phase5Ledger | null;
  phase5Status: Phase5StatusFile | null;
  platformMode?: string;
  humanApproved?: boolean;
}) {
  const challengers = phase5 ? summarizePhase5(phase5) : [];
  const formalProduction = platformMode === "PRODUCTION" && humanApproved === true;
  const champion = productionForward ? summarizeForward(productionForward).find((x) => x.id === "VS13") : null;
  const changed = production ? Math.abs(production.target - production.previousTarget) > 0.001 : false;
  return (
    <>
      <section className="opsDashboard">
        <article className="decision productionCard">
          <div className="panelHead"><div><em>{formalProduction ? "FORMAL PRODUCTION · HUMAN APPROVED" : "OPERATIONAL BASELINE · NOT FORMAL PRODUCTION"}</em><h2>{formalProduction ? "現在の正式運用" : "現在の日次運用基準"}</h2></div><Chip tone={formalProduction ? "ok" : "warn"}>{formalProduction ? "PRODUCTION" : "BASELINE"}</Chip></div>
          {production ? <>
            <div className="opsHeadline"><div><span>{production.ticker} / {production.version || production.strategy}</span><strong>{Math.round(production.target * 100)}%</strong></div><div><span>本日のAction</span><b>{changed ? `${Math.round(production.previousTarget * 100)}% → ${Math.round(production.target * 100)}%` : "売買なし"}</b></div></div>
            <p>{production.date || "—"} 判定 · {production.regime || "Regime未表示"} · Score {production.score ?? "—"}</p>
            <div className="opsNext"><span>次回約定想定</span><strong>{changed ? production.executionDate || "次営業日始値" : "なし"}</strong></div>
          </> : <p>Production Signalを読み込めません。System Statusを確認してください。</p>}
          <div className="opsMiniGrid"><div><span>Forward仮想元本</span><b>{champion ? yen(champion.currentCapital) : "—"}</b></div><div><span>Forward DD</span><b>{champion ? pct(champion.currentDd) : "—"}</b></div><div><span>Evidence</span><b>{champion?.evidence || "—"}</b></div></div><p className="note">{formalProduction ? "正式ProductionはHuman Approval済みです。" : "このカードはOperational Baselineであり、正式Production承認状態ではありません。"} Forward金額はJPY-normalized仮想元本で、USD/JPY変動・税・broker固有の実コストを含みません。</p>
        </article>

        <article className="decision challengerCard">
          <div className="panelHead"><div><em>PHASE 5 · RESEARCH OBSERVATION ONLY</em><h2>Productionとは別の候補群</h2></div><Chip tone={phase5Status?.status === "success" ? "warn" : "bad"}>{phase5Status?.status === "success" ? "ACTIVE" : "要確認"}</Chip></div>
          <p>ここに表示されるUPRO / SSO / QLDは、現在の売買指示ではありません。Phase 6までは独立Forwardで観測します。</p>
          <div className="opsMiniGrid"><div><span>新規候補</span><b>{challengers.length || 3}本</b></div><div><span>Forward記録</span><b>{phase5?.records.length ?? 0}件</b></div><div><span>Formal Review</span><b>{phase5?.reviewSchedule.formal || "2027-08-25"}</b></div></div>
          <div className="opsNext"><span>現在の状態</span><strong>{challengers.length ? challengers.map((x) => `${x.ticker}: ${x.status}`).join(" · ") : "最初の確定Bar待ち"}</strong></div>
        </article>
      </section>

      <article className="panel">
        <div className="panelHead"><div><em>DAILY CONTROL BOARD</em><h2>ProductionとChallengerを混同しない</h2></div><span>Productionだけが実運用判断。Challengerは比較観測。</span></div>
        <SimpleTable heads={["区分", "Ticker / Version", "現在Target", "Position", "次回Action", "観測", "Evidence"]} rows={[
          [<Chip key="p" tone="ok">PRODUCTION</Chip>, `${production?.ticker || "TQQQ"} / ${production?.version || production?.strategy || "VS13"}`, production ? `${Math.round(production.target * 100)}%` : "—", "実保有は今日のシグナルで確認", changed ? production?.executionDate || "次営業日" : "なし", champion?.observations ?? "—", champion?.evidence || "—"],
          ...challengers.map((x) => {
            const last = phase5!.records.filter((r) => r.strategyVersion === x.version).at(-1);
            return [<Chip key={x.version} tone="warn">RESEARCH</Chip>, `${x.ticker} / ${x.version}`, last ? `${Math.round(last.targetExposure * 100)}%` : "—", last ? `${Math.round(last.position * 100)}%` : "—", last && Math.abs(last.targetExposure - last.position) > 0.001 ? last.intendedExecutionDate : "なし", x.observations, x.evidence];
          }),
        ]} />
      </article>
      <ResearchLineage />
    </>
  );
}

export function Phase5ForwardPanel({ productionForward, ledger, status }: {
  productionForward: ForwardLedger | null;
  ledger: Phase5Ledger | null;
  status: Phase5StatusFile | null;
}) {
  if (!ledger) return <article className="panel"><em>PHASE 5 FORWARD</em><h2>Phase 5台帳を読み込めません</h2><p className="warningNote">既存Production Forwardには影響しません。Phase 5 Workflowとstatus JSONを確認してください。</p></article>;
  const rows = summarizePhase5(ledger);
  const champion = productionForward ? summarizeForward(productionForward).find((x) => x.id === "VS13") : null;
  return (
    <>
      <article className="guideHero phase5Hero"><em>PHASE 5 · TRUE FORWARD GATE</em><h2>3候補を凍結して未来だけで検証</h2><p>2026-08-25より前へSignalを遡及しません。6か月は情報更新のみ、12か月で初めてPhase 6昇格可否を審査します。</p><p className="warningNote">表示する資産額はJPY-normalizedの比較用仮想元本です。ETFのUSD価格リターンを比較しており、為替・税・実broker約定コストを含む日本円口座実績ではありません。</p><div className="contextBadges"><Chip tone={status?.status === "success" ? "ok" : "bad"}>{status?.status === "success" ? "Workflow正常" : "Workflow要確認"}</Chip><Chip tone="warn">Production変更なし</Chip></div></article>
      <section className="candidateCards">{ledger.freezes.map((freeze) => {
        const s = rows.find((x) => x.version === freeze.version)!;
        const last = ledger.records.filter((r) => r.strategyVersion === freeze.version).at(-1);
        return <article className="panel candidateAccount" key={freeze.version}><div className="panelHead"><div><em>{roleLabel[freeze.role] || freeze.role}</em><h2>{freeze.ticker}</h2></div><Chip tone={s.status === "FORWARD_ACTIVE" ? "ok" : "warn"}>{s.status}</Chip></div><strong className="versionLabel">{freeze.version}</strong><p>{systemDescription[freeze.version]}</p><div className="candidateMetrics"><div><span>Target</span><b>{last ? `${Math.round(last.targetExposure * 100)}%` : "—"}</b></div><div><span>Total Return</span><b>{pct(s.totalReturn)}</b></div><div><span>DD</span><b>{pct(s.currentDd)}</b></div><div><span>Actions</span><b>{s.actionDays}</b></div></div><p className="note">開始 {freeze.startDate} · Evidence {s.evidence} · 観測 {s.observations}</p></article>;
      })}</section>
      <article className="panel"><div className="panelHead"><div><em>FORWARD FRONTIER</em><h2>既存TQQQ Championとの比較</h2></div><span>短期順位ではなく、壊れていないかを優先</span></div><SimpleTable heads={["System", "役割", "開始", "仮想元本/Return", "Current DD", "Action", "Evidence", "次回Review"]} rows={[
        ["TQQQ / VS13-v1.0", "Production Champion", productionForward?.freezes[0]?.startDate || "2026-08-21", champion ? `${yen(champion.currentCapital)} / ${pct(champion.totalReturn)}` : "—", champion ? pct(champion.currentDd) : "—", champion?.orders ?? "—", champion?.evidence || "—", productionForward?.reviewSchedule.twelveMonth || "2027-08-23"],
        ...ledger.freezes.map((f) => { const s = rows.find((x) => x.version === f.version)!; return [`${f.ticker} / ${f.version}`, roleLabel[f.role] || f.role, f.startDate, `${yen(s.currentCapital)} / ${pct(s.totalReturn)}`, pct(s.currentDd), s.actionDays, s.evidence, ledger.reviewSchedule.formal]; }),
      ]} /></article>
      <article className="panel formula"><em>FORWARD GOVERNANCE</em><h2>昇格条件は先に固定</h2><code>{ledger.promotionPolicy}</code><p>ロジックを変更する場合は新Version・新startDateです。既存台帳の上書きは禁止です。</p></article>
    </>
  );
}

export function Phase5PaperPanel({ ledger }: { ledger: Phase5Ledger | null }) {
  const [paperConfig, setPaperConfig] = useState<{ initialJpy: number; fxRate: number } | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("tqqq-paper-v1") || "null");
        setPaperConfig(saved ? { initialJpy: Number(saved.initialJpy) || 1_000_000, fxRate: Number(saved.fxRate) || 150 } : null);
      } catch { setPaperConfig(null); }
    };
    load();
    window.addEventListener("paper-config-changed", load);
    return () => window.removeEventListener("paper-config-changed", load);
  }, []);
  const accounts = useMemo(() => ledger && paperConfig ? phase5PaperAccounts(ledger, paperConfig.initialJpy, paperConfig.fxRate) : [], [ledger, paperConfig]);
  return (
    <article className="panel phase5Paper">
      <div className="panelHead"><div><em>PHASE 5 · PARALLEL PAPER ACCOUNTS</em><h2>候補ごとに独立100%比較</h2></div><Chip tone={ledger ? "warn" : "bad"}>Research only</Chip></div>
      <p className="note">既存Production Paperの初期資金・固定USD/JPY設定を共有します。ただし各候補の開始日は凍結された真のForward開始日から変更できません。3口座を同時保有する提案ではなく、比較用の独立仮想口座です。固定FXレートで表示するため、為替・税・broker固有コストを含む実円建て口座損益ではありません。</p>
      {!paperConfig && <div className="emptyMini">上のProduction Paper Tradingを開始すると、同じ初期資金条件でPhase 5候補も自動表示します。</div>}
      {paperConfig && !ledger && <div className="emptyMini">Phase 5 Forward台帳を読み込めません。</div>}
      {accounts.length > 0 && <>
        <SimpleTable heads={["Candidate", "役割", "開始日", "仮想資産", "仮想損益", "Return", "Max DD", "Action", "Target", "次回約定"]} rows={accounts.map((a) => [`${a.ticker} / ${a.version}`, roleLabel[a.role] || a.role, a.startDate, yen(a.equityJpy), yen(a.pnlJpy), pct(a.totalReturn), pct(a.maxDd), a.actions, `${Math.round(a.currentTarget * 100)}%`, a.nextExecutionDate || "なし"])} />
        <div className="paperAccountGrid">{accounts.map((a) => <div className="paperAccount" key={a.version}><span>{a.ticker}</span><strong>{yen(a.equityJpy)}</strong><small>{pct(a.totalReturn)} · DD {pct(a.currentDd)} · {a.evidence}</small></div>)}</div>
        {accounts.some((a) => a.trades.length) && <SimpleTable heads={["Version", "判定日", "約定日", "変更", "価格", "推定数量", "費用"]} rows={accounts.flatMap((a) => a.trades.slice(-10).map((t) => [t.version, t.signalDate, t.executionDate, `${Math.round(t.before * 100)}%→${Math.round(t.after * 100)}%`, `$${t.price.toFixed(2)}`, num(t.estimatedQuantity, 4), yen(t.totalCostJpy)]))} />}
      </>}
    </article>
  );
}

export function Phase5SystemStatus({ ledger, status }: { ledger: Phase5Ledger | null; status: Phase5StatusFile | null }) {
  const summaries = ledger ? summarizePhase5(ledger) : [];
  const latest = status?.latestDates ? Object.values(status.latestDates).filter(Boolean).sort()[0] : undefined;
  return <article className="panel health"><div className="panelHead"><div><em>PHASE 5 SUBSYSTEM</em><h2>Challenger Forward</h2></div><Chip tone={status?.status === "success" && ledger ? "ok" : "bad"}>{status?.status === "success" && ledger ? "Operational" : "Check required"}</Chip></div><div className="statusGrid"><div className="metric"><span>最終取得日</span><strong>{latest || "—"}</strong></div><div className="metric"><span>台帳件数</span><strong>{ledger?.records.length ?? "—"}</strong></div><div className="metric"><span>候補</span><strong>{ledger?.freezes.length ?? 3}</strong></div><div className="metric"><span>次回Review</span><strong>{ledger?.reviewSchedule.interim || "2027-02-25"}</strong></div><div className="metric"><span>Formal Gate</span><strong>{ledger?.reviewSchedule.formal || "2027-08-25"}</strong></div><div className="metric"><span>Evidence</span><strong>{summaries.length ? summaries.map((x) => x.evidence).join(" / ") : "Insufficient"}</strong></div></div>{status?.errors?.length ? <p className="warningNote">{status.errors.join(" / ")}</p> : <p className="note">Production Signalとは隔離されています。Phase 5側の障害でProduction台帳を変更しません。</p>}</article>;
}
