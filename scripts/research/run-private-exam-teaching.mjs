import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { ScriptedTutor } from "../../dist/src/adapters/scripted-tutor.js";
import { parseTutorScenarioSuiteVNext, toTutorTurnInput } from "../../dist/src/contracts/index.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../../dist/src/datasets/real-world.js";
import { runTutorHealthEvaluation } from "../../dist/src/runner/tutor-health-runner.js";

const capabilities = ["diagnosis", "guidance", "adaptation", "actionability"];
const checkpoints = (suite) => suite.scenarios.flatMap((scenario) => scenario.decisionPoints);
const tutorInputs = (suite) => tutorScenarioSuiteToTutorEvalDataset(suite).cases.map((item) => toTutorTurnInput(item));
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function materialize(pilot, admissions) {
  const suite = globalThis.structuredClone(pilot.suite);
  const byId = new Map(pilot.teachingReferences.map((reference) => [reference.questionId, reference]));
  assert.equal(suite.scenarios.length, Object.keys(pilot.scenarioQuestions).length);
  assert.equal(checkpoints(suite).length, 10);
  assert.equal(byId.size, 6);
  assert.deepEqual(new Set(Object.values(pilot.scenarioQuestions)), new Set(byId.keys()));
  const eligible = new Set();
  for (const scenario of suite.scenarios) {
    const questionId = pilot.scenarioQuestions[scenario.identity.id];
    const source = byId.get(questionId);
    assert.ok(source && typeof source.tutorStimulus === "string" && source.tutorStimulus.trim());
    const admitted = admissions[questionId].admitted;
    assert.equal(typeof admitted, "boolean");
    // 只把核对过的题面放进 Tutor 可见的对话。
    for (const { conversationHistory } of [scenario.trajectory,
      ...scenario.decisionPoints.flatMap((point) => point.trajectory ? [point.trajectory] : [])]) {
      assert.equal(conversationHistory[0]?.role, "user");
      if (admitted) conversationHistory[0].content = source.tutorStimulus + "\n\n" + conversationHistory[0].content;
    }
    if (admitted) for (const point of scenario.decisionPoints) eligible.add(point.evaluationCaseId);
  }
  return { suite: parseTutorScenarioSuiteVNext(suite), eligible };
}

function checkHiddenFirewall(suite) {
  const changed = globalThis.structuredClone(suite);
  const hidden = { misconceptions: [{ statement: "PRIVATE_EVALUATOR_CANARY", evidenceLearnerTurns: [1] }] };
  for (const scenario of changed.scenarios) {
    scenario.evaluatorReferenceState = hidden;
    for (const point of scenario.decisionPoints) {
      point.evaluatorReferenceState = hidden;
      for (const rubric of point.evaluationCriteria) rubric.criterion = "PRIVATE_RUBRIC_CANARY";
    }
  }
  const original = tutorInputs(suite);
  assert.deepEqual(tutorInputs(changed), original, "hidden annotation changed a Tutor packet");
  assert.ok(original.every((input) => input.studentState.misconceptions.length === 0));
  return { tutorPacketSha256: digest(original), packetsChecked: original.length };
}

function coverage(suite, evaluation) {
  const points = new Map(checkpoints(suite).map((point) => [point.evaluationCaseId, point]));
  const counts = Object.fromEntries(capabilities.map((name) => [name, { assessed: 0, scored: 0, total: 0 }]));
  for (const point of points.values()) {
    for (const criterion of point.evaluationCriteria) counts[criterion.category].total += evaluation.runsPerCase;
  }
  for (const row of evaluation.caseResults) {
    for (const criterion of points.get(row.caseId).evaluationCriteria) {
      if (row.rawTutorResponse === null) continue;
      if (criterion.evaluationType === "judge" && (
        row.rawJudgeResult?.insufficientInformation !== false ||
        !row.rawJudgeResult.rubricResults.some((entry) => entry.rubricId === criterion.rubricId)
      )) continue;
      const result = row.rubricResults.find((entry) => entry.rubricId === criterion.rubricId);
      if (result && result.result !== "ERROR") counts[criterion.category].assessed += 1;
      if (result && result.result !== "ERROR" && result.score !== null) counts[criterion.category].scored += 1;
    }
  }
  return counts;
}

async function run(suite, eligible, pilot, variant) {
  const packets = [];
  const link = pilot.historyLink;
  const scripted = new ScriptedTutor({
    id: "authored-offline-replies",
    responses: Object.fromEntries(Object.entries(pilot.fixtures).map(([id, fixture]) =>
      [id, variant === "adversarial" ? fixture.adversarial : fixture.baseline])),
  });
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    runId: suite.id + "-" + variant,
    tutorDescriptor: {
      provider: "offline-fixture", model: variant, promptId: "authored-pilot",
      promptVersion: suite.version, temperature: 0,
    },
    tutor: {
      id: scripted.id,
      async respond(input) {
        const id = input.caseId;
        if (!eligible.has(id) || (variant === "missing-response" && id === pilot.missingResponseCase)) {
          throw new Error("offline response unavailable");
        }
        if (id === link.nextCaseId && (input.conversation.at(-1)?.role !== "tutor" ||
            input.conversation.at(-1).text !== pilot.fixtures[link.previousCaseId].baseline ||
            !input.currentStudentMessage.includes(link.learnerAnchor))) {
          throw new Error("H2 learner continuation requires its earlier response");
        }
        packets.push(input);
        return scripted.respond(input);
      },
    },
  });
  const byCapability = coverage(suite, evaluation);
  const partial = Object.values(byCapability).some((row) => row.scored < row.total);
  return { evaluation, report, tutorPackets: packets, byCapability,
    criterionCoverage: partial ? "PARTIAL COVERAGE" : "COMPLETE",
    judge: "unavailable" };
}

function linkedHistory(suite, pilot, response) {
  const { nextCaseId, previousCaseId } = pilot.historyLink;
  const point = checkpoints(suite).find((entry) => entry.evaluationCaseId === nextCaseId);
  const earlier = point?.trajectory?.conversationHistory.at(-2);
  assert.equal(earlier?.role, "assistant");
  assert.equal(earlier.content, pilot.fixtures[previousCaseId].baseline, "authored continuation is misbound");
  earlier.content = response;
  point.trajectory.priorHints = [response];
}

export async function executePrivatePilot({ pilot, admissions, inputDigests }) {
  const { suite, eligible } = materialize(pilot, admissions);
  const allPoints = checkpoints(suite);
  assert.deepEqual(new Set(Object.keys(pilot.fixtures)), new Set(allPoints.map((point) => point.evaluationCaseId)));
  assert.ok(Object.hasOwn(pilot.fixtures, pilot.missingResponseCase));
  const { previousCaseId, nextCaseId } = pilot.historyLink;
  assert.notEqual(previousCaseId, nextCaseId);
  assert.ok(Object.values(pilot.fixtures).every((fixture) =>
    [fixture.baseline, fixture.adversarial].every((reply) => typeof reply === "string" && reply.trim())));
  const [previous, next] = [previousCaseId, nextCaseId].map((id) =>
    allPoints.find((point) => point.evaluationCaseId === id));
  assert.equal(previous?.turnIndex, 1);
  assert.equal(next?.turnIndex, 2);
  assert.equal(previous.trajectory.conversationHistory[0].content, next.trajectory.conversationHistory[0].content);
  assert.ok(next.trajectory.conversationHistory.at(-1).content.includes(pilot.historyLink.learnerAnchor));
  const seedSuite = globalThis.structuredClone(suite);
  seedSuite.scenarios = seedSuite.scenarios.filter((scenario) =>
    scenario.decisionPoints.some((point) => point.evaluationCaseId === previousCaseId));
  assert.equal(seedSuite.scenarios.length, 1);
  seedSuite.scenarios[0].decisionPoints = seedSuite.scenarios[0].decisionPoints
    .filter((point) => point.evaluationCaseId === previousCaseId);
  const seed = await run(seedSuite, eligible, pilot, "h2-seed");
  const priorResponse = seed.evaluation.caseResults[0]?.rawTutorResponse;
  if (eligible.has(nextCaseId)) {
    assert.ok(priorResponse, "H2 predecessor did not execute");
    linkedHistory(suite, pilot, priorResponse);
  }
  const firewall = checkHiddenFirewall(suite);
  const baseline = await run(suite, eligible, pilot, "baseline");
  const observed = new Map(baseline.tutorPackets.map((packet) => [packet.caseId, packet]));
  const projected = tutorInputs(suite).filter((packet) => eligible.has(packet.caseId));
  assert.equal(observed.size, projected.length);
  for (const packet of projected) assert.deepEqual(observed.get(packet.caseId), packet);
  const adversarial = await run(suite, eligible, pilot, "adversarial");
  const missingResponse = await run(suite, eligible, pilot, "missing-response");
  const alteredSuite = globalThis.structuredClone(suite);
  linkedHistory(alteredSuite, pilot, "A different earlier intervention with no matching learner continuation.");
  const historyMismatch = await run(alteredSuite, eligible, pilot, "history-mismatch");
  return { schemaVersion: 1, inputDigests, admissions, firewall, suite,
    teachingReferences: pilot.teachingReferences, scenarioQuestions: pilot.scenarioQuestions,
    variants: { baseline, adversarial, missingResponse, historyMismatch },
    h2Seed: seed.evaluation.caseResults[0] };
}

if (process.argv[1]?.endsWith("run-private-exam-teaching.mjs")) {
  try {
    const output = await executePrivatePilot(JSON.parse(readFileSync(0, "utf8")));
    process.stdout.write(JSON.stringify(output));
  } catch {
    process.stderr.write("private teaching pilot: invalid suite, fixtures, or evidence binding\n");
    process.exitCode = 1;
  }
}
