"""Provider-free tests for the 25-task DeepSeek Flash live pilot."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import run_deepseek_flash_math_25 as pilot
import verify_dual_path_math_answers as bridge


class Pilot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=pilot.load_manifest()
        cls.rows={x["id"]:x for x in cls.doc["cases"]}

    def model_response(self,text,finish="stop",model="deepseek-flash"):
        return {"id":"mock-not-provider","model":model,"choices":[{
            "finish_reason":finish,"message":{"content":text}}],
            "usage":{"prompt_tokens":20,"completion_tokens":7,"total_tokens":27}}

    def test_25_problem_contract_and_existing_verifier_solves_all(self):
        counts={}
        for case in self.doc["cases"]:
            kind=case["question"]["kind"]
            counts[kind]=counts.get(kind,0)+1
            result=bridge.question_math(case["question"])
            self.assertTrue(result["mathValidated"],case["id"])
            self.assertTrue(result["exactAnswer"],case["id"])
            req=pilot.build_request(case)
            self.assertEqual(req["model"],"deepseek-flash")
            self.assertEqual(req["thinking"],{"type":"disabled"})
            self.assertEqual(req["max_tokens"],1536)
            self.assertEqual([m["role"] for m in req["messages"]],["system","user"])
            self.assertNotIn("referenceAnswer",pilot.canonical(req))
            self.assertNotIn("exactAnswer",pilot.canonical(req))
            self.assertEqual(req["messages"][1]["content"],pilot.question_text(case["question"]))
        self.assertEqual(len(self.doc["cases"]),25)
        self.assertEqual(set(counts),pilot.KINDS)
        self.assertTrue(all(v==5 for v in counts.values()))
        self.assertNotIn("61/25",pilot.canonical(pilot.build_request(self.rows["occ-01"])))

    def test_known_correct_wrong_and_equivalent_decimal(self):
        case=self.rows["occ-01"]
        outcomes=[]
        for answer in ("61/25","61/125","2.44"):
            outcome=pilot.run_one(case,"fake-key",1,
                                  lambda _p,_k,_t:self.model_response(answer))
            outcomes.append(outcome)
            self.assertEqual(outcome["exactAnswerUnderTypedQuestion"],"61/25")
            self.assertEqual(outcome["tokenUsage"]["total_tokens"],27)
        self.assertEqual([x["status"] for x in outcomes],
                         ["math_correct","math_incorrect","math_correct"])

    def test_quadratic_model_replies_are_fully_compared(self):
        case=self.rows["quad-02"]
        self.assertEqual(pilot.examine(case,self.model_response('{"kind":"all_real"}'))["status"],
                         "math_incorrect")
        good={"kind":"union","parts":[
            {"kind":"interval","left":{"kind":"infinity","side":"negative"},
             "right":{"kind":"rational","num":1,"den":1},
             "includeLeft":False,"includeRight":False},
            {"kind":"interval","left":{"kind":"rational","num":1,"den":1},
             "right":{"kind":"infinity","side":"positive"},
             "includeLeft":False,"includeRight":False}]}
        raw=json.dumps(good,ensure_ascii=False,indent=2)
        self.assertEqual(pilot.examine(case,self.model_response(raw))["status"],
                         "math_correct")

    def test_truncated_invalid_prose_empty_and_bad_provider_are_separate(self):
        case=self.rows["occ-01"]
        self.assertEqual(pilot.examine(case,self.model_response("61/25","length"))["status"],
                         "output_truncated")
        self.assertEqual(pilot.examine(case,self.model_response(""))["status"],
                         "empty_response")
        self.assertEqual(pilot.examine(case,self.model_response("61/25","content_filter"))["status"],
                         "model_incomplete")
        self.assertEqual(pilot.examine(case,self.model_response("61/25",model="other"))["status"],
                         "provider_identity_mismatch")
        self.assertEqual(pilot.examine(case,self.model_response("The answer is 61/25"))["status"],
                         "math_unverified")
        big="61/25"+(" " * 4500)
        long=pilot.examine(case,self.model_response(big))
        self.assertEqual(long["status"],"format_invalid")
        self.assertEqual(long["rawText"],big)
        json_case=self.rows["circle-01"]
        for raw in ('{"kind":"empty","kind":"all_real"}',
                    "Answer: {\"kind\":\"point_set\",\"points\":[]}",
                    chr(96)*3+"json\n{}\n"+chr(96)*3):
            self.assertEqual(pilot.examine(json_case,self.model_response(raw))["status"],
                             "format_invalid")
        def fails(_payload,_key,_timeout):
            raise pilot.ProviderFailure("provider_http_error",503)
        failure=pilot.run_one(case,"fake-key",1,fails)
        self.assertEqual(failure["status"],"provider_failure")
        self.assertEqual(failure["httpStatus"],503)

    def test_no_false_real_world_error_metrics(self):
        statuses=["math_correct","math_incorrect","output_truncated","format_invalid"]
        rows=[{"family":"finite_uniform_occupancy","status":s} for s in statuses]
        report=pilot.summary(rows)
        self.assertEqual(report["detectedWrongUnderTypedQuestion"],1)
        self.assertEqual(report["decidableCoverage"],
                         {"numerator":2,"denominator":4,"value":0.5})
        self.assertIsNone(report["empiricalFalseAcceptanceRate"])
        self.assertIsNone(report["empiricalWrongAnswerDetectionRecall"])

    def test_exclusive_saved_raw_jsonl_no_key_and_no_duplicate_replay(self):
        with tempfile.TemporaryDirectory() as d:
            output=Path(d)/"local.jsonl"
            pilot.write_run(self.doc,[self.rows["occ-01"]],"fake-secret",1,output,
                            lambda _p,_k,_t:self.model_response("61/25"))
            saved=output.read_text(encoding="utf8")
            self.assertNotIn("fake-secret",saved)
            self.assertEqual(pilot.load_runs([output])[0]["rawText"],"61/25")
            self.assertEqual(pilot.summary(pilot.load_runs([output]))["mathCorrectOnDecidable"]["value"],1.0)
            with self.assertRaises(FileExistsError):
                pilot.write_run(self.doc,[self.rows["occ-01"]],"fake-secret",1,output,
                                lambda _p,_k,_t:self.model_response("61/25"))
            with self.assertRaisesRegex(pilot.Invalid,"duplicate_case_id"):
                pilot.load_runs([output,output])

    def test_plan_no_network_run_requires_explicit_live_switch(self):
        cmd=[sys.executable,str(ROOT/"scripts/research/run_deepseek_flash_math_25.py")]
        planned=subprocess.run(cmd+["plan","--limit","25"],
                               capture_output=True,text=True,check=False,timeout=20)
        self.assertEqual(planned.returncode,0,planned.stderr)
        self.assertEqual(json.loads(planned.stdout)["selected"],25)
        refused=subprocess.run(cmd+["run"],capture_output=True,
                               text=True,check=False,timeout=20)
        self.assertNotEqual(refused.returncode,0)
        self.assertIn("--execute-live",refused.stderr)


if __name__=="__main__":
    unittest.main()
