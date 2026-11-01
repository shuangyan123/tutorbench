import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface ReviewRow {
  sequence: number;
  caseId: string;
  variantId: string;
  rubricRatings: Record<string, string>;
  answerLeakage: boolean;
  reviewerReason: string | null;
}
interface ShadowRow {
  sequence: number;
  caseId: string;
  variantId: string;
  mathClaimStatus: "correct" | "incorrect";
  responseMode: "bounded_hint" | "complete_correct_result" |
    "wrong_student_claim_endorsement" | "incorrect_final_result_assertion";
  correctFinalResultDisclosed: boolean;
  prematureClosure: boolean;
  evidence: string;
  notIndependentGold: boolean;
}
interface ContrastSet {
  caseId: string;
  variants: Array<{ id: string; responseText: string }>;
}
async function load<T>(name: string): Promise<T> {
  const url = new URL("../../" + name, import.meta.url);
  return JSON.parse(await readFile(url, "utf8")) as T;
}

test("orthogonal shadow facets are exhaustive and never overwrite user scores", async () => {
  const reviews = await load<{ responsesRecorded: number; reviews: ReviewRow[] }>(
    "docs/research/math-contrast-user-review-completed-2026-11-01.json",
  );
  const fixture = await load<{ contrastSets: ContrastSet[] }>(
    "fixtures/judge/math-pedagogical-boundary-review-v0.1.json",
  );
  const shadow = await load<{
    id: string;
    schemaVersion: number;
    status: string;
    sourceReview: string;
    sourceContrasts: string;
    items: ShadowRow[];
  }>("fixtures/judge/math-orthogonal-facets-shadow-v0.1.json");
  assert.equal(reviews.responsesRecorded, 11);
  assert.equal(shadow.schemaVersion, 1);
  assert.equal(shadow.id, "math-orthogonal-facets-shadow-v0.1");
  assert.equal(shadow.status, "research-hypotheses-only");
  assert.equal(shadow.sourceReview, "docs/research/math-contrast-user-review-completed-2026-11-01.json");
  assert.equal(shadow.sourceContrasts, "fixtures/judge/math-pedagogical-boundary-review-v0.1.json");
  assert.equal(shadow.items.length, 11);

  const expected = new Map(reviews.reviews.map(x => [x.sequence, x]));
  const source = new Set(
    fixture.contrastSets.flatMap(g => g.variants.map(v => g.caseId + ":" + v.id)),
  );
  const unique = new Set<string>();
  for (const item of shadow.items) {
    const user = expected.get(item.sequence);
    assert.ok(user, "missing original reviewer submission " + item.sequence);
    assert.equal(item.caseId, user.caseId);
    assert.equal(item.variantId, user.variantId);
    const key = item.caseId + ":" + item.variantId;
    assert.ok(source.has(key), "unknown source response: " + key);
    assert.ok(!unique.has(key), "duplicate source response: " + key);
    unique.add(key);
    assert.equal(item.notIndependentGold, true);
    assert.ok(item.evidence.length >= 35);
    assert.ok(["correct", "incorrect"].includes(item.mathClaimStatus));
    assert.ok([
      "bounded_hint", "complete_correct_result",
      "wrong_student_claim_endorsement", "incorrect_final_result_assertion",
    ].includes(item.responseMode));
    assert.equal(typeof item.prematureClosure, "boolean");
    assert.equal(typeof item.correctFinalResultDisclosed, "boolean");
    if (item.correctFinalResultDisclosed) {
      assert.equal(item.mathClaimStatus, "correct");
      assert.equal(item.responseMode, "complete_correct_result");
    }
    if (item.responseMode === "bounded_hint") {
      assert.equal(item.prematureClosure, false);
    }
    assert.equal(Object.keys(user.rubricRatings).length, 2);
  }
  assert.equal(unique.size, source.size);
  assert.deepEqual([...expected.keys()].sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10,11]);
});

test("reference facts are independent from teacher disclosure policy", async () => {
  const shadow = await load<{ items: ShadowRow[] }>(
    "fixtures/judge/math-orthogonal-facets-shadow-v0.1.json",
  );
  const bySequence = new Map(shadow.items.map(x => [x.sequence, x]));
  const f = (x: number): number => x * x * x - 3 * x;
  assert.deepEqual([-2, -1, 1, 2].map(f), [-2, 2, -2, 2]);
  assert.equal((5 * 4) / (9 * 8), 5 / 18);
  assert.equal((5 * 4) / (9 * 8) === 1 / 3, false);
  assert.equal((5 * 4) / (9 * 8) === 10 / 30, false);
  assert.equal(10 / (36 - 6), 1 / 3);
  for (const sequence of [3, 7, 11]) {
    const item = bySequence.get(sequence);
    assert.ok(item);
    assert.equal(item.mathClaimStatus, "correct");
    assert.equal(item.correctFinalResultDisclosed, true);
  }
  for (const sequence of [4, 5, 8, 9]) {
    const item = bySequence.get(sequence);
    assert.ok(item);
    assert.equal(item.mathClaimStatus, "incorrect");
    assert.equal(item.correctFinalResultDisclosed, false);
  }
  // These checks protect curated research annotations and arithmetic; they do
  // not establish that the semantic labels are independent human gold.
});

test("identical endorsement mode may receive different raw user leakage judgments", async () => {
  const reviews = await load<{ reviews: ReviewRow[] }>(
    "docs/research/math-contrast-user-review-completed-2026-11-01.json",
  );
  const shadow = await load<{ items: ShadowRow[] }>(
    "fixtures/judge/math-orthogonal-facets-shadow-v0.1.json",
  );
  const byId = new Map(reviews.reviews.map(x => [x.sequence, x]));
  for (const sequence of [4, 8, 9]) {
    assert.equal(shadow.items.find(x => x.sequence === sequence)?.responseMode,
      "wrong_student_claim_endorsement");
  }
  assert.equal(byId.get(4)?.answerLeakage, false);
  assert.equal(byId.get(8)?.answerLeakage, true);
  assert.equal(byId.get(9)?.answerLeakage, true);
  // Preserve unresolved human boundary; do not normalize one user's judgments.
});
