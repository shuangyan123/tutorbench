import type { MathematicsKnowledgeMap } from "./mathematics-knowledge-map.js";
import type { MathematicsExamAlignment } from "./mathematics-exam-alignment.js";

/** Experimental navigation taxonomy, not an official or globally exhaustive discipline ontology. */
export interface AcademicDisciplineSystem {
  readonly id: string;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly disciplineIds: readonly string[];
}
export interface AcademicDiscipline {
  readonly id: string;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly systemId: string;
  readonly knowledgeSystemIds: readonly string[];
}
export interface AcademicKnowledgeSystem {
  readonly id: string;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly disciplineId: string;
  readonly registryPath: string;
  readonly coverage: { readonly domains: number; readonly nodes: number };
  readonly status: "author-proposed";
}
export interface AcademicExamSystem {
  readonly id: string;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly profileIds: readonly string[];
  readonly knowledgeSystemIds: readonly string[];
  readonly status: "author-proposed-alignment";
}
export interface AcademicStructure {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "experimental-authoring";
  readonly description: string;
  readonly disciplineSystems: readonly AcademicDisciplineSystem[];
  readonly disciplines: readonly AcademicDiscipline[];
  readonly knowledgeSystems: readonly AcademicKnowledgeSystem[];
  readonly examSystems: readonly AcademicExamSystem[];
}

type Rec = Record<string, unknown>;
const obj = (value: unknown): value is Rec =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: Rec, fields: readonly string[]) =>
  Object.keys(value).length === fields.length &&
  Object.keys(value).every(key => fields.includes(key));
const phrase = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 3000;
const strings = (value: unknown, empty = false): value is string[] =>
  Array.isArray(value) && value.length <= 100 &&
  (empty || value.length > 0) && value.every(phrase) &&
  new Set(value).size === value.length;
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export function parseAcademicStructure(value: unknown): AcademicStructure {
  if (!obj(value) || !exact(value, ["schemaVersion", "id", "version", "status",
    "description", "disciplineSystems", "disciplines", "knowledgeSystems", "examSystems"]) ||
    value.schemaVersion !== 1 || value.status !== "experimental-authoring" ||
    !phrase(value.id) || !phrase(value.version) || !phrase(value.description) ||
    !Array.isArray(value.disciplineSystems) || value.disciplineSystems.length < 1 ||
    !Array.isArray(value.disciplines) || value.disciplines.length < 1 ||
    !Array.isArray(value.knowledgeSystems) || value.knowledgeSystems.length < 1 ||
    !Array.isArray(value.examSystems) || value.examSystems.length < 1)
    throw new Error("academic_structure_invalid");

  for (const system of value.disciplineSystems) {
    if (!obj(system) || !exact(system, ["id", "labelZh", "labelEn", "disciplineIds"]) ||
      !phrase(system.id) || !phrase(system.labelZh) || !phrase(system.labelEn) ||
      !strings(system.disciplineIds, true))
      throw new Error("academic_structure_invalid_system");
  }
  for (const discipline of value.disciplines) {
    if (!obj(discipline) ||
      !exact(discipline, ["id", "labelZh", "labelEn", "systemId", "knowledgeSystemIds"]) ||
      !phrase(discipline.id) || !phrase(discipline.labelZh) ||
      !phrase(discipline.labelEn) || !phrase(discipline.systemId) ||
      !strings(discipline.knowledgeSystemIds))
      throw new Error("academic_structure_invalid_discipline");
  }
  for (const knowledge of value.knowledgeSystems) {
    if (!obj(knowledge) ||
      !exact(knowledge, ["id", "labelZh", "labelEn", "disciplineId", "registryPath", "coverage", "status"]) ||
      !phrase(knowledge.id) || !phrase(knowledge.labelZh) || !phrase(knowledge.labelEn) ||
      !phrase(knowledge.disciplineId) || !phrase(knowledge.registryPath) ||
      knowledge.status !== "author-proposed" || !obj(knowledge.coverage) ||
      !exact(knowledge.coverage, ["domains", "nodes"]) ||
      !Number.isInteger(knowledge.coverage.domains) || !Number.isInteger(knowledge.coverage.nodes) ||
      (knowledge.coverage.domains as number) < 1 || (knowledge.coverage.nodes as number) < 1)
      throw new Error("academic_structure_invalid_knowledge");
  }
  for (const exam of value.examSystems) {
    if (!obj(exam) ||
      !exact(exam, ["id", "labelZh", "labelEn", "profileIds", "knowledgeSystemIds", "status"]) ||
      !phrase(exam.id) || !phrase(exam.labelZh) || !phrase(exam.labelEn) ||
      !strings(exam.profileIds) || !strings(exam.knowledgeSystemIds) ||
      exam.status !== "author-proposed-alignment")
      throw new Error("academic_structure_invalid_exam");
  }

  const parsed = value as unknown as AcademicStructure;
  if (!unique(parsed.disciplineSystems.map(x => x.id)) ||
    !unique(parsed.disciplines.map(x => x.id)) ||
    !unique(parsed.knowledgeSystems.map(x => x.id)) ||
    !unique(parsed.examSystems.map(x => x.id)))
    throw new Error("academic_structure_duplicate_identity");
  const systems = new Map(parsed.disciplineSystems.map(x => [x.id, x]));
  const disciplines = new Map(parsed.disciplines.map(x => [x.id, x]));
  const knowledge = new Map(parsed.knowledgeSystems.map(x => [x.id, x]));
  for (const d of parsed.disciplines)
    if (!systems.has(d.systemId) || !systems.get(d.systemId)!.disciplineIds.includes(d.id) ||
      d.knowledgeSystemIds.some(k => !knowledge.has(k) || knowledge.get(k)!.disciplineId !== d.id))
      throw new Error("academic_structure_discipline_link_invalid");
  for (const system of parsed.disciplineSystems)
    if (system.disciplineIds.some(id => !disciplines.has(id) || disciplines.get(id)!.systemId !== system.id))
      throw new Error("academic_structure_system_link_invalid");
  for (const k of parsed.knowledgeSystems)
    if (!disciplines.has(k.disciplineId) || !disciplines.get(k.disciplineId)!.knowledgeSystemIds.includes(k.id))
      throw new Error("academic_structure_knowledge_link_invalid");
  for (const e of parsed.examSystems)
    if (e.knowledgeSystemIds.some(k => !knowledge.has(k)))
      throw new Error("academic_structure_exam_link_invalid");
  return parsed;
}

/** The same knowledge reference may be shared by many exams; no exam owns the knowledge graph. */
export function validateAcademicStructureReferences(
  structure: AcademicStructure,
  map: MathematicsKnowledgeMap,
  examAlignment: MathematicsExamAlignment,
): void {
  const mapped = structure.knowledgeSystems.filter(k => k.id === map.id);
  if (mapped.length !== 1 || mapped[0]!.coverage.domains !== map.domains.length ||
    mapped[0]!.coverage.nodes !== map.nodes.length)
    throw new Error("academic_structure_knowledge_coverage_mismatch");
  const registered = new Set(examAlignment.profiles.map(p => p.id));
  const referenced = structure.examSystems.flatMap(e => e.profileIds);
  if (!unique(referenced) || referenced.length !== registered.size ||
    referenced.some(id => !registered.has(id)))
    throw new Error("academic_structure_exam_profile_mismatch");
  for (const e of structure.examSystems)
    if (!e.knowledgeSystemIds.includes(map.id))
      throw new Error("academic_structure_exam_knowledge_mismatch");
}
