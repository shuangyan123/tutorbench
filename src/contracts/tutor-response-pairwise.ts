import type { TutorEvalGroundTruth, TutorEvalTutorInput } from "./tutor-eval.js";
import type { TutorEvalRubric } from "./rubric.js";
import type { TutorCaseLocale } from "./locale.js";

export const TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION = 1 as const;
export const TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID =
  "tutor-response-pairwise-prototype" as const;
export const TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION = "0.1.0" as const;

export type TutorResponsePairwiseOutcome =
  | "A_BETTER"
  | "B_BETTER"
  | "TIE"
  | "INCOMPARABLE";

export type TutorResponsePairwiseRawOutcome = Exclude<
  TutorResponsePairwiseOutcome,
  "INCOMPARABLE"
>;

export type TutorResponsePairwiseEvidenceStatus =
  | "ok"
  | "unavailable"
  | "invalid";

export type TutorResponsePairwiseConsistency =
  | "stable_preference"
  | "stable_tie"
  | "order_sensitive"
  | "inconsistent"
  | "incomplete_evidence";

export interface TutorResponsePairwiseBlindCandidate {
  readonly label: "A" | "B";
  readonly responseText: string;
}

/**
 * Judge-facing packet. Tutor/provider/response identities are deliberately
 * absent; the evaluator sees only authored case evidence and opaque A/B text.
 */
export interface TutorResponsePairwiseBlindPacket {
  readonly schemaVersion: typeof TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION;
  readonly protocolId: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID;
  readonly protocolVersion: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION;
  readonly presentationId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly locale: TutorCaseLocale;
  readonly comparisonInstruction: string;
  readonly tutorInput: TutorEvalTutorInput;
  readonly evaluatorOnly: {
    readonly groundTruth?: TutorEvalGroundTruth;
    readonly knownMisconception?: string | null;
    readonly disclosurePolicy: string;
    readonly rubrics: readonly TutorEvalRubric[];
  };
  readonly candidates: readonly [
    TutorResponsePairwiseBlindCandidate,
    TutorResponsePairwiseBlindCandidate,
  ];
}

export interface TutorResponsePairwisePresentationAssignment {
  readonly presentationId: string;
  readonly aResponseId: string;
  readonly bResponseId: string;
}

export interface TutorResponsePairwisePresentationPlan {
  readonly packet: TutorResponsePairwiseBlindPacket;
  /** Operator-only sidecar. Never send this mapping to the Judge. */
  readonly assignment: TutorResponsePairwisePresentationAssignment;
}

export interface TutorResponsePairwisePlan {
  readonly schemaVersion: typeof TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION;
  readonly protocolId: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID;
  readonly protocolVersion: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION;
  readonly pairId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
  readonly caseId: string;
  readonly caseVersion: string;
  /** Canonical A/B are response-id sorted and independent of presentation order. */
  readonly candidateAResponseId: string;
  readonly candidateBResponseId: string;
  readonly presentations: readonly [
    TutorResponsePairwisePresentationPlan,
    TutorResponsePairwisePresentationPlan,
  ];
}

export interface TutorResponsePairwisePresentationJudgment {
  readonly presentationId: string;
  readonly status: TutorResponsePairwiseEvidenceStatus;
  readonly outcome?: TutorResponsePairwiseRawOutcome;
  /** Stable, privacy-safe reason code supplied by the caller. */
  readonly reason?: string;
}

export interface TutorResponsePairwiseNormalizedPresentation {
  readonly presentationId: string;
  readonly status: TutorResponsePairwiseEvidenceStatus;
  readonly rawOutcome?: TutorResponsePairwiseRawOutcome;
  readonly winnerResponseId: string | null;
  readonly reason?: string;
}

export interface TutorResponsePairwiseResult {
  readonly schemaVersion: typeof TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION;
  readonly protocolId: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID;
  readonly protocolVersion: typeof TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION;
  readonly pairId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly candidateAResponseId: string;
  readonly candidateBResponseId: string;
  readonly outcome: TutorResponsePairwiseOutcome;
  readonly consistency: TutorResponsePairwiseConsistency;
  readonly presentations: readonly TutorResponsePairwiseNormalizedPresentation[];
  readonly rankingClaimAllowed: false;
}
