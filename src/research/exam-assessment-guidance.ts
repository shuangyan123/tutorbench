import { createHash } from "node:crypto";
import release from "./data/cn-math-assessment-v1.json" with { type: "json" };
import { inspectCurriculumRevision, reconcileEditionLeaves } from "./exam-edition-comparison.js";

type Group = typeof release.groups[number];
type Side = "old" | "new";

function anchors(group: Group, side: Side, edition: string) {
  const offset = side === "old" ? 8 : 3;
  const section = side === "old" ? group.oldSection : group.newSection;
  return group[side].map(unit => ({
    requirement_id: [edition, group.id, unit.id].join("/"),
    locator: section + " / " + unit.locator, kind: unit.kind, source: edition,
    printedPage: unit.first, endPrintedPage: unit.last, pdfPage: unit.first + offset, endPdfPage: unit.last + offset,
  }));
}

function span(rows: ReturnType<typeof anchors>) {
  return { printed: [Math.min(...rows.map(row => row.printedPage)), Math.max(...rows.map(row => row.endPrintedPage))],
    pdf: [Math.min(...rows.map(row => row.pdfPage)), Math.max(...rows.map(row => row.endPdfPage))] };
}

function checkRelease(input: unknown): asserts input is typeof release {
  // 冻结的是本次取证与作者对齐；旧版身份、适用性仍通过既有校验链取得。
  if (createHash("sha256").update(JSON.stringify(input)).digest("hex") !==
      "2d8ea05628c0a50513d4d6837524108c8f558576b0aba3670a4a384f7015eabb") throw new Error("changed assessment snapshot");
}

export function inspectAssessmentGuidance(baseline: Parameters<typeof inspectCurriculumRevision>[0], input: unknown = release) {
  const snapshot = structuredClone(input);
  checkRelease(snapshot);
  const { version, oldSource, newSource, applicability } = inspectCurriculumRevision(baseline);
  if (version !== snapshot.baseComparison || oldSource.sha256 !== snapshot.oldSha256 || newSource.sha256 !== snapshot.newSha256)
    throw new Error("assessment source binding mismatch");

  const sections = snapshot.groups.map(group => {
    const old = anchors(group, "old", oldSource.edition);
    const next = anchors(group, "new", newSource.edition);
    const decisions = group.decisions.map(row => ({ ...row,
      old: row.old.map(id => [oldSource.edition, group.id, id].join("/")),
      new: row.new.map(id => [newSource.edition, group.id, id].join("/")),
    }));
    const result = reconcileEditionLeaves(old, next, decisions);
    return { id: group.id, oldSection: group.oldSection, newSection: group.newSection,
      oldSpan: span(old), newSpan: span(next), oldUnits: old.length, newUnits: next.length, ...result };
  });
  const changes = sections.flatMap(section => section.changes);
  return { version: snapshot.version, checkedOn: snapshot.checkedOn, baseComparison: version, oldSource, newSource,
    applicability, evidenceStatus: "provisional", unitBasis: "author-defined bounded units", sections,
    citedAppendixHeadings: snapshot.citedAppendixHeadings.map(row => ({ ...row,
      old: { ...row.old, pdfPage: row.old.printedPage + 8 },
      new: row.new && { ...row.new, pdfPage: row.new.printedPage + 3 },
    })),
    totals: { oldUnits: sections.reduce((n, s) => n + s.oldUnits, 0), newUnits: sections.reduce((n, s) => n + s.newUnits, 0),
      provisionalDecisions: changes.length, issuerVerifiedDecisions: 0, independentReviews: 0,
      officialDenominator: null, coveragePercent: null, bindingPaperBlueprints: 0 } };
}
