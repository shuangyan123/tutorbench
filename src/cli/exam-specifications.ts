import { readFile } from "node:fs/promises";
import { compareExamSources, parseExamSpecifications } from "../research/exam-specifications.js";

const base = "scenarios/case-system-vnext/";
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const [graph, alignment] = await Promise.all(["mathematics-knowledge-map-v0.1", "mathematics-exam-alignment-v0.1"].map(name => read(`${base}${name}.json`)));
const paths = process.argv.slice(2);
if (paths.length > 2) throw new Error("Usage: exam:inspect [snapshot.json [comparison.json]]");
const load = async (path: string) => parseExamSpecifications(await read(path), graph, alignment);
const registry = await load(paths[0] ?? `${base}exam-specifications/0.1.0.json`);
if (paths[1]) {
  console.log(JSON.stringify(compareExamSources(registry, await load(paths[1])), null, 2));
} else {
  const evidence = registry.specifications.flatMap(spec => spec.clauses.map(clause => {
    const key = `${spec.id}@${spec.version}`;
    const mappings = registry.mappings.filter(mapping => mapping.spec === key && mapping.clause === clause.id);
    return { spec: key, exams: spec.exams, jurisdiction: spec.jurisdiction, session: spec.session, paper: spec.paper,
      source: spec.url, sha256: spec.sha256, ...clause, mappings, status: mappings.length ? "author-proposed" : "unmapped" };
  }));
  console.log(JSON.stringify({ version: registry.version, graph: registry.graph, exams: registry.exams,
    landOverlays: registry.landOverlays, locatedClauses: evidence.length, totalOfficialRequirements: null, evidence }, null, 2));
}
