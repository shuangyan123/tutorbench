#!/usr/bin/env python3
"""Context-bound expectation-answer extraction, research-only.

This is a small semantic adapter, NOT another LaTeX parser. It accepts only
one explicitly boxed final answer E[X]=EXACT[\approx DECIMAL] when the typed
question asks E[X]. It delegates EXACT parsing to the existing Math-Verify
isolated subprocess, then calls the established exact typed verifier.
Any ambiguous source, inconsistent approximation, unsupported notation,
parser failure or family mismatch abstains, preserving the full original text.
It never derives the gold until the candidate is extracted and bound.
"""
import argparse
from decimal import Decimal, InvalidOperation, localcontext
import hashlib
import json
from pathlib import Path
import re
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import compare_math_verify_baseline as mv
import run_real_natural_math_holdout as holdout

ID="context_bound_expectation_adapter_v0.1"
EXACT_TARGET=re.compile(r"^\s*E\s*\[\s*X\s*\]\s*=\s*(.*?)\s*$",re.S)
APPROX=re.compile(r"^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$")


def abstain(reason,**attrs):
    return {"state":"contextual_abstained","reason":reason,**attrs}


def source_bound_expression(raw,question):
    if (question.get("kind")!="finite_uniform_occupancy" or
        question.get("query")!={"metric":"expected_value"}):
        return abstain("not_an_expected_value_question")
    try:
        boxes=holdout.boxed(raw)
    except holdout.Invalid:
        return abstain("malformed_final_box")
    if len(boxes)!=1:
        return abstain("requires_one_unique_boxed_answer",boxesFound=len(boxes))
    match=EXACT_TARGET.fullmatch(boxes[0])
    if match is None:
        return abstain("boxed_answer_does_not_bind_E_X")
    rhs=match.group(1)
    parts=rhs.split(r"\approx")
    if len(parts)>2:
        return abstain("multiple_approximation_marks")
    exact=parts[0].strip()
    if (not exact or len(exact)>128 or
        any(token in exact for token in ("=",r"\approx",r"\boxed"))):
        return abstain("unsupported_exact_RHS")
    approx=None
    if len(parts)==2:
        candidate=parts[1]
        m=APPROX.fullmatch(candidate)
        if m is None or len(candidate)>64:
            return abstain("unsupported_approximate_RHS")
        approx=m.group(1)
    return {"state":"source_bound",
            "boxedBody":boxes[0],
            "exactRhsLatex":exact,
            "approximation":approx,
            "target":"expected_number_of_distinct_labels_E_X"}


def compatible_rounding(fraction_text,approx):
    if approx is None:
        return True
    from fractions import Fraction
    try:
        rational=Fraction(fraction_text)
        with localcontext() as context:
            context.prec=80
            exact=Decimal(rational.numerator)/Decimal(rational.denominator)
            estimated=Decimal(approx)
            # Approximation within half of the last explicitly given decimal
            # digit. A tie at .5 is considered compatible, not a proof that
            # a particular rounding convention was followed.
            places=len(approx.split(".",1)[1]) if "." in approx else 0
            tolerance=Decimal(1).scaleb(-places)/2
            return abs(exact-estimated)<=tolerance
    except (ValueError,InvalidOperation,OverflowError,ZeroDivisionError):
        return False


def evaluate(raw,question,parse_function=None):
    if not isinstance(raw,str) or not raw.strip():
        return abstain("empty_original_final_text")
    if len(raw.encode("utf8"))>mv.MAX_INPUT_BYTES:
        return abstain("original_answer_overbound")
    bound=source_bound_expression(raw,question)
    if bound["state"]!="source_bound":
        return bound
    exact=bound["exactRhsLatex"]
    # Do NOT hand the entire Eq(E[X], ...) to Math-Verify: it can parse E[X]
    # as sympy E*x. Instead supply only the source-bound exact RHS, bounded
    # by Math-Verify's pre-existing isolated child and parent wall time.
    if parse_function is None:
        parse_function=mv.parse_without_gold
    worker=parse_function(r"\boxed{"+exact+"}")
    if worker.get("state")!="parsed":
        return abstain("mathverify_worker_not_parsed",workerState=worker.get("state"))
    parsed,why=mv.one_exact_rational(worker)
    if parsed is None:
        return abstain("no_unique_exact_numeric_rhs",workerReason=why,
                       candidateCount=worker.get("candidateCount"))
    if not compatible_rounding(parsed,bound["approximation"]):
        return abstain("approximation_conflicts_with_exact_rhs",
                       exactCandidate=parsed,
                       displayedApproximation=bound["approximation"])
    verdict=holdout.verify_candidate(question,parsed)
    return {
        "state":"contextual_exact_candidate_adjudicated",
        "method":ID,
        "target":bound["target"],
        "sourceBoxedBody":bound["boxedBody"],
        "exactRhsLatex":exact,
        "displayedApproximation":bound["approximation"],
        "exactCandidate":parsed,
        "verifierStatus":verdict["status"],
        "exactAnswerUnderTypedQuestion":verdict.get("exactAnswerUnderTypedQuestion"),
        "independentRealGoldReview":False,
        "productionDecision":False,
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input",action="append",required=True)
    p.add_argument("--id",default="h-occ-01")
    args=p.parse_args()
    import importlib.metadata
    installed=importlib.metadata.version("math-verify")
    if installed!=mv.PINNED_VERSION:
        p.error("requires math-verify=="+mv.PINNED_VERSION)
    cases={case["id"]:case for case in holdout.manifest()["cases"]}
    if args.id not in cases:
        p.error("unknown case_id")
    rows=[x for x in holdout.read_runs(args.input) if x["id"]==args.id]
    if not rows:
        p.error("id absent from supplied saved real run files")
    results=[]
    for row in rows:
        raw=row.get("rawText") or ""
        results.append({
            "id":row["id"],
            "mode":row["mode"],
            "originalStatus":row["status"],
            "originalResponseSha256":hashlib.sha256(raw.encode("utf8")).hexdigest(),
            "contextualResult":evaluate(raw,cases[row["id"]]["question"]),
        })
    print(json.dumps({
        "experiment":ID,
        "sourceRows":len(results),
        "modelApiCallsPerformed":0,
        "mathVerifyInstalledVersion":installed,
        "results":results,
        "limitations":"A narrow source-bound boxed expectation answer adapter; no general natural-math parsing, proof verification or independent real-world gold labels.",
    },ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
