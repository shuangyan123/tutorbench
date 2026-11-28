import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { checkCalibrationV3, finalCalibration } from "../src/premium/check-calibration.js";
import { hash } from "../src/premium/cards.js";
import { studentRequestParametersHash } from "../src/premium/student-http.js";
import { inferenceUsage, readStudentInference, type Call, type StudentInference } from "../src/premium/provider.js";
import { temp } from "./premium-fixture.js";

const languages = ["en", "zh-CN"], repeats = 5;
const card = { id: "fixture-card", version: "2", contentHash: "sha256:fixture", leaveNotBefore: 4 };
const pins = { card, rulesVersion: "2", protocolHash: "fixture-protocol", tapeHash: "fixture-tape", probesHash: "fixture-probes" };
const expectations = { schemaVersion: 3, card, rulesVersion: pins.rulesVersion, languages, repeats, plannedGroups: ["teacher"], optionalGroups: [],
  protocol: { file: "protocol.json", hash: pins.protocolHash, version: "2" }, tape: { file: "tape.json", hash: pins.tapeHash },
  probes: { file: "probes.json", probeSetVersion: "2", hash: pins.probesHash, gates: { key: ["probe-key"], rest: ["probe-rest"] } } };
const batchId = "synthetic-checker-batch";
const student = { id: "learner", label: undefined, developer: "deepseek", provider: "deepseek", requestedModel: "deepseek-flash", pinnedVersion: "fixture-pin" };
const report = { checkerVersion: 3, batchId, batchKind: "calibration-probe", gate: "key", pins,
  machineVerdict: "PASS", verdict: "PENDING_REVIEW", cohortErrors: [], humanReviewPending: true,
  groups: languages.map(lang => ({ probeId: "probe-key", lang, runs: repeats, optional: false })),
  runs: languages.flatMap(lang => Array.from({ length: repeats }, (_, i) => ({
    runId: lang + "-" + (i + 1), probeId: "probe-key", lang, repeat: i + 1,
  }))),
};
function setup(t: TestContext, diagnostic = false) {
  const root = temp(t), checker = join(root, "checker.py"), exp = join(root, "expectations.json"), raw = join(root, "raw.json"),
    review = join(root, "review.json");
  const put = (file: string, x: unknown) => writeFileSync(file, JSON.stringify(x));
  const current = diagnostic ? { ...report, gate: "diagnostic", verdict: "DIAGNOSTIC", checkerRevision: "3.1.0", diagnostic: true } : report;
  put(raw, current); put(exp, expectations);
  put(review, { batchId, schemaVersion: 1, status: "complete", items: [] });
  put(join(root, "unused.json"), {});
  mkdirSync(join(root, "batches"));
  mkdirSync(join(root, "records"));
  const putBatch = (fields: object) => put(join(root, "batches", batchId + ".json"), { batchId, kind: "calibration-probe", gate: current.gate, ...fields });
  putBatch({});
  // 子进程故意模拟可错误放行的上游，而不是在测试里复制包装器。
  writeFileSync(checker, `import json, pathlib, sys
if sys.argv[1] == "check":
    p = pathlib.Path(sys.argv[2]) / "raw.json"
    r = json.loads(p.read_text(encoding="utf-8"))
    code = r.pop("fixtureExit", 1 if r["machineVerdict"] == "FAIL" else 0)
    target = "--report"
else:
    closed = "--review" in sys.argv
    r = {"checkerVersion": 3, "scope": "G2", "verdict": "PASS" if closed else "PENDING_REVIEW"}
    code = 0 if closed else 3
    target = "--out"
pathlib.Path(sys.argv[sys.argv.index(target)+1]).write_text(json.dumps(r), encoding="utf-8")
sys.exit(code)
`);
  const final = (inference?: StudentInference) => finalCalibration(checker, exp, "G2", [raw], [review], inference ? { student, studentInference: inference } : undefined);
  const check = (inference?: StudentInference) => checkCalibrationV3(root, checker, exp, batchId, root, root, inference ? { student, studentInference: inference } : undefined);
  const record = { schemaVersion: 6, batchId, batchKind: report.batchKind, runId: "r1", status: "unscored", scorings: [],
    card: { ...card, lang: "en", rulesVersion: pins.rulesVersion, protocolVersion: "2", protocolHash: pins.protocolHash },
    probe: { probeId: "probe-key", prefixHash: "fixture" }, tutor: { id: "replay" }, repeat: { index: 1 },
    student: { responseFormat: { type: "json_object" }, thinking: "disabled", params: { temperature: 0.7, maxOutputTokens: 512 } },
    calls: [], };
  const putRecord = (r: { runId: string }) => put(join(root, "records", r.runId + ".json"), r);
  putRecord(record);
  return { checker, exp, raw, put, current, record, putRecord, putBatch, check, final };
}
test("v3 final fails verdict FAIL even with machine PASS", t => {
  const f = setup(t);
  f.put(f.raw, { ...report, verdict: "FAIL" });
  assert.equal(f.final().status, 1);
});
test("v3 final fails retained cohort errors", t => {
  const f = setup(t);
  f.put(f.raw, { ...report, cohortErrors: ["fixture defect"] });
  assert.equal(f.final().status, 1);
});
test("v3 final compares pins against expectations", t => {
  const f = setup(t);
  f.put(f.raw, { ...report, pins: { ...pins, protocolHash: "tampered" } });
  assert.equal(f.final().status, 1);
});
test("v3 final refuses empty runs or empty groups", t => {
  const f = setup(t);
  for (const key of ["runs", "groups"]) {
    f.put(f.raw, { ...report, [key]: [] });
    assert.equal(f.final().status, 1);
  }
});
test("v3 checker rejects drifted student request parameters", t => {
  const f = setup(t);
  assert.equal(f.check().status, 0);
  for (const student of [
    { ...f.record.student, thinking: "enabled" },
    { ...f.record.student, responseFormat: { type: "text" } },
    { ...f.record.student, params: { ...f.record.student.params, temperature: 0.4 } },
    { ...f.record.student, params: { ...f.record.student.params, maxOutputTokens: 513 } },
  ]) {
    f.putRecord({ ...f.record, student } as typeof f.record);
    const result = f.check();
    assert.equal(result.status, 1); assert.equal(result.report.verdict, "FAIL");
  }
});
test("v3 checker rejects scorings on a probe or full calibration record", t => {
  const f = setup(t);
  f.putRecord({ ...f.record, scorings: [{ score: 1 }] } as { runId: string });
  assert.equal(f.check().status, 1);
});
test("v3 checker rejects cross-task restart even from an error", t => {
  const f = setup(t);
  f.putRecord({ ...f.record, status: "error" } as typeof f.record);
  const next = { ...f.record, runId: "r2", restartOf: f.record.runId };
  f.putRecord({ ...next, tutor: { id: "wrong-source" } } as typeof next);
  assert.equal(f.check().status, 1);
  f.putRecord(next);
  assert.equal(f.check().status, 0);
  f.putRecord({ ...next, repeat: { index: 2 } } as typeof next);
  assert.equal(f.check().status, 1);
});
test("v3 check keeps PENDING_REVIEW; final returns 0, 1, or 3, and unavailable check returns 2", t => {
  const f = setup(t);
  const check = f.check();
  assert.equal(check.status, 0);
  assert.equal(check.report.verdict, "PENDING_REVIEW");
  assert.equal("humanReviewPending" in check.report && check.report.humanReviewPending, true);
  assert.equal(f.final().status, 0);
  assert.equal(finalCalibration(f.checker, f.exp, "G2", [f.raw], []).status, 3);
  writeFileSync(f.checker, "raise SystemExit(2)\n");
  assert.equal(f.check().status, 2);
});

test("diagnostic verdict alone cannot pass: machine, cohort and checker exit must agree", t => {
  const f = setup(t, true);
  const diagnostic = f.current;
  const verify = (patch: object, status: number) => {
    f.put(f.raw, { ...diagnostic, ...patch });
    const check = f.check();
    assert.equal(check.status, status);
    if (status !== 2) assert.equal(check.report.verdict, "DIAGNOSTIC");
  };
  verify({}, 0);
  verify({ machineVerdict: "FAIL" }, 1);
  verify({ cohortErrors: ["fixture defect"] }, 1);
  verify({ fixtureExit: 1 }, 2);
  verify({ fixtureExit: 2 }, 2);
  f.putRecord({ ...f.record, scorings: [{}] } as { runId: string });
  verify({}, 1);
});
test("diagnostic checker binds the authorized inference profile to the batch, records, and individual calls", t => {
  const f = setup(t, true);
  const profile = readStudentInference({ thinking: "enabled", reasoningEffort: "high", maxOutputTokens: 8192 }, "test");
  const call = { studentInference: profile, role: "student", truncated: true, finishReason: "length",
    requestHash: "sha256:" + "a".repeat(64), historyHash: "sha256:" + "b".repeat(64),
    responseFormat: { requested: "json_object", observed: "truncated" }, usd: 0,
    usage: { inputTokens: 3, outputTokens: 100, reasoningTokens: 90, visibleOutputTokens: 10 } } as Call;
  const record = { ...f.record, student: { ...f.record.student, thinking: "enabled",
    studentInference: profile, params: { maxOutputTokens: 8192 } }, calls: [call] };
  f.putRecord(record);
  f.putBatch({ studentInference: profile, inferenceUsage: inferenceUsage([call]) });
  assert.equal(f.check(profile).status, 0);
  assert.equal(f.check().status, 1);
  for (const replacement of [{ studentInference: { ...profile, reasoningEffort: "max" } }, { truncated: false },
    { usage: { ...call.usage, visibleOutputTokens: 100 } }]) {
    f.putRecord({ ...record, calls: [{ ...call, ...replacement }] } as { runId: string });
    assert.equal(f.check(profile).status, 1);
  }
});
test("formal High checker verifies actual wire receipts and propagates the authorized identity into final reports", t => {
  const f = setup(t);
  const profile = readStudentInference({ thinking: "enabled", reasoningEffort: "high", maxOutputTokens: 8192 }, "test");
  const responseFormat = { type: "json_object" } as const;
  const params = { maxOutputTokens: 8192 };
  const requestParametersHash = studentRequestParametersHash({ model: student, studentInference: profile, params, responseFormat });
  const call = { studentInference: profile, role: "student", model: student.id, requestedModel: student.requestedModel,
    requestHash: "sha256:" + "a".repeat(64), historyHash: "sha256:" + "b".repeat(64),
    requestParametersHash, truncated: false, finishReason: "stop", responseFormat: { requested: "json_object", observed: "json" },
    usd: 0.001, usage: { inputTokens: 3000, outputTokens: 100, reasoningTokens: 90, visibleOutputTokens: 10 } } as Call;
  const record = { ...f.record, student: { ...student, thinking: "enabled", studentInference: profile, params, responseFormat }, calls: [call] };
  f.putRecord(record);
  const calibrationSeries = hash(JSON.stringify(pins));
  f.putBatch({ phase: "G2", calibrationSeries, student, studentInference: profile, inferenceUsage: inferenceUsage([call]) });
  const checked = f.check(profile);
  assert.equal(checked.status, 0);
  f.put(f.raw, checked.report);
  assert.equal(f.final().status, 1);
  assert.equal(f.final({ ...profile, reasoningEffort: "low" }).status, 1);
  assert.equal(f.final(profile).status, 0);
  assert.equal(f.final(profile).report.requestParametersHash, requestParametersHash);
  for (const drift of [{ requestParametersHash: "sha256:" + "f".repeat(64) }, { requestedModel: "different" }]) {
    f.putRecord({ ...record, calls: [{ ...call, ...drift }] } as { runId: string });
    assert.equal(f.check(profile).status, 1);
  }
  f.put(f.raw, { ...checked.report, diagnostic: true });
  assert.equal(f.final(profile).status, 1);
});
test("diagnostic reports are excluded by label, gate and diagnostic flag", t => {
  const f = setup(t, true);
  assert.equal(f.final().status, 1);
  for (const flags of [{ diagnostic: true }, { gate: "diagnostic" }, { verdict: "DIAGNOSTIC" }]) {
    f.put(f.raw, { ...report, ...flags, checkerRevision: "3.1.0" });
    assert.equal(f.final().status, 1);
  }
});
