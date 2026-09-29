import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, readdir, rm, writeFile, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildTutorHealthRunManifest, formatTutorHealthRunManifest, parseTutorHealthRunManifest,
  isTutorHealthRunManifest, verifyTutorHealthRunManifest,
} from "../src/index.js";
import { tutorHealthComparisonJson } from "../src/contracts/tutor-health-comparison-validation.js";
import { TUTOR_HEALTH_ARTIFACT_FILES, writeTutorHealthArtifacts } from "../src/cli/tutorbench-health-artifacts.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("run manifest binds exact artifact bytes and canonical complete suite without copying private evidence", async () => {
  const { baseline } = await syntheticDesignPartnerPilot(2);
  const evaluation = { ...baseline.evaluation, tutor: { ...baseline.evaluation.tutor,
    modelVersion: "fixture-2026", promptId: "policy-alias", temperature: 0, reasoningEffort: "low", seed: 7 },
    judge: { ...baseline.evaluation.judge!, modelVersion: "fixture", promptId: "judge-alias", temperature: 0,
      reasoningEffort: "low", thinkingMode: "disabled" as const, maxOutputTokens: 100, timeoutMs: 500, maxAttempts: 1, seed: 3 },
  };
  const input = { suite: baseline.suite, evaluationJson: `${JSON.stringify(evaluation, null, 2)}\n`,
    reportJson: `${JSON.stringify(baseline.report, null, 2)}\n` };
  const manifest = buildTutorHealthRunManifest(input);
  const bytes = formatTutorHealthRunManifest(manifest);
  assert.deepEqual(parseTutorHealthRunManifest(JSON.parse(bytes)), manifest);
  assert.equal(formatTutorHealthRunManifest(buildTutorHealthRunManifest(structuredClone(input))), bytes);
  assert.equal(manifest.suite.sha256, sha256(tutorHealthComparisonJson(input.suite)));
  assert.equal(manifest.evaluation.sha256, sha256(input.evaluationJson));
  assert.equal(manifest.report.sha256, sha256(input.reportJson));
  assert.equal(manifest.runsPerCase, 2);
  assert.deepEqual(manifest.tutor, evaluation.tutor);
  assert.deepEqual(manifest.judge, evaluation.judge);
  assert.equal(manifest.provenance, "local_execution_only");
  verifyTutorHealthRunManifest(manifest, input);
  assert.doesNotMatch(bytes, /rawTutorResponse|rawJudgeResult|conversationHistory|evaluationCriteria|endpoint|credential|hiddenReasoning|createdAt/);
  for (const result of evaluation.caseResults) {
    assert.ok(!bytes.includes(result.rawTutorResponse!));
    assert.ok(!bytes.includes(JSON.stringify(result.rawJudgeResult)));
  }
  for (const scenario of input.suite.scenarios) {
    for (const turn of scenario.trajectory.conversationHistory) assert.ok(!bytes.includes(turn.content));
    for (const point of scenario.decisionPoints) {
      assert.ok(!bytes.includes(point.expectedBehavior));
      for (const criterion of point.evaluationCriteria) assert.ok(!bytes.includes(criterion.criterion));
    }
  }

  const reordered = JSON.parse(tutorHealthComparisonJson(input.suite)) as typeof input.suite;
  assert.equal(buildTutorHealthRunManifest({ ...input, suite: reordered }).suite.sha256, manifest.suite.sha256);
  const changed = { ...input.suite, scenarios: input.suite.scenarios.map((scenario, index) => index === 0 ? {
    ...scenario, decisionPoints: scenario.decisionPoints.map((point) => ({ ...point, expectedBehavior: "Changed synthetic teaching policy." })),
  } : scenario) };
  assert.notEqual(buildTutorHealthRunManifest({ ...input, suite: changed }).suite.sha256, manifest.suite.sha256);
  assert.notEqual(buildTutorHealthRunManifest({ ...input, suite: { ...input.suite, scenarios: [...input.suite.scenarios].reverse() } }).suite.sha256, manifest.suite.sha256);
  assert.throws(() => verifyTutorHealthRunManifest(manifest, { ...input, suite: changed }), /does not match/);
  // 来源文件哈希刻意绑定字节：仅重新排版也会失配，suite 语义哈希则忽略对象键顺序。
  for (const key of ["evaluationJson", "reportJson"] as const) {
    assert.throws(() => verifyTutorHealthRunManifest(manifest, { ...input, [key]: `${input[key]}\n` }), /does not match/);
  }
});

test("caught mid-write failure removes only this attempt's files and never leaves a manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "health-write-failure-"));
  const { baseline } = await syntheticDesignPartnerPilot();
  const handle = await open(join(directory, "private-notes.txt"), "wx");
  await handle.writeFile("existing private notes");
  const prototype = Object.getPrototypeOf(handle) as FileHandle;
  await handle.close();
  const write = prototype.writeFile;
  let writes = 0;
  t.mock.method(prototype, "writeFile", async function (this: FileHandle, ...args: Parameters<typeof write>) {
    writes += 1;
    if (writes === 3) throw new Error("private-error-sentinel");
    return write.apply(this, args);
  });
  try {
    await assert.rejects(writeTutorHealthArtifacts({ directory, ...baseline }), (error: Error) => {
      assert.match(error.message, /files created by this attempt were removed/);
      assert.doesNotMatch(error.message, /private-error-sentinel/);
      return true;
    });
    assert.equal(writes, 3);
    assert.deepEqual(await readdir(directory), ["private-notes.txt"]);
    assert.equal(await readFile(join(directory, "private-notes.txt"), "utf8"), "existing private notes");
  } finally {
    t.mock.restoreAll();
    await rm(directory, { recursive: true, force: true });
  }
});

test("manifest validation rejects missing/malformed identity and unbounded descriptor fields without leaking values", async () => {
  const { baseline } = await syntheticDesignPartnerPilot();
  const input = { suite: baseline.suite, evaluationJson: JSON.stringify(baseline.evaluation), reportJson: JSON.stringify(baseline.report) };
  const manifest = buildTutorHealthRunManifest(input);
  const invalid: unknown[] = [null, [], {}, { ...manifest, kind: "other" }, { ...manifest, schemaVersion: 2 },
    { ...manifest, provenance: "provider_attestation" }, { ...manifest, runsPerCase: 0 }, { ...manifest, runsPerCase: 1.5 },
    { ...manifest, runsPerCase: Number.MAX_SAFE_INTEGER + 1 }, { ...manifest, endpoint: "private-sentinel" },
  ];
  for (const key of Object.keys(manifest)) {
    invalid.push(Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== key)));
  }
  for (const key of ["suite", "evaluation", "report", "tutor", "judge"] as const) {
    const nested = manifest[key]!;
    for (const field of Object.keys(nested)) {
      invalid.push({ ...manifest, [key]: { ...nested, [field]: "" } });
      invalid.push({ ...manifest, [key]: Object.fromEntries(Object.entries(nested).filter(([name]) => name !== field)) });
    }
    invalid.push({ ...manifest, [key]: { ...nested, private: "private-sentinel" } });
  }
  for (const value of invalid) {
    assert.equal(isTutorHealthRunManifest(value), false);
    assert.throws(() => parseTutorHealthRunManifest(value), (error: Error) => {
      assert.doesNotMatch(error.message, /private-sentinel/);
      return /manifest.*invalid/.test(error.message);
    });
  }
  for (const tutor of [{ ...baseline.evaluation.tutor, provider: "x".repeat(301) },
    { ...baseline.evaluation.tutor, endpoint: "private-sentinel", credentials: "private-sentinel", hiddenReasoning: "private-sentinel" }]) {
    assert.throws(() => buildTutorHealthRunManifest({ ...input, evaluationJson: JSON.stringify({ ...baseline.evaluation, tutor }) }), /manifest.*invalid/);
  }
  assert.throws(() => buildTutorHealthRunManifest({ ...input, evaluationJson: '{"private-sentinel":' }), /manifest.*invalid/);
  for (const changes of [{ evaluatorVersion: undefined }, { runId: "other" }, { datasetId: "other" }]) {
    assert.throws(() => buildTutorHealthRunManifest({ ...input, evaluationJson: JSON.stringify({ ...baseline.evaluation, ...changes }) }), /manifest.*invalid/);
  }
});

test("health artifact writer preserves source values, legacy formatting, unrelated files, and refuses collisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "health-manifest-writer-"));
  try {
    const { baseline } = await syntheticDesignPartnerPilot();
    const sourceBytes = JSON.stringify(baseline);
    await writeFile(join(directory, "notes.txt"), "private notes");
    await writeTutorHealthArtifacts({ directory, ...baseline });
    assert.equal(JSON.stringify(baseline), sourceBytes);
    const evaluationJson = await readFile(join(directory, "evaluation.json"), "utf8");
    const reportJson = await readFile(join(directory, "health-report.json"), "utf8");
    assert.equal(evaluationJson, `${JSON.stringify(baseline.evaluation, null, 2)}\n`);
    assert.equal(reportJson, `${JSON.stringify(baseline.report, null, 2)}\n`);
    const manifestJson = await readFile(join(directory, "pilot-run-manifest.json"), "utf8");
    verifyTutorHealthRunManifest(JSON.parse(manifestJson), { suite: baseline.suite, evaluationJson, reportJson });
    await assert.rejects(writeTutorHealthArtifacts({ directory, ...baseline }), /no existing health artifacts/);
    assert.equal(await readFile(join(directory, "pilot-run-manifest.json"), "utf8"), manifestJson);
    assert.equal(await readFile(join(directory, "notes.txt"), "utf8"), "private notes");
    const invalidDirectory = join(directory, "invalid");
    await assert.rejects(writeTutorHealthArtifacts({ directory: invalidDirectory, ...baseline,
      evaluation: { ...baseline.evaluation, evaluatorVersion: "" } }), /manifest.*invalid/);
    await assert.rejects(readdir(invalidDirectory));
    assert.deepEqual((await readdir(directory)).sort(), [...TUTOR_HEALTH_ARTIFACT_FILES, "notes.txt"].sort());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
