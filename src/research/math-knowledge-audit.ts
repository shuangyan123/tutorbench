import nodeDecisions from "./data/math-node-audit-v1.json" with { type: "json" };
import dispositions from "./data/math-gap-dispositions-v1.json" with { type: "json" };
import type release from "../../scenarios/case-system-vnext/exam-specifications/requirements-1.0.0.json";
import { extendKnowledgeGraph, type inspectKnowledgeCoverage } from "./exam-knowledge-coverage.js";
import { verifyInventoryRelease } from "./exam-international-inventory.js";

type Baseline = ReturnType<typeof inspectKnowledgeCoverage>;
type Leaf = Baseline["requirements"][number];
type Snapshot = typeof release;
const actions = new Map(Object.entries({
  reuse: "Review the candidate against the full located operation and its restrictions.",
  new: "Review the new node against this rule and the narrower operations in other editions.",
  refine: "Specify the narrower operation or restriction before linking.",
  missing: "Compare a proposed definition against adjacent graph nodes and the cited clause.",
  representation: "Record input and output representations and the required conversion before linking.",
  process: "Describe the observable decision or argument in a process rubric.",
  compound: "Review each operation separately while retaining one source leaf.",
  tool: "Record the tool-use condition for task design; leave the conceptual link open.",
}));

function check(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error("math_knowledge_audit_invalid: " + reason);
}

function conceptsOf(row: { concepts?: string[]; concept_id?: unknown }) {
  return row.concepts ?? (typeof row.concept_id === "string" ? [row.concept_id] : []);
}

function exactIndex<T>(rows: readonly T[], key: (row: T) => string, expected: string[]) {
  const index = new Map(rows.map(row => [key(row), row]));
  check(index.size === rows.length && index.size === expected.length && expected.every(id => index.has(id)), "incomplete or duplicate census");
  return index;
}

function provenance(row: Pick<Leaf, "requirement_id" | "source_edition" | "source_sha256" | "locator" | "summary">) {
  return { sourceId: row.requirement_id, edition: row.source_edition, sha256: row.source_sha256,
    locator: row.locator, operation: row.summary };
}

function auditNodes(baseline: Baseline) {
  const graph = baseline.knowledgeGraph;
  const decisions = exactIndex(nodeDecisions, d => d.id, graph.nodes.map(n => n.id));
  const aliases: Record<string, string> = baseline.aliases;
  const edges = graph.knowledgeRelations ?? [];
  check(edges.every(e => e.relationType === "helpful" && e.evidenceStatus === "author-hypothesis"), "historical edge evidence");
  return graph.nodes.map(node => {
    const incoming = edges.filter(e => e.toNodeId === node.id);
    const evidence = baseline.requirements.filter(row => conceptsOf(row).includes(node.id));
    const introducedIn = Object.entries(baseline.graphHistory).find(([, ids]) => ids.includes(node.id))?.[0];
    check(introducedIn && node.prerequisiteIds.every(id => incoming.some(e => e.fromNodeId === id)), "graph provenance");
    return { ...decisions.get(node.id)!, label: node.label, historicalAlias: aliases[node.id] ?? null,
      introducedIn, historicalGraphLocator: introducedIn + "/nodes/" + node.id,
      proposedStage: node.stage, stageStatus: "author-proposed", sourceEvidence: evidence.map(provenance),
      caseIds: graph.caseMappings.filter(c => c.nodeIds.includes(node.id)).map(c => c.taskId),
      incoming, independentlyReviewed: false };
  });
}

function inspectRelease(input: unknown): asserts input is Snapshot {
  verifyInventoryRelease(input, "67c7e70c0226355cbef9f647f5eb636c0e6f6ed16d831850108904c08a56941c", "knowledge audit release");
}

export function inspectMathKnowledgeAudit(input: unknown, baseline: Baseline) {
  inspectRelease(input);
  verifyInventoryRelease(nodeDecisions, "51e2615caa9280ae7319a4e0ab74db52342599cba3145504ededd8aaef85aee7", "node decisions");
  verifyInventoryRelease(dispositions, "e8cec9afded8539653035b71c66a97a4d4565d06cad707090fa9592936bf1ae6", "gap dispositions");
  check(baseline.version === input.baseInventory, "base inventory");
  const origin = baseline.scopes.find(s => s.id === input.sourceScope);
  check(origin && origin.source.sha256 === input.sourceSha256 && origin.source.id + "@" + origin.source.version === input.sourceEdition, "source edition");
  const { id, from, to } = input.aliasRefinement;
  const historicalAliases: Record<string, string> = baseline.aliases;
  check(historicalAliases[id] === from, "alias history");
  const retainedAliases = { ...historicalAliases, [id]: to };
  const graph = extendKnowledgeGraph(baseline.knowledgeGraph, input.graphDelta, retainedAliases);
  const graphKey = graph.id + "@" + graph.version;
  const ids = new Set(graph.nodes.map(n => n.id));
  const checkLinks = (links: string[]) => check(links.every(link => ids.has(link)) && new Set(links).size === links.length, "unknown or repeated concept");
  const unmapped = baseline.requirements.filter(row => row.alignment_status === "unmapped");
  const gaps = exactIndex(dispositions, d => d.id, unmapped.map(r => r.requirement_id));
  const worklist = unmapped.map(row => {
    const gap = gaps.get(row.requirement_id)!;
    checkLinks(gap.concepts);
    const nextAction = actions.get(gap.kind);
    check(nextAction && gap.reason && (["reuse","new"].includes(gap.kind) === Boolean(gap.concepts.length)), "disposition");
    return { ...provenance(row), category: gap.kind, reason: gap.reason, candidateConcepts: gap.concepts, nextAction,
      reviewStatus: "author-proposed" };
  });
  const retained = baseline.requirements.map(row => {
    const gap = gaps.get(row.requirement_id);
    if (!gap?.concepts.length) return row;
    // 新版的多对多关联只保留一个权威字段；原单值表示仍可从旧版重放。
    const { concept_id: _previousSingle, ...fields } = { concept_id: null, ...row };
    return { ...fields, alignment_status: "aligned-author-proposed", concepts: gap.concepts,
      rationale: gap.reason, decision: gap.concepts.length > 1 ? "multi-concept" : gap.kind === "new" ? "new-concept-proposed" : "existing-concept",
      review: "pending-independent-review" };
  });
  const sections = input.scopes.map(section => {
    const parent = "IV / 选择性必修 / 主题一 函数 / 内容要求 / " + section.title;
    const rows = section.leaves.map(leaf => {
      checkLinks(leaf.concepts);
      return { requirement_id: section.id + "/" + leaf.anchor, anchor: leaf.anchor, parent: section.id,
        summary: leaf.summary, source_edition: input.sourceEdition, source_sha256: origin.source.sha256,
        kind: origin.kind, locator: parent + " / " + leaf.anchor + " (printed " + section.printedPage + ", PDF " + section.pdfPage + ")",
        printedPage: section.printedPage, pdfPage: section.pdfPage, throughPdfPage: section.pdfPage, concepts: leaf.concepts,
        rationale: leaf.rationale ?? null, alignment_status: leaf.concepts.length ? "aligned-author-proposed" : "unmapped",
        review: "pending-independent-review" };
    });
    const linked = rows.filter(r => r.concepts.length).length;
    return { rows, scope: { id: section.id, parent, source: origin.source, jurisdiction: origin.jurisdiction,
      exams: origin.exams, session: null, entryCohort: null, kind: origin.kind, inventory_status: "complete",
      unit: "circled content item or sole unnumbered content paragraph", curriculumTrack: "选择性必修",
      excludes: section.starred + "；章首说明、教学提示、学业要求", requirements_in_scope: rows.length,
      requirements_inventoried: rows.length, requirements_with_concept_links: linked,
      requirements_explicitly_unmapped: rows.length - linked, requirements_independently_reviewed: 0 } };
  });
  const requirements = [...retained, ...sections.flatMap(s => s.rows)];
  const byId = new Map(requirements.map(row => [row.requirement_id, row]));
  check(byId.size === requirements.length, "duplicate leaf");
  for (const e of input.graphDelta.knowledgeRelations) {
    check(e.sourceRefs.every(ref => conceptsOf(byId.get(ref) ?? {}).includes(e.toNodeId)), "unlocated new relation");
  }
  const scopes = [...baseline.scopes.map(scope => {
    const added = retained.filter(row => row.parent === scope.id && gaps.get(row.requirement_id)?.concepts.length).length;
    if (!added) return scope;
    const linked = scope.requirements_with_concept_links + added;
    return { ...scope, requirements_with_concept_links: linked, requirements_explicitly_unmapped: scope.requirements_explicitly_unmapped - added,
      ...("requirements_pending_review" in scope ? { requirements_pending_review: scope.requirements_pending_review + added,
        candidate_link_percent: scope.requirements_in_scope ? 100 * linked / scope.requirements_in_scope : null } : {}) };
  }), ...sections.map(s => s.scope)];
  const reviewPacket = input.reviewPriorities.map(entry => {
    const row = byId.get(entry.sourceId);
    check(row && (!entry.candidate || ids.has(entry.candidate)), "review handoff");
    return { ...provenance(row), ...entry, version: input.version, reviewStatus: "author-proposed",
      reason: gaps.get(entry.sourceId)?.reason ?? row.summary, proposedLinks: conceptsOf(row) };
  });
  const links = requirements.flatMap(conceptsOf);
  const linked = requirements.filter(row => conceptsOf(row).length).length;
  const aliases: Record<string, string> = { ...retainedAliases, ...input.graphDelta.aliases };
  return { version: input.version, baseInventory: input.baseInventory, manifestVersion: input.manifestVersion,
    graph: graphKey, graphHistory: { ...baseline.graphHistory, [graphKey]: [...ids] }, knowledgeGraph: graph,
    aliases, aliasRefinement: input.aliasRefinement,
    specializations: input.specializations, nodeAudit: auditNodes(baseline), worklist, reviewPacket,
    baseline: { graphNodes: baseline.knowledgeGraph.nodes.length, clauses: baseline.requirements.length, unmapped: unmapped.length,
      linked: baseline.unique_linked_requirements, boundedSections: baseline.scopes.length },
    categoryCounts: Object.fromEntries([...actions.keys()].map(k => [k, worklist.filter(r => r.category === k).length])),
    scopes, requirements, unique_source_clauses: requirements.length, unique_linked_requirements: linked,
    explicitlyUnmapped: requirements.length - linked, uniqueCandidateConcepts: new Set(links).size, candidateLinks: links.length,
    independentlyReviewed: 0, mappingAccuracy: null, wholeExamDenominator: null };
}
