import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  BenchmarkConfigurationError,
  parseTeachBackLearnerOutcomeEvidence,
} from "../src/contracts/index.js";

async function loadFixture(): Promise<unknown> {
  return JSON.parse(
    await readFile(
      resolve(
        process.cwd(),
        "scenarios/learner-outcome/teach-back-v0.1/synthetic-math-d5.json",
      ),
      "utf8",
    ),
  ) as unknown;
}

test("synthetic teach-back outcome fixture validates as proxy evidence", async () => {
  const evidence = parseTeachBackLearnerOutcomeEvidence(await loadFixture());
  assert.equal(evidence.evidenceKind, "teach_back");
  assert.equal(evidence.evidenceSource, "synthetic_protocol_fixture");
  assert.equal(evidence.recipient.kind, "synthetic");
  assert.equal(evidence.recipient.relativeLevel, "lower_prerequisite");
  assert.equal(evidence.baseline.result, "incorrect");
  assert.equal(evidence.recipientOutcomes.immediate.result, "correct");
  assert.equal(evidence.recipientOutcomes.nearTransfer?.result, "correct");
  assert.equal(evidence.recipientOutcomes.farTransfer?.result, "partial");
  assert.equal(evidence.claimBoundary, "observational_or_proxy_only");
  assert.deepEqual(
    evidence.teachBack.processEvidence.map((item) => item.dimension),
    [
      "knowledge_reconstruction",
      "learner_diagnosis",
      "adaptive_explanation",
    ],
  );
});

test("teach-back evidence rejects source and recipient kind mismatch", async () => {
  const fixture = await loadFixture() as Record<string, unknown>;
  const invalid = structuredClone(fixture) as {
    evidenceSource: string;
    recipient: { kind: string };
  };
  invalid.evidenceSource = "human_observation";
  assert.throws(
    () => parseTeachBackLearnerOutcomeEvidence(invalid),
    (error: unknown) =>
      error instanceof BenchmarkConfigurationError &&
      error.code === "learner_outcome_evidence_invalid",
  );
});

test("teach-back evidence requires all three process dimensions", async () => {
  const fixture = await loadFixture() as {
    teachBack: { processEvidence: unknown[] };
  };
  const invalid = structuredClone(fixture);
  invalid.teachBack.processEvidence.pop();
  assert.throws(
    () => parseTeachBackLearnerOutcomeEvidence(invalid),
    /Learner outcome evidence is invalid/u,
  );
});

test("teach-back evidence rejects out-of-range transcript references", async () => {
  const fixture = await loadFixture() as {
    teachBack: {
      processEvidence: Array<{ evidenceTurnIndexes: number[] }>;
    };
  };
  const invalid = structuredClone(fixture);
  invalid.teachBack.processEvidence[0]!.evidenceTurnIndexes = [999];
  assert.throws(
    () => parseTeachBackLearnerOutcomeEvidence(invalid),
    /Learner outcome evidence is invalid/u,
  );
});

test("teach-back evidence cannot elevate its own causal claim boundary", async () => {
  const fixture = await loadFixture() as Record<string, unknown>;
  const invalid = structuredClone(fixture);
  invalid.claimBoundary = "causal_learning_gain";
  assert.throws(
    () => parseTeachBackLearnerOutcomeEvidence(invalid),
    /Learner outcome evidence is invalid/u,
  );
});

test("teach-back validation rejects array-coerced enum values", async () => {
  const base = await loadFixture() as {
    baseline: { stage: unknown; result: unknown };
    teachBack: {
      processEvidence: Array<{ dimension: unknown; rating: unknown }>;
    };
  };

  for (const mutate of [
    (value: typeof base) => { value.baseline.stage = ["baseline"]; },
    (value: typeof base) => { value.baseline.result = ["incorrect"]; },
    (value: typeof base) => {
      value.teachBack.processEvidence[0]!.dimension = ["knowledge_reconstruction"];
    },
    (value: typeof base) => { value.teachBack.processEvidence[0]!.rating = ["pass"]; },
  ]) {
    const invalid = structuredClone(base);
    mutate(invalid);
    assert.throws(
      () => parseTeachBackLearnerOutcomeEvidence(invalid),
      /Learner outcome evidence is invalid/u,
    );
  }
});
