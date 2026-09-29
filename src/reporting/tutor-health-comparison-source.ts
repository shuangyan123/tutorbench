import { createHash } from "node:crypto";

import { assertValidTutorEvalRunResult } from "../contracts/tutor-eval-result-validation.js";
import { TUTOR_EVAL_EVALUATOR_VERSION } from "../contracts/tutor-eval.js";
import type { TutorEvalRunResult } from "../contracts/result.js";
import { parseTutorHealthReport } from "../contracts/tutor-health-validation.js";
import type { TutorHealthReport } from "../contracts/tutor-health.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";
import { TutorHealthComparisonError, type TutorHealthComparisonSource } from "../contracts/tutor-health-comparison.js";
import { isTutorHealthComparisonDescriptor, tutorHealthComparisonJson } from "../contracts/tutor-health-comparison-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../datasets/real-world.js";
import { buildTutorHealthReport } from "./tutor-health-reporters.js";

export interface TutorHealthComparisonInput {
  readonly suite: TutorScenarioSuiteVNext;
  readonly evaluation: TutorEvalRunResult;
  readonly report: TutorHealthReport;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(tutorHealthComparisonJson(value)).digest("hex");
}

export function validateTutorHealthComparisonSource(input: TutorHealthComparisonInput): TutorHealthComparisonSource {
  const suite = parseTutorScenarioSuiteVNext(input.suite);
  const report = parseTutorHealthReport(input.report);
  const evaluation = input.evaluation;
  assertValidTutorEvalRunResult(evaluation);
  if (evaluation.evaluatorVersion !== TUTOR_EVAL_EVALUATOR_VERSION) {
    throw new TutorHealthComparisonError("missing_or_unsupported_evaluator_version");
  }
  if (!isTutorHealthComparisonDescriptor(evaluation.tutor, false) ||
      (evaluation.judge !== null && !isTutorHealthComparisonDescriptor(evaluation.judge, true))) {
    throw new TutorHealthComparisonError("execution_descriptor");
  }
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  if (evaluation.caseCount !== dataset.cases.length || evaluation.runsPerCase > 10_000 ||
      evaluation.passedCount !== evaluation.caseResults.filter((item) => item.status === "passed").length ||
      evaluation.failedCount !== evaluation.caseResults.filter((item) => item.status === "failed").length ||
      evaluation.errorCount !== evaluation.caseResults.filter((item) => item.status === "error").length) {
    throw new TutorHealthComparisonError("evaluation_scope");
  }
  for (const result of evaluation.caseResults) {
    const authored = dataset.cases.find((item) => item.id === result.caseId);
    if (authored === undefined || result.caseVersion !== authored.version || result.runIndex > evaluation.runsPerCase ||
        result.locale === undefined || result.locale !== (authored.locale ?? "en")) {
      throw new TutorHealthComparisonError("case_identity_or_locale");
    }
    for (const rubric of result.rubricResults) {
      const expected = authored.evaluatorOnly.rubrics.find((item) => item.id === rubric.rubricId);
      if (expected === undefined || rubric.category !== expected.category || rubric.weight !== expected.weight ||
          rubric.critical !== (expected.critical ?? false)) {
        throw new TutorHealthComparisonError("rubric_configuration");
      }
    }
    if (evaluation.judge === null && result.rawJudgeResult !== null) {
      throw new TutorHealthComparisonError("missing_judge_identity");
    }
  }
  // 重建仅用于核对来源；不改写已保存的 evaluation 或 report。
  const rebuilt = buildTutorHealthReport({ suite, evaluation, scoringProfile: report.scoringProfile });
  if (tutorHealthComparisonJson(rebuilt) !== tutorHealthComparisonJson(report)) {
    throw new TutorHealthComparisonError("report_source_mismatch");
  }
  return structuredClone({
    suite: { ...report.sourceScenarioSuite, sha256: sha256(suite) },
    evaluation: { ...report.sourceEvaluation, evaluatorVersion: evaluation.evaluatorVersion,
      createdAt: evaluation.createdAt, sha256: sha256(evaluation) },
    report: { schemaVersion: report.schemaVersion, sha256: sha256(report) },
    tutor: evaluation.tutor,
    judge: evaluation.judge,
    scoringProfile: report.scoringProfile,
    runsPerCase: evaluation.runsPerCase,
  });
}
