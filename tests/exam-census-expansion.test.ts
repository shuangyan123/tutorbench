import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../src/research/data/exam-enumeration-v2.json" with { type: "json" };
import { expandedEnumerationScopes } from "../src/research/exam-inventory-scopes.js";
import { compareRequirementInventories, inspectGapRequirements } from "../src/research/exam-requirements.js";
import { parseExamSpecifications } from "../src/research/exam-specifications.js";

const base = "scenarios/case-system-vnext/";
const read = (name: string): unknown => JSON.parse(readFileSync(base + name + ".json", "utf8")) as unknown;
const graph = read("mathematics-knowledge-map-v0.1");
const registry = parseExamSpecifications(read("exam-specifications/0.1.0"), graph, read("mathematics-exam-alignment-v0.1"));
const prefix = "exam-specifications/requirements-";
const previous = read(prefix + "0.2.0");
const gap = read(prefix + "0.3.0");
const inspect = (delta?: unknown) => inspectGapRequirements(gap, previous, registry, graph, delta);
const fixture = () => read(prefix + "0.4.0") as { baseInventory: string; scopes: Array<{id: string; status: string}>;
  requirements: Array<{scope: string; anchor: string; status: string}> };

test("0.4.0 adds four disjoint sections and preserves the historical graph, decisions and rows", () => {
  const before = inspect();
  const after = inspect(fixture());
  const cli = execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", "--requirements"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(cli), after);
  assert.deepEqual(after.gapAudit, before.gapAudit);
  assert.equal(after.graph, before.graph);
  assert.deepEqual(after.scopes.slice(0, 3), before.scopes);
  assert.deepEqual(after.requirements.filter(row => before.scopes.some(scope => scope.id === row.parent)), before.requirements);
  assert.equal(after.unique_source_clauses, 36);
  assert.equal(after.unique_linked_requirements, 12);
  assert.deepEqual(after.scopes.slice(3).map(scope => [scope.id, scope.inventory_status, scope.requirements_in_scope,
    scope.requirements_explicitly_unmapped, scope.requirements_independently_reviewed]), [
    ["cn-sets-2020", "complete", 7, 7, 0], ["de-l4-elevated", "complete", 3, 3, 0],
    ["us-topic-2-2", "complete", 4, 4, 0], ["us-topic-2-3", "complete", 2, 2, 0],
  ]);
  const views = after.wholeExamViews;
  assert.deepEqual(views.filter(view => view.exam.startsWith("us-ap")).map(view =>
    [view.session, view.requirements_inventoried, view.editions]), [[2027,8,["ap-calculus-ced@2020.1"]],[2027,8,["ap-calculus-ced@2020.1"]]]);
  assert.equal(after.requirements.filter(row => row.anchor.startsWith("CHA-")).length, 8);
  assert.equal(views.find(view => view.exam === "cn-gaokao")?.requirements_inventoried, 0);
  assert.equal(views.filter(view => view.entryCohort === 2027 && view.inventory_status === "unavailable" &&
    view.requirements_inventoried === 0 && view.availability?.outlineSha256 === null).length, 3);
  for (const view of views) {
    assert.equal(view.requirements_in_scope, null);
    assert.equal(view.candidate_link_percent, null);
    assert.equal(view.independently_reviewed_percent, null);
  }
  const diff = compareRequirementInventories(before, after);
  assert.ok("changes" in diff && diff.changes);
  assert.equal(diff.scopes.length, 4);
  assert.deepEqual(diff.changes, { added: diff.requirements.map(row => row.key), removed: [], relocated: [] });
  assert.equal(diff.requirements.length, 16);
  const moved = structuredClone(after);
  moved.requirements[0]!.locator += " revised page";
  const relocated = compareRequirementInventories(after, moved);
  assert.ok("changes" in relocated);
  assert.deepEqual(relocated.changes, { added: [], removed: [], relocated: [after.requirements[0]!.requirement_id] });
  const reverse = compareRequirementInventories(after, before);
  assert.ok("changes" in reverse && reverse.changes);
  assert.deepEqual(reverse.changes.removed, diff.changes.added);
});

test("reject incomplete census, forged evidence and changes to the issued snapshot", () => {
  const edits: Array<[(raw: ReturnType<typeof fixture>) => void, RegExp]> = [
    [raw => { raw.requirements.pop(); }, /incomplete leaf census/],
    [raw => { raw.requirements.push(raw.requirements[0]!); }, /duplicate requirement/],
    [raw => { raw.requirements[0]!.anchor = "1"; }, /unknown leaf/],
    [raw => { raw.requirements.at(-1)!.anchor = "CHA-2.Z.9"; }, /unknown leaf/],
    [raw => { raw.requirements.at(-1)!.scope = "us-topic-2-2"; }, /unknown leaf/],
    [raw => { raw.requirements[0]!.status = "independently-reviewed"; }, /unsupported alignment/],
    [raw => { raw.scopes[0]!.status = "partial"; }, /changed 0.4.0/],
    [raw => { raw.baseInventory = "0.2.0"; }, /expansion pins/],
  ];
  for (const [edit, error] of edits) {
    const raw = fixture(); edit(raw); assert.throws(() => inspect(raw), error);
  }
  for (const change of [{ sourceScope: "cn-logic" }, { session: 2028 }, { anchors: ["CHA-2.B"] }]) {
    const forged = structuredClone(manifest);
    Object.assign(forged.scopes[2]!, change);
    assert.throws(() => expandedEnumerationScopes(registry, forged), /manifest v2 mismatch/);
  }
});
