export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "skipped";

export type SoakDisposition = "PASS" | "FAIL" | "NOT_COUNTED";

export type SoakPhase =
  | "COUNTING"
  | "CLOSED_FAILED"
  | "REBASELINE_REQUIRED";

export interface ScheduledAttempt {
  trigger: "schedule" | "workflow_dispatch" | "workflow_call" | "push";
  conclusion: WorkflowConclusion;
}

export interface SessionLaneEvidence {
  attempts: ScheduledAttempt[];
}

export interface SoakSessionEvidence {
  soakId: string;
  sessionDate: string;
  controlPlaneBaseline: string;
  daily: SessionLaneEvidence;
  phase5: SessionLaneEvidence;
  lifecycle: SessionLaneEvidence;
  pagesPublished: boolean;
  appendOnlyIntegrityPassed: boolean;
  productionRemainsResearch: boolean;
}

export interface SoakState {
  soakId: string;
  baseline: string | null;
  consecutivePasses: number;
  phase: SoakPhase;
  lastAssessedSession: string | null;
}

export interface SoakAssessment {
  disposition: SoakDisposition;
  reason:
    | "ACCEPTED"
    | "FAILED_SCHEDULED_ATTEMPT"
    | "INCOMPLETE_SCHEDULED_EVIDENCE"
    | "SOAK_ID_MISMATCH"
    | "CONTROL_PLANE_MISMATCH"
    | "INTEGRITY_OR_AUTHORITY_FAILURE";
  state: SoakState;
}

const failedConclusions = new Set<WorkflowConclusion>([
  "failure",
  "cancelled",
  "timed_out",
  "skipped",
]);

function scheduledAttempts(lane: SessionLaneEvidence): ScheduledAttempt[] {
  return lane.attempts.filter((attempt) => attempt.trigger === "schedule");
}

function hasScheduledFailure(lane: SessionLaneEvidence): boolean {
  return scheduledAttempts(lane).some((attempt) =>
    failedConclusions.has(attempt.conclusion),
  );
}

function hasScheduledSuccess(lane: SessionLaneEvidence): boolean {
  return scheduledAttempts(lane).some(
    (attempt) => attempt.conclusion === "success",
  );
}

export function startSoak(soakId: string, baseline: string): SoakState {
  if (!soakId) throw new Error("soak id is required");
  if (!baseline) throw new Error("soak baseline is required");
  return {
    soakId,
    baseline,
    consecutivePasses: 0,
    phase: "COUNTING",
    lastAssessedSession: null,
  };
}

export function recordMaterialControlPlaneChange(state: SoakState): SoakState {
  return {
    ...state,
    baseline: null,
    consecutivePasses: 0,
    phase: "REBASELINE_REQUIRED",
  };
}

export function freezeRemediatedBaseline(
  state: SoakState,
  newSoakId: string,
  baseline: string,
): SoakState {
  if (state.phase !== "REBASELINE_REQUIRED") {
    throw new Error("rebaseline is legal only after a material control-plane change");
  }
  if (!newSoakId || newSoakId === state.soakId) {
    throw new Error("remediated baseline requires a distinct new soak id");
  }
  if (!baseline) throw new Error("remediated baseline is required");
  return startSoak(newSoakId, baseline);
}

export function restartSoakAfterFailure(
  state: SoakState,
  newSoakId: string,
): SoakState {
  if (state.phase !== "CLOSED_FAILED" || !state.baseline) {
    throw new Error("only a closed failed soak can restart on the same baseline");
  }
  if (!newSoakId || newSoakId === state.soakId) {
    throw new Error("replacement soak requires a distinct new soak id");
  }
  return startSoak(newSoakId, state.baseline);
}

export function assessSoakSession(
  state: SoakState,
  evidence: SoakSessionEvidence,
): SoakAssessment {
  if (evidence.soakId !== state.soakId) {
    return {
      disposition: "NOT_COUNTED",
      reason: "SOAK_ID_MISMATCH",
      state,
    };
  }
  if (state.phase !== "COUNTING") {
    throw new Error("only an active counting soak can assess a session");
  }
  if (state.lastAssessedSession && evidence.sessionDate <= state.lastAssessedSession) {
    throw new Error("soak sessions must be assessed once in strict date order");
  }

  const next = (overrides: Partial<SoakState>): SoakState => ({
    ...state,
    lastAssessedSession: evidence.sessionDate,
    ...overrides,
  });

  if (!state.baseline || evidence.controlPlaneBaseline !== state.baseline) {
    return {
      disposition: "NOT_COUNTED",
      reason: "CONTROL_PLANE_MISMATCH",
      state: next({
        baseline: null,
        consecutivePasses: 0,
        phase: "REBASELINE_REQUIRED",
      }),
    };
  }

  const lanes = [evidence.daily, evidence.phase5, evidence.lifecycle];
  if (lanes.some(hasScheduledFailure)) {
    return {
      disposition: "FAIL",
      reason: "FAILED_SCHEDULED_ATTEMPT",
      state: next({
        consecutivePasses: 0,
        phase: "CLOSED_FAILED",
      }),
    };
  }

  if (lanes.some((lane) => !hasScheduledSuccess(lane))) {
    return {
      disposition: "NOT_COUNTED",
      reason: "INCOMPLETE_SCHEDULED_EVIDENCE",
      state: next({
        consecutivePasses: 0,
        phase: "CLOSED_FAILED",
      }),
    };
  }

  if (
    !evidence.pagesPublished ||
    !evidence.appendOnlyIntegrityPassed ||
    !evidence.productionRemainsResearch
  ) {
    return {
      disposition: "FAIL",
      reason: "INTEGRITY_OR_AUTHORITY_FAILURE",
      state: next({
        consecutivePasses: 0,
        phase: "CLOSED_FAILED",
      }),
    };
  }

  return {
    disposition: "PASS",
    reason: "ACCEPTED",
    state: next({ consecutivePasses: state.consecutivePasses + 1 }),
  };
}
