import { createHash } from "node:crypto";

import type { CaseSystemVNextStressRawOutcome } from "../contracts/case-system-vnext-evaluator-stress.js";
import {
  CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
  type CaseSystemVNextExpertReviewCanonicalOutcome,
  type CaseSystemVNextExpertReviewEvidence,
  type CaseSystemVNextExpertReviewEvidenceItem,
  type CaseSystemVNextExpertReviewExport,
  type CaseSystemVNextExpertReviewTask,
} from "./expert-review.js";

export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID =
  "case-system-vnext-expert-review-adjudication" as const;
export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION =
  "0.1.0" as const;

export type CaseSystemVNextExpertReviewAdjudicationReason =
  | "reviewer_disagreement"
  | "packet_ambiguity";

export interface CaseSystemVNextExpertReviewAdjudicationAssignment {
  readonly aCandidateId: string;
  readonly bCandidateId: string;
}

export interface CaseSystemVNextExpertReviewAdjudicationManifestTask {
  readonly reviewTaskId: string;
  readonly fixtureId: string;
  readonly reason: CaseSystemVNextExpertReviewAdjudicationReason;
  readonly assignment: CaseSystemVNextExpertReviewAdjudicationAssignment;
  readonly sourceReviewerResults: CaseSystemVNextExpertReviewEvidenceItem["reviewerResults"];
}

export interface CaseSystemVNextExpertReviewAdjudicationManifest {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION;
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
  readonly tasks: readonly CaseSystemVNextExpertReviewAdjudicationManifestTask[];
}

export interface CaseSystemVNextExpertReviewAdjudicationPacket {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly adjudicatorId: string;
  readonly taskSetFingerprint: string;
  readonly sourceEvidenceFingerprint: string;
  readonly adjudicationSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly tasks: readonly CaseSystemVNextExpertReviewTask[];
}

export interface CaseSystemVNextExpertReviewAdjudicationSubmissionItem {
  readonly reviewTaskId: string;
  readonly outcome: CaseSystemVNextStressRawOutcome;
  readonly sufficientlyClear: boolean;
  readonly notes?: string;
}

export interface CaseSystemVNextExpertReviewAdjudicationSubmission {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION;
  readonly adjudicatorId: string;
  readonly taskSetFingerprint: string;
  readonly sourceEvidenceFingerprint: string;
  readonly adjudicationSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly adjudications: readonly CaseSystemVNextExpertReviewAdjudicationSubmissionItem[];
}

export interface CaseSystemVNextExpertReviewAdjudicationSubmissionTemplate {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION;
  readonly adjudicatorId: string;
  readonly taskSetFingerprint: string;
  readonly sourceEvidenceFingerprint: string;
  readonly adjudicationSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly adjudications: readonly {
    readonly reviewTaskId: string;
    readonly outcome: "";
    readonly sufficientlyClear: "";
    readonly notes?: string;
  }[];
}

export interface CaseSystemVNextExpertReviewAdjudicationExport {
  readonly manifest: CaseSystemVNextExpertReviewAdjudicationManifest;
  readonly packet: CaseSystemVNextExpertReviewAdjudicationPacket;
  readonly template: CaseSystemVNextExpertReviewAdjudicationSubmissionTemplate;
}

export interface CaseSystemVNextExpertReviewResolutionTask {
  readonly reviewTaskId: string;
  readonly fixtureId: string;
  readonly sourceAgreement: CaseSystemVNextExpertReviewEvidenceItem["agreement"];
  readonly sourceReviewerResults: CaseSystemVNextExpertReviewEvidenceItem["reviewerResults"];
  readonly resolutionStatus: "reviewer_consensus" | "adjudicated" | "unresolved";
  readonly resolution?: CaseSystemVNextExpertReviewCanonicalOutcome;
  readonly adjudicationReason?: CaseSystemVNextExpertReviewAdjudicationReason;
  readonly adjudicatorResult?: {
    readonly adjudicatorId: string;
    readonly outcome: CaseSystemVNextStressRawOutcome;
    readonly normalizedOutcome: CaseSystemVNextExpertReviewCanonicalOutcome;
    readonly sufficientlyClear: boolean;
    readonly notes?: string;
  };
}

export interface CaseSystemVNextExpertReviewResolution {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly reviewerIds: readonly [string, string];
  readonly adjudicatorId?: string;
  readonly taskSetFingerprint: string;
  readonly sourceEvidenceFingerprint: string;
  readonly adjudicationSetFingerprint?: string;
  readonly summary: {
    readonly totalTaskCount: number;
    readonly reviewerConsensusCount: number;
    readonly adjudicatedCount: number;
    readonly unresolvedCount: number;
    readonly resolvedCount: number;
    readonly resolvedShare: number | null;
  };
  readonly tasks: readonly CaseSystemVNextExpertReviewResolutionTask[];
  readonly interpretationBoundary: readonly string[];
  readonly resolutionFingerprint: string;
}

const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/u;
const outcomes = new Set<CaseSystemVNextStressRawOutcome>([
  "A_BETTER",
  "B_BETTER",
  "EQUIVALENT",
  "NON_DOMINATED",
  "INSUFFICIENT_EVIDENCE",
]);

function invalid(): never {
  throw new Error("Case System vNext expert review adjudication data is invalid.");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function onlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(record).every((key) => keys.has(key));
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function opaqueId(value: string): string {
  if (!opaqueIdPattern.test(value) || value.includes("@")) invalid();
  return value;
}

function sameStringTuple(
  left: readonly [string, string],
  right: readonly [string, string],
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function sameOutcome(
  left: CaseSystemVNextExpertReviewCanonicalOutcome,
  right: CaseSystemVNextExpertReviewCanonicalOutcome,
): boolean {
  return left.kind === right.kind &&
    (left.kind !== "preference" ||
      (right.kind === "preference" && left.candidateId === right.candidateId));
}

function normalizeOutcome(
  outcome: CaseSystemVNextStressRawOutcome,
  assignment: CaseSystemVNextExpertReviewAdjudicationAssignment,
): CaseSystemVNextExpertReviewCanonicalOutcome {
  if (outcome === "A_BETTER") {
    return { kind: "preference", candidateId: assignment.aCandidateId };
  }
  if (outcome === "B_BETTER") {
    return { kind: "preference", candidateId: assignment.bCandidateId };
  }
  if (outcome === "EQUIVALENT") return { kind: "equivalent" };
  if (outcome === "NON_DOMINATED") return { kind: "non_dominated" };
  return { kind: "insufficient_evidence" };
}

function validateEvidenceAgainstExport(
  exported: CaseSystemVNextExpertReviewExport,
  evidence: CaseSystemVNextExpertReviewEvidence,
): void {
  if (
    evidence.schemaVersion !== exported.manifest.schemaVersion ||
    evidence.taskSetFingerprint !== exported.manifest.taskSetFingerprint ||
    evidence.suiteId !== exported.manifest.suiteId ||
    evidence.suiteVersion !== exported.manifest.suiteVersion ||
    evidence.strategyRegistryId !== exported.manifest.strategyRegistryId ||
    evidence.strategyRegistryVersion !== exported.manifest.strategyRegistryVersion ||
    evidence.pilotId !== exported.manifest.pilotId ||
    evidence.pilotVersion !== exported.manifest.pilotVersion ||
    !sameStringTuple(evidence.reviewerIds, exported.manifest.reviewerIds) ||
    evidence.reviews.length !== exported.manifest.tasks.length ||
    evidence.agreementCount + evidence.disagreementCount +
      evidence.packetAmbiguityCount !== evidence.reviews.length
  ) invalid();

  const reviewById = new Map(evidence.reviews.map((review) => [review.reviewTaskId, review]));
  if (reviewById.size !== evidence.reviews.length) invalid();

  for (const task of exported.manifest.tasks) {
    const review = reviewById.get(task.reviewTaskId);
    if (review === undefined || review.fixtureId !== task.fixtureId) invalid();
    if (
      review.reviewerResults[0].reviewerId !== exported.manifest.reviewerIds[0] ||
      review.reviewerResults[1].reviewerId !== exported.manifest.reviewerIds[1]
    ) invalid();

    for (const index of [0, 1] as const) {
      const result = review.reviewerResults[index];
      const assignment = task.assignments[index];
      const normalized = normalizeOutcome(result.outcome, assignment);
      if (!sameOutcome(normalized, result.normalizedOutcome)) invalid();
    }

    const expectedAgreement = review.reviewerResults.some(
      (result) => !result.sufficientlyClear,
    )
      ? "packet_ambiguity"
      : sameOutcome(
          review.reviewerResults[0].normalizedOutcome,
          review.reviewerResults[1].normalizedOutcome,
        )
        ? "agreement"
        : "disagreement";
    if (review.agreement !== expectedAgreement) invalid();
  }

  if (
    evidence.reviews.filter((review) => review.agreement === "agreement").length !==
      evidence.agreementCount ||
    evidence.reviews.filter((review) => review.agreement === "disagreement").length !==
      evidence.disagreementCount ||
    evidence.reviews.filter((review) => review.agreement === "packet_ambiguity").length !==
      evidence.packetAmbiguityCount
  ) invalid();
}

function adjudicationReason(
  agreement: CaseSystemVNextExpertReviewEvidenceItem["agreement"],
): CaseSystemVNextExpertReviewAdjudicationReason | null {
  if (agreement === "disagreement") return "reviewer_disagreement";
  if (agreement === "packet_ambiguity") return "packet_ambiguity";
  return null;
}

export function buildCaseSystemVNextExpertReviewAdjudicationExport(
  exported: CaseSystemVNextExpertReviewExport,
  evidence: CaseSystemVNextExpertReviewEvidence,
  adjudicatorIdInput: string,
): CaseSystemVNextExpertReviewAdjudicationExport {
  validateEvidenceAgainstExport(exported, evidence);
  const adjudicatorId = opaqueId(adjudicatorIdInput);
  if (evidence.reviewerIds.includes(adjudicatorId)) invalid();

  const reviewById = new Map(evidence.reviews.map((review) => [review.reviewTaskId, review]));
  const packetTaskById = new Map(
    exported.packets[0].tasks.map((task) => [task.reviewTaskId, task]),
  );
  const queuedManifestTasks: CaseSystemVNextExpertReviewAdjudicationManifestTask[] = [];
  const queuedPacketTasks: CaseSystemVNextExpertReviewTask[] = [];

  for (const task of exported.manifest.tasks) {
    const review = reviewById.get(task.reviewTaskId);
    const reason = review === undefined ? null : adjudicationReason(review.agreement);
    if (review === undefined || reason === null) continue;
    const packetTask = packetTaskById.get(task.reviewTaskId);
    if (packetTask === undefined) invalid();
    queuedManifestTasks.push({
      reviewTaskId: task.reviewTaskId,
      fixtureId: task.fixtureId,
      reason,
      assignment: {
        aCandidateId: task.assignments[0].aCandidateId,
        bCandidateId: task.assignments[0].bCandidateId,
      },
      sourceReviewerResults: review.reviewerResults,
    });
    queuedPacketTasks.push({
      ...packetTask,
      comparisonInstruction: [
        "Adjudicate this task independently from the prior reviewers.",
        "Choose exactly one outcome: A_BETTER, B_BETTER, EQUIVALENT, NON_DOMINATED, or INSUFFICIENT_EVIDENCE.",
        "Do not infer prior reviewer choices, developer expectations, or model identity.",
      ].join(" "),
    });
  }

  if (queuedManifestTasks.length === 0) invalid();

  const sourceEvidenceFingerprint = fingerprint(evidence);
  const adjudicationSetFingerprint = fingerprint({
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
    taskSetFingerprint: evidence.taskSetFingerprint,
    sourceEvidenceFingerprint,
    adjudicatorId,
    tasks: queuedManifestTasks.map((task) => ({
      reviewTaskId: task.reviewTaskId,
      fixtureId: task.fixtureId,
      reason: task.reason,
      assignment: task.assignment,
    })),
  });

  const withoutPacketFingerprint = {
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
    suiteId: evidence.suiteId,
    suiteVersion: evidence.suiteVersion,
    strategyRegistryId: evidence.strategyRegistryId,
    strategyRegistryVersion: evidence.strategyRegistryVersion,
    pilotId: evidence.pilotId,
    pilotVersion: evidence.pilotVersion,
    adjudicatorId,
    taskSetFingerprint: evidence.taskSetFingerprint,
    sourceEvidenceFingerprint,
    adjudicationSetFingerprint,
    tasks: queuedPacketTasks,
  } as const;
  const packet = {
    ...withoutPacketFingerprint,
    packetFingerprint: fingerprint(withoutPacketFingerprint),
  };

  return {
    manifest: {
      schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
      protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
      protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
      suiteId: evidence.suiteId,
      suiteVersion: evidence.suiteVersion,
      strategyRegistryId: evidence.strategyRegistryId,
      strategyRegistryVersion: evidence.strategyRegistryVersion,
      pilotId: evidence.pilotId,
      pilotVersion: evidence.pilotVersion,
      reviewerIds: evidence.reviewerIds,
      adjudicatorId,
      taskSetFingerprint: evidence.taskSetFingerprint,
      sourceEvidenceFingerprint,
      adjudicationSetFingerprint,
      tasks: queuedManifestTasks,
    },
    packet,
    template: {
      schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
      protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
      protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
      adjudicatorId,
      taskSetFingerprint: evidence.taskSetFingerprint,
      sourceEvidenceFingerprint,
      adjudicationSetFingerprint,
      packetFingerprint: packet.packetFingerprint,
      adjudications: queuedManifestTasks.map((task) => ({
        reviewTaskId: task.reviewTaskId,
        outcome: "" as const,
        sufficientlyClear: "" as const,
      })),
    },
  };
}

export function parseCaseSystemVNextExpertReviewAdjudicationSubmission(
  value: unknown,
  packet: CaseSystemVNextExpertReviewAdjudicationPacket,
): CaseSystemVNextExpertReviewAdjudicationSubmission {
  const record = asRecord(value);
  if (
    record === null ||
    !onlyKeys(record, [
      "schemaVersion",
      "protocolId",
      "protocolVersion",
      "adjudicatorId",
      "taskSetFingerprint",
      "sourceEvidenceFingerprint",
      "adjudicationSetFingerprint",
      "packetFingerprint",
      "adjudications",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION ||
    record.protocolId !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID ||
    record.protocolVersion !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION ||
    record.adjudicatorId !== packet.adjudicatorId ||
    record.taskSetFingerprint !== packet.taskSetFingerprint ||
    record.sourceEvidenceFingerprint !== packet.sourceEvidenceFingerprint ||
    record.adjudicationSetFingerprint !== packet.adjudicationSetFingerprint ||
    record.packetFingerprint !== packet.packetFingerprint ||
    !fingerprintPattern.test(String(record.taskSetFingerprint)) ||
    !fingerprintPattern.test(String(record.sourceEvidenceFingerprint)) ||
    !fingerprintPattern.test(String(record.adjudicationSetFingerprint)) ||
    !fingerprintPattern.test(String(record.packetFingerprint)) ||
    !Array.isArray(record.adjudications) ||
    record.adjudications.length !== packet.tasks.length
  ) invalid();

  const expectedIds = new Set(packet.tasks.map((task) => task.reviewTaskId));
  const seen = new Set<string>();
  const adjudications = record.adjudications.map((value) => {
    const item = asRecord(value);
    if (
      item === null ||
      !onlyKeys(item, ["reviewTaskId", "outcome", "sufficientlyClear", "notes"]) ||
      typeof item.reviewTaskId !== "string" ||
      !expectedIds.has(item.reviewTaskId) ||
      seen.has(item.reviewTaskId) ||
      typeof item.outcome !== "string" ||
      !outcomes.has(item.outcome as CaseSystemVNextStressRawOutcome) ||
      typeof item.sufficientlyClear !== "boolean" ||
      (item.notes !== undefined &&
        (typeof item.notes !== "string" ||
          item.notes.trim().length === 0 ||
          item.notes.length > 2_000)) ||
      (item.sufficientlyClear === false && item.notes === undefined)
    ) invalid();
    seen.add(item.reviewTaskId);
    return {
      reviewTaskId: item.reviewTaskId,
      outcome: item.outcome as CaseSystemVNextStressRawOutcome,
      sufficientlyClear: item.sufficientlyClear,
      ...(item.notes === undefined ? {} : { notes: item.notes }),
    };
  });
  if (seen.size !== expectedIds.size) invalid();

  return {
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
    adjudicatorId: packet.adjudicatorId,
    taskSetFingerprint: packet.taskSetFingerprint,
    sourceEvidenceFingerprint: packet.sourceEvidenceFingerprint,
    adjudicationSetFingerprint: packet.adjudicationSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    adjudications,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function finalizeResolution(
  evidence: CaseSystemVNextExpertReviewEvidence,
  tasks: readonly CaseSystemVNextExpertReviewResolutionTask[],
  sourceEvidenceFingerprint: string,
  adjudication?: {
    readonly adjudicatorId: string;
    readonly adjudicationSetFingerprint: string;
  },
): CaseSystemVNextExpertReviewResolution {
  const reviewerConsensusCount =
    tasks.filter((task) => task.resolutionStatus === "reviewer_consensus").length;
  const adjudicatedCount =
    tasks.filter((task) => task.resolutionStatus === "adjudicated").length;
  const unresolvedCount =
    tasks.filter((task) => task.resolutionStatus === "unresolved").length;
  const resolvedCount = reviewerConsensusCount + adjudicatedCount;

  const withoutFingerprint = {
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_ADJUDICATION_PROTOCOL_VERSION,
    suiteId: evidence.suiteId,
    suiteVersion: evidence.suiteVersion,
    strategyRegistryId: evidence.strategyRegistryId,
    strategyRegistryVersion: evidence.strategyRegistryVersion,
    pilotId: evidence.pilotId,
    pilotVersion: evidence.pilotVersion,
    reviewerIds: evidence.reviewerIds,
    ...(adjudication === undefined ? {} : { adjudicatorId: adjudication.adjudicatorId }),
    taskSetFingerprint: evidence.taskSetFingerprint,
    sourceEvidenceFingerprint,
    ...(adjudication === undefined
      ? {}
      : { adjudicationSetFingerprint: adjudication.adjudicationSetFingerprint }),
    summary: {
      totalTaskCount: tasks.length,
      reviewerConsensusCount,
      adjudicatedCount,
      unresolvedCount,
      resolvedCount,
      resolvedShare: tasks.length === 0 ? null : resolvedCount / tasks.length,
    },
    tasks,
    interpretationBoundary: [
      ...evidence.interpretationBoundary,
      "Adjudication is a separate human record and never rewrites the two source reviewer submissions.",
      "A task remains unresolved when the adjudicator marks the packet insufficiently clear.",
      "Reviewer consensus or completed adjudication is resolution evidence, not infallible ground truth.",
      "No automatic reference-label promotion, Judge ranking, or learner-outcome claim is performed.",
    ],
  } as const;

  return {
    ...withoutFingerprint,
    resolutionFingerprint: fingerprint(withoutFingerprint),
  };
}

export function buildCaseSystemVNextExpertReviewConsensusResolution(
  exported: CaseSystemVNextExpertReviewExport,
  evidence: CaseSystemVNextExpertReviewEvidence,
): CaseSystemVNextExpertReviewResolution {
  validateEvidenceAgainstExport(exported, evidence);
  if (
    evidence.disagreementCount !== 0 ||
    evidence.packetAmbiguityCount !== 0 ||
    evidence.reviews.some((review) => review.agreement !== "agreement")
  ) invalid();

  const tasks = evidence.reviews.map((review): CaseSystemVNextExpertReviewResolutionTask => ({
    reviewTaskId: review.reviewTaskId,
    fixtureId: review.fixtureId,
    sourceAgreement: "agreement",
    sourceReviewerResults: review.reviewerResults,
    resolutionStatus: "reviewer_consensus",
    resolution: review.reviewerResults[0].normalizedOutcome,
  }));
  return finalizeResolution(evidence, tasks, fingerprint(evidence));
}

export function buildCaseSystemVNextExpertReviewResolution(
  exported: CaseSystemVNextExpertReviewExport,
  evidence: CaseSystemVNextExpertReviewEvidence,
  adjudicationExport: CaseSystemVNextExpertReviewAdjudicationExport,
  submissionInput: CaseSystemVNextExpertReviewAdjudicationSubmission,
): CaseSystemVNextExpertReviewResolution {
  const expected = buildCaseSystemVNextExpertReviewAdjudicationExport(
    exported,
    evidence,
    adjudicationExport.manifest.adjudicatorId,
  );
  if (
    !sameJson(expected.manifest, adjudicationExport.manifest) ||
    !sameJson(expected.packet, adjudicationExport.packet)
  ) invalid();

  const submission = parseCaseSystemVNextExpertReviewAdjudicationSubmission(
    submissionInput,
    adjudicationExport.packet,
  );
  const adjudicationTaskById = new Map(
    adjudicationExport.manifest.tasks.map((task) => [task.reviewTaskId, task]),
  );
  const adjudicationById = new Map(
    submission.adjudications.map((item) => [item.reviewTaskId, item]),
  );

  const tasks: CaseSystemVNextExpertReviewResolutionTask[] = evidence.reviews.map((review) => {
    if (review.agreement === "agreement") {
      return {
        reviewTaskId: review.reviewTaskId,
        fixtureId: review.fixtureId,
        sourceAgreement: review.agreement,
        sourceReviewerResults: review.reviewerResults,
        resolutionStatus: "reviewer_consensus",
        resolution: review.reviewerResults[0].normalizedOutcome,
      };
    }

    const adjudicationTask = adjudicationTaskById.get(review.reviewTaskId);
    const adjudication = adjudicationById.get(review.reviewTaskId);
    if (adjudicationTask === undefined || adjudication === undefined) invalid();
    const normalizedOutcome = normalizeOutcome(
      adjudication.outcome,
      adjudicationTask.assignment,
    );
    const adjudicatorResult = {
      adjudicatorId: submission.adjudicatorId,
      outcome: adjudication.outcome,
      normalizedOutcome,
      sufficientlyClear: adjudication.sufficientlyClear,
      ...(adjudication.notes === undefined ? {} : { notes: adjudication.notes }),
    };
    const reason = adjudicationReason(review.agreement);
    if (reason === null) invalid();

    if (!adjudication.sufficientlyClear) {
      return {
        reviewTaskId: review.reviewTaskId,
        fixtureId: review.fixtureId,
        sourceAgreement: review.agreement,
        sourceReviewerResults: review.reviewerResults,
        resolutionStatus: "unresolved",
        adjudicationReason: reason,
        adjudicatorResult,
      };
    }
    return {
      reviewTaskId: review.reviewTaskId,
      fixtureId: review.fixtureId,
      sourceAgreement: review.agreement,
      sourceReviewerResults: review.reviewerResults,
      resolutionStatus: "adjudicated",
      resolution: normalizedOutcome,
      adjudicationReason: reason,
      adjudicatorResult,
    };
  });

  return finalizeResolution(
    evidence,
    tasks,
    adjudicationExport.manifest.sourceEvidenceFingerprint,
    {
      adjudicatorId: submission.adjudicatorId,
      adjudicationSetFingerprint: adjudicationExport.manifest.adjudicationSetFingerprint,
    },
  );
}
