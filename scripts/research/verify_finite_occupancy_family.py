#!/usr/bin/env python3
"""Complete exact answers for a bounded finite uniform occupancy problem family.

Model: d independent, uniformly distributed draws with replacement from n
distinct labels; X counts distinct labels observed. This is a verified
mathematical claim *conditional on correct model input*, not official exam gold,
and not a natural-language / step / proof grader.

Three mathematically distinct distribution implementations are compared:
  A. Stirling number / surjection counting;
  B. occupancy-state dynamic programming on ordered draw sequences;
  C. inclusion-exclusion over selected label sets.
For sufficiently small sample spaces a fourth direct enumeration checks counts.
The expectation and variance are independently recomputed from indicator
variables and two distribution algorithms, all with exact rational arithmetic.
"""
import argparse
from collections import Counter
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from itertools import product
from math import comb, perm
import json
from pathlib import Path
import re
import sys

N_MAX = 64
D_MAX = 128
ENUMERATION_BUDGET = 30_000
MAX_CASES = 256
ID = "finite-uniform-occupancy-family-v0.1"
MODEL_KEYS = {
    "numberOfLabels", "numberOfDraws", "uniform",
    "independent", "withReplacement", "randomVariable",
}
METRICS = {"expected_value", "variance", "probability_exact",
           "probability_at_least", "probability_at_most"}


class Unsupported(Exception):
    pass


def parse_model(model):
    if not isinstance(model, dict) or set(model) != MODEL_KEYS:
        raise Unsupported("incomplete_or_extra_model_fields")
    n, d = model["numberOfLabels"], model["numberOfDraws"]
    if type(n) is not int or type(d) is not int or not 1 <= n <= N_MAX or not 0 <= d <= D_MAX:
        raise Unsupported("model_outside_bounded_uniform_family")
    if (model["uniform"] is not True or
        model["independent"] is not True or
        model["withReplacement"] is not True or
        any(type(model[key]) is not bool for key in ("uniform", "independent", "withReplacement"))):
        raise Unsupported("sampling_assumptions_not_verified")
    if model["randomVariable"] != "number_of_distinct_labels_seen":
        raise Unsupported("unknown_random_variable")
    return n, d


def stirling_distribution(n, d):
    # S(t,k) = k*S(t-1,k) + S(t-1,k-1);  S(0,0)=1.
    row = [1] + [0] * min(n, d)
    for t in range(1, d + 1):
        nxt = [0] * len(row)
        for k in range(1, min(t, n) + 1):
            nxt[k] = k * row[k] + row[k - 1]
        row = nxt
    return {k: perm(n, k) * row[k] for k in range(min(n, d) + 1)
            if perm(n, k) * row[k]}


def dynamic_distribution(n, d):
    # For an ordered sequence with k occupied labels: k ways to repeat a
    # label and (n-k) ways to introduce a new one on the next draw.
    row = [1] + [0] * min(n, d)
    for _ in range(d):
        nxt = [0] * len(row)
        for k, count in enumerate(row):
            if count:
                nxt[k] += k * count
                if k + 1 < len(row):
                    nxt[k + 1] += (n - k) * count
        row = nxt
    return {k: c for k, c in enumerate(row) if c}


def inclusion_exclusion_distribution(n, d):
    # Choose k distinct labels, then count onto functions onto those k:
    # C(n,k) * sum_j (-1)^j C(k,j) (k-j)^d.
    counts = {}
    for k in range(min(n, d) + 1):
        total = 0
        for j in range(k + 1):
            total += (-1)**j * comb(k, j) * (k-j)**d
        count = comb(n, k) * total
        if count:
            counts[k] = count
    return counts


def exhaustive_distribution(n, d):
    if n**d > ENUMERATION_BUDGET:
        return None
    counts = Counter(len(set(seq)) for seq in product(range(n), repeat=d))
    return dict(sorted(counts.items()))


def proof(n, d):
    a = stirling_distribution(n, d)
    b = dynamic_distribution(n, d)
    c = inclusion_exclusion_distribution(n, d)
    if a != b or b != c:
        raise AssertionError("three_exact_distribution_methods_disagree")
    total = n**d
    if sum(a.values()) != total or any(x < 0 for x in a.values()):
        raise AssertionError("sample_space_not_normalized")
    exhaustive = exhaustive_distribution(n, d)
    if exhaustive is not None and exhaustive != a:
        raise AssertionError("independent_full_outcome_enumeration_disagrees")
    expected = Fraction(sum(k * amount for k, amount in a.items()), total)
    second_moment = Fraction(sum(k*k * amount for k, amount in a.items()), total)
    variance = second_moment - expected*expected
    if variance < 0:
        raise AssertionError("impossible_negative_variance")

    # Independent indicator proof (not using a distribution recurrence).
    q = Fraction(n-1, n)**d
    indicator_mean = n * (1-q)
    if n == 1:
        indicator_variance = q*(1-q)
    else:
        r = Fraction(n-2, n)**d
        indicator_variance = n*q*(1-q) + n*(n-1)*(r-q*q)
    if expected != indicator_mean or variance != indicator_variance:
        raise AssertionError("independent_indicator_moments_disagree")
    return {
        "n": n, "draws": d, "total": total, "counts": a,
        "expected": expected, "variance": variance,
        "mathematicalMethods": [
            "stirling_surjection_counts", "occupied_label_dynamic_program",
            "inclusion_exclusion", "indicator_moments",
            *([] if exhaustive is None else ["full_ordered_outcome_enumeration"]),
        ],
        "exhaustiveEnumerationUsed": exhaustive is not None,
    }


def exact_number(value):
    if not isinstance(value, str) or len(value) > 96:
        raise Unsupported("unsupported_answer_type_or_length")
    s = value.strip()
    fraction = re.fullmatch(r"([+-]?\d{1,40})/(\d{1,40})", s)
    if fraction:
        numerator, denominator = int(fraction[1]), int(fraction[2])
        if denominator == 0:
            raise Unsupported("division_by_zero")
        return Fraction(numerator, denominator)
    if re.fullmatch(r"[+-]?\d{1,40}(?:\.\d{1,40})?", s):
        try:
            return Fraction(Decimal(s))
        except (InvalidOperation, OverflowError) as exc:
            raise Unsupported("invalid_decimal") from exc
    raise Unsupported("ambiguous_or_non_numeric_answer")


def exact_query_value(work, query):
    if not isinstance(query, dict) or query.get("metric") not in METRICS:
        raise Unsupported("unknown_quantity_or_metric")
    metric = query["metric"]
    if metric in ("expected_value", "variance"):
        if set(query) != {"metric"}:
            raise Unsupported("irrelevant_or_missing_query_dimension")
        return work["expected"] if metric == "expected_value" else work["variance"]
    if set(query) != {"metric", "k"}:
        raise Unsupported("missing_or_extra_event_parameter")
    k = query["k"]
    if type(k) is not int or not 0 <= k <= work["n"] + 1:
        raise Unsupported("invalid_threshold")
    counts, total = work["counts"], work["total"]
    if metric == "probability_exact":
        numerator = counts.get(k, 0)
    elif metric == "probability_at_least":
        numerator = sum(c for j, c in counts.items() if j >= k)
    else:
        numerator = sum(c for j, c in counts.items() if j <= k)
    return Fraction(numerator, total)


def check_case(case, work_cache=None):
    ident = case.get("id") if isinstance(case, dict) else None
    if not isinstance(ident, str) or not ident or len(ident) > 128:
        raise ValueError("invalid_case_id")
    base = {"id": ident}
    try:
        n, d = parse_model(case.get("model"))
        key = (n,d)
        if work_cache is not None and key in work_cache:
            work = work_cache[key]
        else:
            work = proof(n,d)
            if work_cache is not None:
                work_cache[key] = work
        correct = exact_query_value(work, case.get("query"))
        try:
            candidate = exact_number(case.get("candidate"))
        except Unsupported as exc:
            return {**base, "status": "unverified", "reason": str(exc),
                    "exactReference": str(correct)}
        return {
            **base,
            "status": "verified_correct_under_typed_model" if candidate == correct
                      else "verified_incorrect_under_typed_model",
            "exactReference": str(correct),
            "normalizedCandidate": str(candidate),
            "sourceAuthenticatedOfficially": False,
            "proofMethods": work["mathematicalMethods"],
            "exhaustiveEnumerationUsed": work["exhaustiveEnumerationUsed"],
        }
    except Unsupported as exc:
        return {**base, "status": "unverified", "reason": str(exc),
                "sourceAuthenticatedOfficially": False}


def check_batch(document):
    if not isinstance(document, dict) or document.get("schemaVersion") != 1 or \
        document.get("id") != ID or document.get("status") != "research_only_typed_math_not_exam_gold":
        raise ValueError("unexpected_research_fixture")
    cases = document.get("cases")
    if not isinstance(cases, list) or not 1 <= len(cases) <= MAX_CASES:
        raise ValueError("unsupported_case_count")
    ids = [case.get("id") if isinstance(case, dict) else None for case in cases]
    if any(not isinstance(i,str) or not i or len(i)>128 for i in ids) or len(ids) != len(set(ids)):
        raise ValueError("missing_or_duplicated_case_id")
    cache = {}
    results = [check_case(case, cache) for case in cases]
    return {
        "status": "research_math_family_checked_not_official_gold",
        "scope": "Entire distribution, expectation, variance and threshold probabilities of bounded finite uniform independent draws with replacement; no natural-language parsing or official exam authentication",
        "summary": {
            "total": len(results),
            "verifiedCorrect": sum(r["status"] == "verified_correct_under_typed_model" for r in results),
            "verifiedIncorrect": sum(r["status"] == "verified_incorrect_under_typed_model" for r in results),
            "unverified": sum(r["status"] == "unverified" for r in results),
            "officialExamGoldReleased": 0,
            "distinctMathematicalModelsChecked": len(cache),
        },
        "items": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", default=str(Path(__file__).resolve().parents[2] /
        "fixtures/research/finite-occupancy-family-v0.1.json"))
    parser.add_argument("--require-decidable", action="store_true")
    args = parser.parse_args()
    document = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    result = check_batch(document)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return int(bool(args.require_decidable and result["summary"]["unverified"]))


if __name__ == "__main__":
    sys.exit(main())
