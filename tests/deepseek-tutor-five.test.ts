import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { loadTutorEvalDataset } from "../src/datasets/index.js";

const script = resolve(process.cwd(), "scripts/research/deepseek-tutor-five.mjs");
function invoke(args: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(), env: {
      ...env,
      TUTOR_MODEL_API_KEY: undefined,
      CANONICAL_MODEL_HOST_TOKEN: undefined,
      DEEPSEEK_API_KEY: undefined,
    },
    encoding: "utf8", timeout: 15_000,
  });
}
const ids = [
  "fraction-misconception-001-zh-CN",
  "hint-only-linear-equation-001-zh-CN",
  "science-density-knowledge-001-zh-CN",
  "science-force-transfer-001-zh-CN",
  "science-photosynthesis-concept-001-zh-CN",
] as const;

test("zero-call plan resolves exactly five existing source cases without Tutor/Judge calls", async () => {
  const dataset = await loadTutorEvalDataset();
  const cases = ids.map(id => dataset.cases.find(c => c.id === id));
  assert.ok(cases.every(c => c !== undefined));
  assert.deepEqual(cases.map(c => c!.version), ["1.2.0", "1.1.0", "1.1.0", "1.1.0", "1.1.0"]);
  assert.deepEqual(cases.map(c => c!.metadata.subject), [
    "mathematics", "mathematics", "science", "science", "science",
  ]);
  assert.ok(cases.every(c => c!.locale === "zh-CN"));
  assert.ok(cases.every(c => typeof c!.evaluatorOnly.disclosurePolicy === "string"));
  const plan = invoke(["plan"]);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Planned model calls: 5/u);
  assert.match(plan.stdout, /Model calls made: 0/u);
  assert.match(plan.stdout, /deepseek-flash/u);
  assert.doesNotMatch(plan.stdout, /api[_-]?key|evaluatorOnly|rubrics/iu);
});

test("a live collection always requires explicit opt-in and local separate credentials", () => {
  const noConsent = invoke(["smoke"]);
  assert.notEqual(noConsent.status, 0);
  assert.match(noConsent.stderr, /--execute-live/u);
  const missingSecret = invoke(["smoke", "--execute-live"]);
  assert.notEqual(missingSecret.status, 0);
  assert.match(missingSecret.stderr, /configuration missing or different/u);
  const unsupported = invoke(["all", "--execute-live"]);
  assert.notEqual(unsupported.status, 0);
  assert.match(unsupported.stderr, /Usage:/u);
});

test("a second live stage cannot run without its saved and verified smoke corpus", () => {
  const result = invoke(["complete", "--execute-live"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No smoke corpus on disk|configuration missing or different/u);
});
