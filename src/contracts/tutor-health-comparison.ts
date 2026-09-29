import type { TutorEvalJudgeDescriptor, TutorEvalTutorDescriptor } from "./result.js";
import { BenchmarkConfigurationError } from "./errors.js";
import type { TutorEvidenceRef, TutorHealthReport, TutorHealthScoringProfile } from "./tutor-health.js";

export const TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION = 1 as const;
export const TUTOR_HEALTH_COMPARISON_KIND = "tutor-health-comparison" as const;

export class TutorHealthComparisonError extends BenchmarkConfigurationError {
  constructor(readonly reason: string) {
    super("tutor_health_comparison_incompatible");
    this.message = `Tutor Health sources are not comparable: ${reason}.`;
  }
}

export interface TutorHealthComparisonSource {
  readonly suite: TutorHealthReport["sourceScenarioSuite"] & { readonly sha256: string };
  readonly evaluation: TutorHealthReport["sourceEvaluation"] & {
    readonly evaluatorVersion: string;
    readonly createdAt: string;
    readonly sha256: string;
  };
  readonly report: { readonly schemaVersion: 2; readonly sha256: string };
  readonly tutor: TutorEvalTutorDescriptor;
  readonly judge: TutorEvalJudgeDescriptor | null;
  readonly scoringProfile: TutorHealthScoringProfile;
  readonly runsPerCase: number;
}

export const TUTOR_HEALTH_COMPARISON_UNRESOLVED_REASONS = [
  "missing_case_result", "missing_rubric_result", "duplicate_rubric_result",
  "evaluation_error", "partial_evidence",
] as const;

export interface TutorHealthComparisonAssessment {
  readonly caseId: string;
  readonly caseVersion: string;
  readonly runIndex: number;
  /** Empty only when every authored criterion has a scored PASS/FAIL result. */
  readonly unresolvedReasons: readonly (typeof TUTOR_HEALTH_COMPARISON_UNRESOLVED_REASONS)[number][];
  readonly evidence: readonly TutorEvidenceRef[];
}

export interface TutorHealthComparisonSide {
  readonly findings: readonly {
    /** A source pointer only; never used to match baseline and candidate. */
    readonly findingId: string;
    readonly runIndex: number;
    readonly evidence: readonly TutorEvidenceRef[];
  }[];
  readonly assessments: readonly TutorHealthComparisonAssessment[];
}

export interface TutorHealthFindingComparison {
  readonly identity: {
    readonly scenarioId: string;
    readonly decisionPointId: string;
    readonly type: string;
  };
  readonly classification: "resolved" | "persistent" | "new" | "unresolved";
  readonly baseline: TutorHealthComparisonSide;
  readonly candidate: TutorHealthComparisonSide;
}

export interface TutorHealthComparison {
  readonly schemaVersion: typeof TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION;
  readonly kind: typeof TUTOR_HEALTH_COMPARISON_KIND;
  /** Incompatible sources are rejected before an artifact can be produced. */
  readonly status: "comparable" | "partially_comparable";
  readonly baseline: TutorHealthComparisonSource;
  readonly candidate: TutorHealthComparisonSource;
  readonly counts: Readonly<Record<TutorHealthFindingComparison["classification"], number>>;
  readonly findings: readonly TutorHealthFindingComparison[];
}
