import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import {
  LearnerStateEvidenceError,
  parseLearnerStateEvidenceMatrix,
} from "../src/experiments/learner-state-evidence.js";

const matrixUrl = new URL(
  "../../scenarios/experimental/learner-state-evidence-v0.1/matrix.json",
  import.meta.url,
);
const sourceUrl = new URL(
  "../../scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json",
  import.meta.url,
);

async function input() {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8")) as unknown;
  const source = parseTutorScenarioSuiteVNext(
    JSON.parse(await readFile(sourceUrl, "utf8")) as unknown,
  );
  return { matrix, source };
}
async function mutable() {
  const { matrix, source } = await input();
  return {
    matrix: structuredClone(matrix) as {
      schemaVersion: number;
      participantLinkage: string;
      sourceSuite: { version: string };
      claimBoundary: { stableAbilityInferred: boolean };
      profiles: Array<{
        scenarioId: string;
        observations: Array<{ id: string; learnerTurnIndex: number; quote: string; kind: string }>;
        claims: Array<{ conceptId: string; status: string; observationIds: string[] }>;
      }>;
    },
    source,
  };
}
function rejects(action: () => unknown, reason: RegExp) {
  assert.throws(action, (error: unknown) =>
    error instanceof LearnerStateEvidenceError && reason.test(error.message),
  );
}

test("five existing synthetic learner states are quote-anchored, not five student outcomes", async () => {
  const { matrix, source } = await input();
  const parsed = parseLearnerStateEvidenceMatrix(matrix, source);
  assert.equal(parsed.evidenceMode, "author_written_synthetic");
  assert.equal(parsed.participantLinkage, "unlinked_profiles");
  assert.equal(parsed.claimBoundary.observedLearnerOutcomes, false);
  assert.equal(parsed.claimBoundary.stableAbilityInferred, false);
  assert.equal(parsed.claimBoundary.interventionEffectProven, false);
  assert.equal(parsed.profiles.length, 5);
  assert.equal(parsed.profiles.reduce((count, p) => count + p.observations.length, 0), 8);
  assert.equal(parsed.profiles.reduce((count, p) => count + p.claims.length, 0), 10);
  const unknown = parsed.profiles.find(p => p.scenarioId === "pai-unknown-cause")!;
  assert.deepEqual(unknown.claims.map(c => c.status), ["unknown", "unknown"]);
  const rule = parsed.profiles.find(p => p.scenarioId === "pai-rule-misconception")!;
  assert.deepEqual(rule.claims.map(c => c.status), ["misconception_stated", "stated_definition"]);
  const progress = parsed.profiles.find(p => p.scenarioId === "pai-after-progress")!;
  assert.deepEqual(progress.claims.map(c => c.status), ["supported_local", "unknown"]);
});

test("an incorrect answer cannot become a diagnosed misconception without a stated rule", async () => {
  const { matrix, source } = await mutable();
  const claim = matrix.profiles[0]!.claims[0]!;
  claim.status = "misconception_stated";
  claim.observationIds = ["unknown-incorrect"];
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /claim_evidence_kind_mismatch/);
});

test("a verbal definition cannot be silently promoted to independent demonstrated application", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[2]!.claims[1]!.status = "demonstrated_local";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /claim_evidence_kind_mismatch/);
});

test("a question about an unfinished step is not proof of a missing prerequisite", async () => {
  const { matrix, source } = await mutable();
  const claim = matrix.profiles[4]!.claims[1]!;
  claim.status = "explicit_gap";
  claim.observationIds = ["ready-question"];
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /claim_evidence_kind_mismatch/);
});

test("unknown status cannot carry an apparently confirming evidence reference", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[0]!.claims[0]!.observationIds = ["unknown-incorrect"];
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /unknown_must_not_claim_evidence/);
});

test("quotes must exist in the cited USER message, not another turn or Tutor reply", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[1]!.observations[0]!.quote = "A denominator tells how many equal parts";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /evidence_quote_not_in_learner_turn/);
});

test("learner-turn numbering must be one-based and within the source transcript", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[3]!.observations[0]!.learnerTurnIndex = 3;
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /observation_structure/);
});

test("changing the underlying learner utterance invalidates the quote anchor", async () => {
  const { matrix, source } = await mutable();
  const amended = structuredClone(source) as unknown as {
    scenarios: Array<{ identity: { id: string }; trajectory: { conversationHistory: Array<{ role: string; content: string }> } }>;
  };
  const scenario = amended.scenarios.find(s => s.identity.id === "pai-known-foundation")!;
  scenario.trajectory.conversationHistory[0]!.content = "I know what a fraction is.";
  rejects(
    () => parseLearnerStateEvidenceMatrix(matrix, amended as unknown as typeof source),
    /evidence_quote_not_in_learner_turn/,
  );
});

test("source identity is version-pinned and profiles cannot be omitted", async () => {
  const { matrix, source } = await mutable();
  matrix.sourceSuite.version = "0.2.0";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /source_suite_identity/);
  matrix.sourceSuite.version = source.version;
  matrix.profiles.pop();
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /profile_scope/);
});

test("duplicate evidence IDs and concept claims are rejected", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[2]!.observations[1]!.id = "rule-explicit";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /duplicate_observation_id/);
  matrix.profiles[2]!.observations[1]!.id = "rule-definition";
  matrix.profiles[2]!.claims[1]!.conceptId = "fraction-addition-rule";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /duplicate_concept_claim/);
});

test("there is no field for invented learner gains, fixed ability, or human Gold", async () => {
  const { matrix, source } = await mutable();
  matrix.claimBoundary.stableAbilityInferred = true;
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /overstated_evidence_claim/);
  matrix.claimBoundary.stableAbilityInferred = false;
  Object.assign(matrix, { measuredLearningGain: 0.5 });
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /matrix_structure/);
});

test("distinct profiles cannot be asserted to be successive observations of one human learner", async () => {
  const { matrix, source } = await mutable();
  matrix.participantLinkage = "same_learner_longitudinal";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /matrix_structure/);
});

test("a supported paraphrase cannot be misrepresented as independent work", async () => {
  const { matrix, source } = await mutable();
  matrix.profiles[3]!.claims[0]!.status = "demonstrated_local";
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, source), /claim_evidence_kind_mismatch/);
});

test("prompted-paraphrase evidence requires a preceding Tutor turn", async () => {
  const { matrix, source } = await mutable();
  const edited = structuredClone(source) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      trajectory: { conversationHistory: Array<{ role: "user" | "assistant"; content: string }> };
    }>;
  };
  const s = edited.scenarios.find(x => x.identity.id === "pai-after-progress")!;
  s.trajectory.conversationHistory = [s.trajectory.conversationHistory[2]!];
  matrix.profiles[3]!.observations.forEach(o => { o.learnerTurnIndex = 1; });
  rejects(() => parseLearnerStateEvidenceMatrix(matrix, edited as unknown as typeof source),
    /prompted_paraphrase_requires_prior_tutor/);
});


test("every instantiated epistemic status has a quote-kind trace, with unused self-report kept distinct", async () => {
  const { matrix, source } = await mutable();
  const statuses = matrix.profiles.flatMap(p => p.claims.map(c => c.status));
  const kinds = matrix.profiles.flatMap(p => p.observations.map(o => o.kind));
  const count = (values: readonly string[], value: string) =>
    values.filter(item => item === value).length;

  assert.equal(matrix.profiles.length, 5);
  assert.equal(statuses.length, 10);
  assert.equal(kinds.length, 8);
  assert.equal(count(statuses, "unknown"), 5);
  assert.equal(count(statuses, "reported_only"), 0);
  assert.equal(count(kinds, "self_report"), 0);
  assert.equal(count(kinds, "question"), 2);
  for (const status of [
    "explicit_gap", "misconception_stated", "stated_definition",
    "supported_local", "demonstrated_local",
  ]) {
    assert.equal(count(statuses, status), 1, `expected one authored ${status}`);
  }

  const observed: readonly {
    scenarioId: string;
    status: string;
    kind: string;
  }[] = [
    { scenarioId: "pai-whole-undefined", status: "explicit_gap", kind: "explicit_gap" },
    { scenarioId: "pai-rule-misconception", status: "misconception_stated", kind: "stated_rule" },
    { scenarioId: "pai-rule-misconception", status: "stated_definition", kind: "verbal_definition" },
    { scenarioId: "pai-after-progress", status: "supported_local", kind: "prompted_paraphrase" },
    { scenarioId: "pai-known-foundation", status: "demonstrated_local", kind: "local_reasoning" },
  ];

  for (const item of observed) {
    const profile = matrix.profiles.find(p => p.scenarioId === item.scenarioId);
    assert.ok(profile);
    const claim = profile.claims.find(c => c.status === item.status);
    assert.ok(claim);
    assert.equal(claim.observationIds.length, 1);
    const cited = profile.observations.find(o => o.id === claim.observationIds[0]);
    assert.ok(cited);
    assert.equal(cited.kind, item.kind);

    const attacked = structuredClone(matrix);
    const target = attacked.profiles.find(p => p.scenarioId === item.scenarioId)!;
    const observation = target.observations.find(o => o.id === cited.id)!;
    observation.kind = "question";
    rejects(
      () => parseLearnerStateEvidenceMatrix(attacked, source),
      /claim_evidence_kind_mismatch/,
    );
  }

  // An authored UNKNOWN has no supporting evidence references. This is
  // concept-level uncertainty, not proof that the student lacks that skill.
  for (const claim of matrix.profiles.flatMap(p => p.claims)) {
    if (claim.status === "unknown") assert.deepEqual(claim.observationIds, []);
  }
});

test("reported_only accepts an explicitly authored self-report but not a question or independent demonstration", async () => {
  const { matrix, source } = await mutable();
  const sourceCopy = structuredClone(source) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      trajectory: { conversationHistory: Array<{ role: string; content: string }> };
    }>;
  };
  const s = sourceCopy.scenarios.find(x => x.identity.id === "pai-unknown-cause");
  assert.ok(s);
  const quote = "I think I already understand fraction addition.";
  s.trajectory.conversationHistory[0]!.content += ` ${quote}`;

  const profile = matrix.profiles.find(p => p.scenarioId === "pai-unknown-cause");
  assert.ok(profile);
  profile.observations.push({
    id: "author-synthetic-self-report",
    learnerTurnIndex: 1,
    quote,
    kind: "self_report",
  });
  const claim = profile.claims.find(c => c.conceptId === "chosen-whole");
  assert.ok(claim);
  claim.status = "reported_only";
  claim.observationIds = ["author-synthetic-self-report"];

  const parsedSource = parseTutorScenarioSuiteVNext(sourceCopy);
  const valid = parseLearnerStateEvidenceMatrix(matrix, parsedSource);
  assert.equal(
    valid.profiles.find(p => p.scenarioId === "pai-unknown-cause")?.claims
      .find(c => c.conceptId === "chosen-whole")?.status,
    "reported_only",
  );

  profile.observations[profile.observations.length - 1]!.kind = "question";
  rejects(
    () => parseLearnerStateEvidenceMatrix(matrix, parsedSource),
    /claim_evidence_kind_mismatch/,
  );

  // Fixture mutates a source message in memory only. The checked-in five
  // scenarios still have ZERO reported_only claims and zero real learners.
});
