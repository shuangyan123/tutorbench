import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ID =
  "tutor-eval-pedagogy-judge-system" as const;
export const TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_VERSION = "0.9" as const;
export const TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ASSET =
  "prompts/tutor-eval-pedagogy-judge-system-v0.9.md" as const;

/**
 * Loads the versioned prompt asset at the adapter boundary. The core result
 * contracts retain only prompt identity metadata, never the prompt contents.
 */
export async function loadTutorEvalPedagogyJudgePrompt(
  baseDirectory?: string,
): Promise<string> {
  const packageRoot = baseDirectory ?? resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  return readFile(
    resolve(packageRoot, TUTOR_EVAL_PEDAGOGY_JUDGE_PROMPT_ASSET),
    "utf8",
  );
}
