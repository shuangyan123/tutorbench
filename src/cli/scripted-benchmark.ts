import { partitionTutorEvalRubrics, resolveTutorCaseLocale } from "../contracts/index.js";
import { loadTutorEvalDataset } from "../datasets/index.js";
import { caseErrorCodes, countErrorCodes } from "../reporting/execution-diagnostics.js";
import { runTutorEval } from "../runner/index.js";
import { createGuidedTutor, guidedResponses, guidedTutorDescriptor } from "./synthetic-guided-tutor.js";

export function missingScriptedResponses(
  cases: readonly { readonly id: string }[],
  responses: Readonly<Record<string, string>>,
): string[] {
  return cases.filter(({ id }) => !Object.hasOwn(responses, id) || !responses[id]?.trim()).map(c => c.id);
}

export async function runScriptedBenchmark() {
  const dataset = await loadTutorEvalDataset();
  const missing = missingScriptedResponses(dataset.cases, guidedResponses);
  if (missing.length) throw new Error("Missing scripted demo responses: " + missing.join(", "));

  const result = await runTutorEval({
    dataset,
    tutor: createGuidedTutor(),
    tutorDescriptor: guidedTutorDescriptor,
    runsPerCase: 1,
    runId: "tutor-eval-v0.2a-synthetic-guided",
  });
  const authored = new Map(dataset.cases.map(c => [c.id, c]));
  const cases = result.caseResults.map(row => {
    const source = authored.get(row.caseId)!;
    const resolved = new Set(row.rubricResults.filter(r => r.score !== null).map(r => r.rubricId));
    const unresolvedJudgeRubrics = partitionTutorEvalRubrics(source).judgeRubrics
      .map(r => r.id).filter(id => !resolved.has(id));
    return {
      caseId: row.caseId,
      locale: resolveTutorCaseLocale(source.locale),
      responseReceived: row.rawTutorResponse !== null,
      errorCodes: caseErrorCodes(row),
      unresolvedJudgeRubrics,
    };
  });
  const locales = [...new Set(cases.map(c => c.locale))].map(locale => {
    const rows = cases.filter(c => c.locale === locale);
    const responses = rows.filter(c => c.responseReceived).length;
    return { locale, selected: rows.length, responses, missingResponses: rows.length - responses,
      errors: countErrorCodes(rows) };
  });
  const diagnosis = {
    command: "npm run benchmark", entrypoint: "src/cli/benchmark.ts", mode: "synthetic-scripted-demo",
    datasetId: result.datasetId, datasetVersion: result.datasetVersion, caseCount: cases.length,
    tutor: result.tutor, judgeConfigured: false, networkUsed: false, overallScore: result.overallScore,
    locales, cases,
  };
  return { result, diagnosis };
}
