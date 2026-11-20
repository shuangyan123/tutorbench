import { parseMathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import { createHash } from "node:crypto";
import { applyGapSnapshot } from "./exam-gap-audit.js";
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
  expansion?: unknown) {
  const base = inspectRequirements(baseInput, registry, graphInput);
  const { inventory, extended, audit } = applyGapSnapshot(input, baseInput, parseMathematicsKnowledgeMap(graphInput), base);
  if (expansion === undefined) return { ...inspectRows(inventory, registry, extended, "gap"), gapAudit: audit };
  const delta = record(expansion, "version baseInventory manifestVersion scopes requirements");
  check(delta.version === "0.4.0" && delta.baseInventory === inventory.version && delta.manifestVersion === "2", "expansion pins");
  const report = inspectRows({ ...inventory, version: delta.version, manifestVersion: delta.manifestVersion,
    scopes: [...inventory.scopes, ...array(delta.scopes)], requirements: [...inventory.requirements, ...array(delta.requirements)] },
  registry, extended, "expanded");
  check(createHash("sha256").update(JSON.stringify(expansion)).digest("hex") ===
    "0840807dc8363e96d86da14abf7709d4e69f671cbba3d5313986c66d067d2672", "changed 0.4.0 snapshot");
  return { ...report, gapAudit: audit, sourceObservations };
}

function inspectRows(input: unknown, registry: ExamSpecifications, graph: ReturnType<typeof parseMathematicsKnowledgeMap>,
  mode: "legacy" | "gap" | "expanded") {
  const root = record(input, "version registryVersion manifestVersion scopes requirements");
  const expanded = mode === "expanded";
  check(root.registryVersion === registry.version && registry.version === "0.1.0" && root.manifestVersion === (expanded ? "2" : "1") &&
    (root.version === "0.3.0") === (mode === "gap") && (root.version === "0.4.0") === expanded, "stale inventory pins");
  check(typeof root.version === "string" && /^\d+\.\d+\.\d+$/.test(root.version), "snapshot version");
  const manifest = expanded ? expandedEnumerationScopes(registry) : enumerationScopes(registry);
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
    return { requirement_id: stableId, source_edition: edition, source_sha256: scope.source.sha256,
      parent: scope.id, anchor: row.anchor, locator: scope.parent + " / " + row.anchor,
      summary: row.summary, alignment_status: row.status, concept_id: concept, legacy_clause: row.legacy };
  }).sort((left, right) => left.requirement_id < right.requirement_id ? -1 : 1);
  const scopes = manifest.map(scope => {
    const rows = requirements.filter(row => row.parent === scope.id);
    const complete = declared.get(scope.id) === "complete";
    check(!complete || rows.length === scope.anchors.length, "incomplete leaf census");
    for (const exam of scope.exams) check(registry.exams.some(entry => entry.id === exam), "missing exam");
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
    const exam = registry.exams.find(entry => entry.id === id)!;
    return { exam: id, subject: exam.subject, ...scope };
  }));
  // 全卷视图绝不复用小节百分比；课程条目也不自动成为特定试卷条目。
  const wholeExamViews = registry.exams.map(exam => {
    const graduate = exam.id.startsWith("cn-kaoyan-");
    const slices = bounded.filter(scope => scope.exam === exam.id && scope.jurisdiction === exam.jurisdiction);
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
  return { version: root.version, registryVersion: registry.version, manifestVersion: root.manifestVersion,
    graph: graph.id + "@" + graph.version, unique_source_clauses: requirements.length, unique_linked_requirements: requirements.filter(row =>
      row.alignment_status === "aligned-author-proposed").length, scopes, perExam: bounded, wholeExamViews,
    landOverlays: registry.landOverlays, requirements };
}

type Inventory = ReturnType<typeof inspectRequirements>;

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
  if (before.manifestVersion !== "2" && after.manifestVersion !== "2") return result;
  return { ...result, changes: {
    added: requirements.filter(row => row.before === null).map(row => row.key),
    removed: requirements.filter(row => row.after === null).map(row => row.key),
    relocated: requirements.filter(({ before, after }) => before && after &&
      (before.locator !== after.locator || before.source_edition !== after.source_edition)).map(row => row.key),
  } };
}
