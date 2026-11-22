import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import snapshot from "../scenarios/case-system-vnext/exam-specifications/requirements-1.0.0.json" with { type: "json" };
import { extendKnowledgeGraph } from "../src/research/exam-knowledge-coverage.js";
import { inspectMathKnowledgeAudit } from "../src/research/math-knowledge-audit.js";

const path = (v: string) => "scenarios/case-system-vnext/exam-specifications/requirements-" + v + ".json";
const cli = (...args: string[]) => execFileSync(process.execPath,
  ["dist/src/cli/exam-specifications.js", "--requirements", ...args], { maxBuffer: 2_000_000 });
const historical = cli(path("0.9.0"));
const base = JSON.parse(historical.toString()) as Parameters<typeof inspectMathKnowledgeAudit>[1];
const report = inspectMathKnowledgeAudit(snapshot, base);

test("reconcile every original node, edge and source gap at its historical location", () => {
  assert.equal(createHash("sha256").update(historical).digest("hex"), "45f6560a6e4d669ca8eaafdcdef679c98815d1a1b160d91ae33b6822049d964e");
  assert.deepEqual(report.baseline, { graphNodes: 90, clauses: 349, unmapped: 138, linked: 211, boundedSections: 47 });
  assert.deepEqual(report.nodeAudit.map(r => r.id), base.knowledgeGraph.nodes.map(n => n.id));
  assert.equal(report.nodeAudit.flatMap(r => r.incoming).length, 105);
  const missing = base.requirements.filter(r => r.alignment_status === "unmapped");
  assert.deepEqual(report.worklist.map(r => r.sourceId), missing.map(r => r.requirement_id));
  for (const [i, row] of report.worklist.entries()) {
    assert.equal(row.edition, missing[i]!.source_edition);
    assert.equal(row.locator, missing[i]!.locator);
    assert.equal(row.sha256, missing[i]!.source_sha256);
    assert.ok(row.reason && row.nextAction && row.reviewStatus === "author-proposed");
  }
  assert.deepEqual(report.categoryCounts, { reuse: 11, new: 9, refine: 18, missing: 24, representation: 24, process: 37, compound: 14, tool: 1 });
  assert.equal(Object.values(report.categoryCounts).reduce((a,b) => a+b), 138);
  assert.equal(report.worklist.filter(r => r.candidateConcepts.length > 0).length, 20);
  assert.ok(report.reviewPacket.every(p => p.reviewStatus === "author-proposed" && p.locator && p.alternative));
});

test("bounded content census, applicability and distinct mapping units", () => {
  const sections = report.scopes.slice(-2);
  assert.deepEqual(sections.map(s => [s.requirements_in_scope, s.session]), [[9,null],[8,null]]);
  assert.ok(sections.every(s => s.parent.includes("选择性必修") && s.excludes.includes("(4) *")));
  const rows = report.requirements.slice(-17);
  assert.deepEqual(rows.map(r => r.anchor), ["1","2.1","2.2","2.3","2.4","3.1","3.2","3.3","3.4","1.1","1.2","1.3","2.1","2.2","2.3","3.1","3.2"]);
  assert.ok(rows.every((r,i) => r.printedPage === (i < 9 ? 38 : 39) && r.pdfPage === r.printedPage + 8 && r.source_sha256 === snapshot.sourceSha256));
  const rule = rows.find(r => r.requirement_id === "cn-selective-derivatives/2.2")!;
  assert.match(rule.summary, /f\(ax\+b\)/);
  assert.deepEqual("concepts" in rule && rule.concepts, ["differentiation-rules","function-composition"]);
  assert.equal(report.requirements.length, new Set(report.requirements.map(r => r.requirement_id)).size);
  assert.deepEqual([report.unique_source_clauses, report.unique_linked_requirements, report.explicitlyUnmapped,
    report.knowledgeGraph.nodes.length, report.uniqueCandidateConcepts, report.candidateLinks, report.independentlyReviewed],
  [366,247,119,93,81,313,0]);
  for (const s of report.scopes) {
    const scoped = report.requirements.filter(r => r.parent === s.id);
    assert.equal(s.requirements_explicitly_unmapped, scoped.filter(r => r.alignment_status === "unmapped").length);
    assert.equal(s.requirements_with_concept_links, scoped.filter(r => r.alignment_status === "aligned-author-proposed").length);
  }
  assert.equal(report.wholeExamDenominator, null);
  assert.equal(report.mappingAccuracy, null);
});

test("new graph and audit preserve directional distinctions and reject unsupported changes", () => {
  for (const [left,right] of [["quadratic-discriminant","quadratic-equations"],["dot-product","vector-projection"],
    ["binomial-prediction","binomial-confidence"],["statistics-inference","experimental-design"],
    ["function-composition","coordinate-graph"]]) {
    const a = report.nodeAudit.find(n => n.id === left), b = report.nodeAudit.find(n => n.id === right);
    assert.ok(a?.sourceEvidence.length && b?.sourceEvidence.length && a.boundary !== b.boundary);
  }
  assert.equal(report.aliases["statistical-center"], "分布位置：均值与中位数");
  assert.equal(base.aliases["statistical-center"], "集中趋势");
  for (const mutate of [
    (d: typeof snapshot.graphDelta) => { d.aliases["arithmetic-sequences"] = base.aliases["dot-product"]; },
    (d: typeof snapshot.graphDelta) => { d.knowledgeRelations[0]!.relationType = "necessary"; },
    (d: typeof snapshot.graphDelta) => { d.knowledgeRelations[0]!.evidenceStatus = "expert-reviewed"; },
    (d: typeof snapshot.graphDelta) => { d.addedNodes[0]!.prerequisiteIds = [d.addedNodes[0]!.id]; },
  ]) {
    const delta = structuredClone(snapshot.graphDelta);
    mutate(delta);
    assert.throws(() => extendKnowledgeGraph(base.knowledgeGraph, delta, base.aliases));
  }
  const edit = structuredClone(snapshot);
  edit.scopes[0]!.leaves.pop();
  assert.throws(() => inspectMathKnowledgeAudit(edit, base), /knowledge audit release/);
});

test("CLI replays the current view and computes forward and reverse concept and clause deltas", () => {
  assert.deepEqual(JSON.parse(cli(path("1.0.0")).toString()), report);
  for (const reverse of [false,true]) {
    const versions = reverse ? ["1.0.0","0.9.0"] : ["0.9.0","1.0.0"];
    const diff = JSON.parse(cli(...versions.map(path)).toString()) as {
      changes: Record<"retained"|"added"|"removed"|"relocated", string[]>; concepts: Record<"added"|"removed",string[]> };
    assert.equal(diff.changes.retained.length, 349);
    assert.equal(diff.changes.relocated.length, 0);
    assert.equal(diff.changes.added.length, reverse ? 0 : 17);
    assert.equal(diff.changes.removed.length, reverse ? 17 : 0);
    assert.deepEqual(diff.concepts[reverse ? "removed" : "added"], ["arithmetic-sequences","differentiation-rules","geometric-sequences"]);
  }
});
