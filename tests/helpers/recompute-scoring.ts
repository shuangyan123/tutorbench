import type { TutorEvalRunResult } from "../../src/contracts/result.js";
import { buildTutorEvalFailureSignalMetrics } from "../../src/contracts/tutor-eval-failure-signal-metrics.js";
import {
  aggregateTutorEvalCategoryScores,
  aggregateTutorEvalOverallScore,
  aggregateTutorEvalRubrics,
  createEmptyTutorEvalCategoryScores,
} from "../../src/scoring/index.js";

/** Rebuild derived fixture fields only; preserve the authored config and raw/normalized evidence. */
export function recomputeRecordedScoring(evaluation: TutorEvalRunResult): TutorEvalRunResult {
  const source = evaluation.scoringProvenance;
  if (source === undefined) throw new Error("Fixture recomputation requires recorded scoring provenance.");
  const caseResults = evaluation.caseResults.map((item) => {
    const authored = source.cases.find((candidate) => candidate.caseId === item.caseId && candidate.caseVersion === item.caseVersion);
    if (authored === undefined) throw new Error("Fixture case is outside recorded scoring inputs.");
    const aggregate = aggregateTutorEvalRubrics(authored.rubrics, item.rubricResults, item.criticalFailures, source.config);
    const error = item.status === "error";
    const adapterError = error && item.rawTutorResponse === null && item.rubricResults.length === 0;
    const passed = !error && aggregate.passed;
    return { ...item, categoryScores: aggregate.categoryScores,
      overallScore: error ? null : aggregate.overallScore,
      qualityGate: adapterError ? "FAIL" as const : aggregate.qualityGate,
      passed, status: error ? "error" as const : passed ? "passed" as const : "failed" as const,
    };
  });
  const hasError = caseResults.length !== evaluation.caseCount * evaluation.runsPerCase || caseResults.some((item) => item.status === "error");
  return { ...evaluation, caseResults, caseRunCount: caseResults.length,
    failureSignalMetrics: buildTutorEvalFailureSignalMetrics(caseResults, evaluation.caseCount * evaluation.runsPerCase, source.cases),
    passedCount: caseResults.filter((item) => item.status === "passed").length,
    failedCount: caseResults.filter((item) => item.status === "failed").length,
    errorCount: caseResults.filter((item) => item.status === "error").length,
    categoryScores: hasError ? createEmptyTutorEvalCategoryScores() : aggregateTutorEvalCategoryScores(caseResults.filter((item) => item.overallScore !== null)),
    overallScore: hasError ? null : aggregateTutorEvalOverallScore(caseResults.map((item) => item.overallScore)),
    criticalFailureRate: caseResults.length === 0 ? 0 : caseResults.filter((item) => item.criticalFailures.length > 0).length / caseResults.length,
    answerLeakageRate: caseResults.length === 0 ? 0 : caseResults.filter((item) => item.answerLeakage).length / caseResults.length,
  };
}
