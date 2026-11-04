"""Offline research: controlled text, typed model, exact solver, answer lineage."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import verify_controlled_math_statement_binding as binding
import verify_parametric_circle_line_classification as param
import verify_dual_path_math_answers as bridge

FIXTURE=ROOT/"fixtures/research/controlled-statement-math-chain-v0.1.json"


class ControlledStatementToMathEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.by={row["id"]:row for row in cls.document["cases"]}

    def test_complete_12_case_chain_with_no_false_exam_or_live_claims(self):
        result=binding.check_batch(self.document)
        self.assertEqual(result["status"],
                         "controlled_statement_math_chain_not_official_exam_certification")
        self.assertEqual(result["summary"],{
            "total":12,
            "reference_mathematically_verified":3,
            "reference_mathematically_refuted":3,
            "deterministic_no_answer_solution":4,
            "replayed_candidate_mathematically_verified":2,
            "replayed_candidate_mathematically_refuted":0,
            "unverified":0,
            "formalizationExact":12,
            "sourceLineagesIndependentlyVerified":0,
            "originalSourceAuthenticated":0,
            "officialExamGoldReleased":0,
            "genuineAIModelRuns":0,
            "measuredLiveAIAccuracy":None,
        })
        self.assertEqual({row["id"]:row["status"] for row in result["items"]},
                         {row["id"]:row["expectedStatus"] for row in self.document["cases"]})
        for row in result["items"]:
            self.assertFalse(row["officialExamGoldCertified"])
            self.assertFalse(row["originalSourceAuthenticated"])
            self.assertFalse(row["sourceLineageIndependentlyVerified"])
            self.assertFalse(row["liveAIModelCallPerformed"])
            self.assertEqual(row["formalizationStatus"],"controlled_statement_exact_roundtrip")
            self.assertEqual(len(row["statementSha256"]),64)
            self.assertEqual(len(row["typedQuestionSha256"]),64)

    def test_all_three_grammars_roundtrip_under_separate_parser(self):
        seen=set()
        for row in self.document["cases"]:
            with self.subTest(id=row["id"]):
                q=row["declaredQuestion"]
                seen.add(q["kind"])
                text=binding.render_question(q)
                self.assertEqual(text,row["statement"])
                self.assertEqual(binding.parse_statement(text),q)
                self.assertEqual(binding.sha256(text),row["statementSha256"])
                self.assertEqual(hashlib.sha256(text.encode("utf8")).hexdigest(),row["statementSha256"])
        self.assertEqual(seen,{
            "finite_arithmetic_geometric_sum",
            "circle_line_intersections",
            "parametric_circle_line_intersection_count"})

    def test_fingerprint_mismatch_blocks_even_mathematically_correct_key(self):
        row=copy.deepcopy(self.by["sequence-source-existing-correct"])
        row["statement"]=row["statement"].replace("；d=1；","；d=2；")
        item=binding.certify_one(row)
        self.assertEqual(item["status"],"unverified")
        self.assertEqual(item["reason"],"source_statement_fingerprint_mismatch")
        self.assertFalse(item["officialExamGoldCertified"])

    def test_modified_source_with_new_hash_but_old_model_is_still_rejected(self):
        for caseId,original,altered in (
            ("sequence-source-no-answer","；r=2；","；r=3；"),
            ("circle-source-tangent-correct","；c=-5。","；c=-6。"),
            ("parameter-source-one-correct","恰有 1 个","恰有 2 个"),
        ):
            row=copy.deepcopy(self.by[caseId])
            self.assertIn(original,row["statement"])
            row["statement"]=row["statement"].replace(original,altered)
            row["statementSha256"]=binding.sha256(row["statement"])
            result=binding.certify_one(row)
            self.assertEqual(result["status"],"unverified",caseId)
            self.assertEqual(result["reason"],"statement_and_declared_math_model_mismatch")

    def test_change_typed_question_without_changing_source_is_rejected(self):
        row=copy.deepcopy(self.by["parameter-source-two-no-answer"])
        row["declaredQuestion"]["query"]["intersectionCount"]=1
        self.assertEqual(binding.certify_one(row)["reason"],
                         "statement_and_declared_math_model_mismatch")
        row=copy.deepcopy(self.by["circle-source-tangent-correct"])
        row["declaredQuestion"]["line"]["c"]="-6"
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["sequence-source-no-answer"])
        row["declaredQuestion"]["model"]["termCount"]=5
        self.assertEqual(binding.certify_one(row)["status"],"unverified")

    def test_unsupported_language_and_format_must_not_be_read_as_exam_nlp(self):
        initial=self.by["circle-source-irrational-no-answer"]
        for changed in (
            "给定一个圆，求与直线的交点。",
            initial["statement"].replace("【CLPOINT-1】",""),
            initial["statement"].replace("求全部实数交点。","求有几个交点。"),
            initial["statement"].replace("；R=2；","；R=2.0；"),
            initial["statement"]+" ",
            initial["statement"].replace("；a=0；","；a=0；a=1；"),
        ):
            with self.subTest(text=changed[:40]):
                row=copy.deepcopy(initial)
                row["statement"]=changed
                row["statementSha256"]=binding.sha256(changed)
                result=binding.certify_one(row)
                self.assertEqual(result["status"],"unverified")
        self.assertEqual(binding.certify_one({**copy.deepcopy(initial),
            "statement":initial["statement"],"statementSha256":"0"*64})["status"],"unverified")

    def test_false_official_provenance_and_extra_claims_refused(self):
        row=copy.deepcopy(self.by["parameter-source-two-no-answer"])
        row["source"]["kind"]="official_exam_authenticated"
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["parameter-source-two-no-answer"])
        row["officialExamGoldCertified"]=True
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["parameter-source-two-no-answer"])
        row["source"]["paperAuthenticated"]=True
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["parameter-source-two-no-answer"])
        row["source"]["kind"]="unverified_external_transcription"
        result=binding.certify_one(row)
        self.assertEqual(result["status"],"deterministic_no_answer_solution")
        self.assertEqual(result["sourceOrigin"],"unverified_external_transcription")
        self.assertFalse(result["originalSourceAuthenticated"])
        self.assertFalse(result["officialExamGoldCertified"])

    def test_reference_contamination_raw_replay_and_source_association(self):
        row=copy.deepcopy(self.by["circle-source-irrational-no-answer"])
        row["referenceAnswer"]={"kind":"point_set","points":[]}
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["circle-source-irrational-replay"])
        row["modelAttempt"]["rawText"]="Answer: "+row["modelAttempt"]["rawText"]
        self.assertEqual(binding.certify_one(row)["status"],"unverified")
        row=copy.deepcopy(self.by["circle-source-tangent-correct"])
        row["sourceCaseId"]="gaokao-2025-national-1-q14"
        self.assertEqual(binding.certify_one(row)["status"],"unverified")

    def test_math_derivation_is_not_permitted_to_see_candidate(self):
        row=copy.deepcopy(self.by["sequence-source-existing-correct"])
        baseline=binding.certify_one(row)
        row["referenceAnswer"]="50"
        changed=binding.certify_one(row)
        self.assertEqual(baseline["exactAnswerUnderTypedModel"],"49")
        self.assertEqual(changed["exactAnswerUnderTypedModel"],"49")
        self.assertEqual(baseline["status"],"reference_mathematically_verified")
        self.assertEqual(changed["status"],"reference_mathematically_refuted")

    def test_typed_schema_and_source_ids_fail_closed(self):
        for source in (None,{},{"kind":"synthetic_controlled_statement","sourceId":"../foo"},
                       {"kind":"synthetic_controlled_statement","sourceId":"ok","url":"https://x"}):
            row=copy.deepcopy(self.by["sequence-source-no-answer"])
            row["source"]=source
            self.assertEqual(binding.certify_one(row)["status"],"unverified")
        duplicate=copy.deepcopy(self.document)
        duplicate["cases"].append(duplicate["cases"][0])
        with self.assertRaisesRegex(ValueError,"missing_or_duplicate_statement_id"):
            binding.check_batch(duplicate)

    def test_cli_recomputes_chain_no_external_requests(self):
        result=subprocess.run([sys.executable,
            str(ROOT/"scripts/research/verify_controlled_math_statement_binding.py"),
            "--fixture",str(FIXTURE),"--require-decidable"],
            capture_output=True,text=True,check=False,timeout=120)
        self.assertEqual(result.returncode,0,result.stderr)
        data=json.loads(result.stdout)
        self.assertEqual(data["summary"]["total"],12)
        self.assertEqual(data["summary"]["formalizationExact"],12)
        self.assertEqual(data["summary"]["officialExamGoldReleased"],0)
        self.assertIsNone(data["summary"]["measuredLiveAIAccuracy"])


if __name__=="__main__":
    unittest.main()
