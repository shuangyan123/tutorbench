// Data model for the premium runs dashboard. Pure functions only: no DOM, no network.
// Loaded as a classic script in the page (works from file://) and imported by the Node tests.
// Input is the premium runner's output: records/<runId>.json, batches/<batchId>.json, index.jsonl.
// Record and batch schema v1 and v2 are both read. v2 adds calibration batches (status "unscored", never scored),
// budget restarts (restartOf), review flags, fixedTestSkipped and cost reconciliation.
(function (root) {
  "use strict";

  const RECORD_SCHEMA = "tutorbench.premium-run-record";
  const BATCH_SCHEMA = "tutorbench.premium-batch";
  const VERDICTS = ["good", "flawed", "fail"];
  const ITEMS = ["correct", "readsState", "helpFit", "noLeak", "responds", "helpLevel"];
  const SCHEMA_VERSIONS = [1, 2];
  // States that are listed but never part of an evaluation: a calibration run checks the simulated student only,
  // and a superseded run was interrupted by the budget and replaced by a restart.
  const NOT_EVALUATION = ["calibration", "superseded"];

  function parseJsonl(text) {
    const rows = [];
    String(text).split(/\r?\n/u).forEach((line, i) => {
      if (!line.trim()) return;
      try { rows.push(JSON.parse(line)); } catch { throw new Error("index.jsonl line " + (i + 1) + " is not valid JSON"); }
    });
    return rows;
  }

  function compareVersions(a, b) {
    const pa = String(a).split("."), pb = String(b).split(".");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] ?? "0", y = pb[i] ?? "0";
      const nx = Number(x), ny = Number(y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) { if (nx !== ny) return nx - ny; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  const currentScoring = record => (Array.isArray(record.scorings) && record.scorings.length ? record.scorings[record.scorings.length - 1] : null);
  const isCalibration = record => record.batchKind === "calibration" || record.status === "unscored";
  const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

  // Builds one dataset from whatever the person loaded. Unknown files are reported, never trusted.
  function buildDataset(input) {
    const warnings = [];
    const runs = new Map();
    const names = input.recordNames || [];
    (input.records || []).forEach((r, i) => {
      if (!r || r.schema !== RECORD_SCHEMA || !SCHEMA_VERSIONS.includes(r.schemaVersion) || typeof r.runId !== "string") {
        warnings.push({ code: "not_a_record", detail: r && r.runId ? r.runId : names[i] || "?" });
        return;
      }
      if (runs.has(r.runId)) {
        if (JSON.stringify(runs.get(r.runId)) !== JSON.stringify(r)) warnings.push({ code: "duplicate_run_differs", detail: r.runId });
        return;
      }
      runs.set(r.runId, r);
    });
    const batches = new Map();
    for (const b of input.batches || []) {
      if (!b || b.schema !== BATCH_SCHEMA || typeof b.batchId !== "string") { warnings.push({ code: "not_a_batch", detail: b && b.batchId ? b.batchId : "?" }); continue; }
      batches.set(b.batchId, b);
    }
    const list = [...runs.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.runId.localeCompare(b.runId));

    // Card versions: newest version per card id; one version must always mean one content hash.
    const latestCard = {}, hashes = {};
    for (const r of list) {
      const { id, version, contentHash } = r.card;
      if (!latestCard[id] || compareVersions(version, latestCard[id]) > 0) latestCard[id] = version;
      const key = id + "@" + version;
      if (hashes[key] && hashes[key] !== contentHash) warnings.push({ code: "card_hash_conflict", detail: key });
      hashes[key] = hashes[key] || contentHash;
    }
    for (const r of list) if (!batches.has(r.batchId)) warnings.push({ code: "batch_missing", detail: r.batchId });

    // Budget restarts: the restarted record names the interrupted one, which stays on file but no longer counts.
    const supersededBy = {};
    for (const r of list) {
      if (!r.restartOf) continue;
      if (!runs.has(r.restartOf)) warnings.push({ code: "restart_target_missing", detail: r.runId });
      else if (supersededBy[r.restartOf]) warnings.push({ code: "restarted_twice", detail: r.restartOf });
      else supersededBy[r.restartOf] = r.runId;
    }

    // Judge configurations in order of first use.
    const seen = new Map();
    for (const r of list) for (const s of r.scorings || []) {
      const v = s.judgeConfig && s.judgeConfig.version;
      if (v && (!seen.has(v) || String(s.createdAt) < seen.get(v))) seen.set(v, String(s.createdAt));
    }
    const judgeVersions = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([v]) => v);

    // index.jsonl must agree with the records it was built from.
    if (input.index) {
      for (const row of input.index) {
        const r = runs.get(row.runId);
        if (!r) { warnings.push({ code: "index_row_without_record", detail: row.runId }); continue; }
        const s = currentScoring(r);
        const status = s ? (s.merged && s.merged.verdict ? "scored" : "needs_review") : r.status;
        const m = s && s.merged;
        // v2 rows also carry batchKind, reviewFlags and fixedTestSkipped; v1 rows do not, so only present fields are compared.
        const v2Differs = ("batchKind" in row && row.batchKind !== (r.batchKind ?? "evaluation"))
          || ("reviewFlags" in row && !sameList(row.reviewFlags, m && m.reviewFlags))
          || ("fixedTestSkipped" in row && row.fixedTestSkipped !== !!(m && m.fixedTestSkipped));
        if (v2Differs || row.status !== status || (row.scoringId ?? null) !== (s ? s.scoringId : null) || (row.verdict ?? null) !== (m ? m.verdict ?? null : null)) {
          warnings.push({ code: "index_out_of_date", detail: row.runId });
        }
      }
      const indexed = new Set(input.index.map(row => row.runId));
      for (const id of runs.keys()) if (!indexed.has(id)) warnings.push({ code: "record_not_in_index", detail: id });
    }
    return { runs: list, batches: [...batches.values()], latestCard, judgeVersions, supersededBy, warnings };
  }

  // The state a run counts as under the selected judge configuration.
  // Only the CURRENT scoring decides; an older scoring under another configuration never fills in.
  // supersededBy is the dataset's map from an interrupted run to the run that replaced it.
  function runView(record, selectedVersion, latestCard, supersededBy) {
    const s = currentScoring(record);
    const reason = record.end && record.end.reason;
    const view = {
      record, scoring: s, state: "needs_review", verdict: null, reasons: [], pending: [], reviewFlags: [],
      withheldVerdict: null, fixedTestSkipped: false, scoringIncomplete: false, judgeErrors: [], judgeRepairs: [], disagreements: [],
      olderCard: latestCard ? record.card.version !== latestCard[record.card.id] : false,
      judgeVersion: s && s.judgeConfig ? s.judgeConfig.version : null,
      calibration: isCalibration(record), supersededBy: (supersededBy && supersededBy[record.runId]) || null, restartOf: record.restartOf || null,
    };
    if (view.calibration) { view.state = "calibration"; return view; }
    if (view.supersededBy) { view.state = "superseded"; return view; }
    if (reason === "error" || record.status === "error") { view.state = "error"; return view; }
    if (reason === "student_invalid" || record.status === "student_invalid") { view.state = "student_invalid"; return view; }
    if (!s) { view.pending = ["no_scoring"]; view.scoringIncomplete = true; return view; }
    view.pending = Array.isArray(s.pending) ? s.pending.slice() : [];
    view.disagreements = Array.isArray(s.disagreements) ? s.disagreements : [];
    view.judgeErrors = (s.perJudge || []).filter(j => j.error || !j.output).map(j => ({ judgeId: j.judgeId, error: j.error || "no_output" }));
    // v2: an invalid ballot is sent back to the same judge once; the rejected replies are kept.
    view.judgeRepairs = (s.perJudge || []).filter(j => Array.isArray(j.rejected) && j.rejected.length)
      .map(j => ({ judgeId: j.judgeId, reasons: j.rejected.map(x => x.reason), recovered: !!j.output }));
    // v2 keeps a withheld rule verdict on the scoring (incomplete panel, merged is null); v1 kept it inside merged.
    view.withheldVerdict = s.withheldRuleVerdict || null;
    // Scoring not finished: no merged result, or a judge in the panel gave no valid ballot.
    view.scoringIncomplete = !s.merged || view.pending.includes("incomplete_panel");
    const m = s.merged;
    if (m) {
      view.reasons = Array.isArray(m.reasons) ? m.reasons : [];
      view.reviewFlags = Array.isArray(m.reviewFlags) ? m.reviewFlags : [];
      view.fixedTestSkipped = !!m.fixedTestSkipped;
      view.withheldVerdict = view.withheldVerdict || m.withheldRuleVerdict || null;
    }
    if (selectedVersion && view.judgeVersion !== selectedVersion) { view.state = "other_version"; return view; }
    if (m && m.verdict && VERDICTS.includes(m.verdict) && !view.pending.length) { view.state = "scored"; view.verdict = m.verdict; }
    return view;
  }

  // Formal pass rate: only runs in state "scored" under the selected configuration count.
  // needs_review, error, student_invalid, runs scored under another configuration, calibration runs and superseded runs
  // are listed, never counted.
  function summarize(views) {
    const t = { total: views.length, scored: 0, good: 0, flawed: 0, fail: 0, needsReview: 0, scoringIncomplete: 0,
      otherVersion: 0, error: 0, studentInvalid: 0, calibration: 0, superseded: 0, passRate: null, goodRate: null, failRate: null };
    for (const v of views) {
      if (v.state === "scored") { t.scored++; t[v.verdict]++; }
      else if (v.state === "needs_review") { t.needsReview++; if (v.scoringIncomplete) t.scoringIncomplete++; }
      else if (v.state === "other_version") t.otherVersion++;
      else if (v.state === "error") t.error++;
      else if (v.state === "student_invalid") t.studentInvalid++;
      else if (v.state === "calibration") t.calibration++;
      else if (v.state === "superseded") t.superseded++;
    }
    if (t.scored) {
      t.passRate = (t.good + t.flawed) / t.scored;
      t.goodRate = t.good / t.scored;
      t.failRate = t.fail / t.scored;
    }
    return t;
  }

  const tutorTurn = (record, turn) => (record.transcript || []).find(m => m.role === "tutor" && m.turn === turn) || null;

  // Evidence for a deterministic failure: what a reviewer needs to confirm it without rereading the whole run.
  function failureEvidence(view) {
    const { record, scoring } = view;
    // A v2 withheld verdict has no merged result (incomplete panel), so only record-based evidence exists for it.
    const m = (scoring && scoring.merged) || { reasons: [] };
    const failing = view.verdict === "fail" || view.withheldVerdict === "fail";
    if (!scoring || !failing) return [];
    const out = [];
    if ((m.reasons || []).includes("leak")) {
      for (const turn of m.leakTurns || []) {
        const quotes = (scoring.perJudge || []).filter(j => j.output && j.output.turns && j.output.turns[turn - 1] && j.output.turns[turn - 1].noLeak === false)
          .map(j => ({ judgeId: j.judgeId, evidence: j.output.turns[turn - 1].evidence, helpLevel: j.output.turns[turn - 1].helpLevel }));
        const t = tutorTurn(record, turn);
        out.push({ kind: "leak", turn, tutorText: t ? t.text : null, quotes, afterFixedTest: !!m.leakAfterFixedTest });
      }
    }
    if ((m.reasons || []).includes("student_left") || record.end.reason === "left") {
      const students = (record.transcript || []).filter(x => x.role === "student");
      const last = students[students.length - 1];
      out.push({ kind: "student_left", message: last ? last.text : null, studentMessage: students.length, stage: record.end.finalStage });
    }
    if ((m.reasons || []).includes("unsolved_tutor_fault")) {
      const votes = (scoring.perJudge || []).filter(j => j.output).map(j => ({ judgeId: j.judgeId, tutorFault: (j.output.overall.reasons || []).includes("unsolved_tutor_fault") }));
      out.push({ kind: "unsolved_tutor_fault", tutorTurns: record.end.tutorTurns, votes });
    }
    return out;
  }

  // Student behaviour checks: soft flags are kept, hard failures were rewritten or discarded.
  function studentChecks(record) {
    const students = (record.transcript || []).filter(m => m.role === "student");
    const perMessage = students.map((m, i) => ({ n: i + 1, softFlags: (m.checks && m.checks.softFlags) || [], hardFails: (m.checks && m.checks.hardFails) || [],
      regenerated: (m.checks && m.checks.regenerated) || 0 })).filter(x => x.softFlags.length || x.hardFails.length || x.regenerated);
    const attempts = record.attempts || [];
    return {
      softFlags: (record.end && record.end.softFlags) || [],
      perMessage,
      rewrites: perMessage.reduce((n, x) => n + x.regenerated, 0),
      rejected: attempts.flatMap(a => (a.rejected || []).map(r => ({ attempt: a.attempt, ...r }))),
      discardedAttempts: attempts.filter(a => a.status === "discarded").length,
      behavioursNotFired: (record.end && record.end.behavioursNotFired) || [],
      scriptedMistakesMissing: (record.end && record.end.scriptedMistakesMissing) || [],
    };
  }

  const itemOf = where => {
    const m = /^turn \d+ \/ (\w+)$/u.exec(where);
    return m ? m[1] : where;
  };

  // Who was outvoted, and on what. A judge is in the minority when its vote differs from the merged value.
  function disagreementSummary(views) {
    const byJudge = {}, byItem = {};
    let runsWith = 0, total = 0;
    for (const v of views) {
      if (!v.scoring || !v.disagreements.length) continue;
      runsWith++;
      for (const d of v.disagreements) {
        total++;
        const item = itemOf(d.where);
        byItem[item] = (byItem[item] || 0) + 1;
        for (const [judge, vote] of Object.entries(d.votes || {})) {
          byJudge[judge] = byJudge[judge] || { minority: 0, tie: 0 };
          if (d.merged === null || d.merged === undefined) byJudge[judge].tie++;
          else if (vote !== d.merged) byJudge[judge].minority++;
        }
      }
    }
    return { runsWith, total, byJudge, byItem };
  }

  // Costs are the runner's price-table estimates. A v2 call with no usage from the provider is charged at its
  // reservation and marked costEstimated; those calls are counted so the page can say so.
  function costs(record) {
    const run = record.usage ? record.usage.totalUsd : null;
    const rescoring = (record.scorings || []).slice(1).map(s => ({ scoringId: s.scoringId, usd: s.usage ? s.usage.totalUsd : null }));
    const calls = [...(record.calls || []), ...(record.scorings || []).slice(1).flatMap(s => s.calls || [])];
    return { run, rescoring, estimatedCalls: calls.filter(c => c && c.costEstimated === true).length };
  }

  // A batch as the page shows it. v1 batches have no kind, hard cap, top-ups or reconciliation.
  function batchInfo(b) {
    const runs = b.runs || {};
    const history = Array.isArray(b.reconciliationHistory) ? b.reconciliationHistory : [];
    const reconciled = Object.entries(b.reconciledUsd || {}).map(([provider, actualUsd]) => {
      const last = history.filter(h => h.provider === provider).slice(-1)[0] || null;
      const estimatedUsd = last && typeof last.estimated === "number" ? last.estimated : null;
      return { provider, actualUsd, estimatedUsd, diffUsd: estimatedUsd == null ? null : Math.round((actualUsd - estimatedUsd) * 1e9) / 1e9,
        reason: last ? last.reason || "" : "", at: last ? last.at || null : null };
    }).sort((a, c) => a.provider.localeCompare(c.provider));
    return {
      batchId: b.batchId, kind: b.kind || "evaluation", status: b.status || null, createdAt: b.createdAt || null,
      planned: b.planned ?? runs.planned ?? null,
      done: (runs.scored || 0) + (runs.error || 0) + (runs.studentInvalid || 0) + (runs.needsReview || 0) + (runs.unscored || 0),
      superseded: runs.superseded || 0,
      spentUsd: b.spentUsd ?? null, budgetUsd: b.budgetUsd ?? null, hardCapUsd: b.hardCapUsd ?? null, hardCapReached: b.hardCapReached === true,
      topUps: Array.isArray(b.budgetHistory) ? b.budgetHistory.map(h => ({ at: h.at || null, from: h.from ?? null, to: h.to ?? null })) : [],
      reconciled,
    };
  }

  function groupBy(views, key) {
    const out = new Map();
    for (const v of views) {
      const k = key(v);
      if (!out.has(k)) out.set(k, []);
      out.get(k).push(v);
    }
    return out;
  }

  const api = { parseJsonl, compareVersions, buildDataset, currentScoring, runView, summarize, failureEvidence,
    studentChecks, disagreementSummary, costs, batchInfo, groupBy, itemOf, VERDICTS, ITEMS, NOT_EVALUATION };
  root.PremiumDashboardModel = api;
})(globalThis);
