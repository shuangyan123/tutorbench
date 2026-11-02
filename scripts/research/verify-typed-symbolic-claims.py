#!/usr/bin/env python3
"""Research-only bounded symbolic answer comparator.

Input is a restricted JSON expression tree, NOT arbitrary SymPy/Python source.
Success is only symbolic consistency for a correctly formalized mathematical
claim; no exam text parsing, proof grading, source gold, or pedagogy.
"""
import argparse
import json
import sys
import sympy as sp
from sympy.calculus.util import continuous_domain

MAX_NODES = 64
MAX_DEPTH = 10
INT_BOUND = 10**6
WITNESSES = [-3, -2, -1, sp.Rational(-1, 2), 0,
             sp.Rational(1, 2), 1, 2, 3]
SYMBOL = sp.Symbol("x", real=True)


class Unsupported(Exception):
    pass


def bounded_int(value):
    if isinstance(value, bool) or not isinstance(value, int) or abs(value) > INT_BOUND:
        raise Unsupported("invalid_integer")
    return value


def parse_tree(tree, budget, depth=0):
    if depth > MAX_DEPTH or budget[0] >= MAX_NODES:
        raise Unsupported("expression_too_large")
    budget[0] += 1
    if not isinstance(tree, dict) or not isinstance(tree.get("op"), str):
        raise Unsupported("not_an_expression")
    op = tree["op"]
    if op == "int":
        return sp.Integer(bounded_int(tree.get("value")))
    if op == "rat":
        num = bounded_int(tree.get("num"))
        den = bounded_int(tree.get("den"))
        if den == 0:
            raise Unsupported("zero_denominator")
        return sp.Rational(num, den)
    if op == "symbol" and tree.get("name") == "x":
        return SYMBOL
    if op == "const" and tree.get("name") == "pi":
        return sp.pi
    if op in ("add", "mul"):
        args = tree.get("args")
        if not isinstance(args, list) or not 2 <= len(args) <= 8:
            raise Unsupported("invalid_arity")
        parts = [parse_tree(x, budget, depth+1) for x in args]
        if op == "add":
            return sp.Add(*parts, evaluate=False)
        return sp.Mul(*parts, evaluate=False)
    if op == "pow":
        exponent = bounded_int(tree.get("exponent"))
        if not -8 <= exponent <= 8:
            raise Unsupported("unsupported_exponent")
        return sp.Pow(parse_tree(tree.get("base"), budget, depth+1),
                      exponent, evaluate=False)
    if op in ("sqrt", "sin", "cos", "log", "exp"):
        arg = parse_tree(tree.get("arg"), budget, depth+1)
        if op == "sqrt":
            return sp.Pow(arg, sp.Rational(1, 2), evaluate=False)
        return getattr(sp, op)(arg, evaluate=False)
    raise Unsupported("unsupported_operator")


def status(value, reason, **extra):
    return {"status": value, "reason": reason, **extra}


def verify_one(item):
    if not isinstance(item, dict) or not isinstance(item.get("id"), str):
        return status("unverified", "invalid_item")
    base = {"id": item["id"]}
    try:
        budget = [0]
        expected = parse_tree(item.get("expected"), budget)
        candidate = parse_tree(item.get("candidate"), budget)
        if not expected.free_symbols.issubset({SYMBOL}) or not candidate.free_symbols.issubset({SYMBOL}):
            raise Unsupported("unknown_symbol")
        if not (expected.free_symbols or candidate.free_symbols):
            if sp.simplify(expected).is_real is not True or sp.simplify(candidate).is_real is not True:
                raise Unsupported("complex_or_undetermined_numeric_domain")
            domain1 = domain2 = sp.S.Reals
        else:
            domain1 = continuous_domain(expected, SYMBOL, sp.S.Reals)
            domain2 = continuous_domain(candidate, SYMBOL, sp.S.Reals)
        domains_equal = (domain1 == domain2 or
                         (domain1.is_subset(domain2) is True and
                          domain2.is_subset(domain1) is True))
        if domains_equal is not True:
            return {**base, **status("unverified", "domain_not_proven_equal")}
        difference = sp.simplify(expected - candidate)
        if difference == 0:
            return {**base, **status("symbolically_equal", "exact_symbolic_identity_and_matching_real_domains")}
        if not (expected.free_symbols or candidate.free_symbols):
            if difference.is_zero is False:
                return {**base, **status("counterexample_found", "exact_nonzero_constant_difference")}
            return {**base, **status("unverified", "constant_difference_undecidable")}
        for value in WITNESSES:
            point = sp.sympify(value)
            if domain1.contains(point) is not sp.S.true:
                continue
            delta = sp.simplify(difference.subs(SYMBOL, point))
            if delta.is_real is True and delta.is_zero is False:
                return {**base, **status("counterexample_found", "exact_in_domain_witness",
                                        witness=str(point))}
        return {**base, **status("unverified", "no_exact_identity_or_counterexample")}
    except (Unsupported, ValueError, TypeError, NotImplementedError, RecursionError, ZeroDivisionError) as exc:
        return {**base, **status("unverified", exc.args[0] if isinstance(exc, Unsupported) else "unsupported_domain_or_expression")}


def verify_batch(data):
    if not isinstance(data, dict) or data.get("schemaVersion") != 1 or not isinstance(data.get("items"), list):
        raise ValueError("invalid research fixture")
    if not 1 <= len(data["items"]) <= 128:
        raise ValueError("unsupported fixture size")
    ids = [x.get("id") if isinstance(x, dict) else None for x in data["items"]]
    if None in ids or len(ids) != len(set(ids)):
        raise ValueError("missing or repeated item ID")
    results = [verify_one(x) for x in data["items"]]
    return {
        "status": "research_only_typed_symbolic",
        "scope": "Structured expressions, exact symbolic consistency and bounded counterexamples only; no natural-language or official-key certification",
        "sympyVersion": sp.__version__,
        "summary": {
            "total": len(results),
            "symbolicallyEqual": sum(x["status"] == "symbolically_equal" for x in results),
            "counterexamples": sum(x["status"] == "counterexample_found" for x in results),
            "unverified": sum(x["status"] == "unverified" for x in results),
        },
        "items": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", required=True)
    parser.add_argument("--require-decidable", action="store_true")
    args = parser.parse_args()
    with open(args.fixture, encoding="utf-8") as handle:
        result = verify_batch(json.load(handle))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if args.require_decidable and result["summary"]["unverified"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
