import { createHash } from "node:crypto";
import supplement from "../../scenarios/case-system-vnext/exam-specifications/sources-0.7.0.json" with { type: "json" };
import manifest from "./data/exam-enumeration-v3.json" with { type: "json" };
import { expandedEnumerationScopes } from "./exam-inventory-scopes.js";
import type { ExamSpecifications } from "./exam-specifications.js";

export function verifyInventoryRelease(value: unknown, sha256: string, name: string) {
  if (createHash("sha256").update(JSON.stringify(value)).digest("hex") !== sha256)
    throw new Error("changed international inventory " + name);
}

export function resolveInternationalSources(registry: ExamSpecifications, input: unknown = supplement) {
  verifyInventoryRelease(input, "c6f3e439de53e0bf61d665f241caa0ec8f4b6600906c49079f5448e0f27139e4", "sources");
  if (registry.version !== supplement.baseRegistry) throw new Error("international inventory base registry");
  const additions = structuredClone(supplement);
  const landStatus = registry.landOverlays.jurisdictions.map(jurisdiction => ({ jurisdiction,
    status: jurisdiction === additions.stateExam.jurisdiction ? "partial" : "pending",
    session: jurisdiction === additions.stateExam.jurisdiction ? additions.stateExam.session : null }));
  return { ...registry, ...additions, landOverlays: { ...registry.landOverlays, status: "partial", byJurisdiction: landStatus },
    exams: [...registry.exams.map(exam => exam.id === "us-sat-math" ? { ...exam, status: "partial" } : exam), additions.stateExam],
    specifications: [...registry.specifications, ...additions.specifications] };
}

export function internationalInventoryContext(registry: ExamSpecifications, sources: unknown = supplement, enumeration: unknown = manifest) {
  const resolved = resolveInternationalSources(registry, sources);
  verifyInventoryRelease(enumeration, "d42f950378a4c438fc09217dd7af1599fda1ed8f802558b930336aa5b1ae7948", "manifest");
  const historical = expandedEnumerationScopes(registry);
  const sourceEditions = [...historical.map(s => s.source), ...resolved.specifications];
  const editions = new Map(sourceEditions.map(source => [source.id + "@" + source.version, source]));
  const locations = new Map<string, { printedPage: number; pdfPage: number; kind: string }>();
  const scopes = manifest.scopes.map(({ pages, sourceKey, ...scope }) => {
    const source = editions.get(sourceKey);
    if (!source) throw new Error("unregistered inventory source: " + sourceKey);
    const anchors = pages.flatMap(page => page.anchors.map(anchor => {
      const id = scope.id + "/" + anchor;
      if (locations.has(id)) throw new Error("duplicate inventory location: " + id);
      locations.set(id, { printedPage: page.printedPage, pdfPage: page.pdfPage, kind: scope.kind });
      return anchor;
    }));
    return { ...scope, source, anchors, correction: null };
  });
  return { supplement: structuredClone(supplement), scopes: [...historical, ...scopes], locations,
    exams: resolved.exams,
    crosswalks: manifest.crosswalks.map(row => ({ ...row, kind: "author-proposed-semantic-crosswalk",
      review: "author-proposed-pending-independent-review" })),
    landStatus: resolved.landOverlays.byJurisdiction,
  };
}
