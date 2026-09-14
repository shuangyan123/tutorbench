import { createHash } from "node:crypto";

import {
  CALIBRATION_CONTRACT_SCHEMA_VERSION,
  type CalibrationAnnotationDataKind,
  type CalibrationAnnotationFile,
  type CalibrationCandidateDataKind,
  type CalibrationCandidateResponseFile,
  type CalibrationLabel,
  type CalibrationPacket,
  type SyntheticFixtureMarker,
} from "../contracts/calibration.js";
import {
  parseCalibrationAnnotationFile,
  parseCalibrationCandidateResponseFile,
} from "../contracts/calibration-validation.js";
import { BenchmarkConfigurationError } from "../contracts/errors.js";
import { TUTOR_EVAL_DATASET_ID } from "../contracts/tutor-eval.js";
import { loadTutorEvalDataset } from "../datasets/index.js";
import {
  buildCanonicalCalibrationPilotBundle,
  CANONICAL_CALIBRATION_PILOT_ANNOTATION_GUIDE,
  CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
  CANONICAL_CALIBRATION_PILOT_GUIDE_ID,
  CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION,
  CANONICAL_CALIBRATION_PILOT_REVIEWER_INSTRUCTIONS,
} from "./canonical-pilot.js";
import { buildCalibrationPacket } from "./packet.js";

export const ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID =
  "english-only-tutoreval-human-reference-pilot-001" as const;
export const ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION = "0.1.0" as const;
export const ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_SUBMISSION_KIND =
  "english-only-tutoreval-human-reference-pilot-submission" as const;

interface EnglishOnlyPilotCaseSpec {
  readonly caseId: string;
  readonly caseVersion: string;
}

export const ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_CASES: readonly EnglishOnlyPilotCaseSpec[] =
  Object.freeze([
    { caseId: "fraction-misconception-001", caseVersion: "1.2.0" },
    { caseId: "correct-answer-wrong-reasoning-001", caseVersion: "1.1.0" },
    { caseId: "science-force-transfer-001", caseVersion: "1.0.0" },
    { caseId: "science-density-knowledge-001", caseVersion: "1.0.0" },
    { caseId: "language-verb-check-001", caseVersion: "1.0.1" },
    { caseId: "language-word-context-001", caseVersion: "1.1.1" },
    { caseId: "history-source-bias-001", caseVersion: "1.0.0" },
    { caseId: "programming-function-recall-001", caseVersion: "1.0.0" },
  ]);

export const ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_EXCLUDED_CASE = Object.freeze({
  caseId: "fraction-misconception-001-zh-CN",
  caseVersion: "1.2.0",
});

export interface EnglishOnlyHumanReferencePilotManifestCase {
  readonly caseId: string;
  readonly caseVersion: string;
  readonly locale: string;
  readonly subject: string;
  readonly disclosurePolicy: string;
  readonly rubricCount: number;
}

export interface EnglishOnlyHumanReferencePilotManifest {
  readonly schemaVersion: 1;
  readonly pilotId: typeof ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID;
  readonly pilotVersion: typeof ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION;
  readonly datasetId: typeof TUTOR_EVAL_DATASET_ID;
  readonly datasetVersion: typeof CANONICAL_CALIBRATION_PILOT_DATASET_VERSION;
  readonly annotationGuideId: typeof CANONICAL_CALIBRATION_PILOT_GUIDE_ID;
  readonly annotationGuideVersion: typeof CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION;
  readonly annotationGuideFingerprint: string;
  readonly taskSetFingerprint: string;
  readonly stimulusProvenance: "developer-authored-synthetic";
  readonly humanCalibrationDataPresent: false;
  readonly caseCount: 8;
  readonly responseCount: 24;
  readonly rubricJudgmentCountPerReviewer: number;
  readonly reviewerCount: 2;
  readonly selectedCases: readonly EnglishOnlyHumanReferencePilotManifestCase[];
}

export interface EnglishOnlyHumanReferencePilotSubmissionSlot {
  readonly entryId: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly responseId: string;
  readonly rubricId: string;
  readonly label: "" | CalibrationLabel;
  readonly evidence: string;
  readonly ambiguity: {
    readonly present: boolean;
    readonly reason: string;
  };
}

export interface EnglishOnlyHumanReferencePilotSubmissionTemplate {
  readonly schemaVersion: 1;
  readonly kind: typeof ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_SUBMISSION_KIND;
  readonly pilotId: typeof ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID;
  readonly pilotVersion: typeof ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION;
  readonly datasetId: typeof TUTOR_EVAL_DATASET_ID;
  readonly datasetVersion: typeof CANONICAL_CALIBRATION_PILOT_DATASET_VERSION;
  readonly taskSetFingerprint: string;
  readonly annotationGuideId: typeof CANONICAL_CALIBRATION_PILOT_GUIDE_ID;
  readonly annotationGuideVersion: typeof CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION;
  readonly annotationGuideFingerprint: string;
  readonly reviewerId: string;
  readonly dataKind: CalibrationAnnotationDataKind;
  readonly fixture?: SyntheticFixtureMarker;
  readonly completedAt: string;
  readonly annotations: readonly EnglishOnlyHumanReferencePilotSubmissionSlot[];
}

export interface EnglishOnlyHumanReferencePilotBundle {
  readonly manifest: EnglishOnlyHumanReferencePilotManifest;
  readonly candidates: CalibrationCandidateResponseFile;
  readonly packet: CalibrationPacket;
  readonly templates: readonly EnglishOnlyHumanReferencePilotSubmissionTemplate[];
  readonly annotationGuide: typeof CANONICAL_CALIBRATION_PILOT_ANNOTATION_GUIDE;
  readonly reviewerInstructions: typeof CANONICAL_CALIBRATION_PILOT_REVIEWER_INSTRUCTIONS;
}

type UnknownRecord = Record<string, unknown>;

const syntheticFixture: SyntheticFixtureMarker = Object.freeze({
  synthetic: true,
  notHumanCalibrationData: true,
});

function invalid(
  code: "calibration_data_invalid" | "calibration_annotation_invalid" = "calibration_data_invalid",
): never {
  throw new BenchmarkConfigurationError(code);
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function opaqueReviewerId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value) &&
    !value.includes("@");
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(Date.parse(value));
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function fingerprintJson(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(stableSerialize(value), "utf8")
    .digest("hex")}`;
}

function fingerprintText(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function candidateDataKindForAnnotationKind(
  dataKind: CalibrationAnnotationDataKind,
): CalibrationCandidateDataKind {
  return dataKind === "synthetic-fixture" ? "synthetic-fixture" : "candidate-corpus";
}

async function buildCore(
  annotationDataKind: CalibrationAnnotationDataKind,
): Promise<{
  readonly manifest: EnglishOnlyHumanReferencePilotManifest;
  readonly candidates: CalibrationCandidateResponseFile;
  readonly packet: CalibrationPacket;
}> {
  const source = await buildCanonicalCalibrationPilotBundle(
    ["english-only-source-a", "english-only-source-b"],
    annotationDataKind,
  );
  if (
    source.manifest.datasetId !== TUTOR_EVAL_DATASET_ID ||
    source.manifest.datasetVersion !== CANONICAL_CALIBRATION_PILOT_DATASET_VERSION ||
    source.manifest.caseCount !== 9 ||
    source.manifest.responseCount !== 27
  ) {
    return invalid();
  }

  const dataset = await loadTutorEvalDataset(
    TUTOR_EVAL_DATASET_ID,
    CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
  );
  if (
    dataset.id !== TUTOR_EVAL_DATASET_ID ||
    dataset.version !== CANONICAL_CALIBRATION_PILOT_DATASET_VERSION
  ) {
    return invalid();
  }

  const selectedCases = ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_CASES.map((expected) => {
    const caseValue = dataset.cases.find((candidate) => candidate.id === expected.caseId);
    if (
      caseValue === undefined ||
      caseValue.version !== expected.caseVersion ||
      (caseValue.locale ?? "en") !== "en"
    ) {
      return invalid();
    }
    return caseValue;
  });
  if (new Set(selectedCases.map((caseValue) => caseValue.id)).size !== 8) {
    return invalid();
  }

  const excluded = dataset.cases.find(
    (caseValue) => caseValue.id === ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_EXCLUDED_CASE.caseId,
  );
  if (
    excluded === undefined ||
    excluded.version !== ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_EXCLUDED_CASE.caseVersion
  ) {
    return invalid();
  }

  const selectedIds = new Set(selectedCases.map((caseValue) => caseValue.id));
  const selectedResponses = source.candidates.responses.filter((response) =>
    selectedIds.has(response.caseId),
  );
  if (
    selectedResponses.length !== 24 ||
    ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_CASES.some((caseSpec) =>
      selectedResponses.filter((response) => response.caseId === caseSpec.caseId).length !== 3,
    ) ||
    selectedResponses.some((response) => response.caseId === excluded.id)
  ) {
    return invalid();
  }

  const candidateDataKind = candidateDataKindForAnnotationKind(annotationDataKind);
  if (source.candidates.dataKind !== candidateDataKind) {
    return invalid();
  }
  const candidates = parseCalibrationCandidateResponseFile({
    ...source.candidates,
    responses: selectedResponses,
  });
  const packet = buildCalibrationPacket(dataset, candidates);

  const sourceSelectedEntryIds = source.packet.entries
    .filter((entry) => selectedIds.has(entry.caseId))
    .map((entry) => entry.entryId);
  const actualEntryIds = packet.entries.map((entry) => entry.entryId);
  if (
    packet.entries.length === 0 ||
    packet.entries.some((entry) => !selectedIds.has(entry.caseId)) ||
    packet.entries.some((entry) => entry.caseId === excluded.id) ||
    !sameJson(actualEntryIds, sourceSelectedEntryIds)
  ) {
    return invalid();
  }

  const annotationGuideFingerprint = fingerprintText(
    CANONICAL_CALIBRATION_PILOT_ANNOTATION_GUIDE,
  );
  if (annotationGuideFingerprint !== source.manifest.annotationGuideFingerprint) {
    return invalid();
  }

  const selectedCaseManifest = selectedCases.map((caseValue) => ({
    caseId: caseValue.id,
    caseVersion: caseValue.version,
    locale: caseValue.locale ?? "en",
    subject: caseValue.metadata.subject,
    disclosurePolicy: caseValue.evaluatorOnly.disclosurePolicy,
    rubricCount: caseValue.evaluatorOnly.rubrics.length,
  }));
  const normalizedResponses = [...selectedResponses]
    .sort((left, right) => left.responseId.localeCompare(right.responseId))
    .map((response) => ({
      responseId: response.responseId,
      caseId: response.caseId,
      caseVersion: response.caseVersion,
      responseText: response.responseText,
    }));
  const normalizedEntries = [...packet.entries].sort((left, right) =>
    left.entryId.localeCompare(right.entryId),
  );
  const taskSetFingerprint = fingerprintJson({
    pilotId: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID,
    pilotVersion: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION,
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
    annotationGuideId: CANONICAL_CALIBRATION_PILOT_GUIDE_ID,
    annotationGuideVersion: CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION,
    annotationGuideFingerprint,
    selectedCases: selectedCaseManifest,
    responses: normalizedResponses,
    entries: normalizedEntries,
  });

  const manifest: EnglishOnlyHumanReferencePilotManifest = {
    schemaVersion: 1,
    pilotId: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID,
    pilotVersion: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION,
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
    annotationGuideId: CANONICAL_CALIBRATION_PILOT_GUIDE_ID,
    annotationGuideVersion: CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION,
    annotationGuideFingerprint,
    taskSetFingerprint,
    stimulusProvenance: "developer-authored-synthetic",
    humanCalibrationDataPresent: false,
    caseCount: 8,
    responseCount: 24,
    rubricJudgmentCountPerReviewer: packet.entries.length,
    reviewerCount: 2,
    selectedCases: selectedCaseManifest,
  };
  return { manifest, candidates, packet };
}

function buildTemplate(
  manifest: EnglishOnlyHumanReferencePilotManifest,
  packet: CalibrationPacket,
  reviewerId: string,
  dataKind: CalibrationAnnotationDataKind,
): EnglishOnlyHumanReferencePilotSubmissionTemplate {
  if (!opaqueReviewerId(reviewerId)) {
    return invalid();
  }
  return {
    schemaVersion: 1,
    kind: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_SUBMISSION_KIND,
    pilotId: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID,
    pilotVersion: ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION,
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
    taskSetFingerprint: manifest.taskSetFingerprint,
    annotationGuideId: CANONICAL_CALIBRATION_PILOT_GUIDE_ID,
    annotationGuideVersion: CANONICAL_CALIBRATION_PILOT_GUIDE_VERSION,
    annotationGuideFingerprint: manifest.annotationGuideFingerprint,
    reviewerId,
    dataKind,
    ...(dataKind === "synthetic-fixture" ? { fixture: syntheticFixture } : {}),
    completedAt: "",
    annotations: packet.entries.map((entry) => ({
      entryId: entry.entryId,
      caseId: entry.caseId,
      caseVersion: entry.caseVersion,
      responseId: entry.responseId,
      rubricId: entry.rubric.rubricId,
      label: "" as const,
      evidence: "",
      ambiguity: {
        present: false,
        reason: "",
      },
    })),
  };
}

export async function buildEnglishOnlyHumanReferencePilotBundle(
  reviewerIds: readonly string[],
  annotationDataKind: CalibrationAnnotationDataKind = "human-annotation",
): Promise<EnglishOnlyHumanReferencePilotBundle> {
  if (
    reviewerIds.length !== 2 ||
    new Set(reviewerIds).size !== 2 ||
    reviewerIds.some((reviewerId) => !opaqueReviewerId(reviewerId))
  ) {
    return invalid();
  }
  const core = await buildCore(annotationDataKind);
  return {
    ...core,
    templates: reviewerIds.map((reviewerId) =>
      buildTemplate(core.manifest, core.packet, reviewerId, annotationDataKind),
    ),
    annotationGuide: CANONICAL_CALIBRATION_PILOT_ANNOTATION_GUIDE,
    reviewerInstructions: CANONICAL_CALIBRATION_PILOT_REVIEWER_INSTRUCTIONS,
  };
}

function immutableTemplateFieldsMatch(
  expected: EnglishOnlyHumanReferencePilotSubmissionTemplate,
  submission: UnknownRecord,
): boolean {
  const immutableKeys = [
    "schemaVersion",
    "kind",
    "pilotId",
    "pilotVersion",
    "datasetId",
    "datasetVersion",
    "taskSetFingerprint",
    "annotationGuideId",
    "annotationGuideVersion",
    "annotationGuideFingerprint",
    "reviewerId",
    "dataKind",
  ] as const;
  if (immutableKeys.some((key) => submission[key] !== expected[key])) {
    return false;
  }
  if (expected.fixture === undefined) {
    return submission.fixture === undefined;
  }
  return sameJson(submission.fixture, expected.fixture);
}

function exactKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export async function importEnglishOnlyHumanReferencePilotSubmission(
  templateValue: unknown,
  submissionValue: unknown,
): Promise<CalibrationAnnotationFile> {
  const templateRecord = asRecord(templateValue);
  if (templateRecord === null || !opaqueReviewerId(templateRecord.reviewerId)) {
    return invalid("calibration_annotation_invalid");
  }
  const dataKind = templateRecord.dataKind;
  if (dataKind !== "human-annotation" && dataKind !== "synthetic-fixture") {
    return invalid("calibration_annotation_invalid");
  }
  const validationPeer = templateRecord.reviewerId === "english-only-validation-peer"
    ? "english-only-validation-peer-2"
    : "english-only-validation-peer";
  const bundle = await buildEnglishOnlyHumanReferencePilotBundle(
    [templateRecord.reviewerId, validationPeer],
    dataKind,
  );
  const expectedTemplate = bundle.templates[0];
  if (expectedTemplate === undefined || !sameJson(templateValue, expectedTemplate)) {
    return invalid("calibration_annotation_invalid");
  }

  const submission = asRecord(submissionValue);
  if (
    submission === null ||
    !exactKeys(
      submission,
      expectedTemplate.fixture === undefined
        ? [
            "schemaVersion",
            "kind",
            "pilotId",
            "pilotVersion",
            "datasetId",
            "datasetVersion",
            "taskSetFingerprint",
            "annotationGuideId",
            "annotationGuideVersion",
            "annotationGuideFingerprint",
            "reviewerId",
            "dataKind",
            "completedAt",
            "annotations",
          ]
        : [
            "schemaVersion",
            "kind",
            "pilotId",
            "pilotVersion",
            "datasetId",
            "datasetVersion",
            "taskSetFingerprint",
            "annotationGuideId",
            "annotationGuideVersion",
            "annotationGuideFingerprint",
            "reviewerId",
            "dataKind",
            "fixture",
            "completedAt",
            "annotations",
          ],
    ) ||
    !immutableTemplateFieldsMatch(expectedTemplate, submission) ||
    !validTimestamp(submission.completedAt) ||
    !Array.isArray(submission.annotations) ||
    submission.annotations.length !== expectedTemplate.annotations.length
  ) {
    return invalid("calibration_annotation_invalid");
  }

  const labels = new Set<CalibrationLabel>(["PASS", "PARTIAL", "FAIL", "UNSURE"]);
  const completedAt = submission.completedAt;
  const annotations = submission.annotations.map((value, index) => {
    const slot = asRecord(value);
    const expectedSlot = expectedTemplate.annotations[index];
    if (
      slot === null ||
      expectedSlot === undefined ||
      !exactKeys(slot, [
        "entryId",
        "caseId",
        "caseVersion",
        "responseId",
        "rubricId",
        "label",
        "evidence",
        "ambiguity",
      ]) ||
      slot.entryId !== expectedSlot.entryId ||
      slot.caseId !== expectedSlot.caseId ||
      slot.caseVersion !== expectedSlot.caseVersion ||
      slot.responseId !== expectedSlot.responseId ||
      slot.rubricId !== expectedSlot.rubricId ||
      !labels.has(slot.label as CalibrationLabel) ||
      typeof slot.evidence !== "string" ||
      slot.evidence.length > 500
    ) {
      return invalid("calibration_annotation_invalid");
    }
    const ambiguity = asRecord(slot.ambiguity);
    if (
      ambiguity === null ||
      !exactKeys(ambiguity, ["present", "reason"]) ||
      typeof ambiguity.present !== "boolean" ||
      typeof ambiguity.reason !== "string" ||
      ambiguity.reason.length > 500 ||
      (ambiguity.present && ambiguity.reason.trim().length === 0) ||
      (!ambiguity.present && ambiguity.reason.length !== 0) ||
      (slot.label === "UNSURE" && ambiguity.present !== true)
    ) {
      return invalid("calibration_annotation_invalid");
    }
    const evidence = slot.evidence.trim();
    const reason = ambiguity.reason.trim();
    return {
      schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
      annotationId: `${ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID}-${templateRecord.reviewerId}-${String(index + 1).padStart(3, "0")}`,
      datasetId: TUTOR_EVAL_DATASET_ID,
      datasetVersion: CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
      caseId: expectedSlot.caseId,
      caseVersion: expectedSlot.caseVersion,
      responseId: expectedSlot.responseId,
      rubricId: expectedSlot.rubricId,
      reviewerId: templateRecord.reviewerId,
      label: slot.label as CalibrationLabel,
      ...(evidence.length === 0 ? {} : { evidence }),
      ...(ambiguity.present
        ? { ambiguity: { present: true as const, reason } }
        : {}),
      createdAt: completedAt,
    };
  });

  return parseCalibrationAnnotationFile({
    schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
    dataKind,
    ...(dataKind === "synthetic-fixture" ? { fixture: syntheticFixture } : {}),
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: CANONICAL_CALIBRATION_PILOT_DATASET_VERSION,
    reviewerId: templateRecord.reviewerId,
    annotations,
  });
}
