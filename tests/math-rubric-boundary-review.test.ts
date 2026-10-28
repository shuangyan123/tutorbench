import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface ReviewVariant {
  id: string;
  responseText: string;
  teachingHypothesis: string;
  leakageHypothesis: "yes" | "no" | "disputed";
}
interface ReviewSet {
  id: string;
  caseId: string;
  disclosurePolicy: string;
  question: string;
  variants: ReviewVariant[];
}
interface ReviewFixture {
  schemaVersion: number;
  id: string;
  status: string;
  provenance: string;
  contrastSets: ReviewSet[];
}
interface Scenario {
  identity: { id: string };
  teachingPolicy: { disclosure: string };
}

const root = "../../";
async function jsonFile<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(new URL(root + relativePath, import.meta.url), "utf8")) as T;
}

test("boundary-review examples have unique IDs and refer only to existing hint-only cases", async () => {
  const fixture = await jsonFile<ReviewFixture>("fixtures/judge/math-pedagogical-boundary-review-v0.1.json");
  const suite = await jsonFile<{ scenarios: Scenario[] }>("scenarios/experimental/mathematics-challenge-v0.1/suite.json");
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.id, "math-pedagogical-boundary-review-v0.1");
  assert.equal(fixture.status, "provisional-review-fixture");
  assert.match(fixture.provenance, /not-human-gold/u);
  assert.equal(fixture.contrastSets.length, 3);
  const seen = new Set<string>();
  for (const group of fixture.contrastSets) {
    const scenario = suite.scenarios.find(c => c.identity.id === group.caseId);
    assert.ok(scenario, group.caseId);
    assert.equal(scenario.teachingPolicy.disclosure, "hint_only");
    assert.equal(group.disclosurePolicy, "hint_only");
    assert.ok(group.question.length > 15);
    assert.ok(group.variants.length >= 3);
    for (const variant of group.variants) {
      const key = group.id + ":" + variant.id;
      assert.ok(!seen.has(key), key);
      seen.add(key);
      assert.ok(variant.responseText.trim().length >= 30);
      assert.ok(["yes", "no", "disputed"].includes(variant.leakageHypothesis));
      assert.ok(variant.teachingHypothesis.length > 5);
    }
  }
  assert.equal(seen.size, 11);
});

test("mathematical reference checks prevent silently rewriting the disputed examples", () => {
  const f = (x: number): number => x ** 3 - 3 * x;
  assert.equal(f(-2), -2);
  assert.equal(f(-1), 2);
  assert.equal(f(1), -2);
  assert.equal(f(2), 2);
  assert.equal(5 / 9 * 4 / 8, 5 / 18);
  assert.equal(10 / (36 - 6), 1 / 3);
  assert.notEqual(5 / 18, 1 / 3);
});

test("boundary hypotheses distinguish wrong final assertions, corrected hints, and full solutions", async () => {
  const fixture = await jsonFile<ReviewFixture>("fixtures/judge/math-pedagogical-boundary-review-v0.1.json");
  const group = (id: string): ReviewSet => {
    const item = fixture.contrastSets.find(x => x.id === id);
    assert.ok(item, id);
    return item;
  };
  const variant = (groupId: string, id: string): ReviewVariant => {
    const item = group(groupId).variants.find(x => x.id === id);
    assert.ok(item, id);
    return item;
  };
  assert.equal(variant("endpoint-hint-vs-disclosure", "endpoint-minimal").teachingHypothesis, "acceptable_bounded_hint");
  assert.equal(variant("endpoint-hint-vs-disclosure", "endpoint-possible-tie").leakageHypothesis, "no");
  assert.equal(variant("endpoint-hint-vs-disclosure", "endpoint-final-reveal").leakageHypothesis, "yes");
  assert.equal(variant("conditional-wrong-final-vs-correction", "conditional-wrong-asserted-final").leakageHypothesis, "disputed");
  assert.equal(variant("conditional-wrong-final-vs-correction", "conditional-bounded-correction").leakageHypothesis, "no");
  assert.equal(variant("conditional-wrong-final-vs-correction", "conditional-correct-final-reveal").leakageHypothesis, "yes");
  assert.equal(variant("domain-student-echo-vs-answer", "domain-wrong-echo").leakageHypothesis, "disputed");
  // These are author-proposed hypotheses: this test does not call a Judge or establish semantic validity.
});
