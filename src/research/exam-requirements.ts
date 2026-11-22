import { parseMathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import { createHash } from "node:crypto";
import { applyGapSnapshot } from "./exam-gap-audit.js";
import { internationalInventoryContext, verifyInventoryRelease } from "./exam-international-inventory.js";
import { inspectCurriculumRevision } from "./exam-edition-comparison.js";
import { enumerationScopes, expandedEnumerationScopes, graduateBook, legacyClauses, sourceObservations } from "./exam-inventory-scopes.js";
import type { ExamSpecifications } from "./exam-specifications.js";

function check(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error("exam_inventory_invalid: " + reason);
}
function record(value: unknown, fields: string) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), "object");
  check(Object.keys(value).sort().join(" ") === fields.split(" ").sort().join(" "), "fields");
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  check(Array.isArray(value) && value.length <= 1000, "array");
  return value;
}
function metrics(denominator: number | null, inventoried = 0, linked = 0, unmapped = 0, awaiting = 0) {
  return { requirements_in_scope: denominator, requirements_inventoried: inventoried,
    requirements_with_concept_links: linked, requirements_explicitly_unmapped: unmapped,
    requirements_pending_review: linked + awaiting, requirements_independently_reviewed: 0,
    requirements_out_of_scope: 0, candidate_link_percent: denominator === null ? null : 100 * linked / denominator,
    independently_reviewed_percent: denominator === null ? null : 0 };
}

export function inspectRequirements(input: unknown, registry: ExamSpecifications, graphInput: unknown) {
  const graph = parseMathematicsKnowledgeMap(graphInput);
  check(registry.graph === graph.id + "@" + graph.version, "stale graph pin");
  return inspectRows(input, registry, graph, "legacy");
}

export function inspectGapRequirements(input: unknown, baseInput: unknown, registry: ExamSpecifications, graphInput: unknown,
  expansion?: unknown, international?: unknown) {
  const base = inspectRequirements(baseInput, registry, graphInput);
  const { inventory, extended, audit } = applyGapSnapshot(input, baseInput, parseMathematicsKnowledgeMap(graphInput), base);
  if (expansion === undefined) {
    check(international === undefined, "missing 0.4.0 base");
    return { ...inspectRows(inventory, registry, extended, "gap"), gapAudit: audit };
  }
  const delta = record(expansion, "version baseInventory manifestVersion scopes requirements");
  check(delta.version === "0.4.0" && delta.baseInventory === inventory.version && delta.manifestVersion === "2", "expansion pins");
  const expanded = { ...inventory, version: delta.version, manifestVersion: delta.manifestVersion,
    scopes: [...inventory.scopes, ...array(delta.scopes)], requirements: [...inventory.requirements, ...array(delta.requirements)] };
  const report = inspectRows(expanded, registry, extended, "expanded");
  check(createHash("sha256").update(JSON.stringify(expansion)).digest("hex") ===
    "0840807dc8363e96d86da14abf7709d4e69f671cbba3d5313986c66d067d2672", "changed 0.4.0 snapshot");
  const historical = { ...report, gapAudit: audit, sourceObservations };
  if (international === undefined) return historical;
  const next = record(international, "version baseInventory manifestVersion scopes requirements");
  check(next.version === "0.7.0" && next.baseInventory === report.version && next.manifestVersion === "3", "international pins");
  const context = internationalInventoryContext(registry);
  const updated = inspectRows({ ...expanded, version: next.version, registryVersion: context.supplement.version, manifestVersion: next.manifestVersion,
    scopes: [...expanded.scopes, ...array(next.scopes)], requirements: [...expanded.requirements, ...array(next.requirements)] },
  registry, extended, "international", context);
  verifyInventoryRelease(international, "fd89e91160d9124790465b6474bd22e4dc62c8be74c3d817a83d556d825db6fa", "requirements");
  const editions = new Map(updated.requirements.map(row => [row.requirement_id, row.source_edition]));
  for (const link of context.crosswalks) {
    check(editions.get(link.focus) === context.supplement.stateExamSource && link.curriculum.length > 0 &&
      link.curriculum.every(id => editions.get(id) === context.supplement.requiredCurriculum) &&
      link.national.every(id => editions.get(id) === "kmk-ahr-math@2012.1"), "crosswalk authority mismatch");
  }
  const { newSource, applicability } = inspectCurriculumRevision(historical);
  return { ...updated, gapAudit: audit, sourceObservations, chineseRevision: { candidate: newSource, applicability },
    sourceSupplement: context.supplement, crosswalks: context.crosswalks,
    landOverlays: { ...updated.landOverlays, status: "partial", byJurisdiction: context.landStatus }, independentCrosswalkReviews: 0 };
}

function inspectRows(input: unknown, registry: ExamSpecifications, graph: ReturnType<typeof parseMathematicsKnowledgeMap>,
  mode: "legacy" | "gap" | "expanded" | "international", context?: ReturnType<typeof internationalInventoryContext>) {
  const root = record(input, "version registryVersion manifestVersion scopes requirements");
  const expanded = mode === "expanded";
  const registryVersion = context?.supplement.version ?? registry.version;
  check(root.registryVersion === registryVersion && registry.version === "0.1.0" && root.manifestVersion === (context ? "3" : expanded ? "2" : "1") &&
    (root.version === "0.3.0") === (mode === "gap") && (root.version === "0.4.0") === expanded &&
    (root.version === "0.7.0") === (mode === "international"), "stale inventory pins");
  check(typeof root.version === "string" && /^\d+\.\d+\.\d+$/.test(root.version), "snapshot version");
  const manifest = context?.scopes ?? (expanded ? expandedEnumerationScopes(registry) : enumerationScopes(registry));
  const exams = context?.exams ?? registry.exams;
  check(createHash("sha256").update(JSON.stringify(registry)).digest("hex") ===
    "66f4e05e93e01ebea4d1e8e9cfe9dd897c218f52d886e4cbeb0ac0c5915b2cd2", "changed base registry");
  const declared = new Map<string, "partial" | "complete">();
  for (const raw of array(root.scopes)) {
    const { id, status } = record(raw, "id status");
    check(typeof id === "string" && !declared.has(id) && manifest.some(scope => scope.id === id) &&
      (status === "partial" || status === "complete"), "duplicate/unknown scope or status");
    declared.set(id, status);
  }
  check(declared.size === manifest.length, "missing scope");
  const seen = new Set<string>();
  const concepts = new Set(graph.nodes.map(node => node.id));
  const requirements = array(root.requirements).map(raw => {
    const row = record(raw, "scope anchor summary status concept legacy");
    const scope = manifest.find(entry => entry.id === row.scope);
    check(scope && typeof row.anchor === "string" && scope.anchors.includes(row.anchor), "unknown leaf or parent counted");
    const stableId = scope.id + "/" + row.anchor;
    check(!seen.has(stableId), "duplicate requirement/locator");
    seen.add(stableId);
    check(typeof row.summary === "string" && row.summary.trim() && row.summary.length <= 500, "summary");
    const linked = row.status === "aligned-author-proposed";
    check(linked || row.status === "unmapped" || row.status === "awaiting-evidence", "unsupported alignment/review");
    const concept = row.concept;
    check(linked ? typeof concept === "string" && concepts.has(concept) : concept === null, "incompatible concept");
    const edition = scope.source.id + "@" + scope.source.version;
    check(row.legacy === (legacyClauses[stableId] ?? null), "wrong legacy citation");
    if (row.legacy !== null) check(registry.mappings.some(link => link.spec === edition && link.clause === row.legacy &&
      link.concept === concept && link.review === "author-proposed"), "legacy mapping mismatch");
    const location = context?.locations.get(stableId);
    const locator = scope.parent + " / " + row.anchor;
    return { requirement_id: stableId, source_edition: edition, source_sha256: scope.source.sha256,
      parent: scope.id, anchor: row.anchor, locator: location ? locator + ` (printed ${location.printedPage}, PDF ${location.pdfPage})` : locator, ...location,
      summary: row.summary, alignment_status: row.status, concept_id: concept, legacy_clause: row.legacy };
  }).sort((left, right) => left.requirement_id < right.requirement_id ? -1 : 1);
  const scopes = manifest.map(scope => {
    const rows = requirements.filter(row => row.parent === scope.id);
    const complete = declared.get(scope.id) === "complete";
    check(!complete || rows.length === scope.anchors.length, "incomplete leaf census");
    for (const exam of scope.exams) check(exams.some(entry => entry.id === exam), "missing exam");
    const count = (status: string) => rows.filter(row => row.alignment_status === status).length;
    const excluded = scope.id === "us-topic-2-1" ? [{
      locator: "Printed p. 56 / Unit 2 / Topic 2.2 / CHA-2.B.2", source_edition: "ap-calculus-ced@2020.1",
      alignment_status: "out-of-scope", reason: "Adjacent EK under the same learning objective, outside Topic 2.1",
    }] : [];
    return { ...scope, inventory_status: complete ? "complete" : "partial",
      ...metrics(complete ? scope.anchors.length : null, rows.length, count("aligned-author-proposed"),
        count("unmapped"), count("awaiting-evidence")), explicit_exclusions: excluded, requirements_out_of_scope: excluded.length };
  });
  const bounded = scopes.flatMap(scope => scope.exams.map(id => {
    const exam = exams.find(entry => entry.id === id)!;
    return { exam: id, subject: exam.subject, ...scope };
  }));
  // 全卷视图绝不复用小节百分比；课程条目也不自动成为特定试卷条目。
  const wholeExamViews = exams.map(exam => {
    const graduate = exam.id.startsWith("cn-kaoyan-");
    const slices = bounded.filter(scope => scope.exam === exam.id && scope.jurisdiction === exam.jurisdiction &&
      (exam.id !== context?.supplement.stateExam.id || scope.session === exam.session));
    const sum = (key: "requirements_inventoried" | "requirements_with_concept_links" | "requirements_explicitly_unmapped") =>
      slices.reduce((total, slice) => total + slice[key], 0);
    const pending = slices.reduce((total, slice) => total + slice.requirements_pending_review - slice.requirements_with_concept_links, 0);
    return { exam: exam.id, subject: exam.subject, jurisdiction: exam.jurisdiction, paper: exam.id === "cn-gaokao" ? exam.scope : null,
      session: slices[0]?.session ?? exam.session, entryCohort: graduate ? 2027 : null, scope: "whole subject (not enumerated)",
      editions: [...new Set(slices.map(slice => slice.source.id + "@" + slice.source.version))],
      inventory_status: graduate ? "unavailable" : slices.length ? "partial" : "pending",
      availability: graduate ? graduateBook : null, ...metrics(null, sum("requirements_inventoried"),
        sum("requirements_with_concept_links"), sum("requirements_explicitly_unmapped"), pending) };
  });
  return { version: root.version, registryVersion, manifestVersion: root.manifestVersion,
    graph: graph.id + "@" + graph.version, unique_source_clauses: requirements.length, unique_linked_requirements: requirements.filter(row =>
      row.alignment_status === "aligned-author-proposed").length, scopes, perExam: bounded, wholeExamViews,
    landOverlays: registry.landOverlays, requirements };
}

type Inventory = { version: string; graph: string; manifestVersion: unknown; scopes: { id: string }[];
  requirements: { requirement_id: string; source_edition: string; locator: string }[]; graphHistory?: Record<string, string[]> };

export function compareRequirementInventories(before: Inventory, after: Inventory) {
  function diff<T>(left: T[], right: T[], id: (entry: T) => string) {
    const old = new Map(left.map(entry => [id(entry), entry]));
    const next = new Map(right.map(entry => [id(entry), entry]));
    return [...new Set([...old.keys(), ...next.keys()])].sort()
      .filter(key => JSON.stringify(old.get(key)) !== JSON.stringify(next.get(key)))
      .map(key => ({ key, before: old.get(key) ?? null, after: next.get(key) ?? null }));
  }
  const requirements = diff(before.requirements, after.requirements, row => row.requirement_id);
  const result = { before: before.version, after: after.version,
    scopes: diff(before.scopes, after.scopes, scope => scope.id),
    requirements };
  if (before.manifestVersion === "1" && after.manifestVersion === "1") return result;
  const changes = {
    added: requirements.filter(row => row.before === null).map(row => row.key),
    removed: requirements.filter(row => row.after === null).map(row => row.key),
    relocated: requirements.filter(({ before, after }) => before && after &&
      (before.locator !== after.locator || before.source_edition !== after.source_edition)).map(row => row.key),
  };
  const history = after.graphHistory ?? before.graphHistory;
  if (!history) return { ...result, changes };
  const from = history[before.graph], to = history[after.graph];
  check(from && to, "missing graph version for comparison");
  const remaining = new Set(after.requirements.map(r => r.requirement_id));
  return { ...result, changes: { ...changes, retained: before.requirements.map(r => r.requirement_id).filter(id => remaining.has(id)).sort() },
    concepts: { added: to.filter(id => !from.includes(id)).sort(), removed: from.filter(id => !to.includes(id)).sort() } };
}
