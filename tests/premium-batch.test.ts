import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runBatch, rejudge } from "../src/premium/batch.js";
import { rebuildIndex, safeJson, Store } from "../src/premium/store.js";
import { fixture, storage } from "./premium-fixture.js";

test("interrupted batch resumes once at committed run boundaries and rejects drift", t => {
  const { root, store } = storage(t), { e } = fixture();
  let started = 0;
  const interrupted = { ...e, provider: (job: Parameters<typeof e.provider>[0]) => {
    if (++started === 2) throw new Error("interruption");
    return e.provider(job);
  } };
  assert.throws(() => runBatch(store, interrupted), /interruption/);
  assert.equal(store.records(e.config.batchId).length, 1);
  const second = new Store(root);
  try {
    let resumed = 0;
    const execution = { ...e, provider: (j: Parameters<typeof e.provider>[0]) => { resumed++; return e.provider(j); } };
    assert.equal(runBatch(second, execution).status, "complete");
    runBatch(store, execution);
    assert.equal(resumed, 1);
    assert.equal(store.records(e.config.batchId).length, 2);
    assert.throws(() => runBatch(second, { ...e, tapeHash: "other" }), /drift/);
    assert.throws(() => runBatch(second, { ...e, gitCommit: "b".repeat(40) }), /drift/);
    e.config.repeats++;
    assert.throws(() => runBatch(second, e), /drift/);
  } finally { second.close(); }
});
test("append-only scoring keeps original content and prices, index rebuild is byte-stable", t => {
  const { root, store } = storage(t), { e } = fixture();
  runBatch(store, e);
  const original = store.records(e.config.batchId)[0]!;
  e.config.judgeConfigVersion = "synthetic-panel-v2";
  assert.equal(rejudge(store, e, original.runId), "s2");
  const updated = JSON.parse(readFileSync(join(root, "records", original.runId + ".json"), "utf8"));
  assert.deepEqual({ ...updated, scorings: updated.scorings.slice(0, 1) }, original);
  assert.equal(updated.scorings[1].judgeConfig.version, e.config.judgeConfigVersion);
  const index = readFileSync(join(root, "index.jsonl"), "utf8");
  const row = index.trim().split("\n").map(l => JSON.parse(l)).find(r => r.runId === original.runId);
  assert.equal(row.scoringId, "s2");
  assert.equal(original.usage.totalUsd, 0.00014);
  assert.equal(updated.scorings[1].usage.totalUsd, 0.00006);
  assert.equal(row.usd, 0.0002);
  assert.equal(rebuildIndex(root), 2);
  assert.equal(readFileSync(join(root, "index.jsonl"), "utf8"), index);
  assert.doesNotMatch(safeJson(updated), /authorization|sk-|headers/iu);
  assert.throws(() => safeJson({ apiKey: "private" }), /Sensitive/);
});
test("exactly exhausted budget bills the final call without a floating-point overrun", t => {
  const { store } = storage(t), { e } = fixture();
  e.config.budgetUsd = 0.00028;
  e.config.reserveUsd = 0.00002;
  const result = runBatch(store, e);
  assert.equal(result.spentUsd, 0.00028);
  assert.equal(result.status, "budget_stop");
  assert.ok(store.records(e.config.batchId).every(r => r.status === "scored"));
});
test("unknown price, missing usage, reservation and actual overrun stop new calls", t => {
  for (const mode of ["price", "usage", "reserve", "overrun"]) {
    const { store } = storage(t), { e } = fixture();
    if (mode === "price") e.config.prices.inputUsdPerMillion = null;
    if (mode === "reserve") e.config.budgetUsd = 0.001;
    const originalProvider = e.provider;
    let calls = 0;
    e.provider = j => {
      const base = originalProvider(j);
      return req => {
        calls++;
        const r = base(req);
        if (mode === "usage") r.usage = null;
        if (mode === "overrun") r.usage = { inputTokens: 2_000_000, outputTokens: 1 };
        return r;
      };
    };
    const batch = runBatch(store, e);
    assert.equal(batch.status, mode === "overrun" ? "actual_over_budget" : mode === "reserve" ? "budget_stop" : "unknown_cost");
    assert.equal(calls, ["usage", "overrun"].includes(mode) ? 1 : 0);
    if (mode === "usage") assert.equal(batch.spentUsd, null);
    runBatch(store, e);
    assert.equal(calls, ["usage", "overrun"].includes(mode) ? 1 : 0);
  }
});
