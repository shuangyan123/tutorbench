import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  BenchmarkConfigurationError,
  parseCaseSystemVNextPilot,
} from "../src/contracts/index.js";

async function loadPilot() {
  const path = resolve(
    process.cwd(),
    "scenarios",
    "case-system-vnext",
    "pilot-archetypes.json",
  );
  const raw = await readFile(path, "utf8");
  return parseCaseSystemVNextPilot(JSON.parse(raw) as unknown);
}

test("Case System vNext pilot uses audit-seeded domains with explicit subdomain and practice", async () => {
  const pilot = await loadPilot();
  assert.equal(pilot.id, "case-system-vnext-pilot");
  assert.equal(pilot.version, "0.2.0");
  assert.equal(pilot.archetypes.length, 15);

  const domainIds = new Set(pilot.archetypes.map((archetype) => archetype.domainId));
  for (const required of [
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "computer_science",
    "writing_rhetoric",
    "history",
  ] as const) {
    assert.ok(domainIds.has(required), required);
  }

  assert.ok(
    pilot.archetypes.every(
      (archetype) =>
        archetype.subdomain.length > 0 &&
        archetype.practice.length > 0,
    ),
  );

  const depths = new Set(pilot.archetypes.map((archetype) => archetype.contentDepth));
  assert.ok(depths.has(1));
  assert.ok(depths.has(3));
  assert.ok(depths.has(5));
});

test("human-optimal pilot archetypes bind optimality to learner-visible prerequisites", async () => {
  const pilot = await loadPilot();
  const humanOptimal = pilot.archetypes.filter(
    (archetype) => archetype.referenceReasoning.optimalityMode === "human_optimal",
  );
  assert.ok(humanOptimal.length >= 4);

  for (const archetype of humanOptimal) {
    assert.ok(archetype.prerequisiteBoundary.knownConcepts.length > 0, archetype.id);
    assert.ok(
      archetype.referenceReasoning.humanOptimalInstanceStrategies.length > 0,
      archetype.id,
    );
    assert.ok(
      archetype.referenceReasoning.humanOptimalGeneralStrategies.length > 0,
      archetype.id,
    );
    assert.equal(archetype.referenceReasoning.machineSearchCost, "out_of_scope");
  }
});

test("open-ended pilot archetypes do not fabricate a unique optimal solution", async () => {
  const pilot = await loadPilot();
  for (const id of ["writing-d1-local-revision", "history-d1-source"]) {
    const archetype = pilot.archetypes.find((candidate) => candidate.id === id);
    assert.ok(archetype);
    assert.equal(archetype.referenceReasoning.optimalityMode, "not_applicable");
    assert.equal(archetype.referenceReasoning.humanOptimalInstanceStrategies.length, 0);
    assert.equal(archetype.referenceReasoning.humanOptimalGeneralStrategies.length, 0);
    assert.ok(archetype.referenceReasoning.alternativeHumanValidStrategies.length > 0);
  }
});

test("pilot validation rejects incomplete domain coverage and invalid optimality claims", async () => {
  const pilot = await loadPilot();

  const missing = structuredClone(pilot) as unknown as {
    archetypes: unknown[];
  };
  missing.archetypes.pop();
  assert.throws(
    () => parseCaseSystemVNextPilot(missing),
    (error: unknown) =>
      error instanceof BenchmarkConfigurationError &&
      error.code === "case_system_vnext_invalid",
  );

  const invalidOptimal = structuredClone(pilot) as unknown as {
    archetypes: Array<{
      referenceReasoning: {
        optimalityMode: string;
        humanOptimalInstanceStrategies: unknown[];
        humanOptimalGeneralStrategies: unknown[];
      };
    }>;
  };
  const humanOptimal = invalidOptimal.archetypes.find(
    (archetype) => archetype.referenceReasoning.optimalityMode === "human_optimal",
  );
  assert.ok(humanOptimal);
  humanOptimal.referenceReasoning.humanOptimalInstanceStrategies = [];
  assert.throws(
    () => parseCaseSystemVNextPilot(invalidOptimal),
    (error: unknown) =>
      error instanceof BenchmarkConfigurationError &&
      error.code === "case_system_vnext_invalid",
  );
});

test("pilot covers multi-turn and episode authoring targets without claiming executable H3 behavior", async () => {
  const pilot = await loadPilot();
  const horizons = new Set(pilot.archetypes.map((archetype) => archetype.interactionHorizon));
  assert.ok(horizons.has(1));
  assert.ok(horizons.has(2));
  assert.ok(horizons.has(3));

  const episodeTargets = pilot.archetypes.filter(
    (archetype) => archetype.interactionHorizon === 3,
  );
  assert.ok(episodeTargets.length >= 5);
  assert.ok(episodeTargets.every((archetype) => archetype.authoringStatus === "pilot"));
});
