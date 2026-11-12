import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { loadTutorEvalDataset } from "../src/datasets/index.js";

const path = resolve("scripts/research/deepseek-tutor-efforts.mjs");
function invoke(args: string[]) {
  return spawnSync(process.execPath, [path, ...args], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15000,
    env: {
      ...process.env,
      DEEPSEEK_API_KEY: undefined,
      TUTOR_MODEL_API_KEY: undefined,
      CANONICAL_MODEL_HOST_TOKEN: undefined,
      TUTOR_MODEL: undefined,
    },
  });
}

test("three-effort Tutor plan is zero-call and uses five existing versioned teaching cases", async () => {
  const { status, stdout, stderr } = invoke(["plan"]);
  assert.equal(status, 0, stderr);
  const plan = JSON.parse(stdout);
  assert.deepEqual(plan.efforts, ["low", "high", "max"]);
  assert.equal(plan.totalPlannedProviderCalls, 15);
  assert.equal(plan.perEffortCases, 5);
  assert.equal(plan.maxOutputTokens, 32768);
  assert.equal(plan.actualCalls, 0);
  assert.equal(plan.calibration, "not_calibrated");
  assert.equal(plan.source, "tutor-eval-v0.2a@0.2a.6");
  const dataset = await loadTutorEvalDataset();
  assert.deepEqual(plan.cases.map((c: { id: string }) => c.id), [
    "fraction-misconception-001-zh-CN",
    "hint-only-linear-equation-001-zh-CN",
    "science-density-knowledge-001-zh-CN",
    "science-force-transfer-001-zh-CN",
    "science-photosynthesis-concept-001-zh-CN",
  ]);
  for (const entry of plan.cases) {
    const source = dataset.cases.find(c => c.id === entry.id);
    assert.ok(source);
    assert.equal(source.version, entry.version);
    assert.equal(source.locale, "zh-CN");
  }
  assert.doesNotMatch(stdout, /api[_-]?key|evaluatorOnly|groundTruth|knownMisconception/i);
});

test("each effort's live smoke requires explicit authorization and a private credential", () => {
  for (const effort of ["low", "high", "max"]) {
    const noConsent = invoke(["smoke", "--effort", effort]);
    assert.notEqual(noConsent.status, 0);
    assert.match(noConsent.stderr, /--execute-live/u);
    const noSecrets = invoke(["smoke", "--effort", effort, "--execute-live"]);
    assert.notEqual(noSecrets.status, 0);
    assert.match(noSecrets.stderr, /private credentials|Missing exact DeepSeek/u);
  }
});

test("invalid effort and unexpected options fail before any model request", () => {
  for (const args of [
    ["smoke", "--effort", "medium", "--execute-live"],
    ["complete", "--effort", "none", "--execute-live"],
    ["plan", "--execute-live"],
    ["plan", "--effort", "high"],
    ["inspect", "--effort", "high", "--execute-live"],
    ["smoke", "--effort", "low", "--execute-live", "--execute-live"],
  ]) {
    const result = invoke(args);
    assert.notEqual(result.status, 0, args.join(" ") + " unexpectedly passed");
  }
});

test("offline inspection never treats missing genuine corpus as real model evidence", () => {
  const result = invoke(["inspect", "--effort", "max"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No valid frozen one-case smoke/u);
});
