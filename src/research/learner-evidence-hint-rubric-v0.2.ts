import { evaluateTutorEvalRubric } from "../evaluators/tutor-eval.js";
import type { HintPilotCase } from "./learner-evidence-hint-scenarios.js";

export const hintRubric = { id: "learner-evidence-hint-fit", version: "0.2.1" } as const;

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
    "Use a concrete balance analogy or guided comparison of changing one side versus both.",
  ],
} as const;

const prohibitedInferences = [
  "Treat being stuck, or an authored knownConcepts entry, as proof of a particular deficit.",
  "Treat one local success as stable mastery or proof of understanding why equality is preserved.",
  "Treat a reported unresolved difficulty as proof of a general inability or of a different misconception.",
];

const signals = {
  conceptualHint: /(?:\+\s*3|加\s*3).{0,22}逆运算|逆运算.{0,22}(?:\+\s*3|加\s*3)|(?:抵消|撤销加|消掉)\s*\+?3/u,
  bothSides: /两[边侧]|左右(?:两)?边|两侧|双方|每边|各边/u,
  subtractThree: /(?:减(?:去|掉)?|拿走|取走|移走|去掉)\s*(?:3|三)/u,
  bothSidesOperation: /(?:两边|左右(?:两)?边|两侧|双方|每边|各边).{0,18}(?:(?:同时|都|各自|各)?(?:减(?:去|掉)?|拿走|取走|移走|去掉)\s*(?:3|三))/u,
  independentlyTry: /写出|写下|算算|试着|试试|自己(?:算|写|完成)|你来|会变成什么|会得到什么|算成什么|第一步是什么|会怎样|把这个(?:想法|办法|比较).{0,18}用到/u,
  priorWork: /上一题|上题|上一道题|前一道题|刚才那题|之前那题|像.{0,14}(?:减去?\s*2|x\s*\+\s*2)/u,
  unsupported: /你(?:根本|肯定|显然)?(?:不懂|不会|没学过|没有掌握)(?:逆运算|一元一次方程)|你(?:肯定|已经|完全|显然)(?:完全|熟练|彻底)?掌握了?逆运算|你(?:不懂|不会)(?:保持等式平衡|等式为什么要两边同时运算)/u,
  review: /不(?:能|要|应该)(?:再|只|同时|在)?.{0,10}(?:两边|减去?\s*3)|(?:只减一边|只在一边减).{0,10}(?:就行|就可以)|(?:不会|不能|无法)(?:继续)?保持(?:相等|平衡)/u,
  workedStep: /2\s*x\s*=\s*8/u,
  oneSidedPreservation: /(?:只|仅)(?:在|对|从)?(?:左边|右边|一边|一侧).{0,16}(?:减(?:去|掉)?|加(?:上)?|拿走|取走).{0,16}(?:仍然|依然|还是|保持).{0,8}(?:相等|平衡|成立)|(?:只减|只在).{0,8}(?:一边|左边|右边).{0,12}(?:就行|就可以|即可)/u,
  oneSideOnly: /(?:左|右)(?:边|侧).{0,12}减(?:去|掉)?\s*(?:3|三).{0,16}(?:右|左)(?:边|侧).{0,8}(?:不用|不需要|不必|不动|不减)|(?:右|左)(?:边|侧).{0,12}(?:不用|不需要|不必|不动|不减).{0,16}(?:左|右)(?:边|侧).{0,12}减(?:去|掉)?\s*(?:3|三)/u,
  unequalSideOperations: /左(?:边|侧).{0,16}减(?:去|掉)?\s*(?:3|三).{0,24}右(?:边|侧).{0,16}减(?:去|掉)?\s*(?:2|二)|右(?:边|侧).{0,16}减(?:去|掉)?\s*(?:3|三).{0,24}左(?:边|侧).{0,16}减(?:去|掉)?\s*(?:2|二)/u,
} as const;

const legacyEqualityExplanation =
  /(?:都减|同减|同样|减去相同).{0,16}(?:依然相等|仍然相等|还是相等|保持相等|保持等式成立|保持平衡)|天平.{0,35}(?:同样|等量).{0,12}(?:一样重|等重|平衡)|(?:只减一边|只改一边).{0,15}(?:不相等|不再相等|失去平衡|还相等吗)|(?:两个|两边).{0,8}相等.{0,16}(?:同减|减去同一个数)/u;

function passage(text: string, pattern: RegExp): string | undefined {
  const clauses = text.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/gu) ?? [];
  return clauses.find((clause) => pattern.test(clause))?.trim();
}

function mathStatementNeedsReview(text: string): {
  verdict: "FAIL" | "ABSTAIN"; excerpt: string;
} | undefined {
  // Only compare explicit integer equalities; this is not a general symbolic verifier.
  // Node 24 supports Unicode sets; the RegExp constructor avoids a literal
  // v-flag restriction when compiling to the repository's TypeScript target.
  const integerEquality = new RegExp(
    String.raw`(?<![[\p{L}--\p{Script=Han}]\p{N}_])(-?\d+)\s*[=＝]\s*(-?\d+)(?![[\p{L}--\p{Script=Han}]\p{N}_])`,
    "gv",
  );
  for (const clause of text.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/gu) ?? []) {
    for (const match of clause.matchAll(integerEquality)) {
      // A numeric tail in "3 × 4 = 12" or head in "7 = 3 + 4" is not
      // itself a standalone integer equality; do not verify it as one.
      const start = match.index ?? 0;
      const before = clause.slice(0, start);
      const after = clause.slice(start + match[0]!.length);
      if (/[+\-*/^×÷]\s*$/u.test(before) || /^\s*[+\-*/^×÷]/u.test(after)) continue;
      if (BigInt(match[1]!) === BigInt(match[2]!)) continue;
      const isDiscussedAsFalse = /(?:错(?:误|的|了)?|不成立|不相等|不对|不等于|不是|反例|假设|假如|如果|是否|吗[？?]?)/u.test(clause);
      return { verdict: isDiscussedAsFalse ? "ABSTAIN" : "FAIL", excerpt: clause.trim() };
    }
  }
  return undefined;
}

function explainsEquality(text: string): boolean {
  // Do not construct a supposed explanation from keywords in unrelated clauses.
  const clauses = (text.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/gu) ?? [])
    .map((clause) => clause.trim()).filter(Boolean);
  const windows = clauses.flatMap((clause, index) =>
    index + 1 < clauses.length ? [clause, clause + " " + clauses[index + 1]!] : [clause]);
  return windows.some((passageText) => {
  const sameOperation = /(?:两边|左右(?:两)?边|两侧|双方|每边|各边).{0,22}(?:(?:同时|都|各自|各)?(?:减(?:去|掉)?|加(?:上)?|拿走|取走|移走|去掉)|(?:同样|相同|等量).{0,10}(?:减|加|拿走|取走))/u.test(passageText);
  const equalityState = /(?:本来|原来|原本).{0,12}(?:相等|相同|一样重|平衡)|(?:仍然|依然|还是|保持).{0,10}(?:相等|相同|一样重|平衡|成立)/u.test(passageText);

  const balanceAnalogy =
    /天平|砝码|托盘|盘子/u.test(passageText) &&
    /相等|一样重|等重|平衡/u.test(passageText) &&
    /两边|左右|两侧|每边|各边/u.test(passageText) &&
    /同样|相同|等量|一样/u.test(passageText) &&
    /拿走|取走|移走|去掉|减去/u.test(passageText);

  const numericEquality =
    /(?:\d+\s*[=＝]\s*\d+).{0,55}(?:两边|左右(?:两)?边|两侧).{0,18}(?:同时|都|各自).{0,10}(?:减|加).{0,22}(?:仍然|依然|还是|保持).{0,10}(?:相等|相同|成立)/u.test(passageText);

  const guidedOneSideComparison =
    /(?:只|仅)改(?:变)?一边.{0,16}(?:还|仍然|依然)?(?:能)?相等吗/u.test(passageText) && sameOperation;

  const plainEqualityExplanation = (/(?:两边|左右(?:两)?边|等号两边).{0,18}(?:本来|原来|原本).{0,10}(?:相等|相同)|(?:等号|等式).{0,18}(?:表示|说明|意味着).{0,20}(?:两边|左右).{0,12}(?:相等|相同|数值相同)/u.test(passageText)) && sameOperation && equalityState;

  return balanceAnalogy || numericEquality || guidedOneSideComparison ||
    plainEqualityExplanation || legacyEqualityExplanation.test(passageText);

  });
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

  const numericIssue = mathStatementNeedsReview(text);
  if (numericIssue) {
    return decision(numericIssue.verdict,
      numericIssue.verdict === "FAIL"
        ? "The reply asserts an incorrect integer equality."
        : "An incorrect integer equality may be a counterexample or an assertion; review its meaning.",
      [numericIssue.excerpt]);
  }

  const oneSided = passage(text, signals.oneSidedPreservation);
  const oneSideOnly = passage(text, signals.oneSideOnly);
  const unequal = passage(text, signals.unequalSideOperations);
  if (oneSided || oneSideOnly || unequal) {
    const excerpt = oneSided ?? oneSideOnly ?? unequal;
    const explicitlyRejected = /(?:这样|这种|上述|这是|这个).{0,5}(?:不对|错误|不成立)|(?:错误|不对|不成立).{0,12}(?:做法|操作)|(?:不能|不可|不该)这样/u.test(excerpt ?? "");
    return decision(explicitlyRejected ? "ABSTAIN" : "FAIL",
      explicitlyRejected
        ? "The reply may be rejecting a one-sided operation rather than recommending it."
        : "The reply describes unequal operations on the two sides of an equation.",
      [excerpt]);
  }

  const diagnosis = passage(text, signals.unsupported);
  if (diagnosis) {
    return decision("FAIL", "The reply asserts a broader learner state than the observations support.", [diagnosis]);
  }

  const cue = passage(text, signals.conceptualHint);
  const operation = passage(text, signals.subtractThree);
  const direct = passage(text, signals.bothSidesOperation);
  const sides = passage(text, signals.bothSides);
  const attempt = passage(text, signals.independentlyTry);
  const prior = passage(text, signals.priorWork);
  const workedStep = passage(text, signals.workedStep);
  const explanation = explainsEquality(text);
  const explanationExcerpt = passage(text, /天平|砝码|托盘|盘子|等号|等式|本来相等|只改一边|\d+\s*[=＝]\s*\d+/u) ?? text;

  if (prior && !local) {
    return decision("ABSTAIN", "The reply refers to earlier work that this history does not establish.", [prior]);
  }
  if (workedStep) {
    return decision("ABSTAIN", "The reply computes the first step. Review how much meaningful work remains.", [workedStep, attempt]);
  }
  if (gap) {
    if (explanation && (attempt || direct)) {
      return decision("PASS", "The reply explains why equality is preserved, using a concrete comparison or equality statement, and leaves a step open.", [
        explanationExcerpt, operation, attempt,
      ]);
    }
    if (!explanation && (cue || direct)) {
      return decision("FAIL", "The reply repeats the inverse-operation cue or names the operation without explaining why equality is preserved.", [
        cue, operation, sides, direct,
      ]);
    }
  } else if (local && (cue || direct || prior) && attempt) {
    return decision("PASS", prior
      ? "The reply refers to the earlier local success and leaves a step for the learner."
      : "The reply is compatible with the demonstrated skill and leaves a step open. Explicit reuse of the earlier work was not detected.",
    [prior, cue, operation, sides, attempt]);
  } else if (!local && (cue || direct)) {
    return decision("PASS", "The cause of the difficulty is unknown. This first-step cue or operation gives a way to start without doing the calculation.", [
      cue, operation, sides, direct, attempt,
    ]);
  }
  return decision("ABSTAIN", "The available reply signals are insufficient to distinguish an appropriate hint from inadequate support.", [
    cue ?? operation ?? explanationExcerpt, attempt,
  ]);
}
