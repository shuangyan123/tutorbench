"""Regression checks on the public projection; no private paper or answer is loaded."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import inspect_real_exam_alignment as pilot


class AlignmentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frozen = json.loads(pilot.MANIFEST.read_text("utf8"))
        cls.edition = pilot.inventory()

    def setUp(self):
        self.doc = deepcopy(self.frozen)
        self.rows = self.doc["items"]

    def reject(self, message):
        with self.assertRaisesRegex(ValueError, message):
            pilot.inspect(self.doc, self.edition)

    def test_frozen_denominators(self):
        r = pilot.inspect(self.doc, self.edition)
        self.assertEqual((9, 7, 9), (r["selected"], r["itemsWithPrimaryClause"], r["itemsWithConcepts"]))
        self.assertEqual((17, 19), (len(r["clauses"]), len(r["nodes"])))
        self.assertEqual({"verified": 2, "abstained": 7}, r["wholeAnswers"])
        self.assertEqual(1, r["subclaimOnly"])
        self.assertFalse(r["privateEvidenceReplayed"])
        self.assertEqual(0, r["independentReviews"])
        self.assertIsNone(r["learnerOutcomes"])

    def test_changed_clause_or_node_under_same_id(self):
        for records, field in [("requirements", "summary"), ("nodes", "label")]:
            edition = deepcopy(self.edition)
            rows = edition["knowledgeGraph"]["nodes"] if records == "nodes" else edition[records]
            rows[0][field] += " changed"
            with self.assertRaisesRegex(ValueError, "inventory contents changed"):
                pilot.inspect(self.doc, edition)

    def test_missing_or_duplicate_case(self):
        self.rows.append(self.rows[0])
        self.reject("denominator")
        self.rows.pop()
        self.rows[1] = self.rows[0]
        self.reject("identity")
        self.rows.pop()
        self.reject("denominator")

    def test_wrong_paper_crop_digest_and_answer(self):
        for key, field, replacement in [
            ("identity", "printedNumber", 3), ("source", "pdfSha256", "0"*64),
            ("answer", "locator", "5:0.0"), ("answer", "recordSha256", "0"*64),
            ("source", "regions", [self.rows[1]["source"]["regions"][0]]),
        ]:
            with self.subTest(key=key, field=field):
                self.doc = deepcopy(self.frozen)
                self.doc["items"][0][key][field] = replacement
                self.reject("digest")
        self.doc["items"][0]["answer"]["regions"] = []
        self.reject("answer evidence")

    def test_stale_ids_cross_jurisdiction_and_invalid_mappings(self):
        for field, value in [("nodes", "unknown"), ("requirements", "sat-algebra-two/08"),
                             ("requirements", "cn-stale/1")]:
            with self.subTest(field=field, value=value):
                self.doc = deepcopy(self.frozen)
                self.doc["items"][0][field][0]["id"] = value
                self.reject("unknown mapping")
        self.doc = deepcopy(self.frozen)
        self.doc["items"][0]["requirements"][0]["role"] = "expert-approved"
        self.reject("clause role")
        self.doc["items"][0]["nodes"][0]["rationale"] = ""
        self.reject("rationale")

    def test_promotion_or_subclaim_substitution_rejected(self):
        for r in self.rows:
            if r["verifier"]["whole"] == "abstained":
                r["verifier"]["whole"] = "verified"
                self.reject("unsupported whole")
                r["verifier"]["whole"] = "abstained"
        self.rows[0]["verifier"] = deepcopy(self.rows[3]["verifier"])
        self.reject("digest")
        self.doc["independentReviews"] = 1
        self.reject("review")

    def test_differing_private_verifier_statuses_cannot_project_to_same_view(self):
        partial = dict(method="branch", status="abstained", reason="partial_claim_only", formalScoringEligible=False,
                       verificationCoverage=dict(scope="part-1", referenceClaimsChecked=1,
                                                 wholeAnswerVerified=False, completeProofVerified=False))
        result = pilot.verdict(partial)
        self.assertEqual(("abstained", "part-1", 1), (result["whole"], result["scope"], result["claims"]))
        with self.assertRaisesRegex(ValueError, "inconsistent whole"):
            pilot.verdict(dict(partial, status="verified"))
        with self.assertRaisesRegex(ValueError, "unexpected promotion"):
            pilot.verdict(dict(partial, formalScoringEligible=True))


if __name__ == "__main__":
    unittest.main()
