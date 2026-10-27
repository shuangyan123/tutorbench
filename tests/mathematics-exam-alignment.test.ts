import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import {
  parseMathematicsExamAlignment,
  validateMathematicsExamCoverage,
} from "../src/contracts/mathematics-exam-alignment.js";

const base = new URL("../../scenarios/", import.meta.url);
async function load() {
  const [graph, suite, alignment] = await Promise.all([
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/suite.json", base), "utf8"),
    readFile(new URL("case-system-vnext/mathematics-exam-alignment-v0.1.json", base), "utf8"),
  ]);
  return {
    graph: parseMathematicsKnowledgeMap(JSON.parse(graph) as unknown),
    suite: parseTutorScenarioSuiteVNext(JSON.parse(suite) as unknown),
    exam: parseMathematicsExamAlignment(JSON.parse(alignment) as unknown),
  };
}

test("exam profiles link supported teaching cases without claiming exam authenticity", async () => {
  const { graph, suite, exam } = await load();
  assert.equal(exam.status, "author-proposed-unverified");
  assert.deepEqual(exam.profiles.map(p => p.id),
    ["cn-zhongkao-math-general", "cn-gaokao-math-national-2026", "cn-guokao-aptitude-2027"]);
  validateMathematicsExamCoverage(exam, graph, suite);
  assert.equal(exam.profiles[0]?.examFormat.minutes, null);
  assert.equal(exam.profiles[1]?.examFormat.minutes, null);
  assert.equal(exam.profiles[2]?.examFormat.minutes, 120);
  for (const profile of exam.profiles) {
    assert.equal(profile.examFormat.pointWeightsKnown, false);
    assert.ok(profile.sources.length >= 2);
    assert.ok(profile.authoringGaps.length >= 1);
    assert.ok(profile.modules.every(m => m.nodeIds.length > 0));
  }
});

test("exam profiles reject invented score weights and dangling knowledge or case mapping", async () => {
  const { exam, graph, suite } = await load();
  const fakeWeights = structuredClone(exam) as unknown as {
    profiles: Array<{ examFormat: Record<string, unknown> }>;
  };
  fakeWeights.profiles[0]!.examFormat["pointWeightsKnown"] = true;
  assert.throws(() => parseMathematicsExamAlignment(fakeWeights), /mathematics_exam_format_invalid/);

  const missingNode = structuredClone(exam) as unknown as {
    profiles: Array<{ modules: Array<{ nodeIds: string[]; caseIds: string[] }> }>;
  };
  missingNode.profiles[1]!.modules[0]!.nodeIds.push("nonexistent-knowledge-node");
  const validShape = parseMathematicsExamAlignment(missingNode);
  assert.throws(() => validateMathematicsExamCoverage(validShape, graph, suite),
    /mathematics_exam_coverage_invalid/);

  const missingCase = structuredClone(exam) as unknown as {
    profiles: Array<{ modules: Array<{ nodeIds: string[]; caseIds: string[] }> }>;
  };
  missingCase.profiles[2]!.modules[0]!.caseIds.push("nonexistent-math-case");
  const validCaseShape = parseMathematicsExamAlignment(missingCase);
  assert.throws(() => validateMathematicsExamCoverage(validCaseShape, graph, suite),
    /mathematics_exam_coverage_invalid/);
});
