import type { TutorCriticalFailure, TutorCriticalFailureSeverity, TutorEvalCategory } from "./tutor-eval.js";
import type { TutorEvalRubricBehavior } from "./rubric.js";

export interface TutorEvalScoringConfig {
  readonly criterionScores: Readonly<Record<"PASS" | "PARTIAL" | "FAIL", number>>;
  readonly categoryWeights: Readonly<Record<TutorEvalCategory, number>>;
  readonly casePassThreshold: number;
  readonly qualityGate: {
    readonly failureTypes: readonly TutorCriticalFailure[];
    readonly minimumSeverity: TutorCriticalFailureSeverity;
  };
}

/** Minimum authored inputs needed to reproduce scoring, without criterion text. */
export interface TutorEvalCaseScoringInputs {
  readonly caseId: string;
  readonly caseVersion: string;
  readonly rubrics: readonly {
    readonly id: string;
    readonly category: TutorEvalCategory;
    readonly weight: number;
    readonly behavior: TutorEvalRubricBehavior;
    readonly evaluationType: "judge" | "deterministic";
  }[];
}

export interface TutorEvalScoringProvenance {
  readonly schemaVersion: 1;
  readonly algorithm: "tutor-eval-aggregate@1";
  /** SHA-256 of the canonical effective configuration and algorithm. */
  readonly identity: string;
  readonly config: TutorEvalScoringConfig;
  readonly cases: readonly TutorEvalCaseScoringInputs[];
}
