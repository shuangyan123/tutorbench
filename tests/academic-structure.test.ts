import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseAcademicStructure, validateAcademicStructureReferences, validateAcademicStructureRegistryReferences } from "../src/contracts/academic-structure.js";
import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { parseMathematicsExamAlignment } from "../src/contracts/mathematics-exam-alignment.js";

const root = new URL("../../scenarios/case-system-vnext/", import.meta.url);
const loadJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), "utf8")) as unknown;

test("four-layer navigation classifies mathematics once, and every exam references the same knowledge system", async () => {
  const structure = parseAcademicStructure(await loadJson("academic-structure-v0.1.json"));
  const graph = parseMathematicsKnowledgeMap(await loadJson("mathematics-knowledge-map-v0.1.json"));
  const exams = parseMathematicsExamAlignment(await loadJson("mathematics-exam-alignment-v0.1.json"));
  validateAcademicStructureReferences(structure, graph, exams);
  assert.equal(structure.disciplines.length, 1);
  assert.equal(structure.disciplines[0]?.id, "mathematics");
  assert.equal(structure.disciplines[0]?.systemId, "formal-sciences");
  assert.equal(structure.disciplineSystems.length, 5);
  assert.equal(structure.knowledgeSystems.length, 1);
  assert.equal(structure.examSystems.length, 10);
  assert.equal(structure.examSystems.flatMap(x => x.profileIds).length, 16);
  assert.ok(structure.examSystems.every(x => x.knowledgeSystemIds.includes(graph.id)));
  assert.equal(graph.nodes.length, 44);
  assert.equal(graph.domains.length, 8);
});

test("four-layer navigation rejects dangling discipline, knowledge and exam identifiers", async () => {
  const structure = parseAcademicStructure(await loadJson("academic-structure-v0.1.json"));
  const graph = parseMathematicsKnowledgeMap(await loadJson("mathematics-knowledge-map-v0.1.json"));
  const exams = parseMathematicsExamAlignment(await loadJson("mathematics-exam-alignment-v0.1.json"));

  const brokenSubject = structuredClone(structure) as unknown as {
    disciplines: Array<{ id: string; systemId: string }>;
  };
  brokenSubject.disciplines[0]!.systemId = "unknown-system";
  assert.throws(() => parseAcademicStructure(brokenSubject), /academic_structure_discipline_link_invalid/);

  const brokenKnowledge = structuredClone(structure) as unknown as {
    examSystems: Array<{ knowledgeSystemIds: string[]; profileIds: string[] }>;
  };
  brokenKnowledge.examSystems[0]!.knowledgeSystemIds = ["missing-knowledge"];
  assert.throws(() => parseAcademicStructure(brokenKnowledge), /academic_structure_exam_link_invalid/);

  const doubleMappedProfile = structuredClone(structure) as unknown as {
    examSystems: Array<{ knowledgeSystemIds: string[]; profileIds: string[] }>;
  };
  doubleMappedProfile.examSystems[0]!.profileIds.push(structure.examSystems[1]!.profileIds[0]!);
  const validStructure = parseAcademicStructure(doubleMappedProfile);
  assert.throws(() => validateAcademicStructureReferences(validStructure, graph, exams),
    /academic_structure_exam_profile_mismatch/);

  const inaccurateCoverage = structuredClone(structure) as unknown as {
    knowledgeSystems: Array<{ coverage: { nodes: number } }>;
  };
  inaccurateCoverage.knowledgeSystems[0]!.coverage.nodes = 100;
  const validShape = parseAcademicStructure(inaccurateCoverage);
  assert.throws(() => validateAcademicStructureReferences(validShape, graph, exams),
    /academic_structure_knowledge_coverage_mismatch/);
});

test("each examination profile has its own reviewer guide; no Chinese default for overseas exams", async () => {
  const structure = parseAcademicStructure(await loadJson("academic-structure-v0.1.json"));
  const config = await loadJson("mathematics-exam-locales-v0.1.json") as {
    entries: Array<{ profileId: string; primaryLocale: string; reviewGuide: string }>;
  };
  const expected = new Set(structure.examSystems.flatMap(x => x.profileIds));
  assert.equal(config.entries.length, expected.size);
  assert.equal(new Set(config.entries.map(e => e.profileId)).size, expected.size);
  for (const entry of config.entries) {
    assert.ok(expected.has(entry.profileId));
    assert.ok(["zh-CN", "en-US", "en-GB", "en-001"].includes(entry.primaryLocale));
    assert.ok(entry.reviewGuide.startsWith("docs/"));
    const guide = await readFile(new URL("../../" + entry.reviewGuide, import.meta.url), "utf8");
    assert.ok(guide.trim().length > 200);
    if (!entry.profileId.startsWith("cn-"))
      assert.notEqual(entry.primaryLocale, "zh-CN");
  }
});

test("non-mathematics examinations may reference independent knowledge registries", async () => {
  const structure = parseAcademicStructure(await loadJson("academic-structure-v0.1.json"));
  const graph = parseMathematicsKnowledgeMap(await loadJson("mathematics-knowledge-map-v0.1.json"));
  const exams = parseMathematicsExamAlignment(await loadJson("mathematics-exam-alignment-v0.1.json"));
  const extended = structuredClone(structure) as unknown as {
    disciplineSystems: Array<{ id: string; disciplineIds: string[] }>;
    disciplines: Array<{ id: string; labelZh: string; labelEn: string; systemId: string; knowledgeSystemIds: string[] }>;
    knowledgeSystems: Array<{ id: string; labelZh: string; labelEn: string; disciplineId: string; registryPath: string; coverage: { domains: number; nodes: number }; status: string }>;
    examSystems: Array<{ id: string; labelZh: string; labelEn: string; profileIds: string[]; knowledgeSystemIds: string[]; status: string }>;
  };
  extended.disciplineSystems.find(system => system.id === "natural-sciences")!.disciplineIds.push("physics");
  extended.disciplines.push({
    id: "physics", labelZh: "物理", labelEn: "Physics",
    systemId: "natural-sciences", knowledgeSystemIds: ["physics-map-v0.1"],
  });
  extended.knowledgeSystems.push({
    id: "physics-map-v0.1", labelZh: "物理知识", labelEn: "Physics knowledge",
    disciplineId: "physics", registryPath: "test/physics.json",
    coverage: { domains: 2, nodes: 5 }, status: "author-proposed",
  });
  extended.examSystems.push({
    id: "physics-exam", labelZh: "物理考试", labelEn: "Physics examination",
    profileIds: ["physics-exam-2026"], knowledgeSystemIds: ["physics-map-v0.1"],
    status: "author-proposed-alignment",
  });
  const parsed = parseAcademicStructure(extended);
  const registries = [
    { id: graph.id, domains: graph.domains.length, nodes: graph.nodes.length },
    { id: "physics-map-v0.1", domains: 2, nodes: 5 },
  ];
  const profileIds = [...exams.profiles.map(profile => profile.id), "physics-exam-2026"];
  assert.doesNotThrow(() => validateAcademicStructureRegistryReferences(parsed, registries, profileIds));
  const wrong = registries.map(x => ({ ...x }));
  wrong[1]!.nodes = 6;
  assert.throws(
    () => validateAcademicStructureRegistryReferences(parsed, wrong, profileIds),
    /academic_structure_knowledge_coverage_mismatch/,
  );
  assert.throws(
    () => validateAcademicStructureRegistryReferences(parsed, registries, profileIds.slice(1)),
    /academic_structure_exam_profile_mismatch/,
  );
});
