import { isNyseSession, nextNyseSession } from "./market-calendar.ts";

export const P1A_START_AFTER_MARKET_DATE = "2026-09-22";
export const P1A_TARGET_SESSIONS = 3;

export type StatePlaneCanaryState = "ACTIVE" | "COMPLETE" | "RESET_REQUIRED";
export type StatePlaneCanaryClassification =
  | "PRE_CANARY_BASELINE"
  | "PASS_COUNTABLE"
  | "DUPLICATE_OR_OLD"
  | "SOURCE_NOT_COUNTABLE"
  | "GAP_DETECTED"
  | "COMPLETE_NO_COUNT";

export type StatePlaneCanaryLedger = {
  schemaVersion: 1;
  mode: "P1A_SHADOW_CANARY";
  authoritative: false;
  startAfterMarketDate: string;
  targetSessions: number;
  successfulDates: string[];
  counter: string;
  canaryState: StatePlaneCanaryState;
  gap: null | { expected: string; observed: string };
  lastObservation: {
    sourceMainSha: string;
    dataTreeSha256: string;
    marketDataDate: string | null;
    generatedAt: string | null;
    classification: StatePlaneCanaryClassification;
  } | null;
};

type SourceStatus = {
  actionStatus?: string;
  state?: string;
  errors?: unknown[];
  marketDataDate?: string;
  generatedAt?: string;
};

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA64 = /^[0-9a-f]{64}$/i;
const clone = <T>(x: T): T => structuredClone(x);

export function emptyStatePlaneCanary(): StatePlaneCanaryLedger {
  return {
    schemaVersion: 1,
    mode: "P1A_SHADOW_CANARY",
    authoritative: false,
    startAfterMarketDate: P1A_START_AFTER_MARKET_DATE,
    targetSessions: P1A_TARGET_SESSIONS,
    successfulDates: [],
    counter: `S0/${P1A_TARGET_SESSIONS}`,
    canaryState: "ACTIVE",
    gap: null,
    lastObservation: null,
  };
}

export function assertStatePlaneCanaryIntegrity(ledger: StatePlaneCanaryLedger) {
  if (
    ledger.schemaVersion !== 1 ||
    ledger.mode !== "P1A_SHADOW_CANARY" ||
    ledger.authoritative !== false ||
    ledger.startAfterMarketDate !== P1A_START_AFTER_MARKET_DATE ||
    ledger.targetSessions !== P1A_TARGET_SESSIONS ||
    !Array.isArray(ledger.successfulDates)
  ) throw new Error("STATE_PLANE_CANARY_INVALID");

  const unique = new Set(ledger.successfulDates);
  if (unique.size !== ledger.successfulDates.length) throw new Error("STATE_PLANE_CANARY_DUPLICATE_DATE");

  let expected = nextNyseSession(P1A_START_AFTER_MARKET_DATE);
  for (const date of ledger.successfulDates) {
    if (!isNyseSession(date) || date !== expected) throw new Error("STATE_PLANE_CANARY_NON_CONSECUTIVE");
    expected = nextNyseSession(expected);
  }

  const capped = Math.min(ledger.successfulDates.length, P1A_TARGET_SESSIONS);
  if (ledger.counter !== `S${capped}/${P1A_TARGET_SESSIONS}`) throw new Error("STATE_PLANE_CANARY_COUNTER_MISMATCH");
  if (ledger.canaryState === "COMPLETE" && ledger.successfulDates.length < P1A_TARGET_SESSIONS) throw new Error("STATE_PLANE_CANARY_PREMATURE_COMPLETE");
  if (ledger.canaryState === "RESET_REQUIRED" && !ledger.gap) throw new Error("STATE_PLANE_CANARY_GAP_REQUIRED");
  if (ledger.canaryState !== "RESET_REQUIRED" && ledger.gap) throw new Error("STATE_PLANE_CANARY_UNEXPECTED_GAP");
}

export function updateStatePlaneCanary(args: {
  prior?: StatePlaneCanaryLedger | null;
  status: SourceStatus;
  sourceMainSha: string;
  dataTreeSha256: string;
}): StatePlaneCanaryLedger {
  const { status, sourceMainSha, dataTreeSha256 } = args;
  if (!SHA40.test(sourceMainSha) || !SHA64.test(dataTreeSha256)) throw new Error("STATE_PLANE_CANARY_HASH_INVALID");

  const ledger = args.prior ? clone(args.prior) : emptyStatePlaneCanary();
  assertStatePlaneCanaryIntegrity(ledger);

  const date = typeof status.marketDataDate === "string" ? status.marketDataDate : null;
  const sourceCountable =
    status.actionStatus === "success" &&
    status.state === "latest" &&
    Array.isArray(status.errors) &&
    status.errors.length === 0 &&
    Boolean(date) &&
    isNyseSession(date!);

  let classification: StatePlaneCanaryClassification;

  if (!date || date <= P1A_START_AFTER_MARKET_DATE) {
    classification = "PRE_CANARY_BASELINE";
  } else if (ledger.canaryState === "COMPLETE") {
    classification = "COMPLETE_NO_COUNT";
  } else if (ledger.canaryState === "RESET_REQUIRED") {
    classification = "GAP_DETECTED";
  } else if (!sourceCountable) {
    classification = "SOURCE_NOT_COUNTABLE";
  } else {
    const last = ledger.successfulDates.at(-1) ?? P1A_START_AFTER_MARKET_DATE;
    const expected = nextNyseSession(last);
    if (date! < expected) {
      classification = "DUPLICATE_OR_OLD";
    } else if (date! > expected) {
      ledger.canaryState = "RESET_REQUIRED";
      ledger.gap = { expected, observed: date! };
      classification = "GAP_DETECTED";
    } else {
      ledger.successfulDates.push(date!);
      classification = "PASS_COUNTABLE";
      if (ledger.successfulDates.length >= P1A_TARGET_SESSIONS) ledger.canaryState = "COMPLETE";
    }
  }

  const capped = Math.min(ledger.successfulDates.length, P1A_TARGET_SESSIONS);
  ledger.counter = `S${capped}/${P1A_TARGET_SESSIONS}`;
  ledger.lastObservation = {
    sourceMainSha,
    dataTreeSha256,
    marketDataDate: date,
    generatedAt: typeof status.generatedAt === "string" ? status.generatedAt : null,
    classification,
  };
  assertStatePlaneCanaryIntegrity(ledger);
  return ledger;
}
