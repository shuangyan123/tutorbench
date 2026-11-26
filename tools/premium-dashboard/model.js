// Data model for the premium runs dashboard. Pure functions only: no DOM, no network.
// Loaded as a classic script in the page (works from file://) and imported by the Node tests.
// Input is the premium runner's output: records/<runId>.json, batches/<batchId>.json, index.jsonl.
// Record schema v1, v2 and v3 are all read, together. v2 adds calibration batches (status "unscored", never scored),
// budget restarts (restartOf), review flags, fixedTestSkipped and cost reconciliation. v3 adds the tutor's own prompt
// (tutorPromptId, tutorPromptVersion and a language-independent tutorPromptHash) and the effective tutor parameters;
// its batch lists each tutor's prompt identity and keeps a financial stop (budgetStopReason) beside a drift status.
(function (root) {
  "use strict";

  const RECORD_SCHEMA = "tutorbench.premium-run-record";
  const BATCH_SCHEMA = "tutorbench.premium-batch";
  const VERDICTS = ["good", "flawed", "fail"];
  const ITEMS = ["correct", "readsState", "helpFit", "noLeak", "responds", "helpLevel"];
  const SCHEMA_VERSIONS = [1, 2, 3];
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

    // Tutor prompts (v3): one id and version must always mean one prompt hash, as the runner's ledger enforces, and a
    // record must carry the prompt its batch lists for that tutor. Records before v3 have no prompt of the tutor's own.
    const prompts = new Map(), promptKeys = {};
    for (const r of list) {
      const t = r.tutor || {}, h = t.tutorPromptHash || null;
      if (h) {
        const key = t.tutorPromptId + "@" + t.tutorPromptVersion;
        if (promptKeys[key] && promptKeys[key] !== h) warnings.push({ code: "tutor_prompt_conflict", detail: key });
        promptKeys[key] = promptKeys[key] || h;
        if (!prompts.has(h)) prompts.set(h, { hash: h, id: t.tutorPromptId ?? null, version: t.tutorPromptVersion ?? null, firstAt: String(r.createdAt || "") });
      }
      const bt = ((batches.get(r.batchId) || {}).tutors || []).find(x => x && x.id === t.id);
      if (bt && ((bt.prompt && bt.prompt.hash) || null) !== h) warnings.push({ code: "prompt_batch_mismatch", detail: r.runId });
    }

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
        // v3 rows add the tutor's prompt id and version (null when it has none).
        const v2Differs = ("batchKind" in row && row.batchKind !== (r.batchKind ?? "evaluation"))
          || ("reviewFlags" in row && !sameList(row.reviewFlags, m && m.reviewFlags))
          || ("fixedTestSkipped" in row && row.fixedTestSkipped !== !!(m && m.fixedTestSkipped))
          || ("tutorPromptId" in row && row.tutorPromptId !== (r.tutor.tutorPromptId ?? null))
          || ("tutorPromptVersion" in row && row.tutorPromptVersion !== (r.tutor.tutorPromptVersion ?? null));
        if (v2Differs || row.status !== status || (row.scoringId ?? null) !== (s ? s.scoringId : null) || (row.verdict ?? null) !== (m ? m.verdict ?? null : null)) {
          warnings.push({ code: "index_out_of_date", detail: row.runId });
        }
      }
      const indexed = new Set(input.index.map(row => row.runId));
      for (const id of runs.keys()) if (!indexed.has(id)) warnings.push({ code: "record_not_in_index", detail: id });
    }
    const tutorPrompts = [...prompts.values()].sort((a, b) => a.firstAt.localeCompare(b.firstAt) || a.hash.localeCompare(b.hash));
    return { runs: list, batches: [...batches.values()], latestCard, judgeVersions, supersededBy, tutorPrompts, warnings };
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
  // Wilson score interval for k passes out of n scored runs (95% by default). Unlike p ± z·se it stays inside 0..1
  // and does not collapse to a point at 0% or 100%, which matters with the 5–15 runs a tutor usually has per view.
  function wilson(k, n, z = 1.96) {
    if (!n) return null;
    const p = k / n, z2 = z * z, d = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / d;
    const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / d;
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
  }

  function summarize(views) {
    const t = { total: views.length, scored: 0, good: 0, flawed: 0, fail: 0, needsReview: 0, scoringIncomplete: 0,
      otherVersion: 0, error: 0, studentInvalid: 0, calibration: 0, superseded: 0, passRate: null, passRange: null, goodRate: null, failRate: null };
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
      t.passRange = wilson(t.good + t.flawed, t.scored);
      t.goodRate = t.good / t.scored;
      t.failRate = t.fail / t.scored;
    }
    return t;
  }

  // A tutor's version is the model the provider reported, else the pinned or requested one. The system prompt is not
  // part of it, because it changes with the card and language, and neither is the tutor's own prompt (v3): a new prompt
  // is a change of setup, which compareSetups reads.
  function versionKey(record) {
    const t = (record && record.tutor) || {};
    return t.resolvedModel || t.pinnedVersion || t.requestedModel || "unknown";
  }

  // Every tutor's versions, oldest first by when each first appears in the given records. Pass all loaded records, so
  // the order never depends on a filter, and running an old version again later does not make it the newest.
  function tutorVersions(records) {
    const out = new Map();
    for (const r of records) {
      const tutor = r && r.tutor && r.tutor.label;
      if (!tutor) continue;
      const key = versionKey(r), at = String(r.createdAt || "");
      if (!out.has(tutor)) out.set(tutor, []);
      const list = out.get(tutor), hit = list.find(x => x.key === key);
      if (hit) { if (at < hit.firstAt) hit.firstAt = at; }
      else list.push({ key, label: key, firstAt: at });
    }
    for (const list of out.values()) list.sort((a, b) => a.firstAt.localeCompare(b.firstAt) || a.key.localeCompare(b.key));
    return out;
  }

  // The newest version of each tutor among the given views, by the order from tutorVersions.
  function latestVersions(views, versions) {
    const out = new Map();
    for (const [tutor, group] of groupBy(views, v => v.record.tutor.label)) {
      const keys = new Set(group.map(v => versionKey(v.record)));
      const order = (versions.get(tutor) || []).filter(o => keys.has(o.key));
      if (order.length) out.set(tutor, order[order.length - 1]);
    }
    return out;
  }

  // How each tutor's pass rate moved across its versions. Versions are compared only on the card versions and
  // languages that every one of them has scored runs on, so a version is never judged on easier cards. The change is
  // the newest version against the one before it, and it is called clear only when their 95% ranges do not overlap.
  function versionTrend(views, versions) {
    const cell = v => v.record.card.id + "@" + v.record.card.version + "/" + v.record.card.lang;
    const out = [];
    for (const [tutor, group] of groupBy(views, v => v.record.tutor.label)) {
      const present = (versions.get(tutor) || []).filter(o => group.some(v => versionKey(v.record) === o.key));
      if (present.length < 2) continue;
      const byVersion = present.map(o => group.filter(v => versionKey(v.record) === o.key));
      const sets = byVersion.map(list => new Set(list.filter(v => v.state === "scored").map(cell)));
      const common = new Set([...sets[0]].filter(k => sets.every(s => s.has(k))));
      const points = present.map((o, i) => {
        const runs = byVersion[i].filter(v => common.has(cell(v)));
        return { key: o.key, label: o.label, firstAt: o.firstAt, runs, total: byVersion[i].length, s: summarize(runs) };
      });
      const [prev, last] = points.slice(-2);
      const delta = prev.s.passRate != null && last.s.passRate != null ? last.s.passRate - prev.s.passRate : null;
      const clear = delta != null && (last.s.passRange.lo > prev.s.passRange.hi || last.s.passRange.hi < prev.s.passRange.lo);
      out.push({ tutor, points, cells: common.size, delta, clear });
    }
    return out;
  }

  // The parts of a run's setup that a fair comparison holds fixed. Cards are not a part: they are matched cell by cell
  // (card version and language). A prompt of the tutor's own (v3) is read from tutor.tutorPromptHash, which is the same
  // for its Chinese and English text; without one, the tutor's system prompt is the card's setup alone. Per-language or
  // per-card prompt hashes (tutor.promptHash, the judge prompt) are never parts: they would split one setup by language.
  const SETUP_PARTS = ["tutor", "tutorModel", "tutorPrompt", "tutorParams", "studentModel", "studentParams", "judgeConfig", "rules"];
  function setupOf(v) {
    const r = v.record, t = r.tutor || {}, s = r.student || {}, jc = v.scoring && v.scoring.judgeConfig;
    return {
      tutor: t.label || "unknown",
      tutorModel: versionKey(r),
      tutorPrompt: t.tutorPromptHash || null,
      tutorParams: canonical(t.params),
      studentModel: s.resolvedModel || s.pinnedVersion || s.requestedModel || null,
      studentParams: canonical(s.params),
      // The judge prompt differs by language, so the configuration's version names it, not the prompt hash.
      judgeConfig: jc ? jc.version || null : null,
      rules: (r.card && r.card.rulesVersion) || null,
    };
  }
  // Parameters as JSON with sorted keys, so the order they were written in never splits a setup.
  function canonical(o) {
    if (!o || typeof o !== "object") return JSON.stringify(o ?? null);
    return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])));
  }
  const setupKey = v => { const s = setupOf(v); return SETUP_PARTS.map(p => String(s[p])).join("\u0001"); };

  // The distinct setups among the views, each with its runs, in tutor order and then by first run.
  function setups(views) {
    return [...groupBy(views, setupKey)].map(([key, group]) => {
      const times = group.map(v => String(v.record.createdAt || "")).sort();
      return { key, setup: setupOf(group[0]), views: group, firstAt: times[0], lastAt: times[times.length - 1], batches: [...new Set(group.map(v => v.record.batchId))].sort() };
    }).sort((a, b) => a.setup.tutor.localeCompare(b.setup.tutor) || a.firstAt.localeCompare(b.firstAt));
  }

  // Compare setup B against setup A. First say what differs; a result can be read as the effect of one change only when
  // exactly one part differs. Another tutor counts as one change, its model included. Two tutor names for the same model
  // from the same developer and provider are no change at all: in one batch, a tutor with a prompt of its own and the
  // same model without it need two names, and the prompt is then the only change. Runs are matched on the card versions
  // and languages both sides scored, and a change is clear only when the 95% ranges do not overlap.
  const routeOf = v => { const t = v.record.tutor || {}; return [t.developer, t.provider, versionKey(v.record)].map(x => String(x ?? "")).join("/"); };
  function compareSetups(a, b) {
    const valuesOf = (list, part) => [...new Set(list.map(v => String(setupOf(v)[part])))];
    const diff = [], mixed = [];
    for (const part of SETUP_PARTS) {
      const va = valuesOf(a, part), vb = valuesOf(b, part);
      if (va.length > 1) mixed.push({ side: "a", part, values: va });
      if (vb.length > 1) mixed.push({ side: "b", part, values: vb });
      if (va.join("|") !== vb.join("|")) diff.push({ part, a: va.join(", "), b: vb.join(", ") });
    }
    const ra = [...new Set(a.map(routeOf))], rb = [...new Set(b.map(routeOf))];
    const nameOnly = diff.some(d => d.part === "tutor") && ra.length === 1 && rb.length === 1 && ra[0] === rb[0];
    for (const d of diff) if (d.part === "tutor" && nameOnly) d.nameOnly = true;
    const changes = diff.filter(d => !d.nameOnly && !(d.part === "tutorModel" && diff.some(x => x.part === "tutor"))).length;
    const cell = v => v.record.card.id + "@" + v.record.card.version + "/" + v.record.card.lang;
    const scoredCells = list => new Set(list.filter(v => v.state === "scored").map(cell));
    const ca = scoredCells(a), cb = scoredCells(b);
    const common = new Set([...ca].filter(k => cb.has(k)));
    const sa = summarize(a.filter(v => common.has(cell(v)))), sb = summarize(b.filter(v => common.has(cell(v))));
    const delta = sa.passRate != null && sb.passRate != null ? sb.passRate - sa.passRate : null;
    const clear = delta != null && (sb.passRange.lo > sa.passRange.hi || sb.passRange.hi < sa.passRange.lo);
    const byCell = [...common].sort().map(k => ({ cell: k, a: summarize(a.filter(v => cell(v) === k)), b: summarize(b.filter(v => cell(v) === k)) }));
    return { diff, changes, nameOnly, mixed, cells: common.size, a: sa, b: sb, delta, clear, byCell };
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

  function median(xs) {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const tutorCalls = record => (record.calls || []).filter(c => c && c.role === "tutor" && !c.error);

  // What the tested tutor itself cost in one run, and how long each of its replies took. Only tutor calls count: the
  // simulated student and the judges are the benchmark's own cost. Tokens are not compared, because each model's
  // tokenizer counts the same text differently; dollars and seconds are comparable.
  function tutorEconomy(record) {
    const calls = tutorCalls(record);
    const fromUsage = record.usage && record.usage.tutor && typeof record.usage.tutor.usd === "number" ? record.usage.tutor.usd : null;
    const summed = calls.length && calls.every(c => typeof c.usd === "number") ? calls.reduce((a, c) => a + c.usd, 0) : null;
    const latencies = calls.map(c => c.latencyMs).filter(x => typeof x === "number" && x >= 0);
    return { usd: fromUsage ?? summed, replies: calls.length, latencies, estimated: calls.some(c => c.costEstimated === true) };
  }

  // A group's typical tutor cost per conversation and wait per reply, as medians so one long run does not dominate.
  function economyOf(views) {
    const per = views.map(v => tutorEconomy(v.record));
    const usd = per.map(p => p.usd).filter(x => x != null);
    const waits = per.flatMap(p => p.latencies);
    return { runs: views.length, priced: usd.length, usdPerRun: median(usd), replies: waits.length, latencyMs: median(waits),
      estimated: per.filter(p => p.estimated).length };
  }

  // A batch as the page shows it. v1 batches have no kind, hard cap, top-ups or reconciliation. v3-era batches list each
  // tutor's prompt identity ({id, version, hash}) and any parameters other than the defaults, and keep a financial stop
  // (budgetStopReason) beside the status, which a model-version drift takes over.
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
      budgetStopReason: b.budgetStopReason || null,
      // Shown only when it adds something: a drift status hides a budget stop that happened in the same call.
      alsoStopped: b.budgetStopReason && b.budgetStopReason !== b.status ? b.budgetStopReason : null,
      tutorSetups: (Array.isArray(b.tutors) ? b.tutors : []).filter(t => t && (t.prompt || t.params))
        .map(t => ({ tutor: t.label || t.id, prompt: t.prompt ? { id: t.prompt.id ?? null, version: t.prompt.version ?? null, hash: t.prompt.hash ?? null } : null, params: t.params || null })),
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

  const api = { parseJsonl, compareVersions, buildDataset, currentScoring, runView, summarize, wilson, versionKey, tutorVersions, latestVersions, versionTrend, SETUP_PARTS, setupOf, setups, compareSetups, failureEvidence,
    studentChecks, disagreementSummary, costs, tutorEconomy, economyOf, batchInfo, groupBy, itemOf, VERDICTS, ITEMS, NOT_EVALUATION };
  root.PremiumDashboardModel = api;
})(globalThis);
