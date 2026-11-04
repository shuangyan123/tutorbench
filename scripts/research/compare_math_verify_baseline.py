#!/usr/bin/env python3
"""Offline Math-Verify extraction baseline for saved real Stage-II JSONL.

No model/API calls; original final text is passed to Math-Verify WITHOUT any
gold/reference answer. Report the selected parse and strict exact numeric
comparison only as research diagnostics. No automatic trusted adjudication,
no silent promotion to a TutorBench verifier production result.
"""
import argparse
from fractions import Fraction
import json
import re
import sys

from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import run_real_natural_math_holdout as holdout
import verify_dual_path_math_answers as verifier

BASELINE="huggingface/math-verify"
PINNED_VERSION="0.9.0"
MAX_INPUT_BYTES=100_000
NUMERIC_FAMILIES={"finite_uniform_occupancy","finite_arithmetic_geometric_sum"}


def parse_without_gold(text):
    # Optional dependency, kept OUTSIDE the TutorBench core runtime.
    from math_verify import parse
    from math_verify.parser import LatexExtractionConfig, ExprExtractionConfig
    if not isinstance(text,str) or not text.strip():
        return []
    if len(text.encode("utf8"))>MAX_INPUT_BYTES:
        return []
    return parse(
        text,
        extraction_config=(
            LatexExtractionConfig(boxed_match_priority=0),
            ExprExtractionConfig(),
        ),
        fallback_mode="no_fallback",
        extraction_mode="first_match",
        parsing_timeout=3,
    )


def independent_strict_scalar(parsed):
    """Return one exact numeric candidate or abstain; never guess from math prose.

    Math-Verify may extract a float approximation or a non-number expression.
    Neither is silently scored as a verified exact answer.
    """
    from sympy import Integer, Rational, Float
    numbers=[x for x in parsed if isinstance(x,(Integer,Rational,Float))]
    if len(numbers)!=1:
        return None,"not_one_unambiguous_numeric_expression"
    obj=numbers[0]
    if isinstance(obj,Float):
        # Distinguish finite-decimal literals from true exact rational outputs.
        # Float may be rounded during parsing; never promote it to exact gold.
        return str(obj),"approximate_numeric_expression_only"
    return str(Fraction(int(obj.p),int(obj.q))),"exact_rational_expression"


def diagnose(row,case):
    report={
        "id":row["id"],"mode":row["mode"],
        "family":row["family"],"originalStatus":row["status"],
        "originalResponseSha256":holdout.hashlib.sha256(
            (row.get("rawText") or "").encode("utf8")).hexdigest(),
        "baseline":BASELINE,"baselineVersion":PINNED_VERSION,
        "baselineNotProductionDecision":True,
    }
    raw=row.get("rawText")
    if not isinstance(raw,str) or not raw.strip():
        return {**report,"mathVerifyState":"no_final_text"}
    try:
        candidates=parse_without_gold(raw)
    except Exception as exc:
        return {**report,"mathVerifyState":"parser_exception",
                "exceptionClass":type(exc).__name__}
    report["mathVerifyExtracted"]=[
        {"type":type(x).__name__,"repr":str(x)[:300]} for x in candidates[:8]
    ]
    report["candidateCount"]=len(candidates)
    if not candidates:
        return {**report,"mathVerifyState":"no_expression_extracted"}
    kind=case["question"]["kind"]
    if kind not in NUMERIC_FAMILIES:
        return {**report,"mathVerifyState":"parsed_non_scalar_family_requires_review"}
    number,kind_of_number=independent_strict_scalar(candidates)
    report["numericExtractionStatus"]=kind_of_number
    if number is None:
        return {**report,"mathVerifyState":"ambiguous_or_nonnumeric"}
    report["extractedNumeric"]=number
    if kind_of_number!="exact_rational_expression":
        return {**report,"mathVerifyState":"approximate_only_no_exact_comparison"}
    # The gold is derived strictly AFTER extraction and is not used to choose
    # an extraction from the prose.
    checked=holdout.verify_candidate(case["question"],number)
    report["mathVerifyState"]="exact_candidate_adjudicated"
    report["strictTypedMathVerdict"]=checked["status"]
    report["exactAnswerUnderTypedQuestion"]=checked.get("exactAnswerUnderTypedQuestion")
    return report


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input",action="append",required=True,
                   help="Saved stage-II JSONL result; repeat for both thinking modes")
    p.add_argument("--id",default="h-occ-01",help="Case ID (default: first paired smoke)")
    args=p.parse_args()
    try:
        import math_verify
    except ImportError:
        p.error("optional_dependency_missing: install math-verify[antlr4_13_2]==0.9.0 in a disposable venv")
    doc=holdout.manifest()
    cases={x["id"]:x for x in doc["cases"]}
    if args.id not in cases:
        p.error("unknown_holdout_id")
    rows=[x for x in holdout.read_runs(args.input) if x["id"]==args.id]
    if not rows:
        p.error("case_id_not_found_in_supplied_records")
    output={"experiment":"offline_existing_baseline_comparison",
            "modelApiCallsPerformed":0,
            "sourceRows":len(rows),
            "mathVerifyInstalledVersion":getattr(math_verify,"__version__",None),
            "results":[diagnose(row,cases[args.id]) for row in rows],
            "limitations":"Parsing may select an equation, an approximation or an earlier number. No raw answer is automatically certified; any non-exact or ambiguous parse requires human review."}
    print(json.dumps(output,ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    sys.exit(main())
