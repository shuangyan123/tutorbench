import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_CASE_SYSTEM_VNEXT_STRESS_JUDGE_MAX_OUTPUT_TOKENS,
  parseCaseSystemVNextStressArgs,
  resolveCaseSystemVNextStressJudgeMaxOutputTokens,
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
