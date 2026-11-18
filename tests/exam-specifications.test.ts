import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compareExamSources, parseExamSpecifications } from "../src/research/exam-specifications.js";

const base = "scenarios/case-system-vnext/";
const path = `${base}exam-specifications/0.1.0.json`;
const read = (file: string): unknown => JSON.parse(readFileSync(file, "utf8")) as unknown;
const graph = read(`${base}mathematics-knowledge-map-v0.1.json`);
const alignment = read(`${base}mathematics-exam-alignment-v0.1.json`);
const parse = (input: unknown) => parseExamSpecifications(input, graph, alignment);
const initial = parse(read(path));

test("archived v0.1.0 citations, scopes and digests cannot change silently", () => {
  const digest = createHash("sha256").update(JSON.stringify(read(path))).digest("hex");
  assert.equal(digest, "f44390ac70256ba15ea6deda20ba2d1344ff02c08f70d0e0b547167cd5dc74a3");
});

test("offline CLI joins three located clauses, not three official coverage claims", () => {
  const inspect = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js", ...args], { encoding: "utf8" });
  const report = inspect();
  assert.equal(report, inspect(path));
  assert.match(report, /"locatedClauses": 3/);
  assert.match(report, /"totalOfficialRequirements": null/);
  assert.equal(inspect(path, path), "[]\n");
  assert.deepEqual(initial.mappings.map(mapping => [mapping.clause, mapping.concept]), [
    ["q18", "coordinate-geometry"], ["l4-rate", "derivatives-rate"], ["cha-2-b-1", "derivatives-rate"],
  ]);
  assert.equal(initial.exams.length, 11);
  assert.equal(initial.exams.filter(exam => exam.status === "pending").length, 7);
  assert.equal(initial.landOverlays.jurisdictions.length, 16);
});

test("invalid pins, dangling citations, scope changes and promotions fail closed", () => {
  type Row = Record<string, unknown>;
  const edits: Array<[string, (rows: Row[]) => void]> = [
    ["mappings", rows => { rows[0]!.spec = "zj-paper-i-analysis@2024.1"; }],
    ["mappings", rows => { rows[0]!.clause = "cha-2-b-1"; }],
    ["mappings", rows => { rows[0]!.concept = "derivatives-invented"; }],
    ["mappings", rows => { rows[0]!.review = "independent"; }],
    ["specifications", rows => { (rows[0]!.clauses as Row[])[0]!.locator = ""; }],
    ["specifications", rows => { (rows[0]!.clauses as Row[])[0]!.kind = "curriculum-requirement"; }],
    ["specifications", rows => { rows[0]!.jurisdiction = "CN"; }],
    ["specifications", rows => { rows[0]!.session = 2026; }],
    ["specifications", rows => { rows[0]!.paper = "全国二卷"; }],
    ["specifications", rows => { rows[0]!.url = "https://www.kmk.org.evil.invalid/paper"; }],
    ["specifications", rows => { rows[2]!.exams = ["us-sat-math"]; }],
    ["specifications", rows => { rows[0]!.publicationDate = "2025-02-30"; }],
    ["specifications", rows => { rows[2]!.effectiveTeachingPeriod = { from: "2020-fall", through: "2020-spring" }; }],
    ["exams", rows => { rows[7]!.scope = "nationwide-paper"; }],
    ["exams", rows => { rows[10]!.scope = "national-admission"; }],
    ...["exams", "specifications", "mappings"].map((field): [string, (rows: Row[]) => void] => [field, rows => { rows.push(rows[0]!); }]),
  ];
  for (const [field, edit] of edits) {
    const raw = read(path) as Row;
    edit(raw[field] as Row[]);
    assert.throws(() => parse(raw), /exam_specification_invalid/, field);
  }
  for (const field of ["graph", "alignment"]) assert.throws(() => parse({ ...initial, schemaVersion: 1, [field]: "stale" }), /stale/);
  const raw = read(path) as Row;
  (raw.landOverlays as Row).jurisdictions = Array<string>(16).fill("DE-BY");
  assert.throws(() => parse(raw), /Land overlays/);
});

test("synthetic new edition can coexist with the old one; source diff is ordered and repeatable", () => {
  const next = structuredClone(initial);
  const old = next.specifications[0]!;
  next.specifications.push({ ...old, version: "2025.2", sha256: "1".repeat(64) });
  next.specifications.reverse();
  const parsed = parse({ ...next, schemaVersion: 1, version: "0.2.0" });
  const expected = [{ spec: "zj-paper-i-analysis@2025.2", before: null, after: "1".repeat(64) }];
  assert.deepEqual(compareExamSources(initial, parsed), expected);
  assert.deepEqual(compareExamSources(parse(read(path)), parsed), expected);
  assert.ok(parsed.specifications.some(spec => spec.version === "2025.1" && spec.sha256 === old.sha256));
  assert.equal(parsed.mappings[0]!.spec, "zj-paper-i-analysis@2025.1");
});
