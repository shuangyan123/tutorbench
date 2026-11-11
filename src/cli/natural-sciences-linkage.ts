import { readFile } from "node:fs/promises";
import { parseAcademicStructure } from "../contracts/academic-structure.js";
import { parseMathematicsExamAlignment } from "../contracts/mathematics-exam-alignment.js";
import { parseMathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import { loadTutorEvalDataset } from "../datasets/synthetic.js";
import {
  buildNaturalScienceCoverageAudit,
  NATURAL_SCIENCE_IDS,
  parseNaturalScienceSeedMap,
  type NaturalScienceCandidateRegistry,
  type NaturalScienceGapRegistry,
  type NaturalScienceId,
} from "../research/natural-sciences-linkage.js";

/** Internal development inspector: authored sources only, no model providers or scored evidence. */
async function main(args: readonly string[]): Promise<void> {
  const usage = "Usage: node dist/src/cli/natural-sciences-linkage.js [--subject physics|chemistry|biology] [--node NODE_ID] [--json]\n" +
    "Experimental and unreviewed source mapping; not teaching performance or certified curriculum coverage.";
  if (args.length === 1 && args[0] === "--help") {
    console.log(usage);
    return;
  }
  let subject: NaturalScienceId | null = null, node: string | null = null, json = false;
  for (let p = 0; p < args.length; p++) {
    if (args[p] === "--json" && !json) {
      json = true;
    } else if (args[p] === "--subject" && subject === null && p + 1 < args.length &&
        NATURAL_SCIENCE_IDS.includes(args[p + 1] as NaturalScienceId)) {
      subject = args[++p] as NaturalScienceId;
    } else if (args[p] === "--node" && node === null && p + 1 < args.length &&
        !args[p + 1]!.startsWith("--")) {
      node = args[++p]!;
    } else {
      throw new Error(usage);
    }
  }
  if (node !== null && subject === null) throw new Error(usage);
  const root = new URL("../../../scenarios/", import.meta.url);
  const rootPaths = [
    "case-system-vnext/academic-structure-v0.2.json",
    "case-system-vnext/mathematics-knowledge-map-v0.1.json",
    "case-system-vnext/mathematics-exam-alignment-v0.1.json",
    "experimental/natural-sciences-knowledge-v0.1/physics.json",
    "experimental/natural-sciences-knowledge-v0.1/chemistry.json",
    "experimental/natural-sciences-knowledge-v0.1/biology.json",
    "experimental/natural-sciences-knowledge-v0.1/links.json",
    "experimental/natural-sciences-knowledge-v0.1/unmapped.json",
    "real-world/case-system-vnext-executable-pilot-v0.1/suite.json",
    "experimental/prerequisite-accessibility-contrasts-v0.1/suite.json",
  ];
  const [files, evalDataset] = await Promise.all([
    Promise.all(rootPaths.map(p => readFile(new URL(p, root), "utf8"))),
    loadTutorEvalDataset(),
  ]);
  const sources = files.map(s => JSON.parse(s) as unknown);
  const math = parseMathematicsKnowledgeMap(sources[1]);
  const mathExams = parseMathematicsExamAlignment(sources[2]);
  const report = buildNaturalScienceCoverageAudit({
    academic: parseAcademicStructure(sources[0]),
    mathematicsSummary: { id: math.id, domains: math.domains.length, nodes: math.nodes.length },
    mathematicsExamProfileIds: mathExams.profiles.map(p => p.id),
    maps: sources.slice(3, 6).map(s => parseNaturalScienceSeedMap(s)),
    registry: sources[6] as NaturalScienceCandidateRegistry,
    gaps: sources[7] as NaturalScienceGapRegistry,
    experimentalSuites: sources.slice(8, 10).map(s => parseTutorScenarioSuiteVNext(s)),
    evalDataset,
  });
  const rows = subject === null ? report.nodes : report.nodes.filter(r => r.disciplineId === subject);
  if (node !== null && !rows.some(r => r.id === node)) throw new Error("Unknown concept node for " + subject + ": " + node);
  const selected = node !== null ? rows.filter(r => r.id === node) : rows;
  if (json) {
    console.log(JSON.stringify({
      scope: report.scope, inventoryComplete: report.inventoryComplete,
      semanticReviewCompleted: report.semanticReviewCompleted,
      defaultTutorHealthCoverageMeasured: report.defaultTutorHealthCoverageMeasured,
      modelRunsMeasured: report.modelRunsMeasured, learnerOutcomesMeasured: report.learnerOutcomesMeasured,
      sources: report.sources, counts: report.counts,
      nodes: selected,
      inventory: report.inventory.filter(r => subject === null || r.mappedDiscipline === subject ||
        (r.mappingStatus === "explicitly_unmapped" && node === null)),
    }, null, 2));
  } else {
    console.log("Natural science concept linkage (author-proposed / unreviewed).");
    console.log("Only canonical science Eval + two experimental suites; zero default Tutor Health claims.");
    for (const [key, value] of Object.entries(report.counts)) console.log(key + ": " + value);
    for (const r of selected) console.log(r.disciplineId + "/" + r.id +
      " focus=" + r.focusCaseCount + " supporting=" + r.supportingCaseCount);
    if (subject === null) console.log("Unattributed canonical science cases: " +
      report.inventory.filter(r => r.mappingStatus === "explicitly_unmapped").map(r => r.source.id).join(", "));
  }
}
main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
