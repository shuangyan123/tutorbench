import copy
import csv
import hashlib
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_exam_phase1 as audit


class ExamPhase1Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = audit.load("exam-source-expansion-2022-2026-v0.1.json")["papers"]
        cls.ledger = audit.load("exam-phase1-witnesses-2022-2026-v0.1.json")

    def test_pinned_candidate_bytes_and_duplicate_id(self):
        buffer = io.StringIO()
        fields = ("record_id", "year", "region", "paper_type", "subject", "title", "source_url",
                  "license_status", "status", "sha256", "material_type")
        writer = csv.writer(buffer)
        writer.writerow(fields)
        row = ("example", "2026", "浙江", "地方卷", "化学", "fixture", "https://example.org/p.pdf",
               "permitted", "verified", "a" * 64, "完整试卷")
        writer.writerow(row)
        raw = buffer.getvalue().encode()
        self.assertEqual(audit.source_rows(raw, audit.git_blob_sha(raw))[0]["record_id"], "example")
        with self.assertRaisesRegex(ValueError, "Git blob mismatch"):
            audit.source_rows(raw + b"\n", audit.git_blob_sha(raw))
        writer.writerow(row)
        duplicate = buffer.getvalue().encode()
        with self.assertRaisesRegex(ValueError, "duplicate candidate"):
            audit.source_rows(duplicate, audit.git_blob_sha(duplicate))

    def test_path_matching_does_not_follow_untrusted_or_mutable_aliases(self):
        prefix = "https://raw.githubusercontent.com/deekur/gaokaomath/"
        self.assertEqual(audit.exact_deekur_path(prefix + "main/a%20b.pdf"), "a b.pdf")
        self.assertIsNone(audit.exact_deekur_path(prefix + "other/a%20b.pdf"))
        self.assertIsNone(audit.exact_deekur_path(prefix + "main/a%20b.pdf?override=1"))
        self.assertIsNone(audit.exact_deekur_path(prefix.replace(".com/", ".com.example/") + "main/a.pdf"))

    def test_g0_duplicate_identity_and_reused_bytes_are_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        duplicate = copy.deepcopy(ledger["papers"][1])
        duplicate["paperId"] = "another-id-for-same-paper"
        ledger["papers"].append(duplicate)
        with self.assertRaisesRegex(ValueError, "duplicate edition identity"):
            audit.audit_witnesses(ledger, self.catalog)
        duplicate["identity"]["courseCode"] = "999"
        with self.assertRaisesRegex(ValueError, "same whole-paper bytes"):
            audit.audit_witnesses(ledger, self.catalog)

    def test_g1_public_listing_and_mirror_are_not_rights_clearance(self):
        ledger = copy.deepcopy(self.ledger)
        result = audit.audit_witnesses(ledger, self.catalog)
        self.assertEqual(result["njust-2022-physics"]["G0"], "issuer_listing_and_cover")
        self.assertEqual(result["gaokao-2025-national-1"]["G0"], "third_party_identity_unverified")
        self.assertTrue(all(x["G1"] == "rights_unverified_or_restricted" for x in result.values()))
        ledger["papers"][1]["source"]["rights"] = "permitted"
        with self.assertRaisesRegex(ValueError, "invalid provenance, rights"):
            audit.audit_witnesses(ledger, self.catalog)
        ledger["papers"][1]["source"]["rights"] = "unknown_metadata_only"
        ledger["papers"][1]["source"]["kind"] = "sample_or_syllabus"
        with self.assertRaisesRegex(ValueError, "issuer past-paper listing"):
            audit.audit_witnesses(ledger, self.catalog)
        source = ledger["papers"][1]["source"]
        source["kind"] = "issuer_past_paper_attachment"
        source["listing"] = "https://example.org/pretend-official"
        source["artifact"] = "https://example.org/fake.pdf"
        with self.assertRaisesRegex(ValueError, "issuer past-paper listing"):
            audit.audit_witnesses(ledger, self.catalog)

    def test_g2_missing_bytes_are_pending_and_corrupt_bytes_are_rejected(self):
        result = audit.audit_witnesses(self.ledger, self.catalog)
        self.assertTrue(all(x["G2"] == "recorded_sha_not_rechecked" for x in result.values()))
        data = b"%PDF-1.4\nsynthetic unit-test fixture\n%%EOF\n"
        source = {"sha256": hashlib.sha256(data).hexdigest(), "pages": 2}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.pdf"
            path.write_bytes(data.replace(b"fixture", b"mutated"))
            with self.assertRaisesRegex(ValueError, "PDF SHA-256 mismatch"):
                audit.check_pdf(path, source)
            path.write_bytes(data)
            with patch.object(audit.subprocess, "run",
                              return_value=subprocess.CompletedProcess([], 0, b"Pages: 1\n", b"")):
                with self.assertRaisesRegex(ValueError, "page count mismatch"):
                    audit.check_pdf(path, source)

    def test_g2_mirror_bytes_must_match_the_catalog_and_the_pinned_csv(self):
        data = b"%PDF-1.4\nsynthetic source"
        sha = hashlib.sha256(data).hexdigest()
        paper_id = "gaokao-2025-test"
        catalog = [{"exam": "gaokao", "paperId": paper_id, "source": {"gitBlobSha": audit.git_blob_sha(data)}}]
        evidence = {"catalogPdfSha256": {paper_id: sha}, "equalMirrorPaperIds": [paper_id]}
        crosswalk = {"mathExactSourcePathMatches": [{"tutorBenchPaperId": paper_id, "upstreamRecordId": "x"}],
                     "mathUnresolved": []}
        rows = {"x": {"sha256": sha}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / f"{paper_id}.pdf").write_bytes(data)
            mirrors = root / "mirrors"
            mirrors.mkdir()
            mirror = mirrors / f"{paper_id}.pdf"
            mirror.write_bytes(data)
            report = audit.audit_math_files(evidence, rows, crosswalk, catalog, root)
            self.assertEqual(report["catalogPdfsRechecked"], 1)
            self.assertEqual(report["mirrorsRechecked"], 1)
            mirror.write_bytes(data + b"tampered")
            with self.assertRaisesRegex(ValueError, "mirror SHA-256 mismatch"):
                audit.audit_math_files(evidence, rows, crosswalk, catalog, root)

    def test_g3_cross_page_figure_is_bound_to_its_question_and_never_promotes(self):
        ledger = copy.deepcopy(self.ledger)
        question = ledger["papers"][1]["inventory"]["questions"][7]
        self.assertEqual(question["id"], "A.8")
        self.assertEqual(question["stemPage"], 2)
        self.assertEqual(question["figures"], [{"id": "figure-2", "page": 1}])
        result = audit.audit_witnesses(ledger, self.catalog)
        self.assertTrue(all(x["G3"] == "original_to_candidate_comparison_unverified"
                            and x["sourceQualifiedQuestions"] == 0 for x in result.values()))
        question["figures"][0]["page"] = 3
        with self.assertRaisesRegex(ValueError, "invalid figure or formula observation"):
            audit.audit_witnesses(ledger, self.catalog)
        question["figures"][0]["page"] = 1
        question["comparisonVerified"] = True
        with self.assertRaisesRegex(ValueError, "unexpected question fields"):
            audit.audit_witnesses(ledger, self.catalog)

    def test_g4_missing_question_stays_in_denominator(self):
        ledger = copy.deepcopy(self.ledger)
        actual = audit.audit_witnesses(ledger, self.catalog)
        self.assertEqual({paper: x["locatedQuestions"] for paper, x in actual.items()}, {
            "gaokao-2025-national-1": 19, "njust-2022-physics": 25,
            "njust-2022-chemistry": 38, "njust-2022-biology": 36,
        })
        questions = ledger["papers"][0]["inventory"]["questions"]
        missing = questions.pop()["id"]
        report = audit.audit_witnesses(ledger, self.catalog)["gaokao-2025-national-1"]
        self.assertEqual(report["G4"], "incomplete_inventory")
        self.assertEqual(report["witnessQuestions"], 19)
        self.assertEqual(report["locatedQuestions"], 18)
        self.assertEqual(report["missingQuestionIds"], [missing])
        questions.append(questions[0])
        with self.assertRaisesRegex(ValueError, "duplicate or unexpected question ID"):
            audit.audit_witnesses(ledger, self.catalog)

    def test_open_science_scope_cannot_be_hidden(self):
        ledger = copy.deepcopy(self.ledger)
        ledger["openScope"].pop("gaokaoScience")
        with self.assertRaisesRegex(ValueError, "unbounded science target scope"):
            audit.audit_witnesses(ledger, self.catalog)


if __name__ == "__main__":
    unittest.main()
