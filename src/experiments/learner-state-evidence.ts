/** A bounded, author-synthetic learner-state evidence overlay for an existing vNext suite.
 * It describes visible evidence, not student traits, diagnosis certainty, learning gain or Gold.
 */
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";

export type LearnerObservationKind =
  | "incorrect_result"
  | "explicit_gap"
  | "stated_rule"
  | "local_reasoning"
  | "self_report"
  | "verbal_definition"
  | "prompted_paraphrase"
  | "question";

export type LearnerEpistemicStatus =
  | "unknown"
  | "explicit_gap"
  | "misconception_stated"
  | "demonstrated_local"
  | "reported_only"
  | "stated_definition"
  | "supported_local";

export interface LearnerStateObservation {
  readonly id: string;
  /** One-based index of USER turns, not all conversation messages. */
  readonly learnerTurnIndex: number;
  readonly quote: string;
  readonly kind: LearnerObservationKind;
}

export interface LearnerStateClaim {
  readonly conceptId: string;
  readonly status: LearnerEpistemicStatus;
  readonly observationIds: readonly string[];
}

export interface LearnerStateProfile {
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly observations: readonly LearnerStateObservation[];
  readonly claims: readonly LearnerStateClaim[];
  /** Authored probes, not a unique prescribed teaching response or human Gold. */
  readonly decisionBoundary: {
    readonly acceptableNextMoves: readonly string[];
    readonly prohibitedInferences: readonly string[];
  };
}

export interface LearnerStateEvidenceMatrix {
  readonly schemaVersion: 1;
  readonly id: "learner-state-evidence-matrix-v0.1";
  readonly version: "0.1.1";
  readonly sourceSuite: { readonly id: string; readonly version: string };
  readonly evidenceMode: "author_written_synthetic";
  readonly participantLinkage: "unlinked_profiles";
  readonly claimBoundary: {
    readonly observedLearnerOutcomes: false;
    readonly stableAbilityInferred: false;
    readonly interventionEffectProven: false;
  };
  readonly profiles: readonly LearnerStateProfile[];
}

export class LearnerStateEvidenceError extends Error {
  readonly code = "learner_state_evidence_invalid" as const;
  constructor(reason: string) {
    super(`Learner state evidence invalid: ${reason}`);
    this.name = "LearnerStateEvidenceError";
  }
}

function invalid(reason: string): never { throw new LearnerStateEvidenceError(reason); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length &&
    Object.keys(value).every(key => keys.includes(key));
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 1500;
}
function nonemptyTextArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 8 &&
    value.every(text) && new Set(value).size === value.length;
}
function id(value: unknown): value is string {
  return text(value) && /^[a-z][a-z0-9-]{1,63}$/u.test(value);
}

const scenarioIds = [
  "pai-unknown-cause",
  "pai-whole-undefined",
  "pai-rule-misconception",
  "pai-after-progress",
  "pai-known-foundation",
] as const;
const concepts = new Set([
  "chosen-whole",
  "equal-parts",
  "fraction-addition-rule",
  "equivalent-fraction-units",
]);
const observationKinds = new Set<LearnerObservationKind>([
  "incorrect_result", "explicit_gap", "stated_rule", "local_reasoning",
  "self_report", "verbal_definition", "prompted_paraphrase", "question",
]);
const supportedEvidence: Readonly<Record<Exclude<LearnerEpistemicStatus, "unknown">, LearnerObservationKind>> = {
  explicit_gap: "explicit_gap",
  misconception_stated: "stated_rule",
  demonstrated_local: "local_reasoning",
  reported_only: "self_report",
  stated_definition: "verbal_definition",
  supported_local: "prompted_paraphrase",
};

function parseObservation(
  value: unknown,
  userTurns: readonly string[],
  tutorBeforeLearnerTurn: readonly boolean[],
): LearnerStateObservation {
  if (!shape(value, ["id", "learnerTurnIndex", "quote", "kind"]) ||
      !id(value.id) || !Number.isInteger(value.learnerTurnIndex) ||
      typeof value.learnerTurnIndex !== "number" ||
      value.learnerTurnIndex < 1 || value.learnerTurnIndex > userTurns.length ||
      !text(value.quote) ||
      !observationKinds.has(value.kind as LearnerObservationKind)) {
    return invalid("observation_structure");
  }
  const turn = userTurns[value.learnerTurnIndex - 1];
  if (turn === undefined || !turn.includes(value.quote)) {
    return invalid("evidence_quote_not_in_learner_turn");
  }
  if (value.kind === "prompted_paraphrase" &&
      tutorBeforeLearnerTurn[value.learnerTurnIndex - 1] !== true) {
    return invalid("prompted_paraphrase_requires_prior_tutor");
  }
  return value as unknown as LearnerStateObservation;
}

function parseClaim(value: unknown, evidence: ReadonlyMap<string, LearnerObservationKind>): LearnerStateClaim {
  if (!shape(value, ["conceptId", "status", "observationIds"]) ||
      !id(value.conceptId) || !concepts.has(value.conceptId) ||
      !Array.isArray(value.observationIds) || value.observationIds.length > 8 ||
      !value.observationIds.every(id) ||
      new Set(value.observationIds).size !== value.observationIds.length) {
    return invalid("claim_structure");
  }
  const status = value.status as LearnerEpistemicStatus;
  const ids = value.observationIds as string[];
  if (status === "unknown") {
    if (ids.length !== 0) return invalid("unknown_must_not_claim_evidence");
  } else {
    if (!(status in supportedEvidence) || ids.length === 0) {
      return invalid("claim_status_or_missing_evidence");
    }
    const requiredKind = supportedEvidence[status as Exclude<LearnerEpistemicStatus, "unknown">];
    if (!ids.every(ref => evidence.get(ref) === requiredKind)) {
      return invalid("claim_evidence_kind_mismatch");
    }
  }
  return value as unknown as LearnerStateClaim;
}

/** Checks structural, identity, and literal-evidence provenance only.
 * It does NOT validate that an authored inference is semantically true.
 */
export function parseLearnerStateEvidenceMatrix(
  value: unknown,
  sourceSuite: TutorScenarioSuiteVNext,
): LearnerStateEvidenceMatrix {
  if (!shape(value, [
    "schemaVersion", "id", "version", "sourceSuite", "evidenceMode",
    "participantLinkage", "claimBoundary", "profiles",
  ]) || value.schemaVersion !== 1 ||
      value.id !== "learner-state-evidence-matrix-v0.1" ||
      value.version !== "0.1.1" ||
      value.evidenceMode !== "author_written_synthetic" ||
      value.participantLinkage !== "unlinked_profiles") {
    return invalid("matrix_structure");
  }
  if (!shape(value.sourceSuite, ["id", "version"]) ||
      value.sourceSuite.id !== sourceSuite.id ||
      value.sourceSuite.version !== sourceSuite.version ||
      sourceSuite.id !== "prerequisite-aware-instruction-v0.1" ||
      sourceSuite.version !== "0.1.0") {
    return invalid("source_suite_identity");
  }
  if (!shape(value.claimBoundary, [
    "observedLearnerOutcomes", "stableAbilityInferred", "interventionEffectProven",
  ]) || value.claimBoundary.observedLearnerOutcomes !== false ||
      value.claimBoundary.stableAbilityInferred !== false ||
      value.claimBoundary.interventionEffectProven !== false) {
    return invalid("overstated_evidence_claim");
  }
  if (!Array.isArray(value.profiles) || value.profiles.length !== scenarioIds.length ||
      sourceSuite.scenarios.length !== scenarioIds.length ||
      new Set(sourceSuite.scenarios.map(s => s.learningContext.learningObjective)).size !== 1) {
    return invalid("profile_scope");
  }
  const sources = new Map(sourceSuite.scenarios.map(s => [s.identity.id, s]));
  const seen = new Set<string>();
  for (const rawProfile of value.profiles) {
    if (!shape(rawProfile, [
      "scenarioId", "scenarioVersion", "observations", "claims", "decisionBoundary",
    ]) || !id(rawProfile.scenarioId) ||
        !scenarioIds.includes(rawProfile.scenarioId as typeof scenarioIds[number]) ||
        !text(rawProfile.scenarioVersion) || seen.has(rawProfile.scenarioId)) {
      return invalid("profile_identity");
    }
    seen.add(rawProfile.scenarioId);
    const source = sources.get(rawProfile.scenarioId);
    if (!source || source.identity.version !== rawProfile.scenarioVersion) {
      return invalid("stale_scenario_version");
    }
    const history = source.trajectory.conversationHistory;
    const turns = history.filter(t => t.role === "user").map(t => t.content);
    const tutorBeforeLearnerTurn: boolean[] = [];
    let tutorSeen = false;
    for (const turn of history) {
      if (turn.role === "assistant") tutorSeen = true;
      else tutorBeforeLearnerTurn.push(tutorSeen);
    }
    if (!Array.isArray(rawProfile.observations) ||
        rawProfile.observations.length === 0 || rawProfile.observations.length > 12 ||
        !Array.isArray(rawProfile.claims) || rawProfile.claims.length === 0 ||
        rawProfile.claims.length > concepts.size) {
      return invalid("empty_or_oversized_evidence");
    }
    const observed = rawProfile.observations.map(v =>
      parseObservation(v, turns, tutorBeforeLearnerTurn));
    const evidence = new Map(observed.map(o => [o.id, o.kind] as const));
    if (evidence.size !== observed.length) return invalid("duplicate_observation_id");
    const claims = rawProfile.claims.map(v => parseClaim(v, evidence));
    if (new Set(claims.map(c => c.conceptId)).size !== claims.length) {
      return invalid("duplicate_concept_claim");
    }
    if (!shape(rawProfile.decisionBoundary, [
      "acceptableNextMoves", "prohibitedInferences",
    ]) ||
        !nonemptyTextArray(rawProfile.decisionBoundary.acceptableNextMoves) ||
        !nonemptyTextArray(rawProfile.decisionBoundary.prohibitedInferences)) {
      return invalid("decision_boundary");
    }
  }
  if (scenarioIds.some(s => !seen.has(s))) return invalid("missing_source_scenario");
  return value as unknown as LearnerStateEvidenceMatrix;
}
