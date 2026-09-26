import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_CASE_SYSTEM_VNEXT_STRESS_JUDGE_MAX_OUTPUT_TOKENS,
  DEFAULT_CASE_SYSTEM_VNEXT_STRESS_JUDGE_TIMEOUT_MS,
  parseCaseSystemVNextStressArgs,
  resolveCaseSystemVNextStressJudgeMaxOutputTokens,
  resolveCaseSystemVNextStressJudgeTimeoutMs,
} from "../src/cli/case-system-vnext-stress.js";

test("vNext stress CLI parses targeted fixtures without expanding the live call budget", () => {
  const parsed = parseCaseSystemVNextStressArgs([
    "--judge-deepseek",
    "--runs",
    "3",
    "--fixture",
    "math-human-efficiency",
    "--fixture=objective-exam-math-speed",
    "--output",
    "artifacts/targeted-vnext-stress.json",
  ]);

  assert.deepEqual(parsed, {
    judgeDeepSeek: true,
    runsPerFixture: 3,
    fixtureIds: [
      "math-human-efficiency",
      "objective-exam-math-speed",
    ],
    outputPath: resolve(process.cwd(), "artifacts/targeted-vnext-stress.json"),
    help: false,
  });
});

test("vNext stress CLI keeps full-suite selection as the default", () => {
  const parsed = parseCaseSystemVNextStressArgs([
    "--judge-deepseek",
    "--runs=1",
  ]);

  assert.deepEqual(parsed, {
    judgeDeepSeek: true,
    runsPerFixture: 1,
    fixtureIds: [],
    help: false,
  });
});


test("vNext stress defaults to a 32K Judge output budget while preserving explicit overrides", () => {
  assert.equal(DEFAULT_CASE_SYSTEM_VNEXT_STRESS_JUDGE_MAX_OUTPUT_TOKENS, 32_768);
  assert.equal(
    resolveCaseSystemVNextStressJudgeMaxOutputTokens({}, 8192),
    32_768,
  );
  assert.equal(
    resolveCaseSystemVNextStressJudgeMaxOutputTokens(
      { DEEPSEEK_JUDGE_MAX_TOKENS: "16384" },
      16_384,
    ),
    16_384,
  );
});


test("vNext stress defaults to a 120-second timeout while preserving explicit overrides", () => {
  assert.equal(DEFAULT_CASE_SYSTEM_VNEXT_STRESS_JUDGE_TIMEOUT_MS, 120_000);
  assert.equal(resolveCaseSystemVNextStressJudgeTimeoutMs({}, 60_000), 120_000);
  assert.equal(
    resolveCaseSystemVNextStressJudgeTimeoutMs(
      { DEEPSEEK_JUDGE_TIMEOUT_MS: "90000" },
      90_000,
    ),
    90_000,
  );
});
