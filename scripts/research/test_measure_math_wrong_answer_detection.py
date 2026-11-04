"""Adversarial math detection: don't pass by abstaining or grading yourself."""
from copy import deepcopy
from pathlib import Path
import json
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import measure_math_wrong_answer_detection as detection
import verify_dual_path_math_answers as bridge

FIXTURE=ROOT/"fixtures/research/math-wrong-answer-detection-v0.1.json"


class WrongAnswerDetectionResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf8"))

    def test_complete_54_case_detection_matrix_has_zero_false_accepts(self):
        report=detection.run(self.fixture)
        s=report["summary"]
        self.assertEqual(s["total"],54)
        self.assertEqual(s["knownCorrect"],20)
        self.assertEqual(s["knownWrong"],28)
        self.assertEqual(s["knownUnsupported"],6)
        self.assertEqual(s["wrongDetected"],28)
        self.assertEqual(s["wrongFalselyAccepted"],0)
        self.assertEqual(s["wrongAbstained"],0)
        self.assertEqual(s["correctAccepted"],20)
        self.assertEqual(s["correctFalselyRefuted"],0)
        self.assertEqual(s["correctAbstained"],0)
        self.assertEqual(s["unsupportedAbstained"],6)
        self.assertEqual(s["unsupportedGivenVerdict"],0)
        self.assertEqual(s["wrongAnswerDetectionRecall"],
                         {"numerator":28,"denominator":28,"value":1.0})
        self.assertEqual(s["falseAcceptanceRateOnKnownWrong"],
                         {"numerator":0,"denominator":28,"value":0})
        self.assertEqual(s["supportedAnswerDecisionCoverage"],
                         {"numerator":48,"denominator":48,"value":1.0})
        self.assertTrue(s["falseAcceptanceGatePassed"])
        self.assertTrue(s["fullSupportedDecisionCoverageGatePassed"])
        self.assertIsNone(s["measuredLiveModelErrorDetectionRate"])
        self.assertEqual(s["genuineModelRuns"],0)
        self.assertEqual(s["officialExamGoldReleased"],0)
        self.assertEqual(set(report["byFamily"]),{
            "finite_uniform_occupancy","finite_arithmetic_geometric_sum",
            "circle_line_intersections","quadratic_real_solution_set",
            "parametric_circle_line_intersection_count","unimplemented_open_math"})
        for item in report["items"]:
            self.assertTrue(item["syntheticOnly"])
            if item["truthLabel"]=="wrong":
                self.assertEqual(item["verdict"],"detected_wrong",item["id"])
            elif item["truthLabel"]=="correct":
                self.assertEqual(item["verdict"],"accepted_correct",item["id"])
            else:
                self.assertEqual(item["verdict"],"abstained",item["id"])

    def test_quadratic_set_model_replay_is_canonical_json_and_not_scalar_only(self):
        # Regression found by the adversarial matrix: existing-answer checks
        # could handle typed quadratic sets, but offline model replies wrongly
        # went down the scalar-only extraction branch and always abstained.
        for row in self.fixture["cases"]:
            if row["family"]!="quadratic_real_solution_set" or row["truthLabel"]=="unsupported":
                continue
            with self.subTest(id=row["id"]):
                r=detection.compare_one(row)
                self.assertEqual(r["verdict"],
                    "accepted_correct" if row["truthLabel"]=="correct" else "detected_wrong")
                tampered=deepcopy(row)
                tampered["modelAttempt"]["rawText"]="My reasoning: "+row["modelAttempt"]["rawText"]
                verdict=detection.compare_one(tampered)
                self.assertEqual(verdict["verdict"],"abstained")

    def test_exposes_whether_a_mutant_answer_wrongly_passes(self):
        # Fault injection: if verifier blindly accepts any supported candidate,
        # false acceptance rate MUST rise; cannot report 100% robust detection.
        with patch.object(bridge,"validate_candidate",return_value=(True,"forged",None)):
            report=detection.run(self.fixture)
        s=report["summary"]
        self.assertEqual(s["wrongFalselyAccepted"],28)
        self.assertEqual(s["wrongDetected"],0)
        self.assertEqual(s["falseAcceptanceRateOnKnownWrong"]["value"],1)
        self.assertFalse(s["falseAcceptanceGatePassed"])

    def test_exposes_false_rejection_of_mathematically_correct_answers(self):
        with patch.object(bridge,"validate_candidate",return_value=(False,"forged",None)):
            report=detection.run(self.fixture)
        self.assertEqual(report["summary"]["correctFalselyRefuted"],20)
        self.assertEqual(report["summary"]["falseRejectionRateOnKnownCorrect"]["value"],1)
        self.assertFalse(report["summary"]["falseAcceptanceGatePassed"])

    def test_abstaining_on_every_answer_cannot_pass_coverage_gate(self):
        with patch.object(bridge,"validate_candidate",side_effect=bridge.Abstain("forced_abstention")):
            report=detection.run(self.fixture)
        self.assertEqual(report["summary"]["wrongAbstained"],28)
        self.assertEqual(report["summary"]["correctAbstained"],20)
        self.assertEqual(report["summary"]["supportedAnswerDecisionCoverage"]["value"],0)
        self.assertTrue(report["summary"]["falseAcceptanceGatePassed"])
        self.assertFalse(report["summary"]["fullSupportedDecisionCoverageGatePassed"])

    def test_independent_oracle_fails_on_fake_truth_labels(self):
        original=next(r for r in self.fixture["cases"] if
                      r["oracleKey"]=="sequence-mixed" and r["truthLabel"]=="wrong")
        row=deepcopy(original)
        row["truthLabel"]="correct"
        with self.assertRaisesRegex(detection.InvalidControl,"truth_label_disagrees"):
            detection.compare_one(row)
        original=next(r for r in self.fixture["cases"] if
                      r["oracleKey"]=="quadratic-domain-hole" and r["truthLabel"]=="wrong")
        row=deepcopy(original)
        row["truthLabel"]="correct"
        with self.assertRaisesRegex(detection.InvalidControl,"truth_label_disagrees"):
            detection.compare_one(row)

    def test_oracle_is_not_same_as_production_verifier_answer(self):
        # This control witness is from complete finite enumeration; then
        # deliberately fake the verdict without modifying independent truth.
        self.assertEqual(str(detection.numeric_ground_truth("occupancy-expectation")),"61/25")
        self.assertEqual(str(detection.numeric_ground_truth("occupancy-single")),"1/25")
        self.assertEqual(str(detection.numeric_ground_truth("occupancy-double")),"12/25")
        self.assertEqual(str(detection.numeric_ground_truth("sequence-mixed")),"49")
        self.assertEqual(str(detection.numeric_ground_truth("sequence-zero")),"0")
        self.assertEqual(str(detection.numeric_ground_truth("sequence-arithmetic")),"100")
        from sympy import S,sqrt,FiniteSet,Interval
        self.assertEqual(detection.expected_symbolic("quadratic-roots"),FiniteSet(-sqrt(2),sqrt(2)))
        self.assertEqual(detection.expected_symbolic("parameter-two"),Interval.open(-1,1))
        self.assertEqual(detection.expected_symbolic("parameter-constant-one"),S.Reals)

    def test_exact_boundaries_and_near_miss_are_detected_not_abstained(self):
        keywords={
            "near_miss_decimal",
            "incorrect_radical",
            "cancel_denominator_domain_hole",
            "include_equality_endpoints",
            "include_tangency_boundaries",
            "include_tangent_as_disjoint",
            "missing_negative_root",
            "invent_extra_root",
        }
        report=detection.run(self.fixture)
        for item in report["items"]:
            if item["errorMode"] in keywords:
                self.assertEqual(item["verdict"],"detected_wrong",item["id"])
        self.assertTrue(keywords.issubset({x["errorMode"] for x in report["items"]}))

    def test_changing_question_without_oracle_key_is_rejected_before_verification(self):
        row=deepcopy(self.fixture["cases"][0])
        row["question"]["model"]["numberOfLabels"]=6
        with self.assertRaisesRegex(detection.InvalidControl,"oracle_key_and_question_not_identical"):
            detection.compare_one(row)
        row=deepcopy(self.fixture["cases"][0])
        row["oracleKey"]="sequence-mixed"
        with self.assertRaisesRegex(detection.InvalidControl,"oracle_key_and_question_not_identical"):
            detection.compare_one(row)

    def test_blind_model_reply_never_contains_gold_label(self):
        for row in self.fixture["cases"]:
            self.assertEqual(row["modelAttempt"]["captureKind"],"offline_replay")
            self.assertEqual(row["modelAttempt"]["modelId"],"synthetic-mutant-not-live")
            self.assertNotIn("referenceAnswer",row)
            self.assertNotIn("sourceCaseId",row)
            self.assertNotIn("officialExamGold",row)
        # Invariant: the tested bridge receives only id, question and reply.
        exemplar=next(x for x in self.fixture["cases"] if x["truthLabel"]=="wrong")
        with patch.object(bridge,"adjudicate",wraps=bridge.adjudicate) as probe:
            detection.compare_one(exemplar)
            case,source=probe.call_args.args
        self.assertEqual(set(case),{"id","path","question","modelAttempt"})
        self.assertEqual(case["path"],"no_answer")
        self.assertEqual(source,{})

    def test_broken_canonical_replay_is_missing_detection_not_false_safety(self):
        original=next(x for x in self.fixture["cases"] if x["oracleKey"]=="circle-irrational" and x["truthLabel"]=="wrong")
        mutant=deepcopy(original)
        mutant["modelAttempt"]["rawText"]="Incorrect: "+mutant["modelAttempt"]["rawText"]
        result=detection.compare_one(mutant)
        self.assertEqual(result["verdict"],"abstained")
        report=detection.metrics([result])
        self.assertEqual(report["wrongAbstained"],1)
        self.assertEqual(report["wrongDetected"],0)
        self.assertEqual(report["falseAcceptanceRateOnKnownWrong"]["denominator"],1)

    def test_duplicate_case_ids_and_untrusted_live_claim_fail_closed(self):
        doc=deepcopy(self.fixture)
        doc["cases"].append(doc["cases"][0])
        with self.assertRaisesRegex(ValueError,"duplicate_or_invalid_mutant_id"):
            detection.run(doc)
        row=deepcopy(self.fixture["cases"][0])
        row["modelAttempt"]["captureKind"]="real_model_response"
        with self.assertRaisesRegex(detection.InvalidControl,"cannot_use_live"):
            detection.compare_one(row)
        row=deepcopy(self.fixture["cases"][0])
        row["labelFromSource"]="official"
        with self.assertRaisesRegex(detection.InvalidControl,"invalid_mutant_case_schema"):
            detection.compare_one(row)

    def test_cli_recalculates_metrics_and_enforces_gates(self):
        cmd=[sys.executable,str(ROOT/"scripts/research/measure_math_wrong_answer_detection.py"),
             "--fixture",str(FIXTURE),
             "--require-zero-false-decisions","--require-full-supported-coverage"]
        proc=subprocess.run(cmd,capture_output=True,text=True,check=False,timeout=90)
        self.assertEqual(proc.returncode,0,proc.stderr)
        data=json.loads(proc.stdout)
        self.assertEqual(data["summary"]["wrongDetected"],28)
        self.assertEqual(data["summary"]["wrongFalselyAccepted"],0)
        self.assertEqual(data["summary"]["knownUnsupported"],6)
        self.assertEqual(data["summary"]["genuineModelRuns"],0)


if __name__=="__main__":
    unittest.main()
