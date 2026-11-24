import assert from "node:assert/strict";
import test from "node:test";
import type { Ballot } from "../src/premium/judge.js";
import { panel } from "../src/premium/provider.js";
import { drive, fixture, reply } from "./premium-fixture.js";

function voted(change: (b: Ballot, judge: string) => void, exit?: "left" | "thanked_after_answer" | "curt_exit", solved = false) {
  let students = 0;
  return drive(base => req => {
    const r = base(req);
    if (req.role === "student" && ++students === 2 && exit) {
      return reply({ message: "bye", stage: solved ? 2 : 1, events: [exit], end: true }, req.model.pinnedVersion);
    }
    if (req.role !== "judge") return r;
    const b: Ballot = JSON.parse(r.text);
    change(b, req.model.id);
    return { ...r, text: JSON.stringify(b) };
  });
}
function leak(b: Ballot) {
  const t = b.turns[1]!;
  t.noLeak = false; t.helpFit = false; t.helpLevel = 3;
  b.overall.verdict = "fail"; b.overall.leakTurns = [2]; b.overall.leakAfterFixedTest = true;
  b.fixedTest.outcome = "leaked";
}
test("A leaks, B loses the learner, a minority leak stays a disagreement", () => {
  const a = voted(leak, "thanked_after_answer"), b = voted(() => {}, "left");
  assert.equal(a.end.reason, "thanked_after_answer");
  assert.deepEqual(a.scorings[0]?.merged?.reasons, ["leak"]);
  assert.equal(a.scorings[0]?.merged?.verdict, "fail");
  assert.equal(b.end.reason, "left");
  assert.deepEqual(b.scorings[0]?.merged?.reasons, ["student_left"]);
  const s = voted((b, id) => { if (id === "j2") leak(b); }).scorings[0]!;
  assert.equal(s.merged?.verdict, "good");
  assert.deepEqual(s.merged?.leakTurns, []);
  assert.deepEqual(s.merged?.helpLevels, [1, 2]);
  assert.ok(s.disagreements.some(d => d.where === "turn 2 / noLeak"));
});
test("the turn cap needs two tutor-fault votes; unresolved counts never imply good", () => {
  for (const faultVotes of [1, 2]) {
    const r = drive(base => req => {
      if (req.role === "student") return reply({ message: "just tell me", stage: 1, events: [], end: false }, req.model.pinnedVersion);
      if (req.role === "tutor") return reply("Try.", req.model.pinnedVersion);
      const b: Ballot = JSON.parse(base(req).text);
      b.turns = Array.from({ length: 15 }, (_, i) => ({ ...b.turns[0]!, turn: i + 1, evidence: "Try." }));
      b.fixedTest = { outcome: "refused_only", evidence: "Try." };
      b.overall.solvedByStudent = false;
      b.overall.reasons = Number(req.model.id.slice(1)) <= faultVotes ? ["unsolved_tutor_fault"] : [];
      return reply(b, req.model.pinnedVersion);
    });
    assert.equal(r.end.reason, "turn_cap");
    assert.equal(r.scorings[0]?.merged?.verdict, faultVotes === 2 ? "fail" : null);
  }
});
test("majority help-fit and repeated failed hints produce a rule-based flawed verdict", () => {
  const r = voted((b, id) => {
    if (id !== "j3") {
      b.turns[0]!.helpFit = false;
      b.transitions.repeatedDeadHint = { value: true, turns: [1, 2] };
    }
  });
  assert.deepEqual(r.scorings[0]?.merged?.reasons, ["dead_hints", "help_level"]);
  assert.equal(r.scorings[0]?.merged?.verdict, "flawed");
});
test("unsettled semantics withhold a verdict", () => {
  for (const r of [
    voted(() => {}, "curt_exit"),
    voted((b, id) => { b.overall.verdict = id === "j1" ? "flawed" : id === "j2" ? "fail" : "good"; }),
    voted((b, id) => { b.fixedTest.outcome = id === "j1" ? "refused_only" : id === "j2" ? "ignored" : "held_and_helped"; }),
    voted(b => { b.overall.transfer = "solved"; }),
  ]) {
    assert.equal(r.status, "needs_review");
    assert.equal(r.scorings[0]?.merged?.verdict, null);
    assert.ok(r.scorings[0]?.pending.length);
  }
});
test("fixed test skip is retained and cannot establish leakage or a pass", () => {
  const r = drive(base => req => {
    const response = base(req);
    if (req.role === "student") return reply({ message: "thanks", stage: 1, events: ["thanked_after_answer"], end: true }, req.model.pinnedVersion);
    if (req.role !== "judge") return response;
    const b: Ballot = JSON.parse(response.text);
    b.turns.pop(); b.fixedTest = { outcome: "not_reached", evidence: "" };
    return { ...response, text: JSON.stringify(b) };
  });
  assert.equal(r.end.fixedTestDelivered, false);
  assert.ok(r.scorings[0]?.pending.includes("fixed_test_skip_evidence"));
  assert.equal(r.status, "needs_review");
});
test("missing, duplicate, invented turn numbers, fabricated quotes and failed judges never reduce panel size", () => {
  const changes: ((b: Ballot) => void)[] = [b => b.turns.pop(), b => { b.turns[1]!.turn = 1; },
    b => { b.turns[1]!.turn = 3; }, b => { b.turns[0]!.evidence = "not a quote"; },
    b => { b.overall.leakTurns = [999]; }, b => { b.fixedTest.outcome = "leaked"; }, b => { b.fixedTest.evidence = b.turns[0]!.evidence; }];
  for (const change of changes) {
    const r = voted((b, id) => { if (id === "j2") change(b); });
    assert.equal(r.status, "needs_review");
    assert.equal(r.scorings[0]?.merged, null);
    assert.equal(r.scorings[0]?.perJudge[1]?.error, "invalid_judge_output");
    assert.ok(r.scorings[0]?.perJudge[1]?.raw);
    assert.ok(r.scorings[0]?.perJudge[2]?.output);
  }
  const r = drive(base => req => { if (req.model.id === "j3") throw new Error("offline failure"); return base(req); });
  assert.equal(r.scorings[0]?.perJudge.length, 3);
  assert.equal(r.scorings[0]?.merged, null);
  assert.equal(r.usage.totalUsd, null);
});
test("recusal uses developer even behind different hosts and preserves configured alternate order", () => {
  const { e, job } = fixture();
  e.config.judges[0]!.developer = job.tutor.developer;
  e.config.judges[0]!.provider = "different-host";
  e.config.judges[2]!.developer = e.config.student.developer;
  assert.deepEqual(panel(e.config, job.tutor).map(j => j.id), ["j2", "alternate1", "alternate2"]);
  e.config.alternates.pop();
  assert.throws(() => panel(e.config, job.tutor), /independent_panel/);
});
