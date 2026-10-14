import { TUTOR_EVAL_CATEGORIES,
  type TutorEvalDataset } from "../contracts/tutor-eval.js";
import type { TutorEvalRunResult } from "../contracts/result.js";
import type { TutorEvalCaseScoringInputs, TutorEvalScoringConfig, TutorEvalScoringProvenance } from "../contracts/tutor-eval-scoring.js";
import { aggregateTutorEvalCategoryScores, aggregateTutorEvalOverallScore, aggregateTutorEvalRubrics } from "./aggregator.js";
import { canonicalScoringJson, normalizeTutorEvalScoringConfig, tutorEvalScoringIdentity } from "./config.js";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
/** Authored rubric context alone does not establish a historical scoring configuration. */
export function buildTutorEvalAuthoredScoringInputs(dataset: TutorEvalDataset): readonly TutorEvalCaseScoringInputs[] {
  return [...dataset.cases].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((item) => ({
    caseId: item.id, caseVersion: item.version, rubrics: item.evaluatorOnly.rubrics.map((rubric) => ({
      id: rubric.id, category: rubric.category, weight: rubric.weight, behavior: rubric.behavior ?? "required",
      evaluationType: rubric.evaluationType ?? (rubric.evaluatorId === undefined ? "judge" : "deterministic"),
    })),
  }));
}

export function createTutorEvalScoringProvenance(dataset: TutorEvalDataset, scoring: TutorEvalScoringConfig): TutorEvalScoringProvenance {
  const config = normalizeTutorEvalScoringConfig(scoring);
  return { schemaVersion: 1, algorithm: "tutor-eval-aggregate@1", identity: tutorEvalScoringIdentity(config), config, cases: buildTutorEvalAuthoredScoringInputs(dataset) };
}

export function isTutorEvalScoringProvenance(value: unknown): value is TutorEvalScoringProvenance {
  try {
    if (!record(value) || !keys(value, ["schemaVersion", "algorithm", "identity", "config", "cases"]) ||
        value.schemaVersion !== 1 || value.algorithm !== "tutor-eval-aggregate@1" || !Array.isArray(value.cases) ||
        !record(value.config) || !keys(value.config, ["criterionScores", "categoryWeights", "casePassThreshold", "qualityGate"]) ||
        !record(value.config.criterionScores) || !keys(value.config.criterionScores, ["PASS", "PARTIAL", "FAIL"]) ||
        !record(value.config.categoryWeights) || !keys(value.config.categoryWeights, TUTOR_EVAL_CATEGORIES) ||
        !record(value.config.qualityGate) || !keys(value.config.qualityGate, ["failureTypes", "minimumSeverity"]) ||
        value.cases.some((item: unknown) => !record(item) || !keys(item, ["caseId", "caseVersion", "rubrics"]) ||
          typeof item.caseId !== "string" || !item.caseId.trim() || typeof item.caseVersion !== "string" || !item.caseVersion.trim() ||
          !Array.isArray(item.rubrics) || item.rubrics.some((rubric: unknown) => !record(rubric) ||
            !keys(rubric, ["id", "category", "weight", "behavior", "evaluationType"]) || typeof rubric.id !== "string" || !rubric.id.trim() ||
            !TUTOR_EVAL_CATEGORIES.includes(rubric.category as never) || !finite(rubric.weight) || rubric.weight <= 0 ||
            typeof rubric.behavior !== "string" || !["required", "desirable", "prohibited"].includes(rubric.behavior) ||
            (rubric.evaluationType !== "judge" && rubric.evaluationType !== "deterministic")) ||
          new Set(item.rubrics.map((rubric: Record<string, unknown>) => rubric.id)).size !== item.rubrics.length) ||
        new Set(value.cases.map((item: Record<string, unknown>) => item.caseId)).size !== value.cases.length) return false;
    const config = normalizeTutorEvalScoringConfig(value.config);
    return value.identity === tutorEvalScoringIdentity(config);
  } catch { return false; }
}

/** Internal arithmetic consistency only; available authored sources must be checked separately. */
export function hasValidTutorEvalScoringEvidence(result: TutorEvalRunResult): boolean {
  const source = result.scoringProvenance;
  if (source === undefined) return true; // 历史 v1 不假定默认配置，不凭读取成功认证聚合。
  if (!isTutorEvalScoringProvenance(source) || source.cases.length !== result.caseCount) return false;
  for (const item of result.caseResults) {
    const authored = source.cases.find((candidate) => candidate.caseId === item.caseId && candidate.caseVersion === item.caseVersion);
    if (authored === undefined || item.rubricResults.some((rubric) => !authored.rubrics.some((expected) =>
      rubric.rubricId === expected.id && rubric.category === expected.category && rubric.weight === expected.weight))) return false;
    const judgeIds = authored.rubrics.filter((rubric) => rubric.evaluationType === "judge").map((rubric) => rubric.id);
    if (item.rawJudgeResult !== null && ((item.rawJudgeResult.insufficientInformation && item.rawJudgeResult.rubricResults.length !== judgeIds.length) ||
      item.rawJudgeResult.rubricResults.some((rubric) => !judgeIds.includes(rubric.rubricId)))) return false;
    const aggregate = aggregateTutorEvalRubrics(authored.rubrics, item.rubricResults, item.criticalFailures, source.config);
    const adapterError = item.status === "error" && item.rawTutorResponse === null && item.rubricResults.length === 0;
    if (TUTOR_EVAL_CATEGORIES.some((category) => item.categoryScores[category] !== aggregate.categoryScores[category]) ||
        item.overallScore !== (item.status === "error" ? null : aggregate.overallScore) ||
        item.qualityGate !== (adapterError ? "FAIL" : aggregate.qualityGate) ||
        (item.status !== "error" && item.passed !== aggregate.passed)) return false;
  }
  const complete = result.caseResults.filter((item) => item.overallScore !== null);
  const categories = aggregateTutorEvalCategoryScores(complete);
  const hasError = result.caseResults.length !== result.caseCount * result.runsPerCase ||
    result.caseResults.some((item) => item.status === "error");
  return TUTOR_EVAL_CATEGORIES.every((category) => result.categoryScores[category] === (hasError ? null : categories[category])) &&
    result.overallScore === (hasError ? null : aggregateTutorEvalOverallScore(result.caseResults.map((item) => item.overallScore)));
}

export function hasMatchingTutorEvalAuthoredScoring(result: TutorEvalRunResult, dataset: TutorEvalDataset): boolean {
  const expected = buildTutorEvalAuthoredScoringInputs(dataset);
  return result.scoringProvenance === undefined || result.scoringProvenance.cases.every((item) =>
    expected.some((candidate) => canonicalScoringJson(candidate) === canonicalScoringJson(item)));
}
