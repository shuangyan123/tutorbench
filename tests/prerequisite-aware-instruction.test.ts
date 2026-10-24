import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";

const suiteUrl = new URL(
  "../../scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json",
  import.meta.url,
);

async function loadExperimentalSuite() {
  return parseTutorScenarioSuiteVNext(
    JSON.parse(await readFile(suiteUrl, "utf8")) as unknown,
  );
}

test("prerequisite-aware experimental checkpoints parse without changing canonical registry", async () => {
  const suite = await loadExperimentalSuite();
  assert.equal(suite.id, "prerequisite-aware-instruction-v0.1");
  assert.equal(suite.scenarios.length, 5);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(dataset.cases.length, 5);
  assert.equal(new Set(dataset.cases.map((item) => item.id)).size, 5);
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.decisionPoints[0]?.expectedDecision),
    ["ask_diagnostic_question", "offer_conceptual_hint", "probe_understanding", "fade_support", "fade_support"],
  );
  for (const scenario of suite.scenarios) {
    assert.equal(scenario.decisionPoints.length, 1);
    const point = scenario.decisionPoints[0]!;
    assert.equal(point.evaluationCriteria.length, 2);
    assert.ok(point.evaluationCriteria.every((rubric) => rubric.evaluationType === "judge"));
    assert.ok(point.evaluationCriteria.every((rubric) => rubric.weight === 1));
  }
});

test("diagnostic truth stays hidden from Tutor-visible context", async () => {
  const suite = await loadExperimentalSuite();
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const unknown = dataset.cases.find((item) => item.id === "pai-unknown-cause");
  const misconception = dataset.cases.find((item) => item.id === "pai-rule-misconception");
  assert.ok(unknown);
  assert.ok(misconception);
  assert.equal(unknown.evaluatorOnly.knownMisconception, undefined);
  assert.match(misconception.evaluatorOnly.knownMisconception ?? "", /supported by authored learner turn 1/);
  const visible = toTutorTurnInput(misconception);
  assert.deepEqual(visible.studentState.misconceptions, []);
  assert.ok(!JSON.stringify(visible).includes("supported by authored learner turn"));
  assert.match(visible.currentStudentMessage, /add top numbers and bottom numbers separately/);
});

test("prerequisite clarification and subsequent fading are distinct authored evidence", async () => {
  const suite = await loadExperimentalSuite();
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const clarification = dataset.cases.find((item) => item.id === "pai-whole-undefined");
  const progress = dataset.cases.find((item) => item.id === "pai-after-progress");
  const ready = dataset.cases.find((item) => item.id === "pai-known-foundation");
  assert.ok(clarification);
  assert.ok(progress);
  assert.ok(ready);
  assert.match(toTutorTurnInput(clarification).currentStudentMessage, /What does 'a whole' mean/);
  assert.match(toTutorTurnInput(progress).currentStudentMessage, /why do the pieces have to be equal/);
  assert.match(toTutorTurnInput(ready).currentStudentMessage, /How can I rewrite them to add them/);
  assert.ok(
    suite.scenarios.every((scenario) =>
      scenario.decisionPoints.every((point) =>
        point.evaluationCriteria.every((criterion) =>
          criterion.category === "correctness" ||
          criterion.category === "diagnosis" ||
          criterion.category === "guidance" ||
          criterion.category === "adaptation" ||
          criterion.category === "actionability",
        ),
      ),
    ),
  );
});

test("contrived unsupported misconception reference cannot bypass evidence validation", async () => {
  const suite = await loadExperimentalSuite();
  const invalid = structuredClone(suite) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      evaluatorReferenceState: { misconceptions: Array<{ statement: string; evidenceLearnerTurns: number[] }> };
    }>;
  };
  const unknown = invalid.scenarios.find((scenario) => scenario.identity.id === "pai-unknown-cause");
  assert.ok(unknown);
  unknown.evaluatorReferenceState.misconceptions = [
    { statement: "Unobserved misconception", evidenceLearnerTurns: [2] },
  ];
  assert.throws(() => parseTutorScenarioSuiteVNext(invalid), (error: unknown) =>\n    error instanceof Error && "code" in error && error.code === "tutor_scenario_vnext_invalid",\n  );
});
