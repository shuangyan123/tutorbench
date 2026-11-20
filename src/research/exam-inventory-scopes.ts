import type { ExamSpecifications } from "./exam-specifications.js";

export const graduateBook = {
  edition: "2027", publisher: "高等教育出版社", authority: "教育部教育考试院",
  isbn: "978-7-04-068404-9", publicationMonth: "2026-09", retrievedAt: "2026-11-20",
  url: "https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6aa1910be119ac97297a608f",
  catalogueSha256: "5e6193f612d776a0d29bb1a1fbce0433921a1bfa80d388588ccf9a4585ecec3e",
  outlineSha256: null, reuse: "catalogue metadata only",
};

const curriculum = {
  id: "cn-moe-high-school-math", version: "2020.1", publisher: "中华人民共和国教育部",
  url: "https://www.ictr.edu.cn/Uploads/File/2025/02/07/3.%E6%99%AE%E9%80%9A%E9%AB%98%E4%B8%AD%E6%95%B0%E5%AD%A6%E8%AF%BE%E7%A8%8B%E6%A0%87%E5%87%86%EF%BC%882017%E5%B9%B4%E7%89%882020%E5%B9%B4%E4%BF%AE%E8%AE%A2%EF%BC%89.20250207213419.pdf",
  sha256: "cc4d3a20daa09f5185037e93fbacd58f7df1147392e3dae4bf261c3700ba4195", retrievedAt: "2026-11-20",
  effectiveTeachingPeriod: null, reuse: "metadata-and-paraphrase-only",
};

export const apCorrection = {
  url: "https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-bc-course-and-exam-description-clarifications.pdf",
  sha256: "915d8bdfd3234810715848588e71197324addbc5e048c2a66a23a33be90124af", retrievedAt: "2026-11-20",
  locator: "Effective Fall 2026, pp. 1–2, Unit Guides and Exam Information",
};

function fromRegistry(registry: ExamSpecifications, key: string, digest: string) {
  const spec = registry.specifications.find(entry => entry.id + "@" + entry.version === key);
  if (!spec || spec.sha256 !== digest) throw new Error("inventory source edition mismatch");
  const { id, version, publisher, url, sha256, retrievedAt, effectiveTeachingPeriod, reuse } = spec;
  return { id, version, publisher, url, sha256, retrievedAt, effectiveTeachingPeriod, reuse };
}

// 锚点来自逐节核对的原文目录，不从已录入或已映射的行推导分母。
export function enumerationScopes(registry: ExamSpecifications) {
  return [
    { id: "cn-logic", exams: ["cn-gaokao"], jurisdiction: "CN", session: null, entryCohort: null,
      source: curriculum, kind: "curriculum-requirement", correction: null,
      parent: "IV / compulsory / theme 1 / content requirements / 2. 常用逻辑用语",
      unit: "numbered statement, or sole unnumbered statement in subsection (2)",
      excludes: "teaching suggestions, other sections, paper selection and all session-specific blueprints",
      anchors: ["1.1", "1.2", "1.3", "2", "3.1", "3.2"] },
    { id: "de-l4-common", exams: ["de-abitur"], jurisdiction: "DE", session: null, entryCohort: null,
      source: fromRegistry(registry, "kmk-ahr-math@2012.1", "a636ec6947dca2044618787a9e29116d88f68909d02e4547050e4d3fc9c77546"),
      kind: "curriculum-requirement", correction: null,
      parent: "Printed p. 20 / L4 / Grundlegendes und erhöhtes Anforderungsniveau",
      unit: "bullet ordinal within the common list",
      excludes: "additional elevated-level list, other Leitideen, IQB items and Land implementations",
      anchors: Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")) },
    { id: "us-topic-2-1", exams: ["us-ap-calculus-ab", "us-ap-calculus-bc"], jurisdiction: "US", session: 2027, entryCohort: null,
      source: fromRegistry(registry, "ap-calculus-ced@2020.1", "fd571cdc252c24d33a75ed556ee20d9261ef1ad3dbb718d0caf78acecc8253ca"),
      kind: "assessment-framework", correction: apCorrection,
      parent: "Printed p. 55 / Unit 2 / Topic 2.1 / Essential Knowledge", unit: "EK code",
      excludes: "learning-objective parents, suggested skills, other topics, exam format and SAT",
      anchors: ["CHA-2.A.1", "CHA-2.B.1"] },
  ];
}

export const legacyClauses: Readonly<Record<string, string>> = {
  "de-l4-common/03": "l4-rate", "us-topic-2-1/CHA-2.B.1": "cha-2-b-1",
};
