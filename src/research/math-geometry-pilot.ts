import { parseMathChallengeEvidence, validateMathChallengeCoverage, type MathPractice } from "../contracts/math-challenge-evidence.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import { verifyInventoryRelease } from "./exam-international-inventory.js";
import { extendKnowledgeGraph } from "./exam-knowledge-coverage.js";
import { conceptsOf, type inspectMathKnowledgeAudit } from "./math-knowledge-audit.js";
import pilot from "./data/math-task-evidence-v1.1.json" with { type: "json" };

type Audit = ReturnType<typeof inspectMathKnowledgeAudit>;
type Leaf = { anchor: string; printedPage: number; throughPrintedPage: number; summary: string; concepts: string[]; operation: string };
type Snapshot = { version: string; baseInventory: string; manifestVersion: string; sourceScope: string; sourceEdition: string;
  sourceSha256: string; scopes: { id: string; title: string; excludes: string; leaves: Leaf[] }[];
  graphDelta: NonNullable<Parameters<typeof extendKnowledgeGraph>[1]>;
  gapReview: { sourceId: string; concept: string | null; reason: string }[] };
type EvidenceRow = { source_edition: string; source_sha256: string; locator: string; summary: string };
function check(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error("geometry_pilot_invalid: " + reason);
}
function pin(input: unknown): asserts input is Snapshot {
  verifyInventoryRelease(input, "19dfa9ca7479718e67025a2d157cf4223bc3d34fcda0d165895f19cb57b377c7", "geometry inventory");
}

function traceTasks(suiteInput: unknown, evidenceInput: unknown, graph: Audit["knowledgeGraph"], sources: Map<string, EvidenceRow>) {
  verifyInventoryRelease(pilot, "6a5cf93b7a7e85df407667ded07eca678e0af91fa222089c0fe82164fc733e3b", "task evidence");
  verifyInventoryRelease(suiteInput, "31888fa4b76d131fcb07437d04d782d39404f1fe6065acc808540aac41db9c0a", "project scenarios");
  verifyInventoryRelease(evidenceInput, "c77c75ab9309cd6534f5a7ebad4c075004931758b7811c96fe19c00dbeeb574b", "project answers");
  const suite = parseTutorScenarioSuiteVNext(suiteInput);
  const evidence = parseMathChallengeEvidence(evidenceInput);
  validateMathChallengeCoverage(evidence, suite);
  check(suite.id === pilot.suiteId && suite.version === pilot.suiteVersion, "task edition");
  return pilot.tasks.map(task => {
    const scenario = suite.scenarios.find(s => s.identity.id === task.scenarioId);
    const previous = evidence.tasks.find(t => t.id === task.taskId);
    const existing = task.sourceKind === "existing-synthetic-project-case";
    check(existing ? scenario && previous?.scenarioIds.includes(scenario.identity.id) : task.prompt && !previous && !task.scenarioId, "task origin");
    const inherited = graph.caseMappings.find(m => m.taskId === task.taskId)?.nodeIds ?? [];
    check(inherited.every(id => task.concepts.includes(id)) && task.concepts.every(id => graph.nodes.some(n => n.id === id)), "task concept");
    const practices = task.practice.filter((p): p is MathPractice =>
      p === "modeling" || p === "representation" || p === "reasoning" || p === "justification");
    check(practices.length === task.practice.length, "unknown mathematical practice");
    return { ...task, practice: practices, prompt: scenario?.trajectory.conversationHistory[0]?.content ?? task.prompt,
      asset: existing ? { suite: suite.id, version: suite.version, scenario: scenario!.identity,
        evidenceId: evidence.id, evidenceVersion: evidence.version, priorAnswer: previous!.verifiedResult,
        priorPractices: previous!.mathematicalPractice } : null,
      inheritedConcepts: inherited, rights: "project-authored", review: "author-proposed", diagnosticStatus: "author-hypothesis",
      sourceEvidence: task.requirements.map(ref => {
        const row = sources.get(ref.sourceId);
        check(row, "unresolved task source");
        return { ...ref, edition: row.source_edition, sha256: row.source_sha256, locator: row.locator, sourceOperation: row.summary };
      }) };
  });
}

export function inspectGeometryPilot(input: unknown, base: Audit, suite: unknown, evidence: unknown) {
  pin(input);
  const origin = base.scopes.find(s => s.id === input.sourceScope);
  check(base.version === input.baseInventory && origin && origin.source.id + "@" + origin.source.version === input.sourceEdition &&
    origin.source.sha256 === input.sourceSha256, "edition chain");
  const graph = extendKnowledgeGraph(base.knowledgeGraph, input.graphDelta, base.aliases);
  const ids = new Set(graph.nodes.map(n => n.id));
  const additions = input.scopes.map(section => {
    const parent = "IV / 选择性必修 / 主题二 几何与代数 / 内容要求 / " + section.title;
    const rows = section.leaves.map(leaf => {
      check(leaf.throughPrintedPage >= leaf.printedPage && leaf.concepts.every(id => ids.has(id)), "located concept");
      const span = (offset: number) => leaf.printedPage === leaf.throughPrintedPage ? String(leaf.printedPage + offset)
        : (leaf.printedPage + offset) + "–" + (leaf.throughPrintedPage + offset);
      return { ...leaf, requirement_id: section.id + "/" + leaf.anchor, parent: section.id, source_edition: input.sourceEdition,
        source_sha256: origin.source.sha256, kind: origin.kind, curriculumTrack: "选择性必修", starred: false,
        locator: parent + " / " + leaf.anchor + " (printed " + span(0) + ", PDF " + span(8) + ")",
        pdfPage: leaf.printedPage + 8, throughPdfPage: leaf.throughPrintedPage + 8, review: "pending-independent-review",
        alignment_status: leaf.concepts.length ? "aligned-author-proposed" : "unmapped" };
    });
    const linked = rows.filter(r => r.concepts.length).length;
    return { rows, scope: { id: section.id, parent, source: origin.source, kind: origin.kind, jurisdiction: origin.jurisdiction,
      exams: origin.exams, session: null, entryCohort: null, curriculumTrack: "选择性必修", inventory_status: "complete",
      unit: "circled content item", excludes: section.excludes, requirements_in_scope: rows.length, requirements_inventoried: rows.length,
      requirements_with_concept_links: linked, requirements_explicitly_unmapped: rows.length - linked, requirements_independently_reviewed: 0 } };
  });
  const gaps = new Map(input.gapReview.map(g => [g.sourceId, g]));
  const gapReview = input.gapReview.map(g => {
    const prior = base.worklist.find(w => w.sourceId === g.sourceId);
    check(prior && !prior.candidateConcepts.length && (!g.concept || ids.has(g.concept)), "historical open gap");
    return { ...g, edition: prior.edition, locator: prior.locator, priorReason: prior.reason, review: "author-proposed" };
  });
  const retained = base.requirements.map(row => {
    const gap = gaps.get(row.requirement_id);
    if (!gap?.concept) return row;
    check(row.alignment_status === "unmapped", "stale disposition");
    const { concept_id: _prior, ...fields } = { concept_id: null, ...row };
    return { ...fields, concepts: [gap.concept], rationale: gap.reason, alignment_status: "aligned-author-proposed",
      decision: "existing-concept", review: "pending-independent-review" };
  });
  const requirements = [...retained, ...additions.flatMap(s => s.rows)];
  const byId = new Map(requirements.map(r => [r.requirement_id,r]));
  check(byId.size === requirements.length, "duplicate source leaf");
  for (const edge of input.graphDelta.knowledgeRelations)
    check(edge.sourceRefs.every(ref => conceptsOf(byId.get(ref) ?? {}).includes(edge.toNodeId)), "unlocated graph delta");
  const scopes = [...base.scopes.map(scope => {
    const increment = retained.filter(r => r.parent === scope.id && gaps.get(r.requirement_id)?.concept).length;
    if (!increment) return scope;
    const linked = scope.requirements_with_concept_links + increment;
    return { ...scope, requirements_with_concept_links: linked, requirements_explicitly_unmapped: scope.requirements_explicitly_unmapped - increment,
      ...("requirements_pending_review" in scope ? { requirements_pending_review: scope.requirements_pending_review + increment,
        candidate_link_percent: scope.requirements_in_scope ? 100 * linked / scope.requirements_in_scope : null } : {}) };
  }), ...additions.map(s => s.scope)];
  const tasks = traceTasks(suite, evidence, graph, byId);
  const links = requirements.flatMap(conceptsOf);
  const linked = requirements.filter(r => conceptsOf(r).length).length;
  const graphKey = graph.id + "@" + graph.version;
  return { version: input.version, baseInventory: base.version, manifestVersion: input.manifestVersion, graph: graphKey,
    knowledgeGraph: graph, graphHistory: { ...base.graphHistory, [graphKey]: [...ids] }, aliases: { ...base.aliases, ...input.graphDelta.aliases },
    scopes, requirements, unique_source_clauses: requirements.length, unique_linked_requirements: linked,
    explicitlyUnmapped: requirements.length - linked, candidateLinks: links.length, uniqueCandidateConcepts: new Set(links).size,
    gapReview, tasks, contrasts: pilot.contrasts, taskConceptLinks: tasks.reduce((n,t) => n+t.concepts.length,0),
    independentlyReviewed: 0, independentConstructReviews: 0, learnerOutcomes: null, wholeExamDenominator: null, mappingAccuracy: null };
}
