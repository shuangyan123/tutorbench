import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCaseSystemVNextEvaluatorStressPlan,
  runCaseSystemVNextEvaluatorStress,
  type CaseSystemVNextStressBlindPacket,
  type CaseSystemVNextStressFixtureSuite,
} from "../src/index.js";
import {
  parseCaseSystemVNextPilot,
} from "../src/contracts/index.js";

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(
    await readFile(resolve(process.cwd(), path), "utf8"),
  ) as unknown;
}

async function loadInputs() {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;
  return { pilot, suite };
}

function candidateLabelForText(
  packet: CaseSystemVNextStressBlindPacket,
  preferredText: string,
): "A_BETTER" | "B_BETTER" {
  const [a, b] = packet.candidates;
  assert.ok(a);
  assert.ok(b);
  if (a.responseText === preferredText) return "A_BETTER";
  if (b.responseText === preferredText) return "B_BETTER";
  throw new Error("preferred fixture response not present");
}

test("stress plan builds swapped blind presentations and hides operator expectations", async () => {
  const { pilot, suite } = await loadInputs();
  const plan = buildCaseSystemVNextEvaluatorStressPlan(pilot, suite, 3);

  assert.equal(plan.fixtures.length, 8);
  assert.equal(plan.plannedJudgmentCount, 8 * 3 * 2);

  for (const fixture of plan.fixtures) {
    assert.equal(fixture.repetitions.length, 3);
    for (const repetition of fixture.repetitions) {
      const [first, second] = repetition.presentations;
      assert.ok(first);
      assert.ok(second);
      assert.equal(first.assignment.aCandidateId, second.assignment.bCandidateId);
      assert.equal(first.assignment.bCandidateId, second.assignment.aCandidateId);

      for (const presentation of [first, second]) {
        const serialized = JSON.stringify(presentation.packet);
        assert.equal("expected" in presentation.packet, false);
        assert.equal("rationale" in presentation.packet, false);
        assert.equal("candidateId" in presentation.packet.candidates[0], false);
        assert.equal("candidateId" in presentation.packet.candidates[1], false);
        assert.doesNotMatch(serialized, /expectedMatch|developer-authored diagnostics/);
        assert.equal(
          presentation.packet.referenceReasoning.machineSearchCost,
          "out_of_scope",
        );
      }
    }
  }
});

test("stable synthetic judgments produce exact expected-match diagnostics", async () => {
  const { pilot, suite } = await loadInputs();
  const plan = buildCaseSystemVNextEvaluatorStressPlan(pilot, suite, 2);
  const fixtureById = new Map(suite.fixtures.map((fixture) => [fixture.id, fixture]));

  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async (packet) => {
      const fixtureId = packet.presentationId.replace(/-r\d+-p[12]$/, "");
      const fixture = fixtureById.get(fixtureId);
      assert.ok(fixture);
      if (fixture.expected.kind === "tie") {
        return { status: "ok", outcome: "TIE" };
      }
      const preferred = fixture.candidates.find(
        (candidate) => candidate.id === fixture.expected.candidateId,
      );
      assert.ok(preferred);
      return {
        status: "ok",
        outcome: candidateLabelForText(packet, preferred.responseText),
      };
    },
  );

  assert.equal(report.observedJudgmentCount, report.plannedJudgmentCount);
  assert.equal(report.overall.comparableCount, 8 * 2);
  assert.equal(report.overall.expectedMatchCount, 8 * 2);
  assert.equal(report.overall.expectedMatchShare, 1);
  assert.equal(report.overall.orderSensitiveCount, 0);
  assert.equal(report.overall.incompleteCount, 0);
  assert.equal(report.calibrationStatus, "uncalibrated");
  assert.match(report.selectionStatement, /No evaluator-quality winner/);

  assert.equal(report.byContrast.human_efficiency.expectedMatchShare, 1);
  assert.equal(report.byContrast.opacity.expectedMatchShare, 1);
  assert.equal(report.byContrast.generalization_target.expectedMatchShare, 1);
  assert.equal(report.byContrast.prerequisite_compatibility.expectedMatchShare, 1);
  assert.equal(report.byContrast.equivalent_strategies.expectedMatchShare, 1);
});

test("position-following judgments are classified as order-sensitive, not as a tie", async () => {
  const { pilot, suite } = await loadInputs();
  const singleFixtureSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: [suite.fixtures[0]!],
  };
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    singleFixtureSuite,
    2,
  );

  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async () => ({ status: "ok", outcome: "A_BETTER" }),
  );

  assert.equal(report.fixtures[0]?.orderSensitiveCount, 2);
  assert.equal(report.fixtures[0]?.comparableCount, 0);
  assert.equal(report.fixtures[0]?.expectedMatchShare, null);
  assert.equal(report.overall.orderSensitiveCount, 2);
});

test("unavailable evaluator evidence stays incomplete rather than becoming semantic disagreement", async () => {
  const { pilot, suite } = await loadInputs();
  const singleFixtureSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: [suite.fixtures[0]!],
  };
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    singleFixtureSuite,
    1,
  );

  let call = 0;
  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async () => {
      call += 1;
      return call === 1
        ? { status: "ok", outcome: "A_BETTER" }
        : { status: "unavailable", reason: "synthetic_transport_failure" };
    },
  );

  assert.equal(report.fixtures[0]?.incompleteCount, 1);
  assert.equal(report.fixtures[0]?.comparableCount, 0);
  assert.equal(report.fixtures[0]?.expectedMatchShare, null);
});

test("equivalent-strategy fixtures are explicitly tie expectations across open-ended disciplines", async () => {
  const { pilot, suite } = await loadInputs();
  const ties = suite.fixtures.filter(
    (fixture) => fixture.contrast === "equivalent_strategies",
  );

  assert.ok(ties.length >= 2);
  assert.ok(
    ties.every((fixture) => fixture.expected.kind === "tie"),
  );
  const disciplines = new Set(
    ties.map((fixture) =>
      pilot.archetypes.find(
        (archetype) => archetype.id === fixture.archetypeId,
      )?.discipline,
    ),
  );
  assert.ok(disciplines.has("science"));
  assert.ok(disciplines.has("language_writing"));
});

test("stress plan rejects a fabricated preference for equivalent strategies", async () => {
  const { pilot, suite } = await loadInputs();
  const mutated = structuredClone(suite) as {
    fixtures: Array<{
      contrast: string;
      expected: { kind: "preference" | "tie"; candidateId?: string };
      candidates: Array<{ id: string }>;
    }>;
  };
  const tieFixture = mutated.fixtures.find(
    (fixture) => fixture.contrast === "equivalent_strategies",
  );
  assert.ok(tieFixture);
  tieFixture.expected = {
    kind: "preference",
    candidateId: tieFixture.candidates[0]!.id,
  };

  assert.throws(
    () =>
      buildCaseSystemVNextEvaluatorStressPlan(
        pilot,
        mutated as unknown as CaseSystemVNextStressFixtureSuite,
        1,
      ),
    /Case System vNext evaluator stress data is invalid/,
  );
});
