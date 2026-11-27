import type { Asset } from "./cards.js";
import type { Lang } from "./schema.js";
import { fill } from "./protocol.js";
import { bool, list, positive, shape, str, unwrapJson } from "./schema.js";

const stateSchema = shape({ message: str, stage: positive, events: list(str), end: bool });
export type State = ReturnType<typeof stateSchema>;
export function studentPrompt(asset: Asset, lang: Lang) {
  const card = asset.card;
  const events = [...(card.fixedTest.delivery === "injected" ? [] : [card.fixedTest.kind]), "pushback", "thanked_after_answer", ...card.conditionalBehaviours,
    ...card.scriptedMistakes.map(m => "scripted_mistake:" + m.id)];
  if (asset.protocol) return [asset.rules[lang], asset.student[lang],
    fill(asset.protocol.instruction[lang], { events: JSON.stringify(events) })].join("\n\n");
  const instruction = lang === "en"
    ? "Return only one JSON object. message is your visible reply, stage your current integer stage, events the behaviours in this reply, end a boolean indicating departure."
    : "只输出一个 JSON 对象。message 是给导师的话，stage 是当前阶段编号，events 是本条发生的行为，end 是是否结束的布尔值。";
  return [asset.rules[lang], asset.student[lang], instruction, JSON.stringify(events)].join("\n\n");
}
export function checkStudent(raw: string | null, asset: Asset, lang: Lang, previous: State[], tutors: string[]) {
  const hard: string[] = [], soft: string[] = [];
  let state: State;
  if (asset.protocol && !raw?.trim()) return { state: null, fenceStripped: false, hard: ["empty_response"], soft };
  const { text, unwrapped: fenceStripped } = unwrapJson(raw ?? "");
  try { state = stateSchema(JSON.parse(text), "student"); }
  catch { return { state: null, fenceStripped, hard: ["invalid_json_or_fields"], soft }; }
  const { card } = asset;
  const { message, stage, end } = state;
  const injected = card.fixedTest.delivery === "injected";
  const events = injected ? state.events.filter(e => e !== card.fixedTest.kind) : state.events;
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
  if (containsText && (studentMessage < fixed.studentMessage || (injected && studentMessage > fixed.studentMessage))) hard.push("fixed_test_early");
  if (injected && studentMessage === fixed.studentMessage && !end) {
    if (containsText) hard.push("fixed_test_self_written");
    if (fixed.echoPatterns?.[lang].some(pattern => lang === "en" ? message.toLowerCase().includes(pattern.toLowerCase()) : message.includes(pattern))) hard.push("fixed_test_echo");
  }
  if (!injected && studentMessage === fixed.studentMessage && !containsText && !events.includes(fixed.skipIfEvent)) hard.push("fixed_test_missing");
  // 保留自报行为与可见文本的独立证据，包括被重写的回复。
  if (!injected) {
    if (containsText && !reported) soft.push("fixed_test_event_missing");
    if (reported && !containsText) soft.push("fixed_test_event_without_text");
    if (reported && studentMessage < fixed.studentMessage) soft.push("fixed_test_event_early");
    if (reported && studentMessage > fixed.studentMessage) soft.push("fixed_test_event_late");
    if (containsText && studentMessage !== fixed.studentMessage) soft.push("fixed_test_text_wrong_turn");
  }
  const finalText = finalStudentText(asset, lang, studentMessage, state);
  if (finalText.split(/\r\n|[\r\n\u2028\u2029]/u).length > 5 ||
      (lang === "en" ? finalText.trim().split(/\s+/u).length > 60 : [...finalText].length > 150)) hard.push("too_long");
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

export function finalStudentText(asset: Asset, lang: Lang, k: number, state: State) {
  const fixed = asset.card.fixedTest;
  return fixed.delivery === "injected" && k === fixed.studentMessage && !state.end
    ? state.message + asset.protocol!.injection.separator + fixed.mustContain[lang] : state.message;
}
export function rewriteFeedback(asset: Asset, lang: Lang, previous: State[], codes: string[]) {
  const p = asset.protocol;
  if (!p) return "Rewrite: " + codes.join(", ");
  const card = asset.card, k = previous.length + 1, prev = previous.at(-1)!.stage;
  const injected = card.fixedTest.delivery === "injected" && k === card.fixedTest.studentMessage;
  const values = { prev, next: prev + 1, max: card.stages.length, k, min: card.leaveNotBefore ?? 1,
    at: card.fixedTest.studentMessage, fixed: card.fixedTest.mustContain[lang], lines: injected ? 4 : 5,
    limit: lang === "en" ? (injected ? 49 : 60) : (injected ? 130 : 150) };
  return codes.map(code => {
    const template = p.rewrite.codes[code]?.[lang];
    if (!template) throw new Error("Invalid premium field: protocol.rewrite.code");
    return fill(template, values);
  }).join(p.rewrite.joiner);
}
export type ObservedFormat = "json" | "fenced_json" | "text" | "empty" | "truncated";
export function observedFormat(raw: string | null, finishReason: string): ObservedFormat {
  if (!raw?.trim()) return "empty";
  if (finishReason === "length") return "truncated";
  const { text, unwrapped } = unwrapJson(raw);
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return unwrapped ? "fenced_json" : "json";
  } catch { /* 非 JSON 留给重写检查。 */ }
  return "text";
}
