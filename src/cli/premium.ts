import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { hash, loadCards, parseCard } from "../premium/cards.js";
import { hybridProvider, liveStudent } from "../premium/calibration.js";
import { reconcile, rejudge, runBatch, type Execution } from "../premium/batch.js";
import { configSchema } from "../premium/provider.js";
import { replayProvider } from "../premium/replay.js";
import { Store } from "../premium/store.js";
import { id, invalid } from "../premium/schema.js";

function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({ args, options: {
    checker: { type: "string" }, expectations: { type: "string" }, "batch-id": { type: "string" },
    "dry-run": { type: "boolean" }, "live-student": { type: "boolean" }, "card-id": { type: "string" },
    "judge-prompts": { type: "string" }, "top-up": { type: "boolean" },
    provider: { type: "string" }, usd: { type: "string" }, reason: { type: "string" },
    cards: { type: "string" }, card: { type: "string" }, config: { type: "string" }, tape: { type: "string" },
    out: { type: "string", default: "runs/premium" }, "run-id": { type: "string" },
  } });
  if (command === "check-calibration") {
    if (!values.checker || !values.expectations || !values["batch-id"]) invalid("checker.arguments");
    execFileSync("python", ["-X", "utf8", "-B", resolve(values.checker), resolve(values.out!), resolve(values.expectations),
      "--batch-id", id(values["batch-id"], "batch"), ...(values["dry-run"] ? ["--dry-run"] : [])], { stdio: "inherit" });
    return;
  }
  if (command === "reconcile") {
    if (!values.usd?.trim()) invalid("reconciliation.usd");
    const store = new Store(resolve(values.out!));
    try { reconcile(store, id(values["batch-id"], "batch"), id(values.provider, "provider"), Number(values.usd), values.reason ?? ""); }
    finally { store.close(); }
    return { reconciled: true };
  }
  if (command === "check-cards" && values.card) {
    const card = parseCard(JSON.parse(readFileSync(values.card, "utf8")));
    return { id: card.id, version: card.version, check: "structure_only" };
  }
  if (command === "index") {
    const store = new Store(resolve(values.out!));
    try { return { records: store.export() }; } finally { store.close(); }
  }
  if (!values.cards) throw new Error("--cards is required");
  const all = loadCards(values.cards);
  const assets = values["card-id"] ? all.filter(a => a.card.id === values["card-id"]) : all;
  if (!assets.length) invalid("card-id");
  if (command === "check-cards") return assets.map(a => ({ id: a.card.id, version: a.card.version, contentHash: a.contentHash }));
  if (!values.config || !values.tape || !["run", "calibrate", "rejudge"].includes(command ?? "")) throw new Error("Expected run/rejudge with --config and --tape");
  const config = configSchema(JSON.parse(readFileSync(values.config, "utf8")), "config");
  if (command === "calibrate") {
    if (config.kind === "evaluation") invalid("calibration.kind");
    config.kind = "calibration";
  }
  if (config.kind !== "calibration" && !values["judge-prompts"] && config.syntheticJudgeRubric !== "fixture") invalid("judge-prompts.required");
  const live = values["live-student"];
  if (live && (command !== "calibrate" || !config.prices.models || config.student.provider !== "deepseek" ||
      config.student.developer.toLowerCase() !== "deepseek" || !process.env.DEEPSEEK_API_KEY ||
      assets.some(a => !a.card.leaveNotBefore) || config.tutors.some(t => t.provider !== "scripted"))) invalid("calibration.live_configuration");
  const bytes = readFileSync(values.tape, "utf8");
  const tape: unknown = JSON.parse(bytes);
  const execution: Execution = { config, assets, topUp: values["top-up"] ?? false,
    ...(live ? { mode: "hybrid_calibration" as const } : {}),
    provider: job => live ? hybridProvider(tape, job, liveStudent) : replayProvider(tape, job),
    tapeHash: hash(bytes.replace(/\r\n/g, "\n")), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
  if (values["judge-prompts"]) {
    const text = readFileSync(values["judge-prompts"], "utf8").replace(/\r\n/g, "\n");
    const blocks = [...text.matchAll(/^\x60{3}text\n([\s\S]+?)\n\x60{3}$/gmu)];
    if (blocks.length !== 2) invalid("judge-prompts");
    execution.judgePrompts = { "zh-CN": blocks[0]![1]!, en: blocks[1]![1]! };
  }
  const store = new Store(resolve(values.out!));
  try {
    if (command === "rejudge") return { scoringId: rejudge(store, execution, id(values["run-id"], "run-id")) };
    const b = runBatch(store, execution);
    return { batchId: b.batchId, status: b.status, runs: b.runs, spentUsd: b.spentUsd };
  } finally { store.close(); }
}
try {
  const result = main();
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
}
catch (e) {
  // JSON 解析异常可能包含私有输入片段。只输出已知的安全错误类型。
  const message = e instanceof Error && /^(Invalid premium field:|Premium configuration\/version drift:|--cards|Expected run|Existing record|Sensitive premium|unknown_cost|budget_stop|actual_over_budget)/u.test(e.message)
    ? e.message : "Premium input or storage unavailable; verify paths, UTF-8 JSON and required rules/lock.";
  console.error(message);
  process.exitCode = 1;
}
