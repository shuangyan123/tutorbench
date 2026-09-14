import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCanonicalCalibrationPilotBundle,
  buildEnglishOnlyHumanReferencePilotBundle,
  ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID,
  ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION,
  importEnglishOnlyHumanReferencePilotSubmission,
  type EnglishOnlyHumanReferencePilotSubmissionTemplate,
} from "../src/calibration/index.js";
import { type CalibrationLabel } from "../src/contracts/index.js";

function completeSubmission(
  template: EnglishOnlyHumanReferencePilotSubmissionTemplate,
  labelFor: (index: number) => CalibrationLabel,
): unknown {
  return {
    ...template,
    completedAt: "2026-09-14T06:15:00.000Z",
    annotations: template.annotations.map((slot, index) => {
      const label = labelFor(index);
      return {
        ...slot,
        label,
        evidence: "Synthetic regression evidence.",
        ambiguity: label === "UNSURE"
          ? { present: true, reason: "Synthetic regression ambiguity." }
          : { present: false, reason: "" },
      };
    }),
  };
}

test("English-only pilot freezes a distinct eight-case task identity", async () => {
  const bundle = await buildEnglishOnlyHumanReferencePilotBundle([
    "reviewer-a",
    "reviewer-b",
  ]);
  assert.equal(bundle.manifest.pilotId, ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_ID);
  assert.equal(bundle.manifest.pilotVersion, ENGLISH_ONLY_HUMAN_REFERENCE_PILOT_VERSION);
  assert.equal(bundle.manifest.datasetVersion, "0.2a.6");
  assert.equal(bundle.manifest.caseCount, 8);
  assert.equal(bundle.manifest.responseCount, 24);
  assert.equal(bundle.manifest.rubricJudgmentCountPerReviewer, 69);
  assert.equal(bundle.manifest.reviewerCount, 2);
  assert.equal(bundle.candidates.responses.length, 24);
  assert.equal(bundle.packet.entries.length, 69);
  assert.equal(bundle.templates.length, 2);
  assert.ok(bundle.templates.every((template) => template.annotations.length === 69));
  assert.ok(bundle.templates.every((template) => template.completedAt === ""));
  assert.ok(bundle.manifest.taskSetFingerprint.startsWith("sha256:"));
  assert.ok(bundle.manifest.annotationGuideFingerprint.startsWith("sha256:"));
  assert.ok(bundle.manifest.selectedCases.every((caseValue) => caseValue.locale === "en"));
  assert.ok(!bundle.manifest.selectedCases.some((caseValue) => caseValue.caseId.endsWith("-zh-CN")));
  assert.ok(!bundle.candidates.responses.some((response) => response.caseId.endsWith("-zh-CN")));
  assert.ok(!bundle.packet.entries.some((entry) => entry.caseId.endsWith("-zh-CN")));

  const reviewerVisible = JSON.stringify({
    packet: bundle.packet,
    templates: bundle.templates,
    guide: bundle.annotationGuide,
  });
  assert.doesNotMatch(
    reviewerVisible,
    /"provider"|"model"|"modelVersion"|"promptVersion"|"expectedLabel"|"judgeResult"/u,
  );
});

test("English-only task-set fingerprint is reviewer-independent and differs from canonical", async () => {
  const left = await buildEnglishOnlyHumanReferencePilotBundle(["reviewer-a", "reviewer-b"]);
  const right = await buildEnglishOnlyHumanReferencePilotBundle(["reviewer-x", "reviewer-y"]);
  const canonical = await buildCanonicalCalibrationPilotBundle(["reviewer-a", "reviewer-b"]);
  assert.equal(left.manifest.taskSetFingerprint, right.manifest.taskSetFingerprint);
  assert.notEqual(left.manifest.taskSetFingerprint, canonical.manifest.taskSetFingerprint);
  assert.notEqual(left.templates[0]?.pilotId, canonical.templates[0]?.pilotId);
});

test("English-only import accepts its exact template and fails closed on identity changes", async () => {
  const bundle = await buildEnglishOnlyHumanReferencePilotBundle([
    "reviewer-a",
    "reviewer-b",
  ]);
  const template = bundle.templates[0]!;
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(template, template),
  );

  const completed = completeSubmission(template, () => "PASS");
  const imported = await importEnglishOnlyHumanReferencePilotSubmission(template, completed);
  assert.equal(imported.dataKind, "human-annotation");
  assert.equal(imported.reviewerId, "reviewer-a");
  assert.equal(imported.annotations.length, 69);
  assert.ok(imported.annotations.every((annotation) => annotation.label === "PASS"));

  const completedRecord = completed as Record<string, unknown>;
  const annotations = completedRecord.annotations as readonly unknown[];
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(template, {
      ...completedRecord,
      taskSetFingerprint: "sha256:stale",
    }),
  );
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(template, {
      ...completedRecord,
      pilotId: "canonical-tutoreval-human-calibration-pilot-001",
    }),
  );
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(template, {
      ...completedRecord,
      annotations: annotations.slice(1),
    }),
  );
});

test("canonical and English-only submission templates are not interchangeable", async () => {
  const english = await buildEnglishOnlyHumanReferencePilotBundle(["reviewer-a", "reviewer-b"]);
  const canonical = await buildCanonicalCalibrationPilotBundle(["reviewer-a", "reviewer-b"]);
  const canonicalTemplate = canonical.templates[0]!;
  const canonicalCompleted = {
    ...canonicalTemplate,
    completedAt: "2026-09-14T06:15:00.000Z",
    annotations: canonicalTemplate.annotations.map((slot) => ({
      ...slot,
      label: "PASS",
      evidence: "",
      ambiguity: { present: false, reason: "" },
    })),
  };
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(english.templates[0], canonicalCompleted),
  );
  await assert.rejects(
    importEnglishOnlyHumanReferencePilotSubmission(canonicalTemplate, canonicalCompleted),
  );
});
