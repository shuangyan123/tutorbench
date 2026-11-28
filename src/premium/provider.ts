import { observedFormat, type ObservedFormat } from "./student.js";
import { hash } from "./cards.js";
import { studentRequestParametersHash } from "./student-http.js";
import { amount, choices, id, invalid, list, localized, nullable, optional, positive, shape, str, type Reader } from "./schema.js";

const modelFields = { id, label: optional(str), developer: id, provider: id, requestedModel: id, pinnedVersion: id };
export const modelSchema = shape(modelFields);
const tutorSchema = shape({ ...modelFields,
  prompt: optional(shape({ id, version: id, text: localized(str) })),
  params: optional(shape({ temperature: optional(nullable(amount)), maxOutputTokens: optional(positive) })),
});
export type Tutor = ReturnType<typeof tutorSchema>;
export type Model = ReturnType<typeof modelSchema>;
export interface Message { role: "assistant" | "user"; content: string }
const inferenceSchema = shape({ thinking: choices("disabled", "enabled"), reasoningEffort: choices("none", "low", "high", "max"),
  maxOutputTokens: positive, temperature: optional(amount) });
export type StudentInference = Omit<ReturnType<typeof inferenceSchema>, "temperature"> & { temperature?: number };
export function readStudentInference(v: unknown, field: string): StudentInference {
  const inference = inferenceSchema(v, field);
  if ((inference.thinking === "disabled") !== (inference.reasoningEffort === "none") || inference.maxOutputTokens > 384_000 ||
      (inference.temperature !== undefined && (inference.thinking === "enabled" || inference.temperature > 2))) invalid(field);
  const { temperature, ...required } = inference;
  return temperature === undefined ? required : { ...required, temperature };
}
export interface Request {
  role: "student" | "tutor" | "judge";
  model: Model;
  system: string;
  messages: Message[];
  responseFormat?: { type: "json_object" }; historyHash?: string;
  studentInference?: StudentInference;
  params: { temperature?: number | null; maxOutputTokens?: number };
}
export interface Reply {
  returnedModel?: string | null; system_fingerprint?: string | null;
  text: string | null; resolvedModel: string; finishReason: string; latencyMs: number;
  usage: { inputTokens: number; outputTokens: number; cacheHitTokens?: number | undefined; cacheMissTokens?: number | undefined;
    reasoningTokens?: number | undefined; visibleOutputTokens?: number | undefined } | null;
}
export type Provider = ((request: Request) => Reply) & { requestBytes?: (request: Request) => number };
export interface ModelPrice { model: string; cacheHitInputUsdPerMillion?: number | undefined; inputUsdPerMillion: number;
  outputUsdPerMillion: number; date: string; source: string }
const rate: Reader<ModelPrice> = shape({ model: id, cacheHitInputUsdPerMillion: optional(amount), inputUsdPerMillion: amount, outputUsdPerMillion: amount,
  date: (v, f) => /^\d{4}-\d{2}-\d{2}$/u.test(str(v, f)) ? String(v) : invalid(f),
  source: (v, f) => /^https:\/\//u.test(str(v, f)) ? String(v) : invalid(f) });
export const priceSchema = shape({ version: id, models: optional(list(rate)), cacheHitInputUsdPerMillion: optional(amount),
  inputUsdPerMillion: optional(nullable(amount)), outputUsdPerMillion: optional(nullable(amount)) });
export type Prices = ReturnType<typeof priceSchema>;
export type Role = Request["role"];
export type Failure = `http_${number}` | "timeout" | "overloaded" | "not_dispatched" | "content_filter" | "provider_error" | "mock_not_dispatched" | "sensitive_output" | "invalid_response" | "model_version_drift" | "budget_stop" | "unknown_cost";
export interface Call {
  historyHash?: string; responseFormat?: { requested: "json_object"; observed: ObservedFormat | null };
  studentInference?: StudentInference; requestParametersHash?: string; truncated?: boolean | null;
  transportDiagnostic?: TransportDiagnostic;
  cache?: ReturnType<typeof cacheReceipt>;
  requestedModel: string; returnedModel: string | null; system_fingerprint: string | null; calledAt: string;
  n: number; role: Role; model: string; requestHash: string; resolvedModel: string | null;
  usage: Reply["usage"]; usd: number | null; finishReason: string | null; latencyMs: number | null;
  error: Failure | null; retryDelayMs: number; reservedUsd: number; costEstimated: boolean;
}
export type TransportDiagnostic = "connect_timeout" | "deadline" | "worker_deadline" | "worker_failure" | "connection_reset" | "transport_failure";
export class TransportError extends Error {
  constructor(readonly code: Failure, readonly retryable = false, readonly retryAfterMs?: number,
    readonly identity?: { returnedModel: unknown; system_fingerprint: unknown }, readonly diagnostic?: TransportDiagnostic) { super(code); }
}
export class MockNotDispatched extends TransportError {
  constructor() { super("mock_not_dispatched", true); }
}
export class CallError extends Error { constructor(readonly code: Failure) { super(code); } }

export function sensitive(text: string) {
  // 先展开 JSON 转义，防止凭据在解析学生消息后才显现。
  const visible = text.replace(/\\u([0-9a-f]{4})/giu, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(["'])/gu, "$1");
  return /<\/?(?:think|thinking|reasoning)>|\bsk-[a-z0-9_-]+|\bgh[pousr]_[a-z0-9]+|github_pat_|authorization|\bbearer\s+\S+|\b(?:set-cookie|cookie|password|api[_-]?key|access[_-]?token|request[_-]?headers|headers|reasoning(?:_content)?|chain_of_thought|private[_-]?key|client[_-]?secret|refresh[_-]?token)\b\s*["']?\s*[:=]|\bthinking\b\s*["']?\s*[:=](?!\s*"(?:disabled|enabled)")|-----BEGIN [A-Z ]*PRIVATE KEY-----|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(visible);
}
// 老价格表的 inputUsdPerMillion 也是保守预留所用的未命中价。
function cacheReceipt(hitRate: number | null, missRate: number, usage?: Reply["usage"]) {
  const hit = usage?.cacheHitTokens, miss = usage?.cacheMissTokens;
  const complete = hit !== undefined && miss !== undefined && tokens(hit) && tokens(miss) && hit + miss === usage?.inputTokens;
  return { hitTokens: complete ? hit : null, missTokens: complete ? miss : null,
    hitRate: complete && hit + miss > 0 ? hit / (hit + miss) : null,
    hitUsdPerMillion: hitRate, missUsdPerMillion: missRate,
    hitUsd: complete && (hitRate !== null || hit === 0) ? dollars(hit * (hitRate ?? 0) / 1e6) : null,
    missUsd: complete ? dollars(miss * missRate / 1e6) : null };
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

export function callReservation(req: Request, bytes: number, input: number, output: number) {
  // 推理实验按完整 UTF-8 请求字节加消息封装余量保守估算输入，不依赖缓存折扣。
  const inputTokens = req.studentInference ? bytes + 32 * (req.messages.length + 1) : Math.ceil(bytes / 2);
  const outputTokens = req.studentInference?.maxOutputTokens ?? req.params.maxOutputTokens ?? { tutor: 2048, student: 512, judge: 8192 }[req.role];
  return dollars((inputTokens * input + outputTokens * output) / 1_000_000);
}
export function inferenceUsage(calls: Call[]) {
  return {
    calls: calls.length,
    outputTokens: calls.length ? sumKnown(calls.map(c => c.usage?.outputTokens ?? null)) : null,
    reasoningTokens: calls.length ? sumKnown(calls.map(c => c.usage?.reasoningTokens ?? null)) : null,
    visibleOutputTokens: calls.length ? sumKnown(calls.map(c => c.usage?.visibleOutputTokens ?? null)) : null,
    knownReasoningCalls: calls.filter(c => c.usage?.reasoningTokens !== undefined).length,
    knownVisibleOutputCalls: calls.filter(c => c.usage?.visibleOutputTokens !== undefined).length,
    truncatedCalls: calls.filter(c => c.truncated === true).length,
    knownTruncationCalls: calls.filter(c => typeof c.truncated === "boolean").length,
    usd: sumUsd(calls.map(c => c.usd)),
  };
}

// 同一批次在串行事务内运行，一次只预留一个调用。
export class Session {
  readonly calls: Call[] = [];
  private budgetStopped = false;
  constructor(readonly provider: Provider, readonly prices: Prices, private remaining: number, readonly reserveUsd: number, readonly maxOfflineAttempts = 1,
    private readonly wait = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }) {
    amount(remaining, "available budget");
    if (dollars(remaining) !== remaining || dollars(reserveUsd) !== reserveUsd) invalid("budget.precision");
    amount(reserveUsd, "reserveUsd");
    if (!Number.isInteger(maxOfflineAttempts) || maxOfflineAttempts < 1 || maxOfflineAttempts > 4) invalid("maxOfflineAttempts");
  }
  call(req: Request): Reply {
    let delay = 0;
    for (let attempt = 1; ; attempt++) {
      try { return this.invoke(req, delay); }
      catch (error) {
        if (!(error instanceof TransportError)) throw error;
        const mock = error instanceof MockNotDispatched;
        if (!error.retryable || attempt >= (mock ? this.maxOfflineAttempts : 4) || (error.retryAfterMs ?? 0) > 60_000)
          throw new CallError(error.code);
        const interval = 2000 * 2 ** (attempt - 1);
        delay = error.retryAfterMs ?? (mock ? interval : Math.round(interval * (0.8 + 0.4 * Math.random())));
        if (!mock) this.wait(delay);
      }
    }
  }
  private invoke(req: Request, retryDelayMs: number): Reply {
    const rate = this.prices.models ? this.prices.models.find(m => m.model === req.model.id) : this.prices;
    const input = rate?.inputUsdPerMillion, output = rate?.outputUsdPerMillion;
    if (input == null || output == null || this.calls.some(c => c.usd === null)) throw new CallError("unknown_cost");
    const hitRate = rate?.cacheHitInputUsdPerMillion ?? null;
    if (hitRate !== null && hitRate > input) invalid("prices.cacheHitInputUsdPerMillion");
    const bytes = this.provider.requestBytes?.(req) ?? Buffer.byteLength(JSON.stringify(req));
    const reserve = callReservation(req, bytes, input, output);
    if (reserve === null) throw new CallError("unknown_cost");
    if (this.budgetStopped || this.remaining < reserve || this.remaining <= 0) {
      this.budgetStopped = true;
      throw new CallError("budget_stop");
    }
    const call: Call = { cache: cacheReceipt(hitRate, input), n: this.calls.length + 1, role: req.role, model: req.model.id, requestHash: hash(JSON.stringify(req)),
      calledAt: new Date().toISOString(), requestedModel: req.model.requestedModel, returnedModel: null, system_fingerprint: null,
      resolvedModel: null, usage: null, usd: null, finishReason: null, latencyMs: null, error: null, reservedUsd: reserve, costEstimated: true, retryDelayMs };
    if (req.role === "student" && req.responseFormat) {
      call.responseFormat = { requested: req.responseFormat.type, observed: null };
      if (req.historyHash) call.historyHash = req.historyHash;
    }
    if (req.studentInference) Object.assign(call, { studentInference: req.studentInference,
      requestParametersHash: studentRequestParametersHash(req), truncated: null });
    this.calls.push(call);
    call.usd = reserve;
    this.remaining = dollars(this.remaining - reserve)!;
    const fail = (code: Failure): never => { call.error = code; throw new CallError(code); };
    const recordIdentity = (model: unknown, fingerprint: unknown) => {
      for (const value of [model, fingerprint]) {
        if (value != null && typeof value !== "string") fail("invalid_response");
        if (typeof value === "string" && sensitive(value)) fail("sensitive_output");
      }
      call.returnedModel = typeof model === "string" && model.trim() ? model : null;
      call.system_fingerprint = typeof fingerprint === "string" ? fingerprint : null;
    };
    const returnedDrift = () => req.role !== "tutor" && call.returnedModel !== null && call.returnedModel !== req.model.pinnedVersion;
    const started = Date.now();
    let reply: Reply;
    try { reply = this.provider(structuredClone(req)); }
    catch (error) {
      if (req.studentInference) call.latencyMs = Date.now() - started;
      call.error = error instanceof TransportError ? error.code : "provider_error";
      if (call.error === "not_dispatched" || call.error === "mock_not_dispatched") {
        this.remaining = dollars(this.remaining + reserve)!;
        call.usd = 0; call.costEstimated = false; call.usage = { inputTokens: 0, outputTokens: 0 };
      }
      if (error instanceof TransportError) {
        if (error.diagnostic) call.transportDiagnostic = error.diagnostic;
        if (error.identity) recordIdentity(error.identity.returnedModel, error.identity.system_fingerprint);
        if (returnedDrift()) fail("model_version_drift");
        throw error;
      }
      throw new CallError(call.error);
    }
    if (!reply || typeof reply !== "object") return fail("invalid_response");
    if (reply.usage && tokens(reply.usage.inputTokens) && tokens(reply.usage.outputTokens)) {
      call.costEstimated = false;
      call.usage = { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens };
      const { reasoningTokens, visibleOutputTokens, outputTokens } = reply.usage;
      if (reasoningTokens !== undefined && tokens(reasoningTokens) && reasoningTokens <= outputTokens) call.usage.reasoningTokens = reasoningTokens;
      if (visibleOutputTokens !== undefined && tokens(visibleOutputTokens) &&
          visibleOutputTokens + (call.usage.reasoningTokens ?? 0) <= outputTokens) call.usage.visibleOutputTokens = visibleOutputTokens;
      const cache = cacheReceipt(hitRate, input, reply.usage);
      call.cache = cache;
      if (cache.hitTokens !== null && cache.missTokens !== null) {
        Object.assign(call.usage, { cacheHitTokens: cache.hitTokens, cacheMissTokens: cache.missTokens });
      }
      const expectsCache = req.model.provider === "deepseek" || hitRate !== null ||
        reply.usage.cacheHitTokens !== undefined || reply.usage.cacheMissTokens !== undefined;
      call.costEstimated = expectsCache && call.usage.inputTokens > 0 &&
        (cache.hitTokens === null || (cache.hitTokens > 0 && hitRate === null));
      const inputCost = cache.hitTokens !== null && cache.missTokens !== null && hitRate !== null
        ? cache.hitTokens * hitRate + cache.missTokens * input : call.usage.inputTokens * input;
      const cost = (inputCost +
        call.usage.outputTokens * output) / 1_000_000;
      call.usd = dollars(cost);
      if (call.usd !== null) {
        this.remaining = dollars(this.remaining + reserve - call.usd)!;
      }
    }
    const returned = reply.returnedModel === undefined ? reply.resolvedModel : reply.returnedModel;
    recordIdentity(returned, reply.system_fingerprint);
    if (req.studentInference) {
      call.latencyMs = tokens(reply.latencyMs) ? reply.latencyMs : Date.now() - started;
      if (typeof reply.finishReason === "string" && !sensitive(reply.finishReason)) {
        call.finishReason = reply.finishReason;
        call.truncated = reply.finishReason === "length";
      }
    }
    if (reply.finishReason === "content_filter") return fail(returnedDrift() ? "model_version_drift" : "content_filter");
    const v6Student = req.role === "student" && !!req.responseFormat;
    const validText = typeof reply.text === "string" ? v6Student || !!reply.text.trim() : v6Student && reply.text === null;
    if (!validText || typeof reply.resolvedModel !== "string" || !reply.resolvedModel.trim() ||
        typeof reply.finishReason !== "string" || !reply.finishReason.trim() || !tokens(reply.latencyMs)) return fail(returnedDrift() ? "model_version_drift" : "invalid_response");
    if ([reply.text ?? "", reply.resolvedModel, reply.finishReason].some(sensitive)) return fail("sensitive_output");
    if (call.responseFormat) call.responseFormat.observed = observedFormat(reply.text, reply.finishReason);
    call.resolvedModel = reply.resolvedModel;
    call.finishReason = reply.finishReason;
    call.latencyMs = reply.latencyMs;
    const previous = this.calls.find(c => c.role === req.role && c.model === req.model.id && c.resolvedModel);
    if (returnedDrift() || (req.role !== "tutor" && reply.resolvedModel !== req.model.pinnedVersion) ||
        previous?.resolvedModel !== reply.resolvedModel) return fail("model_version_drift");
    return { text: reply.text, returnedModel: call.returnedModel, system_fingerprint: call.system_fingerprint, resolvedModel: reply.resolvedModel, finishReason: reply.finishReason, latencyMs: reply.latencyMs, usage: call.usage };
  }
}
export const configSchema = shape({
  servingIdentity: optional(choices("revision", "alias", "unknown")),
  identityEvidence: optional(shape({
    url: (v, f) => URL.canParse(str(v, f)) && new URL(String(v)).protocol === "https:" ? String(v) : invalid(f),
    retrievedAt: (v, f) => /^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(str(v, f)) && Number.isFinite(Date.parse(String(v))) ? String(v) : invalid(f),
    quote: str,
  })),
  syntheticJudgeRubric: optional(choices("fixture")), kind: optional(choices("evaluation", "calibration", "calibration-probe")), hardCapUsd: optional(amount), batchId: id, purpose: str, languages: (v, f) => {
    if (!Array.isArray(v) || !v.length || v.some(l => l !== "en" && l !== "zh-CN") || new Set(v).size !== v.length) invalid(f);
    return v as ("en" | "zh-CN")[];
  }, repeats: positive, maxOfflineAttempts: optional(positive), budgetUsd: amount, reserveUsd: (v, f) => v === undefined ? 0 : amount(v, f), prices: priceSchema,
  tutors: list(tutorSchema), student: modelSchema, studentInference: optional(readStudentInference), judgeConfigVersion: id, judges: arrayModels, alternates: arrayModels,
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
