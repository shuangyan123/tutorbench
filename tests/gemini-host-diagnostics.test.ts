import assert from "node:assert/strict";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { ApiError } from "@google/genai";

import { createHttpTutorExecutionHost } from "../src/adapters/index.js";
import { collectCanonicalTutorModel } from "../src/collection/index.js";
import { buildTutorExecutionPacketFile } from "../src/contracts/index.js";
import { buildTutorBaselineGenerationSpec, loadTutorBaselinePrompt } from "../src/corpus/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";

interface Configuration {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly port: number;
  readonly diagnostics: boolean;
}
type Transport = (url: string, init?: RequestInit) => Promise<Response>;
const { readConfiguration, startServer } = await import(
  pathToFileURL(resolve("examples/canonical-model-host/gemini-server.mjs")).href
) as {
  readConfiguration: (environment: Record<string, string>) => Configuration;
  startServer: (configuration: Configuration, transport: Transport) => Promise<Server>;
};

// 全部是合成哨兵；SDK 唯一网络入口被替换，绝不读取进程中的真实凭证。
const sensitive = "synthetic-key secret-prompt hidden-thought secret-signature provider-message " +
  "Proxy-Authorization: Basic secret-proxy rawPayload https://proxy-user:proxy-pass@proxy.invalid/?key=secret-query";
const environment = { GEMINI_API_KEY: "synthetic-key", GEMINI_MODEL: "gemini-2.5-flash", CANONICAL_MODEL_HOST_PORT: "0" };
const validResponse = {
  candidates: [{ finishReason: "STOP", content: { role: "model", parts: [
    { thought: true, text: sensitive, thoughtSignature: sensitive }, { text: "Visible answer." },
  ] } }],
};

function event(stage: string, category: string, code: string, upstreamStatus: number | null = null) {
  return { event: "gemini_host_failure", stage, category, code, upstreamStatus };
}

async function fixture(t: TestContext, options: {
  readonly flag?: string;
  readonly status?: number;
  readonly body?: unknown;
  readonly raw?: string;
  readonly transport?: Transport;
  readonly timeoutMs?: number;
} = {}) {
  const stderr: unknown[][] = [];
  const stdout: unknown[][] = [];
  const warnings: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { stderr.push(args); });
  t.mock.method(console, "log", (...args: unknown[]) => { stdout.push(args); });
  t.mock.method(console, "warn", (...args: unknown[]) => { warnings.push(args); });
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(new URL(input instanceof Request ? input.url : input).hostname, "127.0.0.1");
    return originalFetch(input, init);
  });
  const configuration = readConfiguration({ ...environment,
    ...(options.flag === undefined ? {} : { GEMINI_HOST_DIAGNOSTICS: options.flag }),
  });
  let calls = 0;
  let signal: AbortSignal | undefined;
  const server = await startServer({ ...configuration, timeoutMs: options.timeoutMs ?? 2000 }, async (url, init) => {
    calls++;
    signal = init?.signal ?? undefined;
    if (options.transport) return options.transport(url, init);
    return new Response(options.raw ?? JSON.stringify(options.body ?? validResponse), {
      status: options.status ?? 200, headers: { "content-type": "application/json" },
    });
  });
  t.after(() => new Promise<void>((resolveClose, rejectClose) => {
    server.closeAllConnections();
    server.close((error) => error ? rejectClose(error) : resolveClose());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/generate`;
  const dataset = await loadTutorEvalDataset("tutor-eval-v0.2a");
  const promptAsset = await loadTutorBaselinePrompt();
  const generationSpec = buildTutorBaselineGenerationSpec(promptAsset);
  const packet = buildTutorExecutionPacketFile(dataset, [dataset.cases[0]!], generationSpec, promptAsset);
  // 使请求也包含敏感哨兵，避免仅证明 provider body 没有被日志复制。
  const requestPacket = { ...packet, cases: [{ ...packet.cases[0], messages:
    packet.cases[0]!.messages.map((message, index) => index === 0 ? message : { ...message, content: sensitive }),
  }] };
  const send = async (body: unknown = requestPacket, raw?: string) => {
    const response = await fetch(endpoint, { method: "POST", body: raw ?? JSON.stringify(body) });
    return { status: response.status, body: await response.json() as unknown };
  };
  const assertLogs = (expected: ReturnType<typeof event>[]) => {
    // 精确比较字段和每个值，任意附加异常属性/敏感文本都会使测试失败。
    assert.deepEqual(stderr, expected.map((value) => [JSON.stringify(value)]));
    assert.deepEqual(stdout, []);
    assert.deepEqual(warnings, []);
    for (const sentinel of sensitive.split(" ")) assert.ok(!JSON.stringify(stderr).includes(sentinel));
  };
  return { endpoint, send, assertLogs, stderr, configuration, dataset, promptAsset, generationSpec,
    calls: () => calls, signal: () => signal };
}

test("Gemini diagnostics require the exact opt-in and stay silent on success", async (t) => {
  for (const flag of [undefined, "", "0", "true", "01", " 1 ", sensitive, "1"]) {
    await t.test(flag === "1" ? "enabled" : `disabled-${String(flag)}`, async (subtest) => {
      const host = await fixture(subtest, { ...(flag === undefined ? {} : { flag }) });
      assert.equal(host.configuration.diagnostics, flag === "1");
      const result = await host.send();
      assert.equal(result.status, 200);
      assert.equal((result.body as { output: { text: string } }).output.text, "Visible answer.");
      host.assertLogs([]);
      assert.equal(host.calls(), 1);
    });
  }
});

test("Gemini diagnostics distinguish real SDK HTTP statuses and preserve public classifications without retry", async (t) => {
  for (const flag of [undefined, "1"]) {
    for (const [status, publicStatus, code] of [
      [400, 502, "provider_http_error"], [404, 502, "provider_http_error"],
      [401, 401, "provider_unauthorized"], [403, 403, "provider_forbidden"],
      [429, 429, "provider_rate_limited"], [500, 502, "provider_server_error"], [503, 502, "provider_server_error"],
    ] as const) {
      await t.test(`${flag ?? "off"}-${status}`, async (subtest) => {
        const host = await fixture(subtest, { ...(flag === undefined ? {} : { flag }), status,
          // JSON 中的 code 故意与 HTTP status 冲突，不能将响应体当成状态来源。
          body: { error: { code: 418, message: sensitive }, rawPayload: sensitive },
        });
        assert.deepEqual(await host.send(), { status: publicStatus, body: { error: code } });
        host.assertLogs(flag === "1" ? [event("sdk_request", "http", code, status)] : []);
        assert.equal(host.calls(), 1);
      });
    }
  }
});

test("Gemini local request and packet rejects log no input and make zero SDK calls", async (t) => {
  for (const flag of [undefined, "1"]) {
    await t.test(flag ?? "off", async (subtest) => {
      const host = await fixture(subtest, flag === undefined ? {} : { flag });
      assert.deepEqual(await host.send({ prompt: sensitive }), { status: 400, body: { error: "tutor_execution_packet_invalid" } });
      assert.equal((await host.send(undefined, `{${sensitive}`)).status, 400);
      assert.equal((await host.send(undefined, sensitive + "x".repeat(2_000_001 - sensitive.length))).status, 413);
      assert.equal((await fetch(`${host.endpoint}?${sensitive}`)).status, 404);
      const packet = buildTutorExecutionPacketFile(host.dataset, [host.dataset.cases[0]!], host.generationSpec, host.promptAsset);
      assert.equal((await host.send({ ...packet, generationSpec: { ...packet.generationSpec, temperature: 0 } })).status, 422);
      const messages = packet.cases[0]!.messages;
      assert.equal((await host.send({ ...packet, cases: [{ ...packet.cases[0], messages: [
        messages[0], messages[1], { role: "assistant", content: sensitive },
        { role: "assistant", content: sensitive }, messages.at(-1),
      ] }] })).status, 400);
      host.assertLogs(flag === "1" ? [
        event("local_packet", "request_rejected", "tutor_execution_packet_invalid"),
        event("local_request", "request_rejected", "tutor_execution_packet_invalid"),
        event("local_request", "request_rejected", "request_too_large"),
        event("local_request", "request_rejected", "not_found"),
        event("local_packet", "request_rejected", "unsupported_generation_control"),
        event("local_packet", "request_rejected", "tutor_execution_packet_invalid"),
      ] : []);
      assert.equal(host.calls(), 0);
    });
  }
});

test("Gemini diagnostics never invent status from unknown, transport or malformed SDK errors", async (t) => {
  const failures = [
    new TypeError(sensitive), new Error(sensitive),
    Object.assign(new Error(sensitive), { status: 404, code: 400, cause: { status: 503, message: sensitive } }),
    ...[undefined, "404", NaN, Infinity, 0, 399, 600, 400.5].map((status) => new ApiError({ message: sensitive, status: status as number })),
  ];
  for (const [index, failure] of failures.entries()) {
    await t.test(String(index), async (subtest) => {
      const host = await fixture(subtest, { flag: "1", transport: async () => { throw failure; } });
      const result = await host.send();
      assert.equal(result.status, 502);
      // 既有外部分类不变；诊断 status 比既有分类更严格，不信任任意错误属性。
      const code = (result.body as { error: string }).error;
      host.assertLogs([event("sdk_request", "transport_or_sdk", code)]);
      assert.equal(host.calls(), 1);
    });
  }
});

test("Gemini timeout diagnostics retain unknown upstream status and abort one SDK attempt", async (t) => {
  const host = await fixture(t, { flag: "1", timeoutMs: 50, transport: async () => new Promise<Response>(() => {}) });
  assert.deepEqual(await host.send(), { status: 504, body: { error: "provider_request_timeout" } });
  host.assertLogs([event("sdk_request", "timeout", "provider_request_timeout")]);
  assert.equal(host.signal()?.aborted, true);
  assert.equal(host.calls(), 1);
});

test("Gemini SDK JSON and response-validation failures log only bounded codes", async (t) => {
  for (const [label, options, code] of [
    ["invalid JSON", { raw: `{${sensitive}` }, "provider_response_invalid"],
    ["invalid error body", { raw: `{${sensitive}`, status: 404 }, "provider_response_invalid"],
    ["hidden thought only", { body: { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ thought: true, text: sensitive }] } }] } }, "provider_response_invalid"],
    ["truncated", { body: { candidates: [{ finishReason: "MAX_TOKENS", content: { role: "model", parts: [{ text: sensitive }] } }] } }, "provider_response_truncated"],
  ] as const) {
    await t.test(label, async (subtest) => {
      const host = await fixture(subtest, { flag: "1", ...options });
      assert.deepEqual(await host.send(), { status: 502, body: { error: code } });
      host.assertLogs([event("sdk_response", "response_validation", code)]);
      assert.equal(host.calls(), 1);
    });
  }
});

test("Gemini opted-in failure diagnostics stay outside the collector report and corpus", async (t) => {
  const host = await fixture(t, { flag: "1", status: 404, body: { error: { message: sensitive } } });
  const collection = await collectCanonicalTutorModel({
    host: createHttpTutorExecutionHost({ endpoint: host.endpoint }), dataset: host.dataset,
    selectedCases: [host.dataset.cases[0]!], promptAsset: host.promptAsset, generationSpec: host.generationSpec,
    tutorDescriptor: { provider: "synthetic-gemini-fixture", model: environment.GEMINI_MODEL,
      promptId: host.generationSpec.prompt.id, promptVersion: host.generationSpec.prompt.version },
    corpusId: "gemini-diagnostics-synthetic-fixture", corpusVersion: host.generationSpec.specVersion,
  });
  assert.equal(collection.corpus, null);
  assert.equal(collection.report.failures[0]?.code, "execution_http_error");
  const persisted = JSON.stringify(collection);
  for (const sentinel of sensitive.split(" ")) assert.ok(!persisted.includes(sentinel));
  assert.doesNotMatch(persisted, /upstreamStatus|sdk_request|gemini_host_failure/u);
  host.assertLogs([event("sdk_request", "http", "provider_http_error", 404)]);
  assert.equal(host.calls(), 1);
});

test("Gemini diagnostic sink failure cannot change the public response or cause another attempt", async (t) => {
  const host = await fixture(t, { flag: "1", status: 400 });
  t.mock.method(console, "error", () => { throw new Error(sensitive); });
  assert.deepEqual(await host.send(), { status: 502, body: { error: "provider_http_error" } });
  assert.equal(host.calls(), 1);
});
