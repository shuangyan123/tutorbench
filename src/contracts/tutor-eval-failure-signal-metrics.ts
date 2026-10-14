import type {
  TutorEvalCaseRunResult,
  TutorEvalFailureSignalMetrics,
  TutorEvalFailureSignalRate,
} from "./result.js";
import { isTutorEvalJudgeResult } from "./tutor-eval-validation.js";

function hasCompleteNegativeEvidence(result: TutorEvalCaseRunResult): boolean {
  const judge = result.rawJudgeResult;
  if (
    judge === null || !isTutorEvalJudgeResult(judge) || judge.caseId !== result.caseId ||
    judge.insufficientInformation || judge.rubricResults.length === 0 ||
    result.rubricResults.some((rubric) => rubric.result === "ERROR" || rubric.score === null)
  ) {
    return false;
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
): TutorEvalFailureSignalMetrics {
  function metric(hasConfirmedSignal: (result: TutorEvalCaseRunResult) => boolean): TutorEvalFailureSignalRate {
    let confirmedCount = 0;
    let knownAbsentCount = 0;
    let unavailableCount = 0;
    for (const result of caseResults) {
      if (hasConfirmedSignal(result)) {
        confirmedCount += 1;
      } else if (hasCompleteNegativeEvidence(result)) {
        knownAbsentCount += 1;
      } else {
        unavailableCount += 1;
      }
    }
    return {
      confirmedCount, knownAbsentCount, unavailableCount,
      // abstention 的阳性仍保留；未知阴性不能通过改有效样本分母变成 0%。
      rate: caseResults.length === 0 || unavailableCount > 0 ? null : confirmedCount / caseResults.length,
    };
  }
  return {
    schemaVersion: 1,
    criticalFailures: metric((result) => result.criticalFailures.length > 0),
    answerLeakage: metric((result) => result.answerLeakage),
  };
}

/** Current metadata is a reproducible projection, not additional trust for old evidence. */
export function hasValidTutorEvalFailureSignalMetrics(
  value: unknown,
  caseResults: readonly TutorEvalCaseRunResult[],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || Object.keys(record).length !== 3) return false;
  const expected = buildTutorEvalFailureSignalMetrics(caseResults);
  return (["criticalFailures", "answerLeakage"] as const).every((key) => {
    const metric = record[key];
    if (typeof metric !== "object" || metric === null || Array.isArray(metric)) return false;
    const actual = metric as Record<string, unknown>;
    return Object.keys(actual).length === 4 &&
      (["confirmedCount", "knownAbsentCount", "unavailableCount", "rate"] as const)
        .every((field) => actual[field] === expected[key][field]);
  });
}
