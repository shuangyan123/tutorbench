import { BenchmarkConfigurationError } from "./errors.js";
import {
  LEARNER_OUTCOME_EVIDENCE_SCHEMA_VERSION,
  TEACH_BACK_OUTCOME_PROTOCOL_ID,
  TEACH_BACK_OUTCOME_PROTOCOL_VERSION,
  type TeachBackLearnerOutcomeEvidence,
} from "./learner-outcome-evidence.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(record).every((key) => set.has(key));
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 500));
}

function isTutorExposure(value: unknown): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "learningObjective",
      "tutor",
      "sourceScenarioSuiteId",
      "sourceScenarioSuiteVersion",
      "sourceScenarioId",
      "sourceEvaluationRunId",
    ]) ||
    !isText(record.learningObjective, 1_000)
  ) return false;
  const tutor = asRecord(record.tutor);
  return (
    tutor !== null &&
    hasOnlyKeys(tutor, ["provider", "model", "promptVersion"]) &&
    isText(tutor.provider, 120) &&
    isText(tutor.model, 160) &&
    isText(tutor.promptVersion, 160) &&
    (record.sourceScenarioSuiteId === undefined || isText(record.sourceScenarioSuiteId, 160)) &&
    (record.sourceScenarioSuiteVersion === undefined || isText(record.sourceScenarioSuiteVersion, 80)) &&
    (record.sourceScenarioId === undefined || isText(record.sourceScenarioId, 160)) &&
    (record.sourceEvaluationRunId === undefined || isText(record.sourceEvaluationRunId, 160))
  );
}

function isRecipient(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, [
      "recipientId",
      "kind",
      "relativeLevel",
      "knownConcepts",
      "prerequisiteGaps",
    ]) &&
    isText(record.recipientId, 120) &&
    (record.kind === "synthetic" || record.kind === "human") &&
    (record.relativeLevel === "peer" || record.relativeLevel === "lower_prerequisite") &&
    isTextArray(record.knownConcepts) &&
    isTextArray(record.prerequisiteGaps)
  );
}

const stages = new Set(["baseline", "immediate", "near_transfer", "far_transfer"]);
const results = new Set(["correct", "partial", "incorrect", "unscored"]);

function isAssessment(value: unknown, requiredStage?: string): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, [
      "stage",
      "taskId",
      "result",
      "independentlyCompleted",
      "notes",
    ]) &&
    stages.has(String(record.stage)) &&
    (requiredStage === undefined || record.stage === requiredStage) &&
    isText(record.taskId, 160) &&
    results.has(String(record.result)) &&
    typeof record.independentlyCompleted === "boolean" &&
    (record.notes === undefined || isText(record.notes, 1_000))
  );
}

const dimensions = new Set([
  "knowledge_reconstruction",
  "learner_diagnosis",
  "adaptive_explanation",
]);
const ratings = new Set(["pass", "partial", "fail", "unscored"]);

function isTeachBack(value: unknown): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["transcript", "processEvidence"]) ||
    !Array.isArray(record.transcript) ||
    record.transcript.length === 0 ||
    record.transcript.length > 200 ||
    !record.transcript.every((turn) => {
      const item = asRecord(turn);
      return item !== null &&
        hasOnlyKeys(item, ["speaker", "content"]) &&
        (item.speaker === "learner_teacher" || item.speaker === "recipient") &&
        isText(item.content, 10_000);
    }) ||
    !Array.isArray(record.processEvidence) ||
    record.processEvidence.length === 0 ||
    record.processEvidence.length > 20
  ) {
    return false;
  }

  const transcript = record.transcript;
  const processEvidence = record.processEvidence;
  const seen = new Set<string>();
  const valid = processEvidence.every((item) => {
    const evidence = asRecord(item);
    if (
      evidence === null ||
      !hasOnlyKeys(evidence, [
        "dimension",
        "rating",
        "evidenceTurnIndexes",
        "rationale",
      ]) ||
      !dimensions.has(String(evidence.dimension)) ||
      seen.has(String(evidence.dimension)) ||
      !ratings.has(String(evidence.rating)) ||
      !Array.isArray(evidence.evidenceTurnIndexes) ||
      evidence.evidenceTurnIndexes.length === 0 ||
      !evidence.evidenceTurnIndexes.every((index) =>
        typeof index === "number" &&
        Number.isInteger(index) &&
        index >= 1 &&
        index <= transcript.length
      ) ||
      new Set(evidence.evidenceTurnIndexes).size !== evidence.evidenceTurnIndexes.length ||
      (evidence.rationale !== undefined && !isText(evidence.rationale, 1_000))
    ) {
      return false;
    }
    seen.add(String(evidence.dimension));
    return true;
  });
  return valid && seen.size === dimensions.size;
}

export function isTeachBackLearnerOutcomeEvidence(
  value: unknown,
): value is TeachBackLearnerOutcomeEvidence {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "evidenceKind",
      "protocolId",
      "protocolVersion",
      "evidenceId",
      "evidenceSource",
      "learnerId",
      "sourceTutorExposure",
      "recipient",
      "baseline",
      "teachBack",
      "recipientOutcomes",
      "claimBoundary",
    ]) ||
    record.schemaVersion !== LEARNER_OUTCOME_EVIDENCE_SCHEMA_VERSION ||
    record.evidenceKind !== "teach_back" ||
    record.protocolId !== TEACH_BACK_OUTCOME_PROTOCOL_ID ||
    record.protocolVersion !== TEACH_BACK_OUTCOME_PROTOCOL_VERSION ||
    !isText(record.evidenceId, 160) ||
    (record.evidenceSource !== "synthetic_protocol_fixture" &&
      record.evidenceSource !== "human_observation") ||
    !isText(record.learnerId, 120) ||
    !isTutorExposure(record.sourceTutorExposure) ||
    !isRecipient(record.recipient) ||
    !isAssessment(record.baseline, "baseline") ||
    !isTeachBack(record.teachBack) ||
    record.claimBoundary !== "observational_or_proxy_only"
  ) {
    return false;
  }

  const recipient = record.recipient as UnknownRecord;
  if (
    (record.evidenceSource === "synthetic_protocol_fixture" &&
      recipient.kind !== "synthetic") ||
    (record.evidenceSource === "human_observation" &&
      recipient.kind !== "human")
  ) {
    return false;
  }

  const outcomes = asRecord(record.recipientOutcomes);
  return (
    outcomes !== null &&
    hasOnlyKeys(outcomes, ["immediate", "nearTransfer", "farTransfer"]) &&
    isAssessment(outcomes.immediate, "immediate") &&
    (outcomes.nearTransfer === undefined ||
      isAssessment(outcomes.nearTransfer, "near_transfer")) &&
    (outcomes.farTransfer === undefined ||
      isAssessment(outcomes.farTransfer, "far_transfer"))
  );
}

export function parseTeachBackLearnerOutcomeEvidence(
  value: unknown,
): TeachBackLearnerOutcomeEvidence {
  if (!isTeachBackLearnerOutcomeEvidence(value)) {
    throw new BenchmarkConfigurationError("learner_outcome_evidence_invalid");
  }
  return value;
}

export function assertValidTeachBackLearnerOutcomeEvidence(
  value: unknown,
): asserts value is TeachBackLearnerOutcomeEvidence {
  parseTeachBackLearnerOutcomeEvidence(value);
}
