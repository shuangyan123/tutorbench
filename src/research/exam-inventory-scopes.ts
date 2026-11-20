import { createHash } from "node:crypto";
import manifest from "./data/exam-enumeration-v1.json" with { type: "json" };
import expansion from "./data/exam-enumeration-v2.json" with { type: "json" };
import type { ExamSpecifications } from "./exam-specifications.js";

export const graduateBook = {
  edition: "2027", publisher: "高等教育出版社", authority: "教育部教育考试院",
  isbn: "978-7-04-068404-9", publicationMonth: "2026-09", retrievedAt: "2026-11-20",
  url: "https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6aa1910be119ac97297a608f",
  catalogueSha256: "5e6193f612d776a0d29bb1a1fbce0433921a1bfa80d388588ccf9a4585ecec3e",
  outlineSha256: null, reuse: "catalogue metadata only",
};

// v1 是已归档的封闭清单；更改范围、锚点或适用届次需要另起版本。
export function enumerationScopes(registry: ExamSpecifications, input: unknown = manifest) {
  if (createHash("sha256").update(JSON.stringify(input)).digest("hex") !==
    "45bd41b4495a813502e3889f00f7ad00ff44f7f2e4d27c1dea54eb212dc64a7d") throw new Error("inventory manifest v1 mismatch");
  return manifest.scopes.map(scope => {
    if (!scope.source.registryKey) return { ...scope, source: scope.source };
    const spec = registry.specifications.find(entry => entry.id + "@" + entry.version === scope.source.registryKey);
    if (!spec || spec.sha256 !== scope.source.sha256) throw new Error("inventory source edition mismatch");
    const { id, version, publisher, url, sha256, retrievedAt, effectiveTeachingPeriod, reuse } = spec;
    return { ...scope, source: { id, version, publisher, url, sha256, retrievedAt, effectiveTeachingPeriod, reuse } };
  });
}

export function expandedEnumerationScopes(registry: ExamSpecifications, input: unknown = expansion) {
  if (createHash("sha256").update(JSON.stringify(input)).digest("hex") !==
    "21c1e96e823bba1c2d93b5317cabc3ff5974765c554f63faa136acde011a7f63") throw new Error("inventory manifest v2 mismatch");
  const baseline = enumerationScopes(registry);
  const additions = expansion.scopes.map(({ sourceScope, ...section }) => {
    const origin = baseline.find(scope => scope.id === sourceScope);
    if (!origin) throw new Error("missing scope for source edition and applicability");
    return { ...origin, ...section };
  });
  return [...baseline, ...additions];
}

export const sourceObservations = expansion.sourceObservations;

export const legacyClauses: Readonly<Record<string, string>> = {
  "de-l4-common/03": "l4-rate", "us-topic-2-1/CHA-2.B.1": "cha-2-b-1",
};
