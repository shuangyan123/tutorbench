import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseLearnerPathProtocol } from "../src/contracts/learner-path-protocol.js";

const protocolUrl = new URL(
  "../../scenarios/experimental/learner-path-goal-and-cost-v0.1/protocol.json",
  import.meta.url,
);
const load = async (): Promise<unknown> => JSON.parse(await readFile(protocolUrl, "utf8")) as unknown;

test("learner-path pilot fixes the same goal across three learner start states", async () => {
  const protocol = parseLearnerPathProtocol(await load());
  assert.equal(protocol.status, "authoring_only");
  assert.equal(protocol.pathways.length, 3);
  assert.deepEqual(protocol.pathways.map(p => p.id),
    ["foundation-gap", "partial-understanding", "near-ready"]);
  assert.equal(protocol.objective.targetIsCeiling, false);
  assert.equal(protocol.pathways[0]?.openPrerequisites.length, 3);
  assert.equal(protocol.pathways[2]?.openPrerequisites.length, 0);
  assert.equal(protocol.assessment.baseline.independent, true);
  assert.equal(protocol.assessment.immediate.independent, true);
  assert.equal(protocol.assessment.nearTransfer.independent, true);
  assert.equal(protocol.assessment.delayed.independent, true);
  assert.equal(protocol.observationPlan.missingDataRule, "unknown_not_zero");
  assert.equal(protocol.evidenceBoundary.actualLearnerResultsCollected, false);
  assert.equal(protocol.evidenceBoundary.potentialCeilingMeasured, false);
});

test("learner-path protocol refuses invented measured outcomes and a fixed ability ceiling", async () => {
  const withOutcomes = structuredClone(await load()) as Record<string, unknown>;
  withOutcomes["observedGains"] = [{ id: "foundation-gap", improved: true }];
  assert.throws(() => parseLearnerPathProtocol(withOutcomes), /learner_path_invalid_protocol/);

  const withCeiling = structuredClone(await load()) as { objective: Record<string, unknown> };
  withCeiling.objective["targetIsCeiling"] = true;
  assert.throws(() => parseLearnerPathProtocol(withCeiling), /learner_path_invalid_goal/);

  const withClaim = structuredClone(await load()) as { evidenceBoundary: Record<string, unknown> };
  withClaim.evidenceBoundary["learningGainClaimed"] = true;
  assert.throws(() => parseLearnerPathProtocol(withClaim), /learner_path_invalid_evidence_boundary/);
});

test("learner-path protocol requires uncued assessments and distinct starting states", async () => {
  const cued = structuredClone(await load()) as { assessment: { immediate: Record<string, unknown> } };
  cued.assessment.immediate["independent"] = false;
  assert.throws(() => parseLearnerPathProtocol(cued), /learner_path_invalid_checkpoint/);

  const noFoundationGap = structuredClone(await load()) as {
    pathways: Array<{ id: string; openPrerequisites: string[] }>;
  };
  noFoundationGap.pathways[0]!.openPrerequisites = [];
  assert.throws(() => parseLearnerPathProtocol(noFoundationGap), /learner_path_invalid_pathways/);

  const duplicates = structuredClone(await load()) as {
    pathways: Array<{ id: string; openPrerequisites: string[] }>;
  };
  duplicates.pathways[1]!.id = "foundation-gap";
  assert.throws(() => parseLearnerPathProtocol(duplicates), /learner_path_invalid_pathways/);

  const inventedPrerequisite = structuredClone(await load()) as {
    pathways: Array<{ id: string; openPrerequisites: string[] }>;
  };
  inventedPrerequisite.pathways[0]!.openPrerequisites.push("unrelated secret knowledge");
  assert.throws(() => parseLearnerPathProtocol(inventedPrerequisite), /learner_path_invalid_profile/);
});
