import { createHash } from "node:crypto";

import type { CaseSystemVNextStressRawOutcome } from "../contracts/case-system-vnext-evaluator-stress.js";
import {
  CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
  type CaseSystemVNextExpertReviewCanonicalOutcome,
} from "./expert-review.js";
import {
  CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
  CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
  type CaseSystemVNextExpertReviewResolution,
  type CaseSystemVNextExpertReviewResolutionTask,
} from "./expert-review-adjudication.js";

export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_ID =
  "case-system-vnext-expert-review-reference-candidate" as const;
export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_VERSION =
  "0.1.0" as const;

export type CaseSystemVNextExpertReviewReferenceCandidateBlocker =
  | "unresolved"
  | "insufficient_evidence";

export interface CaseSystemVNextExpertReviewReferenceCandidateTask {
  readonly reviewTaskId: string;
  readonly fixtureId: string;
  readonly sourceResolutionStatus:
    CaseSystemVNextExpertReviewResolutionTask["resolutionStatus"];
  readonly provenance?: "human_consensus" | "human_adjudicated";
  readonly candidateStatus:
    | "candidate_ready"
    | "blocked_unresolved"
    | "blocked_insufficient_evidence";
  readonly outcome?: Exclude<
    CaseSystemVNextExpertReviewCanonicalOutcome,
    { readonly kind: "insufficient_evidence" }
  >;
  readonly blocker?: CaseSystemVNextExpertReviewReferenceCandidateBlocker;
}

export interface CaseSystemVNextExpertReviewReferenceCandidate {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId:
    typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_ID;
  readonly protocolVersion:
    typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly reviewerIds: readonly [string, string];
  readonly adjudicatorId: string;
  readonly taskSetFingerprint: string;
  readonly sourceEvidenceFingerprint: string;
  readonly adjudicationSetFingerprint: string;
  readonly sourceResolutionFingerprint: string;
  readonly summary: {
    readonly totalTaskCount: number;
    readonly candidateReadyCount: number;
    readonly blockedCount: number;
    readonly unresolvedCount: number;
    readonly insufficientEvidenceCount: number;
  };
  readonly promotionGate: {
    readonly status: "blocked" | "eligible_for_manual_promotion";
    readonly automaticPromotionAllowed: false;
    readonly operatorApprovalRequired: true;
    readonly blockers: readonly {
      readonly reviewTaskId: string;
      readonly fixtureId: string;
      readonly reason: CaseSystemVNextExpertReviewReferenceCandidateBlocker;
    }[];
  };
  readonly tasks: readonly CaseSystemVNextExpertReviewReferenceCandidateTask[];
  readonly interpretationBoundary: readonly string[];
  readonly candidateFingerprint: string;
}

const fingerprintPattern = /^sha256:[0-9a-f]{64}$/u;
const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const rawOutcomes = new Set<CaseSystemVNextStressRawOutcome>([
  "A_BETTER",
  "B_BETTER",
  "EQUIVALENT",
  "NON_DOMINATED",
  "INSUFFICIENT_EVIDENCE",
]);

function invalid(): never {
  throw new Error("Case System vNext expert review resolution data is invalid.");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function onlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function opaqueId(value: unknown): value is string {
  return typeof value === "string" &&
    opaqueIdPattern.test(value) &&
    !value.includes("@");
}

function canonicalOutcome(
  value: unknown,
): CaseSystemVNextExpertReviewCanonicalOutcome | null {
  const record = asRecord(value);
  if (record === null || typeof record.kind !== "string") return null;
  if (
    record.kind === "preference" &&
    onlyKeys(record, ["kind", "candidateId"]) &&
    typeof record.candidateId === "string" &&
    record.candidateId.length > 0
  ) {
    return { kind: "preference", candidateId: record.candidateId };
  }
  if (
    ["equivalent", "non_dominated", "insufficient_evidence"].includes(record.kind) &&
    onlyKeys(record, ["kind"])
  ) {
    return { kind: record.kind } as CaseSystemVNextExpertReviewCanonicalOutcome;
  }
  return null;
}

function sameOutcome(
  left: CaseSystemVNextExpertReviewCanonicalOutcome,
  right: CaseSystemVNextExpertReviewCanonicalOutcome,
): boolean {
  return left.kind === right.kind &&
    (left.kind !== "preference" ||
      (right.kind === "preference" && left.candidateId === right.candidateId));
}

function reviewerResult(
  value: unknown,
  reviewerId: string,
): CaseSystemVNextExpertReviewResolutionTask["sourceReviewerResults"][number] | null {
  const record = asRecord(value);
  const normalized = canonicalOutcome(record?.normalizedOutcome);
  if (
    record === null ||
    !onlyKeys(record, [
      "reviewerId",
      "sufficientlyClear",
      "outcome",
      "normalizedOutcome",
      "notes",
    ]) ||
    record.reviewerId !== reviewerId ||
    typeof record.sufficientlyClear !== "boolean" ||
    typeof record.outcome !== "string" ||
    !rawOutcomes.has(record.outcome as CaseSystemVNextStressRawOutcome) ||
    normalized === null ||
    (record.notes !== undefined &&
      (typeof record.notes !== "string" ||
        record.notes.trim().length === 0 ||
        record.notes.length > 2_000))
  ) return null;
  return {
    reviewerId,
    sufficientlyClear: record.sufficientlyClear,
    outcome: record.outcome as CaseSystemVNextStressRawOutcome,
    normalizedOutcome: normalized,
    ...(record.notes === undefined ? {} : { notes: record.notes }),
  };
}

function adjudicatorResult(
  value: unknown,
  adjudicatorId: string,
): NonNullable<CaseSystemVNextExpertReviewResolutionTask["adjudicatorResult"]> | null {
  const record = asRecord(value);
  const normalized = canonicalOutcome(record?.normalizedOutcome);
  if (
    record === null ||
    !onlyKeys(record, [
      "adjudicatorId",
      "outcome",
      "normalizedOutcome",
      "sufficientlyClear",
      "notes",
    ]) ||
    record.adjudicatorId !== adjudicatorId ||
    typeof record.outcome !== "string" ||
    !rawOutcomes.has(record.outcome as CaseSystemVNextStressRawOutcome) ||
    normalized === null ||
    typeof record.sufficientlyClear !== "boolean" ||
    (record.notes !== undefined &&
      (typeof record.notes !== "string" ||
        record.notes.trim().length === 0 ||
        record.notes.length > 2_000)) ||
    (record.sufficientlyClear === false && record.notes === undefined)
  ) return null;
  return {
    adjudicatorId,
    outcome: record.outcome as CaseSystemVNextStressRawOutcome,
    normalizedOutcome: normalized,
    sufficientlyClear: record.sufficientlyClear,
    ...(record.notes === undefined ? {} : { notes: record.notes }),
  };
}

function parseResolutionTask(
  value: unknown,
  reviewerIds: readonly [string, string],
  adjudicatorId: string,
): CaseSystemVNextExpertReviewResolutionTask {
  const record = asRecord(value);
  if (
    record === null ||
    !onlyKeys(record, [
      "reviewTaskId",
      "fixtureId",
      "sourceAgreement",
      "sourceReviewerResults",
      "resolutionStatus",
      "resolution",
      "adjudicationReason",
      "adjudicatorResult",
    ]) ||
    typeof record.reviewTaskId !== "string" ||
    record.reviewTaskId.length === 0 ||
    typeof record.fixtureId !== "string" ||
    record.fixtureId.length === 0 ||
    !["agreement", "disagreement", "packet_ambiguity"].includes(
      String(record.sourceAgreement),
    ) ||
    !Array.isArray(record.sourceReviewerResults) ||
    record.sourceReviewerResults.length !== 2 ||
    !["reviewer_consensus", "adjudicated", "unresolved"].includes(
      String(record.resolutionStatus),
    )
  ) invalid();

  const first = reviewerResult(record.sourceReviewerResults[0], reviewerIds[0]);
  const second = reviewerResult(record.sourceReviewerResults[1], reviewerIds[1]);
  if (first === null || second === null) invalid();

  const sourceAgreement = record.sourceAgreement as
    CaseSystemVNextExpertReviewResolutionTask["sourceAgreement"];
  const resolutionStatus = record.resolutionStatus as
    CaseSystemVNextExpertReviewResolutionTask["resolutionStatus"];
  let parsedResolution: CaseSystemVNextExpertReviewCanonicalOutcome | undefined;
  if (record.resolution !== undefined) {
    const parsed = canonicalOutcome(record.resolution);
    if (parsed === null) invalid();
    parsedResolution = parsed;
  }

  if (resolutionStatus === "reviewer_consensus") {
    if (
      sourceAgreement !== "agreement" ||
      parsedResolution === undefined ||
      record.adjudicationReason !== undefined ||
      record.adjudicatorResult !== undefined ||
      !sameOutcome(first.normalizedOutcome, second.normalizedOutcome) ||
      !sameOutcome(first.normalizedOutcome, parsedResolution) ||
      !first.sufficientlyClear ||
      !second.sufficientlyClear
    ) invalid();
    return {
      reviewTaskId: record.reviewTaskId,
      fixtureId: record.fixtureId,
      sourceAgreement,
      sourceReviewerResults: [first, second],
      resolutionStatus,
      resolution: parsedResolution,
    };
  }

  const expectedReason = sourceAgreement === "disagreement"
    ? "reviewer_disagreement"
    : sourceAgreement === "packet_ambiguity"
      ? "packet_ambiguity"
      : null;
  const parsedAdjudicatorResult = adjudicatorResult(
    record.adjudicatorResult,
    adjudicatorId,
  );
  if (
    expectedReason === null ||
    record.adjudicationReason !== expectedReason ||
    parsedAdjudicatorResult === null
  ) invalid();

  if (resolutionStatus === "adjudicated") {
    if (
      parsedResolution === undefined ||
      !parsedAdjudicatorResult.sufficientlyClear ||
      !sameOutcome(parsedAdjudicatorResult.normalizedOutcome, parsedResolution)
    ) invalid();
    return {
      reviewTaskId: record.reviewTaskId,
      fixtureId: record.fixtureId,
      sourceAgreement,
      sourceReviewerResults: [first, second],
      resolutionStatus,
      resolution: parsedResolution,
      adjudicationReason: expectedReason,
      adjudicatorResult: parsedAdjudicatorResult,
    };
  }

  if (
    parsedResolution !== undefined ||
    parsedAdjudicatorResult.sufficientlyClear
  ) invalid();
  return {
    reviewTaskId: record.reviewTaskId,
    fixtureId: record.fixtureId,
    sourceAgreement,
    sourceReviewerResults: [first, second],
    resolutionStatus: "unresolved",
    adjudicationReason: expectedReason,
    adjudicatorResult: parsedAdjudicatorResult,
  };
}

export function parseCaseSystemVNextExpertReviewResolution(
  value: unknown,
): CaseSystemVNextExpertReviewResolution {
  const record = asRecord(value);
  const reviewerIds = record?.reviewerIds;
  if (
    record === null ||
    !onlyKeys(record, [
      "schemaVersion",
      "protocolId",
      "protocolVersion",
      "suiteId",
      "suiteVersion",
      "strategyRegistryId",
      "strategyRegistryVersion",
      "pilotId",
      "pilotVersion",
      "reviewerIds",
      "adjudicatorId",
      "taskSetFingerprint",
      "sourceEvidenceFingerprint",
      "adjudicationSetFingerprint",
      "summary",
      "tasks",
      "interpretationBoundary",
      "resolutionFingerprint",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION ||
    record.protocolId !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID ||
    record.protocolVersion !==
      CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION ||
    typeof record.suiteId !== "string" ||
    typeof record.suiteVersion !== "string" ||
    typeof record.strategyRegistryId !== "string" ||
    typeof record.strategyRegistryVersion !== "string" ||
    typeof record.pilotId !== "string" ||
    typeof record.pilotVersion !== "string" ||
    !Array.isArray(reviewerIds) ||
    reviewerIds.length !== 2 ||
    !opaqueId(reviewerIds[0]) ||
    !opaqueId(reviewerIds[1]) ||
    reviewerIds[0] === reviewerIds[1] ||
    !opaqueId(record.adjudicatorId) ||
    reviewerIds.includes(record.adjudicatorId) ||
    typeof record.taskSetFingerprint !== "string" ||
    !fingerprintPattern.test(record.taskSetFingerprint) ||
    typeof record.sourceEvidenceFingerprint !== "string" ||
    !fingerprintPattern.test(record.sourceEvidenceFingerprint) ||
    typeof record.adjudicationSetFingerprint !== "string" ||
    !fingerprintPattern.test(record.adjudicationSetFingerprint) ||
    typeof record.resolutionFingerprint !== "string" ||
    !fingerprintPattern.test(record.resolutionFingerprint) ||
    !Array.isArray(record.tasks) ||
    record.tasks.length === 0 ||
    !Array.isArray(record.interpretationBoundary) ||
    record.interpretationBoundary.some((item) => typeof item !== "string")
  ) invalid();

  const reviewerTuple = [reviewerIds[0], reviewerIds[1]] as const;
  const tasks = record.tasks.map((task) =>
    parseResolutionTask(task, reviewerTuple, record.adjudicatorId as string),
  );
  if (
    new Set(tasks.map((task) => task.reviewTaskId)).size !== tasks.length ||
    new Set(tasks.map((task) => task.fixtureId)).size !== tasks.length
  ) invalid();

  const summary = asRecord(record.summary);
  const reviewerConsensusCount =
    tasks.filter((task) => task.resolutionStatus === "reviewer_consensus").length;
  const adjudicatedCount =
    tasks.filter((task) => task.resolutionStatus === "adjudicated").length;
  const unresolvedCount =
    tasks.filter((task) => task.resolutionStatus === "unresolved").length;
  const resolvedCount = reviewerConsensusCount + adjudicatedCount;
  const resolvedShare = tasks.length === 0 ? null : resolvedCount / tasks.length;
  if (
    summary === null ||
    !onlyKeys(summary, [
      "totalTaskCount",
      "reviewerConsensusCount",
      "adjudicatedCount",
      "unresolvedCount",
      "resolvedCount",
      "resolvedShare",
    ]) ||
    summary.totalTaskCount !== tasks.length ||
    summary.reviewerConsensusCount !== reviewerConsensusCount ||
    summary.adjudicatedCount !== adjudicatedCount ||
    summary.unresolvedCount !== unresolvedCount ||
    summary.resolvedCount !== resolvedCount ||
    summary.resolvedShare !== resolvedShare
  ) invalid();

  const withoutFingerprint = {
    schemaVersion: record.schemaVersion,
    protocolId: record.protocolId,
    protocolVersion: record.protocolVersion,
    suiteId: record.suiteId,
    suiteVersion: record.suiteVersion,
    strategyRegistryId: record.strategyRegistryId,
    strategyRegistryVersion: record.strategyRegistryVersion,
    pilotId: record.pilotId,
    pilotVersion: record.pilotVersion,
    reviewerIds: reviewerTuple,
    adjudicatorId: record.adjudicatorId,
    taskSetFingerprint: record.taskSetFingerprint,
    sourceEvidenceFingerprint: record.sourceEvidenceFingerprint,
    adjudicationSetFingerprint: record.adjudicationSetFingerprint,
    summary: {
      totalTaskCount: tasks.length,
      reviewerConsensusCount,
      adjudicatedCount,
      unresolvedCount,
      resolvedCount,
      resolvedShare,
    },
    tasks,
    interpretationBoundary: record.interpretationBoundary as string[],
  } as const;
  if (fingerprint(withoutFingerprint) !== record.resolutionFingerprint) invalid();

  return {
    ...withoutFingerprint,
    resolutionFingerprint: record.resolutionFingerprint as string,
  };
}

export function buildCaseSystemVNextExpertReviewReferenceCandidate(
  resolutionInput: CaseSystemVNextExpertReviewResolution,
): CaseSystemVNextExpertReviewReferenceCandidate {
  const resolution = parseCaseSystemVNextExpertReviewResolution(resolutionInput);
  const tasks = resolution.tasks.map((task): CaseSystemVNextExpertReviewReferenceCandidateTask => {
    if (task.resolutionStatus === "unresolved" || task.resolution === undefined) {
      return {
        reviewTaskId: task.reviewTaskId,
        fixtureId: task.fixtureId,
        sourceResolutionStatus: task.resolutionStatus,
        candidateStatus: "blocked_unresolved",
        blocker: "unresolved",
      };
    }
    const provenance = task.resolutionStatus === "reviewer_consensus"
      ? "human_consensus" as const
      : "human_adjudicated" as const;

    if (task.resolution.kind === "insufficient_evidence") {
      return {
        reviewTaskId: task.reviewTaskId,
        fixtureId: task.fixtureId,
        sourceResolutionStatus: task.resolutionStatus,
        provenance,
        candidateStatus: "blocked_insufficient_evidence",
        blocker: "insufficient_evidence",
      };
    }
    return {
      reviewTaskId: task.reviewTaskId,
      fixtureId: task.fixtureId,
      sourceResolutionStatus: task.resolutionStatus,
      provenance,
      candidateStatus: "candidate_ready",
      outcome: task.resolution,
    };
  });

  const blockers = tasks.flatMap((task) =>
    task.blocker === undefined
      ? []
      : [{
          reviewTaskId: task.reviewTaskId,
          fixtureId: task.fixtureId,
          reason: task.blocker,
        }],
  );
  const candidateReadyCount =
    tasks.filter((task) => task.candidateStatus === "candidate_ready").length;
  const unresolvedCount =
    tasks.filter((task) => task.blocker === "unresolved").length;
  const insufficientEvidenceCount =
    tasks.filter((task) => task.blocker === "insufficient_evidence").length;

  const withoutFingerprint = {
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_ID,
    protocolVersion:
      CASE_SYSTEM_VNEXT_EXPERT_REVIEW_REFERENCE_CANDIDATE_PROTOCOL_VERSION,
    suiteId: resolution.suiteId,
    suiteVersion: resolution.suiteVersion,
    strategyRegistryId: resolution.strategyRegistryId,
    strategyRegistryVersion: resolution.strategyRegistryVersion,
    pilotId: resolution.pilotId,
    pilotVersion: resolution.pilotVersion,
    reviewerIds: resolution.reviewerIds,
    adjudicatorId: resolution.adjudicatorId,
    taskSetFingerprint: resolution.taskSetFingerprint,
    sourceEvidenceFingerprint: resolution.sourceEvidenceFingerprint,
    adjudicationSetFingerprint: resolution.adjudicationSetFingerprint,
    sourceResolutionFingerprint: resolution.resolutionFingerprint,
    summary: {
      totalTaskCount: tasks.length,
      candidateReadyCount,
      blockedCount: blockers.length,
      unresolvedCount,
      insufficientEvidenceCount,
    },
    promotionGate: {
      status: blockers.length === 0
        ? "eligible_for_manual_promotion" as const
        : "blocked" as const,
      automaticPromotionAllowed: false as const,
      operatorApprovalRequired: true as const,
      blockers,
    },
    tasks,
    interpretationBoundary: [
      ...resolution.interpretationBoundary,
      "Only preference, equivalence, or non-dominance resolutions can become reference candidates.",
      "Unresolved or insufficient-evidence tasks block promotion of this candidate set.",
      "An eligible gate permits manual promotion review only; it does not perform promotion.",
      "Promotion requires an explicit operator action outside this artifact builder.",
    ],
  } as const;

  return {
    ...withoutFingerprint,
    candidateFingerprint: fingerprint(withoutFingerprint),
  };
}
