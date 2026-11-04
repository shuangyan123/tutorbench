"""Pinned exam artifacts: source fidelity must not silently imply exam gold."""
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import audit_pinned_exam_artifacts as audit

MANIFEST=ROOT/"fixtures/research/pinned-exam-artifacts-v0.1.json"
PAPERS=ROOT/"fixtures/research/exam-source-expansion-2022-2026-v0.1.json"
LEDGER=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"


class PublicSourceByteIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=json.loads(MANIFEST.read_text(encoding="utf8"))
        cls.by={x["id"]:x for x in cls.doc["cases"]}

    def synthetic(self,index,raw):
        case=deepcopy(self.doc["cases"][index])
        case["source"]["gitBlobSha"]=audit.git_blob_sha(raw)
        return case

    def test_offline_never_falsely_claims_downloaded_external_files(self):
        report=audit.run(self.doc)
        self.assertEqual(report["summary"],{
            "total":2,"byteVerified":0,"convertedQuestionSectionLocated":0,
            "pdfQuestionsFaithfullyVerified":0,
            "sourcePaperOfficiallyAuthenticated":0,
            "typedModelsAlignedWithSourceText":0,
            "mathematicallyMatchedHypothesesOnly":0,
            "officialExamGoldReleased":0,"realModelRuns":0,
            "measuredLiveExamAccuracy":None})
        self.assertTrue(all(x["artifactStatus"]=="not_fetched" for x in report["items"]))
        self.assertTrue(all(not x["sourceOfficiallyAuthenticated"] and
                            not x["questionFormalizationVerified"] and
                            not x["officialExamGoldCertified"]
                            for x in report["items"]))

    def test_real_source_sha_matches_existing_exam_evidence_catalogs(self):
        papers=json.loads(PAPERS.read_text(encoding="utf8"))["papers"]
        entry=next(p for p in papers if p["paperId"]=="gaokao-2025-national-1")
        ours=self.by["gaokao-2025-national-1-q14"]["source"]
        for field in ("repository","revision","path","gitBlobSha"):
            self.assertEqual(ours[field],entry["source"][field])
        self.assertFalse(entry["source"]["rawPaperInspected"])
        ledger=json.loads(LEDGER.read_text(encoding="utf8"))["cases"]
        case=next(e for e in ledger if e["caseId"]=="kaoyan-math-1-2025-q20")
        conversion=next(e for e in case["sources"] if e["id"]=="tsekaluk-2025-q20")
        self.assertIn(self.by["kaoyan-math1-2025-q20"]["source"]["gitBlobSha"],
                      conversion["locator"])
        self.assertFalse(case["paperWitness"]["officialExamAuthenticated"])

    def test_byte_verified_fake_pdf_is_still_not_a_real_exam(self):
        raw=b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"
        case=self.synthetic(0,raw)
        x=audit.check_item(case,lambda _:raw)
        self.assertEqual(x["artifactStatus"],"git_blob_bytes_verified")
        self.assertEqual(x["artifactSha256"],hashlib.sha256(raw).hexdigest())
        self.assertEqual(x["questionLocatorStatus"],"pdf_binary_only_question_not_located")
        self.assertEqual(x["hypothesisMathStatus"],"typed_math_candidate_matches")
        self.assertEqual(x["hypothesisExactAnswer"],"61/25")
        self.assertEqual(x["hypothesisSourceTextAlignment"],"not_proven")
        self.assertFalse(x["officialExamGoldCertified"])
        case["hypothesis"]["referenceCandidate"]="62/25"
        wrong=audit.check_item(case,lambda _:raw)
        self.assertEqual(wrong["hypothesisMathStatus"],"typed_math_candidate_refuted")
        self.assertFalse(wrong["questionFormalizationVerified"])

    def test_markdown_section_locator_verifies_only_third_party_conversion(self):
        row=deepcopy(self.doc["cases"][1])
        part=row["locator"]["section"]
        raw=("引言\n"+part["startMarker"]+"\n"+
             "\n".join(part["requiredAnchors"])+"\n"+
             part["endMarker"]+"\n下文").encode("utf8")
        row["source"]["gitBlobSha"]=audit.git_blob_sha(raw)
        x=audit.check_item(row,lambda _:raw)
        self.assertEqual(x["artifactStatus"],"git_blob_bytes_verified")
        self.assertEqual(x["questionLocatorStatus"],
                         "pinned_conversion_section_located_not_authenticated")
        self.assertEqual(x["locatorEvidence"]["startByte"],len("引言\n".encode("utf8")))
        self.assertFalse(x["locatorEvidence"]["faithfulToOriginalExamStatement"])
        self.assertEqual(len(x["locatorEvidence"]["sectionSha256"]),64)
        self.assertFalse(x["sourceOfficiallyAuthenticated"])
        self.assertNotIn("excerpt",x["locatorEvidence"])

    def test_wrong_bytes_fail_even_if_pdf_magic_survives(self):
        raw=b"%PDF-1.4\nORIGINAL\n%%EOF"
        case=self.synthetic(0,raw)
        forged=raw.replace(b"ORIGINAL",b"MUTATED!")
        x=audit.check_item(case,lambda _:forged)
        self.assertEqual(x["artifactStatus"],"unverified")
        self.assertEqual(x["reason"],"pinned_source_blob_mismatch")
        self.assertNotIn("hypothesisExactAnswer",x)
        y=audit.check_item(case,lambda _:b"")
        self.assertEqual(y["reason"],"invalid_or_oversized_artifact_bytes")

    def test_invalid_pdf_and_nonutf8_conversion_refuse_provenance(self):
        raw=b"not a PDF"
        x=audit.check_item(self.synthetic(0,raw),lambda _:raw)
        self.assertEqual(x["reason"],"source_pdf_magic_mismatch")
        raw=b"\xff\xfe\x00\xff"
        x=audit.check_item(self.synthetic(1,raw),lambda _:raw)
        self.assertEqual(x["reason"],"source_markdown_not_utf8")

    def test_missing_duplicate_or_changed_markdown_anchors_refuse_locator(self):
        example=deepcopy(self.doc["cases"][1])
        loc=example["locator"]["section"]
        raw=(loc["startMarker"]+"\n"+"\n".join(loc["requiredAnchors"])+
             "\n"+loc["endMarker"]).encode("utf8")
        first=raw.replace(loc["requiredAnchors"][0].encode("utf8"),b"altered formula")
        x=audit.check_item(self.synthetic(1,first),lambda _:first)
        self.assertEqual(x["reason"],"section_anchor_missing_or_ambiguous")
        repeated=raw+loc["startMarker"].encode("utf8")
        x=audit.check_item(self.synthetic(1,repeated),lambda _:repeated)
        self.assertEqual(x["reason"],"section_boundary_missing_or_ambiguous")
        flipped=raw.replace(loc["endMarker"].encode("utf8"),b"end")
        x=audit.check_item(self.synthetic(1,flipped),lambda _:flipped)
        self.assertEqual(x["artifactStatus"],"unverified")

    def test_reject_untrusted_authority_source_and_unsupported_question_claim(self):
        raw=b"%PDF-1.4\n%%EOF"
        for modifier,expected in (
            (lambda x:x.update({"scope":"official_exam"}),"untrusted_official_source_claim"),
            (lambda x:x["source"].update({"revision":"main"}),"unsafe_or_unpinned_repository_path"),
            (lambda x:x["source"].update({"path":"../../private.pdf"}),"unsafe_or_unpinned_repository_path"),
            (lambda x:x["source"].update({"repository":"other/unknown"}),"unsafe_or_unpinned_repository_path"),
            (lambda x:x.update({"officialExamGoldCertified":True}),"unexpected_artifact_case_fields"),
            (lambda x:x["hypothesis"].update({"origin":"official_answer"}),"untrusted_hypothesis_claim"),
            (lambda x:x.update({"locator":{"kind":"pdf_verified_exam_question"}}),"unsupported_pdf_question_locator"),
        ):
            case=self.synthetic(0,raw)
            modifier(case)
            self.assertEqual(audit.check_item(case,lambda _:raw)["reason"],expected)

    def test_malformed_inputs_and_overlarge_artifact_fail_closed(self):
        case=deepcopy(self.doc["cases"][0])
        del case["source"]["gitBlobSha"]
        self.assertEqual(audit.check_item(case,lambda _:b"")["reason"],
                         "invalid_source_identity_schema")
        case=deepcopy(self.doc["cases"][0])
        case["questionNumber"]=True
        self.assertEqual(audit.check_item(case,lambda _:b"")["reason"],
                         "invalid_paper_or_question_identity")
        raw=b"%PDF-1.4"
        case=self.synthetic(0,raw)
        large=raw+b"X"*(audit.MAX_BLOB_BYTES+1)
        self.assertEqual(audit.check_item(case,lambda _:large)["reason"],
                         "invalid_or_oversized_artifact_bytes")
        case["hypothesis"]["typedQuestion"]["model"]["numberOfDraws"]=3.5
        self.assertEqual(audit.check_item(case,lambda _:raw)["hypothesisMathStatus"],"unverified")

    def test_duplicate_case_ids_and_cli_fail_closed_without_network(self):
        doc=deepcopy(self.doc)
        doc["cases"].append(doc["cases"][0])
        with self.assertRaisesRegex(ValueError,"duplicate"):
            audit.run(doc)
        command=[sys.executable,str(ROOT/"scripts/research/audit_pinned_exam_artifacts.py"),
                 "--manifest",str(MANIFEST)]
        result=subprocess.run(command,capture_output=True,text=True,check=False,timeout=25)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)["summary"]["byteVerified"],0)
        stricter=subprocess.run(command+["--require-byte-verification"],
                               capture_output=True,text=True,check=False,timeout=25)
        self.assertEqual(stricter.returncode,1)


if __name__=="__main__":
    unittest.main()
