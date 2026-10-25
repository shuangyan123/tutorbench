import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { buildTutorEvalJudgeInput, buildTutorExecutionPacketFile } from "../src/contracts/index.js";
import { buildTutorBaselineGenerationSpec, loadTutorBaselinePrompt } from "../src/corpus/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { createOpenAIJudge } from "../src/providers/openai/tutor-eval-judge.js";
import { oversizedResponse, trackedResponse } from "./helpers/upstream-response.js";

const dataset = await loadTutorEvalDataset();
const prompt = await loadTutorBaselinePrompt();
const packet = buildTutorExecutionPacketFile(dataset, [dataset.cases[0]!], buildTutorBaselineGenerationSpec(prompt), prompt);
const judgeInput = buildTutorEvalJudgeInput(dataset.cases[0]!, "Synthetic candidate.");
const judgeOptions = {
  model: "synthetic-model", prompt: "Synthetic prompt.", promptId: "synthetic", promptVersion: "1",
  environment: { OPENAI_API_KEY: "synthetic-key" }, maxAttempts: 2,
};

function judgeBody() {
  const content = JSON.stringify({
    schemaVersion: 1, caseId: judgeInput.caseId,
    rubricResults: judgeInput.rubrics.map((rubric) => ({ rubricId: rubric.id, result: "PASS", evidence: "Synthetic." })),
    criticalFailures: [], factualErrors: [], insufficientInformation: false,
  });
  return { id: "synthetic", object: "response", status: "completed", output: [{
    type: "message", role: "assistant", content: [{ type: "output_text", text: content, annotations: [] }],
  }] };
}

test("repository-owned OpenAI Judge SDK rejects overflow without retrying", async (context) => {
  const fixture = oversizedResponse(judgeBody());
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls += 1; return fixture.response; });
  await assert.rejects(createOpenAIJudge(judgeOptions).evaluateWithMetrics(judgeInput), (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error && error.code === "judge_result_invalid");
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(fixture.cancelled(), true);
  assert.equal(fixture.reads(), 123);
});

test("repository-owned OpenAI SDK reads actual bytes even with a forged zero length", async (context) => {
  const fixture = trackedResponse([Buffer.from(JSON.stringify(judgeBody()))], 200, { "content-length": "0" });
  context.mock.method(globalThis, "fetch", async () => fixture.response);
  const result = await createOpenAIJudge(judgeOptions).evaluateWithMetrics(judgeInput);
  assert.ok(typeof result.result === "object" && result.result !== null && "caseId" in result.result);
  assert.equal(result.result.caseId, judgeInput.caseId);
  assert.equal(fixture.reads(), 1);
});

for (const status of [401, 429, 503]) {
  test(`OpenAI Judge SDK bounds HTTP ${status} bodies and retains its attempt bound`, async (context) => {
    const fixtures: ReturnType<typeof oversizedResponse>[] = [];
    context.mock.method(globalThis, "fetch", async () => {
      const fixture = oversizedResponse({ error: "synthetic-private-body" }, status);
      fixtures.push(fixture);
      return fixture.response;
    });
    await assert.rejects(createOpenAIJudge(judgeOptions).evaluateWithMetrics(judgeInput), (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error && error.code === "judge_transport_error");
      assert.doesNotMatch(error.message, /synthetic-private-body|synthetic-key/);
      return true;
    });
    assert.equal(fixtures.length, status === 401 ? 1 : 2);
    for (const fixture of fixtures) {
      assert.equal(fixture.cancelled(), true);
      assert.equal(fixture.reads(), 2);
    }
  });
}

type HostModule = {
  readConfiguration: (environment: Record<string, string>) => Record<string, unknown>;
  startServer: (configuration: Record<string, unknown>, fetchImplementation: typeof fetch) => Promise<Server>;
};

async function hostModule(name: string): Promise<HostModule> {
  return import(pathToFileURL(resolve(`examples/canonical-model-host/${name}-server.mjs`)).href) as Promise<HostModule>;
}

async function startHost(context: TestContext, name: string, fixture: ReturnType<typeof oversizedResponse>) {
  const module = await hostModule(name);
  const sessionToken = randomBytes(32).toString("hex");
  const environment = {
    OPENAI_API_KEY: "synthetic-key", OPENAI_MODEL: "synthetic-model", OPENAI_TIMEOUT_MS: "2000",
    TUTOR_MODEL_API_KEY: "synthetic-key", TUTOR_MODEL: "synthetic-model", TUTOR_MODEL_TIMEOUT_MS: "2000",
    TUTOR_MODEL_BASE_URL: "https://synthetic.invalid/v1",
    GEMINI_API_KEY: "synthetic-key", GEMINI_MODEL: "gemini-2.5-flash", GEMINI_TIMEOUT_MS: "2000",
    CANONICAL_MODEL_HOST_PORT: "0",
    CANONICAL_MODEL_HOST_TOKEN: sessionToken,
  };
  let calls = 0;
  const logs: unknown[][] = [];
  context.mock.method(console, "error", (...values: unknown[]) => { logs.push(values); });
  const server = await module.startServer(module.readConfiguration(environment), async () => {
    calls += 1;
    return fixture.response;
  });
  context.after(() => new Promise<void>((resolveClose) => {
    server.closeAllConnections();
    server.close(() => resolveClose());
  }));
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/generate`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + sessionToken }, body: JSON.stringify(packet),
  });
  const result: unknown = await response.json();
  assert.doesNotMatch(JSON.stringify({ result, logs }), /synthetic-private-body|synthetic-key/);
  return { status: response.status, result, calls };
}

for (const name of ["chat-completions", "openai", "gemini"]) {
  test(`${name} canonical host cancels oversized upstream success before consuming its tail`, async (context) => {
    const fixture = oversizedResponse({ text: "synthetic" });
    const result = await startHost(context, name, fixture);
    assert.equal(result.status, 502);
    assert.deepEqual(result.result, { error: "provider_response_invalid" });
    assert.equal(result.calls, 1);
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.reads(), 123);
  });

  test(`${name} canonical host bounds upstream error bodies without changing HTTP classification`, async (context) => {
    const fixture = oversizedResponse({ error: "synthetic-private-body" }, 429);
    const result = await startHost(context, name, fixture);
    assert.equal(result.calls, 1);
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.reads(), name === "chat-completions" ? 0 : 2);
    assert.equal(result.status, name === "openai" ? 502 : 429);
    assert.deepEqual(result.result, { error: name === "openai" ? "provider_request_failed" : "provider_rate_limited" });
  });
}
