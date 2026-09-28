import assert from "node:assert/strict";
import { test } from "node:test";

import type { TutorEvalJudgeInput } from "../src/contracts/index.js";
import { loadTutorScenarioSuiteVNext } from "../src/datasets/real-world.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";

function fixtureJudge() {
  return {
    provider: "synthetic-report-map",
    model: "authored-fixture",
    promptVersion: "1",
    evaluate: async (input: TutorEvalJudgeInput) => ({
      schemaVersion: 1 as const,
      caseId: input.caseId,
      rubricResults: input.rubrics.map((rubric) => ({
        rubricId: rubric.id,
        result: input.caseId === "ps-first-mistake" ? ("FAIL" as const) : ("PASS" as const),
      })),
      criticalFailures: [],
      factualErrors: [],
      insufficientInformation: false,
    }),
  };
}

test("design-partner sample-report fields resolve from suite, evaluation, and Tutor Health artifacts", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const tutorResponse =
    "What would happen if you checked your result in the original equation before taking another step?";

  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: {
      id: "synthetic-report-map-tutor",
      respond: async () => ({ text: tutorResponse }),
    },
    tutorDescriptor: {
      provider: "synthetic-partner",
      model: "pilot-tutor",
      modelVersion: "2026-09-synthetic",
      promptId: "partner-policy",
      promptVersion: "baseline-v1",
    },
    judge: fixtureJudge(),
    runId: "synthetic-report-map-run",
  });

  assert.match(evaluation.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(evaluation.tutor.provider, "synthetic-partner");
  assert.equal(evaluation.tutor.model, "pilot-tutor");
  assert.equal(evaluation.tutor.modelVersion, "2026-09-synthetic");
  assert.equal(evaluation.tutor.promptVersion, "baseline-v1");

  assert.equal(report.sourceEvaluation.runId, evaluation.runId);
  assert.equal(report.sourceEvaluation.evaluatorVersion, evaluation.evaluatorVersion);
  assert.equal(report.sourceScenarioSuite.id, suite.id);
  assert.equal(report.sourceScenarioSuite.version, suite.version);
  assert.equal(report.scoringProfile.id, "productive-struggle-intervention");
  assert.equal(report.coverage.evaluationScope.presentCaseRunCount, suite.scenarios.length);

  const finding = report.findings.find(
    (candidate) =>
      candidate.scenarioId === "ps-first-mistake" &&
      candidate.type === "premature_intervention",
  );
  assert.ok(finding);
  assert.equal(finding.dimension, "intervention_strategy");
  assert.equal(finding.severity, "major");
  assert.equal(finding.location.decisionPointId, "preserve-first-attempt");
  assert.ok(finding.expectedBehavior.length > 0);
  assert.ok(finding.observedBehavior.length > 0);
  assert.ok(finding.recommendations.some((item) => item.kind === "diagnostic"));
  assert.ok(finding.regressionTargets.includes("ps-first-mistake/preserve-first-attempt"));

  const scenario = suite.scenarios.find(
    (candidate) => candidate.identity.id === finding.scenarioId,
  );
  assert.ok(scenario);
  const decisionPoint = scenario.decisionPoints.find(
    (candidate) => candidate.id === finding.location.decisionPointId,
  );
  assert.ok(decisionPoint);
  assert.equal(decisionPoint.expectedBehavior, finding.expectedBehavior);

  const rubricEvidence = finding.evidence.find(
    (candidate) => candidate.kind === "rubric_result",
  );
  assert.ok(rubricEvidence?.kind === "rubric_result");
  const caseResult = evaluation.caseResults.find(
    (candidate) =>
      candidate.caseId === rubricEvidence.caseId &&
      candidate.runIndex === rubricEvidence.runIndex,
  );
  assert.ok(caseResult);
  assert.equal(caseResult.rawTutorResponse, tutorResponse);
  assert.ok(
    caseResult.rubricResults.some(
      (rubric) =>
        rubric.rubricId === rubricEvidence.rubricId &&
        rubric.result === rubricEvidence.result,
    ),
  );

  const learnerExcerpt = scenario.trajectory.conversationHistory
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .join("\n");
  assert.match(learnerExcerpt, /x = 14/);
});
