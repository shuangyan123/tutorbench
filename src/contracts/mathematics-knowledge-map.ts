import type { MathChallengeEvidenceRegistry } from "./math-challenge-evidence.js";

/** Author-proposed topology, NOT a universal curriculum, developmental law or learner mastery estimate. */
export type MathematicsStage = "primary" | "lower-secondary" | "upper-secondary" | "university-intro";
export type PisaContentArea =
  | "quantity" | "change-and-relationships" | "space-and-shape" | "uncertainty-and-data" | "cross-cutting";
export interface MathematicsKnowledgeDomain {
  readonly id: string;
  readonly label: string;
  readonly pisaContent: PisaContentArea;
  /** Distinguish OECD content labels from TutorBench-only extension labels. */
  readonly classificationSource?: "pisa-content" | "tutorbench-internal";
}
export interface MathematicsKnowledgeNode {
  readonly id: string;
  readonly domainId: string;
  readonly label: string;
  readonly stage: MathematicsStage;
  readonly prerequisiteIds: readonly string[];
  readonly commonMisconception: string;
  /** These labels describe authoring assumptions, never validated learner prerequisites. */
  readonly prerequisiteEvidence?: "author-hypothesis";
}
export interface MathematicsTaskKnowledgeMapping {
  readonly taskId: string;
  readonly nodeIds: readonly string[];
}
export interface MathematicsKnowledgeMap {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-uncalibrated";
  readonly scope: string;
  readonly sources: readonly { readonly label: string; readonly url: string; readonly use: string }[];
  readonly domains: readonly MathematicsKnowledgeDomain[];
  readonly nodes: readonly MathematicsKnowledgeNode[];
  readonly caseMappings: readonly MathematicsTaskKnowledgeMapping[];
  readonly notes: string;
}

type UnknownRecord = Record<string, unknown>;
const asRecord = (v: unknown): UnknownRecord | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as UnknownRecord : null;
const exact = (r: UnknownRecord, allowed: readonly string[]) =>
  Object.keys(r).length === allowed.length && Object.keys(r).every(k => allowed.includes(k));
const validText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 2000;
const nonemptyStrings = (v: unknown, allowEmpty = false): v is string[] =>
  Array.isArray(v) && (allowEmpty || v.length > 0) && v.length <= 100 &&
  v.every(validText) && new Set(v).size === v.length;
const nodeStages = new Set<MathematicsStage>(["primary", "lower-secondary", "upper-secondary", "university-intro"]);
const pisaAreas = new Set<PisaContentArea>(["quantity", "change-and-relationships", "space-and-shape", "uncertainty-and-data", "cross-cutting"]);

export function parseMathematicsKnowledgeMap(value: unknown): MathematicsKnowledgeMap {
  const root = asRecord(value);
  if (!root || !exact(root, ["schemaVersion", "id", "version", "status", "scope",
    "sources", "domains", "nodes", "caseMappings", "notes"]) ||
    root.schemaVersion !== 1 || !validText(root.id) || !validText(root.version) ||
    root.status !== "author-proposed-uncalibrated" ||
    !validText(root.scope) || !validText(root.notes) ||
    !Array.isArray(root.sources) || root.sources.length < 1 || root.sources.length > 20 ||
    !Array.isArray(root.domains) || root.domains.length < 1 || root.domains.length > 50 ||
    !Array.isArray(root.nodes) || root.nodes.length < 1 || root.nodes.length > 1000 ||
    !Array.isArray(root.caseMappings) || root.caseMappings.length > 1000
  ) throw new Error("mathematics_knowledge_map_invalid");

  for (const source of root.sources) {
    const r = asRecord(source);
    if (!r || !exact(r, ["label", "url", "use"]) || !validText(r.label) ||
      !validText(r.use) || !validText(r.url) || !r.url.startsWith("https://"))
      throw new Error("mathematics_knowledge_source_invalid");
  }
  const domains = new Set<string>();
  for (const value of root.domains) {
    const d = asRecord(value);
    if (!d || !(exact(d, ["id", "label", "pisaContent"]) ||
        exact(d, ["id", "label", "pisaContent", "classificationSource"])) || !validText(d.id) ||
      !validText(d.label) || !pisaAreas.has(d.pisaContent as PisaContentArea) ||
      (d.classificationSource !== undefined &&
        d.classificationSource !== (d.pisaContent === "cross-cutting" ? "tutorbench-internal" : "pisa-content")) ||
      domains.has(d.id)) throw new Error("mathematics_knowledge_domain_invalid");
    domains.add(d.id);
  }

  const nodes = new Map<string, MathematicsKnowledgeNode>();
  for (const value of root.nodes) {
    const n = asRecord(value);
    if (!n || !(exact(n, ["id", "domainId", "label", "stage", "prerequisiteIds", "commonMisconception"]) ||
        exact(n, ["id", "domainId", "label", "stage", "prerequisiteIds", "commonMisconception", "prerequisiteEvidence"])) ||
      !validText(n.id) || !validText(n.domainId) || !domains.has(n.domainId) ||
      !validText(n.label) || !nodeStages.has(n.stage as MathematicsStage) ||
      !nonemptyStrings(n.prerequisiteIds, true) || !validText(n.commonMisconception) ||
      (n.prerequisiteEvidence !== undefined && n.prerequisiteEvidence !== "author-hypothesis") ||
      nodes.has(n.id)) throw new Error("mathematics_knowledge_node_invalid");
    nodes.set(n.id, n as unknown as MathematicsKnowledgeNode);
  }
  for (const [id, node] of nodes) {
    if (node.prerequisiteIds.some(p => !nodes.has(p) || p === id))
      throw new Error("mathematics_knowledge_prerequisite_invalid");
  }
  const visited = new Set<string>(), active = new Set<string>();
  function walk(id: string): void {
    if (active.has(id)) throw new Error("mathematics_knowledge_cycle");
    if (visited.has(id)) return;
    active.add(id);
    for (const dep of nodes.get(id)!.prerequisiteIds) walk(dep);
    active.delete(id);
    visited.add(id);
  }
  for (const id of nodes.keys()) walk(id);

  const tasks = new Set<string>();
  for (const value of root.caseMappings) {
    const entry = asRecord(value);
    if (!entry || !exact(entry, ["taskId", "nodeIds"]) || !validText(entry.taskId) ||
      !nonemptyStrings(entry.nodeIds) || tasks.has(entry.taskId) ||
      entry.nodeIds.some(id => !nodes.has(id)))
      throw new Error("mathematics_knowledge_mapping_invalid");
    tasks.add(entry.taskId);
  }
  return value as MathematicsKnowledgeMap;
}

/** Require full task coverage without pretending every mathematical concept has a case. */
export function validateMathematicsTaskCoverage(
  map: MathematicsKnowledgeMap,
  evidence: MathChallengeEvidenceRegistry,
): { readonly mappedNodes: number; readonly unmappedNodes: number } {
  const expected = new Set(evidence.tasks.map(task => task.id));
  const actual = new Set(map.caseMappings.map(m => m.taskId));
  if (expected.size !== actual.size || [...expected].some(id => !actual.has(id)))
    throw new Error("mathematics_knowledge_task_coverage_mismatch");
  const used = new Set(map.caseMappings.flatMap(m => m.nodeIds));
  return { mappedNodes: used.size, unmappedNodes: map.nodes.length - used.size };
}
