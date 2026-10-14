import {
  parseTutorResponseCorpus,
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
  TUTOR_EVAL_EVALUATOR_VERSION,
  type TutorEvalCaseRunResult,
  type TutorEvalCriticalFailure,
  type TutorEvalDataset,
  type TutorEvalJudgeDescriptor,
  type TutorEvalJudgeResult,
  type TutorResponseCorpus,
  type TutorResponseCorpusEvaluationResult,
} from "../contracts/index.js";
import { deriveTutorResponseId } from "../corpus/identity.js";
import { assertValidTutorEvalRunResult } from "../contracts/tutor-eval-result-validation.js";
import { hasValidAuthoredAbstention } from "../reporting/tutor-health-abstention-validation.js";
import type { JudgeCandidateComparisonFixture, JudgeCandidateComparisonFixtureObservation, JudgeDiagnosticOutcome } from "./candidate-comparison.js";
import {
  TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ID,
  TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_VERSION,
} from "./tutor-eval-pedagogy-prompt.js";

export const WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID =
  "judge-word-context-discrimination" as const;
export const WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION = "0.1.0" as const;
export const WORD_CONTEXT_DISCRIMINATION_CASE_ID =
  "language-word-context-001" as const;
export const WORD_CONTEXT_DISCRIMINATION_CASE_VERSION = "1.1.1" as const;
export const WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_RUBRIC_ID =
  "language-word-context-001" as const;
export const WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_RUBRIC_ID =
  "language-word-question-001" as const;
export const WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_CRITERION =
  "Evaluate the student's proposed meaning against the surrounding context, explain what the pause-before-agreeing clue supports and what it cannot establish on its own, and do not treat the student's guess as automatically correct or incorrect." as const;
export const WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_CRITERION =
  "Ask the student to point to one clue in the sentence." as const;

const wordContextJudgeCriteria = [
  { rubricId: WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_RUBRIC_ID, category: "correctness", weight: 1, evaluationType: "judge", behavior: "required" },
  { rubricId: WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_RUBRIC_ID, category: "actionability", weight: 1, evaluationType: "judge", behavior: "desirable" },
] as const;

export type WordContextDiscriminationLabel = "PASS" | "PARTIAL" | "FAIL";
export type WordContextDiscriminationFixtureCaseId = "A" | "B" | "C";

export interface WordContextDiscriminationFixtureCase {
  readonly id: WordContextDiscriminationFixtureCaseId;
  readonly runIndex: number;
  readonly responseText: string;
  readonly expected: {
    readonly correctness: WordContextDiscriminationLabel;
    readonly actionability: WordContextDiscriminationLabel;
  };
  readonly expectationRationale: string;
}

/**
 * These are fixed diagnostic inputs, not model evidence or human-calibrated
 * gold labels. The response text is kept provider-neutral at this boundary;
 * the corpus built below is always marked synthetic and never recorded_model.
 */
export const WORD_CONTEXT_DISCRIMINATION_FIXTURES: readonly WordContextDiscriminationFixtureCase[] = Object.freeze([
  Object.freeze({
    id: "A",
    runIndex: 1,
    responseText: [
      "The pause before agreeing suggests hesitation and could be consistent with reluctance, but that clue alone does not tell us whether the character is unwilling, uncertain, or simply thinking. We need another context clue before deciding exactly what 'reluctant' means.",
      "",
      "Can you point to another word or phrase in the sentence that helps us decide?",
    ].join("\n"),
    expected: Object.freeze({
      correctness: "PASS",
      actionability: "PASS",
    } as const),
    expectationRationale:
      "It explains what the pause supports and explicitly states that the clue cannot by itself distinguish unwillingness from uncertainty or thinking, then asks for another clue.",
  }),
  Object.freeze({
    id: "B",
    runIndex: 2,
    responseText: [
      "You're on the right track! Hesitation is definitely part of the meaning. But let me help you fine-tune it.",
      "",
      "**\"Reluctant\"** means *unwilling* or *hesitant because you don't really want to do something*—not just that you're unsure about it.",
      "",
      "The key clue is that the character **pauses before agreeing**. Think about it: if someone is simply \"unsure,\" they might need more information. But when someone pauses before agreeing, it usually means they *don't really want to* but might do it anyway. That's reluctance!",
      "",
      "**Your turn:** Can you point to the specific word or phrase in the sentence that tells us the character isn't fully willing? That's your context clue!",
    ].join("\n"),
    expected: Object.freeze({
      correctness: "PARTIAL",
      actionability: "PASS",
    } as const),
    expectationRationale:
      "It distinguishes reluctant from unsure, uses the context, and asks for a clue, but it overstates what pausing before agreeing establishes and does not name the limitation.",
  }),
  Object.freeze({
    id: "C",
    runIndex: 3,
    responseText: [
      "The character pauses before agreeing, so we know they do not want to agree. Therefore 'reluctant' definitely means unwilling here.",
      "",
      "Can you point to the pause before agreeing?",
    ].join("\n"),
    expected: Object.freeze({
      correctness: "FAIL",
      actionability: "PASS",
    } as const),
    expectationRationale:
      "It treats an underdetermined clue as conclusive evidence and directly violates the limitation clause, while still asking the student to identify a clue.",
  }),
] as const);

export const WORD_CONTEXT_DISCRIMINATION_FIXTURE_PROVENANCE =
  "developer-authored-diagnostic-expectation" as const;

export interface WordContextDiscriminationReportCase {
  readonly fixtureCaseId: WordContextDiscriminationFixtureCaseId;
  readonly runIndex: number;
  readonly expected: WordContextDiscriminationFixtureCase["expected"];
  readonly expectationRationale: string;
  readonly observed: {
    readonly correctness: WordContextDiscriminationLabel | null;
    readonly actionability: WordContextDiscriminationLabel | null;
  };
  readonly status: TutorEvalCaseRunResult["status"];
  readonly judgeOutcome?: JudgeDiagnosticOutcome;
  readonly criticalFailures: readonly TutorEvalCriticalFailure[] | null;
  readonly answerLeakage: boolean | null;
  readonly insufficientInformation: boolean | null;
  readonly factualErrors: TutorEvalJudgeResult["factualErrors"];
  readonly rawJudgeEvidence: readonly {
    readonly rubricId: string;
    readonly result: WordContextDiscriminationLabel;
    readonly evidence?: string;
  }[];
}

export interface WordContextDiscriminationReport {
  readonly schemaVersion: 1 | 2;
  readonly fixtureId: typeof WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID;
  readonly fixtureVersion: typeof WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION;
  readonly fixtureProvenance: typeof WORD_CONTEXT_DISCRIMINATION_FIXTURE_PROVENANCE;
  readonly calibrationStatus: "uncalibrated";
  readonly datasetId: typeof TUTOR_EVAL_DATASET_ID;
  readonly datasetVersion: typeof TUTOR_EVAL_DATASET_VERSION;
  readonly caseId: typeof WORD_CONTEXT_DISCRIMINATION_CASE_ID;
  readonly caseVersion: typeof WORD_CONTEXT_DISCRIMINATION_CASE_VERSION;
  readonly correctnessCriterion: typeof WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_CRITERION;
  readonly actionabilityCriterion: typeof WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_CRITERION;
  readonly evaluatorVersion: string | null;
  readonly judge: TutorEvalJudgeDescriptor | null;
  readonly judgeCallCount?: number;
  readonly cases: readonly WordContextDiscriminationReportCase[];
  readonly limitations: readonly string[];
}

export interface BuildWordContextDiscriminationReportOptions {
  readonly judgeCallCount?: number;
}

export function observeWordContextDiscriminationEvaluation(
  result: TutorResponseCorpusEvaluationResult,
): readonly JudgeCandidateComparisonFixtureObservation[] {
  const report = buildWordContextDiscriminationReport(result);
  return report.cases.map((fixtureCase) => {
    const caseResult = result.evaluation.caseResults.find(
      (candidate) => candidate.runIndex === fixtureCase.runIndex,
    );
    if (caseResult === undefined) {
      throw new Error("Word-context discrimination comparison result is missing a fixture run.");
    }
    return {
      fixtureCaseId: fixtureCase.fixtureCaseId,
      runIndex: fixtureCase.runIndex,
      expectedLabel: fixtureCase.expected.correctness,
      observedLabel: fixtureCase.observed.correctness,
      status: caseResult.status,
      judgeOutcome: fixtureCase.judgeOutcome ?? "unavailable",
      answerLeakage: fixtureCase.answerLeakage,
      // 结构化 abstention 也使用 error 状态；有 raw 结果时仍应展示真实 flag。
      insufficientInformation: caseResult.rawJudgeResult?.insufficientInformation ?? null,
      criticalFailures:
        fixtureCase.criticalFailures?.map((failure) => ({
          type: failure.type,
          severity: failure.severity,
        })) ?? null,
      executionErrorCode:
        fixtureCase.judgeOutcome === "unavailable" && caseResult.status === "error"
          ? caseResult.diagnostics[0]?.code ?? "evaluation_error"
          : null,
      latencyMs: caseResult.judgeMetrics?.latencyMs ?? null,
      tokenUsage: caseResult.judgeMetrics?.tokenUsage ?? null,
    };
  });
}

export function createWordContextDiscriminationComparisonFixture(
  loadDataset: () => Promise<TutorEvalDataset>,
): JudgeCandidateComparisonFixture {
  return {
    fixtureId: WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID,
    fixtureVersion: WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION,
    fixtureProvenance: WORD_CONTEXT_DISCRIMINATION_FIXTURE_PROVENANCE,
    expectedFixtureIds: WORD_CONTEXT_DISCRIMINATION_FIXTURES.map((fixtureCase) => fixtureCase.id),
    caseIdentity: {
      caseId: WORD_CONTEXT_DISCRIMINATION_CASE_ID,
      caseVersion: WORD_CONTEXT_DISCRIMINATION_CASE_VERSION,
    },
    buildCorpus: buildWordContextDiscriminationCorpus,
    loadDataset,
    observeEvaluation: observeWordContextDiscriminationEvaluation,
  };
}

export function getWordContextDiscriminationFixtureCase(
  runIndex: number,
): WordContextDiscriminationFixtureCase {
  const fixtureCase = WORD_CONTEXT_DISCRIMINATION_FIXTURES.find(
    (candidate) => candidate.runIndex === runIndex,
  );
  if (fixtureCase === undefined) {
    throw new Error(`Unknown word-context discrimination run: ${runIndex}`);
  }
  return fixtureCase;
}

export function buildWordContextDiscriminationCorpus(): TutorResponseCorpus {
  const tutor = {
    provider: "synthetic",
    model: WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID,
    promptId: "diagnostic-fixture",
    promptVersion: WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION,
  } as const;
  return parseTutorResponseCorpus({
    schemaVersion: 1,
    corpusId: WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID,
    corpusVersion: WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION,
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: TUTOR_EVAL_DATASET_VERSION,
    createdAt: "2026-08-19T00:00:00.000Z",
    coverage: "partial",
    runsPerCase: WORD_CONTEXT_DISCRIMINATION_FIXTURES.length,
    provenance: "synthetic",
    tutor,
    responses: WORD_CONTEXT_DISCRIMINATION_FIXTURES.map((fixtureCase) => ({
      schemaVersion: 1,
      responseId: deriveTutorResponseId({
        corpusId: WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID,
        corpusVersion: WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION,
        datasetId: TUTOR_EVAL_DATASET_ID,
        datasetVersion: TUTOR_EVAL_DATASET_VERSION,
        caseId: WORD_CONTEXT_DISCRIMINATION_CASE_ID,
        caseVersion: WORD_CONTEXT_DISCRIMINATION_CASE_VERSION,
        tutor,
        runIndex: fixtureCase.runIndex,
      }),
      caseId: WORD_CONTEXT_DISCRIMINATION_CASE_ID,
      caseVersion: WORD_CONTEXT_DISCRIMINATION_CASE_VERSION,
      runIndex: fixtureCase.runIndex,
      responseText: fixtureCase.responseText,
      provenance: "synthetic",
    })),
  });
}

function observedLabel(
  caseResult: TutorEvalCaseRunResult,
  rubricId: string,
): WordContextDiscriminationLabel | null {
  const rubricResult = caseResult.rubricResults.find(
    (candidate) => candidate.rubricId === rubricId,
  );
  return rubricResult?.result === "PASS" ||
      rubricResult?.result === "PARTIAL" ||
      rubricResult?.result === "FAIL"
    ? rubricResult.result
    : null;
}

function rawJudgeEvidence(
  result: TutorEvalJudgeResult | null,
): WordContextDiscriminationReportCase["rawJudgeEvidence"] {
  return result?.rubricResults.map((rubricResult) => ({
    rubricId: rubricResult.rubricId,
    result: rubricResult.result,
    ...(rubricResult.evidence === undefined
      ? {}
      : { evidence: rubricResult.evidence }),
  })) ?? [];
}

function caseReport(
  fixtureCase: WordContextDiscriminationFixtureCase,
  caseResult: TutorEvalCaseRunResult,
): WordContextDiscriminationReportCase {
  const raw = caseResult.rawJudgeResult;
  const judgeOutcome: JudgeDiagnosticOutcome = raw === null || raw.rubricResults.length !== wordContextJudgeCriteria.length
    ? "unavailable" : raw.insufficientInformation ? "abstained" : "completed";
  const criticalFailures = judgeOutcome === "unavailable" ||
    (judgeOutcome === "abstained" && caseResult.criticalFailures.length === 0) ? null : caseResult.criticalFailures;
  return {
    fixtureCaseId: fixtureCase.id,
    runIndex: fixtureCase.runIndex,
    expected: fixtureCase.expected,
    expectationRationale: fixtureCase.expectationRationale,
    observed: {
      correctness: judgeOutcome === "completed" ? observedLabel(
        caseResult,
        WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_RUBRIC_ID,
      ) : null,
      actionability: judgeOutcome === "completed" ? observedLabel(
        caseResult,
        WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_RUBRIC_ID,
      ) : null,
    },
    status: caseResult.status,
    judgeOutcome,
    criticalFailures,
    answerLeakage: judgeOutcome === "unavailable" ? null : caseResult.answerLeakage ? true
      : judgeOutcome === "abstained" ? null : false,
    insufficientInformation: caseResult.rawJudgeResult?.insufficientInformation ?? null,
    factualErrors: caseResult.rawJudgeResult?.factualErrors ?? [],
    rawJudgeEvidence: rawJudgeEvidence(caseResult.rawJudgeResult),
  };
}

function assertReportInputIdentity(
  result: TutorResponseCorpusEvaluationResult,
): readonly TutorEvalCaseRunResult[] {
  assertValidTutorEvalRunResult(result.evaluation);
  if (
    result.corpusId !== WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID ||
    result.corpusVersion !== WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION ||
    result.datasetId !== TUTOR_EVAL_DATASET_ID ||
    result.datasetVersion !== TUTOR_EVAL_DATASET_VERSION ||
    result.evaluation.evaluatorVersion !== TUTOR_EVAL_EVALUATOR_VERSION ||
    result.selectedCaseCount !== 1 ||
    result.evaluation.caseRunCount !== WORD_CONTEXT_DISCRIMINATION_FIXTURES.length
  ) {
    throw new Error("Word-context discrimination evaluation identity is invalid.");
  }
  if (
    result.evaluation.judge !== null &&
    (result.evaluation.judge.promptId !== TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ID ||
      result.evaluation.judge.promptVersion !== TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_VERSION)
  ) {
    throw new Error("Word-context discrimination Judge identity is invalid.");
  }
  const caseResults = result.evaluation.caseResults;
  if (result.evaluation.scoringProvenance?.cases.some((item) => item.caseId !== WORD_CONTEXT_DISCRIMINATION_CASE_ID ||
      item.caseVersion !== WORD_CONTEXT_DISCRIMINATION_CASE_VERSION || item.rubrics.length !== wordContextJudgeCriteria.length ||
      item.rubrics.some((rubric) => rubric.evaluationType !== "judge" ||
        !wordContextJudgeCriteria.some((criterion) => rubric.id === criterion.rubricId && rubric.category === criterion.category && rubric.weight === criterion.weight && rubric.behavior === criterion.behavior)))) {
    throw new Error("Word-context discrimination scoring source is invalid.");
  }
  // 固定 case@1.1.1 仅含这两个 Judge rubric；不凭 error 状态或未经校验的 flag 推断可用性。
  for (const caseResult of caseResults) {
    const raw = caseResult.rawJudgeResult;
    if (!hasValidAuthoredAbstention(caseResult, wordContextJudgeCriteria) ||
        caseResult.rubricResults.some((item) => !wordContextJudgeCriteria.some((criterion) =>
          item.rubricId === criterion.rubricId && item.category === criterion.category && item.weight === criterion.weight && !item.critical)) ||
        raw?.rubricResults.some((item) => !wordContextJudgeCriteria.some((criterion) => item.rubricId === criterion.rubricId)) ||
        (raw !== null && caseResult.answerLeakage !== caseResult.criticalFailures.some((item) => item.type === "answer_leakage"))) {
      throw new Error("Word-context discrimination evidence source is invalid.");
    }
  }
  const expectedRunIndexes = new Set(
    WORD_CONTEXT_DISCRIMINATION_FIXTURES.map((fixtureCase) => fixtureCase.runIndex),
  );
  if (
    caseResults.length !== expectedRunIndexes.size ||
    caseResults.some(
      (caseResult) =>
        caseResult.caseId !== WORD_CONTEXT_DISCRIMINATION_CASE_ID ||
        caseResult.caseVersion !== WORD_CONTEXT_DISCRIMINATION_CASE_VERSION ||
        !expectedRunIndexes.has(caseResult.runIndex),
    ) ||
    new Set(caseResults.map((caseResult) => caseResult.runIndex)).size !== caseResults.length
  ) {
    throw new Error("Word-context discrimination case identity is invalid.");
  }
  return [...caseResults].sort((left, right) => left.runIndex - right.runIndex);
}

export function buildWordContextDiscriminationReport(
  result: TutorResponseCorpusEvaluationResult,
  options: BuildWordContextDiscriminationReportOptions = {},
): WordContextDiscriminationReport {
  const caseResults = assertReportInputIdentity(result);
  const reportCases = WORD_CONTEXT_DISCRIMINATION_FIXTURES.map((fixtureCase) => {
    const caseResult = caseResults.find(
      (candidate) => candidate.runIndex === fixtureCase.runIndex,
    );
    if (caseResult === undefined) {
      throw new Error("Word-context discrimination result is missing a fixture run.");
    }
    return caseReport(fixtureCase, caseResult);
  });
  return {
    schemaVersion: 2,
    fixtureId: WORD_CONTEXT_DISCRIMINATION_FIXTURE_ID,
    fixtureVersion: WORD_CONTEXT_DISCRIMINATION_FIXTURE_VERSION,
    fixtureProvenance: WORD_CONTEXT_DISCRIMINATION_FIXTURE_PROVENANCE,
    calibrationStatus: "uncalibrated",
    datasetId: TUTOR_EVAL_DATASET_ID,
    datasetVersion: TUTOR_EVAL_DATASET_VERSION,
    caseId: WORD_CONTEXT_DISCRIMINATION_CASE_ID,
    caseVersion: WORD_CONTEXT_DISCRIMINATION_CASE_VERSION,
    correctnessCriterion: WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_CRITERION,
    actionabilityCriterion: WORD_CONTEXT_DISCRIMINATION_ACTIONABILITY_CRITERION,
    evaluatorVersion: result.evaluation.evaluatorVersion ?? null,
    judge: result.evaluation.judge,
    ...(options.judgeCallCount === undefined
      ? {}
      : { judgeCallCount: options.judgeCallCount }),
    cases: reportCases,
    limitations: [
      "Developer-authored diagnostic expectations are not human calibration gold.",
      "Observed labels are reported beside expectations; this report does not infer benchmark pass/fail or general Judge accuracy.",
      "The three responses probe one case and one limitation clause only.",
      "Structured abstention preserves confirmed failures; unknown leakage or failure absence remains unavailable.",
    ],
  };
}

function labelOrNA(value: WordContextDiscriminationLabel | null): string {
  return value ?? "n/a";
}

export function formatWordContextDiscriminationReport(
  report: WordContextDiscriminationReport,
): string {
  const judge = report.judge === null
    ? "none"
    : `${report.judge.provider}/${report.judge.model} prompt ${report.judge.promptId ?? "n/a"}@${report.judge.promptVersion}`;
  const lines = [
    "Judge word-context discrimination report",
    `Fixture: ${report.fixtureId}@${report.fixtureVersion}`,
    `Provenance: ${report.fixtureProvenance}`,
    `Calibration: ${report.calibrationStatus}`,
    `Report schema: ${report.schemaVersion}`,
    `Dataset: ${report.datasetId}@${report.datasetVersion}`,
    `Case: ${report.caseId}@${report.caseVersion}`,
    `Evaluator: ${report.evaluatorVersion ?? "n/a"}`,
    `Judge: ${judge}`,
    `Judge calls: ${report.judgeCallCount ?? "n/a"}`,
    "",
    "Expected vs observed (diagnostic only; no benchmark pass/fail inferred):",
  ];
  for (const fixtureCase of report.cases) {
    // 旧 schema 的 error/false 不能升级为已确认的“未泄漏”；保留原字节和已记录的正信号。
    const legacyUnknown = report.schemaVersion === 1 && fixtureCase.judgeOutcome === undefined && fixtureCase.status === "error";
    const leakage = legacyUnknown && fixtureCase.answerLeakage !== true ? null : fixtureCase.answerLeakage;
    lines.push(
      `${fixtureCase.fixtureCaseId}: correctness expected ${fixtureCase.expected.correctness} / observed ${labelOrNA(fixtureCase.observed.correctness)}; actionability expected ${fixtureCase.expected.actionability} / observed ${labelOrNA(fixtureCase.observed.actionability)}`,
      `  status: ${fixtureCase.status}; Judge outcome: ${fixtureCase.judgeOutcome ?? "legacy"}; answer leakage: ${leakage ?? "n/a"}; insufficient information: ${fixtureCase.insufficientInformation ?? "n/a"}`,
      `  expectation: ${fixtureCase.expectationRationale}`,
      "  Judge evidence:",
    );
    if (fixtureCase.rawJudgeEvidence.length === 0) {
      lines.push("    n/a");
    } else {
      for (const evidence of fixtureCase.rawJudgeEvidence) {
        lines.push(
          `    ${evidence.rubricId}: ${evidence.result}${evidence.evidence === undefined ? "" : ` — ${evidence.evidence}`}`,
        );
      }
    }
    if (fixtureCase.criticalFailures === null || (legacyUnknown && fixtureCase.criticalFailures.length === 0)) {
      lines.push("  Critical failures: n/a");
    } else if (fixtureCase.criticalFailures.length > 0) {
      lines.push(
        `  Critical failures: ${fixtureCase.criticalFailures.map((failure) => `${failure.type}/${failure.severity}: ${failure.evidence}`).join("; ")}`,
      );
    }
    if (fixtureCase.factualErrors.length > 0) {
      lines.push(
        `  Factual errors: ${fixtureCase.factualErrors.map((error) => `${error.severity}: ${error.description}`).join("; ")}`,
      );
    }
  }
  lines.push("", "Limitations:", ...report.limitations.map((limitation) => `- ${limitation}`));
  return lines.join("\n");
}

export const WORD_CONTEXT_DISCRIMINATION_JUDGE_IDENTITY = Object.freeze({
  promptId: TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ID,
  promptVersion: TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_VERSION,
  evaluatorVersion: TUTOR_EVAL_EVALUATOR_VERSION,
});
