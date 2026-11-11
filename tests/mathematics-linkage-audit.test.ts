import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseAcademicStructure } from "../src/contracts/academic-structure.js";
import { parseMathematicsExamAlignment } from "../src/contracts/mathematics-exam-alignment.js";
import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { parseMathChallengeEvidence } from "../src/contracts/math-challenge-evidence.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { loadTutorEvalDataset } from "../src/datasets/synthetic.js";
import { loadTutorScenarioSuiteVNext } from "../src/datasets/real-world.js";
import {
  buildMathematicsSubjectCoverageAudit,
  type MathematicsExplicitGapRegistry,
} from "../src/research/mathematics-linkage-audit.js";
import type { MathematicsPilotInputs, MathematicsPilotRegistry } from "../src/research/mathematics-linkage-pilot.js";

const base = new URL("../../scenarios/", import.meta.url);
async function sourceData(): Promise<{ inputs: MathematicsPilotInputs; gaps: MathematicsExplicitGapRegistry }> {
  const files = [
    "case-system-vnext/academic-structure-v0.1.json",
    "case-system-vnext/mathematics-exam-alignment-v0.1.json",
    "case-system-vnext/mathematics-knowledge-map-v0.1.json",
    "experimental/mathematics-eval-health-linkage-v0.1/links.json",
    "experimental/mathematics-eval-health-linkage-v0.1/unmapped.json",
    "experimental/mathematics-challenge-v0.1/evidence.json",
    "experimental/mathematics-challenge-v0.1/suite.json",
  ];
  const [raw, evaluation, health] = await Promise.all([
    Promise.all(files.map(path => readFile(new URL(path, base), "utf8"))),
    loadTutorEvalDataset(),
    loadTutorScenarioSuiteVNext(),
  ]);
  const [academic, exam, map, links, gaps, evidence, research] = raw.map(x => JSON.parse(x) as unknown);
  return {
    inputs: {
      academic: parseAcademicStructure(academic),
      exam: parseMathematicsExamAlignment(exam),
      map: parseMathematicsKnowledgeMap(map),
      pilot: links as MathematicsPilotRegistry,
      evaluation,
      health,
      evidence: parseMathChallengeEvidence(evidence),
      researchSuite: parseTutorScenarioSuiteVNext(research),
    },
    gaps: gaps as MathematicsExplicitGapRegistry,
  };
}

test("entire current canonical bilingual mathematics inventory and default Health scope is accounted for", async () => {
  const { inputs, gaps } = await sourceData();
  const result = buildMathematicsSubjectCoverageAudit(inputs, gaps);
  assert.equal(result.scope, "canonical_mathematics_eval_and_default_health");
  assert.equal(result.caseInventoryComplete, true);
  assert.equal(result.semanticsIndependentlyReviewed, false);
  assert.equal(result.runResultsInspected, false);
  assert.equal(result.learnerOutcomesMeasured, false);
  assert.deepEqual(result.counts, {
    canonicalEvalMathCases: 18,
    canonicalEvalMathCasesLinked: 12,
    canonicalEvalMathCasesUnmapped: 6,
    defaultHealthMathDecisionPoints: 13,
    defaultHealthMathDecisionPointsLinked: 12,
    defaultHealthMathDecisionPointsUnmapped: 1,
    candidateMappings: 24,
    explicitGaps: 7,
    independentlyReviewedMappings: 0,
    graphNodes: 44,
    graphNodesWithCanonicalOrHealthCandidate: 5,
    graphNodesWithPrimaryCanonicalOrHealthCandidate: 4,
    graphNodesWithResearchTask: 22,
  });
  assert.equal(result.inventory.length, 31);
  assert.equal(result.inventory.filter(x => x.mappingStatus === "candidate_linked").length, 24);
  assert.equal(result.inventory.filter(x => x.mappingStatus === "explicitly_unmapped").length, 7);
  assert.ok(result.inventory.every(x => x.independentReview === "not_reviewed"));
  assert.ok(result.inventory.some(x => x.source.id === "paired-multiplication-conceptual-001-zh-CN" &&
    x.mappingStatus === "explicitly_unmapped"));
  assert.ok(result.inventory.some(x => x.source.id === "ps-multiturn-hint-escalation" &&
    x.mappingStatus === "explicitly_unmapped"));
  assert.ok(result.inventory.some(x => x.source.id === "ps-frustration" &&
    x.knowledgeNodeIds.includes("integers-operations")));
  const fraction = result.nodes.find(x => x.nodeId === "fractions-units");
  assert.ok(fraction);
  assert.ok(fraction.candidateEvalCategories.includes("diagnosis"));
  assert.ok(fraction.candidateHealthDimensions.includes("learner_diagnosis"));
  const whole = result.nodes.find(x => x.nodeId === "units-whole");
  assert.ok(whole);
  assert.equal(whole.focusEvalCaseCount, 0);
  assert.ok(whole.supportingEvalCaseCount > 0);
  const weak = result.inventory.find(x => x.source.id === "weak-foundation-fractions-001");
  assert.ok(weak);
  assert.deepEqual(weak.focusNodeIds, ["fractions-units"]);
  assert.deepEqual(weak.supportingNodeIds, ["units-whole"]);
  assert.ok(result.nodes.find(x => x.nodeId === "conditional-events")!.researchTaskCount > 0);
  assert.equal(result.nodes.find(x => x.nodeId === "conditional-events")!.candidateEvalCaseCount, 0);
});

test("missing and contradictory semantic dispositions fail closed", async () => {
  const { inputs, gaps } = await sourceData();
  const withGaps = (edit: (data: MathematicsExplicitGapRegistry) => void) => {
    const changed = structuredClone(gaps) as MathematicsExplicitGapRegistry;
    edit(changed);
    return buildMathematicsSubjectCoverageAudit(inputs, changed);
  };
  assert.throws(() => withGaps(data => {
    (data.gaps as MathematicsExplicitGapRegistry["gaps"][number][]).pop();
  }), /mathematics_source_inventory_incomplete/);
  assert.throws(() => withGaps(data => {
    (data.gaps as MathematicsExplicitGapRegistry["gaps"][number][]).push(structuredClone(data.gaps[0]!));
  }), /mathematics_explicit_gap_duplicate/);
  assert.throws(() => withGaps(data => {
    (data.gaps[0]!.source as { version: string }).version = "stale";
  }), /mathematics_explicit_gap_stale_source/);
  assert.throws(() => withGaps(data => {
    (data.gaps[0]! as { reviewStatus: string }).reviewStatus = "approved";
  }), /mathematics_explicit_gap_invalid/);
  assert.throws(() => withGaps(data => {
    (data.gaps[0]!.source as { id: string; version: string }).id = "fraction-misconception-001";
    (data.gaps[0]!.source as { version: string }).version = "1.2.0";
  }), /mathematics_source_link_and_gap_conflict/);
  const missingLink = structuredClone(inputs.pilot) as MathematicsPilotRegistry;
  (missingLink.links as MathematicsPilotRegistry["links"][number][]).pop();
  assert.throws(() => buildMathematicsSubjectCoverageAudit({ ...inputs, pilot: missingLink }, gaps),
    /mathematics_source_inventory_incomplete/);
});

test("offline audit CLI returns evidence-bounded counts and marks unrepresented concepts", () => {
  const script = fileURLToPath(new URL("../src/cli/mathematics-linkage-pilot.js", import.meta.url));
  const output = execFileSync(process.execPath, [script, "--audit", "--json"], { encoding: "utf8" });
  const report = JSON.parse(output) as {
    scope: string;
    counts: { canonicalEvalMathCases: number; defaultHealthMathDecisionPoints: number; explicitGaps: number };
    semanticsIndependentlyReviewed: boolean;
    inventory: Array<{ source: { id: string }; mappingStatus: string }>;
  };
  assert.equal(report.scope, "canonical_mathematics_eval_and_default_health");
  assert.equal(report.counts.canonicalEvalMathCases, 18);
  assert.equal(report.counts.defaultHealthMathDecisionPoints, 13);
  assert.equal(report.counts.explicitGaps, 7);
  assert.equal(report.semanticsIndependentlyReviewed, false);
  assert.ok(report.inventory.some(row => row.source.id === "ps-multiturn-hint-escalation" &&
    row.mappingStatus === "explicitly_unmapped"));
  const invalid = spawnSync(process.execPath, [script, "--audit", "--node", "fractions-units"], { encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage/);
});
