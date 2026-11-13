import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import {
  buildHintReviewPacket, compareHintRevisions, hintReviewTemplate, replayHintReviewPacket,
  summarizeHintReviewPacket, validateHintReview,
} from "../src/research/learner-evidence-hint-held-out.js";
import { evaluateHintFit } from "../src/research/learner-evidence-hint-rubric.js";
import { createHintPilot, hintSource } from "../src/research/learner-evidence-hint-scenarios.js";

const cases = createHintPilot(await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion));
const responses: readonly { id: string; text: string }[] = JSON.parse(await readFile(
  "scenarios/experimental/learner-evidence-hint-v0.1/held-out-responses.json", "utf8",
));
const packet = buildHintReviewPacket(cases, responses);

test("the held-out packet is disjoint from design replies and hides all evaluator outputs", async () => {
  const controls: readonly { text: string }[] = JSON.parse(await readFile(
    "scenarios/experimental/learner-evidence-hint-v0.1/responses.json", "utf8",
  ));
  assert.ok(responses.every(({ text }) => !controls.some((control) => control.text === text)));
  const template = hintReviewTemplate(packet);
  assert.equal(packet.tasks.length, 30);
  assert.equal(new Set(packet.tasks.map(({ responseId }) => responseId)).size, 10);
  assert.deepEqual(new Set(packet.tasks.map(({ caseId }) => caseId)).size, 3);
  assert.deepEqual(summarizeHintReviewPacket(packet, cases).overall, { uniqueReplies: 10, plannedPairJudgments: 30 });
  for (const task of packet.tasks) {
    assert.ok(task.learnerEvidence.length >= 1);
    assert.equal(task.tutorReply, responses.find(({ id }) => id === task.responseId)?.text);
  }
  assert.ok(template.judgments.every(({ label, rationale, uncertainty }) => label === null && !rationale && !uncertainty));
  assert.doesNotMatch(JSON.stringify(template), /verdict|expectedMoves|demonstrated_local|explicit_gap|responseExcerpts|prohibitedInferences/u);
  assert.throws(() => validateHintReview(packet, template), /hint_held_out_review_source_mismatch/u);
  assert.throws(() => validateHintReview(packet, { ...template, reviewerId: "test", reviewedOn: "2026-11-13" }),
    /hint_held_out_review_incomplete/u);
});

test("a source-bound reference and two different synthetic decisions retain fixes, regressions and abstentions", () => {
  // 只测试配对协议的四个构造边界，不给实际检验包生成参考标签。
  const control = buildHintReviewPacket(cases, [
    { id: "r01", text: "测试回复甲" }, { id: "r02", text: "测试回复乙" },
  ]);
  const template = hintReviewTemplate(control);
  const submission = {
    ...template, reviewerId: "synthetic-test", reviewedOn: "2026-11-13",
    judgments: template.judgments.map(({ unitId }, index) => ({
      unitId, label: index === 2 ? "ABSTAIN" : "PASS", rationale: "Synthetic test", uncertainty: "Protocol fixture",
    })),
  };
  const reference = validateHintReview(control, submission);
  const baseline = replayHintReviewPacket(control, cases, evaluateHintFit).map((row, index) => ({
    ...row, verdict: index === 0 ? "FAIL" as const : "PASS" as const,
  }));
  const revision = baseline.map((row, index) => ({
    ...row, verdict: index === 1 || index === 2 ? "FAIL" as const : "PASS" as const,
  }));
  const result = compareHintRevisions(control, baseline, revision, reference);
  assert.deepEqual(result.changes.map(({ change }) => change), ["fix", "regression", "unresolved"]);
  assert.deepEqual(result.overall.fixes, { count: 1, denominator: 5, rate: 0.2 });
  assert.deepEqual(result.overall.regressions, { count: 1, denominator: 5, rate: 0.2 });
  assert.throws(() => validateHintReview(control, { ...submission, packet }), /hint_held_out_review_source_mismatch/u);
  assert.throws(() => validateHintReview(control, {
    ...submission, judgments: submission.judgments.map((row) => ({ ...row, unitId: "h01" })),
  }), /hint_held_out_review_incomplete/u);
  assert.throws(() => compareHintRevisions(control, baseline, [...revision].reverse(), reference), /hint_held_out_pairing_mismatch/u);
});
