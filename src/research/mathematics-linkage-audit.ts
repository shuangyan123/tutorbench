import type { TutorEvalCategory } from "../contracts/tutor-eval.js";
import type { TutorHealthDimension } from "../contracts/tutor-health.js";
import {
  buildMathematicsPilotCoverage,
  validateMathematicsPilotLinkage,
  type MathematicsPilotInputs,
  type MathematicsPilotSource,
} from "./mathematics-linkage-pilot.js";

/** Gaps are authored omissions, never negative learner/model results. */
export interface MathematicsExplicitGap {
  readonly source: MathematicsPilotSource;
  readonly reasonCode: "no_exact_existing_knowledge_node";
  readonly suggestedConceptLabel: string;
  readonly rationale: string;
  readonly reviewStatus: "not_reviewed";
}
export interface MathematicsExplicitGapRegistry {
  readonly schemaVersion: 1;
  readonly id: "mathematics-linkage-explicit-gaps-v0.1";
  readonly version: "0.1.0";
  readonly status: "author-proposed-unreviewed";
  readonly purpose: string;
  readonly gaps: readonly MathematicsExplicitGap[];
}
export interface MathematicsSourceCoverageRow {
  readonly source: MathematicsPilotSource;
  readonly locale: string | null;
  readonly topic: string;
  /** Original authored source text for reviewer orientation; not a Gold judgment. */
  readonly learningObjective: string;
  readonly mappingStatus: "candidate_linked" | "explicitly_unmapped";
  readonly knowledgeNodeIds: readonly string[];
  readonly relationRationale: string;
  readonly evalCategories: readonly TutorEvalCategory[];
  readonly healthDimensions: readonly TutorHealthDimension[];
  readonly independentReview: "not_reviewed";
}
export interface MathematicsSubjectNodeCoverage {
  readonly nodeId: string;
  readonly domainId: string;
  readonly candidateEvalCategories: readonly TutorEvalCategory[];
  readonly candidateHealthDimensions: readonly TutorHealthDimension[];
  readonly researchTaskCount: number;
  readonly examProfileCount: number;
  readonly candidateEvalCaseCount: number;
  readonly candidateHealthDecisionCount: number;
}
export interface MathematicsSubjectCoverageAudit {
  readonly scope: "canonical_mathematics_eval_and_default_health";
  readonly caseInventoryComplete: true;
  readonly semanticsIndependentlyReviewed: false;
  readonly runResultsInspected: false;
  readonly learnerOutcomesMeasured: false;
  readonly sources: MathematicsPilotInputs["pilot"]["sources"];
  readonly counts: {
    readonly canonicalEvalMathCases: number;
    readonly canonicalEvalMathCasesLinked: number;
    readonly canonicalEvalMathCasesUnmapped: number;
    readonly defaultHealthMathDecisionPoints: number;
    readonly defaultHealthMathDecisionPointsLinked: number;
    readonly defaultHealthMathDecisionPointsUnmapped: number;
    readonly candidateMappings: number;
    readonly explicitGaps: number;
    readonly independentlyReviewedMappings: 0;
    readonly graphNodes: number;
    readonly graphNodesWithCanonicalOrHealthCandidate: number;
    readonly graphNodesWithResearchTask: number;
  };
  readonly inventory: readonly MathematicsSourceCoverageRow[];
  readonly nodes: readonly MathematicsSubjectNodeCoverage[];
}

function key(source: MathematicsPilotSource): string {
  return [source.kind, source.id, source.version, source.decisionPointId ?? ""].join("|");
}
function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
interface SourceContext {
  source: MathematicsPilotSource;
  locale: string | null;
  topic: string;
  learningObjective: string;
  evalCategories: readonly TutorEvalCategory[];
  healthDimensions: readonly TutorHealthDimension[];
}

/**
 * Audit all currently authored mathematics cases in the two named canonical
 * source snapshots. Each source must have exactly one version-pinned link OR
 * one precise documented gap. This is structural completeness, not a
 * scientific claim that every mathematical concept has been evaluated.
 */
export function buildMathematicsSubjectCoverageAudit(
  inputs: MathematicsPilotInputs,
  gapRegistry: MathematicsExplicitGapRegistry,
): MathematicsSubjectCoverageAudit {
  validateMathematicsPilotLinkage(inputs);
  const { evaluation, health, pilot } = inputs;
  if (gapRegistry.schemaVersion !== 1 ||
      gapRegistry.id !== "mathematics-linkage-explicit-gaps-v0.1" ||
      gapRegistry.version !== "0.1.0" ||
      gapRegistry.status !== "author-proposed-unreviewed" ||
      !nonempty(gapRegistry.purpose) || !Array.isArray(gapRegistry.gaps)) {
    throw new Error("mathematics_gap_registry_invalid");
  }
  const expected = new Map<string, SourceContext>();
  function add(ctx: SourceContext): void {
    const k = key(ctx.source);
    if (expected.has(k)) throw new Error("mathematics_source_identity_duplicated");
    expected.set(k, ctx);
  }
  for (const c of evaluation.cases) {
    if (c.metadata.subject !== "mathematics") continue;
    add({
      source: { kind: "eval_case", id: c.id, version: c.version, decisionPointId: null },
      locale: c.locale ?? "en",
      topic: c.metadata.topic,
      learningObjective: c.tutorInput.learningObjective,
      evalCategories: uniqueSorted(c.evaluatorOnly.rubrics.map(r => r.category)),
      healthDimensions: [],
    });
  }
  for (const scenario of health.scenarios) {
    if (scenario.learningContext.subject !== "mathematics") continue;
    for (const dp of scenario.decisionPoints) {
      add({
        source: {
          kind: "health_decision_point",
          id: scenario.identity.id,
          version: scenario.identity.version,
          decisionPointId: dp.id,
        },
        locale: null,
        topic: scenario.learningContext.topic,
        learningObjective: scenario.learningContext.learningObjective,
        evalCategories: uniqueSorted(dp.evaluationCriteria.map(r => r.category)),
        healthDimensions: uniqueSorted(dp.evaluationCriteria.map(r => r.dimension)),
      });
    }
  }

  const links = new Map<string, { nodes: readonly { readonly id: string }[]; rationale: string }>();
  for (const link of pilot.links) {
    const k = key(link.source);
    if (!expected.has(k)) throw new Error("mathematics_link_not_in_canonical_inventory");
    if (links.has(k)) throw new Error("mathematics_link_duplicated");
    links.set(k, { nodes: link.nodes, rationale: link.rationale });
  }
  const gaps = new Map<string, MathematicsExplicitGap>();
  for (const gap of gapRegistry.gaps) {
    if (!gap.source || !nonempty(gap.source.id) || !nonempty(gap.source.version) ||
        gap.reasonCode !== "no_exact_existing_knowledge_node" ||
        gap.reviewStatus !== "not_reviewed" ||
        !nonempty(gap.suggestedConceptLabel) || !nonempty(gap.rationale)) {
      throw new Error("mathematics_explicit_gap_invalid");
    }
    const k = key(gap.source);
    if (!expected.has(k)) throw new Error("mathematics_explicit_gap_stale_source");
    if (links.has(k)) throw new Error("mathematics_source_link_and_gap_conflict");
    if (gaps.has(k)) throw new Error("mathematics_explicit_gap_duplicate");
    gaps.set(k, gap);
  }
  if (expected.size !== links.size + gaps.size) {
    throw new Error("mathematics_source_inventory_incomplete");
  }

  const inventory: MathematicsSourceCoverageRow[] = [...expected.values()].map(ctx => {
    const k = key(ctx.source);
    const linked = links.get(k);
    const gap = gaps.get(k);
    if (!linked && !gap) throw new Error("mathematics_source_inventory_incomplete");
    return {
      ...ctx,
      mappingStatus: linked ? "candidate_linked" : "explicitly_unmapped",
      knowledgeNodeIds: linked ? uniqueSorted(linked.nodes.map(n => n.id)) : [],
      relationRationale: linked?.rationale ?? gap!.rationale,
      independentReview: "not_reviewed",
    };
  }).sort((a, b) => key(a.source).localeCompare(key(b.source)));

  const pilotCoverage = buildMathematicsPilotCoverage(inputs);
  const contextsByKey = new Map(inventory.map(x => [key(x.source), x]));
  const nodeRows: MathematicsSubjectNodeCoverage[] = pilotCoverage.nodes.map(node => {
    const mappedSources = pilot.links.filter(link => link.nodes.some(item => item.id === node.nodeId))
      .map(link => contextsByKey.get(key(link.source))!);
    return {
      nodeId: node.nodeId,
      domainId: node.domainId,
      candidateEvalCategories: uniqueSorted(mappedSources.flatMap(s => s.source.kind === "eval_case" ? s.evalCategories : [])),
      candidateHealthDimensions: uniqueSorted(mappedSources.flatMap(s => s.source.kind === "health_decision_point" ? s.healthDimensions : [])),
      researchTaskCount: node.researchTasks.length,
      examProfileCount: node.examProfiles.length,
      candidateEvalCaseCount: node.evalCases.length,
      candidateHealthDecisionCount: node.healthDecisionPoints.length,
    };
  });
  const evalCases = inventory.filter(x => x.source.kind === "eval_case");
  const healthCases = inventory.filter(x => x.source.kind === "health_decision_point");
  const linkedEval = evalCases.filter(x => x.mappingStatus === "candidate_linked").length;
  const linkedHealth = healthCases.filter(x => x.mappingStatus === "candidate_linked").length;

  return {
    scope: "canonical_mathematics_eval_and_default_health",
    caseInventoryComplete: true,
    semanticsIndependentlyReviewed: false,
    runResultsInspected: false,
    learnerOutcomesMeasured: false,
    sources: pilot.sources,
    counts: {
      canonicalEvalMathCases: evalCases.length,
      canonicalEvalMathCasesLinked: linkedEval,
      canonicalEvalMathCasesUnmapped: evalCases.length - linkedEval,
      defaultHealthMathDecisionPoints: healthCases.length,
      defaultHealthMathDecisionPointsLinked: linkedHealth,
      defaultHealthMathDecisionPointsUnmapped: healthCases.length - linkedHealth,
      candidateMappings: links.size,
      explicitGaps: gaps.size,
      independentlyReviewedMappings: 0,
      graphNodes: nodeRows.length,
      graphNodesWithCanonicalOrHealthCandidate: nodeRows.filter(x => x.candidateEvalCaseCount + x.candidateHealthDecisionCount > 0).length,
      graphNodesWithResearchTask: nodeRows.filter(x => x.researchTaskCount > 0).length,
    },
    inventory,
    nodes: nodeRows,
  };
}
