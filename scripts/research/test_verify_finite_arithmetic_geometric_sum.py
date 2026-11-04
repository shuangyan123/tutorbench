"""Independent exact arithmetic-geometric sequence verification and dual-path safety."""
import copy
from fractions import Fraction
import json
from pathlib import Path
import random
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import verify_finite_arithmetic_geometric_sum as seq
import verify_dual_path_math_answers as bridge

CASES=ROOT/"fixtures/research/finite-arithmetic-geometric-sum-v0.1.json"
LEDGER=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"


def question(a="1",d="1",r="2",n=4):
    return {"kind":"finite_arithmetic_geometric_sum",
            "model":{"firstTerm":a,"commonDifference":d,"commonRatio":r,"termCount":n},
            "query":{"metric":"sum"}}


class ArithmeticGeometricSequenceResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document=json.loads(CASES.read_text(encoding="utf8"))
        cls.sources=bridge.source_ledger(json.loads(LEDGER.read_text(encoding="utf8")))

    def test_frozen_13_synthetic_cases_and_accurate_provenance(self):
        report=bridge.run(self.document,json.loads(LEDGER.read_text(encoding="utf8")))
        summary=report["summary"]
        self.assertEqual(summary,{
            "total":13,
            "reference_mathematically_verified":1,
            "reference_mathematically_refuted":1,
            "deterministic_no_answer_solution":5,
            "replayed_candidate_mathematically_verified":1,
            "replayed_candidate_mathematically_refuted":2,
            "unverified":3,
            "offlineReplayDecidable":3,
            "offlineReplayCorrect":1,
            "genuineAIModelRuns":0,
            "measuredLiveAIAccuracy":None,
            "officialExamGoldReleased":0,
            "realExamCasesProvenAuthenticated":0,
        })
        self.assertEqual({x["id"]:x["status"] for x in report["items"]},
                         {x["id"]:x["expectedStatus"] for x in self.document["cases"]})
        by={r["id"]:r for r in report["items"]}
        for case,expected in {
            "zero-terms":"0",
            "ratio-one-arithmetic":"100",
            "ratio-zero":"5/3",
            "negative-ratio-cancellation":"-6",
            "fractional-ratio":"7/2",
            "existing-candidate-correct":"93",
            "existing-candidate-wrong":"93",
            "offline-replay-correct":"49",
        }.items():
            self.assertEqual(by[case]["exactAnswerUnderTypedModel"],expected)
        self.assertTrue(all(r["officialExamGoldCertified"] is False and
                            r["liveAIModelCallPerformed"] is False
                            for r in report["items"]))

    def test_exact_two_algorithms_agree_on_648_unseen_small_parameter_models(self):
        # Independent test oracle: direct finite rational sum, not either
        # production formula, and not a published answer.
        values=["-2","-1","0","1","2","1/2"]
        for a in ["-3/2","0","2"]:
            for d in ["-2","0","1/3"]:
                for r in values:
                    for n in range(0,12):
                        q=question(a,d,r,n)
                        found=seq.solve_question(q)
                        aa,dd,rr,nn=seq.parse_question(q)
                        expected=sum(((aa+k*dd)*(rr**k) for k in range(nn)),Fraction(0))
                        self.assertEqual(found["value"],expected,(a,d,r,n))
                        self.assertEqual(found["exactAnswer"],str(expected))
                        self.assertEqual(len(found["mathematicalMethods"]),2)
                        self.assertTrue(found["mathValidated"])
        # 3 * 3 * 6 * 12 = 648 independent parameter models.

    def test_seeded_fractions_including_cancellation_and_boundary_128(self):
        rng=random.Random(20261104)
        for i in range(250):
            a=Fraction(rng.randint(-12,12),rng.randint(1,9))
            d=Fraction(rng.randint(-12,12),rng.randint(1,9))
            r=Fraction(rng.randint(-7,7),rng.randint(1,9))
            n=rng.choice((0,1,2,8,32,64,128))
            result=seq.solve_question(question(str(a),str(d),str(r),n))
            expected=sum(((a+k*d)*r**k for k in range(n)),Fraction(0))
            self.assertEqual(result["value"],expected,f"seeded #{i}")

    def test_reference_path_good_wrong_and_blind_no_answer_are_distinct(self):
        sources=self.sources
        ok=bridge.adjudicate({"id":"good","path":"existing_answer",
                             "question":question(),"referenceAnswer":"49"},sources)
        self.assertEqual(ok["status"],"reference_mathematically_verified")
        self.assertEqual(ok["sourceEvidence"]["sourceStatus"],"unsourced_candidate")
        bad=bridge.adjudicate({"id":"bad","path":"existing_answer",
                              "question":question(),"referenceAnswer":"50"},sources)
        self.assertEqual(bad["status"],"reference_mathematically_refuted")
        blind=bridge.adjudicate({"id":"blind","path":"no_answer","question":question()},sources)
        self.assertEqual(blind["status"],"deterministic_no_answer_solution")
        self.assertEqual(blind["exactAnswerUnderTypedModel"],"49")
        self.assertFalse(blind["officialExamGoldCertified"])
        self.assertFalse(blind["liveAIModelCallPerformed"])

    def test_strict_numeric_parser_blocks_prose_float_and_bad_numerals(self):
        for value in (None,1,1.0,True,"","UNSURE","答案是49","49 or 48",
                      "0.7.5","1e3","NaN","Infinity","1/0","1/2/3",
                      "3 + 4","9_" ,"0x10","1,000","9" * 4097):
            with self.subTest(value=str(value)[:25]),self.assertRaises(seq.Unsupported):
                seq.exact_number(value)
        self.assertEqual(seq.exact_number("0.75"),Fraction(3,4))
        self.assertEqual(seq.exact_number("-1/8"),Fraction(-1,8))
        self.assertEqual(seq.exact_number(" +49 "),49)
        self.assertEqual(seq.exact_number("0"),0)

    def test_untrusted_model_contract_fails_closed(self):
        bad=[
            None,{"kind":"free_form_math"},
            {**question(),"answer":"49"},
            {**question(),"query":{"metric":"limit"}},
            {**question(),"query":{"metric":"sum","n":4}},
            {**question(),"model":{**question()["model"],"unexpected":"1"}},
            question(n=True),question(n=-1),question(n=129),question(n=128.0),
            question(a="1e999"),question(d="2/0"),question(r="9999999"),
            question(r="1000001/1000001"),question(a="1e-2"),
        ]
        for q in bad:
            with self.subTest(q=str(q)[:80]),self.assertRaises(seq.Unsupported):
                seq.solve_question(q)
        for candidate in (None,{"answer":"49"},"answer: 49"):
            verdict=bridge.adjudicate({"id":"bad-candidate","path":"existing_answer",
                "question":question(),"referenceAnswer":candidate},self.sources)
            self.assertEqual(verdict["status"],"unverified")
        published=bridge.adjudicate({"id":"fake-source","path":"existing_answer",
            "question":question(),"referenceAnswer":"49",
            "sourceCaseId":"gaokao-2025-national-1-q14"},self.sources)
        self.assertEqual(published["status"],"unverified")
        self.assertFalse(published["officialExamGoldCertified"])

    def test_corrupted_independent_method_abstains_instead_of_false_acceptance(self):
        base={"id":"crosscheck","path":"no_answer","question":question(),
              "modelAttempt":{"captureKind":"offline_replay","modelId":"synthetic",
                              "rawText":"49","answer":"49"}}
        with patch.object(seq,"closed_form_sum",return_value=Fraction(50)):
            verdict=bridge.adjudicate(base,self.sources)
            self.assertEqual(verdict["status"],"unverified")
            self.assertIn("independent_sum_methods_disagree",verdict["reason"])
        with patch.object(seq,"iterative_sum",return_value=Fraction(50)):
            verdict=bridge.adjudicate(base,self.sources)
            self.assertEqual(verdict["status"],"unverified")
        self.assertEqual(bridge.adjudicate(base,self.sources)["status"],
                         "replayed_candidate_mathematically_verified")

    def test_reference_cannot_leak_into_blind_path(self):
        case={"id":"blind","path":"no_answer","question":question(),
              "referenceAnswer":"49"}
        self.assertEqual(bridge.adjudicate(case,self.sources)["status"],"unverified")
        case=copy.deepcopy(case)
        del case["referenceAnswer"]
        case["sourceCaseId"]="gaokao-2025-national-1-q14"
        self.assertEqual(bridge.adjudicate(case,self.sources)["status"],"unverified")
        case=copy.deepcopy(case)
        del case["sourceCaseId"]
        case["modelAttempt"]={"captureKind":"invented_live","modelId":"synthetic",
                              "rawText":"49","answer":"49"}
        self.assertEqual(bridge.adjudicate(case,self.sources)["status"],"unverified")

    def test_cli_recomputes_fixture_without_network_or_official_gold(self):
        command=[sys.executable,str(ROOT/"scripts/research/verify_dual_path_math_answers.py"),
                 "--fixture",str(CASES),"--sources",str(LEDGER)]
        output=subprocess.run(command,capture_output=True,text=True,check=False,timeout=45)
        self.assertEqual(output.returncode,0,output.stderr)
        report=json.loads(output.stdout)
        self.assertEqual(report["summary"]["total"],13)
        self.assertEqual(report["summary"]["genuineAIModelRuns"],0)
        self.assertEqual(report["summary"]["officialExamGoldReleased"],0)


if __name__=="__main__":
    unittest.main()
