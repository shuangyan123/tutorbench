import assert from "node:assert/strict";
import { test } from "node:test";
import { runBatch } from "../src/premium/batch.js";
import { hash } from "../src/premium/cards.js";
import { callReservation, dollars, priceSchema, readStudentInference, Session, type Reply, type Request } from "../src/premium/provider.js";
import { studentRequestOptions } from "../src/premium/student.js";
import { studentHttp, studentPayload } from "../src/premium/student-http.js";
import { readProtocol } from "../src/premium/protocol.js";
import { fixture, storage } from "./premium-fixture.js";

test("diagnostic output is isolated in both directions; its budget cannot be topped up or assigned to a formal gate", t => {
  const { e, job } = fixture(), { store } = storage(t);
  const old = e.config;
  runBatch(store, e);
  const asset = job.asset, config = { ...old, batchId: "diag", kind: "calibration-probe" as const, tutors: [],
    judges: [], alternates: [], budgetUsd: 0.02, hardCapUsd: 0.02 };
  const lang = (text: string) => ({ en: text, "zh-CN": text });
  const prefix = [
    { role: "student" as const, text: "Opening.", fixed: true, state: { stage: 1, events: [], end: false } },
    { role: "tutor" as const, text: "Consider another tile.", turn: 1, source: "test-tutor#1" },
  ];
  asset.protocol = readProtocol({ schemaVersion: 1, id: "synthetic-test", version: "1.2.1", rulesVersion: asset.rulesVersion,
    studentRequest: { responseFormat: { type: "json_object" }, thinking: { type: "disabled" }, temperature: 0.7, maxOutputTokens: 512 },
    instruction: lang("Only JSON {events}"), instructionEvents: "events", turnNote: { separator: "\n", default: lang("{k}"), fixedTestInjected: lang("{k}") },
    rewrite: { joiner: "\n", codes: {} },
    injection: { appliesWhen: "conditional", separator: "\n", position: "append", runnerEvent: "card", dropModelReportedRunnerEvent: true,
      lengthCheck: "final", echoCheckScope: "when injected" }, history: { assistantContent: "canonical", userContent: "note", opening: "fixed" },
  }, hash("synthetic protocol"));
  const probe = { prefix, probeId: "test", probeSetVersion: "1", prefixHash: hash(JSON.stringify(prefix)), targetStudentMessage: 2,
    protocolVersion: "1.2.1", tutorSource: "test-tutor" };
  const d = { ...e, config, probePlan: { gate: "diagnostic" as const, probes: [{ en: probe, "zh-CN": probe }] },
    provider: () => () => { throw new Error("mock blocked"); } };
  assert.throws(() => runBatch(store, d), /diagnostic_output/);
  const isolated = storage(t).store;
  assert.throws(() => runBatch(isolated, { ...d, topUp: true }), /diagnostic_budget_or_series/);
  assert.throws(() => runBatch(isolated, { ...d, series: { phase: "G2", id: "synthetic", priorBatchIds: [] } }), /diagnostic_budget_or_series/);
  const result = runBatch(isolated, d);
  assert.equal(result.gate, "diagnostic");
  assert.equal(result.hardCapUsd, 0.02);
  assert.ok(Number(result.spentUsd) > 0);
  assert.throws(() => runBatch(isolated, e), /diagnostic_output/);
  assert.throws(() => runBatch(isolated, { ...d, config: { ...config, batchId: "other-diagnostic" } }), /diagnostic_output/);
  const studentInference = readStudentInference({ thinking: "enabled", reasoningEffort: "high", maxOutputTokens: 8192 }, "profile");
  const experiment = { ...d, config: { ...config, studentInference } };
  assert.throws(() => runBatch(isolated, experiment), /batch\/diag/u);
  const scratch = storage(t).store;
  const b = runBatch(scratch, experiment);
  assert.deepEqual(b.studentInference, studentInference);
  const [record] = scratch.records(config.batchId);
  assert.deepEqual(record?.student.studentInference, studentInference);
  assert.deepEqual(record?.calls[0]?.studentInference, studentInference);
  assert.throws(() => runBatch(scratch, { ...experiment, probePlan: { ...d.probePlan, gate: "key" } }), /studentInference_scope/);
  const ledger = storage(t).store;
  const g2 = { ...experiment, config: { ...experiment.config, batchId: "formal-g2", budgetUsd: 2, hardCapUsd: 2 },
    probePlan: { ...d.probePlan, gate: "key" as const },
    series: { phase: "G2" as const, id: "synthetic-formal", priorBatchIds: [] } };
  assert.equal(runBatch(ledger, g2).status, "complete");
  assert.ok(ledger.records(g2.config.batchId)[0]?.calls[0]?.requestParametersHash);
  const g3 = { ...g2, config: { ...g2.config, batchId: "formal-g3" },
    probePlan: { ...d.probePlan, gate: "rest" as const },
    series: { ...g2.series, phase: "G3" as const, priorBatchIds: [g2.config.batchId] } };
  for (const drift of [undefined, { ...studentInference, reasoningEffort: "low" as const }]) {
    assert.throws(() => runBatch(ledger, { ...g3, config: { ...g3.config, studentInference: drift } }), /calibration-series/);
  }
  const { series: _series, ...standalone } = g3;
  assert.throws(() => runBatch(ledger, { ...standalone, config: { ...g3.config, studentInference: undefined } }), /series_output/);
  assert.equal(ledger.getBatch("formal-g3"), null);
  const next = runBatch(ledger, g3);
  assert.equal(next.status, "complete");
  assert.ok(Number(next.seriesSpentUsd) > Number(next.spentUsd));
});

test("four DeepSeek inference profiles send only supported settings and retain the historical default", () => {
  const { e } = fixture();
  const base = { role: "student" as const, model: e.config.student, system: "fixture", messages: [],
    responseFormat: { type: "json_object" as const } };
  assert.deepEqual(JSON.parse(studentPayload({ ...base, ...studentRequestOptions(undefined, undefined) })), {
    model: base.model.requestedModel, messages: [{ role: "system", content: "fixture" }],
    temperature: 0.7, max_tokens: 512, thinking: { type: "disabled" }, response_format: { type: "json_object" },
  });
  const hashes = new Set();
  for (const level of ["none", "low", "high", "max"] as const) {
    const input = level === "none" ? { thinking: "disabled", reasoningEffort: level, maxOutputTokens: 512, temperature: 0.4 } :
      { thinking: "enabled", reasoningEffort: level, maxOutputTokens: 8192 };
    const inference = readStudentInference(input, "profile");
    const req = { ...base, ...studentRequestOptions(inference, undefined) };
    const body = JSON.parse(studentPayload(req));
    assert.deepEqual(body.thinking, { type: inference.thinking });
    assert.equal(body.reasoning_effort, level);
    assert.equal(body.max_tokens, inference.maxOutputTokens);
    assert.equal(Object.hasOwn(body, "temperature"), level === "none");
    assert.deepEqual(body.response_format, { type: "json_object" });
    const session = new Session(() => ({ text: "{}", resolvedModel: base.model.pinnedVersion, finishReason: "stop",
      latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 } }), e.config.prices, 2, 0);
    session.call(req);
    assert.equal(session.calls[0]?.requestHash, hash(JSON.stringify(req)));
    hashes.add(session.calls[0]?.requestHash);
  }
  assert.equal(hashes.size, 4);
  for (const input of [{ thinking: "enabled", reasoningEffort: "high", maxOutputTokens: 8192, temperature: 0.7 },
    { thinking: "enabled", reasoningEffort: "none", maxOutputTokens: 8192 },
    { thinking: "disabled", reasoningEffort: "low", maxOutputTokens: 512 },
    { thinking: "disabled", reasoningEffort: "none", maxOutputTokens: 0 }]) {
    assert.throws(() => readStudentInference(input, "profile"), /profile/);
  }
});

test("thinking responses meter both token types, preserve truncation, and discard reasoning content", async () => {
  const { e } = fixture();
  const inference = readStudentInference({ thinking: "enabled", reasoningEffort: "high", maxOutputTokens: 8192 }, "profile");
  const req: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" }, system: "JSON fixture",
    messages: [], ...studentRequestOptions(inference, undefined), responseFormat: { type: "json_object" } };
  const get = async (completion_tokens_details: unknown) => {
    const result = await studentHttp(req, "fixture-key", async (_url, init) => {
      assert.equal(init?.body, studentPayload(req));
      return Response.json({
        model: req.model.pinnedVersion, choices: [{ finish_reason: "length",
          message: { content: null, reasoning_content: "private synthetic sentinel" } }],
        usage: { prompt_tokens: 10, completion_tokens: 8192, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 10,
          completion_tokens_details },
      });
    });
    assert(!JSON.stringify(result).includes("private synthetic sentinel"));
    assert("reply" in result);
    return result.reply as Reply;
  };
  const reply = await get({ reasoning_tokens: 8000 });
  assert.equal(reply.text, null);
  assert.equal(reply.usage?.reasoningTokens, 8000);
  assert.equal(reply.usage?.visibleOutputTokens, 192);
  for (const details of [undefined, { reasoning_tokens: 8193 }]) {
    const unknown = await get(details);
    assert.equal(unknown.usage?.reasoningTokens, undefined);
    assert.equal(unknown.usage?.visibleOutputTokens, undefined);
  }
  const prices = priceSchema({ version: "fixture", inputUsdPerMillion: 0.3, outputUsdPerMillion: 1.2 }, "prices");
  const inputBytes = Buffer.byteLength(studentPayload(req));
  const reserve = callReservation(req, inputBytes, 0.3, 1.2)!;
  const provider = Object.assign(() => reply, { requestBytes: () => inputBytes });
  assert.throws(() => new Session(provider, prices, dollars(reserve - 0.000000001)!, 0).call(req), /budget_stop/);
  const session = new Session(provider, prices, reserve, 0);
  session.call(req);
  const [call] = session.calls;
  assert.equal(call?.reservedUsd, reserve);
  assert.equal(call?.usd, 0.0098334);
  assert.equal(call?.truncated, true);
  assert.equal(call?.responseFormat?.observed, "empty");
  assert.ok(typeof call?.latencyMs === "number");
});
