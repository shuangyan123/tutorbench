import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rejudge, runBatch, type Execution } from "../src/premium/batch.js";
import { hash } from "../src/premium/cards.js";
import { configSchema, Session, type Request } from "../src/premium/provider.js";
import { indexRow, runJob } from "../src/premium/runner.js";
import { rebuildIndex } from "../src/premium/store.js";
import { fixture, storage } from "./premium-fixture.js";

const prompt = { id: "tile-coach", version: "v1", text: { "zh-CN": "请比较两种瓷砖。", en: "Compare the tiles." } };
// 取自 23cb0a5 在未配置 prompt/params 时对原合成双语 tape 的实际请求。
const baseline = {
  en: ["4f6f9183198d4ff660d96f998ede07ca8968a43a5c08046d5683e455193bcb67", "3a3ad10090efa35d2a35f0c1838ea0d79323bdb01a590cc33b75762557eb26f2"],
  "zh-CN": ["73b66bee1c9ab11f629addc454ea1b9b775aff174ee0208004b7d11a4eb0bf14", "b80fb50645986785f5b59cadbfde097a355671a5b087da7b31f2efc571b610bd"],
};

function capture(lang: "en" | "zh-CN", options: object) {
  const { e, job } = fixture();
  const config = configSchema({ ...e.config, tutors: [{ ...job.tutor, ...options }] }, "config");
  const current = { ...job, lang, tutor: config.tutors[0]! };
  const requests: Request[] = [], provider = e.provider(current);
  const session = new Session(req => { requests.push(req); return provider(req); }, config.prices, 1, 0);
  const record = runJob(config, current, session, e.gitCommit, e.now());
  assert.equal(record.status, "scored");
  return { record, requests };
}

test("default tutor preserves both localized request hashes, the transcript and null prompt identities", () => {
  for (const lang of ["en", "zh-CN"] as const) {
    const { record, requests } = capture(lang, {});
    const explicit = capture(lang, { params: { maxOutputTokens: 2048, temperature: null } });
    const transcriptHash = lang === "en" ? "e811fcafe65c1124d94f04fea613c7d64c5e13bd42cab1867ef83031ff5dd40c" :
      "4ba58cdb8dfb92aaab776b69736080a9656608f4168a8e78fd9d062045c16181";
    assert.equal(hash(JSON.stringify(record.transcript)), "sha256:" + transcriptHash);
    assert.deepEqual(record.transcript, explicit.record.transcript);
    assert.deepEqual(requests, explicit.requests);
    assert.equal(record.tutor.systemPrompt, fixture().job.asset.card.tutorSetup[lang]);
    assert.deepEqual(record.calls.filter(c => c.role === "tutor").map(c => c.requestHash), baseline[lang].map(s => "sha256:" + s));
    assert.deepEqual(record.tutor.params, { temperature: null, maxOutputTokens: 2048 });
    assert.deepEqual([record.tutor.tutorPromptId, record.tutor.tutorPromptVersion, record.tutor.tutorPromptHash], [null, null, null]);
  }
});

test("one bilingual prompt fingerprint, exact localized tutor requests and isolated Judge and student inputs", () => {
  const canonical = '{"id":"tile-coach","text":{"en":"Compare the tiles.","zh-CN":"请比较两种瓷砖。"},"version":"v1"}';
  const localizedHashes: string[] = [];
  for (const lang of ["en", "zh-CN"] as const) {
    const setup = fixture().job.asset.card.tutorSetup[lang];
    const system = prompt.text[lang] + "\n\n" + setup;
    const { record, requests } = capture(lang, { prompt, params: { maxOutputTokens: 333, temperature: 0 } });
    assert.equal(record.schemaVersion, 5);
    assert.equal(record.tutor.systemPrompt, system);
    assert.equal(record.tutor.promptHash, hash(system));
    assert.equal(record.tutor.tutorPromptHash, hash(canonical));
    assert.ok(!("prompt" in record.tutor));
    localizedHashes.push(record.tutor.promptHash);
    const row = indexRow(record);
    assert.equal(row.tutorPromptId, prompt.id); assert.equal(row.tutorPromptVersion, prompt.version);
    const control = capture(lang, {});
    for (const [i, req] of requests.entries()) {
      if (req.role === "tutor") {
        assert.equal(req.system, system);
        assert.equal(JSON.stringify(req.params), '{"temperature":0,"maxOutputTokens":333}');
        assert.deepEqual(req.params, record.tutor.params);
        assert.deepEqual(req.model, control.requests[i]!.model);
      } else assert.deepEqual(req, control.requests[i]);
    }
    assert.notEqual(record.calls[0]?.requestHash, control.record.calls[0]?.requestHash);
  }
  assert.notEqual(localizedHashes[0], localizedHashes[1]);
  const changed = capture("en", { prompt: { ...prompt, text: { ...prompt.text, "zh-CN": prompt.text["zh-CN"] + "！" } } });
  assert.notEqual(changed.record.tutor.tutorPromptHash, hash(canonical));
  assert.equal(changed.record.tutor.promptHash, localizedHashes[0]);
  const partial = capture("en", { params: { temperature: 0.3 } });
  assert.deepEqual(partial.record.tutor.params, { temperature: 0.3, maxOutputTokens: 2048 });
  assert.equal(partial.record.tutor.tutorPromptHash, null);
});

test("invalid tutor-only config fails validation before a provider is needed", () => {
  const { e, job } = fixture();
  for (const options of [{ prompt: { ...prompt, id: "" } }, { prompt: { ...prompt, version: " " } },
    ...[{ en: "English" }, { "zh-CN": "中文" }, { en: "", "zh-CN": "中文" }].map(text => ({ prompt: { ...prompt, text } })),
    { params: { maxOutputTokens: 0 } }, { params: { maxOutputTokens: 1.5 } }, { params: { temperature: "0.3" } }]) {
    assert.throws(() => configSchema({ ...e.config, tutors: [{ ...job.tutor, ...options }] }, "config"), /config.tutors/);
  }
  assert.throws(() => configSchema({ ...e.config, student: { ...e.config.student, prompt } }, "config"), /unexpected_field/);
});

test("batch persists only prompt metadata, binds versions across batches and checks effective params on resume and rejudge", t => {
  const { store } = storage(t), { e, job } = fixture();
  const model = JSON.parse(JSON.stringify(job.tutor));
  job.tutor.prompt = structuredClone(prompt);
  job.tutor.params = { temperature: 0.3, maxOutputTokens: 400 };
  const batch = runBatch(store, e);
  const record = store.records(e.config.batchId)[0]!;
  assert.deepEqual(batch.tutors, [{ ...model, prompt: { id: prompt.id, version: prompt.version, hash: record.tutor.tutorPromptHash },
    params: { temperature: 0.3, maxOutputTokens: 400 } }]);
  assert.ok(!JSON.stringify(batch).includes(prompt.text.en));
  assert.equal(rejudge(store, e, record.runId), "s2");
  const reversed = { ...prompt, text: { en: prompt.text.en, "zh-CN": prompt.text["zh-CN"] } };
  job.tutor.prompt = reversed;
  job.tutor.params = { maxOutputTokens: 400, temperature: 0.3 };
  const noCalls = { ...e, provider: () => { throw new Error("unexpected dispatch"); } };
  assert.equal(runBatch(store, noCalls).status, "complete");
  job.tutor.params.temperature = 0.4;
  assert.throws(() => runBatch(store, noCalls), /drift: batch/);
  assert.throws(() => rejudge(store, noCalls, record.runId), /identity\/budget/);
  e.config.batchId += "-new";
  job.tutor.prompt.text.en += "!";
  assert.throws(() => runBatch(store, noCalls), /drift: tutor-prompt/);
  job.tutor.prompt.version = "v2";
  assert.equal(runBatch(store, e).status, "complete");
});

test("legacy v1 through v4 records rebuild a stable index, retaining v3 prompt identity", t => {
  const { root } = storage(t);
  for (const version of [1, 2, 3, 4]) {
    const { record } = capture("en", version >= 3 ? { prompt } : {});
    const old = JSON.parse(JSON.stringify(record, (key, value) =>
      (key === "cache" || (version < 4 && ["calledAt", "returnedModel", "system_fingerprint", "fenceStripped", "unwrapped"].includes(key))) ? undefined : value));
    old.runId = "legacy-" + version; old.schemaVersion = version;
    if (version < 3) for (const key of ["tutorPromptId", "tutorPromptVersion", "tutorPromptHash"]) delete old.tutor[key];
    if (version === 1) { delete old.batchKind; delete old.card.hash; }
    writeFileSync(join(root, "records", old.runId + ".json"), JSON.stringify(old));
  }
  const rows = () => readFileSync(join(root, "index.jsonl"), "utf8");
  assert.equal(rebuildIndex(root), 4);
  const original = rows();
  for (const line of original.trim().split("\n")) {
    const row = JSON.parse(line);
    assert.equal(row.tutorPromptId, ["legacy-3", "legacy-4"].includes(row.runId) ? prompt.id : null);
    assert.equal(row.tutorPromptVersion, ["legacy-3", "legacy-4"].includes(row.runId) ? prompt.version : null);
    assert.equal(row.verdict, "good");
  }
  rebuildIndex(root); assert.equal(rows(), original);
});

test("hybrid model-version drift survives equal or exceeded budget, restart and explicit top-up", t => {
  for (const billed of [1, 2]) {
    const { store } = storage(t), { e } = fixture();
    e.config.kind = "calibration";
    e.config.budgetUsd = 1;
    let dispatches = 0;
    const hybrid: Execution = { ...e, mode: "hybrid_calibration", provider: job => {
      const base = e.provider(job);
      return req => {
        dispatches++;
        const r = base(req);
        return req.role === "student" ? { ...r, resolvedModel: "changed", usage: { inputTokens: billed * 1_000_000, outputTokens: 0 } } :
          { ...r, usage: { inputTokens: 0, outputTokens: 0 } };
      };
    } };
    const batch = runBatch(store, hybrid);
    assert.equal(batch.status, "model_version_drift");
    assert.equal(batch.spentUsd, billed);
    assert.equal(batch.budgetStopReason, billed === 1 ? "budget_stop" : "actual_over_budget");
    assert.equal(dispatches, 2);
    // 模拟旧版本导出的遮蔽状态，底层原始记录仍记录版本漂移。
    store.transaction(() => store.batch(e.config.batchId, { ...batch, status: batch.budgetStopReason }));
    e.config.budgetUsd = 3;
    assert.throws(() => runBatch(store, { ...hybrid, topUp: true }), /budget.top_up/);
    e.config.budgetUsd = 1;
    assert.equal(runBatch(store, hybrid).status, "model_version_drift");
    assert.equal(dispatches, 2); assert.equal(store.records(e.config.batchId).length, 1);
  }
});
