import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runBatch, rejudge, reconcile } from "../src/premium/batch.js";
import { hybridProvider } from "../src/premium/calibration.js";
import { parseBallot } from "../src/premium/judge.js";
import { Session, TransportError, type Request } from "../src/premium/provider.js";
import { indexRow, type Job } from "../src/premium/runner.js";
import { aggregate } from "../src/premium/scoring.js";
import { studentHttp } from "../src/premium/student-http.js";
import { checkStudent, type State } from "../src/premium/student.js";
import { dir, drive, fixture, reply, storage } from "./premium-fixture.js";

test("departure threshold, solved stage and literal challenge use inclusive student-message boundaries", () => {
  const { asset } = fixture().job;
  asset.card.leaveNotBefore = 4;
  asset.card.fixedTest.studentMessage = 3;
  const prior: State = { message: "hi", stage: 1, events: [], end: false };
  const check = (n: number, stage: number, events: string[], message = "bye") =>
    checkStudent(JSON.stringify({ message, stage, events, end: events.includes("left") || events.includes("curt_exit") }),
      asset, "en", Array<State>(n - 1).fill(prior), []);
  const literal = asset.card.fixedTest.mustContain.en;
  assert.deepEqual(check(3, 1, ["left"], literal).hard, ["left_too_early"]);
  assert.deepEqual(check(4, 1, ["left"]).hard, []);
  assert.deepEqual(check(4, 1, ["curt_exit"]).hard, ["curt_exit_unsolved"]);
  assert.deepEqual(check(4, 2, ["curt_exit"]).hard, []);
  assert.deepEqual(check(2, 1, [], literal).hard, ["fixed_test_early"]);
  assert.deepEqual(check(4, 1, [], literal).hard, []);
  assert.ok(check(4, 1, [], literal).soft.includes("fixed_test_text_wrong_turn"));
  assert.deepEqual(check(2, 1, [asset.card.fixedTest.kind]).hard, []);
});

test("one JSON fence, normalized same-turn quotes, symmetric level-three leakage and one repair", () => {
  const run = drive(), output = run.scorings[0]!.perJudge[0]!.output!;
  const quote = structuredClone(output);
  quote.turns[0]!.evidence = "Ｗhat    repeats?";
  assert.deepEqual(parseBallot("\x60\x60\x60json\n" + JSON.stringify(quote) + "\n\x60\x60\x60", run, 2), quote);
  for (const [helpLevel, noLeak] of [[3, true], [1, false]] as const) {
    const bad = structuredClone(output);
    Object.assign(bad.turns[0]!, { helpLevel, noLeak });
    assert.throws(() => parseBallot(JSON.stringify(bad), run, 2), /judge.turns/);
  }
  let visits = 0;
  const repaired = drive(base => req => {
    if (req.model.id === "j2") {
      if (++visits === 1) return reply("broken", req.model.pinnedVersion);
      assert.match(req.messages[0]!.content, /Previous ballot failed validation/);
    } else assert.doesNotMatch(JSON.stringify(req), /Previous ballot failed validation/);
    return base(req);
  });
  assert.equal(repaired.status, "scored");
  assert.equal(repaired.scorings[0]!.perJudge[1]!.rejected.length, 1);
});

test("rule priority, fixed skip evidence, descriptive transfers and three-way splits", () => {
  const { job } = fixture(), run = drive(), original = run.scorings[0]!.perJudge[0]!.output!;
  const votes = () => [0, 1, 2].map(i => ({ judgeId: "j" + i, output: structuredClone(original) }));
  const ballots = votes();
  const result = () => aggregate(ballots, job.asset, run);
  const outcomes = ["held_and_helped", "ignored", "refused_only"] as const;
  const transfers = ["declined", "solved_after_hint", "unsolved"] as const;
  for (const [i, { output }] of ballots.entries()) {
    output.fixedTest.outcome = outcomes[i]!;
    output.overall.transfer = transfers[i]!;
    if (i < 2) {
      Object.assign(output.turns[0]!, { noLeak: false, helpLevel: 3 });
      output.overall.leakTurns = [1];
      output.overall.verdict = "fail";
    }
    parseBallot(JSON.stringify(output), run, 2);
  }
  const score = result();
  assert.equal(score.merged.verdict, "fail");
  assert.deepEqual(score.merged.reviewFlags, ["fixed_test_split", "transfer_split"]);
  Object.assign(run.scorings[0]!, score);
  const index = indexRow(run);
  assert.equal(index.transfer, "split"); assert.equal(index.fixedTest, "split");
  // 复用同一份完整票组，分别检查最后一轮泄露与更早一轮泄露。
  job.asset.card.fixedTest.studentMessage = 3;
  Object.assign(run.end, { fixedTestDelivered: false, reason: "thanked_after_answer" });
  for (const b of ballots) { b.output.fixedTest = { outcome: "not_reached", evidence: "" }; }
  assert.equal(result().merged.fixedTestSkipped, false);
  for (const b of ballots.slice(0, 2)) {
    Object.assign(b.output.turns[1]!, { noLeak: false, helpLevel: 3 });
    b.output.overall.leakTurns = [1, 2];
    parseBallot(JSON.stringify(b.output), run, 3);
  }
  assert.equal(result().merged.fixedTestSkipped, true);
  assert.deepEqual(result().merged.reasons, ["leak"]);
  for (const b of ballots) b.output = structuredClone(original);
  run.end.reason = "curt_exit";
  for (const b of ballots) b.output.overall.solvedByStudent = false;
  assert.deepEqual(result().pending, ["solved_claim_unconfirmed"]);
  run.end.reason = "turn_cap";
  for (const b of ballots) b.output.overall.solvedByStudent = true;
  for (const value of transfers) {
    for (const b of ballots) b.output.overall.transfer = value;
    assert.equal(result().merged.verdict, "good");
    assert.deepEqual(result().pending, []);
  }
});

test("hybrid role routing restarts scripted turns, calibration stays unscored and rejects rejudge", t => {
  const { e, job } = fixture(), { store } = storage(t);
  const tape = JSON.parse(readFileSync(join(dir, "tape.json"), "utf8"));
  e.config.kind = "calibration"; e.config.judges = [];
  let students = 0;
  const hybrid = { ...e, provider: (j: Job) => {
    const base = e.provider(j);
    return hybridProvider(tape, j, req => { students++; assert.equal(req.role, "student"); return base(req); });
  } };
  const batch = runBatch(store, hybrid);
  assert.equal(batch.kind, "calibration"); assert.equal(students, 4);
  for (const r of store.records(e.config.batchId)) {
    assert.equal(indexRow(r).batchKind, "calibration");
    assert.equal(r.status, "unscored"); assert.deepEqual(r.scorings, []);
    assert.throws(() => rejudge(store, e, r.runId), /rejudge.run/);
  }
  const req: Request = { role: "tutor", model: job.tutor, system: "", messages: [{ role: "user", content: "hi" }], params: { temperature: null } };
  const provider = hybrid.provider(job);
  assert.deepEqual(provider(req), provider(req));
  assert.throws(() => provider({ ...req, role: "judge" }), /calibration.role/);
});

test("provider-specific reservation, timeout receipts and bounded transport retry", () => {
  const { job, e } = fixture();
  const req: Request = { role: "student", model: e.config.student, system: "中文", messages: [], params: { temperature: 0.7, maxOutputTokens: 512 } };
  const prices = { ...e.config.prices, models: [{ model: req.model.id, inputUsdPerMillion: 1, outputUsdPerMillion: 3,
    date: "2026-01-01", source: "https://example.test/prices" }] };
  let attempts = 0;
  const waits: number[] = [];
  const session = new Session(() => {
    if (!attempts++) throw new TransportError("timeout", true, 2000);
    return reply("ok", req.model.pinnedVersion);
  }, prices, 1, 0, 1, ms => { waits.push(ms); });
  session.call(req);
  assert.deepEqual(waits, [2000]);
  assert.equal(session.calls[0]?.usd, (Math.ceil(Buffer.byteLength(JSON.stringify(req)) / 2) + 512 * 3) / 1e6);
  assert.ok(session.calls[0]?.costEstimated);
  assert.equal(session.calls[1]?.usd, 0.000025);
  assert.throws(() => session.call({ ...req, model: job.tutor }), /unknown_cost/);
  for (const error of [new TransportError("http_401"), new TransportError("http_429", true, 61_000)]) {
    const refused = new Session(() => { throw error; }, prices, 1, 0);
    assert.throws(() => refused.call(req), new RegExp(error.code));
    assert.equal(refused.calls.length, 1);
  }
});

test("HTTP adapter projects only the visible student reply and classifies status without network", async () => {
  const { e } = fixture();
  const req: Request = { role: "student", model: { ...e.config.student, provider: "deepseek" },
    system: "fixture", messages: [], params: { temperature: 0.7, maxOutputTokens: 512 } };
  let calls = 0;
  const result = await studentHttp(req, "fixture", async (_, init) => {
    calls++;
    assert.equal(JSON.parse(String(init?.body)).max_tokens, 512);
    return Response.json({ model: "fixture-revision", choices: [{ message: { content: "ok", reasoning_content: "PRIVATE" }, finish_reason: "stop" }] });
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  assert.equal(result.reply?.resolvedModel, "fixture-revision");
  const overloaded = await studentHttp(req, "fixture", async () => new Response(null, { status: 503, headers: { "Retry-After": "61" } }));
  assert.deepEqual(overloaded, { error: "http_503", retryable: true, retryAfterMs: 61000 });
  assert.equal(calls, 1);
});

test("budget-stopped dialogue is immutable across explicit top-up and reconciliation", t => {
  const { store } = storage(t), { e } = fixture();
  e.config.languages = ["en"]; e.config.budgetUsd = 0.005;
  const base = e.provider;
  e.provider = job => {
    const provider = base(job);
    return req => {
      const result = provider(req);
      if (req.role === "tutor" && e.config.budgetUsd < 1) result.usage = { inputTokens: 4900, outputTokens: 0 };
      return result;
    };
  };
  const batch = runBatch(store, e), [first] = store.records(e.config.batchId);
  assert.equal(batch.status, "budget_stop"); assert.equal(first?.attempts.at(-1)?.reason, "budget_stop");
  e.config.budgetUsd = 1;
  assert.throws(() => runBatch(store, e), /budget.top_up/);
  const again = runBatch(store, { ...e, topUp: true });
  assert.equal(again.status, "complete");
  assert.deepEqual(store.get(first!.runId), first);
  const retried = store.records(e.config.batchId);
  assert.equal(retried.length, 2);
  assert.equal(retried.find(r => r.runId !== first!.runId)?.restartOf, first!.runId);
  assert.deepEqual(again.runs, { planned: 1, superseded: 1, scored: 1, unscored: 0, error: 0, studentInvalid: 0, needsReview: 0 });
  assert.equal(again.spentUsd, Number((first!.usage.totalUsd! + 0.00014).toFixed(9)));
  assert.throws(() => reconcile(store, e.config.batchId, "mock-host", 2, ""), /reconciliation.reason/);
  reconcile(store, e.config.batchId, "mock-host", 2, "fixture invoice discrepancy");
  assert.deepEqual(store.getBatch(e.config.batchId)?.reconciledUsd, { "mock-host": 2 });
});

test("incomplete rejudge replaces the index view, preserves s1 and card revision binding", t => {
  const { store } = storage(t), { e } = fixture();
  runBatch(store, e);
  const first = store.records(e.config.batchId)[0]!;
  const unavailable = { ...e, provider: () => () => { throw new TransportError("http_401"); } };
  rejudge(store, unavailable, first.runId);
  const updated = store.get(first.runId)!;
  assert.deepEqual(updated.scorings[0], first.scorings[0]);
  assert.equal(indexRow(updated).status, "needs_review"); assert.deepEqual(updated.scorings.at(-1)?.pending, ["incomplete_panel"]);
  e.assets[0]!.card.version = "2.0.0";
  assert.throws(() => rejudge(store, e, first.runId), /rejudge.card/);
});

test("early practice offers preserve the original task and a solved learner can correct a transfer mistake at the same stage", () => {
  const { asset } = fixture().job;
  asset.card.scriptedMistakes.push({ id: "transfer", stage: undefined, required: false, onlyIfTransferOffered: true,
    hint: { en: ["pair"], "zh-CN": ["对"] } });
  const opening: State = { message: "hi", stage: 1, end: false, events: [] };
  const response = (previous: State[], state: State, tutor: string) =>
    checkStudent(JSON.stringify(state), asset, "en", previous, [tutor]);
  const focus = { ...opening, message: "just tell me how to finish this first" };
  assert.deepEqual(response([opening], focus, "Try a different problem.").hard, []);
  const solved = { ...opening, stage: 2, message: "a pair", events: ["scripted_mistake:repeat_last"] };
  const wrong = { ...solved, message: "three", events: ["scripted_mistake:transfer"] };
  assert.deepEqual(response([opening, focus, solved], wrong, "Try this new pattern.").hard, []);
  const corrected = { ...solved, message: "two, thanks", events: ["curt_exit"], end: true };
  assert.deepEqual(response([opening, focus, solved, wrong], corrected, "Count the missing pair.").hard, []);
  assert.deepEqual(response([opening, focus, solved], { ...corrected, message: "no thanks" }, "Another exercise?").hard, []);
});

test("a completed dialogue awaiting an unaffordable judge is recovered by an appended panel", t => {
  const { store } = storage(t), { e } = fixture();
  e.config.languages = ["en"]; e.config.budgetUsd = 20;
  const models = [e.config.student, ...e.config.tutors, ...e.config.judges];
  e.config.prices.models = models.map(m => ({ model: m.id, date: "2026-01-01", source: "https://example.test/rate",
    inputUsdPerMillion: m === e.config.student ? 1 : 0, outputUsdPerMillion: e.config.judges.includes(m) ? 10 : 0 }));
  const factory = e.provider;
  let students = 0, judges = 0;
  e.provider = job => {
    const base = factory(job);
    return req => {
      if (req.role === "judge") judges++;
      const r = base(req);
      r.usage = { inputTokens: req.role === "student" && ++students === 2 ? 19_950_000 : 0, outputTokens: 0 };
      return r;
    };
  };
  const batch = runBatch(store, e);
  assert.equal(batch.status, "budget_stop"); assert.equal(batch.spentUsd, 19.95); assert.equal(judges, 0);
  const first = store.records(e.config.batchId)[0]!;
  assert.equal(first.end.reason, "curt_exit"); assert.deepEqual(first.scorings[0]?.pending, ["incomplete_panel"]);
  e.config.budgetUsd = 21;
  assert.equal(rejudge(store, { ...e, topUp: true }, first.runId), "s2");
  assert.equal(judges, 3);
  assert.equal(indexRow(store.get(first.runId)!).status, "scored");
  assert.deepEqual(store.get(first.runId)?.transcript, first.transcript);
});

test("incomplete panel with student departure withholds rule failure until rejudge", t => {
  const { store } = storage(t), { e } = fixture();
  const factory = e.provider;
  e.provider = job => {
    const base = factory(job);
    let student = 0;
    return req => {
      if (req.role === "student" && ++student === 2) return reply({ message: "bye", stage: 1, events: ["left"], end: true }, req.model.pinnedVersion);
      if (["j1", "j2"].includes(req.model.id)) return reply("broken", req.model.pinnedVersion);
      return base(req);
    };
  };
  runBatch(store, e);
  const first = store.records(e.config.batchId)[0]!;
  assert.deepEqual(first.scorings[0]?.pending, ["incomplete_panel"]);
  const score = first.scorings[0]!;
  assert.ok("withheldRuleVerdict" in score); assert.equal(score.withheldRuleVerdict, "fail"); assert.equal(score.merged, null);
  rejudge(store, { ...e, provider: factory }, first.runId);
  assert.equal(indexRow(store.get(first.runId)!).verdict, "fail");
});

test("a live job interrupted before commit cannot be dispatched a second time", t => {
  const { store } = storage(t), { e, job } = fixture();
  store.liveGuard(e.config.batchId, job.runId);
  assert.throws(() => store.liveGuard(e.config.batchId), /unreconciled_inflight_job/);
});

test("reservations at the exact allowance are charged once and the next paid call is denied", () => {
  const { e } = fixture();
  const req: Request = { role: "student", model: e.config.student, messages: [], system: "fixture", params: { temperature: 0.7, maxOutputTokens: 512 } };
  const session = new Session(() => ({ ...reply("ok", req.model.pinnedVersion), usage: null }),
    { ...e.config.prices, inputUsdPerMillion: 0, outputUsdPerMillion: 1 }, 0.000512, 0);
  session.call(req);
  assert.equal(session.calls[0]?.usd, 0.000512);
  assert.throws(() => session.call(req), /budget_stop/);
  assert.equal(session.calls.length, 1);
});
