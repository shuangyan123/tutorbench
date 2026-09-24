import { BenchmarkConfigurationError } from "./errors.js";
import {
  TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES,
  TUTOR_EVAL_CRITICAL_FAILURE_TYPES,
} from "./tutor-eval.js";
import {
  TUTOR_FINDING_SCHEMA_VERSION,
  TUTOR_HEALTH_DIMENSIONS,
  TUTOR_HEALTH_PROFILE_SCHEMA_VERSION,
  TUTOR_HEALTH_REPORT_SCHEMA_VERSION,
  TUTOR_OBSERVATION_TYPES,
  type TutorEvidenceRef,
  type TutorFinding,
  type TutorHealthReport,
  type TutorHealthScoringProfile,
  type TutorObservation,
} from "./tutor-health.js";

type UnknownRecord = Record<string, unknown>;

const findingSeverities = new Set(["info", "minor", "major", "critical"]);
const evaluatorOwners = new Set([
  "deterministic_evaluator",
  "judge",
  "tutor_eval_aggregate",
  "human_reviewer",
]);
const rubricStatuses = new Set(["PASS", "PARTIAL", "FAIL", "ERROR"]);
const unresolvedReasons = new Set([
  "missing_case_result",
  "missing_rubric_result",
  "duplicate_rubric_result",
  "evaluation_error",
]);

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(record).every((key) => allowedSet.has(key));
}

function isText(value: unknown, maximum = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isBoundedInteger(value: unknown, minimum = 0, maximum = 1_000_000): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isTextArray(value: unknown, maximumItems: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => isText(item, 500))
  );
}

export function isTutorEvidenceRef(value: unknown): value is TutorEvidenceRef {
  const record = asRecord(value);
  if (record === null || !isText(record.sourceId, 240) || !isText(record.scenarioId, 120)) {
    return false;
  }
  switch (record.kind) {
    case "trajectory_turn":
      return (
        hasOnlyKeys(record, ["kind", "sourceId", "scenarioId", "turnIndex"]) &&
        isBoundedInteger(record.turnIndex, 1, 10_000)
      );
    case "rubric_result":
      return (
        hasOnlyKeys(record, [
          "kind",
          "sourceId",
          "scenarioId",
          "caseId",
          "runIndex",
          "turnIndex",
          "rubricId",
          "evaluator",
          "result",
        ]) &&
        isText(record.caseId, 160) &&
        isBoundedInteger(record.runIndex, 1, 10_000) &&
        isBoundedInteger(record.turnIndex, 1, 10_000) &&
        isText(record.rubricId, 120) &&
        (record.evaluator === "deterministic_evaluator" || record.evaluator === "judge") &&
        rubricStatuses.has(String(record.result))
      );
    case "critical_failure":
      return (
        hasOnlyKeys(record, [
          "kind",
          "sourceId",
          "scenarioId",
          "caseId",
          "runIndex",
          "turnIndex",
          "evaluator",
          "failureType",
          "severity",
        ]) &&
        isText(record.caseId, 160) &&
        isBoundedInteger(record.runIndex, 1, 10_000) &&
        isBoundedInteger(record.turnIndex, 1, 10_000) &&
        (record.evaluator === "judge" || record.evaluator === "tutor_eval_aggregate") &&
        TUTOR_EVAL_CRITICAL_FAILURE_TYPES.includes(
          record.failureType as (typeof TUTOR_EVAL_CRITICAL_FAILURE_TYPES)[number],
        ) &&
        TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES.includes(
          record.severity as (typeof TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES)[number],
        )
      );
    case "human_evidence":
      return (
        hasOnlyKeys(record, ["kind", "sourceId", "scenarioId", "owner"]) &&
        record.owner === "human_reviewer"
      );
    default:
      return false;
  }
}

export function isTutorObservation(value: unknown): value is TutorObservation {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "id",
      "type",
      "scenarioId",
      "runIndex",
      "turnIndex",
      "evaluatorOwner",
      "result",
      "evidence",
    ]) ||
    record.schemaVersion !== 1 ||
    !isText(record.id, 300) ||
    !TUTOR_OBSERVATION_TYPES.includes(record.type as (typeof TUTOR_OBSERVATION_TYPES)[number]) ||
    !isText(record.scenarioId, 120) ||
    !isBoundedInteger(record.runIndex, 1, 10_000) ||
    !isBoundedInteger(record.turnIndex, 1, 10_000) ||
    !evaluatorOwners.has(String(record.evaluatorOwner)) ||
    !Array.isArray(record.evidence) ||
    record.evidence.length === 0 ||
    record.evidence.length > 16 ||
    !record.evidence.every(isTutorEvidenceRef)
  ) {
    return false;
  }
  if (record.type === "rubric_result") {
    return rubricStatuses.has(String(record.result));
  }
  return record.result === undefined;
}

function isLikelyCause(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["hypothesis", "confidence", "evidence"]) &&
    isText(record.hypothesis, 1_000) &&
    isUnitInterval(record.confidence) &&
    Array.isArray(record.evidence) &&
    record.evidence.length > 0 &&
    record.evidence.length <= 16 &&
    record.evidence.every(isTutorEvidenceRef)
  );
}

function isRecommendation(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["kind", "text"]) &&
    (record.kind === "diagnostic" || record.kind === "implementation_suggestion") &&
    isText(record.text, 1_000)
  );
}

export function isTutorFinding(value: unknown): value is TutorFinding {
  const record = asRecord(value);
  const location = asRecord(record?.location);
  return (
    record !== null &&
    hasOnlyKeys(record, [
      "schemaVersion",
      "id",
      "type",
      "title",
      "severity",
      "dimension",
      "scenarioId",
      "runIndex",
      "location",
      "observedBehavior",
      "evidence",
      "expectedBehavior",
      "diagnosis",
      "impact",
      "likelyCauses",
      "recommendations",
      "regressionTargets",
      "confidence",
    ]) &&
    record.schemaVersion === TUTOR_FINDING_SCHEMA_VERSION &&
    isText(record.id, 300) &&
    isText(record.type, 100) &&
    /^[a-z][a-z0-9_.-]*$/.test(String(record.type)) &&
    isText(record.title, 200) &&
    findingSeverities.has(String(record.severity)) &&
    TUTOR_HEALTH_DIMENSIONS.includes(
      record.dimension as (typeof TUTOR_HEALTH_DIMENSIONS)[number],
    ) &&
    isText(record.scenarioId, 120) &&
    isBoundedInteger(record.runIndex, 1, 10_000) &&
    location !== null &&
    hasOnlyKeys(location, ["startTurn", "endTurn", "decisionPointId"]) &&
    isBoundedInteger(location.startTurn, 1, 10_000) &&
    isBoundedInteger(location.endTurn, 1, 10_000) &&
    location.endTurn >= location.startTurn &&
    (location.decisionPointId === undefined || isText(location.decisionPointId, 120)) &&
    isText(record.observedBehavior, 2_000) &&
    Array.isArray(record.evidence) &&
    record.evidence.length > 0 &&
    record.evidence.length <= 16 &&
    record.evidence.every(isTutorEvidenceRef) &&
    isText(record.expectedBehavior, 2_000) &&
    isText(record.diagnosis, 2_000) &&
    isText(record.impact, 2_000) &&
    Array.isArray(record.likelyCauses) &&
    record.likelyCauses.length <= 20 &&
    record.likelyCauses.every(isLikelyCause) &&
    Array.isArray(record.recommendations) &&
    record.recommendations.length > 0 &&
    record.recommendations.length <= 30 &&
    record.recommendations.every(isRecommendation) &&
    record.recommendations.some((item) => asRecord(item)?.kind === "diagnostic") &&
    isTextArray(record.regressionTargets, 50) &&
    record.regressionTargets.length > 0 &&
    isUnitInterval(record.confidence)
  );
}

export function parseTutorFinding(value: unknown): TutorFinding {
  if (!isTutorFinding(value)) {
    throw new BenchmarkConfigurationError("tutor_finding_invalid");
  }
  return value;
}

export function assertValidTutorFinding(value: unknown): asserts value is TutorFinding {
  parseTutorFinding(value);
}

export function isTutorHealthScoringProfile(
  value: unknown,
): value is TutorHealthScoringProfile {
  const record = asRecord(value);
  const weights = asRecord(record?.dimensionWeights);
  return (
    record !== null &&
    hasOnlyKeys(record, ["schemaVersion", "id", "version", "dimensionWeights"]) &&
    record.schemaVersion === TUTOR_HEALTH_PROFILE_SCHEMA_VERSION &&
    isText(record.id, 120) &&
    isText(record.version, 80) &&
    weights !== null &&
    hasOnlyKeys(weights, TUTOR_HEALTH_DIMENSIONS) &&
    TUTOR_HEALTH_DIMENSIONS.every(
      (dimension) =>
        typeof weights[dimension] === "number" &&
        Number.isFinite(weights[dimension]) &&
        (weights[dimension] as number) >= 0 &&
        (weights[dimension] as number) <= 100,
    ) &&
    TUTOR_HEALTH_DIMENSIONS.some((dimension) => (weights[dimension] as number) > 0)
  );
}

export function parseTutorHealthScoringProfile(value: unknown): TutorHealthScoringProfile {
  if (!isTutorHealthScoringProfile(value)) {
    throw new BenchmarkConfigurationError("tutor_health_scoring_profile_invalid");
  }
  return value;
}

function isDimensionScore(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["score", "assessedCount", "unresolvedCount"]) &&
    (record.score === null ||
      (typeof record.score === "number" &&
        Number.isInteger(record.score) &&
        record.score >= 0 &&
        record.score <= 100)) &&
    isBoundedInteger(record.assessedCount) &&
    isBoundedInteger(record.unresolvedCount)
  );
}

function isUnresolved(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["scenarioId", "decisionPointId", "runIndex", "reason", "rubricId"]) &&
    isText(record.scenarioId, 120) &&
    isText(record.decisionPointId, 120) &&
    isBoundedInteger(record.runIndex, 1, 10_000) &&
    unresolvedReasons.has(String(record.reason)) &&
    (record.rubricId === undefined || isText(record.rubricId, 120))
  );
}

function sameSeverityCounts(findings: readonly TutorFinding[], value: unknown): boolean {
  const record = asRecord(value);
  if (record === null || !hasOnlyKeys(record, ["info", "minor", "major", "critical"])) {
    return false;
  }
  const counts = { info: 0, minor: 0, major: 0, critical: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return Object.entries(counts).every(
    ([severity, count]) => record[severity] === count,
  );
}

export function isTutorHealthReport(value: unknown): value is TutorHealthReport {
  const record = asRecord(value);
  const scenarioSuite = asRecord(record?.sourceScenarioSuite);
  const source = asRecord(record?.sourceEvaluation);
  const dimensions = asRecord(record?.dimensionScores);
  const findings = record?.findings;
  const observations = record?.observations;
  const unresolved = record?.unresolved;
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "sourceScenarioSuite",
      "sourceEvaluation",
      "scoringProfile",
      "healthScore",
      "releaseGate",
      "findingCounts",
      "dimensionScores",
      "observations",
      "findings",
      "unresolved",
    ]) ||
    record.schemaVersion !== TUTOR_HEALTH_REPORT_SCHEMA_VERSION ||
    scenarioSuite === null ||
    !hasOnlyKeys(scenarioSuite, ["id", "version", "healthTaxonomyVersion"]) ||
    !isText(scenarioSuite.id, 120) ||
    !isText(scenarioSuite.version, 80) ||
    !isText(scenarioSuite.healthTaxonomyVersion, 80) ||
    source === null ||
    !hasOnlyKeys(source, ["runId", "datasetId", "datasetVersion", "evaluatorVersion"]) ||
    !isText(source.runId, 160) ||
    !isText(source.datasetId, 160) ||
    !isText(source.datasetVersion, 80) ||
    (source.evaluatorVersion !== undefined && !isText(source.evaluatorVersion, 80)) ||
    !isTutorHealthScoringProfile(record.scoringProfile) ||
    (record.healthScore !== null &&
      (typeof record.healthScore !== "number" ||
        !Number.isInteger(record.healthScore) ||
        record.healthScore < 0 ||
        record.healthScore > 100)) ||
    (record.releaseGate !== "PASS" &&
      record.releaseGate !== "FAIL" &&
      record.releaseGate !== "UNRESOLVED") ||
    dimensions === null ||
    !hasOnlyKeys(dimensions, TUTOR_HEALTH_DIMENSIONS) ||
    !TUTOR_HEALTH_DIMENSIONS.every((dimension) => isDimensionScore(dimensions[dimension])) ||
    !Array.isArray(observations) ||
    observations.length > 100_000 ||
    !observations.every(isTutorObservation) ||
    new Set(observations.map((item) => (item as TutorObservation).id)).size !== observations.length ||
    !Array.isArray(findings) ||
    findings.length > 100_000 ||
    !findings.every(isTutorFinding) ||
    new Set(findings.map((item) => (item as TutorFinding).id)).size !== findings.length ||
    !sameSeverityCounts(findings as TutorFinding[], record.findingCounts) ||
    !Array.isArray(unresolved) ||
    unresolved.length > 100_000 ||
    !unresolved.every(isUnresolved)
  ) {
    return false;
  }
  const reportFindings = findings as TutorFinding[];
  const reportUnresolved = unresolved as TutorHealthReport["unresolved"];
  const hasCriticalFinding = reportFindings.some(
    (finding) => finding.severity === "critical",
  );
  if (
    (hasCriticalFinding && record.releaseGate !== "FAIL") ||
    (record.releaseGate === "PASS" &&
      (reportUnresolved.length > 0 || record.healthScore === null)) ||
    (record.releaseGate === "UNRESOLVED" && reportUnresolved.length === 0)
  ) {
    return false;
  }
  return true;
}

export function parseTutorHealthReport(value: unknown): TutorHealthReport {
  if (!isTutorHealthReport(value)) {
    throw new BenchmarkConfigurationError("tutor_health_report_invalid");
  }
  return value;
}

export function assertValidTutorHealthReport(
  value: unknown,
): asserts value is TutorHealthReport {
  parseTutorHealthReport(value);
}
