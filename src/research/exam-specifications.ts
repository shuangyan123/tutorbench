import { parseMathematicsExamAlignment } from "../contracts/mathematics-exam-alignment.js";
import { parseMathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`exam_specification_invalid: ${message}`);
}
function record(input: unknown, fields: string): Record<string, unknown> {
  check(typeof input === "object" && input !== null && !Array.isArray(input), "expected object");
  const keys = fields.split(" ");
  check(keys.length === Object.keys(input).length && keys.every(key => Object.hasOwn(input, key)), fields);
  return input as Record<string, unknown>;
}
function list(value: unknown) {
  check(Array.isArray(value) && value.length <= 512, "expected bounded list");
  return value as unknown[];
}
function text(value: unknown, pattern?: RegExp) {
  check(typeof value === "string" && value.trim().length && value.length <= 1000 && (!pattern || pattern.test(value)), "text");
  return value;
}
const id = (value: unknown) => text(value, /^[a-z][a-z0-9-]*$/);
function date(value: unknown) {
  const day = text(value, /^\d{4}-\d{2}-\d{2}$/);
  check(new Date(day).toJSON()?.slice(0, 10) === day, "calendar date");
  return day;
}
function period(value: unknown) {
  if (value === null) return null;
  const obj = record(value, "from through");
  const term = (raw: unknown) => text(raw, /^\d{4}-(spring|fall)$/);
  const from = term(obj.from);
  const through = obj.through === null ? null : term(obj.through);
  const rank = (termValue: string) => Number(termValue.slice(0, 4)) * 2 + Number(termValue.endsWith("fall"));
  check(through === null || rank(from) <= rank(through), "inverted teaching period");
  return { from, through };
}
function unique(values: readonly string[], name: string) {
  check(new Set(values).size === values.length, `duplicate ${name}`);
}
const landCodes = "BB BE BW BY HB HE HH MV NI NW RP SH SL SN ST TH".split(" ").map(code => `DE-${code}`);
const sourceScopes = {
  "www.zjzs.net": { scope: "national-paper", kind: "item-evidence" },
  "www.kmk.org": { scope: "common-framework", kind: "curriculum-requirement" },
  "apcentral.collegeboard.org": { scope: "subject-assessment", kind: "assessment-framework" },
} as const;

function parseExam(input: unknown, profiles: ReadonlySet<string>) {
  const row = record(input, "id jurisdiction provider subject scope session profile status");
  const examId = id(row.id);
  const jurisdiction = text(row.jurisdiction);
  const scope = text(row.scope);
  const session = row.session;
  const nationalPaper = examId === "cn-gaokao";
  const scopes: Record<string, string> = {
    "cn-kaoyan-i": "graduate-subject", "cn-kaoyan-ii": "graduate-subject", "cn-kaoyan-iii": "graduate-subject",
    "cn-guokao-xingce": "public-subject", "cn-guokao-shenlun": "public-subject", "cn-guokao-post": "post-specific",
    "de-abitur": "common-framework", "us-ap-calculus-ab": "subject-assessment", "us-ap-calculus-bc": "subject-assessment",
    "us-sat-math": "admissions-assessment",
  };
  if (nationalPaper) {
    check(jurisdiction === "CN-ZJ" && scope === "全国一卷" && typeof session === "number" && Number.isInteger(session) && session >= 2000 && session <= 2100, "paper/province/year");
  } else {
    check(scopes[examId] === scope && jurisdiction === examId.slice(0, 2).toUpperCase() && session === null, "exam scope");
  }
  const profile = row.profile === null ? null : id(row.profile);
  check(profile === null || profiles.has(profile), "legacy profile");
  check(row.status === "partial" || row.status === "pending", "exam status");
  return { id: examId, jurisdiction, provider: text(row.provider), subject: text(row.subject), scope, session, profile, status: row.status };
}

function parseSpec(input: unknown, exams: ReturnType<typeof parseExam>[]) {
  const row = record(input, "id version exams jurisdiction session paper publisher publicationDate effectiveTeachingPeriod url retrievedAt sha256 reuse clauses");
  const url = new URL(text(row.url));
  check(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && Object.hasOwn(sourceScopes, url.hostname), "official URL");
  const policy = sourceScopes[url.hostname as keyof typeof sourceScopes];
  const targets = list(row.exams).map(id).sort();
  unique(targets, "target");
  check(targets.length, "missing exam");
  const jurisdiction = text(row.jurisdiction);
  for (const target of targets) {
    const exam = exams.find(item => item.id === target);
    check(exam && exam.status === "partial" && jurisdiction === exam.jurisdiction && row.session === exam.session, "exam applicability");
    check(policy.scope === "national-paper" ? exam.id === "cn-gaokao" && row.paper === exam.scope : exam.scope === policy.scope && row.paper === null, "source/track mismatch");
  }
  const publicationDate = row.publicationDate === null ? null : date(row.publicationDate);
  const retrievedAt = date(row.retrievedAt);
  check(publicationDate === null || publicationDate <= retrievedAt, "publication after retrieval");
  check(row.reuse === "metadata-and-paraphrase-only", "reuse");
  const clauses = list(row.clauses).map(value => {
    const clause = record(value, "id locator kind requirement skill");
    check(clause.kind === policy.kind, "wrong evidence kind");
    return { id: id(clause.id), locator: text(clause.locator), kind: policy.kind, requirement: text(clause.requirement), skill: text(clause.skill) };
  });
  unique(clauses.map(clause => clause.id), "clause");
  check(clauses.length > 0, "no located clauses");
  return { id: id(row.id), version: text(row.version, /^\d+\.\d+$/), exams: targets, jurisdiction, session: row.session,
    paper: row.paper, publisher: text(row.publisher), publicationDate, effectiveTeachingPeriod: period(row.effectiveTeachingPeriod),
    url: url.href, retrievedAt, sha256: text(row.sha256, /^[a-f0-9]{64}$/), reuse: row.reuse, clauses };
}

export function parseExamSpecifications(input: unknown, graphInput: unknown, alignmentInput: unknown) {
  const graph = parseMathematicsKnowledgeMap(graphInput);
  const alignment = parseMathematicsExamAlignment(alignmentInput);
  const row = record(input, "schemaVersion version graph alignment exams landOverlays specifications mappings");
  check(row.schemaVersion === 1 && row.graph === `${graph.id}@${graph.version}` && row.alignment === `${alignment.id}@${alignment.version}`, "stale graph or profile registry");
  const version = text(row.version, /^\d+\.\d+\.\d+$/);
  const profiles = new Set(alignment.profiles.map(profile => profile.id));
  const exams = list(row.exams).map(exam => parseExam(exam, profiles));
  unique(exams.map(exam => exam.id), "exam");
  const land = record(row.landOverlays, "parent status jurisdictions");
  const jurisdictions = list(land.jurisdictions).map(value => text(value)).sort();
  check(land.parent === "de-abitur" && exams.some(exam => exam.id === land.parent) && land.status === "pending" && jurisdictions.join() === landCodes.join(), "Land overlays");
  const specifications = list(row.specifications).map(value => parseSpec(value, exams));
  unique(specifications.map(spec => `${spec.id}@${spec.version}`), "specification version");
  const concepts = new Map(graph.nodes.map(node => [node.id, node.label]));
  const mappings = list(row.mappings).map(value => {
    const mapping = record(value, "spec clause concept evidence review");
    const spec = specifications.find(entry => `${entry.id}@${entry.version}` === mapping.spec);
    const clause = spec?.clauses.find(entry => entry.id === mapping.clause);
    const concept = id(mapping.concept);
    check(spec && clause && concepts.has(concept), "unresolved citation or concept");
    check(mapping.review === "author-proposed" && mapping.evidence === "clause-located", "unsupported evidence promotion");
    return { spec: `${spec.id}@${spec.version}`, clause: clause.id, concept, evidence: mapping.evidence, review: mapping.review };
  });
  unique(mappings.map(mapping => `${mapping.spec}/${mapping.clause}/${mapping.concept}`), "mapping");
  for (const exam of exams) {
    check((exam.status === "partial") === specifications.some(spec => spec.exams.includes(exam.id) && mappings.some(mapping => mapping.spec === `${spec.id}@${spec.version}`)), "partial without mapping");
  }
  return { version, graph: row.graph, alignment: row.alignment, exams, landOverlays: { parent: land.parent, status: land.status, jurisdictions }, specifications, mappings };
}

export type ExamSpecifications = ReturnType<typeof parseExamSpecifications>;

/** 比较固定快照的文件字节指纹，不将文件变化解释为要求或难度变化。 */
type FingerprintedSources = { specifications: ReadonlyArray<{ id: string; version: string; sha256: string }> };
export function compareExamSources(before: FingerprintedSources, after: FingerprintedSources) {
  const index = (registry: FingerprintedSources) => new Map(registry.specifications.map(spec => [`${spec.id}@${spec.version}`, spec.sha256]));
  const previous = index(before);
  const next = index(after);
  return [...new Set([...previous.keys(), ...next.keys()])].sort().filter(key => previous.get(key) !== next.get(key))
    .map(key => ({ spec: key, before: previous.get(key) ?? null, after: next.get(key) ?? null }));
}
