import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import {
  CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  loadTutorScenarioSuiteVNext,
  tutorScenarioSuiteToTutorEvalDataset,
} from "../src/datasets/real-world.js";
import { indexScenarioLearnerEvidence } from "../src/datasets/scenario-evidence-provenance.js";

const contrastsUrl = new URL(
  "../../scenarios/experimental/prerequisite-accessibility-contrasts-v0.1/suite.json",
  import.meta.url,
);

async function contrasts() {
  return parseTutorScenarioSuiteVNext(
    JSON.parse(await readFile(contrastsUrl, "utf8")) as unknown,
  );
}

test("eight H1 checkpoints retain exact source and compiled case identities without state inference", async () => {
  const suite = await contrasts();
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const index = indexScenarioLearnerEvidence(suite);

  assert.equal(index.length, 8);
  assert.equal(new Set(index.map((row) => row.caseId)).size, 8);
  for (const row of index) {
    const caseValue = dataset.cases.find((item) => item.id === row.caseId);
    const scenario = suite.scenarios.find((item) => item.identity.id === row.scenarioId);
    assert.ok(caseValue);
    assert.ok(scenario);
    const point = scenario.decisionPoints.find((item) => item.id === row.decisionPointId);
    assert.ok(point);
    assert.equal(row.suiteId, suite.id);
    assert.equal(row.suiteVersion, suite.version);
    assert.equal(row.scenarioVersion, scenario.identity.version);
    assert.equal(row.caseId, point.evaluationCaseId);
    assert.equal(row.caseVersion, caseValue.version);
    assert.equal(row.tutorResponseTurnIndex, point.turnIndex);
    assert.equal(row.learnerTurnCount, 1);
    assert.equal(row.caseSystemSource, undefined);
    assert.equal("knowledgeState" in row, false);
    assert.equal("masteryState" in row, false);
    assert.equal("status" in row, false);
    assert.doesNotMatch(
      JSON.stringify(toTutorTurnInput(caseValue)),
      /evaluatorOnlyMisconceptionReferences|caseSystemSource|referenceOrdinal/u,
    );
  }

  const unknownCause = index.find((item) => item.caseId === "pac-m-a");
  const statedRule = index.find((item) => item.caseId === "pac-m-b");
  assert.ok(unknownCause && statedRule);
  // No authored reference does NOT prove the student has no misconception.
  assert.deepEqual(unknownCause.evaluatorOnlyMisconceptionReferences, []);
  assert.deepEqual(statedRule.evaluatorOnlyMisconceptionReferences, [{
    sourceScope: "scenario",
    referenceOrdinal: 1,
    learnerTurnIndexes: [1],
  }]);
  assert.doesNotMatch(JSON.stringify(statedRule), /one direction must work/u);
  const mB = suite.scenarios.find((item) => item.identity.id === "pac-m-b");
  assert.ok(mB);
  const citedTurn = mB.trajectory.conversationHistory.filter(
    (item) => item.role === "user",
  )[statedRule.evaluatorOnlyMisconceptionReferences[0]!.learnerTurnIndexes[0]! - 1];
  assert.ok(citedTurn);
  assert.match(citedTurn.content, /any rule that works in one direction/u);
});

test("learner evidence positions count USER turns, not mixed Tutor/student messages", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const index = indexScenarioLearnerEvidence(suite);
  const repeated = index.find((row) => row.scenarioId === "ps-repeated-mistake");
  assert.ok(repeated);
  assert.equal(repeated.learnerTurnCount, 2);
  assert.deepEqual(
    repeated.evaluatorOnlyMisconceptionReferences.flatMap((ref) => ref.learnerTurnIndexes),
    [1, 2],
  );
  const scenario = suite.scenarios.find((item) => item.identity.id === repeated.scenarioId);
  assert.ok(scenario);
  assert.deepEqual(
    scenario.trajectory.conversationHistory.map((item) => item.role),
    ["user", "assistant", "user"],
  );
});

test("Case System D/P/H link stays declared authoring provenance, never a Tutor input or inferred score", async () => {
  const suite = await loadTutorScenarioSuiteVNext(CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID);
  const index = indexScenarioLearnerEvidence(suite);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(index.length, 6);
  for (const row of index) {
    const scenario = suite.scenarios.find((item) => item.identity.id === row.scenarioId);
    assert.ok(scenario);
    assert.deepEqual(row.caseSystemSource, scenario.caseSystemSource);
    assert.ok(row.caseSystemSource);
    assert.equal("contentDepth" in row, false);
    assert.equal("pedagogicalDifficulty" in row, false);
    assert.equal("interactionHorizon" in row, false);
    const caseValue = dataset.cases.find((item) => item.id === row.caseId);
    assert.ok(caseValue);
    const visible = JSON.stringify(toTutorTurnInput(caseValue));
    assert.doesNotMatch(visible, /pilotVersion|archetypeId|strategyProfileId/u);
  }
});

test("decision-point reference snapshot overrides scenario-level references without changing turn identity", async () => {
  const raw = JSON.parse(await readFile(contrastsUrl, "utf8")) as {
    scenarios: Array<{
      identity: { id: string };
      evaluatorReferenceState: {
        misconceptions: Array<{ statement: string; evidenceLearnerTurns: number[] }>;
      };
      decisionPoints: Array<{
        evaluatorReferenceState?: {
          misconceptions: Array<{ statement: string; evidenceLearnerTurns: number[] }>;
        };
      }>;
    }>;
  };
  const mB = raw.scenarios.find((item) => item.identity.id === "pac-m-b");
  assert.ok(mB);
  mB.decisionPoints[0]!.evaluatorReferenceState =
    structuredClone(mB.evaluatorReferenceState);
  const suite = parseTutorScenarioSuiteVNext(raw);
  const row = indexScenarioLearnerEvidence(suite).find(
    (item) => item.caseId === "pac-m-b",
  );
  assert.ok(row);
  assert.deepEqual(row.evaluatorOnlyMisconceptionReferences, [{
    sourceScope: "decision_point",
    referenceOrdinal: 1,
    learnerTurnIndexes: [1],
  }]);
  assert.equal(row.caseVersion, "0.1.0:next-response");
  assert.equal(row.learnerTurnCount, 1);
});

test("invalid learner turn evidence cannot enter the source index", async () => {
  const raw = JSON.parse(await readFile(contrastsUrl, "utf8")) as {
    scenarios: Array<{
      identity: { id: string };
      evaluatorReferenceState: {
        misconceptions: Array<{ statement: string; evidenceLearnerTurns: number[] }>;
      };
    }>;
  };
  const mB = raw.scenarios.find((item) => item.identity.id === "pac-m-b");
  assert.ok(mB);
  mB.evaluatorReferenceState.misconceptions[0]!.evidenceLearnerTurns = [2];
  assert.throws(() =>
    indexScenarioLearnerEvidence(raw as unknown as Parameters<
      typeof indexScenarioLearnerEvidence
    >[0]),
  );
});
