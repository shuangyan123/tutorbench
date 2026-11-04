#!/usr/bin/env python3
"""Bounded exact parameter partition: a moving line against a fixed circle.

Circle (x-h)^2+(y-k)^2=R, line a*x+b*y+c0+c1*t=0.
For t in all reals, return exactly those t with 0, 1, or 2 distinct real
intersection points. An analytic interval proof is crosschecked against
an independently generated univariate polynomial sign chart.
"""
import sympy as S
import verify_circle_line_intersections as circle
import verify_quadratic_signsets as sets

T=S.Symbol("t", real=True)
MODEL_CIRCLE={"centerX","centerY","radiusSquared"}
MODEL_LINE={"a","b","baseC","parameterC"}
KINDS={0:"lt",1:"eq",2:"gt"}


class Unsupported(Exception):
    pass


def parse_question(question):
    if (not isinstance(question,dict) or
        set(question)!={"kind","circle","line","query"} or
        question.get("kind")!="parametric_circle_line_intersection_count"):
        raise Unsupported("invalid_parametric_circle_line_question")
    disk=question["circle"]
    line=question["line"]
    query=question["query"]
    if not isinstance(disk,dict) or set(disk)!=MODEL_CIRCLE:
        raise Unsupported("invalid_parametric_circle")
    if not isinstance(line,dict) or set(line)!=MODEL_LINE:
        raise Unsupported("invalid_parametric_line")
    if (not isinstance(query,dict) or set(query)!={"intersectionCount"} or
        type(query["intersectionCount"]) is not int or query["intersectionCount"] not in KINDS):
        raise Unsupported("invalid_intersection_count_metric")
    try:
        h=circle.rational_text(disk["centerX"])
        k=circle.rational_text(disk["centerY"])
        r2=circle.rational_text(disk["radiusSquared"])
        a=circle.rational_text(line["a"])
        b=circle.rational_text(line["b"])
        c0=circle.rational_text(line["baseC"])
        c1=circle.rational_text(line["parameterC"])
    except circle.Unsupported as error:
        raise Unsupported("parameter_coefficient_"+str(error)) from error
    if r2<0:
        raise Unsupported("negative_squared_radius")
    if a==0 and b==0:
        raise Unsupported("line_normal_cannot_be_zero")
    return h,k,r2,a,b,c0,c1,query["intersectionCount"]


def analytic_partition(h,k,r2,a,b,c0,c1,count):
    """Derive the complete set directly from signed distance to circle."""
    normal2=a*a+b*b
    signed0=a*h+b*k+c0
    if c1==0:
        gap=r2*normal2-signed0**2
        actual=0 if gap<0 else 1 if gap==0 else 2
        return S.S.Reals if actual==count else S.EmptySet
    center=-signed0/c1
    if r2==0:
        if count==2:
            return S.EmptySet
        root=S.FiniteSet(center)
        return root if count==1 else S.S.Reals-root
    offset=S.sqrt(r2*normal2)/S.Abs(c1)
    lo=S.simplify(center-offset)
    hi=S.simplify(center+offset)
    if count==0:
        return S.Union(S.Interval.open(-S.oo,lo),S.Interval.open(hi,S.oo))
    if count==1:
        return S.FiniteSet(lo,hi)
    return S.Interval.open(lo,hi)


def polynomial_partition(h,k,r2,a,b,c0,c1,count):
    """Independent polynomial sign chart; does not call analytic_partition."""
    # The existing exact sign-cell engine solves roots in its own X symbol.
    # Build this independent polynomial on that same symbol, otherwise its
    # roots_poly() would silently solve for x in an expression containing t.
    x=sets.X
    expression=S.expand(r2*(a*a+b*b)-(a*h+b*k+c0+c1*x)**2)
    poly=S.Poly(expression,x,domain=S.QQ)
    # Reuse the exact sign-cell partition engine at a separate abstraction.
    # Its degree bound is not inferred from untrusted input.
    try:
        return sets.signchart_set(poly,S.Poly(1,T,domain=S.QQ),KINDS[count])
    except sets.Abstain as error:
        raise Unsupported("signchart_"+str(error)) from error


def solve_question(question):
    h,k,r2,a,b,c0,c1,count=parse_question(question)
    direct=analytic_partition(h,k,r2,a,b,c0,c1,count)
    other=polynomial_partition(h,k,r2,a,b,c0,c1,count)
    try:
        equal,witness=sets.compare_sets(direct,other)
    except (sets.Abstain,ValueError,NotImplementedError,TypeError) as error:
        raise Unsupported("set_crosscheck_undecidable") from error
    if not equal:
        raise Unsupported("geometric_and_polynomial_signchart_disagree_at_"+str(witness))
    return {
        "kind":"parametric_circle_line_intersection_count",
        "exactAnswer":str(direct),
        "value":direct,
        "mathematicalMethods":[
            "exact_center_distance_parameter_interval_partition",
            "independent_quadratic_polynomial_sign_cell_partition",
            "exact_real_set_equality_with_boundary_witness",
        ],
        "proofType":"complete_real_parameter_partition_for_bounded_fixed_circle_moving_line",
        "mathValidated":True,
    }


def verify_candidate(derived,candidate):
    try:
        proposed=sets.typed_set(candidate)
        equal,witness=sets.compare_sets(derived["value"],proposed)
    except (sets.Abstain,ValueError,TypeError,NotImplementedError,RecursionError) as error:
        raise Unsupported("typed_parameter_set_unsupported") from error
    return equal,str(proposed),None if witness is None else str(witness)
