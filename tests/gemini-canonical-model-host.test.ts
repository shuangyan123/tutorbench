import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { createHttpTutorExecutionHost } from "../src/adapters/index.js";
import { collectCanonicalTutorModel } from "../src/collection/index.js";
import {
  buildTutorExecutionPacketFile,
  type TutorExecutionPacketFile,
} from "../src/contracts/index.js";
import { buildTutorBaselineGenerationSpec, loadTutorBaselinePrompt } from "../src/corpus/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";

const sessionToken = randomBytes(32).toString("hex");
const hostHeaders = { "content-type": "application/json", authorization: "Bearer " + sessionToken };

interface Configuration {
  readonly apiKey: string;
  readonly sessionToken: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly port: number;
}
type Transport = (url: string, init?: RequestInit) => Promise<Response>;
const modulePath = pathToFileURL(resolve("examples/canonical-model-host/gemini-server.mjs")).href;
const { readConfiguration, startServer } = await import(modulePath) as {
  readConfiguration: (environment: Record<string, string>) => Configuration;
  startServer: (configuration: Configuration, transport: Transport) => Promise<Server>;
};
const environment = {
  GEMINI_API_KEY: "synthetic-secret-key",
  GEMINI_MODEL: "gemini-2.5-flash",
  CANONICAL_MODEL_HOST_PORT: "0", CANONICAL_MODEL_HOST_TOKEN: sessionToken,
};
const secrets = /synthetic-secret-key|hidden thought|secret-signature|provider-secret|rawPayload/u;

async function packet(): Promise<TutorExecutionPacketFile> {
  const dataset = await loadTutorEvalDataset("tutor-eval-v0.2a");
  const prompt = await loadTutorBaselinePrompt();
  return buildTutorExecutionPacketFile(dataset, [dataset.cases[0]!], buildTutorBaselineGenerationSpec(prompt), prompt);
}

function providerResponse(parts: unknown[] = [{ text: "Visible answer." }], finishReason = "STOP") {
  return {
    candidates: [{ index: 0, finishReason, content: { role: "model", parts } }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 23, thoughtsTokenCount: 5 },
    responseId: "provider-secret",
    modelVersion: "provider-secret",
    rawPayload: "provider-secret",
  };
}

async function fixture(t: TestContext, options: {
  readonly body?: unknown;
  readonly status?: number;
  readonly raw?: string;
  readonly transport?: Transport;
  readonly timeoutMs?: number;
} = {}) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const warnings: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => { warnings.push(args); });
  t.mock.method(console, "error", (...args: unknown[]) => { warnings.push(args); });
  const server = await startServer({ ...readConfiguration(environment), timeoutMs: options.timeoutMs ?? 2000 }, async (url, init) => {
    assert.ok(init);
    // 唯一 SDK 网络入口完全替换，不允许回退到真实 fetch。
    calls.push({ url, init, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    if (options.transport) return options.transport(url, init);
    return new Response(options.raw ?? JSON.stringify(options.body ?? providerResponse()), {
      status: options.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  t.after(() => new Promise<void>((resolveClose, rejectClose) => {
    server.closeAllConnections();
    server.close((error) => error ? rejectClose(error) : resolveClose());
  }));
  const endpoint = `http://127.0.0.1:${address.port}/generate`;
  const send = async (body?: unknown) => {
    const response = await fetch(endpoint, {
      method: "POST", headers: hostHeaders, body: JSON.stringify(body ?? await packet()),
    });
    const result: unknown = await response.json();
    assert.doesNotMatch(JSON.stringify(result), secrets);
    assert.doesNotMatch(JSON.stringify(warnings), secrets);
    return { status: response.status, body: result };
  };
  return { endpoint, calls, warnings, send };
}

test("Gemini official SDK preserves system and every turn, native controls, final text and sanitized usage", async (t) => {
  const host = await fixture(t, { body: providerResponse([
    { thought: true, text: "hidden thought", thoughtSignature: "secret-signature" },
    { text: "Visible ", thoughtSignature: "secret-signature" },
    { text: "answer." },
  ]) });
  const executionPacket = await packet();
  const system = executionPacket.cases[0]!.messages[0]!;
  const messages = [system,
    { role: "user", content: "Context\n 中文  " },
    { role: "user", content: "Question" },
    { role: "assistant", content: "Earlier tutor\n" },
    { role: "user", content: "Follow up" },
  ];
  const result = await host.send({ ...executionPacket,
    generationSpec: { ...executionPacket.generationSpec, maxOutputTokens: 321 },
    cases: [{ ...executionPacket.cases[0], messages }] });
  assert.equal(result.status, 200);
  const body = result.body as { output: { text: string; metrics: { latencyMs: number; tokenUsage: unknown } }; executionSupport: unknown };
  assert.equal(body.output.text, "Visible answer.");
  assert.equal(Number.isInteger(body.output.metrics.latencyMs), true);
  assert.deepEqual(body.output.metrics.tokenUsage, { inputTokens: 11, outputTokens: 7, totalTokens: 23 });
  assert.deepEqual(body.executionSupport, { maxOutputTokens: true });
  assert.equal(host.calls.length, 1);
  const request = host.calls[0]!;
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(new Headers(request.init.headers).get("x-goog-api-key"), environment.GEMINI_API_KEY);
  assert.deepEqual(request.body, {
    systemInstruction: { parts: [{ text: system.content }] },
    contents: messages.slice(1).map(({ role, content }) => ({ role: role === "assistant" ? "model" : "user", parts: [{ text: content }] })),
    generationConfig: { maxOutputTokens: 321, candidateCount: 1, responseModalities: ["TEXT"] },
  });
  assert.deepEqual(host.warnings, []);
});

test("Gemini never invents missing or invalid token counts", async (t) => {
  for (const usageMetadata of [undefined, {}, { promptTokenCount: -1, candidatesTokenCount: 1.5, totalTokenCount: "23" },
    { promptTokenCount: 0, totalTokenCount: 23, thoughtsTokenCount: 5 }]) {
    await t.test(JSON.stringify(usageMetadata) ?? "absent", async (subtest) => {
      const host = await fixture(subtest, { body: { ...providerResponse(), usageMetadata } });
      const result = await host.send();
      assert.equal(result.status, 200);
      const body = result.body as { output: { metrics: { tokenUsage?: unknown } } };
      assert.deepEqual(body.output.metrics.tokenUsage,
        usageMetadata?.promptTokenCount === 0 ? { inputTokens: 0, totalTokens: 23 } : undefined);
    });
  }
});

test("Gemini rejects truncated, blocked, ambiguous, tool and malformed responses without leaking payloads", async (t) => {
  const invalid: [string, unknown, string][] = [
    ["max tokens", providerResponse([{ text: "Partial" }], "MAX_TOKENS"), "provider_response_truncated"],
    ["safety", providerResponse([{ text: "Partial" }], "SAFETY"), "provider_response_invalid"],
    ["abnormal finish", providerResponse([{ text: "Partial" }], "OTHER"), "provider_response_invalid"],
    ["missing finish", { candidates: [{ content: { role: "model", parts: [{ text: "Partial" }] } }] }, "provider_response_invalid"],
    ["prompt blocked", { ...providerResponse(), promptFeedback: { blockReason: "SAFETY", blockReasonMessage: "provider-secret" } }, "provider_response_invalid"],
    ["no candidates", { candidates: [] }, "provider_response_invalid"],
    ["multiple candidates", { candidates: [providerResponse().candidates[0], providerResponse().candidates[0]] }, "provider_response_invalid"],
    ["thought only", providerResponse([{ text: "hidden thought", thought: true }]), "provider_response_invalid"],
    ["empty", providerResponse([]), "provider_response_invalid"],
    ["whitespace", providerResponse([{ text: " \n" }]), "provider_response_invalid"],
    ["tool plus text", providerResponse([{ text: "Answer" }, { functionCall: { name: "rawPayload", args: {} } }]), "provider_response_invalid"],
    ["non-text plus text", providerResponse([{ text: "Answer" }, { inlineData: { mimeType: "image/png", data: "rawPayload" } }]), "provider_response_invalid"],
    ["bad thought flag", providerResponse([{ text: "hidden thought", thought: "true" }]), "provider_response_invalid"],
    ["bad text", providerResponse([{ text: 42 }]), "provider_response_invalid"],
    ["wrong role", { candidates: [{ finishReason: "STOP", content: { role: "user", parts: [{ text: "Answer" }] } }] }, "provider_response_invalid"],
    ["continuation", { candidates: [{ ...providerResponse().candidates[0], continuationToken: "provider-secret", finishReason: "CONTINUATION" }] }, "provider_response_invalid"],
    ["continuation without finish", { candidates: [{ content: { role: "model", parts: [{ text: "Partial" }] }, continuationToken: "provider-secret" }] }, "provider_response_invalid"],
    ["stop with continuation", { candidates: [{ ...providerResponse().candidates[0], continuationToken: "provider-secret" }] }, "provider_response_invalid"],
  ];
  for (const [label, body, error] of invalid) {
    await t.test(label, async (subtest) => {
      const host = await fixture(subtest, { body });
      assert.deepEqual(await host.send(), { status: 502, body: { error } });
      assert.equal(host.calls.length, 1);
    });
  }
  await t.test("invalid JSON", async (subtest) => {
    const host = await fixture(subtest, { raw: "{provider-secret" });
    assert.deepEqual(await host.send(), { status: 502, body: { error: "provider_response_invalid" } });
    assert.equal(host.calls.length, 1);
  });
});

test("Gemini maps provider status failures with exactly one SDK attempt", async (t) => {
  for (const [status, expectedStatus, error] of [
    [401, 401, "provider_unauthorized"], [403, 403, "provider_forbidden"],
    [429, 429, "provider_rate_limited"], [500, 502, "provider_server_error"],
    [503, 502, "provider_server_error"], [400, 502, "provider_http_error"],
  ] as const) {
    await t.test(String(status), async (subtest) => {
      const host = await fixture(subtest, { status, body: { error: { code: status, message: "provider-secret synthetic-secret-key rawPayload" } } });
      assert.deepEqual(await host.send(), { status: expectedStatus, body: { error } });
      assert.equal(host.calls.length, 1);
    });
  }
});

test("Gemini bounds stalled SDK requests and aborts without retrying", async (t) => {
  let signal: AbortSignal | undefined;
  const host = await fixture(t, { timeoutMs: 50, transport: async (_url, init) => {
    signal = init?.signal ?? undefined;
    // 故意不完成：宿主自身 deadline 不能依赖传输实现遵守 abort。
    return new Promise<Response>(() => {});
  } });
  const startedAt = performance.now();
  assert.deepEqual(await host.send(), { status: 504, body: { error: "provider_request_timeout" } });
  assert.ok(performance.now() - startedAt < 2000);
  assert.equal(signal?.aborted, true);
  assert.equal(host.calls.length, 1);
});

test("Gemini transport errors are sanitized and never retried", async (t) => {
  const host = await fixture(t, { transport: async () => { throw new Error("provider-secret synthetic-secret-key"); } });
  assert.deepEqual(await host.send(), { status: 502, body: { error: "provider_request_failed" } });
  assert.equal(host.calls.length, 1);
});

test("Gemini rejects unsupported controls, hidden fields, invalid packets and unrepresentable roles before SDK calls", async (t) => {
  const host = await fixture(t);
  const executionPacket = await packet();
  for (const control of [{ temperature: 0 }, { seed: 7 }, { reasoningEffort: "low" }]) {
    assert.deepEqual(await host.send({ ...executionPacket, generationSpec: { ...executionPacket.generationSpec, ...control } }),
      { status: 422, body: { error: "unsupported_generation_control" } });
  }
  const messages = executionPacket.cases[0]!.messages;
  for (const invalid of [
    { ...executionPacket, evaluatorOnly: "rawPayload" },
    { ...executionPacket, cases: [] },
    { ...executionPacket, cases: [{ ...executionPacket.cases[0] }, { ...executionPacket.cases[0], caseId: "another" }] },
    { ...executionPacket, cases: [{ ...executionPacket.cases[0], messages: [messages[0], messages[1], { role: "system", content: "Hidden" }, messages.at(-1)] }] },
    { ...executionPacket, cases: [{ ...executionPacket.cases[0], messages: [messages[0], messages[1], { role: "assistant", content: "A" }, { role: "assistant", content: "B" }, messages.at(-1)] }] },
  ]) {
    assert.deepEqual(await host.send(invalid), { status: 400, body: { error: "tutor_execution_packet_invalid" } });
  }
  const malformed = await fetch(host.endpoint, { method: "POST", headers: hostHeaders, body: "{provider-secret" });
  assert.equal(malformed.status, 400);
  assert.equal((await fetch(host.endpoint, { headers: hostHeaders })).status, 404);
  const oversized = await fetch(host.endpoint, { method: "POST", headers: hostHeaders, body: "x".repeat(2_000_001) });
  assert.equal(oversized.status, 413);
  assert.equal(host.calls.length, 0);
});

test("Gemini configuration fails closed without echoing values or accepting floating aliases", () => {
  assert.deepEqual(readConfiguration(environment), { apiKey: environment.GEMINI_API_KEY, sessionToken, model: environment.GEMINI_MODEL, timeoutMs: 60_000, port: 0, diagnostics: false });
  for (const overrides of [
    { GEMINI_API_KEY: "" }, { GEMINI_MODEL: "" }, { GEMINI_MODEL: "gemini-flash-latest" },
    { GEMINI_MODEL: "gemini-2.5-flash-latest" }, { GEMINI_MODEL: "models/gemini-2.5-flash" },
    { GEMINI_MODEL: "provider-secret" }, { GEMINI_TIMEOUT_MS: "provider-secret" },
    { GEMINI_TIMEOUT_MS: "2147483648" }, { GEMINI_TIMEOUT_MS: "0" },
    { CANONICAL_MODEL_HOST_PORT: "65536" }, { CANONICAL_MODEL_HOST_PORT: "-1" },
  ]) {
    assert.throws(() => readConfiguration({ ...environment, ...overrides }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, secrets);
      return true;
    });
  }
  const child = spawnSync(process.execPath, [resolve("examples/canonical-model-host/gemini-server.mjs")], {
    env: { ...process.env, GEMINI_API_KEY: "", GEMINI_MODEL: "provider-secret" }, encoding: "utf8", timeout: 5000,
  });
  assert.equal(child.status, 1);
  assert.doesNotMatch(child.stdout + child.stderr, secrets);
});

test("Gemini synthetic collect-model smoke preserves existing corpus identity and bounded failures", async (t) => {
  const host = await fixture(t);
  const dataset = await loadTutorEvalDataset("tutor-eval-v0.2a");
  const promptAsset = await loadTutorBaselinePrompt();
  const generationSpec = buildTutorBaselineGenerationSpec(promptAsset);
  const options = {
    host: createHttpTutorExecutionHost({ endpoint: host.endpoint, sessionToken }), dataset,
    selectedCases: [dataset.cases[0]!], promptAsset, generationSpec,
    tutorDescriptor: { provider: "synthetic-gemini-fixture", model: environment.GEMINI_MODEL,
      promptId: generationSpec.prompt.id, promptVersion: generationSpec.prompt.version },
    corpusId: "gemini-synthetic-protocol-fixture", corpusVersion: generationSpec.specVersion,
  };
  const collection = await collectCanonicalTutorModel(options);
  assert.ok(collection.corpus);
  assert.equal(collection.corpus.responses.length, 1);
  assert.equal(collection.corpus.responses[0]?.responseText, "Visible answer.");
  assert.equal(collection.corpus.provenance, "recorded_model");
  assert.equal(collection.corpus.responses[0]?.provenance, "recorded_model");
  assert.deepEqual(collection.corpus.generationSpec, generationSpec);
  assert.deepEqual(collection.report.artifactMetadata,
    { status: "preliminary", calibrationStatus: "uncalibrated", publicLeaderboardEligible: false });
  assert.doesNotMatch(JSON.stringify(collection), secrets);
  assert.equal(host.calls.length, 1);
  const truncated = await fixture(t, { body: providerResponse([{ text: "Partial" }], "MAX_TOKENS") });
  const failure = await collectCanonicalTutorModel({ ...options, host: createHttpTutorExecutionHost({ endpoint: truncated.endpoint, sessionToken }) });
  assert.equal(failure.corpus?.responses.length ?? 0, 0);
  assert.equal(failure.report.failures[0]?.code, "execution_output_truncated");
  assert.equal(truncated.calls.length, 1);
});

test("Gemini collect-model CLI dry-run makes zero host calls without a credential", async (t) => {
  const host = await fixture(t);
  const child = spawnSync(process.execPath, [resolve("dist/src/cli/tutorbench.js"), "collect-model",
    "--http", host.endpoint, "--provider", "google", "--model", environment.GEMINI_MODEL,
    "--limit", "1", "--dry-run"], {
    env: { ...process.env, GEMINI_API_KEY: "", CANONICAL_MODEL_HOST_TOKEN: undefined }, encoding: "utf8", timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /Model calls made: 0/u);
  assert.equal(host.calls.length, 0);
});
