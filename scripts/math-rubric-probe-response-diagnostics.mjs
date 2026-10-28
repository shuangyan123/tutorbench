/**
 * Experimental, allow-listed diagnostics for a TutorEval Judge provider response.
 * NEVER persist raw provider content, reasoning, prompt text, credentials,
 * arbitrary field values, or whole request/response envelopes.
 */
import { parseTutorEvalJudgeResult } from "../dist/src/contracts/tutor-eval-validation.js";
import {
  TUTOR_EVAL_CRITICAL_FAILURE_TYPES,
  TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES,
} from "../dist/src/contracts/tutor-eval.js";

const failureTypes = new Set(TUTOR_EVAL_CRITICAL_FAILURE_TYPES);
const severities = new Set(TUTOR_EVAL_CRITICAL_FAILURE_SEVERITIES);
const statuses = new Set(["PASS", "PARTIAL", "FAIL"]);
const isRecord = x => x !== null && typeof x === "object" && !Array.isArray(x);
const nonempty = x => typeof x === "string" && x.trim().length > 0;

function shapeIssues(value, caseId, rubricIds) {
  if (!isRecord(value)) return ["top_level_not_object"];
  const issues = [];
  if (value.schemaVersion !== 1) issues.push("schema_version_invalid");
  if (!nonempty(value.caseId)) issues.push("case_id_missing");
  else if (value.caseId !== caseId) issues.push("case_id_mismatch");
  if (!Array.isArray(value.rubricResults)) {
    issues.push("rubric_results_missing");
  } else {
    const seen = new Set();
    for (const item of value.rubricResults) {
      if (!isRecord(item)) { issues.push("rubric_item_not_object"); continue; }
      if (!nonempty(item.rubricId)) issues.push("rubric_id_missing");
      else {
        if (seen.has(item.rubricId)) issues.push("rubric_id_duplicate");
        if (!rubricIds.includes(item.rubricId)) issues.push("rubric_id_unexpected");
        seen.add(item.rubricId);
      }
      if (!statuses.has(item.result)) issues.push("rubric_status_invalid");
      if (item.evidence !== undefined && !nonempty(item.evidence))
        issues.push("rubric_evidence_invalid");
    }
    for (const id of rubricIds) {
      if (!seen.has(id)) issues.push("rubric_id_missing_required");
    }
  }
  if (!Array.isArray(value.criticalFailures)) {
    issues.push("critical_failures_missing");
  } else for (const failure of value.criticalFailures) {
    if (!isRecord(failure) ||
      !failureTypes.has(failure.type) || !severities.has(failure.severity) ||
      !nonempty(failure.evidence)) issues.push("critical_failure_item_invalid");
  }
  if (!Array.isArray(value.factualErrors)) {
    issues.push("factual_errors_missing");
  } else for (const error of value.factualErrors) {
    if (!isRecord(error) || !nonempty(error.description) ||
      !severities.has(error.severity)) issues.push("factual_error_item_invalid");
  }
  if (typeof value.insufficientInformation !== "boolean")
    issues.push("insufficient_information_invalid");
  return [...new Set(issues)];
}

/**
 * A sanitized diagnosis for one provider HTTP response. The raw response is
 * passed in memory only. We never store free-form values from the model.
 */
export function classifyMathJudgeEnvelope(envelope, caseId, rubricIds) {
  if (!isRecord(envelope)) return { phase: "provider_envelope_invalid" };
  const choice = Array.isArray(envelope.choices) ? envelope.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.message))
    return { phase: "provider_message_missing" };
  if (choice.finish_reason === "length")
    return { phase: "provider_output_truncated" };
  if (typeof choice.message.content !== "string")
    return { phase: "final_content_missing", hasThinkingField: nonempty(choice.message.reasoning_content) };
  let parsed;
  try { parsed = JSON.parse(choice.message.content); }
  catch { return { phase: "final_content_json_invalid" }; }
  const issues = shapeIssues(parsed, caseId, rubricIds);
  try {
    parseTutorEvalJudgeResult(parsed);
  } catch {
    return { phase: "judge_schema_invalid",
      issues: issues.length ? issues : ["judge_schema_other"] };
  }
  if (issues.length) return { phase: "judge_identity_invalid", issues };
  return { phase: "valid_judge_schema" };
}
