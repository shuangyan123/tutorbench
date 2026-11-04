"""Offline integration and fail-closed tests for optional Hugging Face Math-Verify baseline."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import compare_math_verify_baseline as baseline
import run_real_natural_math_holdout as holdout

from sympy import Float, Rational


class MathVerifyBaselineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.case=holdout.manifest()["cases"][0]

    def source(self,raw,mode="disabled"):
        return {"id":"h-occ-01","mode":mode,
                "family":"finite_uniform_occupancy",
                "status":"scalar_extraction_abstained","rawText":raw}

    def test_current_extractor_abstains_on_real_response_format(self):
        mixed=r"计算后得到 \[ \boxed{E[X]=\frac{671}{216}\approx 3.1065} \]"
        self.assertEqual(holdout.extract_scalar(mixed)[1],"scalar_extraction_abstained")

    def test_alternative_parser_never_receives_gold(self):
        raw=r"过程包含 625/1296，最后 \boxed{E[X]=\frac{671}{216}\approx 3.1065}"
        with patch.object(baseline,"parse_without_gold",return_value=[Rational(671,216)]) as spy:
            report=baseline.diagnose(self.source(raw),self.case)
        spy.assert_called_once_with(raw)
        self.assertEqual(report["strictTypedMathVerdict"],"accepted_by_verifier")
        self.assertEqual(report["exactAnswerUnderTypedQuestion"],"671/216")
        self.assertTrue(report["baselineNotProductionDecision"])
        self.assertNotIn("rawText",report)

    def test_whether_wrong_candidate_was_extracted_is_visible(self):
        raw="最终答案：2"
        with patch.object(baseline,"parse_without_gold",return_value=[Rational(2)]) as spy:
            report=baseline.diagnose(self.source(raw),self.case)
        spy.assert_called_once_with(raw)
        self.assertEqual(report["strictTypedMathVerdict"],"refuted_by_verifier")
        self.assertEqual(report["extractedNumeric"],"2")

    def test_float_is_approximation_not_exact_proof(self):
        with patch.object(baseline,"parse_without_gold",return_value=[Float("3.1065")]):
            report=baseline.diagnose(self.source("答案约 3.1065"),self.case)
        self.assertEqual(report["mathVerifyState"],"approximate_only_no_exact_comparison")
        self.assertNotIn("strictTypedMathVerdict",report)

    def test_nonnumeric_ambiguous_and_empty_fail_closed(self):
        from sympy import Symbol
        for parsed,expected in [
            ([], "no_expression_extracted"),
            ([Symbol("x")], "ambiguous_or_nonnumeric"),
            ([Rational(1,2),Rational(3,4)], "ambiguous_or_nonnumeric"),
        ]:
            with patch.object(baseline,"parse_without_gold",return_value=parsed):
                self.assertEqual(baseline.diagnose(
                    self.source("a model explanation"),self.case)["mathVerifyState"],expected)

    def test_real_optional_package_parses_simple_boxed_fraction(self):
        # This is a test of the external package, NOT a claim the actual mixed
        # equation-plus-approximation examples will parse correctly.
        import math_verify
        extracted=baseline.parse_without_gold(r"最终答案：\boxed{\frac{671}{216}}")
        self.assertTrue(extracted)
        self.assertTrue(any(str(x)=="671/216" for x in extracted),
                        repr(extracted))

    def test_real_mixed_answer_is_diagnostic_not_automatically_promoted(self):
        # The currently supplied model answer contains both exact and
        # approximate values. Even if Math-Verify parses something, this
        # test must NOT require automatic mathematical acceptance.
        mixed=r"最终答案：\[\boxed{E[X]=\frac{671}{216}\approx 3.1065}\]"
        report=baseline.diagnose(self.source(mixed,mode="high"),self.case)
        self.assertIn(report["mathVerifyState"],(
            "exact_candidate_adjudicated","approximate_only_no_exact_comparison",
            "ambiguous_or_nonnumeric","no_expression_extracted","parser_exception"))
        self.assertTrue(report["baselineNotProductionDecision"])


if __name__=="__main__":
    unittest.main()
