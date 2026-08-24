import { emptyForwardLedger, STRATEGY_FREEZES, type ForwardLedger, type StrategyFreeze } from "./forward.ts";

export const TICKER_FORWARD_BUILD = "ticker-forward-1.0.0";
export const UPRO_FREEZE: StrategyFreeze = {
  ...STRATEGY_FREEZES[0],
  id: "UPRO_VS13",
  name: "UPRO + Common VS13",
  version: "UPRO-VS13-v1.0",
  category: "Balanced",
  role: "challenger",
  asset: "TQQQ",
  frozenAt: "2026-08-24T11:15:00.000Z",
};

export type TickerForwardLedger = ForwardLedger & {
  track: "Track B";
  candidateTicker: "UPRO";
  selectionRule: string;
};

export function emptyTickerForwardLedger(now = new Date().toISOString()): TickerForwardLedger {
  return {
    ...emptyForwardLedger(now),
    track: "Track B",
    candidateTicker: "UPRO",
    freezes: [UPRO_FREEZE],
    selectionRule: "UPRO and TQQQ were the only 2026-08-24 cross-ticker candidates passing Pareto and Operational Quality >=80. TQQQ is already recorded in Track A; UPRO starts here. Human approval is required for any production selection.",
  };
}
