import assert from "node:assert/strict";
import { test } from "node:test";
import { runBatch, rejudge } from "../src/premium/batch.js";
import { childEnvironment } from "../src/premium/child-environment.js";
import { batchCache } from "../src/premium/cache-summary.js";
import { Session, type Request, type Reply } from "../src/premium/provider.js";
import { studentHttp, studentPayload } from "../src/premium/student-http.js";
import { drive, fixture, reply, storage } from "./premium-fixture.js";

test("local helpers receive no provider keys and the HTTP worker receives only its assigned key", () => {
  const source = { PATH: "fixture", DEEPSEEK_API_KEY: "fixture-a", OPENAI_API_KEY: "fixture-b", NODE_OPTIONS: "fixture-option" };
  assert.deepEqual(childEnvironment("local", source), { PATH: "fixture" });
  assert.deepEqual(childEnvironment("deepseek", source), { PATH: "fixture", DEEPSEEK_API_KEY: "fixture-a" });
  assert.equal(source.OPENAI_API_KEY, "fixture-b");
});

test("DeepSeek projects cache usage from the response only and preserves the sent payload", async () => {
  const { e } = fixture();
  const req: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" }, system: "system",
    messages: [{ role: "user", content: "unchanged" }], params: { temperature: 0.7, maxOutputTokens: 512 } };
  const outputs = [];
  for (const split of [{ prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 20 }, {}]) {
    const r = await studentHttp(req, "fixture", async (_, init) => {
      assert.equal(init?.body, studentPayload(req));
      assert.equal(JSON.parse(String(init?.body)).messages[1].content, "unchanged");
      return Response.json({ model: req.model.pinnedVersion, choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 3, ...split } });
    });
    outputs.push(r.reply?.usage);
  }
  assert.equal(outputs[0]?.cacheHitTokens, 80);
  assert.equal(outputs[0]?.cacheMissTokens, 20);
  assert.equal(outputs[1]?.cacheHitTokens, undefined);
});

test("reservations use the miss rate and observed cache usage alone discounts the settled cost", () => {
  const { e } = fixture();
  const req: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" }, system: "a".repeat(1000),
    messages: [], params: { temperature: null, maxOutputTokens: 20 } };
  const run = (usage: Reply["usage"], hitRate?: number, budget = 1) => {
    let count = 0;
    const session = new Session(() => { count++; return { ...reply("ok", req.model.pinnedVersion), usage }; },
      { ...e.config.prices, inputUsdPerMillion: 1, outputUsdPerMillion: 2, cacheHitInputUsdPerMillion: hitRate }, budget, 0);
    if (!budget) {
      assert.throws(() => session.call(req), /budget_stop/); assert.equal(count, 0);
    } else session.call(req);
    return session.calls[0]!;
  };
  const usage = { inputTokens: 100, outputTokens: 3, cacheHitTokens: 80, cacheMissTokens: 20 };
  const c = run(usage, 0.1);
  assert.deepEqual(c.cache, { hitTokens: 80, missTokens: 20, hitRate: 0.8, hitUsdPerMillion: 0.1,
    missUsdPerMillion: 1, hitUsd: 0.000008, missUsd: 0.000020 });
  assert.equal(c.usd, 0.000034); assert.equal(c.costEstimated, false);
  for (const split of [{}, { cacheHitTokens: 80 }, { cacheHitTokens: -1, cacheMissTokens: 101 },
    { cacheHitTokens: 1.5, cacheMissTokens: 98.5 }, { cacheHitTokens: 80, cacheMissTokens: 19 }]) {
    const unknown = run({ inputTokens: 100, outputTokens: 3, ...split }, 0.1);
    assert.equal(unknown.cache?.hitRate, null); assert.equal(unknown.cache?.hitUsd, null);
    assert.equal(unknown.costEstimated, true); assert.equal(unknown.usd, 0.000106);
    assert.equal(unknown.reservedUsd, c.reservedUsd);
  }
  const noPrice = run(usage);
  assert.equal(noPrice.cache?.hitRate, 0.8); assert.equal(noPrice.cache?.hitUsd, null); assert.ok(noPrice.costEstimated);
  assert.equal(run(usage, 0).usd, 0.000026);
  assert.equal(run({ ...usage, cacheHitTokens: 0, cacheMissTokens: 100 }, 0.1).cache?.hitRate, 0);
  assert.equal(run(null, 0.1).usd, c.reservedUsd); run(usage, 0.1, 0);
});

test("batch cache summary weights input tokens and includes original, superseded and appended scoring calls once", t => {
  const { e } = fixture(), { store } = storage(t);
  e.config.prices.cacheHitInputUsdPerMillion = 0.1;
  const base = e.provider;
  e.provider = job => {
    const provider = base(job); let n = 0;
    return req => {
      const r = provider(req);
      const hit = ++n % 2 ? 20 : 0, miss = hit ? 0 : 80;
      r.usage = { inputTokens: hit + miss, outputTokens: 1, cacheHitTokens: hit, cacheMissTokens: miss };
      return r;
    };
  };
  const batch = runBatch(store, e);
  const records = store.records(e.config.batchId);
  const stats = batchCache(records);
  assert.equal(stats.chargedUsd, batch.spentUsd); assert.deepEqual(batch.cache, stats);
  assert.equal(stats.hitRate, stats.hitTokens! / (stats.hitTokens! + stats.missTokens!));
  assert.ok(stats.hitRate! < 0.5 && stats.byModel.every(m => m.hitUsdPerMillion === 0.1));
  rejudge(store, e, records[0]!.runId);
  const next = batchCache(store.records(e.config.batchId));
  assert.equal(next.calls, stats.calls + 3);
  assert.deepEqual(store.getBatch(e.config.batchId)!.cache, next);
  const prior = structuredClone(records[0]!);
  const restarted = { ...prior, restartOf: prior.runId, runId: "replacement" };
  assert.equal(batchCache([prior, restarted]).calls, prior.calls.length * 2);
  const old = drive();
  for (const c of old.calls) delete c.cache;
  assert.equal(batchCache([prior, old]).hitRate, null);
});
