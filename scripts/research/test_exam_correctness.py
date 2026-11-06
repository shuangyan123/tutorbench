"""Synthetic fail-closed controls. Private exam data never enters CI."""
from copy import deepcopy
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exam_correctness import (  # noqa: E402
    blind_worker, checked_handoff, derive_batch, digest, file_digest, final_result,
    question_input, safe_compare,
)
from exam_correctness_rules import solve_blind  # noqa: E402


def qty(value, unit="m/s^2"):
    return {"value": str(value), "unit": unit}


def acceleration():
    return {"kind": "constant_acceleration", "model": {
        "initial": qty(15, "m/s"), "final": qty(0, "m/s"), "duration": qty(3, "s"),
        "constant": True, "target": "magnitude",
    }, "options": {key: qty(value) for key, value in zip("ABCD", (2, 5, 7, 10))}}


class CorrectnessTest(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.ident = "gaokao-2026-synthetic-physics/q01"
        self.problem = acceleration()
        pdf = self.root / "source.pdf"
        pdf.write_bytes(b"%PDF-1.7\nfixture\n%%EOF\n")
        image = self.root / "crop.png"
        image.write_bytes(b"\x89PNG\r\n\x1a\nfixture")
        answer_pdf = self.root / "answer.pdf"
        answer_pdf.write_bytes(b"%PDF-1.7\nanswer fixture\n%%EOF\n")
        source_hash, answer_hash = file_digest(pdf), file_digest(answer_pdf)
        crop = {"page": 1, "sourceSha256": source_hash, "sha256": file_digest(image), "path": "crop.png"}
        self.item = {"questionId": self.ident, "paperId": "gaokao-2026-synthetic-physics", "number": 1,
                     "questionStatus": "user_supplied_assumed_correct", "questionType": "single_choice",
                     "subject": "physics", "transcriptionStatus": "transcribed", "issues": [],
                     "source": {"localPath": "source.pdf", "sha256": source_hash, "pages": [1]},
                     "displayRegions": [crop], "fields": {"options": [{"label": x} for x in "ABCD"]},
                     "answer": {"status": "user_supplied_assumed_correct", "pairing": "matched",
                                "nativeText": "B", "sourceSha256": answer_hash, "localPath": "answer.pdf",
                                "displayRegions": [{**crop, "sourceSha256": answer_hash}], "solutionRegions": []}}
        self.bank = {"questions": [self.item]}
        self.plan = {"questionId": self.ident, "questionSha256": digest(question_input(self.item)),
                     "requiredPages": [1], "sourceReview": "synthetic source review",
                     "check": {"scope": "whole-answer", "problem": self.problem}, "limitations": []}
        self.document = {"schemaVersion": 1, "items": [self.plan]}
        self.receipt = {"status": "derived", **solve_blind(self.problem)}

    def verdict(self, candidate=None, expected=None, blind=None):
        return final_result(self.root, self.plan, checked_handoff(self.bank, self.ident),
                            blind or self.receipt, "engine", None, candidate, expected)

    def test_worker_proves_choice_and_rejects_answer_fields(self):
        self.assertEqual(blind_worker(self.problem)["choice"], "B")
        self.assertEqual(blind_worker({**self.problem, "reference": "B"})["status"], "abstained")

    def test_receipt_uses_only_problem_and_ignores_reference_mutation(self):
        with patch("exam_correctness.blind_worker", return_value=self.receipt) as worker:
            receipt_a, _ = derive_batch(self.bank, self.root, self.document)
            self.item["answer"]["nativeText"] = "D"
            receipt_b, _ = derive_batch(self.bank, self.root, self.document)
        self.assertEqual(receipt_a, receipt_b)
        self.assertEqual(worker.call_args.args, (self.problem,))

    def test_correct_reference_and_wrong_reference_with_witness(self):
        self.assertEqual(self.verdict()["status"], "verified")
        self.item["answer"]["nativeText"] = "D"
        wrong = self.verdict()
        self.assertEqual(wrong["status"], "refuted")
        self.assertEqual(wrong["evidence"]["reference"]["pathA"]["evidence"]["exactResidualSI"], "15")

    def test_equivalent_units_and_wrong_sign_or_dimension(self):
        for value, status in ((qty(500, "cm/s^2"), "verified"), (qty(-5), "refuted"),
                              (qty(5, "m/s"), "refuted"), (qty(5, "arbitrary"), "abstained")):
            with self.subTest(value=value):
                self.assertEqual(safe_compare(self.problem, self.receipt, value)["status"], status)

    def test_missing_precondition_and_diagram_abstain(self):
        p = deepcopy(self.problem)
        p["model"]["constant"] = False
        self.assertEqual(blind_worker(p)["status"], "abstained")
        (self.root / "crop.png").unlink()
        receipt, _ = derive_batch(self.bank, self.root, self.document)
        self.assertEqual(receipt["results"][0]["reason"], "artifact_missing_or_overbound")

    def test_disagreement_is_neither_pass_nor_refutation(self):
        wrong_blind = {"status": "derived", "choice": "D", "derived": qty(10)}
        report = self.verdict(blind=wrong_blind)
        self.assertEqual((report["status"], report["reason"]), ("abstained", "paths_disagree"))

    def test_old_result_invalid_after_answer_record_and_bytes_change(self):
        before = self.verdict()
        self.item["answer"]["nativeText"] = "D"
        self.assertNotEqual(self.verdict()["inputSha256"], before["inputSha256"])
        self.assertEqual(self.verdict(expected=before["inputSha256"])["reason"], "stale_input_digest")
        self.item["answer"]["nativeText"] = "B"
        (self.root / "answer.pdf").write_bytes(b"%PDF-1.7\nchanged\n%%EOF")
        self.assertEqual(self.verdict()["reason"], "artifact_hash_mismatch")
        self.assertEqual(self.verdict(expected=before["inputSha256"])["reason"], "stale_input_digest")

    def test_wrong_id_and_changed_question_file_block(self):
        self.item["questionId"] = "gaokao-2026-synthetic-physics/q02"
        old, _ = derive_batch(self.bank, self.root, self.document)
        self.assertEqual(old["results"][0]["reason"], "question_not_uniquely_located")
        self.item["questionId"] = self.ident
        (self.root / "source.pdf").write_bytes(b"%PDF-1.7\nchanged\n%%EOF")
        stale, _ = derive_batch(self.bank, self.root, self.document)
        self.assertEqual(stale["results"][0]["reason"], "artifact_hash_mismatch")

    def test_wrong_reasoning_is_separate_from_correct_answer(self):
        cand = {"scope": "whole-answer", "value": qty(5), "reasoning": [{"field": "constant", "value": False}]}
        report = self.verdict(cand)
        self.assertEqual(report["candidateAnswer"]["status"], "verified")
        self.assertEqual(report["reasoning"]["status"], "refuted")
        self.assertFalse(report["reasoning"]["completeProofVerified"])
        self.assertFalse(report["formalScoringEligible"])

    def test_exact_latex_and_approximate_only(self):
        problem = {"kind": "occupancy_expectation", "model": {
            "labels": 3, "draws": 2, "uniformWithReplacement": True}, "options": {}}
        blind = solve_blind(problem)
        self.assertEqual(blind["derived"], "5/3")
        good = {"expectationLatex": r"\boxed{E[X]=\frac{10}{6}}"}
        self.assertEqual(safe_compare(problem, blind, good)["status"], "verified")
        approx = {"expectationLatex": r"\boxed{E[X]=1.66666667}"}
        self.assertEqual(safe_compare(problem, blind, approx)["status"], "abstained")
        self.assertEqual(safe_compare(problem, blind, "1.66666667")["status"], "refuted")

    def test_open_boundary_exhibits_exact_counterexample(self):
        problem = {"kind": "circle_parallel_offset_count", "model": {
            "centerResidual": "6", "normalSquared": "4", "distance": "1"}, "options": {}}
        blind = solve_blind(problem)
        wrong = {"lo": "2", "hi": "4", "leftOpen": False, "rightOpen": True}
        report = safe_compare(problem, blind, wrong)
        self.assertEqual(report["status"], "refuted")
        self.assertEqual(report["pathA"]["evidence"]["counterexample"], "2")


if __name__ == "__main__":
    unittest.main()
