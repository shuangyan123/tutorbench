#!/usr/bin/env python3
"""Research-only source-statement -> typed-model -> exact-answer chain.

Accepts only three explicitly labelled *controlled* Chinese statement grammars.
The parser and renderer are separate; canonical exact text, source hash, and
all typed fields must agree before any math or candidate comparison. A SHA256
hash is not a signature and never establishes genuine exam-paper provenance.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import verify_dual_path_math_answers as bridge
import verify_circle_line_intersections as circle
import verify_finite_arithmetic_geometric_sum as seq
import verify_parametric_circle_line_classification as param

FIXTURE_ID="controlled-statement-to-math-proof-v0.1"
KINDS={"synthetic_controlled_statement","unverified_external_transcription"}
NUMBER=r"[+-]?(?:[0-9]+(?:\.[0-9]+)?|[0-9]+/[0-9]+)"
MAX_SOURCE_CHARS=512
MAX_CASES=64


class Unsupported(Exception):
    pass


def canonical_json(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))


def sha256(text):
    return hashlib.sha256(text.encode("utf8")).hexdigest()


def render_question(question):
    """Independent controlled-statement renderer; no answers/sources are read."""
    if not isinstance(question,dict):
        raise Unsupported("invalid_declared_question")
    kind=question.get("kind")
    if kind=="finite_arithmetic_geometric_sum":
        try:
            seq.parse_question(question)
        except seq.Unsupported as e:
            raise Unsupported("unsupported_sequence_"+str(e)) from e
        m=question["model"]
        return (f"【AGSUM-1】已知 u_k=(a+k*d)*r^k (k=0,...,n-1)；"
                f"a={m['firstTerm']}；d={m['commonDifference']}；"
                f"r={m['commonRatio']}；n={m['termCount']}。求总和。")
    if kind=="circle_line_intersections":
        try:
            circle.parse_question(question)
        except circle.Unsupported as e:
            raise Unsupported("unsupported_circle_line_"+str(e)) from e
        disk,line=question["circle"],question["line"]
        return (f"【CLPOINT-1】已知圆 (x-h)^2+(y-k)^2=R，直线 ax+by+c=0；"
                f"h={disk['centerX']}；k={disk['centerY']}；R={disk['radiusSquared']}；"
                f"a={line['a']}；b={line['b']}；c={line['c']}。求全部实数交点。")
    if kind=="parametric_circle_line_intersection_count":
        try:
            param.parse_question(question)
        except param.Unsupported as e:
            raise Unsupported("unsupported_parametric_circle_line_"+str(e)) from e
        disk,line,query=question["circle"],question["line"],question["query"]
        return (f"【CLPARAM-1】已知圆 (x-h)^2+(y-k)^2=R，直线族 ax+by+c0+c1*t=0；"
                f"h={disk['centerX']}；k={disk['centerY']}；R={disk['radiusSquared']}；"
                f"a={line['a']}；b={line['b']}；c0={line['baseC']}；"
                f"c1={line['parameterC']}。求恰有 {query['intersectionCount']} "
                "个不同实数交点时 t 的全部实数取值。")
    raise Unsupported("unsupported_controlled_statement_family")


def compile_parser(pattern):
    return re.compile(pattern.replace("<NUM>",NUMBER),re.ASCII)


PATTERNS=(
    ("finite_arithmetic_geometric_sum",
     compile_parser(r"【AGSUM-1】已知 u_k=\(a\+k\*d\)\*r\^k \(k=0,\.\.\.,n-1\)；a=(?P<a><NUM>)；d=(?P<d><NUM>)；r=(?P<r><NUM>)；n=(?P<n>[0-9]{1,3})。求总和。")),
    ("circle_line_intersections",
     compile_parser(r"【CLPOINT-1】已知圆 \(x-h\)\^2\+\(y-k\)\^2=R，直线 ax\+by\+c=0；h=(?P<h><NUM>)；k=(?P<k><NUM>)；R=(?P<R><NUM>)；a=(?P<a><NUM>)；b=(?P<b><NUM>)；c=(?P<c><NUM>)。求全部实数交点。")),
    ("parametric_circle_line_intersection_count",
     compile_parser(r"【CLPARAM-1】已知圆 \(x-h\)\^2\+\(y-k\)\^2=R，直线族 ax\+by\+c0\+c1\*t=0；h=(?P<h><NUM>)；k=(?P<k><NUM>)；R=(?P<R><NUM>)；a=(?P<a><NUM>)；b=(?P<b><NUM>)；c0=(?P<c0><NUM>)；c1=(?P<c1><NUM>)。求恰有 (?P<count>[012]) 个不同实数交点时 t 的全部实数取值。")),
)


def parse_statement(statement):
    """Separate strictly anchored extraction; cannot see declared model or gold."""
    if not isinstance(statement,str) or not 1<=len(statement)<=MAX_SOURCE_CHARS:
        raise Unsupported("statement_not_bounded_utf8_text")
    for kind,regex in PATTERNS:
        match=regex.fullmatch(statement)
        if match is None:
            continue
        v=match.groupdict()
        if kind=="finite_arithmetic_geometric_sum":
            q={"kind":kind,"model":{
                "firstTerm":v["a"],"commonDifference":v["d"],
                "commonRatio":v["r"],"termCount":int(v["n"])},
               "query":{"metric":"sum"}}
        else:
            disk={"centerX":v["h"],"centerY":v["k"],"radiusSquared":v["R"]}
            if kind=="circle_line_intersections":
                q={"kind":kind,"circle":disk,"line":{"a":v["a"],"b":v["b"],"c":v["c"]}}
            else:
                q={"kind":kind,"circle":disk,
                   "line":{"a":v["a"],"b":v["b"],"baseC":v["c0"],"parameterC":v["c1"]},
                   "query":{"intersectionCount":int(v["count"])}}
        if render_question(q)!=statement:
            raise Unsupported("noncanonical_controlled_statement")
        return q
    raise Unsupported("statement_outside_controlled_grammar")


def certify_one(row):
    ident=row.get("id") if isinstance(row,dict) else None
    base={"id":ident if isinstance(ident,str) and re.fullmatch(r"[a-z0-9-]{1,100}",ident) else None,
          "officialExamGoldCertified":False,
          "originalSourceAuthenticated":False,
          "liveAIModelCallPerformed":False}
    try:
        if base["id"] is None:
            raise Unsupported("invalid_statement_case_id")
        if not isinstance(row,dict) or set(row).difference({
            "id","source","statement","statementSha256","declaredQuestion",
            "path","referenceAnswer","modelAttempt","expectedStatus"}):
            raise Unsupported("unexpected_statement_case_field")
        source=row.get("source")
        if (not isinstance(source,dict) or set(source)!={"kind","sourceId"} or
            source["kind"] not in KINDS or not isinstance(source["sourceId"],str) or
            not re.fullmatch(r"[a-zA-Z0-9._-]{1,100}",source["sourceId"])):
            raise Unsupported("source_lineage_not_declared")
        statement=row.get("statement")
        if not isinstance(statement,str) or sha256(statement)!=row.get("statementSha256"):
            raise Unsupported("source_statement_fingerprint_mismatch")
        parsed=parse_statement(statement)
        declared=row.get("declaredQuestion")
        if parsed!=declared:
            raise Unsupported("statement_and_declared_math_model_mismatch")
        # Math derives from ONLY parsed statement, never candidate, sourceId
        # or the supposedly linked declaration. The legacy bridge handles the
        # same source-free answer or offline replay contract.
        answer_row={"id":base["id"],"path":row.get("path"),"question":parsed}
        if "referenceAnswer" in row:
            answer_row["referenceAnswer"]=row["referenceAnswer"]
        if "modelAttempt" in row:
            answer_row["modelAttempt"]=row["modelAttempt"]
        adjudication=bridge.adjudicate(answer_row,{})
        result={
            **adjudication,
            **base,
            "formalizationStatus":"controlled_statement_exact_roundtrip",
            "statementSha256":sha256(statement),
            "typedQuestionSha256":sha256(canonical_json(parsed)),
            "sourceOrigin":source["kind"],
            "sourceId":source["sourceId"],
            "sourceLineageIndependentlyVerified":False,
        }
        return result
    except (Unsupported,TypeError,ValueError,KeyError,RecursionError) as error:
        return {**base,"status":"unverified",
                "reason":str(error) if isinstance(error,Unsupported)
                         else "statement_evidence_outside_supported_scope",
                "formalizationStatus":"unverified"}


def check_batch(document):
    if (not isinstance(document,dict) or set(document)!={"schemaVersion","id","cases"} or
        document["schemaVersion"]!=1 or document["id"]!=FIXTURE_ID or
        not isinstance(document["cases"],list) or
        not 1<=len(document["cases"])<=MAX_CASES):
        raise ValueError("invalid_controlled_statement_batch_contract")
    ids=[v.get("id") if isinstance(v,dict) else None for v in document["cases"]]
    if any(type(i) is not str for i in ids) or len(set(ids))!=len(ids):
        raise ValueError("missing_or_duplicate_statement_id")
    items=[certify_one(row) for row in document["cases"]]
    categories=["reference_mathematically_verified","reference_mathematically_refuted",
                "deterministic_no_answer_solution",
                "replayed_candidate_mathematically_verified",
                "replayed_candidate_mathematically_refuted","unverified"]
    counts={key:sum(x["status"]==key for x in items) for key in categories}
    counts.update({
        "formalizationExact":sum(x.get("formalizationStatus")=="controlled_statement_exact_roundtrip" for x in items),
        "sourceLineagesIndependentlyVerified":0,
        "originalSourceAuthenticated":0,
        "officialExamGoldReleased":0,
        "genuineAIModelRuns":0,
        "measuredLiveAIAccuracy":None,
    })
    return {"status":"controlled_statement_math_chain_not_official_exam_certification",
            "summary":{"total":len(items),**counts},"items":items}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",required=True)
    parser.add_argument("--require-decidable",action="store_true")
    args=parser.parse_args()
    output=check_batch(json.loads(Path(args.fixture).read_text(encoding="utf8")))
    print(json.dumps(output,ensure_ascii=False,indent=2))
    return int(bool(args.require_decidable and output["summary"]["unverified"]))


if __name__=="__main__":
    sys.exit(main())
