import { BenchmarkConfigurationError } from "./errors.js";
import { isTutorEvidenceRef, isTutorHealthScoringProfile } from "./tutor-health-validation.js";
import type { TutorEvidenceRef } from "./tutor-health.js";
import {
  TUTOR_HEALTH_COMPARISON_KIND,
  TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION,
  TUTOR_HEALTH_COMPARISON_UNRESOLVED_REASONS,
  type TutorHealthComparison,
  type TutorHealthComparisonAssessment,
  type TutorHealthComparisonSide,
  type TutorHealthComparisonSource,
  type TutorHealthFindingComparison,
} from "./tutor-health-comparison.js";

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown, max = 300): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function integer(value: unknown, min = 1, max = 10_000): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
function hash(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/** JSON object order is immaterial; array order remains part of artifact identity. */
export function tutorHealthComparisonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(tutorHealthComparisonJson).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${tutorHealthComparisonJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function isTutorHealthComparisonDescriptor(value: unknown, judge: boolean): boolean {
  if (!record(value) || !keys(value, [
    "provider", "model", "modelVersion", "promptId", "promptVersion", "temperature", "reasoningEffort", "seed",
    ...(judge ? ["thinkingMode", "maxOutputTokens", "timeoutMs", "maxAttempts"] : []),
  ]) || ![value.provider, value.model, value.promptVersion].every((item) => text(item))) return false;
  return ["modelVersion", "promptId", "reasoningEffort"].every((key) => value[key] === undefined || text(value[key])) &&
    (value.temperature === undefined || (typeof value.temperature === "number" && Number.isFinite(value.temperature))) &&
    (value.seed === undefined || (typeof value.seed === "number" && Number.isSafeInteger(value.seed))) &&
    (value.thinkingMode === undefined || value.thinkingMode === "enabled" || value.thinkingMode === "disabled") &&
    ["maxOutputTokens", "timeoutMs", "maxAttempts"].every((key) => value[key] === undefined || integer(value[key], 1, Number.MAX_SAFE_INTEGER));
}

function isSource(value: unknown): value is TutorHealthComparisonSource {
  if (!record(value) || !keys(value, ["suite", "evaluation", "report", "tutor", "judge", "scoringProfile", "runsPerCase"])) return false;
  const { suite, evaluation, report } = value;
  return record(suite) && keys(suite, ["id", "version", "healthTaxonomyVersion", "sha256"]) &&
    text(suite.id, 120) && text(suite.version, 80) && text(suite.healthTaxonomyVersion, 80) && hash(suite.sha256) &&
    record(evaluation) && keys(evaluation, ["runId", "datasetId", "datasetVersion", "evaluatorVersion", "createdAt", "sha256"]) &&
    text(evaluation.runId, 160) && evaluation.datasetId === suite.id && evaluation.datasetVersion === suite.version &&
    text(evaluation.evaluatorVersion, 80) && text(evaluation.createdAt, 80) &&
    Number.isFinite(Date.parse(evaluation.createdAt)) && hash(evaluation.sha256) &&
    record(report) && keys(report, ["schemaVersion", "sha256"]) && report.schemaVersion === 2 && hash(report.sha256) &&
    isTutorHealthComparisonDescriptor(value.tutor, false) &&
    (value.judge === null || isTutorHealthComparisonDescriptor(value.judge, true)) &&
    isTutorHealthScoringProfile(value.scoringProfile) && integer(value.runsPerCase);
}

/** Only Tutor identity and source-run identity may differ. Unknown semantics fail closed. */
export function tutorHealthComparisonIncompatibility(
  baseline: TutorHealthComparisonSource,
  candidate: TutorHealthComparisonSource,
): string | null {
  if (baseline.evaluation.runId === candidate.evaluation.runId) return "run_identity";
  if (tutorHealthComparisonJson(baseline.suite) !== tutorHealthComparisonJson(candidate.suite)) return "scenario_suite";
  if (tutorHealthComparisonJson(baseline.scoringProfile) !== tutorHealthComparisonJson(candidate.scoringProfile)) return "scoring_profile";
  if (baseline.evaluation.evaluatorVersion !== candidate.evaluation.evaluatorVersion) return "evaluator_version";
  if (tutorHealthComparisonJson(baseline.judge) !== tutorHealthComparisonJson(candidate.judge)) return "judge_configuration";
  if (baseline.runsPerCase !== candidate.runsPerCase) return "runs_per_case";
  return null;
}

function isEvidence(value: unknown, scenarioId: string, runIndex: number): value is TutorEvidenceRef[] {
  return Array.isArray(value) && value.length <= 100_000 && value.every((ref) =>
    isTutorEvidenceRef(ref) && ref.scenarioId === scenarioId &&
    (!("runIndex" in ref) || ref.runIndex === runIndex));
}

function isAssessment(value: unknown, scenarioId: string, runIndex: number): value is TutorHealthComparisonAssessment {
  if (!record(value) || !keys(value, ["caseId", "caseVersion", "runIndex", "unresolvedReasons", "evidence"]) ||
      !text(value.caseId, 160) || !text(value.caseVersion) || value.runIndex !== runIndex ||
      !Array.isArray(value.unresolvedReasons) || !isEvidence(value.evidence, scenarioId, runIndex)) return false;
  const allowedReasons: readonly unknown[] = TUTOR_HEALTH_COMPARISON_UNRESOLVED_REASONS;
  if (!value.unresolvedReasons.every((reason: unknown) => allowedReasons.includes(reason)) ||
      new Set(value.unresolvedReasons).size !== value.unresolvedReasons.length) return false;
  if (!value.evidence.every((ref) => !("caseId" in ref) || ref.caseId === value.caseId)) return false;
  if (value.unresolvedReasons.length > 0) return true;
  return value.evidence.some((ref) => ref.kind === "rubric_result") &&
    value.evidence.every((ref) => ref.kind !== "rubric_result" || ref.result === "PASS" || ref.result === "FAIL");
}

function isFindingReference(
  value: unknown,
  scenarioId: string,
  assessments: readonly TutorHealthComparisonAssessment[],
): value is TutorHealthComparisonSide["findings"][number] {
  if (!record(value) || !keys(value, ["findingId", "runIndex", "evidence"]) ||
      !text(value.findingId) || !integer(value.runIndex, 1, assessments.length) ||
      !isEvidence(value.evidence, scenarioId, value.runIndex)) return false;
  const sourceEvidence = assessments[value.runIndex - 1]!.evidence;
  return value.evidence.some((ref) => ref.kind === "critical_failure" ||
      (ref.kind === "rubric_result" && ref.result === "FAIL")) &&
    value.evidence.every((ref) => sourceEvidence.some((candidate) =>
      tutorHealthComparisonJson(candidate) === tutorHealthComparisonJson(ref)));
}

function isSide(value: unknown, scenarioId: string, runs: number): value is TutorHealthComparisonSide {
  if (!record(value) || !keys(value, ["findings", "assessments"]) ||
      !Array.isArray(value.findings) || value.findings.length > 100_000 ||
      !Array.isArray(value.assessments) || value.assessments.length !== runs) return false;
  const assessments: TutorHealthComparisonAssessment[] = [];
  for (const [index, item] of value.assessments.entries()) {
    if (!isAssessment(item, scenarioId, index + 1)) return false;
    if (index > 0 && (item.caseId !== assessments[0]!.caseId || item.caseVersion !== assessments[0]!.caseVersion)) return false;
    assessments.push(item);
  }
  const ids = new Set<string>();
  for (const item of value.findings) {
    if (!isFindingReference(item, scenarioId, assessments) || ids.has(item.findingId)) return false;
    ids.add(item.findingId);
  }
  return true;
}

export function classifyTutorHealthFinding(
  baseline: TutorHealthComparisonSide,
  candidate: TutorHealthComparisonSide,
): TutorHealthFindingComparison["classification"] | null {
  if ([...baseline.assessments, ...candidate.assessments].some((item) => item.unresolvedReasons.length > 0)) return "unresolved";
  if (baseline.findings.length > 0) return candidate.findings.length > 0 ? "persistent" : "resolved";
  return candidate.findings.length > 0 ? "new" : null;
}

export function isTutorHealthComparison(value: unknown): value is TutorHealthComparison {
  if (!record(value) || !keys(value, ["schemaVersion", "kind", "status", "baseline", "candidate", "counts", "findings"]) ||
      value.schemaVersion !== TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION || value.kind !== TUTOR_HEALTH_COMPARISON_KIND ||
      !isSource(value.baseline) || !isSource(value.candidate) ||
      tutorHealthComparisonIncompatibility(value.baseline, value.candidate) !== null ||
      !record(value.counts) || !keys(value.counts, ["resolved", "persistent", "new", "unresolved"]) ||
      !Array.isArray(value.findings) || value.findings.length > 100_000) return false;
  const counts = { resolved: 0, persistent: 0, new: 0, unresolved: 0 };
  const identities = new Set<string>();
  for (const row of value.findings) {
    if (!record(row) || !keys(row, ["identity", "classification", "baseline", "candidate"]) ||
        !record(row.identity) || !keys(row.identity, ["scenarioId", "decisionPointId", "type"]) ||
        ![row.identity.scenarioId, row.identity.decisionPointId, row.identity.type].every((item) => text(item, 120)) ||
        !isSide(row.baseline, row.identity.scenarioId as string, value.baseline.runsPerCase) ||
        !isSide(row.candidate, row.identity.scenarioId as string, value.candidate.runsPerCase)) return false;
    const key = tutorHealthComparisonJson(row.identity);
    if (identities.has(key)) return false;
    identities.add(key);
    const classification = classifyTutorHealthFinding(row.baseline, row.candidate);
    if (classification === null || row.classification !== classification) return false;
    const candidateAssessments = row.candidate.assessments;
    if (row.baseline.assessments.some((item, index) => item.caseId !== candidateAssessments[index]!.caseId ||
        item.caseVersion !== candidateAssessments[index]!.caseVersion)) return false;
    counts[classification] += 1;
  }
  return Object.entries(counts).every(([key, count]) => (value.counts as RecordValue)[key] === count) &&
    value.status === (counts.unresolved > 0 ? "partially_comparable" : "comparable");
}

export function parseTutorHealthComparison(value: unknown): TutorHealthComparison {
  if (!isTutorHealthComparison(value)) throw new BenchmarkConfigurationError("tutor_health_comparison_invalid");
  return value;
}

export function assertValidTutorHealthComparison(value: unknown): asserts value is TutorHealthComparison {
  parseTutorHealthComparison(value);
}
