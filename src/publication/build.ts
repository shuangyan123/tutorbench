import { join } from "node:path";

import type {
  PublicationApprovalManifest,
  PublicationBuildPaths,
  PublicEvidenceInspectionReport,
  PublicationIssue,
  PublicationOutputFiles,
  PublicationSourcePaths,
} from "./contracts.js";
import { PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION } from "./contracts.js";
import { PublicEvidencePublicationError } from "./errors.js";
import { readJsonDocument, writeJsonFile, writePublicationOutputDirectory } from "./io.js";
import {
  validatePublicEvidenceFiles,
  type ValidatedPublicationFiles,
} from "./public-validation.js";
import { sanitizePublication } from "./sanitizer.js";
import {
  publicationGateResults,
  toBenchmarkIdentity,
  toGenerationIdentity,
  toJudgeIdentity,
  toTutorIdentity,
  validatePublicationSources,
  type PublicationSourceContext,
  type PublicationSourceValidationResult,
} from "./source-validation.js";
import {
  parsePublicationApprovalManifest,
  validatePublicationApprovalManifest,
} from "./approval-validation.js";

function sortedIssues(issues: readonly PublicationIssue[]): PublicationIssue[] {
  return [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()]
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function readPublicationSources(paths: PublicationSourcePaths) {
  return Promise.all([
    readJsonDocument(paths.corpusPath),
    readJsonDocument(paths.evaluationPath),
  ]);
}

function inspectionFromValidation(
  validation: PublicationSourceValidationResult,
  corpusSha256: string,
  evaluationSha256: string,
): PublicEvidenceInspectionReport {
  const context = validation.context;
  const issues = sortedIssues(validation.issues);
  const evaluation = context?.evaluationArtifact.evaluation;
  const run = evaluation?.evaluation;
  const selection = evaluation?.evaluationSelection;
  const tutorIdentity = context === undefined ? undefined : toTutorIdentity(context);
  const judgeIdentity = context === undefined ? undefined : toJudgeIdentity(context);
  const coverage = context === undefined
    ? {
        expectedCaseCount: 0,
        expectedResponseCount: 0,
        selectedCaseCount: 0,
        selectedResponseCount: 0,
        caseRunCount: 0,
        errorCount: 0,
      }
    : {
        expectedCaseCount: context.dataset.cases.length,
        expectedResponseCount: context.dataset.cases.length * context.corpus.runsPerCase,
        selectedCaseCount: evaluation?.selectedCaseCount ?? 0,
        selectedResponseCount: selection?.selectedResponseCount ?? 0,
        caseRunCount: run?.caseRunCount ?? 0,
        errorCount: run?.errorCount ?? 0,
      };
  return {
    schemaVersion: PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION,
    eligibleForPreliminaryPublication: issues.length === 0,
    approvalRequired: true,
    sourceCorpusSha256: corpusSha256,
    sourceEvaluationSha256: evaluationSha256,
    ...(context === undefined ? {} : {
      benchmarkIdentity: toBenchmarkIdentity(context),
      corpusIdentity: {
        corpusId: context.corpus.corpusId,
        corpusVersion: context.corpus.corpusVersion,
        coverage: context.corpus.coverage,
        runsPerCase: context.corpus.runsPerCase,
        responseCount: context.corpus.responses.length,
        missingCaseCount: Math.max(
          0,
          context.dataset.cases.length -
            new Set(context.corpus.responses.map((response) => response.caseId)).size,
        ),
      },
      ...(tutorIdentity === undefined
        ? {}
        : { tutorIdentity }),
      generationIdentity: toGenerationIdentity(context),
      ...(judgeIdentity === undefined
        ? {}
        : { judgeIdentity }),
      evaluatorIdentity: {
        evaluatorVersion: context.evaluationArtifact.evaluation.evaluation.evaluatorVersion ?? "",
      },
    }),
    coverage,
    gates: publicationGateResults(issues),
    blockingIssues: issues,
  };
}

export async function inspectPublicationSources(
  paths: PublicationSourcePaths,
): Promise<PublicEvidenceInspectionReport> {
  const [corpusDocument, evaluationDocument] = await readPublicationSources(paths);
  const validation = await validatePublicationSources(corpusDocument, evaluationDocument);
  return inspectionFromValidation(
    validation,
    corpusDocument.sha256,
    evaluationDocument.sha256,
  );
}

async function loadApprovalManifest(path: string): Promise<PublicationApprovalManifest> {
  try {
    return parsePublicationApprovalManifest((await readJsonDocument(path)).value);
  } catch (error) {
    if (error instanceof PublicEvidencePublicationError) {
      throw error;
    }
    throw new PublicEvidencePublicationError([
      { code: "publication_approval_invalid" },
    ]);
  }
}

function requireValidSources(
  validation: PublicationSourceValidationResult,
): { readonly context: PublicationSourceContext } {
  const issues = sortedIssues(validation.issues);
  if (validation.context === undefined || issues.length > 0) {
    throw new PublicEvidencePublicationError(issues.length > 0
      ? issues
      : [{ code: "publication_source_invalid" }]);
  }
  return { context: validation.context };
}

export async function buildPublicEvidencePublication(
  paths: PublicationBuildPaths,
): Promise<PublicationOutputFiles> {
  const [corpusDocument, evaluationDocument] = await readPublicationSources(paths);
  const validation = await validatePublicationSources(corpusDocument, evaluationDocument);
  const { context } = requireValidSources(validation);
  const approval = await loadApprovalManifest(paths.approvalPath);
  const approvalIssues = validatePublicationApprovalManifest(
    approval,
    corpusDocument.sha256,
    evaluationDocument.sha256,
  );
  if (approvalIssues.length > 0) {
    throw new PublicEvidencePublicationError(approvalIssues);
  }
  const files = sanitizePublication(context, approval);
  validatePublicEvidenceFiles(files.publication, files.models, files.trials);
  await writePublicationOutputDirectory(paths.outputDirectory, files);
  return files;
}

async function readArtifact(path: string): Promise<unknown> {
  try {
    return (await readJsonDocument(path)).value;
  } catch {
    throw new PublicEvidencePublicationError([
      { code: "publication_artifact_invalid" },
    ]);
  }
}

export async function validatePublicEvidencePublicationDirectory(
  paths: {
    readonly publicationPath: string;
    readonly modelsPath: string;
    readonly trialsPath: string;
  },
): Promise<ValidatedPublicationFiles> {
  const [publication, models, trials] = await Promise.all([
    readArtifact(paths.publicationPath),
    readArtifact(paths.modelsPath),
    readArtifact(paths.trialsPath),
  ]);
  try {
    return validatePublicEvidenceFiles(publication, models, trials);
  } catch (error) {
    if (error instanceof PublicEvidencePublicationError) {
      throw error;
    }
    throw new PublicEvidencePublicationError([
      { code: "publication_artifact_invalid" },
    ]);
  }
}

export async function validatePublicEvidenceOutputDirectory(
  outputDirectory: string,
): Promise<ValidatedPublicationFiles> {
  return validatePublicEvidencePublicationDirectory({
    publicationPath: join(outputDirectory, "publication.json"),
    modelsPath: join(outputDirectory, "models.json"),
    trialsPath: join(outputDirectory, "trials.json"),
  });
}

export async function writeInspectionReport(
  outputPath: string,
  report: PublicEvidenceInspectionReport,
): Promise<void> {
  await writeJsonFile(outputPath, report);
}
