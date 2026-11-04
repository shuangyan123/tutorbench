"""Regression controls for the Windows-safe Math-Verify 0.9.0 offline baseline.

No DeepSeek API calls. The optional dependency is installed by a separate
test-only CI environment. Windows and Unix must both use the same worker.
"""
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import compare_math_verify_baseline as baseline
import run_real_natural_math_holdout as holdout


class ExternalBaseline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.case=holdout.manifest()["cases"][0]

    def source(self,raw,mode="disabled"):
        return {"id":"h-occ-01","mode":mode,
                "family":"finite_uniform_occupancy",
                "status":"scalar_extraction_abstained","rawText":raw}

    def synthetic(self,value="671",denominator="216"):
        return {"state":"parsed","candidateCount":1,"candidates":[{
            "type":"Rational","repr":value+"/"+denominator,
            "numericKind":"exact_rational",
            "numerator":value,"denominator":denominator}]}

    def test_original_parser_abstained_on_boxed_equation(self):
        text=r"计算后，最终答案：\[\boxed{E[X]=\frac{671}{216}\approx3.1065}\]"
        self.assertEqual(holdout.extract_scalar(text)[1],
                         "scalar_extraction_abstained")

    def test_subprocess_receives_only_model_text_no_reference(self):
        text=r"得到 625/1296；最终答案 \boxed{E[X]=\frac{671}{216}\approx 3.1065}"
        with patch.object(baseline,"parse_without_gold",return_value=self.synthetic()) as mock:
            result=baseline.diagnose(self.source(text),self.case)
        mock.assert_called_once_with(text)
        self.assertEqual(result["strictTypedMathVerdict"],"accepted_by_verifier")
        self.assertEqual(result["exactAnswerUnderTypedQuestion"],"671/216")
        self.assertNotIn("rawText",result)
        self.assertTrue(result["baselineNotProductionDecision"])

    def test_wrong_extraction_diagnosed_not_concealed(self):
        with patch.object(baseline,"parse_without_gold",
                          return_value=self.synthetic("1","2")):
            result=baseline.diagnose(self.source("模型回答：1/2"),self.case)
        self.assertEqual(result["strictTypedMathVerdict"],"refuted_by_verifier")
        self.assertEqual(result["extractedNumeric"],"1/2")

    def test_float_and_symbolic_are_never_exact_verifier_gold(self):
        cases=[
            ({"state":"parsed","candidateCount":1,"candidates":[{
              "type":"Float","repr":"3.1065","numericKind":"approximate_float"}]},
             "approximate_only_no_exact_comparison"),
            ({"state":"parsed","candidateCount":1,"candidates":[{
              "type":"Equality","repr":"Eq(X, 671/216)","numericKind":"not_scalar_numeric"}]},
             "ambiguous_or_nonnumeric"),
            ({"state":"parsed","candidateCount":2,"candidates":[
              {"type":"Rational","repr":"671/216","numericKind":"exact_rational",
               "numerator":"671","denominator":"216"},
              {"type":"Rational","repr":"625/1296","numericKind":"exact_rational",
               "numerator":"625","denominator":"1296"}]},
             "ambiguous_or_nonnumeric"),
        ]
        for result,expected in cases:
            with self.subTest(expected=expected):
                with patch.object(baseline,"parse_without_gold",return_value=result):
                    data=baseline.diagnose(self.source("Final answer"),self.case)
                self.assertEqual(data["mathVerifyState"],expected)
                self.assertNotIn("strictTypedMathVerdict",data)

    def test_worker_timeout_platform_failure_and_exception_are_not_empty_parse(self):
        for state in ["worker_timeout","worker_launch_failure","parser_exception",
                      "worker_failed","worker_output_invalid"]:
            with patch.object(baseline,"parse_without_gold",return_value={"state":state}):
                data=baseline.diagnose(self.source("some answer"),self.case)
                self.assertEqual(data["mathVerifyState"],state)
                self.assertNotEqual(data["mathVerifyState"],"no_expression_extracted")

    def test_timeout_enforced_by_parent_not_math_verify_multiprocessing(self):
        args={}
        def fake_run(command,**kwargs):
            args.update(kwargs)
            return subprocess.CompletedProcess(command,0,stdout=json.dumps(self.synthetic()))
        with patch.object(baseline.subprocess,"run",side_effect=fake_run) as proc:
            result=baseline.parse_without_gold(r"\boxed{\frac{671}{216}}")
        self.assertEqual(result["state"],"parsed")
        self.assertEqual(args["timeout"],baseline.PARSE_WALL_SECONDS)
        self.assertEqual(args["encoding"],"utf8")
        self.assertEqual(args["stderr"],subprocess.DEVNULL)
        self.assertEqual(proc.call_args.args[0][0],sys.executable)
        with patch.object(baseline.subprocess,"run",
                          side_effect=subprocess.TimeoutExpired("python",10)):
            self.assertEqual(baseline.parse_without_gold("a")["state"],"worker_timeout")

    def test_actual_real_external_worker_parses_simple_boxed_expression(self):
        # In Windows this used to be [] due to the upstream internal timeout
        # and WinError5/6. A standalone subprocess + parsing_timeout=None works
        # independently of the parent's OS.
        record=baseline.parse_without_gold(
            r"最终答案：\(\boxed{\frac{671}{216}}\)")
        self.assertEqual(record["state"],"parsed",record)
        self.assertTrue(record["candidateCount"]>=1,record)
        self.assertTrue(any(x["repr"]=="671/216" for x in record["candidates"]),record)

    def test_real_compound_answer_diagnostic_may_abstain_but_must_not_fail_platform(self):
        mixed=r"答案：\[\boxed{E[X]=\frac{671}{216}\approx 3.1065}\]"
        record=baseline.parse_without_gold(mixed)
        self.assertEqual(record["state"],"parsed",record)
        # Parse completeness/selection is evaluated by real-data replay,
        # not asserted based on a simplified mock.
        report=baseline.diagnose(self.source(mixed,mode="high"),self.case)
        self.assertNotIn(report["mathVerifyState"],
                         ["worker_timeout","worker_launch_failure","parser_exception",
                          "worker_failed","worker_output_invalid"])
        self.assertTrue(report["baselineNotProductionDecision"])


if __name__=="__main__":
    unittest.main()
