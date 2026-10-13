import assert from "node:assert/strict";
import { test } from "node:test";

import { assertValidTutorEvalRunResult, isTutorEvalRunResult } from "../src/contracts/tutor-eval-result-validation.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";
import { DEFAULT_TUTOR_EVAL_SCORING_CONFIG, type TutorEvalScoringConfig } from "../src/scoring/index.js";

function syntheticRun(scoring: TutorEvalScoringConfig = DEFAULT_TUTOR_EVAL_SCORING_CONFIG) {
  return runTutorEval({
    dataset: { id: "synthetic-aggregate-compatibility", version: "1", cases: [{
      schemaVersion: 1, id: "one-case", version: "1",
      metadata: { subject: "synthetic", topic: "synthetic" },
      tutorInput: { learningObjective: "Return a response.", studentMessage: "Respond once." },
      evaluatorOnly: { disclosurePolicy: "full_solution_allowed", rubrics: [{
        id: "nonempty", category: "correctness", criterion: "Return a nonempty response.",
        weight: 1, evaluationType: "deterministic", evaluatorId: "empty_response",
      }] },
    }] },
    tutor: { id: "controlled-synthetic", respond: async () => ({ text: "Synthetic response." }) },
    scoring,
    runId: "synthetic-aggregate-compatibility",
    now: () => new Date("2026-10-13T00:00:00.000Z"),
  });
}

test("direct runner custom scoring can exceed one without changing normalized rubric semantics", async () => {
  const result = await syntheticRun({ ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG,
    criterionScores: { PASS: 2, PARTIAL: 0.5, FAIL: 0 },
  });
  assert.equal(result.caseResults[0]!.rubricResults[0]!.result, "PASS");
  assert.equal(result.caseResults[0]!.rubricResults[0]!.score, 1);
  assert.equal(result.caseResults[0]!.categoryScores.correctness, 2);
  assert.equal(result.caseResults[0]!.overallScore, 2);
  assert.equal(result.overallScore, 2);
  // case/category 的旧范围限制仍生效；本轮不扩大旧契约，也不认证评分推导。
  assert.equal(isTutorEvalRunResult(result), false);
});

test("v1 run overallScore retains its historical finite-number-or-null parsing boundary", async () => {
  const reference = await syntheticRun();
  const legacy = JSON.parse(JSON.stringify(reference)) as Record<string, unknown>;
  delete legacy.evaluatorVersion;
  for (const item of legacy.caseResults as Record<string, unknown>[]) {
    delete item.locale;
    delete item.judgeMetrics;
  }
  // 构造旧 v1 曾允许的解析输入；接受解析不代表 aggregate 已由证据重算验证。
  for (const overallScore of [2, -0.25, 0, 0.8, 1, null]) {
    const input = { ...legacy, overallScore };
    assert.doesNotThrow(() => assertValidTutorEvalRunResult(input));
    assert.equal(isTutorEvalRunResult(input), true);
  }
  assertValidTutorEvalRunResult({ ...reference, overallScore: 2 });
});

test("aggregate compatibility still rejects nonfinite values and preserves old case/category bounds", async () => {
  const result = await syntheticRun();
  for (const overallScore of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "2", true, undefined]) {
    assert.equal(isTutorEvalRunResult({ ...result, overallScore }), false);
  }
  const first = result.caseResults[0]!;
  assert.equal(isTutorEvalRunResult({ ...result,
    caseResults: [{ ...first, overallScore: 2 }],
  }), false);
  assert.equal(isTutorEvalRunResult({ ...result,
    caseResults: [{ ...first, categoryScores: { ...first.categoryScores, correctness: 2 } }],
  }), false);
});
