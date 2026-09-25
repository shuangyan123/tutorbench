import type {
  CaseSystemVNextArchetype,
  CaseSystemVNextDiscipline,
  CaseSystemVNextPrerequisiteBoundary,
  CaseSystemVNextReferenceReasoning,
  CaseSystemVNextTransferReference,
} from "./case-system-vnext.js";
import type {
  CaseSystemVNextStrategyCriterion,
  CaseSystemVNextStrategyProfile,
  CaseSystemVNextStrategyProfileRegistry,
} from "./case-system-vnext-strategy-profile.js";

export const CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION = 1 as const;
export const CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID =
  "case-system-vnext-evaluator-stress" as const;
export const CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION = "0.1.0" as const;

export const CASE_SYSTEM_VNEXT_STRESS_CONTRASTS = [
  "human_efficiency",
  "opacity",
  "generalization_target",
  "prerequisite_compatibility",
  "equivalent_strategies",
] as const;
export type CaseSystemVNextStressContrast =
  (typeof CASE_SYSTEM_VNEXT_STRESS_CONTRASTS)[number];

export type CaseSystemVNextStressRawOutcome =
  | "A_BETTER"
  | "B_BETTER"
  | "TIE";

export type CaseSystemVNextStressEvidenceStatus =
  | "ok"
  | "unavailable"
  | "invalid";

export interface CaseSystemVNextStressCandidate {
  readonly id: string;
  readonly responseText: string;
}

export interface CaseSystemVNextStressExpectedOutcome {
  readonly kind: "preference" | "tie";
  /** Operator-only expectation. Never copied into a Judge-facing packet. */
  readonly candidateId?: string;
}

export interface CaseSystemVNextStressFixture {
  readonly id: string;
  readonly archetypeId: string;
  readonly contrast: CaseSystemVNextStressContrast;
  readonly strategyProfileId: string;
  readonly teachingTarget: string;
  readonly learnerState: string;
  readonly candidates: readonly [
    CaseSystemVNextStressCandidate,
    CaseSystemVNextStressCandidate,
  ];
  readonly expected: CaseSystemVNextStressExpectedOutcome;
  readonly rationale: string;
}

export interface CaseSystemVNextStressFixtureSuite {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly fixtures: readonly CaseSystemVNextStressFixture[];
}

export interface CaseSystemVNextStressBlindCandidate {
  readonly label: "A" | "B";
  readonly responseText: string;
}

export interface CaseSystemVNextStressBlindPacket {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION;
  readonly presentationId: string;
  readonly archetypeId: string;
  readonly discipline: CaseSystemVNextDiscipline;
  readonly topic: string;
  readonly learnerLevel: string;
  readonly contentDepth: CaseSystemVNextArchetype["contentDepth"];
  readonly pedagogicalDifficulty: CaseSystemVNextArchetype["pedagogicalDifficulty"];
  readonly interactionHorizon: CaseSystemVNextArchetype["interactionHorizon"];
  readonly coreTask: string;
  readonly learnerState: string;
  readonly teachingTarget: string;
  readonly contrastUnderTest: CaseSystemVNextStressContrast;
  readonly sharedBaseCriteria: readonly CaseSystemVNextStrategyCriterion[];
  readonly strategyProfile: CaseSystemVNextStrategyProfile;
  readonly prerequisiteBoundary: CaseSystemVNextPrerequisiteBoundary;
  readonly referenceReasoning: CaseSystemVNextReferenceReasoning;
  readonly transfer: CaseSystemVNextTransferReference;
  readonly comparisonInstruction: string;
  readonly candidates: readonly [
    CaseSystemVNextStressBlindCandidate,
    CaseSystemVNextStressBlindCandidate,
  ];
}

export interface CaseSystemVNextStressPresentationAssignment {
  readonly presentationId: string;
  readonly aCandidateId: string;
  readonly bCandidateId: string;
}

export interface CaseSystemVNextStressPresentationPlan {
  readonly packet: CaseSystemVNextStressBlindPacket;
  /** Operator-only mapping. Never send this sidecar to the evaluator. */
  readonly assignment: CaseSystemVNextStressPresentationAssignment;
}

export interface CaseSystemVNextStressFixturePlan {
  readonly fixtureId: string;
  readonly archetypeId: string;
  readonly contrast: CaseSystemVNextStressContrast;
  readonly expected: CaseSystemVNextStressExpectedOutcome;
  readonly repetitions: readonly {
    readonly repetition: number;
    readonly presentations: readonly [
      CaseSystemVNextStressPresentationPlan,
      CaseSystemVNextStressPresentationPlan,
    ];
  }[];
}

export interface CaseSystemVNextStressPlan {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly runsPerFixture: number;
  readonly plannedJudgmentCount: number;
  readonly fixtures: readonly CaseSystemVNextStressFixturePlan[];
}

export interface CaseSystemVNextStressPresentationJudgment {
  readonly presentationId: string;
  readonly status: CaseSystemVNextStressEvidenceStatus;
  readonly outcome?: CaseSystemVNextStressRawOutcome;
  readonly reason?: string;
}

export type CaseSystemVNextStressCanonicalOutcome =
  | { readonly kind: "preference"; readonly candidateId: string }
  | { readonly kind: "tie" }
  | { readonly kind: "incomparable" };

export type CaseSystemVNextStressConsistency =
  | "stable_preference"
  | "stable_tie"
  | "order_sensitive"
  | "inconsistent"
  | "incomplete_evidence";

export interface CaseSystemVNextStressRepetitionResult {
  readonly repetition: number;
  readonly outcome: CaseSystemVNextStressCanonicalOutcome;
  readonly consistency: CaseSystemVNextStressConsistency;
  readonly expectedMatch: boolean | null;
}

export interface CaseSystemVNextStressFixtureResult {
  readonly fixtureId: string;
  readonly archetypeId: string;
  readonly contrast: CaseSystemVNextStressContrast;
  readonly expected: CaseSystemVNextStressExpectedOutcome;
  readonly repetitions: readonly CaseSystemVNextStressRepetitionResult[];
  readonly expectedMatchCount: number;
  readonly comparableCount: number;
  readonly expectedMatchShare: number | null;
  readonly orderSensitiveCount: number;
  readonly incompleteCount: number;
  readonly modalOutcome: "preference" | "tie" | "incomparable";
  readonly modalCandidateId?: string;
  readonly modalCount: number;
  readonly modalShare: number;
}

export interface CaseSystemVNextStressAggregate {
  readonly expectedMatchCount: number;
  readonly comparableCount: number;
  readonly expectedMatchShare: number | null;
  readonly orderSensitiveCount: number;
  readonly incompleteCount: number;
}

export interface CaseSystemVNextEvaluatorStressReport {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION;
  readonly calibrationStatus: "uncalibrated";
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly runsPerFixture: number;
  readonly plannedJudgmentCount: number;
  readonly observedJudgmentCount: number;
  readonly fixtures: readonly CaseSystemVNextStressFixtureResult[];
  readonly overall: CaseSystemVNextStressAggregate;
  readonly byContrast: Readonly<
    Record<CaseSystemVNextStressContrast, CaseSystemVNextStressAggregate>
  >;
  readonly interpretationBoundary: readonly string[];
  readonly selectionStatement: "No evaluator-quality winner or calibration claim is inferred.";
}

export type CaseSystemVNextStressStrategyRegistry =
  CaseSystemVNextStrategyProfileRegistry;

export type CaseSystemVNextStressJudge = (
  packet: CaseSystemVNextStressBlindPacket,
) => Promise<Omit<CaseSystemVNextStressPresentationJudgment, "presentationId">>;
