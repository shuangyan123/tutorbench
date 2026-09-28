import assert from "node:assert/strict";
import test from "node:test";

import {
  CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_VERSION,
  loadTutorScenarioSuiteVNext,
  tutorScenarioSuiteToTutorEvalDataset,
} from "../src/datasets/real-world.js";
import { toTutorTurnInput, type TutorEvalJudgeInput } from "../src/contracts/index.js";
import { parseTutorHealthCliOptions } from "../src/cli/tutorbench-health.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";

test("Case System vNext executable pilot loads with bound D1/D3/D5 provenance", async () => {
  const suite = await loadTutorScenarioSuiteVNext(
    CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  );
  assert.equal(suite.id, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
  assert.equal(suite.version, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_VERSION);
  assert.equal(suite.scenarios.length, 3);

  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.caseSystemSource?.archetypeId),
    ["science-d1-graph", "programming-d3-debug", "math-d5-generalization"],
  );
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.caseSystemSource?.strategyProfileId),
    [
      "physics-d1-position-time-graph",
      "computer-science-python-d3-debugging",
      "math-d5-structural-generalization",
    ],
  );
});

test("Case System vNext executable pilot compiles without leaking authoring provenance", async () => {
  const suite = await loadTutorScenarioSuiteVNext(
    CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  );
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(dataset.id, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
  assert.equal(dataset.version, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_VERSION);
  assert.equal(dataset.cases.length, 3);

  for (const caseValue of dataset.cases) {
    const tutorInput = toTutorTurnInput(caseValue);
    const serialized = JSON.stringify(tutorInput);
    assert.doesNotMatch(serialized, /caseSystemSource|pilotId|strategyProfileId/u);
    assert.ok(tutorInput.currentStudentMessage.length > 0);
  }
});

test("health CLI accepts the executable Case System vNext pilot suite", () => {
  const parsed = parseTutorHealthCliOptions([
    "--http",
    "https://partner.example.com/respond",
    "--suite",
    CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
    "--tutor-provider",
    "partner",
    "--tutor-model",
    "production",
    "--prompt-version",
    "v1",
  ]);
  assert.equal(parsed.help, false);
  if (parsed.help) return;
  assert.equal(parsed.suiteId, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
});

test("Case System vNext executable pilot runs through Tutor Health", async () => {
  const suite = await loadTutorScenarioSuiteVNext(
    CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  );
  const judge = {
    provider: "synthetic-test",
    model: "all-pass",
    promptVersion: "test-1",
    evaluate: async (input: TutorEvalJudgeInput) => ({
      schemaVersion: 1 as const,
      caseId: input.caseId,
      rubricResults: input.rubrics.map((rubric) => ({
        rubricId: rubric.id,
        result: "PASS" as const,
      })),
      criticalFailures: [],
      factualErrors: [],
      insufficientInformation: false,
    }),
  };
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: {
      id: "synthetic-vnext-pilot-tutor",
      respond: async () => ({
        text: "I will use the learner's evidence and explain the next relevant step.",
      }),
    },
    tutorDescriptor: {
      provider: "synthetic",
      model: "fixture",
      promptVersion: "1",
    },
    judge,
    runId: "case-system-vnext-executable-pilot-test",
  });

  assert.equal(evaluation.caseCount, 3);
  assert.equal(evaluation.caseRunCount, 3);
  assert.equal(report.sourceScenarioSuite.id, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
  assert.equal(report.unresolved.length, 0);
  assert.equal(report.findings.length, 0);
});
