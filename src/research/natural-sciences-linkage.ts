import {
  validateAcademicStructureRegistryReferences,
  type AcademicStructure,
} from "../contracts/academic-structure.js";
import { CASE_SYSTEM_VNEXT_DOMAIN_IDS } from "../contracts/case-system-vnext-domain-taxonomy.js";
import type { TutorEvalCategory, TutorEvalDataset } from "../contracts/tutor-eval.js";
import type { TutorHealthDimension } from "../contracts/tutor-health.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../datasets/real-world.js";
import { buildSubjectLinkIndex } from "./subject-knowledge-linkage.js";

/**
 * A minimal indexing boundary. Subject-specific scope, reasoning facets and
 * internal conceptual relationships remain authored in each discipline map.
 * This is NOT a universal knowledge/prerequisite ontology.
 */
export const NATURAL_SCIENCE_IDS = ["physics", "chemistry", "biology"] as const;
export type NaturalScienceId = (typeof NATURAL_SCIENCE_IDS)[number];
export interface NaturalScienceSeedMap {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly disciplineId: NaturalScienceId;
  readonly status: "author-proposed-unreviewed";
  readonly domainTaxonomy: { readonly id: string; readonly version: string };
  readonly purpose: string;
  readonly domains: readonly { readonly id: string; readonly label: string }[];
  readonly nodes: readonly {
    readonly id: string;
    readonly domainId: string;
    readonly label: string;
    readonly reasoningFacet: string;
    readonly scopeNote: string;
  }[];
  /** No instructional prerequisite is asserted in this exploratory stage. */
  readonly relationHypotheses: readonly [];
}
export interface NaturalScienceCaseSource {
  readonly kind: "eval_case" | "experimental_decision_point";
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly id: string;
  readonly version: string;
  readonly decisionPointId: string | null;
}
export interface NaturalScienceCandidateLink {
  readonly disciplineId: NaturalScienceId;
  readonly source: NaturalScienceCaseSource;
  readonly nodes: readonly { readonly id: string; readonly role: "focus" | "supporting" }[];
  readonly evidenceAnchor: "tutorInput.learningObjective" | "learningContext.learningObjective";
  readonly rationale: string;
  readonly reviewStatus: "author-proposed-unreviewed";
}
export interface NaturalScienceCandidateRegistry {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-unreviewed";
  readonly purpose: string;
  readonly sources: {
    readonly academic: { readonly id: string; readonly version: string };
    readonly maps: readonly { readonly id: string; readonly version: string }[];
    readonly evalDataset: { readonly id: string; readonly version: string };
    readonly experimentalSuites: readonly { readonly id: string; readonly version: string }[];
  };
  readonly links: readonly NaturalScienceCandidateLink[];
}
export interface NaturalScienceExplicitGap {
  readonly source: NaturalScienceCaseSource;
  readonly reasonCode: "insufficient_discipline_attribution";
  readonly candidateDisciplines: readonly NaturalScienceId[];
  readonly rationale: string;
  readonly reviewStatus: "author-proposed-unreviewed";
}
export interface NaturalScienceGapRegistry {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-unreviewed";
  readonly purpose: string;
  readonly gaps: readonly NaturalScienceExplicitGap[];
}
export interface NaturalScienceIntegrationInputs {
  readonly academic: AcademicStructure;
  readonly mathematicsSummary: { readonly id: string; readonly domains: number; readonly nodes: number };
  readonly mathematicsExamProfileIds: readonly string[];
  readonly maps: readonly NaturalScienceSeedMap[];
  readonly evalDataset: TutorEvalDataset;
  readonly experimentalSuites: readonly TutorScenarioSuiteVNext[];
  readonly registry: NaturalScienceCandidateRegistry;
  readonly gaps: NaturalScienceGapRegistry;
}
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const exact = (obj: Obj, keys: readonly string[]): boolean =>
  Object.keys(obj).length === keys.length && Object.keys(obj).every(k => keys.includes(k));
const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length;
const orderedUnique = <T extends string>(items: readonly T[]): T[] => [...new Set(items)].sort();
const match = (a: { readonly id: string; readonly version: string }, b: { readonly id: string; readonly version: string }): boolean =>
  a.id === b.id && a.version === b.version;

export function parseNaturalScienceSeedMap(raw: unknown): NaturalScienceSeedMap {
  if (!isObj(raw) ||
      !exact(raw, ["schemaVersion", "id", "version", "disciplineId", "status",
        "domainTaxonomy", "purpose", "domains", "nodes", "relationHypotheses"]) ||
      raw.schemaVersion !== 1 || !nonEmpty(raw.id) || !nonEmpty(raw.version) ||
      !NATURAL_SCIENCE_IDS.includes(raw.disciplineId as NaturalScienceId) ||
      raw.status !== "author-proposed-unreviewed" || !nonEmpty(raw.purpose) ||
      !isObj(raw.domainTaxonomy) ||
      !exact(raw.domainTaxonomy, ["id", "version"]) ||
      raw.domainTaxonomy.id !== "case-system-vnext-domain-taxonomy" ||
      raw.domainTaxonomy.version !== "0.1.0" ||
      !Array.isArray(raw.domains) || raw.domains.length < 1 ||
      !Array.isArray(raw.nodes) || raw.nodes.length < 1 ||
      !Array.isArray(raw.relationHypotheses) || raw.relationHypotheses.length !== 0) {
    throw new Error("science_map_invalid");
  }
  const expectedId = raw.disciplineId + "-knowledge-seed-v0.1";
  if (raw.id !== expectedId || raw.version !== "0.1.0" ||
      !CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(raw.disciplineId as NaturalScienceId))
    throw new Error("science_map_identity_invalid");
  for (const d of raw.domains) {
    if (!isObj(d) || !exact(d, ["id", "label"]) || !nonEmpty(d.id) || !nonEmpty(d.label))
      throw new Error("science_map_domain_invalid");
  }
  for (const n of raw.nodes) {
    if (!isObj(n) || !exact(n, ["id", "domainId", "label", "reasoningFacet", "scopeNote"]) ||
        !nonEmpty(n.id) || !nonEmpty(n.domainId) || !nonEmpty(n.label) ||
        !nonEmpty(n.reasoningFacet) || !nonEmpty(n.scopeNote))
      throw new Error("science_map_node_invalid");
  }
  const parsed = raw as unknown as NaturalScienceSeedMap;
  if (!unique(parsed.domains.map(x => x.id)) || !unique(parsed.nodes.map(x => x.id)) ||
      parsed.nodes.some(x => !parsed.domains.some(d => d.id === x.domainId)))
    throw new Error("science_map_graph_invalid");
  return parsed;
}
export function scienceSourceKey(s: NaturalScienceCaseSource): string {
  return [s.kind, s.suiteId, s.suiteVersion, s.id, s.version, s.decisionPointId ?? ""].join("|");
}
interface SourceContext {
  readonly source: NaturalScienceCaseSource;
  readonly declaredDiscipline: NaturalScienceId | null;
  readonly topic: string;
  readonly objective: string;
  readonly evalCategories: readonly TutorEvalCategory[];
  readonly experimentalHealthDimensions: readonly TutorHealthDimension[];
}
export interface NaturalScienceInventoryRow extends SourceContext {
  readonly mappingStatus: "candidate_linked" | "explicitly_unmapped";
  readonly mappedDiscipline: NaturalScienceId | null;
  readonly focusNodeIds: readonly string[];
  readonly supportingNodeIds: readonly string[];
  readonly rationale: string;
  readonly independentlyReviewed: false;
}
export interface NaturalScienceNodeRow {
  readonly id: string;
  readonly disciplineId: NaturalScienceId;
  readonly domainId: string;
  readonly reasoningFacet: string;
  readonly focusCaseCount: number;
  readonly supportingCaseCount: number;
  readonly evalCategoryTags: readonly TutorEvalCategory[];
  /** Experimental Scenario dimensions only; this is NOT default Tutor Health. */
  readonly experimentalHealthDimensionTags: readonly TutorHealthDimension[];
}
export interface NaturalScienceCoverageReport {
  readonly scope: "canonical_science_eval_and_two_experimental_suites";
  readonly inventoryComplete: true;
  readonly semanticReviewCompleted: false;
  readonly officialCurriculumVerified: false;
  readonly modelRunsMeasured: false;
  readonly learnerOutcomesMeasured: false;
  readonly defaultTutorHealthCoverageMeasured: false;
  readonly sources: NaturalScienceCandidateRegistry["sources"];
  readonly counts: {
    readonly subjects: number;
    readonly knowledgeNodes: number;
    readonly canonicalScienceEvalCases: number;
    readonly experimentalDecisionPoints: number;
    readonly candidateLinks: number;
    readonly explicitlyUnmapped: number;
    readonly focusNodes: number;
    readonly independentlyReviewed: 0;
  };
  readonly subjects: readonly {
    readonly id: NaturalScienceId;
    readonly knowledgeNodes: number;
    readonly candidateLinks: number;
    readonly focusNodes: number;
  }[];
  readonly inventory: readonly NaturalScienceInventoryRow[];
  readonly nodes: readonly NaturalScienceNodeRow[];
}

export function buildNaturalScienceCoverageAudit(i: NaturalScienceIntegrationInputs): NaturalScienceCoverageReport {
  const { academic, mathematicsSummary, mathematicsExamProfileIds, maps, evalDataset, experimentalSuites, registry, gaps } = i;
  if (registry.schemaVersion !== 1 || registry.id !== "natural-sciences-case-knowledge-links-v0.1" ||
      registry.version !== "0.1.0" || registry.status !== "author-proposed-unreviewed" ||
      !nonEmpty(registry.purpose) || gaps.schemaVersion !== 1 ||
      gaps.id !== "natural-sciences-knowledge-unmapped-v0.1" ||
      gaps.version !== "0.1.0" || gaps.status !== "author-proposed-unreviewed" ||
      !nonEmpty(gaps.purpose) || !Array.isArray(gaps.gaps) || !Array.isArray(registry.links) ||
      !Array.isArray(registry.sources.maps) || !Array.isArray(registry.sources.experimentalSuites))
    throw new Error("science_registry_invalid");
  if (!match(registry.sources.academic, academic) || !match(registry.sources.evalDataset, evalDataset) ||
      maps.length !== NATURAL_SCIENCE_IDS.length ||
      registry.sources.maps.length !== maps.length ||
      experimentalSuites.length !== 2 || registry.sources.experimentalSuites.length !== 2 ||
      maps.some(m => !registry.sources.maps.some(r => match(r, m))) ||
      experimentalSuites.some(s => !registry.sources.experimentalSuites.some(r => match(r, s))))
    throw new Error("science_snapshot_identity_invalid");

  const mapByDiscipline = new Map<NaturalScienceId, NaturalScienceSeedMap>();
  for (const m of maps) {
    parseNaturalScienceSeedMap(m);
    if (mapByDiscipline.has(m.disciplineId)) throw new Error("science_duplicate_discipline");
    mapByDiscipline.set(m.disciplineId, m);
    const nav = academic.disciplines.find(d => d.id === m.disciplineId);
    const known = academic.knowledgeSystems.find(k => k.id === m.id);
    if (!nav || nav.systemId !== "natural-sciences" || !nav.knowledgeSystemIds.includes(m.id) ||
        !known || known.disciplineId !== m.disciplineId ||
        known.registryPath !== "scenarios/experimental/natural-sciences-knowledge-v0.1/" + m.disciplineId + ".json")
      throw new Error("science_academic_reference_invalid");
  }
  if (NATURAL_SCIENCE_IDS.some(id => !mapByDiscipline.has(id))) throw new Error("science_missing_discipline");
  validateAcademicStructureRegistryReferences(
    academic,
    [mathematicsSummary, ...maps.map(m => ({ id: m.id, domains: m.domains.length, nodes: m.nodes.length }))],
    mathematicsExamProfileIds,
  );
  const expected = new Map<string, SourceContext>();
  const add = (ctx: SourceContext): void => {
    const k = scienceSourceKey(ctx.source);
    if (expected.has(k)) throw new Error("science_duplicate_source");
    expected.set(k, ctx);
  };
  for (const c of evalDataset.cases) {
    if (c.metadata.subject !== "science") continue;
    add({
      source: { kind: "eval_case", suiteId: evalDataset.id, suiteVersion: evalDataset.version,
        id: c.id, version: c.version, decisionPointId: null },
      declaredDiscipline: null,
      topic: c.metadata.topic,
      objective: c.tutorInput.learningObjective,
      evalCategories: orderedUnique(c.evaluatorOnly.rubrics.map(r => r.category)),
      experimentalHealthDimensions: [],
    });
  }
  for (const suite of experimentalSuites) {
    const compiled = tutorScenarioSuiteToTutorEvalDataset(suite);
    for (const s of suite.scenarios) {
      if (!NATURAL_SCIENCE_IDS.includes(s.learningContext.subject as NaturalScienceId)) continue;
      const declaredDiscipline = s.learningContext.subject as NaturalScienceId;
      for (const point of s.decisionPoints) {
        const asCase = compiled.cases.find(c => c.id === point.evaluationCaseId);
        if (!asCase || asCase.version !== s.identity.version + ":" + point.id)
          throw new Error("science_compiler_reference_drift");
        add({
          source: { kind: "experimental_decision_point", suiteId: suite.id, suiteVersion: suite.version,
            id: s.identity.id, version: s.identity.version, decisionPointId: point.id },
          declaredDiscipline,
          topic: s.learningContext.topic,
          objective: s.learningContext.learningObjective,
          evalCategories: orderedUnique(point.evaluationCriteria.map(x => x.category)),
          experimentalHealthDimensions: orderedUnique(point.evaluationCriteria.map(x => x.dimension)),
        });
      }
    }
  }

  const linked = new Map<string, NaturalScienceCandidateLink>();
  for (const link of registry.links) {
    if (!link || !link.source || !NATURAL_SCIENCE_IDS.includes(link.disciplineId) ||
        link.reviewStatus !== "author-proposed-unreviewed" || !nonEmpty(link.rationale) ||
        !Array.isArray(link.nodes) || link.nodes.length < 1)
      throw new Error("science_link_invalid");
    const k = scienceSourceKey(link.source), ctx = expected.get(k);
    if (!ctx) throw new Error("science_link_stale_source");
    if (linked.has(k)) throw new Error("science_link_duplicate");
    if (ctx.declaredDiscipline !== null && ctx.declaredDiscipline !== link.disciplineId)
      throw new Error("science_cross_discipline_mismatch");
    const expectedAnchor = link.source.kind === "eval_case" ?
      "tutorInput.learningObjective" : "learningContext.learningObjective";
    if (link.evidenceAnchor !== expectedAnchor || !nonEmpty(ctx.objective))
      throw new Error("science_link_evidence_anchor_invalid");
    const known = new Set(mapByDiscipline.get(link.disciplineId)!.nodes.map(node => node.id));
    const candidateNodes: readonly NaturalScienceCandidateLink["nodes"][number][] = link.nodes;
    if (candidateNodes.some(n => !n || !known.has(n.id) || !["focus", "supporting"].includes(n.role)) ||
        !unique(candidateNodes.map(n => n.id)) || !candidateNodes.some(n => n.role === "focus"))
      throw new Error("science_link_node_invalid");
    linked.set(k, link);
  }
  const explicitGaps = new Map<string, NaturalScienceExplicitGap>();
  for (const gap of gaps.gaps) {
    if (!gap || !gap.source || gap.reviewStatus !== "author-proposed-unreviewed" ||
        gap.reasonCode !== "insufficient_discipline_attribution" ||
        !nonEmpty(gap.rationale) || !Array.isArray(gap.candidateDisciplines) ||
        gap.candidateDisciplines.length < 2 ||
        gap.candidateDisciplines.some((x: NaturalScienceId) => !NATURAL_SCIENCE_IDS.includes(x)) ||
        !unique(gap.candidateDisciplines))
      throw new Error("science_gap_invalid");
    const k = scienceSourceKey(gap.source);
    const ctx = expected.get(k);
    if (!ctx) throw new Error("science_gap_stale_source");
    if (ctx.declaredDiscipline !== null) throw new Error("science_gap_requires_unattributed_source");
    if (linked.has(k)) throw new Error("science_link_gap_conflict");
    if (explicitGaps.has(k)) throw new Error("science_gap_duplicate");
    explicitGaps.set(k, gap);
  }
  if (expected.size !== linked.size + explicitGaps.size) throw new Error("science_inventory_incomplete");

  // Shared structural projection, with actual science identity/semantics kept
  // in the existing science-specific validators above.
  const sourceIndex = buildSubjectLinkIndex({
    sourceKeys: [...expected.keys()],
    knowledgeNodes: maps.flatMap(m => m.nodes.map(n => ({ disciplineId: m.disciplineId, id: n.id }))),
    candidateLinks: [...linked.entries()].map(([sourceKey, link]) => ({
      sourceKey,
      disciplineId: link.disciplineId,
      focusNodeIds: link.nodes.filter(n => n.role === "focus").map(n => n.id),
      supportingNodeIds: link.nodes.filter(n => n.role === "supporting").map(n => n.id),
    })),
    explicitGapSourceKeys: [...explicitGaps.keys()],
  });
  const indexNode = new Map(sourceIndex.nodes.map(n =>
    [JSON.stringify([n.disciplineId, n.id]), n]));

  const inventory: NaturalScienceInventoryRow[] = [...expected.entries()].map(([k, ctx]) => {
    const link = linked.get(k), gap = explicitGaps.get(k);
    if (!link && !gap) throw new Error("science_inventory_incomplete");
    return {
      ...ctx,
      mappingStatus: link ? "candidate_linked" as const : "explicitly_unmapped" as const,
      mappedDiscipline: link?.disciplineId ?? null,
      focusNodeIds: orderedUnique(link?.nodes.filter(x => x.role === "focus").map(x => x.id) ?? []),
      supportingNodeIds: orderedUnique(link?.nodes.filter(x => x.role === "supporting").map(x => x.id) ?? []),
      rationale: link?.rationale ?? gap!.rationale,
      independentlyReviewed: false as const,
    };
  }).sort((a, b) => scienceSourceKey(a.source).localeCompare(scienceSourceKey(b.source)));

  const nodes: NaturalScienceNodeRow[] = maps.flatMap(map => map.nodes.map(node => {
    const indexedNode = indexNode.get(JSON.stringify([map.disciplineId, node.id]))!;
    const matching = inventory.filter(row => row.mappedDiscipline === map.disciplineId &&
      (row.focusNodeIds.includes(node.id) || row.supportingNodeIds.includes(node.id)));
    return {
      id: node.id,
      disciplineId: map.disciplineId,
      domainId: node.domainId,
      reasoningFacet: node.reasoningFacet,
      focusCaseCount: indexedNode.focusSourceKeys.length,
      supportingCaseCount: indexedNode.supportingSourceKeys.length,
      evalCategoryTags: orderedUnique(matching.flatMap(r => r.source.kind === "eval_case" ? r.evalCategories : [])),
      experimentalHealthDimensionTags: orderedUnique(matching.flatMap(r =>
        r.source.kind === "experimental_decision_point" ? r.experimentalHealthDimensions : [])),
    };
  })).sort((a, b) => (a.disciplineId + ":" + a.id).localeCompare(b.disciplineId + ":" + b.id));
  return {
    scope: "canonical_science_eval_and_two_experimental_suites",
    inventoryComplete: true,
    semanticReviewCompleted: false,
    officialCurriculumVerified: false,
    modelRunsMeasured: false,
    learnerOutcomesMeasured: false,
    defaultTutorHealthCoverageMeasured: false,
    sources: registry.sources,
    counts: {
      subjects: maps.length,
      knowledgeNodes: nodes.length,
      canonicalScienceEvalCases: inventory.filter(r => r.source.kind === "eval_case").length,
      experimentalDecisionPoints: inventory.filter(r => r.source.kind === "experimental_decision_point").length,
      candidateLinks: sourceIndex.counts.candidateLinks,
      explicitlyUnmapped: sourceIndex.counts.explicitGaps,
      focusNodes: sourceIndex.counts.focusNodes,
      independentlyReviewed: 0,
    },
    subjects: NATURAL_SCIENCE_IDS.map(id => ({
      id,
      knowledgeNodes: nodes.filter(n => n.disciplineId === id).length,
      candidateLinks: inventory.filter(r => r.mappedDiscipline === id).length,
      focusNodes: nodes.filter(n => n.disciplineId === id && n.focusCaseCount > 0).length,
    })),
    inventory,
    nodes,
  };
}
