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
  assert.equal(suite.scenarios.length, 6);

  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.caseSystemSource?.archetypeId),
    [
      "science-d1-graph",
      "programming-d3-debug",
      "math-d5-generalization",
      "science-d3-causal",
      "science-d5-investigation",
      "history-d5-conflicting-sources",
    ],
  );
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.caseSystemSource?.strategyProfileId),
    [
      "physics-d1-position-time-graph",
      "computer-science-python-d3-debugging",
      "math-d5-structural-generalization",
      "biology-d3-causal-control",
      "chemistry-d5-kinetics-discrimination",
      "history-d5-source-corroboration",
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
  assert.equal(dataset.cases.length, 6);

  for (const caseValue of dataset.cases) {
    const tutorInput = toTutorTurnInput(caseValue);
    const serialized = JSON.stringify(tutorInput);
    assert.doesNotMatch(serialized, /caseSystemSource|pilotId|strategyProfileId/u);
    assert.ok(tutorInput.currentStudentMessage.length > 0);
  }
});

test("History D5 provides claim-level evidence required by its corroboration rubric", async () => {
  const suite = await loadTutorScenarioSuiteVNext(
    CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  );
  const history = suite.scenarios.find(
    (scenario) => scenario.identity.id === "csvnext-history-d5-corroboration",
  );
  assert.ok(history);
  assert.equal(history.identity.version, "0.2.0");

  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const historyCase = dataset.cases.find(
    (candidate) => candidate.id === "csvnext-history-d5-corroboration",
  );
  assert.ok(historyCase);

  const input = toTutorTurnInput(historyCase);
  assert.match(input.currentStudentMessage, /tax collections stayed stable/u);
  assert.match(input.currentStudentMessage, /fell in three of four sampled districts/u);
  assert.match(input.currentStudentMessage, /no local petitions/u);
  assert.match(input.currentStudentMessage, /two private letters/u);
  assert.match(input.currentStudentMessage, /do not cover every district/u);

  const bounded = historyCase.evaluatorOnly.rubrics.find(
    (rubric) => rubric.id === "csvnext-history-d5-bounded-conclusion",
  );
  assert.ok(bounded);
  assert.match(bounded.criterion, /stable-collections claim/u);
  assert.match(bounded.criterion, /no-petitions claim/u);
  assert.match(bounded.criterion, /does not cover every district/u);
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

  assert.equal(evaluation.caseCount, 6);
  assert.equal(evaluation.caseRunCount, 6);
  assert.equal(report.sourceScenarioSuite.id, CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
  assert.equal(report.scoringProfile.id, "case-system-vnext-executable-pilot");
  assert.equal(report.scoringProfile.version, "0.1.0");
  assert.equal(report.unresolved.length, 0);
  assert.equal(report.findings.length, 0);
});
