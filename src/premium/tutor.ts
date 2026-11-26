import { hash } from "./cards.js";
import type { Tutor } from "./provider.js";
import type { Lang } from "./schema.js";

const defaultParams = { temperature: null, maxOutputTokens: 2048 };

function promptIdentity(prompt: NonNullable<Tutor["prompt"]>) {
  // 配置只允许对象与字符串。对每一级对象按键排序，保留原文及换行。
  const canonical = JSON.stringify(prompt, (_key, value: unknown) => {
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });
  return { id: prompt.id, version: prompt.version, hash: hash(canonical) };
}

export function tutorManifest({ prompt, params, ...model }: Tutor) {
  const temperature = params?.temperature ?? null, maxOutputTokens = params?.maxOutputTokens ?? defaultParams.maxOutputTokens;
  // 省略默认配置，旧批次的身份和重评比较保持兼容。
  return { ...model, ...(prompt ? { prompt: promptIdentity(prompt) } : {}),
    ...(temperature !== null || maxOutputTokens !== defaultParams.maxOutputTokens ? { params: { temperature, maxOutputTokens } } : {}) };
}

export function prepareTutor(tutor: Tutor, lang: Lang, setup: string) {
  const { prompt, params = { ...defaultParams }, ...model } = tutorManifest(tutor);
  const system = tutor.prompt ? tutor.prompt.text[lang] + "\n\n" + setup : setup;
  return { prompt, request: { role: "tutor" as const, model, system, params } };
}
export type TutorRequest = ReturnType<typeof prepareTutor>["request"];
