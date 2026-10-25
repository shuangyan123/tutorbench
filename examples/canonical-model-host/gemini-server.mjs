import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ApiError, GoogleGenAI } from "@google/genai";

import { parseTutorExecutionPacketFile } from "../../dist/src/contracts/index.js";
import { createBoundedFetch, ResponseBodyLimitError } from "../../dist/src/transport/response-body.js";

const MAX_REQUEST_BYTES = 2_000_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

class CanonicalHostRequestError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

class CanonicalHostConfigurationError extends Error {}

function requiredEnvironment(name, environment) {
  const value = environment[name]?.trim();
  if (!value) throw new CanonicalHostConfigurationError(`${name} is required.`);
  return value;
}

function integerEnvironment(name, environment, fallback, minimum, maximum) {
  const raw = environment[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new CanonicalHostConfigurationError(`${name} is outside its supported integer range.`);
  }
  return value;
}

export function readConfiguration(environment = process.env) {
  const model = requiredEnvironment("GEMINI_MODEL", environment);
  if (!/^gemini-\d[\da-z.-]*$/u.test(model) || /(?:^|-)latest(?:-|$)/u.test(model)) {
    throw new CanonicalHostConfigurationError("GEMINI_MODEL must be an explicit versioned Gemini model ID.");
  }
  return {
    apiKey: requiredEnvironment("GEMINI_API_KEY", environment),
    model,
    timeoutMs: integerEnvironment("GEMINI_TIMEOUT_MS", environment, 60_000, 1, MAX_TIMEOUT_MS),
    port: integerEnvironment("CANONICAL_MODEL_HOST_PORT", environment, 9001, 0, 65_535),
    diagnostics: environment.GEMINI_HOST_DIAGNOSTICS === "1",
  };
}

function diagnostic(configuration, stage, category, code, upstreamStatus = null) {
  if (configuration.diagnostics !== true) return;
  // 只接收内部固定分类及可信状态码，绝不序列化异常、请求或响应对象。
  try {
    console.error(JSON.stringify({ event: "gemini_host_failure", stage, category, code, upstreamStatus }));
  } catch {
    // 诊断输出失败不能改变原有 HTTP 结果或触发第二次模型调用。
  }
}

function upstreamHttpStatus(error) {
  // 不从 message/cause/body 或任意同名 status 属性推断上游 HTTP 状态。
  return error instanceof ApiError && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
    ? error.status : null;
}

function requestForPacket(packet, model) {
  const spec = packet.generationSpec;
  // 只证明当前原生默认配置；不把其他厂商的控制语义猜测为 Gemini 能力。
  if (spec.temperature !== undefined || spec.seed !== undefined || spec.reasoningEffort !== undefined) {
    throw new CanonicalHostRequestError("unsupported_generation_control");
  }
  const [system, ...turns] = packet.cases[0].messages;
  if (system.role !== "system" || turns.some((turn, index) =>
    turn.role === "system" ||
    (turn.role === "assistant" && turns[index - 1]?.role !== "user")
  )) {
    throw new CanonicalHostRequestError("tutor_execution_packet_invalid");
  }
  return {
    model,
    // 每条消息单独保留，包含连续 user 上下文；不合并、不插入提示词。
    contents: turns.map(({ role, content }) => ({
      role: role === "assistant" ? "model" : "user",
      parts: [{ text: content }],
    })),
    config: {
      systemInstruction: { parts: [{ text: system.content }] },
      maxOutputTokens: spec.maxOutputTokens,
      candidateCount: 1,
      responseModalities: ["TEXT"],
      automaticFunctionCalling: { disable: true },
      // SDK 2.30 默认续传可能追加请求，必须与重试一起关闭。
      automaticContinuation: false,
    },
  };
}

function responseText(response) {
  if (response?.promptFeedback?.blockReason !== undefined ||
      !Array.isArray(response?.candidates) || response.candidates.length !== 1) {
    throw new CanonicalHostRequestError("provider_response_invalid");
  }
  const candidate = response.candidates[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new CanonicalHostRequestError("provider_response_truncated");
  }
  if (candidate?.finishReason !== "STOP" || candidate.content?.role !== "model" ||
      (candidate.index !== undefined && candidate.index !== 0) ||
      !Array.isArray(candidate.content.parts) || candidate.continuationToken !== undefined) {
    throw new CanonicalHostRequestError("provider_response_invalid");
  }
  const visibleText = [];
  for (const part of candidate.content.parts) {
    // SDK response.text 会忽略非文本并发出警告；先严格拒绝工具/非文本部分。
    if (part === null || typeof part !== "object" || Array.isArray(part) ||
        Object.keys(part).some((key) => !["text", "thought", "thoughtSignature"].includes(key)) ||
        (part.thought !== undefined && typeof part.thought !== "boolean") ||
        (part.text !== undefined && typeof part.text !== "string") ||
        (part.thoughtSignature !== undefined && typeof part.thoughtSignature !== "string")) {
      throw new CanonicalHostRequestError("provider_response_invalid");
    }
    // 只读取明确可见的文本；思考及签名永不进入返回值或日志。
    if (part.thought !== true && typeof part.text === "string") visibleText.push(part.text);
  }
  const text = visibleText.join("");
  if (text.trim().length === 0) throw new CanonicalHostRequestError("provider_response_invalid");
  return text;
}

function sanitizedTokenUsage(usage) {
  const result = {};
  for (const [source, target] of [
    ["promptTokenCount", "inputTokens"],
    ["candidatesTokenCount", "outputTokens"],
    ["totalTokenCount", "totalTokens"],
  ]) {
    const value = usage?.[source];
    if (Number.isSafeInteger(value) && value >= 0) result[target] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function providerErrorCode(error) {
  if (error?.status === 401) return "provider_unauthorized";
  if (error?.status === 403) return "provider_forbidden";
  if (error?.status === 429) return "provider_rate_limited";
  if (Number.isInteger(error?.status) && error.status >= 500) return "provider_server_error";
  if (Number.isInteger(error?.status) && error.status >= 400) return "provider_http_error";
  if (error instanceof SyntaxError || error instanceof ResponseBodyLimitError) return "provider_response_invalid";
  return "provider_request_failed";
}

async function executePacket(client, packet, configuration) {
  const request = requestForPacket(packet, configuration.model);
  const controller = new AbortController();
  const startedAt = performance.now();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CanonicalHostRequestError("provider_request_timeout"));
    }, configuration.timeoutMs);
  });
  try {
    const response = await Promise.race([
      client.models.generateContent({
        ...request,
        config: { ...request.config, abortSignal: controller.signal },
      }),
      deadline,
    ]);
    const text = responseText(response);
    const tokenUsage = sanitizedTokenUsage(response.usageMetadata);
    return {
      output: {
        text,
        metrics: {
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ...(tokenUsage === undefined ? {} : { tokenUsage }),
        },
      },
      executionSupport: { maxOutputTokens: true },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      diagnostic(configuration, "sdk_request", "timeout", "provider_request_timeout");
      throw new CanonicalHostRequestError("provider_request_timeout");
    }
    if (error instanceof CanonicalHostRequestError) {
      diagnostic(configuration, "sdk_response", "response_validation", error.code);
      throw error;
    }
    // 只映射稳定代码，不复制 SDK message/cause/响应体。
    const code = providerErrorCode(error);
    const status = upstreamHttpStatus(error);
    if (status !== null) diagnostic(configuration, "sdk_request", "http", code, status);
    else if (error instanceof SyntaxError) diagnostic(configuration, "sdk_response", "response_validation", code);
    else diagnostic(configuration, "sdk_request", "transport_or_sdk", code);
    throw new CanonicalHostRequestError(code);
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new CanonicalHostRequestError("request_too_large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handleRequest(request, response, client, configuration) {
  if (request.method !== "POST" || request.url !== "/generate") {
    diagnostic(configuration, "local_request", "request_rejected", "not_found");
    sendJson(response, 404, { error: "not_found" });
    return;
  }
  let packet;
  let stage = "local_request";
  try {
    const body = await readJsonBody(request);
    stage = "local_packet";
    packet = parseTutorExecutionPacketFile(body);
    if (packet.cases.length !== 1) throw new CanonicalHostRequestError("tutor_execution_packet_invalid");
  } catch (error) {
    const tooLarge = error instanceof CanonicalHostRequestError && error.code === "request_too_large";
    diagnostic(configuration, stage, "request_rejected", tooLarge ? "request_too_large" : "tutor_execution_packet_invalid");
    sendJson(response, tooLarge ? 413 : 400, {
      error: tooLarge ? "request_too_large" : "tutor_execution_packet_invalid",
    });
    return;
  }
  try {
    sendJson(response, 200, await executePacket(client, packet, configuration));
  } catch (error) {
    const code = error instanceof CanonicalHostRequestError ? error.code : "provider_request_failed";
    if (code === "unsupported_generation_control" || code === "tutor_execution_packet_invalid") {
      diagnostic(configuration, "local_packet", "request_rejected", code);
    }
    const status = {
      unsupported_generation_control: 422,
      tutor_execution_packet_invalid: 400,
      provider_unauthorized: 401,
      provider_forbidden: 403,
      provider_rate_limited: 429,
      provider_request_timeout: 504,
    }[code] ?? 502;
    sendJson(response, status, { error: code });
  }
}

// fetch 注入仅用于离线测试；CLI 不提供重定向上游地址或切换 Vertex 的配置。
export async function startServer(configuration, fetchImplementation) {
  const client = new GoogleGenAI({
    apiKey: configuration.apiKey,
    vertexai: false,
    httpOptions: {
      baseUrl: "https://generativelanguage.googleapis.com",
      apiVersion: "v1beta",
      retryOptions: { attempts: 1 },
      fetch: createBoundedFetch(fetchImplementation),
    },
  });
  const server = createServer((request, response) => {
    void handleRequest(request, response, client, configuration).catch(() => {
      diagnostic(configuration, "host", "unknown", "canonical_host_failed");
      if (!response.headersSent) sendJson(response, 500, { error: "canonical_host_failed" });
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(configuration.port, "127.0.0.1", resolveListen);
  });
  return server;
}

async function main() {
  const server = await startServer(readConfiguration());
  const address = server.address();
  console.log(`Gemini canonical model host listening on http://127.0.0.1:${address.port}/generate`);
  const close = () => { server.close(() => process.exit(0)); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof CanonicalHostConfigurationError
      ? `Canonical model host configuration failed: ${error.message}`
      : "Canonical model host failed to start.");
    process.exitCode = 1;
  }
}
