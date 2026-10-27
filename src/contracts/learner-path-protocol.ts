/**
 * Experimental authoring-only learning-path protocol.
 * This validator does not infer mastery, potential, learner gain, or causal efficacy.
 */
export type LearnerPathCheckpointName =
  | "baseline" | "immediate" | "nearTransfer" | "delayed";

export interface LearnerPathCheckpoint {
  readonly id: string;
  readonly studentPrompt: string;
  readonly referenceAnswer: string;
  readonly independent: true;
}

export interface LearnerPathProfile {
  readonly id: string;
  readonly authoredLearnerEvidence: string;
  readonly evidencedKnownConcepts: readonly string[];
  readonly openPrerequisites: readonly string[];
  readonly firstDecisionTarget: string;
  readonly avoidableCostRisk: string;
}

export interface LearnerPathProtocol {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "authoring_only";
  readonly objective: {
    readonly subject: "mathematics";
    readonly target: string;
    readonly targetIsCeiling: false;
    readonly prerequisites: readonly string[];
  };
  readonly assessment: Record<LearnerPathCheckpointName, LearnerPathCheckpoint>;
  readonly pathways: readonly LearnerPathProfile[];
  readonly observationPlan: {
    readonly tutorObservable: readonly string[];
    readonly learnerOutcomeCheckpoints: readonly LearnerPathCheckpointName[];
    readonly costs: readonly string[];
    readonly missingDataRule: "unknown_not_zero";
    readonly useIndependentAssessments: true;
    readonly feedbackPolicy: string;
  };
  readonly evidenceBoundary: {
    readonly syntheticProfiles: true;
    readonly actualLearnerResultsCollected: false;
    readonly potentialCeilingMeasured: false;
    readonly learningGainClaimed: false;
    readonly allLearnersGuaranteedSameOutcome: false;
    readonly causalEfficacyClaimed: false;
  };
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const hasOnly = (v: UnknownRecord, fields: readonly string[]): boolean =>
  Object.keys(v).length === fields.length &&
  Object.keys(v).every((key) => fields.includes(key));

const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 2000;

const isTextList = (v: unknown, allowEmpty = false): v is string[] =>
  Array.isArray(v) && v.length <= 40 && (allowEmpty || v.length > 0) &&
  v.every(isText) && new Set(v).size === v.length;

const checkpoints = ["baseline", "immediate", "nearTransfer", "delayed"] as const;
const expectedPathIds = ["foundation-gap", "partial-understanding", "near-ready"] as const;
const costNames = [
  "active_learning_minutes", "tutor_turns", "hints_requested",
  "repeated_explanations", "learner_reported_effort",
] as const;

function parseCheckpoint(value: unknown): LearnerPathCheckpoint {
  if (!isRecord(value) || !hasOnly(value, ["id", "studentPrompt", "referenceAnswer", "independent"]) ||
    !isText(value.id) || !isText(value.studentPrompt) || !isText(value.referenceAnswer) ||
    value.independent !== true) throw new Error("learner_path_invalid_checkpoint");
  return value as unknown as LearnerPathCheckpoint;
}

function parseProfile(value: unknown, prerequisites: readonly string[]): LearnerPathProfile {
  if (!isRecord(value) ||
    !hasOnly(value, ["id", "authoredLearnerEvidence", "evidencedKnownConcepts",
      "openPrerequisites", "firstDecisionTarget", "avoidableCostRisk"]) ||
    !isText(value.id) || !isText(value.authoredLearnerEvidence) ||
    !isTextList(value.evidencedKnownConcepts) || !isTextList(value.openPrerequisites, true) ||
    !isText(value.firstDecisionTarget) || !isText(value.avoidableCostRisk) ||
    value.openPrerequisites.some(item => !prerequisites.includes(item))
  ) throw new Error("learner_path_invalid_profile");
  return value as unknown as LearnerPathProfile;
}

/**
 * Reject hidden results, invented ceilings and compromised independence.
 * Any outcome data must be recorded and reviewed in a separate evidence artifact.
 */
export function parseLearnerPathProtocol(value: unknown): LearnerPathProtocol {
  if (!isRecord(value) ||
    !hasOnly(value, ["schemaVersion", "id", "version", "status", "objective",
      "assessment", "pathways", "observationPlan", "evidenceBoundary"]) ||
    value.schemaVersion !== 1 || !isText(value.id) || !isText(value.version) ||
    value.status !== "authoring_only"
  ) throw new Error("learner_path_invalid_protocol");
  const goal = value.objective;
  if (!isRecord(goal) ||
    !hasOnly(goal, ["subject", "target", "targetIsCeiling", "prerequisites"]) ||
    goal.subject !== "mathematics" || !isText(goal.target) ||
    goal.targetIsCeiling !== false || !isTextList(goal.prerequisites)
  ) throw new Error("learner_path_invalid_goal");

  const assessment = value.assessment;
  if (!isRecord(assessment) || !hasOnly(assessment, checkpoints)) {
    throw new Error("learner_path_invalid_assessment");
  }
  const ids = new Set<string>();
  for (const name of checkpoints) {
    const item = parseCheckpoint(assessment[name]);
    if (ids.has(item.id)) throw new Error("learner_path_duplicate_checkpoint");
    ids.add(item.id);
  }

  if (!Array.isArray(value.pathways) || value.pathways.length !== 3) {
    throw new Error("learner_path_invalid_pathways");
  }
  const paths: LearnerPathProfile[] = value.pathways.map(item =>
    parseProfile(item, goal.prerequisites as string[]));
  if (new Set(paths.map(p => p.id)).size !== paths.length ||
    expectedPathIds.some(id => !paths.some(p => p.id === id))
  ) throw new Error("learner_path_invalid_pathways");
  // The same goal is held fixed, but foundation support is not prescribed for already-prepared learners.
  const gap = paths.find(p => p.id === "foundation-gap");
  const ready = paths.find(p => p.id === "near-ready");
  if (!gap || !ready ||
    gap.openPrerequisites.length === 0 ||
    ready.openPrerequisites.length !== 0
  ) throw new Error("learner_path_invalid_pathways");

  const plan = value.observationPlan;
  if (!isRecord(plan)) throw new Error("learner_path_invalid_plan");
  const selectedCheckpoints = plan.learnerOutcomeCheckpoints;
  const selectedCosts = plan.costs;
  if (!hasOnly(plan, ["tutorObservable", "learnerOutcomeCheckpoints", "costs",
      "missingDataRule", "useIndependentAssessments", "feedbackPolicy"]) ||
    !isTextList(plan.tutorObservable) ||
    !isTextList(selectedCheckpoints) ||
    checkpoints.some(x => !selectedCheckpoints.includes(x)) ||
    selectedCheckpoints.length !== checkpoints.length ||
    !isTextList(selectedCosts) || selectedCosts.length !== costNames.length ||
    costNames.some(x => !selectedCosts.includes(x)) ||
    plan.missingDataRule !== "unknown_not_zero" ||
    plan.useIndependentAssessments !== true || !isText(plan.feedbackPolicy)
  ) throw new Error("learner_path_invalid_plan");

  const boundary = value.evidenceBoundary;
  if (!isRecord(boundary) ||
    !hasOnly(boundary, ["syntheticProfiles", "actualLearnerResultsCollected",
      "potentialCeilingMeasured", "learningGainClaimed", "allLearnersGuaranteedSameOutcome",
      "causalEfficacyClaimed"]) ||
    boundary.syntheticProfiles !== true || boundary.actualLearnerResultsCollected !== false ||
    boundary.potentialCeilingMeasured !== false || boundary.learningGainClaimed !== false ||
    boundary.allLearnersGuaranteedSameOutcome !== false || boundary.causalEfficacyClaimed !== false
  ) throw new Error("learner_path_invalid_evidence_boundary");

  return value as unknown as LearnerPathProtocol;
}
