import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  assertValidTutorEvalRunResult,
} from "../contracts/tutor-eval-result-validation.js";
import { BenchmarkConfigurationError } from "../contracts/errors.js";
import {
  TUTOR_HEALTH_DIMENSIONS,
  TUTOR_HEALTH_DIMENSION_LABELS,
  DEFAULT_TUTOR_HEALTH_SCORING_PROFILE,
  TUTOR_FINDING_SCHEMA_VERSION,
  TUTOR_HEALTH_REPORT_SCHEMA_VERSION,
  type TutorEvidenceRef,
  type TutorFinding,
  type TutorHealthDimension,
  type TutorHealthReport,
  type TutorHealthScoringProfile,
  type TutorObservation,
  type TutorScenarioSuiteVNext,
} from "../contracts/index.js";
import { assertValidTutorHealthReport, parseTutorHealthScoringProfile } from "../contracts/tutor-health-validation.js";
import { assertValidTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import type {
  TutorCriticalFailure,
  TutorEvalCaseRunResult,
  TutorEvalRubricResult,
  TutorEvalRunResult,
  TutorFindingTemplate,
} from "../contracts/index.js";

interface CriticalFailurePresentation {
  readonly dimension: TutorHealthDimension;
  readonly title: string;
  readonly observedBehavior: string;
  readonly impact: string;
  readonly diagnosticRecommendation: string;
  readonly implementationSuggestion: string;
}

const criticalFailurePresentation: Readonly<
  Record<TutorCriticalFailure, CriticalFailurePresentation>
> = {
  severe_factual_error: {
    dimension: "content_correctness",
    title: "Severe factual error recorded",
    observedBehavior: "TutorEval recorded a severe_factual_error signal for this case.",
    impact: "A severe factual error can make the guidance unreliable for the learner.",
    diagnosticRecommendation: "Inspect the referenced case and response against the task's accepted facts.",
    implementationSuggestion: "Consider strengthening answer verification for the affected content path.",
  },
  misconception_reinforcement: {
    dimension: "learner_diagnosis",
    title: "Misconception reinforcement recorded",
    observedBehavior: "TutorEval recorded a misconception_reinforcement signal for this case.",
    impact: "The interaction may leave the learner more confident in an incorrect idea.",
    diagnosticRecommendation: "Review the cited evaluation record and the misconception evidence for this case.",
    implementationSuggestion: "Consider checking the learner's claim before confirming or extending it.",
  },
  incorrect_diagnosis: {
    dimension: "learner_diagnosis",
    title: "Incorrect learner diagnosis recorded",
    observedBehavior: "TutorEval recorded an incorrect_diagnosis signal for this case.",
    impact: "Support based on an incorrect diagnosis can target the wrong difficulty.",
    diagnosticRecommendation: "Inspect the diagnosis signal alongside the learner's authored reasoning.",
    implementationSuggestion: "Consider asking a discriminating question when multiple misconceptions fit the response.",
  },
  answer_leakage: {
    dimension: "learning_integrity",
    title: "Answer leakage recorded",
    observedBehavior: "TutorEval recorded an answer_leakage signal for this case.",
    impact: "The learner's remaining work may have been completed for them under a restricted disclosure policy.",
    diagnosticRecommendation: "Inspect the referenced response turn against the case's disclosure policy and forbidden-answer evidence.",
    implementationSuggestion: "Consider a policy-aware final-answer guard while preserving cases that explicitly allow disclosure.",
  },
  student_task_takeover: {
    dimension: "learning_integrity",
    title: "Learner task takeover recorded",
    observedBehavior: "TutorEval recorded a student_task_takeover signal for this case.",
    impact: "The response may complete work that the scenario reserves for the learner.",
    diagnosticRecommendation: "Check which steps the tutor performed and which steps the learner was expected to own.",
    implementationSuggestion: "Consider ending the response with a learner-controlled next step when the policy requires participation.",
  },
  critical_misconception_ignored: {
    dimension: "learner_diagnosis",
    title: "Critical misconception was not addressed",
    observedBehavior: "TutorEval recorded a critical_misconception_ignored signal for this case.",
    impact: "The learner may continue using a misconception that blocks the current objective.",
    diagnosticRecommendation: "Inspect the linked case evidence to identify the misconception the evaluator marked as critical.",
    implementationSuggestion: "Consider requiring a targeted response when the current reasoning contains that misconception.",
  },
  instruction_violation: {
    dimension: "reliability_policy",
    title: "Instruction violation recorded",
    observedBehavior: "TutorEval recorded an instruction_violation signal for this case.",
    impact: "The response may not satisfy a versioned task or policy constraint.",
    diagnosticRecommendation: "Compare the response with the applicable case and evaluation instructions.",
    implementationSuggestion: "Consider validating the affected response path against the exact task constraints before release.",
  },
};

interface DimensionAccumulator {
  weightedScore: number;
  totalWeight: number;
  assessedCount: number;
  unresolvedCount: number;
}

function stableReportId(kind: string, parts: readonly (string | number)[]): string {
  const digest = createHash("sha256")
    .update([kind, ...parts].join("\0"))
    .digest("hex")
    .slice(0, 32);
  return `${kind}_${digest}`;
}

function emptyDimensionAccumulators(): Record<TutorHealthDimension, DimensionAccumulator> {
  return {
    content_correctness: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    learner_diagnosis: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    intervention_strategy: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    adaptation: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    learning_integrity: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    interaction_quality: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
    reliability_policy: { weightedScore: 0, totalWeight: 0, assessedCount: 0, unresolvedCount: 0 },
  };
}

function rubricEvidence(
  scenarioId: string,
  caseId: string,
  runIndex: number,
  turnIndex: number,
  result: TutorEvalRubricResult,
  evaluator: "deterministic_evaluator" | "judge",
): TutorEvidenceRef {
  return {
    kind: "rubric_result",
    sourceId: stableReportId("rubric", [caseId, runIndex, result.rubricId]),
    scenarioId,
    caseId,
    runIndex,
    turnIndex,
    rubricId: result.rubricId,
    evaluator,
    result: result.result,
  };
}

function criticalFailureEvidence(
  scenarioId: string,
  caseResult: TutorEvalCaseRunResult,
  failure: TutorEvalCaseRunResult["criticalFailures"][number],
  evaluator: "judge" | "tutor_eval_aggregate",
  turnIndex: number,
): Extract<TutorEvidenceRef, { readonly kind: "critical_failure" }> {
  return {
    kind: "critical_failure",
    sourceId: stableReportId("critical", [caseResult.caseId, caseResult.runIndex, failure.type]),
    scenarioId,
    caseId: caseResult.caseId,
    runIndex: caseResult.runIndex,
    turnIndex,
    evaluator,
    failureType: failure.type,
    severity: failure.severity,
  };
}

function findingFromTemplate(options: {
  readonly runId: string;
  readonly scenarioId: string;
  readonly runIndex: number;
  readonly decisionPointId: string;
  readonly turnIndex: number;
  readonly dimension: TutorHealthDimension;
  readonly expectedBehavior: string;
  readonly template: TutorFindingTemplate;
  readonly evidence: readonly TutorEvidenceRef[];
}): TutorFinding {
  const {
    runId,
    scenarioId,
    runIndex,
    decisionPointId,
    turnIndex,
    dimension,
    expectedBehavior,
    template,
    evidence,
  } = options;
  return {
    schemaVersion: TUTOR_FINDING_SCHEMA_VERSION,
    id: stableReportId("finding", [
      runId,
      scenarioId,
      runIndex,
      decisionPointId,
      template.type,
      evidence[0]?.sourceId ?? "",
    ]),
    type: template.type,
    title: template.title,
    severity: template.severity,
    dimension,
    scenarioId,
    runIndex,
    location: { startTurn: turnIndex, endTurn: turnIndex, decisionPointId },
    observedBehavior: template.observedBehavior,
    evidence,
    expectedBehavior,
    diagnosis: template.diagnosis,
    impact: template.impact,
    likelyCauses: template.likelyCauses.map((cause) => ({
      hypothesis: cause.hypothesis,
      confidence: cause.confidence,
      evidence,
    })),
    recommendations: template.recommendations,
    regressionTargets: template.regressionTargets,
    confidence: template.confidence,
  };
}

function judgeOwnsFailure(
  caseResult: TutorEvalCaseRunResult,
  failure: TutorEvalCaseRunResult["criticalFailures"][number],
): boolean {
  return (
    caseResult.rawJudgeResult?.criticalFailures.some(
      (judgeFailure) =>
        judgeFailure.type === failure.type &&
        judgeFailure.severity === failure.severity &&
        judgeFailure.evidence === failure.evidence,
    ) ?? false
  );
}

function expectedBehaviorForCriticalFailure(
  scenario: TutorScenarioSuiteVNext["scenarios"][number] | undefined,
  caseId: string,
): { scenarioId: string; turnIndex: number; decisionPointId?: string; expectedBehavior: string } {
  const decisionPoint = scenario?.decisionPoints.find(
    (candidate) => candidate.evaluationCaseId === caseId,
  );
  return {
    scenarioId: scenario?.identity.id ?? caseId,
    turnIndex: decisionPoint?.turnIndex ?? 1,
    ...(decisionPoint === undefined ? {} : { decisionPointId: decisionPoint.id }),
    expectedBehavior:
      decisionPoint?.expectedBehavior ??
      "Follow the case's versioned task and disclosure policy.",
  };
}

function moreSevere(
  left: TutorFinding["severity"],
  right: TutorFinding["severity"],
): TutorFinding["severity"] {
  const rank = { info: 0, minor: 1, major: 2, critical: 3 } as const;
  return rank[left] >= rank[right] ? left : right;
}

function mapCriticalFailureToFinding(
  evaluation: TutorEvalRunResult,
  caseResult: TutorEvalCaseRunResult,
  scenario: TutorScenarioSuiteVNext["scenarios"][number] | undefined,
  failure: TutorEvalCaseRunResult["criticalFailures"][number],
): TutorFinding {
  const owner = judgeOwnsFailure(caseResult, failure) ? "judge" : "tutor_eval_aggregate";
  const presentation = criticalFailurePresentation[failure.type];
  const location = expectedBehaviorForCriticalFailure(scenario, caseResult.caseId);
  const evidence = [criticalFailureEvidence(location.scenarioId, caseResult, failure, owner, location.turnIndex)];
  return {
    schemaVersion: TUTOR_FINDING_SCHEMA_VERSION,
    id: stableReportId("finding", [
      evaluation.runId,
      location.scenarioId,
      caseResult.runIndex,
      failure.type,
      caseResult.caseId,
    ]),
    type: failure.type,
    title: presentation.title,
    severity: failure.severity,
    dimension: presentation.dimension,
    scenarioId: location.scenarioId,
    runIndex: caseResult.runIndex,
    location: {
      startTurn: location.turnIndex,
      endTurn: location.turnIndex,
      ...(location.decisionPointId === undefined ? {} : { decisionPointId: location.decisionPointId }),
    },
    observedBehavior: presentation.observedBehavior,
    evidence,
    expectedBehavior: location.expectedBehavior,
    diagnosis: "This finding adapts an existing TutorEval critical-failure record; it does not add a causal claim or reinterpret the historical evaluator.",
    impact: presentation.impact,
    likelyCauses: [],
    recommendations: [
      { kind: "diagnostic", text: presentation.diagnosticRecommendation },
      { kind: "implementation_suggestion", text: presentation.implementationSuggestion },
    ],
    regressionTargets: [`${location.scenarioId}/${location.decisionPointId ?? "critical-failure"}`],
    confidence: 0.75,
  };
}

function mergeCriticalEvidence(
  findings: TutorFinding[],
  criticalFinding: TutorFinding,
): void {
  const matchingIndex = findings.findIndex(
    (finding) =>
      finding.scenarioId === criticalFinding.scenarioId &&
      finding.runIndex === criticalFinding.runIndex &&
      finding.type === criticalFinding.type,
  );
  if (matchingIndex === -1) {
    findings.push(criticalFinding);
    return;
  }
  const current = findings[matchingIndex]!;
  const evidence = [
    ...current.evidence,
    ...criticalFinding.evidence.filter(
      (ref) => !current.evidence.some((candidate) => candidate.sourceId === ref.sourceId),
    ),
  ].slice(0, 16);
  findings[matchingIndex] = {
    ...current,
    severity: moreSevere(current.severity, criticalFinding.severity),
    evidence,
    confidence: Math.max(current.confidence, criticalFinding.confidence),
  };
}

function scenarioByEvaluationCaseId(
  suite: TutorScenarioSuiteVNext,
): Map<string, {
  scenario: TutorScenarioSuiteVNext["scenarios"][number];
  decisionPoint: TutorScenarioSuiteVNext["scenarios"][number]["decisionPoints"][number];
  caseVersion: string;
}> {
  const index = new Map<string, {
    scenario: TutorScenarioSuiteVNext["scenarios"][number];
    decisionPoint: TutorScenarioSuiteVNext["scenarios"][number]["decisionPoints"][number];
    caseVersion: string;
  }>();
  for (const scenario of suite.scenarios) {
    for (const decisionPoint of scenario.decisionPoints) {
      index.set(decisionPoint.evaluationCaseId, {
        scenario,
        decisionPoint,
        caseVersion: `${scenario.identity.version}:${decisionPoint.id}`,
      });
    }
  }
  return index;
}

function findCaseRun(
  evaluation: TutorEvalRunResult,
  caseId: string,
  runIndex: number,
): TutorEvalCaseRunResult[] {
  return evaluation.caseResults.filter(
    (result) => result.caseId === caseId && result.runIndex === runIndex,
  );
}

function unresolvedItem(
  scenarioId: string,
  decisionPointId: string,
  runIndex: number,
  reason: TutorHealthReport["unresolved"][number]["reason"],
  rubricId?: string,
): TutorHealthReport["unresolved"][number] {
  return {
    scenarioId,
    decisionPointId,
    runIndex,
    reason,
    ...(rubricId === undefined ? {} : { rubricId }),
  };
}

function recordUnresolved(
  accumulator: DimensionAccumulator,
  unresolved: TutorHealthReport["unresolved"][number][],
  item: TutorHealthReport["unresolved"][number],
): void {
  accumulator.unresolvedCount += 1;
  unresolved.push(item);
}

function profileWeightedHealthScore(
  dimensions: TutorHealthReport["dimensionScores"],
  profile: TutorHealthScoringProfile,
): number | null {
  let weightedScore = 0;
  let totalWeight = 0;
  for (const dimension of TUTOR_HEALTH_DIMENSIONS) {
    const score = dimensions[dimension].score;
    const weight = profile.dimensionWeights[dimension];
    if (score !== null && weight > 0) {
      weightedScore += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight === 0 ? null : Math.round(weightedScore / totalWeight);
}

function buildTutorHealthCoverage(
  suite: TutorScenarioSuiteVNext,
  evaluation: TutorEvalRunResult,
  dimensions: TutorHealthReport["dimensionScores"],
  profile: TutorHealthScoringProfile,
): TutorHealthReport["coverage"] {
  const profileDimensions = TUTOR_HEALTH_DIMENSIONS.filter(
    (dimension) => profile.dimensionWeights[dimension] > 0,
  );
  const scoredDimensions = profileDimensions.filter(
    (dimension) => dimensions[dimension].score !== null,
  );
  const totalProfileWeight = profileDimensions.reduce(
    (total, dimension) => total + profile.dimensionWeights[dimension],
    0,
  );
  const scoredProfileWeight = scoredDimensions.reduce(
    (total, dimension) => total + profile.dimensionWeights[dimension],
    0,
  );
  const decisionPointCount = suite.scenarios.reduce(
    (total, scenario) => total + scenario.decisionPoints.length,
    0,
  );
  const expectedCaseRunCount = decisionPointCount * evaluation.runsPerCase;
  const presentCaseRunCount = evaluation.caseResults.length;
  const profileWeightRatio = scoredProfileWeight / totalProfileWeight;
  const caseRunRatio = presentCaseRunCount / expectedCaseRunCount;
  const status =
    profileWeightRatio === 1 && caseRunRatio === 1
      ? "complete"
      : scoredProfileWeight > 0 && presentCaseRunCount > 0
        ? "partial"
        : "none";

  return {
    assessedDimensionCount: scoredDimensions.length,
    totalProfileDimensionCount: profileDimensions.length,
    scoredProfileWeight,
    totalProfileWeight,
    profileWeightRatio,
    status,
    evaluationScope: {
      kind: "scenario_suite",
      suiteId: suite.id,
      suiteVersion: suite.version,
      scenarioCount: suite.scenarios.length,
      decisionPointCount,
      runsPerCase: evaluation.runsPerCase,
      expectedCaseRunCount,
      presentCaseRunCount,
      caseRunRatio,
    },
  };
}

/** Builds a finding-first view from authored checkpoints and existing TutorEval evidence. */
export function buildTutorHealthReport(options: {
  readonly suite: TutorScenarioSuiteVNext;
  readonly evaluation: TutorEvalRunResult;
  readonly scoringProfile?: TutorHealthScoringProfile;
}): TutorHealthReport {
  assertValidTutorScenarioSuiteVNext(options.suite);
  assertValidTutorEvalRunResult(options.evaluation);
  const profile = parseTutorHealthScoringProfile(
    options.scoringProfile ?? DEFAULT_TUTOR_HEALTH_SCORING_PROFILE,
  );
  const caseIndex = scenarioByEvaluationCaseId(options.suite);
  if (
    options.evaluation.datasetId !== options.suite.id ||
    options.evaluation.datasetVersion !== options.suite.version ||
    options.evaluation.caseResults.some((caseResult) => {
      const expected = caseIndex.get(caseResult.caseId);
      return expected === undefined || expected.caseVersion !== caseResult.caseVersion;
    })
  ) {
    throw new BenchmarkConfigurationError("tutor_health_report_source_mismatch");
  }
  const dimensionAccumulators = emptyDimensionAccumulators();
  const observations: TutorObservation[] = [];
  const findings: TutorFinding[] = [];
  const unresolved: TutorHealthReport["unresolved"][number][] = [];
  const seenCaseRuns = new Set<string>();

  for (const caseResult of options.evaluation.caseResults) {
    const key = `${caseResult.caseId}#${caseResult.runIndex}`;
    if (seenCaseRuns.has(key)) {
      throw new BenchmarkConfigurationError("tutor_health_report_case_run_duplicate");
    }
    seenCaseRuns.add(key);
  }

  for (const scenario of options.suite.scenarios) {
    for (const decisionPoint of scenario.decisionPoints) {
      for (let runIndex = 1; runIndex <= options.evaluation.runsPerCase; runIndex += 1) {
        const caseRuns = findCaseRun(
          options.evaluation,
          decisionPoint.evaluationCaseId,
          runIndex,
        );
        if (caseRuns.length === 0) {
          for (const criterion of decisionPoint.evaluationCriteria) {
            recordUnresolved(
              dimensionAccumulators[criterion.dimension],
              unresolved,
              unresolvedItem(
                scenario.identity.id,
                decisionPoint.id,
                runIndex,
                "missing_case_result",
                criterion.rubricId,
              ),
            );
          }
          continue;
        }
        if (caseRuns.length > 1) {
          for (const criterion of decisionPoint.evaluationCriteria) {
            recordUnresolved(
              dimensionAccumulators[criterion.dimension],
              unresolved,
              unresolvedItem(
                scenario.identity.id,
                decisionPoint.id,
                runIndex,
                "duplicate_rubric_result",
                criterion.rubricId,
              ),
            );
          }
          continue;
        }
        const caseResult = caseRuns[0]!;

        for (const criterion of decisionPoint.evaluationCriteria) {
          const results = caseResult.rubricResults.filter(
            (candidate) => candidate.rubricId === criterion.rubricId,
          );
          if (results.length !== 1) {
            recordUnresolved(
              dimensionAccumulators[criterion.dimension],
              unresolved,
              unresolvedItem(
                scenario.identity.id,
                decisionPoint.id,
                runIndex,
                results.length === 0 ? "missing_rubric_result" : "duplicate_rubric_result",
                criterion.rubricId,
              ),
            );
            continue;
          }
          const rubricResult = results[0]!;
          const owner =
            criterion.evaluationType === "deterministic"
              ? "deterministic_evaluator"
              : "judge";
          const evidence = rubricEvidence(
            scenario.identity.id,
            caseResult.caseId,
            caseResult.runIndex,
            decisionPoint.turnIndex,
            rubricResult,
            owner,
          );
          observations.push({
            schemaVersion: 1,
            id: stableReportId("observation", [
              options.evaluation.runId,
              scenario.identity.id,
              runIndex,
              decisionPoint.id,
              criterion.rubricId,
            ]),
            type: "rubric_result",
            scenarioId: scenario.identity.id,
            runIndex,
            turnIndex: decisionPoint.turnIndex,
            evaluatorOwner: owner,
            result: rubricResult.result,
            evidence: [evidence],
          });

          const accumulator = dimensionAccumulators[criterion.dimension];
          if (rubricResult.result === "ERROR" || rubricResult.score === null) {
            recordUnresolved(
              accumulator,
              unresolved,
              unresolvedItem(
                scenario.identity.id,
                decisionPoint.id,
                runIndex,
                "evaluation_error",
                criterion.rubricId,
              ),
            );
            continue;
          }
          accumulator.assessedCount += 1;
          accumulator.weightedScore += rubricResult.score * rubricResult.weight;
          accumulator.totalWeight += rubricResult.weight;
          if (rubricResult.result === "FAIL") {
            findings.push(
              findingFromTemplate({
                runId: options.evaluation.runId,
                scenarioId: scenario.identity.id,
                runIndex,
                decisionPointId: decisionPoint.id,
                turnIndex: decisionPoint.turnIndex,
                dimension: criterion.dimension,
                expectedBehavior: decisionPoint.expectedBehavior,
                template: criterion.failureFinding,
                evidence: [evidence],
              }),
            );
          }
        }

      }
    }
  }

  for (const caseResult of options.evaluation.caseResults) {
    const scenarioContext = caseIndex.get(caseResult.caseId)?.scenario;
    for (const failure of caseResult.criticalFailures) {
      const failureLocation = expectedBehaviorForCriticalFailure(
        scenarioContext,
        caseResult.caseId,
      );
      const evidence = criticalFailureEvidence(
        failureLocation.scenarioId,
        caseResult,
        failure,
        judgeOwnsFailure(caseResult, failure) ? "judge" : "tutor_eval_aggregate",
        failureLocation.turnIndex,
      );
      observations.push({
        schemaVersion: 1,
        id: stableReportId("observation", [
          options.evaluation.runId,
          failureLocation.scenarioId,
          caseResult.runIndex,
          "critical",
          failure.type,
        ]),
        type: "critical_failure",
        scenarioId: failureLocation.scenarioId,
        runIndex: caseResult.runIndex,
        turnIndex: failureLocation.turnIndex,
        evaluatorOwner: evidence.evaluator,
        evidence: [evidence],
      });
      mergeCriticalEvidence(
        findings,
        mapCriticalFailureToFinding(
          options.evaluation,
          caseResult,
          scenarioContext,
          failure,
        ),
      );
    }
  }

  const dimensionScores = Object.fromEntries(
    TUTOR_HEALTH_DIMENSIONS.map((dimension) => {
      const accumulator = dimensionAccumulators[dimension];
      return [
        dimension,
        {
          score:
            accumulator.totalWeight === 0
              ? null
              : Math.round(accumulator.weightedScore / accumulator.totalWeight * 100),
          assessedCount: accumulator.assessedCount,
          unresolvedCount: accumulator.unresolvedCount,
        },
      ];
    }),
  ) as TutorHealthReport["dimensionScores"];
  findings.sort((left, right) => {
    const severityRank = { info: 0, minor: 1, major: 2, critical: 3 } as const;
    return (
      severityRank[right.severity] - severityRank[left.severity] ||
      right.confidence - left.confidence ||
      left.id.localeCompare(right.id)
    );
  });
  observations.sort((left, right) => left.id.localeCompare(right.id));
  unresolved.sort(
    (left, right) =>
      left.scenarioId.localeCompare(right.scenarioId) ||
      left.decisionPointId.localeCompare(right.decisionPointId) ||
      left.runIndex - right.runIndex ||
      left.reason.localeCompare(right.reason) ||
      (left.rubricId ?? "").localeCompare(right.rubricId ?? ""),
  );
  const findingCounts = { info: 0, minor: 0, major: 0, critical: 0 };
  for (const finding of findings) {
    findingCounts[finding.severity] += 1;
  }
  const knownGateFailure =
    findings.some((finding) => finding.severity === "critical") ||
    options.evaluation.caseResults.some(
      (result) => result.status !== "error" && result.qualityGate === "FAIL",
    );
  const hasUnresolvedEvaluation =
    unresolved.length > 0 || options.evaluation.errorCount > 0;
  const releaseGate = knownGateFailure
    ? "FAIL"
    : hasUnresolvedEvaluation
      ? "UNRESOLVED"
      : "PASS";
  const coverage = buildTutorHealthCoverage(
    options.suite,
    options.evaluation,
    dimensionScores,
    profile,
  );
  const report: TutorHealthReport = {
    schemaVersion: TUTOR_HEALTH_REPORT_SCHEMA_VERSION,
    sourceScenarioSuite: {
      id: options.suite.id,
      version: options.suite.version,
      healthTaxonomyVersion: options.suite.healthTaxonomyVersion,
    },
    sourceEvaluation: {
      runId: options.evaluation.runId,
      datasetId: options.evaluation.datasetId,
      datasetVersion: options.evaluation.datasetVersion,
      ...(options.evaluation.evaluatorVersion === undefined
        ? {}
        : { evaluatorVersion: options.evaluation.evaluatorVersion }),
    },
    scoringProfile: profile,
    coverage,
    healthScore: profileWeightedHealthScore(dimensionScores, profile),
    releaseGate,
    findingCounts,
    dimensionScores,
    observations,
    findings,
    unresolved,
  };
  assertValidTutorHealthReport(report);
  return report;
}

function formatEvidence(reference: TutorEvidenceRef): string {
  switch (reference.kind) {
    case "trajectory_turn":
      return `${reference.scenarioId} turn ${reference.turnIndex}`;
    case "rubric_result":
      return `${reference.caseId} run ${reference.runIndex}, ${reference.evaluator}, rubric ${reference.rubricId}=${reference.result}`;
    case "critical_failure":
      return `${reference.caseId} run ${reference.runIndex}, ${reference.evaluator}, ${reference.failureType} (${reference.severity})`;
    case "human_evidence":
      return `${reference.owner} reference ${reference.sourceId}`;
  }
}

function rankDimensions(
  scores: TutorHealthReport["dimensionScores"],
): readonly (readonly [TutorHealthDimension, number])[] {
  const ranked: [TutorHealthDimension, number][] = [];
  for (const dimension of TUTOR_HEALTH_DIMENSIONS) {
    const score = scores[dimension].score;
    if (score !== null) {
      ranked.push([dimension, score]);
    }
  }
  return ranked.sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
}

export function formatTutorHealthReport(
  report: TutorHealthReport,
  options: { readonly maxFindings?: number } = {},
): string {
  assertValidTutorHealthReport(report);
  const maxFindings = Math.min(50, Math.max(0, options.maxFindings ?? 5));
  const rankedDimensions = rankDimensions(report.dimensionScores);
  const strongest = rankedDimensions.slice(0, 2);
  const needsAttention = [...rankedDimensions].reverse().slice(0, 2);
  const findingDetails = report.findings.slice(0, maxFindings).flatMap((finding, index) => {
    const diagnostic = finding.recommendations
      .filter((recommendation) => recommendation.kind === "diagnostic")
      .map((recommendation) => `  RECOMMENDED CHANGE: ${recommendation.text}`);
    const implementation = finding.recommendations
      .filter((recommendation) => recommendation.kind === "implementation_suggestion")
      .map((recommendation) => `  IMPLEMENTATION SUGGESTION: ${recommendation.text}`);
    return [
      `${index + 1}. ${finding.title} [${finding.severity.toUpperCase()}]`,
      `  WHAT HAPPENED: ${finding.observedBehavior}`,
      `  WHERE: ${finding.scenarioId}, turn ${finding.location.startTurn}${finding.location.decisionPointId === undefined ? "" : ` (${finding.location.decisionPointId})`}`,
      `  EVIDENCE: ${finding.evidence.map(formatEvidence).join("; ")}`,
      `  EXPECTED BEHAVIOR: ${finding.expectedBehavior}`,
      `  IMPACT: ${finding.impact}`,
      ...(finding.likelyCauses.length === 0
        ? ["  LIKELY CAUSES: No causal hypothesis was added."]
        : [
            "  LIKELY CAUSES:",
            ...finding.likelyCauses.map(
              (cause) => `    Hypothesis (${Math.round(cause.confidence * 100)}% evidence strength): ${cause.hypothesis}`,
            ),
          ]),
      ...diagnostic,
      ...implementation,
      `  WHAT TO RETEST: ${finding.regressionTargets.join(", ")}`,
      `  CONFIDENCE: ${Math.round(finding.confidence * 100)}% uncalibrated evidence strength`,
    ];
  });
  const coverage = report.coverage;
  const profileCoverage = `${coverage.assessedDimensionCount}/${coverage.totalProfileDimensionCount} dimensions; weight ${coverage.scoredProfileWeight}/${coverage.totalProfileWeight} (${Math.round(coverage.profileWeightRatio * 100)}%)`;
  const scope = coverage.evaluationScope;
  return [
    `Tutor Health Score: ${report.healthScore === null ? "n/a" : `${report.healthScore}/100`} — ${coverage.status.toUpperCase()} COVERAGE (scored dimensions only: ${profileCoverage})`,
    `Evaluation scope: ${scope.suiteId}@${scope.suiteVersion}; ${scope.scenarioCount} scenarios, ${scope.decisionPointCount} decision points; ${scope.presentCaseRunCount}/${scope.expectedCaseRunCount} case-runs (${Math.round(scope.caseRunRatio * 100)}%)`,
    `Release Gate: ${report.releaseGate}`,
    `Findings: critical ${report.findingCounts.critical}, major ${report.findingCounts.major}, minor ${report.findingCounts.minor}, info ${report.findingCounts.info}`,
    `Scoring profile: ${report.scoringProfile.id}@${report.scoringProfile.version}`,
    `Unresolved decision points: ${report.unresolved.length}`,
    "",
    "Strongest dimensions:",
    ...(strongest.length === 0
      ? ["  No scored evidence"]
      : strongest.map(
          ([dimension, score]) => `  ${TUTOR_HEALTH_DIMENSION_LABELS[dimension]} ${score}`,
        )),
    "Needs attention (relative within this run):",
    ...(needsAttention.length === 0
      ? ["  No scored evidence"]
      : needsAttention.map(
          ([dimension, score]) => `  ${TUTOR_HEALTH_DIMENSION_LABELS[dimension]} ${score}`,
        )),
    "",
    `Top findings (${Math.min(report.findings.length, maxFindings)} of ${report.findings.length}):`,
    ...(findingDetails.length === 0 ? ["  None"] : findingDetails),
  ].join("\n");
}

export async function writeTutorHealthReport(
  report: TutorHealthReport,
  outputPath: string,
): Promise<void> {
  assertValidTutorHealthReport(report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
