import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { parseMathChallengeEvidence, validateMathChallengeCoverage } from "../src/contracts/math-challenge-evidence.js";
import { parseMathematicsKnowledgeMap, validateMathematicsTaskCoverage } from "../src/contracts/mathematics-knowledge-map.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";

const base = new URL("../../scenarios/", import.meta.url);
async function load() {
  const [graph, evidence, suite] = await Promise.all([
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/evidence.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/suite.json", base), "utf8"),
  ]);
  return {
    graph: parseMathematicsKnowledgeMap(JSON.parse(graph) as unknown),
    evidence: parseMathChallengeEvidence(JSON.parse(evidence) as unknown),
    suite: parseTutorScenarioSuiteVNext(JSON.parse(suite) as unknown),
  };
}

test("proposed math knowledge graph is acyclic and traces all executable task structures", async () => {
  const { graph, evidence, suite } = await load();
  assert.equal(graph.domains.length, 8);
  assert.equal(graph.nodes.length, 44);
  assert.equal(graph.status, "author-proposed-uncalibrated");
  validateMathChallengeCoverage(evidence, suite);
  const coverage = validateMathematicsTaskCoverage(graph, evidence);
  assert.equal(graph.caseMappings.length, 16);
  assert.equal(coverage.mappedNodes, 22);
  assert.equal(coverage.unmappedNodes, 22);
  assert.equal(evidence.tasks.length, 16);
  assert.equal(suite.scenarios.length, 20);
  const compiled = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(compiled.cases.length, 20);
  for (const scenario of suite.scenarios) {
    const result = compiled.cases.find(c => c.id === scenario.identity.id);
    assert.ok(result);
    const visible = JSON.stringify(toTutorTurnInput(result));
    assert.ok(!visible.includes("verifiedResult"));
    assert.ok(!visible.includes("anticipatedChallenge"));
    assert.ok(!visible.includes("commonMisconception"));
    assert.ok(!visible.includes("mathematics-knowledge-map"));
    assert.equal(scenario.decisionPoints.length, 1);
    assert.equal(scenario.decisionPoints[0]?.evaluationCriteria.length, 2);
  }
});

test("math knowledge graph rejects broken dependencies, cycles and phantom coverage", async () => {
  const { graph, evidence } = await load();
  const broken = structuredClone(graph) as unknown as {
    nodes: Array<{ id: string; prerequisiteIds: string[] }>;
  };
  broken.nodes[0]!.prerequisiteIds.push("not-a-real-node");
  assert.throws(() => parseMathematicsKnowledgeMap(broken), /mathematics_knowledge_prerequisite_invalid/);

  const loop = structuredClone(graph) as unknown as {
    nodes: Array<{ id: string; prerequisiteIds: string[] }>;
  };
  loop.nodes.find(n => n.id === "units-whole")!.prerequisiteIds.push("fractions-units");
  assert.throws(() => parseMathematicsKnowledgeMap(loop), /mathematics_knowledge_cycle/);

  const duplicate = structuredClone(graph) as unknown as {
    caseMappings: Array<{ taskId: string; nodeIds: string[] }>;
  };
  duplicate.caseMappings.push(duplicate.caseMappings[0]!);
  assert.throws(() => parseMathematicsKnowledgeMap(duplicate), /mathematics_knowledge_mapping_invalid/);

  const dropped = { ...graph, caseMappings: graph.caseMappings.slice(1) };
  assert.throws(() => validateMathematicsTaskCoverage(dropped, evidence), /mathematics_knowledge_task_coverage_mismatch/);
});

test("mathematical reference sanity checks cover lower, secondary and university-intro topics", async () => {
  const { evidence } = await load();
  const ids = new Set(evidence.tasks.map(t => t.id));
  for (const id of ["successive-percentage-base", "rational-equation-excluded-root",
    "function-composition-domains", "decreasing-logarithm-inequality",
    "circle-line-tangency-constraint", "simpson-paradox-unequal-mixtures",
    "recurrence-mathematical-induction", "closed-interval-optimization-endpoints",
    "linear-system-consistency-versus-rank"]) assert.ok(ids.has(id));

  assert.equal(200 * 1.2 * 0.8, 192);
  assert.equal(2 / 3 + 1 / 4, 11 / 12);
  // Algebraic cancellation is only valid on its original non-zero-denominator domain.
  assert.equal(1 - 1, 0);
  // Composition: f(g(-2)) exists, but g(f(-2)) does not on the real domain.
  assert.ok((-2) ** 2 - 1 >= 0);
  assert.ok(-2 - 1 < 0);
  // Log_{1/2}(x-1) > -1 holds for 1 < x < 3.
  assert.ok(Math.log(2 - 1) / Math.log(0.5) > -1);
  assert.equal(Math.log(3 - 1) / Math.log(0.5), -1);
  assert.equal((3 / 2) ** 2, 9 / 4);
  // Tangency at (0,5) for y=mx+5 means m=0, otherwise second x is nonzero.
  for (const m of [-3, -1, 0, 1, 3]) {
    const otherX = -10 * m / (1 + m * m);
    assert.equal(otherX === 0, m === 0);
  }
  // Physically distinct tiles A,A,B,B can produce only six distinct 3-letter strings.
  const tiles = ["A", "A", "B", "B"], strings = new Set<string>();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
    for (let k = 0; k < 4; k++)
      if (i !== j && j !== k && i !== k) strings.add(tiles[i]! + tiles[j]! + tiles[k]!);
  assert.equal(strings.size, 6);
  assert.equal(90 / (90 + 495), 2 / 13);
  assert.equal(9 / 10 > 80 / 100, true);
  assert.equal(20 / 100 > 1 / 10, true);
  assert.ok(29 / 110 < 81 / 110);
  for (let n = 1; n <= 10; n++) {
    let a = 1;
    for (let k = 1; k < n; k++) a = 2 * a + 1;
    assert.equal(a, 2 ** n - 1);
  }
  assert.ok(-1 + 1 / -1 < 2);
  const f = (x: number) => x ** 3 - 3 * x;
  assert.deepEqual([-2, -1, 1, 2].map(f), [-2, 2, -2, 2]);
  assert.notEqual(2 * 3, 7);
});

test("prerequisite hypotheses are never accepted as validated mastery evidence", async () => {
  const { graph } = await load();
  assert.ok(graph.nodes.every(node => node.prerequisiteEvidence === "author-hypothesis"));
  const invalid = structuredClone(graph) as unknown as {
    nodes: Array<{ prerequisiteEvidence?: string }>;
  };
  invalid.nodes[0]!.prerequisiteEvidence = "validated";
  assert.throws(() => parseMathematicsKnowledgeMap(invalid), /mathematics_knowledge_node_invalid/);
  const stages = new Map(["primary", "lower-secondary", "upper-secondary", "university-intro"].map((id, i) => [id, i]));
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  for (const node of graph.nodes)
    for (const parent of node.prerequisiteIds)
      assert.ok(stages.get(nodes.get(parent)!.stage)! <= stages.get(node.stage)!);
});
