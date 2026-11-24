import { hash } from "./cards.js";
import { amount, id, invalid, nullable, optional, positive, shape, str } from "./schema.js";

export const modelSchema = shape({ id, label: optional(str), developer: id, provider: id, requestedModel: id, pinnedVersion: id });
export type Model = ReturnType<typeof modelSchema>;
export interface Message { role: "assistant" | "user"; content: string }
export interface Request {
  role: "student" | "tutor" | "judge";
  model: Model;
  system: string;
  messages: Message[];
  params: { temperature: number | null; maxOutputTokens?: number };
}
export interface Reply {
  text: string; resolvedModel: string; finishReason: string; latencyMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}
export type Provider = (request: Request) => Reply;
export const priceSchema = shape({ version: id, inputUsdPerMillion: nullable(amount), outputUsdPerMillion: nullable(amount) });
export type Prices = ReturnType<typeof priceSchema>;
export type Role = Request["role"];
export type Failure = "provider_error" | "mock_not_dispatched" | "sensitive_output" | "invalid_response" | "model_version_drift" | "budget_stop" | "unknown_cost";
export interface Call {
  n: number; role: Role; model: string; requestHash: string; resolvedModel: string | null;
  usage: Reply["usage"]; usd: number | null; finishReason: string | null; latencyMs: number | null;
  error: Failure | null; retryDelayMs: number;
}
export class MockNotDispatched extends Error {}
export class CallError extends Error { constructor(readonly code: Failure) { super(code); } }

export function sensitive(text: string) {
  // 先展开 JSON 转义，防止凭据在解析学生消息后才显现。
  const visible = text.replace(/\\u([0-9a-f]{4})/giu, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(["'])/gu, "$1");
  return /<\/?(?:think|thinking|reasoning)>|\bsk-[a-z0-9_-]+|\bgh[pousr]_[a-z0-9]+|github_pat_|authorization|\bbearer\s+\S+|\b(?:set-cookie|cookie|password|api[_-]?key|access[_-]?token|request[_-]?headers|headers|reasoning(?:_content)?|thinking|chain_of_thought|private[_-]?key|client[_-]?secret|refresh[_-]?token)\b\s*["']?\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY-----|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(visible);
}
function tokens(v: number) { return Number.isSafeInteger(v) && v >= 0; }
export function sumKnown(values: (number | null)[]) {
  let sum = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) return null;
    sum += value;
  }
  return Number.isFinite(sum) ? sum : null;
}
// Offline receipts and budget balances use integer nano-USD to avoid drift at an exact cap.
export function dollars(n: number) {
  const units = Math.round(n * 1e9);
  return Number.isSafeInteger(units) ? units / 1e9 : null;
}
export function sumUsd(values: (number | null)[]) {
  const total = sumKnown(values.map(n => n === null ? null : Math.round(n * 1e9)));
  return total !== null && Number.isSafeInteger(total) ? total / 1e9 : null;
}
export function usage(calls: Call[], priceTable: Prices) {
  const sum = (items: Call[]) => ({
    inputTokens: sumKnown(items.map(c => c.usage?.inputTokens ?? null)),
    outputTokens: sumKnown(items.map(c => c.usage?.outputTokens ?? null)),
    usd: sumUsd(items.map(c => c.usd)),
  });
  return { tutor: sum(calls.filter(c => c.role === "tutor")), student: sum(calls.filter(c => c.role === "student")),
    judges: sum(calls.filter(c => c.role === "judge")), totalUsd: sum(calls).usd, priceTable: priceTable.version, rates: priceTable };
}

// 每次模拟调用先预留额度。异常后的未知花费会阻止下一次调用。
export class Session {
  readonly calls: Call[] = [];
  constructor(readonly provider: Provider, readonly prices: Prices, private remaining: number, readonly reserveUsd: number, readonly maxOfflineAttempts = 1) {
    amount(remaining, "available budget");
    if (dollars(remaining) !== remaining || dollars(reserveUsd) !== reserveUsd) invalid("budget.precision");
    amount(reserveUsd, "reserveUsd");
    if (!Number.isInteger(maxOfflineAttempts) || maxOfflineAttempts < 1 || maxOfflineAttempts > 4) invalid("maxOfflineAttempts");
  }
  call(req: Request): Reply {
    for (let attempt = 1; ; attempt++) {
      try { return this.invoke(req, attempt === 1 ? 0 : 1000 * 2 ** (attempt - 2)); }
      catch (error) {
        if (!(error instanceof CallError) || error.code !== "mock_not_dispatched" || attempt >= this.maxOfflineAttempts) throw error;
      }
    }
  }
  private invoke(req: Request, retryDelayMs: number): Reply {
    if (this.prices.inputUsdPerMillion === null || this.prices.outputUsdPerMillion === null ||
        this.calls.some(c => c.usd === null)) throw new CallError("unknown_cost");
    if (this.remaining <= 0 || this.remaining < this.reserveUsd) throw new CallError("budget_stop");
    const call: Call = { n: this.calls.length + 1, role: req.role, model: req.model.id, requestHash: hash(JSON.stringify(req)),
      resolvedModel: null, usage: null, usd: null, finishReason: null, latencyMs: null, error: null, retryDelayMs };
    this.calls.push(call);
    let reply: Reply;
    try { reply = this.provider(structuredClone(req)); }
    catch (error) {
      call.error = error instanceof MockNotDispatched ? "mock_not_dispatched" : "provider_error";
      if (error instanceof MockNotDispatched) { call.usd = 0; call.usage = { inputTokens: 0, outputTokens: 0 }; }
      throw new CallError(call.error);
    }
    const fail = (code: Failure): never => { call.error = code; throw new CallError(code); };
    if (!reply || typeof reply !== "object") return fail("invalid_response");
    if (reply.usage && tokens(reply.usage.inputTokens) && tokens(reply.usage.outputTokens)) {
      call.usage = { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens };
      const cost = (call.usage.inputTokens * this.prices.inputUsdPerMillion +
        call.usage.outputTokens * this.prices.outputUsdPerMillion) / 1_000_000;
      call.usd = dollars(cost);
      if (call.usd !== null) {
        this.remaining = dollars(this.remaining - call.usd)!;
      }
    }
    if (typeof reply.text !== "string" || !reply.text.trim() || typeof reply.resolvedModel !== "string" || !reply.resolvedModel.trim() ||
        typeof reply.finishReason !== "string" || !reply.finishReason.trim() || !tokens(reply.latencyMs)) return fail("invalid_response");
    if ([reply.text, reply.resolvedModel, reply.finishReason].some(sensitive)) return fail("sensitive_output");
    call.resolvedModel = reply.resolvedModel;
    call.finishReason = reply.finishReason;
    call.latencyMs = reply.latencyMs;
    const previous = this.calls.find(c => c.role === req.role && c.model === req.model.id && c.resolvedModel);
    if ((req.role !== "tutor" && reply.resolvedModel !== req.model.pinnedVersion) ||
        previous?.resolvedModel !== reply.resolvedModel) return fail("model_version_drift");
    return { text: reply.text, resolvedModel: reply.resolvedModel, finishReason: reply.finishReason, latencyMs: reply.latencyMs, usage: call.usage };
  }
}
export const configSchema = shape({
  batchId: id, purpose: str, languages: (v, f) => {
    if (!Array.isArray(v) || !v.length || v.some(l => l !== "en" && l !== "zh-CN") || new Set(v).size !== v.length) invalid(f);
    return v as ("en" | "zh-CN")[];
  }, repeats: positive, maxOfflineAttempts: optional(positive), budgetUsd: amount, reserveUsd: amount, prices: priceSchema,
  tutors: arrayModels, student: modelSchema, judgeConfigVersion: id, judges: arrayModels, alternates: arrayModels,
});
function arrayModels(v: unknown, f: string) {
  if (!Array.isArray(v)) invalid(f);
  return v.map(m => modelSchema(m, f));
}
export type Config = ReturnType<typeof configSchema>;
export function panel(config: Config, tutor: Model) {
  if (config.judges.length !== 3) invalid("judges.length");
  // developer 表示模型开发商，不能用托管平台名代替。
  const used = new Set([tutor.developer.toLowerCase(), config.student.developer.toLowerCase()]);
  const result: Model[] = [];
  for (const model of [...config.judges, ...config.alternates]) {
    if (used.has(model.developer.toLowerCase())) continue;
    used.add(model.developer.toLowerCase());
    result.push(model);
    if (result.length === 3) return result;
  }
  return invalid("judges.independent_panel");
}
