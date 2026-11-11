import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES,
  CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_PROFILES,
  parseCaseSystemVNextTeachingObjectiveSelection,
} from "../src/contracts/index.js";

type AuthoredContrast = {
  id: string;
  compareGroup: string;
  learnerGoal: string;
  learnerEvidence: string;
  task: string;
  teachingObjective: unknown;
  supportedDecision: string;
  failureProbe: string;
  evidenceBoundary: string;
  primaryObservationOwner: string;
};

async function loadContrasts(): Promise<{
  schemaVersion: number;
  status: string;
  cases: AuthoredContrast[];
}> {
  const raw = JSON.parse(await readFile(resolve(
    process.cwd(),
    "scenarios/experimental/goal-aligned-assistance-v0.1/contrasts.json",
  ), "utf8")) as unknown;
  return raw as { schemaVersion: number; status: string; cases: AuthoredContrast[] };
}

test("goal-aligned authoring retains the two existing objective modes and profile identities", () => {
  assert.deepEqual(CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES, [
    "learning_oriented",
    "exam_oriented",
  ]);
  assert.deepEqual(
    CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_PROFILES.map((profile) => profile.id),
    ["learning-oriented-v0.1", "exam-oriented-v0.3"],
  );
  assert.deepEqual(
    parseCaseSystemVNextTeachingObjectiveSelection({ mode: "learning_oriented" }),
    { mode: "learning_oriented" },
  );
});

test("optional learning context has explicit intent, disclosure policy and evidence type", () => {
  const context = {
    intent: "open_inquiry",
    assistancePolicy: "direct_conclusions_permitted",
    permittedTools: ["AI-assisted literature synthesis"],
    outcomeEvidence: "tool_augmented",
    successCondition: "Identify a tractable next question, citing current findings.",
    verificationPlan: "Check primary scientific sources and proposed falsification steps.",
  };
  const selection = parseCaseSystemVNextTeachingObjectiveSelection({
    mode: "learning_oriented",
    learningContext: context,
  });
  assert.deepEqual(selection.learningContext, context);

  // No new scores or blanket obligation to reveal answers: old authored
  // learning contexts still parse and context is deliberately optional.
  assert.equal(parseCaseSystemVNextTeachingObjectiveSelection({
    mode: "learning_oriented",
    learningContext: {
      ...context,
      intent: "concept_mastery",
      assistancePolicy: "guided_attempt",
      outcomeEvidence: "independent",
      verificationPlan: undefined,
    },
  }).learningContext?.outcomeEvidence, "independent");
});

test("goal-aligned selection rejects mixed assessment rules, unverified direct research claims and unknown fields", () => {
  const validExam = {
    mode: "exam_oriented",
    assessmentContext: {
      examFamily: "timed mathematics",
      questionType: "multiple choice",
      scoringPolicy: "one mark",
      timePressure: "high",
      allowedTools: [],
      syllabusBoundary: ["fractions"],
      requiredWork: ["select option"],
    },
  };
  const validLearning = {
    mode: "learning_oriented",
    learningContext: {
      intent: "open_inquiry",
      assistancePolicy: "direct_conclusions_permitted",
      permittedTools: [],
      outcomeEvidence: "tool_augmented",
      successCondition: "Explain the verified claim.",
      verificationPlan: "Verify against source evidence.",
    },
  };
  assert.equal(parseCaseSystemVNextTeachingObjectiveSelection(validExam).mode, "exam_oriented");
  for (const invalid of [
    { ...validExam, learningContext: validLearning.learningContext },
    { ...validLearning, assessmentContext: validExam.assessmentContext },
    { ...validLearning, learningContext: { ...validLearning.learningContext, verificationPlan: undefined } },
    { ...validLearning, learningContext: { ...validLearning.learningContext, outcomeEvidence: "unclear" } },
    { ...validLearning, learningContext: { ...validLearning.learningContext, permittedTools: [42] } },
    { ...validLearning, learningContext: { ...validLearning.learningContext, successCondition: "" } },
    { ...validLearning, learningContext: { ...validLearning.learningContext, hallucinatedField: true } },
    { ...validLearning, unknownOption: true },
  ]) {
    assert.throws(() => parseCaseSystemVNextTeachingObjectiveSelection(invalid));
  }
});

test("authored goal-dependent contrasts declare evidence boundaries without changing evaluator fixtures", async () => {
  const fixture = await loadContrasts();
  assert.equal(fixture.schemaVersion, 1);
  assert.match(fixture.status, /non-canonical/u);
  assert.equal(fixture.cases.length, 7);
  assert.equal(new Set(fixture.cases.map((entry) => entry.id)).size, fixture.cases.length);
  const primaryOwners = new Set(["Guidance", "Adaptation", "Actionability", "Correctness", "Diagnosis"]);
  for (const authored of fixture.cases) {
    for (const value of [
      authored.id,
      authored.compareGroup,
      authored.learnerGoal,
      authored.learnerEvidence,
      authored.task,
      authored.supportedDecision,
      authored.failureProbe,
      authored.evidenceBoundary,
    ]) {
      assert.ok(value.trim().length > 7, authored.id);
    }
    assert.ok(primaryOwners.has(authored.primaryObservationOwner), authored.id);
    const selection = parseCaseSystemVNextTeachingObjectiveSelection(authored.teachingObjective);
    if (selection.mode === "learning_oriented") {
      assert.ok(selection.learningContext, authored.id);
    } else {
      assert.ok(selection.assessmentContext, authored.id);
      assert.equal(selection.learningContext, undefined);
    }
  }
  const fractionCases = fixture.cases.filter((entry) => entry.compareGroup === "fractions-same-calculation");
  assert.equal(fractionCases.length, 2);
  const policies = fractionCases.map((entry) =>
    parseCaseSystemVNextTeachingObjectiveSelection(entry.teachingObjective).learningContext?.assistancePolicy);
  assert.deepEqual(policies, ["guided_attempt", "direct_conclusions_permitted"]);
  const outcomeTypes = new Set(fixture.cases.map((entry) =>
    parseCaseSystemVNextTeachingObjectiveSelection(entry.teachingObjective).learningContext?.outcomeEvidence));
  assert.ok(outcomeTypes.has("independent"));
  assert.ok(outcomeTypes.has("tool_augmented"));
  assert.ok(outcomeTypes.has("both"));
});
