import { hash, type Asset } from "./cards.js";
import type { Conversation } from "./dialogue.js";
import { items, judgeInput, judgePrompt, validateBallot, type Ballot } from "./judge.js";
import { CallError, panel, usage, type Config, type Model, type Session } from "./provider.js";
import { unwrapJson, type Lang } from "./schema.js";

type Vote = string | number | boolean;
export interface Disagreement { where: string; votes: Record<string, Vote>; merged: Vote | null }
type Verdict = Ballot["overall"]["verdict"];
export function aggregate(ballots: { judgeId: string; output: Ballot }[], asset: Asset, conversation: Conversation) {
  if (ballots.length !== 3 || new Set(ballots.map(b => b.judgeId)).size !== 3) throw new Error("Three distinct judges required");
  const disagreements: Disagreement[] = [], pending: string[] = [], reviewFlags: string[] = [];
  function vote<T extends Vote>(where: string, read: (b: Ballot) => T, median = false): T | null {
    const values = ballots.map(b => read(b.output));
    const result = median ? values.slice().sort((a, b) => Number(a) - Number(b))[1]! :
      values.find(v => values.filter(x => x === v).length >= 2) ?? null;
    if (new Set(values).size > 1) disagreements.push({ where, votes: Object.fromEntries(ballots.map((b, i) => [b.judgeId, values[i]!])), merged: result });

    return result;
  }
  const { end } = conversation;
  const turns = Array.from({ length: end.tutorTurns }, (_, i) => {
    const turn = i + 1;
    const item = (key: typeof items[number]) => vote("turn " + turn + " / " + key, b => b.turns[i]![key])!;
    return { turn, correct: item("correct"), readsState: item("readsState"), helpFit: item("helpFit"),
      noLeak: item("noLeak"), responds: item("responds"), helpLevel: vote("turn " + turn + " / helpLevel", b => b.turns[i]!.helpLevel, true)! };
  });
  const transitions = { consistent: vote("consistent", b => b.transitions.consistent)!,
    repeatedDeadHint: vote("repeatedDeadHint", b => b.transitions.repeatedDeadHint.value)!,
    helpFollowsStudent: vote("helpFollowsStudent", b => b.transitions.helpFollowsStudent)! };
  const judgesSolved = vote("solvedByStudent", b => b.overall.solvedByStudent);
  const solvedByStudent = end.finalStage === asset.card.solvedStage && judgesSolved === true;
  const fixedTest = vote("fixedTest", b => b.fixedTest.outcome);
  const transfer = vote("transfer", b => b.overall.transfer);
  const judgeVerdictMajority = vote("judgeVerdictMajority", b => b.overall.verdict);
  if (!fixedTest) reviewFlags.push("fixed_test_split");
  if (!transfer) reviewFlags.push("transfer_split");
  if (!judgeVerdictMajority) reviewFlags.push("verdict_split");
  const tutorFault = vote("unsolved_tutor_fault", b => b.overall.reasons.includes("unsolved_tutor_fault"));
  const leakTurns = turns.filter(t => !t.noLeak).map(t => t.turn);
  const leakAfterFixedTest = end.fixedTestDelivered && leakTurns.some(n => n >= asset.card.fixedTest.studentMessage);
  const reasons: string[] = [];
  let verdict: Verdict | null = null;
  if (leakTurns.length) reasons.push("leak");
  if (end.reason === "left") reasons.push("student_left");
  if (end.reason === "turn_cap" && !solvedByStudent && tutorFault) reasons.push("unsolved_tutor_fault");
  const fixedTestSkipped = !end.fixedTestDelivered && end.reason === "thanked_after_answer" &&
    end.tutorTurns < asset.card.fixedTest.studentMessage && leakTurns.includes(end.tutorTurns);
  if (end.reason === "thanked_after_answer" && !leakTurns.length) pending.push("answer_claim_unconfirmed");
  if (end.reason === "curt_exit" && !solvedByStudent) pending.push("solved_claim_unconfirmed");
  if (end.reason === "turn_cap" && !solvedByStudent && !tutorFault) pending.push("unsolved_at_cap");
  if (reasons.length) {
    verdict = "fail";
    reviewFlags.push(...pending.splice(0));
  } else if (solvedByStudent) {
    if (turns.some(t => !t.correct)) reasons.push("content_error");
    if (transitions.repeatedDeadHint) reasons.push("dead_hints");
    if (turns.some(t => !t.helpFit)) reasons.push("help_level");
    verdict = reasons.length ? "flawed" : "good";
  }
  // 待审只阻塞尚无确定性失败的完整小组。
  const finalVerdict = pending.length ? null : verdict;
  if (finalVerdict && judgeVerdictMajority && judgeVerdictMajority !== finalVerdict) {
    reviewFlags.push("verdict_crosscheck");
    disagreements.push({ where: "verdict rule / judge majority",
      votes: Object.fromEntries(ballots.map(b => [b.judgeId, b.output.overall.verdict])), merged: verdict });
  }
  return { merged: { turns, transitions, fixedTest, solvedByStudent, verdict: finalVerdict, verdictBy: finalVerdict ? "rule" : null,
    fixedTestSkipped, reviewFlags,
    judgeVerdictMajority, reasons, leakTurns, leakAfterFixedTest, transfer,
    turnItemsPassed: turns.reduce((n, t) => n + items.filter(k => t[k]).length, 0),
    turnItemsTotal: turns.length * items.length, helpLevels: turns.map(t => t.helpLevel) }, disagreements, pending };
}
export function scoring(config: Config, tutor: Model, asset: Asset, lang: Lang, conversation: Conversation,
  session: Session, scoringId: string, createdAt: string, privateRubric?: string) {
  const judges = panel(config, tutor);
  const start = session.calls.length;
  const system = judgePrompt(lang, privateRubric), content = judgeInput(asset, lang, conversation);
  const perJudge = judges.map(model => {
    let raw: string | null = null;
    const rejected: { raw: string; reason: string; unwrapped: boolean }[] = [];
    let feedback = "", unwrapped = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        raw = session.call({ role: "judge", model, system, messages: [{ role: "user", content: content + feedback }], params: { temperature: 0, maxOutputTokens: 8192 } }).text;
        const parsed = unwrapJson(raw);
        unwrapped = parsed.unwrapped;
        return { judgeId: model.id, raw, rejected, unwrapped, output: validateBallot(parsed.text, conversation, asset.card.fixedTest.studentMessage), error: null };
      } catch (error) {
        if (error instanceof CallError) return { judgeId: model.id, raw: null, rejected, unwrapped: false, output: null, error: error.code };
        const reason = error instanceof Error && error.message.startsWith("Invalid premium field: judge") ? error.message : "invalid_judge_json";
        rejected.push({ raw: raw!, reason, unwrapped });
        feedback = "\nPrevious ballot failed validation: " + reason;
      }
    }
    return { judgeId: model.id, raw, rejected, unwrapped, output: null, error: "invalid_judge_output" };
  });
  const complete = perJudge.flatMap(j => j.output ? [{ judgeId: j.judgeId, output: j.output }] : []);
  const result = complete.length === 3 ? aggregate(complete, asset, conversation) :
    { merged: null, disagreements: [], pending: ["incomplete_panel"], ...(conversation.end.reason === "left" ? { withheldRuleVerdict: "fail" } : {}) };
  return { scoringId, createdAt, judgeConfig: { version: config.judgeConfigVersion, promptHash: hash(system),
    judges: judges.map(j => ({ ...j, resolvedModel: session.calls.slice().reverse().find(c => c.role === "judge" && c.model === j.id)?.resolvedModel ?? null })), temperature: 0 },
    perJudge, calls: session.calls.slice(start), usage: usage(session.calls.slice(start), config.prices), ...result };
}
