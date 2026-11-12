import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertRecoverableSmoke, parseOptions, corpusId,
} from "./deepseek-tutor-efforts-core.mjs";

function fixture() {
  const effort = "high";
  const ctx = {
    selectedCases: [{ id: "fraction-misconception-001-zh-CN", version: "1.2.0" }],
    generationSpec: {
      schemaVersion: 1, specId: "research-deepseek-tutor-effort",
      specVersion: "0.1.0", reasoningEffort: effort, maxOutputTokens: 32768,
    },
    tutorDescriptor: {
      provider: "deepseek", model: "deepseek-flash", promptId: "tutor-baseline-system",
      promptVersion: "0.2", reasoningEffort: effort,
    },
  };
  const attempt = {
    protocol: "deepseek-thinking-effort-tutor-v0.1",
    stage: "smoke", effort, plannedCalls: 1, corpusId: corpusId(effort),
    status: "attempted; not evidence of a successful provider call",
  };
  const report = {
    collectionMode: "canonical_model",
    manifest: {
      corpusId: corpusId(effort),
      corpusVersion: "0.1.0", datasetId: "tutor-eval-v0.2a",
      datasetVersion: "0.2a.6", generationSpec: ctx.generationSpec,
      tutor: ctx.tutorDescriptor,
    },
    requestedCaseCount: 1, runsPerCase: 1,
    plannedTutorCallCount: 1, executedTutorCallCount: 1,
    completedResponseCount: 0, failedTutorCallCount: 1,
    failures: [{
      caseId: "fraction-misconception-001-zh-CN", caseVersion: "1.2.0",
      runIndex: 1, code: "execution_transport_error",
    }],
  };
  return { ctx, effort, attempt, report };
}

test("failed original transport error is recoverable only with exact frozen provenance", () => {
  const { ctx, effort, attempt, report } = fixture();
  assert.doesNotThrow(() => assertRecoverableSmoke(ctx, effort, attempt, report));
});

test("recovery rejects any completed response, changed failure or incorrect case", () => {
  const { ctx, effort, attempt, report } = fixture();
  for (const override of [
    { completedResponseCount: 1 },
    { failedTutorCallCount: 0 },
    { executedTutorCallCount: 0 },
    { requestedCaseCount: 5 },
    { failures: [{ ...report.failures[0], code: "execution_http_error" }] },
    { failures: [{ ...report.failures[0], caseId: "other-case" }] },
    { failures: [{ ...report.failures[0], runIndex: 2 }] },
    { manifest: { ...report.manifest, corpusId: "other" } },
    { manifest: { ...report.manifest, generationSpec: {
      ...ctx.generationSpec, reasoningEffort: "max",
    } } },
    { manifest: { ...report.manifest, tutor: {
      ...ctx.tutorDescriptor, reasoningEffort: "low",
    } } },
  ]) {
    assert.throws(
      () => assertRecoverableSmoke(ctx, effort, attempt, { ...report, ...override }),
      /recovery denied/,
    );
  }
});

test("recovery rejects modified or absent attempt provenance", () => {
  const { ctx, effort, attempt, report } = fixture();
  for (const altered of [
    { ...attempt, effort: "low" },
    { ...attempt, stage: "complete" },
    { ...attempt, plannedCalls: 5 },
    { ...attempt, status: "completed" },
    null,
  ]) {
    assert.throws(() => assertRecoverableSmoke(ctx, effort, altered, report), /recovery denied/);
  }
});

test("recovery requires two distinct live acknowledgments and cannot be used by a normal smoke", () => {
  const args = ["retry-smoke", "--effort", "high", "--execute-live",
    "--acknowledge-possible-duplicate-charge"];
  assert.deepEqual(parseOptions(args), {
    stage: "retry-smoke", effort: "high", live: true, chargeAcknowledged: true,
  });
  for (const bad of [
    args.slice(0, -1),
    ["retry-smoke", "--effort", "high", "--acknowledge-possible-duplicate-charge"],
    ["smoke", "--effort", "high", "--acknowledge-possible-duplicate-charge"],
    ["plan", "--acknowledge-possible-duplicate-charge"],
  ]) {
    assert.throws(() => parseOptions(bad));
  }
});
