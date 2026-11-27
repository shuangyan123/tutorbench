import assert from "node:assert/strict";
import { test } from "node:test";
import { runBatch } from "../src/premium/batch.js";
import { hash } from "../src/premium/cards.js";
import { readProtocol } from "../src/premium/protocol.js";
import { fixture, storage } from "./premium-fixture.js";

test("diagnostic output is isolated in both directions; its budget cannot be topped up or assigned to a formal gate", t => {
  const { e, job } = fixture(), { store } = storage(t);
  const old = e.config;
  runBatch(store, e);
  const asset = job.asset, config = { ...old, batchId: "diag", kind: "calibration-probe" as const, tutors: [],
    judges: [], alternates: [], budgetUsd: 0.02, hardCapUsd: 0.02 };
  const lang = (text: string) => ({ en: text, "zh-CN": text });
  const prefix = [
    { role: "student" as const, text: "Opening.", fixed: true, state: { stage: 1, events: [], end: false } },
    { role: "tutor" as const, text: "Consider another tile.", turn: 1, source: "test-tutor#1" },
  ];
  asset.protocol = readProtocol({ schemaVersion: 1, id: "synthetic-test", version: "1.2.1", rulesVersion: asset.rulesVersion,
    studentRequest: { responseFormat: { type: "json_object" }, thinking: { type: "disabled" }, temperature: 0.7, maxOutputTokens: 512 },
    instruction: lang("Only JSON {events}"), instructionEvents: "events", turnNote: { separator: "\n", default: lang("{k}"), fixedTestInjected: lang("{k}") },
    rewrite: { joiner: "\n", codes: {} },
    injection: { appliesWhen: "conditional", separator: "\n", position: "append", runnerEvent: "card", dropModelReportedRunnerEvent: true,
      lengthCheck: "final", echoCheckScope: "when injected" }, history: { assistantContent: "canonical", userContent: "note", opening: "fixed" },
  }, hash("synthetic protocol"));
  const probe = { prefix, probeId: "test", probeSetVersion: "1", prefixHash: hash(JSON.stringify(prefix)), targetStudentMessage: 2,
    protocolVersion: "1.2.1", tutorSource: "test-tutor" };
  const d = { ...e, config, probePlan: { gate: "diagnostic" as const, probes: [{ en: probe, "zh-CN": probe }] },
    provider: () => () => { throw new Error("mock blocked"); } };
  assert.throws(() => runBatch(store, d), /diagnostic_output/);
  const isolated = storage(t).store;
  assert.throws(() => runBatch(isolated, { ...d, topUp: true }), /diagnostic_budget_or_series/);
  assert.throws(() => runBatch(isolated, { ...d, series: { phase: "G2", id: "synthetic", priorBatchIds: [] } }), /diagnostic_budget_or_series/);
  const result = runBatch(isolated, d);
  assert.equal(result.gate, "diagnostic");
  assert.equal(result.hardCapUsd, 0.02);
  assert.ok(Number(result.spentUsd) > 0);
  assert.throws(() => runBatch(isolated, e), /diagnostic_output/);
  assert.throws(() => runBatch(isolated, { ...d, config: { ...config, batchId: "other-diagnostic" } }), /diagnostic_output/);
});
