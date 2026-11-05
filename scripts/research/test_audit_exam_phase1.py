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
from exam_phase1_evidence import COMPARISON_CHECKS, GATES, accepted_scope, exact_attachment
from replay_exam_phase1_sources import download_public, raw_url


class ExamPhase1Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = audit.load("exam-source-expansion-2022-2026-v0.1.json")["papers"]
        cls.ledger = audit.load("exam-phase1-witnesses-2022-2026-v0.1.json")
        cls.reviews = audit.load("exam-phase1-source-review-2022-2026-v0.1.json")["papers"]

    def inspect(self, ledger=None, reviews=None):
        return audit.audit_witnesses(self.ledger if ledger is None else ledger, self.catalog,
                                     reviews=self.reviews if reviews is None else reviews)

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
            self.inspect(ledger)
        duplicate["identity"]["variant"] = "alternate-scan"
        with self.assertRaisesRegex(ValueError, "duplicate edition identity"):
            self.inspect(ledger)
        duplicate["identity"]["courseCode"] = "999"
        with self.assertRaisesRegex(ValueError, "same whole-paper bytes"):
            self.inspect(ledger)

    def test_leads_cover_frozen_candidates_without_promoting_source_identity(self):
        leads = audit.load("exam-phase1-source-leads-2022-2026-v0.1.json")
        cross = audit.load("exam-science-source-reconciliation-2022-2026-v0.1.json")
        candidates = {x["upstreamRecordId"]: x["year"] for x in cross["mathUnresolved"]}
        triage = leads["unmatchedMathTriage"]
        self.assertEqual(len(triage), len(candidates))
        self.assertEqual({x["recordId"] for x in triage}, candidates.keys())
        by_id = {p["paperId"]: p for p in self.catalog}
        for entry in triage:
            if (alias := entry["possibleCatalogId"]) is not None:
                self.assertEqual(by_id[alias]["year"], candidates[entry["recordId"]])
                self.assertEqual(entry["status"], "metadata_only_unverified")
        self.assertEqual({x["paperId"] for x in leads["postgraduateMath2026"]},
                         {f"kaoyan-math-{n}-2026" for n in (1, 2, 3)})
        self.assertTrue(all(x["officialIdentity"] == "unverified" and x["questionDenominator"] is None
                            for x in leads["postgraduateMath2026"]))
        self.assertTrue(all(x["paperArtifact"] == "unverified" for x in leads["gaokaoScienceEditionLeads"]))

    def test_g1_public_listing_and_mirror_are_not_rights_clearance(self):
        ledger = copy.deepcopy(self.ledger)
        result = self.inspect(ledger)
        self.assertEqual(result["njust-2022-physics"]["issuerIdentity"], "reviewed_publisher")
        self.assertEqual(result["njust-2022-physics"]["attachmentLink"], "unverified")
        self.assertEqual(result["gaokao-2025-national-1"]["issuerIdentity"], "unverified")
        self.assertTrue(all(x["officialOriginal"] == "unverified" and x["G1"] == "unverified"
                            for x in result.values()))
        ledger["papers"][1]["source"]["rights"] = "permitted"
        with self.assertRaisesRegex(ValueError, "invalid provenance, rights"):
            self.inspect(ledger)
        ledger["papers"][1]["source"]["rights"] = "unknown_metadata_only"
        ledger["papers"][1]["source"]["kind"] = "sample_or_syllabus"
        with self.assertRaisesRegex(ValueError, "not an exam-paper witness"):
            self.inspect(ledger)

    def test_actual_anchor_must_bind_the_exact_attachment(self):
        listing = "https://publisher.example/index/list.html"
        expected = "https://publisher.example/papers/2023.pdf"
        self.assertTrue(exact_attachment(b'<a href="../papers/2023.pdf">paper</a>', listing, expected))
        for html in (b'<a href="../papers/2022.pdf">2023.pdf</a>',
                     b'<a href="../papers/2023.pdf?version=other">2023.pdf</a>',
                     b'<a href="https://fake.example/papers/2023.pdf">paper</a>',
                     b'<script><a href="../papers/2023.pdf">fake</a></script>'):
            self.assertFalse(exact_attachment(html, listing, expected))

    def test_automatic_replay_is_allowlisted_and_does_not_take_mutable_paths(self):
        with self.assertRaisesRegex(ValueError, "unsafe or unpinned"):
            raw_url("deekur/gaokaomath", "main", "paper.pdf")
        with self.assertRaisesRegex(ValueError, "unsafe or unpinned"):
            raw_url("deekur/gaokaomath", "a" * 40, "../paper.pdf")
        with self.assertRaisesRegex(ValueError, "not allowlisted"):
            download_public("https://example.org/paper.pdf")

    def test_g2_missing_bytes_are_pending_and_corrupt_bytes_are_rejected(self):
        result = self.inspect()
        self.assertTrue(all(x["G2"] == "unverified" for x in result.values()))
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
            result = audit.audit_math_files(evidence, rows, crosswalk, catalog, root)
            self.assertEqual(result["files"][f"mirrors/{paper_id}.pdf"], "conflict")
            self.assertEqual(result["mirrorsRechecked"], 0)

    def test_g4_cross_page_figures_tables_and_options(self):
        changes = [
            ("njust-2022-physics", "A.8", {"pages": [2], "figures": []}),
            ("njust-2022-chemistry", "D.2", {"pages": [2], "figures": [{"id": "table-1", "page": 2}]}),
            ("njust-2022-biology", "C.9", {"options": 0}),
            ("njust-2022-biology", "C.9", {"pages": [2], "stemPage": 2}),
        ]
        for paper_id, qid, change in changes:
            with self.subTest(paper=paper_id, change=change):
                ledger = copy.deepcopy(self.ledger)
                paper = next(p for p in ledger["papers"] if p["paperId"] == paper_id)
                next(q for q in paper["inventory"]["questions"] if q["id"] == qid).update(change)
                result = self.inspect(ledger)[paper_id]
                self.assertEqual(result["G4"], "conflict")
                self.assertIn(qid, result["locatorConflicts"])

    def test_g4_whole_section_and_subpart_cannot_change_the_denominator(self):
        ledger = copy.deepcopy(self.ledger)
        math = ledger["papers"][0]["inventory"]
        del math["sections"]["B"]
        math["questions"] = [x for x in math["questions"] if not x["id"].startswith("B.")]
        result = self.inspect(ledger)["gaokao-2025-national-1"]
        self.assertEqual(result["G4"], "conflict")
        self.assertEqual(result["expectedQuestions"], 19)
        self.assertEqual(result["locatedQuestions"], 16)
        self.assertEqual(result["missingQuestionIds"], ["B.9", "B.10", "B.11"])
        math["questions"].append({**math["questions"][-1], "id": "D.20"})
        self.assertEqual(self.inspect(ledger)["gaokao-2025-national-1"]["locatorConflicts"]["D.20"],
                         "not_a_source_top_level_question")
        math["questions"].append(math["questions"][0])
        with self.assertRaisesRegex(ValueError, "duplicate or invalid top-level"):
            self.inspect(ledger)

    def test_real_locator_inventory_is_partial_source_coverage(self):
        actual = self.inspect()
        self.assertEqual({key: x["locatedQuestions"] for key, x in actual.items()}, {
            "gaokao-2025-national-1": 19, "njust-2022-physics": 25,
            "njust-2022-chemistry": 38, "njust-2022-biology": 36,
            "njust-2023-physics-a": 21, "njust-2023-physics-b": 23,
            "njust-2023-biology": 20, "njust-2023-chemistry": 42,
        })
        self.assertTrue(all(x["inventoryAgainstPageReview"] == "passed" and x["G4"] == "unverified"
                            and x["sourceComparedQuestions"] == x["sourceQualifiedQuestions"] == 0
                            for x in actual.values()))
        reviews = copy.deepcopy(self.reviews)
        reviews["njust-2022-biology"]["pageReview"] = None
        result = self.inspect(reviews=reviews)["njust-2022-biology"]
        self.assertIsNone(result["expectedQuestions"])
        self.assertEqual(result["locatedQuestions"], 0)
        self.assertEqual(result["recordedLocators"], 36)

    def test_open_scope_remains_open_even_if_a_paper_passes(self):
        result = accepted_scope(["test-paper"], {"science": {"status": "open", "reason": "test gap"}},
                                {"test-paper": {**dict.fromkeys(GATES, "passed"), "expectedQuestions": 2}})
        self.assertFalse(result["complete"])
        self.assertIsNone(result["phaseQuestionDenominator"])


def synthetic_pdf(cover_label):
    first = b"BT /F1 12 Tf 72 720 Td (" + cover_label + b") Tj 0 -30 Td (A.1 synthetic stem and two subparts) Tj ET"
    second = (
        b"BT /F1 12 Tf 72 720 Td (A.1 continued with options A B C D) Tj "
        b"0 -120 Td (B.1 synthetic stem) Tj ET 100 625 20 20 re S"
    )

    def content(stream):
        return b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        content(first),
        content(second),
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for number, value in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n".encode() + value + b"\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    pdf += b"".join(f"{n:010d} 00000 n \n".encode() for n in offsets)
    return pdf + f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()


class AcceptanceFixtureTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.issuer_patch = patch.dict(audit.ISSUER_HOSTS, {"Fixture University": "issuer.example"})
        self.issuer_patch.start()
        self.addCleanup(self.issuer_patch.stop)
        self.pid = "synthetic-2026-physics"
        self.pdf = synthetic_pdf(b"2026 Fixture University Physics 845")
        self.html = b'<a href="2026.pdf">Physics 845</a>'
        self.review = {"reviewer": "synthetic-reviewer", "date": "2026-11-05",
                       "record": "https://records.example/synthetic-review"}
        cover = {"issuer": "Fixture University", "year": 2026, "courseName": "Physics", "courseCode": "845"}
        self.paper = {
            "paperId": self.pid,
            "identity": {**cover, "exam": "postgraduate_self_set", "subject": "物理", "variant": "test",
                         "editionType": "institution", "difficulty": "unrated"},
            "source": {"kind": "issuer_past_paper_attachment", "listing": "https://issuer.example/index.html",
                       "artifact": "https://issuer.example/2026.pdf", "rights": "restricted_metadata_only",
                       "sha256": self.sha(self.pdf), "pages": 2},
            "inventory": {"sections": {"A": [1, 1], "B": [1, 1]}, "questions": [
                {"id": "A.1", "pages": [1, 2], "stemPage": 1, "figures": [{"id": "figure-1", "page": 2}],
                 "notation": "seen", "numberedParts": 2, "options": 4},
                {"id": "B.1", "pages": [2], "stemPage": 2, "figures": [],
                 "notation": "not_seen", "numberedParts": 0, "options": 0},
            ]},
        }
        original, rights = b"fixture original confirmation", b"fixture internal research permission"
        self.evidence = {
            "artifactSha256": self.sha(self.pdf),
            "issuerListing": {"url": "https://issuer.example/index.html", "sha256": self.sha(self.html), "review": self.review},
            "cover": cover.copy(),
            "pages": [{"starts": {"A": [1, 1]}, "continuations": [], "figures": {}},
                      {"starts": {"B": [1, 1]}, "continuations": ["A.1"],
                       "figures": {"A.1": ["figure-1"]}, "optionCounts": {"A.1": 4}}],
            "pageReview": self.review,
            "editionResolution": {"decision": "unique", "review": self.review},
            "officialOriginal": {"url": "https://issuer.example/confirmation", "sha256": self.sha(original), "review": self.review},
            "researchRights": {"basis": "https://issuer.example/rights", "sha256": self.sha(rights),
                               "decision": "allowed_for_internal_research", "review": self.review},
            "comparisons": [], "difficultyReview": None,
        }
        (self.root / f"{self.pid}.pdf").write_bytes(self.pdf)
        (self.root / f"{self.pid}.html").write_bytes(self.html)
        (self.root / "proofs").mkdir()
        (self.root / f"proofs/{self.pid}.original").write_bytes(original)
        (self.root / f"proofs/{self.pid}.rights").write_bytes(rights)
        (self.root / f"comparisons/{self.pid}").mkdir(parents=True)
        for qid in ("A.1", "B.1"):
            candidate = ('{"syntheticQuestion":"' + qid + '"}').encode()
            (self.root / f"comparisons/{self.pid}/{qid}.json").write_bytes(candidate)
            self.evidence["comparisons"].append({
                "id": qid, "sourceSha256": self.sha(self.pdf), "candidateSha256": self.sha(candidate),
                "checks": sorted(COMPARISON_CHECKS), "decision": "match", "review": self.review,
            })

    @staticmethod
    def sha(data):
        return hashlib.sha256(data).hexdigest()

    def inspect(self):
        ledger = {"schemaVersion": 2, "mathFiles": {}, "papers": [self.paper]}
        return audit.audit_witnesses(ledger, [], self.root, reviews={self.pid: self.evidence})[self.pid]

    def test_complete_synthetic_source_passes_all_gates_and_strict_exit(self):
        result = self.inspect()
        self.assertTrue(all(result[g] == "passed" for g in GATES))
        self.assertEqual([result[k] for k in ("expectedQuestions", "locatedQuestions",
                                              "sourceComparedQuestions", "sourceQualifiedQuestions")], [2] * 4)
        self.assertEqual(result["redistributionRights"], "restricted_metadata_only")
        scope = accepted_scope([self.pid], {}, {self.pid: result})
        self.assertTrue(scope["complete"])
        self.assertEqual(audit.exit_status({"acceptance": scope}, require_complete=True), 0)

    def test_difficulty_requires_a_reviewed_complete_subject_profile(self):
        self.paper["identity"]["difficulty"] = "integrative"
        with self.assertRaisesRegex(ValueError, "lacks reviewed evidence"):
            self.inspect()
        self.evidence["difficultyReview"] = {
            "protocol": "within-subject-demand-v1", "basis": "synthetic subject review",
            "questionBands": {"A.1": "integrative", "B.1": "foundational"}, "review": self.review,
        }
        with self.assertRaisesRegex(ValueError, "lacks a full reviewed majority"):
            self.inspect()
        self.evidence["difficultyReview"]["questionBands"]["B.1"] = "integrative"
        self.assertEqual(self.inspect()["difficultyEvidence"], "reviewed")

    def test_wrong_pdf_and_cover_values_block(self):
        artifact = self.root / f"{self.pid}.pdf"
        artifact.write_bytes(synthetic_pdf(b"2025 Fixture University Physics 845"))
        self.assertEqual(self.inspect()["G2"], "conflict")
        artifact.write_bytes(self.pdf)
        for key, value in (("year", 2025), ("courseCode", "614"),
                           ("issuer", "Different University"), ("courseName", "Chemistry")):
            with self.subTest(key=key):
                previous = self.evidence["cover"][key]
                self.evidence["cover"][key] = value
                result = self.inspect()
                self.assertEqual(result["coverIdentity"], "conflict")
                self.assertEqual(result["G0"], "conflict")
                self.evidence["cover"][key] = previous

    def test_wrong_attachment_and_forged_listing_paths_block(self):
        original = self.paper["source"]["artifact"]
        self.paper["source"]["artifact"] = "https://issuer.example/2025.pdf"
        self.assertEqual(self.inspect()["attachmentLink"], "conflict")
        self.paper["source"]["artifact"] = original
        self.paper["source"]["listing"] = "https://issuer.example/forged-index.html"
        self.assertEqual(self.inspect()["issuerIdentity"], "unverified")
        self.assertEqual(self.inspect()["G0"], "unverified")

    def test_missing_and_conflicting_review_proof_revoke_acceptance(self):
        (self.root / f"proofs/{self.pid}.original").unlink()
        self.assertEqual(self.inspect()["officialOriginal"], "unavailable")
        self.assertEqual(self.inspect()["sourceQualifiedQuestions"], 0)
        (self.root / f"proofs/{self.pid}.original").write_bytes(b"contradictory proof")
        self.assertEqual(self.inspect()["G1"], "conflict")

    def test_partial_and_conflicting_question_comparisons(self):
        (self.root / f"comparisons/{self.pid}/B.1.json").unlink()
        result = self.inspect()
        self.assertEqual(result["missingComparisonArtifacts"], ["B.1"])
        self.assertEqual(result["sourceComparedQuestions"], 1)
        self.assertEqual(result["sourceQualifiedQuestions"], 1)
        self.assertEqual(result["G3"], "unverified")
        phase = accepted_scope([self.pid], {}, {self.pid: result})
        self.assertEqual(audit.exit_status({"acceptance": phase}, require_complete=True), 1)
        self.evidence["comparisons"][0]["decision"] = "mismatch"
        self.assertEqual(self.inspect()["G3"], "conflict")
        self.assertEqual(self.inspect()["sourceQualifiedQuestions"], 0)

if __name__ == "__main__":
    unittest.main()
