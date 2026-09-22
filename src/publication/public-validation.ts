import { TUTOR_EVAL_CATEGORIES, type TutorEvalCategory } from "../contracts/index.js";
import { isSha256Fingerprint } from "./fingerprint.js";
import { PublicEvidencePublicationError } from "./errors.js";
import {
  PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS,
  PUBLIC_EVIDENCE_CALIBRATION_STATUS,
  PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_JUDGE_STATUS,
  PUBLIC_EVIDENCE_LIMITATIONS,
  PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID,
  PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
  PUBLIC_EVIDENCE_PUBLICATION_STATUS,
  PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION,
  type PublicEvidenceCriticalFailure,
  type PublicEvidenceGenerationIdentity,
  type PublicEvidenceJudgeDescriptor,
  type PublicEvidenceModelRecord,
  type PublicEvidenceModelsArtifact,
  type PublicEvidencePublicationBundle,
  type PublicEvidenceRubricResult,
  type PublicEvidenceTokenUsage,
  type PublicEvidenceTrialRecord,
  type PublicEvidenceTrialsArtifact,
  type PublicationIssue,
} from "./contracts.js";

type UnknownRecord = Record<string, unknown>;

const forbiddenKeys = new Set([
  "evaluatorOnly",
  "groundTruth",
  "knownMisconception",
  "misconceptions",
  "rubrics",
  "referenceAnswer",
  "hiddenReasoning",
  "reasoning_content",
  "reasoningDetails",
  "rawProviderPayload",
  "credentials",
  "apiKey",
  "accessToken",
  "cookie",
  "authorization",
  "rawJudgeResult",
  "diagnostics",
  "evidence",
  "reviewerName",
  "email",
  "accountId",
  "baseUrl",
  "requestId",
  "requestPayload",
  "responsePayload",
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

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isScoreOrNull(value: unknown): value is number | null {
  return value === null || isScore(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPublicationId(value: unknown, prefix: "public-model-" | "public-trial-"): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}[a-f0-9]{32}$`, "u").test(value);
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenKey);
  }
  const record = asRecord(value);
  if (record === null) {
    return false;
  }
  return Object.entries(record).some(
    ([key, nested]) => forbiddenKeys.has(key) || containsForbiddenKey(nested),
  );
}

function containsAbsolutePath(value: unknown): boolean {
  if (typeof value === "string") {
    return /^[A-Za-z]:[\\/]/u.test(value) ||
      /^\/(?:home|Users)\//u.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsAbsolutePath);
  }
  const record = asRecord(value);
  return record !== null && Object.values(record).some(containsAbsolutePath);
}

function invalid(code: PublicationIssue["code"] = "publication_artifact_invalid"): never {
  throw new PublicEvidencePublicationError([{ code }]);
}

function parseTokenUsage(value: unknown): PublicEvidenceTokenUsage | null {
  if (value === null) {
    return null;
  }
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["inputTokens", "outputTokens", "totalTokens"]) ||
    Object.values(record).some((item) => !isNonNegativeInteger(item))
  ) {
    invalid();
  }
  return {
    ...(record.inputTokens === undefined ? {} : { inputTokens: record.inputTokens }),
    ...(record.outputTokens === undefined ? {} : { outputTokens: record.outputTokens }),
    ...(record.totalTokens === undefined ? {} : { totalTokens: record.totalTokens }),
  } as PublicEvidenceTokenUsage;
}

function parseGenerationIdentity(value: unknown): PublicEvidenceGenerationIdentity {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "generationSpecId",
      "generationSpecVersion",
      "promptId",
      "promptVersion",
      "promptSha256",
      "maxOutputTokens",
    ]) ||
    !nonEmptyString(record.generationSpecId) ||
    !nonEmptyString(record.generationSpecVersion) ||
    !nonEmptyString(record.promptId) ||
    !nonEmptyString(record.promptVersion) ||
    !/^[a-f0-9]{64}$/u.test(String(record.promptSha256)) ||
    !isNonNegativeInteger(record.maxOutputTokens) ||
    record.maxOutputTokens < 1
  ) {
    invalid();
  }
  return {
    generationSpecId: record.generationSpecId,
    generationSpecVersion: record.generationSpecVersion,
    promptId: record.promptId,
    promptVersion: record.promptVersion,
    promptSha256: record.promptSha256,
    maxOutputTokens: record.maxOutputTokens,
  } as PublicEvidenceGenerationIdentity;
}

function parseJudgeDescriptor(value: unknown): PublicEvidenceJudgeDescriptor {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "provider",
      "model",
      "modelVersion",
      "promptId",
      "promptVersion",
      "reasoningEffort",
      "thinkingMode",
      "maxOutputTokens",
    ]) ||
    !nonEmptyString(record.provider) ||
    !nonEmptyString(record.model) ||
    !nonEmptyString(record.promptVersion) ||
    (record.modelVersion !== undefined && !nonEmptyString(record.modelVersion)) ||
    (record.promptId !== undefined && !nonEmptyString(record.promptId)) ||
    (record.reasoningEffort !== undefined && !nonEmptyString(record.reasoningEffort)) ||
    (record.thinkingMode !== undefined &&
      record.thinkingMode !== "enabled" &&
      record.thinkingMode !== "disabled") ||
    (record.maxOutputTokens !== undefined &&
      (!isNonNegativeInteger(record.maxOutputTokens) || record.maxOutputTokens < 1))
  ) {
    invalid();
  }
  return {
    provider: record.provider,
    model: record.model,
    ...(record.modelVersion === undefined ? {} : { modelVersion: record.modelVersion }),
    ...(record.promptId === undefined ? {} : { promptId: record.promptId }),
    promptVersion: record.promptVersion,
    ...(record.reasoningEffort === undefined ? {} : { reasoningEffort: record.reasoningEffort }),
    ...(record.thinkingMode === undefined ? {} : { thinkingMode: record.thinkingMode }),
    ...(record.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: record.maxOutputTokens }),
  } as PublicEvidenceJudgeDescriptor;
}

function parseRubricResults(value: unknown): readonly PublicEvidenceRubricResult[] {
  if (!Array.isArray(value)) {
    invalid();
  }
  const results = value.map((item) => {
    const record = asRecord(item);
    if (
      record === null ||
      !hasOnlyKeys(record, ["category", "result", "score", "critical"]) ||
      !TUTOR_EVAL_CATEGORIES.includes(record.category as TutorEvalCategory) ||
      (record.result !== "PASS" && record.result !== "PARTIAL" && record.result !== "FAIL") ||
      !isScore(record.score) ||
      typeof record.critical !== "boolean"
    ) {
      invalid();
    }
    return {
      category: record.category,
      result: record.result,
      score: record.score,
      critical: record.critical,
    } as PublicEvidenceRubricResult;
  });
  if (JSON.stringify([...results].sort((left, right) =>
    `${left.category}\u0000${left.result}\u0000${left.score}\u0000${left.critical}`.localeCompare(
      `${right.category}\u0000${right.result}\u0000${right.score}\u0000${right.critical}`,
    ),
  )) !== JSON.stringify(results)) {
    invalid();
  }
  return results;
}

function parseCriticalFailures(value: unknown): readonly PublicEvidenceCriticalFailure[] {
  if (!Array.isArray(value)) {
    invalid();
  }
  const failures = value.map((item) => {
    const record = asRecord(item);
    if (
      record === null ||
      !hasOnlyKeys(record, ["type", "severity"]) ||
      !nonEmptyString(record.type) ||
      (record.severity !== "minor" &&
        record.severity !== "major" &&
        record.severity !== "critical")
    ) {
      invalid();
    }
    return {
      type: record.type,
      severity: record.severity,
    } as PublicEvidenceCriticalFailure;
  });
  if (JSON.stringify([...failures].sort((left, right) =>
    `${left.type}\u0000${left.severity}`.localeCompare(`${right.type}\u0000${right.severity}`),
  )) !== JSON.stringify(failures)) {
    invalid();
  }
  return failures;
}

function parseModel(value: unknown): PublicEvidenceModelRecord {
  const record = asRecord(value);
  if (record !== null && record.id !== undefined && !isPublicationId(record.id, "public-model-")) {
    invalid("publication_id_invalid");
  }
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "id",
      "provider",
      "model",
      "modelVersion",
      "evidenceStatus",
      "calibrationStatus",
      "publicLeaderboardEligible",
      "judgeEvidenceStatus",
      "datasetId",
      "datasetVersion",
      "evaluatorVersion",
      "generationSpecId",
      "generationSpecVersion",
      "promptId",
      "promptVersion",
      "promptSha256",
      "maxOutputTokens",
      "runs",
      "caseCount",
      "trialCount",
      "overallScore",
      "correctness",
      "diagnosis",
      "guidance",
      "adaptation",
      "actionability",
      "criticalFailureRate",
      "answerLeakageRate",
    ]) ||
    !isPublicationId(record.id, "public-model-") ||
    !nonEmptyString(record.provider) ||
    !nonEmptyString(record.model) ||
    !nonEmptyString(record.modelVersion) ||
    record.evidenceStatus !== PUBLIC_EVIDENCE_PUBLICATION_STATUS ||
    record.calibrationStatus !== PUBLIC_EVIDENCE_CALIBRATION_STATUS ||
    record.publicLeaderboardEligible !== false ||
    record.judgeEvidenceStatus !== PUBLIC_EVIDENCE_JUDGE_STATUS ||
    !nonEmptyString(record.datasetId) ||
    !nonEmptyString(record.datasetVersion) ||
    !nonEmptyString(record.evaluatorVersion) ||
    !isNonNegativeInteger(record.runs) ||
    record.runs < 1 ||
    !isNonNegativeInteger(record.caseCount) ||
    record.caseCount < 1 ||
    !isNonNegativeInteger(record.trialCount) ||
    record.trialCount < 1 ||
    !isScore(record.overallScore) ||
    !isScore(record.correctness) ||
    !isScore(record.diagnosis) ||
    !isScore(record.guidance) ||
    !isScore(record.adaptation) ||
    !isScore(record.actionability) ||
    !isScore(record.criticalFailureRate) ||
    !isScore(record.answerLeakageRate)
  ) {
    invalid();
  }
  const generation = parseGenerationIdentity({
    generationSpecId: record.generationSpecId,
    generationSpecVersion: record.generationSpecVersion,
    promptId: record.promptId,
    promptVersion: record.promptVersion,
    promptSha256: record.promptSha256,
    maxOutputTokens: record.maxOutputTokens,
  });
  return {
    id: record.id,
    provider: record.provider,
    model: record.model,
    modelVersion: record.modelVersion,
    evidenceStatus: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    datasetId: record.datasetId,
    datasetVersion: record.datasetVersion,
    evaluatorVersion: record.evaluatorVersion,
    ...generation,
    runs: record.runs,
    caseCount: record.caseCount,
    trialCount: record.trialCount,
    overallScore: record.overallScore,
    correctness: record.correctness,
    diagnosis: record.diagnosis,
    guidance: record.guidance,
    adaptation: record.adaptation,
    actionability: record.actionability,
    criticalFailureRate: record.criticalFailureRate,
    answerLeakageRate: record.answerLeakageRate,
  } as PublicEvidenceModelRecord;
}

function parseTrial(value: unknown): PublicEvidenceTrialRecord {
  const record = asRecord(value);
  if (record !== null && record.id !== undefined && !isPublicationId(record.id, "public-trial-")) {
    invalid("publication_id_invalid");
  }
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "id",
      "modelId",
      "caseId",
      "caseVersion",
      "runIndex",
      "responseId",
      "tutorResponse",
      "status",
      "passed",
      "qualityGate",
      "overallScore",
      "correctness",
      "diagnosis",
      "guidance",
      "adaptation",
      "actionability",
      "rubricResults",
      "criticalFailures",
      "answerLeakage",
      "judgeEvidenceStatus",
      "judge",
      "latencyMs",
      "tokenUsage",
      "cost",
    ]) ||
    !isPublicationId(record.id, "public-trial-") ||
    !nonEmptyString(record.modelId) ||
    !nonEmptyString(record.caseId) ||
    !nonEmptyString(record.caseVersion) ||
    !isNonNegativeInteger(record.runIndex) ||
    record.runIndex < 1 ||
    !nonEmptyString(record.responseId) ||
    typeof record.tutorResponse !== "string" ||
    (record.status !== "passed" && record.status !== "failed") ||
    typeof record.passed !== "boolean" ||
    record.passed !== (record.status === "passed") ||
    (record.qualityGate !== "PASS" && record.qualityGate !== "FAIL") ||
    !isScore(record.overallScore) ||
    !isScoreOrNull(record.correctness) ||
    !isScoreOrNull(record.diagnosis) ||
    !isScoreOrNull(record.guidance) ||
    !isScoreOrNull(record.adaptation) ||
    !isScoreOrNull(record.actionability) ||
    typeof record.answerLeakage !== "boolean" ||
    record.judgeEvidenceStatus !== PUBLIC_EVIDENCE_JUDGE_STATUS ||
    record.latencyMs !== null &&
      !(typeof record.latencyMs === "number" &&
        Number.isFinite(record.latencyMs) &&
        record.latencyMs >= 0) ||
    record.cost !== null &&
      !(typeof record.cost === "number" && Number.isFinite(record.cost) && record.cost >= 0)
  ) {
    invalid();
  }
  const tokenUsage = parseTokenUsage(record.tokenUsage);
  const rubricResults = parseRubricResults(record.rubricResults);
  const criticalFailures = parseCriticalFailures(record.criticalFailures);
  const judge = parseJudgeDescriptor(record.judge);
  return {
    id: record.id,
    modelId: record.modelId,
    caseId: record.caseId,
    caseVersion: record.caseVersion,
    runIndex: record.runIndex,
    responseId: record.responseId,
    tutorResponse: record.tutorResponse,
    status: record.status,
    passed: record.passed,
    qualityGate: record.qualityGate,
    overallScore: record.overallScore,
    correctness: record.correctness,
    diagnosis: record.diagnosis,
    guidance: record.guidance,
    adaptation: record.adaptation,
    actionability: record.actionability,
    rubricResults,
    criticalFailures,
    answerLeakage: record.answerLeakage,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    judge,
    latencyMs: record.latencyMs,
    tokenUsage,
    cost: record.cost,
  } as PublicEvidenceTrialRecord;
}

function parseHeader(
  value: unknown,
  schemaVersion: number,
  artifactKind: string,
): UnknownRecord {
  const record = asRecord(value);
  if (
    record === null ||
    record.schemaVersion !== schemaVersion ||
    record.artifactKind !== artifactKind ||
    !nonEmptyString(record.publicationId) ||
    !nonEmptyString(record.publicationVersion) ||
    record.status !== PUBLIC_EVIDENCE_PUBLICATION_STATUS ||
    record.calibrationStatus !== PUBLIC_EVIDENCE_CALIBRATION_STATUS ||
    record.publicLeaderboardEligible !== false ||
    record.judgeEvidenceStatus !== PUBLIC_EVIDENCE_JUDGE_STATUS
  ) {
    invalid();
  }
  return record;
}

function parseModelArtifact(value: unknown): PublicEvidenceModelsArtifact {
  const record = parseHeader(
    value,
    PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION,
    "public-model-evidence",
  );
  if (
    !hasOnlyKeys(record, [
      "schemaVersion",
      "artifactKind",
      "publicationId",
      "publicationVersion",
      "status",
      "calibrationStatus",
      "publicLeaderboardEligible",
      "judgeEvidenceStatus",
      "entries",
    ]) ||
    !Array.isArray(record.entries) ||
    record.entries.length !== 1
  ) {
    invalid();
  }
  return {
    schemaVersion: PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "public-model-evidence",
    publicationId: record.publicationId as string,
    publicationVersion: record.publicationVersion as string,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    entries: [parseModel(record.entries[0])],
  };
}

function parseTrialsArtifact(value: unknown): PublicEvidenceTrialsArtifact {
  const record = parseHeader(
    value,
    PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION,
    "public-trial-evidence",
  );
  if (
    !hasOnlyKeys(record, [
      "schemaVersion",
      "artifactKind",
      "publicationId",
      "publicationVersion",
      "status",
      "calibrationStatus",
      "publicLeaderboardEligible",
      "judgeEvidenceStatus",
      "entries",
    ]) ||
    !Array.isArray(record.entries)
  ) {
    invalid();
  }
  const entries = record.entries.map(parseTrial);
  return {
    schemaVersion: PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "public-trial-evidence",
    publicationId: record.publicationId as string,
    publicationVersion: record.publicationVersion as string,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    entries,
  };
}

function parseAcknowledgements(value: unknown): Record<string, true> {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS) ||
    PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS.some((key) => record[key] !== true)
  ) {
    invalid();
  }
  return Object.fromEntries(
    PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS.map((key) => [key, true]),
  );
}

function parseSourceIdentity(value: unknown) {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["sourceCorpusSha256", "sourceEvaluationSha256"]) ||
    !isSha256Fingerprint(record.sourceCorpusSha256) ||
    !isSha256Fingerprint(record.sourceEvaluationSha256)
  ) {
    invalid();
  }
  return {
    sourceCorpusSha256: record.sourceCorpusSha256,
    sourceEvaluationSha256: record.sourceEvaluationSha256,
  };
}

function parseBenchmarkIdentity(value: unknown) {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "corpusId",
      "corpusVersion",
      "datasetId",
      "datasetVersion",
      "evaluatorVersion",
    ]) ||
    !nonEmptyString(record.corpusId) ||
    !nonEmptyString(record.corpusVersion) ||
    !nonEmptyString(record.datasetId) ||
    !nonEmptyString(record.datasetVersion) ||
    !nonEmptyString(record.evaluatorVersion)
  ) {
    invalid();
  }
  return {
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    datasetId: record.datasetId,
    datasetVersion: record.datasetVersion,
    evaluatorVersion: record.evaluatorVersion,
  };
}

export function parsePublicEvidencePublicationBundle(
  value: unknown,
): PublicEvidencePublicationBundle {
  if (containsForbiddenKey(value) || containsAbsolutePath(value)) {
    invalid("publication_private_field");
  }
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "publicationId",
      "publicationVersion",
      "policyId",
      "policyVersion",
      "scope",
      "status",
      "calibrationStatus",
      "publicLeaderboardEligible",
      "judgeEvidenceStatus",
      "acknowledgements",
      "limitations",
      "sourceIdentity",
      "benchmarkIdentity",
      "generationIdentity",
      "model",
      "trials",
    ]) ||
    record.schemaVersion !== PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION ||
    !nonEmptyString(record.publicationId) ||
    !nonEmptyString(record.publicationVersion) ||
    record.policyId !== PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID ||
    record.policyVersion !== PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION ||
    record.scope !== PUBLIC_EVIDENCE_PUBLICATION_SCOPE ||
    record.status !== PUBLIC_EVIDENCE_PUBLICATION_STATUS ||
    record.calibrationStatus !== PUBLIC_EVIDENCE_CALIBRATION_STATUS ||
    record.publicLeaderboardEligible !== false ||
    record.judgeEvidenceStatus !== PUBLIC_EVIDENCE_JUDGE_STATUS ||
    !Array.isArray(record.limitations) ||
    JSON.stringify(record.limitations) !== JSON.stringify(PUBLIC_EVIDENCE_LIMITATIONS)
  ) {
    invalid();
  }
  const sourceIdentity = parseSourceIdentity(record.sourceIdentity);
  const benchmarkIdentity = parseBenchmarkIdentity(record.benchmarkIdentity);
  const generationIdentity = parseGenerationIdentity(record.generationIdentity);
  const model = parseModel(record.model);
  if (!Array.isArray(record.trials)) {
    invalid();
  }
  const trials = record.trials.map(parseTrial);
  const trialIds = new Set(trials.map((trial) => trial.id));
  if (
    trialIds.size !== trials.length ||
    trials.some((trial) => trial.modelId !== model.id) ||
    model.trialCount !== trials.length ||
    model.caseCount * model.runs !== trials.length ||
    JSON.stringify([...trials].sort((left, right) =>
      `${left.caseId}\u0000${left.runIndex}`.localeCompare(`${right.caseId}\u0000${right.runIndex}`),
    )) !== JSON.stringify(trials)
  ) {
    invalid();
  }
  if (
    model.datasetId !== benchmarkIdentity.datasetId ||
    model.datasetVersion !== benchmarkIdentity.datasetVersion ||
    model.evaluatorVersion !== benchmarkIdentity.evaluatorVersion ||
    model.generationSpecId !== generationIdentity.generationSpecId ||
    model.generationSpecVersion !== generationIdentity.generationSpecVersion ||
    model.promptId !== generationIdentity.promptId ||
    model.promptVersion !== generationIdentity.promptVersion ||
    model.promptSha256 !== generationIdentity.promptSha256 ||
    model.maxOutputTokens !== generationIdentity.maxOutputTokens
  ) {
    invalid();
  }
  const acknowledgements = parseAcknowledgements(record.acknowledgements);
  return {
    schemaVersion: PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION,
    publicationId: record.publicationId,
    publicationVersion: record.publicationVersion,
    policyId: PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID,
    policyVersion: PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION,
    scope: PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    acknowledgements: acknowledgements as PublicEvidencePublicationBundle["acknowledgements"],
    limitations: PUBLIC_EVIDENCE_LIMITATIONS,
    sourceIdentity,
    benchmarkIdentity,
    generationIdentity,
    model,
    trials,
  };
}

export function parsePublicEvidenceModelsArtifact(
  value: unknown,
): PublicEvidenceModelsArtifact {
  if (containsForbiddenKey(value) || containsAbsolutePath(value)) {
    invalid("publication_private_field");
  }
  return parseModelArtifact(value);
}

export function parsePublicEvidenceTrialsArtifact(
  value: unknown,
): PublicEvidenceTrialsArtifact {
  if (containsForbiddenKey(value) || containsAbsolutePath(value)) {
    invalid("publication_private_field");
  }
  return parseTrialsArtifact(value);
}

export interface ValidatedPublicationFiles {
  readonly publication: PublicEvidencePublicationBundle;
  readonly models: PublicEvidenceModelsArtifact;
  readonly trials: PublicEvidenceTrialsArtifact;
}

export function validatePublicEvidenceFiles(
  publicationValue: unknown,
  modelsValue: unknown,
  trialsValue: unknown,
): ValidatedPublicationFiles {
  const publication = parsePublicEvidencePublicationBundle(publicationValue);
  const models = parsePublicEvidenceModelsArtifact(modelsValue);
  const trials = parsePublicEvidenceTrialsArtifact(trialsValue);
  if (
    models.publicationId !== publication.publicationId ||
    models.publicationVersion !== publication.publicationVersion ||
    trials.publicationId !== publication.publicationId ||
    trials.publicationVersion !== publication.publicationVersion ||
    models.entries[0].id !== publication.model.id ||
    JSON.stringify(models.entries[0]) !== JSON.stringify(publication.model) ||
    JSON.stringify(trials.entries) !== JSON.stringify(publication.trials)
  ) {
    invalid("publication_identity_mismatch");
  }
  return { publication, models, trials };
}

export const PUBLIC_EVIDENCE_INSPECTION_SCHEMA =
  PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION;
