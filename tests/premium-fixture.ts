import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { loadCards, hash } from "../src/premium/cards.js";
import { configSchema, Session, type Provider, type Reply } from "../src/premium/provider.js";
import { replayProvider } from "../src/premium/replay.js";
import { runJob } from "../src/premium/runner.js";
import { Store } from "../src/premium/store.js";

export const dir = "examples/premium";
export function fixture() {
  const assets = loadCards(join(dir, "cards"));
  const config = configSchema(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")), "config");
  const bytes = readFileSync(join(dir, "tape.json"), "utf8");
  const tape: unknown = JSON.parse(bytes);
  const job = { runId: "synthetic-run", lang: "en" as const, repeatIndex: 1, tutor: config.tutors[0]!, asset: assets[0]! };
  const e = { assets, config, tapeHash: hash(bytes), gitCommit: "a".repeat(40), now: () => "2026-01-01T00:00:00Z",
    provider: (j: Parameters<typeof replayProvider>[1]) => replayProvider(tape, j) };
  return { job, e, base: e.provider(job) };
}
export function drive(wrap: (base: Provider) => Provider = base => base) {
  const { job, e, base } = fixture();
  const session = new Session(wrap(base), e.config.prices, 10, 0.01);
  return runJob(e.config, job, session, e.gitCommit, e.now());
}
export function reply(text: string | object, version: string): Reply {
  return { text: typeof text === "string" ? text : JSON.stringify(text), resolvedModel: version,
    finishReason: "stop", latencyMs: 1, usage: { inputTokens: 10, outputTokens: 5 } };
}
export function temp(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), "premium-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
export function storage(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "premium-store-"));
  const store = new Store(root);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store };
}
