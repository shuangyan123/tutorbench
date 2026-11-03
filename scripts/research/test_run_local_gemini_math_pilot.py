"""No-network-by-default tests for opt-in local Gemini math pilot."""
import copy
from hashlib import sha256
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

ROOT=Path(__file__).resolve().parents[2]
MODULE=ROOT/"scripts/research/run_local_gemini_math_pilot.py"
FIXTURE=ROOT/"fixtures/research/live-blind-occupancy-pilot-v0.1.json"
spec=importlib.util.spec_from_file_location("math_live_pilot",MODULE)
pilot=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=pilot
spec.loader.exec_module(pilot)


class MockCanonicalHost:
    def __init__(self,answers,token="a"*64):
        self.answers=answers
        self.token=token
        self.requests=[]
        parent=self
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path!="/generate":
                    self.send_error(404)
                    return
                size=int(self.headers.get("Content-Length","0"))
                body=self.rfile.read(size)
                parent.requests.append({
                    "path":self.path,"headers":dict(self.headers),
                    "body":body,
                })
                if self.headers.get("Authorization")!="Bearer "+parent.token:
                    self.send_response(401)
                    self.send_header("Content-Type","application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error":"host_unauthorized"}')
                    return
                doc=json.loads(body)
                assert len(doc["cases"])==1
                caseid=doc["cases"][0]["caseId"]
                answer=parent.answers.get(caseid,"UNSURE")
                result={
                    "output":{"text":answer,"metrics":{"latencyMs":12,
                              "tokenUsage":{"totalTokens":45}}},
                    "executionSupport":{"maxOutputTokens":True},
                }
                raw=json.dumps(result,ensure_ascii=False).encode("utf8")
                self.send_response(200)
                self.send_header("Content-Type","application/json")
                self.send_header("Content-Length",str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def log_message(self,*args):
                return
        self.server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
        self.port=self.server.server_address[1]
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self,*exc):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class LocalBlindMathPilot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suite=pilot.load_suite(FIXTURE)
        cls.ids=[r["id"] for r in cls.suite["cases"]]

    def test_exact_six_case_suite_contains_no_answers(self):
        self.assertEqual(len(self.ids),6)
        self.assertEqual(len(set(self.ids)),6)
        raw=FIXTURE.read_text(encoding="utf8")
        self.assertNotIn("61/25",raw)
        self.assertNotIn('"referenceAnswer"',raw)
        self.assertNotIn('"expectedStatus"',raw)
        self.assertNotIn('"answer"',raw)
        self.assertEqual(self.suite["cases"][0]["provenanceKind"],
                         "exam_linked_typed_adaptation")

    def test_plan_mode_cannot_read_credentials_or_send_network_request(self):
        with patch.object(pilot,"ask_local_host",side_effect=AssertionError("must_not_connect")):
            captured=io.StringIO()
            with redirect_stdout(captured):
                code=pilot.main(["plan","--suite",str(FIXTURE)],env={})
            self.assertEqual(code,0)
            result=json.loads(captured.getvalue())
            self.assertEqual(result["requestsSent"],0)
            self.assertFalse(result["answerKeysIncludedInPrompt"])
            self.assertFalse(result["modelCredentialsRead"])
            self.assertEqual(result["selectedCases"],6)
            self.assertFalse(any("61/25" in r["prompt"] for r in result["selected"]))

    def test_single_case_packet_obeys_tutorbench_canonical_host_contract(self):
        packet,raw=pilot.packet_for(self.suite["cases"][0])
        self.assertEqual(packet["schemaVersion"],1)
        self.assertEqual(len(packet["cases"]),1)
        self.assertEqual(len(packet["cases"][0]["messages"]),3)
        self.assertEqual([m["role"] for m in packet["cases"][0]["messages"]],
                         ["system","user","user"])
        self.assertEqual(packet["cases"][0]["locale"],"zh-CN")
        self.assertEqual(packet["generationSpec"]["prompt"]["sha256"],
                         sha256(pilot.SYSTEM_PROMPT.encode("utf8")).hexdigest())
        self.assertNotIn(b"61/25",raw)
        self.assertEqual(packet["generationSpec"]["maxOutputTokens"],256)
        self.assertNotIn("temperature",packet["generationSpec"])

    def test_http_only_127_loopback_and_session_authentication(self):
        for url in ("http://localhost:9001/generate",
                    "https://127.0.0.1:9001/generate",
                    "http://127.0.0.2:9001/generate",
                    "http://example.com:9001/generate",
                    "http://127.0.0.1:9001/other",
                    "http://127.0.0.1:9001/generate?x=1",
                    "http://alice:secret@127.0.0.1:9001/generate",
                    "file:///etc/passwd"):
            with self.subTest(endpoint=url):
                with self.assertRaises(pilot.Rejected):
                    pilot.loopback_port(url)
        self.assertEqual(pilot.loopback_port("http://127.0.0.1:9001/generate"),9001)
        for token in ("","123","g"*64,"1"*63):
            with self.assertRaises(pilot.Rejected):
                pilot.token_from_environment({"CANONICAL_MODEL_HOST_TOKEN":token})
        self.assertEqual(pilot.token_from_environment({"CANONICAL_MODEL_HOST_TOKEN":"a"*64}),
                         "a"*64)

    def test_opt_in_required_and_no_accidental_network_call(self):
        with patch.object(pilot,"ask_local_host",side_effect=AssertionError("must_not_connect")):
            with self.assertRaisesRegex(pilot.Rejected,"explicit_execute_live"):
                pilot.main(["run","--suite",str(FIXTURE)],env={})
            with self.assertRaisesRegex(pilot.Rejected,"missing_or_invalid_canonical_host_session_token"):
                pilot.main(["run","--suite",str(FIXTURE),"--execute-live"],env={})

    def test_mock_http_gateway_preserves_authorization_and_model_raw_text(self):
        answers=dict(zip(self.ids,["61/25","1105/343","204/625","11/25","UNSURE","0"]))
        with MockCanonicalHost(answers) as host:
            target=f"http://127.0.0.1:{host.port}/generate"
            def transport(request):
                return pilot.ask_local_host(request,target,host.token,5)
            result=pilot.run_items(self.suite,6,transport,"mock_transport","gemini-2.5-flash")
            self.assertEqual(result["summary"]["mathematicallyCorrect"],4)
            self.assertEqual(result["summary"]["mathematicallyIncorrect"],1)
            self.assertEqual(result["summary"]["unverifiedAnswers"],1)
            self.assertEqual(result["summary"]["decidableAnswers"],5)
            self.assertEqual(result["summary"]["hostFailures"],0)
            self.assertEqual(result["summary"]["decidableAccuracy"]["numerator"],4)
            self.assertEqual(result["summary"]["decidableAccuracy"]["denominator"],5)
            self.assertIsNone(result["summary"]["measuredLiveModelAccuracy"])
            self.assertIsNone(result["summary"]["overallSuccess"]["value"])
            self.assertFalse(result["providerIdentityCryptographicallyVerified"])
            self.assertEqual(len(host.requests),6)
            for req in host.requests:
                self.assertEqual(req["path"],"/generate")
                self.assertEqual(req["headers"].get("Authorization"),"Bearer "+host.token)
                self.assertNotIn("Origin",req["headers"])
                self.assertNotIn(b"61/25",req["body"])
            self.assertEqual(result["items"][0]["rawModelOutput"],"61/25")
            self.assertEqual(result["items"][0]["verifiedReference"],"61/25")
            self.assertNotIn("rawModelOutput",result["items"][4].get("errorCode",""))

    def test_host_bad_token_does_not_become_wrong_math(self):
        with MockCanonicalHost({self.ids[0]:"61/25"}) as host:
            target=f"http://127.0.0.1:{host.port}/generate"
            report=pilot.run_items(self.suite,1,
                lambda request:pilot.ask_local_host(request,target,"f"*64,5),
                "mock_transport","gemini-2.5-flash")
            self.assertEqual(report["items"][0]["status"],"host_failure")
            self.assertEqual(report["items"][0]["errorCode"],"host_http_error_401")
            self.assertEqual(report["summary"]["mathematicallyIncorrect"],0)
            self.assertEqual(report["summary"]["hostFailures"],1)

    def test_simulated_data_never_becomes_published_live_accuracy(self):
        report=pilot.run_items(self.suite,1,
            lambda req:("61/25",{"latencyMs":0}),"mock_transport","gemini-2.5-flash")
        self.assertEqual(report["summary"]["mathematicallyCorrect"],1)
        self.assertIsNone(report["summary"]["measuredLiveModelAccuracy"])
        self.assertIsNone(report["summary"]["verificationCoverage"]["value"])
        self.assertEqual(report["summary"]["officialExamGoldReleased"],0)

    def test_live_local_host_only_reports_observed_gateway_score_not_signed_provider_identity(self):
        report=pilot.run_items(self.suite,1,
            lambda req:("61/25",{"latencyMs":0}),"local_host_observed","gemini-2.5-flash")
        self.assertEqual(report["summary"]["overallSuccess"],
                         {"numerator":1,"denominator":1,"value":1.0})
        self.assertFalse(report["providerIdentityCryptographicallyVerified"])
        self.assertFalse(report["summary"]["benchmarkedWholeSuite"])
        self.assertIsNone(report["summary"]["measuredLiveModelAccuracy"])

    def test_precision_is_exact_and_prose_abstains_instead_of_guessing(self):
        prose=pilot.run_items(self.suite,1,
            lambda _:("结果是 61/25。",{"latencyMs":3}),
            "mock_transport","gemini-2.5-flash")
        self.assertEqual(prose["items"][0]["status"],"unverified_output")
        changed=pilot.run_items(self.suite,1,
            lambda _:("2.4400000001",{"latencyMs":0}),
            "mock_transport","gemini-2.5-flash")
        self.assertEqual(changed["items"][0]["status"],"exactly_incorrect")

    def test_crosscheck_can_fail_without_auto_marking_model_wrong(self):
        with patch.object(pilot.bridge.occupancy,"dynamic_distribution",
                          return_value={1:1}):
            report=pilot.run_items(self.suite,1,
                lambda _:("61/25",{"latencyMs":1}),
                "mock_transport","gemini-2.5-flash")
            self.assertEqual(report["items"][0]["status"],"unverified_math")
            self.assertEqual(report["summary"]["mathematicallyIncorrect"],0)

    def test_suite_mutations_and_published_answer_fields_rejected(self):
        for change in [
            lambda d:d["cases"][0].update({"referenceAnswer":"61/25"}),
            lambda d:d["cases"][0]["question"]["model"].update({"independent":False}),
            lambda d:d["cases"][1]["question"]["model"].update({"numberOfLabels":9}),
            lambda d:d["cases"][1].update({"id":d["cases"][0]["id"]}),
            lambda d:d["cases"][0]["question"].update({"metric":"expected_value"}),
        ]:
            doc=copy.deepcopy(self.suite)
            change(doc)
            with tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)/"case.json"
                path.write_text(json.dumps(doc),encoding="utf8")
                with self.assertRaises(pilot.Rejected):
                    pilot.load_suite(path)

    def test_live_transcripts_must_stay_out_of_tracked_repository_files(self):
        with patch.object(pilot,"ask_local_host",
                          side_effect=AssertionError("must_not_connect")):
            with tempfile.TemporaryDirectory() as tmp:
                external=Path(tmp)/"model-results.json"
                with self.assertRaisesRegex(pilot.Rejected,
                                            "capture_must_be_inside_gitignored_artifacts"):
                    pilot.main(["run","--suite",str(FIXTURE),"--execute-live",
                                "--output",str(external)],
                               env={"CANONICAL_MODEL_HOST_TOKEN":"a"*64})

    def test_existing_output_blocks_billable_requests_before_network(self):
        root=ROOT/"artifacts"
        root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root) as tmp:
            target=Path(tmp)/"already-exists.json"
            target.write_text("previous run, never overwrite",encoding="utf8")
            with patch.object(pilot,"ask_local_host",
                              side_effect=AssertionError("must_not_connect")):
                with self.assertRaises(FileExistsError):
                    pilot.main(["run","--suite",str(FIXTURE),"--execute-live",
                                "--output",str(target)],
                               env={"CANONICAL_MODEL_HOST_TOKEN":"a"*64})
            self.assertEqual(target.read_text(encoding="utf8"),
                             "previous run, never overwrite")

    def test_failed_request_is_not_retried(self):
        number={"calls":0}
        def request(_):
            number["calls"]+=1
            raise pilot.Rejected("host_http_error_429")
        report=pilot.run_items(self.suite,1,request,"mock_transport","gemini-2.5-flash")
        self.assertEqual(number["calls"],1)
        self.assertEqual(report["summary"]["hostFailures"],1)

    def test_raw_and_request_hashes_are_pinned(self):
        report=pilot.run_items(self.suite,1,
            lambda _:("61/25",{"latencyMs":1}),"mock_transport","gemini-2.5-flash")
        item=report["items"][0]
        self.assertEqual(item["rawOutputSha256"],sha256(b"61/25").hexdigest())
        _,request=pilot.packet_for(self.suite["cases"][0])
        self.assertEqual(item["requestPacketSha256"],sha256(request).hexdigest())
        self.assertFalse(item["referenceWasVisibleToModel"])


if __name__=="__main__":
    unittest.main()
