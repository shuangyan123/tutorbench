import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

import type { TutorEvalRunResult } from "../contracts/result.js";
import type { TutorHealthReport } from "../contracts/tutor-health.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";
import { formatTutorHealthReport } from "../reporting/tutor-health-reporters.js";
import { buildTutorHealthRunManifest, formatTutorHealthRunManifest } from "../reporting/tutor-health-run-manifest.js";
import { TutorbenchCliUsageError } from "./tutorbench-common.js";

export const TUTOR_HEALTH_ARTIFACT_FILES = [
  "evaluation.json", "health-report.json", "health-report.txt", "pilot-run-manifest.json",
] as const;

/** Check collisions before any Tutor/Judge execution; wx also protects against later races. */
export async function prepareTutorHealthOutput(directory: string): Promise<void> {
  try {
    await mkdir(directory, { recursive: true });
    for (const file of TUTOR_HEALTH_ARTIFACT_FILES) {
      const existing = await lstat(join(directory, file)).catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      });
      if (existing !== null) throw new Error("existing_artifact");
    }
  } catch {
    throw new TutorbenchCliUsageError("Unable to prepare health output; use a writable directory with no existing health artifacts.");
  }
}

export async function writeTutorHealthArtifacts(input: {
  readonly directory: string;
  readonly suite: TutorScenarioSuiteVNext;
  readonly evaluation: TutorEvalRunResult;
  readonly report: TutorHealthReport;
}): Promise<string> {
  // 序列化一次后同时用于哈希和落盘，保留现有 JSON 格式及结尾换行。
  const evaluationJson = `${JSON.stringify(input.evaluation, null, 2)}\n`;
  const reportJson = `${JSON.stringify(input.report, null, 2)}\n`;
  const reportText = formatTutorHealthReport(input.report);
  const manifest = buildTutorHealthRunManifest({ suite: input.suite, evaluationJson, reportJson });
  const contents = [evaluationJson, reportJson, `${reportText}\n`, formatTutorHealthRunManifest(manifest)];
  await prepareTutorHealthOutput(input.directory);
  const created: string[] = [];
  try {
    // manifest 最后写入；只删除本次排他创建的文件，绝不覆盖已有私有证据。
    for (const [index, file] of TUTOR_HEALTH_ARTIFACT_FILES.entries()) {
      const path = join(input.directory, file);
      const handle = await open(path, "wx");
      created.push(path);
      try {
        await handle.writeFile(contents[index]!, "utf8");
      } finally {
        await handle.close();
      }
    }
  } catch {
    const cleanup = await Promise.allSettled(created.map((path) => unlink(path)));
    throw new TutorbenchCliUsageError(cleanup.some((result) => result.status === "rejected")
      ? "Unable to write health artifacts; incomplete files may remain. Inspect the output directory before retrying."
      : "Unable to write health artifacts; files created by this attempt were removed. Use a new writable output directory.");
  }
  return reportText;
}
