import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMathematicsKnowledgeMap } from "../src/contracts/mathematics-knowledge-map.js";
import { extendKnowledgeGraph, inspectKnowledgeCoverage } from "../src/research/exam-knowledge-coverage.js";
import delta from "../src/research/data/math-graph-v0.9.json" with { type: "json" };
import snapshot from "../scenarios/case-system-vnext/exam-specifications/requirements-0.9.0.json" with { type: "json" };
import gap from "../scenarios/case-system-vnext/exam-specifications/requirements-0.3.0.json" with { type: "json" };

const path = (v: string) => "scenarios/case-system-vnext/exam-specifications/requirements-" + v + ".json";
const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", "--requirements", ...args]);
const before = cli(path("0.7.0"));
const baseline = JSON.parse(before.toString()) as Parameters<typeof inspectKnowledgeCoverage>[1];
const original = parseMathematicsKnowledgeMap(JSON.parse(readFileSync("scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json", "utf8")));
const baseGraph = parseMathematicsKnowledgeMap({ ...original, version: gap.graphVersion, nodes: [...original.nodes, ...gap.addedNodes] });
const report = inspectKnowledgeCoverage(snapshot, baseline, original);

test("immutable replay and additive diff keep clauses, mapping edges and graph nodes distinct", () => {
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  assert.equal(sha(before), "11484192aad66cd837b9365339efb1d39e489e0b2e5a2b038d679118a68cecd1");
  assert.equal(sha(cli("--source-governance")), "d12da3d210be7c492184435443eeca60acc007fd08f75fec44c229c256d516c9");
  assert.deepEqual(JSON.parse(cli(path("0.9.0")).toString()), report);
  const diff = JSON.parse(cli(path("0.7.0"), path("0.9.0")).toString()) as {
    changes: Record<"added" | "retained" | "removed" | "relocated", string[]>; concepts: { added: string[]; removed: string[] } };
  assert.deepEqual(Object.values(diff.changes).map(a => a.length), [202, 0, 0, 147]);
  assert.deepEqual(diff.concepts, { added: [...report.expansion.newConcepts].sort(), removed: [] });
  assert.deepEqual(report.knowledgeGraph.nodes.slice(0, 46), baseGraph.nodes);
  assert.deepEqual(report.requirements.slice(0, 147), baseline.requirements);
  assert.equal(report.scopes.length, 47);
  assert.equal(report.unique_source_clauses, 349);
  assert.equal(report.unique_linked_requirements, 211);
  assert.equal(report.expansion.linkedClauses, 189);
  assert.equal(report.expansion.candidateLinks, 245);
  assert.equal(report.expansion.independentlyReviewed, 0);
  assert.equal(report.wholeExamDenominator, null);
});

test("checked page boundaries preserve independent topic, tier, year and operation", () => {
  const scopes = report.scopes.slice(18);
  assert.deepEqual(scopes.map(s => s.requirements_in_scope),
    [3,8,15,5,3,5,6,1,2,3,5,5,5,7,9,12,14,21,3,2,2,3,6,7,9,5,16,3,17]);
  assert.ok(scopes.filter(s => s.id.startsWith("sat-")).every(s => s.parent.includes("/ SAT /") && s.session === null));
  assert.deepEqual(report.observedEmptyFocus.map(r => [r.track, r.pdfPage, r.redFocusBullets]), [["GK",6,0],["LK",7,0]]);
  assert.deepEqual(scopes.filter(s => s.session !== null).map(s => s.id), ["nw-focus-gk-geometry","nw-focus-lk-geometry"]);
  const row = (id: string) => report.requirements.find(r => r.requirement_id === id)!;
  assert.match(row("cn-order/2").summary, /非负.*√\(ab\)≤\(a\+b\)\/2/);
  assert.match(row("cn-order/2").locator, /printed 16–17, PDF 24–25/);
  assert.equal(row("cn-order/2").source_sha256, "cc4d3a20daa09f5185037e93fbacd58f7df1147392e3dae4bf261c3700ba4195");
  assert.match(row("nw-lk-geometry/G7").summary, /three unknowns.*without digital/);
  assert.match(row("sat-circles/05").summary, /\(x−h\)²\+\(y−k\)²=r²/);
  const vector = row("cn-plane-vectors/4.2");
  assert.ok("concepts" in vector && vector.concepts.length === 2 && vector.decision === "multi-concept");
  assert.ok(report.comparisons.slice(0,2).every(c => new Set(c.examples.map(r => r.edition)).size === 3));
});

test("reject edits to released counts, source, anchor, action and author status", () => {
  for (const change of [
    (s: typeof snapshot) => s.requirements.pop(),
    (s: typeof snapshot) => { s.requirements[0]!.anchor = "Equivalent expressions"; },
    (s: typeof snapshot) => { s.requirements[0]!.scope = "PSAT"; },
    (s: typeof snapshot) => { s.requirements[0]!.summary = "different operation"; },
    (s: typeof snapshot) => Object.assign(s.requirements[0]!, { review: "independently-approved" }),
  ]) {
    const edited = structuredClone(snapshot);
    change(edited);
    assert.throws(() => inspectKnowledgeCoverage(edited, baseline, original), /knowledge requirements/);
  }
});

test("graph contract rejects duplicate identities, dangling and cyclic edges and unsupported evidence", () => {
  for (const change of [
    (d: typeof delta) => { d.addedNodes[0]!.id = original.nodes[0]!.id; },
    (d: typeof delta) => { d.aliases["quadratic-equations"] = original.nodes[0]!.label; },
    (d: typeof delta) => { d.addedNodes[0]!.prerequisiteIds = ["absent"]; },
    (d: typeof delta) => { d.addedNodes[0]!.prerequisiteIds = [d.addedNodes[0]!.id]; },
    (d: typeof delta) => { d.knowledgeRelations[0]!.relationType = "necessary"; },
    (d: typeof delta) => { d.knowledgeRelations[0]!.evidenceStatus = "expert-reviewed"; },
  ]) {
    const edited = structuredClone(delta);
    change(edited);
    assert.throws(() => extendKnowledgeGraph(baseGraph, edited));
  }
});
