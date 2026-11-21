import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import snapshot from "../src/research/data/cn-math-assessment-v1.json" with { type: "json" };
import { inspectAssessmentGuidance } from "../src/research/exam-assessment-guidance.js";

const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", "--requirements", ...args]);
const baseline = JSON.parse(cli().toString()) as Parameters<typeof inspectAssessmentGuidance>[0];
const report = inspectAssessmentGuidance(baseline);

test("assessment replay has its own edition and preserves the Phase 5 CLI bytes", () => {
  assert.equal(createHash("sha256").update(cli("--edition-diff")).digest("hex"),
    "7dbd6029f3b20cdf001c2b33f6f736a79c7c79944062d2540d81b8b2d349c6c1");
  assert.deepEqual(JSON.parse(cli("--edition-diff", "assessment-guidance").toString()), report);
  assert.equal(report.baseComparison, "cn-math-revision-0.5.0");
  assert.equal(report.evidenceStatus, "provisional");
  assert.equal(report.newSource.issuer_authentication, "pending");
  assert.deepEqual(report.totals, { oldUnits: 39, newUnits: 43, provisionalDecisions: 43, issuerVerifiedDecisions: 0,
    independentReviews: 0, officialDenominator: null, coveragePercent: null, bindingPaperBlueprints: 0 });
  for (const field of ["firstGaokaoYear", "teachingIntake", "nationalPaper", "textbookAdoptionCohort", "provincePaperTransition"] as const)
    assert.equal(report.applicability[field], "unknown");
});

test("page spans include the last paragraph on shared pages and consume both independent catalogs", () => {
  assert.deepEqual(report.sections.map(s => [s.oldUnits, s.newUnits, s.oldSpan.pdf, s.newSpan.pdf]),
    [[13, 13, [82,87], [75,78]], [14, 14, [92,96], [82,85]], [12, 16, [96,98], [85,88]]]);
  for (const section of report.sections) {
    assert.equal(new Set(section.changes.flatMap(d => d.old.map(u => u.requirement_id))).size, section.oldUnits);
    assert.equal(new Set(section.changes.flatMap(d => d.new.map(u => u.requirement_id))).size, section.newUnits);
    assert.ok(section.changes.every(d => d.review === "author-proposed-pending-independent-review"));
  }
  const [quality, evaluation, exam] = report.sections;
  assert.equal(quality!.changes.filter(d => d.new[0]?.kind === "level-descriptor" && d.relationship === "substantively-modified").length, 3);
  assert.equal(quality!.changes.find(d => d.new[0]?.kind === "layout")?.relationship, "moved");
  assert.ok(evaluation!.changes.some(d => d.relationship === "merged" && d.old.length === 2));
  assert.ok(exam!.changes.some(d => d.relationship === "split" && d.new.length === 2));
  assert.ok(exam!.changes.filter(d => !d.new.length).every(d => d.relationship === "unresolved"));
  assert.ok(exam!.changes.every(d => [...d.old, ...d.new].every(u => u.kind === "exam-advice")));
  assert.match(exam!.changes.find(d => d.new[0]?.requirement_id.endsWith("/types"))!.rationale, /40%仅指学业水平考试/);
  assert.equal(report.citedAppendixHeadings.filter(c => c.new === null).length, 4);
  assert.deepEqual(report.citedAppendixHeadings.find(c => c.old.number === 25)?.new, { number: 24, printedPage: 143, pdfPage: 146 });
});

test("a historical release cannot be rekeyed or promote an absent anchor, an exam claim or an independent review", () => {
  const edits: Array<(v: typeof snapshot) => void> = [
    v => { v.oldSha256 = v.newSha256; }, v => { v.newSha256 = v.oldSha256; },
    v => { v.version = "cn-math-revision-0.5.0"; }, v => { v.groups[0]!.old.pop(); },
    v => { v.groups[1]!.new.push(v.groups[1]!.new[0]!); }, v => { v.groups[0]!.old[3]!.kind = "topic-requirement"; },
    v => { v.groups[2]!.new[0]!.kind = "binding-paper-blueprint"; },
    v => { Object.assign(v, { issuer_authentication: "verified", independentReviews: 1 }); },
  ];
  for (const edit of edits) {
    const copy = structuredClone(snapshot);
    edit(copy);
    assert.throws(() => inspectAssessmentGuidance(baseline, copy), /changed assessment snapshot/);
  }
  assert.throws(() => inspectAssessmentGuidance({ ...baseline, version: "0.5.0" }), /historical inventory/);
});
