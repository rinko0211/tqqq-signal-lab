export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "skipped";

export type SoakDisposition = "PASS" | "FAIL" | "NOT_COUNTED";

export type SoakPhase =
  | "COUNTING"
  | "RECOVERY_VERIFICATION_REQUIRED"
  | "REBASELINE_REQUIRED";

export interface ScheduledAttempt {
  trigger: "schedule" | "workflow_dispatch" | "workflow_call" | "push";
  conclusion: WorkflowConclusion;
}

export interface SessionLaneEvidence {
  attempts: ScheduledAttempt[];
}

export interface SoakSessionEvidence {
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
    | "RECOVERY_BOUNDARY_VERIFIED"
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

export function startSoak(baseline: string): SoakState {
  if (!baseline) throw new Error("soak baseline is required");
  return {
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
  baseline: string,
): SoakState {
  if (state.phase !== "REBASELINE_REQUIRED") {
    throw new Error("rebaseline is legal only after a material control-plane change");
  }
  if (!baseline) throw new Error("remediated baseline is required");
  return {
    ...state,
    baseline,
    consecutivePasses: 0,
    phase: "RECOVERY_VERIFICATION_REQUIRED",
  };
}

export function assessSoakSession(
  state: SoakState,
  evidence: SoakSessionEvidence,
): SoakAssessment {
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
        phase: "RECOVERY_VERIFICATION_REQUIRED",
      }),
    };
  }

  if (lanes.some((lane) => !hasScheduledSuccess(lane))) {
    return {
      disposition: "NOT_COUNTED",
      reason: "INCOMPLETE_SCHEDULED_EVIDENCE",
      state: next({
        consecutivePasses: 0,
        phase: "RECOVERY_VERIFICATION_REQUIRED",
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
        phase: "RECOVERY_VERIFICATION_REQUIRED",
      }),
    };
  }

  if (state.phase === "RECOVERY_VERIFICATION_REQUIRED") {
    return {
      disposition: "NOT_COUNTED",
      reason: "RECOVERY_BOUNDARY_VERIFIED",
      state: next({ consecutivePasses: 0, phase: "COUNTING" }),
    };
  }

  return {
    disposition: "PASS",
    reason: "ACCEPTED",
    state: next({ consecutivePasses: state.consecutivePasses + 1 }),
  };
}
