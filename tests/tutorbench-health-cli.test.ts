import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { createHttpTutor } from "../src/adapters/http-tutor.js";
import { loadTutorScenarioSuiteVNext } from "../src/datasets/real-world.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { parseTutorbenchArgs } from "../src/cli/tutorbench.js";
import { parseTutorHealthRunManifest, parseTutorHealthComparison, verifyTutorHealthRunManifest } from "../src/index.js";
import { TUTOR_HEALTH_ARTIFACT_FILES } from "../src/cli/tutorbench-health-artifacts.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";

interface CliResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: readonly string[]): Promise<CliResult> {
  const cliPath = resolve(process.cwd(), "dist", "src", "cli", "tutorbench.js");
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

interface TutorHttpFixture {
  readonly endpoint: string;
  readonly requestBodies: Record<string, unknown>[];
  readonly server: Server;
}

async function startTutorHttpFixture(onRequest?: () => Promise<void>): Promise<TutorHttpFixture> {
  const requestBodies: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    requestBodies.push(
      JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
    );
    await onRequest?.();
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ text: "Try the next small step." }));
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  return {
    endpoint: `http://127.0.0.1:${address.port}/respond`,
    requestBodies,
    server,
  };
}

async function closeTutorHttpFixture(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error === undefined ? resolveClose() : reject(error)));
  });
}

function healthArguments(endpoint: string, outputDirectory: string): string[] {
  return [
    "health",
    "--http",
    endpoint,
    "--suite",
    "productive-struggle-intervention-v0.1",
    "--runs",
    "1",
    "--timeout-ms",
    "5000",
    "--output",
    outputDirectory,
    "--tutor-provider",
    "partner",
    "--tutor-model",
    "production",
    "--prompt-version",
    "v17",
  ];
}

test("tutorbench health parser handles suite, run, provenance, Judge, and required HTTP options", () => {
  const parsed = parseTutorbenchArgs([
    "health",
    "--http=https://partner.example.com/respond",
    "--suite=productive-struggle-intervention-v0.1",
    "--runs=2",
    "--timeout-ms",
    "9000",
    "--output",
    "artifacts/partner-pilot",
    "--tutor-provider",
    "partner",
    "--tutor-model=production",
    "--prompt-version",
    "v18",
    "--judge-chat-completions",
  ]);
  assert.equal(parsed.help, false);
  if (parsed.help || !("health" in parsed) || parsed.health.help) {
    return;
  }
  assert.deepEqual(parsed.health, {
    help: false,
    endpoint: "https://partner.example.com/respond",
    suiteId: "productive-struggle-intervention-v0.1",
    runsPerCase: 2,
    timeoutMs: 9000,
    outputDirectory: resolve(process.cwd(), "artifacts/partner-pilot"),
    tutorProvider: "partner",
    tutorModel: "production",
    promptVersion: "v18",
    openAIJudge: false,
    deepSeekJudge: false,
    chatCompletionsJudge: true,
  });

  assert.deepEqual(parseTutorbenchArgs(["health", "--help"]), {
    help: true,
    helpCommand: "health",
  });
  assert.throws(() => parseTutorbenchArgs(["health"]), /--http requires a value/);
  assert.throws(
    () => parseTutorbenchArgs([
      ...healthArguments("http://localhost/respond", "artifacts/health"),
      "--judge-openai",
      "--judge-deepseek",
    ]),
    /mutually exclusive/,
  );
});

test("tutorbench health evaluates external HTTP Tutor and writes both evidence layers", async () => {
  const fixture = await startTutorHttpFixture();
  const outputRoot = await mkdtemp(join(tmpdir(), "tutorbench-health-cli-"));
  const outputDirectory = join(outputRoot, "partner-pilot");
  const evaluationPath = join(outputDirectory, "evaluation.json");
  const reportJsonPath = join(outputDirectory, "health-report.json");
  const reportTextPath = join(outputDirectory, "health-report.txt");

  try {
    const result = await runCli(healthArguments(fixture.endpoint, outputDirectory));
    assert.equal(result.exitCode, 2);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Tutor Health Score:/);
    assert.match(result.stdout, /COVERAGE/);
    assert.match(result.stdout, /Release Gate: UNRESOLVED/);
    assert.match(result.stdout, /not complete evaluation evidence/i);
    assert.equal(fixture.requestBodies.length, 13);

    const evaluationText = await readFile(evaluationPath, "utf8");
    const evaluation = JSON.parse(evaluationText) as {
      readonly tutor: {
        readonly provider: string;
        readonly model: string;
        readonly promptVersion: string;
      };
      readonly judge: unknown;
      readonly caseCount: number;
      readonly caseRunCount: number;
      readonly caseResults: readonly {
        readonly status: string;
        readonly rubricResults: readonly { readonly result: string }[];
        readonly diagnostics: readonly { readonly code: string }[];
      }[];
    };
    const report = JSON.parse(await readFile(reportJsonPath, "utf8")) as {
      readonly releaseGate: string;
      readonly unresolved: readonly unknown[];
      readonly findings: readonly { readonly type: string }[];
    };
    const reportText = await readFile(reportTextPath, "utf8");

    assert.deepEqual(evaluation.tutor, {
      provider: "partner",
      model: "production",
      promptVersion: "v17",
    });
    assert.equal(evaluation.judge, null);
    assert.equal(evaluation.caseCount, 13);
    assert.equal(evaluation.caseRunCount, 13);
    assert.ok(evaluation.caseResults.every((caseResult) =>
      caseResult.status === "error" &&
      caseResult.rubricResults.some((rubric) => rubric.result === "ERROR") &&
      caseResult.diagnostics.some((diagnostic) => diagnostic.code === "judge_unavailable"),
    ));
    assert.equal(report.releaseGate, "UNRESOLVED");
    assert.ok(report.unresolved.length > 0);
    assert.ok(!report.findings.some((finding) => finding.type === "premature_intervention"));
    assert.match(reportText, /Tutor Health Score:/);
    assert.match(reportText, /Release Gate: UNRESOLVED/);
    assert.doesNotMatch(evaluationText, /127\.0\.0\.1|api[_-]?key|rawProviderPayload/i);
    assert.doesNotMatch(await readFile(reportJsonPath, "utf8"), /127\.0\.0\.1|api[_-]?key/i);
    verifyTutorHealthRunManifest(JSON.parse(await readFile(join(outputDirectory, "pilot-run-manifest.json"), "utf8")), {
      suite: await loadTutorScenarioSuiteVNext(), evaluationJson: evaluationText, reportJson: await readFile(reportJsonPath, "utf8"),
    });
  } finally {
    await closeTutorHttpFixture(fixture.server);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

function privateHealthArguments(endpoint: string, output: string, suitePath?: string): string[] {
  const args = healthArguments(endpoint, output);
  args.splice(args.indexOf("--suite"), 2);
  return suitePath === undefined ? args : [...args, "--suite-file", suitePath];
}

test("health suite selectors are exclusive and public defaults and provenance requirements stay intact", async () => {
  const args = privateHealthArguments("http://localhost/respond", "artifacts/health");
  const parsed = parseTutorbenchArgs(args);
  assert.ok(!parsed.help && "health" in parsed && !parsed.health.help);
  assert.equal(parsed.health.suiteId, "productive-struggle-intervention-v0.1");
  for (const selector of [["--suite-file", "synthetic.json"], ["--suite-file=synthetic.json"]]) {
    const privateParsed = parseTutorbenchArgs([...args, ...selector]);
    assert.ok(!privateParsed.help && "health" in privateParsed && !privateParsed.health.help);
    assert.equal(privateParsed.health.suiteFile, resolve("synthetic.json"));
    assert.equal(privateParsed.health.suiteId, undefined);
    for (const combined of [[...args, ...selector, "--suite", "productive-struggle-intervention-v0.1"],
      [...healthArguments("http://localhost/respond", "artifacts/health"), ...selector]]) {
      assert.throws(() => parseTutorbenchArgs(combined), /mutually exclusive/);
      assert.equal((await runCli(combined)).exitCode, 1);
    }
  }
  for (const flag of ["--tutor-provider", "--tutor-model", "--prompt-version"]) {
    const missing = [...args, "--suite-file", "synthetic.json"];
    missing.splice(missing.indexOf(flag), 2);
    assert.throws(() => parseTutorbenchArgs(missing), /requires a value/);
  }
  for (const extra of [["--suite-file"], ["--suite-file="], ["--suite-file", "one", "--suite-file", "two"]]) {
    assert.throws(() => parseTutorbenchArgs([...args, ...extra]));
  }
  const help = await runCli(["health", "--help"]);
  assert.match(help.stdout, /--suite-file/);
  assert.match(help.stdout, /pilot-run-manifest/);
});

test("health private suite uses its loaded snapshot, writes private-safe manifest, and remains comparable", async () => {
  const root = await mkdtemp(join(tmpdir(), "health-private-suite-"));
  const { suite } = await syntheticDesignPartnerPilot();
  const suitePath = join(root, "private-suite.json");
  const original = JSON.stringify(suite);
  await writeFile(suitePath, original);
  // 执行期间磁盘来源变化不能改写已加载 suite 的运行身份。
  const fixture = await startTutorHttpFixture(async () => {
    await writeFile(suitePath, JSON.stringify({ ...suite, description: "Changed after load." }));
  });
  try {
    for (const role of ["baseline", "candidate"]) {
      await writeFile(suitePath, original);
      const directory = join(root, role);
      const result = await runCli(privateHealthArguments(fixture.endpoint, directory, suitePath));
      assert.equal(result.exitCode, 2, result.stderr);
      assert.equal(result.stderr, "");
      assert.match(result.stdout, /Release Gate: UNRESOLVED/);
      const evaluationJson = await readFile(join(directory, "evaluation.json"), "utf8");
      const reportJson = await readFile(join(directory, "health-report.json"), "utf8");
      const manifestJson = await readFile(join(directory, "pilot-run-manifest.json"), "utf8");
      const manifest = parseTutorHealthRunManifest(JSON.parse(manifestJson));
      verifyTutorHealthRunManifest(manifest, { suite, evaluationJson, reportJson });
      assert.equal(manifest.suite.id, suite.id);
      assert.equal(manifest.judge, null);
      assert.doesNotMatch(manifestJson, /127\.0\.0\.1|Try the next small step|rawTutorResponse|rawJudgeResult|conversation|credential|hiddenReasoning/);
      assert.deepEqual((await readdir(directory)).sort(), [...TUTOR_HEALTH_ARTIFACT_FILES].sort());
    }
    assert.equal(fixture.requestBodies.length, suite.scenarios.length * 2);
    assert.doesNotMatch(JSON.stringify(fixture.requestBodies), /evaluationCriteria|evaluatorReferenceState|failureFinding/);
    await writeFile(suitePath, original);
    const comparisonPath = join(root, "comparison.json");
    const compareArgs = ["health-compare", "--baseline", join(root, "baseline"), "--candidate", join(root, "candidate"),
      "--baseline-suite", suitePath, "--candidate-suite", suitePath, "--output", comparisonPath];
    const compare = await runCli(compareArgs);
    assert.equal(compare.exitCode, 2, compare.stderr);
    assert.equal(parseTutorHealthComparison(JSON.parse(await readFile(comparisonPath, "utf8"))).counts.unresolved, 4);
    const sourcePath = join(root, "candidate", "evaluation.json");
    await writeFile(sourcePath, `${await readFile(sourcePath, "utf8")}\n`);
    const tampered = await runCli([...compareArgs.slice(0, -1), join(root, "tampered.json")]);
    assert.equal(tampered.exitCode, 1);
    assert.match(tampered.stderr, /manifest does not match/);
    await assert.rejects(access(join(root, "tampered.json")));
  } finally {
    await closeTutorHttpFixture(fixture.server);
    await rm(root, { recursive: true, force: true });
  }
});

test("health rejects private JSON/schema errors and every output collision before HTTP execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "health-private-invalid-"));
  const fixture = await startTutorHttpFixture();
  const { suite } = await syntheticDesignPartnerPilot();
  const suitePath = join(root, "private-path-sentinel.json");
  const output = join(root, "output");
  try {
    for (const value of ['{"private-content-sentinel":', JSON.stringify({ ...suite, schemaVersion: 999, title: "private-content-sentinel" })]) {
      await writeFile(suitePath, value);
      const result = await runCli(privateHealthArguments(fixture.endpoint, output, suitePath));
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /valid Scenario vNext suite/);
      assert.doesNotMatch(result.stderr + result.stdout, /private-content-sentinel|private-path-sentinel/);
      await assert.rejects(access(output));
      assert.equal(await readFile(suitePath, "utf8"), value);
    }
    for (const path of [join(root, "absent-private-path-sentinel"), "https://private-path-sentinel.invalid/suite.json"]) {
      const result = await runCli(privateHealthArguments(fixture.endpoint, output, path));
      assert.equal(result.exitCode, 1);
      assert.doesNotMatch(result.stderr + result.stdout, /private-path-sentinel/);
    }
    await writeFile(suitePath, JSON.stringify(suite));
    for (const filename of TUTOR_HEALTH_ARTIFACT_FILES) {
      const directory = join(root, filename);
      await mkdir(directory);
      await writeFile(join(directory, filename), "private-existing-sentinel");
      const result = await runCli(privateHealthArguments(fixture.endpoint, directory, suitePath));
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /no existing health artifacts/);
      assert.deepEqual(await readdir(directory), [filename]);
      assert.equal(await readFile(join(directory, filename), "utf8"), "private-existing-sentinel");
      assert.doesNotMatch(result.stderr + result.stdout, /private-existing-sentinel/);
    }
    assert.equal(fixture.requestBodies.length, 0);
  } finally {
    await closeTutorHttpFixture(fixture.server);
    await rm(root, { recursive: true, force: true });
  }
});

test("health still executes both default and experimental registered suites", async () => {
  const root = await mkdtemp(join(tmpdir(), "health-public-default-"));
  const fixture = await startTutorHttpFixture();
  try {
    for (const suiteId of [undefined, "case-system-vnext-executable-pilot-v0.1"]) {
      const directory = join(root, suiteId ?? "default");
      const args = privateHealthArguments(fixture.endpoint, directory);
      if (suiteId !== undefined) args.push("--suite", suiteId);
      const result = await runCli(args);
      assert.equal(result.exitCode, 2, result.stderr);
      const manifest = parseTutorHealthRunManifest(JSON.parse(await readFile(join(directory, "pilot-run-manifest.json"), "utf8")));
      assert.equal(manifest.suite.id, suiteId ?? "productive-struggle-intervention-v0.1");
    }
    assert.equal(fixture.requestBodies.length, 19);
  } finally {
    await closeTutorHttpFixture(fixture.server);
    await rm(root, { recursive: true, force: true });
  }
});

test("health runner passes authored learnerModel to the external HTTP Tutor", async () => {
  const suite = await loadTutorScenarioSuiteVNext();
  const authored = structuredClone(suite) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      tutorVisibleContext: {
        learnerModel?: { memorySummary?: string; confidence?: number };
      };
    }>;
  };
  const firstMistake = authored.scenarios.find(
    (scenario) => scenario.identity.id === "ps-first-mistake",
  );
  assert.ok(firstMistake);
  firstMistake.tutorVisibleContext.learnerModel = {
    memorySummary: "Learner prefers a worked visual balance model.",
    confidence: 0.7,
  };
  const visibleSuite = parseTutorScenarioSuiteVNext(authored);
  const fixture = await startTutorHttpFixture();

  try {
    await runTutorHealthEvaluation({
      suite: visibleSuite,
      tutor: createHttpTutor({ id: "learner-model-fixture", endpoint: fixture.endpoint }),
      tutorDescriptor: {
        provider: "fixture",
        model: "learner-model",
        promptVersion: "v1",
      },
    });
    const request = fixture.requestBodies.find((body) => body.caseId === "ps-first-mistake");
    assert.ok(request);
    assert.deepEqual(
      (request.studentState as Record<string, unknown>).learnerModel,
      firstMistake.tutorVisibleContext.learnerModel,
    );
    assert.doesNotMatch(JSON.stringify(request), /applies an operation to only one side/);
  } finally {
    await closeTutorHttpFixture(fixture.server);
  }
});
