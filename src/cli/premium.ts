import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { hash, loadCards, parseCard } from "../premium/cards.js";
import { rejudge, runBatch } from "../premium/batch.js";
import { configSchema } from "../premium/provider.js";
import { replayProvider } from "../premium/replay.js";
import { Store } from "../premium/store.js";
import { id } from "../premium/schema.js";

function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({ args, options: {
    cards: { type: "string" }, card: { type: "string" }, config: { type: "string" }, tape: { type: "string" },
    out: { type: "string", default: "runs/premium" }, "run-id": { type: "string" },
  } });
  if (command === "check-cards" && values.card) {
    const card = parseCard(JSON.parse(readFileSync(values.card, "utf8")));
    return { id: card.id, version: card.version, check: "structure_only" };
  }
  if (command === "index") {
    const store = new Store(resolve(values.out!));
    try { return { records: store.export() }; } finally { store.close(); }
  }
  if (!values.cards) throw new Error("--cards is required");
  const assets = loadCards(values.cards);
  if (command === "check-cards") return assets.map(a => ({ id: a.card.id, version: a.card.version, contentHash: a.contentHash }));
  if (!values.config || !values.tape || (command !== "run" && command !== "rejudge")) throw new Error("Expected run/rejudge with --config and --tape");
  const config = configSchema(JSON.parse(readFileSync(values.config, "utf8")), "config");
  const bytes = readFileSync(values.tape, "utf8");
  const tape: unknown = JSON.parse(bytes);
  const execution = { config, assets, provider: (job: Parameters<typeof replayProvider>[1]) => replayProvider(tape, job),
    tapeHash: hash(bytes.replace(/\r\n/g, "\n")), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
  const store = new Store(resolve(values.out!));
  try {
    if (command === "rejudge") return { scoringId: rejudge(store, execution, id(values["run-id"], "run-id")) };
    const b = runBatch(store, execution);
    return { batchId: b.batchId, status: b.status, runs: b.runs, spentUsd: b.spentUsd };
  } finally { store.close(); }
}
try { console.log(JSON.stringify(main(), null, 2)); }
catch (e) {
  // JSON 解析异常可能包含私有输入片段。只输出已知的安全错误类型。
  const message = e instanceof Error && /^(Invalid premium field:|Premium configuration\/version drift:|--cards|Expected run|Existing record|Sensitive premium|unknown_cost|budget_stop|actual_over_budget)/u.test(e.message)
    ? e.message : "Premium input or storage unavailable; verify paths, UTF-8 JSON and required rules/lock.";
  console.error(message);
  process.exitCode = 1;
}
