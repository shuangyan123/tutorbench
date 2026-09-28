export const LEARNER_OUTCOME_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const TEACH_BACK_OUTCOME_PROTOCOL_ID =
  "tutorbench.teach-back-outcome" as const;
export const TEACH_BACK_OUTCOME_PROTOCOL_VERSION = "0.1.0" as const;

export type LearnerOutcomeEvidenceSource =
  | "synthetic_protocol_fixture"
  | "human_observation";

export type TeachBackRecipientKind = "synthetic" | "human";
export type TeachBackRecipientRelativeLevel = "peer" | "lower_prerequisite";

export type TeachBackProcessDimension =
  | "knowledge_reconstruction"
  | "learner_diagnosis"
  | "adaptive_explanation";

export type TeachBackProcessRating = "pass" | "partial" | "fail" | "unscored";

export type TeachBackAssessmentStage =
  | "baseline"
  | "immediate"
  | "near_transfer"
  | "far_transfer";

export type TeachBackAssessmentResult =
  | "correct"
  | "partial"
  | "incorrect"
  | "unscored";

export interface TeachBackTutorExposureRef {
  readonly learningObjective: string;
  readonly tutor: {
    readonly provider: string;
    readonly model: string;
    readonly promptVersion: string;
  };
  readonly sourceScenarioSuiteId?: string;
  readonly sourceScenarioSuiteVersion?: string;
  readonly sourceScenarioId?: string;
  readonly sourceEvaluationRunId?: string;
}

export interface TeachBackRecipientProfile {
  /** Anonymous/pseudonymous label only; do not place names or contact data here. */
  readonly recipientId: string;
  readonly kind: TeachBackRecipientKind;
  readonly relativeLevel: TeachBackRecipientRelativeLevel;
  readonly knownConcepts: readonly string[];
  readonly prerequisiteGaps: readonly string[];
}

export interface TeachBackTranscriptTurn {
  readonly speaker: "learner_teacher" | "recipient";
  readonly content: string;
}

export interface TeachBackProcessEvidence {
  readonly dimension: TeachBackProcessDimension;
  readonly rating: TeachBackProcessRating;
  /** 1-based references into teachBack.transcript. */
  readonly evidenceTurnIndexes: readonly number[];
  readonly rationale?: string;
}

export interface TeachBackRecipientAssessment {
  readonly stage: TeachBackAssessmentStage;
  readonly taskId: string;
  readonly result: TeachBackAssessmentResult;
  readonly independentlyCompleted: boolean;
  readonly notes?: string;
}

export interface TeachBackLearnerOutcomeEvidence {
  readonly schemaVersion: typeof LEARNER_OUTCOME_EVIDENCE_SCHEMA_VERSION;
  readonly evidenceKind: "teach_back";
  readonly protocolId: typeof TEACH_BACK_OUTCOME_PROTOCOL_ID;
  readonly protocolVersion: typeof TEACH_BACK_OUTCOME_PROTOCOL_VERSION;
  readonly evidenceId: string;
  readonly evidenceSource: LearnerOutcomeEvidenceSource;
  /** Anonymous/pseudonymous label for the learner whose post-Tutor learning is being studied. */
  readonly learnerId: string;
  readonly sourceTutorExposure: TeachBackTutorExposureRef;
  readonly recipient: TeachBackRecipientProfile;
  readonly baseline: TeachBackRecipientAssessment;
  readonly teachBack: {
    readonly transcript: readonly TeachBackTranscriptTurn[];
    readonly processEvidence: readonly TeachBackProcessEvidence[];
  };
  readonly recipientOutcomes: {
    readonly immediate: TeachBackRecipientAssessment;
    readonly nearTransfer?: TeachBackRecipientAssessment;
    readonly farTransfer?: TeachBackRecipientAssessment;
  };
  /**
   * v0.1 artifacts are evidence only. They do not establish that the Tutor
   * caused a learning gain, even when post-teaching performance exceeds baseline.
   */
  readonly claimBoundary: "observational_or_proxy_only";
}
