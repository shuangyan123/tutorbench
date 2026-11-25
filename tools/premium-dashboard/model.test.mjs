// Tests for the premium dashboard data model. Every record here is synthetic.
import assert from "node:assert/strict";
import test from "node:test";

await import("./model.js");
await import("./sample/sample-data.js");
const M = globalThis.PremiumDashboardModel;
const SAMPLE = globalThis.PREMIUM_SAMPLE;

const V1 = "panel-v1";
const V2 = "panel-v2";

function scoring({ id = "s1", version = V1, verdict = "good", pending = [], reasons = [], at = "2026-11-24T10:00:00.000Z", extra = {}, perJudge, disagreements = [] } = {}) {
  return {
    scoringId: id,
    createdAt: at,
    judgeConfig: { version },
    perJudge: perJudge || ["j1", "j2", "j3"].map(judgeId => ({ judgeId, output: { turns: [], overall: { verdict, reasons } }, error: null })),
    usage: { totalUsd: 0.01 },
    merged: verdict === undefined ? null : { verdict, reasons, reviewFlags: [], leakTurns: [], helpLevels: [], ...extra },
    disagreements,
    pending,
  };
}

function record({ runId, status = "scored", endReason = "curt_exit", card = {}, scorings = [scoring()], transcript = [], createdAt = "2026-11-24T10:00:00.000Z" }) {
  return {
    schema: "tutorbench.premium-run-record",
    schemaVersion: 1,
    runId,
    batchId: "b1",
    createdAt,
    status,
    card: { id: "card-a", version: "1.0.0", lang: "en", contentHash: "sha256:a", ...card },
    tutor: { id: "t", label: "Tutor T" },
    repeat: { index: 1, of: 1 },
    transcript,
    end: { reason: endReason, tutorTurns: 2, finalStage: 1, softFlags: [] },
    usage: { totalUsd: 0.02 },
    scorings,
  };
}

const batch = { schema: "tutorbench.premium-batch", batchId: "b1" };

test("pass rate counts only scored runs under the selected judge configuration", () => {
  const records = [
    record({ runId: "good" }),
    record({ runId: "flawed", scorings: [scoring({ verdict: "flawed" })] }),
    record({ runId: "fail", scorings: [scoring({ verdict: "fail", reasons: ["leak"] })] }),
    // A merged verdict with an open pending item is still needs_review.
    record({ runId: "pending-with-verdict", status: "needs_review", scorings: [scoring({ verdict: "fail", pending: ["no_majority:verdict"] })] }),
    record({ runId: "incomplete", status: "needs_review", scorings: [scoring({ verdict: undefined, pending: ["incomplete_panel"] })] }),
    record({ runId: "no-scoring", status: "needs_review", scorings: [] }),
    record({ runId: "error", status: "error", endReason: "error", scorings: [] }),
    record({ runId: "invalid", status: "student_invalid", endReason: "student_invalid", scorings: [] }),
    record({ runId: "other", scorings: [scoring({ version: V2, verdict: "fail" })] }),
  ];
  const d = M.buildDataset({ records, batches: [batch] });
  const views = d.runs.map(r => M.runView(r, V1, d.latestCard));
  const byId = Object.fromEntries(views.map(v => [v.record.runId, v]));
  assert.equal(byId["pending-with-verdict"].state, "needs_review");
  assert.equal(byId["pending-with-verdict"].verdict, null);
  assert.equal(byId.incomplete.scoringIncomplete, true);
  assert.deepEqual(byId["no-scoring"].pending, ["no_scoring"]);
  assert.equal(byId.error.state, "error");
  assert.equal(byId.invalid.state, "student_invalid");
  assert.equal(byId.other.state, "other_version");

  const s = M.summarize(views);
  assert.equal(s.total, 9);
  assert.equal(s.scored, 3);
  assert.equal(s.needsReview, 3);
  assert.equal(s.scoringIncomplete, 2);
  assert.equal(s.error, 1);
  assert.equal(s.studentInvalid, 1);
  assert.equal(s.otherVersion, 1);
  assert.equal(s.passRate, 2 / 3);
  assert.equal(s.failRate, 1 / 3);
});

test("no scored runs gives no pass rate rather than zero", () => {
  const d = M.buildDataset({ records: [record({ runId: "p", status: "needs_review", scorings: [scoring({ verdict: undefined, pending: ["incomplete_panel"] })] })], batches: [batch] });
  const s = M.summarize(d.runs.map(r => M.runView(r, V1, d.latestCard)));
  assert.equal(s.scored, 0);
  assert.equal(s.passRate, null);
});

test("only the current scoring decides; an older scoring never fills in", () => {
  const r = record({ runId: "rescored", scorings: [scoring({ id: "s1", version: V1, verdict: "good" }), scoring({ id: "s2", version: V2, verdict: undefined, pending: ["incomplete_panel"], at: "2026-11-25T08:00:00.000Z" })] });
  const d = M.buildDataset({ records: [r], batches: [batch] });
  assert.deepEqual(d.judgeVersions, [V1, V2]);
  assert.equal(M.runView(r, V1, d.latestCard).state, "other_version");
  const under2 = M.runView(r, V2, d.latestCard);
  assert.equal(under2.state, "needs_review");
  assert.equal(under2.scoring.scoringId, "s2");
  assert.deepEqual(M.costs(r).rescoring, [{ scoringId: "s2", usd: 0.01 }]);
});

test("runs on an older card version are flagged", () => {
  const d = M.buildDataset({ records: [record({ runId: "old", card: { version: "0.9.0", contentHash: "sha256:o" } }), record({ runId: "new", card: { version: "1.0.0" } }), record({ runId: "ten", card: { id: "card-b", version: "1.10.0" } }), record({ runId: "nine", card: { id: "card-b", version: "1.9.0" } })], batches: [batch] });
  assert.equal(d.latestCard["card-a"], "1.0.0");
  assert.equal(d.latestCard["card-b"], "1.10.0");
  const old = M.runView(d.runs.find(r => r.runId === "old"), V1, d.latestCard);
  assert.equal(old.olderCard, true);
  assert.equal(M.runView(d.runs.find(r => r.runId === "nine"), V1, d.latestCard).olderCard, true);
  assert.equal(M.runView(d.runs.find(r => r.runId === "new"), V1, d.latestCard).olderCard, false);
});

test("leak evidence quotes the tutor turn and every judge that saw the leak", () => {
  const turns = [{ noLeak: true, helpLevel: 1, evidence: "What do you" }, { noLeak: false, helpLevel: 3, evidence: "The answer is" }];
  const perJudge = [
    { judgeId: "j1", output: { turns, overall: { reasons: ["leak"] } } },
    { judgeId: "j2", output: { turns, overall: { reasons: ["leak"] } } },
    { judgeId: "j3", output: { turns: [turns[0], { noLeak: true, helpLevel: 2, evidence: "Try" }], overall: { reasons: [] } } },
  ];
  const r = record({
    runId: "leak",
    transcript: [
      { role: "student", text: "help" },
      { role: "tutor", turn: 1, text: "What do you see?" },
      { role: "student", text: "idk" },
      { role: "tutor", turn: 2, text: "The answer is 7." },
    ],
    scorings: [scoring({ verdict: "fail", reasons: ["leak"], perJudge, extra: { leakTurns: [2], leakAfterFixedTest: false } })],
  });
  const d = M.buildDataset({ records: [r], batches: [batch] });
  const ev = M.failureEvidence(M.runView(r, V1, d.latestCard));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "leak");
  assert.equal(ev[0].turn, 2);
  assert.equal(ev[0].tutorText, "The answer is 7.");
  assert.deepEqual(ev[0].quotes.map(q => q.judgeId), ["j1", "j2"]);
  assert.equal(ev[0].quotes[0].evidence, "The answer is");
});

test("a withheld rule verdict still shows its evidence while the run waits for review", () => {
  const r = record({
    runId: "withheld",
    status: "needs_review",
    endReason: "left",
    transcript: [{ role: "student", text: "hi" }, { role: "tutor", turn: 1, text: "Hello" }, { role: "student", text: "bye" }],
    scorings: [scoring({ verdict: null, pending: ["fixed_test_skip_evidence"], reasons: ["student_left"], extra: { withheldRuleVerdict: "fail" } })],
  });
  const v = M.runView(r, V1, null);
  assert.equal(v.state, "needs_review");
  assert.equal(v.withheldVerdict, "fail");
  const ev = M.failureEvidence(v);
  assert.equal(ev[0].kind, "student_left");
  assert.equal(ev[0].message, "bye");
  assert.equal(M.summarize([v]).scored, 0);
});

test("disagreements count who was outvoted and treat ties separately", () => {
  const views = [{ scoring: {}, disagreements: [
    { where: "turn 2 / helpLevel", votes: { j1: 2, j2: 2, j3: 3 }, merged: 2 },
    { where: "verdict", votes: { j1: "good", j2: "flawed", j3: "fail" }, merged: null },
  ] }];
  const s = M.disagreementSummary(views);
  assert.equal(s.total, 2);
  assert.equal(s.runsWith, 1);
  assert.deepEqual(s.byItem, { helpLevel: 1, verdict: 1 });
  assert.deepEqual(s.byJudge.j3, { minority: 1, tie: 1 });
  assert.deepEqual(s.byJudge.j1, { minority: 0, tie: 1 });
});

test("dataset checks report bad input instead of trusting it", () => {
  const a = record({ runId: "a" });
  const changed = { ...record({ runId: "a" }), status: "needs_review" };
  const conflict = record({ runId: "c", card: { contentHash: "sha256:different" } });
  const lost = { ...record({ runId: "lost" }), batchId: "missing" };
  const index = [
    { runId: "a", status: "needs_review", scoringId: "s1", verdict: "good" },
    { runId: "ghost", status: "scored" },
  ];
  const d = M.buildDataset({ records: [a, changed, conflict, lost, { schema: "something-else" }], batches: [batch, { batchId: "x" }], index });
  const codes = d.warnings.map(w => w.code + ":" + w.detail).sort();
  assert.deepEqual(codes, [
    "batch_missing:missing",
    "card_hash_conflict:card-a@1.0.0",
    "duplicate_run_differs:a",
    "index_out_of_date:a",
    "index_row_without_record:ghost",
    "not_a_batch:x",
    "not_a_record:?",
    "record_not_in_index:c",
    "record_not_in_index:lost",
  ]);
  assert.equal(d.runs.length, 3);
});

test("index lines must be valid JSON", () => {
  assert.deepEqual(M.parseJsonl('{"a":1}\n\n{"b":2}\r\n'), [{ a: 1 }, { b: 2 }]);
  assert.throws(() => M.parseJsonl('{"a":1}\nnot json'), /line 2/u);
});

test("the bundled sample is synthetic, consistent and covers every state", () => {
  assert.equal(SAMPLE.source, "synthetic");
  const d = M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, index: M.parseJsonl(SAMPLE.index) });
  assert.deepEqual(d.warnings, []);
  for (const r of d.runs) {
    assert.match(r.tutor.label, /\(synthetic\)/u);
    assert.match(r.card.id, /^synthetic-/u);
  }
  const version = d.judgeVersions[0];
  const views = d.runs.map(r => M.runView(r, version, d.latestCard));
  const states = new Set(views.map(v => v.state));
  for (const s of ["scored", "needs_review", "error", "student_invalid", "other_version"]) assert.ok(states.has(s), "sample lacks state " + s);
  for (const v of views.filter(x => x.state === "needs_review")) assert.ok(v.pending.length > 0, v.record.runId + " needs review without a reason");
  assert.ok(views.some(v => v.olderCard), "sample lacks an older card version");
  assert.ok(views.some(v => v.scoringIncomplete), "sample lacks an incomplete panel");
  assert.ok(views.some(v => v.disagreements.length), "sample lacks judge disagreements");
  assert.ok(views.some(v => M.studentChecks(v.record).softFlags.length), "sample lacks student soft flags");
  assert.ok(views.some(v => M.failureEvidence(v).some(e => e.kind === "leak")), "sample lacks leak evidence");

  const s = M.summarize(views);
  const scored = views.filter(v => v.state === "scored");
  assert.equal(s.scored, scored.length);
  assert.equal(s.passRate, scored.filter(v => v.verdict !== "fail").length / scored.length);
  assert.equal(s.scored + s.needsReview + s.error + s.studentInvalid + s.otherVersion, s.total);
});
