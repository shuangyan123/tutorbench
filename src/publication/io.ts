import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { sha256Fingerprint } from "./fingerprint.js";
import { PublicEvidencePublicationError } from "./errors.js";
import type {
  PublicationIssue,
  PublicationOutputFiles,
} from "./contracts.js";

export interface JsonDocument {
  readonly bytes: Uint8Array;
  readonly value: unknown;
  readonly sha256: string;
}

function sourceInvalid(): PublicEvidencePublicationError {
  const issue: PublicationIssue = { code: "publication_source_invalid" };
  return new PublicEvidencePublicationError([issue]);
}

export async function readJsonDocument(path: string): Promise<JsonDocument> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch {
    throw sourceInvalid();
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw sourceInvalid();
  }
  return { bytes, value, sha256: sha256Fingerprint(bytes) };
}

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeJson(value), "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Writes a complete publication directory only after all objects are valid. */
export async function writePublicationOutputDirectory(
  outputDirectory: string,
  files: PublicationOutputFiles,
): Promise<void> {
  if (await pathExists(outputDirectory)) {
    throw new PublicEvidencePublicationError([
      { code: "publication_output_exists" },
    ]);
  }
  const parent = dirname(outputDirectory);
  await mkdir(parent, { recursive: true });
  const temporaryDirectory = await mkdtemp(join(parent, ".tutorbench-publication-"));
  try {
    await writeJsonFile(join(temporaryDirectory, "publication.json"), files.publication);
    await writeJsonFile(join(temporaryDirectory, "models.json"), files.models);
    await writeJsonFile(join(temporaryDirectory, "trials.json"), files.trials);
    await rename(temporaryDirectory, outputDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}
