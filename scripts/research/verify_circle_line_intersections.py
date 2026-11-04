#!/usr/bin/env python3
"""Exact bounded circle-line intersection point sets with independent crosschecks.

Circle (x-h)^2 + (y-k)^2 = radiusSquared, line a*x+b*y+c=0.
This solves only a caller-provided typed problem, not a scanned exam question.
No model answer, source key, LLM call or published claim enters derivation.
"""
from fractions import Fraction
import re

import sympy as S

MAX_COEFFICIENT_COMPONENT=1000000
MAX_RADICAND_COMPONENT=1000000000000
MAX_FIELD_LENGTH=64
MAX_POINTS=2
NUMBER=re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]+)?|[0-9]+/[0-9]+)",re.ASCII)
CIRCLE_FIELDS={"centerX","centerY","radiusSquared"}
LINE_FIELDS={"a","b","c"}


class Unsupported(Exception):
    pass


def rational_text(value, *, radical=False):
    """Parse a bounded EXACT rational; never interpret floats or expressions."""
    if not isinstance(value,str) or not value or len(value)>MAX_FIELD_LENGTH or not NUMBER.fullmatch(value):
        raise Unsupported("bounded_exact_rational_text_required")
    limit=MAX_RADICAND_COMPONENT if radical else MAX_COEFFICIENT_COMPONENT
    components=re.split(r"[/\.]",value.lstrip("+-"))
    if any(int(p)>limit for p in components):
        raise Unsupported("numeric_component_outside_supported_bound")
    try:
        number=Fraction(value)
    except (ValueError,ZeroDivisionError,OverflowError) as error:
        raise Unsupported("invalid_exact_rational") from error
    if abs(number.numerator)>limit or number.denominator>limit:
        raise Unsupported("normalized_component_outside_supported_bound")
    return S.Rational(number.numerator,number.denominator)


def parse_question(question):
    if (not isinstance(question,dict) or
        set(question)!={"kind","circle","line"} or
        question["kind"]!="circle_line_intersections"):
        raise Unsupported("invalid_circle_line_question_fields")
    circle=question["circle"]
    line=question["line"]
    if not isinstance(circle,dict) or set(circle)!=CIRCLE_FIELDS:
        raise Unsupported("invalid_circle_fields")
    if not isinstance(line,dict) or set(line)!=LINE_FIELDS:
        raise Unsupported("invalid_line_fields")
    h=rational_text(circle["centerX"])
    k=rational_text(circle["centerY"])
    radius2=rational_text(circle["radiusSquared"])
    a=rational_text(line["a"])
    b=rational_text(line["b"])
    c=rational_text(line["c"])
    if radius2<0:
        raise Unsupported("negative_squared_radius")
    if a==0 and b==0:
        raise Unsupported("line_normal_cannot_be_zero")
    return h,k,radius2,a,b,c


def coincident(first,second):
    return (S.simplify(first[0]-second[0])==0 and
            S.simplify(first[1]-second[1])==0)


def same_point_sets(lhs,rhs):
    """A bijection of exact 0/1/2-point sets, independent of input ordering."""
    if len(lhs)!=len(rhs):
        return False
    unused=list(rhs)
    for point in lhs:
        index=next((i for i,candidate in enumerate(unused)
                    if coincident(point,candidate)),None)
        if index is None:
            return False
        unused.pop(index)
    return not unused


def geometric_points(h,k,radius2,a,b,c):
    """Normal projection onto a line and exact perpendicular offsets."""
    normal2=a*a+b*b
    signed=a*h+b*k+c
    gap=radius2*normal2-signed*signed
    foot=(h-a*signed/normal2,k-b*signed/normal2)
    if gap<0:
        return []
    if gap==0:
        return [foot]
    root=S.sqrt(gap)/normal2
    return [(foot[0]-b*root,foot[1]+a*root),
            (foot[0]+b*root,foot[1]-a*root)]


def elimination_points(h,k,radius2,a,b,c):
    """Solve a different polynomial: eliminate y when b != 0, else fix x."""
    if b!=0:
        # After substituting y=-(a*x+c)/b and multiplying by b**2:
        # (a**2+b**2)*x**2 +
        # (-2*b**2*h + 2*a*(c+b*k))*x +
        # b**2*h**2+(c+b*k)**2-radius2*b**2 = 0.
        qa=a*a+b*b
        qb=-2*b*b*h+2*a*(c+b*k)
        qc=b*b*h*h+(c+b*k)**2-radius2*b*b
        discriminant=qb*qb-4*qa*qc
        if discriminant<0:
            return []
        roots=[-qb/(2*qa)] if discriminant==0 else [
            (-qb+S.sqrt(discriminant))/(2*qa),
            (-qb-S.sqrt(discriminant))/(2*qa),
        ]
        return [(x,S.simplify(-(a*x+c)/b)) for x in roots]
    x=-c/a
    square=radius2-(x-h)**2
    if square<0:
        return []
    if square==0:
        return [(x,k)]
    return [(x,k+S.sqrt(square)),(x,k-S.sqrt(square))]


def validate_original_equations(points,h,k,radius2,a,b,c):
    for x,y in points:
        if (S.simplify(a*x+b*y+c)!=0 or
            S.simplify((x-h)**2+(y-k)**2-radius2)!=0):
            raise Unsupported("candidate_from_solver_fails_original_equations")


def canonical_points(points):
    normalized=sorted(((S.simplify(x),S.simplify(y)) for x,y in points),
                      key=lambda pair:(S.default_sort_key(pair[0]),S.default_sort_key(pair[1])))
    return tuple(normalized)


def display_points(points):
    if not points:
        return "EmptySet"
    return "FiniteSet("+"; ".join("("+str(x)+", "+str(y)+")" for x,y in points)+")"


def solve_question(question):
    h,k,radius2,a,b,c=parse_question(question)
    geometric=geometric_points(h,k,radius2,a,b,c)
    elimination=elimination_points(h,k,radius2,a,b,c)
    validate_original_equations(geometric,h,k,radius2,a,b,c)
    validate_original_equations(elimination,h,k,radius2,a,b,c)
    if not same_point_sets(geometric,elimination):
        raise Unsupported("independent_geometric_and_elimination_methods_disagree")
    points=canonical_points(geometric)
    if len(points)!=len(geometric):
        raise Unsupported("nonunique_intersection_points")
    return {
        "kind":"circle_line_intersections",
        "exactAnswer":display_points(points),
        "value":points,
        "intersectionCount":len(points),
        "mathematicalMethods":[
            "exact_normal_projection_and_perpendicular_offset",
            "independent_univariate_quadratic_elimination",
            "substitution_into_both_original_equations",
        ],
        "proofType":"complete_bounded_circle_line_intersection_point_set",
        "mathValidated":True,
    }


def parse_coordinate(node):
    if not isinstance(node,dict):
        raise Unsupported("typed_coordinate_required")
    if set(node)=={"kind","value"} and node.get("kind")=="rational":
        return rational_text(node["value"])
    if (set(node)=={"kind","offset","coefficient","radicand"} and
        node.get("kind")=="affine_sqrt"):
        offset=rational_text(node["offset"])
        coefficient=rational_text(node["coefficient"])
        radicand=rational_text(node["radicand"],radical=True)
        if radicand<0:
            raise Unsupported("negative_coordinate_radicand")
        return S.simplify(offset+coefficient*S.sqrt(radicand))
    raise Unsupported("unsupported_typed_coordinate")


def parse_candidate(candidate):
    if not isinstance(candidate,dict) or set(candidate)!={"kind","points"} or candidate.get("kind")!="point_set":
        raise Unsupported("typed_point_set_required")
    rows=candidate["points"]
    if not isinstance(rows,list) or len(rows)>MAX_POINTS:
        raise Unsupported("candidate_point_count_unsupported")
    points=[]
    for row in rows:
        if not isinstance(row,dict) or set(row)!={"x","y"}:
            raise Unsupported("invalid_candidate_point")
        point=(parse_coordinate(row["x"]),parse_coordinate(row["y"]))
        if any(coincident(point,old) for old in points):
            raise Unsupported("duplicate_candidate_point")
        points.append(point)
    return canonical_points(points)


def verify_candidate(derived,candidate):
    proposed=parse_candidate(candidate)
    expected=derived["value"]
    matched=same_point_sets(expected,proposed)
    witness=None if matched else (
        f"expected_{len(expected)}_points_vs_{len(proposed)}_points"
        if len(expected)!=len(proposed) else "exact_point_coordinates_differ"
    )
    return matched,display_points(proposed),witness
