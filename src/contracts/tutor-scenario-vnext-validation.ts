import { BenchmarkConfigurationError } from "./errors.js";
import {
  TUTOR_EVAL_CATEGORIES,
} from "./tutor-eval.js";
import { parseTutorEvalRubric } from "./tutor-eval-validation.js";
import {
  TUTOR_HEALTH_DIMENSIONS,
  type TutorFindingTemplate,
} from "./tutor-health.js";
import {
  TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION,
  type TutorScenarioDecisionPoint,
  type TutorScenarioEvaluatorReferenceState,
  type TutorScenarioMisconceptionReference,
  type TutorScenarioEvaluationCriterion,
  type TutorScenarioSuiteVNext,
  type TutorScenarioVNext,
} from "./tutor-scenario-vnext.js";

type UnknownRecord = Record<string, unknown>;

const disclosurePolicies = new Set([
  "no_answer",
  "hint_only",
  "partial_solution",
  "full_solution_allowed",
  "full_solution_required",
]);
const engagements = new Set(["low", "steady", "high", "frustrated"]);
const masteryStates = new Set(["novice", "developing", "near_mastery", "mastered"]);
const teachingDecisions = new Set([
  "preserve_struggle",
  "ask_diagnostic_question",
  "offer_conceptual_hint",
  "escalate_support",
  "fade_support",
  "probe_understanding",
  "support_emotion",
  "validate_partial_progress",
  "protect_learning_integrity",
]);
const findingSeverities = new Set(["info", "minor", "major", "critical"]);
const recommendationKinds = new Set(["diagnostic", "implementation_suggestion"]);
const rubricBehaviors = new Set(["required", "desirable", "prohibited"]);

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(record).every((key) => allowedSet.has(key));
}

function isText(value: unknown, max = 2_000): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max
  );
}

function isBoundedTextArray(value: unknown, maxItems = 50): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 500))
  );
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isRecommendation(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["kind", "text"]) &&
    recommendationKinds.has(String(record.kind)) &&
    isText(record.text, 1_000)
  );
}

function isFindingTemplate(value: unknown): value is TutorFindingTemplate {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "type",
      "title",
      "severity",
      "observedBehavior",
      "diagnosis",
      "impact",
      "likelyCauses",
      "recommendations",
      "regressionTargets",
      "confidence",
    ]) ||
    !isText(record.type, 100) ||
    !/^[a-z][a-z0-9_.-]*$/.test(record.type) ||
    !isText(record.title, 200) ||
    !findingSeverities.has(String(record.severity)) ||
    !isText(record.observedBehavior, 1_000) ||
    !isText(record.diagnosis, 1_000) ||
    !isText(record.impact, 1_000) ||
    !Array.isArray(record.likelyCauses) ||
    record.likelyCauses.length > 10 ||
    !record.likelyCauses.every((cause) => {
      const causeRecord = asRecord(cause);
      return (
        causeRecord !== null &&
        hasOnlyKeys(causeRecord, ["hypothesis", "confidence"]) &&
        isText(causeRecord.hypothesis, 500) &&
        isUnitInterval(causeRecord.confidence)
      );
    }) ||
    !Array.isArray(record.recommendations) ||
    record.recommendations.length < 2 ||
    record.recommendations.length > 20 ||
    !record.recommendations.every(isRecommendation) ||
    !record.recommendations.some((item) => asRecord(item)?.kind === "diagnostic") ||
    !record.recommendations.some(
      (item) => asRecord(item)?.kind === "implementation_suggestion",
    ) ||
    !isBoundedTextArray(record.regressionTargets, 20) ||
    record.regressionTargets.length === 0 ||
    !isUnitInterval(record.confidence)
  ) {
    return false;
  }
  return true;
}

function isEvaluationCriterion(value: unknown): value is TutorScenarioEvaluationCriterion {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "rubricId",
      "category",
      "dimension",
      "criterion",
      "weight",
      "evaluationType",
      "behavior",
      "evaluatorId",
      "config",
      "criticalFailure",
      "failureFinding",
    ]) ||
    !isText(record.rubricId, 120) ||
    !TUTOR_EVAL_CATEGORIES.includes(record.category as (typeof TUTOR_EVAL_CATEGORIES)[number]) ||
    !TUTOR_HEALTH_DIMENSIONS.includes(record.dimension as (typeof TUTOR_HEALTH_DIMENSIONS)[number]) ||
    !isText(record.criterion, 2_000) ||
    typeof record.weight !== "number" ||
    !Number.isFinite(record.weight) ||
    record.weight <= 0 ||
    (record.evaluationType !== "judge" && record.evaluationType !== "deterministic") ||
    !rubricBehaviors.has(String(record.behavior)) ||
    !isFindingTemplate(record.failureFinding)
  ) {
    return false;
  }
  try {
    parseTutorEvalRubric({
      id: record.rubricId,
      category: record.category,
      criterion: record.criterion,
      weight: record.weight,
      evaluationType: record.evaluationType,
      behavior: record.behavior,
      ...(record.evaluatorId === undefined ? {} : { evaluatorId: record.evaluatorId }),
      ...(record.config === undefined ? {} : { config: record.config }),
      ...(record.criticalFailure === undefined
        ? {}
        : { criticalFailure: record.criticalFailure }),
    });
    return true;
  } catch {
    return false;
  }
}

function isTutorVisibleContext(value: unknown): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["knownConcepts", "learnerModel"]) ||
    !isBoundedTextArray(record.knownConcepts) ||
    (record.learnerModel !== undefined && !isTutorLearnerModel(record.learnerModel))
  ) {
    return false;
  }
  return true;
}

function isTutorLearnerModel(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["memorySummary", "confidence", "engagement", "masteryState"]) &&
    (record.memorySummary === undefined || isText(record.memorySummary, 2_000)) &&
    (record.confidence === undefined || isUnitInterval(record.confidence)) &&
    (record.engagement === undefined || engagements.has(String(record.engagement))) &&
    (record.masteryState === undefined || masteryStates.has(String(record.masteryState)))
  );
}

function isMisconceptionReference(
  value: unknown,
  learnerTurnCount: number,
): value is TutorScenarioMisconceptionReference {
  const record = asRecord(value);
  return (
    record !== null &&
    hasOnlyKeys(record, ["statement", "evidenceLearnerTurns"]) &&
    isText(record.statement, 500) &&
    Array.isArray(record.evidenceLearnerTurns) &&
    record.evidenceLearnerTurns.length > 0 &&
    record.evidenceLearnerTurns.length <= 20 &&
    record.evidenceLearnerTurns.every((turn) =>
      isBoundedInteger(turn, 1, learnerTurnCount),
    ) &&
    new Set(record.evidenceLearnerTurns).size === record.evidenceLearnerTurns.length
  );
}

function isEvaluatorReferenceState(
  value: unknown,
  trajectory: UnknownRecord,
): value is TutorScenarioEvaluatorReferenceState {
  const record = asRecord(value);
  const history = trajectory.conversationHistory as UnknownRecord[];
  const learnerTurnCount = history.filter((message) => message.role === "user").length;
  return (
    record !== null &&
    hasOnlyKeys(record, ["misconceptions", "confidence", "engagement", "masteryState"]) &&
    Array.isArray(record.misconceptions) &&
    record.misconceptions.length <= 20 &&
    record.misconceptions.every((reference) =>
      isMisconceptionReference(reference, learnerTurnCount),
    ) &&
    (record.confidence === undefined || isUnitInterval(record.confidence)) &&
    (record.engagement === undefined || engagements.has(String(record.engagement))) &&
    (record.masteryState === undefined || masteryStates.has(String(record.masteryState)))
  );
}

function isTrajectory(value: unknown): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["attemptCount", "failedAttempts", "priorHints", "conversationHistory"]) ||
    !isBoundedInteger(record.attemptCount, 1, 100) ||
    !isBoundedInteger(record.failedAttempts, 0, 100) ||
    record.failedAttempts > record.attemptCount ||
    !isBoundedTextArray(record.priorHints, 100) ||
    record.priorHints.length > record.attemptCount ||
    !Array.isArray(record.conversationHistory) ||
    record.conversationHistory.length === 0 ||
    record.conversationHistory.length > 200
  ) {
    return false;
  }
  return record.conversationHistory.every((message) => {
    const messageRecord = asRecord(message);
    return (
      messageRecord !== null &&
      hasOnlyKeys(messageRecord, ["role", "content"]) &&
      (messageRecord.role === "user" || messageRecord.role === "assistant") &&
      isText(messageRecord.content, 10_000)
    );
  }) && asRecord(record.conversationHistory.at(-1))?.role === "user";
}

function isTeachingPolicy(
  value: unknown,
  evaluatorReferenceState: UnknownRecord,
): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["disclosure", "intervention", "productiveStruggle", "mastery"]) ||
    !disclosurePolicies.has(String(record.disclosure))
  ) {
    return false;
  }

  let firstHintAfter: number | undefined;
  if (record.intervention !== undefined) {
    const intervention = asRecord(record.intervention);
    if (
      intervention === null ||
      !hasOnlyKeys(intervention, ["firstHintAfterFailedAttempts", "escalateAfterFailedAttempts"]) ||
      !isBoundedInteger(intervention.firstHintAfterFailedAttempts, 1, 100) ||
      (intervention.escalateAfterFailedAttempts !== undefined &&
        (!isBoundedInteger(intervention.escalateAfterFailedAttempts, 1, 100) ||
          intervention.escalateAfterFailedAttempts <= intervention.firstHintAfterFailedAttempts))
    ) {
      return false;
    }
    firstHintAfter = intervention.firstHintAfterFailedAttempts;
  }

  if (record.productiveStruggle !== undefined) {
    const productiveStruggle = asRecord(record.productiveStruggle);
    if (
      productiveStruggle === null ||
      !hasOnlyKeys(productiveStruggle, ["minimumMeaningfulAttempts"]) ||
      !isBoundedInteger(productiveStruggle.minimumMeaningfulAttempts, 1, 100) ||
      (firstHintAfter !== undefined &&
        firstHintAfter < productiveStruggle.minimumMeaningfulAttempts)
    ) {
      return false;
    }
  }

  if (record.mastery !== undefined) {
    const mastery = asRecord(record.mastery);
    if (
      mastery === null ||
      !hasOnlyKeys(mastery, ["independentSuccessesToConfirm"]) ||
      !isBoundedInteger(mastery.independentSuccessesToConfirm, 1, 100)
    ) {
      return false;
    }
  }
  return !(
    (evaluatorReferenceState.masteryState === "near_mastery" ||
      evaluatorReferenceState.masteryState === "mastered") &&
    record.mastery === undefined
  );
}

function isDecisionPoint(
  value: unknown,
  scenario: UnknownRecord,
  rubricIds: Set<string>,
  evaluationCaseIds: Set<string>,
): value is TutorScenarioDecisionPoint {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "id",
      "evaluationCaseId",
      "turnIndex",
      "tutorVisibleContext",
      "evaluatorReferenceState",
      "trajectory",
      "expectedDecision",
      "expectedBehavior",
      "evaluationCriteria",
    ]) ||
    !isText(record.id, 120) ||
    !isText(record.evaluationCaseId, 160) ||
    !isBoundedInteger(record.turnIndex, 1, 100) ||
    !teachingDecisions.has(String(record.expectedDecision)) ||
    !isText(record.expectedBehavior, 2_000) ||
    !Array.isArray(record.evaluationCriteria) ||
    record.evaluationCriteria.length === 0 ||
    record.evaluationCriteria.length > 30 ||
    (record.tutorVisibleContext !== undefined &&
      !isTutorVisibleContext(record.tutorVisibleContext)) ||
    (record.trajectory !== undefined && !isTrajectory(record.trajectory))
  ) {
    return false;
  }
  if (evaluationCaseIds.has(record.evaluationCaseId)) {
    return false;
  }
  evaluationCaseIds.add(record.evaluationCaseId);

  const trajectory =
    (record.trajectory as UnknownRecord | undefined) ??
    (scenario.trajectory as UnknownRecord);
  const evaluatorReferenceState =
    (record.evaluatorReferenceState as UnknownRecord | undefined) ??
    (scenario.evaluatorReferenceState as UnknownRecord);
  const assistantTurns = (trajectory.conversationHistory as UnknownRecord[]).filter(
    (message) => message.role === "assistant",
  ).length;
  if (
    record.turnIndex !== assistantTurns + 1 ||
    record.turnIndex > (trajectory.attemptCount as number) ||
    !isEvaluatorReferenceState(evaluatorReferenceState, trajectory) ||
    !isTeachingPolicy(scenario.teachingPolicy, evaluatorReferenceState)
  ) {
    return false;
  }

  for (const criterionValue of record.evaluationCriteria) {
    if (!isEvaluationCriterion(criterionValue)) {
      return false;
    }
    if (rubricIds.has(criterionValue.rubricId)) {
      return false;
    }
    rubricIds.add(criterionValue.rubricId);
  }
  return true;
}

function isScenario(
  value: unknown,
  suiteId: string,
  scenarioIds: Set<string>,
  evaluationCaseIds: Set<string>,
): value is TutorScenarioVNext {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "identity",
      "description",
      "learningContext",
      "tutorVisibleContext",
      "evaluatorReferenceState",
      "trajectory",
      "teachingPolicy",
      "decisionPoints",
    ]) ||
    record.schemaVersion !== TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION ||
    !isText(record.description, 2_000) ||
    !isTutorVisibleContext(record.tutorVisibleContext) ||
    !isTrajectory(record.trajectory) ||
    !Array.isArray(record.decisionPoints) ||
    record.decisionPoints.length === 0 ||
    record.decisionPoints.length > 20
  ) {
    return false;
  }
  const identity = asRecord(record.identity);
  const learningContext = asRecord(record.learningContext);
  if (
    identity === null ||
    !hasOnlyKeys(identity, ["id", "version", "title", "suiteId"]) ||
    !isText(identity.id, 120) ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(identity.id) ||
    !isText(identity.version, 80) ||
    !isText(identity.title, 200) ||
    identity.suiteId !== suiteId ||
    learningContext === null ||
    !hasOnlyKeys(learningContext, ["subject", "topic", "learningObjective", "learnerLevel"]) ||
    !isText(learningContext.subject, 120) ||
    !isText(learningContext.topic, 200) ||
    !isText(learningContext.learningObjective, 1_000) ||
    !isText(learningContext.learnerLevel, 120)
  ) {
    return false;
  }
  const trajectory = asRecord(record.trajectory);
  if (
    trajectory === null ||
    !isEvaluatorReferenceState(record.evaluatorReferenceState, trajectory)
  ) {
    return false;
  }
  if (scenarioIds.has(identity.id)) {
    return false;
  }
  scenarioIds.add(identity.id);

  const rubricIds = new Set<string>();
  const decisionPointIds = new Set<string>();
  for (const decisionPointValue of record.decisionPoints) {
    const decisionPoint = asRecord(decisionPointValue);
    if (
      decisionPoint === null ||
      typeof decisionPoint.id !== "string" ||
      decisionPointIds.has(decisionPoint.id) ||
      !isDecisionPoint(decisionPointValue, record, rubricIds, evaluationCaseIds)
    ) {
      return false;
    }
    decisionPointIds.add(decisionPoint.id);
  }
  return true;
}

export function isTutorScenarioSuiteVNext(value: unknown): value is TutorScenarioSuiteVNext {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["schemaVersion", "id", "version", "title", "description", "healthTaxonomyVersion", "scenarios"]) ||
    record.schemaVersion !== TUTOR_SCENARIO_VNEXT_SCHEMA_VERSION ||
    !isText(record.id, 120) ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(record.id) ||
    !isText(record.version, 80) ||
    !isText(record.title, 200) ||
    !isText(record.description, 4_000) ||
    !isText(record.healthTaxonomyVersion, 80) ||
    !Array.isArray(record.scenarios) ||
    record.scenarios.length === 0 ||
    record.scenarios.length > 100
  ) {
    return false;
  }
  const scenarioIds = new Set<string>();
  const evaluationCaseIds = new Set<string>();
  return record.scenarios.every((scenario) =>
    isScenario(scenario, record.id as string, scenarioIds, evaluationCaseIds),
  );
}

export function parseTutorScenarioSuiteVNext(value: unknown): TutorScenarioSuiteVNext {
  if (!isTutorScenarioSuiteVNext(value)) {
    throw new BenchmarkConfigurationError("tutor_scenario_vnext_invalid");
  }
  return value;
}

export function assertValidTutorScenarioSuiteVNext(
  value: unknown,
): asserts value is TutorScenarioSuiteVNext {
  parseTutorScenarioSuiteVNext(value);
}
