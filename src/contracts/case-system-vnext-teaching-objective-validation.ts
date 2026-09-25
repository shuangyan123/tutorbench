import { BenchmarkConfigurationError } from "./errors.js";
import {
  CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES,
  type CaseSystemVNextAssessmentContext,
  type CaseSystemVNextTeachingObjectiveSelection,
} from "./case-system-vnext-teaching-objective.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 500));
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(record).every((key) => set.has(key));
}

function isAssessmentContext(value: unknown): value is CaseSystemVNextAssessmentContext {
  const record = asRecord(value);
  return record !== null &&
    hasOnlyKeys(record, [
      "examFamily",
      "questionType",
      "scoringPolicy",
      "timePressure",
      "timeBudgetMinutes",
      "allowedTools",
      "syllabusBoundary",
      "requiredWork",
    ]) &&
    isText(record.examFamily, 200) &&
    isText(record.questionType, 200) &&
    isText(record.scoringPolicy, 1_000) &&
    ["low", "moderate", "high"].includes(String(record.timePressure)) &&
    (record.timeBudgetMinutes === undefined ||
      (typeof record.timeBudgetMinutes === "number" &&
        Number.isFinite(record.timeBudgetMinutes) &&
        record.timeBudgetMinutes > 0 &&
        record.timeBudgetMinutes <= 1_440)) &&
    isTextArray(record.allowedTools, 50) &&
    isTextArray(record.syllabusBoundary, 50) &&
    isTextArray(record.requiredWork, 50);
}

export function parseCaseSystemVNextTeachingObjectiveSelection(
  value: unknown,
): CaseSystemVNextTeachingObjectiveSelection {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["mode", "assessmentContext"]) ||
    !CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES.includes(record.mode as never)
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  if (record.mode === "exam_oriented") {
    if (!isAssessmentContext(record.assessmentContext)) {
      throw new BenchmarkConfigurationError("case_system_vnext_invalid");
    }
  } else if (record.assessmentContext !== undefined) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  return record as unknown as CaseSystemVNextTeachingObjectiveSelection;
}
