import { BenchmarkConfigurationError } from "./errors.js";
import {
  type TutorEvalTutorDescriptor,
  type TutorEvalRunResult,
} from "./result.js";
import { assertValidTutorEvalRunResult } from "./tutor-eval-result-validation.js";
import {
  parseTutorGenerationSpec,
  type TutorGenerationSpec,
} from "./tutor-generation.js";
import {
  TUTOR_RESPONSE_CORPUS_RESULT_SCHEMA_VERSION,
  type TutorResponseCorpusCoverage,
  type TutorResponseCorpusEvaluationResult,
  type TutorResponseCorpusEvaluationScoring,
  type TutorResponseCorpusEvaluationSelection,
  type TutorResponseCorpusEvaluationSelectionMode,
} from "./tutor-response-corpus.js";
import type { TutorResponseCorpusSemanticReplay } from "./tutor-response-replay.js";

type UnknownRecord = Record<string, unknown>;

const selectionModes = new Set<TutorResponseCorpusEvaluationSelectionMode>([
  "all_available",
  "explicit_cases",
  "available_limit",
  "explicit_cases_limit",
]);

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || !value.every(nonEmptyString)) {
    return null;
  }
  const values = value as string[];
  return new Set(values).size === values.length ? values : null;
}

function parseTutorDescriptor(value: unknown): TutorEvalTutorDescriptor | null {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "provider",
      "model",
      "modelVersion",
      "promptId",
      "promptVersion",
      "temperature",
      "reasoningEffort",
      "seed",
    ]) ||
    !nonEmptyString(record.provider) ||
    !nonEmptyString(record.model) ||
    !nonEmptyString(record.promptVersion) ||
    (record.modelVersion !== undefined && !nonEmptyString(record.modelVersion)) ||
    (record.promptId !== undefined && !nonEmptyString(record.promptId)) ||
    (record.temperature !== undefined &&
      (typeof record.temperature !== "number" ||
        !Number.isFinite(record.temperature) ||
        record.temperature < 0)) ||
    (record.reasoningEffort !== undefined && !nonEmptyString(record.reasoningEffort)) ||
    (record.seed !== undefined &&
      (typeof record.seed !== "number" || !Number.isInteger(record.seed) || record.seed < 0))
  ) {
    return null;
  }
  return {
    provider: record.provider,
    model: record.model,
    ...(record.modelVersion === undefined ? {} : { modelVersion: record.modelVersion as string }),
    ...(record.promptId === undefined ? {} : { promptId: record.promptId as string }),
    promptVersion: record.promptVersion,
    ...(record.temperature === undefined ? {} : { temperature: record.temperature as number }),
    ...(record.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: record.reasoningEffort as string }),
    ...(record.seed === undefined ? {} : { seed: record.seed as number }),
  };
}

function parseSelection(
  value: unknown,
): TutorResponseCorpusEvaluationSelection | null {
  const record = asRecord(value);
  const requestedCaseIds = parseStringArray(record?.requestedCaseIds);
  const selectedCaseIds = parseStringArray(record?.selectedCaseIds);
  const limit = record?.limit;
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "mode",
      "requestedCaseIds",
      "selectedCaseIds",
      "limit",
      "selectedResponseCount",
    ]) ||
    !selectionModes.has(record.mode as TutorResponseCorpusEvaluationSelectionMode) ||
    requestedCaseIds === null ||
    selectedCaseIds === null ||
    (limit !== null &&
      (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1)) ||
    !isNonNegativeInteger(record.selectedResponseCount)
  ) {
    return null;
  }
  return {
    mode: record.mode as TutorResponseCorpusEvaluationSelectionMode,
    requestedCaseIds,
    selectedCaseIds,
    limit: limit as number | null,
    selectedResponseCount: record.selectedResponseCount,
  };
}

function parseSemanticReplay(value: unknown): TutorResponseCorpusSemanticReplay | null {
  const record = asRecord(value);
  const mappingsValue = record?.caseVersionMappings;
  const mappings = Array.isArray(mappingsValue)
    ? mappingsValue.map((mappingValue) => {
        const mapping = asRecord(mappingValue);
        return mapping !== null &&
          hasOnlyKeys(mapping, ["caseId", "sourceVersion", "targetVersion"]) &&
          nonEmptyString(mapping.caseId) &&
          nonEmptyString(mapping.sourceVersion) &&
          nonEmptyString(mapping.targetVersion)
          ? {
              caseId: mapping.caseId,
              sourceVersion: mapping.sourceVersion,
              targetVersion: mapping.targetVersion,
            }
          : null;
      })
    : null;
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "compatibilityId",
      "sourceDatasetId",
      "sourceDatasetVersion",
      "targetDatasetId",
      "targetDatasetVersion",
      "caseVersionMappings",
    ]) ||
    !nonEmptyString(record.compatibilityId) ||
    !nonEmptyString(record.sourceDatasetId) ||
    !nonEmptyString(record.sourceDatasetVersion) ||
    !nonEmptyString(record.targetDatasetId) ||
    !nonEmptyString(record.targetDatasetVersion) ||
    mappings === null ||
    mappings.length === 0 ||
    mappings.some((mapping) => mapping === null) ||
    new Set(mappings.filter((mapping) => mapping !== null).map((mapping) => mapping.caseId)).size !==
      mappings.length
  ) {
    return null;
  }
  return {
    compatibilityId: record.compatibilityId,
    sourceDatasetId: record.sourceDatasetId,
    sourceDatasetVersion: record.sourceDatasetVersion,
    targetDatasetId: record.targetDatasetId,
    targetDatasetVersion: record.targetDatasetVersion,
    caseVersionMappings: mappings as NonNullable<(typeof mappings)[number]>[],
  };
}

function parseScoring(
  value: unknown,
): TutorResponseCorpusEvaluationScoring | null {
  const record = asRecord(value);
  const criterionScores = asRecord(record?.criterionScores);
  const categoryWeights = asRecord(record?.categoryWeights);
  const qualityGate = asRecord(record?.qualityGate);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "criterionScores",
      "categoryWeights",
      "casePassThreshold",
      "qualityGate",
    ]) ||
    criterionScores === null ||
    !hasOnlyKeys(criterionScores, ["PASS", "PARTIAL", "FAIL"]) ||
    !["PASS", "PARTIAL", "FAIL"].every((key) => {
      const score = criterionScores[key];
      return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1;
    }) ||
    categoryWeights === null ||
    !hasOnlyKeys(categoryWeights, [
      "correctness",
      "diagnosis",
      "guidance",
      "adaptation",
      "actionability",
    ]) ||
    !["correctness", "diagnosis", "guidance", "adaptation", "actionability"].every((key) => {
      const weight = categoryWeights[key];
      return typeof weight === "number" && Number.isFinite(weight) && weight >= 0;
    }) ||
    typeof record.casePassThreshold !== "number" ||
    !Number.isFinite(record.casePassThreshold) ||
    record.casePassThreshold < 0 ||
    record.casePassThreshold > 1 ||
    qualityGate === null ||
    !hasOnlyKeys(qualityGate, ["failureTypes", "minimumSeverity"]) ||
    !Array.isArray(qualityGate.failureTypes) ||
    !qualityGate.failureTypes.every((item) =>
      typeof item === "string" &&
      [
        "severe_factual_error",
        "misconception_reinforcement",
        "incorrect_diagnosis",
        "answer_leakage",
        "student_task_takeover",
        "critical_misconception_ignored",
        "instruction_violation",
      ].includes(item)
    ) ||
    new Set(qualityGate.failureTypes).size !== qualityGate.failureTypes.length ||
    (qualityGate.minimumSeverity !== "minor" &&
      qualityGate.minimumSeverity !== "major" &&
      qualityGate.minimumSeverity !== "critical")
  ) {
    return null;
  }
  return value as TutorResponseCorpusEvaluationScoring;
}

function parseArtifactMetadata(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["status", "calibrationStatus", "publicLeaderboardEligible"]) &&
    (record.status === undefined || nonEmptyString(record.status)) &&
    (record.calibrationStatus === undefined || nonEmptyString(record.calibrationStatus)) &&
    (record.publicLeaderboardEligible === undefined ||
      typeof record.publicLeaderboardEligible === "boolean")
  );
}

function invalid(): never {
  throw new BenchmarkConfigurationError("tutor_eval_result_invalid");
}

/**
 * Parses the wrapper emitted by `tutorbench evaluate`. Raw legacy
 * TutorEvalRunResult values are intentionally not accepted for resume because
 * they do not carry the corpus identity required to bind frozen responses.
 */
export function parseTutorResponseCorpusEvaluationResult(
  value: unknown,
): TutorResponseCorpusEvaluationResult {
  const record = asRecord(value);
  const evaluationValue = record?.evaluation;
  const tutor = parseTutorDescriptor(record?.tutor);
  const evaluationSelection = record?.evaluationSelection === undefined
    ? undefined
    : parseSelection(record.evaluationSelection);
  const semanticReplay = record?.semanticReplay === undefined
    ? undefined
    : parseSemanticReplay(record.semanticReplay);
  const scoring = record?.scoring === undefined
    ? undefined
    : parseScoring(record.scoring);
  let generationSpec: TutorGenerationSpec | undefined;
  if (record?.generationSpec !== undefined) {
    try {
      generationSpec = parseTutorGenerationSpec(record.generationSpec);
    } catch {
      return invalid();
    }
  }
  try {
    assertValidTutorEvalRunResult(evaluationValue);
  } catch {
    return invalid();
  }
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "corpusId",
      "corpusVersion",
      "datasetId",
      "datasetVersion",
      "coverage",
      "selectedCaseCount",
      "availableResponseCount",
      "missingCaseCount",
      "evaluationSelection",
      "scoring",
      "semanticReplay",
      "generationSpec",
      "tutor",
      "evaluation",
      "artifactMetadata",
    ]) ||
    record.schemaVersion !== TUTOR_RESPONSE_CORPUS_RESULT_SCHEMA_VERSION ||
    !nonEmptyString(record.corpusId) ||
    !nonEmptyString(record.corpusVersion) ||
    !nonEmptyString(record.datasetId) ||
    !nonEmptyString(record.datasetVersion) ||
    (record.coverage !== "full" && record.coverage !== "partial") ||
    !isNonNegativeInteger(record.selectedCaseCount) ||
    !isNonNegativeInteger(record.availableResponseCount) ||
    !isNonNegativeInteger(record.missingCaseCount) ||
    tutor === null ||
    (record.evaluationSelection !== undefined && evaluationSelection === null) ||
    (record.scoring !== undefined && scoring === null) ||
    (record.semanticReplay !== undefined && semanticReplay === null) ||
    (record.artifactMetadata !== undefined && !parseArtifactMetadata(record.artifactMetadata))
  ) {
    return invalid();
  }
  const validEvaluationSelection = evaluationSelection as
    | TutorResponseCorpusEvaluationSelection
    | undefined;
  const validSemanticReplay = semanticReplay as TutorResponseCorpusSemanticReplay | undefined;
  return {
    schemaVersion: TUTOR_RESPONSE_CORPUS_RESULT_SCHEMA_VERSION,
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    datasetId: record.datasetId,
    datasetVersion: record.datasetVersion,
    coverage: record.coverage as TutorResponseCorpusCoverage,
    selectedCaseCount: record.selectedCaseCount,
    availableResponseCount: record.availableResponseCount,
    missingCaseCount: record.missingCaseCount,
    ...(validEvaluationSelection === undefined
      ? {}
      : { evaluationSelection: validEvaluationSelection }),
    ...(scoring === undefined ? {} : { scoring }),
    ...(validSemanticReplay === undefined ? {} : { semanticReplay: validSemanticReplay }),
    ...(generationSpec === undefined ? {} : { generationSpec }),
    tutor,
    evaluation: evaluationValue as TutorEvalRunResult,
  };
}

export function assertValidTutorResponseCorpusEvaluationResult(
  value: unknown,
): asserts value is TutorResponseCorpusEvaluationResult {
  parseTutorResponseCorpusEvaluationResult(value);
}
