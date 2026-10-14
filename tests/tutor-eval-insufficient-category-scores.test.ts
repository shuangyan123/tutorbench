import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTutorScenarioSuiteVNext, TUTOR_EVAL_CATEGORIES, type TutorEvalCategory, type TutorEvalRunResult } from "../src/contracts/index.js";
import { assertValidTutorEvalRunResult, isTutorEvalRunResult } from "../src/contracts/tutor-eval-result-validation.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { compareTutorHealthRuns } from "../src/reporting/tutor-health-comparison.js";
import { buildTutorHealthRunManifest } from "../src/reporting/tutor-health-run-manifest.js";
import { insufficientInformationJudge, insufficientInformationSuite } from "./helpers/insufficient-information.js";

const tutor = { id: "controlled-synthetic", respond: async () => ({ text: "Synthetic response." }) };

function withCaseCategoryScore(evaluation: TutorEvalRunResult, category: TutorEvalCategory, score: number): TutorEvalRunResult {
  return { ...evaluation, caseResults: evaluation.caseResults.map((item) => ({ ...item,
    categoryScores: { ...item.categoryScores, [category]: score },
  })) };
}

test("Judge-only abstention requires null case scores in every unsupported category", async () => {
  const suite = await insufficientInformationSuite({ twoJudgeRubrics: true });
  const { evaluation } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true, alternateResults: true }),
  });
  assertValidTutorEvalRunResult(evaluation);
  assert.ok(evaluation.caseResults[0]!.rubricResults.every((item) => item.result === "ERROR" && item.score === null));
  for (const category of TUTOR_EVAL_CATEGORIES) {
    for (const score of [0, 1]) {
      const forged = withCaseCategoryScore(evaluation, category, score);
      assert.equal(isTutorEvalRunResult(forged), false, `${category}=${score} has no scoreable evidence`);
    }
  }
});

test("missing normalized rubric evidence remains readable only with null case category scores", async () => {
  const suite = await insufficientInformationSuite();
  const { evaluation } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true }),
  });
  const missing = { ...evaluation, caseResults: evaluation.caseResults.map((item) => ({ ...item, rubricResults: [] })) };
  assertValidTutorEvalRunResult(missing);
  assert.equal(buildTutorHealthReport({ suite, evaluation: missing }).releaseGate, "UNRESOLVED");
  assert.equal(isTutorEvalRunResult(withCaseCategoryScore(missing, "guidance", 1)), false);
});

test("a mixed category retains independent deterministic PASS and FAIL scores during abstention", async () => {
  const fixture = await insufficientInformationSuite({ mixed: true });
  const scenario = fixture.scenarios[0]!;
  const point = scenario.decisionPoints[0]!;
  const criteria = point.evaluationCriteria;
  const judge = criteria[0]!;
  const deterministic = criteria.find((item) => item.rubricId === "controlled-nonempty")!;
  // 仅调整受控 synthetic fixture，让两种证据处在同一类别。
  const suite = parseTutorScenarioSuiteVNext({ ...fixture, scenarios: [{ ...scenario,
    decisionPoints: [{ ...point, evaluationCriteria: criteria.map((item) => item.rubricId === deterministic.rubricId
      ? { ...item, category: judge.category, dimension: judge.dimension } : item) }],
  }] });
  for (const text of ["Synthetic response.", ""]) {
    const { evaluation, report } = await runTutorHealthEvaluation({ suite,
      tutor: { ...tutor, respond: async () => ({ text }) },
      judge: insufficientInformationJudge({ insufficientInformation: true }),
    });
    const result = evaluation.caseResults[0]!;
    assert.equal(result.categoryScores[judge.category], text ? 1 : 0);
    assert.equal(result.rubricResults.find((item) => item.rubricId === deterministic.rubricId)!.result, text ? "PASS" : "FAIL");
    assert.equal(result.rubricResults.find((item) => item.rubricId === judge.rubricId)!.score, null);
    assert.equal(result.overallScore, null);
    assert.equal(report.releaseGate, "UNRESOLVED");
    assertValidTutorEvalRunResult(evaluation);
  }
});

test("independent evidence in another category cannot support a Judge-only category score", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  const { evaluation } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true }),
  });
  assert.equal(evaluation.caseResults[0]!.categoryScores.correctness, 1);
  assert.equal(evaluation.caseResults[0]!.categoryScores.guidance, null);
  assertValidTutorEvalRunResult(evaluation);
  assert.equal(isTutorEvalRunResult(withCaseCategoryScore(evaluation, "guidance", 1)), false);
});

test("ERROR or null-scored independent rubric entries cannot support a numeric category score", async () => {
  const suite = await insufficientInformationSuite({ mixed: true });
  const { evaluation } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true }),
  });
  for (const [status, score] of [["ERROR", null], ["ERROR", 1], ["PASS", null]] as const) {
    const forged = { ...evaluation, caseResults: evaluation.caseResults.map((item) => ({ ...item,
      rubricResults: item.rubricResults.map((rubric) => rubric.rubricId === "controlled-nonempty"
        ? { ...rubric, result: status, score } : rubric),
    })) };
    assert.equal(isTutorEvalRunResult(forged), false, `${status}/${score} is not scoreable evidence`);
  }
});

test("valid historical flag-false results and transport errors retain their import behavior", async () => {
  const suite = await insufficientInformationSuite();
  for (const result of ["PASS", "FAIL"] as const) {
    const { evaluation } = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ result }) });
    assert.equal(evaluation.caseResults[0]!.rawJudgeResult!.insufficientInformation, false);
    assert.equal(evaluation.caseResults[0]!.categoryScores.guidance, result === "PASS" ? 1 : 0);
    const { judgeMetrics, ...historicalCase } = evaluation.caseResults[0]!;
    assert.equal(judgeMetrics, null);
    const historical = { ...evaluation, evaluatorVersion: "0.3a.4", caseResults: [historicalCase] };
    assertValidTutorEvalRunResult(historical);
  }
  const { evaluation, report } = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ transportError: true }),
  });
  assert.equal(evaluation.caseResults[0]!.rawJudgeResult, null);
  assert.equal(evaluation.caseResults[0]!.categoryScores.guidance, null);
  assert.equal(report.releaseGate, "UNRESOLVED");
  assert.equal(report.unresolved[0]!.reason, "evaluation_error");
  assertValidTutorEvalRunResult(evaluation);
});

test("report, comparison and manifest boundaries reject unsupported case scores", async () => {
  const suite = await insufficientInformationSuite();
  const baseline = await runTutorHealthEvaluation({ suite, tutor, judge: insufficientInformationJudge({ result: "FAIL" }), runId: "baseline" });
  const candidate = await runTutorHealthEvaluation({ suite, tutor,
    judge: insufficientInformationJudge({ insufficientInformation: true }), runId: "candidate",
  });
  const forged = withCaseCategoryScore(candidate.evaluation, "guidance", 1);
  assert.throws(() => buildTutorHealthReport({ suite, evaluation: forged }), { code: "tutor_eval_result_invalid" });
  assert.throws(() => compareTutorHealthRuns({ baseline: { suite, ...baseline },
    candidate: { suite, evaluation: forged, report: candidate.report },
  }), { code: "tutor_eval_result_invalid" });
  assert.throws(() => buildTutorHealthRunManifest({ suite,
    evaluationJson: JSON.stringify(forged), reportJson: JSON.stringify(candidate.report),
  }), { code: "tutor_health_run_manifest_invalid" });
});
