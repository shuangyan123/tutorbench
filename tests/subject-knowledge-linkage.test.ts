import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubjectLinkIndex,
  type SubjectLinkIndexInputs,
} from "../src/research/subject-knowledge-linkage.js";

function fixture(): SubjectLinkIndexInputs {
  return {
    sourceKeys: [
      "eval|math|fraction-v1", "eval|physics|mass-v2",
      "experimental|chem|atom-v1", "eval|science|ambiguous-v1",
    ],
    knowledgeNodes: [
      { disciplineId: "mathematics", id: "conservation" },
      { disciplineId: "physics", id: "conservation" },
      { disciplineId: "physics", id: "measurement" },
      { disciplineId: "chemistry", id: "conservation" },
    ],
    candidateLinks: [
      { sourceKey: "eval|math|fraction-v1", disciplineId: "mathematics",
        focusNodeIds: ["conservation"], supportingNodeIds: [] },
      { sourceKey: "eval|physics|mass-v2", disciplineId: "physics",
        focusNodeIds: ["measurement"], supportingNodeIds: ["conservation"] },
      { sourceKey: "experimental|chem|atom-v1", disciplineId: "chemistry",
        focusNodeIds: ["conservation"], supportingNodeIds: [] },
    ],
    explicitGapSourceKeys: ["eval|science|ambiguous-v1"],
  };
}
function altered(change: (value: {
  sourceKeys: string[];
  knowledgeNodes: Array<{ disciplineId: string; id: string }>;
  candidateLinks: Array<{ sourceKey: string; disciplineId: string; focusNodeIds: string[]; supportingNodeIds: string[] }>;
  explicitGapSourceKeys: string[];
}) => void): SubjectLinkIndexInputs {
  const value = structuredClone(fixture()) as {
    sourceKeys: string[];
    knowledgeNodes: Array<{ disciplineId: string; id: string }>;
    candidateLinks: Array<{ sourceKey: string; disciplineId: string; focusNodeIds: string[]; supportingNodeIds: string[] }>;
    explicitGapSourceKeys: string[];
  };
  change(value);
  return value;
}

test("domain-neutral index supports overlapping concept IDs only when discipline identity differs", () => {
  const original = fixture();
  const unchanged = JSON.stringify(original);
  const report = buildSubjectLinkIndex(original);
  assert.deepEqual(report.counts, {
    sources: 4,
    candidateLinks: 3,
    explicitGaps: 1,
    graphNodes: 4,
    focusNodes: 3,
    linkedNodes: 4,
    supportingOnlyNodes: 1,
  });
  assert.equal(report.scope, "authored_sources_only");
  assert.equal(report.independentlyReviewed, false);
  assert.equal(report.modelRunsMeasured, false);
  assert.equal(report.learnerOutcomesMeasured, false);
  assert.deepEqual(report.nodes.find(x => x.disciplineId === "physics" && x.id === "conservation")?.supportingSourceKeys,
    ["eval|physics|mass-v2"]);
  assert.deepEqual(report.nodes.find(x => x.disciplineId === "mathematics" && x.id === "conservation")?.focusSourceKeys,
    ["eval|math|fraction-v1"]);
  assert.deepEqual(report.nodes.find(x => x.disciplineId === "chemistry" && x.id === "conservation")?.focusSourceKeys,
    ["experimental|chem|atom-v1"]);
  assert.deepEqual(report.sources.find(x => x.sourceKey === "eval|science|ambiguous-v1"), {
    sourceKey: "eval|science|ambiguous-v1",
    disposition: "explicitly_unmapped",
    disciplineId: null,
    focusNodeIds: [],
    supportingNodeIds: [],
  });
  assert.equal(JSON.stringify(original), unchanged);
});

test("reversing input orders does not change the deterministic report", () => {
  const a = fixture();
  const b = altered(x => {
    x.sourceKeys.reverse(); x.knowledgeNodes.reverse();
    x.candidateLinks.reverse(); x.explicitGapSourceKeys.reverse();
  });
  assert.deepEqual(buildSubjectLinkIndex(a), buildSubjectLinkIndex(b));
});

test("missing sources and duplicate or stale references never become coverage", () => {
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.explicitGapSourceKeys.pop();
  })), /subject_index_incomplete/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.sourceKeys.push(x.sourceKeys[0]!);
  })), /subject_index_sources_invalid/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.candidateLinks.push(structuredClone(x.candidateLinks[0]!));
  })), /subject_index_candidate_duplicate/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.candidateLinks[0]!.sourceKey = "missing-case";
  })), /subject_index_source_stale/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.explicitGapSourceKeys[0] = "stale-gap";
  })), /subject_index_gap_stale/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.explicitGapSourceKeys.push(x.explicitGapSourceKeys[0]!);
  })), /subject_index_gap_duplicate/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.explicitGapSourceKeys[0] = x.candidateLinks[0]!.sourceKey;
  })), /subject_index_conflicting_disposition/);
});

test("cross-discipline phantom nodes and focus/support collisions fail closed", () => {
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    // A physics "measurement" node is not a chemistry node even if other names overlap.
    x.candidateLinks[1]!.disciplineId = "chemistry";
  })), /subject_index_node_missing/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.candidateLinks[0]!.focusNodeIds = ["phantom"];
  })), /subject_index_node_missing/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.candidateLinks[0]!.focusNodeIds = [];
  })), /subject_index_candidate_invalid/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.candidateLinks[1]!.supportingNodeIds.push("measurement");
  })), /subject_index_candidate_invalid/);
  assert.throws(() => buildSubjectLinkIndex(altered(x => {
    x.knowledgeNodes.push(structuredClone(x.knowledgeNodes[0]!));
  })), /subject_index_node_duplicate/);
});

test("the core never manufactures scored results, learner outcomes or prerequisites", () => {
  const report = buildSubjectLinkIndex(fixture());
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /studentMessage|rawTutorResponse|rubricResults|healthScore|masteryScore|learnerId|prerequisiteEdges/);
  assert.equal(report.counts.sources, report.counts.candidateLinks + report.counts.explicitGaps);
});
