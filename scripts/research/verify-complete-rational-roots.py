#!/usr/bin/env python3
"""Bounded exact *complete solution set* checker for degree <=2 rational polynomials.

The program accepts a trusted structured equation, not raw exam language.
It does not validate transcription, derive a polynomial from original wording,
certify teaching behavior, or judge written proofs.
"""
import argparse
from fractions import Fraction
from math import isqrt
import json
import sys

BOUND = 10**6
MAX_ITEMS = 128
MAX_ANSWERS = 8


class OutOfScope(Exception):
    pass


def rational(node):
    if not isinstance(node, dict) or set(node) != {"num", "den"}:
        raise OutOfScope("unsupported_rational_representation")
    n, d = node["num"], node["den"]
    if isinstance(n, bool) or isinstance(d, bool) or not isinstance(n, int) or not isinstance(d, int):
        raise OutOfScope("rational_must_use_integers")
    if abs(n) > BOUND or not 1 <= d <= BOUND:
        raise OutOfScope("out_of_bounds_rational")
    return Fraction(n, d)


def exact_square_root(value):
    if value < 0:
        raise OutOfScope("negative_discriminant")
    n, d = isqrt(value.numerator), isqrt(value.denominator)
    if n * n != value.numerator or d * d != value.denominator:
        raise OutOfScope("irrational_root_not_supported")
    return Fraction(n, d)


def domain_filter(roots, spec):
    if not isinstance(spec, dict):
        raise OutOfScope("domain_missing")
    if spec == {"kind": "real"}:
        return roots
    if set(spec) != {"kind", "min", "max", "includeMin", "includeMax"} or spec["kind"] != "interval":
        raise OutOfScope("unsupported_domain")
    lo, hi = rational(spec["min"]), rational(spec["max"])
    inc_lo, inc_hi = spec["includeMin"], spec["includeMax"]
    if type(inc_lo) is not bool or type(inc_hi) is not bool or lo >= hi:
        raise OutOfScope("unsupported_interval_bounds")
    return {
        x for x in roots
        if (x > lo or (inc_lo and x == lo)) and
           (x < hi or (inc_hi and x == hi))
    }


def exact_roots(coefficients):
    if not isinstance(coefficients, dict) or set(coefficients) != {"a", "b", "c"}:
        raise OutOfScope("unsupported_polynomial")
    a, b, c = (rational(coefficients[k]) for k in ("a", "b", "c"))
    if a == 0:
        if b == 0:
            if c == 0:
                raise OutOfScope("infinitely_many_solutions")
            return set()
        return {-c/b}
    discriminant = b*b - 4*a*c
    if discriminant < 0:
        return set()
    rt = exact_square_root(discriminant)
    return {(-b + rt)/(2*a), (-b - rt)/(2*a)}


def render_fraction(q):
    return f"{q.numerator}/{q.denominator}" if q.denominator != 1 else str(q.numerator)


def verify_item(item):
    if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
        return {"id": None, "status": "unverified", "reason": "invalid_item"}
    base = {"id": item["id"]}
    if item.get("claimKind") != "all_real_roots":
        return {**base, "status": "unverified", "reason": "unsupported_claim_kind"}
    try:
        all_roots = exact_roots(item.get("coefficients"))
        expected = domain_filter(all_roots, item.get("domain"))
        raw = item.get("candidateRoots")
        if not isinstance(raw, list) or len(raw) > MAX_ANSWERS:
            raise OutOfScope("invalid_candidate_list")
        proposed_list = [rational(x) for x in raw]
        # The mathematical object is a set. Duplicate entries do not add roots.
        proposed = set(proposed_list)
        missing, extraneous = expected - proposed, proposed - expected
        if missing or extraneous:
            return {**base, "status": "refuted_solution_set",
                    "reason": "incomplete_or_extraneous_roots",
                    "missing": [render_fraction(x) for x in sorted(missing)],
                    "extraneous": [render_fraction(x) for x in sorted(extraneous)],
                    "candidateDuplicates": len(proposed_list)-len(proposed)}
        return {**base, "status": "verified_complete_solution_set",
                "reason": "exact_bounded_rational_polynomial_and_full_domain_set",
                "rootCount": len(expected),
                "candidateDuplicates": len(proposed_list)-len(proposed)}
    except (OutOfScope, ZeroDivisionError, OverflowError) as e:
        return {**base, "status": "unverified", "reason": e.args[0] if isinstance(e, OutOfScope)
                else "unsupported_arithmetic"}


def verify_batch(doc):
    if not isinstance(doc, dict) or doc.get("schemaVersion") != 1 or not isinstance(doc.get("items"), list):
        raise ValueError("invalid_fixture_schema")
    items=doc["items"]
    if not 1 <= len(items) <= MAX_ITEMS:
        raise ValueError("invalid_fixture_size")
    ids=[x.get("id") if isinstance(x, dict) else None for x in items]
    if any(not isinstance(i,str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError("invalid_or_duplicated_id")
    outcomes=[verify_item(x) for x in items]
    return {"status": "research_only_complete_root_set",
            "scope": "Exact rational polynomials of degree <=2 with bounded real intervals; not a natural-language equation grader or proof checker",
            "summary": {
                "total": len(outcomes),
                "verifiedComplete": sum(x["status"] == "verified_complete_solution_set" for x in outcomes),
                "refuted": sum(x["status"] == "refuted_solution_set" for x in outcomes),
                "unverified": sum(x["status"] == "unverified" for x in outcomes)
            }, "items": outcomes}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",required=True)
    parser.add_argument("--require-decidable", action="store_true")
    args=parser.parse_args()
    with open(args.fixture, encoding="utf-8") as f:
        result=verify_batch(json.load(f))
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return int(args.require_decidable and result["summary"]["unverified"] != 0)


if __name__ == "__main__":
    sys.exit(main())
