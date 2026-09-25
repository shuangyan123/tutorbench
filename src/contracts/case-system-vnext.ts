import type { CaseSystemVNextDomainId } from "./case-system-vnext-domain-taxonomy.js";

export const CASE_SYSTEM_VNEXT_SCHEMA_VERSION = 2 as const;

export const CASE_SYSTEM_VNEXT_CONTENT_DEPTHS = [1, 2, 3, 4, 5] as const;
export type CaseSystemVNextContentDepth =
  (typeof CASE_SYSTEM_VNEXT_CONTENT_DEPTHS)[number];

export const CASE_SYSTEM_VNEXT_PEDAGOGICAL_DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type CaseSystemVNextPedagogicalDifficulty =
  (typeof CASE_SYSTEM_VNEXT_PEDAGOGICAL_DIFFICULTIES)[number];

export const CASE_SYSTEM_VNEXT_INTERACTION_HORIZONS = [1, 2, 3] as const;
export type CaseSystemVNextInteractionHorizon =
  (typeof CASE_SYSTEM_VNEXT_INTERACTION_HORIZONS)[number];

export const CASE_SYSTEM_VNEXT_LEARNER_STATES = [
  "novice",
  "partial_understanding",
  "procedural_error",
  "conceptual_misconception",
  "repeated_failure",
  "false_confidence",
  "uncertain_but_correct",
  "frustration",
  "partial_progress",
  "near_mastery",
] as const;
export type CaseSystemVNextLearnerState =
  (typeof CASE_SYSTEM_VNEXT_LEARNER_STATES)[number];

export type CaseSystemVNextOptimalityMode =
  | "human_optimal"
  | "bounded_strategy_set"
  | "not_applicable";

export interface CaseSystemVNextPrerequisiteBoundary {
  readonly knownConcepts: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly excludedMethods: readonly string[];
}

export interface CaseSystemVNextReasoningStrategy {
  readonly id: string;
  readonly label: string;
  readonly keyInsight: string;
  /** Authoring annotation only; not a calibrated score. */
  readonly effectiveReasoningSteps?: number;
  readonly applicability: string;
}

export interface CaseSystemVNextReferenceReasoning {
  readonly optimalityMode: CaseSystemVNextOptimalityMode;
  readonly humanOptimalInstanceStrategies: readonly CaseSystemVNextReasoningStrategy[];
  readonly humanOptimalGeneralStrategies: readonly CaseSystemVNextReasoningStrategy[];
  readonly alternativeHumanValidStrategies: readonly CaseSystemVNextReasoningStrategy[];
  readonly avoidableDetours: readonly string[];
  readonly machineSearchCost: "out_of_scope";
}

export interface CaseSystemVNextTransferReference {
  readonly nearTransfer: string;
  readonly farTransfer?: string;
}

export interface CaseSystemVNextArchetype {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  /** Audit-seeded subject/domain. Broad labels such as "science" are not valid here. */
  readonly domainId: CaseSystemVNextDomainId;
  /** Narrower curricular or technical branch, e.g. algebra, mechanics, python, source_analysis. */
  readonly subdomain: string;
  /** Concrete practice/task family, e.g. debugging, proof, causal_explanation, source_synthesis. */
  readonly practice: string;
  readonly topic: string;
  readonly learnerLevel: string;
  readonly contentDepth: CaseSystemVNextContentDepth;
  readonly pedagogicalDifficulty: CaseSystemVNextPedagogicalDifficulty;
  readonly interactionHorizon: CaseSystemVNextInteractionHorizon;
  readonly coreTask: string;
  readonly learnerStates: readonly CaseSystemVNextLearnerState[];
  readonly prerequisiteBoundary: CaseSystemVNextPrerequisiteBoundary;
  readonly referenceReasoning: CaseSystemVNextReferenceReasoning;
  readonly transfer: CaseSystemVNextTransferReference;
  readonly authoringStatus: "pilot";
}

export interface CaseSystemVNextPilot {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly archetypes: readonly CaseSystemVNextArchetype[];
}
