import type { PublicationIssue, PublicationIssueCode } from "./contracts.js";

export class PublicEvidencePublicationError extends Error {
  readonly code: PublicationIssueCode;
  readonly issues: readonly PublicationIssue[];

  constructor(issues: readonly PublicationIssue[]) {
    const normalized = [...issues];
    const firstCode = normalized[0]?.code ?? "publication_output_invalid";
    super(`Public evidence publication validation failed: ${firstCode}.`);
    this.name = "PublicEvidencePublicationError";
    this.code = firstCode;
    this.issues = normalized;
  }
}

export function throwPublicationIssues(
  issues: readonly PublicationIssue[],
): never {
  throw new PublicEvidencePublicationError(issues);
}
