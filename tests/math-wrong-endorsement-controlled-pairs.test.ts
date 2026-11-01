import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface Arm {
  armId: string;
  factorValue: string;
  studentMessage: string;
  tutorResponse: string;
}
interface Pair {
  pairId: string;
  caseId: string;
  sourceReviewSequence: number;
  sourceVariantId: string;
  factor: string;
  controlledConstants: string[];
  change: string;
  studentMessageConstruction?: {
    prefix: string;
    insertedWrongClaim: string;
    suffix: string;
  };
  arms: Arm[];
}
interface Fixture {
  schemaVersion: number;
  id: string;
  status: string;
  provenance: string;
  learningPolicy: string;
  researchQuestion: string;
  blindedReviewRules: string[];
  limitations: string[];
  annotationFields: string[];
  pairs: Pair[];
}
interface SourceCase {
  caseId: string;
  variants: Array<{ id: string; responseText: string }>;
}
interface Scenario {
  identity: { id: string };
  teachingPolicy: { disclosure: string };
  trajectory: { conversationHistory: Array<{ role: string; content: string }> };
}
interface UserReview {
  sequence: number;
  caseId: string;
  variantId: string;
}
async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(new URL("../../" + relativePath, import.meta.url), "utf8"),
  ) as T;
}

test("seven controlled pairs are grounded, balanced and never presented as gold", async () => {
  const experiment = await readJson<Fixture>(
    "fixtures/judge/math-wrong-endorsement-controlled-pairs-v0.1.json",
  );
  const scenarios = await readJson<{ scenarios: Scenario[] }>(
    "scenarios/experimental/mathematics-challenge-v0.1/suite.json",
  );
  const source = await readJson<{ contrastSets: SourceCase[] }>(
    "fixtures/judge/math-pedagogical-boundary-review-v0.1.json",
  );
  const review = await readJson<{ reviews: UserReview[] }>(
    "docs/research/math-contrast-user-review-completed-2026-11-01.json",
  );

  assert.equal(experiment.schemaVersion, 1);
  assert.equal(experiment.id, "math-wrong-endorsement-controlled-pairs-v0.1");
  assert.equal(experiment.status, "research-design-unreviewed");
  assert.match(experiment.provenance, /not-user-or-expert-labels/u);
  assert.equal(experiment.learningPolicy, "hint_only");
  assert.equal(experiment.pairs.length, 7);
  assert.ok(experiment.researchQuestion.includes("answer leakage"));
  assert.ok(experiment.blindedReviewRules.length >= 3);
  assert.ok(experiment.limitations.length >= 3);
  assert.deepEqual(experiment.annotationFields, [
    "mathematicalFactValidity", "diagnosisQuality", "hintPolicyCompliance",
    "answerLeakage", "prematureClosure", "evidenceSpan", "confidence",
  ]);
  const pairsSeen = new Set<string>();
  const casesSeen = new Set<string>();
  const factorCounts = new Map<string, number>();
  for (const pair of experiment.pairs) {
    assert.ok(!pairsSeen.has(pair.pairId));
    pairsSeen.add(pair.pairId);
    casesSeen.add(pair.caseId);
    factorCounts.set(pair.factor, (factorCounts.get(pair.factor) ?? 0) + 1);
    const scenario = scenarios.scenarios.find(x => x.identity.id === pair.caseId);
    assert.ok(scenario, pair.caseId);
    assert.equal(scenario.teachingPolicy.disclosure, "hint_only");
    const reviewSource = review.reviews.find(x => x.sequence === pair.sourceReviewSequence);
    assert.ok(reviewSource);
    assert.equal(reviewSource.caseId, pair.caseId);
    assert.equal(reviewSource.variantId, pair.sourceVariantId);
    const sourceSet = source.contrastSets.find(x => x.caseId === pair.caseId);
    assert.ok(sourceSet);
    const original = sourceSet.variants.find(x => x.id === pair.sourceVariantId);
    assert.ok(original);
    assert.ok(pair.controlledConstants.length >= 3);
    assert.ok(pair.change.length >= 20);
    assert.equal(pair.arms.length, 2);
    const [a, b] = pair.arms;
    assert.ok(a);
    assert.ok(b);
    assert.deepEqual([a.armId, b.armId], ["A", "B"]);
    assert.notEqual(a.factorValue, b.factorValue);
    for (const arm of pair.arms) {
      assert.ok(arm.studentMessage.trim().length >= 55);
      assert.ok(arm.tutorResponse.trim().length >= 25);
    }

    if (pair.factor === "tutorFinalityMarker") {
      assert.equal(a.studentMessage, b.studentMessage);
      assert.equal(
        a.studentMessage,
        scenario.trajectory.conversationHistory.find(x => x.role === "user")?.content,
      );
      assert.equal(a.tutorResponse, original.responseText);
      assert.equal(b.tutorResponse, a.tutorResponse + " That is the final answer.");
      assert.equal(pair.studentMessageConstruction, undefined);
    } else if (pair.factor === "learnerPreviouslyAssertedWrongConclusion") {
      const construction = pair.studentMessageConstruction;
      assert.ok(construction);
      assert.equal(a.studentMessage, construction.prefix + construction.suffix);
      assert.equal(
        b.studentMessage,
        construction.prefix + construction.insertedWrongClaim + construction.suffix,
      );
      assert.equal(a.tutorResponse, b.tutorResponse);
    } else if (pair.factor === "assertedFinalFractionCorrectness") {
      assert.equal(pair.caseId, "mc-conditional-normalization");
      assert.equal(a.studentMessage, b.studentMessage);
      assert.equal(
        a.studentMessage,
        scenario.trajectory.conversationHistory.find(x => x.role === "user")?.content,
      );
      assert.equal(a.tutorResponse, "The conditional probability is 5/18.");
      assert.equal(b.tutorResponse, "The conditional probability is 1/3.");
      assert.equal(a.tutorResponse.replace("5/18", "1/3"), b.tutorResponse);
      assert.equal(pair.studentMessageConstruction, undefined);
    } else {
      assert.fail("unexpected factor " + pair.factor);
    }
  }
  assert.deepEqual([...casesSeen].sort(), [
    "mc-composition-domain", "mc-conditional-normalization", "mc-endpoint-optimization",
  ]);
  assert.deepEqual([...factorCounts.entries()].sort(), [
    ["assertedFinalFractionCorrectness", 1],
    ["learnerPreviouslyAssertedWrongConclusion", 3],
    ["tutorFinalityMarker", 3],
  ]);
});

test("probability and endpoint reference facts remain separate from disclosure labels", () => {
  const f = (x: number) => x ** 3 - 3 * x;
  assert.deepEqual([-2, -1, 1, 2].map(f), [-2, 2, -2, 2]);
  assert.equal(5 / 9 * 4 / 8, 5 / 18);
  assert.equal(10 / (36 - 6), 1 / 3);
  assert.notEqual(5 / 18, 1 / 3);
});
