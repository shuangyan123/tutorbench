import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BenchmarkConfigurationError,
  DEFAULT_TUTOR_HEALTH_SCORING_PROFILE,
  assertValidTutorEvalRunResult,
  parseTutorEvalCase,
  parseTutorFinding,
  parseTutorHealthReport,
  parseTutorScenarioSuiteVNext,
  toTutorTurnInput,
  type TutorEvalJudgeInput,
  type TutorEvalRunResult,
} from "../src/contracts/index.js";
import {
  loadTutorScenarioSuiteVNext,
  tutorScenarioSuiteToTutorEvalDataset,
} from "../src/datasets/real-world.js";
import {
  buildTutorHealthReport,
  formatTutorHealthReport,
} from "../src/reporting/tutor-health-reporters.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";

const constantTutorResponse = "Let's look at one small next step together.";

function fixtureTutor(text = constantTutorResponse) {
  return {
    id: "finding-first-fixture-tutor",
    respond: async () => ({ text }),
  };
}

function fixtureJudge(
  decide: (input: TutorEvalJudgeInput) => {
    readonly result?: "PASS" | "PARTIAL" | "FAIL";
    readonly results?: Readonly<Record<string, "PASS" | "PARTIAL" | "FAIL">>;
    readonly criticalFailures?: readonly {
      readonly type: "answer_leakage";
      readonly severity: "critical";
      readonly evidence: string;
    }[];
    readonly error?: boolean;
  },
) {
  return {
    provider: "synthetic-test",
    model: "authored-fixture",
    promptVersion: "test-1",
    evaluate: async (input: TutorEvalJudgeInput) => {
      const decision = decide(input);
      if (decision.error) {
        throw new Error("synthetic_judge_error");
      }
      return {
        schemaVersion: 1,
        caseId: input.caseId,
        rubricResults: input.rubrics.map((rubric) => ({
          rubricId: rubric.id,
          result: decision.results?.[rubric.id] ?? decision.result ?? "PASS",
        })),
        criticalFailures: decision.criticalFailures ?? [],
        factualErrors: [],
        insufficientInformation: false,
      };
    },
  };
}

function resultFor(result: TutorEvalRunResult, caseId: string) {
  const caseResult = result.caseResults.find((candidate) => candidate.caseId === caseId);
  assert.ok(caseResult, `missing case ${caseId}`);
  return caseResult;
}

function assertErrorCode(action: () => unknown, expectedCode: string): void {
  assert.throws(action, (error: unknown) =>
    error instanceof BenchmarkConfigurationError && error.code === expectedCode,
  );
}

test("the vNext suite validates and compiles into the existing TutorEval runner contract", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  assert.equal(suite.id, "productive-struggle-intervention-v0.1");
  assert.equal(suite.scenarios.length, 13);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(dataset.id, suite.id);
  assert.equal(dataset.version, suite.version);
  assert.equal(dataset.cases.length, 13);

  const misconceptionScenario = suite.scenarios.find(
    (scenario) => scenario.identity.id === "ps-same-misconception",
  );
  assert.ok(misconceptionScenario);
  const caseValue = dataset.cases.find(
    (candidate) => candidate.id === "ps-same-misconception",
  );
  assert.ok(caseValue);
  const tutorInput = toTutorTurnInput(caseValue);
  assert.deepEqual(tutorInput.studentState.misconceptions, []);
  assert.match(caseValue.evaluatorOnly.knownMisconception ?? "", /denominator/);
  assert.equal(tutorInput.currentStudentMessage, "It counts the pieces, so eight pieces must make a larger fraction.");
});

test("authored algebra errors are visible and evaluator misconceptions cite those learner turns", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const first = suite.scenarios.find((scenario) => scenario.identity.id === "ps-first-mistake");
  const repeated = suite.scenarios.find((scenario) => scenario.identity.id === "ps-repeated-mistake");
  assert.ok(first);
  assert.ok(repeated);

  const firstLearnerText = first.trajectory.conversationHistory[0]?.content ?? "";
  assert.match(firstLearnerText, /only the left side/);
  assert.match(firstLearnerText, /x = 14/);
  assert.doesNotMatch(firstLearnerText, /not sure what to do next|can you help/i);
  assert.deepEqual(
    first.evaluatorReferenceState.misconceptions[0]?.evidenceLearnerTurns,
    [1],
  );

  const repeatedLearnerTurns = repeated.trajectory.conversationHistory
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  assert.equal(repeatedLearnerTurns.length, 2);
  assert.ok(repeatedLearnerTurns.every((turn) => /only the left side|left 14 unchanged/.test(turn)));
  assert.match(repeatedLearnerTurns[1] ?? "", /x = 14/);
  assert.deepEqual(
    repeated.evaluatorReferenceState.misconceptions[0]?.evidenceLearnerTurns,
    [1, 2],
  );

  for (const scenarioId of ["ps-first-mistake", "ps-repeated-mistake"]) {
    const scenario = suite.scenarios.find((candidate) => candidate.identity.id === scenarioId);
    const caseValue = dataset.cases.find((candidate) => candidate.id === scenarioId);
    assert.ok(scenario);
    assert.ok(caseValue);
    const tutorInput = toTutorTurnInput(caseValue);
    assert.deepEqual(tutorInput.studentState.misconceptions, []);
    assert.doesNotMatch(JSON.stringify(tutorInput), /one side of an equation/);
    assert.match(caseValue.evaluatorOnly.knownMisconception ?? "", /supported by authored learner turns? 1/);
  }
});

test("square-root escalation is constrained to the unique nonnegative solution", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const scenario = suite.scenarios.find(
    (candidate) => candidate.identity.id === "ps-multiturn-hint-escalation",
  );
  assert.ok(scenario);
  assert.match(scenario.learningContext.learningObjective, /x² = 9.*x ≥ 0.*x = 3/);
  assert.match(
    scenario.trajectory.conversationHistory[0]?.content ?? "",
    /x² = 9 with x ≥ 0/,
  );
});

test("authored Tutor-visible learner model crosses the Tutor boundary while reference truth does not", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const authored = structuredClone(suite) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      tutorVisibleContext: { learnerModel?: { memorySummary?: string; confidence?: number } };
    }>;
  };
  const first = authored.scenarios.find((scenario) => scenario.identity.id === "ps-first-mistake");
  assert.ok(first);
  first.tutorVisibleContext.learnerModel = {
    memorySummary: "Learner prefers a worked visual balance model.",
    confidence: 0.7,
  };
  const visibleSuite = parseTutorScenarioSuiteVNext(authored);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(visibleSuite);
  const caseValue = dataset.cases.find((candidate) => candidate.id === "ps-first-mistake");
  assert.ok(caseValue);
  const tutorInput = toTutorTurnInput(caseValue);
  assert.deepEqual(tutorInput.studentState.learnerModel, first.tutorVisibleContext.learnerModel);
  assert.doesNotMatch(JSON.stringify(tutorInput), /applies an operation to only one side/);
  assert.match(caseValue.evaluatorOnly.knownMisconception ?? "", /applies an operation to only one side/);

  const missingEvidence = structuredClone(suite) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      evaluatorReferenceState: { misconceptions: Array<{ evidenceLearnerTurns: number[] }> };
    }>;
  };
  const referencedScenario = missingEvidence.scenarios.find(
    (scenario) => scenario.identity.id === "ps-first-mistake",
  );
  assert.ok(referencedScenario);
  referencedScenario.evaluatorReferenceState.misconceptions[0]!.evidenceLearnerTurns = [2];
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(missingEvidence),
    "tutor_scenario_vnext_invalid",
  );
  referencedScenario.evaluatorReferenceState.misconceptions[0]!.evidenceLearnerTurns = [];
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(missingEvidence),
    "tutor_scenario_vnext_invalid",
  );
});

test("vNext validation rejects impossible reference-state and intervention-policy combinations", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const failedAttemptOverflow = structuredClone(suite) as unknown as {
    scenarios: Array<{ trajectory: { attemptCount: number; failedAttempts: number } }>;
  };
  failedAttemptOverflow.scenarios[0]!.trajectory.failedAttempts = 2;
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(failedAttemptOverflow),
    "tutor_scenario_vnext_invalid",
  );

  const conflictingHintThreshold = structuredClone(suite) as unknown as {
    scenarios: Array<{
      teachingPolicy: {
        intervention: { firstHintAfterFailedAttempts: number };
        productiveStruggle: { minimumMeaningfulAttempts: number };
      };
    }>;
  };
  conflictingHintThreshold.scenarios[0]!.teachingPolicy.intervention.firstHintAfterFailedAttempts = 1;
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(conflictingHintThreshold),
    "tutor_scenario_vnext_invalid",
  );

  const missingMasteryPolicy = structuredClone(suite) as unknown as {
    scenarios: Array<{
      teachingPolicy: { mastery?: { independentSuccessesToConfirm: number } };
      evaluatorReferenceState: { masteryState?: string };
    }>;
  };
  const nearMastery = missingMasteryPolicy.scenarios.find(
    (scenario) => scenario.evaluatorReferenceState.masteryState === "near_mastery",
  );
  assert.ok(nearMastery);
  delete nearMastery.teachingPolicy.mastery;
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(missingMasteryPolicy),
    "tutor_scenario_vnext_invalid",
  );
});

test("the same tutor response is interpreted against different authored learner states", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "same-action", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      result:
        input.caseId === "ps-first-mistake"
          ? "FAIL"
          : "PASS",
    })),
    runId: "contextual-action-test",
  });

  assert.deepEqual(report.sourceScenarioSuite, {
    id: suite.id,
    version: suite.version,
    healthTaxonomyVersion: suite.healthTaxonomyVersion,
  });
  assert.equal(
    resultFor(evaluation, "ps-first-mistake").rawTutorResponse,
    resultFor(evaluation, "ps-repeated-mistake").rawTutorResponse,
  );
  assert.equal(resultFor(evaluation, "ps-first-mistake").rubricResults[0]?.result, "FAIL");
  assert.equal(resultFor(evaluation, "ps-repeated-mistake").rubricResults[0]?.result, "PASS");
  assert.ok(report.findings.some((finding) => finding.type === "premature_intervention"));
  assert.ok(
    !report.findings.some(
      (finding) =>
        finding.scenarioId === "ps-repeated-mistake" &&
        finding.type === "missed_repeated_misconception",
    ),
  );
  assert.equal(
    resultFor(evaluation, "ps-underhelping").rubricResults[0]?.result,
    "PASS",
  );
  assert.ok(
    !report.findings.some(
      (finding) => finding.type === "underhelping_after_repeated_failure",
    ),
  );
});

test("premature intervention and non-escalating repeated hints become evidence-linked findings", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "timing-test", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      result:
        input.caseId === "ps-first-mistake" ||
        input.caseId === "ps-multiturn-hint-escalation"
          ? "FAIL"
          : "PASS",
    })),
    runId: "intervention-findings-test",
  });

  const early = report.findings.find((finding) => finding.type === "premature_intervention");
  assert.ok(early);
  assert.equal(early.location.startTurn, 1);
  const earlyEvidence = early.evidence[0];
  assert.ok(earlyEvidence?.kind === "rubric_result");
  assert.equal(earlyEvidence.evaluator, "judge");

  const late = report.findings.find((finding) => finding.type === "late_hint_escalation");
  assert.ok(late);
  assert.equal(late.location.startTurn, 3);
  assert.match(late.observedBehavior, /repeats a prior low-specificity hint/);
  assert.ok(late.recommendations.some((recommendation) => recommendation.kind === "diagnostic"));
  assert.ok(
    late.recommendations.some(
      (recommendation) => recommendation.kind === "implementation_suggestion",
    ),
  );
});

test("critical answer leakage fails the release gate despite a high health score", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const privateJudgeEvidence = "PRIVATE_JUDGE_RATIONALE_SENTINEL";
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor("The value is four; use that result to finish."),
    tutorDescriptor: { provider: "synthetic", model: "critical-test", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      result: "PASS",
      ...(input.caseId === "ps-overhelping-answer-leak"
        ? { results: { "ps-overhelping-scope": "FAIL" } }
        : {}),
      ...(input.caseId === "ps-overhelping-answer-leak"
        ? {
            criticalFailures: [
              {
                type: "answer_leakage",
                severity: "critical",
                evidence: `The response states the answer in words. ${privateJudgeEvidence}`,
              },
            ],
          }
        : {}),
    })),
    runId: "critical-gate-test",
  });

  assert.equal(
    resultFor(evaluation, "ps-overhelping-answer-leak").rubricResults.find(
      (rubric) => rubric.rubricId === "ps-overhelping-answer-leak-deterministic",
    )?.result,
    "PASS",
  );
  assert.ok(report.healthScore !== null && report.healthScore >= 90);
  assert.equal(report.releaseGate, "FAIL");
  const finding = report.findings.find((candidate) => candidate.type === "answer_leakage");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.equal(finding.dimension, "learning_integrity");
  assertErrorCode(
    () => parseTutorHealthReport({ ...report, releaseGate: "PASS" }),
    "tutor_health_report_invalid",
  );
  const criticalEvidence = finding.evidence[0];
  assert.ok(criticalEvidence?.kind === "critical_failure");
  assert.equal(criticalEvidence.evaluator, "judge");
  assert.ok(
    report.observations.some(
      (observation) =>
        observation.evaluatorOwner === "deterministic_evaluator" &&
        observation.evidence.some(
          (reference) =>
            reference.kind === "rubric_result" &&
            reference.rubricId === "ps-overhelping-answer-leak-deterministic",
        ),
    ),
  );
  assert.doesNotMatch(JSON.stringify(report), new RegExp(privateJudgeEvidence));
  assert.doesNotMatch(formatTutorHealthReport(report), new RegExp(privateJudgeEvidence));
});

test("Tutor Health reports scored dimensions and incomplete suite runs beside its summary score", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "coverage-test", promptVersion: "1" },
    judge: fixtureJudge(() => ({ result: "PASS" })),
    runId: "full-coverage-test",
  });

  assert.equal(report.scoringProfile.id, "productive-struggle-intervention");
  assert.equal(report.scoringProfile.version, "0.1.0");
  assert.equal(report.dimensionScores.content_correctness.score, null);
  assert.equal(report.dimensionScores.reliability_policy.score, null);
  assert.equal(report.coverage.assessedDimensionCount, 5);
  assert.equal(report.coverage.totalProfileDimensionCount, 7);
  assert.equal(report.coverage.scoredProfileWeight, 5);
  assert.equal(report.coverage.totalProfileWeight, 7);
  assert.equal(report.coverage.profileWeightRatio, 5 / 7);
  assert.equal(report.coverage.status, "partial");
  assert.deepEqual(report.coverage.evaluationScope, {
    kind: "scenario_suite",
    suiteId: suite.id,
    suiteVersion: suite.version,
    scenarioCount: 13,
    decisionPointCount: 13,
    runsPerCase: 1,
    expectedCaseRunCount: 13,
    presentCaseRunCount: 13,
    caseRunRatio: 1,
  });
  const fullText = formatTutorHealthReport(report);
  assert.match(fullText, /Tutor Health Score: .*PARTIAL COVERAGE \(scored dimensions only: 5\/7 dimensions; weight 5\/7 \(71%\)\)/);
  assert.match(fullText, /productive-struggle-intervention-v0\.1@0\.2\.0; 13 scenarios.*13\/13 case-runs/);
  assertErrorCode(
    () => parseTutorHealthReport({ ...report, coverage: { ...report.coverage, status: "complete" } }),
    "tutor_health_report_invalid",
  );
  const coreTutorReport = buildTutorHealthReport({
    suite,
    evaluation,
    scoringProfile: { ...DEFAULT_TUTOR_HEALTH_SCORING_PROFILE, id: "core-tutor" },
  });
  assert.equal(coreTutorReport.coverage.assessedDimensionCount, 5);
  assert.equal(coreTutorReport.coverage.totalProfileDimensionCount, 7);
  assert.equal(coreTutorReport.coverage.status, "partial");

  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const partialEvaluation = await runTutorEval({
    dataset: { ...dataset, cases: dataset.cases.slice(0, 5) },
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "partial-coverage-test", promptVersion: "1" },
    judge: fixtureJudge(() => ({ result: "PASS" })),
    runId: "partial-coverage-test",
  });
  const partialReport = buildTutorHealthReport({ suite, evaluation: partialEvaluation });
  assert.equal(partialReport.coverage.status, "partial");
  assert.equal(partialReport.coverage.evaluationScope.expectedCaseRunCount, 13);
  assert.equal(partialReport.coverage.evaluationScope.presentCaseRunCount, 5);
  assert.equal(partialReport.coverage.evaluationScope.caseRunRatio, 5 / 13);
  assert.match(formatTutorHealthReport(partialReport), /PARTIAL COVERAGE/);
  assert.match(formatTutorHealthReport(partialReport), /5\/13 case-runs/);
});

test("Judge infrastructure errors remain unresolved and do not create pedagogical failure findings", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "error-test", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      error: input.caseId === "ps-first-mistake",
    })),
    runId: "judge-error-test",
  });

  assert.equal(resultFor(evaluation, "ps-first-mistake").status, "error");
  assert.ok(report.unresolved.some((item) => item.scenarioId === "ps-first-mistake"));
  assert.equal(report.releaseGate, "UNRESOLVED");
  assert.ok(!report.findings.some((finding) => finding.type === "premature_intervention"));
});

test("finding and evidence validation rejects root-cause assertions and unbounded references", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "validation-test", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      result: input.caseId === "ps-first-mistake" ? "FAIL" : "PASS",
    })),
    runId: "finding-validation-test",
  });
  const finding = report.findings.find((candidate) => candidate.type === "premature_intervention");
  assert.ok(finding);
  assert.equal(parseTutorFinding(finding).likelyCauses[0]?.hypothesis.includes("may be"), true);

  assertErrorCode(
    () => parseTutorFinding({ ...finding, rootCause: "proven internal cause" }),
    "tutor_finding_invalid",
  );
  assertErrorCode(
    () =>
      parseTutorFinding({
        ...finding,
        evidence: [{
          ...(finding.evidence[0] as object),
          runIndex: 0,
        }],
      }),
    "tutor_finding_invalid",
  );
  assertErrorCode(
    () =>
      parseTutorFinding({
        ...finding,
        location: { ...finding.location, endTurn: finding.location.startTurn - 1 },
      }),
    "tutor_finding_invalid",
  );
});

test("legacy TutorEval result artifacts remain valid without the additive health fields", async () => {
  const caseValue = {
    schemaVersion: 1,
    id: "legacy-result-case",
    version: "0.2a.1",
    metadata: { subject: "mathematics", topic: "addition" },
    tutorInput: {
      learningObjective: "Explain one addition step.",
      studentMessage: "What is 2 + 2?",
    },
    evaluatorOnly: {
      disclosurePolicy: "full_solution_allowed",
      rubrics: [
        {
          id: "legacy-nonempty",
          category: "correctness",
          criterion: "Respond with a non-empty answer.",
          weight: 1,
          evaluationType: "deterministic",
          evaluatorId: "empty_response",
        },
      ],
    },
  };
  const result = await runTutorEval({
    dataset: {
      id: "historical-fixture",
      version: "0.2a.1",
      cases: [parseTutorEvalCase(caseValue)],
    },
    tutor: { id: "legacy-fixture", respond: async () => ({ text: "Four." }) },
    runId: "legacy-result-run",
  });
  const legacy = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  delete legacy.evaluatorVersion;
  const caseResults = legacy.caseResults as Record<string, unknown>[];
  for (const caseResult of caseResults) {
    delete caseResult.locale;
    delete caseResult.judgeMetrics;
  }
  assertValidTutorEvalRunResult(legacy);
});

test("the finding-first runner uses the explicitly weighted profile", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "weights-test", promptVersion: "1" },
    judge: fixtureJudge((input) => ({
      result: input.caseId === "ps-first-mistake" ? "FAIL" : "PASS",
    })),
    scoringProfile: {
      schemaVersion: 1,
      id: "intervention-only",
      version: "0.1.0",
      dimensionWeights: {
        content_correctness: 0,
        learner_diagnosis: 0,
        intervention_strategy: 1,
        adaptation: 0,
        learning_integrity: 0,
        interaction_quality: 0,
        reliability_policy: 0,
      },
    },
    runId: "weights-test",
  });
  assert.equal(report.scoringProfile.id, "intervention-only");
  assert.equal(report.healthScore, report.dimensionScores.intervention_strategy.score);
});

test("report builder rejects evaluation artifacts from a different suite identity", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const { evaluation } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(),
    tutorDescriptor: { provider: "synthetic", model: "source-binding-test", promptVersion: "1" },
    judge: fixtureJudge(() => ({ result: "PASS" })),
    runId: "source-binding-test",
  });

  assertErrorCode(
    () =>
      buildTutorHealthReport({
        suite: { ...suite, version: "0.2.1" },
        evaluation,
      }),
    "tutor_health_report_source_mismatch",
  );
  assertErrorCode(
    () =>
      buildTutorHealthReport({
        suite,
        evaluation: { ...evaluation, caseResults: evaluation.caseResults.map((result, index) =>
          index === 0 ? { ...result, caseVersion: "stale-case-version" } : result,
        ) },
      }),
    "tutor_health_report_source_mismatch",
  );
});

test("scenario suite parser rejects unversioned or extra fields", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const invalid = structuredClone(suite) as unknown as Record<string, unknown>;
  invalid.unversionedAlias = true;
  assertErrorCode(
    () => parseTutorScenarioSuiteVNext(invalid),
    "tutor_scenario_vnext_invalid",
  );
  assert.equal(suite.scenarios.length, 13);
});
