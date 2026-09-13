import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRubricAuthoringAudit,
  renderRubricAuthoringAuditMarkdown,
} from "../src/audits/index.js";
import {
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
  type TutorEvalDataset,
} from "../src/contracts/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";

test("rubric authoring audit is deterministic, advisory, and read-only", async () => {
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const before = JSON.stringify(dataset);
  const first = buildRubricAuthoringAudit(dataset);
  const second = buildRubricAuthoringAudit(dataset);

  assert.equal(first.datasetId, TUTOR_EVAL_DATASET_ID);
  assert.equal(first.datasetVersion, TUTOR_EVAL_DATASET_VERSION);
  assert.equal(first.caseCount, 48);
  assert.equal(first.rubricCount, 128);
  assert.equal(first.advisoryOnly, true);
  assert.equal(first.mutatesBenchmarkData, false);
  assert.equal(first.hardGate, false);
  assert.match(first.ruleSetFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(first.reportFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(dataset), before);
});

test("rubric authoring audit preserves word-context ambiguity sentinels", async () => {
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const report = buildRubricAuthoringAudit(dataset);
  const sentinels = report.findings.filter(
    (finding) => finding.ruleId === "known_ambiguity_sentinel",
  );

  assert.deepEqual(
    sentinels.map((finding) => finding.caseId).sort(),
    ["language-word-context-001", "language-word-context-001-zh-CN"],
  );
  assert.ok(sentinels.every((finding) => finding.evidenceClass === "informational"));
  assert.ok(sentinels.every((finding) => finding.priority === "medium"));
});

test("current fraction locale pair has aligned structural signatures", async () => {
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const report = buildRubricAuthoringAudit(dataset);
  const fractionStructuralFindings = report.findings.filter(
    (finding) =>
      finding.ruleId === "cross_locale_structure" &&
      finding.crossLocaleGroupId === "fraction-misconception-001",
  );

  assert.deepEqual(fractionStructuralFindings, []);
});

test("cross-locale structure rule detects a synthetic structural drift without claiming equivalence", async () => {
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const mutated: TutorEvalDataset = {
    ...dataset,
    cases: dataset.cases.map((caseValue) => {
      if (caseValue.id !== "fraction-misconception-001-zh-CN") {
        return caseValue;
      }
      return {
        ...caseValue,
        evaluatorOnly: {
          ...caseValue.evaluatorOnly,
          rubrics: caseValue.evaluatorOnly.rubrics.map((rubric, index) =>
            index === 0 ? { ...rubric, weight: rubric.weight + 1 } : rubric,
          ),
        },
      };
    }),
  };

  const report = buildRubricAuthoringAudit(mutated);
  const finding = report.findings.find(
    (candidate) =>
      candidate.ruleId === "cross_locale_structure" &&
      candidate.crossLocaleGroupId === "fraction-misconception-001",
  );
  assert.ok(finding);
  assert.equal(finding.evidenceClass, "structural_fact");
  assert.equal(finding.priority, "high");
  assert.match(finding.evidence, /does not establish semantic or psychometric inequivalence/u);
});

test("markdown rendering states the advisory claim boundary", async () => {
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const report = buildRubricAuthoringAudit(dataset);
  const markdown = renderRubricAuthoringAuditMarkdown(report);

  assert.match(markdown, /Advisory review aid only/u);
  assert.match(markdown, /not proof that a rubric is defective/u);
  assert.match(markdown, /not a CI hard gate/u);
  assert.match(markdown, /semantic_review_candidate/u);
  assert.match(markdown, /language-word-context-001/u);
});
