#!/usr/bin/env python3
"""Opt-in localhost canonical Gemini host math pilot; no provider credentials in CLI.

Plan has zero network calls. Live requires --execute-live and a separate
CANONICAL_MODEL_HOST_TOKEN; original model text is persisted only locally.
No claimed official exam gold or independent provider identity attestation.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import sys
import uuid
from urllib.parse import urlsplit

sys.path.insert(0,str(Path(__file__).resolve().parent))
import verify_dual_path_math_answers as bridge
import verify_finite_occupancy_family as occupancy

ROOT=Path(__file__).resolve().parents[2]
SUITE_ID="live-blind-occupancy-pilot-v0.1"
PROMPT_ID="blind-independent-numeric-answer-v0.1"
SYSTEM_PROMPT=(
    "你正在独立完成数学题。只能使用题目中给出的条件求解。"
    "请只输出一个最终的精确数值：整数、分数或有限小数。"
    "不要输出推导、文字、单位、Markdown 或第二个候选答案。"
    "如果确实无法确定，请仅输出 UNSURE。"
)
USER_CONTEXT="以下是一道独立求解的数学题；不提供参考答案。"
DATASET_ID="math-blind-occupancy-pilot"
SPEC_VERSION="0.1.0"
MAX_OUTPUT_TOKENS=256
MAX_RESPONSE_BYTES=256_000
MAX_RAW_TEXT=8192
MAX_CASES=8
DEFAULT_ENDPOINT="http://127.0.0.1:9001/generate"


class Rejected(Exception):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def canonical_json(value):
    return json.dumps(value,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode("utf8")


def load_suite(path):
    with open(path,encoding="utf8") as f:
        suite=json.load(f)
    if (not isinstance(suite,dict) or set(suite)!={"schemaVersion","id","status","cases"} or
        suite.get("schemaVersion")!=1 or suite.get("id")!=SUITE_ID or
        suite.get("status")!="research_blind_numeric_only"):
        raise Rejected("invalid_blind_pilot_suite")
    rows=suite.get("cases")
    if not isinstance(rows,list) or not 1<=len(rows)<=MAX_CASES:
        raise Rejected("invalid_blind_case_count")
    seen=set()
    for row in rows:
        if (not isinstance(row,dict) or set(row)!={"id","question","provenanceKind"} or
            not isinstance(row["id"],str) or not re.fullmatch(r"[a-z0-9-]{1,100}",row["id"]) or
            row["id"] in seen or row["provenanceKind"] not in
            ("exam_linked_typed_adaptation","synthetic_typed_math")):
            raise Rejected("invalid_blind_case_identity")
        seen.add(row["id"])
        # The suite stores only model-visible problem specifications, never
        # keys, answers, expectedStatus or reference candidates.
        if any(k in json.dumps(row,ensure_ascii=False).lower() for k in
               ('"referenceanswer"','"expectedstatus"','"modelattempt"','"answerkey"')):
            raise Rejected("reference_answers_forbidden_in_blind_suite")
        question=row["question"]
        if not isinstance(question,dict) or question.get("kind")!="finite_uniform_occupancy":
            raise Rejected("only_finite_occupancy_numeric_pilot_supported")
        try:
            n,d=occupancy.parse_model(question.get("model"))
            query=question.get("query")
            if not isinstance(query,dict) or query.get("metric") not in occupancy.METRICS:
                raise Rejected("unsupported_numeric_query")
            # Strict query schema without deriving answer/reading any gold.
            if query["metric"] in ("expected_value","variance"):
                if set(query)!={"metric"}:raise Rejected("unexpected_query_fields")
            else:
                if set(query)!={"metric","k"} or type(query["k"]) is not int or not 0<=query["k"]<=n+1:
                    raise Rejected("unsupported_probability_event")
        except occupancy.Unsupported as e:
            raise Rejected("unsupported_blind_problem_"+str(e)) from e
        if set(question)!={"kind","model","query"}:
            raise Rejected("unknown_typed_problem_fields")
    return suite


def question_text(q):
    n=q["model"]["numberOfLabels"]
    d=q["model"]["numberOfDraws"]
    metric=q["query"]["metric"]
    base=(f"有 {n} 个互不相同的编号标签，每次从全部 {n} 个标签中"
          f"等概率独立抽取一个，记录后放回，共抽取 {d} 次。"
          "令 X 为这些抽取结果中出现过的不同标签数。")
    match={
        "expected_value":"求 X 的数学期望 E(X)。",
        "variance":"求 X 的方差 Var(X)。",
        "probability_exact":f"求概率 P(X={q['query'].get('k')})。",
        "probability_at_least":f"求概率 P(X≥{q['query'].get('k')})。",
        "probability_at_most":f"求概率 P(X≤{q['query'].get('k')})。",
    }
    return base+match[metric]


def packet_for(row):
    prompt_sha=sha256(SYSTEM_PROMPT.encode("utf8"))
    packet={
        "schemaVersion":1,
        "datasetId":DATASET_ID,
        "datasetVersion":SPEC_VERSION,
        "generationSpec":{
            "schemaVersion":1,
            "specId":"math-blind-numeric-answer",
            "specVersion":SPEC_VERSION,
            "prompt":{"id":PROMPT_ID,"version":SPEC_VERSION,"sha256":prompt_sha},
            "maxOutputTokens":MAX_OUTPUT_TOKENS,
        },
        "cases":[{
            "caseId":row["id"],
            "caseVersion":SPEC_VERSION,
            "locale":"zh-CN",
            # The canonical host requires >=3 messages, first system,
            # then user context, and a final user question.
            "messages":[
                {"role":"system","content":SYSTEM_PROMPT},
                {"role":"user","content":USER_CONTEXT},
                {"role":"user","content":question_text(row["question"])},
            ],
        }],
    }
    raw=canonical_json(packet)
    if len(raw)>64_000:raise Rejected("packet_exceeds_pilot_budget")
    return packet,raw


def loopback_port(endpoint):
    try:
        parsed=urlsplit(endpoint)
        if (parsed.scheme!="http" or parsed.hostname!="127.0.0.1" or
            parsed.username is not None or parsed.password is not None or
            parsed.path!="/generate" or parsed.query or parsed.fragment or
            parsed.port is None or not 1<=parsed.port<=65535):
            raise Rejected("endpoint_must_be_http_ipv4_loopback_generate")
        return parsed.port
    except ValueError as e:
        raise Rejected("invalid_localhost_endpoint") from e


def token_from_environment(env):
    token=env.get("CANONICAL_MODEL_HOST_TOKEN","")
    if not isinstance(token,str) or not re.fullmatch(r"[0-9a-f]{64}",token):
        raise Rejected("missing_or_invalid_canonical_host_session_token")
    return token


def ask_local_host(raw,endpoint,token,timeout_seconds):
    port=loopback_port(endpoint)
    conn=http.client.HTTPConnection("127.0.0.1",port,timeout=timeout_seconds)
    try:
        conn.request("POST","/generate",body=raw,headers={
            "Authorization":"Bearer "+token,
            "Content-Type":"application/json",
            "Accept":"application/json",
        })
        response=conn.getresponse()
        data=response.read(MAX_RESPONSE_BYTES+1)
        if len(data)>MAX_RESPONSE_BYTES:
            raise Rejected("host_response_too_large")
        if response.status!=200:
            # No raw server error messages or arbitrary headers leaked.
            raise Rejected("host_http_error_"+str(response.status))
        if not response.getheader("Content-Type","").lower().startswith("application/json"):
            raise Rejected("host_response_not_json")
        try:
            payload=json.loads(data)
        except (ValueError,UnicodeError) as e:
            raise Rejected("malformed_host_response_json") from e
        if not isinstance(payload,dict):
            raise Rejected("malformed_host_response")
        output=payload.get("output")
        support=payload.get("executionSupport")
        if (not isinstance(output,dict) or not isinstance(support,dict) or
            support.get("maxOutputTokens") is not True or
            not isinstance(output.get("text"),str) or
            not 0<len(output["text"])<=MAX_RAW_TEXT):
            raise Rejected("host_response_not_validated_single_text")
        metrics=output.get("metrics")
        if not isinstance(metrics,dict) or not isinstance(metrics.get("latencyMs"),int) or metrics["latencyMs"]<0:
            raise Rejected("missing_host_latency_metadata")
        usage=metrics.get("tokenUsage")
        if usage is not None and (not isinstance(usage,dict) or
                any(type(v) is not int or v<0 for v in usage.values())):
            raise Rejected("invalid_token_usage")
        return output["text"],metrics
    finally:
        conn.close()


def run_items(suite,limit,transport,provenance,declared_model):
    if provenance not in ("local_host_observed","mock_transport"):
        raise Rejected("invalid_execution_provenance")
    if type(limit) is not int or not 1<=limit<=len(suite["cases"]):
        raise Rejected("invalid_run_limit")
    results=[]
    for row in suite["cases"][:limit]:
        _,request=packet_for(row)
        base={
            "caseId":row["id"],"provenanceKind":row["provenanceKind"],
            "questionSha256":sha256(canonical_json(row["question"])),
            "requestPacketSha256":sha256(request),
            "referenceWasVisibleToModel":False,
        }
        try:
            raw,metrics=transport(request)
        except (Rejected,OSError,TimeoutError) as error:
            # Host errors do not become mathematically incorrect answers.
            reason=str(error) if isinstance(error,Rejected) else "local_host_transport_failed"
            results.append({**base,"status":"host_failure","errorCode":reason})
            continue
        if not isinstance(raw,str) or not 0<len(raw)<=MAX_RAW_TEXT:
            results.append({**base,"status":"unverified_output","errorCode":"invalid_raw_model_text"})
            continue
        evidence={**base,"rawModelOutput":raw,"rawOutputSha256":sha256(raw.encode("utf8")),
                  "hostMetrics":metrics}
        try:
            math=bridge.question_math(row["question"])
            try:
                yes,normalized,_=bridge.validate_candidate(row["question"],math,raw.strip())
                evidence.update({
                    "status":"exactly_correct" if yes else "exactly_incorrect",
                    "normalizedModelAnswer":normalized,
                    "verifiedReference":math["exactAnswer"],
                    "mathematicalMethods":math["mathematicalMethods"],
                })
            except bridge.Abstain as e:
                evidence.update({"status":"unverified_output","errorCode":str(e),
                                 "verifiedReference":math["exactAnswer"],
                                 "mathematicalMethods":math["mathematicalMethods"]})
        except (bridge.Abstain,AssertionError,ValueError,TypeError) as e:
            evidence.update({"status":"unverified_math","errorCode":"mathematical_crosscheck_unavailable"})
        results.append(evidence)
    total=len(results)
    correct=sum(r["status"]=="exactly_correct" for r in results)
    wrong=sum(r["status"]=="exactly_incorrect" for r in results)
    abstain=sum(r["status"] in ("unverified_output","unverified_math") for r in results)
    failed=sum(r["status"]=="host_failure" for r in results)
    verified=correct+wrong
    observed=total-failed
    # Mock transport MUST NOT result in published "live model accuracy".
    real=(provenance=="local_host_observed")
    return {
        "schemaVersion":1,"id":"local-blind-math-host-run-v0.1",
        "researchOnly":True,
        "suiteId":suite["id"],"suiteSha256":sha256(canonical_json(suite)),
        "runId":str(uuid.uuid4()),"capturedAtUtc":utc_now(),
        "executionProvenance":provenance,
        "declaredModel":declared_model,
        "providerIdentityCryptographicallyVerified":False,
        "sourceOfficialExamGoldVerified":False,
        "rawTranscriptIsLocallyCapturedNotProviderSigned":True,
        "summary":{
            "suiteSize":len(suite["cases"]),"attempted":total,
            "hostSuccessfulResponses":observed,"hostFailures":failed,
            "mathematicallyCorrect":correct,"mathematicallyIncorrect":wrong,
            "unverifiedAnswers":abstain,"decidableAnswers":verified,
            "decidableAccuracy":{"numerator":correct,"denominator":verified,
                                  "value":correct/verified if verified and real else None},
            "overallSuccess":{"numerator":correct,"denominator":total,
                              "value":correct/total if total and real else None},
            "verificationCoverage":{"numerator":verified,"denominator":total,
                                    "value":verified/total if total and real else None},
            "abstentionRate":{"numerator":abstain,"denominator":total,
                             "value":abstain/total if total and real else None},
            "benchmarkedWholeSuite":total==len(suite["cases"]) and failed==0,
            "measuredLiveModelAccuracy":(correct/total if total and real else None),
            "falseAcceptanceRate":None,
            "officialExamGoldReleased":0,
        },"items":results,
    }


def main(argv=None,env=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("mode",choices=("plan","run"))
    parser.add_argument("--suite",default=str(ROOT/"fixtures/research/live-blind-occupancy-pilot-v0.1.json"))
    parser.add_argument("--endpoint",default=DEFAULT_ENDPOINT)
    parser.add_argument("--model",default="gemini-2.5-flash")
    parser.add_argument("--limit",type=int)
    parser.add_argument("--timeout",type=int,default=60)
    parser.add_argument("--execute-live",action="store_true")
    parser.add_argument("--output")
    args=parser.parse_args(argv)
    suite=load_suite(args.suite)
    if not isinstance(args.model,str) or not re.fullmatch(r"gemini-\d[\da-z.-]{1,80}",args.model):
        raise Rejected("explicit_versioned_gemini_model_id_required")
    loopback_port(args.endpoint)
    if not 1<=args.timeout<=120:
        raise Rejected("invalid_timeout")
    limit=len(suite["cases"]) if args.limit is None else args.limit
    if not 1<=limit<=len(suite["cases"]):
        raise Rejected("invalid_limit")
    if args.mode=="plan":
        if args.execute_live or args.output:
            raise Rejected("plan_mode_cannot_execute_or_write_results")
        print(json.dumps({"mode":"plan","requestsSent":0,
                          "suiteId":suite["id"],"totalCases":len(suite["cases"]),
                          "selectedCases":limit,"declaredModel":args.model,
                          "promptSha256":sha256(SYSTEM_PROMPT.encode("utf8")),
                          "selected":[{"id":r["id"],"prompt":question_text(r["question"])}
                                      for r in suite["cases"][:limit]],
                          "answerKeysIncludedInPrompt":False,
                          "modelCredentialsRead":False},ensure_ascii=False,indent=2))
        return 0
    if not args.execute_live:
        raise Rejected("live_model_calls_require_explicit_execute_live")
    token=token_from_environment(env if env is not None else os.environ)
    if not args.output:
        raise Rejected("explicit_output_path_required_for_live_provenance")
    path=Path(args.output).resolve()
    # Exclusive write: a previous model run must never be overwritten.
    def transport(data):
        return ask_local_host(data,args.endpoint,token,args.timeout)
    result=run_items(suite,limit,transport,"local_host_observed",args.model)
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("x",encoding="utf8") as f:
        json.dump(result,f,indent=2,ensure_ascii=False)
        f.write("\n")
    # Print aggregates and file location, never raw model output or token.
    print(json.dumps({"savedAt":str(path),"executionProvenance":result["executionProvenance"],
                      "summary":result["summary"]},ensure_ascii=False,indent=2))
    return 0 if result["summary"]["hostFailures"]==0 else 2


if __name__=="__main__":
    try:
        sys.exit(main())
    except (Rejected,OSError,ValueError) as error:
        print("Blind math pilot not executed: "+
              (str(error) if isinstance(error,Rejected) else "invalid_filesystem_or_arguments"),
              file=sys.stderr)
        sys.exit(1)
