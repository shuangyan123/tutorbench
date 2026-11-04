"""Provider-free exact point-set verifier and dual-path circle-line research."""
import copy
from fractions import Fraction
import json
from pathlib import Path
import random
import subprocess
import sys
import unittest
from unittest.mock import patch

import sympy as S

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import verify_circle_line_intersections as geometry
import verify_dual_path_math_answers as bridge

FIXTURE=ROOT/"fixtures/research/circle-line-intersections-v0.1.json"
EVIDENCE=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"


def question(h="0",k="0",r2="25",a="0",b="1",c="0"):
    return {"kind":"circle_line_intersections",
            "circle":{"centerX":h,"centerY":k,"radiusSquared":r2},
            "line":{"a":a,"b":b,"c":c}}


def rat(value):
    return {"kind":"rational","value":str(value)}


def radical(offset,coefficient,radicand):
    return {"kind":"affine_sqrt","offset":str(offset),
            "coefficient":str(coefficient),"radicand":str(radicand)}


def point(x,y):
    return {"x":x,"y":y}


def point_set(*points):
    return {"kind":"point_set","points":list(points)}


def canonical_json(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))


class CircleLineExactResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.ledger=json.loads(EVIDENCE.read_text(encoding="utf8"))
        cls.sources=bridge.source_ledger(cls.ledger)

    def test_23_case_dual_path_fixture_has_no_false_provider_or_official_claims(self):
        report=bridge.run(self.document,self.ledger)
        self.assertEqual(report["summary"],{
            "total":23,
            "reference_mathematically_verified":2,
            "reference_mathematically_refuted":2,
            "deterministic_no_answer_solution":8,
            "replayed_candidate_mathematically_verified":2,
            "replayed_candidate_mathematically_refuted":2,
            "unverified":7,
            "offlineReplayDecidable":4,
            "offlineReplayCorrect":2,
            "genuineAIModelRuns":0,
            "measuredLiveAIAccuracy":None,
            "officialExamGoldReleased":0,
            "realExamCasesProvenAuthenticated":0,
        })
        by={r["id"]:r for r in report["items"]}
        self.assertEqual({r["id"]:r["status"] for r in report["items"]},
                         {r["id"]:r["expectedStatus"] for r in self.document["cases"]})
        self.assertEqual(len(by["circle-secants-two"]["mathematicalMethods"]),3)
        self.assertIn("sqrt(2)",by["circle-irrational-radical"]["exactAnswerUnderTypedModel"])
        self.assertEqual(by["circle-disjoint-zero"]["exactAnswerUnderTypedModel"],"EmptySet")
        self.assertEqual(by["circle-tangent-one"]["exactAnswerUnderTypedModel"],"FiniteSet((0, 5))")
        self.assertFalse(any(r["officialExamGoldCertified"] or r["liveAIModelCallPerformed"]
                             for r in report["items"]))

    def test_intended_replay_fixture_answers_match_full_visible_canonical_json(self):
        # Regression: editing a candidate without its visible raw transcript
        # must never silently change a decisional case into an abstention.
        replays=[row for row in self.document["cases"]
                 if "modelAttempt" in row and row["expectedStatus"]!="unverified"]
        self.assertEqual(len(replays),4)
        for row in replays:
            attempt=row["modelAttempt"]
            self.assertEqual(attempt["rawText"],canonical_json(attempt["answer"]),row["id"])

    def test_geometric_classification_and_exact_points_cover_288_grid_models(self):
        samples=["0","1","-3/2"]
        for h in samples:
            for k in ("0","2"):
                for r2 in ("0","1","2","25"):
                    for a,b in (("1","0"),("0","1"),("1","-1"),("2","3")):
                        for c in ("-3","0","2"):
                            q=question(h,k,r2,a,b,c)
                            found=geometry.solve_question(q)
                            x,y,rr,aa,bb,cc=geometry.parse_question(q)
                            d=aa*x+bb*y+cc
                            gap=rr*(aa*aa+bb*bb)-d*d
                            self.assertEqual(found["intersectionCount"],
                                             0 if gap<0 else 1 if gap==0 else 2)
                            self.assertTrue(found["mathValidated"])
                            for u,v in found["value"]:
                                self.assertEqual(S.simplify(aa*u+bb*v+cc),0)
                                self.assertEqual(S.simplify((u-x)**2+(v-y)**2-rr),0)
        # 3 * 2 * 4 * 4 * 3 = 288 exact parameter models.

    def test_240_seeded_rational_geometries_and_discriminant_boundaries(self):
        rng=random.Random(20261104)
        for n in range(240):
            h=Fraction(rng.randint(-5,5),rng.randint(1,4))
            k=Fraction(rng.randint(-5,5),rng.randint(1,4))
            r2=Fraction(rng.randint(0,12),rng.randint(1,4))
            a=Fraction(rng.randint(-5,5),rng.randint(1,4))
            b=Fraction(rng.randint(-5,5),rng.randint(1,4))
            if a==0 and b==0:
                a=Fraction(1)
            c=Fraction(rng.randint(-9,9),rng.randint(1,4))
            q=question(str(h),str(k),str(r2),str(a),str(b),str(c))
            solved=geometry.solve_question(q)
            direct=geometry.geometric_points(h,k,r2,a,b,c)
            alt=geometry.elimination_points(h,k,r2,a,b,c)
            self.assertTrue(geometry.same_point_sets(direct,alt),n)
            self.assertTrue(geometry.same_point_sets(direct,solved["value"]),n)

    def test_exact_structured_radicals_order_and_candidate_cardinality(self):
        q=question(r2="2")
        expected=geometry.solve_question(q)
        correct=point_set(
            point(radical("0","-1","2"),rat("0")),
            point(radical("0","1","2"),rat("0")))
        self.assertTrue(geometry.verify_candidate(expected,correct)[0])
        swapped=point_set(*reversed(correct["points"]))
        self.assertTrue(geometry.verify_candidate(expected,swapped)[0])
        wrong=point_set(point(rat("-1"),rat("0")),point(rat("1"),rat("0")))
        matched,_,witness=geometry.verify_candidate(expected,wrong)
        self.assertFalse(matched)
        self.assertEqual(witness,"exact_point_coordinates_differ")
        absent=geometry.verify_candidate(expected,point_set())
        self.assertEqual(absent[2],"expected_2_points_vs_0_points")
        self.assertTrue(geometry.verify_candidate(
            geometry.solve_question(question(c="-6")),point_set())[0])

    def test_crosscheck_failure_and_invalid_original_point_cannot_be_accepted(self):
        baseline=question()
        with patch.object(geometry,"elimination_points",return_value=[]):
            result=bridge.adjudicate({"id":"faulty-algebra","path":"no_answer","question":baseline},self.sources)
            self.assertEqual(result["status"],"unverified")
            self.assertIn("independent_geometric_and_elimination_methods_disagree",result["reason"])
        with patch.object(geometry,"geometric_points",return_value=[(S.Integer(0),S.Integer(0))]):
            result=bridge.adjudicate({"id":"faulty-geometry","path":"no_answer","question":baseline},self.sources)
            self.assertEqual(result["status"],"unverified")
            self.assertIn("fails_original_equations",result["reason"])
        correct=bridge.adjudicate({"id":"baseline","path":"no_answer","question":baseline},self.sources)
        self.assertEqual(correct["status"],"deterministic_no_answer_solution")

    def test_invalid_schema_untrusted_numbers_and_non_lines_fail_closed(self):
        bad=[
            None,
            {"kind":"circle_line_intersections"},
            {**question(),"extra":"answer"},
            {**question(),"circle":{**question()["circle"],"radiusSquared":"-1"}},
            {**question(),"line":{"a":"0","b":"0","c":"2"}},
            {**question(),"line":{**question()["line"],"d":"1"}},
            {**question(),"circle":{**question()["circle"],"centerX":0.1}},
            {**question(),"circle":{**question()["circle"],"centerX":"1e100"}},
            {**question(),"circle":{**question()["circle"],"centerX":"1/0"}},
            {**question(),"line":{**question()["line"],"a":"1000001"}},
            {**question(),"line":{**question()["line"],"a":"1000001/1000001"}},
            {**question(),"circle":{**question()["circle"],"radiusSquared":True}},
        ]
        for q in bad:
            with self.subTest(input=str(q)[:70]),self.assertRaises(geometry.Unsupported):
                geometry.solve_question(q)
        for expr in (None,3,3.0,True,"1e-3","sqrt(2)","1+2","NaN"," 1 ","1/0"):
            with self.subTest(expr=str(expr)),self.assertRaises(geometry.Unsupported):
                geometry.rational_text(expr)

    def test_malicious_typed_candidate_and_duplicate_points_abstain(self):
        q=question(r2="2")
        invalid=[
            None,
            "(-sqrt(2), 0)",
            {"kind":"point_set","points":{}},
            point_set(point(rat("0"),rat("0")),point(rat("0"),rat("0"))),
            point_set(point(rat("0"),rat("0")),point(rat("0"),rat("1")),point(rat("0"),rat("2"))),
            point_set(point({"kind":"affine_sqrt","offset":"0","coefficient":"1","radicand":"-2"},rat("0"))),
            point_set(point({"kind":"expr","value":"__import__('os').system('x')"},rat("0"))),
            point_set(point({"kind":"rational","value":"0","other":"1"},rat("0"))),
            {"kind":"point_set","points":[],"officialExamGold":True},
        ]
        for value in invalid:
            with self.subTest(candidate=str(value)[:80]),self.assertRaises(geometry.Unsupported):
                geometry.parse_candidate(value)
        for value in invalid:
            verdict=bridge.adjudicate({"id":"bad-candidate","path":"existing_answer",
                "question":q,"referenceAnswer":value},self.sources)
            self.assertEqual(verdict["status"],"unverified")

    def test_no_reference_leakage_and_canonical_offline_model_answer(self):
        q=question(r2="2")
        candidate=point_set(point(radical("0","-1","2"),rat("0")),
                            point(radical("0","1","2"),rat("0")))
        payload={"captureKind":"offline_replay","modelId":"synthetic-local",
                 "rawText":canonical_json(candidate),"answer":candidate}
        valid=bridge.adjudicate({"id":"offline","path":"no_answer",
            "question":q,"modelAttempt":payload},self.sources)
        self.assertEqual(valid["status"],"replayed_candidate_mathematically_verified")
        self.assertFalse(valid["liveAIModelCallPerformed"])
        for bad in (
            {**payload,"rawText":"Here is the answer: "+canonical_json(candidate)},
            {**payload,"rawText":canonical_json(candidate)+" second answer"},
            {**payload,"answer":{**candidate,"unknown":"visible"}},
            {**payload,"captureKind":"invented_live"},
            {**payload,"rawText":canonical_json(candidate)*100},
        ):
            report=bridge.adjudicate({"id":"tampered","path":"no_answer",
                "question":q,"modelAttempt":bad},self.sources)
            self.assertEqual(report["status"],"unverified")
        polluted=bridge.adjudicate({"id":"leak","path":"no_answer",
            "question":q,"referenceAnswer":candidate},self.sources)
        self.assertEqual(polluted["status"],"unverified")
        wrong_source=bridge.adjudicate({"id":"fabricated-paper","path":"existing_answer",
            "question":q,"referenceAnswer":candidate,
            "sourceCaseId":"gaokao-2025-national-1-q14"},self.sources)
        self.assertEqual(wrong_source["status"],"unverified")
        self.assertFalse(wrong_source["officialExamGoldCertified"])

    def test_complete_research_cli_preserves_all_23_verdicts(self):
        result=subprocess.run(
            [sys.executable,str(ROOT/"scripts/research/verify_dual_path_math_answers.py"),
             "--fixture",str(FIXTURE),"--sources",str(EVIDENCE)],
            capture_output=True,text=True,check=False,timeout=120)
        self.assertEqual(result.returncode,0,result.stderr)
        output=json.loads(result.stdout)
        self.assertEqual(output["summary"]["total"],23)
        self.assertEqual(output["summary"]["unverified"],7)
        self.assertIsNone(output["summary"]["measuredLiveAIAccuracy"])
        self.assertEqual(output["summary"]["officialExamGoldReleased"],0)


if __name__=="__main__":
    unittest.main()
