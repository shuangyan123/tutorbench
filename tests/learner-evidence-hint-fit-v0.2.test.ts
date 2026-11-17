import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { TUTOR_EVAL_EVALUATOR_VERSION } from "../src/contracts/tutor-eval.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { evaluateHintFit as evaluateV01 } from "../src/research/learner-evidence-hint-rubric.js";
import { evaluateHintFit as evaluateV02, hintRubric } from "../src/research/learner-evidence-hint-rubric-v0.2.js";
import { createHintPilot, hintSource } from "../src/research/learner-evidence-hint-scenarios.js";

const dataset = await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion);
const cases = createHintPilot(dataset);
const [unknown, local, gap] = cases;
assert.ok(unknown && local && gap);

interface DevelopmentControl {
  readonly id: string;
  readonly text: string;
  readonly expected: readonly ("PASS" | "FAIL" | "ABSTAIN")[];
}

const v01Controls: readonly DevelopmentControl[] = JSON.parse(await readFile(
  "scenarios/experimental/learner-evidence-hint-v0.1/responses.json", "utf8",
));
const v02Controls: readonly DevelopmentControl[] = JSON.parse(await readFile(
  "scenarios/experimental/learner-evidence-hint-v0.2/responses.json", "utf8",
));

function evaluateAll(text: string) {
  return cases.map((pilotCase) => evaluateV02(pilotCase, text));
}

test("v0.2 has a distinct experimental identity and leaves v0.1 untouched", () => {
  assert.deepEqual(hintRubric, { id: "learner-evidence-hint-fit", version: "0.2.0" });
  assert.notEqual(evaluateV02, evaluateV01);
});

test("all v0.1 development controls retain their authored expectations", () => {
  assert.equal(v01Controls.length, 14);
  for (const fixture of v01Controls) {
    const results = evaluateAll(fixture.text);
    assert.deepEqual(results.map((result) => result.verdict), fixture.expected, fixture.id);
    for (const result of results) {
      assert.ok(result.reason);
      assert.ok(result.responseExcerpts.length);
      assert.ok(result.responseExcerpts.every((excerpt) => fixture.text.includes(excerpt)));
      assert.equal("score" in result, false);
    }
  }
});

test("v0.2 recognizes concrete equality explanations across common paraphrases", () => {
  assert.equal(v02Controls.length, 9);
  for (const fixture of v02Controls) {
    const results = evaluateAll(fixture.text);
    assert.deepEqual(results.map((result) => result.verdict), fixture.expected, fixture.id);
    for (const result of results) {
      assert.ok(result.reason);
      assert.ok(result.responseExcerpts.length);
      assert.ok(result.responseExcerpts.every((excerpt) => fixture.text.includes(excerpt)));
      assert.equal("score" in result, false);
    }
  }
});

test("the expanded balance analogy is a coverage gain over v0.1", () => {
  const example = v02Controls.find((item) => item.id === "balance-trays");
  assert.ok(example);
  assert.equal(evaluateV01(gap, example.text).verdict, "ABSTAIN");
  assert.equal(evaluateV02(gap, example.text).verdict, "PASS");
});

test("a false one-sided operation or unequal side operations fail in every evidence condition", () => {
  for (const id of ["one-sided-operation-claimed-valid", "unequal-side-operations"]) {
    const fixture = v02Controls.find((item) => item.id === id);
    assert.ok(fixture);
    assert.deepEqual(evaluateAll(fixture.text).map((result) => result.verdict), ["FAIL", "FAIL", "FAIL"]);
  }
});

test("a formal rule alone does not masquerade as an accessible explanation", () => {
  const fixture = v02Controls.find((item) => item.id === "abstract-rule-without-explanation");
  assert.ok(fixture);
  assert.deepEqual(evaluateAll(fixture.text).map((result) => result.verdict), ["ABSTAIN", "ABSTAIN", "ABSTAIN"]);
});

test("the failed-hint condition rejects a slogan that repeats the rule without explaining it", () => {
  const fixture = v02Controls.find((item) => item.id === "bare-rule-after-failed-hint");
  assert.ok(fixture);
  assert.equal(evaluateV02(gap, fixture.text).verdict, "FAIL");
  assert.equal(evaluateV02(unknown, fixture.text).verdict, "PASS");
});

test("empty replies and completed first calculations remain conservative", () => {
  assert.equal(evaluateV02(gap, "").verdict, "ABSTAIN");
  const fixture = v02Controls.find((item) => item.id === "completed-first-calculation");
  assert.ok(fixture);
  assert.deepEqual(evaluateAll(fixture.text).map((result) => result.verdict), ["ABSTAIN", "ABSTAIN", "ABSTAIN"]);
});

test("isolated balance and subtraction keywords do not establish a useful hint", () => {
  assert.deepEqual(
    evaluateAll("天平、两边、减去。").map((result) => result.verdict),
    ["ABSTAIN", "ABSTAIN", "ABSTAIN"],
  );
  assert.equal(evaluateV02(gap, "想象一架天平。两边同时减去 3，你试着写出来。").verdict, "FAIL");
});

test("the shared disclosure guard handles CJK adjacency without matching a longer answer", () => {
  assert.equal(TUTOR_EVAL_EVALUATOR_VERSION, "0.3a.6");
  for (const pilotCase of cases) {
    const leak = "结果就是x=4哦。";
    const result = evaluateV02(pilotCase, leak);
    assert.equal(result.verdict, "FAIL");
    assert.ok(result.responseExcerpts.length > 0);
    assert.ok(result.responseExcerpts.every((excerpt) => leak.includes(excerpt)));
    assert.equal(evaluateV02(pilotCase, "这里用x=40作记号。").verdict, "ABSTAIN");
  }
});
