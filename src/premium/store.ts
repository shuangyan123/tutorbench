import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { indexRow, type RunRecord } from "./runner.js";
import { id, invalid } from "./schema.js";
import { sensitive } from "./provider.js";

export function safeJson(value: unknown) {
  const text = JSON.stringify(value);
  if (sensitive(text)) throw new Error("Sensitive premium data blocked");
  return text;
}
export function publish(path: string, bytes: string) {
  if (existsSync(path) && readFileSync(path, "utf8") === bytes) return;
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    writeFileSync(temp, bytes, { flag: "wx", mode: 0o600, flush: true });
    renameSync(temp, path);
  } finally { rmSync(temp, { force: true }); }
}
export function rebuildIndex(root: string) {
  const dir = join(root, "records");
  const rows = (existsSync(dir) ? readdirSync(dir) : []).filter(f => f.endsWith(".json")).sort().map(f => {
    const r: RunRecord = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (r.schema !== "tutorbench.premium-run-record" || ![1, 2, 3, 4].includes(r.schemaVersion) || id(r.runId, "runId") + ".json" !== f) invalid("record.identity");
    return safeJson(indexRow(r)) + "\n";
  });
  publish(join(root, "index.jsonl"), rows.join(""));
  return rows.length;
}
type Score = RunRecord["scorings"][number] & { gitCommit: string; tapeHash: string };
// SQLite 原子提交原始记录与独立评分条目。JSON 是可从已提交事务恢复的私有读取接口。
export class Store {
  private readonly db: DatabaseSync;
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    for (const dir of ["records", "batches"]) mkdirSync(join(root, dir), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(root, ".premium.sqlite"));
    this.db.exec(`PRAGMA busy_timeout=30000;
      CREATE TABLE IF NOT EXISTS bindings (key TEXT PRIMARY KEY, identity TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS originals (id TEXT PRIMARY KEY, batch TEXT NOT NULL, body TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS batch_runs ON originals(batch);
      CREATE TABLE IF NOT EXISTS scores (run TEXT NOT NULL REFERENCES originals(id), n INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run,n));`);
  }
  // 活跃标记独立于 SQLite 事务。断电后不能自动重放一次可能已扣费的任务。
  liveGuard(batch: string, newRun?: string) {
    const path = join(this.root, ".inflight-" + id(batch, "batch"));
    if (existsSync(path)) {
      const run = readFileSync(path, "utf8");
      if (!this.get(run)) invalid("calibration.unreconciled_inflight_job");
      rmSync(path);
    }
    if (newRun) writeFileSync(path, newRun, { flag: "wx", flush: true, mode: 0o600 });
  }
  close() { this.db.close(); }
  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  bind(key: string, identity: string) {
    this.db.prepare("INSERT OR IGNORE INTO bindings VALUES (?,?)").run(key, identity);
    if (this.db.prepare("SELECT identity FROM bindings WHERE key=?").get(key)?.identity !== identity)
      throw new Error("Premium configuration/version drift: " + key);
  }
  batch(id: string, value: object) {
    if (!this.db.prepare("SELECT 1 FROM batches WHERE id=?").get(id) && existsSync(join(this.root, "batches", id + ".json")))
      throw new Error("Batch ID already exists outside this ledger");
    this.db.prepare("INSERT INTO batches VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").run(id, safeJson(value));
  }
  getBatch(id: string): Record<string, unknown> | null {
    const row = this.db.prepare("SELECT body FROM batches WHERE id=?").get(id);
    return row ? JSON.parse(String(row.body)) : null;
  }
  get(id: string): RunRecord | null {
    const row = this.db.prepare("SELECT body FROM originals WHERE id=?").get(id);
    if (!row) return null;
    const r: RunRecord = JSON.parse(String(row.body));
    for (const s of this.db.prepare("SELECT body FROM scores WHERE run=? ORDER BY n").all(id)) r.scorings.push(JSON.parse(String(s.body)));
    return r;
  }
  records(batch: string) {
    return this.db.prepare("SELECT id FROM originals WHERE batch=? ORDER BY id").all(batch).map(row => this.get(String(row.id))!);
  }
  insert(r: RunRecord) {
    if (existsSync(join(this.root, "records", r.runId + ".json"))) throw new Error("Existing record is immutable");
    this.db.prepare("INSERT INTO originals VALUES (?,?,?)").run(r.runId, r.batchId, safeJson(r));
  }
  append(run: string, n: number, score: Score) {
    this.db.prepare("INSERT INTO scores VALUES (?,?,?)").run(run, n, safeJson(score));
  }
  export() {
    return this.transaction(() => {
      for (const row of this.db.prepare("SELECT id FROM originals ORDER BY id").all()) {
        const run = String(row.id);
        publish(join(this.root, "records", run + ".json"), safeJson(this.get(run)) + "\n");
      }
      for (const row of this.db.prepare("SELECT * FROM batches ORDER BY id").all())
        publish(join(this.root, "batches", String(row.id) + ".json"), String(row.body) + "\n");
      return rebuildIndex(this.root);
    });
  }
}
