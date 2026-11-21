import release from "./data/exam-sources-v0.8.json" with { type: "json" };
import { assessArtifactChain, type ArtifactBinding } from "./exam-artifact-chain.js";
import { resolveInternationalSources, verifyInventoryRelease } from "./exam-international-inventory.js";
import type { inspectRequirements, inspectGapRequirements } from "./exam-requirements.js";
import type { ExamSpecifications } from "./exam-specifications.js";

const evidenceKinds = ["issued-instrument", "issuer-notice", "issuer-interview", "authority-citation", "copy-inspection",
  "school-listing", "institutional-context", "transition-instrument", "exam-year-instrument", "assessment-specification",
  "pagination-audit", "rights-instrument", "digest"] as const;
type Evidence = { kind: typeof evidenceKinds[number]; location: string; locator: string };
type Claim = { field: string; value: string; evidence: string };
type Inventory = ReturnType<typeof inspectGapRequirements> | ReturnType<typeof inspectRequirements>;
const dimensions = ["jurisdiction", "track", "subject", "effectiveFrom", "effectiveThrough", "teachingIntake",
  "textbookRollout", "examSession", "examType", "provincePaper", "transitionInstrument"] as const;
type Dimension = typeof dimensions[number];

function check(value: unknown, reason: string): asserts value {
  if (!value) throw new Error("exam_governance_invalid: " + reason);
}

function locatedEvidence(item: { kind: string; locator: string }, location: string): Evidence {
  const kind = evidenceKinds.find(value => value === item.kind);
  const url = new URL(location);
  const safeLocation = (url.protocol === "https:" && !url.username && !url.password) || /^urn:sha256:[a-f0-9]{64}$/.test(location);
  check(kind && item.locator.trim() && safeLocation, "evidence locator");
  return { kind, location, locator: item.locator };
}

// 考期和教学过渡必须各自有依据；未列出的维度在输出中显式保留 unknown。
export function locateApplicability(claims: readonly Claim[], evidence: Readonly<Record<string, Evidence>>) {
  const result = Object.fromEntries(dimensions.map(field => [field, { value: "unknown", evidence: null }])) as
    Record<Dimension, { value: string; evidence: string | null }>;
  for (const claim of claims) {
    const field = claim.field as Dimension;
    const kind = evidence[claim.evidence]?.kind;
    check(Object.hasOwn(result, field) && result[field].evidence === null && kind && claim.value.trim(), "unsupported scope");
    if (["effectiveFrom", "effectiveThrough", "teachingIntake", "textbookRollout", "transitionInstrument"].includes(field))
      check(kind === "transition-instrument", "missing transition evidence");
    else if (field === "examSession" || field === "provincePaper")
      check(kind === "exam-year-instrument" || kind === "transition-instrument", "missing exam applicability evidence");
    else
      check(["issued-instrument", "issuer-interview", "copy-inspection", "exam-year-instrument", "assessment-specification"].includes(kind),
        "unrelated scope evidence");
    result[field] = { value: claim.value, evidence: claim.evidence };
  }
  return result;
}

export function assessIssuance(records: Readonly<Record<string, Evidence>>) {
  const entries = Object.entries(records).filter(([, r]) =>
    ["issued-instrument", "issuer-notice", "issuer-interview", "authority-citation"].includes(r.kind));
  const kinds = new Set(entries.map(([, r]) => r.kind));
  const confirmed = kinds.has("issued-instrument") || kinds.has("issuer-notice") ||
    (kinds.has("issuer-interview") && kinds.has("authority-citation"));
  return { status: confirmed ? "confirmed" : entries.length ? "pending" : "unknown", evidence: entries.map(([id]) => id) };
}

const instrumentRoles = ["national-curriculum", "common-standard", "state-curriculum", "state-exam-focus",
  "assessment-framework", "illustrative-task", "administered-paper"] as const;

export function checkInstrumentRole(role: string, requirementCount: number) {
  const known = instrumentRoles.find(value => value === role);
  check(known, "unknown instrument role");
  if (known === "illustrative-task" || known === "administered-paper")
    check(requirementCount === 0, "item evidence cannot supply normative leaves");
  return known;
}

type EvidenceDecision = { status: string; evidence: string | null };

export function verifyEvidenceDecision(decision: EvidenceDecision, dimension: "wholeDocument" | "fullTextReuse",
  evidence: Readonly<Record<string, Evidence>>) {
  check(Object.keys(decision).sort().join(" ") === "evidence status", "unexpected decision fields");
  if (decision.status === "unknown" || decision.status === "pending") {
    check(decision.evidence === null, "unexpected status evidence");
    return decision;
  }
  const basis = decision.evidence === null ? null : evidence[decision.evidence];
  const supported = dimension === "wholeDocument"
    ? ["complete", "incomplete"].includes(decision.status) && basis?.kind === "pagination-audit"
    : ["permitted", "restricted"].includes(decision.status) && basis?.kind === "rights-instrument";
  check(supported, "unsupported " + dimension + " decision");
  return decision;
}

type GovernanceRecord = {
  role: string;
  acquisition: { channel: string; receipt?: unknown };
  evidence: Record<string, { kind: string; location: string; locator: string }>;
  applicability: Claim[];
  inspection: string;
  wholeDocument: EvidenceDecision;
  fullTextReuse: EvidenceDecision;
};

export function assessSourceRecord(row: GovernanceRecord, source: ArtifactBinding, bytes: number | null,
  locations: { artifact: string | null; schoolListing?: string }, requirementCount: number) {
  const channel = row.acquisition.channel;
  const chain = assessArtifactChain(channel === "issuer-direct" ? { ...row.acquisition, url: locations.artifact } : row.acquisition, source);
  // 受控证据仅输出不含身份的定位符，核对者在获准访问的系统中解析。
  const location = channel === "controlled-distribution" ? null : locations.artifact;
  const evidence: Record<string, Evidence> = {};
  for (const [id, item] of Object.entries(row.evidence)) {
    let ref = item.location;
    if (ref === "artifact") ref = location ?? "urn:sha256:" + source.sha256;
    if (ref === "school-listing") {
      check(locations.schoolListing, "unresolved school listing");
      ref = locations.schoolListing;
    }
    evidence[id] = locatedEvidence(item, ref);
  }
  return {
    edition: source.edition, role: checkInstrumentRole(row.role, requirementCount), issuer: source.issuer,
    issuance: { act: source.act, ...assessIssuance(evidence) }, evidence,
    artifact: { location, channel, authentication: chain.authentication,
      authenticationStatus: chain.authentication === "verified-issuer-original" ? "verified" : "pending", chainEvidence: chain.evidence },
    integrity: { sha256: source.sha256, bytes, pages: source.pages, inspection: row.inspection,
      wholeDocumentCompleteness: verifyEvidenceDecision(row.wholeDocument, "wholeDocument", evidence) },
    access: chain.access, use: { repositoryUse: "metadata-locators-and-original-paraphrases",
      fullTextPermission: verifyEvidenceDecision(row.fullTextReuse, "fullTextReuse", evidence) },
    applicability: locateApplicability(row.applicability, evidence),
  };
}

export function inspectSourceGovernance(registry: ExamSpecifications, inventory: Inventory, input: unknown = release) {
  verifyInventoryRelease(input, "ba60b89189cf56c1a8f171f06a7cfbfcca7ac82dfad59fa058fd6ff59f95ad32", "source governance");
  check(inventory.version === release.baseInventory && "chineseRevision" in inventory && inventory.chineseRevision, "base inventory");
  const candidate = inventory.chineseRevision.candidate;
  const registered = resolveInternationalSources(registry);
  const records = release.sources.map(row => {
    const spec = registered.specifications.find(s => s.id + "@" + s.version === row.edition);
    const isCandidate = row.edition === candidate.edition;
    check(spec || isCandidate, "unregistered edition");
    const issuer = spec?.publisher ?? candidate.attributedAuthority;
    const url = spec?.url ?? candidate.url;
    const sha256 = spec?.sha256 ?? candidate.sha256;
    const binding = { issuer, act: row.act, edition: row.edition, title: isCandidate ? candidate.title : row.act,
      sha256, pages: isCandidate ? candidate.pdfPages : row.pages,
      issuerDownload: spec && row.evidence.issuance.kind === "issued-instrument" && row.evidence.issuance.location === "artifact"
        ? { url: spec.url, sha256: spec.sha256 } : null };
    const requirements = inventory.requirements.filter(r => r.source_edition === row.edition);
    const scopes = inventory.scopes.filter(s => s.source.id + "@" + s.source.version === row.edition);
    const bytes = isCandidate ? candidate.bytes : spec && "bytes" in spec ? spec.bytes : row.bytes ?? null;
    const locations = isCandidate ? { artifact: url, schoolListing: candidate.schoolListing } : { artifact: url };
    return { ...assessSourceRecord(row, binding, bytes, locations, requirements.length),
      contentReview: { boundedSections: scopes.map(s => ({ scope: s.id, status: s.inventory_status })),
        requirements: requirements.length, authorProposed: requirements.filter(r => r.alignment_status === "aligned-author-proposed").length,
        independentlyReviewed: scopes.reduce((count, s) => count + s.requirements_independently_reviewed, 0),
        editionComparisons: isCandidate ? { status: "provisional", versions: ["0.5.0", "0.6.0"] } : null } };
  });
  return { version: release.version, inventoryVersion: inventory.version,
    inventory: { requirements: inventory.unique_source_clauses, authorProposed: inventory.unique_linked_requirements,
      unmapped: inventory.requirements.filter(r => r.alignment_status === "unmapped").length,
      independentlyReviewed: inventory.scopes.reduce((count, s) => count + s.requirements_independently_reviewed, 0) },
    sourceRelationships: [{ from: registered.stateExamSource, relation: "references", to: registered.requiredCurriculum,
      locator: "NRW 2027, I, printed/PDF p. 1" }], records };
}
