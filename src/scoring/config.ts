import { createHash } from "node:crypto";
import { BenchmarkConfigurationError } from "../contracts/errors.js";
import { TUTOR_EVAL_CATEGORIES, TUTOR_EVAL_CRITICAL_FAILURE_TYPES, TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES,
  type TutorCriticalFailure, type TutorCriticalFailureSeverity } from "../contracts/tutor-eval.js";
import type { TutorEvalScoringConfig } from "../contracts/tutor-eval-scoring.js";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

/** Internal canonical JSON: object key order is immaterial, authored array order is preserved. */
export function canonicalScoringJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalScoringJson).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalScoringJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Custom scores/thresholds use caller units; normalized rubric encodings remain unchanged. */
export function normalizeTutorEvalScoringConfig(value: unknown): TutorEvalScoringConfig {
  if (!record(value) || !record(value.criterionScores) || !record(value.categoryWeights) || !record(value.qualityGate) ||
      !["PASS", "PARTIAL", "FAIL"].every((key) => finite((value.criterionScores as Record<string, unknown>)[key])) ||
      !TUTOR_EVAL_CATEGORIES.every((key) => finite((value.categoryWeights as Record<string, unknown>)[key]) &&
        ((value.categoryWeights as Record<string, number>)[key] ?? -1) >= 0) ||
      !TUTOR_EVAL_CATEGORIES.some((key) => (value.categoryWeights as Record<string, number>)[key]! > 0) ||
      !finite(value.casePassThreshold) || !Array.isArray(value.qualityGate.failureTypes) ||
      !value.qualityGate.failureTypes.every((type: unknown) => typeof type === "string" && TUTOR_EVAL_CRITICAL_FAILURE_TYPES.includes(type as TutorCriticalFailure)) ||
      new Set(value.qualityGate.failureTypes).size !== value.qualityGate.failureTypes.length ||
      typeof value.qualityGate.minimumSeverity !== "string" ||
      !TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES.includes(value.qualityGate.minimumSeverity as TutorCriticalFailureSeverity)) {
    throw new BenchmarkConfigurationError("tutor_eval_scoring_invalid");
  }
  const config = value as unknown as TutorEvalScoringConfig;
  return Object.freeze({
    criterionScores: Object.freeze({ PASS: config.criterionScores.PASS, PARTIAL: config.criterionScores.PARTIAL, FAIL: config.criterionScores.FAIL }),
    categoryWeights: Object.freeze(Object.fromEntries(TUTOR_EVAL_CATEGORIES.map((category) => [category, config.categoryWeights[category]])) as TutorEvalScoringConfig["categoryWeights"]),
    casePassThreshold: config.casePassThreshold,
    qualityGate: Object.freeze({ failureTypes: Object.freeze([...config.qualityGate.failureTypes].sort()), minimumSeverity: config.qualityGate.minimumSeverity }),
  });
}

export function tutorEvalScoringIdentity(config: TutorEvalScoringConfig): string {
  const canonical = canonicalScoringJson({ algorithm: "tutor-eval-aggregate@1", config: normalizeTutorEvalScoringConfig(config) });
  return `tutor-eval-scoring:sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
