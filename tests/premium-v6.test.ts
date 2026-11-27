import assert from "node:assert/strict";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { callStudentWorker } from "../src/premium/calibration.js";
import { runBatch, type Execution } from "../src/premium/batch.js";
import { hash, loadCards } from "../src/premium/cards.js";
import { loadProbes, type Probe } from "../src/premium/plan.js";
import { Session, TransportError, type Provider, type Reply, type Request } from "../src/premium/provider.js";
import { readProtocol } from "../src/premium/protocol.js";
import { runJob } from "../src/premium/runner.js";
import { studentHttp, studentPayload } from "../src/premium/student-http.js";
import { dir, fixture, reply, storage, temp } from "./premium-fixture.js";

const localized = (en: string, zh = en) => ({ en, "zh-CN": zh });
const codes = ["empty_response", "invalid_json_or_fields", "internal_state_in_message", "unknown_event", "duplicate_event",
  "invalid_stage", "invalid_end", "curt_exit_unsolved", "left_too_early", "fixed_test_early", "fixed_test_missing",
  "fixed_test_self_written", "fixed_test_echo", "too_long", "role_reference"];
const protocol = {
  schemaVersion: 1, id: "synthetic-protocol", version: "2.0.0", rulesVersion: "2.0.0",
  studentRequest: { temperature: 0.7, maxOutputTokens: 512, thinking: { type: "disabled" }, responseFormat: { type: "json_object" } },
  instruction: localized("Only JSON {events}"), instructionEvents: "fixture contract",
  turnNote: { separator: "\n\n", default: localized("Write {k}"), fixedTestInjected: localized("Write {k}. Runner appends the line.") },
  rewrite: { joiner: "\n", codes: { ...Object.fromEntries(codes.map(c => [c, localized("Try again", "再写一次")])),
    too_long: localized("At most {lines} lines and {limit} words", "最多 {lines} 行、{limit} 字") } },
  injection: { appliesWhen: "at the expected turn", separator: "\n", position: "append", runnerEvent: "fixedTest.kind",
    dropModelReportedRunnerEvent: true, lengthCheck: "final visible text" },
  history: { assistantContent: "canonical", userContent: "annotated", opening: "fixed" },
};
const protocolHash = hash(JSON.stringify(protocol));
function v6() {
  const { job, e } = fixture();
  job.asset.protocol = readProtocol(protocol, protocolHash);
  job.asset.rulesVersion = protocol.rulesVersion;
  job.asset.card.fixedTest.delivery = "injected";
  job.asset.card.fixedTest.echoPatterns = { en: ["give it"], "zh-CN": ["直接告诉"] };
  job.asset.card.fixedTest.studentMessage = 2;
  e.config.kind = "calibration";
  e.config.judges = []; e.config.alternates = [];
  return { job, e };
}
const json = (message: string, events: string[] = [], end = false) => JSON.stringify({ message, stage: 1, events, end });
const done = json("Thanks.", ["thanked_after_answer"], true);
function transport(req: Request, text: string | null, finishReason = "stop"): Reply {
  return { ...reply("fixture", req.model.pinnedVersion), text, finishReason };
}
function exercise(students: (req: Request, i: number) => Reply, lang: "en" | "zh-CN" = "en") {
  const { job, e } = v6(), requests: Request[] = [];
  const provider: Provider = req => {
    requests.push(req);
    return req.role === "tutor" ? transport(req, "Consider the tiles.") : students(req, requests.filter(r => r.role === "student").length - 1);
  };
  const result = runJob(e.config, { ...job, lang }, new Session(provider, e.config.prices, 2, 0), e.gitCommit, e.now());
  return { result, requests, card: job.asset.card };
}
test("v6 student JSON wire options and sanitized 120s HTTP diagnostics", async () => {
  const { e, job } = v6();
  const request: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" }, system: "JSON test",
    messages: [], params: { temperature: 0.7, maxOutputTokens: 512 }, responseFormat: { type: "json_object" } };
  const body = JSON.parse(studentPayload(request));
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.thinking, { type: "disabled" });
  const timeout = AbortSignal.timeout;
  const deadlines: number[] = [];
  try {
    AbortSignal.timeout = ms => { deadlines.push(ms); return timeout(ms); };
    const error = await studentHttp(request, "synthetic", async () => {
      throw new Error("private diagnostic should not be recorded", { cause: { code: "UND_ERR_CONNECT_TIMEOUT", private: job.asset.contentHash } });
    });
    assert.deepEqual(deadlines, [120_000]);
    assert.deepEqual(error, { diagnostic: "connect_timeout", error: "timeout", retryable: true });
  } finally { AbortSignal.timeout = timeout; }
});
test("student worker deadline leaves room for HTTP and records only a stable diagnostic", () => {
  const { e } = v6();
  const request: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" }, system: "test",
    messages: [], params: { temperature: 0.7, maxOutputTokens: 512 } };
  assert.throws(() => callStudentWorker(request, (_file, _argv, options) => {
    assert.equal(options.timeout, 130_000);
    return { pid: 1, output: [], stdout: "", stderr: "private text", status: null, signal: null,
      error: Object.assign(new Error("private detail"), { code: "ETIMEDOUT" }) };
  }), (e: unknown) => e instanceof TransportError && e.code === "timeout" && e.diagnostic === "worker_deadline" && e.message === "timeout");
});
test("null, blank and whitespace replies consume two rewrites per attempt, with only user feedback", () => {
  for (const blank of [null, "", "  "]) {
    const { result, requests } = exercise(req => transport(req, blank));
    assert.equal(result.status, "student_invalid");
    assert.equal(result.attempts.length, 3);
    assert.ok(result.attempts.every(a => a.rejected.length === 3 && a.rejected.every(r =>
      r.reasons.join() === "empty_response" && r.observedFormat === "empty")));
    const seq = requests.filter(r => r.role === "student");
    assert.equal(seq.length, 9);
    assert.deepEqual(seq[1]!.messages.slice(-2).map(m => m.role), ["user", "user"]);
    assert.equal(seq[0]!.historyHash, seq[2]!.historyHash);
    assert.ok(result.calls.filter(c => c.role === "student").every(c => c.responseFormat?.observed === "empty"));
  }
});
test("injection keeps original raw output and builds canonical history, with no injection when S2 ends", () => {
  const { job } = v6(), kind = job.asset.card.fixedTest.kind;
  const raw = "  " + json("A short answer.", ["pushback", kind]) + "  ";
  const { result, requests, card } = exercise((req, i) => transport(req, i ? done : raw));
  const accepted = result.transcript[2]!;
  assert.equal(accepted.role, "student"); if (accepted.role !== "student") throw new Error("wrong role");
  const finalText = "A short answer.\n" + card.fixedTest.mustContain.en;
  assert.deepEqual(accepted.injected, { kind: "fixed_test", text: card.fixedTest.mustContain.en, separator: "\n" });
  assert.deepEqual(accepted.state.events, ["pushback", kind]);
  assert.deepEqual(accepted.runnerEvents, [kind]);
  assert.deepEqual(accepted.droppedEvents, [kind]);
  assert.equal(accepted.text, finalText);
  assert.equal(accepted.model?.raw, raw);
  assert.equal(accepted.checks?.call, 2);
  const next = requests.filter(r => r.role === "student")[1]!;
  assert.deepEqual(next.messages.slice(-2), [
    { role: "assistant", content: json(finalText, ["pushback", kind]) },
    { role: "user", content: "Consider the tiles.\n\nWrite 3" },
  ]);
  assert.equal(next.historyHash, hash(JSON.stringify(next.messages)));
  assert.ok(requests.filter(r => r.role === "tutor").every(r => r.messages.every(m => !m.content.includes("Write "))));
  const terminal = exercise(req => transport(req, done)).result;
  assert.equal(terminal.end.fixedTestDelivered, false);
  assert.equal(terminal.end.reason, "thanked_after_answer");
});
test("self-written, echo and final visible length fail with localized feedback; length finish is observed", () => {
  for (const [lang, raw, reason, feedback] of [
    ["en", v6().job.asset.card.fixedTest.mustContain.en, "fixed_test_self_written", "Try again"],
    ["en", "GIVE IT", "fixed_test_echo", "Try again"],
    ["zh-CN", "字".repeat(150), "too_long", "最多 4 行、130 字"],
    ["en", Array.from({ length: 60 }, () => "word").join(" "), "too_long", "At most 4 lines and 49 words"],
  ] as const) {
    const { result, requests } = exercise((req, i) => transport(req, i ? done : json(raw), i ? "stop" : "length"), lang);
    assert.ok(result.attempts[0]!.rejected[0]!.reasons.includes(reason));
    assert.equal(requests.filter(r => r.role === "student")[1]!.messages.at(-1)?.content, feedback);
    assert.equal(result.calls[1]!.responseFormat?.observed, "truncated");
  }
});
test("ending fixed-test message with a descriptive echo is accepted without rewrite or injection", () => {
  const raw = json("你直接告诉我答案了，谢谢。", ["thanked_after_answer"], true);
  const { result, requests } = exercise(req => transport(req, raw), "zh-CN");
  assert.equal(requests.filter(r => r.role === "student").length, 1);
  assert.equal(result.attempts[0]?.rejected.length, 0);
  assert.equal(result.end.reason, "thanked_after_answer");
  const last = result.transcript.at(-1);
  assert.equal(last?.role, "student");
  assert.ok(last?.role === "student" && !last.injected && last.model?.raw === raw);
});
test("non-ending fixed-test echo still rewrites with localized feedback", () => {
  const { result, requests } = exercise((req, i) => transport(req, i ? done : json("请直接告诉我答案。")), "zh-CN");
  assert.deepEqual(result.attempts[0]?.rejected[0]?.reasons, ["fixed_test_echo"]);
  assert.equal(requests.filter(r => r.role === "student")[1]?.messages.at(-1)?.content, "再写一次");
});
test("non-ending fixed-test output containing the fixed line still rewrites", () => {
  const line = v6().job.asset.card.fixedTest.mustContain.en;
  const { result } = exercise((req, i) => transport(req, i ? done : json(line)));
  assert.ok(result.attempts[0]?.rejected[0]?.reasons.includes("fixed_test_self_written"));
});
test("schema 2 pins protocol while schema 1 remains readable", t => {
  const root = temp(t);
  cpSync(join(dir, "cards"), root, { recursive: true });
  const [old] = loadCards(root);
  assert.ok(old && !old.protocol);
  const lockPath = join(root, "cards.lock.json"), protoPath = join(root, "protocol.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  Object.assign(lock, { schemaVersion: 2, rulesVersion: protocol.rulesVersion, protocol: {
    file: "protocol.json", id: protocol.id, version: protocol.version, hash: protocolHash,
  } });
  writeFileSync(lockPath, JSON.stringify(lock)); writeFileSync(protoPath, JSON.stringify(protocol));
  assert.equal(loadCards(root)[0]?.protocol?.hash, protocolHash);
  writeFileSync(protoPath, JSON.stringify(protocol) + " ");
  assert.throws(() => loadCards(root), /protocol.hash/);
});
function prefixFixture() {
  const { job } = v6();
  const prefix: Probe["prefix"] = [
    { role: "student", text: "Start.", state: { stage: 1, events: [], end: false }, fixed: true },
    { role: "tutor", turn: 1, text: "Consider tiles.", source: "fixture-tutor#1" },
  ];
  const probe = { probeId: "fixture-probe", probeSetVersion: "fixture-probes", protocolVersion: protocol.version,
    prefixHash: hash(JSON.stringify(prefix)), targetStudentMessage: 2, prefix, tutorSource: "fixture-tutor" };
  return { job, probe };
}
test("probe prefix hash, order, history and student-only target", t => {
  const { job, probe } = prefixFixture(), { e } = v6();
  const root = temp(t), path = join(root, "probes.v1.json");
  const rows = [{ probeId: probe.probeId, gate: "key", purpose: "fixture", targetStudentMessage: 2,
    prefix: { en: probe.prefix, "zh-CN": probe.prefix }, prefixHash: localized(probe.prefixHash) }];
  const dump = () => JSON.stringify({ schemaVersion: 1, probeSetVersion: probe.probeSetVersion,
    protocolVersion: protocol.version, rulesVersion: protocol.rulesVersion, probes: rows });
  const exp = { probes: { file: "probes.v1.json", hash: hash(dump()), probeSetVersion: probe.probeSetVersion, gates: { key: [probe.probeId], rest: [] } },
    protocol: { version: protocol.version }, languages: ["en", "zh-CN"] as ("en" | "zh-CN")[] };
  writeFileSync(path, dump());
  const [parsed] = loadProbes(path, exp, job.asset, "key");
  assert.deepEqual(loadProbes(path, exp, job.asset, "diagnostic", [probe.probeId]), [parsed]);
  for (const ids of [[], [probe.probeId, probe.probeId], ["not-in-the-pin"]])
    assert.throws(() => loadProbes(path, exp, job.asset, "diagnostic", ids), /probe\./);
  e.config.kind = "calibration-probe";
  const reqs: Request[] = [];
  const run = runJob(e.config, { ...job, probe: parsed!.en }, new Session(req => {
    reqs.push(req); return transport(req, json("Probe response."));
  }, e.config.prices, 2, 0), e.gitCommit, e.now());
  assert.equal(run.end.reason, "probe_complete");
  assert.deepEqual(run.tutor, { id: probe.tutorSource, provider: "replay" });
  assert.deepEqual(run.transcript.slice(0, 2), probe.prefix.map((line, i) => ({ ...line, i: i + 1, prefix: true })));
  assert.equal(reqs.length, 1); assert.equal(reqs[0]?.role, "student");
  rows[0]!.prefixHash.en = hash("different");
  writeFileSync(path, dump());
  exp.probes.hash = hash(dump());
  assert.throws(() => loadProbes(path, exp, job.asset, "key"), /prefix_hash/);
});
test("transport recovery preserves original charge, rejects auth recovery, and carries shared cap across gates", t => {
  const { store } = storage(t), { e } = v6(), { probe } = prefixFixture();
  const config = e.config;
  const g4Tutors = config.tutors;
  Object.assign(config, { kind: "calibration-probe", tutors: [], budgetUsd: 2, hardCapUsd: 2, languages: ["en"] });
  let calls = 0;
  const execution: Execution = { ...e, mode: "hybrid_calibration", series: { id: "test-series", phase: "G2", priorBatchIds: [] },
    probePlan: { gate: "key", probes: [{ en: probe, "zh-CN": probe }] },
    provider: () => () => { calls++; throw new TransportError("provider_error", false, undefined, undefined, "transport_failure"); } };
  assert.equal(runBatch(store, execution).status, "provider_error");
  const [before] = store.records(config.batchId);
  assert.equal(before!.calls[0]?.transportDiagnostic, "transport_failure");
  const original = JSON.stringify(before);
  execution.provider = () => req => { calls++; return transport(req, done); };
  assert.equal(runBatch(store, execution).status, "provider_error"); assert.equal(calls, 1);
  const recovered = runBatch(store, { ...execution, recoverTransportRunId: before!.runId });
  assert.equal(recovered.status, "complete");
  assert.equal(calls, 2);
  const records = store.records(config.batchId);
  assert.equal(JSON.stringify(records.find(r => r.runId === before!.runId)), original);
  assert.ok(records.some(r => r.restartOf === before!.runId));
  assert.ok(Number(recovered.spentUsd) > before!.usage.totalUsd!);
  assert.throws(() => runBatch(store, { ...execution, recoverTransportRunId: before!.runId }), /transport_recovery/);
  const g2 = config.batchId;
  store.transaction(() => store.batch(g2, { ...recovered, spentUsd: 2 }));
  const g3 = { ...execution, config: { ...config, batchId: "second-gate" },
    series: { id: "test-series", phase: "G3" as const, priorBatchIds: [g2] },
    probePlan: { ...execution.probePlan!, gate: "rest" as const } };
  assert.equal(runBatch(store, g3).status, "budget_stop"); assert.equal(calls, 2);
  assert.throws(() => runBatch(store, { ...g3, config: { ...g3.config, budgetUsd: 3 } }), /series_budget/);
  const { probePlan: _probePlan, ...fullRun } = execution;
  assert.throws(() => runBatch(store, { ...fullRun, config: { ...config, batchId: "third-gate", kind: "calibration", tutors: g4Tutors },
    series: { id: "test-series", phase: "G4", priorBatchIds: [g2, "second-gate"] } }), /series_order/);
  const other = storage(t);
  const auth = { ...execution, provider: () => () => { throw new TransportError("http_401"); } };
  assert.equal(runBatch(other.store, auth).status, "provider_error");
  assert.throws(() => runBatch(other.store, { ...auth, recoverTransportRunId: other.store.records(g2)[0]!.runId }), /transport_recovery/);
});
