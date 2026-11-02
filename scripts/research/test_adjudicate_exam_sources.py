"""Multisource evidence research tests: disagreement must block gold release."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/"scripts/research/adjudicate_exam_sources.py"
EVIDENCE=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"
CATALOG=ROOT/"fixtures/research/exam-source-expansion-2022-2026-v0.1.json"
spec=importlib.util.spec_from_file_location("adjudicate_exam_sources",SCRIPT)
verifier=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class MultiPublisherAdjudication(unittest.TestCase):
    def setUp(self):
        self.evidence=json.loads(EVIDENCE.read_text(encoding="utf-8"))
        self.catalog=json.loads(CATALOG.read_text(encoding="utf-8"))

    def test_real_questions_require_external_adjudication_despite_correct_math(self):
        result=verifier.evaluate(self.evidence,self.catalog)
        self.assertEqual(result["status"],"research_only_multi_source_no_gold")
        self.assertEqual(result["summary"],{
            "cases":4,"mathematicalMethodChecks":8,
            "contradictedCases":2,"releasedGoldAnswers":0})
        claims={c["caseId"]:c for c in result["items"]}
        cone=claims["kaoyan-math-1-2025-q20"]
        self.assertEqual(cone["status"],"contested_needs_adjudication")
        self.assertEqual(set(cone["mathematics"].values()),{"-2*sqrt(3)*pi/3"})
        self.assertEqual(cone["sourceSupport"]["alignedSupportingPublisherGroups"],2)
        self.assertEqual(cone["sourceSupport"]["independentlyReviewedSupportingPublisherGroups"],0)
        self.assertEqual(cone["sourceSupport"]["contradictingSourceIds"],["tsekaluk-2025-q20"])
        self.assertEqual(cone["sourceSupport"]["differentProblemStatementSourceIds"],["kuaiyizhi-2025-q20"])
        covariance=claims["kaoyan-math-1-2025-q08"]
        self.assertEqual(covariance["status"],"provisionally_corrob_source_lineage_unverified")
        self.assertEqual(set(covariance["mathematics"].values()),{"C"})
        self.assertEqual(covariance["sourceSupport"]["alignedSupportingPublisherGroups"],3)
        self.assertEqual(covariance["sourceSupport"]["independentlyReviewedSupportingPublisherGroups"],0)
        integral=claims["kaoyan-math-2-2022-q02"]
        self.assertEqual(integral["status"],"blocked_original_question_not_checked")
        self.assertEqual(set(integral["mathematics"].values()),{"2/3"})
        self.assertEqual(integral["sourceSupport"]["contradictingSourceIds"],["math2-md-2022-q02-key"])
        self.assertEqual(integral["sourceSupport"]["alignedSupportingPublisherGroups"],1)
        gaokao=claims["gaokao-2025-national-1-q14"]
        self.assertEqual(gaokao["status"],"provisionally_corrob_source_lineage_unverified")
        self.assertEqual(set(gaokao["mathematics"].values()),{"61/25"})
        self.assertEqual(gaokao["sourceSupport"]["alignedSupportingPublisherGroups"],3)
        self.assertEqual(gaokao["sourceSupport"]["independentlyReviewedSupportingPublisherGroups"],0)
        self.assertFalse(gaokao["sourceFlags"]["originalPaperAuthenticated"])
        self.assertTrue(all(c["answerGoldCertified"] is False for c in result["items"]))

    def test_same_publisher_worked_and_key_are_not_two_independent_sources(self):
        src=self.evidence["cases"][2]
        result=verifier.evidence_case(src,{p["paperId"] for p in self.catalog["papers"]})
        self.assertEqual(result["sourceSupport"]["publisherGroupsRepresented"],1)
        self.assertEqual(result["sourceSupport"]["independentlyReviewedSupportingPublisherGroups"],0)

    def test_different_websites_do_not_become_independent_votes_without_lineage_review(self):
        src=copy.deepcopy(self.evidence["cases"][1])
        for item in src["sources"]:
            if item["role"]=="worked_solution":
                item["lineageReview"]="verified_independent"
        with self.assertRaisesRegex(ValueError,"unsubstantiated_lineage_claim"):
            verifier.evidence_case(src,{p["paperId"] for p in self.catalog["papers"]})

    def test_double_counts_and_claim_or_provenance_drift_fail_closed(self):
        src=copy.deepcopy(self.evidence)
        src["cases"][0]["sources"].append(copy.deepcopy(src["cases"][0]["sources"][1]))
        with self.assertRaisesRegex(ValueError,"duplicate_source_id"):
            verifier.evaluate(src,self.catalog)
        src=copy.deepcopy(self.evidence)
        src["cases"][0]["provisionalComputedResult"]="sqrt(2)*pi/4-1"
        with self.assertRaisesRegex(ValueError,"inconsistent_expected_reference"):
            verifier.evaluate(src,self.catalog)
        src=copy.deepcopy(self.evidence)
        src["cases"][1]["requiredIndependentMathMethods"]=["covariance_spectrum"]
        with self.assertRaisesRegex(ValueError,"missing_independent_math_method"):
            verifier.evaluate(src,self.catalog)
        src=copy.deepcopy(self.evidence)
        src["cases"][0]["paperId"]="kaoyan-math-4-2025"
        with self.assertRaisesRegex(ValueError,"unknown_paper"):
            verifier.evaluate(src,self.catalog)

    def test_two_methods_are_distinct_and_mathematically_consistent(self):
        for case in self.evidence["cases"]:
            proofs=verifier.math_witnesses(case["formalizedClaimId"])
            self.assertEqual(len(proofs),2)
            canon={verifier.canonical(v,case["formalizedClaimId"]) for v in proofs.values()}
            self.assertEqual(canon,{case["provisionalComputedResult"]})

    def test_source_paper_authority_and_second_review_cannot_be_wished_into_gold(self):
        src=copy.deepcopy(self.evidence["cases"][1])
        src["paperWitness"]["officialExamAuthenticated"]=True
        src["paperWitness"]["secondIndependentHumanReviewer"]=True
        src["paperWitness"]["statementFingerprinted"]=True
        out=verifier.evidence_case(src,{p["paperId"] for p in self.catalog["papers"]})
        self.assertFalse(out["answerGoldCertified"])
        self.assertEqual(out["status"],"provisionally_corrob_source_lineage_unverified")


if __name__=="__main__":
    unittest.main()
