import assert from "node:assert/strict";
import { test } from "node:test";
import { compareTutorHealthRuns, formatTutorHealthComparison, parseTutorHealthComparison, type TutorFinding } from "../src/index.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";

function findingKey(finding: TutorFinding): string {
  return `${finding.scenarioId}::${finding.location.decisionPointId}::${finding.type}`;
}

test("synthetic design-partner pilot exercises canonical resolved, persistent, and new Findings", async () => {
  const { suite, baseline, candidate } = await syntheticDesignPartnerPilot();
  assert.equal(suite.scenarios.length, 4);
  assert.deepEqual(baseline.report.sourceScenarioSuite, candidate.report.sourceScenarioSuite);
  assert.equal(baseline.report.sourceScenarioSuite.id, "synthetic-design-partner-pilot-001");
  assert.equal(baseline.report.sourceScenarioSuite.version, "0.1.0");
  assert.equal(baseline.evaluation.tutor.provider, "synthetic-partner");
  assert.equal(candidate.evaluation.tutor.provider, "synthetic-partner");
  assert.equal(baseline.evaluation.tutor.promptVersion, "baseline-v1");
  assert.equal(candidate.evaluation.tutor.promptVersion, "candidate-v2");

  const before = JSON.stringify({ baseline, candidate });
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.equal(JSON.stringify({ baseline, candidate }), before);
  assert.equal(comparison.status, "comparable");
  assert.deepEqual(comparison.counts, { resolved: 1, persistent: 1, new: 1, unresolved: 0 });
  const keys = (classification: string) => comparison.findings
    .filter((item) => item.classification === classification)
    .map((item) => `${item.identity.scenarioId}::${item.identity.decisionPointId}::${item.identity.type}`);
  const resolved = keys("resolved");
  const persistent = keys("persistent");
  const newlyObserved = keys("new");
  assert.deepEqual(resolved, ["ps-first-mistake::preserve-first-attempt::premature_intervention"]);
  assert.deepEqual(persistent, ["ps-repeated-mistake::target-second-attempt::missed_repeated_misconception"]);
  assert.deepEqual(newlyObserved, ["ps-partial-progress::reinforce-correct-step::partial_progress_not_used"]);
  for (const row of comparison.findings) {
    for (const role of ["baseline", "candidate"] as const) {
      assert.equal(comparison[role].evaluation.runId, ({ baseline, candidate })[role].evaluation.runId);
      assert.match(comparison[role].evaluation.sha256, /^[a-f0-9]{64}$/);
      for (const reference of row[role].findings) {
        const finding = ({ baseline, candidate })[role].report.findings.find((item) => item.id === reference.findingId);
        assert.ok(finding);
        assert.deepEqual(reference.evidence, finding.evidence);
      }
      assert.ok(row[role].assessments[0]!.evidence.length > 0);
    }
  }
  const stillPresent = comparison.findings.find((item) => item.classification === "persistent")!;
  assert.notEqual(stillPresent.baseline.findings[0]!.findingId, stillPresent.candidate.findings[0]!.findingId);
  assert.deepEqual(parseTutorHealthComparison(JSON.parse(JSON.stringify(comparison))), comparison);
  assert.match(formatTutorHealthComparison(comparison), /resolved 1, persistent 1, new 1, unresolved 0/);

  assert.ok(
    baseline.report.findings
      .find((finding) => findingKey(finding) === resolved[0])
      ?.regressionTargets.includes("ps-first-mistake/preserve-first-attempt"),
  );
  assert.ok(
    candidate.report.findings
      .find((finding) => findingKey(finding) === newlyObserved[0])
      ?.regressionTargets.includes("ps-partial-progress/reinforce-correct-step"),
  );

  assert.equal(
    baseline.report.coverage.evaluationScope.presentCaseRunCount,
    suite.scenarios.length,
  );
  assert.equal(
    candidate.report.coverage.evaluationScope.presentCaseRunCount,
    suite.scenarios.length,
  );
});
