import { hash, type Asset } from "./cards.js";
import { judgePrompt } from "./judge.js";
import { dollars, panel, Session, sumUsd, type Config, type Provider } from "./provider.js";
import { indexRow, runJob, type Job, type RunRecord } from "./runner.js";
import { invalid, unique } from "./schema.js";
import { scoring } from "./scoring.js";
import { safeJson, Store } from "./store.js";
import { studentPrompt } from "./student.js";

export interface Execution {
  config: Config; assets: Asset[]; gitCommit: string; tapeHash: string;
  provider: (job: Job) => Provider; now?: () => string;
}
function bindVersions(store: Store, e: Execution) {
  const c = e.config;
  safeJson(c);
  if ([c.budgetUsd, c.reserveUsd].some(n => dollars(n) !== n)) invalid("budget.precision");
  if ((c.maxOfflineAttempts ?? 1) > 4) invalid("maxOfflineAttempts");
  if (!c.tutors.length || !e.assets.length) invalid("tutors/cards");
  unique([...c.tutors, c.student, ...c.judges, ...c.alternates].map(m => m.id), "model.ids");
  for (const m of [...c.tutors, c.student, ...c.judges, ...c.alternates]) {
    if (/^(auto|latest|default|recommended)$/iu.test(m.pinnedVersion)) invalid("pinnedVersion");
    store.bind("developer/" + m.requestedModel.toLowerCase() + "/" + m.pinnedVersion.toLowerCase(), m.developer.toLowerCase());
  }
  for (const t of c.tutors) panel(c, t);
  for (const a of e.assets) {
    store.bind("card/" + a.card.id + "/" + a.card.version, a.contentHash);
    store.bind("rules/" + a.rulesVersion, hash(JSON.stringify([a.rules["zh-CN"], a.rules.en])));
  }
  store.bind("prices/" + c.prices.version, hash(safeJson(c.prices)));
  store.bind("judges/" + c.judgeConfigVersion, hash(safeJson([c.judges, c.alternates, judgePrompt("en"), judgePrompt("zh-CN")])));
}
function manifest(e: Execution) {
  const { config: c, assets } = e;
  const cards = assets.map(a => ({ id: a.card.id, version: a.card.version, contentHash: a.contentHash, rulesVersion: a.rulesVersion,
    studentPrompts: c.languages.map(l => hash(studentPrompt(a, l))) }));
  return { schema: "tutorbench.premium-batch", schemaVersion: 1, mode: "offline_replay", ...c, cards,
    gitCommit: e.gitCommit, tapeHash: e.tapeHash, planned: cards.length * c.languages.length * c.tutors.length * c.repeats };
}
function totals(records: RunRecord[]) {
  const rows = records.map(indexRow);
  const count = (s: string) => rows.filter(r => r.status === s).length;
  return { spentUsd: sumUsd(rows.map(r => r.usd)), scored: count("scored"), error: count("error"),
    studentInvalid: count("student_invalid"), needsReview: count("needs_review") };
}
function budgetStop(c: Config, spent: number | null) {
  if (spent === null || c.prices.inputUsdPerMillion === null || c.prices.outputUsdPerMillion === null) return "unknown_cost";
  if (spent > c.budgetUsd) return "actual_over_budget";
  return dollars(c.budgetUsd - spent)! < c.reserveUsd || spent >= c.budgetUsd ? "budget_stop" : null;
}
function refresh(store: Store, batchId: string, explicitStop: string | null = null) {
  const b = store.getBatch(batchId)!;
  const records = store.records(batchId);
  const { spentUsd, ...counts } = totals(records);
  const stop = explicitStop ?? budgetStop(b as Config, spentUsd);
  const status = stop ?? (records.length === b.planned ? "complete" : "running");
  store.batch(batchId, { ...b, spentUsd, status, runs: { planned: b.planned, ...counts } });
  return status;
}
export function runBatch(store: Store, e: Execution) {
  const c = e.config, spec = manifest(e);
  const now = e.now ?? (() => new Date().toISOString());
  store.transaction(() => {
    bindVersions(store, e);
    store.bind("batch/" + c.batchId, hash(safeJson(spec)));
    if (!store.getBatch(c.batchId)) store.batch(c.batchId, { ...spec, createdAt: now() });
  });
  outer: for (const asset of e.assets) for (const lang of c.languages) for (const tutor of c.tutors)
    for (let repeatIndex = 1; repeatIndex <= c.repeats; repeatIndex++) {
      const identity = [c.batchId, asset.card.id, lang, tutor.id, repeatIndex];
      const runId = "run-" + hash(JSON.stringify(identity)).slice(7);
      const job = { asset, lang, tutor, repeatIndex, runId };
      const stop = store.transaction(() => {
        if (store.get(runId)) return false;
        const spent = totals(store.records(c.batchId)).spentUsd;
        const stop = budgetStop(c, spent);
        if (stop) { refresh(store, c.batchId, stop); return true; }
        const session = new Session(e.provider(job), c.prices, dollars(c.budgetUsd - spent!)!, c.reserveUsd, c.maxOfflineAttempts);
        const r = runJob(c, job, session, e.gitCommit, now());
        store.insert(r);
        refresh(store, c.batchId);
        return false;
      });
      if (stop) break outer;
    }
  store.export();
  return store.getBatch(c.batchId)!;
}
export function rejudge(store: Store, e: Execution, runId: string) {
  const c = e.config;
  const result = store.transaction(() => {
    bindVersions(store, e);
    const r = store.get(runId);
    if (!r || r.batchId !== c.batchId || ["error", "student_invalid"].includes(r.end.reason)) invalid("rejudge.run");
    const asset = e.assets.find(a => a.card.id === r.card.id && a.contentHash === r.card.contentHash &&
      a.card.version === r.card.version && a.rulesVersion === r.card.rulesVersion);
    if (!asset) invalid("rejudge.card");
    const batch = store.getBatch(c.batchId)!;
    const tutor = c.tutors.find(t => t.id === r.tutor.id);
    if (!tutor || safeJson(c.tutors) !== safeJson(batch.tutors) || tutor.developer !== r.tutor.developer || safeJson(c.student) !== safeJson(batch.student) ||
        c.budgetUsd !== batch.budgetUsd || c.reserveUsd !== batch.reserveUsd || safeJson(c.prices) !== safeJson(batch.prices)) invalid("rejudge.identity/budget");
    const spent = totals(store.records(c.batchId)).spentUsd;
    const stop = budgetStop(c, spent);
    if (stop) throw new Error(stop);
    const n = r.scorings.length + 1;
    const session = new Session(e.provider({ asset, lang: r.card.lang, tutor, repeatIndex: r.repeat.index, runId }),
      c.prices, dollars(c.budgetUsd - spent!)!, c.reserveUsd, c.maxOfflineAttempts);
    const s = scoring(c, tutor, asset, r.card.lang, r, session, "s" + n, e.now?.() ?? new Date().toISOString());
    store.append(runId, n, { ...s, gitCommit: e.gitCommit, tapeHash: e.tapeHash });
    refresh(store, c.batchId);
    return s.scoringId;
  });
  store.export();
  return result;
}
