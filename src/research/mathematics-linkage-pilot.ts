import type { AcademicStructure } from "../contracts/academic-structure.js";
import { validateAcademicStructureReferences } from "../contracts/academic-structure.js";
import type { MathematicsExamAlignment } from "../contracts/mathematics-exam-alignment.js";
import { validateMathematicsExamCoverage } from "../contracts/mathematics-exam-alignment.js";
import type { MathChallengeEvidenceRegistry } from "../contracts/math-challenge-evidence.js";
import { validateMathChallengeCoverage } from "../contracts/math-challenge-evidence.js";
import type { MathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import { validateMathematicsTaskCoverage } from "../contracts/mathematics-knowledge-map.js";
import type { TutorEvalDataset } from "../contracts/tutor-eval.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../datasets/real-world.js";

/**
 * Read-only, scoped research projection. NOT a canonical mapping ontology or a
 * source of scores, learner state, curriculum alignment, or outcome evidence.
 */
export interface MathematicsPilotSource {
  readonly kind: "eval_case" | "health_decision_point";
  readonly id: string;
  readonly version: string;
  readonly decisionPointId: string | null;
}
export interface MathematicsPilotLink {
  readonly source: MathematicsPilotSource;
  readonly nodes: readonly { readonly id: string; readonly role: "focus" | "supporting" }[];
  readonly evidenceAnchor: "tutorInput.learningObjective" | "learningContext.learningObjective";
  readonly rationale: string;
}
export interface MathematicsPilotRegistry {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-unreviewed";
  readonly sources: {
    readonly academicStructure: { readonly id: string; readonly version: string };
    readonly knowledgeMap: { readonly id: string; readonly version: string };
    readonly examAlignment: { readonly id: string; readonly version: string };
    readonly evalDataset: { readonly id: string; readonly version: string };
    readonly healthSuite: { readonly id: string; readonly version: string };
    readonly researchEvidence: { readonly id: string; readonly version: string };
    readonly researchSuite: { readonly id: string; readonly version: string };
  };
  readonly links: readonly MathematicsPilotLink[];
}
export interface MathematicsPilotInputs {
  readonly academic: AcademicStructure;
  readonly exam: MathematicsExamAlignment;
  readonly map: MathematicsKnowledgeMap;
  readonly pilot: MathematicsPilotRegistry;
  readonly evaluation: TutorEvalDataset;
  readonly health: TutorScenarioSuiteVNext;
  readonly evidence: MathChallengeEvidenceRegistry;
  readonly researchSuite: TutorScenarioSuiteVNext;
}

function sourceKey(source: MathematicsPilotSource): string {
  return [source.kind, source.id, source.version, source.decisionPointId ?? ""].join(":");
}
function matchesIdentity(expected: { readonly id: string; readonly version: string }, actual: { readonly id: string; readonly version: string }): boolean {
  return expected.id === actual.id && expected.version === actual.version;
}

/** Ensures structural identity only. It cannot establish educational validity. */
export function validateMathematicsPilotLinkage(inputs: MathematicsPilotInputs): void {
  const { academic, exam, map, pilot, evaluation, health, evidence, researchSuite } = inputs;
  if (pilot.schemaVersion !== 1 ||
      pilot.id !== "mathematics-eval-health-knowledge-linkage-pilot-v0.1" ||
      pilot.version !== "0.1.0" || pilot.status !== "author-proposed-unreviewed" ||
      !matchesIdentity(pilot.sources.academicStructure, academic) ||
      !matchesIdentity(pilot.sources.knowledgeMap, map) ||
      !matchesIdentity(pilot.sources.examAlignment, exam) ||
      !matchesIdentity(pilot.sources.evalDataset, evaluation) ||
      !matchesIdentity(pilot.sources.healthSuite, health) ||
      !matchesIdentity(pilot.sources.researchEvidence, evidence) ||
      !matchesIdentity(pilot.sources.researchSuite, researchSuite)) {
    throw new Error("pilot_source_snapshot_invalid");
  }
  if (map.status !== "author-proposed-uncalibrated" ||
      evidence.status !== "author-proposed-uncalibrated" ||
      researchSuite.id !== evidence.suiteId) {
    throw new Error("pilot_research_status_invalid");
  }
  validateAcademicStructureReferences(academic, map, exam);
  validateMathematicsExamCoverage(exam, map, researchSuite);
  const mathDiscipline = academic.disciplines.find(item => item.id === "mathematics");
  if (!mathDiscipline?.knowledgeSystemIds.includes(map.id)) throw new Error("pilot_academic_link_invalid");
  validateMathematicsTaskCoverage(map, evidence);
  validateMathChallengeCoverage(evidence, researchSuite);
  const compiledHealth = tutorScenarioSuiteToTutorEvalDataset(health);
  const nodeIds = new Set(map.nodes.map(item => item.id));
  const seen = new Set<string>();
  if (pilot.links.length === 0) throw new Error("pilot_link_shape_invalid");
  for (const link of pilot.links) {
    const source = link.source;
    if (!source || !source.id || !source.version || !Array.isArray(link.nodes) ||
        link.nodes.length === 0 || typeof link.rationale !== "string" || !link.rationale.trim()) {
      throw new Error("pilot_link_shape_invalid");
    }
    const key = sourceKey(source);
    if (seen.has(key)) throw new Error("pilot_link_duplicate");
    seen.add(key);
    const linkedNodes = new Set<string>();
    for (const node of link.nodes) {
      if (!node || !nodeIds.has(node.id) || !["focus", "supporting"].includes(node.role) || linkedNodes.has(node.id)) {
        throw new Error("pilot_knowledge_node_invalid");
      }
      linkedNodes.add(node.id);
    }
    if (!link.nodes.some(node => node.role === "focus")) throw new Error("pilot_focus_missing");

    if (source.kind === "eval_case") {
      if (source.decisionPointId !== null || link.evidenceAnchor !== "tutorInput.learningObjective") {
        throw new Error("pilot_eval_anchor_invalid");
      }
      const match = evaluation.cases.find(item => item.id === source.id && item.version === source.version);
      if (!match || match.metadata.subject !== "mathematics" ||
          !match.tutorInput.learningObjective.trim()) {
        throw new Error("pilot_eval_identity_invalid");
      }
    } else if (source.kind === "health_decision_point") {
      if (!source.decisionPointId || link.evidenceAnchor !== "learningContext.learningObjective") {
        throw new Error("pilot_health_anchor_invalid");
      }
      const scenario = health.scenarios.find(item => item.identity.id === source.id && item.identity.version === source.version);
      const point = scenario?.decisionPoints.find(item => item.id === source.decisionPointId);
      const compiled = compiledHealth.cases.find(item => item.id === point?.evaluationCaseId);
      if (!scenario || scenario.learningContext.subject !== "mathematics" ||
          !scenario.learningContext.learningObjective.trim() || !point ||
          compiled?.version !== source.version + ":" + point.id) {
        throw new Error("pilot_health_identity_invalid");
      }
    } else {
      throw new Error("pilot_source_kind_invalid");
    }
  }
}

export interface MathematicsNodePilotCoverage {
  readonly nodeId: string;
  readonly domainId: string;
  readonly examProfiles: readonly string[];
  readonly researchTasks: readonly string[];
  readonly researchScenarios: readonly string[];
  readonly evalCases: readonly { readonly id: string; readonly version: string }[];
  readonly healthDecisionPoints: readonly {
    readonly scenarioId: string;
    readonly scenarioVersion: string;
    readonly decisionPointId: string;
  }[];
}
export interface MathematicsPilotCoverageReport {
  readonly scope: "authored_links_only";
  readonly reviewed: false;
  readonly modelRunsMeasured: false;
  readonly learnerOutcomesMeasured: false;
  readonly sources: MathematicsPilotRegistry["sources"];
  readonly counts: {
    readonly graphNodes: number;
    readonly examProfileCount: number;
    readonly examLinkedNodeCount: number;
    readonly researchMappedNodes: number;
    readonly researchUnmappedNodes: number;
    readonly researchTaskCount: number;
    readonly researchScenarioCount: number;
    readonly linkedEvalCaseCount: number;
    readonly linkedHealthDecisionPointCount: number;
    readonly pilotLinkedNodeCount: number;
    readonly combinedLinkedNodeCount: number;
  };
  readonly nodes: readonly MathematicsNodePilotCoverage[];
}

const sortedUnique = (items: readonly string[]) => [...new Set(items)].sort();

/** Structured, deterministic reverse lookup. It never guesses links by label or topic similarity. */
export function buildMathematicsPilotCoverage(inputs: MathematicsPilotInputs): MathematicsPilotCoverageReport {
  validateMathematicsPilotLinkage(inputs);
  const { map, pilot, evidence, exam } = inputs;
  const tasksById = new Map(evidence.tasks.map(item => [item.id, item]));
  const taskNodes = new Map<string, string[]>();
  const scenarioNodes = new Map<string, string[]>();
  for (const task of map.caseMappings) {
    const scenarios = tasksById.get(task.taskId)?.scenarioIds ?? [];
    for (const id of task.nodeIds) {
      taskNodes.set(id, [...(taskNodes.get(id) ?? []), task.taskId]);
      scenarioNodes.set(id, [...(scenarioNodes.get(id) ?? []), ...scenarios]);
    }
  }
  const rows: MathematicsNodePilotCoverage[] = map.nodes.map(node => {
    const links = pilot.links.filter(link => link.nodes.some(item => item.id === node.id));
    return {
      nodeId: node.id,
      domainId: node.domainId,
      examProfiles: sortedUnique(exam.profiles.filter(profile =>
        profile.modules.some(module => module.nodeIds.includes(node.id))).map(profile => profile.id)),
      researchTasks: sortedUnique(taskNodes.get(node.id) ?? []),
      researchScenarios: sortedUnique(scenarioNodes.get(node.id) ?? []),
      evalCases: links.filter(link => link.source.kind === "eval_case")
        .map(link => ({ id: link.source.id, version: link.source.version }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      healthDecisionPoints: links.filter(link => link.source.kind === "health_decision_point")
        .map(link => ({ scenarioId: link.source.id, scenarioVersion: link.source.version, decisionPointId: link.source.decisionPointId! }))
        .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId)),
    };
  }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const researchMapped = rows.filter(row => row.researchTasks.length > 0);
  const pilotLinked = rows.filter(row => row.evalCases.length + row.healthDecisionPoints.length > 0);
  const combined = rows.filter(row => row.researchTasks.length + row.evalCases.length + row.healthDecisionPoints.length > 0);
  return {
    scope: "authored_links_only",
    reviewed: false,
    modelRunsMeasured: false,
    learnerOutcomesMeasured: false,
    sources: pilot.sources,
    counts: {
      graphNodes: rows.length,
      examProfileCount: exam.profiles.length,
      examLinkedNodeCount: rows.filter(row => row.examProfiles.length > 0).length,
      researchMappedNodes: researchMapped.length,
      researchUnmappedNodes: rows.length - researchMapped.length,
      researchTaskCount: evidence.tasks.length,
      researchScenarioCount: sortedUnique(evidence.tasks.flatMap(item => item.scenarioIds)).length,
      linkedEvalCaseCount: pilot.links.filter(link => link.source.kind === "eval_case").length,
      linkedHealthDecisionPointCount: pilot.links.filter(link => link.source.kind === "health_decision_point").length,
      pilotLinkedNodeCount: pilotLinked.length,
      combinedLinkedNodeCount: combined.length,
    },
    nodes: rows,
  };
}

/** Returns an existing graph node's authored links, or null for an invalid ID. */
export function findMathematicsPilotNode(
  report: MathematicsPilotCoverageReport,
  nodeId: string,
): MathematicsNodePilotCoverage | null {
  return report.nodes.find(node => node.nodeId === nodeId) ?? null;
}
