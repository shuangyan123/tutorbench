import { isSha256Fingerprint } from "./fingerprint.js";
import { PublicEvidencePublicationError } from "./errors.js";
import {
  PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS,
  PUBLIC_EVIDENCE_APPROVAL_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
  type PublicationApprovalManifest,
  type PublicationIssue,
} from "./contracts.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function nonEmptyIdentifier(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 200 &&
    !/[\s|]/u.test(value);
}

export function parsePublicationApprovalManifest(
  value: unknown,
): PublicationApprovalManifest {
  const record = asRecord(value);
  const acknowledgements = asRecord(record?.acknowledgements);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "publicationId",
      "publicationVersion",
      "scope",
      "sourceCorpusSha256",
      "sourceEvaluationSha256",
      "publicLeaderboardEligible",
      "acknowledgements",
    ]) ||
    record.schemaVersion !== PUBLIC_EVIDENCE_APPROVAL_SCHEMA_VERSION ||
    !nonEmptyIdentifier(record.publicationId) ||
    !nonEmptyIdentifier(record.publicationVersion) ||
    record.scope !== PUBLIC_EVIDENCE_PUBLICATION_SCOPE ||
    !isSha256Fingerprint(record.sourceCorpusSha256) ||
    !isSha256Fingerprint(record.sourceEvaluationSha256) ||
    typeof record.publicLeaderboardEligible !== "boolean" ||
    acknowledgements === null ||
    !hasOnlyKeys(acknowledgements, PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS) ||
    PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS.some(
      (key) => typeof acknowledgements[key] !== "boolean",
    )
  ) {
    throw new PublicEvidencePublicationError([
      { code: "publication_approval_invalid" },
    ]);
  }
  return {
    schemaVersion: PUBLIC_EVIDENCE_APPROVAL_SCHEMA_VERSION,
    publicationId: record.publicationId,
    publicationVersion: record.publicationVersion,
    scope: PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
    sourceCorpusSha256: record.sourceCorpusSha256,
    sourceEvaluationSha256: record.sourceEvaluationSha256,
    publicLeaderboardEligible: record.publicLeaderboardEligible,
    acknowledgements: Object.fromEntries(
      PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS.map((key) => [key, acknowledgements[key]]),
    ) as PublicationApprovalManifest["acknowledgements"],
  };
}

export function validatePublicationApprovalManifest(
  manifest: PublicationApprovalManifest,
  sourceCorpusSha256: string,
  sourceEvaluationSha256: string,
): readonly PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  if (manifest.publicLeaderboardEligible) {
    issues.push({ code: "publication_leaderboard_forbidden" });
  }
  if (
    manifest.sourceCorpusSha256 !== sourceCorpusSha256 ||
    manifest.sourceEvaluationSha256 !== sourceEvaluationSha256
  ) {
    issues.push({ code: "publication_source_hash_mismatch" });
  }
  if (PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS.some(
    (key) => manifest.acknowledgements[key] !== true,
  )) {
    issues.push({ code: "publication_approval_invalid" });
  }
  return issues;
}
