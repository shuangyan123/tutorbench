import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { childEnvironment } from "../premium/child-environment.js";
import { checkCalibration, checkCalibrationV3, finalCalibration, validateCalibration } from "../premium/check-calibration.js";
import { hash, loadCards, parseCard } from "../premium/cards.js";
import { hybridProvider, liveStudent } from "../premium/calibration.js";
import { reconcile, rejudge, runBatch, type Execution } from "../premium/batch.js";
import { loadProbes, readExpectations, type Phase } from "../premium/plan.js";
import { configSchema } from "../premium/provider.js";
import { replayProvider } from "../premium/replay.js";
import { publish, safeJson, Store } from "../premium/store.js";
import { choices, id, invalid } from "../premium/schema.js";

function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({ args, options: {
    "student-tape": { type: "string" }, calibration: { type: "string" }, phase: { type: "string" }, "probe-id": { type: "string", multiple: true }, probes: { type: "string" }, recover: { type: "string" },
    report: { type: "string", multiple: true }, review: { type: "string", multiple: true }, output: { type: "string" },
    checker: { type: "string" }, expectations: { type: "string" }, "batch-id": { type: "string" },
    "dry-run": { type: "boolean" }, "live-student": { type: "boolean" }, "card-id": { type: "string" },
    "judge-prompts": { type: "string" }, "top-up": { type: "boolean" },
    provider: { type: "string" }, usd: { type: "string" }, reason: { type: "string" },
    cards: { type: "string" }, card: { type: "string" }, config: { type: "string" }, tape: { type: "string" },
    out: { type: "string", default: "runs/premium" }, "run-id": { type: "string" },
  } });
  if (command === "validate-calibration" || command === "final-calibration") {
    if (!values.checker || !values.expectations) invalid("checker.arguments");
    const result = command === "validate-calibration" ? (() => {
      if (!values.cards || !values.calibration) invalid("checker.validate_arguments");
      return validateCalibration(resolve(values.checker), resolve(values.expectations), resolve(values.cards), resolve(values.calibration));
    })() : finalCalibration(resolve(values.checker), resolve(values.expectations),
      choices("G2", "G3", "G4")(values.phase, "checker.phase"), (values.report ?? []).map(p => resolve(p)), (values.review ?? []).map(p => resolve(p)));
    if (values.output) publish(resolve(values.output), safeJson(result.report) + "\n");
    process.exitCode = result.status;
    return result.report;
  }
  if (command === "check-calibration") {
    if (!values.checker || !values.expectations || !values["batch-id"]) invalid("checker.arguments");
    if (JSON.parse(readFileSync(values.expectations, "utf8")).schemaVersion === 3) {
      if (!values.cards || !values.calibration || values["dry-run"]) invalid("checker.v3_arguments");
      const audit = values.config ? configSchema(JSON.parse(readFileSync(values.config, "utf8")), "config") : undefined;
      if (audit && (audit.batchId !== values["batch-id"] || !audit.studentInference)) invalid("checker.studentInference_config");
      const result = checkCalibrationV3(resolve(values.out!), resolve(values.checker), resolve(values.expectations),
        values["batch-id"], resolve(values.cards), resolve(values.calibration), audit?.studentInference);
      process.exitCode = result.status;
      return result.report;
    }
    process.exitCode = checkCalibration(resolve(values.out!), resolve(values.checker), resolve(values.expectations),
      values["batch-id"], !!values["dry-run"]);
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
    const probe = values.phase === "G2" || values.phase === "G3" || values.phase === "DIAGNOSTIC";
    if (!!values.probes !== probe || (config.kind === "calibration-probe" && !probe)) invalid("calibration.probe_arguments");
    config.kind = probe ? "calibration-probe" : "calibration";
  }
  if (config.kind !== "calibration" && config.kind !== "calibration-probe" && !values["judge-prompts"] && config.syntheticJudgeRubric !== "fixture") invalid("judge-prompts.required");
  const live = values["live-student"];
  if (live && (command !== "calibrate" || !config.prices.models || config.student.provider !== "deepseek" ||
      config.student.developer.toLowerCase() !== "deepseek" || !process.env.DEEPSEEK_API_KEY ||
      assets.some(a => !a.card.leaveNotBefore) || config.tutors.some(t => t.provider !== "scripted"))) invalid("calibration.live_configuration");
  const bytes = readFileSync(values.tape, "utf8");
  const tape: unknown = JSON.parse(bytes);
  if (values["student-tape"] && (live || command !== "calibrate")) invalid("calibration.mock_student_arguments");
  const studentBytes = values["student-tape"] ? readFileSync(values["student-tape"], "utf8").replace(/\r\n/g, "\n") : undefined;
  const studentTape: unknown = studentBytes ? JSON.parse(studentBytes) : undefined;
  const tapeHash = hash(bytes.replace(/\r\n/g, "\n"));
  const phase: Phase | "DIAGNOSTIC" | undefined = values.phase ? choices("G2", "G3", "G4", "DIAGNOSTIC")(values.phase, "calibration.phase") : undefined;
  if ((phase === "DIAGNOSTIC") !== !!values["probe-id"]?.length ||
      (phase === "DIAGNOSTIC" && (values.report?.length || values.review?.length))) invalid("calibration.diagnostic_arguments");
  const exp = values.expectations ? readExpectations(values.expectations) : undefined;
  if (phase && (command !== "calibrate" || !exp)) invalid("calibration.phase_arguments");
  const asset = assets[0]!;
  if (exp && (assets.length !== 1 || asset.card.id !== exp.card.id || asset.card.version !== exp.card.version ||
      asset.contentHash !== exp.card.contentHash || asset.rulesVersion !== exp.rulesVersion || asset.protocol?.hash !== exp.protocol.hash ||
      asset.protocol.version !== exp.protocol.version || config.repeats !== exp.repeats ||
      [...config.languages].sort().join() !== [...exp.languages].sort().join())) invalid("calibration.expectations");
  let probePlan: Execution["probePlan"];
  if ((phase === "G2" || phase === "G3" || phase === "DIAGNOSTIC") && exp && values.probes) {
    const gate = phase === "DIAGNOSTIC" ? "diagnostic" : phase === "G2" ? "key" : "rest";
    if (basename(values.probes) !== exp.probes.file) invalid("calibration.probe_filename");
    probePlan = { gate, probes: loadProbes(values.probes, exp, asset, gate, values["probe-id"]) };
  }
  if (exp && (exp.tape.hash !== tapeHash || exp.tape.file !== basename(values.tape))) invalid("calibration.tape_pin");
  if (exp && !probePlan && (!exp.required.every(t => config.tutors.some(m => m.id === t)) ||
      config.tutors.some(m => ![...exp.required, ...exp.optional].includes(m.id)))) invalid("calibration.tape_or_tutors");
  if (exp && (config.judges.length || config.alternates.length)) invalid("calibration.no_judges");
  let series: Execution["series"];
  if (live && exp && phase) {
    if (!values.checker) invalid("calibration.checker_required");
    const validated = validateCalibration(resolve(values.checker), resolve(values.expectations!), resolve(values.cards),
      resolve(values.calibration ?? dirname(values.expectations!)));
    if (validated.status !== 0) invalid("calibration.validate_assets");
    const prior = phase === "G2" || phase === "DIAGNOSTIC" ? undefined : finalCalibration(resolve(values.checker), resolve(values.expectations!),
      phase === "G3" ? "G2" : "G3", (values.report ?? []).map(p => resolve(p)), (values.review ?? []).map(p => resolve(p)));
    if (prior && prior.status !== 0) invalid("calibration.prior_gate_not_passed");
    if (phase !== "DIAGNOSTIC") series = { phase, id: hash(JSON.stringify(exp.pins)), priorBatchIds: prior?.batchIds ?? [] };
  }
  const execution: Execution = { ...(studentBytes ? { mockTapeHash: hash(studentBytes) } : {}), ...(series ? { series } : {}), ...(probePlan ? { probePlan } : {}),
    ...(values.recover ? { recoverTransportRunId: id(values.recover, "recover") } : {}), config, assets, topUp: values["top-up"] ?? false,
    ...(live ? { mode: "hybrid_calibration" as const } : {}),
    provider: job => live ? hybridProvider(tape, job, liveStudent) : studentTape ? hybridProvider(tape, job, replayProvider(studentTape, job)) : replayProvider(tape, job),
    tapeHash, gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", env: childEnvironment("local") }).trim() };
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
    if (live && b.status !== "complete") process.exitCode = 1;
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
  process.exitCode = ["check-calibration", "validate-calibration", "final-calibration"].includes(process.argv[2] ?? "") ? 2 : 1;
}
