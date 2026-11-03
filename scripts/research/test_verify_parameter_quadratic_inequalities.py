"""Research regression: exact complete all-parameter quadratic inequality x-solution sets."""
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
MODULE=ROOT/"scripts/research/verify_parameter_quadratic_inequalities.py"
FIXTURE=ROOT/"fixtures/research/parameter-affine-quadratic-inequalities-v0.1.json"
spec=importlib.util.spec_from_file_location("parameter_inequality_verifier",MODULE)
math=importlib.util.module_from_spec(spec)
spec.loader.exec_module(math)


class CompleteParameterInequalityFamilies(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.byid={row["id"]:row for row in cls.fixture["cases"]}

    def test_all_65_accepted_refuted_and_unsupported_exact_cases(self):
        report=math.check_batch(self.fixture)
        self.assertEqual(report["status"],"research_exact_parameter_quadratic_inequality_sets_no_exam_gold")
        self.assertEqual(report["summary"],{
            "total":65,"verifiedComplete":38,"refuted":15,
            "unverified":12,"officialExamGoldReleased":0})
        self.assertEqual({x["id"]:x["status"] for x in report["items"]},
                         {x["id"]:x["expectedStatus"] for x in self.fixture["cases"]})
        self.assertTrue(all(x["officialExamGoldCertified"] is False for x in report["items"]))
        self.assertTrue(all(x["exactParameterCellChecks"]>0 for x in report["items"]
                            if x["status"]=="verified_complete_parameter_solution_family"))

    def test_six_inequality_relation_classes_include_linear_degeneracy(self):
        for op in ("eq","ne","lt","le","gt","ge"):
            row=self.byid["tquad_xplus1_"+op]
            result=math.compare_claim(row)
            self.assertEqual(result["status"],"verified_complete_parameter_solution_family",op)
            self.assertEqual(result["criticalParameters"],["0","1/4"])
            self.assertGreaterEqual(result["exactParameterCellChecks"],5)

    def test_invalid_root_formula_at_critical_parameter_is_refuted_with_witness(self):
        for name,point,expected in (
            ("f_quadratic_instead_of_linear_at_t0","0","right_open"),
            ("f_forgets_excluded_double_root","1/4","except_point"),
            ("f_wrong_sign_for_negative_leading",None,"between_open"),
            ("linear_reverses_ray_for_negative_slope",None,"left_open"),
            ("constant_degeneration_at_tzero","0","all_reals"),
        ):
            actual=math.compare_claim(self.byid[name])
            self.assertEqual(actual["status"],"refuted_parameter_solution_family",name)
            self.assertEqual(actual["reason"],"wrong_complete_inequality_solution_template",name)
            self.assertEqual(actual["expectedSolutionTemplate"],expected,name)
            self.assertNotEqual(actual["expectedSolutionTemplate"],actual["submittedSolutionTemplate"])
            self.assertIsNotNone(actual["parameterWitness"])
            if point is not None:
                self.assertEqual(actual["parameterWitness"],point)

    def test_missing_and_double_counted_parameter_sections_are_refuted(self):
        for name in ("f_missing_degenerate_singleton","f_overlapping_boundary",
                     "linear_misses_constant_parameter_zero","wrong_noncritical_partition_gap"):
            actual=math.compare_claim(self.byid[name])
            self.assertEqual(actual["status"],"refuted_parameter_solution_family",name)
            self.assertEqual(actual["reason"],"incomplete_or_overlapping_parameter_partition")
            self.assertNotEqual(actual["matchingBranches"],1)
            self.assertIsNotNone(actual["parameterWitness"])

    def test_irrational_critical_parameters_are_not_numerically_rounded(self):
        result=math.compare_claim(self.byid["irrational_discriminant_gt"])
        self.assertEqual(result["status"],"verified_complete_parameter_solution_family")
        self.assertIn("-sqrt(2)",result["criticalParameters"])
        self.assertIn("sqrt(2)",result["criticalParameters"])
        failed=math.compare_claim(self.byid["irrational_boundary_misclassified"])
        self.assertEqual(failed["status"],"refuted_parameter_solution_family")
        self.assertEqual(failed["expectedSolutionTemplate"],"except_point")

    def test_all_false_cases_have_witness_on_entire_parameter_axis(self):
        rows=[r for r in self.fixture["cases"] if r["expectedStatus"]=="refuted_parameter_solution_family"]
        self.assertEqual(len(rows),15)
        for row in rows:
            with self.subTest(row=row["id"]):
                result=math.compare_claim(row)
                self.assertEqual(result["status"],"refuted_parameter_solution_family")
                self.assertIsNotNone(result["parameterWitness"])
                if result["reason"]=="wrong_complete_inequality_solution_template":
                    self.assertIn(result["expectedSolutionTemplate"],math.TEMPLATES)
                else:
                    self.assertNotEqual(result["matchingBranches"],1)

    def test_48_random_parameter_families_recomputed_at_all_critical_cells(self):
        rng=random.Random(20261103)
        checks=0
        for _ in range(48):
            triples=[(rng.randint(-3,3),rng.randint(-3,3)) for _ in range(3)]
            A,B,C=(S.Integer(v)+S.Integer(k)*math.T for v,k in triples)
            D=S.expand(B*B-4*A*C)
            roots=set()
            for expr in (A,B,C,D):
                roots.update(math.base.polynomial_roots(expr))
            ordered=sorted(roots,key=math.cmp_to_key(math.base.compare))
            intervals=[-S.oo,*ordered,S.oo]
            probes=[*ordered,*[math.base.point_between(i,j) for i,j in zip(intervals,intervals[1:])]]
            op=rng.choice(sorted(math.OPERATORS))
            for t in probes:
                a,b,c=(S.simplify(z.subs(math.T,t)) for z in (A,B,C))
                expected=math.expected_kind(a,b,c,op)
                explicit=math.exact_template_set(expected,a,b,c)
                other=math.independent_solver(a,b,c,op)
                equal,witness=math.equal_sets(explicit,other)
                self.assertTrue(equal,(triples,t,op,expected,witness))
                checks+=1
        self.assertGreater(checks,130)

    def test_open_and_closed_root_endpoints_are_not_inverted(self):
        # Explicit regression: SymPy Interval defaults to CLOSED finite ends.
        # All strict polynomial inequalities MUST exclude their zero points.
        for a,b,c,comparison,expected,roots,contained in [
            (1,0,-1,"lt","between_open",[-1,1],False),
            (1,0,-1,"le","between_closed",[-1,1],True),
            (1,0,-1,"gt","outside_open",[-1,1],False),
            (1,0,-1,"ge","outside_closed",[-1,1],True),
            (-1,0,1,"gt","between_open",[-1,1],False),
            (-1,0,1,"ge","between_closed",[-1,1],True),
            (1,-2,1,"gt","except_point",[1],False),
            (1,-2,1,"ge","all_reals",[1],True),
            (0,-2,2,"gt","left_open",[1],False),
            (0,-2,2,"ge","left_closed",[1],True),
        ]:
            with self.subTest(a=a,b=b,c=c,comparison=comparison):
                template=math.expected_kind(S.Integer(a),S.Integer(b),S.Integer(c),comparison)
                self.assertEqual(template,expected)
                result=math.exact_template_set(template,S.Integer(a),S.Integer(b),S.Integer(c))
                for r in roots:
                    self.assertEqual(math.in_set(result,S.Integer(r)),contained)

    def test_positive_scaling_and_negative_comparison_reversal(self):
        rng=random.Random(11032026)
        checks=0
        reversal={"lt":"gt","le":"ge","gt":"lt","ge":"le","eq":"eq","ne":"ne"}
        for _ in range(25):
            a,b,c=[S.Integer(rng.randint(-3,3)) for _ in range(3)]
            if a==b==c==0:continue
            op=rng.choice(sorted(math.OPERATORS))
            original=math.expected_kind(a,b,c,op)
            original_set=math.exact_template_set(original,a,b,c)
            for scale in (2,5,-3):
                adjusted_op=op if scale>0 else reversal[op]
                new=math.expected_kind(scale*a,scale*b,scale*c,adjusted_op)
                new_set=math.exact_template_set(new,scale*a,scale*b,scale*c)
                same,witness=math.equal_sets(original_set,new_set)
                self.assertTrue(same,(a,b,c,op,scale,witness))
                checks+=1
        self.assertGreater(checks,65)

    def test_complementary_comparisons_partition_the_whole_x_axis(self):
        rng=random.Random(20261104)
        checks=0
        for _ in range(25):
            a,b,c=[S.Integer(rng.randint(-5,5)) for _ in range(3)]
            for first,second in (("eq","ne"),("lt","ge"),("gt","le")):
                kind1=math.expected_kind(a,b,c,first)
                kind2=math.expected_kind(a,b,c,second)
                left=math.exact_template_set(kind1,a,b,c)
                right=math.exact_template_set(kind2,a,b,c)
                whole,_=math.equal_sets(left.union(right),S.S.Reals)
                overlap,_=math.equal_sets(left.intersect(right),S.EmptySet)
                self.assertTrue(whole,(a,b,c,first,second))
                self.assertTrue(overlap,(a,b,c,first,second))
                checks+=1
        self.assertEqual(checks,75)

    def test_any_alternative_complete_nonoverlapping_partition_is_accepted(self):
        target=copy.deepcopy(self.byid["constant_positive_x2_plus1_gt"])
        def Q(x): return {"kind":"rational","num":x,"den":1}
        N={"kind":"infinity","side":"negative"}
        P={"kind":"infinity","side":"positive"}
        def I(lo,hi):return {"kind":"interval","left":lo,"right":hi,
                             "includeLeft":False,"includeRight":False}
        def point(x):return {"kind":"point","value":Q(x)}
        target["parameterBranches"]=[
            {"when":section,"solution":{"kind":"all_reals"}}
            for section in (I(N,Q(-2)),point(-2),I(Q(-2),Q(1)),
                            point(1),I(Q(1),P))
        ]
        result=math.compare_claim(target)
        self.assertEqual(result["status"],"verified_complete_parameter_solution_family")

    def test_corrupted_independent_solver_never_majority_votes_to_pass(self):
        with patch.object(math,"independent_solver",return_value=S.EmptySet):
            report=math.compare_claim(self.byid["tquad_xplus1_gt"])
            self.assertEqual(report["status"],"unverified")
            self.assertIn("independent_inequality_solver_disagrees",report["reason"])
        with patch.object(math,"independent_solver",return_value=S.S.Reals):
            report=math.compare_claim(self.byid["linear_t_x_plus1_eq"])
            self.assertEqual(report["status"],"unverified")

    def test_invalid_polynomials_parameter_types_and_unknown_templates_abstain(self):
        names=[c["id"] for c in self.fixture["cases"] if c["expectedStatus"]=="unverified"]
        self.assertEqual(len(names),12)
        for name in names:
            self.assertEqual(math.compare_claim(self.byid[name])["status"],"unverified",name)
        changed=copy.deepcopy(self.fixture)
        changed["cases"]=[self.fixture["cases"][0],self.fixture["cases"][0]]
        with self.assertRaisesRegex(ValueError,"missing_or_duplicate_case_id"):
            math.check_batch(changed)

    def test_strict_cli_refuses_unverified_claims_without_production_gold(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"cases.json"
            path.write_text(json.dumps(self.fixture),encoding="utf8")
            result=subprocess.run(
                [sys.executable,str(MODULE),"--fixture",str(path),"--require-decidable"],
                capture_output=True,text=True,check=False)
            self.assertEqual(result.returncode,1,result.stderr)
            payload=json.loads(result.stdout)
            self.assertEqual(payload["summary"]["unverified"],12)
            self.assertEqual(payload["summary"]["officialExamGoldReleased"],0)


if __name__=="__main__":
    unittest.main()
