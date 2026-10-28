import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { parseTutorResponseCorpus } from "../src/contracts/tutor-response-corpus-validation.js";
import { deriveTutorResponseId } from "../src/corpus/identity.js";

const fixturePath = new URL("../../fixtures/judge/math-rubric-counterexamples-v0.1.json", import.meta.url);
const suitePath = new URL("../../scenarios/experimental/mathematics-challenge-v0.1/suite.json", import.meta.url);

interface ProbeVariant {
  id: string;
  responseText: string;
  expectedRubricResults: Record<string, "PASS" | "PARTIAL" | "FAIL">;
  rationale: string;
}
interface ProbeCase {
  caseId: string;
  findingId: string;
  rubricIds: string[];
  variants: ProbeVariant[];
}
interface ProbeFixture {
  schemaVersion: number;
  id: string;
  calibrationStatus: string;
  provenance: string;
  cases: ProbeCase[];
}

async function readAssets() {
  const [rawSuite, rawFixture] = await Promise.all([
    readFile(suitePath, "utf8"), readFile(fixturePath, "utf8"),
  ]);
  const suite = parseTutorScenarioSuiteVNext(JSON.parse(rawSuite) as unknown);
  const fixture = JSON.parse(rawFixture) as ProbeFixture;
  return { dataset: tutorScenarioSuiteToTutorEvalDataset(suite), fixture };
}

test("math counterexample diagnostic fixtures align exactly with authored case and rubric identities", async () => {
  const { dataset, fixture } = await readAssets();
  assert.equal(fixture.id, "math-rubric-counterexamples-v0.1");
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.calibrationStatus, "uncalibrated");
  assert.equal(fixture.provenance, "developer-authored-diagnostic-expectations");
  assert.equal(fixture.cases.length, 3);
  assert.equal(new Set(fixture.cases.map(c => c.caseId)).size, 3);

  for (const group of fixture.cases) {
    const matched = dataset.cases.find(c => c.id === group.caseId);
    assert.ok(matched, group.caseId);
    assert.equal(matched.evaluatorOnly.disclosurePolicy, "hint_only");
    assert.deepEqual(group.rubricIds, matched.evaluatorOnly.rubrics.map(r => r.id));
    assert.ok(group.variants.length >= 4);
    assert.equal(new Set(group.variants.map(v => v.id)).size, group.variants.length);
    assert.ok(group.variants.some(v => v.id === "minimal-correct"));
    assert.ok(group.variants.some(v => v.id === "answer-takeover"));
    assert.ok(group.variants.some(v => v.id.startsWith("wrong-")));
    const rubrics = matched.evaluatorOnly.rubrics.map(r => r.id);
    for (const v of group.variants) {
      assert.ok(v.responseText.trim().length > 0);
      assert.ok(v.rationale.trim().length > 0);
      assert.deepEqual(Object.keys(v.expectedRubricResults).sort(), [...rubrics].sort());
      assert.ok(Object.values(v.expectedRubricResults).every(label =>
        ["PASS", "PARTIAL", "FAIL"].includes(label)));
    }
  }
});

test("counterexample responses can be encoded as valid frozen corpora without a live model", async () => {
  const { dataset, fixture } = await readAssets();
  for (const group of fixture.cases) {
    const target = dataset.cases.find(c => c.id === group.caseId)!;
    const tutor = { provider: "review_workspace", model: "developer-authored-counterexample", promptVersion: "0.1.0" };
    const identity = { corpusId: "math-rubric-probe-" + group.caseId, corpusVersion: "0.1.0",
      datasetId: dataset.id, datasetVersion: dataset.version };
    const corpus = parseTutorResponseCorpus({
      schemaVersion: 1, ...identity, createdAt: "2026-10-28T00:00:00.000Z",
      coverage: "partial", runsPerCase: group.variants.length, provenance: "review_workspace",
      tutor, responses: group.variants.map((v, i) => ({
        schemaVersion: 1, caseId: group.caseId, caseVersion: target.version, runIndex: i + 1,
        responseId: deriveTutorResponseId({ ...identity, caseId: group.caseId,
          caseVersion: target.version, tutor, runIndex: i + 1 }),
        responseText: v.responseText, provenance: "review_workspace",
      })),
    });
    assert.equal(corpus.responses.length, group.variants.length);
    assert.ok(corpus.responses.every(r => r.provenance === "review_workspace"));
  }
});

test("probe dry-run validates without a Judge and explicit live mode fails closed without keys", () => {
  const command = "scripts/math-rubric-counterexample-probe.mjs";
  const safeEnv = { ...process.env, DEEPSEEK_API_KEY: "", DEEPSEEK_JUDGE_MODEL: "" };
  const output = execFileSync(process.execPath, [command, "--dry-run"], {
    cwd: process.cwd(), encoding: "utf8", env: safeEnv,
  });
  assert.match(output, /VALIDATED: 3 cases, 13 synthetic responses, 0 Judge calls/u);
  const targeted = execFileSync(process.execPath, [
    command, "--dry-run",
    "--variant", "wrong-agreement",
    "--variant", "wrong-diagnosis",
    "--variant", "wrong-endorsement",
  ], { cwd: process.cwd(), encoding: "utf8", env: safeEnv });
  assert.match(targeted, /VALIDATED: 3 cases, 4 synthetic responses, 0 Judge calls/u);
  const versioned = execFileSync(process.execPath, [
    command, "--dry-run", "--judge-prompt-version", "0.9.1",
    "--variant", "wrong-diagnosis",
  ], { cwd: process.cwd(), encoding: "utf8", env: safeEnv });
  assert.match(versioned, /VALIDATED: 1 cases, 1 synthetic responses, 0 Judge calls\. Judge prompt 0\.9\.1\./u);
  const badVersion = spawnSync(process.execPath, [
    command, "--dry-run", "--judge-prompt-version", "0.10",
  ], { cwd: process.cwd(), encoding: "utf8", env: safeEnv });
  assert.notEqual(badVersion.status, 0);
  assert.match(badVersion.stderr, /Allowed --judge-prompt-version values/u);
  const unknown = spawnSync(process.execPath, [
    command, "--dry-run", "--variant", "no-such-variant",
  ], { cwd: process.cwd(), encoding: "utf8", env: safeEnv });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown fixture variant/u);
  const dryDiagnostic = spawnSync(process.execPath, [command, "--dry-run", "--diagnose-invalid"], {
    cwd: process.cwd(), encoding: "utf8", env: safeEnv,
  });
  assert.notEqual(dryDiagnostic.status, 0);
  assert.match(dryDiagnostic.stderr, /requires --judge-deepseek/u);
  const blocked = spawnSync(process.execPath, [command, "--judge-deepseek"], {
    cwd: process.cwd(), encoding: "utf8", env: safeEnv,
  });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /requires locally configured DEEPSEEK_API_KEY/u);
});


test("redacted provider diagnostics detect schema defects without retaining model text", async () => {
  const moduleUrl = new URL("../../scripts/math-rubric-probe-response-diagnostics.mjs", import.meta.url).href;
  const { classifyMathJudgeEnvelope } = await import(moduleUrl) as {
    classifyMathJudgeEnvelope: (
      value: unknown, caseId: string, rubrics: string[],
    ) => { phase: string; issues?: string[] };
  };
  const ids = ["test-math-1", "test-math-2"];
  const valid = {
    schemaVersion: 1, caseId: "test-math",
    rubricResults: ids.map(id => ({ rubricId: id, result: "FAIL", evidence: "Contradicts the concept." })),
    criticalFailures: [], factualErrors: [], insufficientInformation: false,
  };
  const envelope = (content: unknown): unknown => ({
    choices: [{ finish_reason: "stop", message: { content } }],
  });
  assert.equal(classifyMathJudgeEnvelope(envelope(JSON.stringify(valid)), "test-math", ids).phase, "valid_judge_schema");
  assert.equal(classifyMathJudgeEnvelope(envelope("{bad json}"), "test-math", ids).phase, "final_content_json_invalid");
  assert.equal(classifyMathJudgeEnvelope(envelope(null), "test-math", ids).phase, "final_content_missing");
  const malformed = { ...valid, factualErrors: [{ error: "Wrong result", severity: "major" }] };
  const diagnosis = classifyMathJudgeEnvelope(envelope(JSON.stringify(malformed)), "test-math", ids);
  assert.equal(diagnosis.phase, "judge_schema_invalid");
  assert.ok(diagnosis.issues?.includes("factual_error_item_invalid"));
  assert.ok(diagnosis.issues?.includes("factual_error_description_invalid"));
  assert.doesNotMatch(JSON.stringify(diagnosis), /Wrong result|Contradicts the concept/u);
  const omitted = classifyMathJudgeEnvelope(envelope(JSON.stringify({
    ...valid, insufficientInformation: undefined,
  })), "test-math", ids);
  assert.ok(omitted.issues?.includes("insufficient_information_invalid"));
  const noSeverity = classifyMathJudgeEnvelope(envelope(JSON.stringify({
    ...valid, factualErrors: [{ description: "Incorrect factor" }],
  })), "test-math", ids);
  assert.ok(noSeverity.issues?.includes("factual_error_severity_invalid"));
});

test("v0.9.1 is an isolated output-shape clarification, while v0.9 remains frozen", async () => {
  const oldPrompt = await readFile(new URL("../../prompts/tutor-eval-pedagogy-judge-system-v0.9.md", import.meta.url), "utf8");
  const newPrompt = await readFile(new URL("../../prompts/tutor-eval-pedagogy-judge-system-v0.9.1.md", import.meta.url), "utf8");
  const beforeContract = (text: string) => text.slice(0, text.indexOf("## Output contract"))
    .replace("# TutorEval Pedagogy Judge — System Prompt v0.9.1 (experimental output-shape clarification)",
      "# TutorEval Pedagogy Judge — System Prompt v0.9");
  assert.equal(beforeContract(newPrompt), beforeContract(oldPrompt));
  assert.match(newPrompt, /"factualErrors": \[/u);
  assert.match(newPrompt, /"description": "The Tutor incorrectly states/u);
  assert.match(newPrompt, /"severity": "major"/u);
  assert.match(newPrompt, /If there are no supported factual/u);
});
