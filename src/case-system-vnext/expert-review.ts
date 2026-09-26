import { createHash } from "node:crypto";

import type {
  CaseSystemVNextPilot,
} from "../contracts/case-system-vnext.js";
import type {
  CaseSystemVNextStressBlindPacket,
  CaseSystemVNextStressFixtureSuite,
  CaseSystemVNextStressRawOutcome,
  CaseSystemVNextStressStrategyRegistry,
} from "../contracts/case-system-vnext-evaluator-stress.js";
import {
  buildCaseSystemVNextEvaluatorStressPlan,
} from "./evaluator-stress.js";

export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION = 1 as const;
export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID =
  "case-system-vnext-expert-review" as const;
export const CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION = "0.1.0" as const;

export interface CaseSystemVNextExpertReviewCandidate {
  readonly label: "A" | "B";
  readonly responseText: string;
}

export interface CaseSystemVNextExpertReviewTask {
  readonly reviewTaskId: string;
  readonly domainId: CaseSystemVNextStressBlindPacket["domainId"];
  readonly subdomain: string;
  readonly practice: string;
  readonly topic: string;
  readonly learnerLevel: string;
  readonly contentDepth: CaseSystemVNextStressBlindPacket["contentDepth"];
  readonly pedagogicalDifficulty: CaseSystemVNextStressBlindPacket["pedagogicalDifficulty"];
  readonly interactionHorizon: CaseSystemVNextStressBlindPacket["interactionHorizon"];
  readonly coreTask: string;
  readonly learnerState: string;
  readonly teachingTarget: string;
  readonly teachingObjective: CaseSystemVNextStressBlindPacket["teachingObjective"];
  readonly teachingObjectiveProfile:
    CaseSystemVNextStressBlindPacket["teachingObjectiveProfile"];
  readonly sharedBaseCriteria:
    CaseSystemVNextStressBlindPacket["sharedBaseCriteria"];
  readonly strategyProfile: CaseSystemVNextStressBlindPacket["strategyProfile"];
  readonly prerequisiteBoundary:
    CaseSystemVNextStressBlindPacket["prerequisiteBoundary"];
  readonly referenceReasoning:
    CaseSystemVNextStressBlindPacket["referenceReasoning"];
  readonly transfer: CaseSystemVNextStressBlindPacket["transfer"];
  readonly comparisonInstruction: string;
  readonly candidates: readonly [
    CaseSystemVNextExpertReviewCandidate,
    CaseSystemVNextExpertReviewCandidate,
  ];
}

export interface CaseSystemVNextExpertReviewPacket {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly reviewerId: string;
  readonly taskSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly tasks: readonly CaseSystemVNextExpertReviewTask[];
}

export interface CaseSystemVNextExpertReviewAssignment {
  readonly reviewerId: string;
  readonly aCandidateId: string;
  readonly bCandidateId: string;
}

export interface CaseSystemVNextExpertReviewManifestTask {
  readonly reviewTaskId: string;
  readonly fixtureId: string;
  readonly assignments: readonly [
    CaseSystemVNextExpertReviewAssignment,
    CaseSystemVNextExpertReviewAssignment,
  ];
}

export interface CaseSystemVNextExpertReviewManifest {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly reviewerIds: readonly [string, string];
  readonly taskSetFingerprint: string;
  readonly tasks: readonly CaseSystemVNextExpertReviewManifestTask[];
}

export interface CaseSystemVNextExpertReviewSubmissionItem {
  readonly reviewTaskId: string;
  readonly outcome: CaseSystemVNextStressRawOutcome;
  readonly sufficientlyClear: boolean;
  readonly notes?: string;
}

export interface CaseSystemVNextExpertReviewSubmission {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION;
  readonly reviewerId: string;
  readonly taskSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly reviews: readonly CaseSystemVNextExpertReviewSubmissionItem[];
}

export interface CaseSystemVNextExpertReviewSubmissionTemplateItem {
  readonly reviewTaskId: string;
  readonly outcome: "";
  readonly sufficientlyClear: "";
  readonly notes?: string;
}

export interface CaseSystemVNextExpertReviewSubmissionTemplate {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION;
  readonly reviewerId: string;
  readonly taskSetFingerprint: string;
  readonly packetFingerprint: string;
  readonly reviews: readonly CaseSystemVNextExpertReviewSubmissionTemplateItem[];
}

export type CaseSystemVNextExpertReviewCanonicalOutcome =
  | { readonly kind: "preference"; readonly candidateId: string }
  | { readonly kind: "equivalent" }
  | { readonly kind: "non_dominated" }
  | { readonly kind: "insufficient_evidence" };

export interface CaseSystemVNextExpertReviewEvidenceItem {
  readonly reviewTaskId: string;
  readonly fixtureId: string;
  readonly reviewerResults: readonly [
    {
      readonly reviewerId: string;
      readonly sufficientlyClear: boolean;
      readonly outcome: CaseSystemVNextStressRawOutcome;
      readonly normalizedOutcome: CaseSystemVNextExpertReviewCanonicalOutcome;
      readonly notes?: string;
    },
    {
      readonly reviewerId: string;
      readonly sufficientlyClear: boolean;
      readonly outcome: CaseSystemVNextStressRawOutcome;
      readonly normalizedOutcome: CaseSystemVNextExpertReviewCanonicalOutcome;
      readonly notes?: string;
    },
  ];
  readonly agreement: "agreement" | "disagreement" | "packet_ambiguity";
}

export interface CaseSystemVNextExpertReviewEvidence {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION;
  readonly protocolId: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID;
  readonly protocolVersion: typeof CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION;
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly strategyRegistryId: string;
  readonly strategyRegistryVersion: string;
  readonly pilotId: string;
  readonly pilotVersion: string;
  readonly taskSetFingerprint: string;
  readonly reviewerIds: readonly [string, string];
  readonly reviews: readonly CaseSystemVNextExpertReviewEvidenceItem[];
  readonly agreementCount: number;
  readonly disagreementCount: number;
  readonly packetAmbiguityCount: number;
  readonly interpretationBoundary: readonly string[];
}

export interface CaseSystemVNextExpertReviewExport {
  readonly manifest: CaseSystemVNextExpertReviewManifest;
  readonly packets: readonly [
    CaseSystemVNextExpertReviewPacket,
    CaseSystemVNextExpertReviewPacket,
  ];
  readonly templates: readonly [
    CaseSystemVNextExpertReviewSubmissionTemplate,
    CaseSystemVNextExpertReviewSubmissionTemplate,
  ];
}

const outcomes = new Set<CaseSystemVNextStressRawOutcome>([
  "A_BETTER",
  "B_BETTER",
  "EQUIVALENT",
  "NON_DOMINATED",
  "INSUFFICIENT_EVIDENCE",
]);
const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/u;

function invalid(): never {
  throw new Error("Case System vNext expert review data is invalid.");
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function reviewerId(value: string): string {
  if (!opaqueIdPattern.test(value) || value.includes("@")) invalid();
  return value;
}

function reviewTaskId(index: number): string {
  return `task-${String(index + 1).padStart(3, "0")}`;
}

function visibleTask(
  packet: CaseSystemVNextStressBlindPacket,
  id: string,
): CaseSystemVNextExpertReviewTask {
  return {
    reviewTaskId: id,
    domainId: packet.domainId,
    subdomain: packet.subdomain,
    practice: packet.practice,
    topic: packet.topic,
    learnerLevel: packet.learnerLevel,
    contentDepth: packet.contentDepth,
    pedagogicalDifficulty: packet.pedagogicalDifficulty,
    interactionHorizon: packet.interactionHorizon,
    coreTask: packet.coreTask,
    learnerState: packet.learnerState,
    teachingTarget: packet.teachingTarget,
    teachingObjective: packet.teachingObjective,
    teachingObjectiveProfile: packet.teachingObjectiveProfile,
    sharedBaseCriteria: packet.sharedBaseCriteria,
    strategyProfile: packet.strategyProfile,
    prerequisiteBoundary: packet.prerequisiteBoundary,
    referenceReasoning: packet.referenceReasoning,
    transfer: packet.transfer,
    comparisonInstruction: [
      "Compare only candidate A and candidate B against the task evidence in this packet.",
      "Choose exactly one outcome: A_BETTER, B_BETTER, EQUIVALENT, NON_DOMINATED, or INSUFFICIENT_EVIDENCE.",
      "Do not infer a preferred answer from task identifiers or external evaluator results.",
    ].join(" "),
    candidates: [
      { label: "A", responseText: packet.candidates[0].responseText },
      { label: "B", responseText: packet.candidates[1].responseText },
    ],
  };
}

function commonFingerprintInput(
  pilot: CaseSystemVNextPilot,
  suite: CaseSystemVNextStressFixtureSuite,
  registry: CaseSystemVNextStressStrategyRegistry,
): unknown {
  return {
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
    suiteId: suite.id,
    suiteVersion: suite.version,
    strategyRegistryId: registry.id,
    strategyRegistryVersion: registry.version,
    pilotId: pilot.id,
    pilotVersion: pilot.version,
    fixtures: [...suite.fixtures]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((fixture) => ({
        fixtureId: fixture.id,
        candidates: [...fixture.candidates]
          .map((candidate) => ({
            candidateId: candidate.id,
            responseText: candidate.responseText,
          }))
          .sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
      })),
  };
}

function packetFingerprintInput(
  packet: Omit<CaseSystemVNextExpertReviewPacket, "packetFingerprint">,
): unknown {
  return packet;
}

export function buildCaseSystemVNextExpertReviewExport(
  pilot: CaseSystemVNextPilot,
  suite: CaseSystemVNextStressFixtureSuite,
  registry: CaseSystemVNextStressStrategyRegistry,
  reviewerIdsInput: readonly [string, string],
): CaseSystemVNextExpertReviewExport {
  const reviewerIds: readonly [string, string] = [
    reviewerId(reviewerIdsInput[0]),
    reviewerId(reviewerIdsInput[1]),
  ];
  if (reviewerIds[0] === reviewerIds[1]) invalid();

  const orderedSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: [...suite.fixtures].sort((left, right) => left.id.localeCompare(right.id)),
  };
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    orderedSuite,
    registry,
    1,
  );
  const taskSetFingerprint = fingerprint(
    commonFingerprintInput(pilot, orderedSuite, registry),
  );

  const tasksByReviewer: [CaseSystemVNextExpertReviewTask[], CaseSystemVNextExpertReviewTask[]] =
    [[], []];
  const manifestTasks: CaseSystemVNextExpertReviewManifestTask[] = [];

  plan.fixtures.forEach((fixturePlan, index) => {
    const repetition = fixturePlan.repetitions[0];
    if (repetition === undefined) invalid();
    const first = repetition.presentations[0];
    const second = repetition.presentations[1];
    const id = reviewTaskId(index);
    tasksByReviewer[0].push(visibleTask(first.packet, id));
    tasksByReviewer[1].push(visibleTask(second.packet, id));
    manifestTasks.push({
      reviewTaskId: id,
      fixtureId: fixturePlan.fixtureId,
      assignments: [
        {
          reviewerId: reviewerIds[0],
          aCandidateId: first.assignment.aCandidateId,
          bCandidateId: first.assignment.bCandidateId,
        },
        {
          reviewerId: reviewerIds[1],
          aCandidateId: second.assignment.aCandidateId,
          bCandidateId: second.assignment.bCandidateId,
        },
      ],
    });
  });

  const packetFor = (
    index: 0 | 1,
  ): CaseSystemVNextExpertReviewPacket => {
    const withoutFingerprint = {
      schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
      protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
      protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
      suiteId: orderedSuite.id,
      suiteVersion: orderedSuite.version,
      strategyRegistryId: registry.id,
      strategyRegistryVersion: registry.version,
      pilotId: pilot.id,
      pilotVersion: pilot.version,
      reviewerId: reviewerIds[index],
      taskSetFingerprint,
      tasks: tasksByReviewer[index],
    } as const;
    return {
      ...withoutFingerprint,
      packetFingerprint: fingerprint(packetFingerprintInput(withoutFingerprint)),
    };
  };

  const packets = [packetFor(0), packetFor(1)] as const;
  const templates = packets.map((packet) => ({
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: "" as const,
      sufficientlyClear: "" as const,
    })),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmissionTemplate,
    CaseSystemVNextExpertReviewSubmissionTemplate,
  ];

  return {
    manifest: {
      schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
      protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
      protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
      suiteId: orderedSuite.id,
      suiteVersion: orderedSuite.version,
      strategyRegistryId: registry.id,
      strategyRegistryVersion: registry.version,
      pilotId: pilot.id,
      pilotVersion: pilot.version,
      reviewerIds,
      taskSetFingerprint,
      tasks: manifestTasks,
    },
    packets,
    templates,
  };
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

export function parseCaseSystemVNextExpertReviewSubmission(
  value: unknown,
  packet: CaseSystemVNextExpertReviewPacket,
): CaseSystemVNextExpertReviewSubmission {
  const record = asRecord(value);
  if (
    record === null ||
    !onlyKeys(record, [
      "schemaVersion",
      "protocolId",
      "protocolVersion",
      "reviewerId",
      "taskSetFingerprint",
      "packetFingerprint",
      "reviews",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION ||
    record.protocolId !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID ||
    record.protocolVersion !== CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION ||
    record.reviewerId !== packet.reviewerId ||
    record.taskSetFingerprint !== packet.taskSetFingerprint ||
    record.packetFingerprint !== packet.packetFingerprint ||
    !fingerprintPattern.test(String(record.taskSetFingerprint)) ||
    !fingerprintPattern.test(String(record.packetFingerprint)) ||
    !Array.isArray(record.reviews) ||
    record.reviews.length !== packet.tasks.length
  ) invalid();

  const expectedIds = new Set(packet.tasks.map((task) => task.reviewTaskId));
  const seen = new Set<string>();
  const reviews = record.reviews.map((value) => {
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
          item.notes.length > 2_000))
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
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews,
  };
}

function normalizeOutcome(
  outcome: CaseSystemVNextStressRawOutcome,
  assignment: CaseSystemVNextExpertReviewAssignment,
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

function sameOutcome(
  left: CaseSystemVNextExpertReviewCanonicalOutcome,
  right: CaseSystemVNextExpertReviewCanonicalOutcome,
): boolean {
  return left.kind === right.kind &&
    (left.kind !== "preference" ||
      (right.kind === "preference" && left.candidateId === right.candidateId));
}

export function mergeCaseSystemVNextExpertReviewSubmissions(
  exported: CaseSystemVNextExpertReviewExport,
  submissionsInput: readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ],
): CaseSystemVNextExpertReviewEvidence {
  const submissionsByReviewer = new Map(
    submissionsInput.map((submission) => [submission.reviewerId, submission]),
  );
  if (
    submissionsByReviewer.size !== 2 ||
    exported.manifest.reviewerIds.some((id) => !submissionsByReviewer.has(id))
  ) invalid();

  const packetByReviewer = new Map(
    exported.packets.map((packet) => [packet.reviewerId, packet]),
  );
  const submissions = exported.manifest.reviewerIds.map((id) => {
    const packet = packetByReviewer.get(id);
    const submission = submissionsByReviewer.get(id);
    if (packet === undefined || submission === undefined) invalid();
    return parseCaseSystemVNextExpertReviewSubmission(submission, packet);
  }) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];

  const reviews = exported.manifest.tasks.map((task) => {
    const reviewerResults = exported.manifest.reviewerIds.map((id, index) => {
      const submission = submissions[index];
      const assignment = task.assignments[index];
      if (
        submission === undefined ||
        assignment === undefined ||
        assignment.reviewerId !== id
      ) invalid();
      const review = submission.reviews.find(
        (candidate) => candidate.reviewTaskId === task.reviewTaskId,
      );
      if (review === undefined) invalid();
      return {
        reviewerId: id,
        sufficientlyClear: review.sufficientlyClear,
        outcome: review.outcome,
        normalizedOutcome: normalizeOutcome(review.outcome, assignment),
        ...(review.notes === undefined ? {} : { notes: review.notes }),
      };
    }) as unknown as CaseSystemVNextExpertReviewEvidenceItem["reviewerResults"];

    const agreement =
      reviewerResults.some((result) => !result.sufficientlyClear)
        ? "packet_ambiguity" as const
        : sameOutcome(
            reviewerResults[0].normalizedOutcome,
            reviewerResults[1].normalizedOutcome,
          )
          ? "agreement" as const
          : "disagreement" as const;

    return {
      reviewTaskId: task.reviewTaskId,
      fixtureId: task.fixtureId,
      reviewerResults,
      agreement,
    };
  });

  return {
    schemaVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EXPERT_REVIEW_PROTOCOL_VERSION,
    suiteId: exported.manifest.suiteId,
    suiteVersion: exported.manifest.suiteVersion,
    strategyRegistryId: exported.manifest.strategyRegistryId,
    strategyRegistryVersion: exported.manifest.strategyRegistryVersion,
    pilotId: exported.manifest.pilotId,
    pilotVersion: exported.manifest.pilotVersion,
    taskSetFingerprint: exported.manifest.taskSetFingerprint,
    reviewerIds: exported.manifest.reviewerIds,
    reviews,
    agreementCount: reviews.filter((review) => review.agreement === "agreement").length,
    disagreementCount: reviews.filter((review) => review.agreement === "disagreement").length,
    packetAmbiguityCount:
      reviews.filter((review) => review.agreement === "packet_ambiguity").length,
    interpretationBoundary: [
      "Independent reviewer agreement is human reference evidence, not infallible ground truth.",
      "Disagreement and packet ambiguity remain explicit and are not majority-voted away.",
      "No Judge/model quality ranking or learner-outcome claim is inferred.",
      "Developer-authored expectations are not included in reviewer packets or this merged evidence.",
    ],
  };
}
