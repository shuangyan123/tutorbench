import { amount, choices, invalid, localized, obj, optional, positive, shape, str } from "./schema.js";
import type { Lang } from "./schema.js";

const bilingual = localized(str);
const responseFormat = shape({ type: choices("json_object") });
const protocolSchema = shape({
  schemaVersion: positive, id: str, version: str, rulesVersion: str,
  studentRequest: shape({ responseFormat, thinking: shape({ type: choices("disabled") }), temperature: amount, maxOutputTokens: positive }),
  instruction: bilingual, instructionEvents: str,
  turnNote: shape({ separator: strWithWhitespace, default: bilingual, fixedTestInjected: bilingual }),
  rewrite: shape({ joiner: strWithWhitespace, codes: (v, f) => Object.fromEntries(
    Object.entries(obj(v, f)).map(([k, item]) => [k, bilingual(item, f)])) }),
  injection: shape({ appliesWhen: str, separator: strWithWhitespace, position: choices("append"), runnerEvent: str,
    dropModelReportedRunnerEvent: choicesTrue, lengthCheck: str, echoCheckScope: optional(str) }),
  history: shape({ assistantContent: str, userContent: str, opening: str }),
});
function strWithWhitespace(v: unknown, f: string) { return typeof v === "string" && v.length ? v : invalid(f); }
function choicesTrue(v: unknown, f: string) { return v === true ? true : invalid(f); }
export type StudentProtocol = ReturnType<typeof protocolSchema> & { hash: string };
export function readProtocol(v: unknown, hash: string): StudentProtocol {
  const p = protocolSchema(v, "protocol");
  if (p.schemaVersion !== 1 || p.studentRequest.temperature !== 0.7 || p.studentRequest.maxOutputTokens !== 512 ||
      (["zh-CN", "en"] as const).some(l => !p.instruction[l].includes("{events}") ||
        !p.turnNote.default[l].includes("{k}") || !p.turnNote.fixedTestInjected[l].includes("{k}"))) invalid("protocol.contract");
  return { ...p, hash };
}
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-z]+)\}/gu, (_, key: string) => Object.hasOwn(values, key) ? String(values[key]) : invalid("protocol.placeholder"));
}
export function turnNote(p: StudentProtocol, lang: Lang, k: number, inject: boolean) {
  return p.turnNote.separator + fill((inject ? p.turnNote.fixedTestInjected : p.turnNote.default)[lang], { k });
}
