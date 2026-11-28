// Data model for the premium runs dashboard. Pure functions only: no DOM, no network.
// Loaded as a classic script in the page (works from file://) and imported by the Node tests.
// Input is the premium runner's output: records/<runId>.json, batches/<batchId>.json, index.jsonl.
// Record schema v1 to v6 are all read, together. v2 adds calibration batches (status "unscored", never scored),
// budget restarts (restartOf), review flags, fixedTestSkipped and cost reconciliation. v3 adds the tutor's own prompt
// (tutorPromptId, tutorPromptVersion and a language-independent tutorPromptHash) and the effective tutor parameters;
// its batch lists each tutor's prompt identity and keeps a financial stop (budgetStopReason) beside a drift status.
// v4 adds fence evidence (end.fenceStripped, checks.fenceStripped, rejected[].fenceStripped, perJudge[].unwrapped) and,
// on every call, requestedModel, returnedModel, system_fingerprint and calledAt; its batch says how the served model
// is known (servingIdentity: revision, alias or unknown). v5 adds the cache split of each call (calls[].cache) and a
// cache summary on the batch. v6 adds the student protocol (the student answers in JSON mode; on an "injected" card the
// runner writes the fixed sentence itself, so a student line keeps the model's raw reply, its own message and events, the
// injected text and the events the runner added or dropped) and single-step probes (batch kind "calibration-probe": a fixed
// history prefix, then one student message). A field a record does not carry is "not recorded", never zero.
// A calibration report (calibration-report-<batchId>.json, checker v2 or v3) is read as the machine verdict of its batch.
// Checker v3 adds review items per run; a content review (content-review-<batchId>.json) decides them, and a gate or final
// output (checker kind "gate" or "final") gives the final verdict. The page shows all three as written and never
// recomputes a verdict.
(function (root) {
  "use strict";

  const RECORD_SCHEMA = "tutorbench.premium-run-record";
  const BATCH_SCHEMA = "tutorbench.premium-batch";
  const VERDICTS = ["good", "flawed", "fail"];
  const ITEMS = ["correct", "readsState", "helpFit", "noLeak", "responds", "helpLevel"];
  const SCHEMA_VERSIONS = [1, 2, 3, 4, 5, 6];
  // Batch kinds that check the simulated student and are never scored: a full calibration and a probe batch.
  const CALIBRATION_KINDS = ["calibration", "calibration-probe"];
  const isCalibrationKind = kind => CALIBRATION_KINDS.includes(kind);
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

  // A calibration report as the runner's check writes it (checker v2 plus the runner's own fields), or the short form it
  // publishes when the input could not be checked.
  const isReport = r => !!r && typeof r === "object" && typeof r.batchId === "string" && typeof r.verdict === "string"
    && (r.verdict === "CANNOT_CHECK" || (Number.isInteger(r.checkerVersion) && Array.isArray(r.groups) && Array.isArray(r.runs)));
  const isExpectations = v => !!v && typeof v === "object" && !!v.card && !!v.pass && Array.isArray(v.plannedGroups);
  // A content review as the reviewer writes it: one decision per review item, with a quote and a note.
  const isContentReview = v => !!v && typeof v === "object" && v.schemaVersion === 1 && typeof v.batchId === "string" && typeof v.status === "string"
    && typeof v.reviewer === "string" && Array.isArray(v.items);
  // The checker's gate (G2, G3) or final (G4) output. It names its batches only in machineVerdicts.
  const isGateResult = v => !!v && typeof v === "object" && Number.isInteger(v.checkerVersion) && (v.kind === "gate" || v.kind === "final")
    && typeof v.scope === "string" && typeof v.verdict === "string" && !!v.machineVerdicts && typeof v.machineVerdicts === "object" && Array.isArray(v.groups);
  // A probe file: the fixed prefixes of every probe in a probe set, in both languages.
  const isProbeSet = v => !!v && typeof v === "object" && v.schemaVersion === 1 && typeof v.probeSetVersion === "string" && Array.isArray(v.probes);

  const currentScoring = record => (Array.isArray(record.scorings) && record.scorings.length ? record.scorings[record.scorings.length - 1] : null);
  const isCalibration = record => isCalibrationKind(record.batchKind) || record.status === "unscored";
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
          || ("tutorPromptVersion" in row && row.tutorPromptVersion !== (r.tutor.tutorPromptVersion ?? null))
          || ("probeId" in row && row.probeId !== (r.probe ? r.probe.probeId : undefined))
          || (r.probe && !("probeId" in row));
        if (v2Differs || row.status !== status || (row.scoringId ?? null) !== (s ? s.scoringId : null) || (row.verdict ?? null) !== (m ? m.verdict ?? null : null)) {
          warnings.push({ code: "index_out_of_date", detail: row.runId });
        }
      }
      const indexed = new Set(input.index.map(row => row.runId));
      for (const id of runs.keys()) if (!indexed.has(id)) warnings.push({ code: "record_not_in_index", detail: id });
    }
    const tutorPrompts = [...prompts.values()].sort((a, b) => a.firstAt.localeCompare(b.firstAt) || a.hash.localeCompare(b.hash));

    // Calibration reports: one per batch. A report is the checker's verdict and is shown as written; it must name a
    // loaded calibration batch, and every run it judged must be loaded.
    const reports = new Map();
    for (const rep of input.reports || []) {
      if (!isReport(rep)) { warnings.push({ code: "not_a_report", detail: rep && rep.batchId ? rep.batchId : "?" }); continue; }
      if (reports.has(rep.batchId)) {
        if (JSON.stringify(reports.get(rep.batchId)) !== JSON.stringify(rep)) warnings.push({ code: "report_conflict", detail: rep.batchId });
        continue;
      }
      reports.set(rep.batchId, rep);
      const b = batches.get(rep.batchId);
      if (!b) warnings.push({ code: "report_without_batch", detail: rep.batchId });
      else if (!isCalibrationKind(b.kind)) warnings.push({ code: "report_not_calibration", detail: rep.batchId });
      for (const x of rep.runs || []) {
        const r = runs.get(x.runId);
        if (!r || r.batchId !== rep.batchId) warnings.push({ code: "report_run_missing", detail: x.runId });
      }
    }
    // Expectations (the checker's private thresholds and per-message expectations) are optional. They only add the exact
    // pass thresholds, which the report itself does not carry.
    const expectations = (input.expectations || []).filter(e => {
      const ok = e && typeof e === "object" && e.card && e.pass && Array.isArray(e.plannedGroups);
      if (!ok) warnings.push({ code: "not_expectations", detail: "?" });
      return ok;
    });
    // Content reviews: one per batch. Each decision must name a loaded record of that batch and, when the report is loaded,
    // a review item the checker listed for that run.
    const reviews = new Map();
    for (const rv of input.reviews || []) {
      if (!isContentReview(rv)) { warnings.push({ code: "not_a_review", detail: rv && rv.batchId ? rv.batchId : "?" }); continue; }
      if (reviews.has(rv.batchId)) {
        if (JSON.stringify(reviews.get(rv.batchId)) !== JSON.stringify(rv)) warnings.push({ code: "review_conflict", detail: rv.batchId });
        continue;
      }
      reviews.set(rv.batchId, rv);
      if (!batches.has(rv.batchId)) warnings.push({ code: "review_without_batch", detail: rv.batchId });
      const rep = reports.get(rv.batchId), items = new Set(rep && rep.verdict !== "CANNOT_CHECK" ? (rep.runs || []).flatMap(x => (x.reviewItems || []).map(i => x.runId + "/" + i.itemId)) : []);
      for (const it of rv.items) {
        const r = it && runs.get(it.recordId);
        if (!r || r.batchId !== rv.batchId) warnings.push({ code: "review_run_unknown", detail: (it && it.recordId) || "?" });
        else if (rep && rep.verdict !== "CANNOT_CHECK" && !items.has(it.recordId + "/" + it.itemId)) warnings.push({ code: "review_item_unknown", detail: it.recordId + " " + it.itemId });
      }
    }
    // Gate and final outputs. Each batch they name must be loaded, its machine verdict must be the one its report gives,
    // and a diagnostic batch never belongs in one.
    const gates = [];
    for (const g of input.gates || []) {
      if (!isGateResult(g)) { warnings.push({ code: "not_a_gate", detail: g && g.scope ? g.scope : "?" }); continue; }
      if (gates.some(x => JSON.stringify(x) === JSON.stringify(g))) continue;
      gates.push(g);
      for (const [batchId, verdict] of Object.entries(g.machineVerdicts)) {
        const b = batches.get(batchId), rep = reports.get(batchId);
        if (!b) warnings.push({ code: "gate_batch_missing", detail: g.scope + " " + batchId });
        const machine = rep ? (rep.checkerVersion >= 3 ? rep.machineVerdict : rep.verdict) : null;
        if (machine && machine !== verdict) warnings.push({ code: "gate_report_differs", detail: g.scope + " " + batchId });
        if (batchClass(b, rep) === "diagnostic") warnings.push({ code: "gate_has_diagnostic", detail: g.scope + " " + batchId });
      }
    }
    const probeSets = [];
    for (const p of input.probeSets || []) {
      if (!isProbeSet(p)) { warnings.push({ code: "not_a_probe_set", detail: "?" }); continue; }
      if (!probeSets.some(x => JSON.stringify(x) === JSON.stringify(p))) probeSets.push(p);
    }
    return { runs: list, batches: [...batches.values()], latestCard, judgeVersions, supersededBy, tutorPrompts, reports, expectations, reviews, gates, probeSets, warnings };
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

  // ---------- attempts, rejected replies and calls (v2 and later) ----------
  // Strips exactly one whole-reply ```json fence, as the runner's parser does, so a rejected reply that was valid JSON
  // shows its message, stage and events. Anything else is shown as the raw text it was.
  function unwrapJson(raw) {
    const text = String(raw ?? "").trim();
    const m = /^`{3}(?:json)?\r?\n([\s\S]*?)\r?\n`{3}$/iu.exec(text);
    if (!m || /^\s*`{3}/mu.test(m[1])) return { text, unwrapped: false };
    return { text: m[1], unwrapped: true };
  }
  function parseStudentReply(raw) {
    const u = unwrapJson(raw);
    try {
      const v = JSON.parse(u.text);
      if (v && typeof v === "object" && !Array.isArray(v) && typeof v.message === "string") {
        return { json: true, message: v.message, stage: v.stage ?? null, events: Array.isArray(v.events) ? v.events : [], end: v.end ?? null, fenced: u.unwrapped };
      }
    } catch { /* not JSON: shown as written */ }
    return { json: false, message: String(raw ?? ""), stage: null, events: [], end: null, fenced: false };
  }

  // Every attempt of one conversation. Student messages are numbered in each attempt (the opening is message 1), and
  // the replies the runner sent back are grouped by the message they were meant to be, in the order they were written.
  // A v1 record keeps only its final transcript, so it reads as one attempt with rewrite counts and no rejected text.
  function attemptsOf(record) {
    const list = Array.isArray(record.attempts) && record.attempts.length ? record.attempts
      : [{ attempt: 1, status: "kept", reason: null, atStudentMessage: null, transcript: record.transcript || [], rejected: [], legacy: true }];
    const calls = new Map((record.calls || []).map(c => [c.n, c]));
    return list.map(a => {
      // The call that wrote each accepted student message: the attempt's student calls that neither failed in transport nor
      // were sent back, in order. The record does not name it, so it is left out whenever the counts do not match.
      const sentBack = new Set((a.rejected || []).map(x => x.call));
      const writers = (Array.isArray(a.calls) ? a.calls : []).map(k => calls.get(k)).filter(c => c && c.role === "student" && !c.error && !sentBack.has(c.n));
      // A probe's fixed prefix was written by nobody in this run; a v6 line names its call itself.
      const written = (a.transcript || []).filter(m => m.role === "student" && !m.fixed && !m.prefix).length;
      let n = 0, w = 0;
      const lines = (a.transcript || []).map(m => {
        if (m.role !== "student") return m;
        const own = !m.fixed && !m.prefix, named = m.checks && m.checks.call != null ? calls.get(m.checks.call) || null : null;
        const byOrder = own && writers.length === written ? writers[w++] : null;
        return { ...m, n: ++n, callInfo: own ? named || byOrder : null };
      });
      const rejected = (a.rejected || []).map(x => ({ ...x, studentMessage: Number(x.studentMessage), reply: parseStudentReply(x.text), callInfo: calls.get(x.call) || null }));
      const byMessage = new Map();
      for (const x of rejected) {
        if (!byMessage.has(x.studentMessage)) byMessage.set(x.studentMessage, []);
        byMessage.get(x.studentMessage).push(x);
      }
      return { attempt: a.attempt, status: a.status, reason: a.reason || null, atStudentMessage: a.atStudentMessage ?? null, lines, rejected, byMessage,
        studentMessages: n, calls: Array.isArray(a.calls) ? a.calls : [], legacy: !!a.legacy };
    });
  }

  // Rule families for replies sent back to the simulated student: the reply's form, the card's protocol, its state.
  const RULE_FAMILY = {
    invalid_json_or_fields: "format", internal_state_in_message: "format", too_long: "format", role_reference: "format", sensitive_output: "format",
    fixed_test_missing: "protocol", fixed_test_early: "protocol", left_too_early: "protocol", invalid_end: "protocol", curt_exit_unsolved: "protocol",
    invalid_stage: "state", unknown_event: "state", duplicate_event: "state",
    // Record schema v6: an empty reply is a format failure; writing or echoing the sentence the runner injects breaks the protocol.
    empty_response: "format", fixed_test_self_written: "protocol", fixed_test_echo: "protocol",
  };
  const ruleFamily = reasons => { for (const r of reasons || []) if (RULE_FAMILY[r]) return RULE_FAMILY[r]; return "other"; };

  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const allCalls = record => [...(record.calls || []), ...(record.scorings || []).slice(1).flatMap(s => s.calls || [])];
  // Errors that stop a batch are not transport errors; they are shown with the batch.
  const STOPS = ["budget_stop", "unknown_cost", "model_version_drift", "actual_over_budget"];

  // Calls that failed in transport (timeouts, provider errors, calls never sent) and calls that were a retry, with the
  // conversation they belong to and, when that conversation was replaced, the record that replaced it.
  function transportOf(records, supersededBy) {
    const out = [];
    for (const r of records) for (const c of allCalls(r)) {
      const failed = c.error && !STOPS.includes(c.error);
      if (!failed && !(c.retryDelayMs > 0)) continue;
      out.push({ runId: r.runId, n: c.n, role: c.role, model: c.model, error: failed ? c.error : null, retry: c.retryDelayMs > 0, retryDelayMs: c.retryDelayMs || 0,
        costEstimated: c.costEstimated === true, usd: c.usd ?? null, calledAt: c.calledAt || null, status: r.status, endReason: (r.end && r.end.reason) || null,
        replacedBy: (supersededBy && supersededBy[r.runId]) || null });
    }
    return out;
  }

  // Cache per model. The batch's own summary (v5) is kept as written; beside it, the totals over the calls whose split is
  // known, with that denominator, so an unknown call never turns the whole into zero or into a guess.
  function cacheOf(batch, records) {
    const per = new Map();
    for (const r of records) for (const c of allCalls(r)) {
      if (c.error === "not_dispatched" || c.error === "mock_not_dispatched") continue;
      const p = per.get(c.model) || { model: c.model, role: c.role, calls: 0, observed: 0, noInput: 0, unrecorded: 0, hitTokens: 0, missTokens: 0, hitUsd: 0, missUsd: 0 };
      p.calls++;
      if (!has(c, "cache")) p.unrecorded++;
      if (c.cache && c.cache.hitTokens != null && c.cache.missTokens != null) {
        p.observed++; p.hitTokens += c.cache.hitTokens; p.missTokens += c.cache.missTokens;
        p.hitUsd += c.cache.hitUsd || 0; p.missUsd += c.cache.missUsd || 0;
      } else if (c.usage && c.usage.inputTokens === 0) p.noInput++;
      per.set(c.model, p);
    }
    const models = [...per.values()].map(p => ({ ...p, unknown: p.calls - p.observed - p.noInput,
      hitRate: p.hitTokens + p.missTokens > 0 ? p.hitTokens / (p.hitTokens + p.missTokens) : null,
      batch: ((batch && batch.cache && batch.cache.byModel) || []).find(m => m.model === p.model) || null }))
      .sort((a, b) => a.role.localeCompare(b.role) || a.model.localeCompare(b.model));
    return { recorded: models.some(m => m.calls > m.unrecorded), batch: (batch && batch.cache) || null, models };
  }

  // Who answered, per role: the model names asked for and returned, when, and the fingerprints seen. Each distinct
  // fingerprint counts once per conversation, adopted and superseded apart, as the calibration check counts them.
  function identityOf(batch, records, supersededBy) {
    const roles = new Map();
    for (const r of records) {
      const replaced = !!(supersededBy && supersededBy[r.runId]);
      const seen = new Map();
      for (const c of allCalls(r)) {
        const g = roles.get(c.role) || { role: c.role, calls: 0, requested: new Set(), returned: new Set(), returnedNull: 0, unrecorded: 0, first: null, last: null, fingerprints: new Map() };
        g.calls++;
        if (c.requestedModel) g.requested.add(c.requestedModel);
        if (!has(c, "returnedModel")) g.unrecorded++;
        else if (c.returnedModel == null) g.returnedNull++;
        else g.returned.add(c.returnedModel);
        if (c.calledAt) { if (!g.first || c.calledAt < g.first) g.first = c.calledAt; if (!g.last || c.calledAt > g.last) g.last = c.calledAt; }
        if (!c.error || !STOPS.includes(c.error)) {
          const fp = has(c, "system_fingerprint") ? (c.system_fingerprint ?? null) : undefined;
          if (!seen.has(c.role)) seen.set(c.role, new Set());
          seen.get(c.role).add(fp === undefined ? "\u0000unrecorded" : fp === null ? "\u0000null" : fp);
        }
        roles.set(c.role, g);
      }
      for (const [role, set] of seen) for (const fp of set) {
        const g = roles.get(role), row = g.fingerprints.get(fp) || { conversations: 0, adopted: 0, superseded: 0 };
        row.conversations++; row[replaced ? "superseded" : "adopted"]++;
        g.fingerprints.set(fp, row);
      }
    }
    const order = ["tutor", "student", "judge"];
    const list = [...roles.values()].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)).map(g => ({
      role: g.role, calls: g.calls, requested: [...g.requested].sort(), returned: [...g.returned].sort(), returnedNull: g.returnedNull, unrecorded: g.unrecorded,
      first: g.first, last: g.last,
      fingerprints: [...g.fingerprints].map(([k, v]) => ({ value: k === "\u0000null" ? null : k === "\u0000unrecorded" ? undefined : k, ...v }))
        .sort((a, b) => (a.value === undefined) - (b.value === undefined) || (a.value === null) - (b.value === null) || String(a.value).localeCompare(String(b.value))),
    }));
    const target = batch && isCalibrationKind(batch.kind) ? "student" : "tutor";
    const t = list.find(g => g.role === target);
    return { target, roles: list, servingIdentity: (batch && batch.servingIdentity) || null, configured: (batch && batch.configuredServingIdentity) || null,
      evidence: (batch && batch.identityEvidence) || null,
      multipleFingerprints: !!t && t.fingerprints.filter(f => typeof f.value === "string").length > 1 };
  }

  // ---------- calibration ----------
  // A checker line such as "msg 2: missing event pushback" belongs to student message 2; others belong to the whole run.
  function parseCheckerLine(line) {
    const m = /^msg (\d+): ([\s\S]*)$/u.exec(String(line));
    return m ? { n: Number(m[1]), text: m[2], line: String(line) } : { n: null, text: String(line), line: String(line) };
  }
  // A checker report in one shape. Checker v2 writes pass, tutor groups and the rewrite and discard rates at the top;
  // checker v3 writes machinePass, probe or tutor groups, the L0 block, review items and a machine verdict apart from its
  // verdict (PENDING_REVIEW until the review, DIAGNOSTIC for a diagnostic batch). Both are copied, never recomputed.
  const keyOf = x => (x && (x.probeId ?? x.tutor)) ?? null;
  function normReport(rep) {
    if (!rep || rep.verdict === "CANNOT_CHECK" || !Array.isArray(rep.runs)) return null;
    const v3 = rep.checkerVersion >= 3, l0 = rep.l0 || {};
    return {
      checkerVersion: rep.checkerVersion, checkerRevision: rep.checkerRevision ?? null, v3,
      machineVerdict: v3 ? rep.machineVerdict ?? null : rep.verdict, reportVerdict: rep.verdict,
      diagnostic: rep.diagnostic === true || rep.verdict === "DIAGNOSTIC", dryRun: rep.dryRun === true, gate: rep.gate ?? null,
      pins: rep.pins || null, card: rep.card || (rep.pins && rep.pins.card) || null, probes: (rep.groups || []).some(g => g.probeId != null),
      groups: (rep.groups || []).map(g => ({ key: keyOf(g), lang: g.lang, passing: v3 ? g.machinePassing : g.passing, runs: g.runs, pass: v3 ? g.machinePass : g.pass, optional: !!g.optional })),
      runs: rep.runs.map(x => ({ ...x, key: keyOf(x), pass: v3 ? x.machinePass : x.pass, hard: x.hard || [], soft: x.soft || [], reviewItems: x.reviewItems || [] })),
      rewrite: (v3 ? l0.rewrite : rep.rewrite) || null, discard: (v3 ? l0.discard : rep.discard) || null,
      firstTryByMessage: l0.firstTryByMessage || null, observedFormats: l0.observedFormats || null,
      review: rep.review || null, humanReviewPending: rep.humanReviewPending ?? null, cohortErrors: rep.cohortErrors || [], superseded: rep.superseded || [],
      fingerprints: rep.fingerprintDistribution || null, multipleFingerprints: rep.multipleFingerprints ?? null,
      servingIdentity: rep.servingIdentity ?? null, spentUsd: rep.batchSpentUsd ?? null, batchStatus: rep.batchStatus ?? null,
    };
  }
  const reportRun = (dataset, runId) => {
    for (const rep of dataset.reports.values()) {
      const n = normReport(rep), x = n && n.runs.find(y => y.runId === runId);
      if (x) return { report: rep, norm: n, run: x };
    }
    return null;
  };
  // What a batch is for, which decides what may follow from it. A diagnostic batch is for development only: it needs no
  // content review, a final refuses it, and its numbers never count toward a gate. A calibration (full or probe, gate key
  // or rest) checks the simulated student and leads to a gate or final verdict. An evaluation scores tutors.
  function batchClass(batch, report) {
    if ((batch && batch.gate === "diagnostic") || (report && (report.diagnostic === true || report.verdict === "DIAGNOSTIC"))) return "diagnostic";
    if ((batch && isCalibrationKind(batch.kind)) || (report && isCalibrationKind(report.batchKind))) return "calibration";
    return "evaluation";
  }
  // The record key of a run in a calibration: its probe in a probe batch, else its scripted tutor.
  const runKey = r => (r.probe && r.probe.probeId) || r.tutor.id;

  // Everything the calibration view shows for one batch. The verdict, the group passes and the rewrite and discard rates
  // come from the report only; without a report the page lists what the records say and calls the batch unchecked.
  function calibrationOf(dataset, batchId) {
    const batch = dataset.batches.find(b => b.batchId === batchId) || null;
    const report = dataset.reports.get(batchId) || null;
    const norm = normReport(report), checked = !!norm;
    const records = dataset.runs.filter(r => r.batchId === batchId);
    const sup = dataset.supersededBy || {};
    const adopted = records.filter(r => !sup[r.runId]);
    const byRun = new Map(((checked && norm.runs) || []).map(x => [x.runId, x]));
    const card = (checked && norm.card) || (records[0] && { id: records[0].card.id, version: records[0].card.version, contentHash: records[0].card.contentHash }) || null;
    // Expectations apply to one card version under one rules version, as the runner's check-calibration requires.
    const rules = records[0] ? records[0].card.rulesVersion : null;
    const exp = card ? dataset.expectations.filter(e => e.card.id === card.id && e.card.version === card.version && (!card.contentHash || e.card.contentHash === card.contentHash)
      && (!rules || !e.rulesVersion || e.rulesVersion === rules)).sort((a, b) => (b.schemaVersion || 0) - (a.schemaVersion || 0))[0] || null : null;
    const probes = !!(batch && Array.isArray(batch.probes)) || records.some(r => r.probe);
    const order = probes ? ((batch && batch.probes) || []).slice() : ((batch && batch.tutors) || []).map(x => x.id);
    for (const r of records) if (!order.includes(runKey(r))) order.push(runKey(r));
    const langs = (batch && batch.languages) || [...new Set(records.map(r => r.card.lang))];
    const set = probes ? probeSetOf(dataset, batch, records) : null;
    const label = key => {
      if (probes) return key;
      const bt = ((batch && batch.tutors) || []).find(x => x.id === key), r = records.find(x => x.tutor.id === key);
      return (bt && bt.label) || (r && r.tutor.label) || key;
    };
    const purpose = key => { const p = set && set.probes.find(x => x.probeId === key); return p ? p.purpose || null : null; };
    const optional = new Set(((checked && norm.groups) || []).filter(g => g.optional).map(g => g.key));
    const groups = order.map(key => ({ key, tutor: key, label: label(key), purpose: purpose(key), optional: optional.has(key), cells: langs.map(lang => {
      const runs = adopted.filter(r => runKey(r) === key && r.card.lang === lang).sort((a, b) => a.repeat.index - b.repeat.index)
        .map(r => ({ record: r, check: byRun.get(r.runId) || null }));
      const g = ((checked && norm.groups) || []).find(x => x.key === key && x.lang === lang) || null;
      return { lang, runs, group: g };
    }) })).filter(g => g.cells.some(c => c.runs.length || c.group));
    const rejects = records.flatMap(r => attemptsOf(r).flatMap(a => a.rejected.map(x => ({ runId: r.runId, key: runKey(r), tutor: runKey(r), lang: r.card.lang, repeat: r.repeat.index,
      attempt: a.attempt, attemptStatus: a.status, superseded: !!sup[r.runId], n: x.studentMessage, reasons: x.reasons || [], family: ruleFamily(x.reasons) }))));
    const deviations = [];
    for (const [runId, x] of byRun) {
      const r = records.find(y => y.runId === runId);
      for (const kind of ["hard", "soft"]) for (const line of x[kind]) deviations.push({ runId, key: x.key, tutor: x.key, lang: x.lang, repeat: x.repeat, kind, record: r || null, ...parseCheckerLine(line) });
    }
    const need = exp ? (norm && norm.dryRun ? 1 : exp.pass.group.minPassingRuns) : null;
    const machine = checked ? {
      verdict: norm.machineVerdict, reportVerdict: norm.reportVerdict, checkerVersion: norm.checkerVersion, checkerRevision: norm.checkerRevision, dryRun: norm.dryRun,
      runsPassing: norm.runs.filter(x => x.pass).length, runs: norm.runs.length,
      groupsPassing: norm.groups.filter(g => !g.optional && g.pass).length, groups: norm.groups.filter(g => !g.optional).length,
      rewrite: norm.rewrite, discard: norm.discard, firstTryByMessage: norm.firstTryByMessage, observedFormats: norm.observedFormats,
      cohortErrors: norm.cohortErrors, superseded: norm.superseded, pins: norm.pins,
      fingerprints: norm.fingerprints, multipleFingerprints: norm.multipleFingerprints,
      servingIdentity: norm.servingIdentity, spentUsd: norm.spentUsd, batchStatus: norm.batchStatus,
    } : null;
    const group = exp && exp.pass ? exp.pass.group || {} : {};
    const criteria = exp ? { maxHard: exp.pass.run.maxHard, maxSoft: exp.pass.run.maxSoft, minPassingRuns: need, repeats: exp.repeats, groupRuns: group.runs ?? exp.repeats,
      rewriteRateMax: exp.pass.rewriteRateMax, rulesVersion: exp.rulesVersion || null, probes } : (machine && machine.rewrite ? { rewriteRateMax: machine.rewrite.max, probes } : null);
    const cls = batchClass(batch, report);
    return { batchId, batch, report, norm, checked, cannotCheck: !!report && report.verdict === "CANNOT_CHECK", card, records, adopted, groups, langs, rejects, deviations,
      machine, criteria, expectations: exp, probes, probeSet: set, cls,
      contentReview: report ? (report.humanReviewPending === true ? "pending" : report.humanReviewPending === false ? "not_pending" : "unstated") : "unstated",
      review: reviewOf(dataset, batchId), final: finalOf(dataset, batchId) };
  }

  // The content review joined to the checker's review items, run by run. A decision is shown as the reviewer wrote it;
  // an item nobody decided is shown by the rules the review follows: auto_pass stays pass, auto_fail stays fail unless
  // overridden, and needs_review is pending while the review is open and counts as fail once it is complete.
  function reviewOf(dataset, batchId) {
    const batch = dataset.batches.find(b => b.batchId === batchId) || null, report = dataset.reports.get(batchId) || null;
    const norm = normReport(report), file = (dataset.reviews && dataset.reviews.get(batchId)) || null;
    const diagnostic = batchClass(batch, report) === "diagnostic";
    const complete = !!file && file.status === "complete";
    const decided = new Map(((file && file.items) || []).map(i => [i.recordId + "/" + i.itemId, i]));
    const records = new Map(dataset.runs.filter(r => r.batchId === batchId).map(r => [r.runId, r]));
    const items = [];
    for (const x of (norm && norm.runs) || []) for (const it of x.reviewItems) {
      const d = decided.get(x.runId + "/" + it.itemId) || null;
      const decision = d && (d.decision === "pass" || d.decision === "fail") ? d.decision : null;
      const effective = decision || (it.machine === "auto_pass" ? "pass" : it.machine === "auto_fail" ? "fail" : complete ? "fail" : "pending");
      items.push({ runId: x.runId, key: x.key, lang: x.lang, repeat: x.repeat, record: records.get(x.runId) || null, itemId: it.itemId, level: it.level || null,
        machine: it.machine || null, severityIfFail: it.severityIfFail || null, message: it.message ?? null, messages: it.messages || (it.message != null ? [it.message] : []),
        question: it.question || null, machineQuote: it.quote ?? null, decision, quote: d ? d.quote ?? null : null, note: d ? d.note ?? null : null,
        overridesMachine: !!(d && d.overridesMachine), undecidedFail: !decision && it.machine === "needs_review" && complete, effective });
    }
    const unknown = ((file && file.items) || []).filter(i => !items.some(x => x.runId === i.recordId && x.itemId === i.itemId));
    const by = {};
    for (const m of ["auto_pass", "needs_review", "auto_fail"]) by[m] = { pass: 0, fail: 0, undecided: 0 };
    for (const x of items) { const row = by[x.machine] || (by[x.machine] = { pass: 0, fail: 0, undecided: 0 }); row[x.decision || "undecided"]++; }
    return { batchId, file, diagnostic, status: file ? file.status : null, complete, reviewer: file ? file.reviewer : null, blind: file ? file.blind ?? null : null,
      scope: file ? file.scope || null : null, checkerUsed: file ? file.checkerUsed || null : null, items, unknown, byMachine: by,
      counts: { items: items.length, decided: items.filter(x => x.decision).length, needsReview: items.filter(x => x.machine === "needs_review").length,
        autoFail: items.filter(x => x.machine === "auto_fail").length, fails: items.filter(x => x.decision === "fail").length,
        overrides: items.filter(x => x.overridesMachine).length, undecidedFail: items.filter(x => x.undecidedFail).length,
        pending: items.filter(x => x.effective === "pending").length } };
  }

  // The gate or final outputs that name this batch, as written. A diagnostic batch has none: the final refuses it.
  function finalOf(dataset, batchId) {
    const batch = dataset.batches.find(b => b.batchId === batchId) || null, report = dataset.reports.get(batchId) || null;
    const outputs = (dataset.gates || []).filter(g => Object.prototype.hasOwnProperty.call(g.machineVerdicts, batchId)).map(g => ({
      gate: g, kind: g.kind, scope: g.scope, verdict: g.verdict, reviewStatus: g.reviewStatus || null, errors: g.errors || [], checkerRevision: g.checkerRevision || null,
      batches: Object.keys(g.machineVerdicts), machineVerdict: g.machineVerdicts[batchId],
      groups: g.groups.filter(x => x.batchId === batchId), overrides: (g.overrides || []).filter(x => x.batchId === batchId),
    }));
    return { batchId, diagnostic: batchClass(batch, report) === "diagnostic", outputs };
  }

  // The probe file that matches a probe batch's probe set version, if one is loaded.
  function probeSetOf(dataset, batch, records) {
    const version = (batch && batch.probeSetVersion) || (records.find(r => r.probe) || { probe: {} }).probe.probeSetVersion;
    return (dataset.probeSets || []).find(p => p.probeSetVersion === version) || null;
  }
  // The fixed history prefix of a probe record, without the line numbers the runner adds, in the key order of the file.
  const prefixOf = record => (record.transcript || []).filter(l => l.prefix).map(l => { const rest = { ...l }; delete rest.i; delete rest.prefix; return rest; });

  // One model-written student message as its parts: what the model returned, the message and events it wrote, what the
  // runner injected and dropped, and the final text and state the conversation kept. Record schema v6 keeps all of them;
  // an older line has only its final text and state, and the rest is null.
  function messageParts(line) {
    const ck = line.checks || {}, m = line.model || null;
    return {
      raw: m ? m.raw ?? null : null, modelMessage: m ? m.message ?? null : null, modelEvents: m ? m.events || [] : null,
      injected: line.injected || null, runnerEvents: line.runnerEvents || [], droppedEvents: line.droppedEvents || [],
      final: line.text ?? null, state: line.state || null, format: ck.observedFormat || null, call: ck.call ?? null,
      regenerated: ck.regenerated || 0, hardFails: ck.hardFails || [], softFlags: ck.softFlags || [], fenceStripped: !!ck.fenceStripped, v6: !!m,
    };
  }

  // A probe batch, probe by probe and language by language: the fixed prefix (the same for every repeat, else flagged),
  // its hash, and each repeat's target message as its parts. sha, when given, hashes text to its hex SHA-256, so the page
  // can show that a prefix hash is the hash of the prefix it carries. Probes of the probe file that this batch did not run
  // are listed apart.
  function probeView(dataset, batchId, sha) {
    const c = calibrationOf(dataset, batchId), set = c.probeSet;
    const exp = c.expectations && c.expectations.probeExpectations ? c.expectations.probeExpectations : {};
    const ids = c.groups.map(g => g.key);
    const rows = ids.map(probeId => {
      const def = set ? set.probes.find(p => p.probeId === probeId) || null : null;
      const any = c.adopted.find(r => r.probe && r.probe.probeId === probeId) || null;
      const langs = {};
      for (const lang of c.langs) {
        const g = c.groups.find(x => x.key === probeId), cell = g && g.cells.find(x => x.lang === lang);
        const runs = (cell ? cell.runs : []).map(x => {
          const atts = attemptsOf(x.record), last = atts[atts.length - 1];
          const line = last.lines.filter(l => l.role === "student" && !l.prefix).slice(-1)[0] || null;
          const rejected = atts.flatMap(a => a.rejected.filter(rj => line && rj.studentMessage === line.n).map(rj => ({ ...rj, attempt: a.attempt, attemptStatus: a.status })));
          const review = c.review.items.filter(i => i.runId === x.record.runId);
          return { record: x.record, check: x.check, n: line ? line.n : null, parts: line ? messageParts(line) : null, rejected, discarded: atts.filter(a => a.status === "discarded").length, review };
        });
        const first = runs[0] ? runs[0].record : null, prefix = first ? prefixOf(first) : [];
        const text = JSON.stringify(prefix), hash = first ? first.probe.prefixHash : null;
        const same = runs.every(x => JSON.stringify(prefixOf(x.record)) === text && x.record.probe.prefixHash === hash);
        const fileText = def && def.prefix && def.prefix[lang] ? JSON.stringify(def.prefix[lang]) : null;
        langs[lang] = { runs, prefix, prefixHash: hash, sameAcrossRuns: same,
          hashMatches: sha && hash ? "sha256:" + sha(text) === hash : null, matchesFile: fileText == null ? null : fileText === text && (!def.prefixHash || def.prefixHash[lang] === hash),
          group: cell ? cell.group : null };
      }
      return { probeId, inBatch: true, purpose: def ? def.purpose || null : null, gate: def ? def.gate || null : null,
        target: (any && any.probe.targetStudentMessage) || (def && def.targetStudentMessage) || null, tutorSource: any ? any.probe.tutorSource : null,
        protocolVersion: any ? any.probe.protocolVersion : null, expectation: exp[probeId] || null, langs };
    });
    const others = set ? set.probes.filter(p => !ids.includes(p.probeId)).map(p => ({ probeId: p.probeId, inBatch: false, purpose: p.purpose || null, gate: p.gate || null,
      target: p.targetStudentMessage || null, expectation: exp[p.probeId] || null })) : [];
    return { calibration: c, set, probes: rows, others, langs: c.langs };
  }

  // The calibration batches in view: formal ones before diagnostic ones, a batch with a report before one without, newest first.
  function calibrationBatches(dataset) {
    const diag = b => batchClass(b, dataset.reports.get(b.batchId)) === "diagnostic";
    return dataset.batches.filter(b => isCalibrationKind(b.kind))
      .sort((a, b) => diag(a) - diag(b) || (dataset.reports.has(b.batchId) - dataset.reports.has(a.batchId)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  // The probe batches, formal before diagnostic, newest first.
  function probeBatches(dataset) {
    const diag = b => batchClass(b, dataset.reports.get(b.batchId)) === "diagnostic";
    return dataset.batches.filter(b => b.kind === "calibration-probe")
      .sort((a, b) => diag(a) - diag(b) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  // A batch's status now, and any earlier stop it recovered from. A recovered batch can keep the stopReason of its first
  // run beside status "complete"; that is history, not the current state.
  function batchHistory(b) {
    const stop = b && b.stopReason ? String(b.stopReason) : null;
    const topUps = (b && Array.isArray(b.budgetHistory) ? b.budgetHistory : []).filter(x => x && typeof x.from === "number" && typeof x.to === "number").map(x => ({ at: x.at || null, from: x.from, to: x.to }));
    return { status: (b && b.status) || null, earlierStop: stop && stop !== b.status ? stop : null, topUps };
  }

  // ---------- review pack ----------
  // One row per record of a batch, for the review index in the pack. Checker results are copied from the report;
  // everything else is counted from the record as written. Nothing here re-scores or re-checks a run.
  const REVIEW_COLUMNS = ["job", "batch_class", "record_role", "probe", "tutor", "language", "repeat", "checker_pass", "record_status", "end_reason", "checker_hard", "checker_soft",
    "review_items", "review_needs_review", "review_auto_fail", "review_decided_fail", "review_overrides", "review_pending",
    "report_extra_rewrites", "rejected_outputs", "rejection_rule_counts", "attempts", "discarded_attempts", "attempt_stops", "student_calls", "transport_errors",
    "fingerprints", "prefix_hash", "run_id", "restart_of", "replaced_by", "record_path"];
  const recordOrder = sup => (a, b) => runKey(a).localeCompare(runKey(b)) || String(a.card.lang).localeCompare(String(b.card.lang)) || a.repeat.index - b.repeat.index
    || (sup[a.runId] ? -1 : 0) - (sup[b.runId] ? -1 : 0);
  function reviewIndex(dataset, batchId) {
    const rep = dataset.reports.get(batchId), norm = normReport(rep);
    const batch = dataset.batches.find(b => b.batchId === batchId) || null, cls = batchClass(batch, rep);
    const byRun = new Map(((norm && norm.runs) || []).map(x => [x.runId, x]));
    const review = reviewOf(dataset, batchId);
    const sup = dataset.supersededBy || {};
    const records = dataset.runs.filter(r => r.batchId === batchId).sort(recordOrder(sup));
    return records.map(r => {
      const x = byRun.get(r.runId), attempts = attemptsOf(r), items = review.items.filter(i => i.runId === r.runId);
      const counts = {};
      for (const a of attempts) for (const rj of a.rejected) for (const k of rj.reasons || []) counts[k] = (counts[k] || 0) + 1;
      const transport = transportOf([r], sup).filter(t => t.error);
      const fps = [...new Set(allCalls(r).filter(c => has(c, "system_fingerprint") && c.system_fingerprint).map(c => c.system_fingerprint))].sort();
      const n = k => (x ? items.filter(k).length : "");
      return {
        job: [runKey(r), r.card.lang, r.repeat.index].join("/"), batch_class: cls, record_role: sup[r.runId] ? "superseded" : "adopted",
        probe: r.probe ? r.probe.probeId : "", tutor: r.tutor.id, language: r.card.lang, repeat: r.repeat.index,
        checker_pass: x ? (x.pass ? "PASS" : "FAIL") : !rep ? "NO_REPORT" : !norm ? "CANNOT_CHECK" : "NOT_EVALUATED",
        record_status: r.status, end_reason: r.end && r.end.reason, checker_hard: x ? x.hard : "", checker_soft: x ? x.soft : "",
        review_items: n(() => true), review_needs_review: n(i => i.machine === "needs_review"), review_auto_fail: n(i => i.machine === "auto_fail"),
        review_decided_fail: n(i => i.decision === "fail"), review_overrides: n(i => i.overridesMachine), review_pending: n(i => i.effective === "pending"),
        report_extra_rewrites: x ? x.extraRewrites ?? "" : "",
        rejected_outputs: attempts.reduce((k, a) => k + a.rejected.length, 0), rejection_rule_counts: counts, attempts: attempts.filter(a => !a.legacy).length,
        discarded_attempts: attempts.filter(a => a.status === "discarded").length,
        attempt_stops: attempts.filter(a => !a.legacy && a.status !== "kept").map(a => ({ attempt: a.attempt, status: a.status, reason: a.reason, atStudentMessage: a.atStudentMessage })),
        student_calls: allCalls(r).filter(c => c.role === "student").length, transport_errors: transport.map(t => "call " + t.n + " " + t.error).join("; "),
        fingerprints: fps.join(" "), prefix_hash: r.probe ? r.probe.prefixHash || "" : "", run_id: r.runId, restart_of: r.restartOf || "", replaced_by: sup[r.runId] || "",
        record_path: "records/" + r.runId + ".json",
      };
    });
  }

  // One row per student message of every attempt, kept or sent back, so an agent can read what the model returned,
  // what the runner injected or dropped, and what the conversation kept without opening each record. A prefix line is
  // the probe's fixed history; a fixed line is the card's scripted opening.
  const MESSAGE_COLUMNS = ["run_id", "record_role", "probe", "tutor", "language", "repeat", "attempt", "attempt_status", "student_message", "target", "row",
    "call", "observed_format", "rejection_reasons", "regenerated", "raw", "model_message", "model_events", "injected_kind", "injected_text",
    "runner_events", "dropped_events", "final_text", "stage", "events", "end", "hard_fails", "soft_flags", "fence_stripped"];
  function messageRows(dataset, batchId) {
    const sup = dataset.supersededBy || {};
    const out = [];
    for (const r of dataset.runs.filter(x => x.batchId === batchId).sort(recordOrder(sup))) {
      const target = r.probe ? r.probe.targetStudentMessage : null;
      const base = { run_id: r.runId, record_role: sup[r.runId] ? "superseded" : "adopted", probe: r.probe ? r.probe.probeId : "", tutor: r.tutor.id,
        language: r.card.lang, repeat: r.repeat.index };
      for (const a of attemptsOf(r)) {
        const at = { attempt: a.legacy ? "" : a.attempt, attempt_status: a.legacy ? "" : a.status };
        for (const l of a.lines.filter(x => x.role === "student")) {
          for (const rj of a.byMessage.get(l.n) || []) out.push({ ...base, ...at, student_message: l.n, target: target === l.n, row: "rejected", call: rj.call ?? "",
            observed_format: rj.observedFormat || "", rejection_reasons: (rj.reasons || []).join(" "), regenerated: "", raw: rj.text ?? "",
            model_message: rj.reply.json ? rj.reply.message : "", model_events: rj.reply.json ? rj.reply.events : "", injected_kind: "", injected_text: "",
            runner_events: "", dropped_events: "", final_text: "", stage: rj.reply.json ? rj.reply.stage ?? "" : "", events: "", end: "",
            hard_fails: "", soft_flags: "", fence_stripped: rj.reply.fenced });
          const p = messageParts(l), st = l.state || {};
          out.push({ ...base, ...at, student_message: l.n, target: target === l.n, row: l.prefix ? "prefix" : l.fixed ? "fixed" : "kept",
            call: p.call ?? (l.callInfo ? l.callInfo.n : ""), observed_format: p.format || "", rejection_reasons: "", regenerated: p.v6 ? p.regenerated : "",
            raw: p.raw ?? "", model_message: p.modelMessage ?? "", model_events: p.modelEvents || "", injected_kind: p.injected ? p.injected.kind || "" : "",
            injected_text: p.injected ? p.injected.text ?? "" : "", runner_events: p.runnerEvents, dropped_events: p.droppedEvents, final_text: p.final ?? "",
            stage: st.stage ?? "", events: st.events || "", end: st.end ?? "", hard_fails: p.hardFails, soft_flags: p.softFlags, fence_stripped: p.fenceStripped });
        }
        // Replies sent back for a message the attempt never reached (it stopped there) still belong in the table.
        const reached = new Set(a.lines.filter(x => x.role === "student").map(x => x.n));
        for (const [n, list] of a.byMessage) if (!reached.has(n)) for (const rj of list) out.push({ ...base, ...at, student_message: n, target: target === n, row: "rejected",
          call: rj.call ?? "", observed_format: rj.observedFormat || "", rejection_reasons: (rj.reasons || []).join(" "), regenerated: "", raw: rj.text ?? "",
          model_message: rj.reply.json ? rj.reply.message : "", model_events: rj.reply.json ? rj.reply.events : "", injected_kind: "", injected_text: "",
          runner_events: "", dropped_events: "", final_text: "", stage: rj.reply.json ? rj.reply.stage ?? "" : "", events: "", end: "",
          hard_fails: "", soft_flags: "", fence_stripped: rj.reply.fenced });
      }
    }
    return out;
  }

  // One row per checker review item, with the machine label beside the reviewer's decision and the result the review
  // rules give it. Empty when the report has no review items (checker v2, or a diagnostic batch).
  const REVIEW_ITEM_COLUMNS = ["run_id", "probe", "tutor", "language", "repeat", "item_id", "level", "machine", "severity_if_fail", "student_message",
    "question", "machine_quote", "decision", "overrides_machine", "effective", "review_quote", "review_note", "record_path"];
  function reviewItemRows(dataset, batchId) {
    return reviewOf(dataset, batchId).items.map(i => ({
      run_id: i.runId, probe: i.record && i.record.probe ? i.record.probe.probeId : "", tutor: i.record ? i.record.tutor.id : i.key, language: i.lang, repeat: i.repeat,
      item_id: i.itemId, level: i.level || "", machine: i.machine || "", severity_if_fail: i.severityIfFail || "", student_message: i.messages.join(" "),
      question: i.question || "", machine_quote: i.machineQuote ?? "", decision: i.decision || "", overrides_machine: i.overridesMachine, effective: i.effective,
      review_quote: i.quote ?? "", review_note: i.note ?? "", record_path: "records/" + i.runId + ".json",
    }));
  }

  // What the pack holds, in three layers that never mix: what the checker decided, what the reviewer decided, and the
  // gate or final verdict written from both. Counts are copied or counted, never re-derived into a new verdict.
  function packLayers(dataset, batchId) {
    const c = calibrationOf(dataset, batchId), rv = c.review, fin = c.final;
    const b = c.batch || {};
    return {
      batchId, class: c.cls, kind: b.kind || null, gate: b.gate || (c.norm && c.norm.gate) || null, phase: b.phase || null,
      series: b.calibrationSeries || null, priorBatchIds: b.priorBatchIds || [], probeSetVersion: b.probeSetVersion || null, probes: b.probes || null,
      card: c.card, languages: c.langs,
      machine: c.machine ? { verdict: c.machine.verdict, reportVerdict: c.machine.reportVerdict, checkerVersion: c.machine.checkerVersion,
        checkerRevision: c.machine.checkerRevision, runsPassing: c.machine.runsPassing, runs: c.machine.runs, groupsPassing: c.machine.groupsPassing,
        groups: c.machine.groups, rewrite: c.machine.rewrite, discard: c.machine.discard, cohortErrors: c.machine.cohortErrors } : null,
      review: { required: c.cls !== "diagnostic" && rv.counts.items > 0, status: rv.status, complete: rv.complete, reviewer: rv.reviewer, blind: rv.blind,
        counts: rv.counts, unknownDecisions: rv.unknown.length },
      final: { refused: fin.diagnostic, outputs: fin.outputs.map(o => ({ kind: o.kind, scope: o.scope, verdict: o.verdict, reviewStatus: o.reviewStatus,
        machineVerdict: o.machineVerdict, batches: o.batches, errors: o.errors, overrides: o.overrides.length })) },
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
    studentChecks, disagreementSummary, costs, tutorEconomy, economyOf, batchInfo, groupBy, itemOf, VERDICTS, ITEMS, NOT_EVALUATION,
    SCHEMA_VERSIONS, isReport, isExpectations, unwrapJson, parseStudentReply, attemptsOf, ruleFamily, RULE_FAMILY, transportOf, cacheOf, identityOf,
    parseCheckerLine, reportRun, calibrationOf, calibrationBatches, batchHistory, REVIEW_COLUMNS, reviewIndex,
    CALIBRATION_KINDS, isCalibrationKind, isContentReview, isGateResult, isProbeSet, normReport, batchClass, runKey, reviewOf, finalOf,
    probeSetOf, prefixOf, messageParts, probeView, probeBatches, MESSAGE_COLUMNS, messageRows, REVIEW_ITEM_COLUMNS, reviewItemRows, packLayers };
  root.PremiumDashboardModel = api;
})(globalThis);
