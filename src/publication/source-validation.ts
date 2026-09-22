import {
  assertValidTutorResponseCorpus,
  parseTutorResponseCorpus,
  parseTutorResponseCorpusEvaluationResult,
  partitionTutorEvalRubrics,
  TUTOR_EVAL_CATEGORIES,
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
  TUTOR_EVAL_EVALUATOR_VERSION,
  tutorGenerationSpecsEqual,
  type TutorEvalCaseRunResult,
  type TutorEvalJudgeDescriptor,
  type TutorEvalRunResult,
  type TutorEvalTutorDescriptor,
  type TutorGenerationSpec,
  type TutorResponseCorpus,
  type TutorResponseCorpusEvaluationResult,
} from "../contracts/index.js";
import { loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec } from "../corpus/index.js";
import { loadTutorEvalDataset } from "../datasets/index.js";
import type { TutorEvalDataset } from "../contracts/index.js";
import type {
  PublicationIssue,
  PublicEvidenceBenchmarkIdentity,
  PublicEvidenceGenerationIdentity,
  PublicEvidenceJudgeDescriptor,
  PublicEvidenceTutorIdentity,
} from "./contracts.js";
import type { JsonDocument } from "./io.js";

export interface PublicationArtifactMetadata {
  readonly status: "preliminary";
  readonly calibrationStatus: "uncalibrated";
  readonly publicLeaderboardEligible: false;
}

export interface ParsedPublicationEvaluation {
  readonly evaluation: TutorResponseCorpusEvaluationResult;
  readonly artifactMetadata?: PublicationArtifactMetadata;
}

export interface PublicationSourceContext {
  readonly corpus: TutorResponseCorpus;
  readonly evaluationArtifact: ParsedPublicationEvaluation;
  readonly dataset: TutorEvalDataset;
  readonly expectedGenerationSpec: TutorGenerationSpec;
  readonly sourceCorpusSha256: string;
  readonly sourceEvaluationSha256: string;
}

export interface PublicationSourceValidationResult {
  readonly context?: PublicationSourceContext;
  readonly issues: readonly PublicationIssue[];
}

type UnknownRecord = Record<string, unknown>;

const gateCodes = [
  "publication_source_invalid",
  "publication_provenance_not_recorded_model",
  "publication_generation_spec_invalid",
  "publication_generation_profile_mismatch",
  "publication_dataset_not_current",
  "publication_coverage_incomplete",
  "publication_model_identity_missing",
  "publication_model_version_missing",
  "publication_evaluation_subset",
  "publication_identity_mismatch",
  "publication_response_mismatch",
  "publication_missing_case_run",
  "publication_extra_case_run",
  "publication_evaluator_version_mismatch",
  "publication_semantic_replay_forbidden",
  "publication_judge_missing",
  "publication_evaluation_error",
  "publication_score_unresolved",
  "publication_metric_mismatch",
  "publication_source_metadata_invalid",
] as const;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function issueKey(issue: PublicationIssue): string {
  return JSON.stringify(issue);
}

function sortedIssues(issues: readonly PublicationIssue[]): PublicationIssue[] {
  const unique = [...new Map(issues.map((issue) => [issueKey(issue), issue])).values()];
  return unique.sort((left, right) => issueKey(left).localeCompare(issueKey(right)));
}

function canonicalTutorDescriptor(
  descriptor: TutorEvalTutorDescriptor,
): Record<string, unknown> {
  return {
    provider: descriptor.provider,
    model: descriptor.model,
    ...(descriptor.modelVersion === undefined ? {} : { modelVersion: descriptor.modelVersion }),
    ...(descriptor.promptId === undefined ? {} : { promptId: descriptor.promptId }),
    promptVersion: descriptor.promptVersion,
    ...(descriptor.temperature === undefined ? {} : { temperature: descriptor.temperature }),
    ...(descriptor.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: descriptor.reasoningEffort }),
    ...(descriptor.seed === undefined ? {} : { seed: descriptor.seed }),
  };
}

function tutorDescriptorsEqual(
  left: TutorEvalTutorDescriptor,
  right: TutorEvalTutorDescriptor,
): boolean {
  return JSON.stringify(canonicalTutorDescriptor(left)) ===
    JSON.stringify(canonicalTutorDescriptor(right));
}

function expectedGenerationIdentity(
  spec: TutorGenerationSpec,
): PublicEvidenceGenerationIdentity {
  return {
    generationSpecId: spec.specId,
    generationSpecVersion: spec.specVersion,
    promptId: spec.prompt.id,
    promptVersion: spec.prompt.version,
    promptSha256: spec.prompt.sha256,
    maxOutputTokens: spec.maxOutputTokens,
  };
}

export function toPublicTutorIdentity(
  descriptor: TutorEvalTutorDescriptor,
): PublicEvidenceTutorIdentity | undefined {
  if (
    !nonEmptyString(descriptor.provider) ||
    !nonEmptyString(descriptor.model) ||
    !nonEmptyString(descriptor.modelVersion)
  ) {
    return undefined;
  }
  return {
    provider: descriptor.provider,
    model: descriptor.model,
    modelVersion: descriptor.modelVersion,
  };
}

export function toPublicJudgeDescriptor(
  descriptor: TutorEvalJudgeDescriptor | null,
): PublicEvidenceJudgeDescriptor | undefined {
  if (descriptor === null) {
    return undefined;
  }
  return {
    provider: descriptor.provider,
    model: descriptor.model,
    ...(descriptor.modelVersion === undefined ? {} : { modelVersion: descriptor.modelVersion }),
    ...(descriptor.promptId === undefined ? {} : { promptId: descriptor.promptId }),
    promptVersion: descriptor.promptVersion,
    ...(descriptor.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: descriptor.reasoningEffort }),
    ...(descriptor.thinkingMode === undefined ? {} : { thinkingMode: descriptor.thinkingMode }),
    ...(descriptor.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: descriptor.maxOutputTokens }),
  };
}

export function parsePublicationArtifactMetadata(
  value: unknown,
): PublicationArtifactMetadata | undefined {
  const record = asRecord(value);
  if (record === null) {
    return undefined;
  }
  if (
    !hasOnlyKeys(record, ["status", "calibrationStatus", "publicLeaderboardEligible"]) ||
    record.status !== "preliminary" ||
    record.calibrationStatus !== "uncalibrated" ||
    record.publicLeaderboardEligible !== false
  ) {
    return undefined;
  }
  return {
    status: "preliminary",
    calibrationStatus: "uncalibrated",
    publicLeaderboardEligible: false,
  };
}

function parseEvaluationArtifact(value: unknown): ParsedPublicationEvaluation | undefined {
  let evaluation: TutorResponseCorpusEvaluationResult;
  try {
    evaluation = parseTutorResponseCorpusEvaluationResult(value);
  } catch {
    return undefined;
  }
  const record = asRecord(value);
  const artifactMetadata = parsePublicationArtifactMetadata(record?.artifactMetadata);
  return {
    evaluation,
    ...(artifactMetadata === undefined ? {} : { artifactMetadata }),
  };
}

async function currentGenerationSpec(): Promise<TutorGenerationSpec | undefined> {
  try {
    return buildTutorBaselineGenerationSpec(await loadTutorBaselinePrompt());
  } catch {
    return undefined;
  }
}

function responseKey(caseId: string, runIndex: number): string {
  return `${caseId}\u0000${runIndex}`;
}

function hasAllCategoryScores(
  scores: TutorEvalRunResult["categoryScores"],
): boolean {
  return TUTOR_EVAL_CATEGORIES.every(
    (category) => typeof scores[category] === "number" && Number.isFinite(scores[category]),
  );
}

function hasRequiredCaseCategoryScores(
  scores: TutorEvalCaseRunResult["categoryScores"],
  datasetCase: TutorEvalDataset["cases"][number],
): boolean {
  const requiredCategories = new Set(
    datasetCase.evaluatorOnly.rubrics.map((rubric) => rubric.category),
  );
  return TUTOR_EVAL_CATEGORIES.every(
    (category) =>
      !requiredCategories.has(category) ||
      (typeof scores[category] === "number" && Number.isFinite(scores[category])),
  );
}

function compareMetrics(
  corpus: TutorResponseCorpus["responses"][number]["metrics"],
  evaluated: TutorEvalCaseRunResult,
  issues: PublicationIssue[],
): void {
  const numericMetrics: readonly [
    "latencyMs" | "cost",
    number | undefined,
    number | null,
  ][] = [
    ["latencyMs", corpus?.latencyMs, evaluated.latencyMs],
    ["cost", corpus?.cost, evaluated.cost],
  ];
  for (const [field, corpusValue, evaluationValue] of numericMetrics) {
    if (
      corpusValue !== undefined &&
      evaluationValue !== null &&
      corpusValue !== evaluationValue
    ) {
      issues.push({
        code: "publication_metric_mismatch",
        caseId: evaluated.caseId,
        runIndex: evaluated.runIndex,
        field,
      });
    }
  }
  const corpusTokens = corpus?.tokenUsage;
  const evaluationTokens = evaluated.tokenUsage;
  if (
    corpusTokens !== undefined &&
    evaluationTokens !== null &&
    JSON.stringify(corpusTokens) !== JSON.stringify(evaluationTokens)
  ) {
    issues.push({
      code: "publication_metric_mismatch",
      caseId: evaluated.caseId,
      runIndex: evaluated.runIndex,
      field: "tokenUsage",
    });
  }
}

function validateCaseResult(
  result: TutorEvalCaseRunResult,
  corpusResponse: TutorResponseCorpus["responses"][number],
  datasetCase: TutorEvalDataset["cases"][number] | undefined,
  issues: PublicationIssue[],
): void {
  if (
    result.status === "error" ||
    result.passed !== (result.status === "passed") ||
    result.rawTutorResponse === null ||
    result.rawTutorResponse !== corpusResponse.responseText
  ) {
    issues.push({
      code: result.status === "error"
        ? "publication_evaluation_error"
        : "publication_response_mismatch",
      caseId: result.caseId,
      runIndex: result.runIndex,
    });
  }
  if (datasetCase === undefined) {
    issues.push({
      code: "publication_extra_case_run",
      caseId: result.caseId,
      runIndex: result.runIndex,
    });
    return;
  }
  const expectedRubricIds = datasetCase.evaluatorOnly.rubrics.map((rubric) => rubric.id);
  const actualRubricIds = result.rubricResults.map((rubric) => rubric.rubricId);
  const expectedSet = new Set(expectedRubricIds);
  const actualSet = new Set(actualRubricIds);
  if (
    actualRubricIds.length !== actualSet.size ||
    actualSet.size !== expectedSet.size ||
    expectedRubricIds.some((rubricId) => !actualSet.has(rubricId)) ||
    actualRubricIds.some((rubricId) => !expectedSet.has(rubricId)) ||
    result.rubricResults.some(
      (rubric) => rubric.result === "ERROR" || rubric.score === null,
    ) ||
    !hasRequiredCaseCategoryScores(result.categoryScores, datasetCase) ||
    result.overallScore === null
  ) {
    issues.push({
      code: "publication_score_unresolved",
      caseId: result.caseId,
      runIndex: result.runIndex,
    });
  }
  const judgeRubricCount = partitionTutorEvalRubrics(datasetCase).judgeRubrics.length;
  if (judgeRubricCount > 0 && result.rawJudgeResult === null) {
    issues.push({
      code: "publication_judge_missing",
      caseId: result.caseId,
      runIndex: result.runIndex,
    });
  }
  if (result.rawJudgeResult !== null && result.rawJudgeResult.caseId !== result.caseId) {
    issues.push({
      code: "publication_identity_mismatch",
      caseId: result.caseId,
      runIndex: result.runIndex,
      field: "rawJudgeResult.caseId",
    });
  }
  compareMetrics(corpusResponse.metrics, result, issues);
}

function validateEvaluationSelection(
  evaluation: TutorResponseCorpusEvaluationResult,
  dataset: TutorEvalDataset,
  expectedResponseCount: number,
  issues: PublicationIssue[],
): void {
  const selection = evaluation.evaluationSelection;
  const expectedCaseIds = [...dataset.cases]
    .map((tutorEvalCase) => tutorEvalCase.id)
    .sort((left, right) => left.localeCompare(right));
  if (
    evaluation.coverage !== "full" ||
    evaluation.missingCaseCount !== 0 ||
    evaluation.selectedCaseCount !== dataset.cases.length ||
    evaluation.availableResponseCount !== expectedResponseCount
  ) {
    issues.push({ code: "publication_coverage_incomplete" });
  }
  if (
    selection === undefined ||
    selection.mode !== "all_available" ||
    selection.requestedCaseIds.length !== 0 ||
    selection.limit !== null ||
    JSON.stringify([...selection.selectedCaseIds].sort((left, right) => left.localeCompare(right))) !==
      JSON.stringify(expectedCaseIds) ||
    selection.selectedResponseCount !== expectedResponseCount
  ) {
    issues.push({ code: "publication_evaluation_subset" });
  }
}

function validateCaseRuns(
  corpus: TutorResponseCorpus,
  evaluation: TutorResponseCorpusEvaluationResult,
  dataset: TutorEvalDataset,
  issues: PublicationIssue[],
): void {
  const corpusByKey = new Map(
    corpus.responses.map((response) => [responseKey(response.caseId, response.runIndex), response]),
  );
  const datasetById = new Map(dataset.cases.map((tutorEvalCase) => [tutorEvalCase.id, tutorEvalCase]));
  const seen = new Set<string>();
  for (const result of evaluation.evaluation.caseResults) {
    const key = responseKey(result.caseId, result.runIndex);
    const corpusResponse = corpusByKey.get(key);
    if (seen.has(key) || corpusResponse === undefined) {
      issues.push({
        code: "publication_extra_case_run",
        caseId: result.caseId,
        runIndex: result.runIndex,
      });
      continue;
    }
    seen.add(key);
    if (result.caseVersion !== corpusResponse.caseVersion) {
      issues.push({
        code: "publication_response_mismatch",
        caseId: result.caseId,
        runIndex: result.runIndex,
        field: "caseVersion",
      });
    }
    validateCaseResult(result, corpusResponse, datasetById.get(result.caseId), issues);
  }
  for (const response of corpus.responses) {
    const key = responseKey(response.caseId, response.runIndex);
    if (!seen.has(key)) {
      issues.push({
        code: "publication_missing_case_run",
        caseId: response.caseId,
        runIndex: response.runIndex,
      });
    }
  }
}

function validateCorpusCoverage(
  corpus: TutorResponseCorpus,
  dataset: TutorEvalDataset,
  issues: PublicationIssue[],
): void {
  const expected = new Set<string>();
  for (const tutorEvalCase of dataset.cases) {
    for (let runIndex = 1; runIndex <= corpus.runsPerCase; runIndex += 1) {
      expected.add(responseKey(tutorEvalCase.id, runIndex));
    }
  }
  const actual = new Set(corpus.responses.map((response) =>
    responseKey(response.caseId, response.runIndex),
  ));
  if (
    corpus.coverage !== "full" ||
    actual.size !== expected.size ||
    corpus.responses.length !== expected.size ||
    [...expected].some((key) => !actual.has(key)) ||
    [...actual].some((key) => !expected.has(key))
  ) {
    issues.push({ code: "publication_coverage_incomplete" });
  }
  try {
    assertValidTutorResponseCorpus({ corpus, dataset, requireFull: true });
  } catch {
    issues.push({ code: "publication_coverage_incomplete" });
  }
}

function validateSourceIdentity(
  corpus: TutorResponseCorpus,
  evaluationArtifact: ParsedPublicationEvaluation,
  expectedGenerationSpec: TutorGenerationSpec,
  dataset: TutorEvalDataset,
  issues: PublicationIssue[],
): void {
  const evaluation = evaluationArtifact.evaluation;
  const run = evaluation.evaluation;
  if (
    corpus.datasetId !== TUTOR_EVAL_DATASET_ID ||
    corpus.datasetVersion !== TUTOR_EVAL_DATASET_VERSION ||
    evaluation.datasetId !== TUTOR_EVAL_DATASET_ID ||
    evaluation.datasetVersion !== TUTOR_EVAL_DATASET_VERSION ||
    run.datasetId !== TUTOR_EVAL_DATASET_ID ||
    run.datasetVersion !== TUTOR_EVAL_DATASET_VERSION
  ) {
    issues.push({ code: "publication_dataset_not_current" });
  }
  if (
    corpus.corpusId !== evaluation.corpusId ||
    corpus.corpusVersion !== evaluation.corpusVersion ||
    corpus.datasetId !== evaluation.datasetId ||
    corpus.datasetVersion !== evaluation.datasetVersion ||
    corpus.runsPerCase !== run.runsPerCase ||
    !tutorDescriptorsEqual(corpus.tutor, evaluation.tutor) ||
    !tutorDescriptorsEqual(corpus.tutor, run.tutor) ||
    evaluation.generationSpec === undefined ||
    !tutorGenerationSpecsEqual(corpus.generationSpec, evaluation.generationSpec)
  ) {
    issues.push({ code: "publication_identity_mismatch" });
  }
  if (
    evaluation.semanticReplay !== undefined ||
    corpus.datasetId !== dataset.id ||
    corpus.datasetVersion !== dataset.version
  ) {
    if (evaluation.semanticReplay !== undefined) {
      issues.push({ code: "publication_semantic_replay_forbidden" });
    }
  }
  if (run.evaluatorVersion !== TUTOR_EVAL_EVALUATOR_VERSION) {
    issues.push({ code: "publication_evaluator_version_mismatch" });
  }
  if (
    corpus.generationSpec === undefined ||
    !tutorGenerationSpecsEqual(corpus.generationSpec, expectedGenerationSpec) ||
    corpus.tutor.promptId !== expectedGenerationSpec.prompt.id ||
    corpus.tutor.promptVersion !== expectedGenerationSpec.prompt.version
  ) {
    issues.push({ code: "publication_generation_profile_mismatch" });
  }
}

function validateModelIdentity(
  corpus: TutorResponseCorpus,
  issues: PublicationIssue[],
): void {
  if (!nonEmptyString(corpus.tutor.provider) || !nonEmptyString(corpus.tutor.model)) {
    issues.push({ code: "publication_model_identity_missing" });
  }
  if (!nonEmptyString(corpus.tutor.modelVersion)) {
    issues.push({ code: "publication_model_version_missing" });
  }
}

function validateEvaluationCompleteness(
  evaluation: TutorEvalRunResult,
  dataset: TutorEvalDataset,
  corpus: TutorResponseCorpus,
  issues: PublicationIssue[],
): void {
  const expectedCaseCount = dataset.cases.length;
  const expectedRunCount = expectedCaseCount * corpus.runsPerCase;
  const actualErrorCount = evaluation.caseResults.filter((result) => result.status === "error").length;
  const actualPassedCount = evaluation.caseResults.filter((result) => result.status === "passed").length;
  const actualFailedCount = evaluation.caseResults.filter((result) => result.status === "failed").length;
  if (
    evaluation.judge === null ||
    evaluation.errorCount !== 0 ||
    actualErrorCount !== 0 ||
    evaluation.caseCount !== expectedCaseCount ||
    evaluation.caseRunCount !== expectedRunCount ||
    evaluation.caseResults.length !== expectedRunCount ||
    evaluation.passedCount !== actualPassedCount ||
    evaluation.failedCount !== actualFailedCount ||
    evaluation.errorCount !== actualErrorCount
  ) {
    if (evaluation.judge === null) {
      issues.push({ code: "publication_judge_missing" });
    }
    if (evaluation.errorCount !== 0 || actualErrorCount !== 0) {
      issues.push({ code: "publication_evaluation_error" });
    }
    if (
      evaluation.caseCount !== expectedCaseCount ||
      evaluation.caseRunCount !== expectedRunCount ||
      evaluation.caseResults.length !== expectedRunCount
    ) {
      issues.push({ code: "publication_coverage_incomplete" });
    }
  }
  if (
    evaluation.overallScore === null ||
    !hasAllCategoryScores(evaluation.categoryScores)
  ) {
    issues.push({ code: "publication_score_unresolved" });
  }
}

function validateSourceMetadata(
  evaluationArtifact: ParsedPublicationEvaluation,
  issues: PublicationIssue[],
): void {
  if (evaluationArtifact.artifactMetadata === undefined) {
    issues.push({ code: "publication_source_metadata_invalid" });
  }
}

export async function validatePublicationSources(
  corpusDocument: JsonDocument,
  evaluationDocument: JsonDocument,
): Promise<PublicationSourceValidationResult> {
  const issues: PublicationIssue[] = [];
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID, TUTOR_EVAL_DATASET_VERSION);
  const expectedGenerationSpec = await currentGenerationSpec();
  let corpus: TutorResponseCorpus | undefined;
  const rawEvaluation = asRecord(evaluationDocument.value);
  const rawArtifactMetadata = rawEvaluation?.artifactMetadata;
  const hasInvalidArtifactMetadata = rawArtifactMetadata !== undefined &&
    parsePublicationArtifactMetadata(rawArtifactMetadata) === undefined;
  const evaluationArtifact = parseEvaluationArtifact(evaluationDocument.value);
  try {
    corpus = parseTutorResponseCorpus(corpusDocument.value);
  } catch {
    issues.push({ code: "publication_source_invalid" });
  }
  if (evaluationArtifact === undefined) {
    issues.push({ code: "publication_source_invalid" });
  }
  if (hasInvalidArtifactMetadata) {
    issues.push({ code: "publication_source_metadata_invalid" });
  }
  if (expectedGenerationSpec === undefined) {
    issues.push({ code: "publication_generation_spec_invalid" });
  }
  if (corpus === undefined || evaluationArtifact === undefined || expectedGenerationSpec === undefined) {
    return { issues: sortedIssues(issues) };
  }
  if (corpus.provenance !== "recorded_model" ||
    corpus.responses.some((response) => response.provenance !== "recorded_model")) {
    issues.push({ code: "publication_provenance_not_recorded_model" });
  }
  validateModelIdentity(corpus, issues);
  validateCorpusCoverage(corpus, dataset, issues);
  validateSourceIdentity(corpus, evaluationArtifact, expectedGenerationSpec, dataset, issues);
  validateSourceMetadata(evaluationArtifact, issues);
  validateEvaluationSelection(
    evaluationArtifact.evaluation,
    dataset,
    corpus.responses.length,
    issues,
  );
  validateEvaluationCompleteness(
    evaluationArtifact.evaluation.evaluation,
    dataset,
    corpus,
    issues,
  );
  validateCaseRuns(corpus, evaluationArtifact.evaluation, dataset, issues);
  const context: PublicationSourceContext = {
    corpus,
    evaluationArtifact,
    dataset,
    expectedGenerationSpec,
    sourceCorpusSha256: corpusDocument.sha256,
    sourceEvaluationSha256: evaluationDocument.sha256,
  };
  return { context, issues: sortedIssues(issues) };
}

export function publicationGateResults(
  issues: readonly PublicationIssue[],
): readonly { readonly code: (typeof gateCodes)[number]; readonly passed: boolean }[] {
  return gateCodes.map((code) => ({
    code,
    passed: !issues.some((issue) => issue.code === code),
  }));
}

export function toBenchmarkIdentity(
  context: PublicationSourceContext,
): PublicEvidenceBenchmarkIdentity {
  return {
    corpusId: context.corpus.corpusId,
    corpusVersion: context.corpus.corpusVersion,
    datasetId: context.corpus.datasetId,
    datasetVersion: context.corpus.datasetVersion,
    evaluatorVersion: context.evaluationArtifact.evaluation.evaluation.evaluatorVersion ?? "",
  };
}

export function toGenerationIdentity(
  context: PublicationSourceContext,
): PublicEvidenceGenerationIdentity {
  return expectedGenerationIdentity(context.expectedGenerationSpec);
}

export function toTutorIdentity(
  context: PublicationSourceContext,
): PublicEvidenceTutorIdentity | undefined {
  return toPublicTutorIdentity(context.corpus.tutor);
}

export function toJudgeIdentity(
  context: PublicationSourceContext,
): PublicEvidenceJudgeDescriptor | undefined {
  return toPublicJudgeDescriptor(context.evaluationArtifact.evaluation.evaluation.judge);
}

export function expectedCoverage(context: PublicationSourceContext) {
  const expectedCaseCount = context.dataset.cases.length;
  return {
    expectedCaseCount,
    expectedResponseCount: expectedCaseCount * context.corpus.runsPerCase,
  } as const;
}
