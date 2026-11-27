import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { sha256Fingerprint, isSha256Fingerprint } from "../publication/fingerprint.js";
import { bool, choices, id, invalid, language, list, localized, optional, positive, shape, str, unique } from "./schema.js";

import { readProtocol } from "./protocol.js";

export function hash(text: string) { return sha256Fingerprint(Buffer.from(text, "utf8")); }
const strings = list(str);
const bilingual = localized(str);
const context = shape({
  problem: bilingual, referenceAnswer: bilingual, referenceSolution: bilingual,
  misconception: bilingual, leakDefinition: bilingual, transferReference: bilingual,
});
const cardSchema = shape({
  schemaVersion: positive, id, version: id, suite: str, realism: str, subject: str, source: str,
  languages: list(language), studentCard: localized(id), tutorSetup: bilingual, firstMessage: bilingual,
  judgeContext: context, stages: list(shape({ n: positive, label: bilingual })), solvedStage: positive, leaveNotBefore: optional(positive),
  fixedTest: shape({ studentMessage: positive, kind: id, mustContain: bilingual, skipIfEvent: id,
    delivery: optional(choices("model", "injected")), echoPatterns: optional(localized(strings)) }),
  scriptedMistakes: list(shape({ id, stage: optional(positive), required: bool, onlyIfTransferOffered: optional(bool), hint: localized(strings) })),
  conditionalBehaviours: list(id), prematureIdea: shape({ studentKeywords: localized(strings), unlockedByTutorKeywords: localized(strings) }),
  endMessages: localized(shape({ thanked_after_answer: str, left: str })), maxTutorTurns: positive,
});
export function parseCard(value: unknown) {
  const card = cardSchema(value, "card");
  if (card.schemaVersion !== 1 || card.realism !== "simulated") invalid("card.schemaVersion/realism");
  if (unique(card.languages, "languages").length !== 2) invalid("languages");
  if (!card.stages.length || card.stages.some((s, i) => s.n !== i + 1) || card.solvedStage > card.stages.length) invalid("stages");
  if (card.maxTutorTurns !== 15 || card.fixedTest.studentMessage < 2 || card.fixedTest.studentMessage > 15 ||
      card.fixedTest.skipIfEvent !== "thanked_after_answer") invalid("fixedTest/maxTutorTurns");
  unique(["pushback", "thanked_after_answer", card.fixedTest.kind, ...card.conditionalBehaviours], "events");
  unique(card.scriptedMistakes.map(m => m.id), "scriptedMistakes");
  if (card.scriptedMistakes.some(m => m.stage && m.stage > card.stages.length)) invalid("scriptedMistakes.stage");
  for (const lang of card.languages) {
    if (card.studentCard[lang] !== "student." + lang + ".md") invalid("studentCard");
  }
  return card;
}
export type Card = ReturnType<typeof parseCard>;
function file(dir: string, name: string) {
  const path = realpathSync(join(dir, name));
  if (dirname(path) !== realpathSync(dir)) invalid("card.path");
  const bytes = readFileSync(path);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (text.startsWith("\uFEFF") || !text.trim()) invalid("card.encoding/content");
  return text.replace(/\r\n/g, "\n");
}
const lockSchema = shape({
  schemaVersion: positive, rulesVersion: id, protocol: optional(shape({id, version: id, file: id, hash: str})), cards: list(shape({ id, version: id, contentHash: str })),
});
export function loadCards(dir: string) {
  const lock = lockSchema(JSON.parse(file(dir, "cards.lock.json")), "lock");
  if (![1, 2].includes(lock.schemaVersion) || !!lock.protocol !== (lock.schemaVersion === 2) || !lock.cards.length) invalid("lock");
  const pin = lock.protocol;
  const protocol = pin && (() => {
    if (pin.file !== "protocol.json") invalid("lock.protocol.file");
    const raw = file(dir, pin.file);
    if (hash(raw) !== pin.hash) invalid("lock.protocol.hash");
    const parsed = readProtocol(JSON.parse(raw), pin.hash);
    if (parsed.id !== pin.id || parsed.version !== pin.version || parsed.rulesVersion !== lock.rulesVersion) invalid("lock.protocol.identity");
    return parsed;
  })();
  unique(lock.cards.map(c => c.id.toLowerCase()), "lock.cards");
  const rules = { "zh-CN": file(dir, "rules.zh-CN.md"), en: file(dir, "rules.en.md") };
  return lock.cards.map(entry => {
    const folder = realpathSync(join(dir, entry.id));
    if (dirname(folder) !== realpathSync(dir)) invalid("card.path");
    const raw = file(folder, "card.json");
    const card = parseCard(JSON.parse(raw));
    if (card.fixedTest.delivery === "injected" && !protocol) invalid("card.fixedTest.protocol");
    const student = { "zh-CN": file(folder, card.studentCard["zh-CN"]), en: file(folder, card.studentCard.en) };
    const contentHash = hash(JSON.stringify([raw, student["zh-CN"], student.en, rules["zh-CN"], rules.en]));
    if (entry.id !== card.id || entry.version !== card.version || !isSha256Fingerprint(entry.contentHash) ||
        contentHash !== entry.contentHash) invalid("cards.lock.json/version/contentHash");
    return { card, student, rules, rulesVersion: lock.rulesVersion, contentHash, ...(protocol ? { protocol } : {}) };
  });
}
export type Asset = ReturnType<typeof loadCards>[number];
