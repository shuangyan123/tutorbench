import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseMathematicsKnowledgeMap, type MathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import type { TutorEvalDataset } from "../src/contracts/tutor-eval.js";
import type { TutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext.js";
import { loadTutorEvalDataset } from "../src/datasets/synthetic.js";
import { loadTutorScenarioSuiteVNext, tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";

interface PilotLink {
  source: {
    kind: "eval_case" | "health_decision_point";
    id: string;
    version: string;
    decisionPointId: string | null;
  };
  nodes: Array<{ id: string; role: "focus" | "supporting" }>;
  evidenceAnchor: "tutorInput.learningObjective" | "learningContext.learningObjective";
  rationale: string;
}
interface PilotRegistry {
  schemaVersion: 1;
  id: string;
  version: string;
  status: "author-proposed-unreviewed";
  sources: {
    knowledgeMap: { id: string; version: string };
    evalDataset: { id: string; version: string };
    healthSuite: { id: string; version: string };
  };
  links: PilotLink[];
}

const scenarioBase = new URL("../../scenarios/", import.meta.url);

async function sources() {
  const [rawGraph, rawLinks, evaluation, health] = await Promise.all([
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", scenarioBase), "utf8"),
    readFile(new URL("experimental/mathematics-eval-health-linkage-v0.1/links.json", scenarioBase), "utf8"),
    loadTutorEvalDataset(),
    loadTutorScenarioSuiteVNext(),
  ]);
  return {
    map: parseMathematicsKnowledgeMap(JSON.parse(rawGraph) as unknown),
    pilot: JSON.parse(rawLinks) as PilotRegistry,
    evaluation,
    health,
  };
}

/** A read-only, intentionally narrow pilot gate; it does not validate the educational meaning of a link. */
function checkPilot(
  pilot: PilotRegistry,
  map: MathematicsKnowledgeMap,
  evaluation: TutorEvalDataset,
  health: TutorScenarioSuiteVNext,
): void {
  if (pilot.schemaVersion !== 1 ||
      pilot.id !== "mathematics-eval-health-knowledge-linkage-pilot-v0.1" ||
      pilot.version !== "0.1.0" || pilot.status !== "author-proposed-unreviewed" ||
      pilot.sources.knowledgeMap.id !== map.id || pilot.sources.knowledgeMap.version !== map.version ||
      pilot.sources.evalDataset.id !== evaluation.id || pilot.sources.evalDataset.version !== evaluation.version ||
      pilot.sources.healthSuite.id !== health.id || pilot.sources.healthSuite.version !== health.version) {
    throw new Error("pilot_source_snapshot_invalid");
  }
  if (map.status !== "author-proposed-uncalibrated") {
    throw new Error("pilot_knowledge_status_invalid");
  }
  const compiledHealth = tutorScenarioSuiteToTutorEvalDataset(health);
  const nodeIds = new Set(map.nodes.map(item => item.id));
  const seen = new Set<string>();
  for (const link of pilot.links) {
    const source = link.source;
    if (!source || !source.id || !source.version || !Array.isArray(link.nodes) || link.nodes.length === 0 ||
        typeof link.rationale !== "string" || !link.rationale.trim()) {
      throw new Error("pilot_link_shape_invalid");
    }
    const sourceKey = [source.kind, source.id, source.version, source.decisionPointId ?? ""].join(":");
    if (seen.has(sourceKey)) throw new Error("pilot_link_duplicate");
    seen.add(sourceKey);
    const linkedNodes = new Set<string>();
    for (const node of link.nodes) {
      if (!nodeIds.has(node.id) || !["focus", "supporting"].includes(node.role) || linkedNodes.has(node.id)) {
        throw new Error("pilot_knowledge_node_invalid");
      }
      linkedNodes.add(node.id);
    }
    if (!link.nodes.some(node => node.role === "focus")) throw new Error("pilot_focus_missing");

    if (source.kind === "eval_case") {
      if (source.decisionPointId !== null || link.evidenceAnchor !== "tutorInput.learningObjective") {
        throw new Error("pilot_eval_anchor_invalid");
      }
      const match = evaluation.cases.find(item => item.id === source.id && item.version === source.version);
      if (!match || match.metadata.subject !== "mathematics" || (match.locale ?? "en") !== "en" ||
          !match.tutorInput.learningObjective.trim()) {
        throw new Error("pilot_eval_identity_invalid");
      }
    } else if (source.kind === "health_decision_point") {
      if (!source.decisionPointId || link.evidenceAnchor !== "learningContext.learningObjective") {
        throw new Error("pilot_health_anchor_invalid");
      }
      const scenario = health.scenarios.find(item => item.identity.id === source.id && item.identity.version === source.version);
      const point = scenario?.decisionPoints.find(item => item.id === source.decisionPointId);
      const compiled = compiledHealth.cases.find(item => item.id === point?.evaluationCaseId);
      if (!scenario || scenario.learningContext.subject !== "mathematics" ||
          !scenario.learningContext.learningObjective.trim() || !point ||
          compiled?.version !== source.version + ":" + point.id) {
        throw new Error("pilot_health_identity_invalid");
      }
    } else {
      throw new Error("pilot_source_kind_invalid");
    }
  }
}

test("math pilot links are pinned to existing knowledge nodes and exact executable sources", async () => {
  const { map, pilot, evaluation, health } = await sources();
  checkPilot(pilot, map, evaluation, health);
  assert.equal(pilot.links.length, 7);
  assert.equal(pilot.links.filter(link => link.source.kind === "eval_case").length, 3);
  assert.equal(pilot.links.filter(link => link.source.kind === "health_decision_point").length, 4);
  assert.deepEqual(new Set(pilot.links.flatMap(link => link.nodes.map(node => node.id))), new Set([
    "fractions-units", "fraction-equivalence", "linear-equations",
  ]));
  assert.equal(
    pilot.links.find(link => link.source.id === "fraction-misconception-001")?.source.version,
    "1.2.0",
  );
  const serialized = JSON.stringify(pilot);
  assert.doesNotMatch(serialized, /rawTutorResponse|rawJudgeResult|evaluatorOnly|studentMessage|healthScore/);
});

test("knowledge-node reverse lookup distinguishes Eval and Health links from existing research tasks", async () => {
  const { map, pilot, evaluation, health } = await sources();
  checkPilot(pilot, map, evaluation, health);
  const linked = (nodeId: string, kind: PilotLink["source"]["kind"]) =>
    pilot.links.filter(link => link.source.kind === kind &&
      link.nodes.some(node => node.id === nodeId)).map(link => link.source.id).sort();

  assert.deepEqual(linked("fractions-units", "eval_case"), [
    "fraction-misconception-001", "paired-fraction-conceptual-001",
  ]);
  assert.deepEqual(linked("fractions-units", "health_decision_point"), [
    "ps-false-confidence", "ps-same-misconception",
  ]);
  assert.deepEqual(linked("linear-equations", "eval_case"), ["hint-only-linear-equation-001"]);
  assert.deepEqual(linked("linear-equations", "health_decision_point"), [
    "ps-first-mistake", "ps-repeated-mistake",
  ]);

  // No linkage is NOT a claim that the mathematics topic does not exist.
  assert.deepEqual(linked("conditional-events", "eval_case"), []);
  assert.deepEqual(linked("conditional-events", "health_decision_point"), []);
  assert.deepEqual(map.caseMappings.find(item => item.taskId === "conditional-two-red")?.nodeIds,
    ["combinations", "conditional-events"]);
});

test("pilot rejects stale versions, phantom nodes, duplicate rows, and mismatched decision points", async () => {
  const { map, pilot, evaluation, health } = await sources();
  const stale = structuredClone(pilot);
  stale.links[0]!.source.version = "1.1.0";
  assert.throws(() => checkPilot(stale, map, evaluation, health), /pilot_eval_identity_invalid/);

  const wrongNode = structuredClone(pilot);
  wrongNode.links[0]!.nodes[0]!.id = "unregistered-concept";
  assert.throws(() => checkPilot(wrongNode, map, evaluation, health), /pilot_knowledge_node_invalid/);

  const wrongSuite = structuredClone(pilot);
  wrongSuite.sources.healthSuite.version = "0.0.0";
  assert.throws(() => checkPilot(wrongSuite, map, evaluation, health), /pilot_source_snapshot_invalid/);

  const duplicate = structuredClone(pilot);
  duplicate.links.push(structuredClone(duplicate.links[0]!));
  assert.throws(() => checkPilot(duplicate, map, evaluation, health), /pilot_link_duplicate/);

  const wrongPoint = structuredClone(pilot);
  const healthRow = wrongPoint.links.find(link => link.source.kind === "health_decision_point")!;
  healthRow.source.decisionPointId = "phantom-decision-point";
  assert.throws(() => checkPilot(wrongPoint, map, evaluation, health), /pilot_health_identity_invalid/);
});
