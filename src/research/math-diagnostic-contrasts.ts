import { createHash } from "node:crypto";
import { CALIBRATION_CRITICAL_FAILURE_DEFINITIONS } from "../calibration/critical-failure-packet.js";
import { expertReviewFingerprint, readBoundReviewRows } from "../case-system-vnext/expert-review.js";
import { verifyInventoryRelease } from "./exam-international-inventory.js";
import type { inspectGeometryPilot } from "./math-geometry-pilot.js";
import release from "./data/math-diagnostic-contrasts-v1.2.json" with { type: "json" };

type Geometry = ReturnType<typeof inspectGeometryPilot>;

export function inspectDiagnosticContrasts(base: Geometry) {
  verifyInventoryRelease(release, "ad5c06373f7776d847c255fa8f11b58125836a04770bd26d49d7a16d24423e28", "synthetic diagnostic contrasts");
  if (base.version !== release.baseTaskVersion) throw new Error("diagnostic task edition mismatch");
  const cases = release.groups.map(group => {
    const task = base.tasks.find(t => t.taskId === group.taskId);
    if (!task?.prompt) throw new Error("diagnostic task missing");
    const promptDigest = "sha256:" + createHash("sha256").update(task.prompt).digest("hex");
    const traces = group.traces.map(trace => {
      if (trace.origin === "project-prompt-excerpt" && (!task.asset || !task.prompt!.includes(trace.response)))
        throw new Error("diagnostic excerpt mismatch");
      return { ...trace, synthetic: true, conceptDeficitEstablished: false, causalAttribution: "insufficient-evidence" };
    });
    const concepts = task.concepts.map(id => {
      const node = base.knowledgeGraph.nodes.find(n => n.id === id);
      if (!node) throw new Error("diagnostic concept missing");
      return { id, label: node.label };
    });
    return { taskId: task.taskId, version: base.version, asset: task.asset?.scenario ?? null, sourceKind: task.sourceKind,
      prompt: task.prompt, promptDigest, sourceEvidence: task.sourceEvidence, concepts, answer: task.answer,
      solution: task.solution, alternative: task.alternative, restrictions: task.restrictions, required: task.required,
      operation: task.operation, input: task.input, target: task.target, conversion: task.conversion, practice: task.practice,
      proposedClarification: group.proposedClarification, clarificationStatus: "pending-independent-review",
      cannotInfer: group.cannotInfer, traces };
  });
  const traces = cases.flatMap(c => c.traces);
  if (new Set(cases.map(c => c.taskId)).size !== base.tasks.length || new Set(traces.map(t => t.id)).size !== traces.length)
    throw new Error("diagnostic census mismatch");
  const modes = new Set(traces.map(t => t.mode));
  return { version: release.version, baseTaskVersion: base.version, status: "experimental-non-scoring", cases,
    tutorPolicyReference: { targetId: "target-diagnosis-incorrect-diagnosis", meaning: CALIBRATION_CRITICAL_FAILURE_DEFINITIONS.incorrect_diagnosis },
    contrasts: base.contrasts, metrics: { mathVerifiedTasks: cases.length, taskConceptLinks: base.taskConceptLinks,
      syntheticTraces: traces.length, alternativeHypotheses: traces.reduce((n,t) => n+t.hypotheses.length,0),
      reviewUnits: { mathematics: cases.length + traces.length, construct: base.taskConceptLinks, attribution: traces.length },
      byMode: Object.fromEntries([...modes].map(m => [m,traces.filter(t => t.mode === m).length])),
      independentReviewers: 0, independentSubmissions: 0, independentlyReviewed: 0, learnerOutcomes: null,
      diagnosticAccuracy: null, perDimensionAgreement: null } };
}

type Challenge = ReturnType<typeof inspectDiagnosticContrasts>;
/** Evidence-only view of the frozen, authored traces. No prediction on new responses. */
export function diagnosticEvidence(report: Challenge) {
  return report.cases.flatMap(task => task.traces.map(trace => ({
    taskId: task.taskId,
    traceId: trace.id,
    observation: trace.fact,
    conclusion: trace.answerStatus,
    reasoning: trace.reasoning,
    supportedStep: trace.claimEvidence === "observable" ? trace.inferenceClaim : null,
    alternativeExplanations: trace.hypotheses,
    causalAttribution: trace.causalAttribution,
    cannotInfer: task.cannotInfer,
    reviewStatus: task.clarificationStatus,
  })));
}

type Dimension = "mathematics" | "construct" | "attribution";
type ReviewItem = { sourceKey: string; evidence: Record<string, unknown> };
const instructions = {
  mathematics: "Independently solve the task. Does the presented work establish the stated result under the original conditions? Identify a decisive step, missing premise or counterexample. Treat a question as tentative.",
  construct: "Assess this proposed concept link and source fit. Distinguish required from optional operations, representations and arguments. Identify any overstatement or defensible alternative.",
  attribution: "Assess the proposed inference against the written work. Cite the actual step, name alternative explanations and state what cannot be determined. No learner history is available.",
};

function reviewItems(report: Challenge, dimension: Dimension): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const c of report.cases) {
    const context = { prompt: c.prompt, promptDigest: c.promptDigest, sourceKind: c.sourceKind, taskVersion: c.version };
    if (dimension === "construct") {
      for (const concept of c.concepts) items.push({ sourceKey: c.taskId + "/" + concept.id, evidence: { ...context,
        concept, operation: c.operation, representations: { input: c.input, target: c.target, conversion: c.conversion },
        practice: c.practice, proposedDemand: c.required, restrictions: c.restrictions, sources: c.sourceEvidence } });
    } else {
      if (dimension === "mathematics") items.push({ sourceKey: c.taskId + "/reference", evidence: { ...context, work: c.solution } });
      for (const t of c.traces) items.push({ sourceKey: c.taskId + "/" + t.id, evidence: dimension === "mathematics"
        ? { ...context, work: t.response }
        : { ...context, work: t.response, proposedInference: t.inferenceClaim } });
    }
  }
  return items;
}

const decisions = ["supported","partial","unsupported","insufficient-evidence"];
export function prepareDiagnosticReview(report: Challenge, dimension: string, reviewerId: string) {
  if (!Object.hasOwn(instructions, dimension) || !["reviewer-a","reviewer-b"].includes(reviewerId))
    throw new Error("unknown diagnostic review dimension or slot");
  const axis = dimension as Dimension;
  const items = reviewItems(report, axis);
  // 内部指纹同时绑定原题、作者解及解释；分发时只输出该维度可见的材料。
  const taskSetFingerprint = expertReviewFingerprint({ version: report.version, dimension, cases: report.cases });
  const assignments = items.map(({ sourceKey,evidence }) => ({
    sourceKey, reviewTaskId: expertReviewFingerprint([reviewerId,taskSetFingerprint,sourceKey]).slice(7,31), evidence,
  })).sort((a,b) => a.reviewTaskId.localeCompare(b.reviewTaskId, "en"));
  const header = { schemaVersion: 1, protocolId: "math-diagnostic-review-" + dimension, protocolVersion: report.version,
    reviewerId, taskSetFingerprint };
  const visible = { ...header, instructions: instructions[axis], decisions, syntheticMaterial: true,
    tasks: assignments.map(({ reviewTaskId,evidence }) => ({ reviewTaskId,...evidence })) };
  const packetFingerprint = expertReviewFingerprint(visible);
  const packet = { ...visible, packetFingerprint };
  const template = { ...header, packetFingerprint, reviews: packet.tasks.map(t => ({
    reviewTaskId: t.reviewTaskId, outcome: "", reason: "", alternative: "", uncertainty: "",
  })) };
  const manifest = { ...header, packetFingerprint, tasks: assignments.map(({sourceKey,reviewTaskId}) => ({sourceKey,reviewTaskId})) };
  return { packet, template, manifest };
}

export function inspectDiagnosticSubmission(input: unknown, frozen: ReturnType<typeof prepareDiagnosticReview>) {
  const rows = readBoundReviewRows(input, frozen.packet);
  const reviews = rows.map(row => {
    const { reviewTaskId, outcome, reason, alternative, uncertainty } = row;
    if (Object.keys(row).some(k => !["reviewTaskId","outcome","reason","alternative","uncertainty"].includes(k)) ||
      typeof outcome !== "string" || !decisions.includes(outcome) ||
      ![reason,alternative,uncertainty].every(v => typeof v === "string" && v.trim().length > 0 && v.length <= 2000))
      throw new Error("invalid diagnostic review row");
    const assignment = frozen.manifest.tasks.find(t => t.reviewTaskId === reviewTaskId)!;
    return { sourceKey: assignment.sourceKey, reviewTaskId, outcome, reason, alternative, uncertainty };
  });
  return { status: "structure-validated-only", reviewerSlot: frozen.packet.reviewerId,
    packetFingerprint: frozen.packet.packetFingerprint, reviews, independenceVerified: false };
}
