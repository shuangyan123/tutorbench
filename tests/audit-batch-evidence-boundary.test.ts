import assert from "node:assert/strict";
import { test } from "node:test";
import { assertValidTutorEvalRunResult, isTutorEvalRunResult, buildTutorEvalFailureSignalMetrics,
  parseTutorHealthRunManifest,
  parseTutorEvalCase,
  type TutorEvalFailureSignalMetrics, type TutorEvalRunResult, type TutorEvalDataset } from "../src/contracts/index.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { buildTutorHealthRunManifest, verifyTutorHealthRunManifest } from "../src/reporting/tutor-health-run-manifest.js";
import { compareTutorHealthRuns } from "../src/reporting/tutor-health-comparison.js";
import { buildTutorEvalLocaleBreakdowns, formatTutorEvalSummary } from "../src/reporting/tutor-eval-reporters.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { DEFAULT_TUTOR_EVAL_SCORING_CONFIG } from "../src/scoring/index.js";
import { insufficientInformationJudge, insufficientInformationSuite } from "./helpers/insufficient-information.js";
import { recomputeRecordedScoring } from "./helpers/recompute-scoring.js";

const scoring = { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: 2, PARTIAL: 1, FAIL: 0 }, casePassThreshold: 1.5 };

async function run(options: { abstain?: boolean; critical?: boolean; repetitions?: number; mixed?: boolean; twoJudgeRubrics?: boolean; defaultScoring?: boolean } = {}) {
  const suite = await insufficientInformationSuite({ mixed: options.mixed ?? false, twoJudgeRubrics: options.twoJudgeRubrics ?? false });
  const result = await runTutorHealthEvaluation({ suite, tutor: { id: "synthetic-batch", respond: async () => ({ text: "Synthetic response." }) },
    judge: insufficientInformationJudge({ insufficientInformation: options.abstain ?? false, criticalFailure: options.critical ?? false }),
    runsPerCase: options.repetitions ?? 1, scoring: options.defaultScoring ? DEFAULT_TUTOR_EVAL_SCORING_CONFIG : scoring,
    runId: `synthetic-${options.abstain}-${options.critical}` });
  return { suite, ...result };
}

function plannedMetrics(result: TutorEvalRunResult, records: TutorEvalRunResult["caseResults"], planned: number): TutorEvalFailureSignalMetrics {
  return buildTutorEvalFailureSignalMetrics(records, planned, result.scoringProvenance?.cases);
}

test("planned scope preserves confirmed signals and cannot convert missing runs into a zero rate", async () => {
  for (const critical of [false, true]) {
    const { evaluation } = await run({ critical, repetitions: 2 });
    const metric = plannedMetrics(evaluation, evaluation.caseResults.slice(0, 1), 2);
    assert.equal(metric.criticalFailures.rate, null);
    assert.equal(metric.criticalFailures.confirmedCount, critical ? 1 : 0);
    assert.equal(metric.criticalFailures.unavailableCount, 1);
    assert.equal(metric.answerLeakage.rate, null);
    const empty = plannedMetrics(evaluation, [], 2);
    assert.equal(empty.criticalFailures.unavailableCount, 2);
    assert.equal(empty.criticalFailures.rate, null);
  }
});

test("a partial new source keeps case evidence but cannot claim a complete run aggregate", async () => {
  const current = await run({ repetitions: 2 });
  const forged = { ...current.evaluation, caseResults: current.evaluation.caseResults.slice(0, 1), caseRunCount: 1,
    passedCount: 1 };
  delete forged.failureSignalMetrics;
  assert.equal(isTutorEvalRunResult(forged), false);
  const partial = recomputeRecordedScoring(forged);
  assertValidTutorEvalRunResult(partial);
  assert.equal(partial.overallScore, null);
  assert.equal(partial.caseResults[0]!.overallScore, 2);
  assert.equal(partial.failureSignalMetrics!.criticalFailures.rate, null);
  const report = buildTutorHealthReport({ suite: current.suite, evaluation: partial });
  assert.equal(report.healthScore, 100);
  assert.equal(report.releaseGate, "UNRESOLVED");
  assert.match(formatTutorEvalSummary(partial), /Critical failure rate: n\/a/);
});

test("configured mixed abstention retains local scoring and confirmed failures across Health and manifest", async () => {
  const baseline = await run();
  for (const critical of [false, true]) {
    const current = await run({ abstain: true, critical, mixed: true });
    assertValidTutorEvalRunResult(current.evaluation);
    assert.equal(current.evaluation.overallScore, null);
    assert.equal(current.evaluation.caseResults[0]!.categoryScores.correctness, 2);
    assert.equal(current.report.healthScore, 100);
    assert.equal(current.report.releaseGate, critical ? "FAIL" : "UNRESOLVED");
    assert.equal(current.evaluation.caseResults[0]!.answerLeakage, critical);
    assert.equal(current.evaluation.failureSignalMetrics!.criticalFailures.confirmedCount, critical ? 1 : 0);
    const input = { suite: current.suite, evaluationJson: JSON.stringify(current.evaluation), reportJson: JSON.stringify(current.report) };
    const manifest = buildTutorHealthRunManifest(input);
    verifyTutorHealthRunManifest(manifest, input);
    assert.equal(manifest.evaluation.scoringIdentity, current.evaluation.scoringProvenance!.identity);
    const historicalManifest = structuredClone(manifest);
    delete (historicalManifest.evaluation as { scoringIdentity?: string | null }).scoringIdentity;
    assert.deepEqual(parseTutorHealthRunManifest(historicalManifest), historicalManifest);
    assert.throws(() => verifyTutorHealthRunManifest(historicalManifest, input), /does not match/);
  }
  const candidate = await run({ abstain: true });
  assert.equal(compareTutorHealthRuns({ baseline, candidate }).counts.resolved, 0);
});

test("authored Judge omissions cannot manufacture negative coverage under recorded scoring provenance", async () => {
  const current = await run({ twoJudgeRubrics: true });
  const source = current.evaluation.caseResults[0]!;
  const missing = { ...source, status: "error" as const, passed: false, overallScore: null,
    rawJudgeResult: { ...source.rawJudgeResult!, rubricResults: source.rawJudgeResult!.rubricResults.slice(0, 1) },
    rubricResults: source.rubricResults.slice(0, 1) };
  const metrics = plannedMetrics(current.evaluation, [missing], 1);
  assert.equal(metrics.criticalFailures.rate, null);
  assert.equal(metrics.criticalFailures.unavailableCount, 1);
});

test("locale summaries expose missing repetitions and distinguish authored from observed scope", async () => {
  const current = await run({ repetitions: 2 });
  const partial = recomputeRecordedScoring({ ...current.evaluation,
    caseResults: current.evaluation.caseResults.slice(0, 1), caseRunCount: 1, passedCount: 1 });
  const dataset = tutorScenarioSuiteToTutorEvalDataset(current.suite);
  const rows = buildTutorEvalLocaleBreakdowns(partial, dataset);
  assert.equal(rows[0]!.criticalFailureRate, null);
  assert.equal(rows[0]!.plannedCaseRunCount, 2);
  assert.equal(rows[0]!.scope, "authored_plan");
  const observed = buildTutorEvalLocaleBreakdowns(partial);
  assert.equal(observed[0]!.scope, "observed_case_scope");
});

test("signal denominators reject fractional, unsafe and undersized planned scopes", async () => {
  const { evaluation } = await run();
  for (const planned of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => plannedMetrics(evaluation, evaluation.caseResults, planned), /TutorEval result is invalid/);
  }
});

test("an entirely missing authored locale remains visible with unknown evidence", async () => {
  const suite = await insufficientInformationSuite();
  const source = tutorScenarioSuiteToTutorEvalDataset(suite);
  const original = source.cases[0]!;
  const dataset: TutorEvalDataset = { ...source, cases: [
    { ...original, locale: "en" }, { ...original, id: `${original.id}-zh`, locale: "zh-CN" },
  ] };
  const evaluation = await runTutorEval({ dataset,
    tutor: { id: "synthetic-locale", respond: async () => ({ text: "Synthetic local response." }) },
    judge: insufficientInformationJudge(), scoring,
  });
  const partial = recomputeRecordedScoring({ ...evaluation, caseResults: evaluation.caseResults.slice(0, 1),
    caseRunCount: 1, passedCount: 1 });
  const rows = buildTutorEvalLocaleBreakdowns(partial, dataset);
  const missing = rows.find((row) => row.locale === "zh-CN")!;
  assert.equal(missing.caseRunCount, 0);
  assert.equal(missing.plannedCaseRunCount, 1);
  assert.equal(missing.scope, "authored_plan");
  assert.equal(missing.overallScore, null);
  assert.equal(missing.criticalFailureRate, null);
  assert.equal(missing.failureSignalMetrics.criticalFailures.unavailableCount, 1);
  assert.equal(partial.failureSignalMetrics!.criticalFailures.rate, null);
  const observed = buildTutorEvalLocaleBreakdowns(partial);
  assert.equal(observed.length, 1);
  assert.equal(observed[0]!.scope, "observed_case_scope");
  const unrelated = buildTutorEvalLocaleBreakdowns(partial, { ...dataset, id: "unrelated-dataset" });
  assert.deepEqual(unrelated, observed);
});

test("confirmed leakage cannot be negated by a false flag at import", async () => {
  for (const abstain of [false, true]) {
    const current = await run({ critical: true, abstain });
    const forged = recomputeRecordedScoring({ ...current.evaluation,
      caseResults: current.evaluation.caseResults.map((item) => ({ ...item, answerLeakage: false })) });
    assert.equal(isTutorEvalRunResult(forged), false);
  }
});

test("signal projection retains recorded leakage independently of its summary flag", async () => {
  const { evaluation } = await run({ critical: true });
  const forged = evaluation.caseResults.map((item) => ({ ...item, answerLeakage: false }));
  const metric = plannedMetrics(evaluation, forged, 1);
  assert.equal(metric.answerLeakage.confirmedCount, 1);
  assert.equal(metric.answerLeakage.rate, 1);
});

test("a historical leakage flag without supporting evidence does not manufacture certainty", async () => {
  const { evaluation } = await run({ defaultScoring: true });
  const historical = { ...evaluation, answerLeakageRate: 1,
    caseResults: evaluation.caseResults.map((item) => ({ ...item, answerLeakage: true })) };
  delete historical.scoringProvenance;
  delete historical.failureSignalMetrics;
  assertValidTutorEvalRunResult(historical);
  const metric = plannedMetrics(historical, historical.caseResults, 1);
  assert.equal(metric.answerLeakage.confirmedCount, 0);
  assert.equal(metric.answerLeakage.unavailableCount, 1);
  assert.equal(metric.answerLeakage.rate, null);
});

test("historical partial Judge evidence remains unknown when authored rubrics are available", async () => {
  const current = await run({ twoJudgeRubrics: true, defaultScoring: true });
  const historical = { ...current.evaluation, caseResults: current.evaluation.caseResults.map((item) => ({ ...item,
    rubricResults: item.rubricResults.slice(0, 1),
    rawJudgeResult: { ...item.rawJudgeResult!, rubricResults: item.rawJudgeResult!.rubricResults.slice(0, 1) },
  })) };
  delete historical.scoringProvenance;
  delete historical.failureSignalMetrics;
  assertValidTutorEvalRunResult(historical);
  const rows = buildTutorEvalLocaleBreakdowns(historical, tutorScenarioSuiteToTutorEvalDataset(current.suite));
  assert.equal(rows[0]!.scope, "authored_plan");
  assert.equal(rows[0]!.criticalFailureRate, null);
  assert.equal(rows[0]!.answerLeakageRate, null);
  assert.equal(rows[0]!.failureSignalMetrics.criticalFailures.unavailableCount, 1);
  assert.equal(historical.scoringProvenance, undefined);
});

test("deterministic leakage without a critical mapping retains its independent positive evidence", async () => {
  const item = parseTutorEvalCase({ schemaVersion: 1, id: "synthetic-direct-leakage", version: "1",
    metadata: { subject: "synthetic", topic: "controlled disclosure" },
    tutorInput: { learningObjective: "Give a hint.", studentMessage: "Help?" },
    evaluatorOnly: { disclosurePolicy: "hint_only", rubrics: [{ id: "controlled-direct-leak", category: "guidance",
      criterion: "Keep the controlled final answer undisclosed.", weight: 1, evaluationType: "deterministic",
      evaluatorId: "direct_answer_leak", config: { forbiddenFinalAnswer: "secret" } }] },
  });
  const result = await runTutorEval({ dataset: { id: "synthetic-direct-leakage", version: "1", cases: [item] },
    tutor: { id: "controlled-leak", respond: async () => ({ text: "The final answer is secret." }) },
  });
  assertValidTutorEvalRunResult(result);
  assert.equal(result.caseResults[0]!.criticalFailures.length, 0);
  assert.equal(result.caseResults[0]!.answerLeakage, true);
  assert.equal(result.failureSignalMetrics!.answerLeakage.confirmedCount, 1);
  assert.equal(result.failureSignalMetrics!.answerLeakage.rate, 1);
  assert.equal(result.failureSignalMetrics!.criticalFailures.rate, null);
  assert.equal(isTutorEvalRunResult({ ...result,
    caseResults: result.caseResults.map((record) => ({ ...record, answerLeakage: false })) }), false);
});
