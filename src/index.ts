/**
 * Stable package entry point for local and custom Tutor evaluation.
 * Advanced corpus, calibration, generation, and provider modules stay behind
 * their explicit internal paths so the default import surface stays small.
 */
export { loadTutorEvalDataset, loadTutorScenarioSuiteVNext } from "./datasets/index.js";
export {
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
  TUTOR_EVAL_IMMEDIATE_PREVIOUS_DATASET_VERSION,
  TUTOR_EVAL_PREVIOUS_CURRENT_DATASET_VERSION,
  TUTOR_EVAL_PREVIOUS_CANONICAL_DATASET_VERSION,
  TUTOR_EVAL_PREVIOUS_BILINGUAL_DATASET_VERSION,
  TUTOR_EVAL_PREVIOUS_DATASET_VERSION,
  TUTOR_EVAL_EVALUATOR_VERSION,
  TUTOR_EVAL_LEGACY_DATASET_ID,
  TUTOR_EVAL_LEGACY_DATASET_VERSION,
  TUTOR_CASE_LOCALES,
  DEFAULT_TUTOR_CASE_LOCALE,
  parseTutorScenarioSuiteVNext,
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
  parseCaseSystemVNextDomainTaxonomy,
  parseCaseSystemVNextTeachingObjectiveSelection,
  toTutorTurnInput,
} from "./contracts/index.js";
export { runTutorBenchmark, runTutorEval } from "./runner/index.js";
export { runTutorHealthEvaluation } from "./runner/index.js";
export {
  buildCaseSystemVNextEvaluatorStressPlan,
  runCaseSystemVNextEvaluatorStress,
  CaseSystemVNextEvaluatorStressError,
} from "./case-system-vnext/index.js";
export {
  buildTutorHealthReport,
  formatTutorHealthReport,
  writeTutorHealthReport,
} from "./reporting/index.js";
export { createHttpTutor } from "./adapters/http-tutor.js";
export * from "./community-review/index.js";
export * from "./contracts/community-review-application.js";
export * from "./contracts/community-review-application-validation.js";

export type {
  StudentState,
  TutorConversationMessage,
  TutorMessageRole,
  TutorTokenUsage,
  TutorTurnInput,
  TutorTurnMetrics,
  TutorTurnOutput,
  TutorUnderTest,
} from "./contracts/tutor.js";
export type {
  TutorEvalCase,
  TutorEvalDataset,
} from "./contracts/tutor-eval.js";
export type {
  CaseSystemVNextDomainId,
  CaseSystemVNextDomainProfile,
  CaseSystemVNextDomainTaxonomy,
} from "./contracts/case-system-vnext-domain-taxonomy.js";
export type {
  CaseSystemVNextAssessmentContext,
  CaseSystemVNextTeachingObjectiveMode,
  CaseSystemVNextTeachingObjectiveProfile,
  CaseSystemVNextTeachingObjectiveSelection,
} from "./contracts/case-system-vnext-teaching-objective.js";
export type {
  CaseSystemVNextStrategyProfile,
  CaseSystemVNextStrategyProfileRegistry,
  CaseSystemVNextStrategyCriterion,
} from "./contracts/case-system-vnext-strategy-profile.js";
export type {
  CaseSystemVNextEvaluatorStressReport,
  CaseSystemVNextStressBlindPacket,
  CaseSystemVNextStressFixtureSuite,
  CaseSystemVNextStressJudge,
  CaseSystemVNextStressPlan,
} from "./contracts/case-system-vnext-evaluator-stress.js";
export type {
  CaseSystemVNextArchetype,
  CaseSystemVNextPilot,
  CaseSystemVNextReferenceReasoning,
  CaseSystemVNextReasoningStrategy,
} from "./contracts/case-system-vnext.js";
export type {
  TutorScenarioSuiteVNext,
  TutorScenarioVNext,
  TutorScenarioDecisionPoint,
} from "./contracts/tutor-scenario-vnext.js";
export type {
  TutorEvidenceRef,
  TutorFinding,
  TutorHealthReport,
  TutorHealthScoringProfile,
  TutorObservation,
  TutorHealthDimension,
} from "./contracts/tutor-health.js";
export type { TutorCaseLocale } from "./contracts/locale.js";
export type { HttpTutorOptions } from "./adapters/http-tutor.js";
export type { TutorEvalRubric } from "./contracts/rubric.js";
export type {
  TutorEvalCaseRunResult,
  TutorEvalCategoryScores,
  TutorEvalCriticalFailure,
  TutorEvalRunResult,
  TutorEvalRubricResult,
} from "./contracts/result.js";
export type {
  RunTutorBenchmarkOptions,
} from "./runner/public-runner.js";
export type {
  RunTutorEvalOptions,
  TutorEvalJudgeRunOptions,
  TutorEvalTutorOptions,
} from "./runner/tutor-eval-runner.js";
export type {
  RunTutorHealthEvaluationOptions,
  TutorHealthEvaluationRun,
} from "./runner/tutor-health-runner.js";
