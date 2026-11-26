import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runBatch } from "../src/premium/batch.js";
import { fingerprintDistribution } from "../src/premium/check-calibration.js";
import { studentHttp } from "../src/premium/student-http.js";
import { drive, fixture, reply, storage, temp } from "./premium-fixture.js";

const ticks = "\x60\x60\x60";
const wrap = (s: string, tag = "json") => ticks + tag + "\r\n" + s + "\r\n" + ticks;

test("both roles accept one whole fence, retain repair evidence and charge only actual rewrites", () => {
  const clean = drive(), result = drive(base => req => {
    const response = base(req);
    if (req.role !== "tutor") response.text = wrap(response.text, req.role === "student" ? "" : "JSON");
    return response;
  });
  assert.equal(result.schemaVersion, 5);
  assert.equal(result.status, "scored");
  assert.equal(result.calls.length, clean.calls.length);
  assert.equal(result.end.fenceStripped, result.calls.filter(c => c.role === "student").length);
  assert.ok(result.transcript.every(l => l.role !== "student" || !l.checks || (l.checks.fenceStripped && l.checks.regenerated === 0)));
  assert.ok(result.scorings[0]!.perJudge.every(j => j.unwrapped && !j.rejected.length));
  for (const invalid of ["prefix " + wrap("{}"), wrap("{}") + "\n" + wrap("{}"), wrap(wrap("{}")), wrap("{}", "js"), wrap("bad")]) {
    const seen = new Set<string>();
    const repaired = drive(base => req => {
      if ((req.role === "student" || req.model.id === "j2") && !seen.has(req.model.id)) {
        seen.add(req.model.id);
        return reply(invalid, req.model.pinnedVersion);
      }
      return base(req);
    });
    const stripped = invalid === wrap("bad");
    const rejected = repaired.attempts[0]!.rejected[0]!;
    assert.equal(rejected.text, invalid);
    assert.equal(!!rejected.fenceStripped, stripped);
    assert.equal(repaired.end.fenceStripped, Number(stripped));
    assert.equal(repaired.calls.length, clean.calls.length + 2);
    const judge = repaired.scorings[0]!.perJudge[1]!;
    assert.equal(repaired.status, "scored");
    assert.equal(judge.unwrapped, false);
    assert.equal(judge.rejected[0]!.unwrapped, stripped);
    assert.equal(judge.rejected[0]!.raw, invalid);
  }
});

test("identity receipts distinguish literal responses, missing fields, and multiple fingerprints in one conversation", async () => {
  const { e } = fixture();
  const req = { role: "student" as const, model: { ...e.config.student, provider: "deepseek" },
    system: "fixture", messages: [], params: { temperature: 0.7, maxOutputTokens: 512 } };
  const { reply: received } = await studentHttp(req, "fixture", async () => Response.json({
    model: "alias", system_fingerprint: "fp A", choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
  assert.equal(received?.system_fingerprint, "fp A");
  let count = 0;
  const run = drive(base => request => {
    const res = base(request);
    if (request.role === "student") Object.assign(res, { returnedModel: res.resolvedModel, system_fingerprint: ++count === 1 ? "fp A" : "fp B" });
    return res;
  });
  const missing = drive();
  assert.ok(missing.calls.every(c => c.system_fingerprint === null));
  for (const c of run.calls) {
    assert.ok(Number.isFinite(Date.parse(c.calledAt)));
    if (c.role === "student") {
      assert.equal(c.requestedModel, e.config.student.requestedModel);
      assert.equal(c.returnedModel, e.config.student.pinnedVersion);
    }
  }
  assert.deepEqual(fingerprintDistribution([run, { ...missing, restartOf: run.runId, runId: "replacement" }]), [
    { system_fingerprint: null, conversations: 1, adopted: 1, superseded: 0 },
    ...["fp A", "fp B"].map(system_fingerprint => ({ system_fingerprint, conversations: 1, adopted: 0, superseded: 1 })),
  ]);
});

test("serving identity requires literal receipts and evidence for revisions, and DeepSeek calibration uses an alias", t => {
  for (const tier of ["alias", "revision"] as const) {
    const { e } = fixture(), { store } = storage(t);
    e.config.kind = "calibration";
    e.config.servingIdentity = tier;
    if (tier === "revision") {
      assert.throws(() => runBatch(store, e), /revision_evidence/);
      e.config.identityEvidence = { url: "https://example.test/fixed", retrievedAt: "2026-01-01", quote: "Fixed synthetic snapshot" };
    }
    const base = e.provider;
    e.provider = job => {
      const provider = base(job);
      return req => { const r = provider(req); return { ...r, returnedModel: r.resolvedModel }; };
    };
    assert.equal(runBatch(store, e).servingIdentity, tier);
    e.config.batchId += "-missing";
    e.provider = job => {
      const provider = base(job);
      return req => ({ ...provider(req), returnedModel: null });
    };
    assert.equal(runBatch(store, e).servingIdentity, "unknown");
    e.config.student.provider = "deepseek";
    e.config.batchId += "-live";
    if (tier === "revision") assert.throws(() => runBatch(store, { ...e, mode: "hybrid_calibration" }), /calibration.servingIdentity/);
  }
});

test("checker CLI retains 0/1/2 and rejects scored calibration, failed dry-run optional group and cross-job restarts", t => {
  const root = temp(t), record = drive();
  Object.assign(record, { batchKind: "calibration", status: "unscored", scorings: [] });
  const exp = join(root, "expect.json"), checker = join(root, "reference.py"), batch = record.batchId;
  const json = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value));
  mkdirSync(join(root, "batches")); mkdirSync(join(root, "records"));
  const recPath = (id: string) => join(root, "records", id + ".json");
  json(join(root, "batches", batch + ".json"), { repeats: 1, tutors: [{ id: "required" }, { id: "extra" }] });
  const expectations = { schemaVersion: 2, rulesVersion: record.card.rulesVersion, plannedGroups: ["required"], optionalGroups: ["extra"] };
  // 独立的合成子进程只模拟 v2 的退出码和报告，正式协议阈值由私有脚本验收。
  writeFileSync(checker, `import json, sys
with open(sys.argv[2]) as f: e=json.load(f)
code=e.get("exit",0)
if code != 2:
    report=dict(checkerVersion=2,batchId=sys.argv[sys.argv.index("--batch-id")+1],dryRun=True,
                verdict="FAIL" if code else "PASS",cohortErrors=[],groups=[{"pass":True},{"pass": e.get("extraPass",True)}])
    with open(sys.argv[sys.argv.index("--report")+1],"w") as f: json.dump(report,f)
sys.exit(code)
`);
  const check = (status: number, options: object = {}) => {
    json(exp, { ...expectations, ...options });
    const result = spawnSync(process.execPath, ["dist/src/cli/premium.js", "check-calibration", "--dry-run",
      "--checker", checker, "--expectations", exp, "--out", root, "--batch-id", batch], { encoding: "utf8" });
    assert.equal(result.status, status, result.stdout + result.stderr);
    const report = JSON.parse(readFileSync(join(root, "calibration-report-" + batch + ".json"), "utf8"));
    assert.equal(report.verdict, ["PASS", "FAIL", "CANNOT_CHECK"][status]);
  };
  json(recPath(record.runId), record);
  check(0); check(1, { extraPass: false }); check(1, { exit: 1 }); check(2, { exit: 2 });
  for (const change of [{ status: "scored" }, { scorings: [{}] }]) {
    json(recPath(record.runId), { ...record, ...change }); check(1);
  }
  json(recPath(record.runId), { ...record, status: "error" });
  const next = { ...record, runId: "next", restartOf: record.runId };
  json(recPath(next.runId), next); check(0);
  for (const change of [{ tutor: { ...record.tutor, id: "other" } }, { repeat: { index: 2 } },
    ...[{ id: "other" }, { version: "2" }, { lang: "zh-CN" }, { rulesVersion: "other" }, { hash: "other", contentHash: "other" }]
      .map(override => ({ card: { ...record.card, ...override } }))]) {
    json(recPath(next.runId), { ...next, ...change }); check(1);
  }
});
