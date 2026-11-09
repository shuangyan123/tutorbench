import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE,
  type TutorHealthScoringProfile,
} from "../src/contracts/index.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { insufficientInformationSuite } from "./helpers/insufficient-information.js";

const fixtureTutor = {
  id: "scoring-profile-provenance-fixture",
  respond: async () => ({ text: "A controlled synthetic response." }),
};

test("unregistered suites use the same explicit unscoped profile in runner and direct report construction", async () => {
  const suite = await insufficientInformationSuite();
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor,
    runId: "unscoped-profile-default",
  });

  assert.equal(suite.id, "synthetic-insufficient-information");
  assert.deepEqual(report.scoringProfile, UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE);
  assert.notEqual(report.scoringProfile.id, "productive-struggle-intervention");

  const rebuilt = buildTutorHealthReport({ suite, evaluation });
  assert.deepEqual(rebuilt.scoringProfile, UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE);
  assert.equal(
    rebuilt.sourceEvaluation.scoringIdentity,
    report.sourceEvaluation.scoringIdentity,
  );
});

test("an explicit scoring profile overrides the unscoped default for a custom suite", async () => {
  const suite = await insufficientInformationSuite();
  const { evaluation } = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor,
    runId: "explicit-profile-override",
  });
  const explicitProfile: TutorHealthScoringProfile = {
    ...UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE,
    id: "custom-research-profile",
    version: "2.1.0",
  };

  const report = buildTutorHealthReport({
    suite,
    evaluation,
    scoringProfile: explicitProfile,
  });
  assert.deepEqual(report.scoringProfile, explicitProfile);
  assert.equal(report.sourceEvaluation.scoringIdentity, "custom-research-profile@2.1.0");
});
