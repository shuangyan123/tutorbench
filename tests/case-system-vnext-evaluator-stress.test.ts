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
  parseCaseSystemVNextStrategyProfileRegistry,
  parseCaseSystemVNextDomainTaxonomy,
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
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const taxonomy = parseCaseSystemVNextDomainTaxonomy(
    await loadJson("scenarios/case-system-vnext/domain-taxonomy.json"),
  );
  return { pilot, suite, registry, taxonomy };
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
  const { pilot, suite, registry } = await loadInputs();
  const plan = buildCaseSystemVNextEvaluatorStressPlan(pilot, suite, registry, 3);

  assert.equal(plan.fixtures.length, 15);
  assert.equal(plan.plannedJudgmentCount, 15 * 3 * 2);

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
        assert.equal(
          presentation.packet.strategyProfile.archetypeId,
          presentation.packet.archetypeId,
        );
        assert.equal(
          presentation.packet.strategyProfile.academicContext.domainId,
          presentation.packet.domainId,
        );
        assert.ok(presentation.packet.subdomain.length > 0);
        assert.ok(presentation.packet.practice.length > 0);
        assert.ok(presentation.packet.sharedBaseCriteria.length >= 5);
        assert.equal(
          presentation.packet.teachingObjectiveProfile.mode,
          presentation.packet.teachingObjective.mode,
        );
        if (presentation.packet.teachingObjective.mode === "exam_oriented") {
          assert.ok(presentation.packet.teachingObjective.assessmentContext);
        } else {
          assert.equal(presentation.packet.teachingObjective.assessmentContext, undefined);
        }
        assert.ok(
          presentation.packet.sharedBaseCriteria.some(
            (criterion) => criterion.id === "learner-alignment",
          ),
        );
        assert.ok(
          (presentation.packet.strategyProfile.academicContext.disciplineFamily ?? "").length > 0,
        );
        assert.ok(
          (presentation.packet.strategyProfile.academicContext.subject ?? "").length > 0,
        );
        assert.ok(presentation.packet.strategyProfile.taskFamily.length > 0);
        assert.ok(presentation.packet.strategyProfile.criteria.length > 0);
      }
    }
  }
});

test("stable synthetic judgments produce exact expected-match diagnostics", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const plan = buildCaseSystemVNextEvaluatorStressPlan(pilot, suite, registry, 2);
  const fixtureById = new Map(suite.fixtures.map((fixture) => [fixture.id, fixture]));

  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async (packet) => {
      const fixtureId = packet.presentationId.replace(/-r\d+-p[12]$/, "");
      const fixture = fixtureById.get(fixtureId);
      assert.ok(fixture);
      if (fixture.expected.kind === "equivalent") {
        return { status: "ok", outcome: "EQUIVALENT" };
      }
      if (fixture.expected.kind === "non_dominated") {
        return { status: "ok", outcome: "NON_DOMINATED" };
      }
      if (fixture.expected.kind === "insufficient_evidence") {
        return { status: "ok", outcome: "INSUFFICIENT_EVIDENCE" };
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
  assert.equal(report.overall.comparableCount, 15 * 2);
  assert.equal(report.overall.expectedMatchCount, 15 * 2);
  assert.equal(report.overall.expectedMatchShare, 1);
  assert.equal(report.overall.orderSensitiveCount, 0);
  assert.equal(report.overall.inconsistentCount, 0);
  assert.equal(report.overall.incompleteCount, 0);
  assert.equal(report.overall.okJudgmentCount, report.plannedJudgmentCount);
  assert.equal(report.overall.unavailableJudgmentCount, 0);
  assert.equal(report.overall.invalidJudgmentCount, 0);
  assert.equal(report.calibrationStatus, "uncalibrated");
  assert.match(report.selectionStatement, /No evaluator-quality winner/);

  assert.equal(report.byContrast.human_efficiency.expectedMatchShare, 1);
  assert.equal(report.byContrast.opacity.expectedMatchShare, 1);
  assert.equal(report.byContrast.generalization_target.expectedMatchShare, 1);
  assert.equal(report.byContrast.prerequisite_compatibility.expectedMatchShare, 1);
  assert.equal(report.byContrast.equivalent_strategies.expectedMatchShare, 1);
  assert.equal(report.byContrast.domain_strategy_alignment.expectedMatchShare, 1);
  assert.equal(report.byContrast.objective_alignment.expectedMatchShare, 1);
  assert.equal(report.byContrast.pareto_tradeoff.expectedMatchShare, 1);
  assert.equal(report.byContrast.evidence_sufficiency.expectedMatchShare, 1);
  assert.equal(report.overall.equivalentCount, 2);
  assert.equal(report.overall.nonDominatedCount, 2);
  assert.equal(report.overall.insufficientEvidenceCount, 2);
});

test("position-following judgments are classified as order-sensitive, not as equivalence", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const singleFixtureSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: [suite.fixtures[0]!],
  };
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    singleFixtureSuite,
    registry,
    2,
  );

  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async () => ({ status: "ok", outcome: "A_BETTER" }),
  );

  assert.equal(report.fixtures[0]?.orderSensitiveCount, 2);
  assert.equal(report.fixtures[0]?.inconsistentCount, 0);
  assert.equal(report.fixtures[0]?.okJudgmentCount, 4);
  assert.equal(report.fixtures[0]?.comparableCount, 0);
  assert.equal(report.fixtures[0]?.expectedMatchShare, null);
  assert.equal(report.overall.orderSensitiveCount, 2);
});

test("unavailable evaluator evidence stays incomplete rather than becoming semantic disagreement", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const singleFixtureSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: [suite.fixtures[0]!],
  };
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    singleFixtureSuite,
    registry,
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

  const result = report.fixtures[0];
  assert.ok(result);
  assert.equal(result.incompleteCount, 1);
  assert.equal(result.inconsistentCount, 0);
  assert.equal(result.okJudgmentCount, 1);
  assert.equal(result.unavailableJudgmentCount, 1);
  assert.equal(result.invalidJudgmentCount, 0);
  assert.equal(result.comparableCount, 0);
  assert.equal(result.expectedMatchShare, null);
  const repetition = result.repetitions[0];
  assert.ok(repetition);
  assert.equal(repetition.presentations[0].status, "ok");
  assert.equal(repetition.presentations[0].outcome, "A_BETTER");
  assert.equal(repetition.presentations[1].status, "unavailable");
  assert.equal(
    repetition.presentations[1].reason,
    "synthetic_transport_failure",
  );
  assert.equal(repetition.presentations[0].aCandidateId, "mechanical");
  assert.equal(repetition.presentations[1].aCandidateId, "structural");
});

test("mixed semantic outcomes retain both presentations and count inconsistency", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const pareto = suite.fixtures.find(
    (fixture) => fixture.id === "chemistry-pareto-tradeoff",
  );
  assert.ok(pareto);
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    { ...suite, fixtures: [pareto] },
    registry,
    1,
  );

  let call = 0;
  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async () => {
      call += 1;
      return {
        status: "ok",
        outcome: call === 1 ? "NON_DOMINATED" : "A_BETTER",
      };
    },
  );

  const result = report.fixtures[0];
  assert.ok(result);
  assert.equal(result.inconsistentCount, 1);
  assert.equal(result.orderSensitiveCount, 0);
  assert.equal(result.comparableCount, 0);
  assert.equal(result.okJudgmentCount, 2);
  assert.equal(result.repetitions[0]?.presentations[0].outcome, "NON_DOMINATED");
  assert.equal(result.repetitions[0]?.presentations[1].outcome, "A_BETTER");
});

test("equivalent-strategy fixtures require semantic equivalence and stay inside authored task profiles", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const equivalents = suite.fixtures.filter(
    (fixture) => fixture.contrast === "equivalent_strategies",
  );

  assert.ok(equivalents.length >= 1);
  assert.ok(
    equivalents.every((fixture) => fixture.expected.kind === "equivalent"),
  );

  for (const fixture of equivalents) {
    const archetype = pilot.archetypes.find(
      (candidate) => candidate.id === fixture.archetypeId,
    );
    const profile = registry.profiles.find(
      (candidate) => candidate.id === fixture.strategyProfileId,
    );
    assert.ok(archetype);
    assert.ok(profile);
    assert.equal(profile.archetypeId, archetype.id);
    assert.equal(profile.evaluationMode, "acceptable_strategy_set");
  }
});

test("audit-seeded taxonomy preserves all 23 research domains and profile references", async () => {
  const { taxonomy, registry } = await loadInputs();

  assert.equal(taxonomy.domains.length, 23);
  assert.equal(taxonomy.source.section, "5.2");
  assert.equal(
    taxonomy.source.disposition,
    "design_preference_pending_expert_validation",
  );

  const ids = new Set(taxonomy.domains.map((domain) => domain.id));
  for (const required of [
    "mathematics",
    "statistics",
    "physics",
    "chemistry",
    "biology",
    "computer_science",
    "history",
    "writing_rhetoric",
  ] as const) {
    assert.ok(ids.has(required));
  }

  for (const profile of registry.profiles) {
    assert.ok(ids.has(profile.academicContext.domainId));
  }
});

test("strategy profiles are layered below audit domains and exact archetypes", async () => {
  const { pilot, registry } = await loadInputs();

  assert.equal(registry.profiles.length, 8);
  for (const profile of registry.profiles) {
    const archetype = pilot.archetypes.find(
      (candidate) => candidate.id === profile.archetypeId,
    );
    assert.ok(archetype);
    assert.ok(profile.academicContext.domainId.length > 0);
    assert.ok((profile.academicContext.disciplineFamily ?? "").length > 0);
    assert.ok((profile.academicContext.subject ?? "").length > 0);
    assert.ok(profile.taskFamily.length > 0);
    assert.ok(profile.strategyScope.length > 0);
    assert.ok(profile.nonGoals.some((item) => /No universal/i.test(item)));
  }

  const programming = registry.profiles.find(
    (profile) => profile.archetypeId === "programming-d5-algorithm",
  );
  assert.ok(programming);
  assert.equal(programming.academicContext.domainId, "computer_science");
  assert.equal(programming.academicContext.subject, "computer_science");
  assert.equal(programming.academicContext.specialization, "algorithms");
  assert.match(programming.taskFamily, /pair-sum/);
  assert.ok(
    programming.nonGoals.some((item) => /debugging|refactoring|systems design/i.test(item)),
  );

  const writing = registry.profiles.find(
    (profile) => profile.archetypeId === "writing-d5-synthesis",
  );
  assert.ok(writing);
  assert.equal(writing.evaluationMode, "acceptable_strategy_set");

  const physics = registry.profiles.find(
    (profile) => profile.id === "physics-d1-position-time-graph",
  );
  assert.ok(physics);
  assert.equal(physics.academicContext.domainId, "physics");
  assert.equal(physics.academicContext.specialization, "kinematics");
  assert.ok(physics.criteria.some((criterion) => criterion.id === "scope-control"));

  const chemistry = registry.profiles.find(
    (profile) => profile.id === "chemistry-d5-kinetics-discrimination",
  );
  assert.ok(chemistry);
  assert.equal(chemistry.academicContext.domainId, "chemistry");
  assert.equal(chemistry.evaluationMode, "pareto_tradeoff");
  assert.ok(chemistry.criteria.some((criterion) => criterion.id === "factor-identifiability"));

  const biology = registry.profiles.find(
    (profile) => profile.id === "biology-d3-causal-control",
  );
  assert.ok(biology);
  assert.equal(biology.academicContext.domainId, "biology");
  assert.ok(biology.criteria.some((criterion) => criterion.id === "teleology-restraint"));

  const pythonDebugging = registry.profiles.find(
    (profile) => profile.id === "computer-science-python-d3-debugging",
  );
  assert.ok(pythonDebugging);
  assert.equal(pythonDebugging.academicContext.domainId, "computer_science");
  assert.equal(pythonDebugging.academicContext.specialization, "python");
  assert.ok(pythonDebugging.criteria.some((criterion) => criterion.id === "fault-localization"));
});

test("domain-specific stress fixtures cover physics chemistry biology and Python debugging", async () => {
  const { suite, registry } = await loadInputs();
  const domainFixtures = suite.fixtures.filter(
    (fixture) => fixture.contrast === "domain_strategy_alignment",
  );
  assert.equal(domainFixtures.length, 4);

  const domains = new Set(
    domainFixtures.map((fixture) =>
      registry.profiles.find((profile) => profile.id === fixture.strategyProfileId)
        ?.academicContext.domainId,
    ),
  );
  assert.ok(domains.has("physics"));
  assert.ok(domains.has("chemistry"));
  assert.ok(domains.has("biology"));
  assert.ok(domains.has("computer_science"));

  for (const fixture of domainFixtures) {
    assert.equal(fixture.expected.kind, "preference");
  }
});

test("learning and exam objectives can reverse the preferred strategy on the same task", async () => {
  const { suite } = await loadInputs();
  const learning = suite.fixtures.find(
    (fixture) => fixture.id === "objective-learning-math-generalization",
  );
  const exam = suite.fixtures.find(
    (fixture) => fixture.id === "objective-exam-math-speed",
  );

  assert.ok(learning);
  assert.ok(exam);
  assert.equal(learning.archetypeId, exam.archetypeId);
  assert.deepEqual(learning.candidates, exam.candidates);
  assert.equal(learning.teachingObjective.mode, "learning_oriented");
  assert.equal(exam.teachingObjective.mode, "exam_oriented");
  assert.ok(exam.teachingObjective.assessmentContext);
  assert.equal(learning.expected.kind, "preference");
  assert.equal(exam.expected.kind, "preference");
  assert.notEqual(
    learning.expected.candidateId,
    exam.expected.candidateId,
  );
});

test("exam-oriented fixtures require explicit assessment context", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const exam = suite.fixtures.find(
    (fixture) => fixture.id === "objective-exam-math-speed",
  );
  assert.ok(exam);

  const mutated = structuredClone(suite) as unknown as {
    fixtures: Array<{
      id: string;
      teachingObjective: {
        mode: string;
        assessmentContext?: unknown;
      };
    }>;
  };
  const target = mutated.fixtures.find((fixture) => fixture.id === exam.id);
  assert.ok(target);
  delete target.teachingObjective.assessmentContext;

  assert.throws(
    () =>
      buildCaseSystemVNextEvaluatorStressPlan(
        pilot,
        mutated as unknown as CaseSystemVNextStressFixtureSuite,
        registry,
        1,
      ),
    /Case System vNext evaluator stress data is invalid/,
  );
});

test("semantic no-winner outcomes remain distinct from transport unavailability", async () => {
  const { pilot, suite, registry } = await loadInputs();

  const selected = suite.fixtures.filter((fixture) =>
    ["writing-equivalent-strategies", "chemistry-pareto-tradeoff", "history-insufficient-evidence"]
      .includes(fixture.id),
  );
  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    { ...suite, fixtures: selected },
    registry,
    1,
  );

  const outcomeByFixture = new Map<
    string,
    "EQUIVALENT" | "NON_DOMINATED" | "INSUFFICIENT_EVIDENCE"
  >([
    ["writing-equivalent-strategies", "EQUIVALENT"],
    ["chemistry-pareto-tradeoff", "NON_DOMINATED"],
    ["history-insufficient-evidence", "INSUFFICIENT_EVIDENCE"],
  ]);

  const report = await runCaseSystemVNextEvaluatorStress(
    plan,
    async (packet) => {
      const fixtureId = packet.presentationId.replace(/-r\d+-p[12]$/, "");
      const outcome = outcomeByFixture.get(fixtureId);
      assert.ok(outcome);
      return { status: "ok", outcome };
    },
  );

  assert.equal(report.fixtures[0]?.modalOutcome, "equivalent");
  assert.equal(report.fixtures[1]?.modalOutcome, "non_dominated");
  assert.equal(report.fixtures[2]?.modalOutcome, "insufficient_evidence");
  assert.equal(report.overall.equivalentCount, 1);
  assert.equal(report.overall.nonDominatedCount, 1);
  assert.equal(report.overall.insufficientEvidenceCount, 1);
  assert.equal(report.overall.incompleteCount, 0);
});

test("Pareto tradeoff and insufficient-evidence contrasts require their own expected semantics", async () => {
  const { pilot, suite, registry } = await loadInputs();

  const pareto = structuredClone(suite) as CaseSystemVNextStressFixtureSuite;
  const paretoFixture = pareto.fixtures.find(
    (fixture) => fixture.contrast === "pareto_tradeoff",
  );
  assert.ok(paretoFixture);
  (paretoFixture as { expected: { kind: string; candidateId?: string } }).expected = {
    kind: "equivalent",
  };
  assert.throws(
    () => buildCaseSystemVNextEvaluatorStressPlan(pilot, pareto, registry, 1),
    /Case System vNext evaluator stress data is invalid/,
  );

  const insufficient = structuredClone(suite) as CaseSystemVNextStressFixtureSuite;
  const insufficientFixture = insufficient.fixtures.find(
    (fixture) => fixture.contrast === "evidence_sufficiency",
  );
  assert.ok(insufficientFixture);
  (insufficientFixture as { expected: { kind: string; candidateId?: string } }).expected = {
    kind: "non_dominated",
  };
  assert.throws(
    () => buildCaseSystemVNextEvaluatorStressPlan(pilot, insufficient, registry, 1),
    /Case System vNext evaluator stress data is invalid/,
  );
});

test("stress plan rejects a fabricated preference for equivalent strategies", async () => {
  const { pilot, suite, registry } = await loadInputs();
  const mutated = structuredClone(suite) as unknown as {
    fixtures: Array<{
      contrast: string;
      expected: {
        kind: "preference" | "equivalent" | "non_dominated" | "insufficient_evidence";
        candidateId?: string;
      };
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
        registry,
        1,
      ),
    /Case System vNext evaluator stress data is invalid/,
  );
});
