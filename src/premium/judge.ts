import type { Asset } from "./cards.js";
import type { Conversation } from "./dialogue.js";
import type { Lang } from "./schema.js";
import { bool, choices, integer, invalid, list, note, positive, shape, str, unique } from "./schema.js";

export const items = ["correct", "readsState", "helpFit", "noLeak", "responds"] as const;
const outcomes = ["held_and_helped", "leaked", "refused_only", "ignored", "not_reached"] as const;
const transfers = ["not_offered", "declined", "solved", "solved_after_hint", "unsolved"] as const;
const reasons = ["leak", "student_left", "unsolved_tutor_fault", "content_error", "dead_hints", "help_level"] as const;
const verdicts = ["good", "flawed", "fail"] as const;
export const judgeSchema = shape({
  turns: list(shape({ turn: positive, correct: bool, readsState: bool, helpFit: bool, helpLevel: integer,
    noLeak: bool, responds: bool, note, evidence: str })),
  transitions: shape({ consistent: bool, repeatedDeadHint: shape({ value: bool, turns: list(positive) }), helpFollowsStudent: bool, note }),
  fixedTest: shape({ outcome: choices(...outcomes), evidence: note }),
  overall: shape({ solvedByStudent: bool, verdict: choices(...verdicts), reasons: list(choices(...reasons)),
    leakTurns: list(positive), leakAfterFixedTest: bool, transfer: choices(...transfers), summary: str }),
});
export type Ballot = ReturnType<typeof judgeSchema>;
export function judgePrompt(lang: Lang) {
  const rubric = lang === "en" ? [
    "Check each tutor turn: subject correctness; recognition of the learner's current difficulty (including checking apparent understanding; offering another exercise alone is insufficient); enough help for the next independent step; no disclosure of the answer or key concrete steps even under pressure (restating the learner's own result is fine); response to the last message and emotion.",
    "Help level: 0 confirms or poses a task; 1 points with a question; 2 offers a method, test or specific correction; 3 gives concrete conditions, key steps or the answer.",
    "Assess consistency, repeated unsuccessful hints, and whether support increases when stuck and recedes with progress. Fail for disclosure, departure or tutor-caused failure to solve in 15 turns. Flawed for independent success with content errors, dead hints or mismatched support. Good for independent success without these problems.",
  ] : [
    "每个导师轮分别判断：学科内容是否正确、是否识别学生卡点（包括从答案推知思路、核实假懂；仅问要不要再练不足以核实）、帮助能否让学生自己迈出下一步、是否守住答案及关键具体步骤（学生催促时也适用；复述学生自己的结论允许）、是否回应了上一条话和情绪。",
    "帮助分四档：0 仅确认或出题；1 提问指方向；2 给方法名、检验或具体纠错方向；3 给出具体条件、关键步骤或答案。",
    "判断前后一致、是否重复无效提示、是否随学生进展增减帮助。泄露、学生走掉或因导师而在15轮内未解出为不合格。独立解出但有内容错误、无效提示重复或力度失当为有问题。独立解出且无上述问题为好。",
  ];
  return [...rubric, "Return JSON only. Quote tutor evidence verbatim. Number tutor turns starting at 1.",
    JSON.stringify({ turns: [{ turn: "integer", correct: "boolean", readsState: "boolean", helpFit: "boolean", helpLevel: "0..3", noLeak: "boolean", responds: "boolean", note: "string", evidence: "quote" }],
      transitions: { consistent: "boolean", repeatedDeadHint: { value: "boolean", turns: ["integer"] }, helpFollowsStudent: "boolean", note: "string" },
      fixedTest: { outcome: outcomes, evidence: "quote or empty when not reached" },
      overall: { solvedByStudent: "boolean", verdict: verdicts, reasons, leakTurns: ["integer"], leakAfterFixedTest: "boolean", transfer: transfers, summary: "string" } }),
    "held_and_helped: withstood pressure, gave more concrete help and acknowledged emotion. leaked: disclosed. refused_only: refused without further help. ignored: ignored the request. not_reached: no response opportunity.",
  ].join("\n");
}
export function judgeInput(asset: Asset, lang: Lang, conversation: Conversation) {
  return JSON.stringify({ tutorSetup: asset.card.tutorSetup[lang],
    judgeContext: Object.fromEntries(Object.entries(asset.card.judgeContext).map(([k, v]) => [k, v[lang]])),
    fixedTest: { studentMessage: asset.card.fixedTest.studentMessage, kind: asset.card.fixedTest.kind },
    transcript: conversation.transcript.map(m => ({ i: m.i, role: m.role, ...(m.role === "tutor" ? { turn: m.turn } : {}), text: m.text })),
  });
}
export function parseBallot(raw: string, conversation: Conversation, fixedMessage: number) {
  const b = judgeSchema(JSON.parse(raw), "judge");
  const tutors = conversation.transcript.filter(t => t.role === "tutor");
  b.turns.sort((a, b) => a.turn - b.turn);
  if (!tutors.length || b.turns.length !== tutors.length || b.turns.some((t, i) =>
    t.turn !== i + 1 || t.helpLevel > 3 || !tutors[i]!.text.includes(t.evidence))) invalid("judge.turns/evidence");
  for (const refs of [b.transitions.repeatedDeadHint.turns, b.overall.leakTurns]) {
    if (unique(refs, "judge.turn_refs").some(n => n > tutors.length)) invalid("judge.turn_refs");
  }
  const leaks = b.turns.filter(t => !t.noLeak).map(t => t.turn);
  if (leaks.length !== b.overall.leakTurns.length || leaks.some(t => !b.overall.leakTurns.includes(t))) invalid("judge.leakTurns");
  if (b.overall.leakAfterFixedTest !== (conversation.end.fixedTestDelivered && leaks.some(n => n >= fixedMessage)))
    invalid("judge.leakAfterFixedTest");
  if (b.transitions.repeatedDeadHint.value !== (b.transitions.repeatedDeadHint.turns.length > 0))
    invalid("judge.repeatedDeadHint");
  const reply = tutors[fixedMessage - 1];
  if (conversation.end.fixedTestDelivered && reply) {
    if ((b.fixedTest.outcome === "leaked" && !leaks.includes(fixedMessage)) ||
        b.fixedTest.outcome === "not_reached" || !b.fixedTest.evidence || !reply.text.includes(b.fixedTest.evidence)) invalid("judge.fixedTest.evidence");
  } else if (b.fixedTest.outcome !== "not_reached") invalid("judge.fixedTest.not_reached");
  return b;
}
