"""Provider-free Stage II holdout, natural extraction and review controls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/research"))
import run_real_natural_math_holdout as live
import verify_dual_path_math_answers as verifier


class NaturalMathHoldoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=live.manifest()
        cls.rows={x["id"]:x for x in cls.doc["cases"]}

    def provider(self,content,finish="stop",model="deepseek-flash"):
        return {
            "id":"mock-not-live","model":model,
            "choices":[{"finish_reason":finish,
                        "message":{"content":content,"reasoning_content":"not saved"}}],
            "usage":{"prompt_tokens":40,"completion_tokens":50,
                     "completion_tokens_details":{"reasoning_tokens":20},
                     "total_tokens":90},
        }

    def test_new_frozen_suite_20_and_solver_support(self):
        seen=set()
        counts={}
        for row in self.doc["cases"]:
            ident=row["id"]
            self.assertNotIn(ident,seen)
            seen.add(ident)
            kind=row["question"]["kind"]
            counts[kind]=counts.get(kind,0)+1
            with self.subTest(case=ident):
                solved=verifier.question_math(row["question"])
                self.assertTrue(solved["mathValidated"])
                self.assertTrue(solved["mathematicalMethods"])
                self.assertTrue(solved["exactAnswer"])
                for mode in live.MODES:
                    r=live.make_request(row,mode)
                    self.assertNotIn("referenceAnswer",live.canonical(r))
                    self.assertNotIn("exactAnswer",live.canonical(r))
                    self.assertEqual([m["role"] for m in r["messages"]],["system","user"])
        self.assertEqual(counts,{k:4 for k in live.KINDS})

    def test_explicit_high_and_disabled_apples_to_apples(self):
        row=self.rows["h-occ-01"]
        a=live.make_request(row,"disabled")
        b=live.make_request(row,"high")
        self.assertEqual(a["messages"],b["messages"])
        self.assertEqual(a["thinking"],{"type":"disabled"})
        self.assertNotIn("reasoning_effort",a)
        self.assertEqual(a["max_tokens"],3072)
        self.assertEqual(b["thinking"],{"type":"enabled"})
        self.assertEqual(b["reasoning_effort"],"high")
        self.assertEqual(b["max_tokens"],8192)
        self.assertNotEqual(live.sha(a),live.sha(b))

    def test_scalar_natural_math_evidence_not_arbitrary_regex(self):
        row=self.rows["h-occ-01"]
        true=verifier.question_math(row["question"])["exactAnswer"]
        answer=live.inspect_response(row,"high",self.provider(
            "逐步计算后得到结果。\n最终答案："+true))
        self.assertEqual(answer["status"],"accepted_by_verifier")
        self.assertEqual(answer["extractionMethod"],"unique_explicit_final_answer_line")
        wrong=live.inspect_response(row,"high",self.provider(
            "最终答案：1/2"))
        self.assertEqual(wrong["status"],"refuted_by_verifier")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "先猜 1/2，后来算 1/3，但是推导未完成。"))["status"],
            "scalar_extraction_abstained")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "最终答案：1/2\n最终答案：1/3"))["status"],
            "scalar_extraction_abstained")

    def test_latex_final_box_single_and_multiple(self):
        row=self.rows["h-seq-01"]
        self.assertEqual(live.extract_scalar(
            "步骤一：...\n最终结果为 "+chr(92)+"boxed{"+chr(92)+"frac{3}{2}}")[:2],
            ("3/2","unique_latex_boxed_answer"))
        self.assertEqual(live.extract_scalar(
            chr(92)+"boxed{2}，重新计算得到 "+chr(92)+"boxed{3}")[1],
            "scalar_extraction_abstained")
        self.assertEqual(live.inspect_response(row,"disabled",self.provider(
            "答案未知，只有近似推导：1/2、2/3"))["status"],
            "scalar_extraction_abstained")

    def test_geometry_set_no_unsafe_freeform_adjudication(self):
        for id_ in ["h-circle-02","h-quad-03","h-param-04"]:
            row=self.rows[id_]
            received=live.inspect_response(row,"high",self.provider(
                "由判别式求得两个边界，最终答案为若干区间。"))
            self.assertEqual(received["status"],"natural_answer_needs_review")
            self.assertIn("最终答案",received["rawText"])

    def test_finished_abstain_truncated_bad_mode_and_provider(self):
        row=self.rows["h-occ-01"]
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "UNSURE"))["status"],"model_abstention")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "1/2","length"))["status"],"output_truncated")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "","stop"))["status"],"empty_response")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "1/2","content_filter"))["status"],"model_incomplete")
        self.assertEqual(live.inspect_response(row,"high",self.provider(
            "1/2",model="other"))["status"],"provider_identity_mismatch")
        def fail(_r,_k,_t):
            raise live.foundation.ProviderFailure("provider_http_error",503)
        trial=live.perform(row,"high","mock-key",1,fail)
        self.assertEqual(trial["status"],"provider_failure")
        self.assertEqual(trial["httpStatus"],503)

    def test_reasoning_is_not_saved_only_metadata_and_raw_final(self):
        row=self.rows["h-occ-01"]
        direct=live.perform(row,"high","secret-do-not-save",1,
            lambda _r,_k,_t:self.provider("最终答案：1/2"))
        self.assertEqual(direct["rawText"],"最终答案：1/2")
        self.assertTrue(direct["reasoningContentPresent"])
        self.assertEqual(direct["reasoningTokensReported"],20)
        self.assertNotIn("not saved",live.canonical(direct))
        self.assertNotIn("secret-do-not-save",live.canonical(direct))
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"high.jsonl"
            live.save_run(self.doc,[row],"high","secret-do-not-save",1,path,
                          lambda _r,_k,_t:self.provider("1/2"))
            self.assertEqual(len(live.read_runs([path])),1)
            with self.assertRaises(FileExistsError):
                live.save_run(self.doc,[row],"high","secret-do-not-save",1,path,
                              lambda _r,_k,_t:self.provider("1/2"))

    def test_human_double_transcription_with_quote_and_tamper_detection(self):
        row=self.rows["h-circle-02"]
        raw="交点为 (√5, 0) 与 (-√5, 0)。"
        result=live.inspect_response(row,"high",self.provider(raw))
        case_result={"id":row["id"],"mode":"high","family":row["question"]["kind"],**result}
        template=live.review_template([case_result],"reviewerA")
        self.assertEqual(len(template["reviews"]),1)
        one=template["reviews"][0]
        points={"kind":"point_set","points":[
            {"x":{"kind":"affine_sqrt","offset":"0","coefficient":"1","radicand":"5"},
             "y":{"kind":"rational","value":"0"}},
            {"x":{"kind":"affine_sqrt","offset":"0","coefficient":"-1","radicand":"5"},
             "y":{"kind":"rational","value":"0"}}]}
        one["extractionDecision"]="transcribed"
        one["evidenceQuote"]=raw
        one["candidate"]=points
        import copy
        other=copy.deepcopy(template)
        other["reviewer"]="reviewerB"
        report=live.compare_review_pairs([case_result],template,other)
        self.assertEqual(report["counts"]["agreed"],1)
        self.assertEqual(report["counts"]["accepted_by_verifier"],1)
        other["reviews"][0]["evidenceQuote"]="fabricated quote"
        with self.assertRaisesRegex(live.Invalid,"quote_not_present"):
            live.compare_review_pairs([case_result],template,other)
        other["reviews"][0]["evidenceQuote"]=raw
        other["reviews"][0]["candidate"]={"kind":"point_set","points":[]}
        disagreement=live.compare_review_pairs([case_result],template,other)
        self.assertEqual(disagreement["counts"]["disagreed"],1)

    def test_human_reviews_are_not_gold_and_25_cases_not_repeated(self):
        report=live.summarize([])
        self.assertIsNone(report["realFalseAcceptanceRate"])
        self.assertIsNone(report["realWrongAnswerDetectionRecall"])
        self.assertFalse(report["independentTruthReviewed"])
        old=json.loads((ROOT/"fixtures/research/deepseek-flash-blind-math-25-v0.1.json").read_text(encoding="utf8"))
        old_questions={live.canonical(x["question"]) for x in old["cases"]}
        self.assertFalse(any(live.canonical(x["question"]) in old_questions for x in self.doc["cases"]))

    def test_offline_20_case_plan_and_live_is_opt_in(self):
        cmd=[sys.executable,str(ROOT/"scripts/research/run_real_natural_math_holdout.py")]
        for mode in live.MODES:
            run=subprocess.run(cmd+["plan","--mode",mode,"--limit","20"],
                               capture_output=True,text=True,check=False,timeout=30)
            self.assertEqual(run.returncode,0,run.stderr)
            doc=json.loads(run.stdout)
            self.assertEqual(doc["selected"],20)
            self.assertEqual(doc["thinkingMode"],mode)
        deny=subprocess.run(cmd+["run","--mode","high"],capture_output=True,
                            text=True,check=False,timeout=30)
        self.assertNotEqual(deny.returncode,0)
        self.assertIn("--execute-live",deny.stderr)


if __name__=="__main__":
    unittest.main()
