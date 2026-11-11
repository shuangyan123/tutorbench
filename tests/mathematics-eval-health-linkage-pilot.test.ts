import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseAcademicStructure } from "../src/contracts/academic-structure.js";
import { parseMathematicsExamAlignment } from "../src/contracts/mathematics-exam-alignment.js";
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
  const [academic, exam, graph, links, research, evidence, evaluation, health] = await Promise.all([
    readFile(new URL("case-system-vnext/academic-structure-v0.1.json", scenarioBase), "utf8"),
    readFile(new URL("case-system-vnext/mathematics-exam-alignment-v0.1.json", scenarioBase), "utf8"),
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-eval-health-linkage-v0.1/links.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/suite.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/evidence.json", scenarioBase), "utf8"),
    loadTutorEvalDataset(),
    loadTutorScenarioSuiteVNext(),
  ]);
  return {
    academic: parseAcademicStructure(JSON.parse(academic) as unknown),
    exam: parseMathematicsExamAlignment(JSON.parse(exam) as unknown),
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
    examProfileCount: 16,
    examLinkedNodeCount: 42,
    researchMappedNodes: 22,
    researchUnmappedNodes: 22,
    researchTaskCount: 16,
    researchScenarioCount: 20,
    linkedEvalCaseCount: 12,
    linkedHealthDecisionPointCount: 12,
    pilotLinkedNodeCount: 5,
    combinedLinkedNodeCount: 25,
  });
  assert.equal(inputs.pilot.links.find(link => link.source.id === "fraction-misconception-001")?.source.version, "1.2.0");
  assert.ok(report.nodes.every(row => inputs.map.nodes.some(node => node.id === row.nodeId)));
});

test("knowledge-node reverse lookup joins three existing source types without conflating their IDs", async () => {
  const report = buildMathematicsPilotCoverage(await load());
  const units = findMathematicsPilotNode(report, "fractions-units");
  assert.ok(units);
  assert.equal(units.evalCases.length, 8);
  assert.ok(units.evalCases.some(item => item.id === "fraction-misconception-001" && item.version === "1.2.0"));
  assert.ok(units.evalCases.some(item => item.id === "fraction-misconception-001-zh-CN" && item.version === "1.2.0"));
  assert.deepEqual(units.healthDecisionPoints.map(item => item.scenarioId), [
    "ps-false-confidence", "ps-same-misconception",
  ]);
  assert.ok(units.examProfiles.includes("cn-zhongkao-math-general"));
  assert.ok(units.researchTasks.includes("fraction-unit-repair"));
  assert.ok(units.researchScenarios.includes("mc-fraction-units"));

  const equation = findMathematicsPilotNode(report, "linear-equations");
  assert.ok(equation);
  assert.equal(equation.evalCases.length, 4);
  assert.ok(equation.evalCases.some(item => item.id === "hint-only-linear-equation-001-zh-CN"));
  assert.equal(equation.healthDecisionPoints.length, 7);
  assert.ok(equation.healthDecisionPoints.some(item => item.scenarioId === "ps-first-mistake"));
  assert.ok(equation.healthDecisionPoints.some(item => item.scenarioId === "ps-repeated-mistake"));

  const probability = findMathematicsPilotNode(report, "conditional-events");
  assert.ok(probability);
  assert.deepEqual(probability.evalCases, []);
  assert.deepEqual(probability.healthDecisionPoints, []);
  assert.ok(probability.examProfiles.includes("cn-gaokao-math-national-2026"));
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
    (pilot.sources.academicStructure as { version: string }).version = "0.0.0";
  })), /pilot_source_snapshot_invalid/);
  assert.throws(() => buildMathematicsPilotCoverage(altered(pilot => {
    (pilot.sources.examAlignment as { version: string }).version = "0.0.0";
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


test("provider-free pilot inspector resolves valid nodes and fails on unknown IDs", () => {
  const script = fileURLToPath(new URL("../src/cli/mathematics-linkage-pilot.js", import.meta.url));
  const json = execFileSync(process.execPath, [script, "--node", "conditional-events", "--json"], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(json) as {
    scope: string;
    reviewed: boolean;
    modelRunsMeasured: boolean;
    node: { nodeId: string; researchTasks: string[]; evalCases: unknown[]; healthDecisionPoints: unknown[] };
  };
  assert.equal(parsed.scope, "authored_links_only");
  assert.equal(parsed.reviewed, false);
  assert.equal(parsed.modelRunsMeasured, false);
  assert.equal(parsed.node.nodeId, "conditional-events");
  assert.ok(parsed.node.researchTasks.includes("conditional-two-red"));
  assert.deepEqual(parsed.node.evalCases, []);
  assert.deepEqual(parsed.node.healthDecisionPoints, []);

  const bad = spawnSync(process.execPath, [script, "--node", "nonexistent-node"], { encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unknown knowledge node/);
});
