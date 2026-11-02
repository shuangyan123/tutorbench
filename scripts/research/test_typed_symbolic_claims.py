"""Adversarial research-only tests. No teacher rating or official exam gold."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts/research/verify-typed-symbolic-claims.py"
FIXTURE_PATH = ROOT / "fixtures/research/typed-symbolic-claim-contract-v0.1.json"
spec = importlib.util.spec_from_file_location("research_typed_math", MODULE_PATH)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class TypedSymbolicContract(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_expected_statuses_and_no_gold_claim(self):
        result = verifier.verify_batch(self.fixture)
        self.assertEqual(result["status"], "research_only_typed_symbolic")
        self.assertEqual(result["summary"],
                         {"total": 12, "symbolicallyEqual": 3,
                          "counterexamples": 2, "unverified": 7})
        expected = {row["id"]: row["expectedStatus"] for row in self.fixture["items"]}
        self.assertEqual({row["id"]: row["status"] for row in result["items"]}, expected)
        errors = {row["id"]: row for row in result["items"]}
        self.assertEqual(errors["removable-singularity"]["reason"], "domain_not_proven_equal")
        self.assertEqual(errors["exponential-log-domain"]["reason"], "domain_not_proven_equal")
        self.assertEqual(errors["absolute-value-counterexample"]["witness"], "-3")
        self.assertNotIn("gold", json.dumps(result).lower())

    def test_mathematical_counterexample_survives_rewording_of_ast_metadata(self):
        sample = self.fixture["items"][1].copy()
        sample["irrelevantMetadata"] = "This is totally right!"
        self.assertEqual(verifier.verify_one(sample)["status"], "counterexample_found")

    def test_untrusted_ast_is_never_evaluated(self):
        sample = {"id": "bad", "expected": {"op": "int", "value": 1},
                  "candidate": {"op": "eval",
                                "text": "__import__('os').system('echo DO_NOT_RUN')"}}
        result = verifier.verify_one(sample)
        self.assertEqual(result["status"], "unverified")
        self.assertEqual(result["reason"], "unsupported_operator")

    def test_vacuous_equality_on_empty_real_domain_cannot_pass(self):
        x = {"op": "symbol", "name": "x"}
        impossible = {
            "op": "sqrt",
            "arg": {"op": "add", "args": [
                {"op": "int", "value": -1},
                {"op": "mul", "args": [
                    {"op": "int", "value": -1},
                    {"op": "pow", "base": x, "exponent": 2},
                ]},
            ]},
        }
        result = verifier.verify_one({"id": "empty-domain", "expected": impossible,
                                      "candidate": impossible})
        self.assertEqual(result["status"], "unverified")
        self.assertEqual(result["reason"], "empty_real_domain")

    def test_bounds_and_duplicate_identity_fail_closed(self):
        huge = {"id": "huge", "expected": {"op": "int", "value": 1},
                "candidate": {"op": "pow", "base": {"op": "int", "value": 2}, "exponent": 100}}
        self.assertEqual(verifier.verify_one(huge)["status"], "unverified")
        with self.assertRaises(ValueError):
            verifier.verify_batch({"schemaVersion": 1, "items": [huge, huge]})

    def test_strict_cli_exits_nonzero_for_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "fixture.json"
            source.write_text(json.dumps(self.fixture), encoding="utf-8")
            run = subprocess.run(
                [sys.executable, str(MODULE_PATH), "--fixture", str(source), "--require-decidable"],
                capture_output=True, text=True, check=False)
            self.assertEqual(run.returncode, 1, run.stderr)
            self.assertEqual(json.loads(run.stdout)["summary"]["unverified"], 7)


if __name__ == "__main__":
    unittest.main()
