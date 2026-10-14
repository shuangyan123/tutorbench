import assert from "node:assert/strict";
import { test } from "node:test";

import { TutorEvalJudgeExecutionError, type TutorEvalJudgeResult, type TutorResponseCorpusEvaluationResult } from "../src/contracts/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { runTutorResponseCorpus, type TutorEvalJudgeRunOptions } from "../src/runner/index.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { insufficientInformationSuite } from "./helpers/insufficient-information.js";
import { buildWordContextDiscriminationCorpus, buildWordContextDiscriminationReport,
  createWordContextDiscriminationComparisonFixture, formatWordContextDiscriminationReport,
  observeWordContextDiscriminationEvaluation, WORD_CONTEXT_DISCRIMINATION_CASE_ID,
  WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_RUBRIC_ID, WORD_CONTEXT_DISCRIMINATION_JUDGE_IDENTITY,
} from "../src/judge/word-context-discrimination.js";
import { formatJudgeCandidateComparisonReport, runJudgeCandidateComparison, type JudgeCandidateComparisonCandidate } from "../src/judge/candidate-comparison.js";

type Mode = "leak-abstention" | "failure-abstention" | "abstention" | "transport" | "PASS" | "FAIL" | "leak-FAIL";

function controlledJudge(modes: readonly Mode[]): TutorEvalJudgeRunOptions {
  let calls = 0;
  return { provider: "synthetic", model: "controlled-diagnostic", ...WORD_CONTEXT_DISCRIMINATION_JUDGE_IDENTITY,
    evaluate: async (input): Promise<TutorEvalJudgeResult> => {
      const mode = modes[calls++ % modes.length]!;
      if (mode === "transport") throw new TutorEvalJudgeExecutionError("judge_transport_error");
      return { schemaVersion: 1, caseId: input.caseId,
        rubricResults: input.rubrics.map((item) => ({ rubricId: item.id,
          result: (mode === "FAIL" || mode === "leak-FAIL") && item.id === WORD_CONTEXT_DISCRIMINATION_CORRECTNESS_RUBRIC_ID ? "FAIL" : "PASS" })),
        criticalFailures: mode === "leak-abstention" || mode === "leak-FAIL" ? [{ type: "answer_leakage", severity: "major", evidence: "Controlled synthetic leakage." }]
          : mode === "failure-abstention" ? [{ type: "instruction_violation", severity: "major", evidence: "Controlled synthetic failure." }] : [],
        factualErrors: [], insufficientInformation: mode.endsWith("abstention"),
      };
    },
  };
}

async function wordEvaluation(modes: readonly Mode[]) {
  return runTutorResponseCorpus({ corpus: buildWordContextDiscriminationCorpus(),
    dataset: await loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6"), judge: controlledJudge(modes),
  });
}

function candidate(modes: readonly Mode[]): JudgeCandidateComparisonCandidate {
  return { id: "synthetic/controlled-diagnostic", provider: "synthetic", model: "controlled-diagnostic",
    promptId: WORD_CONTEXT_DISCRIMINATION_JUDGE_IDENTITY.promptId,
    promptVersion: WORD_CONTEXT_DISCRIMINATION_JUDGE_IDENTITY.promptVersion,
    generationProfile: {}, createJudge: () => controlledJudge(modes),
  };
}

function replaceWordCase(result: TutorResponseCorpusEvaluationResult, changes: Partial<TutorResponseCorpusEvaluationResult["evaluation"]["caseResults"][number]>) {
  return { ...result, evaluation: { ...result.evaluation,
    caseResults: result.evaluation.caseResults.map((item, index) => index === 0 ? { ...item, ...changes } : item),
  } };
}

test("diagnostic observations retain confirmed failures and leakage during structured abstention", async () => {
  const result = await wordEvaluation(["failure-abstention", "leak-abstention", "abstention"]);
  assert.equal(result.evaluation.caseResults[0]!.criticalFailures[0]!.type, "instruction_violation");
  assert.equal(result.evaluation.caseResults[1]!.answerLeakage, true);
  const observations = observeWordContextDiscriminationEvaluation(result);
  assert.deepEqual(observations[0]!.criticalFailures, [{ type: "instruction_violation", severity: "major" }]);
  assert.deepEqual(observations[1]!.criticalFailures, [{ type: "answer_leakage", severity: "major" }]);
  assert.equal(observations[1]!.answerLeakage, true);
  assert.equal(observations[0]!.answerLeakage, null);
  assert.equal(observations[2]!.answerLeakage, null);
  assert.equal(observations[2]!.criticalFailures, null);
  assert.ok(observations.every((item) => item.executionErrorCode === null && item.observedLabel === null));
  assert.ok(observations.every((item) => item.judgeOutcome === "abstained"));
});

test("Word report keeps confirmed positives and displays unknown instead of a fabricated negative", async () => {
  const result = await wordEvaluation(["failure-abstention", "leak-abstention", "abstention"]);
  const report = buildWordContextDiscriminationReport(result);
  assert.equal(report.cases[0]!.answerLeakage, null);
  assert.equal(report.cases[1]!.answerLeakage, true);
  assert.equal(report.cases[2]!.criticalFailures, null);
  assert.equal(report.schemaVersion, 2);
  const text = formatWordContextDiscriminationReport(report);
  assert.match(text, /answer leakage: n\/a/);
  assert.match(text, /answer leakage: true/);
  assert.match(text, /instruction_violation\/major/);
});

test("comparison separates five abstentions from one execution failure and retains positive-signal statistics", async () => {
  const report = await runJudgeCandidateComparison({
    fixture: createWordContextDiscriminationComparisonFixture(() => loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6")),
    runsPerCandidate: 3, candidates: [candidate([
      "failure-abstention", "leak-abstention", "abstention",
      "failure-abstention", "abstention", "transport",
      "PASS", "leak-FAIL", "FAIL",
    ])],
  });
  const metrics = report.candidates[0]!.metrics;
  assert.equal(metrics.executionErrors.count, 1);
  assert.equal(metrics.abstentions!.count, 5);
  assert.deepEqual(metrics.executionErrors.byCode, { judge_transport_error: 1 });
  assert.deepEqual(metrics.answerLeakageDistribution.B, { trueCount: 2, falseCount: 0, unavailableCount: 1 });
  assert.equal(metrics.stability.answerLeakageByFixture.B!.observedCount, 2);
  assert.equal(metrics.stability.answerLeakageByFixture.B!.unavailableCount, 1);
  assert.equal(metrics.criticalFailureDistribution.A!.counts["instruction_violation/major"], 2);
  assert.equal(metrics.criticalFailureDistribution.A!.counts.none, 1);
  assert.equal(metrics.criticalFailureDistribution.A!.partialCount, 2);
  assert.equal(metrics.criticalFailureDistribution.B!.counts["answer_leakage/major"], 2);
  assert.equal(metrics.criticalFailureDistribution.B!.partialCount, 1);
  assert.equal(metrics.criticalFailureDistribution.C!.unavailableCount, 2);
  assert.equal(metrics.criticalFailureDisagreementCount, 1);
});

test("real transport error remains unavailable and normal PASS/FAIL retain their diagnostic behavior", async () => {
  const result = await wordEvaluation(["transport", "PASS", "FAIL"]);
  const observations = observeWordContextDiscriminationEvaluation(result);
  assert.equal(observations[0]!.executionErrorCode, "judge_transport_error");
  assert.equal(observations[0]!.answerLeakage, null);
  assert.equal(observations[0]!.observedLabel, null);
  assert.equal(observations[1]!.answerLeakage, false);
  assert.equal(observations[1]!.observedLabel, "PASS");
  assert.deepEqual(observations[1]!.criticalFailures, []);
  assert.equal(observations[2]!.observedLabel, "FAIL");
  assert.equal(observations[2]!.executionErrorCode, null);
});

test("a case error does not discard an independently completed and valid Judge failure", async () => {
  const original = await wordEvaluation(["leak-FAIL"]);
  const result = { ...original, evaluation: { ...original.evaluation, failedCount: 0, errorCount: 3,
    overallScore: null, categoryScores: { correctness: null, diagnosis: null, guidance: null, adaptation: null, actionability: null },
    caseResults: original.evaluation.caseResults.map((item) => ({ ...item, status: "error" as const, overallScore: null,
      diagnostics: [{ code: "post_processing_failure", message: "Controlled synthetic non-Judge failure." }],
    })),
  } };
  const observations = observeWordContextDiscriminationEvaluation(result);
  assert.ok(observations.every((item) => item.judgeOutcome === "completed" && item.answerLeakage === true));
  assert.ok(observations.every((item) => item.criticalFailures?.[0]?.type === "answer_leakage" && item.executionErrorCode === null));
});

test("diagnostic projection rejects flag, normalized score and raw rubric identity contradictions", async () => {
  const result = await wordEvaluation(["abstention"]);
  const first = result.evaluation.caseResults[0]!;
  const invalid = [
    replaceWordCase(result, { rawJudgeResult: { ...first.rawJudgeResult!, insufficientInformation: false } }),
    replaceWordCase(result, { rubricResults: first.rubricResults.map((item) => ({ ...item, result: "PASS", score: 1 })) }),
    replaceWordCase(result, { rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: [] } }),
    replaceWordCase(result, { rawJudgeResult: { ...first.rawJudgeResult!, rubricResults: first.rawJudgeResult!.rubricResults.map((item) => ({ ...item, rubricId: `forged-${item.rubricId}` })) } }),
  ];
  for (const forged of invalid) assert.throws(() => observeWordContextDiscriminationEvaluation(forged), /invalid|mismatch/);
});

test("the same controlled failure signal survives Health and the separate Word diagnostic fixture", async () => {
  const suite = await insufficientInformationSuite();
  const health = await runTutorHealthEvaluation({ suite,
    tutor: { id: "controlled", respond: async () => ({ text: "Synthetic response." }) }, judge: controlledJudge(["leak-abstention"]),
  });
  assert.equal(health.report.releaseGate, "FAIL");
  assert.ok(buildTutorHealthReport({ suite, evaluation: health.evaluation }).findings.some((item) => item.type === "answer_leakage"));
  const result = await wordEvaluation(["leak-abstention"]);
  assert.deepEqual(health.evaluation.caseResults[0]!.criticalFailures, result.evaluation.caseResults[0]!.criticalFailures);
  assert.ok(observeWordContextDiscriminationEvaluation(result).every((item) => item.answerLeakage === true));
  assert.ok(result.evaluation.caseResults.every((item) => item.caseId === WORD_CONTEXT_DISCRIMINATION_CASE_ID && item.overallScore === null));
});

test("a legacy observation without a verified outcome cannot classify a true flag as abstention or transport", async () => {
  const fixture = createWordContextDiscriminationComparisonFixture(() => loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6"));
  await assert.rejects(() => runJudgeCandidateComparison({ fixture: { ...fixture, observeEvaluation: (result) =>
    fixture.observeEvaluation(result).map((item) => {
      const legacy = { ...item };
      Reflect.deleteProperty(legacy, "judgeOutcome");
      return legacy;
    }),
  }, candidates: [candidate(["leak-abstention"])] }), /abstention outcome is unverified/);
});

test("an observer cannot claim an abstention from an ordinary valid Judge result", async () => {
  const fixture = createWordContextDiscriminationComparisonFixture(() => loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6"));
  await assert.rejects(() => runJudgeCandidateComparison({ fixture: { ...fixture, observeEvaluation: (result) =>
    fixture.observeEvaluation(result).map((item) => ({ ...item, judgeOutcome: "abstained",
      insufficientInformation: true, observedLabel: null, criticalFailures: null, answerLeakage: null, executionErrorCode: null,
    })),
  }, candidates: [candidate(["PASS"])] }), /observation source is invalid/);
});

test("a flag and projected outcome cannot hide co-tampering of raw authored rubric identity", async () => {
  const fixture = createWordContextDiscriminationComparisonFixture(() => loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6"));
  await assert.rejects(() => runJudgeCandidateComparison({ fixture: { ...fixture, observeEvaluation: (result) => {
    const observations = fixture.observeEvaluation(result);
    const first = result.evaluation.caseResults[0]!;
    Reflect.set(first, "rawJudgeResult", { ...first.rawJudgeResult!,
      rubricResults: first.rawJudgeResult!.rubricResults.map((item) => ({ ...item, rubricId: `forged-${item.rubricId}` })),
    });
    return observations;
  } }, candidates: [candidate(["abstention"])] }), /invalid/);
});

test("legacy complete Word and candidate report formatting remains readable", async () => {
  const report = buildWordContextDiscriminationReport(await wordEvaluation(["PASS"]));
  const legacy = structuredClone(report);
  Reflect.set(legacy, "schemaVersion", 1);
  for (const item of legacy.cases) Reflect.deleteProperty(item, "judgeOutcome");
  assert.match(formatWordContextDiscriminationReport(legacy), /answer leakage: false/);
  const comparison = await runJudgeCandidateComparison({
    fixture: createWordContextDiscriminationComparisonFixture(() => loadTutorEvalDataset("tutor-eval-v0.2a", "0.2a.6")),
    candidates: [candidate(["PASS"])] });
  Reflect.set(comparison, "comparisonVersion", "0.1.1");
  Reflect.deleteProperty(comparison.candidates[0]!.metrics, "abstentions");
  assert.match(formatJudgeCandidateComparisonReport(comparison), /structured abstentions: unavailable \(legacy report\)/);
  assert.match(formatJudgeCandidateComparisonReport(comparison), /execution errors: 0/);
});

test("legacy error/false is displayed as unknown without rewriting the saved artifact", async () => {
  const legacy = structuredClone(buildWordContextDiscriminationReport(await wordEvaluation(["transport"])));
  Reflect.set(legacy, "schemaVersion", 1);
  for (const item of legacy.cases) {
    Reflect.deleteProperty(item, "judgeOutcome");
    Reflect.set(item, "answerLeakage", false);
    Reflect.set(item, "criticalFailures", []);
  }
  const bytes = JSON.stringify(legacy);
  const text = formatWordContextDiscriminationReport(legacy);
  assert.match(text, /answer leakage: n\/a/);
  assert.doesNotMatch(text, /answer leakage: false/);
  assert.equal(JSON.stringify(legacy), bytes);
});
