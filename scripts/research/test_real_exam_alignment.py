"""Regression checks on the public projection; no private paper or answer is loaded."""
from collections import Counter
from copy import deepcopy
from fractions import Fraction
from itertools import product
import json
from pathlib import Path
import re
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

    def test_assessment_report_joins_frozen_question_ids_and_verdicts(self):
        report = (pilot.ROOT / "docs/research/real-exam-assessment-demands.md").read_text("utf8")
        rows = [line.strip("|").split("|") for line in report.splitlines() if line.startswith("| gaokao-")]
        actual = {}
        for row in rows:
            question, concepts, task, methods, limits, status = (cell.strip() for cell in row)
            self.assertNotIn(question, actual)
            self.assertTrue(task and methods and limits)
            actual[question] = (re.findall(r"`([^`]+)`", concepts), status)
        expected = {r["questionId"]: ([n["id"] for n in r["nodes"]], r["verifier"]["whole"]) for r in self.rows}
        self.assertEqual(expected, actual)

    def test_course_report_cites_the_registered_editions_and_real_graph_nodes(self):
        report = (pilot.ROOT / "docs/research/cn-math-knowledge-2025.md").read_text("utf8")
        revision = json.loads((pilot.ROOT / "src/research/data/cn-math-revision-v1.json").read_text("utf8"))
        self.assertEqual([revision[k]["sha256"] for k in ("oldSource", "newSource")],
                         re.findall(r"`([0-9a-f]{64})`", report))
        nodes = {n["id"] for n in self.edition["knowledgeGraph"]["nodes"]}
        refs = set(re.findall(r"`([a-z]+(?:-[a-z]+)+)`", report))
        self.assertTrue({"vector-basis", "spatial-vector-basis", "optimization-boundary"} <= refs)
        self.assertEqual(set(), refs - nodes)

    def test_ellipse_area_slope_cannot_witness_the_angle_minimum(self):
        # 面积约束给出 cos(theta)=2/3；最后一问重新开放所有正斜率。
        cos_sq = Fraction(4, 9)
        area_k_sq = (1 - cos_sq) / cos_sq
        optimum_k_sq = Fraction(3, 4)

        def tangent_sq(k_sq):
            return (3 + 4 * k_sq) ** 2 / k_sq

        self.assertEqual(area_k_sq, Fraction(5, 4))
        self.assertEqual(tangent_sq(optimum_k_sq), 48)
        self.assertGreater(tangent_sq(area_k_sq), tangent_sq(optimum_k_sq))
        rows = {r["questionId"]: r for r in self.rows}
        conic = rows["gaokao-2026-national-1/q18"]
        parameter = rows["gaokao-2026-national-1/q06"]
        shared = {n["id"] for n in conic["nodes"]} & {n["id"] for n in parameter["nodes"]}
        self.assertEqual(shared, {"optimization-boundary"})
        self.assertNotEqual(conic["operation"], parameter["operation"])

    def test_sampling_contrast_has_a_counterexample_to_label_independence(self):
        # 标签事件相关，仍可线性求和。直接枚举不使用闭式期望。
        draws = list(product(range(5), repeat=3))
        first = Fraction(sum(0 in draw for draw in draws), len(draws))
        both = Fraction(sum(0 in draw and 1 in draw for draw in draws), len(draws))
        self.assertNotEqual(first * first, both)
        mean = Fraction(sum(len(set(draw)) for draw in draws), len(draws))
        self.assertEqual(5 * first, mean)
        self.assertEqual(Fraction(61, 25), mean)

        # 四次封顶。按全部投掷路径累加，包含最后一次命中或失手。
        miss = Fraction(2, 3)
        mass = Counter()
        for path in product((0, 1), repeat=4):
            hits = sum(path)
            stop = path.index(1) + 1 if hits else 4
            mass[stop] += (1 - miss) ** hits * miss ** (4 - hits)
        self.assertEqual(mass[4], miss ** 3)

        def tail(k):
            return sum(v for n, v in mass.items() if n > k)

        self.assertEqual(tail(3) / tail(1), tail(2))
        self.assertNotEqual(tail(4) / tail(1), tail(3))

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
