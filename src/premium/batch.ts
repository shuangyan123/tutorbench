import { hash, type Asset } from "./cards.js";
import { judgePrompt } from "./judge.js";
import { dollars, panel, Session, sumUsd, type Config, type Provider } from "./provider.js";
import { indexRow, runJob, type Job, type RunRecord } from "./runner.js";
import { invalid, unique } from "./schema.js";
import { scoring } from "./scoring.js";
import { safeJson, Store } from "./store.js";
import { tutorManifest } from "./tutor.js";
import { studentPrompt } from "./student.js";

export interface Execution {
  config: Config; assets: Asset[]; gitCommit: string; tapeHash: string;
  topUp?: boolean;
  judgePrompts?: Record<"en" | "zh-CN", string>; mode?: "hybrid_calibration";
  provider: (job: Job) => Provider; now?: () => string;
}
function bindVersions(store: Store, e: Execution, tutors: ReturnType<typeof tutorManifest>[]) {
  const c = e.config;
  safeJson(c);
  if (c.servingIdentity === "revision" && !c.identityEvidence) invalid("servingIdentity.revision_evidence");
  if (e.mode === "hybrid_calibration" && c.student.provider === "deepseek" &&
      c.servingIdentity !== undefined && c.servingIdentity !== "alias") invalid("calibration.servingIdentity");
  if ([c.budgetUsd, c.reserveUsd].some(n => dollars(n) !== n)) invalid("budget.precision");
  if ((c.maxOfflineAttempts ?? 1) > 4) invalid("maxOfflineAttempts");
  if (c.hardCapUsd !== undefined && (c.hardCapUsd < c.budgetUsd || dollars(c.hardCapUsd) !== c.hardCapUsd)) invalid("hardCapUsd");
  if (c.prices.models) {
    unique(c.prices.models.map(p => p.model), "prices.models");
    const required = [...c.tutors, c.student, ...(c.kind === "calibration" ? [] : c.tutors.flatMap(t => panel(c, t)))];
    if (required.some(m => !c.prices.models!.some(p => p.model === m.id))) invalid("prices.missing_model");
  }
  if (!c.tutors.length || !e.assets.length) invalid("tutors/cards");
  unique([...c.tutors, c.student, ...c.judges, ...c.alternates].map(m => m.id), "model.ids");
  for (const m of [...c.tutors, c.student, ...c.judges, ...c.alternates]) {
    if (/^(auto|latest|default|recommended)$/iu.test(m.pinnedVersion)) invalid("pinnedVersion");
    store.bind("developer/" + m.requestedModel.toLowerCase() + "/" + m.pinnedVersion.toLowerCase(), m.developer.toLowerCase());
  }
  for (const { prompt } of tutors) {
    if (prompt) store.bind("tutor-prompt/" + prompt.id + "/" + prompt.version, prompt.hash);
  }
  if (c.kind !== "calibration") for (const t of c.tutors) panel(c, t);
  for (const a of e.assets) {
    store.bind("card/" + a.card.id + "/" + a.card.version, a.contentHash);
    store.bind("rules/" + a.rulesVersion, hash(JSON.stringify([a.rules["zh-CN"], a.rules.en])));
  }
  store.bind("prices/" + c.prices.version, hash(safeJson(c.prices)));
  if (c.kind !== "calibration") store.bind("judges/" + c.judgeConfigVersion, hash(safeJson([c.judges, c.alternates, judgePrompt("en", e.judgePrompts?.en), judgePrompt("zh-CN", e.judgePrompts?.["zh-CN"])])));
}
function manifest(e: Execution) {
  const { config: c, assets } = e;
  const cards = assets.map(a => ({ id: a.card.id, version: a.card.version, contentHash: a.contentHash, rulesVersion: a.rulesVersion,
    studentPrompts: c.languages.map(l => hash(studentPrompt(a, l))) }));
  return { schema: "tutorbench.premium-batch", schemaVersion: 2, mode: e.mode ?? "offline_replay", ...c, tutors: c.tutors.map(tutorManifest), kind: c.kind ?? "evaluation", hardCapUsd: c.hardCapUsd ?? c.budgetUsd * 1.25, cards,
    configuredServingIdentity: c.servingIdentity ?? (e.mode === "hybrid_calibration" && c.student.provider === "deepseek" ? "alias" : "unknown"),
    gitCommit: e.gitCommit, tapeHash: e.tapeHash, planned: cards.length * c.languages.length * c.tutors.length * c.repeats };
}
function totals(records: RunRecord[]) {
  const rows = records.map(indexRow);
  const superseded = new Set(records.flatMap(r => r.restartOf ? [r.restartOf] : []));
  const count = (s: string) => rows.filter(r => !superseded.has(r.runId) && r.status === s).length;
  return { spentUsd: sumUsd(rows.map(r => r.usd)), superseded: superseded.size, scored: count("scored"), error: count("error"),
    unscored: count("unscored"), studentInvalid: count("student_invalid"), needsReview: count("needs_review") };
}
function budgetStop(c: Config, spent: number | null) {
  if (spent === null || (!c.prices.models && (c.prices.inputUsdPerMillion == null || c.prices.outputUsdPerMillion == null))) return "unknown_cost";
  if (spent > c.budgetUsd) return "actual_over_budget";
  return spent >= c.budgetUsd ? "budget_stop" : null;
}
function refresh(store: Store, batchId: string, explicitStop: string | null = null) {
  const b = store.getBatch(batchId)!;
  const records = store.records(batchId);
  const { spentUsd, ...counts } = totals(records);
  const budgetStopReason = budgetStop(b as Config, spentUsd) ?? (explicitStop === "budget_stop" ? explicitStop : null);
  // 已保存的版本漂移是永久停止条件，即使同一次扣费也耗尽了预算。
  const drift = b.mode === "hybrid_calibration" && records.some(r => r.attempts.some(a => a.reason === "model_version_drift"));
  const stop = drift ? "model_version_drift" : budgetStopReason ?? explicitStop;
  const status = stop ?? (new Set(records.map(r => JSON.stringify([r.card.id, r.card.lang, r.tutor.id, r.repeat.index]))).size === b.planned ? "complete" : "running");
  const role = b.kind === "calibration" ? "student" : "tutor";
  const measured = records.flatMap(r => r.calls.filter(c => c.role === role).map(c => ({ call: c, pin: r[role].pinnedVersion })));
  let servingIdentity = b.configuredServingIdentity ?? "unknown";
  if (!measured.some(({ call }) => call.returnedModel) ||
      (servingIdentity === "revision" && measured.some(({ call, pin }) => call.returnedModel !== pin)))
    servingIdentity = "unknown";
  store.batch(batchId, { ...b, servingIdentity, spentUsd, budgetStopReason, hardCapReached: spentUsd !== null && spentUsd >= Number(b.hardCapUsd), status, runs: { planned: b.planned, ...counts } });
  return status;
}
function updateBudget(store: Store, previous: Record<string, unknown>, e: Execution) {
  const { batchId, budgetUsd } = e.config;
  const hardCapUsd = e.config.hardCapUsd ?? budgetUsd * 1.25;
  const oldHardCap = previous.hardCapUsd ?? Number(previous.budgetUsd) * 1.25;
  if (previous.budgetUsd === budgetUsd && oldHardCap === hardCapUsd) return;
  if (!e.topUp || previous.status === "model_version_drift" || budgetUsd <= Number(previous.budgetUsd) || hardCapUsd < Number(oldHardCap)) invalid("budget.top_up");
  store.batch(batchId, { ...previous, budgetUsd, hardCapUsd, status: "running",
    budgetHistory: [...((previous.budgetHistory ?? []) as object[]), { at: e.now?.() ?? new Date().toISOString(),
      from: previous.budgetUsd, to: budgetUsd, previousHardCap: oldHardCap, hardCapUsd }] });
}
export function runBatch(store: Store, e: Execution) {
  const c = e.config, spec = manifest(e);
  const now = e.now ?? (() => new Date().toISOString());
  store.transaction(() => {
    bindVersions(store, e, spec.tutors);
    if (e.mode) store.liveGuard(c.batchId);
    const identity = { ...spec, budgetUsd: undefined, hardCapUsd: undefined };
    store.bind("batch/" + c.batchId, hash(safeJson(identity)));
    const previous = store.getBatch(c.batchId);
    if (!previous) store.batch(c.batchId, { ...spec, servingIdentity: "unknown", createdAt: now(), budgetHistory: [], reconciledUsd: {} });
    else {
      // v2 账本可能只在原记录中保留漂移，恢复前先重建被费用遮蔽的状态。
      if (previous.mode === "hybrid_calibration" && ["actual_over_budget", "budget_stop", "unknown_cost"].includes(String(previous.status)))
        refresh(store, c.batchId, String(previous.status));
      updateBudget(store, store.getBatch(c.batchId)!, e);
    }
  });
  outer: for (const asset of e.assets) for (const lang of c.languages) for (const tutor of c.tutors)
    for (let repeatIndex = 1; repeatIndex <= c.repeats; repeatIndex++) {
      const identity = [c.batchId, asset.card.id, lang, tutor.id, repeatIndex];
      const runId = "run-" + hash(JSON.stringify(identity)).slice(7);
      const stop = store.transaction(() => {
        const batch = store.getBatch(c.batchId)!;
        if (["budget_stop", "actual_over_budget", "unknown_cost", "model_version_drift"].includes(String(batch.status))) return true;
        let currentId = runId, restartOf: string | undefined;
        let previous = store.get(currentId);
        while (previous) {
          if (previous.attempts.at(-1)?.reason !== "budget_stop") return false;
          restartOf = currentId;
          currentId = "run-" + hash(currentId + "/budget-restart").slice(7);
          previous = store.get(currentId);
        }
        const job = { asset, lang, tutor, repeatIndex, runId: currentId, ...(restartOf ? { restartOf } : {}) };
        const spent = totals(store.records(c.batchId)).spentUsd;
        const stop = budgetStop(c, spent);
        if (stop) { refresh(store, c.batchId, stop); return true; }
        const session = new Session(e.provider(job), c.prices, dollars(c.budgetUsd - spent!)!, c.reserveUsd, c.maxOfflineAttempts);
        if (e.mode) store.liveGuard(c.batchId, currentId);
        const r = runJob(c, job, session, e.gitCommit, now(), e.judgePrompts?.[lang]);
        store.insert(r);
        const stopped = r.attempts.at(-1)?.reason === "budget_stop" || r.scorings.some(s => s.perJudge.some(j => j.error === "budget_stop"));
        const status = refresh(store, c.batchId, stopped ? "budget_stop" : null);
        return stopped || status === "model_version_drift";
      });
      if (stop) break outer;
    }
  if (e.mode) store.transaction(() => store.liveGuard(c.batchId));
  store.export();
  return store.getBatch(c.batchId)!;
}
export function reconcile(store: Store, batchId: string, provider: string, actualUsd: number, reason: string) {
  store.transaction(() => {
    const batch = store.getBatch(batchId);
    if (!batch || actualUsd < 0 || dollars(actualUsd) !== actualUsd) invalid("reconciliation");
    const charges: (number | null)[] = [];
    for (const r of store.records(batchId)) {
      const groups = [{ models: [r.tutor, r.student, ...(r.scorings[0]?.judgeConfig.judges ?? [])], calls: r.calls },
        ...r.scorings.slice(1).map(s => ({ models: s.judgeConfig.judges, calls: s.calls }))];
      for (const group of groups) for (const call of group.calls)
        if (group.models.find(m => m.id === call.model)?.provider === provider) charges.push(call.usd);
    }
    if (!charges.length) invalid("reconciliation.provider");
    const estimated = sumUsd(charges);
    const difference = estimated === null ? Infinity : Math.abs(Math.round(actualUsd * 1e9) - Math.round(estimated * 1e9));
    if ((estimated === null || difference >= 1e9 || (difference > 0 && difference * 10 >= Math.round(estimated * 1e9))) && !reason.trim()) invalid("reconciliation.reason");
    store.batch(batchId, { ...batch, reconciledUsd: { ...batch.reconciledUsd as object, [provider]: actualUsd },
      reconciliationHistory: [...((batch.reconciliationHistory ?? []) as object[]), { provider, actualUsd, estimated, reason, at: new Date().toISOString() }] });
  });
  store.export();
}
export function rejudge(store: Store, e: Execution, runId: string) {
  const c = e.config;
  const result = store.transaction(() => {
    const tutors = c.tutors.map(tutorManifest);
    bindVersions(store, e, tutors);
    const r = store.get(runId);
    if (!r || c.kind === "calibration" || r.batchKind === "calibration" || r.batchId !== c.batchId || ["error", "student_invalid"].includes(r.end.reason)) invalid("rejudge.run");
    const asset = e.assets.find(a => a.card.id === r.card.id && a.contentHash === r.card.contentHash &&
      a.card.version === r.card.version && a.rulesVersion === r.card.rulesVersion);
    if (!asset) invalid("rejudge.card");
    updateBudget(store, store.getBatch(c.batchId)!, e);
    const batch = store.getBatch(c.batchId)!;
    const tutor = c.tutors.find(t => t.id === r.tutor.id);
    if (!tutor || safeJson(tutors) !== safeJson(batch.tutors) || tutor.developer !== r.tutor.developer || safeJson(c.student) !== safeJson(batch.student) ||
        c.budgetUsd !== batch.budgetUsd || (c.hardCapUsd ?? c.budgetUsd * 1.25) !== (batch.hardCapUsd ?? Number(batch.budgetUsd) * 1.25) || c.reserveUsd !== batch.reserveUsd || safeJson(c.prices) !== safeJson(batch.prices)) invalid("rejudge.identity/budget");
    const spent = totals(store.records(c.batchId)).spentUsd;
    const stop = budgetStop(c, spent);
    if (stop || batch.status === "budget_stop") throw new Error(stop ?? "budget_stop");
    const n = r.scorings.length + 1;
    const session = new Session(e.provider({ asset, lang: r.card.lang, tutor, repeatIndex: r.repeat.index, runId }),
      c.prices, dollars(c.budgetUsd - spent!)!, c.reserveUsd, c.maxOfflineAttempts);
    const s = scoring(c, tutor, asset, r.card.lang, r, session, "s" + n, e.now?.() ?? new Date().toISOString(), e.judgePrompts?.[r.card.lang]);
    store.append(runId, n, { ...s, gitCommit: e.gitCommit, tapeHash: e.tapeHash });
    refresh(store, c.batchId, s.perJudge.some(j => j.error === "budget_stop") ? "budget_stop" : null);
    return s.scoringId;
  });
  store.export();
  return result;
}
