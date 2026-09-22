import type {
  TutorEvalCaseRunResult,
  TutorResponseCorpus,
} from "../contracts/index.js";
import { stableDigest } from "./fingerprint.js";
import {
  PUBLIC_EVIDENCE_CALIBRATION_STATUS,
  PUBLIC_EVIDENCE_JUDGE_STATUS,
  PUBLIC_EVIDENCE_LIMITATIONS,
  PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID,
  PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
  PUBLIC_EVIDENCE_PUBLICATION_STATUS,
  PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION,
  PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION,
  type PublicationApprovalManifest,
  type PublicationOutputFiles,
  type PublicEvidenceModelRecord,
  type PublicEvidencePublicationBundle,
  type PublicEvidenceRubricResult,
  type PublicEvidenceTokenUsage,
  type PublicEvidenceTrialRecord,
} from "./contracts.js";
import {
  toBenchmarkIdentity,
  toGenerationIdentity,
  toPublicJudgeDescriptor,
  toPublicTutorIdentity,
  type PublicationSourceContext,
} from "./source-validation.js";

function responseKey(caseId: string, runIndex: number): string {
  return `${caseId}\u0000${runIndex}`;
}

function deriveModelId(context: PublicationSourceContext): string {
  const identity = {
    provider: context.corpus.tutor.provider,
    model: context.corpus.tutor.model,
    modelVersion: context.corpus.tutor.modelVersion,
    datasetId: context.corpus.datasetId,
    datasetVersion: context.corpus.datasetVersion,
    evaluatorVersion: context.evaluationArtifact.evaluation.evaluation.evaluatorVersion,
    generation: toGenerationIdentity(context),
  };
  return `public-model-${stableDigest(identity).slice(0, 32)}`;
}

function deriveTrialId(
  modelId: string,
  caseId: string,
  caseVersion: string,
  runIndex: number,
  responseId: string,
): string {
  return `public-trial-${stableDigest({ modelId, caseId, caseVersion, runIndex, responseId }).slice(0, 32)}`;
}

function copyTokenUsage(
  value: { readonly inputTokens?: number; readonly outputTokens?: number; readonly totalTokens?: number } | null | undefined,
): PublicEvidenceTokenUsage | null {
  if (value === undefined || value === null) {
    return null;
  }
  return {
    ...(value.inputTokens === undefined ? {} : { inputTokens: value.inputTokens }),
    ...(value.outputTokens === undefined ? {} : { outputTokens: value.outputTokens }),
    ...(value.totalTokens === undefined ? {} : { totalTokens: value.totalTokens }),
  };
}

function publicRubricResults(
  result: TutorEvalCaseRunResult,
): readonly PublicEvidenceRubricResult[] {
  return [...result.rubricResults]
    .map((rubric) => ({
      category: rubric.category,
      result: rubric.result === "PASS" || rubric.result === "PARTIAL" || rubric.result === "FAIL"
        ? rubric.result
        : "FAIL",
      score: rubric.score as number,
      critical: rubric.critical,
    }))
    .sort((left, right) =>
      `${left.category}\u0000${left.result}\u0000${left.score}\u0000${left.critical}`.localeCompare(
        `${right.category}\u0000${right.result}\u0000${right.score}\u0000${right.critical}`,
      ),
    );
}

function publicCriticalFailures(
  result: TutorEvalCaseRunResult,
) {
  return [...result.criticalFailures]
    .map((failure) => ({ type: failure.type, severity: failure.severity }))
    .sort((left, right) =>
      `${left.type}\u0000${left.severity}`.localeCompare(`${right.type}\u0000${right.severity}`),
    );
}

function publicMetricNumber(
  evaluated: number | null,
  corpus: number | undefined,
): number | null {
  return evaluated ?? corpus ?? null;
}

function publicMetrics(
  result: TutorEvalCaseRunResult,
  response: TutorResponseCorpus["responses"][number],
) {
  return {
    latencyMs: publicMetricNumber(result.latencyMs, response.metrics?.latencyMs),
    tokenUsage: copyTokenUsage(result.tokenUsage ?? response.metrics?.tokenUsage),
    cost: publicMetricNumber(result.cost, response.metrics?.cost),
  } as const;
}

function buildTrial(
  context: PublicationSourceContext,
  modelId: string,
  result: TutorEvalCaseRunResult,
  response: TutorResponseCorpus["responses"][number],
): PublicEvidenceTrialRecord {
  const metrics = publicMetrics(result, response);
  const judge = toPublicJudgeDescriptor(
    context.evaluationArtifact.evaluation.evaluation.judge,
  );
  if (judge === undefined || result.overallScore === null) {
    throw new Error("Publication source validation must run before sanitization.");
  }
  return {
    id: deriveTrialId(modelId, result.caseId, result.caseVersion, result.runIndex, response.responseId),
    modelId,
    caseId: result.caseId,
    caseVersion: result.caseVersion,
    runIndex: result.runIndex,
    responseId: response.responseId,
    tutorResponse: response.responseText,
    status: result.status === "passed" ? "passed" : "failed",
    passed: result.passed,
    qualityGate: result.qualityGate,
    overallScore: result.overallScore,
    correctness: result.categoryScores.correctness,
    diagnosis: result.categoryScores.diagnosis,
    guidance: result.categoryScores.guidance,
    adaptation: result.categoryScores.adaptation,
    actionability: result.categoryScores.actionability,
    rubricResults: publicRubricResults(result),
    criticalFailures: publicCriticalFailures(result),
    answerLeakage: result.answerLeakage,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    judge,
    latencyMs: metrics.latencyMs,
    tokenUsage: metrics.tokenUsage,
    cost: metrics.cost,
  };
}

function buildModel(
  context: PublicationSourceContext,
  modelId: string,
  trialCount: number,
): PublicEvidenceModelRecord {
  const tutor = toPublicTutorIdentity(context.corpus.tutor);
  const evaluation = context.evaluationArtifact.evaluation.evaluation;
  if (tutor === undefined || evaluation.overallScore === null) {
    throw new Error("Publication source validation must run before sanitization.");
  }
  const generation = toGenerationIdentity(context);
  return {
    id: modelId,
    provider: tutor.provider,
    model: tutor.model,
    modelVersion: tutor.modelVersion,
    evidenceStatus: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    datasetId: context.corpus.datasetId,
    datasetVersion: context.corpus.datasetVersion,
    evaluatorVersion: evaluation.evaluatorVersion as string,
    ...generation,
    runs: context.corpus.runsPerCase,
    caseCount: context.dataset.cases.length,
    trialCount,
    overallScore: evaluation.overallScore,
    correctness: evaluation.categoryScores.correctness as number,
    diagnosis: evaluation.categoryScores.diagnosis as number,
    guidance: evaluation.categoryScores.guidance as number,
    adaptation: evaluation.categoryScores.adaptation as number,
    actionability: evaluation.categoryScores.actionability as number,
    criticalFailureRate: evaluation.criticalFailureRate,
    answerLeakageRate: evaluation.answerLeakageRate,
  };
}

export function sanitizePublication(
  context: PublicationSourceContext,
  approval: PublicationApprovalManifest,
): PublicationOutputFiles {
  const modelId = deriveModelId(context);
  const responseByKey = new Map(
    context.corpus.responses.map((response) => [
      responseKey(response.caseId, response.runIndex),
      response,
    ]),
  );
  const results = [...context.evaluationArtifact.evaluation.evaluation.caseResults]
    .sort((left, right) =>
      `${left.caseId}\u0000${left.runIndex}`.localeCompare(`${right.caseId}\u0000${right.runIndex}`),
    );
  const trials = results.map((result) => {
    const response = responseByKey.get(responseKey(result.caseId, result.runIndex));
    if (response === undefined) {
      throw new Error("Publication source validation must run before sanitization.");
    }
    return buildTrial(context, modelId, result, response);
  });
  const model = buildModel(context, modelId, trials.length);
  const acknowledgements = {
    uncalibrated: true,
    judgeIsNotGroundTruth: true,
    noLearningOutcomeClaim: true,
    sourceIdentityReviewed: true,
    publicSanitizationReviewed: true,
  } as const;
  const publication: PublicEvidencePublicationBundle = {
    schemaVersion: PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION,
    publicationId: approval.publicationId,
    publicationVersion: approval.publicationVersion,
    policyId: PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID,
    policyVersion: PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION,
    scope: PUBLIC_EVIDENCE_PUBLICATION_SCOPE,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    acknowledgements,
    limitations: PUBLIC_EVIDENCE_LIMITATIONS,
    sourceIdentity: {
      sourceCorpusSha256: context.sourceCorpusSha256,
      sourceEvaluationSha256: context.sourceEvaluationSha256,
    },
    benchmarkIdentity: toBenchmarkIdentity(context),
    generationIdentity: toGenerationIdentity(context),
    model,
    trials,
  };
  const models = {
    schemaVersion: PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "public-model-evidence" as const,
    publicationId: publication.publicationId,
    publicationVersion: publication.publicationVersion,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false as const,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    entries: [model] as [PublicEvidenceModelRecord],
  };
  const trialsArtifact = {
    schemaVersion: PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "public-trial-evidence" as const,
    publicationId: publication.publicationId,
    publicationVersion: publication.publicationVersion,
    status: PUBLIC_EVIDENCE_PUBLICATION_STATUS,
    calibrationStatus: PUBLIC_EVIDENCE_CALIBRATION_STATUS,
    publicLeaderboardEligible: false as const,
    judgeEvidenceStatus: PUBLIC_EVIDENCE_JUDGE_STATUS,
    entries: trials,
  };
  return { publication, models, trials: trialsArtifact };
}
