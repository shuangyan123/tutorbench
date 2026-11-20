import { readFile } from "node:fs/promises";
import { compareExamSources, parseExamSpecifications } from "../research/exam-specifications.js";
import { compareRequirementInventories, inspectGapRequirements, inspectRequirements } from "../research/exam-requirements.js";

const base = "scenarios/case-system-vnext/";
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const [graph, alignment] = await Promise.all(["mathematics-knowledge-map-v0.1", "mathematics-exam-alignment-v0.1"].map(name => read(`${base}${name}.json`)));
const args = process.argv.slice(2);
const inventory = args[0] === "--requirements";
const paths = inventory ? args.slice(1) : args;
if (paths.length > 2) throw new Error("Usage: exam:inspect [--requirements] [snapshot.json [comparison.json]]");
const load = async (path: string) => parseExamSpecifications(await read(path), graph, alignment);
const archived = `${base}exam-specifications/0.1.0.json`;
const registry = await load(inventory ? archived : paths[0] ?? archived);
if (inventory) {
  const inspect = async (path: string) => {
    const input = await read(path);
    if (input && typeof input === "object" && "version" in input && input.version === "0.3.0")
      return inspectGapRequirements(input, await read(`${base}exam-specifications/requirements-0.2.0.json`), registry, graph);
    return inspectRequirements(input, registry, graph);
  };
  const report = await inspect(paths[0] ?? `${base}exam-specifications/requirements-0.3.0.json`);
  console.log(JSON.stringify(paths[1] ? compareRequirementInventories(report, await inspect(paths[1])) : report, null, 2));
} else if (paths[1]) {
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
