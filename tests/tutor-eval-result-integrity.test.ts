import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTutorHealthRunManifest,
  compareTutorHealthRuns,
  runTutorEval,
  runTutorHealthEvaluation,
  type TutorEvalCaseRunResult,
  type TutorEvalRunResult,
} from "../src/index.js";
import { BenchmarkConfigurationError } from "../src/contracts/errors.js";
import { assertValidTutorEvalRunResult, isTutorEvalRunResult } from "../src/contracts/tutor-eval-result-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { DEFAULT_TUTOR_EVAL_SCORING_CONFIG } from "../src/scoring/index.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";
import { recomputeRecordedScoring } from "./helpers/recompute-scoring.js";

function replaceCases(evaluation: TutorEvalRunResult, caseResults: readonly TutorEvalCaseRunResult[]): TutorEvalRunResult {
  return { ...evaluation, caseResults, caseRunCount: caseResults.length,
    passedCount: caseResults.filter((item) => item.status === "passed").length,
    failedCount: caseResults.filter((item) => item.status === "failed").length,
    errorCount: caseResults.filter((item) => item.status === "error").length };
}

test("import and report reject FAIL/score contradictions without changing the source", async () => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const forged = replaceCases(baseline.evaluation, baseline.evaluation.caseResults.map((item) => ({ ...item,
    rubricResults: item.rubricResults.map((rubric) => rubric.result === "FAIL" ? { ...rubric, score: 1 } : rubric),
  })));
  const bytes = JSON.stringify(forged);
  assert.equal(isTutorEvalRunResult(forged), false);
  assert.throws(() => assertValidTutorEvalRunResult(forged), /invalid/);
  assert.throws(() => buildTutorHealthReport({ suite: baseline.suite, evaluation: forged }), /invalid/);
  assert.equal(JSON.stringify(forged), bytes);
});

test("case status, passed flag, ERROR score and summary counts must agree", async (t) => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const evaluation = baseline.evaluation;
  const first = evaluation.caseResults[0]!;
  const invalid: Record<string, TutorEvalRunResult> = {
    "passed flag": replaceCases(evaluation, [{ ...first, passed: !first.passed }, ...evaluation.caseResults.slice(1)]),
    "error marked passed": replaceCases(evaluation, [{ ...first, status: "error", passed: true, overallScore: null }, ...evaluation.caseResults.slice(1)]),
    "invented summary counts": { ...evaluation, passedCount: evaluation.caseRunCount, failedCount: 0 },
    "passed with failed gate": replaceCases(evaluation, [{ ...first, status: "passed", passed: true, qualityGate: "FAIL" }, ...evaluation.caseResults.slice(1)]),
    "ERROR rubric with numeric score": replaceCases(evaluation, [{ ...first, status: "error", passed: false, overallScore: null,
      rawJudgeResult: null, rubricResults: first.rubricResults.map((rubric) => ({ ...rubric, result: "ERROR", score: 1 })),
    }, ...evaluation.caseResults.slice(1)]),
    "nonfinite overall score": { ...evaluation, overallScore: Number.POSITIVE_INFINITY },
  };
  for (const [name, value] of Object.entries(invalid)) await t.test(name, () => {
    assert.equal(isTutorEvalRunResult(value), false);
  });
});

test("raw Judge FAIL cannot become normalized PASS or a resolved Finding", async () => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const forged: TutorEvalRunResult = { ...baseline.evaluation, runId: "synthetic-forged-candidate",
    passedCount: baseline.evaluation.caseRunCount, failedCount: 0, errorCount: 0, overallScore: 1,
    caseResults: baseline.evaluation.caseResults.map((item) => ({ ...item,
      status: "passed", passed: true, qualityGate: "PASS", overallScore: 1,
      rubricResults: item.rubricResults.map((rubric) => ({ ...rubric, result: "PASS", score: 1 })),
      categoryScores: { ...item.categoryScores, guidance: 1 },
    })),
  };
  assert.throws(() => {
    const report = buildTutorHealthReport({ suite: baseline.suite, evaluation: forged });
    const comparison = compareTutorHealthRuns({ baseline, candidate: { ...baseline, evaluation: forged, report } });
    // 基线漏洞会产生两个 resolved；修复后必须在消费矛盾证据之前拒绝。
    assert.equal(comparison.counts.resolved, 2);
  }, /invalid/);
});

test("duplicate, conflicting-version and out-of-range case/run identities fail import", async (t) => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const evaluation = baseline.evaluation;
  const first = evaluation.caseResults[0]!;
  const invalid = {
    duplicate: replaceCases(evaluation, [first, first, ...evaluation.caseResults.slice(2)]),
    "out of range run": replaceCases(evaluation, [{ ...first, runIndex: 2 }, ...evaluation.caseResults.slice(1)]),
    "exceeded case scope": { ...evaluation, caseCount: 1 },
    "conflicting version": { ...replaceCases(evaluation, [first, { ...first, caseVersion: "other", runIndex: 2 }, ...evaluation.caseResults.slice(1)]), runsPerCase: 2 },
    "raw Judge case identity": replaceCases(evaluation, [{ ...first, rawJudgeResult: { ...first.rawJudgeResult!, caseId: "other-case" } }, ...evaluation.caseResults.slice(1)]),
  };
  for (const [name, value] of Object.entries(invalid)) await t.test(name, () => {
    assert.equal(isTutorEvalRunResult(value), false);
  });
});

test("a manifest cannot bless contradictory evaluation bytes or a detached report", async () => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const contradictory = { ...baseline.evaluation, passedCount: baseline.evaluation.caseRunCount, failedCount: 0 };
  const input = { suite: baseline.suite, evaluationJson: JSON.stringify(contradictory), reportJson: JSON.stringify(baseline.report) };
  assert.throws(() => buildTutorHealthRunManifest(input), /manifest.*invalid/);
  const detached = { ...candidate.report, sourceEvaluation: baseline.report.sourceEvaluation };
  assert.throws(() => buildTutorHealthRunManifest({ ...input,
    evaluationJson: JSON.stringify(baseline.evaluation), reportJson: JSON.stringify(detached),
  }), /manifest.*invalid/);
});

test("raw critical/factual failures cannot be dropped or downgraded during normalization", async () => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const first = baseline.evaluation.caseResults[0]!;
  const rawJudgeResult = { ...first.rawJudgeResult!,
    criticalFailures: [{ type: "answer_leakage" as const, severity: "major" as const, evidence: "Controlled synthetic signal." }],
    factualErrors: [{ severity: "critical" as const, description: "Controlled synthetic factual signal." }],
  };
  const altered = { ...first, rawJudgeResult };
  assert.equal(isTutorEvalRunResult(replaceCases(baseline.evaluation, [altered, ...baseline.evaluation.caseResults.slice(1)])), false);
  const consistent = { ...altered, answerLeakage: true, criticalFailures: [
    { type: "answer_leakage" as const, severity: "critical" as const, evidence: "Highest severity after deduplication." },
    { type: "severe_factual_error" as const, severity: "critical" as const, evidence: "Controlled synthetic factual signal." },
  ] };
  const consistentEvaluation = recomputeRecordedScoring(replaceCases(baseline.evaluation, [consistent, ...baseline.evaluation.caseResults.slice(1)]));
  assertValidTutorEvalRunResult(consistentEvaluation);
  assert.equal(consistentEvaluation.caseResults[0]!.qualityGate, "FAIL");
  assert.equal(consistentEvaluation.caseResults[0]!.answerLeakage, true);
  assert.equal(isTutorEvalRunResult(replaceCases(baseline.evaluation, [{ ...consistent,
    criticalFailures: consistent.criticalFailures.map((item) => ({ ...item, severity: "minor" })),
  }, ...baseline.evaluation.caseResults.slice(1)])), false);
});

test("missing raw Judge evidence stays readable but cannot imply assessed/resolved evidence", async () => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const evaluation = recomputeRecordedScoring(replaceCases(candidate.evaluation, candidate.evaluation.caseResults.map((item) => ({ ...item, rawJudgeResult: null }))));
  assert.equal(isTutorEvalRunResult(evaluation), true);
  const report = buildTutorHealthReport({ suite: candidate.suite, evaluation });
  assert.equal(report.releaseGate, "UNRESOLVED");
  assert.equal(report.healthScore, null);
  assert.equal(report.findings.length, 0);
  const comparison = compareTutorHealthRuns({ baseline, candidate: { ...candidate, evaluation, report } });
  assert.equal(comparison.counts.resolved, 0);
  assert.equal(comparison.counts.unresolved, 4);
  const missingJudgments = recomputeRecordedScoring(replaceCases(candidate.evaluation, candidate.evaluation.caseResults.map((item) => ({ ...item,
    rawJudgeResult: { ...item.rawJudgeResult!, rubricResults: [] },
  }))));
  assert.equal(buildTutorHealthReport({ suite: candidate.suite, evaluation: missingJudgments }).releaseGate, "UNRESOLVED");
  const missingTutor = recomputeRecordedScoring(replaceCases(candidate.evaluation, candidate.evaluation.caseResults.map((item) => ({ ...item, rawTutorResponse: null }))));
  assert.equal(buildTutorHealthReport({ suite: candidate.suite, evaluation: missingTutor }).healthScore, null);
});

test("a Judge error preserves completed deterministic FAIL evidence in the same case", async () => {
  const { suite } = await syntheticDesignPartnerPilot();
  const scenario = suite.scenarios[0]!;
  const point = scenario.decisionPoints[0]!;
  const criterion = point.evaluationCriteria[0]!;
  const mixed = { ...suite, scenarios: [{ ...scenario, decisionPoints: [{ ...point,
    evaluationCriteria: [criterion, { ...criterion, rubricId: "controlled-empty-response",
      evaluationType: "deterministic" as const, evaluatorId: "empty_response" as const }],
  }] }] };
  const { evaluation, report } = await runTutorHealthEvaluation({ suite: mixed,
    tutor: { id: "controlled-synthetic", respond: async () => ({ text: "" }) },
    judge: { provider: "synthetic", model: "fixture", promptVersion: "1", evaluate: async () => { throw new Error("Controlled synthetic error."); } },
  });
  assert.equal(evaluation.caseResults[0]!.status, "error");
  assert.equal(evaluation.caseResults[0]!.rubricResults.find((item) => item.rubricId === "controlled-empty-response")!.result, "FAIL");
  assert.equal(report.findings.length, 1);
  assert.equal(report.unresolved.length, 1);
  assert.equal(report.releaseGate, "UNRESOLVED");
});

test("authored rubric metadata and Judge ownership are bound at the report boundary", async (t) => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const evaluation = baseline.evaluation;
  const first = evaluation.caseResults[0]!;
  const unexpectedJudge = replaceCases(evaluation, [{ ...first, rawJudgeResult: { ...first.rawJudgeResult!,
    rubricResults: [...first.rawJudgeResult!.rubricResults, { rubricId: "not-authored", result: "PASS" }],
  } }, ...evaluation.caseResults.slice(1)]);
  assert.throws(() => buildTutorHealthReport({ suite: baseline.suite, evaluation: unexpectedJudge }),
    (error: unknown) => error instanceof BenchmarkConfigurationError && error.code === "tutor_eval_result_invalid");
  for (const [name, rubricResults] of Object.entries({
    weight: first.rubricResults.map((rubric) => ({ ...rubric, weight: 100 })),
    category: first.rubricResults.map((rubric) => ({ ...rubric, category: "correctness" as const })),
    identity: first.rubricResults.map((rubric) => ({ ...rubric, rubricId: "not-authored" })),
    critical: first.rubricResults.map((rubric) => ({ ...rubric, critical: true })),
  })) await t.test(name, () => {
    assert.throws(() => buildTutorHealthReport({ suite: baseline.suite,
      evaluation: replaceCases(evaluation, [{ ...first, rubricResults }, ...evaluation.caseResults.slice(1)]),
    }), (error: unknown) => error instanceof BenchmarkConfigurationError &&
      error.code === (name === "critical" ? "tutor_health_report_source_mismatch" : "tutor_eval_result_invalid"));
  });
});

test("valid v1 optional fields, partial scope and custom scoring remain compatible", async () => {
  const { baseline, suite } = await syntheticDesignPartnerPilot();
  const legacy = JSON.parse(JSON.stringify(baseline.evaluation)) as Record<string, unknown>;
  delete legacy.evaluatorVersion;
  delete legacy.scoringProvenance;
  for (const item of legacy.caseResults as Record<string, unknown>[]) { delete item.locale; delete item.judgeMetrics; }
  assertValidTutorEvalRunResult(legacy);
  assert.doesNotThrow(() => buildTutorHealthReport({ suite, evaluation: legacy }));
  const partial = recomputeRecordedScoring(replaceCases(baseline.evaluation, baseline.evaluation.caseResults.slice(1)));
  assertValidTutorEvalRunResult(partial);
  assert.ok(buildTutorHealthReport({ suite, evaluation: partial }).unresolved.length > 0);
  const custom = await runTutorEval({ dataset: tutorScenarioSuiteToTutorEvalDataset(suite),
    tutor: { id: "controlled-synthetic", respond: async () => ({ text: "Check the next step." }) },
    judge: { provider: "synthetic", model: "fixture", promptVersion: "1", evaluate: async (input) => ({
      schemaVersion: 1, caseId: input.caseId, rubricResults: input.rubrics.map((rubric) => ({ rubricId: rubric.id, result: "PASS" })),
      criticalFailures: [], factualErrors: [], insufficientInformation: false,
    }) },
    scoring: { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: 0.8, PARTIAL: 0.4, FAIL: 0.1 } },
  });
  assert.equal(custom.overallScore, 0.8);
  assert.equal(custom.caseResults[0]!.rubricResults[0]!.score, 1);
  assertValidTutorEvalRunResult(custom);
  const inconsistentDuplicate = replaceCases(custom, custom.caseResults.map((item, index) => index === 0 ? { ...item,
    rawJudgeResult: null, rubricResults: [...item.rubricResults, { ...item.rubricResults[0]!, result: "FAIL", score: 0 }],
  } : item));
  assert.equal(isTutorEvalRunResult(inconsistentDuplicate), false);
});
