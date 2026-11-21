import { createHash } from "node:crypto";
import candidate from "./data/cn-math-revision-v1.json" with { type: "json" };
import type { inspectRequirements } from "./exam-requirements.js";

const relations = ["unchanged", "wording-changed", "substantively-modified", "added", "removed", "moved", "split", "merged", "unresolved"] as const;
type Relation = typeof relations[number];
type Leaf = { requirement_id: string; locator: string; printedPage: number; pdfPage: number };
type Decision = { old: string[]; new: string[]; relationship: string; rationale: string };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error("exam_edition_invalid: " + message);
}

function cardinality(relation: Relation, oldCount: number, newCount: number) {
  switch (relation) {
    case "added": return oldCount === 0 && newCount === 1;
    case "removed": return oldCount === 1 && newCount === 0;
    case "split": return oldCount === 1 && newCount > 1;
    case "merged": return oldCount > 1 && newCount === 1;
    case "unresolved": return oldCount + newCount > 0;
    default: return oldCount === 1 && newCount === 1;
  }
}

// 每侧的叶子只可消费一次，拆分、合并按决定计数；缺席本身不构成删除证据。
export function reconcileEditionLeaves<Old extends Leaf, New extends Leaf>(before: Old[], after: New[], decisions: Decision[]) {
  function side<T extends Leaf>(leaves: T[]) {
    const remaining = new Map(leaves.map(leaf => [leaf.requirement_id, leaf]));
    check(remaining.size === leaves.length, "duplicate source anchor");
    return { remaining, take(ids: string[]) {
      return ids.map(id => {
        const leaf = remaining.get(id);
        check(leaf, "duplicate or foreign decision anchor");
        remaining.delete(id);
        return leaf;
      });
    } };
  }
  const oldSide = side(before);
  const newSide = side(after);
  const counts = Object.fromEntries(relations.map(relation => [relation, 0])) as Record<Relation, number>;
  const changes = decisions.map(decision => {
    const relationship = decision.relationship as Relation;
    check(relations.includes(relationship) && cardinality(relationship, decision.old.length, decision.new.length), "relationship cardinality");
    check(decision.rationale.trim(), "missing clause evidence");
    counts[relationship]++;
    return { relationship, old: oldSide.take(decision.old), new: newSide.take(decision.new),
      rationale: decision.rationale, review: "author-proposed-pending-independent-review" };
  });
  check(!oldSide.remaining.size && !newSide.remaining.size, "missing decision for enumerated leaf");
  return { changes, counts, unpaired: {
    old: changes.filter(row => !row.new.length).flatMap(row => row.old.map(leaf => leaf.requirement_id)),
    new: changes.filter(row => !row.old.length).flatMap(row => row.new.map(leaf => leaf.requirement_id)),
  } };
}

function checkSnapshot(value: unknown): asserts value is typeof candidate {
  check(digest(value) === "d3e842aba1c903cb912a7ad168f63c88bee2be11bda5a99bcc01f2667f064ef0", "changed comparison snapshot");
}

export function inspectCurriculumRevision(baseline: ReturnType<typeof inspectRequirements>, input: unknown = candidate) {
  const snapshot = structuredClone(input);
  checkSnapshot(snapshot);
  check(baseline.version === snapshot.baseInventory && digest(baseline) === snapshot.baselineReportSha256, "changed historical inventory");
  const before = snapshot.sections.flatMap(section => baseline.requirements.filter(row => row.parent === section.oldScope).map(row => {
    check(row.source_sha256 === snapshot.oldSource.sha256 && row.source_edition === snapshot.oldSource.edition, "old source binding");
    return { requirement_id: row.requirement_id, locator: row.locator, printedPage: section.oldPrintedPage, pdfPage: section.oldPdfPage };
  }));
  const after = snapshot.sections.flatMap(section => section.pages.flatMap(page => page.anchors.map(anchor => ({
    requirement_id: section.id + "/" + anchor, locator: section.parent + " / " + anchor,
    printedPage: page.printedPage, pdfPage: page.pdfPage,
  }))));
  const result = reconcileEditionLeaves(before, after, snapshot.decisions);
  return { version: snapshot.version, checkedOn: snapshot.checkedOn, baseInventory: baseline.version,
    oldSource: snapshot.oldSource, newSource: snapshot.newSource, applicability: snapshot.applicability, sections: snapshot.sections, ...result,
    totals: { historicalLeaves: before.length, candidateLeaves: after.length, issuerVerifiedDecisions: 0,
      provisionalDecisions: result.changes.length, independentReviews: 0 } };
}
