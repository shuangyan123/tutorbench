import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { freezeMeasurementSource, type MeasurementTarget } from "../research/measurement-reliability-source.js";
import { buildMeasurementReliabilityReport } from "../research/measurement-reliability.js";

const usage = "freeze --dataset FILE --corpus FILE --evaluation FILE --targets FILE --output NEW_FILE | report --source FILE [--annotation FILE ... --human-source FILE] [--adjudication FILE] --output NEW_FILE";
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dataset: { type: "string" }, corpus: { type: "string" }, evaluation: { type: "string" },
      targets: { type: "string" }, source: { type: "string" }, output: { type: "string" },
      annotation: { type: "string", multiple: true }, adjudication: { type: "string" },
      "human-source": { type: "string" },
    },
  });
  const read = async (path: string | undefined): Promise<unknown> => {
    if (!path) throw new Error("measurement_argument_missing");
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  };
  if (positionals.length !== 1 || !values.output) throw new Error("measurement_arguments_invalid");
  let artifact: unknown;
  if (positionals[0] === "freeze") {
    if (values.source || values.annotation || values.adjudication || values["human-source"]) throw new Error("measurement_arguments_invalid");
    const [dataset, corpus, evaluation, targets] = await Promise.all([
      read(values.dataset), read(values.corpus), read(values.evaluation), read(values.targets),
    ]);
    artifact = freezeMeasurementSource(dataset, corpus, evaluation, targets as readonly MeasurementTarget[]);
  } else if (positionals[0] === "report") {
    if (values.dataset || values.corpus || values.evaluation || values.targets) throw new Error("measurement_arguments_invalid");
    artifact = await buildMeasurementReliabilityReport(await read(values.source),
      await Promise.all((values.annotation ?? []).map(read)),
      values.adjudication ? await read(values.adjudication) : undefined,
      values["human-source"] ? await read(values["human-source"]) : undefined);
  } else throw new Error("measurement_arguments_invalid");
  // 排他创建：不能覆盖历史结果、输入文件，或跟随既有符号链接写入。
  await writeFile(values.output, JSON.stringify(artifact, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  console.log("Measurement research artifact created; not_calibrated.");
} catch (error) {
  const message = error instanceof Error && /^measurement_[a-z_]+$/.test(error.message)
    ? error.message : "measurement_input_or_output_invalid";
  console.error(`${message}\n${usage}`);
  process.exitCode = 1;
}
