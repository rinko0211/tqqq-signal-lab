import { fetchOfficialData } from "../lib/official-data.ts";
import {
  STRATEGIES,
  benchmark,
  datasetFromPayload,
  holdoutForConfig,
  oosComparison,
  robustness,
  runBacktest,
  walkForward,
} from "../lib/engine.ts";

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const payload = await fetchOfficialData();
const dataset = datasetFromPayload(payload);
const errors = dataset.issues.filter((issue) => issue.severity === "error");
if (errors.length)
  throw new Error(errors.map((issue) => issue.message).join("; "));

const comparison = oosComparison(dataset);
const ranked = [...comparison].sort(
  (a, b) =>
    b.metrics.calmar - a.metrics.calmar || b.metrics.sharpe - a.metrics.sharpe,
);
const selected = ranked[0];
const backtest = runBacktest(dataset, STRATEGIES[selected.key]);
const walk = walkForward(dataset);
const stress = robustness(dataset, STRATEGIES[selected.key]);
const latest = backtest.daily.at(-1)!;
const holdoutDataset = {
  ...dataset,
  days: dataset.days.filter((day) => day.date >= "2025-01-01"),
};
const ordersByYear = backtest.yearly.map((year) => ({
  year: year.year,
  entries: year.entries,
  exits: year.exits,
  orders: year.orders,
  turnover: pct(year.turnover),
}));

console.log(
  JSON.stringify(
    {
      source: payload.source,
      retrievedAt: payload.retrievedAt,
      commonPeriod: {
        start: dataset.days[0].date,
        end: dataset.days.at(-1)!.date,
        days: dataset.days.length,
      },
      warnings: dataset.issues
        .filter((issue) => issue.severity === "warning")
        .map((issue) => issue.message),
      pureOosComparison: comparison.map((item) => ({
        strategy: item.name,
        years: item.years,
        cagr: pct(item.metrics.cagr),
        sharpe: +item.metrics.sharpe.toFixed(3),
        sortino: +item.metrics.sortino.toFixed(3),
        maxDd: pct(item.metrics.maxDd),
        calmar: +item.metrics.calmar.toFixed(3),
        ordersPerYear: +item.metrics.ordersPerYear.toFixed(2),
      })),
      fixedHoldoutComparison: Object.values(STRATEGIES).map((config) => {
        const result = holdoutForConfig(dataset, config)!;
        return {
          strategy: config.name,
          startYear: result.startYear,
          cagr: pct(result.metrics.cagr),
          sharpe: +result.metrics.sharpe.toFixed(3),
          sortino: +result.metrics.sortino.toFixed(3),
          maxDd: pct(result.metrics.maxDd),
          calmar: +result.metrics.calmar.toFixed(3),
          ordersPerYear: +result.metrics.ordersPerYear.toFixed(2),
        };
      }),
      selectedForOperationalDisplay: selected.name,
      walkForward: {
        years: walk.years.map((year) => ({
          year: year.year,
          selected: year.selected,
          oosReturn: pct(year.oosReturn),
          oosSharpe: +year.oosSharpe.toFixed(3),
          oosMaxDd: pct(year.oosMaxDd),
          orders: year.orders,
        })),
        stitched: {
          cagr: pct(walk.metrics.cagr),
          sharpe: +walk.metrics.sharpe.toFixed(3),
          sortino: +walk.metrics.sortino.toFixed(3),
          maxDd: pct(walk.metrics.maxDd),
          calmar: +walk.metrics.calmar.toFixed(3),
        },
        holdout: walk.holdout
          ? {
              startYear: walk.holdout.startYear,
              selected: walk.holdout.selected,
              cagr: pct(walk.holdout.metrics.cagr),
              sharpe: +walk.holdout.metrics.sharpe.toFixed(3),
              sortino: +walk.holdout.metrics.sortino.toFixed(3),
              maxDd: pct(walk.holdout.metrics.maxDd),
              calmar: +walk.holdout.metrics.calmar.toFixed(3),
              ordersPerYear: +walk.holdout.metrics.ordersPerYear.toFixed(2),
            }
          : null,
      },
      currentSignal: {
        date: latest.date,
        tqqqClose: dataset.days.at(-1)!.tqqq.close,
        regime: latest.signal.regime,
        score: latest.signal.score,
        components: latest.signal.components,
        target: `${latest.signal.target * 100}%`,
        previousTarget: `${latest.signal.previousTarget * 100}%`,
        reason: latest.signal.reason,
        nextChange: latest.signal.nextChange,
      },
      selectedFullPeriodAudit: {
        cagr: pct(backtest.metrics.cagr),
        sharpe: +backtest.metrics.sharpe.toFixed(3),
        sortino: +backtest.metrics.sortino.toFixed(3),
        maxDd: pct(backtest.metrics.maxDd),
        calmar: +backtest.metrics.calmar.toFixed(3),
        entries: backtest.metrics.entries,
        exits: backtest.metrics.exits,
        roundTrips: backtest.metrics.roundTrips,
        rebalanceOrders: backtest.metrics.rebalanceOrders,
        changeDays: backtest.metrics.changeDays,
        ordersPerYear: +backtest.metrics.ordersPerYear.toFixed(2),
        annualTurnover: pct(backtest.metrics.annualTurnover),
        ordersByYear,
      },
      benchmarks: {
        tqqq: benchmark(dataset, "tqqq"),
        qqq: benchmark(dataset, "qqq"),
      },
      holdoutBenchmarks: {
        tqqq: benchmark(holdoutDataset, "tqqq"),
        qqq: benchmark(holdoutDataset, "qqq"),
      },
      robustness: {
        parameterNeighborhood: stress.variants,
        costStress: stress.cost,
        executionDelay: stress.delay,
        ablation: stress.ablation,
        positionModes: stress.modes,
        bootstrap: stress.bootstrap,
        crises: stress.crises,
      },
    },
    null,
    2,
  ),
);
