#!/usr/bin/env python3
"""Math-Verify 0.9.0 offline extraction comparison for saved Stage-II answers.

The upstream Windows timeout bug (huggingface/Math-Verify issue #79) silently
returned empty matches and raised WinError 5/6. Parse in a separate *OS*
subprocess with parsing_timeout=None, raise_on_error=True, and a bounded
parent-owned wall-clock timeout. This remains a research diagnostic; no live
model calls, no production scoring or gold-assisted answer extraction.
"""
import argparse
from fractions import Fraction
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import run_real_natural_math_holdout as holdout

BASELINE="huggingface/math-verify"
PINNED_VERSION="0.9.0"
MAX_INPUT_BYTES=100_000
MAX_WORKER_OUTPUT_BYTES=20_000
PARSE_WALL_SECONDS=20
NUMERIC_FAMILIES={"finite_uniform_occupancy","finite_arithmetic_geometric_sum"}
WORKER=Path(__file__).with_name("mathverify_parse_worker.py")


def parse_without_gold(text):
    """Parse in a fresh Python subprocess, never in Math-Verify multiprocessing.

    Returns an explicit state, even on timeout or platform failures. Missing
    evidence is NOT equivalent to a genuinely empty successful extraction.
    """
    if not isinstance(text,str) or not text.strip():
        return {"state":"no_final_text"}
    if len(text.encode("utf8"))>MAX_INPUT_BYTES:
        return {"state":"answer_overbound"}
    try:
        outcome=subprocess.run(
            [sys.executable,str(WORKER)],
            input=text,encoding="utf8",
            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,
            timeout=PARSE_WALL_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"state":"worker_timeout"}
    except (OSError,subprocess.SubprocessError) as error:
        return {"state":"worker_launch_failure","exceptionClass":type(error).__name__}
    raw=outcome.stdout
    if not isinstance(raw,str) or len(raw.encode("utf8"))>MAX_WORKER_OUTPUT_BYTES:
        return {"state":"worker_output_invalid"}
    try:
        document=json.loads(raw)
    except (ValueError,TypeError):
        return {"state":"worker_output_invalid"}
    if not isinstance(document,dict):
        return {"state":"worker_output_invalid"}
    if outcome.returncode!=0:
        if document.get("state")=="parser_exception" and isinstance(document.get("exceptionClass"),str):
            return {"state":"parser_exception",
                    "exceptionClass":document["exceptionClass"][:80]}
        return {"state":"worker_failed","exitCode":outcome.returncode}
    if (document.get("state")!="parsed" or
        type(document.get("candidateCount")) is not int or
        not 0<=document["candidateCount"]<=64 or
        not isinstance(document.get("candidates"),list) or
        len(document["candidates"])!=min(document["candidateCount"],8)):
        return {"state":"worker_output_invalid"}
    for item in document["candidates"]:
        if (not isinstance(item,dict) or
            not isinstance(item.get("type"),str) or
            not isinstance(item.get("repr"),str) or
            item.get("numericKind") not in ("exact_rational","approximate_float","not_scalar_numeric")):
            return {"state":"worker_output_invalid"}
    return document


def one_exact_rational(document):
    candidates=document["candidates"]
    if document["candidateCount"]!=1 or len(candidates)!=1:
        return None,"not_one_unambiguous_extraction"
    node=candidates[0]
    kind=node["numericKind"]
    if kind=="approximate_float":
        return None,"approximate_numeric_expression_only"
    if kind!="exact_rational":
        return None,"not_exact_scalar_numeric"
    numerator=node.get("numerator")
    denominator=node.get("denominator")
    if (not isinstance(numerator,str) or not isinstance(denominator,str) or
        len(numerator)>100 or len(denominator)>100 or
        not numerator.lstrip("+-").isdigit() or not denominator.isdigit()):
        return None,"invalid_numeric_worker_evidence"
    try:
        value=Fraction(int(numerator),int(denominator))
    except (ValueError,ZeroDivisionError):
        return None,"invalid_numeric_worker_evidence"
    return str(value),"exact_rational_expression"


def diagnose(row,case):
    raw=row.get("rawText")
    result={
        "id":row["id"],"mode":row["mode"],
        "family":row["family"],"originalStatus":row["status"],
        "originalResponseSha256":hashlib.sha256(
            (raw if isinstance(raw,str) else "").encode("utf8")).hexdigest(),
        "baseline":BASELINE,"baselineVersion":PINNED_VERSION,
        "baselineNotProductionDecision":True,
        "parseWorkerIsolation":"independent_python_subprocess",
        "mathVerifyInternalTimeout":"disabled_to_avoid_windows_spawn_bug",
        "parentWallTimeoutSeconds":PARSE_WALL_SECONDS,
    }
    document=parse_without_gold(raw)
    state=document["state"]
    if state!="parsed":
        result["mathVerifyState"]=state
        if isinstance(document.get("exceptionClass"),str):
            result["exceptionClass"]=document["exceptionClass"]
        if "exitCode" in document:
            result["exitCode"]=document["exitCode"]
        return result
    result["mathVerifyExtracted"]=document["candidates"]
    result["candidateCount"]=document["candidateCount"]
    if document["candidateCount"]==0:
        return {**result,"mathVerifyState":"no_expression_extracted"}
    if case["question"]["kind"] not in NUMERIC_FAMILIES:
        return {**result,"mathVerifyState":"parsed_non_scalar_family_requires_review"}
    candidate,reason=one_exact_rational(document)
    result["numericExtractionStatus"]=reason
    if candidate is None:
        state=("approximate_only_no_exact_comparison" if reason==
               "approximate_numeric_expression_only" else "ambiguous_or_nonnumeric")
        return {**result,"mathVerifyState":state}
    result["extractedNumeric"]=candidate
    # The reference is only derived AFTER candidate extraction. Do not use
    # typed mathematics as an extraction hint for model text.
    verdict=holdout.verify_candidate(case["question"],candidate)
    return {**result,"mathVerifyState":"exact_candidate_adjudicated",
            "strictTypedMathVerdict":verdict["status"],
            "exactAnswerUnderTypedQuestion":verdict.get("exactAnswerUnderTypedQuestion")}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",action="append",required=True,
                        help="Saved Stage-II real-result JSONL; repeat for both modes")
    parser.add_argument("--id",default="h-occ-01")
    args=parser.parse_args()
    try:
        import math_verify
    except ImportError:
        parser.error("math-verify not installed: use isolated venv and math-verify[antlr4_13_2]==0.9.0")
    try:
        installed=importlib.metadata.version("math-verify")
    except importlib.metadata.PackageNotFoundError:
        parser.error("math-verify package distribution metadata is missing")
    if installed!=PINNED_VERSION:
        parser.error("unsupported math-verify version: expected "+PINNED_VERSION+" found "+installed)
    manifest=holdout.manifest()
    cases={x["id"]:x for x in manifest["cases"]}
    if args.id not in cases:
        parser.error("unknown holdout ID")
    rows=[x for x in holdout.read_runs(args.input) if x["id"]==args.id]
    if not rows:
        parser.error("case not found in saved records")
    result={
        "experiment":"offline_existing_baseline_comparison_windows_safe",
        "modelApiCallsPerformed":0,
        "sourceRows":len(rows),
        "mathVerifyInstalledVersion":installed,
        "results":[diagnose(row,cases[args.id]) for row in rows],
        "limitations":"A parsed expression may be an intermediate or approximation. This diagnostic does not establish the correctness of arbitrary natural-language proof steps; independent review is still required.",
    }
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
