import {
  TUTOR_EVAL_INSUFFICIENT_INFORMATION_DIAGNOSTIC,
  TUTOR_EVAL_JUDGE_FAILURE_MESSAGES,
  type TutorEvalCaseRunResult,
} from "../contracts/index.js";

const executionCodes = new Set([
  ...Object.keys(TUTOR_EVAL_JUDGE_FAILURE_MESSAGES),
  TUTOR_EVAL_INSUFFICIENT_INFORMATION_DIAGNOSTIC.code,
  "adapter_failed",
  "evaluation_failed",
]);

// Historical/imported results may contain free-form diagnostics. Only expose known codes.
export function caseErrorCodes(row: TutorEvalCaseRunResult): string[] {
  if (row.status !== "error") return [];
  const codes = row.diagnostics.map(({ code }) => code).filter(code => executionCodes.has(code));
  // A Judge failure takes precedence in the case diagnostic; retain concurrent evaluator errors.
  if (row.rubricResults.some(r => r.result === "ERROR" && r.diagnostics.some(d =>
    d.code === "evaluator_config_invalid" || d.code === "evaluation_failed"))) {
    codes.push("evaluation_failed");
  }
  return codes.length ? [...new Set(codes)] : ["unclassified_error"];
}

export function countErrorCodes(rows: readonly { readonly errorCodes: readonly string[] }[]) {
  const counts = new Map<string, number>();
  for (const { errorCodes } of rows) {
    for (const code of errorCodes) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}
