import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { parseMathChallengeEvidence } from "../src/contracts/math-challenge-evidence.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";
import { loadTutorEvalDataset } from "../src/datasets/synthetic.js";
import { loadTutorScenarioSuiteVNext, tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import {
  buildMathematicsPilotCoverage,
  findMathematicsPilotNode,
  validateMathematicsPilotLinkage,
  type MathematicsPilotInputs,
  type MathematicsPilotRegistry,
} from "../src/research/mathematics-linkage-pilot.js";

const scenarioBase = new URL("../../scenarios/", import.meta.url);
async function load(): Promise<MathematicsPilotInputs> {
  const [graph, links, research, evidence, evaluation, health] = await Promise.all([
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-eval-health-linkage-v0.1/links.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/suite.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/evidence.json", scenarioBase), "utf8"),
    loadTutorEvalDataset(),
    loadTutorScenarioSuiteVNext(),
  ]);
  return {
    map: parseMathematicsKnowledgeMap(JSON.parse(graph) as unknown),
    pilot: JSON.parse(links) as MathematicsPilotRegistry,
    researchSuite: parseTutorScenarioSuiteVNext(JSON.parse(research) as unknown),
    evidence: parseMathChallengeEvidence(JSON.parse(evidence) as unknown),
    evaluation,
    health,
  };
}

test("pilot pins sources, validates links, and distinguishes case presence from observed evaluation evidence", async () => {
  const inputs = await load();
  validateMathematicsPilotLinkage(inputs);
  const report = buildMathematicsPilotCoverage(inputs);
  assert.equal(report.scope, "authored_links_only");
  assert.equal(report.reviewed, false);
  assert.equal(report.modelRunsMeasured, false);
  assert.equal(report.learnerOutcomesMeasured, false);
  assert.deepEqual(report.counts, {
    graphNodes: 44,
    researchMappedNodes: 22,
    researchUnmappedNodes: 22,
    researchTaskCount: 16,
    researchScenarioCount: 20,
    linkedEvalCaseCount: 3,
    linkedHealthDecisionPointCount: 4,
    pilotLinkedNodeCount: 3,
    combinedLinkedNodeCount: 23,
  });
  assert.equal(inputs.pilot.links.find(link => link.source.id === "fraction-misconception-001")?.source.version, "1.2.0");
  assert.ok(report.nodes.every(row => inputs.map.nodes.some(node => node.id === row.nodeId)));
});

test("knowledge-node reverse lookup joins three existing source types without conflating their IDs", async () => {
  const report = buildMathematicsPilotCoverage(await load());
  const units = findMathematicsPilotNode(report, "fractions-units");
  assert.ok(units);
  assert.deepEqual(units.evalCases.map(item => item.id), [
    "fraction-misconception-001", "paired-fraction-conceptual-001",
  ]);
  assert.deepEqual(units.healthDecisionPoints.map(item => item.scenarioId), [
    "ps-false-confidence", "ps-same-misconception",
  ]);
  assert.ok(units.researchTasks.includes("fraction-unit-repair"));
  assert.ok(units.researchScenarios.includes("mc-fraction-units"));

  const equation = findMathematicsPilotNode(report, "linear-equations");
  assert.ok(equation);
  assert.deepEqual(equation.evalCases.map(item => item.id), ["hint-only-linear-equation-001"]);
  assert.deepEqual(equation.healthDecisionPoints.map(item => item.scenarioId), [
    "ps-first-mistake", "ps-repeated-mistake",
  ]);

  const probability = findMathematicsPilotNode(report, "conditional-events");
  assert.ok(probability);
  assert.deepEqual(probability.evalCases, []);
  assert.deepEqual(probability.healthDecisionPoints, []);
  assert.ok(probability.researchTasks.includes("conditional-two-red"));
  assert.deepEqual(probability.researchScenarios, [
    "mc-conditional-normalization", "mc-conditional-prerequisite", "mc-conditional-transfer",
  ]);
  assert.equal(findMathematicsPilotNode(report, "nonexistent-node"), null);
});

test("pilot rejects stale sources, phantom concepts, duplicate links, or incorrect decision references", async () => {
  const inputs = await load();
  const altered = (edit: (pilot: MathematicsPilotRegistry) => void) => {
    const pilot = structuredClone(inputs.pilot) as unknown as MathematicsPilotRegistry;
    edit(pilot);
    return { ...inputs, pilot };
  };
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.links[0]!.source as { version: string }).version = "1.1.0";
  })), /pilot_eval_identity_invalid/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.links[0]!.nodes[0] as { id: string }).id = "ghost-node";
  })), /pilot_knowledge_node_invalid/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.sources.healthSuite as { version: string }).version = "0.0.0";
  })), /pilot_source_snapshot_invalid/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.sources.researchEvidence as { version: string }).version = "0.0.0";
  })), /pilot_source_snapshot_invalid/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.links as MathematicsPilotRegistry["links"][number][]).push(structuredClone(pilot.links[0]!));
  })), /pilot_link_duplicate/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    const row = pilot.links.find(item => item.source.kind === "health_decision_point")!;
    (row.source as { decisionPointId: string }).decisionPointId = "phantom-point";
  })), /pilot_health_identity_invalid/);
});

test("linkage projection never becomes a Tutor/Judge prompt, Eval score, or Health score", async () => {
  const inputs = await load();
  const compiled = tutorScenarioSuiteToTutorEvalDataset(inputs.health);
  const originalCases = JSON.stringify(compiled);
  const originalEval = JSON.stringify(inputs.evaluation);
  const before = compiled.cases.map(item => JSON.stringify(toTutorTurnInput(item)));
  const report = buildMathematicsPilotCoverage(inputs);
  assert.equal(JSON.stringify(inputs.evaluation), originalEval);
  assert.equal(JSON.stringify(tutorScenarioSuiteToTutorEvalDataset(inputs.health)), originalCases);
  assert.deepEqual(compiled.cases.map(item => JSON.stringify(toTutorTurnInput(item))), before);
  const projected = JSON.stringify(report);
  assert.doesNotMatch(projected, /rawTutorResponse|rawJudgeResult|evaluatorOnly|studentMessage|healthScore|rubricResults/);
  assert.doesNotMatch(JSON.stringify(inputs.pilot), /rawTutorResponse|rawJudgeResult|evaluatorOnly|studentMessage|healthScore/);
});
