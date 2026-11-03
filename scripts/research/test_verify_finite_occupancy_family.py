"""Exact occupancy-family oracle tests: no official exam gold, no human reviewer."""
import copy
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts/research/verify_finite_occupancy_family.py"
FIXTURE = ROOT / "fixtures/research/finite-occupancy-family-v0.1.json"
PRIOR_REAL_EXAM = ROOT / "fixtures/research/gaokao-2025-q14-typed-contract-v0.1.json"
SPEC = importlib.util.spec_from_file_location("finite_occupancy_math", MODULE)
math = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(math)


def model(n, d, **changes):
    m = {
        "numberOfLabels": n, "numberOfDraws": d, "uniform": True,
        "independent": True, "withReplacement": True,
        "randomVariable": "number_of_distinct_labels_seen",
    }
    m.update(changes)
    return m


class ExactFiniteOccupancyFamily(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_all_41_expected_results_are_exact_and_source_non_gold(self):
        result = math.check_batch(self.fixture)
        expected = {x["id"]: x["expectedStatus"] for x in self.fixture["cases"]}
        actual = {x["id"]: x["status"] for x in result["items"]}
        self.assertEqual(actual, expected)
        self.assertEqual(result["summary"], {
            "total": 41, "verifiedCorrect": 26, "verifiedIncorrect": 4,
            "unverified": 11, "officialExamGoldReleased": 0,
            "distinctMathematicalModelsChecked": 4,
        })
        self.assertEqual(result["status"], "research_math_family_checked_not_official_gold")
        self.assertTrue(all("officialExamGoldReleased" not in x for x in result["items"]))
        for row in result["items"]:
            if row["status"] != "unverified":
                self.assertFalse(row["sourceAuthenticatedOfficially"])

    def test_entire_2025_gaokao_q14_distribution_and_variance(self):
        work = math.proof(5, 3)
        self.assertEqual(work["total"], 125)
        self.assertEqual(work["counts"], {1: 5, 2: 60, 3: 60})
        self.assertEqual(work["expected"], Fraction(61, 25))
        self.assertEqual(work["variance"], Fraction(204, 625))
        self.assertTrue(work["exhaustiveEnumerationUsed"])
        self.assertEqual(len(work["mathematicalMethods"]), 5)
        self.assertEqual(math.exact_query_value(work, {"metric":"probability_exact","k":2}), Fraction(12,25))
        self.assertEqual(math.exact_query_value(work, {"metric":"probability_at_least","k":2}), Fraction(24,25))
        self.assertEqual(math.exact_query_value(work, {"metric":"probability_at_most","k":2}), Fraction(13,25))

    def test_original_real_exam_anchor_is_unchanged(self):
        source = json.loads(PRIOR_REAL_EXAM.read_text(encoding="utf-8"))
        anchor = self.fixture["realExamAnchor"]
        self.assertEqual(anchor["paperId"], source["exam"]["paperId"])
        self.assertEqual(anchor["question"], source["exam"]["question"])
        self.assertFalse(anchor["officialExamGoldCertified"])
        n = source["model"]["numberOfEquiprobableLabels"]
        d = source["model"]["numberOfDraws"]
        self.assertEqual((n,d),(5,3))
        self.assertEqual(source["model"]["quantity"],"number_of_distinct_labels_seen")
        self.assertEqual(math.proof(n,d)["expected"],
                         math.exact_number(source["candidateAnswers"][0]["claim"]))

    def test_100_small_models_have_identical_three_distribution_methods(self):
        for n in range(1,11):
            for d in range(0,10):
                with self.subTest(n=n,d=d):
                    w = math.proof(n, d)
                    counts = math.stirling_distribution(n, d)
                    self.assertEqual(counts,math.dynamic_distribution(n,d))
                    self.assertEqual(counts,math.inclusion_exclusion_distribution(n,d))
                    self.assertEqual(sum(counts.values()),n**d)
                    self.assertEqual(w["expected"],Fraction(n)*(1-Fraction(n-1,n)**d))
                    self.assertTrue(Fraction(0)<=w["expected"]<=min(n,d))
                    self.assertGreaterEqual(w["variance"],0)

    def test_2500_distribution_cdf_survival_complement_properties(self):
        # This is property testing of the whole supported family, not
        # rewriting the same numeric example using different constants.
        assertions = 0
        for n in range(1,26):
            for d in range(0,10):
                w = math.proof(n,d)
                mass = sum((math.exact_query_value(w,{"metric":"probability_exact","k":k})
                            for k in range(n+1)),Fraction(0))
                self.assertEqual(mass,1)
                for k in range(1,n+2):
                    lower = math.exact_query_value(w,{"metric":"probability_at_most","k":k-1})
                    upper = math.exact_query_value(w,{"metric":"probability_at_least","k":k})
                    self.assertEqual(lower+upper,1)
                    assertions+=1
        self.assertGreater(assertions,3000)

    def test_extreme_but_supported_cases_still_complete(self):
        for n,d in [(64,128),(64,0),(64,1),(3,128),(1,128),(31,60)]:
            w = math.proof(n,d)
            self.assertEqual(sum(w["counts"].values()),n**d)
            self.assertEqual(math.exact_query_value(w,{"metric":"probability_at_least","k":0}),1)
            self.assertEqual(math.exact_query_value(w,{"metric":"probability_at_most","k":n+1}),1)
            self.assertEqual(w["expected"],n*(1-Fraction(n-1,n)**d))

    def test_no_draw_and_one_label_boundary_conditions(self):
        for n in (1,2,7,64):
            w=math.proof(n,0)
            self.assertEqual(w["counts"],{0:1})
            self.assertEqual(w["expected"],0)
            self.assertEqual(w["variance"],0)
        for d in (1,2,7,128):
            w=math.proof(1,d)
            self.assertEqual(w["counts"],{1:1})
            self.assertEqual(w["expected"],1)
            self.assertEqual(w["variance"],0)

    def test_invalid_sampling_assumptions_cannot_pass_by_guess(self):
        for update in (
            {"withReplacement":False},{"uniform":False},{"independent":False},
            {"numberOfLabels":65},{"numberOfLabels":0},{"numberOfDraws":129},
            {"numberOfDraws":-1},{"numberOfDraws":2.0},
            {"uniform":1},{"randomVariable":"number_of_label_one"},
        ):
            m=model(5,3,**update)
            row={"id":"bad-assumption","model":m,
                 "query":{"metric":"expected_value"},"candidate":"61/25"}
            out=math.check_case(row)
            self.assertEqual(out["status"],"unverified",update)

    def test_answer_parsing_is_exact_never_float_tolerance_or_expression_eval(self):
        for good in ("2.44","2.440000000","61/25","+61/25","244/100"):
            self.assertEqual(math.exact_number(good),Fraction(61,25))
        for wrong in ("2.4400000000000001","2.43999999999999","2.4","61/125"):
            self.assertNotEqual(math.exact_number(wrong),Fraction(61,25))
        for unsupported in ("61/0","61/25+0","1e0","NaN",
                            "61/25;__import__('os').system('echo BAD')",
                            "Approximately 2.44",None,0.5):
            with self.assertRaises(math.Unsupported):
                math.exact_number(unsupported)

    def test_unknown_query_or_duplicate_ids_abort_or_abstain(self):
        first=copy.deepcopy(self.fixture["cases"][0])
        for question in ({"metric":"median"},{"metric":"probability_exact"},
                         {"metric":"expected_value","k":1},
                         {"metric":"probability_exact","k":1.0},
                         {"metric":"probability_exact","k":-1}):
            first["query"]=question
            self.assertEqual(math.check_case(first)["status"],"unverified")
        duplicate=copy.deepcopy(self.fixture)
        duplicate["cases"]=[first,first]
        with self.assertRaisesRegex(ValueError,"duplicated_case_id"):
            math.check_batch(duplicate)

    def test_fault_in_one_mathematical_method_is_detected_not_silently_passed(self):
        with patch.object(math,"inclusion_exclusion_distribution",return_value={1:125}):
            with self.assertRaisesRegex(AssertionError,"three_exact_distribution_methods_disagree"):
                math.proof(5,3)

    def test_absent_candidate_and_bad_case_size_fail_closed(self):
        row=copy.deepcopy(self.fixture["cases"][0])
        row.pop("candidate")
        result=math.check_case(row)
        self.assertEqual(result["status"],"unverified")
        too_many=copy.deepcopy(self.fixture)
        too_many["cases"]=too_many["cases"]*7
        with self.assertRaisesRegex(ValueError,"unsupported_case_count"):
            math.check_batch(too_many)

    def test_strict_cli_returns_failure_when_unsupported_answers_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            name=Path(tmp)/"claims.json"
            name.write_text(json.dumps(self.fixture),encoding="utf-8")
            completed=subprocess.run(
                [sys.executable,str(MODULE),"--fixture",str(name),"--require-decidable"],
                capture_output=True,text=True,check=False)
            self.assertEqual(completed.returncode,1,completed.stderr)
            decoded=json.loads(completed.stdout)
            self.assertEqual(decoded["summary"]["unverified"],11)


if __name__=="__main__":
    unittest.main()
