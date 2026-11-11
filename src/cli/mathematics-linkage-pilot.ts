import { readFile } from "node:fs/promises";
import { parseMathChallengeEvidence } from "../contracts/math-challenge-evidence.js";
import { parseMathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import { loadTutorEvalDataset } from "../datasets/synthetic.js";
import { loadTutorScenarioSuiteVNext } from "../datasets/real-world.js";
import {
  buildMathematicsPilotCoverage,
  findMathematicsPilotNode,
  type MathematicsPilotRegistry,
} from "../research/mathematics-linkage-pilot.js";

/**
 * Development-only inspection utility. Not added to public tutorbench CLI,
 * and intentionally does not invoke any Tutor, Judge, or scoring engine.
 */
async function main(args: readonly string[]): Promise<void> {
  const help = "Usage: node dist/src/cli/mathematics-linkage-pilot.js [--node KNOWLEDGE_NODE_ID] [--json]\n" +
    "Read-only authored knowledge links only: not scored runs or learner outcomes.";
  if (args.includes("--help")) {
    console.log(help);
    return;
  }
  const unknown = args.filter((arg, i) => arg !== "--json" && arg !== "--node" &&
    !(i > 0 && args[i - 1] === "--node"));
  const nodeFlag = args.indexOf("--node");
  if (unknown.length > 0 || (nodeFlag >= 0 && (args[nodeFlag + 1] === undefined || args[nodeFlag + 1]!.startsWith("--"))) ||
      args.filter(arg => arg === "--node").length > 1 ||
      args.filter(arg => arg === "--json").length > 1) {
    throw new Error(help);
  }
  const nodeId = nodeFlag >= 0 ? args[nodeFlag + 1]! : null;
  const base = new URL("../../../scenarios/", import.meta.url);
  const [mapText, pilotText, evidenceText, researchText, evaluation, health] = await Promise.all([
    readFile(new URL("case-system-vnext/mathematics-knowledge-map-v0.1.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-eval-health-linkage-v0.1/links.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/evidence.json", base), "utf8"),
    readFile(new URL("experimental/mathematics-challenge-v0.1/suite.json", base), "utf8"),
    loadTutorEvalDataset(),
    loadTutorScenarioSuiteVNext(),
  ]);
  const report = buildMathematicsPilotCoverage({
    map: parseMathematicsKnowledgeMap(JSON.parse(mapText) as unknown),
    pilot: JSON.parse(pilotText) as MathematicsPilotRegistry,
    evidence: parseMathChallengeEvidence(JSON.parse(evidenceText) as unknown),
    researchSuite: parseTutorScenarioSuiteVNext(JSON.parse(researchText) as unknown),
    evaluation,
    health,
  });
  if (nodeId !== null) {
    const found = findMathematicsPilotNode(report, nodeId);
    if (found === null) throw new Error("Unknown knowledge node: " + nodeId);
    if (args.includes("--json")) {
      console.log(JSON.stringify({
        scope: report.scope,
        reviewed: report.reviewed,
        modelRunsMeasured: report.modelRunsMeasured,
        learnerOutcomesMeasured: report.learnerOutcomesMeasured,
        node: found,
      }, null, 2));
    } else {
      console.log("Knowledge node: " + found.nodeId + " (" + found.domainId + ")");
      console.log("Research tasks: " + (found.researchTasks.join(", ") || "none linked"));
      console.log("Research scenarios: " + (found.researchScenarios.join(", ") || "none linked"));
      console.log("Canonical Eval cases (English pilot links): " + (found.evalCases.map(c => c.id + "@" + c.version).join(", ") || "none linked"));
      console.log("Default Health decision points: " + (found.healthDecisionPoints.map(c => c.scenarioId + "@" + c.scenarioVersion + "/" + c.decisionPointId).join(", ") || "none linked"));
    }
  } else if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("Mathematics authored-linkage pilot, unreviewed. Never interpret as model performance.");
    for (const [key, value] of Object.entries(report.counts)) {
      console.log(key + ": " + value);
    }
    console.log("Query with --node fractions-units | linear-equations | conditional-events");
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
