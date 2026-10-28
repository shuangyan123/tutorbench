import type { MathChallengeEvidenceRegistry } from "./math-challenge-evidence.js";

/** Author-proposed topology, NOT a universal curriculum, developmental law or learner mastery estimate. */
export type MathematicsStage = "primary" | "lower-secondary" | "upper-secondary" | "university-intro";
/** Official PISA mathematical content areas, excluding internal TutorBench extensions. */
export type OfficialPisaContentArea =
  | "quantity" | "change-and-relationships" | "space-and-shape" | "uncertainty-and-data";
/** Legacy field type: cross-cutting was previously stored in pisaContent. */
export type PisaContentArea = OfficialPisaContentArea | "cross-cutting";
export type KnowledgeRelationType = "necessary" | "helpful";
export type KnowledgeEvidenceStatus = "author-hypothesis" | "expert-reviewed" | "learner-validated";
export interface MathematicsKnowledgeDomain {
  readonly id: string;
  readonly label: string;
  /** Kept optional to read v1 legacy maps. Never place cross-cutting here in v2. */
  readonly pisaContent?: PisaContentArea;
  readonly classificationSource?: "pisa-content" | "tutorbench-internal";
  readonly internalCategory?: "cross-cutting-practice" | "advanced-topics";
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
/** Per-edge semantics. A hypothesis cannot assert a mandatory prerequisite. */
export interface MathematicsKnowledgeRelation {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relationType: KnowledgeRelationType;
  readonly evidenceStatus: KnowledgeEvidenceStatus;
  readonly sourceRefs: readonly string[];
}
/** An author-proposed approach, not a required sequence or learner diagnosis. */
export interface MathematicsAlternativeLearningPath {
  readonly id: string;
  readonly targetNodeId: string;
  readonly nodeIds: readonly string[];
  readonly description: string;
  readonly evidenceStatus: "author-hypothesis";
}
/** Curriculum-specific stage overlays; global node.stage remains an authoring fallback. */
export interface MathematicsCurriculumStageMapping {
  readonly curriculumId: string;
  readonly nodeId: string;
  readonly stage: MathematicsStage;
  readonly mappingStatus: "author-proposed" | "source-verified";
  readonly sourceRefs: readonly string[];
}
export interface MathematicsTaskKnowledgeMapping {
  readonly taskId: string;
  readonly nodeIds: readonly string[];
}
export interface MathematicsKnowledgeMap {
  /** v2 adds typed relations, alternative approaches and curriculum stage overlays. */
  readonly schemaVersion: 1 | 2;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-uncalibrated";
  readonly scope: string;
  readonly sources: readonly { readonly label: string; readonly url: string; readonly use: string }[];
  readonly domains: readonly MathematicsKnowledgeDomain[];
  readonly nodes: readonly MathematicsKnowledgeNode[];
  readonly caseMappings: readonly MathematicsTaskKnowledgeMapping[];
  /** Available on v2 registries; legacy v1 can still be read. */
  readonly knowledgeRelations?: readonly MathematicsKnowledgeRelation[];
  readonly alternativePaths?: readonly MathematicsAlternativeLearningPath[];
  readonly curriculumStageMappings?: readonly MathematicsCurriculumStageMapping[];
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
const officialPisaAreas = new Set<OfficialPisaContentArea>([
  "quantity", "change-and-relationships", "space-and-shape", "uncertainty-and-data",
]);
const relationTypes = new Set<KnowledgeRelationType>(["necessary", "helpful"]);
const evidenceStatuses = new Set<KnowledgeEvidenceStatus>([
  "author-hypothesis", "expert-reviewed", "learner-validated",
]);

export function parseMathematicsKnowledgeMap(value: unknown): MathematicsKnowledgeMap {
  const root = asRecord(value);
  const baseFields = ["schemaVersion", "id", "version", "status", "scope",
    "sources", "domains", "nodes", "caseMappings", "notes"];
  const v2Fields = [...baseFields, "knowledgeRelations", "alternativePaths", "curriculumStageMappings"];
  if (!root ||
    !(root.schemaVersion === 1 ? exact(root, baseFields) :
      root.schemaVersion === 2 ? exact(root, v2Fields) : false) ||
    !validText(root.id) || !validText(root.version) ||
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
    if (!d || !validText(d.id) || !validText(d.label) || domains.has(d.id))
      throw new Error("mathematics_knowledge_domain_invalid");
    if (root.schemaVersion === 2) {
      const official = exact(d, ["id", "label", "pisaContent", "classificationSource"]) &&
        d.classificationSource === "pisa-content" &&
        officialPisaAreas.has(d.pisaContent as OfficialPisaContentArea);
      const internal = exact(d, ["id", "label", "internalCategory", "classificationSource"]) &&
        d.classificationSource === "tutorbench-internal" &&
        (d.internalCategory === "cross-cutting-practice" || d.internalCategory === "advanced-topics");
      if (!official && !internal) throw new Error("mathematics_knowledge_domain_invalid");
    } else {
      const legacy = exact(d, ["id", "label", "pisaContent"]) ||
        exact(d, ["id", "label", "pisaContent", "classificationSource"]);
      const expected = d.pisaContent === "cross-cutting" ? "tutorbench-internal" : "pisa-content";
      if (!legacy ||
        !(officialPisaAreas.has(d.pisaContent as OfficialPisaContentArea) ||
          d.pisaContent === "cross-cutting") ||
        (d.classificationSource !== undefined && d.classificationSource !== expected))
        throw new Error("mathematics_knowledge_domain_invalid");
    }
    domains.add(d.id as string);
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

  if (root.schemaVersion === 2) {
    const allLegacyEdges = new Set<string>();
    for (const node of nodes.values())
      for (const parentId of node.prerequisiteIds)
        allLegacyEdges.add(parentId + "=>" + node.id);
    const relations = root.knowledgeRelations;
    if (!Array.isArray(relations) || relations.length !== allLegacyEdges.size)
      throw new Error("mathematics_knowledge_relation_coverage_mismatch");
    const seenEdges = new Set<string>();
    for (const value of relations) {
      const edge = asRecord(value);
      if (!edge || !exact(edge, ["fromNodeId", "toNodeId", "relationType", "evidenceStatus", "sourceRefs"]) ||
        !validText(edge.fromNodeId) || !validText(edge.toNodeId) ||
        !nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId) ||
        edge.fromNodeId === edge.toNodeId ||
        !relationTypes.has(edge.relationType as KnowledgeRelationType) ||
        !evidenceStatuses.has(edge.evidenceStatus as KnowledgeEvidenceStatus) ||
        !nonemptyStrings(edge.sourceRefs, true) ||
        (edge.relationType === "necessary" && edge.evidenceStatus === "author-hypothesis") ||
        (edge.evidenceStatus !== "author-hypothesis" && edge.sourceRefs.length === 0))
        throw new Error("mathematics_knowledge_relation_invalid");
      const key = edge.fromNodeId + "=>" + edge.toNodeId;
      if (seenEdges.has(key)) throw new Error("mathematics_knowledge_relation_duplicate");
      seenEdges.add(key);
    }
    if (seenEdges.size !== allLegacyEdges.size ||
      [...allLegacyEdges].some(key => !seenEdges.has(key)))
      throw new Error("mathematics_knowledge_relation_coverage_mismatch");

    const paths = root.alternativePaths;
    if (!Array.isArray(paths) || paths.length > 500)
      throw new Error("mathematics_knowledge_alternative_path_invalid");
    const seenPaths = new Set<string>(), targetPaths = new Map<string, number>();
    for (const value of paths) {
      const path = asRecord(value);
      if (!path || !exact(path, ["id", "targetNodeId", "nodeIds", "description", "evidenceStatus"]) ||
        !validText(path.id) || seenPaths.has(path.id) || !validText(path.targetNodeId) ||
        !nodes.has(path.targetNodeId) || !nonemptyStrings(path.nodeIds) ||
        path.nodeIds.some(id => !nodes.has(id) || id === path.targetNodeId) ||
        !validText(path.description) || path.evidenceStatus !== "author-hypothesis")
        throw new Error("mathematics_knowledge_alternative_path_invalid");
      seenPaths.add(path.id);
      const target = path.targetNodeId as string;
      targetPaths.set(target, (targetPaths.get(target) ?? 0) + 1);
    }
    if ([...targetPaths.values()].some(count => count < 2))
      throw new Error("mathematics_knowledge_alternative_path_incomplete");

    const mappings = root.curriculumStageMappings;
    if (!Array.isArray(mappings) || mappings.length > 2000)
      throw new Error("mathematics_knowledge_curriculum_stage_invalid");
    const seenMappings = new Set<string>();
    for (const value of mappings) {
      const m = asRecord(value);
      if (!m || !exact(m, ["curriculumId", "nodeId", "stage", "mappingStatus", "sourceRefs"]) ||
        !validText(m.curriculumId) || !validText(m.nodeId) || !nodes.has(m.nodeId) ||
        !nodeStages.has(m.stage as MathematicsStage) ||
        (m.mappingStatus !== "author-proposed" && m.mappingStatus !== "source-verified") ||
        !nonemptyStrings(m.sourceRefs, true) ||
        (m.mappingStatus === "source-verified" && m.sourceRefs.length === 0))
        throw new Error("mathematics_knowledge_curriculum_stage_invalid");
      const key = m.curriculumId + "=>" + m.nodeId;
      if (seenMappings.has(key))
        throw new Error("mathematics_knowledge_curriculum_stage_duplicate");
      seenMappings.add(key);
    }
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
