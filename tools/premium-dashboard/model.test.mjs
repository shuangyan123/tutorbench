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

function record({ runId, status = "scored", endReason = "curt_exit", card = {}, scorings = [scoring()], transcript = [], createdAt = "2026-11-24T10:00:00.000Z", tutor = {}, student }) {
  return {
    schema: "tutorbench.premium-run-record",
    schemaVersion: 1,
    runId,
    batchId: "b1",
    createdAt,
    status,
    card: { id: "card-a", version: "1.0.0", lang: "en", contentHash: "sha256:a", ...card },
    tutor: { id: "t", label: "Tutor T", ...tutor },
    repeat: { index: 1, of: 1 },
    ...(student ? { student } : {}),
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
  assert.deepEqual(s.passRange, M.wilson(2, 3));
  assert.equal(s.failRate, 1 / 3);
});

test("the pass rate carries a Wilson 95% range that stays inside 0..1", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 5e-4, a + " vs " + b);
  const third = M.wilson(5, 15);
  near(third.lo, 0.1518); near(third.hi, 0.5829);
  const all = M.wilson(15, 15);
  near(all.lo, 0.7961); assert.equal(all.hi, 1);
  const none = M.wilson(0, 4);
  assert.equal(none.lo, 0); near(none.hi, 0.4899);
  assert.equal(M.wilson(0, 0), null);
  // More runs, narrower range, same rate.
  const small = M.wilson(2, 4), big = M.wilson(20, 40);
  assert.ok(big.hi - big.lo < small.hi - small.lo);
});

test("no scored runs gives no pass rate rather than zero", () => {
  const d = M.buildDataset({ records: [record({ runId: "p", status: "needs_review", scorings: [scoring({ verdict: undefined, pending: ["incomplete_panel"] })] })], batches: [batch] });
  const s = M.summarize(d.runs.map(r => M.runView(r, V1, d.latestCard)));
  assert.equal(s.scored, 0);
  assert.equal(s.passRate, null);
  assert.equal(s.passRange, null);
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
  // Calibration and superseded runs need the batch links, so check them with the dataset's map.
  const linked = d.runs.map(r => M.runView(r, version, d.latestCard, d.supersededBy));
  for (const s of ["calibration", "superseded"]) assert.ok(linked.some(v => v.state === s), "sample lacks state " + s);
  assert.ok(linked.some(v => v.restartOf && v.state !== "superseded"), "sample lacks a restarted run");
  assert.ok(linked.some(v => v.reviewFlags.length && v.state === "scored"), "sample lacks a scored run with review flags");
  assert.ok(linked.some(v => v.fixedTestSkipped), "sample lacks fixedTestSkipped");
  assert.ok(linked.some(v => v.judgeRepairs.some(j => j.recovered)), "sample lacks a repaired judge ballot");
  assert.ok(d.runs.some(r => M.costs(r).estimatedCalls > 0), "sample lacks a call charged at its reservation");
  const infos = d.batches.map(M.batchInfo);
  assert.ok(infos.some(b => b.kind === "calibration"), "sample lacks a calibration batch");
  assert.ok(infos.some(b => b.topUps.length && b.superseded), "sample lacks a topped-up batch with a restart");
  assert.ok(infos.some(b => b.reconciled.some(x => x.estimatedUsd != null)), "sample lacks a reconciliation");
  const ls = M.summarize(linked);
  assert.equal(ls.scored + ls.needsReview + ls.error + ls.studentInvalid + ls.otherVersion + ls.calibration + ls.superseded, ls.total);
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
  assert.equal(s.scored + s.needsReview + s.error + s.studentInvalid + s.otherVersion + s.calibration + s.superseded, s.total);
});

// ---------- record schema v2 ----------
function v2(fields) {
  return { ...record(fields), schemaVersion: 2, batchKind: fields.batchKind || "evaluation", ...(fields.restartOf ? { restartOf: fields.restartOf } : {}) };
}

test("v2: calibration runs and superseded runs are listed but never counted", () => {
  const records = [
    v2({ runId: "eval" }),
    v2({ runId: "calib", batchKind: "calibration", status: "unscored", scorings: [] }),
    // Interrupted by the budget, then restarted after a top-up.
    v2({ runId: "cut", status: "error", endReason: "error", scorings: [], createdAt: "2026-11-24T09:00:00.000Z" }),
    v2({ runId: "redo", restartOf: "cut", scorings: [scoring({ verdict: "fail", reasons: ["leak"] })] }),
  ];
  const d = M.buildDataset({ records, batches: [batch] });
  assert.deepEqual(d.supersededBy, { cut: "redo" });
  assert.deepEqual(d.warnings, []);
  const views = d.runs.map(r => M.runView(r, V1, d.latestCard, d.supersededBy));
  const byId = Object.fromEntries(views.map(v => [v.record.runId, v]));
  assert.equal(byId.calib.state, "calibration");
  assert.equal(byId.cut.state, "superseded");
  assert.equal(byId.cut.supersededBy, "redo");
  assert.equal(byId.redo.restartOf, "cut");
  assert.equal(byId.redo.state, "scored");
  const s = M.summarize(views);
  assert.equal(s.calibration, 1);
  assert.equal(s.superseded, 1);
  assert.equal(s.error, 0);
  assert.equal(s.scored, 2);
  assert.equal(s.passRate, 1 / 2);
  // Without the dataset's links the interrupted run is an ordinary error; it is never scored either way.
  assert.equal(M.runView(records[2], V1, d.latestCard).state, "error");
});

test("v2: a calibration record is never scored, even if the batch kind is missing", () => {
  const r = { ...record({ runId: "c", status: "unscored", scorings: [] }), schemaVersion: 2 };
  assert.equal(M.runView(r, V1, null).state, "calibration");
});

test("v2: restart links that point nowhere or twice are reported", () => {
  const d = M.buildDataset({ records: [v2({ runId: "a", restartOf: "gone" }), v2({ runId: "cut", status: "error", endReason: "error", scorings: [] }),
    v2({ runId: "b", restartOf: "cut" }), v2({ runId: "c", restartOf: "cut" })], batches: [batch] });
  assert.deepEqual(d.warnings.map(w => w.code + ":" + w.detail).sort(), ["restart_target_missing:a", "restarted_twice:cut"]);
  assert.equal(d.supersededBy.cut, "b");
});

test("v2: a withheld verdict on an incomplete panel is read from the scoring and keeps its evidence", () => {
  const r = v2({
    runId: "w", status: "needs_review", endReason: "left",
    transcript: [{ role: "student", text: "hi" }, { role: "tutor", turn: 1, text: "Hello" }, { role: "student", text: "bye" }],
    scorings: [{ ...scoring({ verdict: undefined, pending: ["incomplete_panel"] }), withheldRuleVerdict: "fail" }],
  });
  const v = M.runView(r, V1, null);
  assert.equal(v.state, "needs_review");
  assert.equal(v.withheldVerdict, "fail");
  assert.equal(v.scoringIncomplete, true);
  const ev = M.failureEvidence(v);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "student_left");
  assert.equal(ev[0].studentMessage, 2);
});

test("v2: review flags and fixedTestSkipped do not block a verdict", () => {
  const r = v2({ runId: "f", endReason: "thanked_after_answer",
    scorings: [scoring({ verdict: "fail", reasons: ["leak"], extra: { reviewFlags: ["verdict_split", "answer_claim_unconfirmed"], fixedTestSkipped: true } })] });
  const v = M.runView(r, V1, null);
  assert.equal(v.state, "scored");
  assert.equal(v.verdict, "fail");
  assert.deepEqual(v.reviewFlags, ["verdict_split", "answer_claim_unconfirmed"]);
  assert.equal(v.fixedTestSkipped, true);
});

test("v2: a judge ballot sent back once is shown as repaired or still invalid", () => {
  const ok = { judgeId: "j1", output: { turns: [], overall: { verdict: "good", reasons: [] } }, error: null, rejected: [] };
  const perJudge = [ok, { ...ok, judgeId: "j2", rejected: [{ raw: "{}", reason: "Invalid premium field: judge.leakTurns" }] },
    { judgeId: "j3", output: null, error: "invalid_judge_output", rejected: [{ raw: "x", reason: "invalid_judge_json" }, { raw: "y", reason: "invalid_judge_json" }] }];
  const v = M.runView(v2({ runId: "j", status: "needs_review", scorings: [scoring({ verdict: undefined, pending: ["incomplete_panel"], perJudge })] }), V1, null);
  assert.deepEqual(v.judgeRepairs, [
    { judgeId: "j2", reasons: ["Invalid premium field: judge.leakTurns"], recovered: true },
    { judgeId: "j3", reasons: ["invalid_judge_json", "invalid_judge_json"], recovered: false },
  ]);
  assert.deepEqual(v.judgeErrors, [{ judgeId: "j3", error: "invalid_judge_output" }]);
});

test("v2: index rows are checked on batchKind, reviewFlags and fixedTestSkipped; v1 rows without them still pass", () => {
  const flagged = v2({ runId: "f", scorings: [scoring({ extra: { reviewFlags: ["fixed_test_split"], fixedTestSkipped: false } })] });
  const calib = v2({ runId: "c", batchKind: "calibration", status: "unscored", scorings: [] });
  const old = record({ runId: "o" });
  const good = [
    { runId: "f", status: "scored", scoringId: "s1", verdict: "good", batchKind: "evaluation", reviewFlags: ["fixed_test_split"], fixedTestSkipped: false, fixedTest: "split" },
    { runId: "c", status: "unscored", scoringId: null, verdict: null, batchKind: "calibration", reviewFlags: [], fixedTestSkipped: false },
    { runId: "o", status: "scored", scoringId: "s1", verdict: "good" },
  ];
  assert.deepEqual(M.buildDataset({ records: [flagged, calib, old], batches: [batch], index: good }).warnings, []);
  const stale = [{ ...good[0], reviewFlags: [] }, { ...good[1], batchKind: "evaluation" }, good[2]];
  assert.deepEqual(M.buildDataset({ records: [flagged, calib, old], batches: [batch], index: stale }).warnings.map(w => w.detail).sort(), ["c", "f"]);
});

test("v2: costs count calls charged at their reservation", () => {
  const r = { ...v2({ runId: "u" }), calls: [{ n: 1, usd: 0.001, costEstimated: false }, { n: 2, usd: 0.004, costEstimated: true }] };
  r.scorings = [scoring(), { ...scoring({ id: "s2" }), calls: [{ n: 3, usd: 0.02, costEstimated: true }] }];
  assert.equal(M.costs(r).estimatedCalls, 2);
  assert.equal(M.costs(record({ runId: "v1" })).estimatedCalls, 0);
});

test("v2: batch info shows the hard cap, top-ups and the reconciliation against the estimate", () => {
  const b = M.batchInfo({ schema: "tutorbench.premium-batch", schemaVersion: 2, batchId: "b2", kind: "evaluation", status: "complete", planned: 2,
    spentUsd: 0.026, budgetUsd: 0.5, hardCapUsd: 0.625, hardCapReached: false,
    budgetHistory: [{ at: "2026-11-25T10:45:00.000Z", from: 0.006, to: 0.5, previousHardCap: 0.0075, hardCapUsd: 0.625 }],
    reconciledUsd: { host: 0.03 }, reconciliationHistory: [{ provider: "host", actualUsd: 0.028, estimated: 0.026, reason: "", at: "x" }, { provider: "host", actualUsd: 0.03, estimated: 0.026, reason: "invoice", at: "y" }],
    runs: { planned: 2, superseded: 1, scored: 2, error: 0, unscored: 0, studentInvalid: 0, needsReview: 0 } });
  assert.equal(b.done, 2);
  assert.equal(b.superseded, 1);
  assert.equal(b.hardCapUsd, 0.625);
  assert.deepEqual(b.topUps, [{ at: "2026-11-25T10:45:00.000Z", from: 0.006, to: 0.5 }]);
  assert.deepEqual(b.reconciled, [{ provider: "host", actualUsd: 0.03, estimatedUsd: 0.026, diffUsd: 0.004, reason: "invoice", at: "y" }]);
  const calib = M.batchInfo({ batchId: "c", kind: "calibration", planned: 8, runs: { unscored: 8 } });
  assert.equal(calib.done, 8);
  const v1 = M.batchInfo({ batchId: "old", spentUsd: 0.1, budgetUsd: 5, runs: { scored: 3, needsReview: 1 } });
  assert.equal(v1.kind, "evaluation");
  assert.equal(v1.hardCapUsd, null);
  assert.deepEqual(v1.topUps, []);
  assert.deepEqual(v1.reconciled, []);
});

test("versions: ordered by first appearance; the card's system prompt is not part of a version", () => {
  const recs = [
    record({ runId: "b1", createdAt: "2026-11-20T00:00:00.000Z", tutor: { resolvedModel: "m-2", promptHash: "sha256:aaaa" } }),
    record({ runId: "a1", createdAt: "2026-11-10T00:00:00.000Z", tutor: { resolvedModel: "m-1", promptHash: "sha256:aaaa" } }),
    // An old version run again later stays old.
    record({ runId: "a0", createdAt: "2026-11-25T00:00:00.000Z", tutor: { resolvedModel: "m-1", promptHash: "sha256:aaaa" } }),
    // Another card or language brings another system prompt, but the same model is the same version.
    record({ runId: "b2", createdAt: "2026-11-22T00:00:00.000Z", card: { id: "card-b" }, tutor: { resolvedModel: "m-2", promptHash: "sha256:bbbb" } }),
    record({ runId: "p1", createdAt: "2026-11-23T00:00:00.000Z", tutor: { resolvedModel: undefined, pinnedVersion: "m-3" } }),
  ];
  const list = M.tutorVersions(recs).get("Tutor T");
  assert.deepEqual(list.map(v => v.label), ["m-1", "m-2", "m-3"]);
  const d = M.buildDataset({ records: recs, batches: [batch] });
  const views = d.runs.map(r => M.runView(r, V1, d.latestCard));
  assert.equal(M.latestVersions(views, M.tutorVersions(d.runs)).get("Tutor T").key, "m-3");
  // Among the views of one older version only, that version is the newest present.
  const onlyOld = views.filter(v => v.record.tutor.resolvedModel === "m-1");
  assert.equal(M.latestVersions(onlyOld, M.tutorVersions(d.runs)).get("Tutor T").label, "m-1");
});

test("version trend compares only cards both versions scored, and calls a change clear only outside both ranges", () => {
  const run = (id, model, cardId, verdict, at) => record({ runId: id, createdAt: at, card: { id: cardId }, tutor: { resolvedModel: model },
    scorings: [scoring({ verdict, reasons: verdict === "fail" ? ["leak"] : [] })] });
  const old = "2026-11-01T00:00:00.000Z", now = "2026-11-20T00:00:00.000Z";
  const recs = [];
  for (let i = 0; i < 10; i++) recs.push(run("o" + i, "m-1", "card-a", "good", old));
  for (let i = 0; i < 10; i++) recs.push(run("n" + i, "m-2", "card-a", i < 2 ? "good" : "fail", now));
  // Only the new version ran card-b, so card-b must not count for either.
  for (let i = 0; i < 6; i++) recs.push(run("x" + i, "m-2", "card-b", "good", now));
  recs.push(record({ runId: "solo", createdAt: now, tutor: { label: "Solo" } }));
  const d = M.buildDataset({ records: recs, batches: [batch] });
  const views = d.runs.map(r => M.runView(r, V1, d.latestCard));
  const trend = M.versionTrend(views, M.tutorVersions(d.runs));
  assert.equal(trend.length, 1, "a tutor with one version has no trend");
  const [t] = trend;
  assert.deepEqual(t.points.map(p => p.label), ["m-1", "m-2"]);
  assert.equal(t.cells, 1);
  assert.deepEqual(t.points.map(p => p.s.scored), [10, 10]);
  assert.equal(t.points[1].total, 16);
  assert.ok(Math.abs(t.delta - -0.8) < 1e-9);
  assert.equal(t.clear, true);

  // A small change on few runs stays inside the ranges.
  const small = [run("p0", "m-1", "card-a", "good", old), run("p1", "m-1", "card-a", "good", old), run("q0", "m-2", "card-a", "good", now), run("q1", "m-2", "card-a", "fail", now)];
  const d2 = M.buildDataset({ records: small, batches: [batch] });
  const t2 = M.versionTrend(d2.runs.map(r => M.runView(r, V1, d2.latestCard)), M.tutorVersions(d2.runs))[0];
  assert.equal(t2.delta, -0.5);
  assert.equal(t2.clear, false);

  // No card in common: no change is claimed.
  const apart = [run("r0", "m-1", "card-a", "good", old), run("r1", "m-2", "card-b", "fail", now)];
  const d3 = M.buildDataset({ records: apart, batches: [batch] });
  const t3 = M.versionTrend(d3.runs.map(r => M.runView(r, V1, d3.latestCard)), M.tutorVersions(d3.runs))[0];
  assert.equal(t3.cells, 0);
  assert.equal(t3.delta, null);
  assert.equal(t3.clear, false);
});

test("tutor economy counts only the tutor's own calls, as medians", () => {
  const call = (role, usd, latencyMs, extra = {}) => ({ role, usd, latencyMs, error: null, costEstimated: false, ...extra });
  const a = { ...record({ runId: "a" }), calls: [call("tutor", 0.001, 400), call("student", 0.5, 9000), call("tutor", 0.002, 800), call("judge", 0.9, 9000),
    call("tutor", null, 30000, { error: "timeout" })], usage: { tutor: { usd: 0.003 }, totalUsd: 1.403 } };
  const e = M.tutorEconomy(a);
  assert.equal(e.usd, 0.003);
  assert.equal(e.replies, 2, "a failed call is not a reply");
  assert.deepEqual(e.latencies, [400, 800]);
  // Without a usage block the tutor calls are summed; one unpriced call leaves the cost unknown rather than low.
  const b = { ...record({ runId: "b" }), calls: [call("tutor", 0.004, 600), call("tutor", 0.004, 1000, { costEstimated: true })], usage: null };
  assert.ok(Math.abs(M.tutorEconomy(b).usd - 0.008) < 1e-12);
  assert.equal(M.tutorEconomy(b).estimated, true);
  const c = { ...record({ runId: "c" }), calls: [call("tutor", 0.004, 600), call("tutor", null, 700)], usage: null };
  assert.equal(M.tutorEconomy(c).usd, null);
  const g = M.economyOf([a, b, c].map(r => ({ record: r })));
  assert.equal(g.priced, 2);
  assert.equal(g.usdPerRun, (0.003 + 0.008) / 2);
  assert.equal(g.latencyMs, 650, "median over every reply: 400 600 600 700 800 1000");
});

test("setup comparison names what differs and reads a result only when one thing changed", () => {
  const run = (id, { model = "m-1", label, studentModel = "s-1", cardId = "card-a", verdict = "good" } = {}) => record({ runId: id, card: { id: cardId },
    tutor: { resolvedModel: model, ...(label ? { label } : {}) }, student: { resolvedModel: studentModel, params: { temperature: 0.7 } },
    scorings: [scoring({ verdict, reasons: verdict === "fail" ? ["leak"] : [] })] });
  const viewsOf = recs => { const d = M.buildDataset({ records: recs, batches: [batch] }); return d.runs.map(r => M.runView(r, V1, d.latestCard)); };
  const all = viewsOf([
    run("a1"), run("a2"), run("a3", { cardId: "card-b" }),
    run("b1", { studentModel: "s-2", verdict: "fail" }), run("b2", { studentModel: "s-2" }),
    run("c1", { model: "m-2", studentModel: "s-2" }),
    run("d1", { label: "Tutor U", model: "u-1" }),
  ]);
  const groups = M.setups(all);
  assert.equal(groups.length, 4);
  const pick = id => groups.find(g => g.views.some(v => v.record.runId === id)).views;

  // Only the student changed: one change, read on card-a only (card-b ran on one side).
  const ab = M.compareSetups(pick("a1"), pick("b1"));
  assert.deepEqual(ab.diff.map(d => d.part), ["studentModel"]);
  assert.equal(ab.changes, 1);
  assert.equal(ab.cells, 1);
  assert.equal(ab.a.scored, 2);
  assert.equal(ab.delta, -0.5);
  assert.equal(ab.clear, false);

  // Another tutor is one change even though its model differs too.
  const ad = M.compareSetups(pick("a1"), pick("d1"));
  assert.deepEqual(ad.diff.map(d => d.part), ["tutor", "tutorModel"]);
  assert.equal(ad.changes, 1);

  // Model and student both changed: two changes, so no single cause.
  const ac = M.compareSetups(pick("a1"), pick("c1"));
  assert.equal(ac.changes, 2);

  // A hand-made group that mixes two students is reported as mixed.
  const mixed = M.compareSetups([...pick("a1"), ...pick("b1")], pick("c1"));
  assert.ok(mixed.mixed.some(m => m.side === "a" && m.part === "studentModel"));
});

// ---------- record schema v3: the tutor's own prompt ----------
// These read the bundled sample: its records were written by the runners themselves, the history by a record schema v2
// runner and the rest by a v3 runner, into one runs folder.
function sampleViews() {
  const d = M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, index: M.parseJsonl(SAMPLE.index) });
  const version = d.judgeVersions[0];
  const views = d.runs.map(r => M.runView(r, version, d.latestCard, d.supersededBy));
  return { d, views, evaluated: views.filter(v => !M.NOT_EVALUATION.includes(v.state)) };
}
// A run whose current scoring is under the first judge configuration (some pilot runs were re-scored under the second).
const underV1 = r => (M.currentScoring(r) || { judgeConfig: {} }).judgeConfig.version === "synthetic-panel-v1";
const setupWith = (evaluated, pred) => {
  const hits = M.setups(evaluated).filter(g => g.views.some(v => pred(v.record)));
  assert.equal(hits.length, 1, "expected one setup, found " + hits.length);
  return hits[0];
};

test("v3: records of schema v1, v2, v3 and v5 load together, and v2 history joins v3 runs of the same setup", () => {
  const { d, evaluated } = sampleViews();
  assert.deepEqual(d.warnings, []);
  assert.deepEqual([...new Set(d.runs.map(r => r.schemaVersion))].sort(), [2, 3, 5]);
  // A v1 record from an older folder loads beside them.
  const old = record({ runId: "v1-run", createdAt: "2026-11-01T00:00:00.000Z" });
  const mixed = M.buildDataset({ records: [...SAMPLE.records, old], batches: [...SAMPLE.batches, batch] });
  assert.deepEqual(mixed.warnings, []);
  assert.deepEqual([...new Set(mixed.runs.map(r => r.schemaVersion))].sort(), [1, 2, 3, 5]);
  // Atlas with no prompt of its own: the v2 pilot and the v3 runs after it are one setup.
  const atlas = setupWith(evaluated, r => r.batchId === "synthetic-pilot-02" && r.tutor.id === "atlas" && underV1(r));
  assert.deepEqual([...new Set(atlas.views.map(v => v.record.schemaVersion))].sort(), [2, 3]);
  assert.ok(atlas.views.some(v => v.record.batchId === "synthetic-prompt-08"));
  assert.equal(atlas.setup.tutorPrompt, null);
});

test("v3: one bilingual tutor prompt is one setup, though each language sends a different system prompt", () => {
  const { d, evaluated } = sampleViews();
  assert.deepEqual(d.tutorPrompts.map(p => p.id + "@" + p.version), ["synthetic-coach@1.0.0", "synthetic-coach@1.1.0"]);
  const coach = d.runs.filter(r => r.tutor.tutorPromptVersion === "1.0.0");
  const byLang = lang => coach.filter(r => r.card.lang === lang);
  assert.ok(byLang("zh-CN").length && byLang("en").length);
  assert.equal(new Set(coach.map(r => r.tutor.tutorPromptHash)).size, 1);
  // The localized system prompt is the tutor's prompt, a blank line, then the card's setup, so it differs by language.
  assert.notEqual(byLang("zh-CN")[0].tutor.promptHash, byLang("en")[0].tutor.promptHash);
  assert.ok(byLang("en")[0].tutor.systemPrompt.endsWith("\n\n" + "Guide the learner; do not give the answer."));
  const g = setupWith(evaluated, r => r.tutor.tutorPromptVersion === "1.0.0");
  assert.deepEqual([...new Set(g.views.map(v => v.record.card.lang))].sort(), ["en", "zh-CN"]);
  assert.equal(g.views.length, coach.length);
  assert.equal(g.setup.tutorPrompt, coach[0].tutor.tutorPromptHash);
  // 1.1.0 changed one sentence: a different hash, a different setup.
  const next = setupWith(evaluated, r => r.tutor.tutorPromptVersion === "1.1.0");
  assert.notEqual(next.key, g.key);
});

test("v3: changing only the tutor prompt is read as one change, even under another tutor name", () => {
  const { evaluated } = sampleViews();
  const plain = setupWith(evaluated, r => r.batchId === "synthetic-prompt-08" && r.tutor.id === "atlas");
  const v100 = setupWith(evaluated, r => r.tutor.tutorPromptVersion === "1.0.0");
  const v110 = setupWith(evaluated, r => r.tutor.tutorPromptVersion === "1.1.0");

  // Same batch, same Atlas model, two names: the name is not a change, the prompt is.
  const a = M.compareSetups(plain.views, v100.views);
  assert.deepEqual(a.diff.map(x => x.part), ["tutor", "tutorPrompt"]);
  assert.equal(a.nameOnly, true);
  assert.equal(a.changes, 1);
  assert.deepEqual(a.mixed, []);
  assert.equal(a.cells, 6);

  // One prompt version against the next: one change, same name.
  const b = M.compareSetups(v100.views, v110.views);
  assert.deepEqual(b.diff.map(x => x.part), ["tutorPrompt"]);
  assert.equal(b.nameOnly, false);
  assert.equal(b.changes, 1);

  // Another model and another prompt: two changes, never put down to the prompt.
  const birch = setupWith(evaluated, r => r.batchId === "synthetic-pilot-02" && r.tutor.id === "birch" && underV1(r));
  const c = M.compareSetups(birch.views, v110.views);
  assert.equal(c.nameOnly, false);
  assert.equal(c.changes, 2);
});

test("v3: index rows are checked on the prompt id and version; v1 and v2 rows without them still pass", () => {
  const rows = M.parseJsonl(SAMPLE.index);
  assert.ok(rows.every(r => "tutorPromptId" in r && "tutorPromptVersion" in r));
  const coachRow = rows.find(r => r.tutorPromptVersion === "1.1.0");
  const stale = rows.map(r => (r === coachRow ? { ...r, tutorPromptVersion: "1.0.0" } : r));
  assert.deepEqual(M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, index: stale }).warnings, [{ code: "index_out_of_date", detail: coachRow.runId }]);
  const older = rows.map(r => { const o = { ...r }; delete o.tutorPromptId; delete o.tutorPromptVersion; return o; });
  assert.deepEqual(M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, index: older }).warnings, []);
});

test("v3: a record must carry the prompt its batch lists, and one prompt version must mean one hash", () => {
  const coach = SAMPLE.records.filter(r => r.tutor.tutorPromptVersion === "1.1.0");
  const changed = { ...coach[0], tutor: { ...coach[0].tutor, tutorPromptHash: "sha256:" + "0".repeat(64) } };
  const records = SAMPLE.records.map(r => (r.runId === changed.runId ? changed : r));
  const codes = M.buildDataset({ records, batches: SAMPLE.batches }).warnings.map(w => w.code + " " + w.detail);
  assert.deepEqual(codes.sort(), ["prompt_batch_mismatch " + changed.runId, "tutor_prompt_conflict synthetic-coach@1.1.0"].sort());
});

test("v3: batch info lists each tutor's prompt and keeps a budget stop beside a drift status", () => {
  const info = id => M.batchInfo(SAMPLE.batches.find(b => b.batchId === id));
  const drift = info("synthetic-drift-10");
  assert.equal(drift.status, "model_version_drift");
  assert.equal(drift.budgetStopReason, "budget_stop");
  assert.equal(drift.alsoStopped, "budget_stop");
  // When the budget is the stop itself, it is not repeated.
  const smoke = info("synthetic-smoke-03");
  assert.equal(smoke.status, "budget_stop");
  assert.equal(smoke.alsoStopped, null);
  const p8 = info("synthetic-prompt-08");
  assert.equal(p8.tutorSetups.length, 1);
  assert.equal(p8.tutorSetups[0].tutor, "Atlas · coach (synthetic)");
  assert.deepEqual([p8.tutorSetups[0].prompt.id, p8.tutorSetups[0].prompt.version], ["synthetic-coach", "1.0.0"]);
  assert.match(p8.tutorSetups[0].prompt.hash, /^sha256:[0-9a-f]{64}$/u);
  // A v2 batch has neither.
  const old = info("synthetic-older-00a");
  assert.equal(old.budgetStopReason, null);
  assert.deepEqual(old.tutorSetups, []);
  // The drift run is a calibration run: listed, never counted.
  const { views } = sampleViews();
  assert.ok(views.filter(v => v.record.batchId === "synthetic-drift-10").every(v => v.state === "calibration"));
});

test("v3: tutor parameters are compared by value, not by the order they were written in", () => {
  const a = record({ runId: "p1", tutor: { resolvedModel: "m", params: { temperature: 0.3, maxOutputTokens: 900 } } });
  const b = record({ runId: "p2", tutor: { resolvedModel: "m", params: { maxOutputTokens: 900, temperature: 0.3 } } });
  const c = record({ runId: "p3", tutor: { resolvedModel: "m", params: { maxOutputTokens: 900, temperature: 0 } } });
  const d = M.buildDataset({ records: [a, b, c], batches: [batch] });
  const views = d.runs.map(r => M.runView(r, V1, d.latestCard));
  const groups = M.setups(views);
  assert.equal(groups.length, 2);
  const cmp = M.compareSetups(groups[0].views, groups[1].views);
  assert.deepEqual(cmp.diff.map(x => x.part), ["tutorParams"]);
  assert.equal(cmp.changes, 1);
});

// ---------- record schema v4–v5, calibration reports and the review pack ----------
await import("./pack.js");
const P = globalThis.PremiumReviewPack;
const full = () => M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, index: M.parseJsonl(SAMPLE.index), reports: SAMPLE.reports, expectations: SAMPLE.expectations });
const CAL = "synthetic-calibration-13";

test("v5: the sample's calibration reports load, and the page shows them as written", () => {
  const d = full();
  assert.deepEqual(d.warnings, []);
  assert.equal(d.reports.size, 3);
  assert.deepEqual(M.calibrationBatches(d).map(b => b.batchId).slice(0, 3), [CAL, "synthetic-dryrun-12", "synthetic-cannot-check-11"]);
  const rep = d.reports.get(CAL), c = M.calibrationOf(d, CAL);
  assert.equal(c.machine.verdict, rep.verdict);
  assert.equal(c.machine.runsPassing, rep.runs.filter(x => x.pass).length);
  assert.equal(c.machine.groupsPassing, rep.groups.filter(g => !g.optional && g.pass).length);
  assert.deepEqual(c.machine.rewrite, rep.rewrite);
  assert.deepEqual(c.machine.discard, rep.discard);
  assert.equal(c.contentReview, "pending");
  // Thresholds come from the expectations, never from the page.
  assert.deepEqual({ ...c.criteria, rulesVersion: undefined }, { maxHard: 0, maxSoft: 1, minPassingRuns: 2, repeats: 3, rewriteRateMax: 0.2, rulesVersion: undefined });
  // Groups hold the adopted runs only; the interrupted record is kept apart.
  assert.equal(c.records.length, 19);
  assert.equal(c.adopted.length, 18);
  assert.deepEqual(c.groups.map(g => g.cells.map(x => x.runs.length)), [[3, 3], [3, 3], [3, 3]]);
  for (const g of c.groups) for (const cell of g.cells) for (const x of cell.runs) assert.equal(x.check.runId, x.record.runId);
  // Every reply sent back in the adopted runs is listed: the report's extra tries, plus one position per discarded
  // attempt where no reply was ever accepted.
  assert.equal(c.rejects.filter(x => !x.superseded).length, rep.rewrite.extraRewrites + rep.discard.discarded);
  assert.equal(c.deviations.length, rep.runs.reduce((n, x) => n + x.hard.length + x.soft.length, 0));
  assert.ok(c.deviations.some(x => x.n === null), "a whole-run deviation stays off the message grid");
  // A report is copied, not re-judged: a report that says PASS is shown as PASS.
  const said = { ...rep, verdict: "PASS" };
  const d2 = M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, reports: [said] });
  assert.equal(M.calibrationOf(d2, CAL).machine.verdict, "PASS");
  // Without expectations only the report's rewrite limit is known.
  assert.deepEqual(M.calibrationOf(d2, CAL).criteria, { rewriteRateMax: 0.2 });
  // Expectations written for another rules version do not apply.
  const other = M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, reports: SAMPLE.reports, expectations: [{ ...SAMPLE.expectations[0], rulesVersion: "9.9.9" }] });
  assert.equal(M.calibrationOf(other, CAL).expectations, null);
});

test("v5: a dry run, a report that could not check, and a batch without a report", () => {
  const d = full();
  const dry = M.calibrationOf(d, "synthetic-dryrun-12");
  assert.equal(dry.machine.verdict, "PASS");
  assert.equal(dry.machine.dryRun, true);
  assert.equal(dry.criteria.minPassingRuns, 1);
  const cannot = M.calibrationOf(d, "synthetic-cannot-check-11");
  assert.equal(cannot.cannotCheck, true);
  assert.equal(cannot.checked, false);
  assert.equal(cannot.machine, null);
  assert.equal(cannot.contentReview, "unstated");
  const none = M.calibrationOf(d, "synthetic-calibration-05");
  assert.equal(none.report, null);
  assert.equal(none.machine, null);
  assert.ok(none.groups.length > 0 && none.groups.every(g => g.cells.every(x => x.runs.every(y => y.check === null))));
  assert.deepEqual(none.deviations, []);
});

test("v5: attempts, drafts sent back and the call that wrote each accepted message", () => {
  const discard = SAMPLE.records.find(r => r.batchId === CAL && r.tutor.id === "calib-steady" && r.card.lang === "en" && r.repeat.index === 1);
  const atts = M.attemptsOf(discard);
  assert.deepEqual(atts.map(a => a.status), ["discarded", "kept"]);
  assert.deepEqual([...atts[0].byMessage.keys()], [2]);
  assert.equal(atts[0].byMessage.get(2).length, 3);
  assert.ok(atts[0].rejected.every(x => x.callInfo && x.callInfo.role === "student" && x.callInfo.n === x.call));
  assert.equal(atts[0].rejected[0].reply.json, false);
  for (const a of atts) for (const line of a.lines.filter(l => l.role === "student")) {
    if (line.fixed) assert.equal(line.callInfo, null);
    else assert.equal(line.callInfo.role, "student");
  }
  // The last attempt is the record's transcript.
  assert.deepEqual(atts[1].lines.map(l => l.text), discard.transcript.map(l => l.text));
  // A v1 record reads as one attempt with nothing sent back.
  const old = M.attemptsOf(record({ runId: "v1", transcript: [{ role: "student", text: "hi" }, { role: "tutor", turn: 1, text: "hello" }] }));
  assert.equal(old.length, 1);
  assert.equal(old[0].legacy, true);
  assert.equal(old[0].lines[0].n, 1);
  // A reply in one whole ```json fence is read; anything else is shown as written.
  const fenced = SAMPLE.records.find(r => r.batchId === CAL && r.transcript.some(l => l.checks && l.checks.fenceStripped));
  assert.ok(fenced, "sample lacks a fenced student reply");
  assert.ok(fenced.end.fenceStripped >= 1);
  const ok = M.parseStudentReply("```json\n{\"message\":\"hi\",\"stage\":2,\"events\":[\"pushback\"],\"end\":false}\n```");
  assert.deepEqual([ok.json, ok.fenced, ok.message, ok.stage, ok.events], [true, true, "hi", 2, ["pushback"]]);
  assert.equal(M.parseStudentReply("```json\n```json\n{}\n```\n```").json, false);
  assert.equal(M.parseStudentReply("plain words").message, "plain words");
  assert.equal(M.ruleFamily(["too_long"]), "format");
  assert.equal(M.ruleFamily(["fixed_test_missing"]), "protocol");
  assert.equal(M.ruleFamily(["invalid_stage"]), "state");
  assert.equal(M.ruleFamily(["something_new"]), "other");
  assert.deepEqual(M.parseCheckerLine("msg 3: missing event pushback"), { n: 3, text: "missing event pushback", line: "msg 3: missing event pushback" });
  assert.equal(M.parseCheckerLine("required mistake x not made").n, null);
});

test("v5: cache totals count only known splits, with their denominator; unknown is never zero", () => {
  const d = full(), raw = SAMPLE.batches.find(b => b.batchId === CAL), recs = d.runs.filter(r => r.batchId === CAL);
  const cache = M.cacheOf(raw, recs);
  assert.equal(cache.recorded, true);
  const learner = cache.models.find(m => m.model === "learner");
  assert.ok(learner.observed > 0 && learner.observed < learner.calls, "the sample needs known and unknown splits");
  assert.equal(learner.unknown, learner.calls - learner.observed);
  const calls = recs.flatMap(r => r.calls).filter(c => c.model === "learner" && c.cache.hitTokens != null);
  assert.equal(learner.hitTokens, calls.reduce((n, c) => n + c.cache.hitTokens, 0));
  assert.ok(learner.hitRate > 0 && learner.hitRate < 1);
  // The batch's own summary is kept as written: one unknown call makes its total unknown.
  assert.equal(learner.batch.hitTokens, null);
  // Scripted tutors send no input, so they have no cache to speak of.
  assert.ok(cache.models.filter(m => m.role === "tutor").every(m => m.observed === 0 && m.noInput === m.calls));
  // A v3 record has no cache field at all.
  const v3 = SAMPLE.records.find(r => r.schemaVersion === 3);
  assert.equal(M.cacheOf(null, [v3]).recorded, false);
});

test("v5: fingerprints count once per conversation, adopted and superseded apart, as the checker counts them", () => {
  const d = full(), raw = SAMPLE.batches.find(b => b.batchId === CAL), recs = d.runs.filter(r => r.batchId === CAL);
  const id = M.identityOf(raw, recs, d.supersededBy);
  assert.equal(id.target, "student");
  assert.equal(id.servingIdentity, "alias");
  assert.equal(id.multipleFingerprints, true);
  const student = id.roles.find(g => g.role === "student");
  const mine = student.fingerprints.map(f => [f.value, f.conversations, f.adopted, f.superseded]);
  const theirs = d.reports.get(CAL).fingerprintDistribution.map(f => [f.system_fingerprint, f.conversations, f.adopted, f.superseded]);
  assert.deepEqual(mine.sort(), theirs.sort());
  assert.deepEqual(student.requested, ["Learner"]);
  assert.deepEqual(student.returned, ["learner-2026-11"]);
  // Before v4 nothing about identity was recorded, and the page says so rather than showing null.
  const v3 = SAMPLE.records.find(r => r.schemaVersion === 3 && r.batchKind === "evaluation");
  const old = M.identityOf(null, [v3], {}).roles.find(g => g.role === "tutor");
  assert.equal(old.unrecorded, old.calls);
  assert.deepEqual(old.fingerprints.map(f => f.value), [undefined]);
});

test("v5: transport errors and retries, with the record that replaced an interrupted run", () => {
  const d = full(), recs = d.runs.filter(r => r.batchId === CAL);
  const tr = M.transportOf(recs, d.supersededBy);
  const timeout = tr.find(x => x.error === "timeout");
  assert.ok(timeout && timeout.costEstimated, "a failed call is charged at its reservation");
  const retry = tr.find(x => x.runId === timeout.runId && x.retry);
  assert.equal(retry.error, null);
  assert.equal(retry.retryDelayMs, 1500);
  assert.equal(retry.n, timeout.n + 1);
  // A conversation that ended on a provider error and was restarted points to its restart; budget stops are not
  // transport errors.
  const call = (n, extra) => ({ n, role: "student", model: "m", usd: 0.001, retryDelayMs: 0, error: null, ...extra });
  const cut = { ...v2({ runId: "cut", status: "error", endReason: "error", scorings: [] }), calls: [call(1), call(2, { error: "provider_error", costEstimated: true }), call(3, { error: "budget_stop" })] };
  const redo = { ...v2({ runId: "redo", restartOf: "cut", scorings: [] }), calls: [call(1)] };
  const rows = M.transportOf([cut, redo], { cut: "redo" });
  assert.deepEqual(rows.map(x => [x.runId, x.n, x.error, x.replacedBy]), [["cut", 2, "provider_error", "redo"]]);
});

test("v5: a recovered batch keeps its old stop as history, not as its status", () => {
  assert.deepEqual(M.batchHistory({ status: "complete", stopReason: "provider_error" }), { status: "complete", earlierStop: "provider_error", topUps: [] });
  assert.deepEqual(M.batchHistory({ status: "budget_stop", stopReason: "budget_stop" }), { status: "budget_stop", earlierStop: null, topUps: [] });
  assert.deepEqual(M.batchHistory({ status: "complete" }), { status: "complete", earlierStop: null, topUps: [] });
  // A top-up is part of the batch's history even when the batch then completed.
  const cal = SAMPLE.batches.find(b => b.batchId === "synthetic-calibration-13");
  assert.deepEqual(M.batchHistory(cal).topUps.map(x => [x.from, x.to]), [[0.006, 0.05]]);
});

test("v5: reports and expectations that do not fit are reported, not trusted", () => {
  const rep = SAMPLE.reports.find(r => r.batchId === CAL);
  const evalBatch = SAMPLE.batches.find(b => b.batchId === "synthetic-pilot-02");
  const d = M.buildDataset({ records: SAMPLE.records, batches: SAMPLE.batches, expectations: [{ card: null }],
    reports: [rep, { ...rep, verdict: "PASS" }, { batchId: "gone", verdict: "CANNOT_CHECK" }, { batchId: evalBatch.batchId, verdict: "CANNOT_CHECK" },
      { ...SAMPLE.reports.find(r => r.batchId === "synthetic-dryrun-12"), runs: [{ runId: "run-missing", pass: true, hard: [], soft: [] }] },
      { batchId: "x", verdict: "FAIL" }] });
  assert.deepEqual(d.warnings.map(w => w.code + ":" + w.detail).sort(), ["not_a_report:x", "not_expectations:?", "report_conflict:" + CAL,
    "report_not_calibration:synthetic-pilot-02", "report_run_missing:run-missing", "report_without_batch:gone"].sort());
  assert.equal(d.reports.get(CAL).verdict, "FAIL", "the first report of a batch is kept");
  assert.equal(M.isReport({ batchId: "b", verdict: "CANNOT_CHECK" }), true);
  assert.equal(M.isReport(SAMPLE.batches[0]), false);
  assert.equal(M.isExpectations(SAMPLE.expectations[0]), true);
});

test("review index: one row per record; checker results are copied from the report, counts from the record", () => {
  const d = full(), rep = d.reports.get(CAL), rows = M.reviewIndex(d, CAL);
  assert.equal(rows.length, 19);
  for (const row of rows) assert.deepEqual(Object.keys(row), M.REVIEW_COLUMNS);
  const adopted = rows.filter(r => r.record_role === "adopted"), superseded = rows.filter(r => r.record_role === "superseded");
  assert.equal(adopted.length, 18);
  assert.equal(superseded.length, 1);
  assert.equal(superseded[0].checker_pass, "NOT_EVALUATED");
  assert.equal(superseded[0].replaced_by, adopted.find(r => r.restart_of === superseded[0].run_id).run_id);
  for (const row of adopted) {
    const x = rep.runs.find(y => y.runId === row.run_id);
    assert.equal(row.checker_pass, x.pass ? "PASS" : "FAIL");
    assert.deepEqual([row.checker_hard, row.checker_soft, row.report_extra_rewrites], [x.hard, x.soft, x.extraRewrites]);
    assert.equal(row.record_path, "records/" + row.run_id + ".json");
  }
  assert.ok(rows.some(r => r.transport_errors.startsWith("call ")), "the timeout is listed");
  assert.ok(rows.some(r => r.discarded_attempts === 1 && r.attempt_stops.length === 1));
  assert.ok(M.reviewIndex(d, "synthetic-cannot-check-11").every(r => r.checker_pass === "CANNOT_CHECK"));
  assert.ok(M.reviewIndex(d, "synthetic-calibration-05").every(r => r.checker_pass === "NO_REPORT"));
});

// A minimal reader for the stored zips the pack writes: the end record, the central directory, then each local entry.
function readZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const end = bytes.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  const count = v.getUint16(end + 10, true), size = v.getUint32(end + 12, true), start = v.getUint32(end + 16, true);
  assert.equal(start + size, end);
  const out = [];
  for (let i = 0, at = start; i < count; i++) {
    assert.equal(v.getUint32(at, true), 0x02014b50);
    assert.equal(v.getUint16(at + 8, true) & 0x0800, 0x0800, "names are flagged as UTF-8");
    assert.equal(v.getUint16(at + 10, true), 0, "stored, not compressed");
    const crc = v.getUint32(at + 16, true), len = v.getUint32(at + 20, true), nameLen = v.getUint16(at + 28, true), local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    assert.equal(v.getUint32(local, true), 0x04034b50);
    const dataAt = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.subarray(dataAt, dataAt + len);
    assert.equal(P.crc32(data), crc);
    out.push({ name, data });
    at += 46 + nameLen;
  }
  return out;
}

test("review pack: SHA-256, CRC-32, a stored zip with UTF-8 names, and CSV that spreadsheet programs read", async () => {
  const { createHash } = await import("node:crypto");
  for (const s of ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "b".repeat(1000), "复核包 · review"]) {
    assert.equal(P.sha256(s), createHash("sha256").update(s, "utf8").digest("hex"));
  }
  assert.equal(P.crc32("123456789"), 0xcbf43926);
  const files = [{ path: "pack/records/run-a.json", data: "{\"a\":1}\n" }, { path: "pack/说明.txt", data: "中文\n" }, { path: "pack/bin", data: new Uint8Array([0, 255, 10]) }];
  const zip = P.zip(files, "2026-11-26T08:00:00.000Z");
  const back = readZip(zip);
  assert.deepEqual(back.map(f => f.name), files.map(f => f.path));
  back.forEach((f, i) => assert.deepEqual([...f.data], [...P.bytesOf(files[i].data)]));
  assert.deepEqual([...P.zip(files, "2026-11-26T08:00:00.000Z")], [...zip], "one export time gives the same bytes");
  const csv = P.csv(["a", "b", "c"], [{ a: "x,y", b: "say \"hi\"", c: { k: [1] } }, { a: "two\nlines", b: null, c: 3 }]);
  assert.ok(csv.startsWith("﻿a,b,c\r\n"));
  assert.equal(csv, "﻿a,b,c\r\n\"x,y\",\"say \"\"hi\"\"\",\"{\"\"k\"\":[1]}\"\r\n\"two\nlines\",,3\r\n");
  // The review index of the sample goes through it whole.
  const rows = M.reviewIndex(full(), CAL);
  assert.equal(P.csv(M.REVIEW_COLUMNS, rows).split("\r\n").length, rows.length + 2);
});
