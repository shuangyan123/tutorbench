"""Exact end-to-end tests of one Gaokao numeric result, no human review gate."""
import copy
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
MODULE=ROOT/"scripts/research/verify_gaokao_q14_exact.py"
FIXTURE=ROOT/"fixtures/research/gaokao-2025-q14-typed-contract-v0.1.json"
EVIDENCE=ROOT/"fixtures/research/exam-multi-source-evidence-v0.1.json"
spec=importlib.util.spec_from_file_location("gaokao_q14_exact",MODULE)
verifier=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class GaokaoQ14CompleteAnswer(unittest.TestCase):
    def setUp(self):
        self.fixture=json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_complete_numeric_answer_three_distinct_exact_methods(self):
        report=verifier.check_document(self.fixture)
        self.assertEqual(report["status"],"mathematics_verified_published_sources_corroborated")
        self.assertEqual(report["mathematics"]["exactReference"],"61/25")
        self.assertEqual(report["mathematics"]["orderedSampleSpaceSize"],125)
        self.assertEqual(report["mathematics"]["distributionCounts"],{"1":5,"2":60,"3":60})
        self.assertEqual(len(report["mathematics"]["methodResults"]),3)
        self.assertEqual(set(report["mathematics"]["methodResults"].values()),{"61/25"})
        classified={x["id"]:x["status"] for x in report["results"]}
        self.assertEqual(classified,{
            "original-reported-fraction":"verified_correct_under_typed_model",
            "equivalent-decimal":"verified_correct_under_typed_model",
            "incorrect-three-distinct":"verified_incorrect_under_typed_model",
            "incorrect-61-over-125":"verified_incorrect_under_typed_model",
            "malformed-claim":"unverified",
            "unknown-language":"unverified"})
        self.assertTrue(report["sourceCertification"]["publishedConsensusPresent"])
        self.assertEqual(report["sourceCertification"]["publishedMatchingAnswerHosts"],3)
        self.assertFalse(report["sourceCertification"]["officialExamGoldCertified"])
        self.assertFalse(report["sourceCertification"]["publisherIndependenceAuthenticated"])

    def test_correctness_does_not_depend_on_manual_reviewer_or_external_judge(self):
        unreviewed=copy.deepcopy(self.fixture)
        self.assertTrue(unreviewed["verificationPolicy"]["doNotDependOnHumanReview"])
        unreviewed["sourceEvidence"]["pdfWitness"]["paperTextAutomaticallyAuthenticated"]=False
        self.assertEqual(verifier.check_document(unreviewed)["mathematics"]["exactReference"],"61/25")

    def test_published_source_disagreement_prevents_consensus_not_math_truth(self):
        changed=copy.deepcopy(self.fixture)
        sources=changed["sourceEvidence"]["sameQuestionIndependentPages"]
        next(x for x in sources if x["publisherGroup"]=="gaokaowiki")["claimedAnswer"]="3"
        report=verifier.check_document(changed)
        self.assertEqual(report["status"],"mathematics_verified_source_consensus_unresolved")
        self.assertEqual(report["sourceCertification"]["publishedConflictingAnswerHosts"],1)
        self.assertFalse(report["sourceCertification"]["officialExamGoldCertified"])
        self.assertEqual(report["mathematics"]["exactReference"],"61/25")

    def test_repeated_website_publisher_is_not_independent_evidence(self):
        changed=copy.deepcopy(self.fixture)
        sources=changed["sourceEvidence"]["sameQuestionIndependentPages"]
        sources[1]["publisherGroup"]=sources[2]["publisherGroup"]
        with self.assertRaisesRegex(verifier.Unsupported,"untraceable_or_duplicate_source"):
            verifier.check_document(changed)

    def test_formula_and_exhaustive_enumeration_agree_for_42_small_models(self):
        for n in range(1,8):
            for d in range(0,6):
                model={"numberOfEquiprobableLabels":n,"numberOfDraws":d,
                       "drawsWithReplacement":True,"independentDraws":True,
                       "samplingUniform":True,"quantity":"number_of_distinct_labels_seen"}
                proof=verifier.derive(model)
                self.assertEqual(len(set(proof["methods"].values())),1,(n,d))
                self.assertEqual(sum(proof["distributionCounts"].values()),n**d)
                self.assertEqual(proof["reference"],Fraction(n*(n**d-(n-1)**d),n**d))
                if d>0:
                    self.assertTrue(Fraction(1)<=proof["reference"]<=min(n,d))

    def test_wrong_problem_assumptions_or_question_identity_refused(self):
        for key,value in (("drawsWithReplacement",False),
                          ("independentDraws",False),
                          ("samplingUniform",False),
                          ("quantity","number_of_times_label_one_seen"),
                          ("numberOfDraws",4)):
            changed=copy.deepcopy(self.fixture)
            changed["model"][key]=value
            with self.assertRaises((verifier.Unsupported,ValueError),msg=key):
                verifier.check_document(changed)
        changed=copy.deepcopy(self.fixture)
        changed["exam"]["question"]=13
        with self.assertRaises(ValueError):
            verifier.check_document(changed)

    def test_source_missing_and_fake_web_claims_cannot_become_official_gold(self):
        changed=copy.deepcopy(self.fixture)
        changed["sourceEvidence"]["sameQuestionIndependentPages"]=[
            x for x in changed["sourceEvidence"]["sameQuestionIndependentPages"]
            if x["claimedAnswer"] is None]
        report=verifier.check_document(changed)
        self.assertEqual(report["status"],"mathematics_verified_source_consensus_unresolved")
        self.assertFalse(report["sourceCertification"]["publishedConsensusPresent"])
        changed=copy.deepcopy(self.fixture)
        changed["sourceEvidence"]["sameQuestionIndependentPages"][1]["statementFeatures"]=["five_labeled_balls"]
        report=verifier.check_document(changed)
        self.assertEqual(report["sourceCertification"]["publishedMatchingAnswerHosts"],2)
        self.assertFalse(report["sourceCertification"]["officialExamGoldCertified"])

    def test_cross_check_prior_multisource_evidence_has_same_exam_identity_and_answer(self):
        historical=json.loads(EVIDENCE.read_text(encoding="utf-8"))
        case=next(x for x in historical["cases"] if x["caseId"]=="gaokao-2025-national-1-q14")
        self.assertEqual(case["paperId"],self.fixture["exam"]["paperId"])
        self.assertEqual(case["question"],self.fixture["exam"]["question"])
        self.assertEqual(case["provisionalComputedResult"],verifier.check_document(self.fixture)["mathematics"]["exactReference"])
        publications={x["url"] for x in case["sources"] if x["role"]=="worked_solution"}
        records={x["url"] for x in self.fixture["sourceEvidence"]["sameQuestionIndependentPages"] if x["claimedAnswer"] is not None}
        self.assertEqual(publications,records)

    def test_numeric_parser_exactness_and_refusal(self):
        for equivalent in ["61/25","2.44","2.440000000", " 61/25 "]:
            self.assertEqual(verifier.exact_numeric(equivalent),Fraction(61,25))
        for bad in ["2.439999999","2.439", "1/0","nan","Inf","61/25+0",
                    "os.system('rm -rf /')"]:
            if bad=="2.439999999":
                self.assertNotEqual(verifier.exact_numeric(bad),Fraction(61,25))
            elif bad=="2.439":
                self.assertNotEqual(verifier.exact_numeric(bad),Fraction(61,25))
            else:
                with self.assertRaises(verifier.Unsupported,msg=bad):
                    verifier.exact_numeric(bad)


if __name__=="__main__":
    unittest.main()
