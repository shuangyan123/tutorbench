import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import sources from "../src/research/data/exam-sources-v0.7.json" with { type: "json" };
import delta from "../scenarios/case-system-vnext/exam-specifications/requirements-0.7.0.json" with { type: "json" };
import manifest from "../src/research/data/exam-enumeration-v3.json" with { type: "json" };
import { internationalInventoryContext } from "../src/research/exam-international-inventory.js";
import { inspectGapRequirements } from "../src/research/exam-requirements.js";
import { parseExamSpecifications } from "../src/research/exam-specifications.js";

const base = "scenarios/case-system-vnext/";
const load = (path: string): unknown => JSON.parse(readFileSync(base + path, "utf8")) as unknown;
const graph = load("mathematics-knowledge-map-v0.1.json");
const registry = parseExamSpecifications(load("exam-specifications/0.1.0.json"), graph, load("mathematics-exam-alignment-v0.1.json"));
const file = (v: string) => "exam-specifications/requirements-" + v + ".json";
const inspect = (input: unknown) => inspectGapRequirements(load(file("0.3.0")), load(file("0.2.0")), registry, graph, load(file("0.4.0")), input);
const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", "--requirements", ...args]);

test("the source-registry CLI resolves the three new editions against the archived registry", () => {
  const command = ["dist/src/cli/exam-specifications.js", base + "exam-specifications/0.1.0.json",
    "src/research/data/exam-sources-v0.7.json"];
  const diff = JSON.parse(execFileSync(process.execPath, command).toString()) as Array<{ spec: string; before: null; after: string }>;
  assert.deepEqual(diff.map(row => row.spec), ["digital-sat-framework@4.0", "nrw-abitur-math-gg@2027.1", "nrw-gost-math-klp@2023.1"]);
  assert.ok(diff.every(row => row.before === null && sources.specifications.some(spec => spec.sha256 === row.after)));
});

test("Phase 7 CLI adds located unique clauses, retains historic bytes and replays an additive diff", () => {
  const report = inspect(delta);
  assert.deepEqual(JSON.parse(cli(base + file("0.7.0")).toString()), report);
  assert.equal(createHash("sha256").update(cli("--edition-diff", "assessment-guidance")).digest("hex"),
    "fbb0bfd94f4abf460eebc53c5f5ecaa83ffcd7772231619ba54c1d30345b94e8");
  const diff = JSON.parse(cli(base + file("0.4.0"), base + file("0.7.0")).toString()) as {
    changes: { added: string[]; removed: string[]; relocated: string[] }; requirements: unknown[] };
  assert.equal(diff.requirements.length, 111);
  assert.deepEqual([diff.changes.added.length, diff.changes.removed, diff.changes.relocated], [111, [], []]);
  assert.equal(report.unique_source_clauses, 147);
  assert.equal(report.unique_linked_requirements, 22);
  assert.ok("crosswalks" in report && report.crosswalks && "byJurisdiction" in report.landOverlays);
  assert.equal(report.landOverlays.byJurisdiction.filter(row => row.status === "pending").length, 15);
  assert.equal(report.crosswalks.length, 17);
  assert.ok(report.crosswalks.every(link => link.review === "author-proposed-pending-independent-review"));
  assert.equal(report.independentCrosswalkReviews, 0);
  assert.equal(report.chineseRevision!.candidate.issuer_authentication, "pending");
  assert.equal(report.chineseRevision!.applicability.firstGaokaoYear, "unknown");
  assert.equal(report.sourceSupplement!.satDomains.filter(d => d.status === "pending").length, 3);
  assert.ok(report.wholeExamViews.every(v => v.requirements_in_scope === null && v.candidate_link_percent === null));
  const view = (id: string) => report.wholeExamViews.find(row => row.exam === id)!;
  assert.deepEqual([view("de-nw-abitur-2027").session, view("de-nw-abitur-2027").requirements_inventoried], [2027, 17]);
  assert.deepEqual([view("de-abitur").session, view("de-abitur").requirements_inventoried], [null, 15]);
  assert.deepEqual([view("us-sat-math").session, view("us-sat-math").requirements_inventoried], [null, 36]);
  assert.equal(view("us-ap-calculus-ab").requirements_inventoried, 8);
  assert.equal(view("cn-gaokao").requirements_inventoried, 0);
  assert.deepEqual(report.scopes.slice(7).map(s => s.requirements_in_scope), [5,10,20,23,9,8,6,9,9,7,5]);
  for (const row of report.requirements.filter(r => diff.changes.added.includes(r.requirement_id))) {
    assert.ok(row.printedPage && row.pdfPage && row.kind);
    assert.equal(row.source_sha256, report.scopes.find(s => s.id === row.parent)!.source.sha256);
  }
});

test("reject altered school track, year, publisher bytes and missing obligatory curriculum", () => {
  const edits: Array<(s: typeof sources) => void> = [
    s => { s.specifications[1]!.url = s.specifications[1]!.url.replace("_gg.pdf", "_wbk.pdf"); },
    s => { s.stateExam.session = 2028; }, s => { s.requiredCurriculum = "kmk-ahr-math@2012.1"; },
    s => { s.specifications.shift(); }, s => { s.specifications[2]!.sha256 = "0".repeat(64); },
    s => { s.stateExam.status = "complete"; },
  ];
  for (const change of edits) {
    const copy = structuredClone(sources);
    change(copy);
    assert.throws(() => internationalInventoryContext(registry, copy), /sources/);
  }
});

test("reject promoted crosswalks, PSAT or AP substitution and borrowed sessions", () => {
  const edits: Array<(m: typeof manifest) => void> = [
    m => { m.crosswalks[0]!.relation = "official-equivalent"; },
    m => { Object.assign(m.crosswalks[0]!, { review: "independently-approved" }); },
    m => { m.scopes.at(-1)!.parent = "PSAT 8/9"; },
    m => { m.scopes.at(-1)!.sourceKey = "ap-calculus-ced@2020.1"; },
    m => { m.scopes[2]!.session = 2027; },
  ];
  for (const change of edits) {
    const copy = structuredClone(manifest);
    change(copy);
    assert.throws(() => internationalInventoryContext(registry, sources, copy), /manifest/);
  }
});

test("missing, duplicated and parent units cannot enter bounded counts", () => {
  const copy = structuredClone(delta);
  copy.requirements.pop();
  assert.throws(() => inspect(copy), /incomplete leaf census/);
  copy.requirements.push(copy.requirements[0]!);
  assert.throws(() => inspect(copy), /duplicate requirement/);
  copy.requirements[0]!.anchor = "Algebra";
  assert.throws(() => inspect(copy), /unknown leaf/);
});
