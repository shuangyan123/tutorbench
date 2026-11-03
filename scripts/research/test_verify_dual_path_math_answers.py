"""Research dual-path math: known-source auditing and blind no-answer replay."""
import copy
from fractions import Fraction
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
SCRIPT=ROOT/"scripts/research/verify_dual_path_math_answers.py"
DATA=ROOT/"fixtures/research/dual-path-math-evidence-v0.1.json"
EVIDENCE=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"
spec=importlib.util.spec_from_file_location("math_dual_path",SCRIPT)
bridge=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=bridge
spec.loader.exec_module(bridge)


class PublishedAndNoAnswerMathEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document=json.loads(DATA.read_text(encoding="utf8"))
        cls.sources=json.loads(EVIDENCE.read_text(encoding="utf8"))
        cls.rows={v["id"]:v for v in cls.document["cases"]}

    def test_27_decisions_with_no_false_ai_accuracy_or_official_exam_gold(self):
        report=bridge.run(self.document,self.sources)
        self.assertEqual(report["status"],"bounded_dual_path_math_verified_not_live_ai_accuracy_or_exam_gold")
        self.assertEqual(report["summary"],{
            "total":27,"reference_mathematically_verified":4,
            "reference_mathematically_refuted":2,
            "deterministic_no_answer_solution":6,
            "replayed_candidate_mathematically_verified":3,
            "replayed_candidate_mathematically_refuted":3,
            "unverified":9,"offlineReplayDecidable":6,
            "offlineReplayCorrect":3,"genuineAIModelRuns":0,
            "measuredLiveAIAccuracy":None,"officialExamGoldReleased":0,
            "realExamCasesProvenAuthenticated":0})
        self.assertEqual({r["id"]:r["status"] for r in report["items"]},
                         {r["id"]:r["expectedStatus"] for r in self.document["cases"]})
        self.assertTrue(all(r["officialExamGoldCertified"] is False and
                            r["liveAIModelCallPerformed"] is False
                            for r in report["items"]))

    def test_real_gaokao_reference_agrees_mathematically_but_origin_not_authenticated(self):
        result=bridge.adjudicate(self.rows["exam-gaokao-2025-14"],bridge.source_ledger(self.sources))
        self.assertEqual(result["status"],"reference_mathematically_verified")
        self.assertEqual(result["exactAnswerUnderTypedModel"],"61/25")
        evidence=result["sourceEvidence"]
        self.assertEqual(set(evidence["matchingPublisherClaims"]),{
            "gaokaohub-2025-q14","meloon-2025-q14","gaokaowiki-2025-q14"})
        self.assertEqual(evidence["independentlyVerifiedPublisherLineages"],0)
        self.assertFalse(evidence["paperOriginalAuthenticated"])
        self.assertEqual(evidence["sourceStatus"],"math_matches_unverified_publications")

    def test_published_reference_can_be_refuted_without_taking_publisher_vote(self):
        result=bridge.adjudicate(self.rows["reference-wrong"],bridge.source_ledger(self.sources))
        self.assertEqual(result["status"],"reference_mathematically_refuted")
        self.assertEqual(result["exactAnswerUnderTypedModel"],"61/25")
        self.assertEqual(result["submittedReference"],"61/125")
        self.assertEqual(result["sourceEvidence"]["sourceStatus"],"unsourced_candidate")
        wrong_paper=bridge.adjudicate(self.rows["reference-unpublished-paper-value"],
                                      bridge.source_ledger(self.sources))
        self.assertEqual(wrong_paper["status"],"unverified")
        self.assertIn("not_found_in_linked_sources",wrong_paper["reason"])

    def test_no_answer_produces_exact_math_without_reference_or_ai_candidate(self):
        ledger=bridge.source_ledger(self.sources)
        expected={
            "no-answer-real-exam-occupancy":"61/25",
            "no-answer-generic-occupancy":"1105/343",
            "no-answer-occupancy-variance":"204/625",
            "no-answer-occupancy-two-labels":"12/25",
        }
        for name,value in expected.items():
            case=self.rows[name]
            self.assertNotIn("referenceAnswer",case)
            self.assertNotIn("modelAttempt",case)
            result=bridge.adjudicate(case,ledger)
            self.assertEqual(result["status"],"deterministic_no_answer_solution")
            self.assertEqual(result["exactAnswerUnderTypedModel"],value,name)
            self.assertEqual(result["candidateOrigin"],"independent_exact_math_solver")
        quadratic=bridge.adjudicate(self.rows["no-answer-quadratic-irrational"],ledger)
        self.assertEqual(quadratic["status"],"deterministic_no_answer_solution")
        self.assertIn("sqrt(2)",quadratic["exactAnswerUnderTypedModel"])
        self.assertGreaterEqual(len(quadratic["mathematicalMethods"]),2)

    def test_an_offline_replay_is_not_a_real_measured_model_call(self):
        report=bridge.run(self.document,self.sources)
        ids={r["id"]:r for r in report["items"]}
        self.assertEqual(ids["offline-candidate-correct"]["status"],
                         "replayed_candidate_mathematically_verified")
        self.assertEqual(ids["offline-candidate-wrong"]["status"],
                         "replayed_candidate_mathematically_refuted")
        self.assertEqual(ids["offline-candidate-near-wrong"]["status"],
                         "replayed_candidate_mathematically_refuted")
        self.assertEqual(ids["offline-candidate-variance-correct"]["exactAnswerUnderTypedModel"],
                         "204/625")
        self.assertEqual(report["summary"]["genuineAIModelRuns"],0)
        self.assertIsNone(report["summary"]["measuredLiveAIAccuracy"])

    def test_blind_path_rejects_reference_answer_contamination_and_unattested_capture(self):
        ledger=bridge.source_ledger(self.sources)
        for name in ("no-answer-received-reference","no-answer-unsupported-capture",
                     "offline-candidate-answer-not-in-raw"):
            self.assertEqual(bridge.adjudicate(self.rows[name],ledger)["status"],
                             "unverified",name)
        changed=copy.deepcopy(self.rows["offline-candidate-correct"])
        changed["sourceCaseId"]="gaokao-2025-national-1-q14"
        self.assertEqual(bridge.adjudicate(changed,ledger)["status"],"unverified")
        changed=copy.deepcopy(self.rows["offline-candidate-correct"])
        changed["referenceAnswer"]="61/25"
        self.assertEqual(bridge.adjudicate(changed,ledger)["status"],"unverified")

    def test_source_problem_identity_cannot_be_reattached_to_different_typed_model(self):
        ledger=bridge.source_ledger(self.sources)
        for name in ("reference-false-paper-association",
                     "reference-unsupported-paper-formalization"):
            self.assertEqual(bridge.adjudicate(self.rows[name],ledger)["status"],
                             "unverified",name)
        changed=copy.deepcopy(self.rows["exam-gaokao-2025-14"])
        changed["question"]["model"]["withReplacement"]=False
        self.assertEqual(bridge.adjudicate(changed,ledger)["status"],"unverified")
        self.assertFalse(bridge.adjudicate(changed,ledger)["officialExamGoldCertified"])

    def test_source_disagreement_is_visible_and_not_corrected_by_publisher_counts(self):
        altered=copy.deepcopy(self.sources)
        q14=next(x for x in altered["cases"] if x["caseId"]==bridge.GAOKAO_SOURCE_ID)
        one=next(x for x in q14["sources"] if x["id"]=="meloon-2025-q14")
        one["claim"]="61/125"
        ledger=bridge.source_ledger(altered)
        result=bridge.adjudicate(self.rows["exam-gaokao-2025-14"],ledger)
        self.assertEqual(result["status"],"reference_mathematically_verified")
        self.assertEqual(result["sourceEvidence"]["sourceStatus"],"published_answer_conflict")
        self.assertEqual(result["sourceEvidence"]["contradictoryPublisherClaims"],
                         ["meloon-2025-q14"])
        self.assertEqual(result["sourceEvidence"]["independentlyVerifiedPublisherLineages"],0)
        self.assertFalse(result["officialExamGoldCertified"])

    def test_independent_math_is_unaffected_by_corrupted_candidate_or_publisher_key(self):
        problem=self.rows["exam-gaokao-2025-14"]["question"]
        before=bridge.question_math(problem)
        altered=copy.deepcopy(self.rows["reference-wrong"])
        altered["referenceAnswer"]="1/2"
        after=bridge.question_math(altered["question"])
        self.assertEqual(before["exactAnswer"],after["exactAnswer"])
        self.assertEqual(before["mathematicalMethods"],after["mathematicalMethods"])
        self.assertEqual(after["exactAnswer"],"61/25")

    def test_bounded_symbolic_equation_and_original_domain_holes_reused(self):
        known=bridge.adjudicate(self.rows["reference-solution-set-correct"],
                                bridge.source_ledger(self.sources))
        self.assertEqual(known["status"],"reference_mathematically_verified")
        missing=bridge.adjudicate(self.rows["reference-solution-set-missing-root"],
                                  bridge.source_ledger(self.sources))
        self.assertEqual(missing["status"],"reference_mathematically_refuted")
        self.assertIn("sqrt(2)",missing["counterexample"])
        hole=bridge.adjudicate(self.rows["reference-domain-hole"],
                               bridge.source_ledger(self.sources))
        self.assertEqual(hole["status"],"reference_mathematically_verified")

    def test_30_seeded_unseen_occupancy_models_agree_across_exact_proof_paths(self):
        rng=random.Random(20261103)
        for _ in range(30):
            n,d=rng.randint(1,9),rng.randint(0,8)
            question={
                "kind":"finite_uniform_occupancy",
                "model":{"numberOfLabels":n,"numberOfDraws":d,
                         "uniform":True,"independent":True,"withReplacement":True,
                         "randomVariable":"number_of_distinct_labels_seen"},
                "query":{"metric":"expected_value"}}
            result=bridge.question_math(question)
            exact=Fraction(n)*(1-Fraction(n-1,n)**d)
            self.assertEqual(Fraction(result["exactAnswer"]),exact)
            self.assertGreaterEqual(len(result["mathematicalMethods"]),4)

    def test_corrupted_one_of_two_math_engines_cannot_be_used_as_own_judge(self):
        ledger=bridge.source_ledger(self.sources)
        with patch.object(bridge.occupancy,"dynamic_distribution",return_value={1:1}):
            bad=bridge.adjudicate(self.rows["no-answer-real-exam-occupancy"],ledger)
            self.assertEqual(bad["status"],"unverified")
        with patch.object(bridge.algebra,"oracle_set",return_value=S.EmptySet):
            bad=bridge.adjudicate(self.rows["no-answer-quadratic-irrational"],ledger)
            self.assertEqual(bad["status"],"unverified")

    def test_unsupported_tasks_and_nonmachine_readable_candidates_fail_closed(self):
        ledger=bridge.source_ledger(self.sources)
        for name in ("no-answer-undefined-denominator","no-answer-mismatched-premises",
                     "offline-candidate-ambiguous"):
            self.assertEqual(bridge.adjudicate(self.rows[name],ledger)["status"],
                             "unverified",name)
        changed=copy.deepcopy(self.rows["offline-candidate-correct"])
        changed["question"]["kind"]="freeform_math_proof"
        self.assertEqual(bridge.adjudicate(changed,ledger)["status"],"unverified")

    def test_ledger_case_id_and_duplicate_ids_are_strict(self):
        tampered=copy.deepcopy(self.sources)
        tampered["cases"][0]["caseId"]=tampered["cases"][1]["caseId"]
        with self.assertRaisesRegex(ValueError,"source_evidence_case_identity_drift"):
            bridge.source_ledger(tampered)
        doc=copy.deepcopy(self.document)
        doc["cases"]=[self.document["cases"][0],self.document["cases"][0]]
        with self.assertRaisesRegex(ValueError,"missing_or_duplicate_case_id"):
            bridge.run(doc,self.sources)

    def test_strict_mode_reports_unverified_instead_of_falsely_completing(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"cases.json"
            path.write_text(json.dumps(self.document),encoding="utf8")
            run=subprocess.run([sys.executable,str(SCRIPT),"--fixture",str(path),
                                "--sources",str(EVIDENCE),"--require-decidable"],
                               capture_output=True,text=True,check=False,timeout=120)
            self.assertEqual(run.returncode,1,run.stderr)
            self.assertEqual(json.loads(run.stdout)["summary"]["unverified"],9)


if __name__=="__main__":
    unittest.main()
