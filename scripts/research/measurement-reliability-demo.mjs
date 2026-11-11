// Provider-free plumbing demonstration only; never human calibration evidence.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { measurementFixture } from "../../dist/tests/fixtures/measurement-reliability.js";
import { buildMeasurementReliabilityReport } from "../../dist/src/research/measurement-reliability.js";

const directory = resolve(process.argv[2] ?? "artifacts/measurement-reliability-demo");
await mkdir(directory, { recursive: true });
const source = await measurementFixture();
const report = await buildMeasurementReliabilityReport(source);
for (const [name, value] of Object.entries({ "frozen.json": source, "report.json": report })) {
  await writeFile(join(directory, name), JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
}
console.log(JSON.stringify({ syntheticOnly: true, calibrationStatus: report.calibrationStatus,
  coverage: report.coverage, strictVsJudge: report.strictVsJudge, evidenceIssues: report.evidenceIssues }, null, 2));
