import type { DisclosurePolicy, TutorEvalCategory } from "./tutor-eval.js";
import type { DeterministicEvaluatorId, DeterministicEvaluatorConfig, TutorEvalRubricBehavior, TutorEvalRubricFailure } from "./rubric.js";
import type { TutorHealthDimension, TutorFindingTemplate } from "./tutor-health.js";

export const TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION = 2 as const;

export type TutorScenarioEngagement = "low" | "steady" | "high" | "frustrated";
export type TutorScenarioMasteryState =
  | "novice"
  | "developing"
  | "near_mastery"
  | "mastered";

export type TutorTeachingDecision =
  | "preserve_struggle"
  | "ask_diagnostic_question"
  | "offer_conceptual_hint"
  | "escalate_support"
  | "fade_support"
  | "probe_understanding"
  | "support_emotion"
  | "validate_partial_progress"
  | "protect_learning_integrity";

export interface TutorScenarioEvaluationCriterion {
  readonly rubricId: string;
  readonly category: TutorEvalCategory;
  readonly dimension: TutorHealthDimension;
  readonly criterion: string;
  readonly weight: number;
  readonly evaluationType: "deterministic" | "judge";
  readonly behavior: TutorEvalRubricBehavior;
  readonly evaluatorId?: DeterministicEvaluatorId;
  readonly config?: DeterministicEvaluatorConfig;
  readonly criticalFailure?: TutorEvalRubricFailure;
  readonly failureFinding: TutorFindingTemplate;
}

export interface TutorScenarioDecisionPoint {
  readonly id: string;
  /** Case identity used by the existing TutorEval runner for this checkpoint. */
  readonly evaluationCaseId: string;
  /** 1-based Tutor response position after the authored conversation history. */
  readonly turnIndex: number;
  /** Optional authored checkpoint snapshot for multi-point scenario branches. */
  readonly learnerState?: TutorScenarioVNext["learnerState"];
  readonly trajectory?: TutorScenarioVNext["trajectory"];
  readonly expectedDecision: TutorTeachingDecision;
  readonly expectedBehavior: string;
  readonly evaluationCriteria: readonly TutorScenarioEvaluationCriterion[];
}

export interface TutorScenarioVNext {
  readonly schemaVersion: typeof TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION;
  readonly identity: {
    readonly id: string;
    readonly version: string;
    readonly title: string;
    readonly suiteId: string;
  };
  readonly description: string;
  readonly learningContext: {
    readonly subject: string;
    readonly topic: string;
    readonly learningObjective: string;
    readonly learnerLevel: string;
  };
  readonly learnerState: {
    readonly knownConcepts: readonly string[];
    readonly misconceptions: readonly string[];
    readonly confidence?: number;
    readonly engagement?: TutorScenarioEngagement;
    readonly masteryState?: TutorScenarioMasteryState;
  };
  readonly trajectory: {
    /** Attempts completed before the Tutor response at a decision point. */
    readonly attemptCount: number;
    readonly failedAttempts: number;
    readonly priorHints: readonly string[];
    /** Authored history ends with the learner message for the next response. */
    readonly conversationHistory: readonly {
      readonly role: "user" | "assistant";
      readonly content: string;
    }[];
  };
  readonly teachingPolicy: {
    readonly disclosure: DisclosurePolicy;
    readonly intervention?: {
      readonly firstHintAfterFailedAttempts: number;
      readonly escalateAfterFailedAttempts?: number;
    };
    readonly productiveStruggle?: {
      readonly minimumMeaningfulAttempts: number;
    };
    readonly mastery?: {
      readonly independentSuccessesToConfirm: number;
    };
  };
  readonly decisionPoints: readonly TutorScenarioDecisionPoint[];
}

export interface TutorScenarioSuiteVNext {
  readonly schemaVersion: typeof TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly healthTaxonomyVersion: string;
  readonly scenarios: readonly TutorScenarioVNext[];
}
