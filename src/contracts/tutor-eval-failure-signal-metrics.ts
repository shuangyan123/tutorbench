import type {
  TutorEvalCaseRunResult,
  TutorEvalFailureSignalMetrics,
  TutorEvalFailureSignalRate,
} from "./result.js";
import { isTutorEvalJudgeResult } from "./tutor-eval-validation.js";
import { BenchmarkConfigurationError } from "./errors.js";
import type { TutorEvalCaseScoringInputs } from "./tutor-eval-scoring.js";

/** Recorded positive evidence, independent of the derived summary flag. */
export function hasRecordedTutorEvalAnswerLeakage(result: TutorEvalCaseRunResult): boolean {
  return result.criticalFailures.some((failure) => failure.type === "answer_leakage") ||
    result.rubricResults.some((rubric) => rubric.diagnostics.some((item) => item.code === "direct_answer_detected"));
}

function hasCompleteNegativeEvidence(result: TutorEvalCaseRunResult, authoredCases?: readonly TutorEvalCaseScoringInputs[]): boolean {
  const judge = result.rawJudgeResult;
  if (
    judge === null || !isTutorEvalJudgeResult(judge) || judge.caseId !== result.caseId ||
    judge.insufficientInformation || judge.rubricResults.length === 0 ||
    result.rubricResults.some((rubric) => rubric.result === "ERROR" || rubric.score === null) ||
    (result.answerLeakage && !hasRecordedTutorEvalAnswerLeakage(result))
  ) {
    return false;
  }
  if (authoredCases !== undefined) {
    const authored = authoredCases.find((item) => item.caseId === result.caseId && item.caseVersion === result.caseVersion);
    const judgeIds = authored?.rubrics.filter((rubric) => rubric.evaluationType === "judge").map((rubric) => rubric.id) ?? [];
    if (authored === undefined || judgeIds.length === 0 || judge.rubricResults.length !== judgeIds.length ||
        judge.rubricResults.some((rubric) => !judgeIds.includes(rubric.rubricId)) ||
        result.rubricResults.length !== authored.rubrics.length || authored.rubrics.some((rubric) =>
          result.rubricResults.filter((item) => item.rubricId === rubric.id).length !== 1)) return false;
  }
  return judge.rubricResults.every((source) => {
    const normalized = result.rubricResults.filter((rubric) => rubric.rubricId === source.rubricId);
    return normalized.length === 1 && normalized[0]?.result === source.result;
  }) && judge.criticalFailures.every((source) => result.criticalFailures.some((failure) =>
    failure.type === source.type && failure.severity === source.severity && failure.evidence === source.evidence,
  ));
}

/** Derive coverage from validated case evidence, never from a supplied availability flag. */
export function buildTutorEvalFailureSignalMetrics(
  caseResults: readonly TutorEvalCaseRunResult[],
  expectedCaseRunCount = caseResults.length,
  authoredCases?: readonly TutorEvalCaseScoringInputs[],
): TutorEvalFailureSignalMetrics {
  if (!Number.isSafeInteger(expectedCaseRunCount) || expectedCaseRunCount < caseResults.length) {
    throw new BenchmarkConfigurationError("tutor_eval_result_invalid");
  }
  function metric(hasConfirmedSignal: (result: TutorEvalCaseRunResult) => boolean): TutorEvalFailureSignalRate {
    let confirmedCount = 0;
    let knownAbsentCount = 0;
    let unavailableCount = expectedCaseRunCount - caseResults.length;
    for (const result of caseResults) {
      if (hasConfirmedSignal(result)) {
        confirmedCount += 1;
      } else if (hasCompleteNegativeEvidence(result, authoredCases)) {
        knownAbsentCount += 1;
      } else {
        unavailableCount += 1;
      }
    }
    return {
      confirmedCount, knownAbsentCount, unavailableCount,
      // abstention 的阳性仍保留；未知阴性不能通过改有效样本分母变成 0%。
      rate: expectedCaseRunCount === 0 || unavailableCount > 0 ? null : confirmedCount / expectedCaseRunCount,
    };
  }
  return {
    schemaVersion: 1,
    criticalFailures: metric((result) => result.criticalFailures.length > 0),
    answerLeakage: metric(hasRecordedTutorEvalAnswerLeakage),
  };
}

/** Current metadata is a reproducible projection, not additional trust for old evidence. */
export function hasValidTutorEvalFailureSignalMetrics(
  value: unknown,
  caseResults: readonly TutorEvalCaseRunResult[],
  expectedCaseRunCount = caseResults.length,
  authoredCases?: readonly TutorEvalCaseScoringInputs[],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || Object.keys(record).length !== 3) return false;
  let expected: TutorEvalFailureSignalMetrics;
  try { expected = buildTutorEvalFailureSignalMetrics(caseResults, expectedCaseRunCount, authoredCases); }
  catch { return false; }
  return (["criticalFailures", "answerLeakage"] as const).every((key) => {
    const metric = record[key];
    if (typeof metric !== "object" || metric === null || Array.isArray(metric)) return false;
    const actual = metric as Record<string, unknown>;
    return Object.keys(actual).length === 4 &&
      (["confirmedCount", "knownAbsentCount", "unavailableCount", "rate"] as const)
        .every((field) => actual[field] === expected[key][field]);
  });
}
