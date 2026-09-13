import assert from "node:assert/strict";
import { test } from "node:test";

import type { TutorTurnInput, TutorUnderTest } from "../src/contracts/tutor.js";
import {
  TUTOR_EVAL_DATASET_VERSION,
  TUTOR_EVAL_EVALUATOR_VERSION,
} from "../src/contracts/tutor-eval.js";
import {
  buildEvidenceBearingProgrammingTutorInput,
  generateEvidenceBearingProgrammingBundle,
  runEvidenceBearingProgrammingPrototype,
  type EvidenceBearingProgrammingBundle,
  verifyEvidenceBearingProgrammingBundle,
} from "../src/experiments/evidence-bearing-programming.js";

test("execution-backed programming evidence is deterministic on the supported runtime", () => {
  const first = generateEvidenceBearingProgrammingBundle();
  const second = generateEvidenceBearingProgrammingBundle();

  assert.deepEqual(first, second);
  assert.equal(first.evidence.status, "failed");
  assert.equal(first.evidence.exitCode, 1);
  assert.equal(first.evidence.testName, "clampScore caps values above 100");
  assert.equal(first.evidence.expected, 100);
  assert.equal(first.evidence.actual, 0);
  assert.equal(first.evidence.operator, "strictEqual");
  assert.equal(first.evidence.errorCode, "ERR_ASSERTION");
  assert.match(first.provenance.challengeSpecFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(first.provenance.fixtureFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(first.provenance.executionSpecFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(first.provenance.evidenceFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(first.provenance.bindingFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(verifyEvidenceBearingProgrammingBundle(first), {
    status: "pass",
    diagnostics: [],
  });
});

test("Tutor-visible input carries normalized evidence without canonical identity or hidden diagnosis", () => {
  const bundle = generateEvidenceBearingProgrammingBundle();
  const input = buildEvidenceBearingProgrammingTutorInput(bundle);
  const serialized = JSON.stringify(input);

  assert.equal(input.caseId, undefined);
  assert.equal(input.caseVersion, undefined);
  assert.match(input.initialContext, /Experimental execution-backed debugging evidence/u);
  assert.match(input.initialContext, /expected=100/u);
  assert.match(input.initialContext, /actual=0/u);
  assert.match(input.initialContext, /Evidence binding fingerprint: sha256:/u);
  assert.doesNotMatch(serialized, /reverses the min\/max bounds/u);
  assert.doesNotMatch(serialized, /causing an input of 120 to return 0 instead of 100/u);
});

test("tampered execution evidence fails closed before reaching a Tutor", () => {
  const bundle = generateEvidenceBearingProgrammingBundle();
  const tampered: EvidenceBearingProgrammingBundle = {
    ...bundle,
    evidence: {
      ...bundle.evidence,
      actual: 1,
    },
  };

  assert.deepEqual(verifyEvidenceBearingProgrammingBundle(tampered), {
    status: "fail",
    diagnostics: ["evidence_fingerprint_mismatch", "binding_fingerprint_mismatch"],
  });
  assert.throws(
    () => buildEvidenceBearingProgrammingTutorInput(tampered),
    /evidence_integrity_failure:evidence_fingerprint_mismatch,binding_fingerprint_mismatch/u,
  );
});

test("prototype exercises a provider-free Tutor without applying canonical scoring", async () => {
  let receivedInput: TutorTurnInput | undefined;
  const tutor: TutorUnderTest = {
    id: "test-evidence-aware-tutor",
    async respond(input) {
      receivedInput = input;
      return {
        text: "The actual value is 0 while 100 was expected. Trace the bound expression and inspect the min/max ordering first.",
      };
    },
  };

  const run = await runEvidenceBearingProgrammingPrototype(tutor);

  assert.ok(receivedInput !== undefined);
  assert.equal(run.tutorInput, receivedInput);
  assert.equal(run.verification.evidenceIntegrity, "pass");
  assert.equal(run.verification.semanticTutoringEvaluation, "not_evaluated");
  assert.equal(run.verification.canonicalScoringApplied, false);
  assert.equal(TUTOR_EVAL_DATASET_VERSION, "0.2a.6");
  assert.equal(TUTOR_EVAL_EVALUATOR_VERSION, "0.3a.4");
});
