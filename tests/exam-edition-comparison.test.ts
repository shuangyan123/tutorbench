import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import candidate from "../src/research/data/cn-math-revision-v1.json" with { type: "json" };
import { inspectCurriculumRevision, reconcileEditionLeaves } from "../src/research/exam-edition-comparison.js";

const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", ...args]);
const baseline = JSON.parse(cli("--requirements").toString()) as Parameters<typeof inspectCurriculumRevision>[0];

test("edition diff is opt-in and historical CLI bytes replay", () => {
  const expected = ["e44c9bcd0574c2195c2c23f0a48268ffcf89f601c25fa5360e0dd6f566b49a39",
    "53e8b7d9930b2b3788c83417d8ef4640c00cf28a3a2e82ec9f0667a9a2d8a301",
    "5df7b7ffb3cc965aaa2b33c79e49e4ac8e7f95da360a430a132daf271e4d0b50",
    "636b2ebe1a92588b444cce4728ed87b38b3c6b82a86528bd76283bd32a11f9ac"];
  const files = ["0.2.0","0.3.0","0.4.0"].map(v => ["--requirements",
    `scenarios/case-system-vnext/exam-specifications/requirements-${v}.json`]);
  for (const [index, args] of [[], ...files, ["--requirements"]].entries())
    assert.equal(createHash("sha256").update(cli(...args)).digest("hex"), expected[Math.min(index, 3)]);
  const raw = cli("--requirements", "--edition-diff");
  assert.deepEqual(raw, cli("--requirements", "--edition-diff"));
  const report = inspectCurriculumRevision(baseline);
  assert.deepEqual(JSON.parse(raw.toString()), report);
  assert.deepEqual(report.totals, { historicalLeaves: 13, candidateLeaves: 13, provisionalDecisions: 13,
    issuerVerifiedDecisions: 0, independentReviews: 0 });
  assert.equal(report.newSource.issuer_authentication, "pending");
  assert.equal(report.applicability.firstGaokaoYear, "unknown");
  assert.equal(report.applicability.teachingIntake, "unknown");
  assert.equal(report.counts.unchanged, 13);
  assert.deepEqual(report.unpaired, { old: [], new: [] });
  assert.notEqual(report.oldSource.sha256, report.newSource.sha256);
  assert.deepEqual(report.changes.map(row => [row.old[0]!.pdfPage, row.new[0]!.pdfPage]),
    [...Array(7).fill([23,18]), ...Array(3).fill([24,18]), ...Array(3).fill([24,19])]);
  assert.ok(report.changes.every(row => row.review === "author-proposed-pending-independent-review" &&
    row.old[0]!.requirement_id !== row.new[0]!.requirement_id));
});

test("the bounded candidate cannot acquire a different identity, applicability or review by editing its release", () => {
  const edits: Array<(v: typeof candidate) => void> = [
    v => { v.newSource.sha256 = v.oldSource.sha256; }, v => { v.oldSource.edition = v.newSource.edition; },
    v => { v.newSource.issuer_authentication = "verified-current-normative"; },
    v => { v.applicability.teachingIntake = "2025"; }, v => { v.applicability.firstGaokaoYear = "2027"; },
    v => { Object.assign(v.decisions[0]!, { review: "approved" }); }, v => { v.sections[0]!.pages[0]!.anchors.pop(); },
  ];
  for (const edit of edits) {
    const copy = structuredClone(candidate);
    edit(copy);
    assert.throws(() => inspectCurriculumRevision(baseline, copy), /changed comparison snapshot/);
  }
  assert.throws(() => inspectCurriculumRevision({ ...baseline, unique_linked_requirements: 13 }), /historical inventory/);
});

test("split, merge and one-sided decisions consume exactly the enumerated leaves", () => {
  const leaf = (id: string) => ({ requirement_id: id, locator: id, printedPage: 1, pdfPage: 2 });
  const decide = (relationship: string, old: string[], next: string[]) => ({ relationship, old, new: next, rationale: "test evidence" });
  const old = ["a","b","c","d","e"].map(leaf);
  const next = ["u","v","w","x"].map(leaf);
  const rows = [decide("split", ["a"], ["u","v"]), decide("merged", ["b","c"], ["w"]),
    decide("added", [], ["x"]), decide("removed", ["d"], []), decide("unresolved", ["e"], [])];
  const result = reconcileEditionLeaves(old, next, rows);
  assert.deepEqual(result.unpaired, { old: ["d","e"], new: ["x"] });
  for (const kind of ["split","merged","added","removed","unresolved"] as const) assert.equal(result.counts[kind], 1);
  assert.throws(() => reconcileEditionLeaves(old, next, rows.slice(0,-1)), /missing decision/);
  assert.throws(() => reconcileEditionLeaves(old, next, [...rows, rows[0]!]), /duplicate or foreign/);
  assert.throws(() => reconcileEditionLeaves(old, [...next, next[0]!], rows), /duplicate source/);
  assert.throws(() => reconcileEditionLeaves(old, next, [decide("merged", ["a"], ["u","v"])]), /cardinality/);
  assert.throws(() => reconcileEditionLeaves(old, next, [decide("split", ["a"], ["u","ghost"])]), /foreign/);
  assert.throws(() => reconcileEditionLeaves(old, next, [decide("removed", [], [])]), /cardinality/);
});
