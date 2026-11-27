import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { cancelResponseBody, readBoundedJson } from "../transport/response-body.js";
import type { Request, TransportDiagnostic } from "./provider.js";
import { obj } from "./schema.js";

export function studentPayload(req: Request) {
  const inference = req.studentInference;
  return JSON.stringify({ model: req.model.requestedModel, messages: [{ role: "system", content: req.system }, ...req.messages],
    temperature: inference ? inference.temperature : req.params.temperature,
    max_tokens: inference?.maxOutputTokens ?? req.params.maxOutputTokens, thinking: { type: inference?.thinking ?? "disabled" },
    ...(inference ? { reasoning_effort: inference.reasoningEffort } : {}), ...(req.responseFormat ? { response_format: req.responseFormat } : {}) });
}
function outputBreakdown(bill: Record<string, unknown>, req: Request) {
  const details = bill.completion_tokens_details;
  const total = bill.completion_tokens;
  const reasoning = details && typeof details === "object" && "reasoning_tokens" in details ? details.reasoning_tokens : undefined;
  const safety = details && typeof details === "object" && "safety_tokens" in details ? details.safety_tokens : 0;
  const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (!count(total)) return {};
  if (count(reasoning) && reasoning <= total) return {
    reasoningTokens: reasoning,
    ...(count(safety) && safety <= total - reasoning ? { visibleOutputTokens: total - reasoning - safety } : {}),
  };
  if (reasoning === undefined && req.studentInference?.thinking === "disabled" && count(safety) && safety <= total)
    return { visibleOutputTokens: total - safety };
  return {};
}
export async function studentHttp(req: Request, key: string | undefined, send = fetch) {
  if (!key || req.role !== "student" || req.model.provider !== "deepseek") return { error: "not_dispatched" };
  const start = Date.now(), signal = AbortSignal.timeout(120_000);
  try {
    const response = await send("https://api.deepseek.com/chat/completions", {
      method: "POST", redirect: "error", signal,
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: studentPayload(req),
    });
    if (!response.ok) {
      const after = response.headers.get("retry-after");
      const seconds = after === null ? NaN : /^\d+(?:\.\d+)?$/u.test(after) ? Number(after) : (Date.parse(after) - Date.now()) / 1000;
      cancelResponseBody(response);
      return { error: "http_" + response.status, retryable: [408, 429, 500, 502, 503, 504, 529].includes(response.status),
        ...(Number.isFinite(seconds) ? { retryAfterMs: Math.max(0, Math.ceil(seconds * 1000)) } : {}) };
    }
    const data = obj(await readBoundedJson(response, signal), "response");
    if (data.error && typeof data.error === "object" && "code" in data.error &&
        ["server_overloaded", "overloaded_error"].includes(String(data.error.code))) return { error: "overloaded", retryable: true,
          identity: { returnedModel: data.model ?? null, system_fingerprint: data.system_fingerprint ?? null } };
    const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;
    const bill = data.usage == null ? null : obj(data.usage, "usage");
    return { reply: { text: choice?.message?.content ?? null, resolvedModel: data.model, system_fingerprint: data.system_fingerprint ?? null, finishReason: choice?.finish_reason,
      usage: bill && typeof bill === "object" ? { inputTokens: bill.prompt_tokens, outputTokens: bill.completion_tokens,
        cacheHitTokens: bill.prompt_cache_hit_tokens, cacheMissTokens: bill.prompt_cache_miss_tokens, ...outputBreakdown(bill, req) } : null,
      latencyMs: Date.now() - start } };
  } catch (error) {
    const cause = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause ? error.cause.code : null;
    if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(String(cause))) return { error: "not_dispatched", retryable: true };
    const diagnostic: TransportDiagnostic = signal.aborted ? "deadline" : cause === "UND_ERR_CONNECT_TIMEOUT" ? "connect_timeout" :
      cause === "ECONNRESET" || cause === "UND_ERR_SOCKET" ? "connection_reset" : "transport_failure";
    return diagnostic === "deadline" || diagnostic === "connect_timeout" ? { error: "timeout", retryable: true, diagnostic } :
      { error: "provider_error", retryable: diagnostic === "connection_reset", diagnostic };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(JSON.stringify(await studentHttp(JSON.parse(readFileSync(0, "utf8")), process.env.DEEPSEEK_API_KEY))); }
  catch { process.exitCode = 1; }
}
