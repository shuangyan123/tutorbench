import { evaluateTutorEvalRubric } from "../evaluators/tutor-eval.js";
import type { HintPilotCase } from "./learner-evidence-hint-scenarios.js";

export const hintRubric = { id: "learner-evidence-hint-fit", version: "0.1.0" } as const;

const alternatives = {
  unknown: [
    "Invite the learner to find what undoes +3.",
    "Name the first operation on both sides and leave the calculation open.",
  ],
  local: [
    "Prompt transfer of the earlier subtraction without doing the work.",
    "Give the first operation with an independent calculation or self-explanation prompt.",
  ],
  gap: [
    "Explain how applying the same operation preserves equality, then leave a step to try.",
    "Use a small equality example or a guided comparison of changing one side versus both.",
  ],
} as const;

const prohibitedInferences = [
  "Treat being stuck, or an authored knownConcepts entry, as proof of a particular deficit.",
  "Treat one local success as stable mastery or proof of understanding why equality is preserved.",
  "Treat a reported unresolved difficulty as proof of a general inability or of a different misconception.",
];

// 这些是针对本题的有限文本信号。没有匹配时保留 ABSTAIN，交给人工复核。
const signals = {
  conceptualHint: /(?:\+\s*3|加\s*3).{0,22}逆运算|逆运算.{0,22}(?:\+\s*3|加\s*3)|(?:抵消|撤销加|消掉)\s*\+?\s*3/u,
  bothSides: /两[边侧]|左右[两二]边|等号[的]?两边/u,
  subtractThree: /减(?:去|掉)?\s*(?:3|三)|[-−]\s*3/u,
  independentlyTry: /写出|写下|算算|试着|试试|自己(?:算|写|完成)|你来|会变成什么|会得到什么|算成什么|第一步是什么|会怎样/u,
  priorWork: /上一题|刚才那题|之前那题|像.{0,14}(?:减去?\s*2|x\s*\+\s*2)/u,
  equalityReason: /(?:都减|同减|同样|减去相同).{0,16}(?:依然相等|仍然相等|还是相等|保持相等|保持等式成立|保持平衡)|天平.{0,35}(?:同样|等量).{0,12}(?:一样重|等重|平衡)|(?:只减一边|只改一边).{0,15}(?:不相等|不再相等|失去平衡|还相等吗)|(?:两个|两边).{0,8}相等.{0,16}(?:同减|减去同一个数)/u,
  unsupported: /你(?:根本|肯定|显然)?(?:不懂|不会|没学过|没有掌握)(?:逆运算|一元一次方程)|你(?:肯定|已经|完全|显然)(?:完全|熟练|彻底)?掌握了?逆运算|你(?:不懂|不会)(?:保持等式平衡|等式为什么要两边同时运算)/u,
  review: /不(?:能|要|应该)(?:再|只|同时|在)?.{0,10}(?:两边|减去?\s*3)|(?:只减一边|只在一边减).{0,10}(?:就行|就可以)|(?:不会|不能|无法)(?:继续)?保持(?:相等|平衡)|(?:比如|例如).{0,16}(?:x\s*=\s*4)/u,
  workedStep: /2\s*x\s*=\s*8/u,
} as const;

function passage(text: string, pattern: RegExp): string | undefined {
  const clauses = text.match(/[^。！？!?；;\n]+[。！？!?；;]?/gu) ?? [];
  return clauses.find((clause) => pattern.test(clause))?.trim();
}

export function evaluateHintFit(pilotCase: HintPilotCase, text: string) {
  const local = pilotCase.claims.some((item) =>
    item.conceptId === "inverse-operations" && item.status === "demonstrated_local");
  const gap = pilotCase.priorHelp !== undefined && pilotCase.claims.some((item) =>
    item.conceptId === "preservation-of-equality" && item.status === "explicit_gap");
  const expectedMoves = gap ? alternatives.gap : local ? alternatives.local : alternatives.unknown;
  const base = {
    rubric: hintRubric,
    ...pilotCase.sourcePointer,
    evidence: { observations: pilotCase.observations, claims: pilotCase.claims, priorHelp: pilotCase.priorHelp },
    expectedMoves,
    prohibitedInferences,
  };
  const decision = (verdict: "PASS" | "FAIL" | "ABSTAIN", reason: string, excerpts: readonly (string | undefined)[]) => ({
    ...base, verdict, reason,
    responseExcerpts: [...new Set(excerpts.filter((excerpt): excerpt is string => excerpt !== undefined))],
  });

  if (!text.trim()) return decision("ABSTAIN", "No assessable reply.", []);
  const disclosureRule = pilotCase.tutorCase.evaluatorOnly.rubrics[0];
  if (disclosureRule === undefined) throw new Error("hint_pilot_disclosure_guard_missing");
  const disclosure = evaluateTutorEvalRubric(pilotCase.tutorCase, disclosureRule, { text });
  const conflict = passage(text, signals.review);
  if (conflict || disclosure.result === "ERROR") {
    return decision("ABSTAIN", "A potentially contradictory or quoted statement needs review.", [conflict ?? text]);
  }
  if (disclosure.result === "FAIL") {
    return decision("FAIL", "The existing disclosure evaluator detected the configured final answer.", [
      passage(text, /x\s*[=＝]\s*4/u) ?? text,
    ]);
  }
  const diagnosis = passage(text, signals.unsupported);
  if (diagnosis) {
    return decision("FAIL", "The reply asserts a broader learner state than the observations support.", [diagnosis]);
  }
  const cue = passage(text, signals.conceptualHint);
  const operation = passage(text, signals.subtractThree);
  const sides = passage(text, signals.bothSides);
  const direct = operation !== undefined && signals.bothSides.test(operation);
  const attempt = passage(text, signals.independentlyTry);
  const reason = passage(text, signals.equalityReason);
  const prior = passage(text, signals.priorWork);
  const workedStep = passage(text, signals.workedStep);

  if (prior && !local) {
    return decision("ABSTAIN", "The reply refers to earlier work that this history does not establish.", [prior]);
  }
  if (workedStep) {
    return decision("ABSTAIN", "The reply computes the first step. Review how much meaningful work remains.", [workedStep, attempt]);
  }
  if (gap) {
    if (reason && (attempt || direct)) {
      return decision("PASS", "The reply adds equality-specific support after the earlier cue failed and leaves work open.", [
        reason, operation, attempt,
      ]);
    }
    if (!reason && (cue || direct)) {
      return decision("FAIL", "The reply offers the inverse operation or its instruction again without addressing why equality is preserved.", [
        cue, operation, sides,
      ]);
    }
  } else if (local && (cue || direct || prior) && attempt) {
    return decision("PASS", prior
      ? "The reply refers to the earlier local success and leaves a step for the learner."
      : "The reply is compatible with the demonstrated skill and leaves a step open. Explicit reuse of the earlier work was not detected.",
    [prior, cue, operation, sides, attempt]);
  } else if (!local && (cue || direct)) {
    return decision("PASS", "The cause of the difficulty is unknown. This first-step cue or instruction gives a way to start without doing the calculation.", [
      cue, operation, sides, attempt,
    ]);
  }
  return decision("ABSTAIN", "The available reply signals are insufficient to distinguish an appropriate hint from inadequate support.", [
    cue ?? operation ?? reason ?? text, attempt,
  ]);
}
