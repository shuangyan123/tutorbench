"""Exact entire parameter-axis root-family validation and mutation checks."""
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
MODULE=ROOT/"scripts/research/verify_parameter_quadratics.py"
FIXTURE=ROOT/"fixtures/research/parameter-affine-quadratic-real-roots-v0.1.json"
spec=importlib.util.spec_from_file_location("exact_parameter_quadratics",MODULE)
solver=importlib.util.module_from_spec(spec)
spec.loader.exec_module(solver)


class ParameterQuadraticCompleteSolutions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf8"))
        cls.cases={c["id"]:c for c in cls.fixture["cases"]}

    def test_all_54_expected_cases_have_exact_result(self):
        result=solver.check_batch(self.fixture)
        self.assertEqual(result["summary"],{
            "total":54,"verifiedComplete":26,"refuted":15,
            "unverified":13,"officialExamGoldReleased":0})
        self.assertEqual({x["id"]:x["status"] for x in result["items"]},
                         {c["id"]:c["expectedStatus"] for c in self.fixture["cases"]})
        self.assertTrue(all(x["officialExamGoldCertified"] is False for x in result["items"]))
        self.assertTrue(all(x["sampleChecks"]>0 for x in result["items"]
                            if x["status"]=="verified_complete_parameter_solution_family"))

    def test_quadratic_to_linear_transition_and_discriminant_corner(self):
        row=solver.check_claim(self.cases["quadratic-with-linear-drop-and-double"])
        self.assertEqual(row["status"],"verified_complete_parameter_solution_family")
        self.assertEqual(row["criticalParameters"],["0","1/4"])
        missing=solver.check_claim(self.cases["same-equation-missed-linear-drop"])
        self.assertEqual(missing["status"],"refuted_parameter_solution_family")
        self.assertEqual(missing["parameterWitness"],"0")
        self.assertEqual(missing["expectedSolutionRule"],"linear")

    def test_all_real_at_only_one_parameter_cannot_be_lost(self):
        right=solver.check_claim(self.cases["all-at-t0-none-else"])
        self.assertEqual(right["status"],"verified_complete_parameter_solution_family")
        wrong=solver.check_claim(self.cases["all-at-t0-missing"])
        self.assertEqual(wrong["status"],"refuted_parameter_solution_family")
        self.assertEqual(wrong["parameterWitness"],"0")
        self.assertEqual(wrong["expectedRootsAtWitness"],"Reals")

    def test_irrational_discriminant_parameter_endpoints(self):
        row=solver.check_claim(self.cases["quadratic-surd-boundaries"])
        self.assertEqual(row["status"],"verified_complete_parameter_solution_family")
        self.assertTrue({"-sqrt(2)","sqrt(2)"}.issubset(set(row["criticalParameters"])))
        bad=solver.check_claim(self.cases["quadratic-surd-boundaries-bad-inside"])
        self.assertEqual(bad["status"],"refuted_parameter_solution_family")
        self.assertEqual(bad["expectedSolutionRule"],"empty")

    def test_disjoint_union_covering_all_real_parameter_values(self):
        good=solver.check_claim(self.cases["linear-alternate-valid-four-segments"])
        self.assertEqual(good["status"],"verified_complete_parameter_solution_family")
        for name in ("gap-at-parameter-zero","overlap-at-parameter-zero",
                     "gap-in-noncritical-cell"):
            wrong=solver.check_claim(self.cases[name])
            self.assertEqual(wrong["status"],"refuted_parameter_solution_family")
            self.assertEqual(wrong["reason"],"missing_or_overlapping_parameter_case")
            self.assertIsNotNone(wrong["parameterWitness"])

    def test_all_parameter_false_cases_have_exact_counterexample(self):
        for row in self.fixture["cases"]:
            if row["expectedStatus"]!="refuted_parameter_solution_family":continue
            with self.subTest(case=row["id"]):
                result=solver.check_claim(row)
                self.assertEqual(result["status"],"refuted_parameter_solution_family")
                self.assertIsNotNone(result["parameterWitness"])
                if result["reason"]=="incorrect_complete_root_family":
                    self.assertNotEqual(result["expectedSolutionRule"],result["actualSolutionRule"])
                    self.assertTrue(result["expectedRootsAtWitness"])
                else:
                    self.assertNotEqual(result["matchedBranches"],1)

    def test_64_seeded_random_coefficient_triples_exact_vs_sympy_at_all_critical_points(self):
        rng=random.Random(20261103)
        checks=0
        for _ in range(64):
            coefficients=[(rng.randint(-3,3),rng.randint(-3,3)) for _ in range(3)]
            a,b,c=(S.Integer(z)+S.Integer(t)*solver.T for z,t in coefficients)
            delta=S.expand(b*b-4*a*c)
            critical=set()
            for p in (a,b,c,delta):critical.update(solver.polynomial_roots(p))
            ordered=sorted(critical,key=solver.cmp_to_key(solver.compare))
            edges=[-S.oo,*ordered,S.oo]
            for param in [*ordered,*[solver.point_between(lo,hi) for lo,hi in zip(edges,edges[1:])]]:
                expected=solver.rule_at(a,b,c,param)
                formula=solver.explicit_set_at(a,b,c,param,expected)
                oracle=solver.oracle_at(a,b,c,param)
                self.assertTrue(solver.same_solution_sets(formula,oracle),
                    (coefficients,param,expected,formula,oracle))
                checks+=1
        self.assertGreater(checks,120)

    def test_no_parameter_sample_is_mistaken_for_a_global_proof(self):
        wrong=self.cases["same-equation-wrong-double-boundary"]
        output=solver.check_claim(wrong)
        self.assertEqual(output["parameterWitness"],"1/4")
        self.assertEqual(output["expectedSolutionRule"],"double")
        self.assertEqual(output["actualSolutionRule"],"quadratic_pair")

    def test_faulty_independent_solver_abstains_even_if_branch_template_matches(self):
        with patch.object(solver,"oracle_at",return_value=S.EmptySet):
            row=solver.check_claim(self.cases["x2-minus-t"])
            self.assertEqual(row["status"],"unverified")
            self.assertIn("independent_exact_solver_disagrees",row["reason"])
        with patch.object(solver,"oracle_at",return_value=S.S.Reals):
            row=solver.check_claim(self.cases["x2-plus-one-none"])
            self.assertEqual(row["status"],"unverified")

    def test_malformed_source_fields_and_unapproved_formula_syntax_abstain(self):
        for name in ("unknown-formula-kind","missing-quadratic-coefficient",
                     "coefficient-operator-injection","quadratic-coefficient-beyond-bound",
                     "fractional-coefficient-zero-denominator",
                     "unsupported-param-nonlinearity","malformed-root-surd",
                     "reversed-interval","boolean-not-int-coefficient",
                     "bad-infinite-closure","point-at-infinity",
                     "nonboolean-closure","unknown-schema-filler"):
            self.assertEqual(solver.check_claim(self.cases[name])["status"],"unverified",name)

    def test_zero_polynomial_and_real_root_condition_are_explicitly_separated(self):
        for caseid,expected in (("zero-polynomial-all","all_reals"),
                                ("x2-double-zero","double"),
                                ("plain-linear-zero","linear"),
                                ("x2-plus-one-none","empty")):
            row=self.cases[caseid]
            self.assertEqual(solver.check_claim(row)["status"],
                             "verified_complete_parameter_solution_family")
            self.assertEqual(row["parameterBranches"][0]["solution"]["kind"],expected)

    def test_parameter_coefficient_scaling_preserves_all_exact_root_families(self):
        rng=random.Random(31415926)
        tested=0
        for _ in range(15):
            factors=[(rng.randint(-4,4),rng.randint(-4,4)) for _ in range(3)]
            eq=[S.Integer(i)+S.Integer(j)*solver.T for i,j in factors]
            for param in (S.Integer(-2),S.Integer(0),S.Rational(1,4),S.Integer(2)):
                original_rule=solver.rule_at(*eq,param)
                original_set=solver.explicit_set_at(*eq,param,original_rule)
                for scale in (-3,2,5):
                    scaled=[scale*v for v in eq]
                    changed_rule=solver.rule_at(*scaled,param)
                    changed_set=solver.explicit_set_at(*scaled,param,changed_rule)
                    self.assertEqual(changed_rule,original_rule)
                    self.assertTrue(solver.same_solution_sets(original_set,changed_set))
                    tested+=1
        self.assertEqual(tested,180)

    def test_strict_cli_refuses_unverifiable_claims(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"fixtures.json"
            path.write_text(json.dumps(self.fixture),encoding="utf8")
            proc=subprocess.run([sys.executable,str(MODULE),"--fixture",str(path),"--require-decidable"],
                                capture_output=True,text=True,check=False)
            self.assertEqual(proc.returncode,1,proc.stderr)
            self.assertEqual(json.loads(proc.stdout)["summary"]["unverified"],13)


if __name__=="__main__":
    unittest.main()
