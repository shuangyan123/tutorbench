import type { TutorEvalRubricResultStatus } from "./result.js";
import type {
  TutorCriticalFailure,
  TutorCriticalFailureSeverity,
} from "./tutor-eval.js";

export const TUTOR_HEALTH_TAXONOMY_VERSION = "0.1.0" as const;
export const TUTOR_HEALTH_DIMENSIONS = [
  "content_correctness",
  "learner_diagnosis",
  "intervention_strategy",
  "adaptation",
  "learning_integrity",
  "interaction_quality",
  "reliability_policy",
] as const;

export type TutorHealthDimension = (typeof TUTOR_HEALTH_DIMENSIONS)[number];

export const TUTOR_HEALTH_DIMENSION_LABELS: Readonly<
  Record<TutorHealthDimension, string>
> = {
  content_correctness: "Content & Correctness",
  learner_diagnosis: "Learner Diagnosis",
  intervention_strategy: "Intervention Strategy",
  adaptation: "Adaptation",
  learning_integrity: "Learning Integrity",
  interaction_quality: "Interaction Quality",
  reliability_policy: "Reliability & Policy",
};

export const TUTOR_FINDING_SCHEMA_VERSION = 1 as const;
export const TUTOR_HEALTH_REPORT_SCHEMA_VERSION = 2 as const;

export type TutorFindingSeverity =
  | "info"
  | "minor"
  | "major"
  | "critical";

export type TutorEvaluatorOwner =
  | "deterministic_evaluator"
  | "judge"
  | "tutor_eval_aggregate"
  | "human_reviewer";

export type TutorEvidenceRef =
  | {
      readonly kind: "trajectory_turn";
      readonly sourceId: string;
      readonly scenarioId: string;
      readonly turnIndex: number;
    }
  | {
      readonly kind: "rubric_result";
      readonly sourceId: string;
      readonly scenarioId: string;
      readonly caseId: string;
      readonly runIndex: number;
      readonly turnIndex: number;
      readonly rubricId: string;
      readonly evaluator: "deterministic_evaluator" | "judge";
      readonly result: TutorEvalRubricResultStatus;
    }
  | {
      readonly kind: "critical_failure";
      readonly sourceId: string;
      readonly scenarioId: string;
      readonly caseId: string;
      readonly runIndex: number;
      readonly turnIndex: number;
      readonly evaluator: "judge" | "tutor_eval_aggregate";
      readonly failureType: TutorCriticalFailure;
      readonly severity: TutorCriticalFailureSeverity;
    }
  | {
      readonly kind: "human_evidence";
      readonly sourceId: string;
      readonly scenarioId: string;
      readonly owner: "human_reviewer";
    };

export const TUTOR_OBSERVATION_TYPES = [
  "procedural_hint_given",
  "misconception_detected",
  "direct_answer_disclosed",
  "same_hint_repeated",
  "support_escalated",
  "support_not_escalated",
  "question_asked",
  "factual_error_detected",
  "rubric_result",
  "critical_failure",
] as const;

export type TutorObservationType = (typeof TUTOR_OBSERVATION_TYPES)[number];

export interface TutorObservation {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly type: TutorObservationType;
  readonly scenarioId: string;
  readonly runIndex: number;
  readonly turnIndex: number;
  readonly evaluatorOwner: TutorEvaluatorOwner;
  /** Present only for rubric-result observations; it reports evaluator output. */
  readonly result?: TutorEvalRubricResultStatus;
  readonly evidence: readonly TutorEvidenceRef[];
}

export interface TutorLikelyCauseHypothesis {
  readonly hypothesis: string;
  /** Coarse, uncalibrated evidence-strength value; not a causal probability. */
  readonly confidence: number;
  readonly evidence: readonly TutorEvidenceRef[];
}

export type TutorRecommendationKind =
  | "diagnostic"
  | "implementation_suggestion";

export interface TutorRecommendation {
  readonly kind: TutorRecommendationKind;
  readonly text: string;
}

export interface TutorFindingTemplate {
  readonly type: string;
  readonly title: string;
  readonly severity: TutorFindingSeverity;
  readonly observedBehavior: string;
  readonly diagnosis: string;
  readonly impact: string;
  readonly likelyCauses: readonly {
    readonly hypothesis: string;
    readonly confidence: number;
  }[];
  readonly recommendations: readonly TutorRecommendation[];
  readonly regressionTargets: readonly string[];
  readonly confidence: number;
}

export interface TutorFinding {
  readonly schemaVersion: typeof TUTOR_FINDING_SCHEMA_VERSION;
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly severity: TutorFindingSeverity;
  readonly dimension: TutorHealthDimension;
  readonly scenarioId: string;
  readonly runIndex: number;
  readonly location: {
    readonly startTurn: number;
    readonly endTurn: number;
    readonly decisionPointId?: string;
  };
  readonly observedBehavior: string;
  readonly evidence: readonly TutorEvidenceRef[];
  readonly expectedBehavior: string;
  readonly diagnosis: string;
  readonly impact: string;
  readonly likelyCauses: readonly TutorLikelyCauseHypothesis[];
  readonly recommendations: readonly TutorRecommendation[];
  readonly regressionTargets: readonly string[];
  readonly confidence: number;
}

export const TUTOR_HEALTH_PROFILE_SCHEMA_VERSION = 1 as const;

export interface TutorHealthScoringProfile {
  readonly schemaVersion: typeof TUTOR_HEALTH_PROFILE_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly dimensionWeights: Readonly<Record<TutorHealthDimension, number>>;
}

/**
 * Explicit starter weights for the Productive Struggle suite. This is a
 * suite-scoped reporting profile, not a complete core-tutor profile.
 */
export const DEFAULT_TUTOR_HEALTH_SCORING_PROFILE: TutorHealthScoringProfile = {
  schemaVersion: TUTOR_HEALTH_PROFILE_SCHEMA_VERSION,
  id: "productive-struggle-intervention",
  version: "0.1.0",
  dimensionWeights: {
    content_correctness: 1,
    learner_diagnosis: 1,
    intervention_strategy: 1,
    adaptation: 1,
    learning_integrity: 1,
    interaction_quality: 1,
    reliability_policy: 1,
  },
};

export type TutorReleaseGate = "PASS" | "FAIL" | "UNRESOLVED";

export interface TutorHealthDimensionScore {
  readonly score: number | null;
  readonly assessedCount: number;
  readonly unresolvedCount: number;
}

export interface TutorHealthFindingCounts {
  readonly info: number;
  readonly minor: number;
  readonly major: number;
  readonly critical: number;
}

export type TutorHealthCoverageStatus = "complete" | "partial" | "none";

export interface TutorHealthEvaluationScope {
  readonly kind: "scenario_suite";
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly scenarioCount: number;
  readonly decisionPointCount: number;
  readonly runsPerCase: number;
  readonly expectedCaseRunCount: number;
  readonly presentCaseRunCount: number;
  readonly caseRunRatio: number;
}

export interface TutorHealthCoverage {
  readonly assessedDimensionCount: number;
  readonly totalProfileDimensionCount: number;
  readonly scoredProfileWeight: number;
  readonly totalProfileWeight: number;
  /** Scored profile weight divided by the profile's total configured weight. */
  readonly profileWeightRatio: number;
  readonly status: TutorHealthCoverageStatus;
  readonly evaluationScope: TutorHealthEvaluationScope;
}

export type TutorHealthUnresolvedReason =
  | "missing_case_result"
  | "missing_rubric_result"
  | "duplicate_rubric_result"
  | "evaluation_error";

export interface TutorHealthUnresolvedDecisionPoint {
  readonly scenarioId: string;
  readonly decisionPointId: string;
  readonly runIndex: number;
  readonly reason: TutorHealthUnresolvedReason;
  readonly rubricId?: string;
}

export interface TutorHealthReport {
  readonly schemaVersion: typeof TUTOR_HEALTH_REPORT_SCHEMA_VERSION;
  readonly sourceScenarioSuite: {
    readonly id: string;
    readonly version: string;
    readonly healthTaxonomyVersion: string;
  };
  readonly sourceEvaluation: {
    readonly runId: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly evaluatorVersion?: string;
  };
  readonly scoringProfile: TutorHealthScoringProfile;
  readonly coverage: TutorHealthCoverage;
  /** Integer 0-100 score; null means no scored evidence was available. */
  readonly healthScore: number | null;
  readonly releaseGate: TutorReleaseGate;
  readonly findingCounts: TutorHealthFindingCounts;
  readonly dimensionScores: Readonly<
    Record<TutorHealthDimension, TutorHealthDimensionScore>
  >;
  readonly observations: readonly TutorObservation[];
  readonly findings: readonly TutorFinding[];
  readonly unresolved: readonly TutorHealthUnresolvedDecisionPoint[];
}
