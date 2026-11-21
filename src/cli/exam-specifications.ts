import { readFile } from "node:fs/promises";
import { compareExamSources, parseExamSpecifications } from "../research/exam-specifications.js";
import { inspectCurriculumRevision } from "../research/exam-edition-comparison.js";
import { inspectAssessmentGuidance } from "../research/exam-assessment-guidance.js";
import { resolveInternationalSources } from "../research/exam-international-inventory.js";
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
const registry = await load(archived);
if (inventory) {
  const inspect = async (path: string) => {
    const input = await read(path);
    if (input && typeof input === "object" && "version" in input && ["0.3.0", "0.4.0", "0.7.0"].includes(String(input.version))) {
      const previous = await read(`${base}exam-specifications/requirements-0.2.0.json`);
      if (input.version === "0.3.0") return inspectGapRequirements(input, previous, registry, graph);
      const gap = await read(`${base}exam-specifications/requirements-0.3.0.json`);
      if (input.version === "0.7.0") return inspectGapRequirements(gap, previous, registry, graph, await read(current), input);
      return inspectGapRequirements(gap, previous, registry, graph, input);
    }
    return inspectRequirements(input, registry, graph);
  };
  const current = `${base}exam-specifications/requirements-0.4.0.json`;
  if (paths[0] === "--edition-diff") {
    if (paths[1] !== undefined && paths[1] !== "assessment-guidance") throw new Error("Unknown --edition-diff scope");
    const baseline = await inspect(current);
    console.log(JSON.stringify(paths[1] ? inspectAssessmentGuidance(baseline) : inspectCurriculumRevision(baseline), null, 2));
  } else {
    const report = await inspect(paths[0] ?? current);
    console.log(JSON.stringify(paths[1] ? compareRequirementInventories(report, await inspect(paths[1])) : report, null, 2));
  }
} else {
  const sourceSnapshot = async (path: string) => {
    if (path === archived) return registry;
    const input = await read(path);
    if (input && typeof input === "object" && "baseRegistry" in input) return resolveInternationalSources(registry, input);
    return parseExamSpecifications(input, graph, alignment);
  };
  const selected = await sourceSnapshot(paths[0] ?? archived);
  if (paths[1]) {
    console.log(JSON.stringify(compareExamSources(selected, await sourceSnapshot(paths[1])), null, 2));
  } else if ("baseRegistry" in selected) {
    console.log(JSON.stringify(selected, null, 2));
  } else {
    const evidence = selected.specifications.flatMap(spec => spec.clauses.map(clause => {
      const key = `${spec.id}@${spec.version}`;
      const mappings = selected.mappings.filter(mapping => mapping.spec === key && mapping.clause === clause.id);
      return { spec: key, exams: spec.exams, jurisdiction: spec.jurisdiction, session: spec.session, paper: spec.paper,
        source: spec.url, sha256: spec.sha256, ...clause, mappings, status: mappings.length ? "author-proposed" : "unmapped" };
    }));
    console.log(JSON.stringify({ version: selected.version, graph: selected.graph, exams: selected.exams,
      landOverlays: selected.landOverlays, locatedClauses: evidence.length, totalOfficialRequirements: null, evidence }, null, 2));
  }
}
