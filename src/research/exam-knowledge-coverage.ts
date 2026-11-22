import { parseMathematicsKnowledgeMap, type MathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import enumeration from "./data/exam-enumeration-v4.json" with { type: "json" };
import delta from "./data/math-graph-v0.9.json" with { type: "json" };
import { verifyInventoryRelease } from "./exam-international-inventory.js";
import type { inspectGapRequirements, inspectRequirements } from "./exam-requirements.js";

type Inventory = ReturnType<typeof inspectGapRequirements> | ReturnType<typeof inspectRequirements>;
type Leaf = { scope: string; anchor: string; summary: string; concepts: string[]; disposition?: string; rationale?: string };
type Snapshot = { version: string; baseInventory: string; graphVersion: string; manifestVersion: string; requirements: Leaf[] };
const noLink = { refine: "existing-concept-needs-refinement", process: "process-or-representation-needs-separate-modeling",
  unresolved: "unresolved" } as const;

function check(value: unknown, reason: string): asserts value {
  if (!value) throw new Error("knowledge_coverage_invalid: " + reason);
}

export function extendKnowledgeGraph(base: MathematicsKnowledgeMap, input = delta) {
  check(base.version === input.baseGraph, "stale graph");
  const graph = parseMathematicsKnowledgeMap({ ...base, version: input.version, nodes: [...base.nodes, ...input.addedNodes],
    knowledgeRelations: [...base.knowledgeRelations ?? [], ...input.knowledgeRelations] });
  const additions = new Set(input.addedNodes.map(n => n.id));
  check(input.knowledgeRelations.every(edge => additions.has(edge.toNodeId) && edge.relationType === "helpful" &&
    edge.evidenceStatus === "author-hypothesis" && edge.sourceRefs.length), "unwarranted prerequisite");
  const names = new Map<string, string>();
  function reserve(label: string, id: string) {
    const key = label.normalize("NFKC").trim().toLowerCase();
    check(key && (!names.has(key) || names.get(key) === id), "duplicate canonical label or alias");
    names.set(key, id);
  }
  for (const node of graph.nodes) {
    reserve(node.id, node.id);
    reserve(node.label, node.id);
  }
  for (const [id, alias] of Object.entries(input.aliases)) {
    check(additions.has(id), "unknown alias target");
    reserve(alias, id);
  }
  return graph;
}

function pinnedSnapshot(input: unknown): asserts input is Snapshot {
  verifyInventoryRelease(input, "b5e2935fa0f8647bef9c102b2c9a5ecdd7bd76766ec531e94dad0bfad31ea75b", "knowledge requirements");
}

export function inspectKnowledgeCoverage(input: unknown, baseline: Inventory, graphInput: unknown) {
  pinnedSnapshot(input);
  verifyInventoryRelease(enumeration, "7af458845ff1d9dc511d3e9b51af8a0e74a2558ad00b1ce303370ac9e45c7801", "knowledge census");
  verifyInventoryRelease(delta, "3f6451e8c4aea4ba7a7abe7c19e1bcc7b01501d9cea7b1569ff16907551baf33", "knowledge graph");
  check(baseline.version === input.baseInventory && "gapAudit" in baseline && baseline.gapAudit &&
    input.manifestVersion === enumeration.version && input.graphVersion === delta.version, "stale inventory");
  const original = parseMathematicsKnowledgeMap(graphInput);
  const inherited = parseMathematicsKnowledgeMap({ ...original, version: delta.baseGraph,
    nodes: [...original.nodes, ...baseline.gapAudit.addedNodes] });
  check(baseline.graph === inherited.id + "@" + inherited.version, "base graph");
  const graph = extendKnowledgeGraph(inherited);
  const oldIds = new Set(inherited.nodes.map(node => node.id));
  const ids = new Set(graph.nodes.map(node => node.id));
  const used = new Set<string>();
  const leaves = new Map(input.requirements.map(row => [row.scope + "/" + row.anchor, row]));
  check(leaves.size === input.requirements.length, "duplicate requirement");
  const additions = enumeration.scopes.map(scope => {
    const origin = baseline.scopes.find(s => s.id === scope.sourceScope);
    check(origin && origin.source.id + "@" + origin.source.version === scope.sourceKey, "wrong source edition");
    const rows = scope.pages.flatMap(page => page.anchors.map(anchor => {
      const key = scope.id + "/" + anchor;
      const row = leaves.get(key);
      check(row && !used.has(key) && !baseline.requirements.some(r => r.requirement_id === key), "missing or duplicate leaf");
      used.add(key);
      const concepts = row.concepts;
      check(concepts.every(id => ids.has(id)) && new Set(concepts).size === concepts.length, "unknown or duplicate concept");
      check(concepts.length ? !row.disposition && !row.rationale : row.disposition && Object.hasOwn(noLink, row.disposition) && row.rationale, "mapping disposition");
      const decision = concepts.length > 1 ? "multi-concept" : concepts.length === 1
        ? oldIds.has(concepts[0]!) ? "existing-concept" : "new-concept-proposed" : noLink[row.disposition as keyof typeof noLink];
      const span = page.throughPdfPage - page.pdfPage;
      const printed = span ? page.printedPage + "–" + (page.printedPage + span) : String(page.printedPage);
      const pdf = span ? page.pdfPage + "–" + page.throughPdfPage : String(page.pdfPage);
      return { requirement_id: key, parent: scope.id, anchor, source_edition: scope.sourceKey, source_sha256: origin.source.sha256,
        locator: scope.parent + " / " + anchor + " (printed " + printed + ", PDF " + pdf + ")",
        printedPage: page.printedPage, pdfPage: page.pdfPage, throughPdfPage: page.throughPdfPage,
        kind: origin.kind, summary: row.summary, concepts, decision, rationale: row.rationale ?? null,
        alignment_status: concepts.length ? "aligned-author-proposed" : "unmapped", review: "pending-independent-review" };
    }));
    const linked = rows.filter(row => row.concepts.length).length;
    return { scope: { id: scope.id, parent: scope.parent, unit: scope.unit, excludes: scope.excludes, source: origin.source,
      jurisdiction: origin.jurisdiction, exams: origin.exams, session: origin.session, kind: origin.kind, inventory_status: "complete",
      requirements_in_scope: rows.length, requirements_inventoried: rows.length, requirements_with_concept_links: linked,
      requirements_explicitly_unmapped: rows.length - linked, requirements_independently_reviewed: 0 }, rows };
  });
  check(used.size === leaves.size, "leaf outside bounded scope");
  for (const edge of delta.knowledgeRelations)
    check(edge.sourceRefs.every(key => leaves.get(key)?.concepts.includes(edge.toNodeId)), "unlocated graph relation");
  const worklist = additions.flatMap(s => s.rows);
  const linkedIds = new Set(worklist.flatMap(row => row.concepts));
  check(delta.addedNodes.every(node => linkedIds.has(node.id)), "orphan concept");
  const linked = worklist.filter(row => row.concepts.length);
  const requirements = [...baseline.requirements, ...worklist];
  const scopes = [...baseline.scopes, ...additions.map(s => s.scope)];
  const graphHistory: Record<string, string[]> = {};
  for (const view of [original, inherited, graph]) graphHistory[view.id + "@" + view.version] = view.nodes.map(n => n.id);
  const byId = new Map(requirements.map(row => [row.requirement_id, row]));
  const comparisons = enumeration.comparisons.map(({ concept, requirements: keys }) => ({
    concept, examples: keys.map(key => {
      const row = byId.get(key);
      check(row && ("concepts" in row ? row.concepts.includes(concept) : row.concept_id === concept), "unsupported comparison");
      return { requirement: key, edition: row.source_edition, locator: row.locator, operation: row.summary };
    }), review: "author-proposed",
  }));
  return { version: input.version, manifestVersion: input.manifestVersion, baseInventory: baseline.version,
    graph: graph.id + "@" + graph.version, graphHistory, knowledgeGraph: graph, aliases: delta.aliases,
    comparisons, observedEmptyFocus: enumeration.observedEmptyFocus, scopes, requirements, unique_source_clauses: requirements.length, unique_linked_requirements: baseline.unique_linked_requirements + linked.length,
    expansion: { boundedSections: additions.length, sourceClauses: worklist.length, linkedClauses: linked.length,
      clausesUsingExisting: linked.filter(r => r.concepts.some(id => oldIds.has(id))).length,
      clausesUsingNew: linked.filter(r => r.concepts.some(id => !oldIds.has(id))).length,
      candidateLinks: linked.reduce((n, r) => n + r.concepts.length, 0), unresolvedClauses: worklist.length - linked.length,
      reusedConcepts: [...linkedIds].filter(id => oldIds.has(id)).sort(), newConcepts: delta.addedNodes.map(n => n.id),
      independentlyReviewed: 0 }, wholeExamDenominator: null };
}
