import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseAcademicStructure } from "../src/contracts/academic-structure.js";
import { parseMathematicsExamAlignment } from "../src/contracts/mathematics-exam-alignment.js";
import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { loadTutorEvalDataset } from "../src/datasets/synthetic.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import {
  buildNaturalScienceCoverageAudit,
  parseNaturalScienceSeedMap,
  type NaturalScienceCandidateRegistry,
  type NaturalScienceGapRegistry,
  type NaturalScienceIntegrationInputs,
} from "../src/research/natural-sciences-linkage.js";

const root = new URL("../../scenarios/", import.meta.url);
async function inputs(): Promise<NaturalScienceIntegrationInputs> {
  const paths = [
    "case-system-vnext/academic-structure-v0.2.json",
    "case-system-vnext/mathematics-knowledge-map-v0.1.json",
    "case-system-vnext/mathematics-exam-alignment-v0.1.json",
    "experimental/natural-sciences-knowledge-v0.1/physics.json",
    "experimental/natural-sciences-knowledge-v0.1/chemistry.json",
    "experimental/natural-sciences-knowledge-v0.1/biology.json",
    "experimental/natural-sciences-knowledge-v0.1/links.json",
    "experimental/natural-sciences-knowledge-v0.1/unmapped.json",
    "real-world/case-system-vnext-executable-pilot-v0.1/suite.json",
    "experimental/prerequisite-accessibility-contrasts-v0.1/suite.json",
  ];
  const [texts, evalDataset] = await Promise.all([
    Promise.all(paths.map(p => readFile(new URL(p, root), "utf8"))),
    loadTutorEvalDataset(),
  ]);
  const files = texts.map(t => JSON.parse(t) as unknown);
  const math = parseMathematicsKnowledgeMap(files[1]);
  const exams = parseMathematicsExamAlignment(files[2]);
  return {
    academic: parseAcademicStructure(files[0]),
    mathematicsSummary: { id: math.id, domains: math.domains.length, nodes: math.nodes.length },
    mathematicsExamProfileIds: exams.profiles.map(p => p.id),
    maps: files.slice(3, 6).map(f => parseNaturalScienceSeedMap(f)),
    registry: files[6] as NaturalScienceCandidateRegistry,
    gaps: files[7] as NaturalScienceGapRegistry,
    experimentalSuites: files.slice(8, 10).map(f => parseTutorScenarioSuiteVNext(f)),
    evalDataset,
  };
}

test("new academic navigation registers physics, chemistry and biology without rewriting the mathematics registry", async () => {
  const i = await inputs(), report = buildNaturalScienceCoverageAudit(i);
  assert.equal(i.academic.id, "tutorbench-academic-structure-v0.2");
  assert.equal(i.academic.version, "0.2.0");
  assert.equal(i.academic.disciplines.length, 4);
  assert.deepEqual(i.academic.disciplineSystems.find(s => s.id === "natural-sciences")?.disciplineIds,
    ["physics", "chemistry", "biology"]);
  assert.equal(i.academic.knowledgeSystems.find(k => k.disciplineId === "mathematics")?.coverage.nodes, 44);
  assert.equal(i.academic.examSystems.length, 10);
  assert.deepEqual(report.counts, {
    subjects: 3,
    knowledgeNodes: 10,
    canonicalScienceEvalCases: 8,
    experimentalDecisionPoints: 9,
    candidateLinks: 15,
    explicitlyUnmapped: 2,
    focusNodes: 9,
    independentlyReviewed: 0,
  });
  assert.equal(report.inventory.length, 17);
  assert.equal(report.inventory.filter(r => r.mappingStatus === "candidate_linked").length, 15);
  assert.equal(report.inventory.filter(r => r.mappingStatus === "explicitly_unmapped").length, 2);
  assert.equal(report.inventoryComplete, true);
  assert.equal(report.semanticReviewCompleted, false);
  assert.equal(report.modelRunsMeasured, false);
  assert.equal(report.learnerOutcomesMeasured, false);
  assert.equal(report.officialCurriculumVerified, false);
  assert.equal(report.defaultTutorHealthCoverageMeasured, false);
  assert.deepEqual(report.subjects.map(s => ({ id: s.id, nodes: s.knowledgeNodes, linked: s.candidateLinks })),
    [{ id: "physics", nodes: 4, linked: 7 }, { id: "chemistry", nodes: 3, linked: 3 },
      { id: "biology", nodes: 3, linked: 5 }]);
});

test("science case classification is authored and source-typed, not inferred from a generic science label", async () => {
  const report = buildNaturalScienceCoverageAudit(await inputs());
  const gaps = report.inventory.filter(r => r.mappingStatus === "explicitly_unmapped");
  assert.deepEqual(gaps.map(r => r.source.id).sort(), ["science-graph-error-001", "science-graph-error-001-zh-CN"].sort());
  assert.ok(gaps.every(r => r.mappedDiscipline === null && r.focusNodeIds.length === 0));
  assert.ok(report.inventory.some(r => r.source.id === "science-density-knowledge-001-zh-CN" &&
    r.mappedDiscipline === "physics" && r.source.version === "1.1.0"));
  assert.ok(report.inventory.some(r => r.source.id === "science-photosynthesis-concept-001" &&
    r.mappedDiscipline === "biology"));
  assert.ok(report.inventory.some(r => r.source.id === "pac-c-a" &&
    r.mappedDiscipline === "chemistry" && r.source.suiteId === "prerequisite-accessibility-contrasts-v0.1"));
  assert.ok(report.inventory.some(r => r.source.id === "csvnext-physics-d1-graph" &&
    r.mappedDiscipline === "physics" && r.source.suiteVersion === "0.3.0"));
  const coefficient = report.nodes.find(n => n.id === "coefficient-vs-formula");
  assert.ok(coefficient);
  assert.equal(coefficient.focusCaseCount, 0);
  assert.equal(coefficient.supportingCaseCount, 2);
  assert.ok(report.nodes.find(n => n.id === "position-time-graph")!.experimentalHealthDimensionTags.includes("content_correctness"));
  assert.ok(report.nodes.find(n => n.id === "density-mass-volume")!.evalCategoryTags.length > 0);
  assert.ok(report.inventory.filter(r => r.source.kind === "experimental_decision_point")
    .every(r => r.declaredDiscipline !== null));
});

test("stale, duplicate, phantom and contradictory science source relationships fail closed", async () => {
  const base = await inputs();
  const withRegistry = (edit: (r: NaturalScienceCandidateRegistry) => void) => {
    const registry = structuredClone(base.registry) as NaturalScienceCandidateRegistry;
    edit(registry);
    return buildNaturalScienceCoverageAudit({ ...base, registry });
  };
  const withGaps = (edit: (r: NaturalScienceGapRegistry) => void) => {
    const gaps = structuredClone(base.gaps) as NaturalScienceGapRegistry;
    edit(gaps);
    return buildNaturalScienceCoverageAudit({ ...base, gaps });
  };
  assert.throws(() => withRegistry(r => {
    (r.links[0]!.source as { version: string }).version = "0.0.0";
  }), /science_link_stale_source/);
  assert.throws(() => withRegistry(r => {
    (r.links[0]!.nodes[0] as { id: string }).id = "nonexistent-node";
  }), /science_link_node_invalid/);
  assert.throws(() => withRegistry(r => {
    (r.links as NaturalScienceCandidateRegistry["links"][number][]).push(structuredClone(r.links[0]!));
  }), /science_link_duplicate/);
  assert.throws(() => withRegistry(r => {
    (r.links as NaturalScienceCandidateRegistry["links"][number][]).pop();
  }), /science_inventory_incomplete/);
  assert.throws(() => withRegistry(r => {
    const physics = r.links.find(x => x.source.id === "pac-p-a")!;
    (physics as { disciplineId: string }).disciplineId = "chemistry";
  }), /science_cross_discipline_mismatch/);
  assert.throws(() => withRegistry(r => {
    (r.sources.experimentalSuites[0] as { version: string }).version = "missing";
  }), /science_snapshot_identity_invalid/);
  assert.throws(() => withGaps(r => {
    (r.gaps[0]!.source as { version: string }).version = "1.0.0-stale";
  }), /science_gap_stale_source/);
  assert.throws(() => withGaps(r => {
    (r.gaps as NaturalScienceGapRegistry["gaps"][number][]).push(structuredClone(r.gaps[0]!));
  }), /science_gap_duplicate/);
  assert.throws(() => withGaps(r => {
    (r.gaps[0]!.source as { id: string }).id = "science-density-knowledge-001";
  }), /science_gap_stale_source|science_link_gap_conflict/);
  const changedAcademic = structuredClone(base.academic) as unknown as {
    knowledgeSystems: Array<{ id: string; coverage: { nodes: number } }>;
  };
  changedAcademic.knowledgeSystems.find(k => k.id === "physics-knowledge-seed-v0.1")!.coverage.nodes = 500;
  assert.throws(() => buildNaturalScienceCoverageAudit({
    ...base, academic: changedAcademic as unknown as NaturalScienceIntegrationInputs["academic"],
  }), /academic_structure_knowledge_coverage_mismatch/);
  const brokenGraph = structuredClone(base.maps[0]!) as unknown as { nodes: Array<{ id: string }> };
  brokenGraph.nodes.push({ id: brokenGraph.nodes[0]!.id });
  assert.throws(() => parseNaturalScienceSeedMap(brokenGraph), /science_map_node_invalid|science_map_graph_invalid/);
});

test("linkage has zero effect on original Eval/scenario inputs or historical mathematics audit", async () => {
  const i = await inputs();
  const beforeEval = JSON.stringify(i.evalDataset);
  const beforeSuites = i.experimentalSuites.map(s => JSON.stringify(tutorScenarioSuiteToTutorEvalDataset(s)));
  const report = buildNaturalScienceCoverageAudit(i);
  assert.equal(JSON.stringify(i.evalDataset), beforeEval);
  assert.deepEqual(i.experimentalSuites.map(s => JSON.stringify(tutorScenarioSuiteToTutorEvalDataset(s))), beforeSuites);
  const reportJson = JSON.stringify(report);
  assert.doesNotMatch(reportJson, /rawTutorResponse|rawJudgeResult|rubricResults|healthScore|studentMessage/);
  assert.equal(report.counts.independentlyReviewed, 0);
});

test("read-only science CLI returns authored coverage and rejects an invalid concept or flag", () => {
  const script = fileURLToPath(new URL("../src/cli/natural-sciences-linkage.js", import.meta.url));
  const output = execFileSync(process.execPath, [script, "--subject", "chemistry", "--json"], { encoding: "utf8" });
  const o = JSON.parse(output) as {
    counts: { canonicalScienceEvalCases: number; experimentalDecisionPoints: number };
    nodes: Array<{ id: string; disciplineId: string }>;
    semanticReviewCompleted: boolean; defaultTutorHealthCoverageMeasured: boolean;
  };
  assert.equal(o.counts.canonicalScienceEvalCases, 8);
  assert.equal(o.counts.experimentalDecisionPoints, 9);
  assert.ok(o.nodes.length === 3 && o.nodes.every(n => n.disciplineId === "chemistry"));
  assert.equal(o.semanticReviewCompleted, false);
  assert.equal(o.defaultTutorHealthCoverageMeasured, false);
  const valid = execFileSync(process.execPath, [script, "--subject", "physics", "--node", "ideal-series-ohm", "--json"], { encoding: "utf8" });
  assert.equal((JSON.parse(valid) as { nodes: Array<{ id: string }> }).nodes[0]?.id, "ideal-series-ohm");
  const bad = spawnSync(process.execPath, [script, "--subject", "biology", "--node", "ideal-series-ohm"], { encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unknown concept node/);
  const unknown = spawnSync(process.execPath, [script, "--subject", "astrology"], { encoding: "utf8" });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Usage/);
});
