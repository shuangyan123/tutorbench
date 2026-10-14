import assert from "node:assert/strict";
import { test } from "node:test";

import { BenchmarkConfigurationError, TutorHealthComparisonError, parseTutorScenarioSuiteVNext, parseTutorEvalJudgeResult, TUTOR_EVAL_EVALUATOR_VERSION,
  type TutorEvalCaseRunResult, type TutorEvalRunResult, type TutorScenarioSuiteVNext } from "../src/contracts/index.js";
import { assertValidTutorEvalRunResult, isTutorEvalRunResult } from "../src/contracts/tutor-eval-result-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { runTutorEval, type TutorEvalJudgeRunOptions } from "../src/runner/tutor-eval-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { compareTutorHealthRuns } from "../src/reporting/tutor-health-comparison.js";
import { buildTutorHealthRunManifest, verifyTutorHealthRunManifest } from "../src/reporting/tutor-health-run-manifest.js";
import { insufficientInformationJudge, insufficientInformationSuite } from "./helpers/insufficient-information.js";
import { recomputeRecordedScoring } from "./helpers/recompute-scoring.js";

const isSourceError = (error: unknown) => error instanceof BenchmarkConfigurationError &&
  (error.code === "tutor_eval_result_invalid" || error.code === "tutor_health_report_source_mismatch");

function evaluate(suite: TutorScenarioSuiteVNext, judge: TutorEvalJudgeRunOptions, text = "Synthetic response.", runId = "integration") {
  return runTutorEval({ dataset: tutorScenarioSuiteToTutorEvalDataset(suite),
    tutor: { id: "controlled-synthetic", respond: async () => ({ text }) }, judge, runId,
  });
}

function withCase(evaluation: TutorEvalRunResult, changes: Partial<TutorEvalCaseRunResult>): TutorEvalRunResult {
  const caseResults = [{ ...evaluation.caseResults[0]!, ...changes }];
  return { ...evaluation, caseResults, passedCount: caseResults.filter((item) => item.status === "passed").length,
    failedCount: caseResults.filter((item) => item.status === "failed").length,
    errorCount: caseResults.filter((item) => item.status === "error").length };
}

function reportChain(suite: TutorScenarioSuiteVNext, evaluation: TutorEvalRunResult) {
  assertValidTutorEvalRunResult(evaluation);
  const report = buildTutorHealthReport({ suite, evaluation });
  const input = { suite, evaluationJson: JSON.stringify(evaluation), reportJson: JSON.stringify(report) };
  const manifest = buildTutorHealthRunManifest(input);
  verifyTutorHealthRunManifest(manifest, input);
  return { suite, evaluation, report };
}

function assertRejectedByReports(evaluation: TutorEvalRunResult, reference: ReturnType<typeof reportChain>) {
  const { suite, report } = reference;
  assert.throws(() => buildTutorHealthReport({ suite, evaluation }), isSourceError);
  assert.throws(() => buildTutorHealthRunManifest({ suite,
    evaluationJson: JSON.stringify(evaluation), reportJson: JSON.stringify(report),
  }), { code: "tutor_health_run_manifest_invalid" });
  assert.throws(() => compareTutorHealthRuns({ baseline: reference, candidate: { suite, evaluation, report } }),
    (error: unknown) => isSourceError(error) || error instanceof TutorHealthComparisonError);
}

test("combined normal Judge PASS/PARTIAL/FAIL retains normalization and complete evidence", async () => {
  const suite = await insufficientInformationSuite();
  for (const [result, score] of [["PASS", 1], ["PARTIAL", 0.5], ["FAIL", 0]] as const) {
    const run = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ result })));
    assert.equal(run.evaluation.evaluatorVersion, "0.3a.5");
    assert.equal(run.evaluation.caseResults[0]!.rubricResults[0]!.score, score);
    assert.equal(run.report.healthScore, score * 100);
    assert.equal(run.report.unresolved.length, 0);
    assert.notEqual(run.report.releaseGate, "UNRESOLVED");
  }
});

test("combined structured abstention permits each raw status only as normalized ERROR/null", async () => {
  const suite = await insufficientInformationSuite();
  for (const result of ["PASS", "PARTIAL", "FAIL"] as const) {
    const run = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ result, insufficientInformation: true })));
    const first = run.evaluation.caseResults[0]!;
    assert.equal(first.rawJudgeResult!.rubricResults[0]!.result, result);
    assert.equal(first.rubricResults[0]!.result, "ERROR");
    assert.equal(first.rubricResults[0]!.score, null);
    assert.ok(Object.values(first.categoryScores).every((score) => score === null));
    assert.equal(run.evaluation.overallScore, null);
    assert.equal(run.report.healthScore, null);
    assert.equal(run.report.findings.length, 0);
    assert.equal(run.report.releaseGate, "UNRESOLVED");
  }
});

test("abstention cannot bless flag/status/score/count or case/run identity contradictions", async () => {
  const suite = await insufficientInformationSuite();
  const evaluation = await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }));
  const first = evaluation.caseResults[0]!;
  const invalid = [
    withCase(evaluation, { rawJudgeResult: { ...first.rawJudgeResult!, insufficientInformation: false } }),
    withCase(evaluation, { status: "passed", passed: true, overallScore: 1 }),
    withCase(evaluation, { passed: true }),
    withCase(evaluation, { rawJudgeResult: { ...first.rawJudgeResult!, caseId: "forged-case" } }),
    withCase(evaluation, { runIndex: 2 }),
    withCase(evaluation, { categoryScores: { ...first.categoryScores, guidance: 1 } }),
    withCase(evaluation, { qualityGate: "FAIL" }),
    withCase(evaluation, { rubricResults: first.rubricResults.map((item) => ({ ...item, result: "PASS", score: 1 })) }),
    { ...evaluation, errorCount: 0, passedCount: 1 },
    { ...evaluation, overallScore: 1 },
    { ...evaluation, categoryScores: { ...evaluation.categoryScores, guidance: 1 } },
    { ...evaluation, caseResults: [first, first], runsPerCase: 2, caseRunCount: 2, errorCount: 2 },
  ];
  for (const forged of invalid) assert.equal(isTutorEvalRunResult(forged), false);
  const complete = await evaluate(suite, insufficientInformationJudge());
  assert.equal(isTutorEvalRunResult(withCase(complete, { rawJudgeResult: {
    ...complete.caseResults[0]!.rawJudgeResult!, insufficientInformation: true,
  } })), false);
});

test("authored Judge rubric collection rejects omitted, unexpected and co-renamed IDs", async () => {
  const suite = await insufficientInformationSuite({ twoJudgeRubrics: true });
  const reference = reportChain(suite, await evaluate(suite, insufficientInformationJudge()));
  const evaluation = await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }));
  const first = evaluation.caseResults[0]!;
  const forged = [
    withCase(evaluation, { rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: first.rawJudgeResult!.rubricResults.slice(1) } }),
    withCase(evaluation, { rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: [] } }),
    withCase(evaluation, { rubricResults: first.rubricResults.map((item) => ({ ...item, rubricId: `forged-${item.rubricId}` })),
      rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: first.rawJudgeResult!.rubricResults.map((item) => ({ ...item, rubricId: `forged-${item.rubricId}` })) } }),
  ];
  for (const input of forged) assertRejectedByReports(input, reference);
});

test("authored ownership rejects raw Judge evidence mapped onto a deterministic rubric", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  const reference = reportChain(suite, await evaluate(suite, insufficientInformationJudge()));
  const evaluation = await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }));
  const first = evaluation.caseResults[0]!;
  const forged = withCase(evaluation, { categoryScores: { ...first.categoryScores, correctness: null },
    rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: first.rawJudgeResult!.rubricResults.map((item) => ({ ...item, rubricId: "controlled-nonempty" })) },
    rubricResults: first.rubricResults.map((item) => ({ ...item, result: "ERROR", score: null })),
  });
  assertRejectedByReports(forged, reference);
  const masked = withCase(evaluation, { categoryScores: { ...first.categoryScores, correctness: null },
    rubricResults: first.rubricResults.map((item) => item.rubricId === "controlled-nonempty"
      ? { ...item, result: "ERROR", score: null, diagnostics: first.rubricResults[0]!.diagnostics } : item),
  });
  assertRejectedByReports(masked, reference);
});

test("mixed same-category abstention retains deterministic PASS and FAIL evidence", async () => {
  const original = await insufficientInformationSuite({ mixed: true });
  const scenario = original.scenarios[0]!;
  const point = scenario.decisionPoints[0]!;
  const judgeCriterion = point.evaluationCriteria[0]!;
  const suite = parseTutorScenarioSuiteVNext({ ...original, scenarios: [{ ...scenario,
    decisionPoints: [{ ...point, evaluationCriteria: point.evaluationCriteria.map((item) => item.evaluationType === "deterministic"
      ? { ...item, category: judgeCriterion.category, dimension: judgeCriterion.dimension } : item) }],
  }] });
  for (const text of ["Synthetic response.", ""]) {
    const run = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }), text));
    assert.equal(run.evaluation.caseResults[0]!.categoryScores[judgeCriterion.category], text ? 1 : 0);
    assert.equal(run.report.healthScore, text ? 100 : 0);
    assert.equal(run.report.findings.length, text ? 0 : 1);
    assert.equal(run.report.releaseGate, "UNRESOLVED");
  }
});

test("mixed distinct categories retain only the independently scored category", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  const run = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true })));
  assert.equal(run.evaluation.caseResults[0]!.categoryScores.correctness, 1);
  assert.equal(run.evaluation.caseResults[0]!.categoryScores.guidance, null);
  assert.equal(run.report.healthScore, 100);
  assert.equal(run.report.releaseGate, "UNRESOLVED");
});

test("raw critical and factual failures survive abstention and still block release", async () => {
  const suite = await insufficientInformationSuite();
  const judge = insufficientInformationJudge({ insufficientInformation: true, criticalFailure: true });
  const evaluation = await evaluate(suite, { ...judge, evaluate: async (input) => ({ ...parseTutorEvalJudgeResult(await judge.evaluate!(input)),
    factualErrors: [{ severity: "critical", description: "Controlled synthetic factual signal." }],
  }) });
  const run = reportChain(suite, evaluation);
  assert.equal(run.report.releaseGate, "FAIL");
  assert.ok(run.report.findings.some((item) => item.type === "answer_leakage"));
  assert.ok(run.report.findings.some((item) => item.type === "severe_factual_error"));
  assert.equal(run.report.healthScore, null);
});

test("deterministic critical failure and highest-severity deduplication remain source-bound", async () => {
  const suite = await insufficientInformationSuite({ mixed: true, criticalDeterministic: true });
  const judge = insufficientInformationJudge({ insufficientInformation: true });
  for (const higherJudgeSeverity of [false, true]) {
    const evaluation = await evaluate(suite, { ...judge, evaluate: async (input) => ({ ...parseTutorEvalJudgeResult(await judge.evaluate!(input)),
      criticalFailures: higherJudgeSeverity ? [{ type: "instruction_violation", severity: "critical", evidence: "Controlled higher-severity raw signal." }] : [],
    }) }, "");
    const run = reportChain(suite, evaluation);
    assert.equal(run.report.releaseGate, "FAIL");
    assert.equal(evaluation.caseResults[0]!.criticalFailures.length, 1);
    assert.equal(evaluation.caseResults[0]!.criticalFailures[0]!.severity, higherJudgeSeverity ? "critical" : "major");
    const dropped = withCase(evaluation, { criticalFailures: [] });
    assert.throws(() => buildTutorHealthReport({ suite, evaluation: dropped }), isSourceError);
  }
});

test("abstention rejects fabricated, upgraded or rewritten normalized critical failures", async () => {
  const suite = await insufficientInformationSuite();
  const reference = reportChain(suite, await evaluate(suite, insufficientInformationJudge()));
  const evaluation = await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true, criticalFailure: true }));
  const failure = evaluation.caseResults[0]!.criticalFailures[0]!;
  for (const criticalFailures of [[], [{ ...failure, severity: "minor" as const }],
    [{ ...failure, severity: "critical" as const }], [{ ...failure, evidence: "Forged synthetic source text." }],
    [failure, { type: "instruction_violation" as const, severity: "major" as const, evidence: "No authored or raw source." }],
  ]) assertRejectedByReports(withCase(evaluation, { criticalFailures }), reference);
});

test("genuinely missing normalized evidence remains unresolved and cannot resolve Findings", async () => {
  const suite = await insufficientInformationSuite();
  const baseline = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ result: "FAIL" }), undefined, "baseline"));
  const evaluation = await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }), undefined, "candidate");
  const partial = reportChain(suite, recomputeRecordedScoring(withCase(evaluation, { rubricResults: [] })));
  assert.equal(partial.report.releaseGate, "UNRESOLVED");
  assert.ok(partial.report.unresolved.some((item) => item.reason === "missing_rubric_result"));
  assert.equal(compareTutorHealthRuns({ baseline, candidate: partial }).counts.resolved, 0);
});

test("abstaining candidates cannot resolve baseline Findings and detached reports fail manifests", async () => {
  const suite = await insufficientInformationSuite();
  const baseline = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ result: "FAIL" }), undefined, "baseline"));
  const candidate = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ insufficientInformation: true }), undefined, "candidate"));
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.equal(comparison.counts.resolved, 0);
  assert.equal(comparison.counts.unresolved, 1);
  const complete = reportChain(suite, await evaluate(suite, insufficientInformationJudge(), undefined, "complete"));
  const detached = { ...complete.report, sourceEvaluation: candidate.report.sourceEvaluation };
  assert.throws(() => buildTutorHealthRunManifest({ suite, evaluationJson: JSON.stringify(candidate.evaluation),
    reportJson: JSON.stringify(detached),
  }), { code: "tutor_health_run_manifest_invalid" });
  assert.throws(() => compareTutorHealthRuns({ baseline, candidate: { ...candidate, report: detached } }), /report_source_mismatch/);
});

test("historical v1 optional fields and finite run aggregate parsing remain compatible", async () => {
  assert.equal(TUTOR_EVAL_EVALUATOR_VERSION, "0.3a.5");
  const suite = await insufficientInformationSuite();
  const evaluation = await evaluate(suite, insufficientInformationJudge());
  assert.equal(buildTutorHealthReport({ suite, evaluation }).releaseGate, "PASS");
  const legacy = JSON.parse(JSON.stringify(evaluation)) as Record<string, unknown>;
  delete legacy.evaluatorVersion;
  delete legacy.scoringProvenance;
  for (const item of legacy.caseResults as Record<string, unknown>[]) { delete item.locale; delete item.judgeMetrics; }
  for (const overallScore of [2, -0.25, 1, null]) assertValidTutorEvalRunResult({ ...legacy, overallScore });
  assertValidTutorEvalRunResult(legacy);
  const historicalReport = buildTutorHealthReport({ suite, evaluation: legacy });
  assert.equal(historicalReport.releaseGate, "UNRESOLVED");
  assert.equal(historicalReport.sourceEvaluation.scoringIdentity, null);
});

test("transport errors retain their separate unresolved diagnostics without structured abstention", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  const run = reportChain(suite, await evaluate(suite, insufficientInformationJudge({ transportError: true })));
  assert.equal(run.evaluation.caseResults[0]!.rawJudgeResult, null);
  assert.equal(run.evaluation.caseResults[0]!.categoryScores.correctness, 1);
  assert.equal(run.report.releaseGate, "UNRESOLVED");
  assert.equal(run.report.unresolved[0]!.reason, "evaluation_error");
});
