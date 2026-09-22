import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import {
  LocalBaselineConfigurationError,
  buildLocalBaselineCommands,
  parseLocalBaselineConfiguration,
} from "./local-real-model-baseline.mjs";

const cwd = "C:/repo";

function env(overrides = {}) {
  return {
    TUTORBENCH_LOCAL_MODEL: "qwen3-local",
    TUTORBENCH_BASELINE_ID: "preliminary-qwen3-local-001",
    ...overrides,
  };
}

test("plan mode is loopback-only and dry-run", () => {
  const configuration = parseLocalBaselineConfiguration("plan", env(), cwd);
  assert.equal(configuration.endpoint, "http://127.0.0.1:9001/generate");
  assert.equal(configuration.provider, "local");
  assert.equal(configuration.model, "qwen3-local");
  assert.equal(
    configuration.corpusPath,
    resolve(cwd, "artifacts", "real-model", "preliminary-qwen3-local-001.corpus.json"),
  );
  const commands = buildLocalBaselineCommands(configuration);
  assert.equal(commands.length, 1);
  assert.ok(commands[0].includes("--dry-run"));
  assert.equal(commands[0].filter((value) => value === "--case").length, 4);
});

test("smoke mode uses the fixed bilingual four-case cohort", () => {
  const configuration = parseLocalBaselineConfiguration("smoke", env(), cwd);
  const commands = buildLocalBaselineCommands(configuration);
  assert.equal(commands.length, 3);
  assert.equal(commands[0].filter((value) => value === "--case").length, 4);
  assert.equal(commands[1][0], "dist/src/cli/tutor-corpus-validate.js");
  assert.equal(commands[2][1], "evaluate");
  assert.equal(commands[2].includes("--full"), false);
});

test("full mode resumes the exact smoke corpus and validates full coverage", () => {
  const configuration = parseLocalBaselineConfiguration("full", env(), cwd);
  const commands = buildLocalBaselineCommands(configuration);
  assert.equal(commands.length, 3);
  const resumeIndex = commands[0].indexOf("--resume");
  assert.notEqual(resumeIndex, -1);
  assert.equal(commands[0][resumeIndex + 1], configuration.corpusPath);
  assert.equal(commands[1].includes("--full"), true);
  assert.equal(commands[2].includes("--full"), true);
});

test("optional model version is preserved as provenance input", () => {
  const configuration = parseLocalBaselineConfiguration(
    "plan",
    env({ TUTORBENCH_LOCAL_MODEL_VERSION: "snapshot-2026-09-22" }),
    cwd,
  );
  const command = buildLocalBaselineCommands(configuration)[0];
  const index = command.indexOf("--model-version");
  assert.notEqual(index, -1);
  assert.equal(command[index + 1], "snapshot-2026-09-22");
});

test("non-loopback endpoint is rejected", () => {
  assert.throws(
    () => parseLocalBaselineConfiguration(
      "plan",
      env({ TUTORBENCH_LOCAL_ENDPOINT: "https://api.example.com/generate" }),
      cwd,
    ),
    (error) => error instanceof LocalBaselineConfigurationError &&
      /loopback/u.test(error.message),
  );
});

test("endpoint credentials are rejected", () => {
  assert.throws(
    () => parseLocalBaselineConfiguration(
      "plan",
      env({ TUTORBENCH_LOCAL_ENDPOINT: "http://user:pass@127.0.0.1:9001/generate" }),
      cwd,
    ),
    /credential-free loopback/u,
  );
});

test("model and baseline identity are required", () => {
  assert.throws(
    () => parseLocalBaselineConfiguration(
      "plan",
      { TUTORBENCH_BASELINE_ID: "baseline-001" },
      cwd,
    ),
    /TUTORBENCH_LOCAL_MODEL is required/u,
  );
  assert.throws(
    () => parseLocalBaselineConfiguration(
      "plan",
      { TUTORBENCH_LOCAL_MODEL: "local-model" },
      cwd,
    ),
    /TUTORBENCH_BASELINE_ID is required/u,
  );
});

test("unknown mode is rejected", () => {
  assert.throws(
    () => parseLocalBaselineConfiguration("publish", env(), cwd),
    /Mode must be plan, smoke, or full/u,
  );
});
