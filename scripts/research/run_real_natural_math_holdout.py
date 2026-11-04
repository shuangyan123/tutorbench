#!/usr/bin/env python3
"""Research stage II: blind unseen math questions with natural final responses.

Two optional DeepSeek Flash arms (disabled vs high thinking) on identical
held-out prompts. No model calls in plan, summarize, review-template or
replay-reviews. Provider calls require explicit --execute-live. No retries.
Reviewed free-language math answers require TWO independent transcriptions;
no automatic extraction of arbitrary equations or proof conclusions.
"""
import argparse
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import uuid

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import run_deepseek_flash_math_25 as foundation
import verify_dual_path_math_answers as verifier

MANIFEST=ROOT/"fixtures/research/real-natural-math-holdout-v0.1.json"
IDENTITY="real-natural-math-holdout-v0.1"
MODES=("disabled","high")
KINDS=foundation.KINDS
NUMERIC_KINDS={"finite_uniform_occupancy","finite_arithmetic_geometric_sum"}
VERDICT_STATES={
    "accepted_by_verifier",
    "refuted_by_verifier",
    "unverified_by_verifier",
    "natural_answer_needs_review",
    "scalar_extraction_abstained",
    "model_abstention",
    "output_truncated",
    "model_incomplete",
    "empty_response",
    "provider_failure",
    "provider_identity_mismatch",
    "answer_overbound",
}
MODEL="deepseek-flash"
MAX_FINAL_BYTES=100_000
MAX_EXTRACT_CHARS=128
SCALAR_RE=re.compile(r"[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:/[+-]?\d+)?\Z")
LATEX_FRAC=re.compile(r"\\(?:dfrac|tfrac|frac)\s*\{\s*([+-]?\d+)\s*\}\s*\{\s*([+-]?\d+)\s*\}\Z")


class Invalid(Exception):
    pass


def canonical(obj):
    return json.dumps(obj,sort_keys=True,ensure_ascii=False,separators=(",",":"))


def sha(obj):
    return hashlib.sha256(canonical(obj).encode("utf8")).hexdigest()


def manifest():
    doc=json.loads(MANIFEST.read_text(encoding="utf8"))
    if (set(doc)!={"schemaVersion","id","status","models","modes","cases"} or
        doc["schemaVersion"]!=1 or doc["id"]!=IDENTITY or
        doc["status"]!="answer_blind_unseen_typed_questions" or
        doc["models"]!=[MODEL] or doc["modes"]!=list(MODES) or
        not isinstance(doc["cases"],list) or len(doc["cases"])!=20):
        raise Invalid("invalid_holdout_manifest")
    seen=set()
    counts={kind:0 for kind in KINDS}
    for row in doc["cases"]:
        if (not isinstance(row,dict) or set(row)!={"id","question"} or
            not isinstance(row["id"],str) or row["id"] in seen or
            not row["id"].startswith("h-") or
            not isinstance(row["question"],dict) or
            row["question"].get("kind") not in KINDS):
            raise Invalid("invalid_holdout_case")
        seen.add(row["id"])
        counts[row["question"]["kind"]]+=1
    if any(count!=4 for count in counts.values()):
        raise Invalid("expected_four_new_cases_per_family")
    return doc


def prompt_for(row):
    question=foundation.question_text(row["question"])
    return question+" 请写出必要的数学推导，并明确给出最终答案。"


NATURAL_SYSTEM=(
    "你是一位独立解决数学问题的答题者。仅依据用户题目中的条件解题。"
    "可以使用自然语言、数学公式及必要的推导，不必输出 JSON。"
    "请在回答结尾明确写出最终答案。不能确定时明确说明无法求解。"
    "不要假定任何参考答案，也不要查询外部资料。"
)


def make_request(row,mode):
    if mode not in MODES:
        raise Invalid("unsupported_reasoning_mode")
    request={
        "model":MODEL,
        "messages":[{"role":"system","content":NATURAL_SYSTEM},
                    {"role":"user","content":prompt_for(row)}],
        "thinking":{"type":"enabled" if mode=="high" else "disabled"},
        "max_tokens":8192 if mode=="high" else 3072,
        "stream":False,
    }
    if mode=="high":
        request["reasoning_effort"]="high"
    return request


def parse_scalar_text(text):
    text=text.strip()
    if len(text)>MAX_EXTRACT_CHARS:
        raise Invalid("scalar_candidate_overbound")
    while ((text.startswith("$") and text.endswith("$")) or
           (text.startswith("\\(") and text.endswith("\\)")) or
           (text.startswith("\\[") and text.endswith("\\]"))):
        if text.startswith("$"):
            text=text[1:-1].strip()
        else:
            text=text[2:-2].strip()
    text=text.rstrip("。；;，,").strip()
    fraction=LATEX_FRAC.fullmatch(text)
    if fraction:
        if int(fraction.group(2))==0:
            raise Invalid("fraction_zero_denominator")
        text=fraction.group(1)+"/"+fraction.group(2)
    if not SCALAR_RE.fullmatch(text):
        raise Invalid("no_unambiguous_numeric_final_answer")
    try:
        value=Fraction(text)
    except (ValueError,ZeroDivisionError):
        raise Invalid("malformed_numeric_final_answer") from None
    return str(value)


def boxed(text):
    hits=[]
    for start in re.finditer(r"\\boxed\s*\{",text):
        depth=1
        i=start.end()
        begin=i
        while i<len(text) and depth:
            if text[i]=="{":
                depth+=1
            elif text[i]=="}":
                depth-=1
            i+=1
        if depth:
            raise Invalid("unclosed_boxed_answer")
        hits.append(text[begin:i-1])
    if len(hits)>1:
        raise Invalid("multiple_boxed_answers")
    return hits


def extract_scalar(raw):
    direct=raw.strip()
    if direct=="UNSURE" or direct in ("无法确定","不知道","无法求解"):
        return None,"model_abstention",None
    try:
        return parse_scalar_text(direct),"exact_numeric_whole_message",direct
    except Invalid:
        pass
    try:
        boxes=boxed(raw)
    except Invalid as e:
        return None,"scalar_extraction_abstained",str(e)
    if boxes:
        try:
            return parse_scalar_text(boxes[0]),"unique_latex_boxed_answer",boxes[0]
        except Invalid as e:
            return None,"scalar_extraction_abstained",str(e)
    lines=[line.strip() for line in raw.splitlines() if line.strip()]
    candidate_lines=[]
    for line in lines:
        m=re.fullmatch(r"(?:最终答案|答案|所以答案|因此答案)\s*[：:]\s*(.*)",line)
        if m:
            candidate_lines.append(m.group(1))
    if len(candidate_lines)==1:
        try:
            return parse_scalar_text(candidate_lines[0]),"unique_explicit_final_answer_line",candidate_lines[0]
        except Invalid as e:
            return None,"scalar_extraction_abstained",str(e)
    return None,"scalar_extraction_abstained","no_single_canonical_scalar_final_answer"


def verify_candidate(question,candidate):
    # Deliberately invoke the mathematics layer directly. This is NOT a
    # forged offline_replay of an original message or a signed live AI score.
    try:
        derived=verifier.question_math(question)
        correct,normalized,witness=verifier.validate_candidate(question,derived,candidate)
    except (verifier.Abstain,AssertionError,ValueError,TypeError,
            NotImplementedError,RecursionError,ZeroDivisionError) as e:
        return {"status":"unverified_by_verifier",
                "verificationReason":str(e)}
    return {"status":"accepted_by_verifier" if correct else "refuted_by_verifier",
            "exactAnswerUnderTypedQuestion":derived["exactAnswer"],
            "candidateNormalized":normalized,"counterexample":witness,
            "mathematicalMethods":derived["mathematicalMethods"],
            "independentRealGoldReview":False}


def inspect_response(case,mode,response):
    kind=case["question"]["kind"]
    base={"id":case["id"],"family":kind,"mode":mode,
          "rawText":None,"finishReason":None,
          "providerIdentityCryptographicallyVerified":False}
    if response.get("model")!=MODEL:
        return {**base,"status":"provider_identity_mismatch",
                "returnedModel":response.get("model")}
    choices=response.get("choices")
    if not isinstance(choices,list) or len(choices)!=1 or not isinstance(choices[0],dict):
        return {**base,"status":"provider_failure","errorCategory":"invalid_choices"}
    ch=choices[0]
    base["finishReason"]=ch.get("finish_reason")
    msg=ch.get("message")
    raw=msg.get("content") if isinstance(msg,dict) else None
    base["rawText"]=raw if isinstance(raw,str) else None
    if base["finishReason"]=="length":
        return {**base,"status":"output_truncated"}
    if base["finishReason"]!="stop":
        return {**base,"status":"model_incomplete"}
    if not isinstance(raw,str) or not raw.strip():
        return {**base,"status":"empty_response"}
    if len(raw.encode("utf8"))>MAX_FINAL_BYTES:
        return {**base,"status":"answer_overbound"}
    if raw.strip()=="UNSURE" or raw.strip() in ("无法确定","不知道","无法求解"):
        return {**base,"status":"model_abstention"}
    if kind not in NUMERIC_KINDS:
        return {**base,"status":"natural_answer_needs_review",
                "extractionPolicy":"no_unsupported_arbitrary_geometry_or_set_parser"}
    candidate,source,quote=extract_scalar(raw)
    if candidate is None:
        return {**base,"status":source,"extractionReason":quote}
    return {**base,"extractionMethod":source,"extractionEvidence":quote,
            **verify_candidate(case["question"],candidate)}


def perform(case,mode,key,timeout,transport=foundation.provider_call):
    req=make_request(case,mode)
    start=time.monotonic()
    base={"id":case["id"],"family":case["question"]["kind"],"mode":mode,
          "modelRequested":MODEL,
          "requestSha256":sha(req),
          "promptSha256":sha(req["messages"]),
          "startedAtUtc":datetime.now(timezone.utc).isoformat(),
          "realHttpRequestAttempted":True,
          "reasoningModeRequested":"high" if mode=="high" else "disabled",
          "providerIdentityCryptographicallyVerified":False}
    try:
        response=transport(req,key,timeout)
        result={**base,**inspect_response(case,mode,response),"httpStatus":200}
        result["providerResponseId"]=response.get("id") if isinstance(response.get("id"),str) else None
        msg=response["choices"][0].get("message") if isinstance(response.get("choices"),list) and len(response["choices"])==1 and isinstance(response["choices"][0],dict) else None
        if isinstance(msg,dict):
            reasoning=msg.get("reasoning_content")
            result["reasoningContentPresent"]=isinstance(reasoning,str) and bool(reasoning)
            # Reasoning text is not saved or sent to a grading model.
        usage=response.get("usage")
        if isinstance(usage,dict):
            result["tokenUsage"]={name:value for name,value in usage.items()
                if name in ("prompt_tokens","completion_tokens","total_tokens") and
                type(value) is int and value>=0}
            details=usage.get("completion_tokens_details")
            if isinstance(details,dict) and type(details.get("reasoning_tokens")) is int:
                result["reasoningTokensReported"]=details["reasoning_tokens"]
    except foundation.ProviderFailure as e:
        result={**base,"status":"provider_failure","httpStatus":e.status,
                "errorCategory":e.category}
    result["elapsedMs"]=round((time.monotonic()-start)*1000)
    return result


def summarize(rows):
    states={state:0 for state in sorted(VERDICT_STATES)}
    families={k:{"attempted":0,"accepted_by_verifier":0,"refuted_by_verifier":0,
                 "unverified_by_verifier":0,"abstained_or_needs_review":0}
              for k in sorted(KINDS)}
    modes={mode:{"attempted":0,"accepted_by_verifier":0,
                 "refuted_by_verifier":0,"awaiting_review":0}
           for mode in MODES}
    for row in rows:
        state,mode,kind=row.get("status"),row.get("mode"),row.get("family")
        if state not in states or mode not in modes or kind not in families:
            raise Invalid("invalid_saved_record")
        states[state]+=1
        modes[mode]["attempted"]+=1
        families[kind]["attempted"]+=1
        if state in ("accepted_by_verifier","refuted_by_verifier"):
            modes[mode][state]+=1
            families[kind][state]+=1
        else:
            modes[mode]["awaiting_review"]+=1
            if state=="unverified_by_verifier":
                families[kind]["unverified_by_verifier"]+=1
            else:
                families[kind]["abstained_or_needs_review"]+=1
    attempted=len(rows)
    adjudicated=states["accepted_by_verifier"]+states["refuted_by_verifier"]
    pairs={}
    for row in rows:
        pairs.setdefault(row["id"],{})[row["mode"]]=row["status"]
    paired=[p for p in pairs.values() if set(p)==set(MODES)]
    return {"attempted":attempted,"statuses":states,"families":families,
            "byMode":modes,"pairedQuestionsAttempted":len(paired),
            "autoDecidable":{"numerator":adjudicated,"denominator":attempted,
                             "value":adjudicated/attempted if attempted else None},
            "realWrongAnswerDetectionRecall":None,
            "realFalseAcceptanceRate":None,
            "independentTruthReviewed":False,
            "reasonForNullErrorMetrics":"requires_independent_answer_semantics_and_gold_review"}


def save_run(doc,chosen,mode,key,timeout,path,transport=foundation.provider_call):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    rows=[]
    with os.fdopen(fd,"w",encoding="utf8") as f:
        meta={"recordType":"run_metadata","suiteId":IDENTITY,
              "modelRequested":MODEL,"reasoningModeRequested":mode,
              "caseIds":[c["id"] for c in chosen],"manifestSha256":sha(doc),
              "answerKeysProvidedToModel":False,
              "maxTokens":8192 if mode=="high" else 3072,
              "explicitOperatorLiveOptIn":True,"providerIdentityCryptographicallyVerified":False,
              "runStartedAtUtc":datetime.now(timezone.utc).isoformat()}
        f.write(canonical(meta)+"\n")
        f.flush()
        os.fsync(f.fileno())
        for case in chosen:
            row=perform(case,mode,key,timeout,transport)
            rows.append(row)
            f.write(canonical({"recordType":"case_result",**row})+"\n")
            f.flush()
            os.fsync(f.fileno())
            print(case["id"]+" "+mode+" "+row["status"]+
                  " ("+str(row["elapsedMs"])+" ms)",flush=True)
        f.write(canonical({"recordType":"summary","summary":summarize(rows)})+"\n")
        f.flush()
        os.fsync(f.fileno())
    return rows


def read_runs(paths):
    doc=manifest()
    by_id={case["id"]:case for case in doc["cases"]}
    rows=[]
    seen=set()
    for path in paths:
        first=True
        for line in Path(path).read_text(encoding="utf8").splitlines():
            if not line.strip():
                continue
            item=json.loads(line)
            if first:
                first=False
                if (item.get("recordType")!="run_metadata" or
                    item.get("suiteId")!=IDENTITY or
                    item.get("manifestSha256")!=sha(doc) or
                    item.get("reasoningModeRequested") not in MODES):
                    raise Invalid("run_manifest_or_mode_does_not_match")
                run_mode=item["reasoningModeRequested"]
                continue
            if item.get("recordType")!="case_result":
                continue
            key=(item.get("id"),item.get("mode"))
            if (key in seen or item.get("id") not in by_id or
                item.get("mode")!=run_mode or item.get("status") not in VERDICT_STATES or
                item.get("family")!=by_id[item["id"]]["question"]["kind"] or
                item.get("requestSha256")!=sha(make_request(by_id[item["id"]],run_mode))):
                raise Invalid("duplicate_or_invalid_saved_case")
            seen.add(key)
            rows.append(item)
    return rows


def review_template(rows,reviewer):
    if not isinstance(reviewer,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{2,48}",reviewer):
        raise Invalid("reviewer_id_required")
    doc=manifest()
    candidates={case["id"]:case for case in doc["cases"]}
    unresolved={"natural_answer_needs_review","scalar_extraction_abstained",
                "unverified_by_verifier","model_abstention"}
    return {"schemaVersion":1,"suiteId":IDENTITY,"reviewer":reviewer,
            "instructions":"Read actual rawText; copy an exact evidence quote. Do not consult verifier exactAnswer. Independent reviewer transcribes complete final answer to typed candidate; null means cannot determine.",
            "reviews":[{"id":row["id"],"mode":row["mode"],
                "family":row["family"],"question":prompt_for(candidates[row["id"]]),
                "rawTextSha256":hashlib.sha256((row.get("rawText") or "").encode("utf8")).hexdigest(),
                "statusBeforeReview":row["status"],
                "evidenceQuote":"","candidate":None,"extractionDecision":"pending"}
                for row in rows if row["status"] in unresolved]}


def compare_review_pairs(rows,a,b):
    if (a.get("schemaVersion")!=1 or b.get("schemaVersion")!=1 or
        a.get("suiteId")!=IDENTITY or b.get("suiteId")!=IDENTITY or
        a.get("reviewer")==b.get("reviewer")):
        raise Invalid("two_distinct_reviewers_required")
    registry={(r["id"],r["mode"]):r for r in rows}
    cases={c["id"]:c for c in manifest()["cases"]}
    if not isinstance(a.get("reviews"),list) or not isinstance(b.get("reviews"),list):
        raise Invalid("reviews_list_missing")
    def index(rev):
        out={}
        for x in rev["reviews"]:
            key=(x.get("id"),x.get("mode"))
            if key in out or key not in registry:
                raise Invalid("unmatched_or_duplicate_review")
            if x.get("rawTextSha256")!=hashlib.sha256((registry[key].get("rawText") or "").encode("utf8")).hexdigest():
                raise Invalid("raw_model_answer_digest_mismatch")
            out[key]=x
        return out
    aa,bb=index(a),index(b)
    if set(aa)!=set(bb):
        raise Invalid("reviewers_do_not_cover_same_cases")
    counts={"agreed":0,"disagreed":0,"unresolved":0,
            "accepted_by_verifier":0,"refuted_by_verifier":0,
            "unverified_by_verifier":0}
    details=[]
    for key in sorted(aa):
        one,two=aa[key],bb[key]
        def ready(x):
            if x.get("extractionDecision")!="transcribed" or x.get("candidate") is None:
                return False
            quote=x.get("evidenceQuote")
            if not isinstance(quote,str) or not quote.strip() or quote not in registry[key].get("rawText",""):
                raise Invalid("transcription_quote_not_present_in_raw_response")
            return True
        if not ready(one) or not ready(two):
            counts["unresolved"]+=1
            details.append({"id":key[0],"mode":key[1],"status":"unresolved"})
            continue
        if (canonical(one["candidate"])!=canonical(two["candidate"]) or
            one["evidenceQuote"]!=two["evidenceQuote"]):
            counts["disagreed"]+=1
            details.append({"id":key[0],"mode":key[1],"status":"reviewer_disagreement"})
            continue
        verdict=verify_candidate(cases[key[0]]["question"],one["candidate"])
        counts["agreed"]+=1
        counts[verdict["status"]]+=1
        details.append({"id":key[0],"mode":key[1],"status":"agreed_transcription",
                        "verifierStatus":verdict["status"],"candidate":one["candidate"],
                        "verificationDetails":verdict})
    return {"suiteId":IDENTITY,"reviewers":[a["reviewer"],b["reviewer"]],
            "counts":counts,"details":details,
            "independentGoldAccuracyClaims":None,
            "note":"Reviewer consensus concerns answer transcription only, not independent mathematical gold."}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("command",choices=("plan","run","summarize","review-template","replay-reviews"))
    p.add_argument("--mode",choices=MODES,default="high")
    p.add_argument("--start-index",type=int,default=1)
    p.add_argument("--limit",type=int,default=1)
    p.add_argument("--execute-live",action="store_true")
    p.add_argument("--timeout-sec",type=int,default=150)
    p.add_argument("--input",action="append",default=[])
    p.add_argument("--output")
    p.add_argument("--reviewer")
    p.add_argument("--review-a")
    p.add_argument("--review-b")
    args=p.parse_args()
    if args.command in ("summarize","review-template","replay-reviews"):
        if not args.input:
            p.error("saved_--input_required")
        rows=read_runs(args.input)
        if args.command=="summarize":
            output=summarize(rows)
        elif args.command=="review-template":
            if not args.reviewer:
                p.error("--reviewer_required")
            output=review_template(rows,args.reviewer)
        else:
            if not args.review_a or not args.review_b:
                p.error("--review-a_and_--review-b_required")
            a=json.loads(Path(args.review_a).read_text(encoding="utf8"))
            b=json.loads(Path(args.review_b).read_text(encoding="utf8"))
            output=compare_review_pairs(rows,a,b)
        rendered=json.dumps(output,ensure_ascii=False,indent=2)
        if args.output:
            output_path=Path(args.output)
            output_path.parent.mkdir(parents=True,exist_ok=True)
            with output_path.open("x",encoding="utf8") as f:
                f.write(rendered+"\n")
            print("wrote "+str(output_path))
        else:
            print(rendered)
        return 0
    doc=manifest()
    if not 1<=args.start_index<=20 or not 1<=args.limit<=21-args.start_index:
        p.error("invalid_1_based_question_window")
    selected=doc["cases"][args.start_index-1:args.start_index+args.limit-1]
    if args.command=="plan":
        print(json.dumps({"mode":"offline_plan_zero_api_calls","suiteId":IDENTITY,
            "thinkingMode":args.mode,"model":MODEL,"selected":len(selected),
            "maxTokensPerRequest":8192 if args.mode=="high" else 3072,
            "questions":[{"id":r["id"],"family":r["question"]["kind"],
                          "prompt":prompt_for(r),"requestSha256":sha(make_request(r,args.mode))}
                         for r in selected]},ensure_ascii=False,indent=2))
        return 0
    if not args.execute_live:
        p.error("run_requires_--execute-live")
    if not 1<=args.timeout_sec<=240:
        p.error("invalid_timeout")
    key=os.environ.get("DEEPSEEK_API_KEY","")
    if not key.strip():
        p.error("DEEPSEEK_API_KEY_missing")
    output=args.output or str(ROOT/"artifacts/research"/
        ("natural-math-"+args.mode+"-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+
        "-"+uuid.uuid4().hex[:8]+".jsonl"))
    rows=save_run(doc,selected,args.mode,key,args.timeout_sec,output)
    print(json.dumps({"outputPath":output,"summary":summarize(rows)},
                     ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    sys.exit(main())
