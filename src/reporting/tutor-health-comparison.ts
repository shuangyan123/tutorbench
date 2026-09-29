import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  TUTOR_HEALTH_COMPARISON_KIND,
  TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION,
  TutorHealthComparisonError,
  type TutorHealthComparison,
  type TutorHealthComparisonAssessment,
  type TutorHealthComparisonSide,
  type TutorHealthFindingComparison,
} from "../contracts/tutor-health-comparison.js";
import {
  assertValidTutorHealthComparison,
  classifyTutorHealthFinding,
  tutorHealthComparisonIncompatibility,
  tutorHealthComparisonJson,
} from "../contracts/tutor-health-comparison-validation.js";
import type { TutorEvidenceRef } from "../contracts/tutor-health.js";
import type { TutorScenarioDecisionPoint } from "../contracts/tutor-scenario-vnext.js";
import { validateTutorHealthComparisonSource, type TutorHealthComparisonInput } from "./tutor-health-comparison-source.js";

export type { TutorHealthComparisonInput } from "./tutor-health-comparison-source.js";

function orderedEvidence(evidence: readonly TutorEvidenceRef[]): TutorEvidenceRef[] {
  const unique = new Map(evidence.map((item) => [tutorHealthComparisonJson(item), item]));
  return [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item);
}

function assessPoint(
  source: TutorHealthComparisonInput,
  scenarioId: string,
  scenarioVersion: string,
  point: TutorScenarioDecisionPoint,
): TutorHealthComparisonAssessment[] {
  return Array.from({ length: source.evaluation.runsPerCase }, (_, index) => {
    const runIndex = index + 1;
    const result = source.evaluation.caseResults.find((item) => item.caseId === point.evaluationCaseId && item.runIndex === runIndex);
    const reasons = new Set<TutorHealthComparisonAssessment["unresolvedReasons"][number]>(
      source.report.unresolved.filter((item) => item.scenarioId === scenarioId && item.decisionPointId === point.id && item.runIndex === runIndex)
        .map((item) => item.reason),
    );
    if (result === undefined) reasons.add("missing_case_result");
    else {
      if (result.status === "error" || result.rawTutorResponse === null ||
          (point.evaluationCriteria.some((item) => item.evaluationType === "judge") &&
           (source.evaluation.judge === null || result.rawJudgeResult === null))) reasons.add("evaluation_error");
      if (result.rubricResults.some((item) => item.result === "PARTIAL")) reasons.add("partial_evidence");
    }
    const refs = source.report.observations.flatMap((item) => item.evidence).filter((ref) =>
      "caseId" in ref && ref.caseId === point.evaluationCaseId && ref.runIndex === runIndex);
    return {
      caseId: point.evaluationCaseId,
      caseVersion: `${scenarioVersion}:${point.id}`,
      runIndex,
      unresolvedReasons: [...reasons].sort(),
      evidence: orderedEvidence(refs),
    };
  });
}

function sideFor(
  source: TutorHealthComparisonInput,
  identity: TutorHealthFindingComparison["identity"],
  assessments: readonly TutorHealthComparisonAssessment[],
): TutorHealthComparisonSide {
  return {
    findings: source.report.findings.filter((item) => item.scenarioId === identity.scenarioId &&
      item.location.decisionPointId === identity.decisionPointId && item.type === identity.type)
      .map((item) => ({ findingId: item.id, runIndex: item.runIndex, evidence: orderedEvidence(item.evidence) }))
      .sort((a, b) => a.runIndex - b.runIndex || (a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0)),
    assessments,
  };
}

/** Compares preserved artifacts without executing a Tutor/Judge or changing scores. */
export function compareTutorHealthRuns(options: {
  readonly baseline: TutorHealthComparisonInput;
  readonly candidate: TutorHealthComparisonInput;
}): TutorHealthComparison {
  const baseline = validateTutorHealthComparisonSource(options.baseline);
  const candidate = validateTutorHealthComparisonSource(options.candidate);
  const incompatible = tutorHealthComparisonIncompatibility(baseline, candidate);
  if (incompatible !== null) throw new TutorHealthComparisonError(incompatible);
  const findings: TutorHealthFindingComparison[] = [];
  for (const scenario of options.baseline.suite.scenarios) {
    for (const point of scenario.decisionPoints) {
      const baselineAssessments = assessPoint(options.baseline, scenario.identity.id, scenario.identity.version, point);
      const candidateAssessments = assessPoint(options.candidate, scenario.identity.id, scenario.identity.version, point);
      const types = new Set([
        ...point.evaluationCriteria.map((item) => item.failureFinding.type),
        ...[...options.baseline.report.findings, ...options.candidate.report.findings]
          .filter((item) => item.scenarioId === scenario.identity.id && item.location.decisionPointId === point.id)
          .map((item) => item.type),
      ]);
      for (const type of types) {
        const identity = { scenarioId: scenario.identity.id, decisionPointId: point.id, type };
        const baselineSide = sideFor(options.baseline, identity, baselineAssessments);
        const candidateSide = sideFor(options.candidate, identity, candidateAssessments);
        // 任一重复运行证据不完整时，不能把 Finding 消失解释为修复。
        const classification = classifyTutorHealthFinding(baselineSide, candidateSide);
        if (classification !== null) findings.push({ identity, classification, baseline: baselineSide, candidate: candidateSide });
      }
    }
  }
  findings.sort((a, b) => {
    const left = tutorHealthComparisonJson(a.identity);
    const right = tutorHealthComparisonJson(b.identity);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const counts = { resolved: 0, persistent: 0, new: 0, unresolved: 0 };
  for (const finding of findings) counts[finding.classification] += 1;
  const comparison: TutorHealthComparison = {
    schemaVersion: TUTOR_HEALTH_COMPARISON_SCHEMA_VERSION,
    kind: TUTOR_HEALTH_COMPARISON_KIND,
    status: counts.unresolved > 0 ? "partially_comparable" : "comparable",
    baseline, candidate, counts, findings,
  };
  assertValidTutorHealthComparison(comparison);
  return structuredClone(comparison);
}

export function formatTutorHealthComparison(comparison: TutorHealthComparison): string {
  assertValidTutorHealthComparison(comparison);
  return [
    `Tutor Health comparison: ${comparison.status}`,
    `Baseline: ${comparison.baseline.evaluation.runId}; candidate: ${comparison.candidate.evaluation.runId}`,
    `Suite: ${comparison.baseline.suite.id}@${comparison.baseline.suite.version}`,
    `Findings (authored identities): resolved ${comparison.counts.resolved}, persistent ${comparison.counts.persistent}, new ${comparison.counts.new}, unresolved ${comparison.counts.unresolved}`,
    ...comparison.findings.slice(0, 20).map((item) => `  ${item.classification}: ${item.identity.scenarioId} / ${item.identity.decisionPointId} / ${item.identity.type}`),
    ...(comparison.findings.length > 20 ? [`  ${comparison.findings.length - 20} further identities in the JSON artifact.`] : []),
    "Presence across repeated runs, not a score delta, release gate, or statistical improvement claim. Partial/missing evidence remains unresolved.",
  ].join("\n");
}

export async function writeTutorHealthComparison(comparison: TutorHealthComparison, outputPath: string): Promise<void> {
  assertValidTutorHealthComparison(comparison);
  await mkdir(dirname(outputPath), { recursive: true });
  // 排他创建保护 source artifact，也避免覆盖上一次比较证据。
  await writeFile(outputPath, `${JSON.stringify(JSON.parse(tutorHealthComparisonJson(comparison)), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}
