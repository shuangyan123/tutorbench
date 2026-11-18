import type { TutorEvalDataset } from "../contracts/tutor-eval.js";
import type {
  TutorScenarioSuiteVNext,
  TutorScenarioVNext,
  TutorTeachingDecision,
} from "../contracts/tutor-scenario-vnext.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../datasets/real-world.js";
import { indexScenarioLearnerEvidence } from "../datasets/scenario-evidence-provenance.js";

export const hintPilotId = "learner-evidence-hint-v0.1";
export const hintPilotVersion = "0.1.0";
export const hintSource = {
  datasetId: "tutor-eval-v0.2a",
  datasetVersion: "0.2a.6",
  caseId: "hint-only-linear-equation-001-zh-CN",
  caseVersion: "1.1.0",
} as const;

// 复用 #349 的逐字引用、证据类型和状态约束。这里仅使用本实验所需的子集。
type Observation = {
  readonly id: string;
  readonly kind: "question" | "local_reasoning" | "explicit_gap";
  readonly learnerTurnIndex: number;
  readonly quote: string;
};
type Claim = {
  readonly conceptId: "inverse-operations" | "preservation-of-equality";
  readonly status: "unknown" | "demonstrated_local" | "explicit_gap";
  readonly observationIds: readonly string[];
};
const supportedEvidence = {
  demonstrated_local: "local_reasoning",
  explicit_gap: "explicit_gap",
} as const;

type Profile = {
  readonly id: "unknown" | "local-understanding" | "unresolved-gap";
  readonly trajectory: TutorScenarioVNext["trajectory"];
  readonly observations: readonly Observation[];
  readonly claims: readonly Claim[];
  readonly failedHint?: { readonly messageIndex: number; readonly observationId: string };
  readonly expectedDecision: TutorTeachingDecision;
};

function profiles(request: string): readonly Profile[] {
  const priorWork = "上一题 x + 2 = 7，我自己在两边都减去 2，得到 x = 5。";
  const priorHint = "想一想 +3 的逆运算。";
  const gap = "我知道要减 3，但不明白为什么等式两边都要减 3。刚才的提示没让我继续下去。";
  const ask = { role: "user", content: request } as const;
  const stuck = (learnerTurnIndex: number): Observation => ({
    id: "current-request", kind: "question", learnerTurnIndex, quote: request,
  });
  const inverseUnknown = {
    conceptId: "inverse-operations", status: "unknown", observationIds: [],
  } as const;
  const equalityUnknown = {
    conceptId: "preservation-of-equality", status: "unknown", observationIds: [],
  } as const;
  return [
    {
      id: "unknown",
      trajectory: { attemptCount: 1, failedAttempts: 0, priorHints: [], conversationHistory: [ask] },
      observations: [stuck(1)],
      claims: [inverseUnknown, equalityUnknown],
      expectedDecision: "offer_conceptual_hint",
    },
    {
      id: "local-understanding",
      trajectory: {
        attemptCount: 1, failedAttempts: 0, priorHints: [],
        conversationHistory: [{ role: "user", content: priorWork }, ask],
      },
      observations: [
        { id: "independent-work", kind: "local_reasoning", learnerTurnIndex: 1, quote: priorWork },
        stuck(2),
      ],
      claims: [
        { conceptId: "inverse-operations", status: "demonstrated_local", observationIds: ["independent-work"] },
        equalityUnknown,
      ],
      expectedDecision: "fade_support",
    },
    {
      id: "unresolved-gap",
      trajectory: {
        attemptCount: 2, failedAttempts: 1, priorHints: [priorHint],
        conversationHistory: [
          { role: "user", content: "2x + 3 = 11 要怎么开始？" },
          { role: "assistant", content: priorHint },
          { role: "user", content: gap },
          ask,
        ],
      },
      observations: [
        { id: "equality-gap", kind: "explicit_gap", learnerTurnIndex: 2, quote: gap },
        stuck(3),
      ],
      claims: [
        inverseUnknown,
        { conceptId: "preservation-of-equality", status: "explicit_gap", observationIds: ["equality-gap"] },
      ],
      failedHint: { messageIndex: 2, observationId: "equality-gap" },
      expectedDecision: "escalate_support",
    },
  ];
}

export function resolveHintEvidence(profile: Pick<Profile, "observations" | "claims" | "failedHint">,
  trajectory: TutorScenarioVNext["trajectory"]) {
  const userTurns = trajectory.conversationHistory.flatMap((turn, index) =>
    turn.role === "user" ? [{ ...turn, messageIndex: index + 1 }] : []);
  const observations = profile.observations.map((item) => {
    const turn = userTurns[item.learnerTurnIndex - 1];
    if (turn === undefined || !item.quote.trim() || !turn.content.includes(item.quote)) {
      throw new Error("hint_evidence_quote_not_in_learner_turn");
    }
    if (item.kind === "local_reasoning" &&
        trajectory.conversationHistory.slice(0, turn.messageIndex - 1).some((message) => message.role === "assistant")) {
      throw new Error("hint_local_work_not_before_help");
    }
    return { ...item, messageIndex: turn.messageIndex };
  });
  const byId = new Map(observations.map((item) => [item.id, item]));
  if (byId.size !== observations.length ||
      new Set(profile.claims.map((claim) => claim.conceptId)).size !== profile.claims.length) {
    throw new Error("hint_evidence_duplicate");
  }
  for (const claim of profile.claims) {
    const { status, observationIds } = claim;
    const valid = status === "unknown" ? observationIds.length === 0 :
      observationIds.length > 0 &&
      new Set(observationIds).size === observationIds.length &&
      observationIds.every((id) => byId.get(id)?.kind === supportedEvidence[status]);
    if (!valid) {
      throw new Error("hint_evidence_status_mismatch");
    }
  }
  let priorHelp;
  if (profile.failedHint !== undefined) {
    const { messageIndex, observationId } = profile.failedHint;
    const hint = trajectory.conversationHistory[messageIndex - 1];
    const outcome = byId.get(observationId);
    if (hint?.role !== "assistant" || !trajectory.priorHints.includes(hint.content) ||
        outcome?.kind !== "explicit_gap" || outcome.messageIndex <= messageIndex ||
        !profile.claims.some((claim) => claim.conceptId === "preservation-of-equality" &&
          claim.status === "explicit_gap" && claim.observationIds.includes(observationId))) {
      throw new Error("hint_evidence_prior_help_mismatch");
    }
    priorHelp = { messageIndex, quote: hint.content, outcomeObservationId: observationId };
  }
  return { observations, claims: profile.claims, priorHelp };
}

export function createHintPilot(dataset: TutorEvalDataset) {
  const source = dataset.cases.find((item) => item.id === hintSource.caseId);
  const disclosure = source?.evaluatorOnly.rubrics.find((rubric) =>
    rubric.id === "equation-hint-no-leak-001-zh-CN");
  if (dataset.id !== hintSource.datasetId || dataset.version !== hintSource.datasetVersion ||
      source?.version !== hintSource.caseVersion || source.locale !== "zh-CN" ||
      source.evaluatorOnly.disclosurePolicy !== "hint_only" ||
      disclosure?.evaluatorId !== "direct_answer_leak" || disclosure.config === undefined) {
    throw new Error("hint_pilot_source_mismatch");
  }
  const { locale } = source;
  const { evaluatorId, config } = disclosure;

  const authored = profiles(source.tutorInput.studentMessage);
  const suite: TutorScenarioSuiteVNext = {
    schemaVersion: 3,
    id: hintPilotId,
    version: hintPilotVersion,
    title: "Learner evidence and hint calibration",
    description: "Experimental counterfactuals with author-written learner histories.",
    healthTaxonomyVersion: "0.1.0",
    scenarios: authored.map((profile, index) => {
      // TutorTurnInput 包含案例 ID，因此使用不透露证据状态的编号。
      const caseId = `${hintPilotId}-${index + 1}`;
      return {
        schemaVersion: 3,
        identity: { id: caseId, version: hintPilotVersion, title: profile.id, suiteId: hintPilotId },
        description: "Same hint request with an authored evidence condition.",
        learningContext: {
          subject: source.metadata.subject,
          topic: source.metadata.topic,
          learningObjective: source.tutorInput.learningObjective,
          learnerLevel: source.tutorInput.studentProfile?.level ?? "初中阶段",
        },
        tutorVisibleContext: { knownConcepts: [] },
        evaluatorReferenceState: { misconceptions: [] },
        trajectory: profile.trajectory,
        teachingPolicy: { disclosure: "hint_only" },
        decisionPoints: [{
          id: "next-hint",
          evaluationCaseId: caseId,
          turnIndex: profile.trajectory.conversationHistory.filter((turn) => turn.role === "assistant").length + 1,
          expectedDecision: profile.expectedDecision,
          expectedBehavior: "Calibrate one next hint to the observed reasoning and help history.",
          evaluationCriteria: [{
            rubricId: `${caseId}-disclosure`,
            category: "guidance",
            dimension: "learning_integrity",
            criterion: disclosure.criterion,
            weight: 1,
            evaluationType: "deterministic",
            evaluatorId,
            config,
            behavior: "prohibited",
            failureFinding: {
              type: "hint-pilot-disclosure",
              title: "Final answer disclosed",
              severity: "major",
              observedBehavior: "The response discloses the configured final answer.",
              diagnosis: "The response exceeds the student's request for one hint.",
              impact: "The learner loses the opportunity to solve independently.",
              likelyCauses: [],
              recommendations: [
                { kind: "diagnostic", text: "Check the reply for the final answer." },
                { kind: "implementation_suggestion", text: "Offer a next step and leave the remaining work to the learner." },
              ],
              regressionTargets: [caseId],
              confidence: 1,
            },
          }],
        }],
      };
    }),
  };
  const compiled = tutorScenarioSuiteToTutorEvalDataset(suite);
  const provenance = indexScenarioLearnerEvidence(suite);
  return authored.map((profile, index) => {
    const caseId = `${hintPilotId}-${index + 1}`;
    const scenario = suite.scenarios.find((item) => item.identity.id === caseId);
    const tutorCase = compiled.cases.find((item) => item.id === caseId);
    const sourcePointer = provenance.find((item) => item.scenarioId === caseId);
    if (scenario === undefined || tutorCase === undefined || sourcePointer === undefined) {
      throw new Error("hint_pilot_case_missing");
    }
    return {
      condition: profile.id,
      // vNext 编译器没有 locale 字段；本地回放使用来源案例的语言。
      tutorCase: { ...tutorCase, locale },
      sourcePointer,
      ...resolveHintEvidence(profile, scenario.trajectory),
    };
  });
}

export type HintPilotCase = ReturnType<typeof createHintPilot>[number];
