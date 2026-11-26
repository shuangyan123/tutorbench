import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obj, id } from "./schema.js";
import { publish, safeJson } from "./store.js";
import type { RunRecord } from "./runner.js";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

function jobKey(r: RunRecord) {
  return JSON.stringify([r.batchId, r.tutor.id, r.card.lang, r.repeat.index,
    r.card.id, r.card.version, r.card.contentHash ?? r.card.hash, r.card.rulesVersion]);
}

function checkRecords(records: RunRecord[], errors: string[]) {
  const byId = new Map(records.map(r => [r.runId, r]));
  if (byId.size !== records.length) errors.push("duplicate runId");
  for (const r of records) {
    if (!["unscored", "student_invalid", "error"].includes(r.status) || !Array.isArray(r.scorings) || r.scorings.length)
      errors.push(r.runId + ": invalid calibration status or scoring history");
    if (r.card.hash && r.card.contentHash && r.card.hash !== r.card.contentHash)
      errors.push(r.runId + ": conflicting card hashes");
    if (r.restartOf === undefined) continue;
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
      "--batch-id", batchId, "--report", path, ...(dry ? ["--dry-run"] : [])], { stdio: "ignore", windowsHide: true });
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
