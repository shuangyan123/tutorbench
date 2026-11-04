#!/usr/bin/env python3
"""Bounded exact verifier for finite arithmetic-geometric sequence sums.

For k=0,...,n-1 the term is (firstTerm+k*commonDifference)*commonRatio**k.
Two independently implemented exact rational computations must agree. The
model is caller-supplied: no natural-language parsing, exam provenance or
official answer authentication is implied by a correct mathematics certificate.
"""
from fractions import Fraction
import re

MAX_TERMS=128
MAX_COEFFICIENT=1_000_000
MAX_CANDIDATE_CHARS=4096
MODEL_FIELDS={"firstTerm","commonDifference","commonRatio","termCount"}
NUMBER=re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]+)?|[0-9]+/[0-9]+)",re.ASCII)


class Unsupported(Exception):
    pass


def exact_number(value, *, coefficient=False):
    if not isinstance(value,str) or not value or len(value)>(64 if coefficient else MAX_CANDIDATE_CHARS):
        raise Unsupported("numeric_text_required_and_bounded")
    value=value.strip()
    if not NUMBER.fullmatch(value):
        raise Unsupported("not_one_exact_rational_or_finite_decimal")
    try:
        if coefficient:
            # Bound unreduced components, not merely the simplified Fraction.
            for component in re.split(r"[/\.]",value.lstrip("+-")):
                if int(component)>MAX_COEFFICIENT:
                    raise Unsupported("coefficient_outside_supported_bound")
        result=Fraction(value)
    except (ValueError,ZeroDivisionError,OverflowError) as exc:
        raise Unsupported("invalid_exact_number") from exc
    if coefficient and (abs(result.numerator)>MAX_COEFFICIENT or
                        result.denominator>MAX_COEFFICIENT):
        raise Unsupported("coefficient_outside_supported_bound")
    return result


def parse_question(question):
    if not isinstance(question,dict) or set(question)!={"kind","model","query"}:
        raise Unsupported("invalid_arithmetic_geometric_question_fields")
    if question["kind"]!="finite_arithmetic_geometric_sum":
        raise Unsupported("invalid_arithmetic_geometric_kind")
    if question["query"]!={"metric":"sum"}:
        raise Unsupported("only_finite_sum_metric_supported")
    model=question["model"]
    if not isinstance(model,dict) or set(model)!=MODEL_FIELDS:
        raise Unsupported("invalid_arithmetic_geometric_model_fields")
    n=model["termCount"]
    if type(n) is not int or not 0<=n<=MAX_TERMS:
        raise Unsupported("term_count_outside_supported_bound")
    a=exact_number(model["firstTerm"],coefficient=True)
    d=exact_number(model["commonDifference"],coefficient=True)
    r=exact_number(model["commonRatio"],coefficient=True)
    return a,d,r,n


def iterative_sum(a,d,r,n):
    """Independent exact term-by-term sum using recurrence-updated factors."""
    total=Fraction(0)
    term_coefficient=a
    power=Fraction(1)
    for _ in range(n):
        total+=term_coefficient*power
        term_coefficient+=d
        power*=r
    return total


def closed_form_sum(a,d,r,n):
    """Separate finite geometric and differentiated geometric closed forms."""
    if n==0:
        return Fraction(0)
    if r==1:
        return a*n+d*Fraction(n*(n-1),2)
    denominator=1-r
    geometric=(1-r**n)/denominator
    weighted=(r-n*r**n+(n-1)*r**(n+1))/(denominator**2)
    return a*geometric+d*weighted


def solve_question(question):
    a,d,r,n=parse_question(question)
    iterative=iterative_sum(a,d,r,n)
    algebraic=closed_form_sum(a,d,r,n)
    if iterative!=algebraic:
        raise Unsupported("independent_sum_methods_disagree")
    return {
        "kind":"finite_arithmetic_geometric_sum",
        "exactAnswer":str(iterative),
        "value":iterative,
        "mathematicalMethods":[
            "exact_rational_iterative_term_accumulation",
            "independent_finite_geometric_and_weighted_series_closed_form",
        ],
        "proofType":"bounded_exact_finite_arithmetic_geometric_sum_crosscheck",
        "mathValidated":True,
    }
