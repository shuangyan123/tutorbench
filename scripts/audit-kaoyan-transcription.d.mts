export interface KaoyanTranscriptionAudit {
  status: 'blocked_for_gold' | 'requires_independent_math_and_pdf_review';
  scope: string;
  source: {
    repository: string;
    revision: string;
    path: string;
    expectedGitBlobSha: string;
    actualGitBlobSha: string;
    sourceMatched: boolean;
  };
  summary: {
    expectedChoiceQuestions: number;
    foundChoiceQuestions: number;
    findings: number;
    blockedChoiceQuestions: number;
  };
  findings: Array<{
    question: number | null;
    code: string;
    details: string;
    sourceLine: number | null;
    origin: string;
  }>;
}
export function gitBlobSha(content: string): string;
export function auditTranscription(markdown: string, manifest: {
  id: string;
  gitBlobSha: string;
  repository?: string;
  revision?: string;
  path?: string;
  manualChecks?: Array<{ question: number; needle: string; code: string; details: string; pdfPage: number }>;
}): KaoyanTranscriptionAudit;
