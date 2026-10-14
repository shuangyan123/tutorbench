import assert from "node:assert/strict";
import { test } from "node:test";

import { BenchmarkConfigurationError, isTutorEvalRunResult, type TutorEvalDataset, type TutorEvalRunResult } from "../src/contracts/index.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { compareTutorHealthRuns } from "../src/reporting/tutor-health-comparison.js";
import { DEFAULT_TUTOR_EVAL_SCORING_CONFIG, aggregateTutorEvalRubrics, isTutorEvalScoringProvenance, type TutorEvalScoringConfig } from "../src/scoring/index.js";
import { formatTutorHealthComparison, parseTutorHealthComparison } from "../src/index.js";
import { insufficientInformationJudge, insufficientInformationSuite } from "./helpers/insufficient-information.js";

const dataset: TutorEvalDataset = { id: "synthetic-scoring-provenance", version: "1", cases: [{
  schemaVersion: 1, id: "synthetic-one", version: "1", metadata: { subject: "synthetic", topic: "scoring" },
  tutorInput: { learningObjective: "Respond once.", studentMessage: "Synthetic input." },
  evaluatorOnly: { disclosurePolicy: "full_solution_allowed", rubrics: [{ id: "nonempty", category: "correctness",
    criterion: "A nonempty response.", weight: 1, evaluationType: "deterministic", evaluatorId: "empty_response" }] },
}] };

function run(scoring?: TutorEvalScoringConfig) {
  return runTutorEval({ dataset, tutor: { id: "synthetic-scoring", respond: async () => ({ text: "Synthetic response." }) },
    ...(scoring === undefined ? {} : { scoring }), runId: "synthetic-scoring-provenance" });
}

function legacy(result: TutorEvalRunResult): TutorEvalRunResult {
  const copy = structuredClone(result);
  delete (copy as unknown as Record<string, unknown>).scoringProvenance;
  return copy;
}

test("new runner records canonical scoring identity without changing normalized rubric scores", async () => {
  const result = await run();
  assert.ok(Reflect.get(result, "scoringProvenance"));
  assert.equal(result.caseResults[0]!.rubricResults[0]!.score, 1);
  const reordered = await run({ ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, qualityGate: {
    ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG.qualityGate,
    failureTypes: [...DEFAULT_TUTOR_EVAL_SCORING_CONFIG.qualityGate.failureTypes].reverse(),
  } });
  assert.deepEqual(Reflect.get(result, "scoringProvenance"), Reflect.get(reordered, "scoringProvenance"));
});

test("configured scores above one round-trip with verifiable aggregates", async () => {
  const result = await run({ ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: 2, PARTIAL: 0.5, FAIL: 0 }, casePassThreshold: 1.5 });
  assert.equal(result.overallScore, 2);
  assert.equal(result.caseResults[0]!.rubricResults[0]!.score, 1);
  assert.equal(isTutorEvalRunResult(JSON.parse(JSON.stringify(result))), true);
});

test("invalid custom configuration is rejected before Tutor execution", async () => {
  let calls = 0;
  for (const scoring of [
    { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: Number.NaN, PARTIAL: 0.5, FAIL: 0 } },
    { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, casePassThreshold: Number.POSITIVE_INFINITY },
    { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, categoryWeights: { correctness: 0, diagnosis: 0, guidance: 0, adaptation: 0, actionability: 0 } },
    { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, categoryWeights: { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG.categoryWeights, correctness: -1 } },
  ]) {
    await assert.rejects(runTutorEval({ dataset, scoring,
      tutor: { id: "synthetic-scoring", respond: async () => { calls += 1; return { text: "Synthetic response." }; } },
    }), (error: unknown) => error instanceof BenchmarkConfigurationError && error.code === "tutor_eval_scoring_invalid");
  }
  assert.equal(calls, 0);
});

test("new provenance rejects forged case and run aggregates", async () => {
  const result = await run();
  assert.equal(isTutorEvalRunResult({ ...result, overallScore: 0.1 }), false);
  assert.equal(isTutorEvalRunResult({ ...result, categoryScores: { ...result.categoryScores, correctness: 0.1 } }), false);
  assert.equal(isTutorEvalRunResult({ ...result, caseResults: result.caseResults.map((item) => ({ ...item, overallScore: 0.1 })) }), false);
});

test("identity-free legacy v1 retains parsing but does not authorize a release PASS", async () => {
  const suite = await insufficientInformationSuite();
  const current = await runTutorHealthEvaluation({ suite, tutor: { id: "synthetic", respond: async () => ({ text: "Synthetic response." }) },
    judge: insufficientInformationJudge({ insufficientInformation: false }), runId: "legacy-source" });
  const evaluation = legacy(current.evaluation);
  assert.equal(isTutorEvalRunResult({ ...evaluation, overallScore: 2 }), true);
  const report = buildTutorHealthReport({ suite, evaluation });
  assert.equal(report.healthScore, current.report.healthScore);
  assert.equal(report.releaseGate, "UNRESOLVED");
  assert.equal(Reflect.get(report.sourceEvaluation, "scoringIdentity"), null);
});

test("Health keeps normalized scoring units and compares only equal recorded TutorEval scoring identities", async () => {
  const suite = await insufficientInformationSuite();
  const options = { suite, tutor: { id: "synthetic", respond: async () => ({ text: "Synthetic response." }) },
    judge: insufficientInformationJudge({ insufficientInformation: false }) };
  const baseline = await runTutorHealthEvaluation({ ...options, runId: "scoring-default" });
  const candidate = await runTutorHealthEvaluation({ ...options, runId: "scoring-custom", scoring: {
    ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: 2, PARTIAL: 1, FAIL: 0 }, casePassThreshold: 1.5,
  } });
  assert.equal(candidate.evaluation.overallScore, 2);
  assert.equal(candidate.report.healthScore, baseline.report.healthScore);
  assert.throws(() => compareTutorHealthRuns({ baseline: { suite, ...baseline }, candidate: { suite, ...candidate } }), /scoring/);
});

test("finite extreme custom scores and weights remain finite across case and run averaging", async () => {
  const result = await runTutorEval({ dataset, runsPerCase: 2,
    tutor: { id: "synthetic-extremes", respond: async () => ({ text: "Synthetic response." }) },
    scoring: { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: Number.MAX_VALUE, PARTIAL: 0.5, FAIL: 0 },
      categoryWeights: { correctness: Number.MAX_VALUE, diagnosis: Number.MAX_VALUE, guidance: 1, adaptation: 1, actionability: 1 } },
  });
  assert.equal(result.overallScore, Number.MAX_VALUE);
  assert.equal(result.categoryScores.correctness, Number.MAX_VALUE);
  assert.equal(isTutorEvalRunResult(JSON.parse(JSON.stringify(result))), true);
});

test("provenance rejects coerced behaviors, identities, duplicates, and extra private configuration fields", async () => {
  const result = await run();
  const source = result.scoringProvenance!;
  for (const value of [
    { ...source, identity: "unverified" },
    { ...source, cases: [source.cases[0], source.cases[0]] },
    { ...source, cases: source.cases.map((item) => ({ ...item, rubrics: item.rubrics.map((rubric) => ({ ...rubric, behavior: ["required"] })) })) },
    { ...source, config: { ...source.config, credentials: "synthetic-private-field-sentinel" } },
  ]) {
    assert.equal(isTutorEvalScoringProvenance(value), false);
    assert.equal(isTutorEvalRunResult({ ...result, scoringProvenance: value }), false);
  }
  const reordered = { ...source, config: Object.fromEntries(Object.entries(source.config).reverse()) };
  assert.equal(isTutorEvalScoringProvenance(reordered), true);
});

test("direct aggregation rejects an invalid runtime config instead of emitting NaN", () => {
  assert.throws(() => aggregateTutorEvalRubrics([], [], [], { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG,
    criterionScores: { PASS: Number.NaN, PARTIAL: 0.5, FAIL: 0 } }),
  (error: unknown) => error instanceof BenchmarkConfigurationError && error.code === "tutor_eval_scoring_invalid");
});

test("historical saved comparisons remain readable without promoting their old classifications", async () => {
  const suite = await insufficientInformationSuite();
  const options = { suite, tutor: { id: "synthetic", respond: async () => ({ text: "Synthetic response." }) },
    judge: insufficientInformationJudge({ insufficientInformation: false }) };
  const baseline = await runTutorHealthEvaluation({ ...options, runId: "history-baseline" });
  const candidate = await runTutorHealthEvaluation({ ...options, runId: "history-candidate" });
  const saved = compareTutorHealthRuns({ baseline: { suite, ...baseline }, candidate: { suite, ...candidate } });
  delete (saved.baseline.evaluation as unknown as Record<string, unknown>).scoringIdentity;
  delete (saved.candidate.evaluation as unknown as Record<string, unknown>).scoringIdentity;
  const bytes = JSON.stringify(saved);
  assert.equal(parseTutorHealthComparison(saved), saved);
  assert.match(formatTutorHealthComparison(saved), /scoring provenance: unknown/i);
  assert.equal(JSON.stringify(saved), bytes);
});
