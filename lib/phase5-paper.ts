import { summarizePhase5, type Phase5Ledger, type Phase5Role, type Phase5Ticker } from "./phase5-forward.ts";

export type Phase5PaperTrade = {
  version: string;
  ticker: Phase5Ticker;
  signalDate: string;
  executionDate: string;
  before: number;
  after: number;
  turnover: number;
  price: number;
  estimatedQuantity: number;
  equityJpy: number;
  totalCostJpy: number;
};

export type Phase5PaperAccount = {
  version: string;
  ticker: Phase5Ticker;
  role: Phase5Role;
  startDate: string;
  initialJpy: number;
  equityJpy: number;
  pnlJpy: number;
  totalReturn: number;
  currentDd: number;
  maxDd: number;
  currentTarget: number;
  currentPosition: number;
  nextExecutionDate: string | null;
  observations: number;
  liveObservations: number;
  actions: number;
  evidence: string;
  status: string;
  curve: { date: string; equityJpy: number; drawdown: number }[];
  trades: Phase5PaperTrade[];
};

/**
 * Phase 5 challenger paper accounts are projections of the immutable true-Forward ledger.
 * They always begin on each frozen strategy's real Forward start date. We deliberately do
 * not let a device-local start date rewrite that history. Percentage-based costs make the
 * Forward equity path scale linearly to any display capital.
 */
export function phase5PaperAccounts(
  ledger: Phase5Ledger,
  initialJpy = 1_000_000,
  fxRate = 150,
): Phase5PaperAccount[] {
  if (!Number.isFinite(initialJpy) || initialJpy <= 0) throw new Error("Phase 5 paper initialJpy must be positive");
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("Phase 5 paper fxRate must be positive");
  const summary = new Map(summarizePhase5(ledger).map((x) => [x.version, x]));

  return ledger.freezes.map((freeze) => {
    const rows = ledger.records
      .filter((r) => r.strategyVersion === freeze.version)
      .sort((a, b) => a.marketDataDate.localeCompare(b.marketDataDate));
    const scale = initialJpy / freeze.initialCapital;
    const curve = rows.map((r) => ({
      date: r.marketDataDate,
      equityJpy: r.equity * scale,
      drawdown: r.currentDrawdown,
    }));
    const trades: Phase5PaperTrade[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.execution || row.execution.turnover <= 0) continue;
      const priorEquityJpy = (rows[i - 1]?.equity ?? freeze.initialCapital) * scale;
      const estimatedQuantity =
        ((priorEquityJpy / fxRate) * Math.abs(row.execution.after - row.execution.before)) /
        Math.max(row.execution.price, 1e-12);
      trades.push({
        version: freeze.version,
        ticker: freeze.ticker,
        signalDate: row.execution.signalDate,
        executionDate: row.execution.recordedDate,
        before: row.execution.before,
        after: row.execution.after,
        turnover: row.execution.turnover,
        price: row.execution.price,
        estimatedQuantity,
        equityJpy: row.equity * scale,
        totalCostJpy: row.execution.totalCost * scale,
      });
    }
    const last = rows.at(-1);
    const s = summary.get(freeze.version);
    const equityJpy = last ? last.equity * scale : initialJpy;
    const currentTarget = last?.targetExposure ?? 0;
    const currentPosition = last?.position ?? 0;
    return {
      version: freeze.version,
      ticker: freeze.ticker,
      role: freeze.role,
      startDate: freeze.startDate,
      initialJpy,
      equityJpy,
      pnlJpy: equityJpy - initialJpy,
      totalReturn: equityJpy / initialJpy - 1,
      currentDd: last?.currentDrawdown ?? 0,
      maxDd: curve.length ? Math.min(0, ...curve.map((x) => x.drawdown)) : 0,
      currentTarget,
      currentPosition,
      nextExecutionDate:
        last && Math.abs(currentTarget - currentPosition) > 1e-12
          ? last.intendedExecutionDate
          : null,
      observations: rows.length,
      liveObservations: s?.liveObservations ?? 0,
      actions: trades.length,
      evidence: s?.evidence ?? "INSUFFICIENT",
      status: s?.status ?? "AWAITING_FIRST_BAR",
      curve,
      trades,
    };
  });
}
