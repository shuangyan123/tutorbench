import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readExpectations, type Expectations, type Phase } from "./plan.js";
import { childEnvironment } from "./child-environment.js";
import { obj, id, invalid } from "./schema.js";
import { publish, safeJson } from "./store.js";
import type { RunRecord } from "./runner.js";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

function jobKey(r: RunRecord) {
  return JSON.stringify([r.batchId, r.batchKind, r.tutor.id, r.card.lang, r.repeat.index,
    r.card.id, r.card.version, r.card.contentHash ?? r.card.hash, r.card.rulesVersion, r.card.protocolHash,
    ...(r.batchKind === "calibration-probe" ? [r.probe?.probeId, r.probe?.prefixHash, r.probe?.targetStudentMessage] : [])]);
}

function checkRecords(records: RunRecord[], errors: string[]) {
  const byId = new Map(records.map(r => [r.runId, r]));
  if (byId.size !== records.length) errors.push("duplicate runId");
  const successors = new Set<string>();
  for (const r of records) {
    if (!["unscored", "student_invalid", "error"].includes(r.status) || !Array.isArray(r.scorings) || r.scorings.length)
      errors.push(r.runId + ": invalid calibration status or scoring history");
    if (r.card.hash && r.card.contentHash && r.card.hash !== r.card.contentHash)
      errors.push(r.runId + ": conflicting card hashes");
    if (r.restartOf === undefined) continue;
    if (successors.has(r.restartOf)) errors.push(r.runId + ": duplicate restart successor");
    successors.add(r.restartOf);
    const parent = byId.get(r.restartOf);
    if (!parent || parent.status !== "error" || jobKey(parent) !== jobKey(r))
      errors.push(r.runId + ": restartOf must reference an error in the same planned job");
    // 只沿同一条前驱链找环，封闭的作废链也不能从验收中消失。
    const seen = new Set([r.runId]);
    let previous = parent;
    while (previous) {
      if (seen.has(previous.runId)) { errors.push(r.runId + ": restart cycle"); break; }
      seen.add(previous.runId);
      previous = previous.restartOf ? byId.get(previous.restartOf) : undefined;
    }
  }
}

export function fingerprintDistribution(records: RunRecord[]) {
  const replaced = new Set(records.flatMap(r => r.restartOf ? [r.restartOf] : []));
  const counts = new Map<string | null, { conversations: number; adopted: number; superseded: number }>();
  for (const r of records) {
    const seen = new Set((r.calls ?? []).filter(c => c.role === "student").map(c => c.system_fingerprint ?? null));
    for (const fp of seen) {
      const count = counts.get(fp) ?? { conversations: 0, adopted: 0, superseded: 0 };
      count.conversations++;
      if (replaced.has(r.runId)) count.superseded++;
      else count.adopted++;
      counts.set(fp, count);
    }
  }
  const sorted = [...counts.keys()].sort((a, b) => a === b ? 0 : a === null || (b !== null && a < b) ? -1 : 1);
  return sorted.map(fp => ({ system_fingerprint: fp, ...counts.get(fp)! }));
}

// 授权的私有 v2 检查器负责原阈值与重写统计；发布报告前再校验 Runner 的记录完整性。
export function checkCalibration(out: string, checker: string, expectations: string, batchId: string, dry: boolean) {
  id(batchId, "batch");
  const scratch = mkdtempSync(join(tmpdir(), "premium-check-"));
  const destination = join(out, "calibration-report-" + batchId + ".json");
  try {
    const path = join(scratch, "reference.json");
    const process = spawnSync("python", ["-I", "-B", "-X", "utf8", checker, out, expectations,
      "--batch-id", batchId, "--report", path, ...(dry ? ["--dry-run"] : [])], { env: childEnvironment("local"), stdio: "ignore", windowsHide: true });
    if (process.status !== 0 && process.status !== 1) throw new Error("checker unavailable");
    const report = obj(read(path), "checker.report");
    if (report.checkerVersion !== 2 || report.batchId !== batchId || report.dryRun !== dry ||
        report.verdict !== (process.status === 0 ? "PASS" : "FAIL") || !Array.isArray(report.cohortErrors) || !Array.isArray(report.groups))
      throw new Error("invalid v2 report");
    const batch = read(join(out, "batches", batchId + ".json"));
    const exp = read(expectations);
    if (exp.schemaVersion !== 2 || !exp.rulesVersion) throw new Error("invalid v2 expectations");
    const dir = join(out, "records");
    const records: RunRecord[] = [];
    for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
      const r: RunRecord = read(join(dir, f));
      if (r.batchId !== batchId) { report.cohortErrors.push("output directory contains another batch"); continue; }
      if (r.runId + ".json" !== f || r.card.rulesVersion !== exp.rulesVersion)
        report.cohortErrors.push(r.runId + ": record filename or rules version mismatch");
      records.push(r);
    }
    checkRecords(records, report.cohortErrors);
    if (dry) {
      const tutors = batch.tutors.map((t: { id: string }) => t.id);
      if (batch.repeats !== 1 || ![...exp.plannedGroups, ...(exp.optionalGroups ?? [])].every(t => tutors.includes(t)))
        report.cohortErrors.push("dry run requires every supplied group with one repeat");
    }
    if (report.cohortErrors.length || (dry && report.groups.some(g => g.pass !== true))) report.verdict = "FAIL";
    report.servingIdentity = batch.servingIdentity ?? "unknown";
    const distribution = fingerprintDistribution(records);
    report.fingerprintDistribution = distribution;
    report.multipleFingerprints = distribution.filter(row => row.system_fingerprint !== null).length > 1;
    report.humanReviewPending = true;
    const bytes = safeJson(report) + "\n";
    publish(destination, bytes);
    console.log(bytes.trimEnd());
    return report.verdict === "PASS" ? 0 : 1;
  } catch {
    console.error("CANNOT CHECK: verify private v2 checker, expectations, input records and output directory.");
    // 无法检查时让固定路径也显示本次状态，避免读取旧 PASS。
    try { publish(destination, JSON.stringify({ batchId, verdict: "CANNOT_CHECK" }) + "\n"); } catch { /* output unavailable */ }
    return 2;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

// v3 的机器报告必须保留待复核状态。最终关卡还要独立核验报告身份及计划覆盖。
const formats = ["json", "fenced_json", "text", "empty", "truncated"];
function checkRequests(records: RunRecord[], errors: string[]) {
  for (const r of records) {
    if (r.schemaVersion !== 6 || r.student.thinking !== "disabled" || (r.batchKind === "calibration-probe") !== !!r.probe ||
        !isDeepStrictEqual(r.student.responseFormat, { type: "json_object" }) ||
        !isDeepStrictEqual(r.student.params, { temperature: 0.7, maxOutputTokens: 512 }) ||
        !Array.isArray(r.calls) || r.calls.some(c => c.role === "judge" ||
          (c.role === "student" && (c.responseFormat?.requested !== "json_object" ||
            !/^sha256:[a-f0-9]{64}$/u.test(c.historyHash ?? "") ||
            (c.responseFormat.observed === null ? !c.error : !formats.includes(c.responseFormat.observed))))))
      errors.push(r.runId + ": invalid v6 student request parameters or call evidence");
  }
}
function pythonReport(checker: string, args: string[], reportOption: string, accepted: number[]) {
  const scratch = mkdtempSync(join(tmpdir(), "premium-check-"));
  try {
    const path = join(scratch, "report.json");
    const process = spawnSync("python", ["-I", "-B", "-X", "utf8", checker, ...args, reportOption, path],
      { env: childEnvironment("local"), stdio: "ignore", windowsHide: true });
    if (process.status === null || !accepted.includes(process.status)) return invalid("checker.exit");
    return { status: process.status, report: obj(read(path), "checker.report") };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
export function validateCalibration(checker: string, expectations: string, cards: string, calibration: string) {
  readExpectations(expectations);
  const { status, report } = pythonReport(checker, ["validate", cards, calibration, expectations], "--report", [0, 1]);
  if (report.ok !== (status === 0) || !Array.isArray(report.errors) || (status === 0 && report.errors.length)) invalid("checker.validate");
  return { status, report };
}
export function checkCalibrationV3(out: string, checker: string, expectations: string, batchId: string, cards: string, calibration: string) {
  id(batchId, "batch");
  const destination = join(out, "calibration-report-" + batchId + ".json");
  try {
    const exp = readExpectations(expectations);
    const { status, report } = pythonReport(checker, ["check", out, expectations, "--cards", cards,
      "--calibration", calibration, "--batch-id", batchId], "--report", [0, 1]);
    const batch = read(join(out, "batches", batchId + ".json"));
    const errors = report.cohortErrors;
    if (report.checkerVersion !== 3 || report.batchId !== batchId || batch.batchId !== batchId ||
        report.batchKind !== batch.kind || (report.gate ?? null) !== (batch.gate ?? null) ||
        report.machineVerdict !== (status === 0 ? "PASS" : "FAIL") || report.verdict !== (status === 0 ? "PENDING_REVIEW" : "FAIL") ||
        !Array.isArray(errors) || !Array.isArray(report.runs) || !Array.isArray(report.groups) ||
        !isDeepStrictEqual(report.pins, exp.pins)) invalid("checker.v3_report");
    const dir = join(out, "records"), records: RunRecord[] = [];
    const seriesBatches = new Set<string>();
    if (batch.calibrationSeries) {
      const batches = join(out, "batches");
      for (const f of readdirSync(batches).filter(f => f.endsWith(".json"))) {
        const b = read(join(batches, f));
        if (b.calibrationSeries === batch.calibrationSeries && b.batchId + ".json" === f &&
            ["G2", "G3", "G4"].includes(b.phase)) seriesBatches.add(b.batchId);
      }
    }
    for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
      const r: RunRecord = read(join(dir, f));
      if (r.runId + ".json" !== f) errors.push("record filename mismatch");
      if (r.batchId !== batchId) {
        if (!seriesBatches.has(r.batchId)) errors.push("output directory contains an unrelated batch");
        continue;
      }
      if (r.batchKind !== batch.kind || r.card.rulesVersion !== exp.rulesVersion ||
          r.card.protocolVersion !== exp.protocol.version || r.card.protocolHash !== exp.protocol.hash)
        errors.push(r.runId + ": record kind or protocol mismatch");
      records.push(r);
    }
    checkRecords(records, errors);
    checkRequests(records, errors);
    if (errors.length) report.verdict = "FAIL";
    report.servingIdentity = batch.servingIdentity ?? "unknown";
    const distribution = fingerprintDistribution(records);
    report.fingerprintDistribution = distribution;
    report.multipleFingerprints = distribution.filter(row => row.system_fingerprint !== null).length > 1;
    publish(destination, safeJson(report) + "\n");
    return { status: report.verdict === "FAIL" ? 1 : 0, report };
  } catch {
    const report = { checkerVersion: 3, batchId, verdict: "CANNOT_CHECK" };
    try { publish(destination, safeJson(report) + "\n"); } catch { /* 路径不可写。 */ }
    return { status: 2, report };
  }
}
const stages: Phase[] = ["G2", "G3", "G4"];
function reportPhase(r: Record<string, unknown>): Phase | undefined {
  if (r.batchKind === "calibration-probe") return r.gate === "key" ? "G2" : r.gate === "rest" ? "G3" : undefined;
  if (r.batchKind === "calibration" && r.gate == null) return "G4";
}
function coverage(r: Record<string, unknown>, exp: Expectations, phase: Phase) {
  const keys = phase === "G4" ? [...exp.required, ...exp.optional.filter(g => Array.isArray(r.groups) &&
    r.groups.some((row: unknown) => obj(row, "final.group").tutor === g))] : exp.probes.gates[phase === "G2" ? "key" : "rest"];
  const keyColumn = phase === "G4" ? "tutor" : "probeId";
  const expectedGroups = new Set(keys.flatMap(key => exp.languages.map(lang => JSON.stringify([key, lang]))));
  const expectedRuns = new Set(keys.flatMap(key => exp.languages.flatMap(lang =>
    Array.from({ length: exp.repeats }, (_, i) => JSON.stringify([key, lang, i + 1])))));
  if (!Array.isArray(r.groups) || !Array.isArray(r.runs) || !r.groups.length || !r.runs.length) return false;
  for (const row of r.groups) {
    const g = obj(row, "final.group");
    if (g.runs !== exp.repeats || g.optional !== (phase === "G4" && exp.optional.includes(String(g[keyColumn]))) ||
        !expectedGroups.delete(JSON.stringify([g[keyColumn], g.lang]))) return false;
  }
  const ids = new Set();
  for (const row of r.runs) {
    const run = obj(row, "final.run");
    if (typeof run.runId !== "string" || !run.runId || ids.has(run.runId) ||
        !expectedRuns.delete(JSON.stringify([run[keyColumn], run.lang, run.repeat]))) return false;
    ids.add(run.runId);
  }
  return !expectedGroups.size && !expectedRuns.size;
}
export function finalCalibration(checker: string, expectations: string, scope: Phase, reports: string[], reviews: string[]) {
  const exp = readExpectations(expectations);
  const errors: string[] = [], requested = stages.slice(0, stages.indexOf(scope) + 1), batchIds: string[] = [];
  const inputs = reports.map(path => obj(read(path), "final.input"));
  const uniqueIds = new Set(inputs.map(r => id(r.batchId, "final.batchId")));
  if (inputs.length !== requested.length || uniqueIds.size !== inputs.length) errors.push("wrong report count or duplicate batch ID");
  for (const phase of requested) {
    const reportsForPhase = inputs.filter(r => reportPhase(r) === phase);
    if (reportsForPhase.length !== 1) { errors.push("expected exactly one report for " + phase); continue; }
    const r = reportsForPhase[0]!;
    batchIds.push(String(r.batchId));
    if (r.checkerVersion !== 3 || r.machineVerdict !== "PASS" || r.verdict !== "PENDING_REVIEW" ||
        !Array.isArray(r.cohortErrors) || r.cohortErrors.length) errors.push(phase + ": machine or cohort failure");
    if (!isDeepStrictEqual(r.pins, exp.pins)) errors.push(phase + ": report pins differ from expectations");
    if (!coverage(r, exp, phase)) errors.push(phase + ": incomplete or duplicate report coverage");
  }
  const reviewed = new Set<string>();
  for (const path of reviews) {
    const review = obj(read(path), "final.review");
    const idValue = id(review.batchId, "final.review.batchId");
    if (!uniqueIds.has(idValue) || reviewed.has(idValue) || review.schemaVersion !== 1 ||
        !["open", "complete"].includes(String(review.status)) || !Array.isArray(review.items)) errors.push("invalid or duplicate review");
    reviewed.add(idValue);
  }
  if (errors.length) return { status: 1, batchIds, report: { checkerVersion: 3, kind: scope === "G4" ? "final" : "gate",
    scope, verdict: "FAIL", errors, groups: [], overrides: [] } };
  const result = pythonReport(checker, ["final", expectations, "--scope", scope, ...reports.flatMap(path => ["--report", path]),
    ...reviews.flatMap(path => ["--review", path])], "--out", [0, 1, 3]);
  if (result.report.checkerVersion !== 3 || result.report.scope !== scope ||
      result.report.verdict !== (result.status === 0 ? "PASS" : result.status === 1 ? "FAIL" : "PENDING_REVIEW"))
    invalid("checker.final_verdict");
  return { ...result, batchIds };
}
