"""Full real parameter-axis rational-fraction solution set verification."""
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
MODULE=ROOT/"scripts/research/verify_parameter_rational_inequalities.py"
FIXTURE=ROOT/"fixtures/research/parameter-rational-linear-fractions-v0.1.json"
spec=importlib.util.spec_from_file_location("rational_parameter_math",MODULE)
math=importlib.util.module_from_spec(spec)
spec.loader.exec_module(math)


class ParameterRationalInequalityFamily(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.byid={v["id"]:v for v in cls.document["cases"]}

    def test_all_81_expected_results_and_never_official_exam_gold(self):
        result=math.check_batch(self.document)
        self.assertEqual(result["status"],"exact_parameter_rational_fraction_real_sets_research_only")
        self.assertEqual(result["summary"],{
            "total":81,"verifiedComplete":51,"refuted":18,
            "unverified":12,"officialExamGoldReleased":0})
        self.assertEqual({v["id"]:v["status"] for v in result["items"]},
                         {v["id"]:v["expectedStatus"] for v in self.document["cases"]})
        self.assertTrue(all(v["officialExamGoldCertified"] is False for v in result["items"]))

    def test_root_pole_collision_and_no_cancellation_of_original_holes(self):
        for suffix in ("gt","ge","lt","le","eq","ne"):
            row=math.classify_case(self.byid["crossing_linear_root_pole_"+suffix])
            self.assertEqual(row["status"],"verified_complete_parameter_solution_family",suffix)
            self.assertEqual(row["criticalParameters"],["1"])
            self.assertEqual(row["exactParameterCellChecks"],3)
        wrong=math.classify_case(self.byid["false_cancelled_hole_all_reals"])
        self.assertEqual(wrong["status"],"refuted_parameter_solution_family")
        self.assertEqual(wrong["parameterWitness"],"1")
        self.assertEqual(wrong["xWitness"],"1")

    def test_zero_entire_denominator_at_one_parameter_has_no_real_domain(self):
        for op in ("eq","ne","lt","le","gt","ge"):
            row=math.classify_case(self.byid["denominator_identically_zero_"+op])
            self.assertEqual(row["status"],"verified_complete_parameter_solution_family",op)
        wrong=math.classify_case(self.byid["false_zero_denominator_returns_full"])
        self.assertEqual(wrong["parameterWitness"],"0")
        self.assertEqual(wrong["expectedRealSetAtWitness"],"EmptySet")

    def test_ordinary_undefined_poles_also_survive_zero_numerators(self):
        for op in ("eq","ne","lt","le","gt","ge"):
            self.assertEqual(math.classify_case(self.byid["zero_numerator_pole_"+op])["status"],
                             "verified_complete_parameter_solution_family",op)
            self.assertEqual(math.classify_case(self.byid["parameter_cancellation_with_hole_"+op])["status"],
                             "verified_complete_parameter_solution_family",op)
        row=math.classify_case(self.byid["false_omit_denominator_pole_at_zero_numerator"])
        self.assertEqual(row["status"],"refuted_parameter_solution_family")
        self.assertEqual(row["xWitness"],"-1")

    def test_slope_degeneracy_and_zero_pole_crossings(self):
        for op in ("eq","ne","lt","le","gt","ge"):
            item=math.classify_case(self.byid["slope_degeneration_crossing_"+op])
            self.assertEqual(item["status"],"verified_complete_parameter_solution_family",op)
            self.assertEqual(item["criticalParameters"],["-1","0"])
        for name,parameter in (
            ("false_disappearing_num_root_at_t0","0"),
            ("false_slope_root_pole_coincide","-1"),
            ("false_t1_numerator_root_undefined","1")):
            out=math.classify_case(self.byid[name])
            self.assertEqual(out["status"],"refuted_parameter_solution_family")
            self.assertEqual(out["parameterWitness"],parameter)

    def test_all_false_families_give_exact_parameter_counterexamples(self):
        for item in self.document["cases"]:
            if item["expectedStatus"]!="refuted_parameter_solution_family":
                continue
            result=math.classify_case(item)
            self.assertEqual(result["status"],"refuted_parameter_solution_family",item["id"])
            self.assertIsNotNone(result.get("parameterWitness"),item["id"])
            if result["reason"]=="wrong_full_x_solution_set":
                self.assertIsNotNone(result.get("xWitness"),item["id"])

    def test_randomized_differential_32_parameter_families_at_all_critical_cells(self):
        rng=random.Random(20261103)
        checked=0
        for _ in range(32):
            pairs=[(rng.randint(-3,3),rng.randint(-3,3)) for _ in range(4)]
            A,B,C,D=(S.Integer(a)+S.Integer(b)*math.T for a,b in pairs)
            determinant=S.expand(A*D-B*C)
            critical=set()
            for p in (A,B,C,D,determinant):
                critical.update(math.base.polynomial_roots(p))
            critical=sorted(critical,key=math.cmp_to_key(math.base.compare))
            edges=[-S.oo,*critical,S.oo]
            param_values=[*critical,*[math.base.point_between(a,b) for a,b in zip(edges,edges[1:])]]
            op=rng.choice(sorted(math.OPERATORS))
            for t in param_values:
                values=[S.simplify(p.subs(math.T,t)) for p in (A,B,C,D)]
                left=math.exact_signchart(*values,op)
                right=math.original_solver(*values,op)
                same,witness=math.equal_sets(left,right)
                self.assertTrue(same,(pairs,t,op,witness))
                checked+=1
        self.assertGreater(checked,75)

    def test_exact_pointwise_relation_matches_direct_original_fraction(self):
        rng=random.Random(22061103)
        checked=0
        for _ in range(55):
            a,b,c,d=(S.Rational(rng.randint(-5,5)) for _ in range(4))
            op=rng.choice(sorted(math.OPERATORS))
            expected=math.exact_signchart(a,b,c,d,op)
            for k in range(-5,6):
                x=S.Integer(k)
                denominator=c*x+d
                should=bool(denominator!=0 and not (c==0 and d==0) and
                            math.holds(math.sign(a*x+b)*math.sign(denominator),op))
                self.assertEqual(math.membership(expected,x),should,(a,b,c,d,x,op))
                checked+=1
        self.assertGreater(checked,500)

    def test_scale_numerator_and_denominator_without_changing_result(self):
        rng=random.Random(11142026)
        checks=0
        for _ in range(35):
            a,b,c,d=(S.Integer(rng.randint(-4,4)) for _ in range(4))
            op=rng.choice(sorted(math.OPERATORS))
            baseline=math.exact_signchart(a,b,c,d,op)
            for scale in (2,-3):
                value=math.exact_signchart(scale*a,scale*b,scale*c,scale*d,op)
                same,w=math.equal_sets(baseline,value)
                self.assertTrue(same,(a,b,c,d,op,scale,w))
                checks+=1
        self.assertEqual(checks,70)

    def test_complementary_relations_cover_original_defined_domain(self):
        rng=random.Random(20261114)
        count=0
        for _ in range(28):
            a,b,c,d=(S.Integer(rng.randint(-4,4)) for _ in range(4))
            pole=math.xzero(c,d)
            valid=S.EmptySet if c==0 and d==0 else (
                S.S.Reals if pole is None else S.S.Reals-S.FiniteSet(pole))
            for aop,bop in (("eq","ne"),("lt","ge"),("gt","le")):
                left=math.exact_signchart(a,b,c,d,aop)
                right=math.exact_signchart(a,b,c,d,bop)
                self.assertTrue(math.equal_sets(left.union(right),valid)[0])
                self.assertTrue(math.equal_sets(left.intersect(right),S.EmptySet)[0])
                count+=1
        self.assertEqual(count,84)

    def test_alternative_correct_parameter_partition_is_accepted(self):
        original=copy.deepcopy(self.byid["constant_positive_fraction_gt"])
        def q(n):return {"kind":"rational","num":n,"den":1}
        N={"kind":"infinity","side":"negative"}
        P={"kind":"infinity","side":"positive"}
        def i(a,b):return {"kind":"interval","left":a,"right":b,
                           "includeLeft":False,"includeRight":False}
        def pt(n):return {"kind":"point","value":q(n)}
        original["parameterBranches"]=[
            {"when":w,"xSolution":{"kind":"all_real"}}
            for w in (i(N,q(-2)),pt(-2),i(q(-2),q(3)),pt(3),i(q(3),P))]
        self.assertEqual(math.classify_case(original)["status"],
                         "verified_complete_parameter_solution_family")

    def test_corrupted_independent_original_solver_forces_abstention(self):
        with patch.object(math,"original_solver",return_value=S.EmptySet):
            output=math.classify_case(self.byid["crossing_linear_root_pole_gt"])
            self.assertEqual(output["status"],"unverified")
            self.assertIn("independent_original_fraction_solver_disagrees",output["reason"])
        with patch.object(math,"original_solver",return_value=S.S.Reals):
            output=math.classify_case(self.byid["denominator_identically_zero_eq"])
            self.assertEqual(output["status"],"unverified")

    def test_all_invalid_schema_cases_abstain_no_eval(self):
        rows=[r for r in self.document["cases"] if r["expectedStatus"]=="unverified"]
        self.assertEqual(len(rows),12)
        for row in rows:
            self.assertEqual(math.classify_case(row)["status"],"unverified",row["id"])
        copy_doc=copy.deepcopy(self.document)
        copy_doc["cases"]=[self.document["cases"][0],self.document["cases"][0]]
        with self.assertRaisesRegex(ValueError,"missing_or_duplicate_ids"):
            math.check_batch(copy_doc)

    def test_strict_cli_refuses_abstentions_and_gives_no_official_gold(self):
        with tempfile.TemporaryDirectory() as root:
            target=Path(root)/"claims.json"
            target.write_text(json.dumps(self.document),encoding="utf8")
            run=subprocess.run([sys.executable,str(MODULE),"--fixture",str(target),
                                "--require-decidable"],capture_output=True,text=True,check=False)
            self.assertEqual(run.returncode,1,run.stderr)
            result=json.loads(run.stdout)
            self.assertEqual(result["summary"]["unverified"],12)
            self.assertEqual(result["summary"]["officialExamGoldReleased"],0)


if __name__=="__main__":
    unittest.main()
