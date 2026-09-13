import type { TutorUnderTest } from "../contracts/tutor.js";
import { runEvidenceBearingProgrammingPrototype } from "../experiments/evidence-bearing-programming.js";

const syntheticTutor: TutorUnderTest = {
  id: "synthetic-evidence-aware-debugging-tutor",
  async respond(input) {
    return {
      text: [
        "The test shows a concrete mismatch: an input above the upper bound produced 0 when 100 was expected.",
        "Trace the bound-handling expression for that one input and check whether the min/max operations are nested in the intended order before changing anything else.",
        `Use the evidence from scenario ${input.scenarioId}; do not infer a different failing case.`,
      ].join(" "),
    };
  },
};

async function main(): Promise<void> {
  const result = await runEvidenceBearingProgrammingPrototype(syntheticTutor);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`evidence-bearing programming prototype failed: ${message}\n`);
  process.exitCode = 1;
});
