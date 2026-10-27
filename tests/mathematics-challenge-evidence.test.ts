import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { parseMathChallengeEvidence, validateMathChallengeCoverage } from "../src/contracts/math-challenge-evidence.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";

const folder = new URL("../../scenarios/experimental/mathematics-challenge-v0.1/", import.meta.url);
async function assets() {
  const [suiteText, evidenceText] = await Promise.all([
    readFile(new URL("suite.json", folder), "utf8"),
    readFile(new URL("evidence.json", folder), "utf8"),
  ]);
  return { suite: parseTutorScenarioSuiteVNext(JSON.parse(suiteText) as unknown),
    evidence: parseMathChallengeEvidence(JSON.parse(evidenceText) as unknown) };
}

test("six mathematics checkpoints parse and evidence covers every authored learner state", async () => {
  const { suite, evidence } = await assets();
  assert.equal(suite.scenarios.length, 6);
  assert.equal(evidence.tasks.length, 2);
  assert.equal(evidence.status, "author-proposed-uncalibrated");
  validateMathChallengeCoverage(evidence, suite);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(dataset.cases.length, 6);
  assert.equal(new Set(dataset.cases.map(x => x.id)).size, 6);
  for (const scenario of suite.scenarios) {
    assert.equal(scenario.decisionPoints.length, 1);
    assert.equal(scenario.decisionPoints[0]?.evaluationCriteria.length, 2);
    assert.ok(scenario.decisionPoints[0]?.evaluationCriteria.every(c => c.evaluationType === "judge" && c.weight === 1));
    const compiled = dataset.cases.find(c => c.id === scenario.identity.id);
    assert.ok(compiled);
    const visible = JSON.stringify(toTutorTurnInput(compiled));
    assert.ok(!visible.includes("math_challenge_evidence"));
    assert.ok(!visible.includes("anticipatedChallenge"));
    assert.ok(!visible.includes("verifiedResult"));
    assert.ok(!visible.includes("evaluatorReferenceState"));
  }
});

type MutableEvidence = { tasks: Array<{ anticipatedChallenge: unknown; cohort?: string; scenarioIds: string[] }> };

test("challenge evidence rejects invented precision, missing fields, duplicates and untracked cases", async () => {
  const { suite, evidence } = await assets();
  const invalid = structuredClone(evidence) as unknown as MutableEvidence;
  invalid.tasks[0]!.anticipatedChallenge = 4;
  assert.throws(() => parseMathChallengeEvidence(invalid), /math_challenge_evidence_invalid/);
  const missing = structuredClone(evidence) as unknown as MutableEvidence;
  delete missing.tasks[0]!.cohort;
  assert.throws(() => parseMathChallengeEvidence(missing), /math_challenge_evidence_invalid/);
  const duplicate = structuredClone(evidence) as unknown as MutableEvidence;
  duplicate.tasks[1]!.scenarioIds.push(duplicate.tasks[0]!.scenarioIds[0]!);
  assert.throws(() => parseMathChallengeEvidence(duplicate), /math_challenge_evidence_duplicate_scenario/);
  const mismatch = structuredClone(evidence) as unknown as typeof evidence;
  const edited = { ...mismatch, tasks: mismatch.tasks.map((t, i) => i === 0 ? { ...t, scenarioIds: t.scenarioIds.slice(1) } : t) };
  assert.throws(() => validateMathChallengeCoverage(edited, suite), /math_challenge_evidence_coverage_mismatch/);
});

test("math reference checks: positivity and conditional sample-space counts", async () => {
  const { evidence } = await assets();
  const quadratic = evidence.tasks.find(t => t.id === "quadratic-positive-roots");
  const conditional = evidence.tasks.find(t => t.id === "conditional-two-red");
  assert.ok(quadratic && conditional);
  // D = 4(a-2)(a+1); both roots positive requires D>0, 2a>0 and a+2>0.
  for (let a = -10; a <= 10; a += 0.125) {
    const disc = 4 * (a - 2) * (a + 1);
    const positiveDistinct = disc > 0 && 2 * a > 0 && a + 2 > 0;
    assert.equal(positiveDistinct, a > 2);
  }
  // Uniformly sampled unordered pairs, excluding blue-blue pairs.
  const eligible = 36 - 6, allRed = 10;
  assert.equal(eligible, 30);
  assert.equal(allRed / eligible, 1 / 3);
  assert.match(quadratic.verifiedResult, /a > 2/u);
  assert.match(conditional.verifiedResult, /10\/30=1\/3/u);
});
