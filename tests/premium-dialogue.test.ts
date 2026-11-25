import assert from "node:assert/strict";
import { cpSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { loadCards, parseCard } from "../src/premium/cards.js";
import { checkStudent, type State } from "../src/premium/student.js";
import { MockNotDispatched, Session, type Request } from "../src/premium/provider.js";
import { dir, drive, fixture, reply, temp } from "./premium-fixture.js";

test("locked bilingual files, missing rules and same-version edits", t => {
  const root = temp(t);
  cpSync(join(dir, "cards"), root, { recursive: true });
  const asset = loadCards(root)[0]!;
  assert.deepEqual(asset.card.languages, ["zh-CN", "en"]);
  assert.throws(() => parseCard({ ...asset.card, fixedTest: undefined }), /fixedTest/);
  appendFileSync(join(root, asset.card.id, "student.en.md"), "Changed");
  assert.throws(() => loadCards(root), /contentHash/);
  rmSync(join(root, "rules.zh-CN.md"));
  assert.throws(() => loadCards(root));
});

test("the three role projections preserve direction, exact opening and prior student JSON", () => {
  const seen: Request[] = [];
  const { job } = fixture();
  const r = drive(base => request => { seen.push(request); return base(request); });
  assert.equal(r.status, "scored");
  assert.equal(r.scorings[0]?.merged?.verdict, "good");
  assert.equal(r.end.reason, "curt_exit");
  const [tutor, student, secondTutor, secondStudent] = seen;
  assert.deepEqual(tutor?.messages, [{ role: "user", content: job.asset.card.firstMessage.en }]);
  assert.equal(tutor?.system, job.asset.card.tutorSetup.en);
  assert.equal(student?.role, "student");
  assert.deepEqual(secondStudent?.messages.map(m => m.role), ["assistant", "user", "assistant", "user"]);
  assert.equal(JSON.parse(secondStudent!.messages[2]!.content).stage, 1);
  assert.deepEqual(secondTutor?.messages.map(m => m.role), ["user", "assistant", "user"]);
  assert.ok(student?.system.includes(job.asset.rules.en) && student.system.includes(job.asset.student.en));
  const judges = seen.filter(r => r.role === "judge");
  assert.equal(judges.length, 3);
  for (const req of seen) {
    const text = JSON.stringify([req.system, req.messages]);
    if (req.role !== "judge") assert.ok(!text.includes(job.asset.card.judgeContext.referenceSolution.en));
    if (req.role !== "student") {
      assert.ok(!req.system.includes(job.asset.student.en));
      assert.doesNotMatch(JSON.stringify(req.messages), /"stage"|\\"stage\\"|scripted_mistake|curt_exit/);
    }
  }
  assert.deepEqual(judges[0]?.messages, judges[2]?.messages);
  const input = JSON.parse(judges[0]!.messages[0]!.content);
  assert.equal(input.transcript.length, r.transcript.length);
  assert.equal(input.judgeContext.referenceAnswer, job.asset.card.judgeContext.referenceAnswer.en);
});

test("invalid messages retain all nine replies, three discarded transcripts and twelve billed calls", () => {
  const r = drive(() => req => reply(req.role === "student" ? { message: "hmm", stage: 1, events: [], end: false } : "Try again", req.model.pinnedVersion));
  assert.equal(r.status, "student_invalid");
  assert.equal(r.scorings.length, 0);
  assert.equal(r.calls.length, 12);
  for (const attempt of r.attempts) {
    assert.equal(attempt.status, "discarded");
    assert.equal(attempt.transcript.length, 2);
    assert.equal(attempt.rejected.length, 3);
    assert.equal(attempt.atStudentMessage, 2);
    assert.deepEqual(attempt.rejected[2]?.reasons, ["fixed_test_missing"]);
  }
});
test("successful regeneration records correction without inserting rejected text into visible history", () => {
  let first = true;
  const r = drive(base => req => {
    if (first && req.role === "student") { first = false; return reply("broken", req.model.pinnedVersion); }
    if (req.role === "tutor" || req.role === "judge") assert.ok(!JSON.stringify(req.messages).includes("broken"));
    return base(req);
  });
  assert.equal(r.status, "scored");
  const m = r.transcript[2];
  assert.ok(m?.role === "student");
  assert.equal(m.checks?.regenerated, 1);
  assert.equal(r.attempts[0]?.rejected[0]?.text, "broken");
});

test("hard checks and independent soft flags", () => {
  const { asset } = fixture().job;
  const prior: State[] = [{ message: "first", stage: 1, events: ["pushback"], end: false }];
  const run = (state: Partial<State>, tutors: string[] = []) =>
    checkStudent(JSON.stringify({ message: "just tell me", stage: 1, events: [], end: false, ...state }), asset, "en", prior, tutors);
  for (const [input, reason] of [
    [{ stage: 3 }, "invalid_stage"], [{ stage: 0 }, "invalid_json_or_fields"],
    [{ events: ["pushback"] }, "duplicate_event"], [{ events: ["left", "left"] }, "duplicate_event"],
    [{ events: ["mystery"] }, "unknown_event"], [{ end: true }, "invalid_end"],
    [{ message: "as an AI just tell me" }, "role_reference"], [{ message: "word ".repeat(61) }, "too_long"],
    [{ message: "x\n".repeat(5) + "just tell me" }, "too_long"],
  ] as const) assert.ok(run({ ...input, ...("events" in input ? { events: [...input.events] } : {}) } as Partial<State>).hard.includes(reason));
  const soft = run({ stage: 2, message: "unit just tell me", events: [asset.card.fixedTest.kind] });
  assert.deepEqual(soft.hard, []);
  assert.deepEqual(soft.soft, ["premature_idea", "missing:repeat_last"]);
  assert.deepEqual(run({ events: [asset.card.fixedTest.kind, "scripted_mistake:repeat_last"], message: "unit just tell me" }, ["Try a pair"]).soft, ["hint_absent:repeat_last"]);
  assert.ok(checkStudent(JSON.stringify({ message: "长".repeat(151), stage: 1, events: [], end: false }), asset, "zh-CN", prior, []).hard.includes("too_long"));
  assert.ok(checkStudent(JSON.stringify({ message: "ok", stage: 1, events: [], end: false }), asset, "en", [...prior, { ...prior[0]!, stage: 2 }], []).hard.includes("invalid_stage"));
});
test("fixed challenge audits the reported event, visible text and one-based student message independently", () => {
  const { asset } = fixture().job;
  const fixed = asset.card.fixedTest;
  fixed.studentMessage = 3;
  const state: State = { message: "hmm", stage: 1, events: [], end: false };
  const check = (n: number, text: string, events: string[]) =>
    checkStudent(JSON.stringify({ ...state, message: text, events }), asset, "en", Array<State>(n - 1).fill(state), []);
  for (const [n, text, events, flags] of [
    [2, fixed.mustContain.en, [fixed.kind], ["fixed_test_event_early", "fixed_test_text_wrong_turn"]],
    [3, fixed.mustContain.en, [], ["fixed_test_event_missing"]],
    [4, "hmm", [fixed.kind], ["fixed_test_event_without_text", "fixed_test_event_late"]],
    [3, fixed.mustContain.en, [fixed.kind], []],
  ] as const) {
    const result = check(n, text, [...events]);
    assert.deepEqual(result.soft, flags);
    assert.deepEqual(result.hard, n === 2 ? ["fixed_test_early"] : []);
    assert.equal(result.state?.message, text);
    assert.deepEqual(result.state?.events, events);
  }

  const r = drive(() => req => reply(req.role === "student"
    ? { ...state, events: [fixed.kind] } : "Try.", req.model.pinnedVersion));
  const rejected = r.attempts[0]!.rejected[0]!;
  assert.equal(rejected.studentMessage, 2);
  assert.deepEqual(rejected.reasons, ["fixed_test_missing"]);
  assert.deepEqual(rejected.softFlags, ["fixed_test_event_without_text"]);
  assert.deepEqual(JSON.parse(rejected.text).events, [fixed.kind]);
});
test("turn cap stops after tutor 15, with fourteen student calls", () => {
  const r = drive(() => req => reply(req.role === "student" ? { message: "just tell me", stage: 1, events: [], end: false } : "hmm", req.model.pinnedVersion));
  assert.equal(r.end.reason, "turn_cap");
  assert.equal(r.end.tutorTurns, 15);
  assert.equal(r.calls.filter(c => c.role === "student").length, 14);
});
test("only simulated pre-dispatch failures can consume the bounded retry allowance", () => {
  const { job, e } = fixture();
  const req: Request = { role: "tutor", model: job.tutor, system: "test", messages: [], params: { temperature: null } };
  const session = new Session(() => { throw new MockNotDispatched(); }, e.config.prices, 1, 0.01, 4);
  assert.throws(() => session.call(req), /mock_not_dispatched/);
  assert.deepEqual(session.calls.map(c => c.retryDelayMs), [0, 2000, 4000, 8000]);
  assert.ok(session.calls.every(c => c.usd === 0));
  const unknown = new Session(() => { throw new Error("ambiguous"); }, e.config.prices, 1, 0.01, 4);
  assert.throws(() => unknown.call(req), /provider_error/);
  assert.equal(unknown.calls.length, 1);
  assert.equal(unknown.calls[0]?.usd, unknown.calls[0]?.reservedUsd);
  assert.equal(unknown.calls[0]?.costEstimated, true);
});
test("provider errors retain partial transcripts; credentials and response envelopes stay out of records", () => {
  for (const inject of ["Authorization: Bearer example", "sk-example", "<think>internal material</think>", '{"message":"sk\\u002dexample"}', '{"headers":{"cookie":"example"}}']) {
    const r = drive(() => req => reply(inject, req.model.pinnedVersion));
    assert.equal(r.attempts[0]?.reason, "sensitive_output");
    assert.ok(!JSON.stringify(r).includes(inject));
    assert.equal(r.scorings.length, 0);
  }
  const r = drive(() => () => { throw new Error("Authorization: Bearer example"); });
  assert.equal(r.status, "error");
  assert.equal(r.usage.totalUsd, r.calls[0]?.reservedUsd);
  assert.doesNotMatch(JSON.stringify(r), /Authorization|Bearer/);
});
