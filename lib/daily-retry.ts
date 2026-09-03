import { marketDataAvailability, type MarketDataAvailability } from "./market-calendar.ts";

export type DailyPipelineMode =
  | "FETCH_AND_DEPLOY"
  | "DEPLOY_PERSISTED"
  | "SKIP_CURRENT";

export type DailyPipelineDecision = {
  mode: DailyPipelineMode;
  runPipeline: boolean;
  fetchData: boolean;
  availability: MarketDataAvailability | "NOT_APPLICABLE";
};

/**
 * Scheduled retries only need the expensive validation/deployment pipeline
 * while the latest completed NYSE session is still missing. Direct/manual
 * runs intentionally remain full refreshes, and an approved deploy-only call
 * must publish the exact persisted state without fetching.
 */
export function decideDailyPipeline(input: {
  eventName: string;
  deployPersistedOnly: boolean;
  marketDataDate?: string;
  now?: string;
}): DailyPipelineDecision {
  if (input.deployPersistedOnly) {
    return {
      mode: "DEPLOY_PERSISTED",
      runPipeline: true,
      fetchData: false,
      availability: "NOT_APPLICABLE",
    };
  }

  if (input.eventName !== "schedule") {
    return {
      mode: "FETCH_AND_DEPLOY",
      runPipeline: true,
      fetchData: true,
      availability: "NOT_APPLICABLE",
    };
  }

  const availability = marketDataAvailability(
    input.marketDataDate,
    input.now,
  ).state;
  if (availability === "CURRENT") {
    return {
      mode: "SKIP_CURRENT",
      runPipeline: false,
      fetchData: false,
      availability,
    };
  }

  return {
    mode: "FETCH_AND_DEPLOY",
    runPipeline: true,
    fetchData: true,
    availability,
  };
}
