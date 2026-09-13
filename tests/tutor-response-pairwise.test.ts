import assert from "node:assert/strict";
import test from "node:test";

import { loadTutorEvalDataset } from "../src/datasets/index.js";
import type { TutorCandidateResponse } from "../src/contracts/index.js";
import {
  TutorResponsePairwiseError,
  buildTutorResponsePairwisePlan,
  normalizeTutorResponsePairwiseEvidence,
} from "../src/pairwise/index.js";

function response(
  caseId: string,
  caseVersion: string,
  responseId: string,
  responseText: string,
): TutorCandidateResponse {
  return {
    schemaVersion: 1,
    responseId,
    caseId,
    caseVersion,
    runIndex: 1,
    responseText,
    provenance: "synthetic",
  };
}

test("pair identity is input-order independent and blind packets omit candidate identity", async () => {
  const dataset = await loadTutorEvalDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const left = response(tutorEvalCase.id, tutorEvalCase.version, "response-z", "Helpful response Z");
  const right = response(tutorEvalCase.id, tutorEvalCase.version, "response-a", "Helpful response A");

  const forward = buildTutorResponsePairwisePlan(dataset, left, right);
  const reversed = buildTutorResponsePairwisePlan(dataset, right, left);

  assert.equal(forward.pairId, reversed.pairId);
  assert.equal(forward.candidateAResponseId, "response-a");
  assert.equal(forward.candidateBResponseId, "response-z");

  const [first, second] = forward.presentations;
  assert.equal(first.assignment.aResponseId, "response-a");
  assert.equal(first.assignment.bResponseId, "response-z");
  assert.equal(second.assignment.aResponseId, "response-z");
  assert.equal(second.assignment.bResponseId, "response-a");

  for (const presentation of [first, second]) {
    const serialized = JSON.stringify(presentation.packet);
    assert.doesNotMatch(serialized, /response-a|response-z/);
    assert.equal("tutor" in presentation.packet, false);
    assert.equal("provider" in presentation.packet, false);
    assert.equal("model" in presentation.packet, false);
    assert.equal("generationSpec" in presentation.packet, false);
    assert.equal("metrics" in presentation.packet, false);
    for (const candidate of presentation.packet.candidates) {
      assert.equal("responseId" in candidate, false);
      assert.equal("provider" in candidate, false);
      assert.equal("model" in candidate, false);
      assert.equal("metrics" in candidate, false);
    }
    assert.ok(presentation.packet.comparisonInstruction.length > 0);
    assert.ok(presentation.packet.evaluatorOnly.rubrics.length > 0);
    assert.ok(presentation.packet.evaluatorOnly.disclosurePolicy.length > 0);
  }

  assert.equal(first.packet.candidates[0].responseText, "Helpful response A");
  assert.equal(second.packet.candidates[1].responseText, "Helpful response A");
});

test("stable preference survives A/B presentation swap", async () => {
  const dataset = await loadTutorEvalDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const a = response(tutorEvalCase.id, tutorEvalCase.version, "response-a", "A");
  const b = response(tutorEvalCase.id, tutorEvalCase.version, "response-b", "B");
  const plan = buildTutorResponsePairwisePlan(dataset, a, b);

  const result = normalizeTutorResponsePairwiseEvidence(plan, [
    {
      presentationId: plan.presentations[0].packet.presentationId,
      status: "ok",
      outcome: "A_BETTER",
    },
    {
      presentationId: plan.presentations[1].packet.presentationId,
      status: "ok",
      outcome: "B_BETTER",
    },
  ]);

  assert.equal(result.outcome, "A_BETTER");
  assert.equal(result.consistency, "stable_preference");
  assert.equal(result.rankingClaimAllowed, false);
});

test("order reversal is explicit incomparable evidence rather than a tie", async () => {
  const dataset = await loadTutorEvalDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const a = response(tutorEvalCase.id, tutorEvalCase.version, "response-a", "A");
  const b = response(tutorEvalCase.id, tutorEvalCase.version, "response-b", "B");
  const plan = buildTutorResponsePairwisePlan(dataset, a, b);

  const result = normalizeTutorResponsePairwiseEvidence(plan, [
    {
      presentationId: plan.presentations[0].packet.presentationId,
      status: "ok",
      outcome: "A_BETTER",
    },
    {
      presentationId: plan.presentations[1].packet.presentationId,
      status: "ok",
      outcome: "A_BETTER",
    },
  ]);

  assert.equal(result.outcome, "INCOMPARABLE");
  assert.equal(result.consistency, "order_sensitive");
});

test("stable ties remain ties while incomplete evidence fails closed", async () => {
  const dataset = await loadTutorEvalDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const a = response(tutorEvalCase.id, tutorEvalCase.version, "response-a", "A");
  const b = response(tutorEvalCase.id, tutorEvalCase.version, "response-b", "B");
  const plan = buildTutorResponsePairwisePlan(dataset, a, b);

  const tie = normalizeTutorResponsePairwiseEvidence(plan, [
    {
      presentationId: plan.presentations[0].packet.presentationId,
      status: "ok",
      outcome: "TIE",
    },
    {
      presentationId: plan.presentations[1].packet.presentationId,
      status: "ok",
      outcome: "TIE",
    },
  ]);
  assert.equal(tie.outcome, "TIE");
  assert.equal(tie.consistency, "stable_tie");

  const incomplete = normalizeTutorResponsePairwiseEvidence(plan, [
    {
      presentationId: plan.presentations[0].packet.presentationId,
      status: "ok",
      outcome: "A_BETTER",
    },
    {
      presentationId: plan.presentations[1].packet.presentationId,
      status: "unavailable",
      reason: "synthetic_unavailable",
    },
  ]);
  assert.equal(incomplete.outcome, "INCOMPARABLE");
  assert.equal(incomplete.consistency, "incomplete_evidence");
});

test("pairwise prototype rejects incompatible inputs and malformed evidence", async () => {
  const dataset = await loadTutorEvalDataset();
  const firstCase = dataset.cases[0];
  const secondCase = dataset.cases[1];
  assert.ok(firstCase);
  assert.ok(secondCase);

  const first = response(firstCase.id, firstCase.version, "response-a", "A");
  const wrongCase = response(secondCase.id, secondCase.version, "response-b", "B");
  assert.throws(
    () => buildTutorResponsePairwisePlan(dataset, first, wrongCase),
    TutorResponsePairwiseError,
  );

  const second = response(firstCase.id, firstCase.version, "response-b", "B");
  const plan = buildTutorResponsePairwisePlan(dataset, first, second);
  assert.throws(
    () =>
      normalizeTutorResponsePairwiseEvidence(plan, [
        {
          presentationId: plan.presentations[0].packet.presentationId,
          status: "unavailable",
          outcome: "A_BETTER",
        },
        {
          presentationId: plan.presentations[1].packet.presentationId,
          status: "ok",
          outcome: "B_BETTER",
        },
      ]),
    TutorResponsePairwiseError,
  );
});