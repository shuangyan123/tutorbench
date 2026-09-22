import type {
  TutorEvalCategory,
  TutorEvalJudgeDescriptor,
  TutorGenerationSpec,
} from "../contracts/index.js";

export const PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION = 1 as const;
export const PUBLIC_EVIDENCE_APPROVAL_SCHEMA_VERSION = 1 as const;
export const PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION = 1 as const;
export const PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION = 1 as const;

export const PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID =
  "public-evidence-publication" as const;
export const PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION = "1" as const;
export const PUBLIC_EVIDENCE_PUBLICATION_SCOPE =
  "preliminary-model-evidence" as const;
export const PUBLIC_EVIDENCE_PUBLICATION_STATUS = "preliminary" as const;
export const PUBLIC_EVIDENCE_CALIBRATION_STATUS = "uncalibrated" as const;
export const PUBLIC_EVIDENCE_JUDGE_STATUS = "preliminary" as const;

export const PUBLIC_EVIDENCE_LIMITATIONS = [
  "This preliminary evidence is not scientifically calibrated.",
  "Judge evidence is not human ground truth.",
  "This publication does not establish long-term learning, retention, transfer, satisfaction, classroom effectiveness, teacher replacement, or general model intelligence.",
  "This publication is not eligible for an official leaderboard.",
] as const;

export const PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS = [
  "uncalibrated",
  "judgeIsNotGroundTruth",
  "noLearningOutcomeClaim",
  "sourceIdentityReviewed",
  "publicSanitizationReviewed",
] as const;

export type PublicEvidenceAcknowledgementKey =
  (typeof PUBLIC_EVIDENCE_ACKNOWLEDGEMENT_KEYS)[number];

export type PublicationIssueCode =
  | "publication_source_invalid"
  | "publication_provenance_not_recorded_model"
  | "publication_generation_spec_invalid"
  | "publication_generation_profile_mismatch"
  | "publication_dataset_not_current"
  | "publication_coverage_incomplete"
  | "publication_model_identity_missing"
  | "publication_model_version_missing"
  | "publication_evaluation_subset"
  | "publication_identity_mismatch"
  | "publication_response_mismatch"
  | "publication_missing_case_run"
  | "publication_extra_case_run"
  | "publication_evaluator_version_mismatch"
  | "publication_semantic_replay_forbidden"
  | "publication_judge_missing"
  | "publication_evaluation_error"
  | "publication_score_unresolved"
  | "publication_metric_mismatch"
  | "publication_source_metadata_invalid"
  | "publication_source_hash_mismatch"
  | "publication_approval_invalid"
  | "publication_leaderboard_forbidden"
  | "publication_private_field"
  | "publication_output_exists"
  | "publication_output_invalid"
  | "publication_artifact_invalid"
  | "publication_id_invalid";

export interface PublicationIssue {
  readonly code: PublicationIssueCode;
  readonly caseId?: string;
  readonly runIndex?: number;
  readonly field?: string;
}

export interface PublicationGateResult {
  readonly code: PublicationIssueCode;
  readonly passed: boolean;
}

export interface PublicationApprovalManifest {
  readonly schemaVersion: typeof PUBLIC_EVIDENCE_APPROVAL_SCHEMA_VERSION;
  readonly publicationId: string;
  readonly publicationVersion: string;
  readonly scope: typeof PUBLIC_EVIDENCE_PUBLICATION_SCOPE;
  readonly sourceCorpusSha256: string;
  readonly sourceEvaluationSha256: string;
  readonly publicLeaderboardEligible: boolean;
  readonly acknowledgements: Readonly<
    Record<PublicEvidenceAcknowledgementKey, boolean>
  >;
}

export interface PublicEvidenceSourceIdentity {
  readonly sourceCorpusSha256: string;
  readonly sourceEvaluationSha256: string;
}

export interface PublicEvidenceBenchmarkIdentity {
  readonly corpusId: string;
  readonly corpusVersion: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
}

export interface PublicEvidenceGenerationIdentity {
  readonly generationSpecId: string;
  readonly generationSpecVersion: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptSha256: string;
  readonly maxOutputTokens: number;
}

export interface PublicEvidenceTutorIdentity {
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
}

export interface PublicEvidenceModelRecord
  extends PublicEvidenceTutorIdentity,
    PublicEvidenceGenerationIdentity {
  readonly id: string;
  readonly evidenceStatus: typeof PUBLIC_EVIDENCE_PUBLICATION_STATUS;
  readonly calibrationStatus: typeof PUBLIC_EVIDENCE_CALIBRATION_STATUS;
  readonly publicLeaderboardEligible: false;
  readonly judgeEvidenceStatus: typeof PUBLIC_EVIDENCE_JUDGE_STATUS;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly evaluatorVersion: string;
  /** Number of frozen runs represented for each dataset case. */
  readonly runs: number;
  readonly caseCount: number;
  readonly trialCount: number;
  readonly overallScore: number;
  readonly correctness: number;
  readonly diagnosis: number;
  readonly guidance: number;
  readonly adaptation: number;
  readonly actionability: number;
  readonly criticalFailureRate: number;
  readonly answerLeakageRate: number;
}

export interface PublicEvidenceTokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface PublicEvidenceRubricResult {
  readonly category: TutorEvalCategory;
  readonly result: "PASS" | "PARTIAL" | "FAIL";
  readonly score: number;
  readonly critical: boolean;
}

export interface PublicEvidenceCriticalFailure {
  readonly type: string;
  readonly severity: "minor" | "major" | "critical";
}

export interface PublicEvidenceJudgeDescriptor {
  readonly provider: string;
  readonly model: string;
  readonly modelVersion?: string;
  readonly promptId?: string;
  readonly promptVersion: string;
  readonly reasoningEffort?: string;
  readonly thinkingMode?: "enabled" | "disabled";
  readonly maxOutputTokens?: number;
}

export interface PublicEvidenceTrialRecord {
  readonly id: string;
  readonly modelId: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly runIndex: number;
  readonly responseId: string;
  readonly tutorResponse: string;
  readonly status: "passed" | "failed";
  readonly passed: boolean;
  readonly qualityGate: "PASS" | "FAIL";
  readonly overallScore: number;
  readonly correctness: number | null;
  readonly diagnosis: number | null;
  readonly guidance: number | null;
  readonly adaptation: number | null;
  readonly actionability: number | null;
  readonly rubricResults: readonly PublicEvidenceRubricResult[];
  readonly criticalFailures: readonly PublicEvidenceCriticalFailure[];
  readonly answerLeakage: boolean;
  readonly judgeEvidenceStatus: typeof PUBLIC_EVIDENCE_JUDGE_STATUS;
  readonly judge: PublicEvidenceJudgeDescriptor;
  readonly latencyMs: number | null;
  readonly tokenUsage: PublicEvidenceTokenUsage | null;
  readonly cost: number | null;
}

export interface PublicEvidencePublicationBundle {
  readonly schemaVersion: typeof PUBLIC_EVIDENCE_PUBLICATION_SCHEMA_VERSION;
  readonly publicationId: string;
  readonly publicationVersion: string;
  readonly policyId: typeof PUBLIC_EVIDENCE_PUBLICATION_POLICY_ID;
  readonly policyVersion: typeof PUBLIC_EVIDENCE_PUBLICATION_POLICY_VERSION;
  readonly scope: typeof PUBLIC_EVIDENCE_PUBLICATION_SCOPE;
  readonly status: typeof PUBLIC_EVIDENCE_PUBLICATION_STATUS;
  readonly calibrationStatus: typeof PUBLIC_EVIDENCE_CALIBRATION_STATUS;
  readonly publicLeaderboardEligible: false;
  readonly judgeEvidenceStatus: typeof PUBLIC_EVIDENCE_JUDGE_STATUS;
  readonly acknowledgements: Readonly<
    Record<PublicEvidenceAcknowledgementKey, true>
  >;
  readonly limitations: typeof PUBLIC_EVIDENCE_LIMITATIONS;
  readonly sourceIdentity: PublicEvidenceSourceIdentity;
  readonly benchmarkIdentity: PublicEvidenceBenchmarkIdentity;
  readonly generationIdentity: PublicEvidenceGenerationIdentity;
  readonly model: PublicEvidenceModelRecord;
  readonly trials: readonly PublicEvidenceTrialRecord[];
}

export interface PublicEvidenceModelsArtifact {
  readonly schemaVersion: typeof PUBLIC_EVIDENCE_MODEL_ARTIFACT_SCHEMA_VERSION;
  readonly artifactKind: "public-model-evidence";
  readonly publicationId: string;
  readonly publicationVersion: string;
  readonly status: typeof PUBLIC_EVIDENCE_PUBLICATION_STATUS;
  readonly calibrationStatus: typeof PUBLIC_EVIDENCE_CALIBRATION_STATUS;
  readonly publicLeaderboardEligible: false;
  readonly judgeEvidenceStatus: typeof PUBLIC_EVIDENCE_JUDGE_STATUS;
  readonly entries: readonly [PublicEvidenceModelRecord];
}

export interface PublicEvidenceTrialsArtifact {
  readonly schemaVersion: typeof PUBLIC_EVIDENCE_TRIAL_ARTIFACT_SCHEMA_VERSION;
  readonly artifactKind: "public-trial-evidence";
  readonly publicationId: string;
  readonly publicationVersion: string;
  readonly status: typeof PUBLIC_EVIDENCE_PUBLICATION_STATUS;
  readonly calibrationStatus: typeof PUBLIC_EVIDENCE_CALIBRATION_STATUS;
  readonly publicLeaderboardEligible: false;
  readonly judgeEvidenceStatus: typeof PUBLIC_EVIDENCE_JUDGE_STATUS;
  readonly entries: readonly PublicEvidenceTrialRecord[];
}

export interface PublicEvidenceInspectionReport {
  readonly schemaVersion: typeof PUBLIC_EVIDENCE_INSPECTION_SCHEMA_VERSION;
  readonly eligibleForPreliminaryPublication: boolean;
  readonly approvalRequired: true;
  readonly sourceCorpusSha256: string;
  readonly sourceEvaluationSha256: string;
  readonly benchmarkIdentity?: PublicEvidenceBenchmarkIdentity;
  readonly corpusIdentity?: {
    readonly corpusId: string;
    readonly corpusVersion: string;
    readonly coverage: "full" | "partial";
    readonly runsPerCase: number;
    readonly responseCount: number;
    readonly missingCaseCount: number;
  };
  readonly tutorIdentity?: PublicEvidenceTutorIdentity;
  readonly generationIdentity?: PublicEvidenceGenerationIdentity;
  readonly evaluatorIdentity?: { readonly evaluatorVersion: string };
  readonly judgeIdentity?: PublicEvidenceJudgeDescriptor;
  readonly coverage: {
    readonly expectedCaseCount: number;
    readonly expectedResponseCount: number;
    readonly selectedCaseCount: number;
    readonly selectedResponseCount: number;
    readonly caseRunCount: number;
    readonly errorCount: number;
  };
  readonly gates: readonly PublicationGateResult[];
  readonly blockingIssues: readonly PublicationIssue[];
}

export interface PublicationSourcePaths {
  readonly corpusPath: string;
  readonly evaluationPath: string;
}

export interface PublicationBuildPaths extends PublicationSourcePaths {
  readonly approvalPath: string;
  readonly outputDirectory: string;
}

export interface PublicationOutputFiles {
  readonly publication: PublicEvidencePublicationBundle;
  readonly models: PublicEvidenceModelsArtifact;
  readonly trials: PublicEvidenceTrialsArtifact;
}

export type { TutorEvalJudgeDescriptor, TutorGenerationSpec };
