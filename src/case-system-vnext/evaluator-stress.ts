import {
  CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID,
  CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
  CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION,
  CASE_SYSTEM_VNEXT_STRESS_CONTRASTS,
  type CaseSystemVNextEvaluatorStressReport,
  type CaseSystemVNextStressAggregate,
  type CaseSystemVNextStressCanonicalOutcome,
  type CaseSystemVNextStressFixture,
  type CaseSystemVNextStressFixturePlan,
  type CaseSystemVNextStressFixtureResult,
  type CaseSystemVNextStressFixtureSuite,
  type CaseSystemVNextStressJudge,
  type CaseSystemVNextStressPlan,
  type CaseSystemVNextStressStrategyRegistry,
  type CaseSystemVNextStressPresentationJudgment,
  type CaseSystemVNextStressPresentationPlan,
  type CaseSystemVNextStressRepetitionResult,
} from "../contracts/case-system-vnext-evaluator-stress.js";
import type {
  CaseSystemVNextArchetype,
  CaseSystemVNextPilot,
} from "../contracts/case-system-vnext.js";
import { CASE_SYSTEM_VNEXT_BASE_EVALUATION_CRITERIA } from "../contracts/case-system-vnext-strategy-profile.js";

export class CaseSystemVNextEvaluatorStressError extends Error {
  readonly code = "case_system_vnext_evaluator_stress_invalid" as const;

  constructor() {
    super("Case System vNext evaluator stress data is invalid.");
    this.name = "CaseSystemVNextEvaluatorStressError";
  }
}

function invalid(): never {
  throw new CaseSystemVNextEvaluatorStressError();
}

const comparisonInstruction = [
  "Compare only the two candidate Tutor responses against the authored Case System vNext evidence in this packet.",
  "Apply the shared base criteria first, then the exact task-specific strategy profile for the authored subject, specialization, practice, and task family.",
  "Do not reward response length, stylistic polish, hidden model computation, inference speed, token count, tool use, or brute-force search.",
  "A_BETTER means candidate A is substantively better for the authored contrast; B_BETTER means candidate B is substantively better; TIE means no substantive difference is supported.",
  "Do not invent a unique optimal strategy when the referenceReasoning says bounded_strategy_set or not_applicable.",
].join(" ");

function archetypeFor(pilot: CaseSystemVNextPilot, id: string): CaseSystemVNextArchetype {
  const archetype = pilot.archetypes.find((candidate) => candidate.id === id);
  if (archetype === undefined) invalid();
  return archetype;
}

function buildPresentation(
  fixture: CaseSystemVNextStressFixture,
  archetype: CaseSystemVNextArchetype,
  strategyProfile: CaseSystemVNextStressStrategyRegistry["profiles"][number],
  repetition: number,
  ordinal: 1 | 2,
): CaseSystemVNextStressPresentationPlan {
  const [left, right] = fixture.candidates;
  if (left === undefined || right === undefined) invalid();
  const first = ordinal === 1 ? left : right;
  const second = ordinal === 1 ? right : left;
  const presentationId = `${fixture.id}-r${repetition}-p${ordinal}`;

  return {
    packet: {
      schemaVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION,
      protocolId: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID,
      protocolVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
      presentationId,
      archetypeId: archetype.id,
      discipline: archetype.discipline,
      topic: archetype.topic,
      learnerLevel: archetype.learnerLevel,
      contentDepth: archetype.contentDepth,
      pedagogicalDifficulty: archetype.pedagogicalDifficulty,
      interactionHorizon: archetype.interactionHorizon,
      coreTask: archetype.coreTask,
      learnerState: fixture.learnerState,
      teachingTarget: fixture.teachingTarget,
      contrastUnderTest: fixture.contrast,
      sharedBaseCriteria: CASE_SYSTEM_VNEXT_BASE_EVALUATION_CRITERIA,
      strategyProfile,
      prerequisiteBoundary: archetype.prerequisiteBoundary,
      referenceReasoning: archetype.referenceReasoning,
      transfer: archetype.transfer,
      comparisonInstruction,
      candidates: [
        { label: "A", responseText: first.responseText },
        { label: "B", responseText: second.responseText },
      ],
    },
    assignment: {
      presentationId,
      aCandidateId: first.id,
      bCandidateId: second.id,
    },
  };
}

function validateFixture(
  fixture: CaseSystemVNextStressFixture,
  pilot: CaseSystemVNextPilot,
  registry: CaseSystemVNextStressStrategyRegistry,
): void {
  const archetype = archetypeFor(pilot, fixture.archetypeId);
  const strategyProfile = registry.profiles.find(
    (profile) => profile.id === fixture.strategyProfileId,
  );
  if (
    strategyProfile === undefined ||
    strategyProfile.archetypeId !== fixture.archetypeId
  ) invalid();
  if (
    fixture.id.trim().length === 0 ||
    fixture.strategyProfileId.trim().length === 0 ||
    !CASE_SYSTEM_VNEXT_STRESS_CONTRASTS.includes(fixture.contrast) ||
    fixture.teachingTarget.trim().length === 0 ||
    fixture.learnerState.trim().length === 0 ||
    fixture.rationale.trim().length === 0 ||
    fixture.candidates.length !== 2 ||
    fixture.candidates[0].id === fixture.candidates[1].id ||
    fixture.candidates.some(
      (candidate) =>
        candidate.id.trim().length === 0 || candidate.responseText.trim().length === 0,
    )
  ) invalid();

  if (fixture.expected.kind === "preference") {
    if (
      fixture.expected.candidateId === undefined ||
      !fixture.candidates.some(
        (candidate) => candidate.id === fixture.expected.candidateId,
      )
    ) invalid();
  } else if (fixture.expected.kind === "tie") {
    if (fixture.expected.candidateId !== undefined) invalid();
  } else {
    invalid();
  }

  if (
    fixture.contrast === "equivalent_strategies" &&
    fixture.expected.kind !== "tie"
  ) invalid();

  if (
    fixture.contrast === "generalization_target" &&
    archetype.referenceReasoning.humanOptimalGeneralStrategies.length === 0
  ) invalid();
}

export function buildCaseSystemVNextEvaluatorStressPlan(
  pilot: CaseSystemVNextPilot,
  suite: CaseSystemVNextStressFixtureSuite,
  registry: CaseSystemVNextStressStrategyRegistry,
  runsPerFixture = 3,
): CaseSystemVNextStressPlan {
  if (
    suite.schemaVersion !== CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION ||
    suite.id.trim().length === 0 ||
    suite.version.trim().length === 0 ||
    registry.id.trim().length === 0 ||
    registry.version.trim().length === 0 ||
    suite.fixtures.length === 0 ||
    !Number.isInteger(runsPerFixture) ||
    runsPerFixture < 1 ||
    runsPerFixture > 20
  ) invalid();

  const ids = new Set<string>();
  for (const fixture of suite.fixtures) {
    if (ids.has(fixture.id)) invalid();
    ids.add(fixture.id);
    validateFixture(fixture, pilot, registry);
  }

  const fixtures: CaseSystemVNextStressFixturePlan[] = suite.fixtures.map((fixture) => {
    const archetype = archetypeFor(pilot, fixture.archetypeId);
    const strategyProfile = registry.profiles.find(
      (profile) => profile.id === fixture.strategyProfileId,
    );
    if (strategyProfile === undefined) invalid();
    return {
      fixtureId: fixture.id,
      archetypeId: fixture.archetypeId,
      contrast: fixture.contrast,
      expected: fixture.expected,
      repetitions: Array.from({ length: runsPerFixture }, (_, index) => {
        const repetition = index + 1;
        return {
          repetition,
          presentations: [
            buildPresentation(fixture, archetype, strategyProfile, repetition, 1),
            buildPresentation(fixture, archetype, strategyProfile, repetition, 2),
          ],
        };
      }),
    };
  });

  return {
    schemaVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
    suiteId: suite.id,
    suiteVersion: suite.version,
    strategyRegistryId: registry.id,
    strategyRegistryVersion: registry.version,
    pilotId: pilot.id,
    pilotVersion: pilot.version,
    runsPerFixture,
    plannedJudgmentCount: suite.fixtures.length * runsPerFixture * 2,
    fixtures,
  };
}

function normalizeOne(
  plan: CaseSystemVNextStressPresentationPlan,
  judgment: CaseSystemVNextStressPresentationJudgment,
): { status: CaseSystemVNextStressPresentationJudgment["status"]; winnerCandidateId: string | null; rawOutcome?: CaseSystemVNextStressPresentationJudgment["outcome"] } {
  if (judgment.presentationId !== plan.assignment.presentationId) invalid();
  if (judgment.status === "ok" && judgment.outcome === undefined) invalid();
  if (judgment.status !== "ok" && judgment.outcome !== undefined) invalid();

  if (judgment.status !== "ok") {
    return { status: judgment.status, winnerCandidateId: null };
  }
  if (judgment.outcome === "TIE") {
    return { status: "ok", winnerCandidateId: null, rawOutcome: "TIE" };
  }
  if (judgment.outcome === "A_BETTER") {
    return {
      status: "ok",
      winnerCandidateId: plan.assignment.aCandidateId,
      rawOutcome: judgment.outcome,
    };
  }
  if (judgment.outcome === "B_BETTER") {
    return {
      status: "ok",
      winnerCandidateId: plan.assignment.bCandidateId,
      rawOutcome: judgment.outcome,
    };
  }
  invalid();
}

function normalizeRepetition(
  fixture: CaseSystemVNextStressFixturePlan,
  repetition: CaseSystemVNextStressFixturePlan["repetitions"][number],
  judgments: readonly CaseSystemVNextStressPresentationJudgment[],
): CaseSystemVNextStressRepetitionResult {
  const byId = new Map(judgments.map((judgment) => [judgment.presentationId, judgment]));
  const normalized = repetition.presentations.map((presentation) => {
    const judgment = byId.get(presentation.packet.presentationId);
    if (judgment === undefined) invalid();
    return normalizeOne(presentation, judgment);
  });

  let outcome: CaseSystemVNextStressCanonicalOutcome = { kind: "incomparable" };
  let consistency: CaseSystemVNextStressRepetitionResult["consistency"];

  if (normalized.some((item) => item.status !== "ok")) {
    consistency = "incomplete_evidence";
  } else {
    const [first, second] = normalized;
    if (first === undefined || second === undefined) invalid();
    const firstTie = first.rawOutcome === "TIE";
    const secondTie = second.rawOutcome === "TIE";
    if (firstTie && secondTie) {
      consistency = "stable_tie";
      outcome = { kind: "tie" };
    } else if (firstTie || secondTie) {
      consistency = "inconsistent";
    } else if (
      first.winnerCandidateId !== null &&
      second.winnerCandidateId !== null &&
      first.winnerCandidateId === second.winnerCandidateId
    ) {
      consistency = "stable_preference";
      outcome = { kind: "preference", candidateId: first.winnerCandidateId };
    } else if (
      first.winnerCandidateId !== null &&
      second.winnerCandidateId !== null &&
      first.winnerCandidateId !== second.winnerCandidateId
    ) {
      consistency = "order_sensitive";
    } else {
      invalid();
    }
  }

  let expectedMatch: boolean | null = null;
  if (outcome.kind !== "incomparable") {
    expectedMatch =
      fixture.expected.kind === "tie"
        ? outcome.kind === "tie"
        : outcome.kind === "preference" &&
          outcome.candidateId === fixture.expected.candidateId;
  }

  return {
    repetition: repetition.repetition,
    outcome,
    consistency,
    expectedMatch,
  };
}

function outcomeKey(
  result: CaseSystemVNextStressRepetitionResult,
): string {
  if (result.outcome.kind === "preference") {
    return `preference:${result.outcome.candidateId}`;
  }
  return result.outcome.kind;
}

function summarizeFixture(
  fixture: CaseSystemVNextStressFixturePlan,
  repetitions: readonly CaseSystemVNextStressRepetitionResult[],
): CaseSystemVNextStressFixtureResult {
  const comparable = repetitions.filter((result) => result.expectedMatch !== null);
  const expectedMatchCount = comparable.filter((result) => result.expectedMatch).length;
  const counts = new Map<string, number>();
  for (const result of repetitions) {
    const key = outcomeKey(result);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const modal = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  if (modal === undefined) invalid();
  const [modalKey, modalCount] = modal;
  const [modalOutcome, modalCandidateId] = modalKey.split(":");

  return {
    fixtureId: fixture.fixtureId,
    archetypeId: fixture.archetypeId,
    contrast: fixture.contrast,
    expected: fixture.expected,
    repetitions,
    expectedMatchCount,
    comparableCount: comparable.length,
    expectedMatchShare:
      comparable.length === 0 ? null : expectedMatchCount / comparable.length,
    orderSensitiveCount: repetitions.filter(
      (result) => result.consistency === "order_sensitive",
    ).length,
    incompleteCount: repetitions.filter(
      (result) => result.consistency === "incomplete_evidence",
    ).length,
    modalOutcome: modalOutcome as "preference" | "tie" | "incomparable",
    ...(modalCandidateId === undefined ? {} : { modalCandidateId }),
    modalCount,
    modalShare: modalCount / repetitions.length,
  };
}

function aggregate(
  results: readonly CaseSystemVNextStressFixtureResult[],
): CaseSystemVNextStressAggregate {
  const expectedMatchCount = results.reduce(
    (sum, result) => sum + result.expectedMatchCount,
    0,
  );
  const comparableCount = results.reduce(
    (sum, result) => sum + result.comparableCount,
    0,
  );
  return {
    expectedMatchCount,
    comparableCount,
    expectedMatchShare:
      comparableCount === 0 ? null : expectedMatchCount / comparableCount,
    orderSensitiveCount: results.reduce(
      (sum, result) => sum + result.orderSensitiveCount,
      0,
    ),
    incompleteCount: results.reduce(
      (sum, result) => sum + result.incompleteCount,
      0,
    ),
  };
}

export async function runCaseSystemVNextEvaluatorStress(
  plan: CaseSystemVNextStressPlan,
  judge: CaseSystemVNextStressJudge,
): Promise<CaseSystemVNextEvaluatorStressReport> {
  const fixtureResults: CaseSystemVNextStressFixtureResult[] = [];
  let observedJudgmentCount = 0;

  for (const fixture of plan.fixtures) {
    const repetitionResults: CaseSystemVNextStressRepetitionResult[] = [];
    for (const repetition of fixture.repetitions) {
      const judgments: CaseSystemVNextStressPresentationJudgment[] = [];
      for (const presentation of repetition.presentations) {
        const judgment = await judge(presentation.packet);
        observedJudgmentCount += 1;
        judgments.push({
          presentationId: presentation.packet.presentationId,
          ...judgment,
        });
      }
      repetitionResults.push(
        normalizeRepetition(fixture, repetition, judgments),
      );
    }
    fixtureResults.push(summarizeFixture(fixture, repetitionResults));
  }

  const byContrast = Object.fromEntries(
    CASE_SYSTEM_VNEXT_STRESS_CONTRASTS.map((contrast) => [
      contrast,
      aggregate(fixtureResults.filter((result) => result.contrast === contrast)),
    ]),
  ) as CaseSystemVNextEvaluatorStressReport["byContrast"];

  return {
    schemaVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_SCHEMA_VERSION,
    protocolId: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_ID,
    protocolVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
    calibrationStatus: "uncalibrated",
    suiteId: plan.suiteId,
    suiteVersion: plan.suiteVersion,
    strategyRegistryId: plan.strategyRegistryId,
    strategyRegistryVersion: plan.strategyRegistryVersion,
    pilotId: plan.pilotId,
    pilotVersion: plan.pilotVersion,
    runsPerFixture: plan.runsPerFixture,
    plannedJudgmentCount: plan.plannedJudgmentCount,
    observedJudgmentCount,
    fixtures: fixtureResults,
    overall: aggregate(fixtureResults),
    byContrast,
    interpretationBoundary: [
      "Fixture expectations are developer-authored diagnostics, not human calibration gold.",
      "Expected-match share is a stress-test diagnostic, not evaluator accuracy.",
      "Stable preference on synthetic contrasts does not establish general tutoring validity.",
      "No learner outcome, learning gain, or realized transfer claim is supported.",
    ],
    selectionStatement:
      "No evaluator-quality winner or calibration claim is inferred.",
  };
}
