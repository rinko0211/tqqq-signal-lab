import { isNyseSession, nextNyseSession } from "./market-calendar.ts";

export const P1A_BASELINE_ID = "p1a-workflow-run-v2";
export const P1A_START_AFTER_MARKET_DATE = "2026-09-24";
export const P1A_TARGET_SESSIONS = 3;

const LEGACY_BASELINE_ID = "p1a-initial-push-trigger-v1";
const LEGACY_START_AFTER_MARKET_DATE = "2026-09-22";
const AUTHORIZED_LEGACY_GAP = Object.freeze({ expected: "2026-09-23", observed: "2026-09-24" });

export type StatePlaneCanaryState = "ACTIVE" | "COMPLETE" | "RESET_REQUIRED";
export type StatePlaneCanaryClassification =
  | "PRE_CANARY_BASELINE"
  | "PASS_COUNTABLE"
  | "DUPLICATE_OR_OLD"
  | "SOURCE_NOT_COUNTABLE"
  | "GAP_DETECTED"
  | "COMPLETE_NO_COUNT";

export type StatePlaneCanaryRebaseline = {
  fromBaselineId: typeof LEGACY_BASELINE_ID;
  fromStartAfterMarketDate: typeof LEGACY_START_AFTER_MARKET_DATE;
  previousState: "RESET_REQUIRED";
  previousGap: { expected: "2026-09-23"; observed: "2026-09-24" };
  previousSourceMainSha: string;
  previousDataTreeSha256: string;
  reason: "GITHUB_ACTIONS_PUSH_RECURSION_TRIGGER_DEFECT_FIXED";
};

export type StatePlaneCanaryLedger = {
  schemaVersion: 1;
  mode: "P1A_SHADOW_CANARY";
  authoritative: false;
  baselineId: typeof P1A_BASELINE_ID;
  startAfterMarketDate: string;
  targetSessions: number;
  rebaseline: StatePlaneCanaryRebaseline | null;
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

type LegacyResetLedger = {
  schemaVersion?: unknown;
  mode?: unknown;
  authoritative?: unknown;
  startAfterMarketDate?: unknown;
  targetSessions?: unknown;
  successfulDates?: unknown;
  counter?: unknown;
  canaryState?: unknown;
  gap?: unknown;
  lastObservation?: {
    sourceMainSha?: unknown;
    dataTreeSha256?: unknown;
    marketDataDate?: unknown;
    classification?: unknown;
  } | null;
};

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA64 = /^[0-9a-f]{64}$/i;
const clone = <T>(x: T): T => structuredClone(x);

function authorizedLegacyReset(prior: LegacyResetLedger): StatePlaneCanaryRebaseline | null {
  const gap = prior.gap as { expected?: unknown; observed?: unknown } | null;
  const last = prior.lastObservation;
  if (
    prior.schemaVersion !== 1 ||
    prior.mode !== "P1A_SHADOW_CANARY" ||
    prior.authoritative !== false ||
    prior.startAfterMarketDate !== LEGACY_START_AFTER_MARKET_DATE ||
    prior.targetSessions !== P1A_TARGET_SESSIONS ||
    !Array.isArray(prior.successfulDates) ||
    prior.successfulDates.length !== 0 ||
    prior.counter !== "S0/3" ||
    prior.canaryState !== "RESET_REQUIRED" ||
    !gap ||
    gap.expected !== AUTHORIZED_LEGACY_GAP.expected ||
    gap.observed !== AUTHORIZED_LEGACY_GAP.observed ||
    !last ||
    last.marketDataDate !== AUTHORIZED_LEGACY_GAP.observed ||
    last.classification !== "GAP_DETECTED" ||
    typeof last.sourceMainSha !== "string" ||
    !SHA40.test(last.sourceMainSha) ||
    typeof last.dataTreeSha256 !== "string" ||
    !SHA64.test(last.dataTreeSha256)
  ) return null;

  return {
    fromBaselineId: LEGACY_BASELINE_ID,
    fromStartAfterMarketDate: LEGACY_START_AFTER_MARKET_DATE,
    previousState: "RESET_REQUIRED",
    previousGap: { ...AUTHORIZED_LEGACY_GAP },
    previousSourceMainSha: last.sourceMainSha,
    previousDataTreeSha256: last.dataTreeSha256,
    reason: "GITHUB_ACTIONS_PUSH_RECURSION_TRIGGER_DEFECT_FIXED",
  };
}

export function emptyStatePlaneCanary(rebaseline: StatePlaneCanaryRebaseline | null = null): StatePlaneCanaryLedger {
  return {
    schemaVersion: 1,
    mode: "P1A_SHADOW_CANARY",
    authoritative: false,
    baselineId: P1A_BASELINE_ID,
    startAfterMarketDate: P1A_START_AFTER_MARKET_DATE,
    targetSessions: P1A_TARGET_SESSIONS,
    rebaseline,
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
    ledger.baselineId !== P1A_BASELINE_ID ||
    ledger.startAfterMarketDate !== P1A_START_AFTER_MARKET_DATE ||
    ledger.targetSessions !== P1A_TARGET_SESSIONS ||
    !Array.isArray(ledger.successfulDates)
  ) throw new Error("STATE_PLANE_CANARY_INVALID");

  if (ledger.rebaseline) {
    const r = ledger.rebaseline;
    if (
      r.fromBaselineId !== LEGACY_BASELINE_ID ||
      r.fromStartAfterMarketDate !== LEGACY_START_AFTER_MARKET_DATE ||
      r.previousState !== "RESET_REQUIRED" ||
      r.previousGap.expected !== AUTHORIZED_LEGACY_GAP.expected ||
      r.previousGap.observed !== AUTHORIZED_LEGACY_GAP.observed ||
      r.reason !== "GITHUB_ACTIONS_PUSH_RECURSION_TRIGGER_DEFECT_FIXED" ||
      !SHA40.test(r.previousSourceMainSha) ||
      !SHA64.test(r.previousDataTreeSha256)
    ) throw new Error("STATE_PLANE_CANARY_REBASELINE_INVALID");
  }

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
  prior?: StatePlaneCanaryLedger | LegacyResetLedger | null;
  status: SourceStatus;
  sourceMainSha: string;
  dataTreeSha256: string;
}): StatePlaneCanaryLedger {
  const { status, sourceMainSha, dataTreeSha256 } = args;
  if (!SHA40.test(sourceMainSha) || !SHA64.test(dataTreeSha256)) throw new Error("STATE_PLANE_CANARY_HASH_INVALID");

  let ledger: StatePlaneCanaryLedger;
  if (!args.prior) {
    ledger = emptyStatePlaneCanary();
  } else {
    const legacyRebaseline = authorizedLegacyReset(args.prior);
    if (legacyRebaseline) {
      ledger = emptyStatePlaneCanary(legacyRebaseline);
    } else {
      ledger = clone(args.prior as StatePlaneCanaryLedger);
      assertStatePlaneCanaryIntegrity(ledger);
    }
  }

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
