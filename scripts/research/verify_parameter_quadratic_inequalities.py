#!/usr/bin/env python3
"""Exact complete real solution sets for parameter-affine quadratic INEQUALITIES.

This extends the parent parameter-equation research by verifying every real
parameter t, not sampling a finite random set: critical roots of A,B,C,Delta
and candidate interval boundaries partition the full parameter axis into
sign-invariant open cells and checked singleton points. A second SymPy solver
rechecks each exact representative in the original unsimplified inequality.

Input is a bounded, typed math contract; no OCR/NLP, official exam gold,
arbitrary student expressions, external Judge or mandatory human review.
"""
import argparse
from functools import cmp_to_key
import json
from pathlib import Path
import sys

import sympy as S
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_parameter_quadratics as base

X, T = base.X, base.T
CONTRACT = "parameter-affine-quadratic-inequalities-v0.1"
OPERATORS = frozenset(("eq", "ne", "lt", "le", "gt", "ge"))
TEMPLATES = frozenset((
    "all_reals", "empty", "point", "two_points",
    "except_point", "except_two_points",
    "left_open", "left_closed", "right_open", "right_closed",
    "between_open", "between_closed", "outside_open", "outside_closed",
))


class Abstain(Exception):
    pass


def sign(v):
    return base.sign(v)


def truth(s, operator):
    return {"eq": s == 0, "ne": s != 0, "lt": s < 0,
            "le": s <= 0, "gt": s > 0, "ge": s >= 0}[operator]


def one_sided_template(direction, closed):
    return ("right_" if direction == "right" else "left_") + ("closed" if closed else "open")


def expected_kind(a, b, c, operator):
    """Classify complete real x-set using exact arithmetic at a fixed t."""
    aa, bb, cc = (S.simplify(i) for i in (a,b,c))
    if aa == 0:
        if bb == 0:
            return "all_reals" if truth(sign(cc), operator) else "empty"
        if operator == "eq":
            return "point"
        if operator == "ne":
            return "except_point"
        slope = sign(bb)
        greater = operator in ("gt","ge")
        direction = "right" if (slope > 0)==greater else "left"
        return one_sided_template(direction, operator in ("le","ge"))
    delta = S.simplify(bb*bb-4*aa*cc)
    dsign = sign(delta)
    leading = sign(aa)
    if dsign < 0:
        return "all_reals" if truth(leading, operator) else "empty"
    if dsign == 0:
        if operator == "eq": return "point"
        if operator == "ne": return "except_point"
        if truth(0, operator) and truth(leading, operator): return "all_reals"
        if truth(0, operator): return "point"
        if truth(leading, operator): return "except_point"
        return "empty"
    if operator == "eq": return "two_points"
    if operator == "ne": return "except_two_points"
    # Away from roots the polynomial has leading-sign outside, negative
    # leading-sign between. Include both roots only for weak comparisons.
    outside = truth(leading, operator)
    inside = truth(-leading, operator)
    if outside == inside:
        raise Abstain("unexpected_two_root_sign_classification")
    return ("outside_" if outside else "between_") + (
        "closed" if operator in ("le","ge") else "open")


def roots_at(a,b,c):
    if a == 0:
        if b == 0:
            raise Abstain("constant_polynomial_has_no_root_formula")
        return [S.simplify(-c/b)]
    delta=S.simplify(b*b-4*a*c)
    dsign=sign(delta)
    if dsign<0:
        return []
    if dsign==0:
        return [S.simplify(-b/(2*a))]
    sr=S.sqrt(delta)
    raw=[S.simplify((-b-sr)/(2*a)),S.simplify((-b+sr)/(2*a))]
    return raw if sign(a)>0 else raw[::-1]


def exact_template_set(kind,a,b,c):
    if kind=="all_reals": return S.S.Reals
    if kind=="empty": return S.EmptySet
    if kind not in TEMPLATES:
        raise Abstain("unexpected_solution_template")
    roots=roots_at(a,b,c)
    if kind in ("point","except_point","left_open","left_closed","right_open","right_closed"):
        if len(roots)!=1:
            raise Abstain("invalid_one_root_formula_at_parameter")
        root=roots[0]
        if kind=="point":return S.FiniteSet(root)
        if kind=="except_point":return S.S.Reals-S.FiniteSet(root)
        if kind=="left_open":return S.Interval(-S.oo,root,right_open=True)
        if kind=="left_closed":return S.Interval(-S.oo,root,right_open=False)
        if kind=="right_open":return S.Interval(root,S.oo,left_open=True)
        if kind=="right_closed":return S.Interval(root,S.oo,left_open=False)
    if len(roots)!=2:
        raise Abstain("invalid_two_roots_formula_at_parameter")
    lo,hi=roots
    if kind=="two_points":return S.FiniteSet(lo,hi)
    if kind=="except_two_points":return S.S.Reals-S.FiniteSet(lo,hi)
    if kind=="between_open":return S.Interval(lo,hi,left_open=True,right_open=True)
    if kind=="between_closed":return S.Interval(lo,hi,left_open=False,right_open=False)
    if kind=="outside_open":return S.Union(S.Interval(-S.oo,lo,right_open=True),S.Interval(hi,S.oo,left_open=True))
    if kind=="outside_closed":
        return S.Union(S.Interval(-S.oo,lo,right_open=False),
                       S.Interval(hi,S.oo,left_open=False))
    raise Abstain("unhandled_solution_template")


def independent_solver(a,b,c,operator):
    """Separate SymPy solver on the original expression at a fixed real t."""
    polynomial=S.Add(S.Mul(a,X*X,evaluate=False),
                     S.Mul(b,X,evaluate=False),c,evaluate=False)
    if operator=="eq": return S.solveset(S.Eq(polynomial,0,evaluate=False),X,domain=S.S.Reals)
    if operator=="ne":
        zero=S.solveset(S.Eq(polynomial,0,evaluate=False),X,domain=S.S.Reals)
        return S.S.Reals-zero
    relation={"lt":S.Lt,"le":S.Le,"gt":S.Gt,"ge":S.Ge}[operator](polynomial,0,evaluate=False)
    return solve_univariate_inequality(relation,X,relational=False,domain=S.S.Reals)


def boundaries_of_set(val):
    if val in (S.S.Reals,S.EmptySet):return []
    if isinstance(val,S.Interval):
        return [a for a in (val.start,val.end) if a not in (-S.oo,S.oo)]
    if isinstance(val,S.FiniteSet):return list(val)
    if isinstance(val,(S.Union,S.Intersection)):
        return [v for arg in val.args for v in boundaries_of_set(arg)]
    if isinstance(val,S.Complement):
        return boundaries_of_set(val.args[0])+boundaries_of_set(val.args[1])
    raise Abstain("unsupported_independent_solver_set")


def in_set(val,p):
    found=val.contains(p)
    if found==S.true:return True
    if found==S.false:return False
    raise Abstain("set_membership_not_exactly_decidable")


def equal_sets(a,b):
    if a==b:return True,None
    critical=sorted(set(boundaries_of_set(a)+boundaries_of_set(b)),
                    key=cmp_to_key(base.compare))
    samples=critical[:]
    # Exact midpoint cells; algebraic endpoints stay algebraic.
    edges=[-S.oo,*critical,S.oo]
    for u,v in zip(edges,edges[1:]):
        if u==-S.oo and v==S.oo:probe=S.Integer(0)
        elif u==-S.oo:probe=S.floor(v)-1
        elif v==S.oo:probe=S.ceiling(u)+1
        else:probe=S.simplify((u+v)/2)
        samples.append(probe)
    for probe in samples:
        if in_set(a,probe)!=in_set(b,probe):
            return False,probe
    return True,None


def compare_claim(claim):
    ident=claim.get("id") if isinstance(claim,dict) else None
    if not isinstance(ident,str) or not ident or len(ident)>128:
        return {"id":None,"status":"unverified","reason":"invalid_claim_identity",
                "officialExamGoldCertified":False}
    base_result={"id":ident,"officialExamGoldCertified":False}
    try:
        if set(claim).difference({"id","equation","comparison","parameterBranches","expectedStatus"}):
            raise Abstain("unrecognized_claim_fields")
        operator=claim.get("comparison")
        if operator not in OPERATORS:raise Abstain("unsupported_comparison")
        A,B,C=base.read_model(claim.get("equation"))
        branches=claim.get("parameterBranches")
        if not isinstance(branches,list) or not 1<=len(branches)<=32:
            raise Abstain("missing_or_too_many_parameter_branches")
        parsed=[]
        for br in branches:
            if not isinstance(br,dict) or set(br)!={"when","solution"}:
                raise Abstain("malformed_parameter_branch")
            descriptor=br["solution"]
            if not isinstance(descriptor,dict) or set(descriptor)!={"kind"} or descriptor["kind"] not in TEMPLATES:
                raise Abstain("unsupported_complete_solution_template")
            parsed.append((base.parse_section(br["when"]),descriptor["kind"]))
        delta=S.expand(B*B-4*A*C)
        critical=set()
        for poly in (A,B,C,delta):
            critical.update(base.polynomial_roots(poly))
        for region,_ in parsed:
            if isinstance(region,S.Interval):
                for point in (region.start,region.end):
                    if point not in (-S.oo,S.oo):critical.add(point)
            else:
                critical.update(region)
        points=sorted(critical,key=cmp_to_key(base.compare))
        spans=[-S.oo,*points,S.oo]
        probes=[*points,*[base.point_between(lo,hi) for lo,hi in zip(spans,spans[1:])]]
        for probe in probes:
            selected=[template for region,template in parsed if base.member(region,probe)]
            if len(selected)!=1:
                return {**base_result,"status":"refuted_parameter_solution_family",
                        "reason":"incomplete_or_overlapping_parameter_partition",
                        "parameterWitness":str(probe),"matchingBranches":len(selected)}
            a,b,c=(S.simplify(p.subs(T,probe)) for p in (A,B,C))
            correct=expected_kind(a,b,c,operator)
            reference=exact_template_set(correct,a,b,c)
            try:
                independent=independent_solver(a,b,c,operator)
                agree,witness=equal_sets(reference,independent)
            except (ValueError,TypeError,NotImplementedError,RuntimeError) as exc:
                raise Abstain("independent_inequality_solver_unsupported") from exc
            if not agree:
                raise Abstain("independent_inequality_solver_disagrees_at_"+str(probe)+
                              "_x_"+str(witness))
            if selected[0]!=correct:
                return {**base_result,"status":"refuted_parameter_solution_family",
                        "reason":"wrong_complete_inequality_solution_template",
                        "parameterWitness":str(probe),
                        "expectedSolutionTemplate":correct,
                        "submittedSolutionTemplate":selected[0],
                        "expectedRealSetAtWitness":str(reference)}
        return {**base_result,"status":"verified_complete_parameter_solution_family",
                "criticalParameters":[str(x) for x in points],
                "exactParameterCellChecks":len(probes),
                "reason":"all_A_B_C_discriminant_critical_points_and_full_parameter_cells_checked_with_original_inequality_solver",
                "answerSemantics":"Every template expands to the exact complete x solution set at every real parameter in its section."}
    except (Abstain,base.Abstain,ValueError,TypeError,NotImplementedError,RecursionError,ZeroDivisionError) as exc:
        return {**base_result,"status":"unverified",
                "reason":str(exc) if isinstance(exc,(Abstain,base.Abstain))
                         else "symbolic_inequality_outside_supported_scope"}


def check_batch(data):
    if (not isinstance(data,dict) or data.get("schemaVersion")!=1 or
        data.get("id")!=CONTRACT or data.get("status")!="research_only_no_official_exam_gold"):
        raise ValueError("invalid_inequality_research_contract")
    cases=data.get("cases")
    if not isinstance(cases,list) or not 1<=len(cases)<=128:
        raise ValueError("unsupported_case_collection")
    ids=[v.get("id") if isinstance(v,dict) else None for v in cases]
    if any(not isinstance(v,str) or not v for v in ids) or len(set(ids))!=len(ids):
        raise ValueError("missing_or_duplicate_case_id")
    result=[compare_claim(x) for x in cases]
    return {
        "status":"research_exact_parameter_quadratic_inequality_sets_no_exam_gold",
        "scope":"All real t, real x solutions to quadratic polynomial comparisons with rational coefficients affine in t and exact canonical solution-template partitions; no natural language, arbitrary proofs or authenticated official exam answers.",
        "summary":{"total":len(result),
                   "verifiedComplete":sum(x["status"]=="verified_complete_parameter_solution_family" for x in result),
                   "refuted":sum(x["status"]=="refuted_parameter_solution_family" for x in result),
                   "unverified":sum(x["status"]=="unverified" for x in result),
                   "officialExamGoldReleased":0},
        "items":result,
    }


def main():
    arg=argparse.ArgumentParser()
    arg.add_argument("--fixture",required=True)
    arg.add_argument("--require-decidable",action="store_true")
    args=arg.parse_args()
    with open(args.fixture,encoding="utf8") as f: data=json.load(f)
    result=check_batch(data)
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return int(bool(args.require_decidable and result["summary"]["unverified"]))


if __name__=="__main__":
    sys.exit(main())
