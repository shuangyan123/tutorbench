import { parseTutorEvalDataset, type TutorResponseCorpus } from "../../src/contracts/index.js";
import { runTutorResponseCorpus } from "../../src/runner/tutor-response-corpus-runner.js";
import { freezeMeasurementSource } from "../../src/research/measurement-reliability-source.js";

/** Author-synthetic software controls, not model observations or human labels. */
export async function measurementFixture() {
  const dataset = parseTutorEvalDataset({
    id: "measurement-synthetic-control", version: "1", cases: [{
      schemaVersion: 1, id: "addition-control", version: "1",
      metadata: { subject: "mathematics", topic: "addition", tags: ["synthetic"] },
      tutorInput: { learningObjective: "Check addition.", studentMessage: "Is two plus two four? Explain." },
      evaluatorOnly: {
        groundTruth: { finalAnswer: "4", explanation: "hidden-reference-canary" },
        knownMisconception: "hidden-misconception-canary",
        disclosurePolicy: "full_solution_allowed",
        rubrics: [{ id: "correctness-control", category: "correctness", criterion: "Verify four.",
          weight: 1, evaluationType: "judge" }],
      },
    }],
  });
  const responses = ["4", "Four.", "5", "4 ", "four", "uncertain"];
  const corpus: TutorResponseCorpus = {
    schemaVersion: 1, corpusId: "measurement-synthetic-responses", corpusVersion: "1",
    datasetId: dataset.id, datasetVersion: dataset.version,
    createdAt: "2026-11-11T00:00:00.000Z", coverage: "full", runsPerCase: responses.length,
    provenance: "synthetic", tutor: { provider: "synthetic", model: "software-control", promptVersion: "1" },
    responses: responses.map((responseText, i) => ({ schemaVersion: 1, responseId: `control-${i + 1}`,
      caseId: "addition-control", caseVersion: "1", runIndex: i + 1, responseText,
      provenance: "synthetic", metrics: { latencyMs: 0 } })),
  };
  let index = 0;
  const labels = ["FAIL", "PASS", "FAIL", "PARTIAL", "PASS", "FAIL"] as const;
  const replay = await runTutorResponseCorpus({
    dataset, corpus, runId: "measurement-synthetic-evaluation", now: () => new Date(corpus.createdAt),
    judge: {
      provider: "synthetic", model: "contradiction-control", promptVersion: "1",
      async evaluate(input) {
        const position = index++;
        return { schemaVersion: 1, caseId: input.caseId,
          rubricResults: input.rubrics.map(r => ({ rubricId: r.id, result: labels[position]!, evidence: "hidden-judge-canary" })),
          criticalFailures: [], factualErrors: [], insufficientInformation: position === 5 };
      },
    },
  });
  return freezeMeasurementSource(dataset, corpus, replay.evaluation,
    [{ caseId: "addition-control", rubricId: "correctness-control" }]);
}
