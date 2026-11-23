import { readFile } from "node:fs/promises";
import { compareExamSources, parseExamSpecifications } from "../research/exam-specifications.js";
import { inspectCurriculumRevision } from "../research/exam-edition-comparison.js";
import { inspectAssessmentGuidance } from "../research/exam-assessment-guidance.js";
import { inspectKnowledgeCoverage } from "../research/exam-knowledge-coverage.js";
import { inspectMathKnowledgeAudit } from "../research/math-knowledge-audit.js";
import { inspectGeometryPilot } from "../research/math-geometry-pilot.js";
import { diagnosticEvidence, inspectDiagnosticContrasts, inspectDiagnosticSubmission, prepareDiagnosticReview } from "../research/math-diagnostic-contrasts.js";
import { inspectSourceGovernance } from "../research/exam-source-governance.js";
import { resolveInternationalSources } from "../research/exam-international-inventory.js";
import { compareRequirementInventories, inspectGapRequirements, inspectRequirements } from "../research/exam-requirements.js";

const base = "scenarios/case-system-vnext/";
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const [graph, alignment] = await Promise.all(["mathematics-knowledge-map-v0.1", "mathematics-exam-alignment-v0.1"].map(name => read(`${base}${name}.json`)));
const args = process.argv.slice(2);
const inventory = args[0] === "--requirements";
const paths = inventory ? args.slice(1) : args;
const diagnostic = inventory && paths[0] === "--diagnostic-contrasts";
if (!diagnostic && paths.length > 2) throw new Error("Usage: exam:inspect [--requirements] [snapshot.json [comparison.json]]");
const load = async (path: string) => parseExamSpecifications(await read(path), graph, alignment);
const archived = `${base}exam-specifications/0.1.0.json`;
const registry = await load(archived);
if (inventory) {
  const inspect = async (path: string, provided?: unknown) => {
    const input = provided ?? await read(path);
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
  if (paths[0] === "--source-governance") {
    if (paths.length !== 1) throw new Error("Unexpected source governance argument");
    const baseline = await inspect(`${base}exam-specifications/requirements-0.7.0.json`);
    console.log(JSON.stringify(inspectSourceGovernance(registry, baseline), null, 2));
  } else if (paths[0] === "--edition-diff") {
    if (paths[1] !== undefined && paths[1] !== "assessment-guidance") throw new Error("Unknown --edition-diff scope");
    const baseline = await inspect(current);
    console.log(JSON.stringify(paths[1] ? inspectAssessmentGuidance(baseline) : inspectCurriculumRevision(baseline), null, 2));
  } else {
    const select = async (path: string) => {
      const input = await read(path);
      if (input && typeof input === "object" && "version" in input && ["0.9.0", "1.0.0", "1.1.0"].includes(String(input.version))) {
        const baseline = await inspect(`${base}exam-specifications/requirements-0.7.0.json`);
        if (input.version === "0.9.0") return inspectKnowledgeCoverage(input, baseline, graph);
        const previous = await read(`${base}exam-specifications/requirements-0.9.0.json`);
        const coverage = inspectKnowledgeCoverage(previous, baseline, graph);
        if (input.version === "1.0.0") return inspectMathKnowledgeAudit(input, coverage);
        const challenge = "scenarios/experimental/mathematics-challenge-v0.1/";
        const [audit, suite, evidence] = await Promise.all([
          read(`${base}exam-specifications/requirements-1.0.0.json`), read(challenge + "suite.json"), read(challenge + "evidence.json"),
        ]);
        return inspectGeometryPilot(input, inspectMathKnowledgeAudit(audit, coverage), suite, evidence);
      }
      return inspect(path, input);
    };
    if (diagnostic) {
      const baseReport = await select(`${base}exam-specifications/requirements-1.1.0.json`);
      if (!("tasks" in baseReport)) throw new Error("missing task evidence");
      const report = inspectDiagnosticContrasts(baseReport);
      const [, action, dimension, slot, submission] = paths;
      if (!action && paths.length === 1) console.log(JSON.stringify(report, null, 2));
      else if (action === "evidence" && paths.length === 2) console.log(JSON.stringify(diagnosticEvidence(report), null, 2));
      else {
        if (!dimension || !slot || !["export","manifest","import"].includes(action ?? "") ||
          paths.length !== (action === "import" ? 5 : 4)) throw new Error("Expected export|manifest|import dimension reviewer-slot [submission.json]");
        const frozen = prepareDiagnosticReview(report, dimension, slot);
        const result = action === "export" ? { packet: frozen.packet, template: frozen.template } : action === "manifest"
          ? frozen.manifest : inspectDiagnosticSubmission(await read(submission!), frozen);
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      const report = await select(paths[0] ?? current);
      console.log(JSON.stringify(paths[1] ? compareRequirementInventories(report, await select(paths[1])) : report, null, 2));
    }
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
