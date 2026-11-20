import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareRequirementInventories, inspectRequirements } from "../src/research/exam-requirements.js";
import { parseExamSpecifications } from "../src/research/exam-specifications.js";

const base = "scenarios/case-system-vnext/";
const load = (path: string): unknown => JSON.parse(readFileSync(base + path, "utf8")) as unknown;
const graph = load("mathematics-knowledge-map-v0.1.json");
const registry = parseExamSpecifications(load("exam-specifications/0.1.0.json"), graph, load("mathematics-exam-alignment-v0.1.json"));
const file = "exam-specifications/requirements-0.2.0.json";
type Fixture = { version: string; registryVersion: string; manifestVersion: string;
  scopes: Array<{ id: string; status: string }>; requirements: Array<Record<string, unknown>> };
const fixture = () => load(file) as Fixture;
const inspect = (raw: unknown) => inspectRequirements(raw, registry, graph);

test("archived inventory and CLI replay preserve scope-specific counts, shared AP leaves and unknowns", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(fixture())).digest("hex"),
    "829885928e34fe586ddd6840ca449ec435daad9b3d79559b9a9ce8791f9a8967");
  const report = inspect(fixture());
  const evidenceManifest = report.scopes.map(scope => ({
    id: scope.id, exams: scope.exams, jurisdiction: scope.jurisdiction, session: scope.session, entryCohort: scope.entryCohort,
    source: scope.source, kind: scope.kind, correction: scope.correction, parent: scope.parent, unit: scope.unit,
    excludes: scope.excludes, anchors: scope.anchors,
  }));
  assert.equal(createHash("sha256").update(JSON.stringify(evidenceManifest)).digest("hex"),
    "374287aebae7842dc55f8f738a7ac5a67741824df0edc402547ba60878b694ec");
  const cli = (...args: string[]) => execFileSync(process.execPath,
    ["dist/src/cli/exam-specifications.js", "--requirements", ...args], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(cli(base + file)), report);
  assert.deepEqual(JSON.parse(cli(base + file, base + file)), compareRequirementInventories(report, report));
  assert.equal(report.unique_source_clauses, 20);
  assert.equal(report.unique_linked_requirements, 8);
  assert.deepEqual(report.perExam.map(scope => [scope.exam, scope.requirements_in_scope, scope.requirements_with_concept_links]),
    [["cn-gaokao", 6, 3], ["de-abitur", 12, 4], ["us-ap-calculus-ab", 2, 1], ["us-ap-calculus-bc", 2, 1]]);
  for (const scope of report.scopes) {
    assert.equal(scope.requirements_explicitly_unmapped + scope.requirements_with_concept_links, scope.requirements_inventoried);
    assert.equal(scope.requirements_pending_review, scope.requirements_with_concept_links);
    assert.equal(scope.independently_reviewed_percent, 0);
  }
  assert.equal(report.scopes[2]!.requirements_out_of_scope, 1);
  assert.equal(report.scopes[2]!.candidate_link_percent, 50);
  assert.equal(report.scopes[2]!.session, 2027);
  assert.equal(report.scopes[0]!.session, null);
  assert.equal(report.wholeExamViews.length, 11);
  for (const view of report.wholeExamViews) {
    assert.equal(view.requirements_in_scope, null);
    assert.equal(view.candidate_link_percent, null);
    assert.equal(view.independently_reviewed_percent, null);
  }
  assert.equal(report.wholeExamViews.find(view => view.exam === "cn-gaokao")!.requirements_inventoried, 0);
  assert.equal(report.wholeExamViews.filter(view => view.availability?.isbn === "978-7-04-068404-9" && view.entryCohort === 2027).length, 3);
  assert.equal(report.landOverlays.jurisdictions.length, 16);
});

test("removing an unlinked leaf cannot inflate scoped coverage; partial editions retain history", () => {
  const raw = fixture();
  const original = inspect(raw);
  raw.version = "0.2.1";
  raw.requirements.shift();
  assert.throws(() => inspect(raw), /incomplete leaf census/);
  raw.scopes[0]!.status = "partial";
  raw.requirements.reverse();
  raw.scopes.reverse();
  const next = inspect(raw);
  assert.equal(next.scopes[0]!.requirements_in_scope, null);
  assert.equal(next.scopes[0]!.candidate_link_percent, null);
  assert.equal(next.scopes[0]!.requirements_inventoried, 5);
  const diff = compareRequirementInventories(original, next);
  assert.deepEqual(diff.requirements.map(entry => [entry.key, entry.after]), [["cn-logic/1.1", null]]);
  assert.deepEqual(diff.scopes.map(entry => entry.key), ["cn-logic"]);
  assert.deepEqual(compareRequirementInventories(inspect(fixture()), next), diff);
  assert.deepEqual(inspect({ ...fixture(), requirements: fixture().requirements.reverse() }), original);
});

test("reject invalid scope, foreign/parent locators, duplicate leaves, false reviews and stale provenance", () => {
  const edits: Array<(raw: Fixture) => void> = [
    raw => { raw.scopes.pop(); }, raw => { raw.scopes[0]!.id = "china-all"; },
    raw => { raw.requirements.push(raw.requirements[0]!); }, raw => { raw.requirements[0]!.anchor = "1"; },
    raw => { raw.requirements[0]!.scope = "de-l4-common"; }, raw => { raw.requirements[0]!.anchor = "CHA-2.B.2"; },
    raw => { raw.requirements[0]!.status = "independently-reviewed"; },
    raw => { raw.requirements[0]!.status = "out-of-scope"; },
    raw => { raw.requirements[3]!.concept = "phantom"; },
    raw => { raw.requirements[0]!.legacy = "q18"; },
    raw => { raw.manifestVersion = "0"; }, raw => { raw.registryVersion = "0.0.1"; },
    raw => { raw.requirements.at(-1)!.concept = "ratios"; },
    raw => { raw.scopes[0] = { ...raw.scopes[0]!, session: 2027 } as Fixture["scopes"][number]; },
  ];
  for (const edit of edits) { const raw = fixture(); edit(raw); assert.throws(() => inspect(raw)); }
  const stale = structuredClone(registry);
  stale.specifications[1]!.sha256 = "1".repeat(64);
  assert.throws(() => inspectRequirements(fixture(), stale, graph), /edition mismatch/);
  const raw = fixture();
  raw.requirements[0]!.status = "awaiting-evidence";
  const result = inspect(raw).scopes[0]!;
  assert.equal(result.requirements_pending_review, 4);
  assert.equal(result.requirements_in_scope, 6);
});
