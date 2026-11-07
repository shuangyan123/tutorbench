import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import {
  LearnerEvidenceContrastError,
  buildLearnerEvidenceContrastTutorPackets,
  parseLearnerEvidenceContrastPlan,
} from "../src/experiments/learner-state-contrast.js";

const sourceUrl = new URL(
  "../../scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json",
  import.meta.url,
);
const planUrl = new URL(
  "../../scenarios/experimental/learner-state-evidence-v0.1/contrast-plan.json",
  import.meta.url,
);
async function inputs() {
  const source = parseTutorScenarioSuiteVNext(
    JSON.parse(await readFile(sourceUrl, "utf8")) as unknown,
  );
  const plan = JSON.parse(await readFile(planUrl, "utf8")) as unknown;
  return { source, plan };
}
async function editable() {
  const { source, plan } = await inputs();
  return {
    source, plan: structuredClone(plan) as {
      tutorExecutionStatus: string;
      learnerOutcomeStatus: string;
      pairs: Array<{
        id: string;
        sourceScenarioVersion: string;
        sourceLatestLearnerMessage: string;
        controls: { a: string; b: string };
        prefix: string;
        researchQuestion: string;
      }>;
    },
  };
}
function rejected(action: () => unknown, reason: RegExp) {
  assert.throws(action, (e: unknown) =>
    e instanceof LearnerEvidenceContrastError && reason.test(e.message));
}

test("counterfactuals reuse five existing source scenarios without pretending to run a Tutor", async () => {
  const { source, plan } = await inputs();
  const parsed = parseLearnerEvidenceContrastPlan(plan, source);
  assert.equal(parsed.pairs.length, 5);
  assert.equal(new Set(parsed.pairs.map(p => p.sourceScenarioId)).size, 5);
  assert.deepEqual(parsed.pairs.map(p => p.comparisonKind), [
    "signal-added", "signal-added", "signal-added",
    "expected-action-invariant", "paraphrase-invariant",
  ]);
  assert.equal(parsed.tutorExecutionStatus, "not_run");
  assert.equal(parsed.learnerOutcomeStatus, "not_measured");
});

test("all ten fixed Tutor inputs are unique, reproducible and independent of operator labels", async () => {
  const { source, plan } = await inputs();
  const a = buildLearnerEvidenceContrastTutorPackets(plan, source);
  const b = buildLearnerEvidenceContrastTutorPackets(plan, source);
  assert.deepEqual(a, b);
  assert.equal(a.cases.length, 10);
  assert.equal(new Set(a.cases.map(x => x.caseId)).size, 10);
  assert.equal(new Set(a.cases.map(x => x.inputSha256)).size, 10);
  for (const item of a.cases) {
    assert.equal(item.caseId, item.input.caseId);
    assert.equal(item.input.runIndex, 1);
    assert.equal(item.inputSha256, createHash("sha256")
      .update(JSON.stringify(item.input)).digest("hex"));
  }
  const serialized = JSON.stringify(a);
  assert.equal(a.tutorExecutionStatus, "not_run");
  assert.ok(!serialized.includes("researchQuestion"));
  assert.ok(!serialized.includes("prohibitedInferences"));
  assert.ok(!serialized.includes("evaluatorOnly"));
  assert.ok(!serialized.includes("misconception_stated"));
  assert.ok(!serialized.includes("comparisonKind"));
  assert.ok(!serialized.includes("sourceScenarioId"));
});

test("only the inserted learner evidence and case IDs may differ within each pair", async () => {
  const { source, plan } = await inputs();
  const packet = buildLearnerEvidenceContrastTutorPackets(plan, source);
  for (let k = 1; k <= 5; k++) {
    const prefix = `ls-v01-p${String(k).padStart(2, "0")}`;
    const left = packet.cases.find(x => x.caseId === prefix + "-a")!.input;
    const right = packet.cases.find(x => x.caseId === prefix + "-b")!.input;
    assert.notEqual(left.currentStudentMessage, right.currentStudentMessage);
    const normalize = (x: typeof left) => ({
      ...x, scenarioId: prefix, caseId: prefix, currentStudentMessage: "[evidence-span]",
    });
    assert.deepEqual(normalize(left), normalize(right));
    assert.equal(left.learningObjective, right.learningObjective);
    assert.deepEqual(left.conversation, right.conversation);
    assert.deepEqual(left.studentState, right.studentState);
  }
});

test("static author-known concepts are neutralized in both arms, not mistaken for learner evidence", async () => {
  const { source, plan } = await inputs();
  const original = source.scenarios.find(s => s.identity.id === "pai-known-foundation")!;
  assert.ok(original.tutorVisibleContext.knownConcepts.length > 0);
  const a = buildLearnerEvidenceContrastTutorPackets(plan, source);
  for (const c of a.cases) {
    assert.deepEqual(c.input.studentState.knownConcepts, []);
    assert.deepEqual(c.input.studentState.misconceptions, []);
  }
});

test("the unknown-cause pair retains the same erroneous answer and changes only stated rule", async () => {
  const { source, plan } = await inputs();
  const a = buildLearnerEvidenceContrastTutorPackets(plan, source);
  const left = a.cases.find(x => x.caseId === "ls-v01-p01-a")!.input.currentStudentMessage;
  const right = a.cases.find(x => x.caseId === "ls-v01-p01-b")!.input.currentStudentMessage;
  assert.match(left, /2\/7/);
  assert.match(right, /2\/7/);
  assert.equal(right.replace(" I always add the top numbers and bottom numbers separately.", ""), left);
});

test("semantically equivalent wrong rules constitute a lexical invariance control", async () => {
  const { source, plan } = await inputs();
  const a = buildLearnerEvidenceContrastTutorPackets(plan, source);
  const left = a.cases.find(x => x.caseId === "ls-v01-p05-a")!.input.currentStudentMessage;
  const right = a.cases.find(x => x.caseId === "ls-v01-p05-b")!.input.currentStudentMessage;
  assert.match(left, /top numbers and bottom numbers/);
  assert.match(right, /numerators.*denominators/);
  assert.match(left, /2\/7/);
  assert.match(right, /2\/7/);
});

test("source latest utterance drift requires a new plan, not silent replay", async () => {
  const { source, plan } = await editable();
  plan.pairs[0]!.sourceLatestLearnerMessage = "A new, different original message.";
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /source_utterance_drift/);
});

test("duplicated source scenarios, identical arms and missing pairs are rejected", async () => {
  const { source, plan } = await editable();
  plan.pairs[1]!.id = plan.pairs[0]!.id;
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /pair_structure_or_duplicate/);
  plan.pairs[1]!.id = "reported-vs-defined";
  plan.pairs[1]!.controls.b = plan.pairs[1]!.controls.a;
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /contrast_span/);
  plan.pairs.pop();
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /pair_count/);
});

test("only an added fragment may differ in a signal-added condition", async () => {
  const { source, plan } = await editable();
  plan.pairs[0]!.controls.a = " I definitely know fractions.";
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /nonminimal_added_signal/);
});

test("operator labels and artificial outcome values cannot enter a valid frozen plan", async () => {
  const { source, plan } = await editable();
  plan.learnerOutcomeStatus = "improved";
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /plan_structure_or_claim/);
  plan.learnerOutcomeStatus = "not_measured";
  Object.assign(plan, { observedLearnerSuccessRate: 1 });
  rejected(() => parseLearnerEvidenceContrastPlan(plan, source), /plan_structure_or_claim/);
});

test("a source suite that has changed its objective cannot masquerade as controlled", async () => {
  const { source, plan } = await inputs();
  const changed = structuredClone(source) as typeof source;
  changed.scenarios[0]!.learningContext.learningObjective = "A different goal";
  rejected(() => parseLearnerEvidenceContrastPlan(plan, changed), /objective_not_fixed/);
});
