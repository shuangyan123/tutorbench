import {
  buildRubricAuthoringAudit,
  renderRubricAuthoringAuditMarkdown,
} from "../audits/index.js";
import { TUTOR_EVAL_DATASET_ID } from "../contracts/index.js";
import { loadTutorEvalDataset } from "../datasets/index.js";

function parseFormat(args: readonly string[]): "json" | "markdown" {
  const explicit = args.find((arg) => arg.startsWith("--format="));
  if (explicit !== undefined) {
    const value = explicit.slice("--format=".length);
    if (value === "json" || value === "markdown") {
      return value;
    }
    throw new Error("--format must be json or markdown");
  }
  const formatIndex = args.indexOf("--format");
  if (formatIndex >= 0) {
    const value = args[formatIndex + 1];
    if (value === "json" || value === "markdown") {
      return value;
    }
    throw new Error("--format must be json or markdown");
  }
  if (args.some((arg) => arg === "--markdown")) {
    return "markdown";
  }
  return "json";
}

const format = parseFormat(process.argv.slice(2));
const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
const report = buildRubricAuthoringAudit(dataset);

if (format === "markdown") {
  process.stdout.write(renderRubricAuthoringAuditMarkdown(report));
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
