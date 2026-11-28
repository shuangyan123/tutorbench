"""Offline tests: no paid DeepSeek calls, no real learner outcome claims."""
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_deepseek_learner_state_contrasts as runner


def fixture():
    cases = []
    for num in range(1, 6):
        for arm in ("a", "b"):
            case_id = f"ls-v01-p{num:02d}-{arm}"
            inp = {
                "scenarioId": case_id,
                "caseId": case_id, "caseVersion": "0.1.0",
                "runIndex": 1, "locale": "en",
                "learningObjective": "Fractions",
                "initialContext": "",
                "conversation": [{"role": "student", "text": "I am confused."}],
                "currentStudentMessage": f"1/3 + 1/4 = 2/7? {'Why?' if arm == 'a' else 'Why, please?'}",
                "studentState": {"knownConcepts": [], "misconceptions": [], "level": "upper primary", "goal": "fractions"},
            }
            cases.append({"caseId": case_id, "inputSha256": runner.digest(inp), "input": inp})
    return {
        "schemaVersion": 1, "id": "learner-state-contrast-tutor-packets", "version": "0.1.0",
        "blind": True, "tutorExecutionStatus": "not_run",
        "evidenceMode": "author_written_counterfactual",
        "sourceVisibleSha256": "a" * 64, "cases": cases,
    }


def fake_response(req, key, timeout):
    if key != "test-fixture-key":
        raise AssertionError("test key mismatch")
    if req["reasoning_effort"] not in ("high", "max"):
        raise AssertionError("missing explicit effort")
    return {
        "id": "mock-response",
        "model": "deepseek-flash",
        "choices": [{"finish_reason": "stop", "message": {
            "content": "你为什么把分母加在一起？", "reasoning_content": "private-test-reasoning",
        }}],
        "usage": {"prompt_tokens": 45, "completion_tokens": 20, "total_tokens": 65,
                  "completion_tokens_details": {"reasoning_tokens": 10}},
    }


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.packet = Path(self.temp.name) / "packets.json"
        self.packet.write_text(json.dumps(fixture(), ensure_ascii=False), encoding="utf8")

    def test_reject_missing_or_mutated_input_hash(self):
        doc = runner.load_packet(self.packet)
        self.assertEqual(len(doc["cases"]), 10)
        doc["cases"][0]["input"]["currentStudentMessage"] = "tampered"
        self.packet.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf8")
        with self.assertRaisesRegex(runner.Invalid, "packet_case_integrity"):
            runner.load_packet(self.packet)

    def test_identical_messages_with_different_thinking_efforts(self):
        item = fixture()["cases"][0]
        a = runner.make_request(item, "high")
        b = runner.make_request(item, "max")
        self.assertEqual(a["messages"], b["messages"])
        self.assertEqual(a["max_tokens"], b["max_tokens"])
        self.assertEqual(a["model"], "deepseek-flash")
        self.assertEqual(a["thinking"], {"type": "enabled"})
        self.assertEqual(a["reasoning_effort"], "high")
        self.assertEqual(b["reasoning_effort"], "max")
        self.assertNotIn("temperature", a)
        self.assertNotIn("temperature", b)

    def test_prior_student_and_tutor_history_roles(self):
        item = fixture()["cases"][0]
        inp = item["input"]
        inp["conversation"].append({"role": "tutor", "text": "Tutor previous hint"})
        messages = runner.messages_for(item)
        self.assertEqual([m["role"] for m in messages],
                         ["system", "user", "user", "assistant", "user"])
        self.assertEqual(messages[-1]["content"], inp["currentStudentMessage"])
        self.assertNotIn("rubric", json.dumps(messages).lower())
        self.assertNotIn("misconception_stated", json.dumps(messages).lower())

    def test_only_visible_final_response_is_stored(self):
        item = fixture()["cases"][0]
        row = runner.one_call(item, "high", "test-fixture-key", 30, fake_response)
        self.assertEqual(row["status"], "ok")
        self.assertEqual(row["finalText"], "你为什么把分母加在一起？")
        self.assertTrue(row["reasoningContentPresent"])
        self.assertEqual(row["reasoningTokensReported"], 10)
        self.assertNotIn("private-test-reasoning", json.dumps(row, ensure_ascii=False))

    def test_truncated_response_is_never_counted_as_ok(self):
        def truncated(req, key, timeout):
            result = fake_response(req, key, timeout)
            result["choices"][0]["finish_reason"] = "length"
            return result
        row = runner.one_call(fixture()["cases"][0], "max", "test-fixture-key", 30, truncated)
        self.assertEqual(row["status"], "output_truncated")
        self.assertEqual(runner.summarize([row])["responses"]["max"]["ok"], 0)

    def test_provider_failure_not_retried(self):
        calls = []
        def failure(req, key, timeout):
            calls.append(req)
            raise runner.foundation.ProviderFailure("provider_rate_limited", 429)
        row = runner.one_call(fixture()["cases"][0], "max", "test-fixture-key", 10, failure)
        self.assertEqual(len(calls), 1)
        self.assertEqual(row["status"], "provider_failure")

    def test_plan_requires_no_key_and_performs_no_api_call(self):
        output = io.StringIO()
        with patch.dict(os.environ, {}, clear=True), redirect_stdout(output):
            self.assertEqual(runner.main(["plan", "--packet", str(self.packet),
                                          "--effort", "max", "--limit", "10"]), 0)
        plan = json.loads(output.getvalue())
        self.assertEqual(plan["apiCalls"], 0)
        self.assertEqual(len(plan["cases"]), 10)
        self.assertEqual(plan["maxSelectedCompletionTokens"], 81920)

    def test_run_must_explicitly_opt_in_and_have_key(self):
        with self.assertRaises(SystemExit):
            runner.main(["run", "--packet", str(self.packet),
                         "--output", str(Path(self.temp.name) / "run.jsonl")])
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SystemExit):
                runner.main(["run", "--packet", str(self.packet), "--execute-live",
                             "--output", str(Path(self.temp.name) / "run.jsonl")])

    def test_create_only_output_and_readback(self):
        doc = runner.load_packet(self.packet)
        output = Path(self.temp.name) / "high.jsonl"
        rows = runner.write_run(doc, doc["cases"][:2], "high", "test-fixture-key",
                                30, output, fake_response)
        self.assertEqual(len(rows), 2)
        stored = runner.read_runs([str(output)])
        self.assertEqual(len(stored), 2)
        self.assertEqual(runner.summarize(stored)["responses"]["high"]["ok"], 2)
        with self.assertRaises(FileExistsError):
            runner.write_run(doc, doc["cases"][:1], "high", "test-fixture-key",
                             30, output, fake_response)

    def test_summary_merges_separate_high_and_max_runs_and_preserves_identity(self):
        doc = runner.load_packet(self.packet)
        high = Path(self.temp.name) / "high.jsonl"
        max_path = Path(self.temp.name) / "max.jsonl"
        runner.write_run(doc, doc["cases"][:2], "high", "test-fixture-key",
                         30, high, fake_response)
        runner.write_run(doc, doc["cases"][:2], "max", "test-fixture-key",
                         30, max_path, fake_response)
        stats = runner.summarize(runner.read_runs([str(high), str(max_path)]))
        self.assertEqual(stats["responses"]["high"]["ok"], 2)
        self.assertEqual(stats["responses"]["max"]["ok"], 2)
        self.assertEqual(stats["learningOutcome"], "not_measured")
        self.assertIsNone(stats["automaticTeachingQualityScore"])
        with self.assertRaisesRegex(runner.Invalid, "duplicate_or_invalid_case_result"):
            runner.read_runs([str(high), str(high)])


if __name__ == "__main__":
    unittest.main()
