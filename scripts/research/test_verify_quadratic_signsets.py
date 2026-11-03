"""Exact complete real solution-set differential and mutation regression checks."""
import copy
import importlib.util
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import sympy as S

ROOT=Path(__file__).resolve().parents[2]
MODULE=ROOT/"scripts/research/verify_quadratic_signsets.py"
FIXTURE=ROOT/"fixtures/research/quadratic-rational-signsets-v0.1.json"
spec=importlib.util.spec_from_file_location("quadratic_signsets",MODULE)
math=importlib.util.module_from_spec(spec)
spec.loader.exec_module(math)


class CompleteQuadraticRealSolutionSets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf-8"))

    def by_id(self,name):
        return next(x for x in self.fixture["cases"] if x["id"]==name)

    def test_all_64_manually_expected_decisions_are_exact_and_never_official_gold(self):
        report=math.check_batch(self.fixture)
        got={x["id"]:x["status"] for x in report["items"]}
        expected={x["id"]:x["expectedStatus"] for x in self.fixture["cases"]}
        self.assertEqual(got,expected)
        self.assertEqual(report["summary"],{
            "total":64,"verifiedComplete":39,"refuted":13,
            "unverified":12,"officialExamGoldReleased":0})
        for row in report["items"]:
            self.assertFalse(row["officialExamGoldCertified"])
            if row["status"]!="unverified":
                self.assertIn("referenceSet",row)

    def test_every_refuted_answer_includes_a_valid_exact_counterexample(self):
        for row in self.fixture["cases"]:
            if row["expectedStatus"]!="refuted_solution_set":
                continue
            expected=math.signchart_set(math.coeff_poly(row["numerator"]),
              math.coeff_poly(row["denominator"]),row["comparison"]).intersect(
                math.typed_set(row["domain"]))
            candidate=math.typed_set(row["candidateSolution"])
            equal,point=math.compare_sets(expected,candidate)
            self.assertFalse(equal,row["id"])
            self.assertIsNotNone(point,row["id"])
            self.assertNotEqual(math.member(expected,point),math.member(candidate,point),row["id"])

    def test_exam_math_one_2025_q16_only_intermediate_root_claim_not_full_answer(self):
        good=self.by_id("real-exam-math1-2025-q16-intermediate-p")
        self.assertEqual(good["sourceEvidence"]["question"],16)
        self.assertEqual(good["sourceEvidence"]["year"],2025)
        self.assertTrue(good["sourceEvidence"]["onlyIntermediateClaim"])
        self.assertFalse(good["sourceEvidence"]["officialGold"])
        self.assertEqual(math.check_one(good)["status"],"verified_complete_solution_set")
        bad=math.check_one(self.by_id("real-exam-math1-2025-q16-extra-pole-like-root"))
        self.assertEqual(bad["status"],"refuted_solution_set")
        self.assertEqual(bad["witness"],"5/4")

    def test_strict_open_closed_edges_and_cancellation_holes(self):
        cases=[
            "rational-hole-common-factor-gt","rational-hole-common-factor-eq",
            "rational-cancel-hole-ge","rational-zero-numerator-le-exclude-pole",
            "domain-positive-restrict-equation","domain-gap-excludes-one-root",
            "two-surds-overlap-gt","quadratic-surds-complete",
            "root-of-quadratic-large-rational"
        ]
        for name in cases:
            self.assertEqual(math.check_one(self.by_id(name))["status"],
                             "verified_complete_solution_set",name)
        for name in ["rational-hole-common-factor-false-all-reals",
                     "rational-cancel-hole-ge-false-includes-pole"]:
            result=math.check_one(self.by_id(name))
            self.assertEqual(result["status"],"refuted_solution_set",name)
            self.assertEqual(result["witness"],"1")
        for name in ["quadratic-sign-strict-wrong-endpoint",
                     "quadratic-sign-le-wrong-open",
                     "two-surds-wrong-pole-included",
                     "domain-positive-extraneous-root"]:
            self.assertEqual(math.check_one(self.by_id(name))["status"],"refuted_solution_set",name)

    def test_six_relations_and_exact_root_of_endpoint(self):
        for comparison in ("eq","ne","lt","le","gt","ge"):
            cases=[x for x in self.fixture["cases"] if x["comparison"]==comparison
                   and x["expectedStatus"]=="verified_complete_solution_set"]
            self.assertGreater(len(cases),0)
            for row in cases:
                self.assertEqual(math.check_one(row)["status"],"verified_complete_solution_set")
        self.assertEqual(math.atom({"kind":"root_of","polynomial":{
            "coefficients":[{"num":-2,"den":1},{"num":0,"den":1},{"num":1,"den":1}]
            },"index":1}),S.sqrt(2))

    def test_160_seeded_math_cases_agree_with_separate_sympy_inequality_solver(self):
        rng=random.Random(20261103)
        for i in range(160):
            cs=[rng.randint(-3,3) for _ in range(6)]
            num=S.Poly(sum(cs[j]*math.X**j for j in range(3)),math.X,domain=S.QQ)
            den=S.Poly(sum(cs[j+3]*math.X**j for j in range(3)),math.X,domain=S.QQ)
            if den.is_zero:
                den=S.Poly(1,math.X)
            operator=rng.choice(sorted(math.RELATIONS))
            with self.subTest(i=i,operator=operator):
                expected=math.signchart_set(num,den,operator)
                independent=math.oracle_set(num,den,operator)
                equal,witness=math.compare_sets(expected,independent)
                self.assertTrue(equal,f"{num.as_expr()}/{den.as_expr()} {operator} 0 witness={witness}")

    def test_corrupting_independent_math_oracle_abstains_not_auto_passes(self):
        row=self.by_id("quadratic-two-roots")
        with patch.object(math,"oracle_set",return_value=S.EmptySet):
            result=math.check_one(row)
            self.assertEqual(result["status"],"unverified")
            self.assertIn("independent_solver_disagrees",result["reason"])

    def test_invalid_types_and_unknown_domains_fail_closed(self):
        original=self.by_id("quadratic-two-roots")
        variants=[
            ("numerator",{"coefficients":[{"num":True,"den":1}]}),
            ("numerator",{"coefficients":[{"num":10**10,"den":1}]}),
            ("denominator",{"coefficients":[{"num":0,"den":1}]}),
            ("comparison","invalid_operator"),
            ("domain",{"kind":"empty"}),
            ("candidateSolution",{"kind":"union","parts":[{"kind":"point",
                "value":{"kind":"infinity","side":"negative"}}]}),
            ("candidateSolution",{"kind":"union","parts":[{"kind":"interval",
                "left":{"kind":"rational","num":3,"den":1},
                "right":{"kind":"rational","num":1,"den":1},
                "includeLeft":True,"includeRight":True}]}),
        ]
        for key,value in variants:
            row=copy.deepcopy(original)
            row[key]=value
            self.assertEqual(math.check_one(row)["status"],"unverified",key)
        malicious=copy.deepcopy(original)
        malicious["candidateSolution"]={"kind":"union","parts":[
            {"kind":"point","value":{"kind":"__import__('os').system('echo RUN')"}}]}
        self.assertEqual(math.check_one(malicious)["status"],"unverified")
        duplicated=copy.deepcopy(self.fixture)
        duplicated["cases"]=[original,original]
        with self.assertRaisesRegex(ValueError,"duplicated_or_missing_id"):
            math.check_batch(duplicated)

    def test_strict_cli_returns_one_for_unverified_claims(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/"claims.json"
            file.write_text(json.dumps(self.fixture),encoding="utf-8")
            result=subprocess.run([sys.executable,str(MODULE),"--fixture",str(file),
                                   "--require-decidable"],
                                  capture_output=True,text=True,check=False)
            self.assertEqual(result.returncode,1,result.stderr)
            self.assertEqual(json.loads(result.stdout)["summary"]["unverified"],12)


if __name__=="__main__":
    unittest.main()
