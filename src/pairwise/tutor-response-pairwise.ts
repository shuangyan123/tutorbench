import { createHash } from "node:crypto";

import {
  TUTOR_EVAL_EVALUATOR_VERSION,
  type TutorCandidateResponse,
  type TutorEvalDataset,
} from "../contracts/index.js";
import {
  TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID,
  TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION,
  TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION,
  type TutorResponsePairwiseBlindPacket,
  type TutorResponsePairwiseNormalizedPresentation,
  type TutorResponsePairwisePlan,
  type TutorResponsePairwisePresentationJudgment,
  type TutorResponsePairwisePresentationPlan,
  type TutorResponsePairwiseRawOutcome,
  type TutorResponsePairwiseResult,
} from "../contracts/tutor-response-pairwise.js";
import { resolveTutorCaseLocale } from "../contracts/locale.js";

export const TUTOR_RESPONSE_PAIRWISE_COMPARISON_INSTRUCTION = [
  "Compare only the two candidate Tutor responses against the authored TutorEval evidence in this packet.",
  "Use the supplied rubrics, disclosure policy, ground truth, known misconception, and existing critical-failure semantics; do not invent new teaching-quality criteria.",
  "A_BETTER means candidate A is substantively better under those criteria; B_BETTER means candidate B is substantively better; TIE means no substantive difference is supported.",
  "Do not reward or penalize provider identity, model identity, response length, style, latency, token use, cost, popularity, or leaderboard history unless an authored rubric explicitly requires the observable behavior.",
] as const;

export class TutorResponsePairwiseError extends Error {
  readonly code = "pairwise_evaluation_invalid" as const;

  constructor() {
    super("Tutor response pairwise evaluation data is invalid.");
    this.name = "TutorResponsePairwiseError";
  }
}

function invalid(): never {
  throw new TutorResponsePairwiseError();
}

function derivePairId(input: {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly responseIds: readonly [string, string];
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `tutor-response-pair-${digest}`;
}

function presentationId(pairId: string, ordinal: 1 | 2): string {
  return `${pairId}-presentation-${ordinal}`;
}

function buildPresentation(
  pairId: string,
  ordinal: 1 | 2,
  dataset: TutorEvalDataset,
  evaluatorVersion: string,
  candidateA: TutorCandidateResponse,
  candidateB: TutorCandidateResponse,
): TutorResponsePairwisePresentationPlan {
  const tutorEvalCase = dataset.cases.find(
    (candidate) => candidate.id === candidateA.caseId,
  );
  if (tutorEvalCase === undefined) {
    invalid();
  }

  const id = presentationId(pairId, ordinal);
  const packet: TutorResponsePairwiseBlindPacket = {
    schemaVersion: TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION,
    protocolId: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID,
    protocolVersion: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION,
    presentationId: id,
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    evaluatorVersion,
    caseId: tutorEvalCase.id,
    caseVersion: tutorEvalCase.version,
    locale: resolveTutorCaseLocale(tutorEvalCase.locale),
    comparisonInstruction: TUTOR_RESPONSE_PAIRWISE_COMPARISON_INSTRUCTION.join(" "),
    tutorInput: tutorEvalCase.tutorInput,
    evaluatorOnly: {
      ...(tutorEvalCase.evaluatorOnly.groundTruth === undefined
        ? {}
        : { groundTruth: tutorEvalCase.evaluatorOnly.groundTruth }),
      ...(tutorEvalCase.evaluatorOnly.knownMisconception === undefined
        ? {}
        : { knownMisconception: tutorEvalCase.evaluatorOnly.knownMisconception }),
      disclosurePolicy: tutorEvalCase.evaluatorOnly.disclosurePolicy,
      rubrics: tutorEvalCase.evaluatorOnly.rubrics,
    },
    candidates: [
      { label: "A", responseText: candidateA.responseText },
      { label: "B", responseText: candidateB.responseText },
    ],
  };

  return {
    packet,
    assignment: {
      presentationId: id,
      aResponseId: candidateA.responseId,
      bResponseId: candidateB.responseId,
    },
  };
}

function validateResponseAgainstCase(
  response: TutorCandidateResponse,
  caseId: string,
  caseVersion: string,
): void {
  if (
    response.responseId.trim().length === 0 ||
    response.caseId !== caseId ||
    response.caseVersion !== caseVersion ||
    response.runIndex < 1 ||
    !Number.isInteger(response.runIndex)
  ) {
    invalid();
  }
}

export function buildTutorResponsePairwisePlan(
  dataset: TutorEvalDataset,
  left: TutorCandidateResponse,
  right: TutorCandidateResponse,
  evaluatorVersion = TUTOR_EVAL_EVALUATOR_VERSION,
): TutorResponsePairwisePlan {
  if (
    dataset.id.trim().length === 0 ||
    dataset.version.trim().length === 0 ||
    evaluatorVersion.trim().length === 0 ||
    left.responseId === right.responseId ||
    left.caseId !== right.caseId ||
    left.caseVersion !== right.caseVersion
  ) {
    invalid();
  }

  const tutorEvalCase = dataset.cases.find((candidate) => candidate.id === left.caseId);
  if (tutorEvalCase === undefined || tutorEvalCase.version !== left.caseVersion) {
    invalid();
  }

  validateResponseAgainstCase(left, tutorEvalCase.id, tutorEvalCase.version);
  validateResponseAgainstCase(right, tutorEvalCase.id, tutorEvalCase.version);

  const canonical = [left, right].sort((a, b) =>
    a.responseId.localeCompare(b.responseId),
  ) as [TutorCandidateResponse, TutorCandidateResponse];
  const responseIds = [canonical[0].responseId, canonical[1].responseId] as const;
  const pairId = derivePairId({
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    evaluatorVersion,
    caseId: tutorEvalCase.id,
    caseVersion: tutorEvalCase.version,
    responseIds,
  });

  return {
    schemaVersion: TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION,
    protocolId: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID,
    protocolVersion: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION,
    pairId,
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    evaluatorVersion,
    caseId: tutorEvalCase.id,
    caseVersion: tutorEvalCase.version,
    candidateAResponseId: canonical[0].responseId,
    candidateBResponseId: canonical[1].responseId,
    presentations: [
      buildPresentation(
        pairId,
        1,
        dataset,
        evaluatorVersion,
        canonical[0],
        canonical[1],
      ),
      buildPresentation(
        pairId,
        2,
        dataset,
        evaluatorVersion,
        canonical[1],
        canonical[0],
      ),
    ],
  };
}

function normalizePresentation(
  presentation: TutorResponsePairwisePresentationPlan,
  judgment: TutorResponsePairwisePresentationJudgment,
): TutorResponsePairwiseNormalizedPresentation {
  if (judgment.presentationId !== presentation.assignment.presentationId) {
    invalid();
  }
  if (judgment.status === "ok" && judgment.outcome === undefined) {
    invalid();
  }
  if (judgment.status !== "ok" && judgment.outcome !== undefined) {
    invalid();
  }

  let winnerResponseId: string | null = null;
  if (judgment.status === "ok") {
    if (judgment.outcome === "A_BETTER") {
      winnerResponseId = presentation.assignment.aResponseId;
    } else if (judgment.outcome === "B_BETTER") {
      winnerResponseId = presentation.assignment.bResponseId;
    } else if (judgment.outcome !== "TIE") {
      invalid();
    }
  }

  return {
    presentationId: judgment.presentationId,
    status: judgment.status,
    ...(judgment.outcome === undefined ? {} : { rawOutcome: judgment.outcome }),
    winnerResponseId,
    ...(judgment.reason === undefined ? {} : { reason: judgment.reason }),
  };
}

function canonicalOutcome(
  plan: TutorResponsePairwisePlan,
  winnerResponseId: string,
): "A_BETTER" | "B_BETTER" {
  if (winnerResponseId === plan.candidateAResponseId) {
    return "A_BETTER";
  }
  if (winnerResponseId === plan.candidateBResponseId) {
    return "B_BETTER";
  }
  invalid();
}

function isTie(
  presentation: TutorResponsePairwiseNormalizedPresentation,
): boolean {
  return presentation.status === "ok" && presentation.rawOutcome === "TIE";
}

export function normalizeTutorResponsePairwiseEvidence(
  plan: TutorResponsePairwisePlan,
  judgments: readonly TutorResponsePairwisePresentationJudgment[],
): TutorResponsePairwiseResult {
  if (judgments.length !== plan.presentations.length) {
    invalid();
  }

  const judgmentById = new Map<string, TutorResponsePairwisePresentationJudgment>();
  for (const judgment of judgments) {
    if (judgmentById.has(judgment.presentationId)) {
      invalid();
    }
    judgmentById.set(judgment.presentationId, judgment);
  }

  const normalized = plan.presentations.map((presentation) => {
    const judgment = judgmentById.get(presentation.assignment.presentationId);
    if (judgment === undefined) {
      invalid();
    }
    return normalizePresentation(presentation, judgment);
  });

  let outcome: TutorResponsePairwiseResult["outcome"] = "INCOMPARABLE";
  let consistency: TutorResponsePairwiseResult["consistency"];

  if (normalized.some((presentation) => presentation.status !== "ok")) {
    consistency = "incomplete_evidence";
  } else if (normalized.every(isTie)) {
    outcome = "TIE";
    consistency = "stable_tie";
  } else if (normalized.some(isTie)) {
    consistency = "inconsistent";
  } else {
    const [first, second] = normalized;
    if (
      first?.winnerResponseId === null ||
      second?.winnerResponseId === null ||
      first?.winnerResponseId === undefined ||
      second?.winnerResponseId === undefined
    ) {
      invalid();
    }
    if (first.winnerResponseId === second.winnerResponseId) {
      outcome = canonicalOutcome(plan, first.winnerResponseId);
      consistency = "stable_preference";
    } else {
      consistency = "order_sensitive";
    }
  }

  return {
    schemaVersion: TUTOR_RESPONSE_PAIRWISE_SCHEMA_VERSION,
    protocolId: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_ID,
    protocolVersion: TUTOR_RESPONSE_PAIRWISE_PROTOCOL_VERSION,
    pairId: plan.pairId,
    datasetId: plan.datasetId,
    datasetVersion: plan.datasetVersion,
    evaluatorVersion: plan.evaluatorVersion,
    caseId: plan.caseId,
    caseVersion: plan.caseVersion,
    candidateAResponseId: plan.candidateAResponseId,
    candidateBResponseId: plan.candidateBResponseId,
    outcome,
    consistency,
    presentations: normalized,
    rankingClaimAllowed: false,
  };
}

export function isTutorResponsePairwiseRawOutcome(
  value: string,
): value is TutorResponsePairwiseRawOutcome {
  return value === "A_BETTER" || value === "B_BETTER" || value === "TIE";
}
