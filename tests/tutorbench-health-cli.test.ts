import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { createHttpTutor } from "../src/adapters/http-tutor.js";
import { loadTutorScenarioSuiteVNext } from "../src/datasets/real-world.js";
import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { parseTutorbenchArgs } from "../src/cli/tutorbench.js";

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

async function startTutorHttpFixture(): Promise<TutorHttpFixture> {
  const requestBodies: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    requestBodies.push(
      JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
    );
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
  } finally {
    await closeTutorHttpFixture(fixture.server);
    await rm(outputRoot, { recursive: true, force: true });
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
