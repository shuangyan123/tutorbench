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

function record({ runId, status = "scored", endReason = "curt_exit", card = {}, scorings = [scoring()], transcript = [], createdAt = "2026-11-24T10:00:00.000Z", tutor = {} }) {
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
