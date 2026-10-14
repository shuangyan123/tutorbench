import type { TutorEvalCaseRunResult, TutorScenarioEvaluationCriterion } from "../contracts/index.js";
import { TUTOR_EVAL_INSUFFICIENT_INFORMATION_DIAGNOSTIC } from "../contracts/tutor-eval-judge.js";

const severityRank = { minor: 1, major: 2, critical: 3 } as const;

/** Authored ownership is unavailable to standalone v1 parsing; verify it before reporting. */
export function hasValidAuthoredAbstention(
  result: TutorEvalCaseRunResult,
  criteria: readonly TutorScenarioEvaluationCriterion[],
): boolean {
  const raw = result.rawJudgeResult;
  if (raw?.insufficientInformation !== true) return true;
  const judgeIds = new Set(criteria.filter((item) => item.evaluationType === "judge").map((item) => item.rubricId));
  if (judgeIds.size === 0 || raw.rubricResults.length !== judgeIds.size ||
      raw.rubricResults.some((item) => !judgeIds.has(item.rubricId))) return false;

  const authored = new Map(criteria.map((item) => [item.rubricId, item]));
  if (result.rubricResults.some((item) => {
    const criterion = authored.get(item.rubricId);
    if (criterion === undefined) return true;
    if (criterion.evaluationType === "judge") return item.result !== "ERROR" || item.score !== null;
    // deterministic ERROR 可以是独立执行问题，但不能借用 Judge 的 abstention 来源。
    return item.diagnostics.some((diagnostic) => diagnostic.code === TUTOR_EVAL_INSUFFICIENT_INFORMATION_DIAGNOSTIC.code);
  })) return false;

  const sourceFailures = [
    ...raw.criticalFailures,
    ...raw.factualErrors.filter((item) => item.severity !== "minor").map((item) => ({
      type: "severe_factual_error", severity: item.severity, evidence: item.description,
    })),
  ];
  for (const criterion of criteria) {
    if (criterion.evaluationType !== "deterministic" || criterion.criticalFailure === undefined) continue;
    const rubric = result.rubricResults.find((item) => item.rubricId === criterion.rubricId);
    if (rubric?.result === "FAIL") sourceFailures.push({
      ...criterion.criticalFailure,
      evidence: rubric.diagnostics[0]?.message ?? `Rubric ${criterion.rubricId} failed.`,
    });
  }
  // 按类型去重只可保留真实来源的最高严重度；不重算可配置评分或 gate。
  if (new Set(result.criticalFailures.map((item) => item.type)).size !== result.criticalFailures.length) return false;
  return sourceFailures.every((source) => result.criticalFailures.some((item) =>
    item.type === source.type && severityRank[item.severity] >= severityRank[source.severity],
  )) && result.criticalFailures.every((item) => sourceFailures.some((source) =>
    item.type === source.type && item.severity === source.severity && item.evidence === source.evidence,
  ));
}
