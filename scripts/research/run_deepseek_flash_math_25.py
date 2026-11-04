#!/usr/bin/env python3
"""DeepSeek Flash real-model 25-case pilot; explicit local opt-in, no retries."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler
import uuid

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
MANIFEST=ROOT/"fixtures/research/deepseek-flash-blind-math-25-v0.1.json"
URL="https://api.deepseek.com/chat/completions"
MODEL="deepseek-flash"
MAX_TOKENS=1536
KINDS={"finite_uniform_occupancy","finite_arithmetic_geometric_sum",
       "circle_line_intersections","quadratic_real_solution_set",
       "parametric_circle_line_intersection_count"}
JSON_KINDS={"circle_line_intersections","quadratic_real_solution_set",
            "parametric_circle_line_intersection_count"}
STATES=("math_correct","math_incorrect","math_unverified","format_invalid",
        "output_truncated","empty_response","provider_failure",
        "provider_identity_mismatch","model_incomplete")


class Invalid(Exception):
    pass


class ProviderFailure(Exception):
    def __init__(self,category,status=None):
        self.category,self.status=category,status
        super().__init__(category)


def canonical(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))


def sha256(value):
    return hashlib.sha256(value.encode("utf8")).hexdigest()


def load_manifest(path=MANIFEST):
    doc=json.loads(Path(path).read_text(encoding="utf8"))
    if (not isinstance(doc,dict) or set(doc)!={"schemaVersion","id","status","model","thinking","cases"} or
        doc["schemaVersion"]!=1 or doc["id"]!="deepseek-flash-blind-math-25-v0.1" or
        doc["status"]!="real_model_opt_in_no_answers_in_prompts" or
        doc["model"]!=MODEL or doc["thinking"]!="disabled" or
        not isinstance(doc["cases"],list) or len(doc["cases"])!=25):
        raise Invalid("invalid_frozen_25_case_manifest")
    ids=[]
    family_counts={k:0 for k in KINDS}
    prefixes={"finite_uniform_occupancy":"occ-","finite_arithmetic_geometric_sum":"seq-",
              "circle_line_intersections":"circle-","quadratic_real_solution_set":"quad-",
              "parametric_circle_line_intersection_count":"param-"}
    for row in doc["cases"]:
        if (not isinstance(row,dict) or set(row)!={"id","question"} or
            not isinstance(row["id"],str) or not 1<=len(row["id"])<=64 or
            not isinstance(row["question"],dict) or row["question"].get("kind") not in KINDS):
            raise Invalid("invalid_case_schema")
        kind=row["question"]["kind"]
        if not row["id"].startswith(prefixes[kind]):
            raise Invalid("case_family_id_mismatch")
        ids.append(row["id"])
        family_counts[kind]+=1
    if len(set(ids))!=25 or any(n!=5 for n in family_counts.values()):
        raise Invalid("expected_five_distinct_cases_per_family")
    return doc


def polynomial(node):
    return " + ".join(
        f"({c['num']}/{c['den']})*x^{i}" if i else f"({c['num']}/{c['den']})"
        for i,c in enumerate(node["coefficients"])
    )


def question_text(q):
    kind=q["kind"]
    if kind=="finite_uniform_occupancy":
        m,a=q["model"],q["query"]
        metric=a["metric"]
        text={"expected_value":"数学期望 E[X]","variance":"方差 Var(X)",
              "probability_exact":f"概率 P(X={a.get('k')})",
              "probability_at_least":f"概率 P(X≥{a.get('k')})",
              "probability_at_most":f"概率 P(X≤{a.get('k')})"}[metric]
        return (f"有 {m['numberOfLabels']} 种等可能标签，独立、均匀、有放回抽取 "
                f"{m['numberOfDraws']} 次。X 是出现过的不同标签数。求 {text}。")
    if kind=="finite_arithmetic_geometric_sum":
        m=q["model"]
        return (f"u_k=(a+k*d)*r^k（k=0,...,n-1），a={m['firstTerm']}，"
                f"d={m['commonDifference']}，r={m['commonRatio']}，n={m['termCount']}。"
                "求 S=∑_{k=0}^{n-1}u_k 的精确值。")
    if kind=="circle_line_intersections":
        c,l=q["circle"],q["line"]
        return (f"圆 (x-({c['centerX']}))²+(y-({c['centerY']}))²={c['radiusSquared']}；"
                f"直线 ({l['a']})x+({l['b']})y+({l['c']})=0。求所有不同实数交点，"
                "无交点输出空点集。")
    if kind=="quadratic_real_solution_set":
        relation={"eq":"=","ne":"≠","gt":">","ge":"≥","lt":"<","le":"≤"}[q["comparison"]]
        return (f"令 P(x)={polynomial(q['numerator'])}，Q(x)={polynomial(q['denominator'])}。"
                f"求 P(x)/Q(x) {relation} 0 的完整实数解集，必须排除 Q(x)=0 的点。")
    if kind=="parametric_circle_line_intersection_count":
        c,l=q["circle"],q["line"]
        return (f"圆 (x-({c['centerX']}))²+(y-({c['centerY']}))²={c['radiusSquared']}；"
                f"直线族 ({l['a']})x+({l['b']})y+({l['baseC']})+({l['parameterC']})t=0。"
                f"求恰有 {q['query']['intersectionCount']} 个不同实数交点时参数 t 的完整实数解集。")
    raise Invalid("unsupported_question_kind")


SCALAR_PROMPT=("独立解答，只输出一个精确数值：整数、分数或有限小数。"
               "不要解释、推导、Markdown 或单位；无法确定仅输出 UNSURE。")
POINT_PROMPT=(
    '独立解答，只输出完整 JSON 对象，不要解释或 Markdown。'
    '格式 {"kind":"point_set","points":[{"x":COORD,"y":COORD},...]}。'
    'COORD 是 {"kind":"rational","value":"p/q"} 或 '
    '{"kind":"affine_sqrt","offset":"a","coefficient":"b","radicand":"r"}。'
    '各系数字符串表示整数、分数或有限小数，radicand>=0。'
    '无交点时 {"kind":"point_set","points":[]}。求所有实数交点，不可遗漏。'
)
SET_PROMPT=(
    '独立解答，只输出完整 JSON 对象，不要解释或 Markdown。'
    '空集 {"kind":"empty"}；全体实数 {"kind":"all_real"}；其余为 '
    '{"kind":"union","parts":[PIECE,...]}。PIECE 是 '
    '{"kind":"point","value":END} 或 '
    '{"kind":"interval","left":END,"right":END,"includeLeft":false,"includeRight":false}。'
    'END 是 {"kind":"rational","num":p,"den":q}、'
    '{"kind":"surd","a":a,"b":b,"radicand":r,"den":d} 或 '
    '{"kind":"infinity","side":"negative"} / {"kind":"infinity","side":"positive"}。'
    'p,q,a,b,r,d 是整数；q,d>0，r>=0。区间端点包含性必须准确，无穷端点始终不包含。'
    '返回完整解集，保留所有边界与定义域排除点。'
)


def build_request(row):
    kind=row["question"]["kind"]
    system=(POINT_PROMPT if kind=="circle_line_intersections" else
            SET_PROMPT if kind in JSON_KINDS else SCALAR_PROMPT)
    return {"model":MODEL,"messages":[{"role":"system","content":system},
             {"role":"user","content":question_text(row["question"])}],
            "thinking":{"type":"disabled"},"max_tokens":MAX_TOKENS,"stream":False}


def unique_pairs(pairs):
    out={}
    for k,v in pairs:
        if k in out:
            raise ValueError("duplicate_json_key")
        out[k]=v
    return out


def reject_nonfinite(_):
    raise ValueError("nonfinite_json_value")


def parse_answer(raw,kind):
    if not isinstance(raw,str) or not 1<=len(raw)<=4096:
        raise Invalid("answer_text_missing_or_too_long")
    raw=raw.strip()
    if kind in JSON_KINDS:
        try:
            candidate=json.loads(raw,object_pairs_hook=unique_pairs,
                                 parse_constant=reject_nonfinite)
        except (ValueError,TypeError,RecursionError) as e:
            raise Invalid("whole_json_answer_required") from e
        if not isinstance(candidate,dict):
            raise Invalid("whole_json_object_required")
        return candidate,canonical(candidate)
    return raw,raw


def summary(rows):
    counts={state:0 for state in STATES}
    by_family={kind:{"attempted":0,**{s:0 for s in STATES}} for kind in sorted(KINDS)}
    for row in rows:
        state,kind=row["status"],row["family"]
        if state not in counts or kind not in by_family:
            raise Invalid("invalid_result_status")
        counts[state]+=1
        by_family[kind]["attempted"]+=1
        by_family[kind][state]+=1
    total=len(rows)
    decidable=counts["math_correct"]+counts["math_incorrect"]
    return {"attempted":total,**counts,"mathDecidable":decidable,
            "decidableCoverage":{"numerator":decidable,"denominator":total,
                                 "value":decidable/total if total else None},
            "mathCorrectOnDecidable":{"numerator":counts["math_correct"],
                                      "denominator":decidable,
                                      "value":counts["math_correct"]/decidable if decidable else None},
            "detectedWrongUnderTypedQuestion":counts["math_incorrect"],
            "empiricalFalseAcceptanceRate":None,
            "empiricalWrongAnswerDetectionRecall":None,
            "reasonForNullErrorRates":"no_separately_reviewed_real_model_gold",
            "byFamily":by_family}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*_args,**_kwargs):
        return None


def provider_call(payload,key,timeout):
    req=Request(URL,method="POST",data=canonical(payload).encode("utf8"),headers={
        "Authorization":"Bearer "+key,
        "Content-Type":"application/json; charset=utf-8",
        "User-Agent":"TutorBench-MathPilot/0.1",
    })
    try:
        with build_opener(NoRedirect).open(req,timeout=timeout) as response:
            if response.status!=200:
                raise ProviderFailure("provider_http_error",response.status)
            raw=response.read(400_001)
            if len(raw)>400_000:
                raise ProviderFailure("provider_response_too_large",200)
    except HTTPError as e:
        raise ProviderFailure("provider_http_error",e.code) from None
    except (URLError,TimeoutError,socket.timeout,OSError):
        raise ProviderFailure("provider_transport_failure") from None
    try:
        result=json.loads(raw.decode("utf8"))
    except (UnicodeError,ValueError):
        raise ProviderFailure("provider_invalid_json",200) from None
    if not isinstance(result,dict):
        raise ProviderFailure("provider_invalid_schema",200)
    return result


def examine(row,response):
    kind=row["question"]["kind"]
    base={"id":row["id"],"family":kind,"rawText":None,"finishReason":None,
          "realHttpResponseCaptured":True,"bridgeCaptureKind":"offline_replay",
          "providerIdentityCryptographicallyVerified":False}
    if response.get("model")!=MODEL:
        return {**base,"status":"provider_identity_mismatch","returnedModel":response.get("model")}
    choices=response.get("choices")
    if not isinstance(choices,list) or len(choices)!=1 or not isinstance(choices[0],dict):
        return {**base,"status":"provider_failure","errorCategory":"invalid_choices"}
    choice=choices[0]
    finish=choice.get("finish_reason")
    msg=choice.get("message")
    raw=msg.get("content") if isinstance(msg,dict) else None
    base["finishReason"]=finish
    base["rawText"]=raw if isinstance(raw,str) else None
    if finish=="length":
        return {**base,"status":"output_truncated"}
    if finish!="stop":
        return {**base,"status":"model_incomplete"}
    if not isinstance(raw,str) or not raw.strip():
        return {**base,"status":"empty_response"}
    try:
        candidate,replay_text=parse_answer(raw,kind)
    except Invalid as error:
        return {**base,"status":"format_invalid","reason":str(error)}
    import verify_dual_path_math_answers as bridge
    packet={"id":row["id"],"path":"no_answer","question":row["question"],
            "modelAttempt":{"captureKind":"offline_replay","modelId":MODEL,
                            "rawText":replay_text,"answer":candidate}}
    checked=bridge.adjudicate(packet,{})
    labels={"replayed_candidate_mathematically_verified":"math_correct",
            "replayed_candidate_mathematically_refuted":"math_incorrect",
            "unverified":"math_unverified"}
    if (checked.get("status") not in labels or checked.get("officialExamGoldCertified") or
        checked.get("liveAIModelCallPerformed")):
        raise Invalid("unsupported_or_false_claim_from_bridge")
    return {**base,"status":labels[checked["status"]],
            "exactAnswerUnderTypedQuestion":checked.get("exactAnswerUnderTypedModel"),
            "candidateNormalized":checked.get("submittedModelAnswer"),
            "counterexample":checked.get("counterexample"),
            "unverifiedReason":checked.get("reason"),
            "normalization":"whole_json" if kind in JSON_KINDS else "scalar_trim"}


def run_one(row,key,timeout,transport=provider_call):
    payload=build_request(row)
    start=time.monotonic()
    base={"id":row["id"],"family":row["question"]["kind"],
          "modelRequested":MODEL,"thinkingRequested":"disabled",
          "attemptedAtUtc":datetime.now(timezone.utc).isoformat(),
          "requestSha256":sha256(canonical(payload)),
          "realHttpRequestAttempted":True,"providerIdentityCryptographicallyVerified":False}
    try:
        response=transport(payload,key,timeout)
        result={**base,**examine(row,response),"httpStatus":200}
        result["providerResponseId"]=response.get("id") if isinstance(response.get("id"),str) else None
        usage=response.get("usage")
        if isinstance(usage,dict):
            result["tokenUsage"]={k:v for k,v in usage.items() if
                                  k in ("prompt_tokens","completion_tokens","total_tokens") and
                                  type(v) is int and v>=0}
    except ProviderFailure as e:
        result={**base,"status":"provider_failure","httpStatus":e.status,"errorCategory":e.category}
    result["elapsedMs"]=round((time.monotonic()-start)*1000)
    return result


def write_run(doc,rows,key,timeout,path,transport=provider_call):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    results=[]
    with os.fdopen(fd,"w",encoding="utf8") as f:
        f.write(canonical({"recordType":"run_metadata","suiteId":doc["id"],
            "modelRequested":MODEL,"thinkingRequested":"disabled","maxTokens":MAX_TOKENS,
            "selectedIds":[x["id"] for x in rows],"manifestSha256":sha256(canonical(doc)),
            "startedAtUtc":datetime.now(timezone.utc).isoformat(),
            "liveOperatorAuthorized":True,"apiKeyStored":False})+"\n")
        f.flush()
        os.fsync(f.fileno())
        for row in rows:
            result=run_one(row,key,timeout,transport)
            results.append(result)
            f.write(canonical({"recordType":"case_result",**result})+"\n")
            f.flush()
            os.fsync(f.fileno())
            print(f"{row['id']}: {result['status']} ({result['elapsedMs']} ms)",flush=True)
        f.write(canonical({"recordType":"run_summary","summary":summary(results)})+"\n")
        f.flush()
        os.fsync(f.fileno())
    return results


def load_runs(paths):
    rows=[]
    for path in paths:
        first=True
        for line in Path(path).read_text(encoding="utf8").splitlines():
            if not line.strip():
                continue
            record=json.loads(line)
            if first:
                if (record.get("recordType")!="run_metadata" or
                    record.get("suiteId")!="deepseek-flash-blind-math-25-v0.1"):
                    raise Invalid("not_a_supported_run_file")
                first=False
                continue
            if record.get("recordType")=="case_result":
                rows.append(record)
    ids=[x["id"] for x in rows]
    if len(ids)!=len(set(ids)):
        raise Invalid("duplicate_case_id_in_combined_runs")
    return rows


def main():
    p=argparse.ArgumentParser()
    p.add_argument("mode",choices=("plan","run","summarize"))
    p.add_argument("--start-index",type=int,default=1)
    p.add_argument("--limit",type=int,default=1)
    p.add_argument("--execute-live",action="store_true")
    p.add_argument("--timeout-sec",type=int,default=90)
    p.add_argument("--output")
    p.add_argument("--input",action="append",default=[])
    args=p.parse_args()
    if args.mode=="summarize":
        if not args.input:
            p.error("summarize_requires_input_file")
        print(json.dumps(summary(load_runs(args.input)),ensure_ascii=False,indent=2))
        return 0
    doc=load_manifest()
    if not 1<=args.start_index<=25 or not 1<=args.limit<=26-args.start_index:
        p.error("invalid_case_window")
    rows=doc["cases"][args.start_index-1:args.start_index+args.limit-1]
    if args.mode=="plan":
        print(json.dumps({"mode":"plan_no_provider_calls","totalFrozen":25,
            "selected":len(rows),"estimatedPrice":None,"noAnswerKeysSent":True,
            "maxOutputTokensPerRequest":MAX_TOKENS,
            "cases":[{"id":r["id"],"family":r["question"]["kind"],
                      "question":question_text(r["question"]),
                      "requestSha256":sha256(canonical(build_request(r)))} for r in rows]},
            ensure_ascii=False,indent=2))
        return 0
    if not args.execute_live:
        p.error("run_requires_--execute-live")
    if not 1<=args.timeout_sec<=180:
        p.error("timeout_not_in_range")
    key=os.environ.get("DEEPSEEK_API_KEY","")
    if not key.strip():
        p.error("DEEPSEEK_API_KEY_not_set_in_current_terminal")
    output=args.output or str(ROOT/"artifacts/research"/
        ("deepseek-flash-25-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+
         "-"+uuid.uuid4().hex[:8]+".jsonl"))
    results=write_run(doc,rows,key,args.timeout_sec,output)
    print(json.dumps({"outputPath":output,"summary":summary(results)},ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    sys.exit(main())
