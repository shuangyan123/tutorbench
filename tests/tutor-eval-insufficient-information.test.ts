import assert from "node:assert/strict";
import { test } from "node:test";

import { assertValidTutorEvalRunResult, isTutorEvalRunResult } from "../src/contracts/tutor-eval-result-validation.js";
import { parseTutorHealthReport } from "../src/contracts/tutor-health-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { executeTutorEvalJudge } from "../src/runner/tutor-eval-judge-execution.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { compareTutorHealthRuns } from "../src/reporting/tutor-health-comparison.js";
import { buildTutorHealthRunManifest, verifyTutorHealthRunManifest } from "../src/reporting/tutor-health-run-manifest.js";
import { insufficientInformationJudge, insufficientInformationSuite } from "./helpers/insufficient-information.js";

const tutor = { id: "controlled-synthetic", respond: async () => ({ text: "Synthetic response." }) };

test("false retains existing PASS behavior; true prevents Health 100 plus Release Gate PASS", async () => {
  const suite = await insufficientInformationSuite();
  const complete = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge(), runId: "complete" });
  assert.equal(complete.evaluation.passedCount, 1);
  assert.equal(complete.evaluation.overallScore, 1);
  assert.equal(complete.report.healthScore, 100);
  assert.equal(complete.report.releaseGate, "PASS");
  assertValidTutorEvalRunResult({ ...complete.evaluation, evaluatorVersion: "0.3a.4" });
  let calls = 0;
  const incomplete = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true }), runId: "incomplete",
    onJudgeCall: () => { calls += 1; },
  });
  const result = incomplete.evaluation.caseResults[0]!;
  assert.equal(result.rawJudgeResult!.insufficientInformation, true);
  assert.equal(result.rawJudgeResult!.rubricResults[0]!.result, "PASS");
  assert.equal(result.status, "error");
  assert.equal(result.passed, false);
  assert.equal(result.overallScore, null);
  assert.ok(result.rubricResults.every((item) => item.result === "ERROR" && item.score === null));
  assert.ok(result.diagnostics.some((item) => item.code === "judge_insufficient_information"));
  assert.equal(incomplete.evaluation.failedCount, 0);
  assert.equal(incomplete.evaluation.errorCount, 1);
  assert.equal(incomplete.evaluation.overallScore, null);
  assert.equal(incomplete.report.healthScore, null);
  assert.equal(incomplete.report.releaseGate, "UNRESOLVED");
  assert.equal(incomplete.report.findings.length, 0);
  assert.equal(incomplete.report.unresolved[0]!.reason, "insufficient_information");
  assert.equal(calls, 1);
  assertValidTutorEvalRunResult(incomplete.evaluation);
});

test("a global flag cannot select sufficient Judge rubrics from PASS/FAIL polarity", async () => {
  const suite = await insufficientInformationSuite({ twoJudgeRubrics: true });
  const { evaluation, report } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true, alternateResults: true }),
  });
  assert.deepEqual(evaluation.caseResults[0]!.rawJudgeResult!.rubricResults.map((item) => item.result), ["PASS", "FAIL"]);
  assert.ok(evaluation.caseResults[0]!.rubricResults.every((item) => item.result === "ERROR" && item.score === null));
  assert.equal(report.healthScore, null);
  assert.equal(report.findings.length, 0);
  assert.equal(report.unresolved.length, 2);
});

test("mixed evidence retains completed deterministic PASS and FAIL without scoring uncertain Judge rubrics", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  for (const text of ["Synthetic response.", ""]) {
    const { evaluation, report } = await runTutorHealthEvaluation({ suite,
      tutor: { ...tutor, respond: async () => ({ text }) },
      judge: insufficientInformationJudge({ insufficientInformation: true }),
    });
    const result = evaluation.caseResults[0]!;
    assert.equal(result.rubricResults.find((item) => item.rubricId === "controlled-nonempty")!.result, text ? "PASS" : "FAIL");
    assert.equal(result.categoryScores.correctness, text ? 1 : 0);
    assert.equal(report.dimensionScores.content_correctness.score, text ? 100 : 0);
    assert.equal(report.dimensionScores.intervention_strategy.score, null);
    assert.equal(report.healthScore, text ? 100 : 0);
    assert.equal(report.findings.length, text ? 0 : 1);
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.releaseGate, "UNRESOLVED");
    assert.equal(evaluation.overallScore, null);
  }
});

test("explicit failure signals remain independent of insufficient information", async () => {
  const suite = await insufficientInformationSuite();
  const run = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true, criticalFailure: true }),
  });
  assert.equal(run.evaluation.caseResults[0]!.qualityGate, "FAIL");
  assert.equal(run.report.releaseGate, "FAIL");
  assert.ok(run.report.findings.some((item) => item.type === "answer_leakage"));
  const mixed = await insufficientInformationSuite({ mixed: true, criticalDeterministic: true });
  const deterministic = await runTutorHealthEvaluation({ suite: mixed,
    tutor: { ...tutor, respond: async () => ({ text: "" }) },
    judge: insufficientInformationJudge({ insufficientInformation: true }),
  });
  assert.equal(deterministic.report.releaseGate, "FAIL");
  assert.ok(deterministic.report.findings.some((item) => item.type === "instruction_violation"));
});

test("insufficient information is a structured success with telemetry, distinct from transport failure", async () => {
  const suite = await insufficientInformationSuite();
  const authored = tutorScenarioSuiteToTutorEvalDataset(suite).cases[0]!;
  const rubrics = authored.evaluatorOnly.rubrics;
  const judge = insufficientInformationJudge({ insufficientInformation: true });
  const metrics = { latencyMs: 1, tokenUsage: { inputTokens: 1, outputTokens: 1 }, cost: null, attempts: 1 };
  const incomplete = await executeTutorEvalJudge(authored, "Synthetic.", rubrics,
    { evaluateWithMetrics: async (input) => ({ result: await judge.evaluate!(input), metrics }) }, undefined);
  assert.equal(incomplete.failure, null);
  assert.deepEqual(incomplete.metrics, metrics);
  assert.equal(incomplete.rawJudgeResult!.insufficientInformation, true);
  assert.equal(incomplete.rubricResults[0]!.result, "ERROR");
});

test("transport failure retains its distinct execution diagnostics and unresolved behavior", async () => {
  const suite = await insufficientInformationSuite();
  const authored = tutorScenarioSuiteToTutorEvalDataset(suite).cases[0]!;
  const rubrics = authored.evaluatorOnly.rubrics;
  const transport = await executeTutorEvalJudge(authored, "Synthetic.", rubrics,
    insufficientInformationJudge({ transportError: true }), undefined);
  assert.equal(transport.failure!.code, "judge_transport_error");
  assert.equal(transport.rawJudgeResult, null);
  assert.equal(transport.rubricResults[0]!.result, "ERROR");
  const transportRun = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ transportError: true }) });
  assert.equal(transportRun.report.releaseGate, "UNRESOLVED");
  assert.equal(transportRun.report.unresolved[0]!.reason, "evaluation_error");
  assert.equal(transportRun.report.findings.length, 0);
});

test("import rejects historical flag-true PASS claims and incomplete results upgraded to scored evidence", async () => {
  const suite = await insufficientInformationSuite();
  const complete = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge() });
  const inconsistent = { ...complete.evaluation, caseResults: complete.evaluation.caseResults.map((item) => ({ ...item,
    rawJudgeResult: { ...item.rawJudgeResult!, insufficientInformation: true },
  })) };
  assert.equal(isTutorEvalRunResult(inconsistent), false);
  assert.throws(() => buildTutorHealthReport({ suite, evaluation: inconsistent }), /invalid/);
  const incomplete = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ insufficientInformation: true }) });
  assert.equal(isTutorEvalRunResult({ ...incomplete.evaluation, overallScore: 1 }), false);
  const first = incomplete.evaluation.caseResults[0]!;
  assert.equal(isTutorEvalRunResult({ ...incomplete.evaluation, caseResults: [{ ...first,
    rubricResults: first.rubricResults.map((item) => ({ ...item, result: "PASS", score: 1 })),
  }] }), false);
  assertValidTutorEvalRunResult({ ...incomplete.evaluation, caseResults: [{ ...first, rubricResults: [] }] });
});

test("a candidate with insufficient information cannot imply a resolved Finding", async () => {
  const suite = await insufficientInformationSuite();
  const baseline = { suite, ...await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ result: "FAIL" }), runId: "baseline" }) };
  const candidate = { suite, ...await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ insufficientInformation: true }), runId: "candidate" }) };
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.equal(comparison.counts.resolved, 0);
  assert.equal(comparison.counts.unresolved, 1);
  assert.ok(comparison.findings[0]!.candidate.assessments[0]!.unresolvedReasons.some((reason) => String(reason) === "insufficient_information"));
});

test("manifest and comparison reconstruction reject a scored report detached from incomplete evidence", async () => {
  const suite = await insufficientInformationSuite();
  const complete = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge(), runId: "complete" });
  const incomplete = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ insufficientInformation: true }), runId: "incomplete" });
  const input = { suite, evaluationJson: JSON.stringify(incomplete.evaluation), reportJson: JSON.stringify(incomplete.report) };
  const manifest = buildTutorHealthRunManifest(input);
  assert.doesNotThrow(() => verifyTutorHealthRunManifest(manifest, input));
  const forged = { ...complete.report, sourceEvaluation: incomplete.report.sourceEvaluation };
  parseTutorHealthReport(forged);
  assert.throws(() => buildTutorHealthRunManifest({ ...input, reportJson: JSON.stringify(forged) }), /manifest.*invalid/);
  assert.throws(() => compareTutorHealthRuns({ baseline: { suite, ...complete }, candidate: { suite, ...incomplete, report: forged } }), /report_source_mismatch/);
});
