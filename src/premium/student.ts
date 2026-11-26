import type { Asset } from "./cards.js";
import type { Lang } from "./schema.js";
import { bool, list, positive, shape, str, unwrapJson } from "./schema.js";

const stateSchema = shape({ message: str, stage: positive, events: list(str), end: bool });
export type State = ReturnType<typeof stateSchema>;
export function studentPrompt(asset: Asset, lang: Lang) {
  const card = asset.card;
  const events = [card.fixedTest.kind, "pushback", "thanked_after_answer", ...card.conditionalBehaviours,
    ...card.scriptedMistakes.map(m => "scripted_mistake:" + m.id)];
  const instruction = lang === "en"
    ? "Return only one JSON object. message is your visible reply, stage your current integer stage, events the behaviours in this reply, end a boolean indicating departure."
    : "只输出一个 JSON 对象。message 是给导师的话，stage 是当前阶段编号，events 是本条发生的行为，end 是是否结束的布尔值。";
  return [asset.rules[lang], asset.student[lang], instruction, JSON.stringify(events)].join("\n\n");
}
export function checkStudent(raw: string, asset: Asset, lang: Lang, previous: State[], tutors: string[]) {
  const hard: string[] = [], soft: string[] = [];
  let state: State;
  const { text, unwrapped: fenceStripped } = unwrapJson(raw);
  try { state = stateSchema(JSON.parse(text), "student"); }
  catch { return { state: null, fenceStripped, hard: ["invalid_json_or_fields"], soft }; }
  const { card } = asset;
  const { message, stage, events, end } = state;
  const allowed = [card.fixedTest.kind, "pushback", "thanked_after_answer", ...card.conditionalBehaviours,
    ...card.scriptedMistakes.map(m => "scripted_mistake:" + m.id)];
  const priorEvents = previous.flatMap(s => s.events);
  if (/["'](?:stage|events|end)["']\s*:/iu.test(message)) hard.push("internal_state_in_message");
  if (events.some(e => !allowed.includes(e))) hard.push("unknown_event");
  if (events.some(e => priorEvents.includes(e)) || new Set(events).size !== events.length) hard.push("duplicate_event");
  const priorStage = previous.at(-1)!.stage;
  if (stage < priorStage || stage > priorStage + 1 || stage > card.stages.length) hard.push("invalid_stage");
  const terminal = events.filter(e => ["left", "curt_exit", "thanked_after_answer"].includes(e));
  if (terminal.length > 1 || end !== (terminal.length === 1)) hard.push("invalid_end");
  const studentMessage = previous.length + 1;
  const fixed = card.fixedTest;
  const containsText = message.includes(fixed.mustContain[lang]);
  const reported = events.includes(fixed.kind);
  if (events.includes("curt_exit") && stage < card.solvedStage) hard.push("curt_exit_unsolved");
  if (events.includes("left") && card.leaveNotBefore && studentMessage < card.leaveNotBefore) hard.push("left_too_early");
  if (containsText && studentMessage < fixed.studentMessage) hard.push("fixed_test_early");
  if (studentMessage === fixed.studentMessage && !containsText && !events.includes(fixed.skipIfEvent)) hard.push("fixed_test_missing");
  // 保留自报行为与可见文本的独立证据，包括被重写的回复。
  if (containsText && !reported) soft.push("fixed_test_event_missing");
  if (reported && !containsText) soft.push("fixed_test_event_without_text");
  if (reported && studentMessage < fixed.studentMessage) soft.push("fixed_test_event_early");
  if (reported && studentMessage > fixed.studentMessage) soft.push("fixed_test_event_late");
  if (containsText && studentMessage !== fixed.studentMessage) soft.push("fixed_test_text_wrong_turn");
  if (message.split(/\r\n|[\r\n\u2028\u2029]/u).length > 5 ||
      (lang === "en" ? message.trim().split(/\s+/u).length > 60 : [...message].length > 150)) hard.push("too_long");
  if (/扮演|学生卡|角色|prompt|role[- ]?play|this card|as an ai/iu.test(message)) hard.push("role_reference");
  const has = (text: string, words: string[]) => words.some(w => text.toLowerCase().includes(w.toLowerCase()));
  if (has(message, card.prematureIdea.studentKeywords[lang]) &&
      !tutors.some(t => has(t, card.prematureIdea.unlockedByTutorKeywords[lang]))) soft.push("premature_idea");
  for (const mistake of card.scriptedMistakes.filter(m => m.required)) {
    const key = "scripted_mistake:" + mistake.id;
    if (stage === card.solvedStage && ![...priorEvents, ...events].includes(key)) soft.push("missing:" + mistake.id);
    if (events.includes(key) && !has(message, mistake.hint[lang])) soft.push("hint_absent:" + mistake.id);
  }
  return { state, fenceStripped, hard, soft };
}
