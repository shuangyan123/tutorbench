"""Provider-free parameterized circle-line classification: exact set certificates."""
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
import verify_parametric_circle_line_classification as param
import verify_circle_line_intersections as circle
import verify_dual_path_math_answers as bridge
import verify_quadratic_signsets as sets

FIXTURE=ROOT/"fixtures/research/parametric-circle-line-classification-v0.1.json"
LEDGER=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"


def question(h="0",k="0",R="1",a="1",b="0",c0="0",c1="1",count=2):
    return {"kind":"parametric_circle_line_intersection_count",
            "circle":{"centerX":h,"centerY":k,"radiusSquared":R},
            "line":{"a":a,"b":b,"baseC":c0,"parameterC":c1},
            "query":{"intersectionCount":count}}


def ra(num,den=1):
    return {"kind":"rational","num":num,"den":den}


def surd(a,b,radicand,den=1):
    return {"kind":"surd","a":a,"b":b,"radicand":radicand,"den":den}


def union(*parts):
    return {"kind":"union","parts":list(parts)}


def interval(left,right,inc_left=False,inc_right=False):
    return {"kind":"interval","left":left,"right":right,
            "includeLeft":inc_left,"includeRight":inc_right}


class ExactMovingLineResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.ledger=json.loads(LEDGER.read_text(encoding="utf8"))
        cls.sources=bridge.source_ledger(cls.ledger)

    def test_all_26_synthetic_statuses_and_live_source_claims(self):
        report=bridge.run(self.fixture,self.ledger)
        expected={
            "total":26,
            "reference_mathematically_verified":3,
            "reference_mathematically_refuted":2,
            "deterministic_no_answer_solution":12,
            "replayed_candidate_mathematically_verified":2,
            "replayed_candidate_mathematically_refuted":1,
            "unverified":6,
            "offlineReplayDecidable":3,
            "offlineReplayCorrect":2,
            "genuineAIModelRuns":0,
            "measuredLiveAIAccuracy":None,
            "officialExamGoldReleased":0,
            "realExamCasesProvenAuthenticated":0,
        }
        self.assertEqual(report["summary"],expected)
        self.assertEqual({r["id"]:r["status"] for r in report["items"]},
                         {x["id"]:x["expectedStatus"] for x in self.fixture["cases"]})
        self.assertTrue(all(r["officialExamGoldCertified"] is False and
                            r["liveAIModelCallPerformed"] is False for r in report["items"]))

    def test_three_parameter_classes_partition_all_real_t(self):
        for settings in (
            ("0","0","1","1","0","0","1"),
            ("0","0","2","1","0","0","1"),
            ("1","-2","2","1","-1","0","1"),
            ("0","0","0","1","0","0","1"),
            ("0","0","1","1","0","0","0"),
            ("0","0","1","1","0","-1","0"),
            ("0","0","1","1","0","-2","0"),
            ("1/2","-3/2","2","-2","3","1/3","-2"),
        ):
            partitions=[param.solve_question(question(*settings,i))["value"] for i in (0,1,2)]
            self.assertEqual(S.simplify(S.Union(*partitions)),S.S.Reals)
            for i in range(3):
                for j in range(i+1,3):
                    self.assertEqual(partitions[i].intersect(partitions[j]),S.EmptySet)
        baseline=[param.solve_question(question(count=k))["value"] for k in range(3)]
        self.assertEqual(baseline[0],S.Union(S.Interval.open(-S.oo,-1),S.Interval.open(1,S.oo)))
        self.assertEqual(baseline[1],S.FiniteSet(-1,1))
        self.assertEqual(baseline[2],S.Interval.open(-1,1))

    def test_grid_and_original_geometric_equations_at_rational_parameters(self):
        # 2*3*2*2*2*3=144 typed parameter partitions and 1,008 checks
        settings=[]
        for h in ("-1","1/2"):
            for R in ("0","1","2"):
                for (a,b) in (("1","0"),("1","-1")):
                    for c0 in ("0","1"):
                        for c1 in ("0","-2"):
                            settings.append((h,"0",R,a,b,c0,c1))
        for args in settings:
            sets3=[param.solve_question(question(*args,count=i))["value"] for i in (0,1,2)]
            h,k,R,a,b,c0,c1,_=param.parse_question(question(*args,count=0))
            for t in (-5,-2,-1,0,1,2,5):
                real_points=circle.geometric_points(h,k,R,a,b,c0+c1*t)
                truth=len(real_points)
                for number,allowed in enumerate(sets3):
                    membership=allowed.contains(S.Integer(t))
                    self.assertIn(membership,(S.true,S.false),(args,t))
                    self.assertEqual(membership==S.true,truth==number,(args,t,number))

    def test_seeded_rational_samples_and_tangency_boundaries(self):
        rng=random.Random(20261104)
        for _ in range(96):
            h=Fraction(rng.randint(-4,4),rng.randint(1,4))
            k=Fraction(rng.randint(-4,4),rng.randint(1,4))
            R=Fraction(rng.randint(0,10),rng.randint(1,4))
            a=Fraction(rng.randint(-3,3),rng.randint(1,3))
            b=Fraction(rng.randint(-3,3),rng.randint(1,3))
            if not (a or b):
                a=Fraction(1)
            c0=Fraction(rng.randint(-6,6),rng.randint(1,3))
            c1=Fraction(rng.randint(-4,4),rng.randint(1,3))
            args=tuple(map(str,(h,k,R,a,b,c0,c1)))
            count=rng.randint(0,2)
            result=param.solve_question(question(*args,count=count))
            self.assertEqual(len(result["mathematicalMethods"]),3)
            t=Fraction(rng.randint(-6,6),rng.randint(1,3))
            true_count=len(circle.geometric_points(h,k,R,a,b,c0+c1*t))
            self.assertEqual(result["value"].contains(S.Rational(t.numerator,t.denominator))==S.true,
                             true_count==count)
        two=param.solve_question(question(R="2",count=2))["value"]
        one=param.solve_question(question(R="2",count=1))["value"]
        for tangent in (-S.sqrt(2),S.sqrt(2)):
            self.assertEqual(two.contains(tangent),S.false)
            self.assertEqual(one.contains(tangent),S.true)

    def test_typed_rational_and_surd_endpoints_and_wrong_boundary(self):
        derived=param.solve_question(question(R="2",count=2))
        proposed=union(interval(surd(0,-1,2),surd(0,1,2)))
        self.assertTrue(param.verify_candidate(derived,proposed)[0])
        bad=union(interval(surd(0,-1,2),surd(0,1,2),True,True))
        ok,_,witness=param.verify_candidate(derived,bad)
        self.assertFalse(ok)
        self.assertIsNotNone(witness)
        no_solution=param.solve_question(question(R="0",count=2))
        self.assertTrue(param.verify_candidate(no_solution,{"kind":"empty"})[0])
        constant=param.solve_question(question(c1="0",count=2))
        self.assertTrue(param.verify_candidate(constant,{"kind":"all_real"})[0])

    def test_fault_injection_fails_closed_before_candidate(self):
        row={"id":"fault","path":"no_answer","question":question()}
        for name in ("analytic_partition","polynomial_partition"):
            with self.subTest(name=name),patch.object(param,name,return_value=S.EmptySet):
                value=bridge.adjudicate(row,self.sources)
                self.assertEqual(value["status"],"unverified")
                self.assertIn("disagree",value["reason"])
        self.assertEqual(bridge.adjudicate(row,self.sources)["status"],
                         "deterministic_no_answer_solution")

    def test_invalid_schema_and_fake_exam_lineage_cannot_be_scored(self):
        altered=[
            None,
            {**question(),"query":{"intersectionCount":True}},
            {**question(),"query":{"intersectionCount":3}},
            {**question(),"query":{"metric":"two"}},
            {**question(),"line":{"a":"0","b":"0","baseC":"0","parameterC":"1"}},
            {**question(),"circle":{**question()["circle"],"radiusSquared":"-1"}},
            {**question(),"circle":{**question()["circle"],"centerX":0.5}},
            {**question(),"line":{**question()["line"],"parameterC":"1e3"}},
            {**question(),"answer":"redacted"},
        ]
        for bad in altered:
            with self.subTest(q=str(bad)[:90]),self.assertRaises(param.Unsupported):
                param.solve_question(bad)
        result=bridge.adjudicate({"id":"fake-exam","path":"existing_answer",
            "question":question(),"referenceAnswer":{"kind":"empty"},
            "sourceCaseId":"gaokao-2025-national-1-q14"},self.sources)
        self.assertEqual(result["status"],"unverified")
        self.assertFalse(result["officialExamGoldCertified"])

    def test_full_visible_structured_replay_cannot_extract_from_prose(self):
        replay=[row for row in self.fixture["cases"] if "modelAttempt" in row]
        for row in replay:
            if row["expectedStatus"]=="unverified":
                continue
            attempt=row["modelAttempt"]
            self.assertEqual(attempt["rawText"],json.dumps(attempt["answer"],
                ensure_ascii=False,sort_keys=True,separators=(",",":")))
            broken=copy.deepcopy(row)
            broken["modelAttempt"]["rawText"]="Answer: "+attempt["rawText"]
            self.assertEqual(bridge.adjudicate(broken,self.sources)["status"],"unverified")
        leaked={"id":"blind-leak","path":"no_answer","question":question(),
                "referenceAnswer":{"kind":"empty"}}
        self.assertEqual(bridge.adjudicate(leaked,self.sources)["status"],"unverified")

    def test_cli_recomputes_complete_26_verdicts(self):
        output=subprocess.run([
            sys.executable,str(ROOT/"scripts/research/verify_dual_path_math_answers.py"),
            "--fixture",str(FIXTURE),"--sources",str(LEDGER)],
            capture_output=True,text=True,check=False,timeout=120)
        self.assertEqual(output.returncode,0,output.stderr)
        result=json.loads(output.stdout)
        self.assertEqual(result["summary"]["total"],26)
        self.assertEqual(result["summary"]["unverified"],6)
        self.assertEqual(result["summary"]["officialExamGoldReleased"],0)
        self.assertIsNone(result["summary"]["measuredLiveAIAccuracy"])


if __name__=="__main__":
    unittest.main()
