"""Offline regression tests for blind human semantic review; no provider calls."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import review_deepseek_learner_state_contrasts as review
import run_deepseek_learner_state_contrasts as study
import test_run_deepseek_learner_state_contrasts as fixtures


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.packet = self.root / "frozen-input.json"
        self.doc = fixtures.fixture()
        self.packet.write_text(json.dumps(self.doc, ensure_ascii=False), encoding="utf8")
        self.runs = []
        for effort in study.EFFORTS:
            path = self.root / f"{effort}.jsonl"
            study.write_run(self.doc, self.doc["cases"], effort, "test-fixture-key",
                            30, path, fixtures.fake_response)
            self.runs.append(str(path))

    def prepared(self):
        packet, rows = review.verified_rows(self.packet, self.runs, require_full=True)
        out = self.root / "review"
        report = review.export_blind(packet, rows, out, "reviewer-a")
        return out, report

    def test_full_integrity_audit_and_coverage(self):
        packet, rows = review.verified_rows(self.packet, self.runs, require_full=True)
        self.assertEqual(packet["id"], "learner-state-contrast-tutor-packets")
        self.assertEqual(len(rows), 20)
        summary = review.status_summary(rows)
        self.assertEqual(summary["attemptCoverage"], "20/20")
        self.assertEqual(summary["efforts"]["high"]["ok"], 10)
        self.assertEqual(summary["efforts"]["max"]["ok"], 10)
        self.assertIsNone(summary["automaticTeachingScore"])

    def test_partial_is_auditable_but_not_review_ready(self):
        packet, rows = review.verified_rows(self.packet, [self.runs[0]])
        self.assertEqual(len(rows), 10)
        self.assertEqual(review.status_summary(rows)["efforts"]["max"]["missingAttempts"], 10)
        with self.assertRaisesRegex(review.AuditError, "incomplete_attempts"):
            review.verified_rows(self.packet, [self.runs[0]], require_full=True)

    def test_reject_duplicate_attempts(self):
        with self.assertRaisesRegex(review.AuditError, "duplicate_case_effort"):
            review.verified_rows(self.packet, self.runs + [self.runs[0]])

    def test_reject_corrupt_request_hash(self):
        source = Path(self.runs[0]).read_text(encoding="utf8").splitlines()
        changed = json.loads(source[1])
        changed["requestSha256"] = "0" * 64
        source[1] = json.dumps(changed)
        Path(self.runs[0]).write_text("\n".join(source) + "\n", encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "response_request_or_identity_mismatch"):
            review.verified_rows(self.packet, self.runs)

    def test_reject_mutated_response_text(self):
        source = Path(self.runs[0]).read_text(encoding="utf8").splitlines()
        changed = json.loads(source[1])
        changed["finalText"] = "secretly edited"
        source[1] = json.dumps(changed)
        Path(self.runs[0]).write_text("\n".join(source) + "\n", encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "invalid_ok_response_or_text_hash"):
            review.verified_rows(self.packet, self.runs)

    def test_reject_run_metadata_drift(self):
        source = Path(self.runs[0]).read_text(encoding="utf8").splitlines()
        changed = json.loads(source[0])
        changed["promptSha256"] = "0" * 64
        source[0] = json.dumps(changed)
        Path(self.runs[0]).write_text("\n".join(source) + "\n", encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "run_metadata_not_bound_to_frozen_study"):
            review.verified_rows(self.packet, self.runs)

    def test_blind_packet_omits_effort_authored_expectations_and_mapping(self):
        path, report = self.prepared()
        packet = review.read_json(path / "reviewer-packet.json")
        template = review.read_json(path / "submission-template.json")
        self.assertEqual(len(packet["tasks"]), 20)
        self.assertEqual(len(template["items"]), 20)
        self.assertEqual(packet["taskSetFingerprint"], template["taskSetFingerprint"])
        self.assertEqual(report["reviewable"], 20)
        self.assertEqual(len({v["taskId"] for v in packet["tasks"]}), 20)
        visible = json.dumps(packet, ensure_ascii=False)
        for forbidden in ("reasoningContent", "authorExpectation", "reasoning_effort",
                          '"effort"', '"caseId"', '"pairId"', '"operator"', "deepseek-flash"):
            self.assertNotIn(forbidden, visible)
        self.assertIn("你为什么", visible)
        self.assertTrue((path / "operator-mapping.json").exists())
        with self.assertRaises(FileExistsError):
            review.export_blind(self.doc, [], path, "reviewer-a")

    def test_incomplete_or_unrated_submission_is_rejected(self):
        path, _ = self.prepared()
        template = review.read_json(path / "submission-template.json")
        submitted = self.root / "unrated.json"
        submitted.write_text(json.dumps(template, ensure_ascii=False), encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "unrated_or_invalid_semantic_label"):
            review.import_review(path, submitted, self.root / "analysis")

    def completed(self, path):
        template = review.read_json(path / "submission-template.json")
        for index, item in enumerate(template["items"]):
            item["evidenceFit"] = "PASS" if index % 2 == 0 else "PARTIAL"
            item["instructionalSupport"] = "PASS"
            item["unsupportedDiagnosis"] = "NONE"
            item["factualIntegrity"] = "PASS"
            item["evidence"] = "" if index % 2 == 0 else "证据原文。 引号“原样”保留！ \n"
        submit = self.root / "reviewer-submission.json"
        submit.write_text(json.dumps(template, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf8")
        return submit

    def test_verbatim_freeze_before_unseal_and_no_model_winner(self):
        path, _ = self.prepared()
        sub = self.completed(path)
        original = sub.read_bytes()
        result = review.import_review(path, sub, self.root / "analysis")
        self.assertEqual(result["reviewed"], 20)
        self.assertEqual((self.root / "analysis" / "original-submission.json").read_bytes(), original)
        comparison = review.read_json(self.root / "analysis" / "descriptive-comparison.json")
        self.assertEqual(comparison["originalSubmissionSha256"], review.sha_bytes(original))
        self.assertEqual(len(comparison["pairs"]), 5)
        self.assertEqual(comparison["reviewed"], 20)
        self.assertTrue(comparison["notGold"])
        self.assertTrue(comparison["notHumanHumanAgreement"])
        self.assertEqual(comparison["realLearnerOutcome"], "not_measured")
        self.assertNotIn("modelWinner", comparison)
        self.assertIn("证据原文。 引号“原样”保留！ \n",
                      json.dumps(comparison, ensure_ascii=False))
        with self.assertRaises(FileExistsError):
            review.import_review(path, sub, self.root / "analysis")

    def test_missing_evidence_for_partial_is_rejected(self):
        path, _ = self.prepared()
        sub = self.completed(path)
        template = review.read_json(sub)
        partial = next(x for x in template["items"] if x["evidenceFit"] == "PARTIAL")
        partial["evidence"] = "  "
        sub.write_text(json.dumps(template, ensure_ascii=False), encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "nonpass_rating_needs_evidence"):
            review.import_review(path, sub, self.root / "analysis")

    def test_bad_fingerprint_and_duplicate_task_rejected(self):
        path, _ = self.prepared()
        sub = self.completed(path)
        template = review.read_json(sub)
        template["taskSetFingerprint"] = "bad"
        sub.write_text(json.dumps(template, ensure_ascii=False), encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "submission_protocol_identity_or_coverage"):
            review.import_review(path, sub, self.root / "analysis")
        template["taskSetFingerprint"] = review.read_json(path / "reviewer-packet.json")["taskSetFingerprint"]
        template["items"][1]["taskId"] = template["items"][0]["taskId"]
        sub.write_text(json.dumps(template, ensure_ascii=False), encoding="utf8")
        with self.assertRaisesRegex(review.AuditError, "unknown_or_duplicate_review_task"):
            review.import_review(path, sub, self.root / "analysis")


if __name__ == "__main__":
    unittest.main()
