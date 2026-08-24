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
export const UPRO_NATIVE_FREEZE: StrategyFreeze = {
  ...UPRO_FREEZE,
  id:"UPRO_NATIVE",
  name:"UPRO Native Broad Volatility Target",
  version:"UPRO-Native-v1.0",
  category:"Defensive",
  role:"challenger",
  frozenAt:"2026-08-24T12:54:53.120Z",
  startDate:"2026-08-24",
  config:{...UPRO_FREEZE.config!,sizing:"volTarget",targetPortfolioVol:.25},
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
    freezes: [UPRO_FREEZE,UPRO_NATIVE_FREEZE],
    selectionRule: "UPRO Common VS13 and the single pre-registered UPRO Native candidate run in one isolated Track B ledger. The total live-system budget remains 6. Human approval is required for any production selection.",
  };
}
