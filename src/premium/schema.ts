// Small runtime readers shared by the card, configuration and reply boundaries.
export type Reader<T> = (value: unknown, field: string) => T;
export function invalid(field: string): never { throw new Error("Invalid premium field: " + field); }
export const str: Reader<string> = (v, f) => typeof v === "string" && v.trim() ? v : invalid(f);
export const note: Reader<string> = (v, f) => typeof v === "string" ? v : invalid(f);
export const bool: Reader<boolean> = (v, f) => typeof v === "boolean" ? v : invalid(f);
export const amount: Reader<number> = (v, f) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : invalid(f);
export const integer: Reader<number> = (v, f) => Number.isSafeInteger(v) && amount(v, f) === v ? v : invalid(f);
export const positive: Reader<number> = (v, f) => integer(v, f) > 0 ? Number(v) : invalid(f);
export const id: Reader<string> = (v, f) => {
  const s = str(v, f);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/u.test(s) || /\.$|^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/iu.test(s)) invalid(f);
  return s;
};
export function choices<const T extends string>(...options: T[]): Reader<T> {
  return (v, f) => options.find(x => x === v) ?? invalid(f);
}
export function list<T>(read: Reader<T>): Reader<T[]> {
  return (v, f) => Array.isArray(v) ? v.map((item, i) => read(item, f + "[" + i + "]")) : invalid(f);
}
export function unique<T>(items: T[], field: string): T[] {
  return new Set(items).size === items.length ? items : invalid(field);
}
export function obj(v: unknown, f: string): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : invalid(f);
}
export function shape<S extends Record<string, Reader<unknown>>>(fields: S) {
  return (value: unknown, path: string) => {
    const v = obj(value, path);
    if (Object.keys(v).some(k => !Object.hasOwn(fields, k))) invalid(path + ".unexpected_field");
    return Object.fromEntries(Object.entries(fields).map(([k, read]) => [k, read(v[k], path + "." + k)])) as
      { [K in keyof S]: ReturnType<S[K]> };
  };
}
export function optional<T>(read: Reader<T>): Reader<T | undefined> {
  return (v, f) => v === undefined ? undefined : read(v, f);
}
export function nullable<T>(read: Reader<T>): Reader<T | null> {
  return (v, f) => v === null ? null : read(v, f);
}
export const language = choices("zh-CN", "en");
export type Lang = ReturnType<typeof language>;
export const localized = <T>(read: Reader<T>) => shape({ "zh-CN": read, en: read });
