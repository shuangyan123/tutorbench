"""Research-only contextual expectation adapter: provenance and negative controls.

Uses existing isolated Math-Verify worker. No model API calls or synthetic
accuracy claims. The exact E[X] right-hand side is allowed only in a uniquely
boxed final answer to a typed expectation question. Wrong-variable, multiple
boxes, contradictory approximation and invalid parser results always abstain.
"""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import check_contextual_expectation_baseline as adapter
import run_real_natural_math_holdout as holdout

NOND=r"""设出现的标签数为 X，计算：
\[
E[X]=6(1-(5/6)^4)=\frac{671}{216}.
\]
最终答案：
\[
\boxed{E[X]=\frac{671}{216}\approx 3.1065}
\]
"""
HIGH=r"""设 I_i 为每个标签是否出现的指标。
\[
E[X]=6\left[1-\left(\frac56\right)^4\right]
=6\frac{671}{1296}.
\]
最终答案：
\[
\boxed{E[X]=\frac{671}{216}\approx 3.1065}
\]
即平均约 3.1065 种不同标签。
"""


class ContextualExpectationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=holdout.manifest()
        cls.case=next(c for c in cls.doc["cases"] if c["id"]=="h-occ-01")
        cls.question=cls.case["question"]

    def test_both_real_answer_shapes_source_bind_and_exact_check(self):
        for raw in (NOND,HIGH):
            with self.subTest(first=raw[:12]):
                verdict=adapter.evaluate(raw,self.question)
                self.assertEqual(verdict["state"],"contextual_exact_candidate_adjudicated",verdict)
                self.assertEqual(verdict["exactCandidate"],"671/216")
                self.assertEqual(verdict["verifierStatus"],"accepted_by_verifier")
                self.assertEqual(verdict["exactAnswerUnderTypedQuestion"],"671/216")
                self.assertEqual(verdict["displayedApproximation"],"3.1065")
                self.assertFalse(verdict["productionDecision"])
                self.assertFalse(verdict["independentRealGoldReview"])

    def test_wrong_final_fraction_is_refuted_but_not_overwritten(self):
        raw=r"过程有 671/216，但结论：\boxed{E[X]=\frac{2}{3}\approx0.6667}"
        report=adapter.evaluate(raw,self.question)
        self.assertEqual(report["state"],"contextual_exact_candidate_adjudicated",report)
        self.assertEqual(report["verifierStatus"],"refuted_by_verifier")
        self.assertEqual(report["exactCandidate"],"2/3")
        self.assertEqual(report["exactAnswerUnderTypedQuestion"],"671/216")

    def test_context_binding_rejects_unrelated_equations(self):
        for box in (
            r"\boxed{x=\frac{671}{216}}",
            r"\boxed{E[Y]=\frac{671}{216}}",
            r"\boxed{2X=\frac{671}{216}}",
            r"\boxed{\frac{671}{216}}",
            r"\boxed{E[X]=E[Y]=\frac{671}{216}}",
        ):
            with self.subTest(box=box):
                result=adapter.evaluate("最终："+box,self.question)
                self.assertEqual(result["state"],"contextual_abstained",result)

    def test_multiple_or_malformed_boxed_answers_must_abstain(self):
        for raw in (
            r"\boxed{E[X]=\frac{671}{216}} 又算得 \boxed{E[X]=2}",
            r"\boxed{E[X]=\frac{671}{216}",
            r"计算是 E[X]=\frac{671}{216}。无最终方框。",
        ):
            with self.subTest(raw=raw):
                self.assertEqual(adapter.evaluate(raw,self.question)["state"],"contextual_abstained")

    def test_approximation_conflict_and_double_mark_abstain(self):
        for raw in (
            r"\boxed{E[X]=\frac{671}{216}\approx9}",
            r"\boxed{E[X]=\frac{671}{216}\approx3.10648\approx3.1}",
            r"\boxed{E[X]=\frac{671}{216}\approx误差很小}",
        ):
            with self.subTest(raw=raw):
                self.assertEqual(adapter.evaluate(raw,self.question)["state"],"contextual_abstained")

    def test_unsupported_question_must_abstain_before_parser(self):
        # Another occupancy metric may also be an expectation; use a clearly
        # different family to assert the domain restriction.
        other=next(x["question"] for x in self.doc["cases"]
                   if x["question"]["kind"]=="finite_arithmetic_geometric_sum")
        with patch.object(adapter.mv,"parse_without_gold",
                          side_effect=AssertionError("parser_should_not_run")):
            self.assertEqual(adapter.evaluate(NOND,other)["state"],"contextual_abstained")

    def test_worker_failure_and_ambiguous_results_are_inconclusive(self):
        result={"state":"worker_timeout"}
        with patch.object(adapter.mv,"parse_without_gold",return_value=result):
            self.assertEqual(adapter.evaluate(NOND,self.question)["state"],"contextual_abstained")
        ambiguous={
            "state":"parsed","candidateCount":2,"candidates":[
                {"type":"Rational","repr":"671/216",
                 "numericKind":"exact_rational","numerator":"671","denominator":"216"},
                {"type":"Rational","repr":"2","numericKind":"exact_rational",
                 "numerator":"2","denominator":"1"},
            ]}
        with patch.object(adapter.mv,"parse_without_gold",return_value=ambiguous):
            self.assertEqual(adapter.evaluate(NOND,self.question)["state"],"contextual_abstained")

    def test_only_boxed_right_hand_sent_to_existing_parser(self):
        with patch.object(adapter.mv,"parse_without_gold",
                          return_value={"state":"parsed","candidateCount":1,"candidates":[{
                              "type":"Rational","repr":"671/216","numericKind":"exact_rational",
                              "numerator":"671","denominator":"216",
                          }]}) as fake:
            actual=adapter.evaluate(NOND,self.question)
        fake.assert_called_once_with(r"\boxed{\frac{671}{216}}")
        self.assertEqual(actual["verifierStatus"],"accepted_by_verifier")
        self.assertNotIn("userFinalAnswerGold",actual)

    def test_rounding_boundary_and_termination(self):
        self.assertTrue(adapter.compatible_rounding("671/216","3.1065"))
        self.assertFalse(adapter.compatible_rounding("671/216","3.1064"))
        self.assertTrue(adapter.compatible_rounding("2/3","0.6667"))
        self.assertFalse(adapter.compatible_rounding("2/3","0.9"))
        self.assertTrue(adapter.compatible_rounding("1/2",None))

    def test_previous_extractor_and_third_party_baseline_remain_unchanged(self):
        # The contextual approach supplements, not overwrites, the frozen
        # historical statuses or official gold.
        self.assertEqual(holdout.extract_scalar(NOND)[1],"scalar_extraction_abstained")
        self.assertEqual(holdout.extract_scalar(HIGH)[1],"scalar_extraction_abstained")


if __name__=="__main__":
    unittest.main()
