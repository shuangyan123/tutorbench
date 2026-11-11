/**
 * Domain-neutral, read-only structural index for author-proposed subject links.
 *
 * The caller resolves/pins real suite, case, version, evidence and disciplinary
 * meaning BEFORE entering this adapter. It deliberately never infers concepts,
 * creates prerequisites, scores a Tutor, or verifies learner outcomes.
 */
export interface SubjectKnowledgeNodeRef {
  readonly disciplineId: string;
  readonly id: string;
}
export interface SubjectConceptCandidate {
  /** A caller-generated, fully versioned, exact source identity. */
  readonly sourceKey: string;
  readonly disciplineId: string;
  readonly focusNodeIds: readonly string[];
  readonly supportingNodeIds: readonly string[];
}
export interface SubjectLinkIndexInputs {
  readonly sourceKeys: readonly string[];
  readonly knowledgeNodes: readonly SubjectKnowledgeNodeRef[];
  readonly candidateLinks: readonly SubjectConceptCandidate[];
  readonly explicitGapSourceKeys: readonly string[];
}
export interface SubjectLinkIndexNode {
  readonly disciplineId: string;
  readonly id: string;
  readonly focusSourceKeys: readonly string[];
  readonly supportingSourceKeys: readonly string[];
}
export interface SubjectLinkIndexSource {
  readonly sourceKey: string;
  readonly disposition: "candidate_linked" | "explicitly_unmapped";
  readonly disciplineId: string | null;
  readonly focusNodeIds: readonly string[];
  readonly supportingNodeIds: readonly string[];
}
export interface SubjectLinkIndex {
  readonly scope: "authored_sources_only";
  readonly independentlyReviewed: false;
  readonly modelRunsMeasured: false;
  readonly learnerOutcomesMeasured: false;
  readonly counts: {
    readonly sources: number;
    readonly candidateLinks: number;
    readonly explicitGaps: number;
    readonly graphNodes: number;
    readonly focusNodes: number;
    readonly linkedNodes: number;
    readonly supportingOnlyNodes: number;
  };
  readonly sources: readonly SubjectLinkIndexSource[];
  readonly nodes: readonly SubjectLinkIndexNode[];
}

const valid = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const distinct = (s: readonly string[]) => new Set(s).size === s.length;
const sorted = (s: readonly string[]) => [...s].sort();
const nodeKey = (discipline: string, id: string) => JSON.stringify([discipline, id]);

export function buildSubjectLinkIndex(inputs: SubjectLinkIndexInputs): SubjectLinkIndex {
  const { sourceKeys, knowledgeNodes, candidateLinks, explicitGapSourceKeys } = inputs;
  if (!Array.isArray(sourceKeys) || !Array.isArray(knowledgeNodes) ||
      !Array.isArray(candidateLinks) || !Array.isArray(explicitGapSourceKeys) ||
      sourceKeys.some(x => !valid(x)) || !distinct(sourceKeys))
    throw new Error("subject_index_sources_invalid");
  if (knowledgeNodes.some(n => !n || !valid(n.disciplineId) || !valid(n.id)))
    throw new Error("subject_index_node_invalid");
  const allNodeKeys = knowledgeNodes.map(n => nodeKey(n.disciplineId, n.id));
  if (!distinct(allNodeKeys)) throw new Error("subject_index_node_duplicate");
  const sourceSet = new Set(sourceKeys);
  const nodeSet = new Set(allNodeKeys);
  const candidateBySource = new Map<string, SubjectConceptCandidate>();
  const focusByNode = new Map<string, string[]>();
  const supportingByNode = new Map<string, string[]>();
  for (const link of candidateLinks) {
    if (!link || !valid(link.sourceKey) || !valid(link.disciplineId) ||
        !Array.isArray(link.focusNodeIds) || !Array.isArray(link.supportingNodeIds) ||
        link.focusNodeIds.length === 0 ||
        !distinct(link.focusNodeIds) || !distinct(link.supportingNodeIds) ||
        link.focusNodeIds.some(id => !valid(id)) || link.supportingNodeIds.some(id => !valid(id)) ||
        link.focusNodeIds.some(id => link.supportingNodeIds.includes(id)))
      throw new Error("subject_index_candidate_invalid");
    if (!sourceSet.has(link.sourceKey)) throw new Error("subject_index_source_stale");
    if (candidateBySource.has(link.sourceKey)) throw new Error("subject_index_candidate_duplicate");
    const add = (id: string, target: Map<string, string[]>) => {
      const key = nodeKey(link.disciplineId, id);
      if (!nodeSet.has(key)) throw new Error("subject_index_node_missing");
      target.set(key, [...(target.get(key) ?? []), link.sourceKey]);
    };
    for (const id of link.focusNodeIds) add(id, focusByNode);
    for (const id of link.supportingNodeIds) add(id, supportingByNode);
    candidateBySource.set(link.sourceKey, link);
  }

  if (explicitGapSourceKeys.some(key => !valid(key)))
    throw new Error("subject_index_gap_invalid");
  if (!distinct(explicitGapSourceKeys)) throw new Error("subject_index_gap_duplicate");
  const gapSet = new Set(explicitGapSourceKeys);
  for (const key of gapSet) {
    if (!sourceSet.has(key)) throw new Error("subject_index_gap_stale");
    if (candidateBySource.has(key)) throw new Error("subject_index_conflicting_disposition");
  }
  if (sourceSet.size !== candidateBySource.size + gapSet.size)
    throw new Error("subject_index_incomplete");

  const sources: SubjectLinkIndexSource[] = sorted(sourceKeys).map(sourceKey => {
    const link = candidateBySource.get(sourceKey);
    return link ? {
      sourceKey,
      disposition: "candidate_linked" as const,
      disciplineId: link.disciplineId,
      focusNodeIds: sorted(link.focusNodeIds),
      supportingNodeIds: sorted(link.supportingNodeIds),
    } : {
      sourceKey,
      disposition: "explicitly_unmapped" as const,
      disciplineId: null,
      focusNodeIds: [],
      supportingNodeIds: [],
    };
  });
  const nodes: SubjectLinkIndexNode[] = knowledgeNodes.map(node => {
    const key = nodeKey(node.disciplineId, node.id);
    return {
      disciplineId: node.disciplineId, id: node.id,
      focusSourceKeys: sorted(focusByNode.get(key) ?? []),
      supportingSourceKeys: sorted(supportingByNode.get(key) ?? []),
    };
  }).sort((a, b) => nodeKey(a.disciplineId, a.id).localeCompare(nodeKey(b.disciplineId, b.id)));
  return {
    scope: "authored_sources_only",
    independentlyReviewed: false,
    modelRunsMeasured: false,
    learnerOutcomesMeasured: false,
    counts: {
      sources: sources.length,
      candidateLinks: candidateBySource.size,
      explicitGaps: gapSet.size,
      graphNodes: nodes.length,
      focusNodes: nodes.filter(n => n.focusSourceKeys.length > 0).length,
      linkedNodes: nodes.filter(n => n.focusSourceKeys.length + n.supportingSourceKeys.length > 0).length,
      supportingOnlyNodes: nodes.filter(n => n.focusSourceKeys.length === 0 && n.supportingSourceKeys.length > 0).length,
    },
    sources,
    nodes,
  };
}
