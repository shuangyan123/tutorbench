"""Independent exact-rational root-set regression tests; not official exam gold."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
MODULE=ROOT/"scripts/research/verify-complete-rational-roots.py"
FIXTURE=ROOT/"fixtures/research/bounded-rational-roots-contract-v0.1.json"
spec=importlib.util.spec_from_file_location("root_research",MODULE)
verifier=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class CompleteRationalRootsContract(unittest.TestCase):
    def setUp(self):
        self.data=json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_all_contract_cases(self):
        result=verifier.verify_batch(self.data)
        expected={row["id"]:row["expectedStatus"] for row in self.data["items"]}
        actual={row["id"]:row["status"] for row in result["items"]}
        self.assertEqual(actual,expected)
        self.assertEqual(result["summary"],{
            "total":15,"verifiedComplete":7,"refuted":4,"unverified":4})
        self.assertEqual(result["status"],"research_only_complete_root_set")

    def test_duplicate_answer_cannot_hide_a_missing_distinct_root(self):
        items={x["id"]:x for x in self.data["items"]}
        broken=verifier.verify_item(items["missing-second-root-by-duplication"])
        self.assertEqual(broken["status"],"refuted_solution_set")
        self.assertEqual(broken["missing"],["3"])
        self.assertEqual(broken["candidateDuplicates"],1)
        double=verifier.verify_item(items["repeated-polynomial-root"])
        self.assertEqual(double["status"],"verified_complete_solution_set")
        self.assertEqual(double["rootCount"],1)

    def test_real_exam_claim_rejects_infeasible_second_probability_root(self):
        items={x["id"]:x for x in self.data["items"]}
        valid=items["ky2025-q16-probability-subclaim"]
        self.assertTrue(valid["examEvidence"]["notOfficialAnswerKey"])
        self.assertTrue(valid["examEvidence"]["doesNotVerifyFinalProbability"])
        self.assertEqual(verifier.verify_item(valid)["status"],"verified_complete_solution_set")
        invalid=verifier.verify_item(items["ky2025-q16-forbidden-extra-root"])
        self.assertEqual(invalid["status"],"refuted_solution_set")
        self.assertEqual(invalid["extraneous"],["5/4"])

    def test_unknown_and_unsatisfiable_source_are_not_confused(self):
        items={x["id"]:x for x in self.data["items"]}
        self.assertEqual(verifier.verify_item(items["identically-zero-polynomial-infinite-set"])["status"],"unverified")
        self.assertEqual(verifier.verify_item(items["irrational-roots-not-supported"])["status"],"unverified")
        self.assertEqual(verifier.verify_item(items["no-real-roots"])["status"],"verified_complete_solution_set")
        self.assertEqual(verifier.verify_item(items["missing-domain"])["reason"],"domain_missing")

    def test_bad_types_bounds_and_ambiguous_polynomial_reject(self):
        original=self.data["items"][0]
        bad=json.loads(json.dumps(original))
        bad["coefficients"]["a"]["num"]=True
        self.assertEqual(verifier.verify_item(bad)["status"],"unverified")
        bad["coefficients"]["a"]["num"]=10**10
        self.assertEqual(verifier.verify_item(bad)["status"],"unverified")
        with self.assertRaises(ValueError):
            verifier.verify_batch({"schemaVersion":1,"items":[original,original]})

    def test_factorized_quadratics_cover_49_root_set_combinations(self):
        real={"kind":"real"}
        def n(v):
            return {"num":v,"den":1}
        for r1 in range(-3,4):
            for r2 in range(-3,4):
                coefficients={"a":n(1),"b":n(-(r1+r2)),"c":n(r1*r2)}
                candidate=[n(x) for x in sorted(set([r1,r2]))]
                row={"id":f"factor-{r1}-{r2}", "claimKind":"all_real_roots",
                     "coefficients":coefficients,"domain":real,
                     "candidateRoots":candidate}
                self.assertEqual(verifier.verify_item(row)["status"],
                                 "verified_complete_solution_set",row["id"])
                if r1 != r2:
                    row["candidateRoots"]=[n(r1),n(r1)]
                    result=verifier.verify_item(row)
                    self.assertEqual(result["status"],"refuted_solution_set",row["id"])
                    self.assertEqual(result["missing"],[str(r2)],row["id"])

    def test_nonzero_scaling_and_domain_narrowing_preserve_meaning(self):
        def n(v):
            return {"num":v,"den":1}
        original={"id":"scale","claimKind":"all_real_roots",
                  "coefficients":{"a":n(1),"b":n(-5),"c":n(6)},
                  "domain":{"kind":"real"},"candidateRoots":[n(2),n(3)]}
        for factor in [-3,-2,-1,1,2,3]:
            row=json.loads(json.dumps(original))
            row["coefficients"]={k:n(v["num"]*factor) for k,v in row["coefficients"].items()}
            self.assertEqual(verifier.verify_item(row)["status"],"verified_complete_solution_set")
        original["domain"]={"kind":"interval","min":n(2),"max":n(4),
                            "includeMin":False,"includeMax":True}
        original["candidateRoots"]=[n(3)]
        self.assertEqual(verifier.verify_item(original)["status"],"verified_complete_solution_set")
        original["candidateRoots"]=[n(2),n(3)]
        self.assertEqual(verifier.verify_item(original)["status"],"refuted_solution_set")

    def test_strict_cli_fails_when_unsupported(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"fixture.json"
            path.write_text(json.dumps(self.data),encoding="utf-8")
            out=subprocess.run([sys.executable,str(MODULE),"--fixture",str(path),"--require-decidable"],
                               capture_output=True,text=True,check=False)
            self.assertEqual(out.returncode,1,out.stderr)
            self.assertEqual(json.loads(out.stdout)["summary"]["unverified"],4)


if __name__=="__main__":
    unittest.main()
