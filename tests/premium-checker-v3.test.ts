import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { checkCalibrationV3, finalCalibration } from "../src/premium/check-calibration.js";
import { temp } from "./premium-fixture.js";

const languages = ["en", "zh-CN"], repeats = 5;
const card = { id: "fixture-card", version: "2", contentHash: "sha256:fixture", leaveNotBefore: 4 };
const pins = { card, rulesVersion: "2", protocolHash: "fixture-protocol", tapeHash: "fixture-tape", probesHash: "fixture-probes" };
const expectations = { schemaVersion: 3, card, rulesVersion: pins.rulesVersion, languages, repeats, plannedGroups: ["teacher"], optionalGroups: [],
  protocol: { file: "protocol.json", hash: pins.protocolHash, version: "2" }, tape: { file: "tape.json", hash: pins.tapeHash },
  probes: { file: "probes.json", probeSetVersion: "2", hash: pins.probesHash, gates: { key: ["probe-key"], rest: ["probe-rest"] } } };
const batchId = "synthetic-checker-batch";
const report = { checkerVersion: 3, batchId, batchKind: "calibration-probe", gate: "key", pins,
  machineVerdict: "PASS", verdict: "PENDING_REVIEW", cohortErrors: [], humanReviewPending: true,
  groups: languages.map(lang => ({ probeId: "probe-key", lang, runs: repeats, optional: false })),
  runs: languages.flatMap(lang => Array.from({ length: repeats }, (_, i) => ({
    runId: lang + "-" + (i + 1), probeId: "probe-key", lang, repeat: i + 1,
  }))),
};
function setup(t: TestContext) {
  const root = temp(t), checker = join(root, "checker.py"), exp = join(root, "expectations.json"), raw = join(root, "raw.json"),
    review = join(root, "review.json");
  const put = (file: string, x: unknown) => writeFileSync(file, JSON.stringify(x));
  put(raw, report); put(exp, expectations);
  put(review, { batchId, schemaVersion: 1, status: "complete", items: [] });
  put(join(root, "unused.json"), {});
  mkdirSync(join(root, "batches"));
  mkdirSync(join(root, "records"));
  put(join(root, "batches", batchId + ".json"), { batchId, kind: "calibration-probe", gate: "key" });
  // 子进程故意模拟可错误放行的上游，而不是在测试里复制包装器。
  writeFileSync(checker, `import json, pathlib, sys
if sys.argv[1] == "check":
    p = pathlib.Path(sys.argv[2]) / "raw.json"
    r = json.loads(p.read_text(encoding="utf-8"))
    code = 0
    target = "--report"
else:
    closed = "--review" in sys.argv
    r = {"checkerVersion": 3, "scope": "G2", "verdict": "PASS" if closed else "PENDING_REVIEW"}
    code = 0 if closed else 3
    target = "--out"
pathlib.Path(sys.argv[sys.argv.index(target)+1]).write_text(json.dumps(r), encoding="utf-8")
sys.exit(code)
`);
  const final = () => finalCalibration(checker, exp, "G2", [raw], [review]);
  const check = () => checkCalibrationV3(root, checker, exp, batchId, root, root);
  const record = { schemaVersion: 6, batchId, batchKind: report.batchKind, runId: "r1", status: "unscored", scorings: [],
    card: { ...card, lang: "en", rulesVersion: pins.rulesVersion, protocolVersion: "2", protocolHash: pins.protocolHash },
    probe: { probeId: "probe-key", prefixHash: "fixture" }, tutor: { id: "replay" }, repeat: { index: 1 },
    student: { responseFormat: { type: "json_object" }, thinking: "disabled", params: { temperature: 0.7, maxOutputTokens: 512 } },
    calls: [], };
  const putRecord = (r: { runId: string }) => put(join(root, "records", r.runId + ".json"), r);
  putRecord(record);
  return { checker, exp, raw, put, record, putRecord, check, final };
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
