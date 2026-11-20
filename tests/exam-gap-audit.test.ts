import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../src/research/data/exam-enumeration-v1.json" with { type: "json" };
import { enumerationScopes } from "../src/research/exam-inventory-scopes.js";
import { parseExamSpecifications } from "../src/research/exam-specifications.js";
import { compareRequirementInventories, inspectGapRequirements, inspectRequirements } from "../src/research/exam-requirements.js";

const base = "scenarios/case-system-vnext/";
const read = (name: string): unknown => JSON.parse(readFileSync(base + name + ".json", "utf8")) as unknown;
const graph = read("mathematics-knowledge-map-v0.1");
const registry = parseExamSpecifications(read("exam-specifications/0.1.0"), graph, read("mathematics-exam-alignment-v0.1"));
const previous = read("exam-specifications/requirements-0.2.0");
const baseline = inspectRequirements(previous, registry, graph);
const file = "exam-specifications/requirements-0.3.0";
const inspect = (raw: unknown) => inspectGapRequirements(raw, previous, registry, graph);
type Fixture = { addedNodes: Array<Record<string, unknown>>; dispositions: Array<Record<string, unknown>> };
const fixture = () => read(file) as Fixture;

test("historical replay, four full author proposals and AP deduplication", () => {
  const sha = createHash("sha256").update(JSON.stringify(baseline)).digest("hex");
  assert.equal(sha, "f69ab43d13fc239968c64428f2fccc9d07ccc92328629395551c9497604a30a6");
  const report = inspect(fixture());
  const cli = (...args: string[]): unknown => JSON.parse(execFileSync(process.execPath,
    ["dist/src/cli/exam-specifications.js", "--requirements", ...args], { encoding: "utf8" })) as unknown;
  assert.equal(createHash("sha256").update(JSON.stringify(report)).digest("hex"),
    "7ce6d5f1d2c06a134a11bba6efe9ae50cb67b9b9b02076b32e3cf45d5db51f85");
  assert.deepEqual(cli(base + file + ".json"), report);
  const diff = compareRequirementInventories(baseline, report);
  assert.deepEqual(cli(base + "exam-specifications/requirements-0.2.0.json", base + file + ".json"), diff);
  assert.deepEqual(diff.requirements.map(row => row.key), ["cn-logic/1.1","cn-logic/1.2","cn-logic/1.3","us-topic-2-1/CHA-2.A.1"]);
  assert.deepEqual(report.gapAudit.categoryCounts, {
    "existing-concept-can-map": 0, "new-concept-needed": 6, "refine-concept-or-relation": 3, "remain-unmapped": 3 });
  assert.equal(report.gapAudit.missingConcepts.length, 4);
  assert.equal(report.gapAudit.addedNodes.length, 2);
  assert.equal(report.unique_source_clauses, 20);
  assert.equal(report.unique_linked_requirements, 12);
  assert.deepEqual(report.perExam.map(row => [row.requirements_in_scope, row.requirements_with_concept_links]), [[6,6],[12,4],[2,2],[2,2]]);
  for (const row of report.scopes) assert.equal(row.requirements_independently_reviewed, 0);
  for (const row of report.wholeExamViews) assert.equal(row.candidate_link_percent, null);
  assert.deepEqual(report.landOverlays, baseline.landOverlays);
});

test("the census cannot be edited to fit a gap decision", () => {
  for (const mutate of [
    (copy: typeof manifest) => { copy.scopes[1]!.anchors.pop(); },
    (copy: typeof manifest) => { copy.scopes[2]!.session = 2028; },
    (copy: typeof manifest) => { copy.scopes[0]!.excludes = ""; },
  ]) {
    const copy = structuredClone(manifest); mutate(copy);
    assert.throws(() => enumerationScopes(registry, copy), /manifest/);
  }
});

test("decisions fail closed on stale pins, partial matches, orphan additions and cycles", () => {
  const edits: Array<[(raw: Fixture) => void, RegExp]> = [
    [raw => { raw.dispositions.pop(); }, /missing disposition/],
    [raw => { raw.dispositions.push(raw.dispositions[0]!); }, /clause binding/],
    ...["requirement","edition","sha256"].map((key): [(raw: Fixture) => void, RegExp] =>
      [raw => { raw.dispositions[0]![key] = "wrong"; }, /clause binding/]),
    [raw => { raw.dispositions[0]!.requirement = "cn-logic/2"; }, /clause binding/],
    [raw => { raw.dispositions[0]!.fit = "partial"; }, /unsupported focus/],
    [raw => { raw.dispositions[0]!.focus = "ghost"; }, /unsupported focus/],
    [raw => { raw.dispositions[0]!.neighbors = ["ghost"]; }, /semantic evidence/],
    [raw => { raw.dispositions[0]!.review = "independent"; }, /fields/],
    [raw => { raw.addedNodes.push({ ...raw.addedNodes[0], id: "orphan" }); }, /orphan/],
    [raw => { raw.addedNodes[0]!.prerequisiteIds = [raw.addedNodes[1]!.id]; raw.addedNodes[1]!.prerequisiteIds = [raw.addedNodes[0]!.id]; }, /cycle/],
    [raw => { raw.dispositions[0]!.rationale = "different under the same version"; }, /changed 0.3.0/],
  ];
  for (const [mutate, error] of edits) { const raw = fixture(); mutate(raw); assert.throws(() => inspect(raw), error); }
});
