import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { cancelResponseBody, readBoundedJson } from "../transport/response-body.js";
import type { Request } from "./provider.js";
import { obj } from "./schema.js";

export function studentPayload(req: Request) {
  return JSON.stringify({ model: req.model.requestedModel, messages: [{ role: "system", content: req.system }, ...req.messages],
    temperature: req.params.temperature, max_tokens: req.params.maxOutputTokens, thinking: { type: "disabled" } });
}
export async function studentHttp(req: Request, key: string | undefined, send = fetch) {
  if (!key || req.role !== "student" || req.model.provider !== "deepseek") return { error: "not_dispatched" };
  const start = Date.now(), signal = AbortSignal.timeout(30_000);
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
    return { reply: { text: choice?.message?.content, resolvedModel: data.model, system_fingerprint: data.system_fingerprint ?? null, finishReason: choice?.finish_reason,
      usage: bill && typeof bill === "object" ? { inputTokens: bill.prompt_tokens, outputTokens: bill.completion_tokens } : null,
      latencyMs: Date.now() - start } };
  } catch (error) {
    const cause = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause ? error.cause.code : null;
    if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(String(cause))) return { error: "not_dispatched", retryable: true };
    return signal.aborted || cause === "UND_ERR_CONNECT_TIMEOUT" ? { error: "timeout", retryable: true } : { error: "provider_error" };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(JSON.stringify(await studentHttp(JSON.parse(readFileSync(0, "utf8")), process.env.DEEPSEEK_API_KEY))); }
  catch { process.exitCode = 1; }
}
