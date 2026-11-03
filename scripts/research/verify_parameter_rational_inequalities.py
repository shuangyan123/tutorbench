#!/usr/bin/env python3
"""Complete exact x-solution sets for all real t in bounded parameter-rational relations.

N(t,x)/D(t,x) □ 0, with N=A(t)x+B(t), D=C(t)x+E(t), each
parameter coefficient affine rational. Only explicit typed mathematical claims.
Any original denominator zero remains forbidden, including cancelled factors.
"""
import argparse
from functools import cmp_to_key
import json
from pathlib import Path
import sys

import sympy as S
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0,str(Path(__file__).resolve().parent))
import verify_parameter_quadratics as base

T,X=base.T,base.X
CONTRACT="parameter-rational-linear-fractions-v0.1"
OPERATORS=frozenset(("eq","ne","lt","le","gt","ge"))


class Abstain(Exception):
    pass


class UndefinedCandidateAtParameter(Exception):
    pass


def model_coefficients(model):
    if not isinstance(model,dict) or set(model)!={"numerator","denominator"}:
        raise Abstain("invalid_fraction_model")
    for key in ("numerator","denominator"):
        row=model[key]
        if not isinstance(row,dict) or set(row)!={"slope","constant"}:
            raise Abstain("invalid_affine_x_coefficients")
    try:
        return tuple(base.affine(model[part][field])
                     for part,field in (("numerator","slope"),("numerator","constant"),
                                        ("denominator","slope"),("denominator","constant")))
    except base.Abstain as e:
        raise Abstain(str(e)) from e


def sign(v):
    return base.sign(v)


def holds(v,op):
    return {"eq":v==0,"ne":v!=0,"lt":v<0,"le":v<=0,
            "gt":v>0,"ge":v>=0}[op]


def xzero(slope,constant):
    if slope==0:
        return None
    return S.simplify(-constant/slope)


def xbreaks(a,b,c,d):
    zero=xzero(a,b)
    pole=xzero(c,d)
    values=[v for v in (zero,pole) if v is not None]
    return sorted(set(values),key=cmp_to_key(base.compare)),zero,pole


def in_domain(a,b,c,d,point):
    return S.simplify(c*point+d)!=0


def x_cell_probe(lo,hi):
    # Exact algebraic midpoint for x-cells; rational-only t probes remain
    # handled by the parent all-parameter classifier.
    if lo==-S.oo and hi==S.oo:return S.Integer(0)
    if lo==-S.oo:return S.floor(hi)-1
    if hi==S.oo:return S.ceiling(lo)+1
    return S.simplify((lo+hi)/2)


def exact_signchart(a,b,c,d,op):
    """Independent sign-cell construction on the ORIGINAL numerator/denominator."""
    if c==0 and d==0:
        return S.EmptySet
    boundaries,_,pole=xbreaks(a,b,c,d)
    edges=[-S.oo,*boundaries,S.oo]
    parts=[]
    for lo,hi in zip(edges,edges[1:]):
        x=x_cell_probe(lo,hi)
        nval=S.simplify(a*x+b)
        dval=S.simplify(c*x+d)
        if dval==0:
            raise Abstain("interior_probe_lands_on_original_pole")
        ss=0 if nval==0 else sign(nval)*sign(dval)
        if holds(ss,op):
            parts.append(S.Interval(lo,hi,left_open=True,right_open=True))
    for x in boundaries:
        den=S.simplify(c*x+d)
        if den==0:
            continue
        nval=S.simplify(a*x+b)
        ss=0 if nval==0 else sign(nval)*sign(den)
        if holds(ss,op):
            parts.append(S.FiniteSet(x))
    return S.Union(*parts) if parts else S.EmptySet


def original_solver(a,b,c,d,op):
    """Independent exact reduction by multiplication with D(x)^2 > 0.

    On the original domain D!=0, N/D □ 0 iff N*D □ 0. For equality and
    disequality it is enough to solve N=0, and always remove the ORIGINAL
    denominator poles. Unlike solving a rational expression directly, this
    avoids SymPy's duplicate algebraic-root sorting failures at t-surds.
    """
    if c==0 and d==0:
        return S.EmptySet
    numerator=S.expand(a*X+b)
    denominator=S.expand(c*X+d)
    pole=xzero(c,d)
    valid=S.S.Reals if pole is None else S.S.Reals-S.FiniteSet(pole)
    if op=="eq":
        roots=S.solveset(S.Eq(numerator,0,evaluate=False),X,domain=S.S.Reals)
        return roots.intersect(valid)
    if op=="ne":
        roots=S.solveset(S.Eq(numerator,0,evaluate=False),X,domain=S.S.Reals)
        return valid-roots
    polynomial=S.expand(numerator*denominator)
    relation={"lt":S.Lt,"le":S.Le,"gt":S.Gt,"ge":S.Ge}[op](
        polynomial,0,evaluate=False)
    return solve_univariate_inequality(
        relation,X,relational=False,domain=S.S.Reals).intersect(valid)

def set_boundaries(value):
    if value in (S.S.Reals,S.EmptySet):
        return []
    if isinstance(value,S.Interval):
        return [v for v in (value.start,value.end) if v not in (-S.oo,S.oo)]
    if isinstance(value,S.FiniteSet):
        return list(value)
    if isinstance(value,(S.Union,S.Intersection)):
        return [v for item in value.args for v in set_boundaries(item)]
    if isinstance(value,S.Complement):
        return set_boundaries(value.args[0])+set_boundaries(value.args[1])
    raise Abstain("symbolic_set_type_unverified")


def membership(value,p):
    contained=value.contains(p)
    if contained==S.true:
        return True
    if contained==S.false:
        return False
    raise Abstain("symbolic_set_membership_unverified")


def equal_sets(left,right):
    if left==right:return True,None
    critical=sorted(set(set_boundaries(left)+set_boundaries(right)),
                    key=cmp_to_key(base.compare))
    edges=[-S.oo,*critical,S.oo]
    probes=[*critical,*[x_cell_probe(lo,hi) for lo,hi in zip(edges,edges[1:])]]
    for p in probes:
        if membership(left,p)!=membership(right,p):
            return False,p
    # Valid only because all admitted sets are finite unions of real intervals
    # and singleton algebraic points. Other symbolic-set forms abstain.
    return True,None


def x_endpoint(obj,a,b,c,d):
    if not isinstance(obj,dict):
        raise Abstain("invalid_x_endpoint")
    if obj=={"kind":"num_zero"}:
        v=xzero(a,b)
        if v is None:
            raise UndefinedCandidateAtParameter("numerator_root_not_defined_at_parameter")
        return v
    if obj=={"kind":"den_zero"}:
        v=xzero(c,d)
        if v is None:
            raise UndefinedCandidateAtParameter("denominator_root_not_defined_at_parameter")
        return v
    try:
        return base.endpoint(obj)
    except base.Abstain as e:
        raise Abstain(str(e)) from e


def candidate_x_set(doc,a,b,c,d):
    if doc=={"kind":"all_real"}:
        return S.S.Reals
    if doc=={"kind":"empty"}:
        return S.EmptySet
    if not isinstance(doc,dict) or set(doc)!={"kind","parts"} or doc["kind"]!="union":
        raise Abstain("invalid_candidate_x_set")
    rows=doc["parts"]
    if not isinstance(rows,list) or len(rows)>20:
        raise Abstain("invalid_candidate_x_parts")
    pieces=[]
    for part in rows:
        if not isinstance(part,dict):
            raise Abstain("invalid_x_set_part")
        if part.get("kind")=="point" and set(part)=={"kind","value"}:
            p=x_endpoint(part["value"],a,b,c,d)
            if p in (-S.oo,S.oo):
                raise Abstain("infinite_x_singleton")
            pieces.append(S.FiniteSet(p))
            continue
        if part.get("kind")=="interval" and set(part)=={
            "kind","left","right","includeLeft","includeRight"}:
            lc,rc=part["includeLeft"],part["includeRight"]
            if type(lc) is not bool or type(rc) is not bool:
                raise Abstain("invalid_x_interval_boolean")
            lo=x_endpoint(part["left"],a,b,c,d)
            hi=x_endpoint(part["right"],a,b,c,d)
            if (lo==-S.oo and lc) or (hi==S.oo and rc) or lo==S.oo or hi==-S.oo:
                raise Abstain("invalid_infinite_x_boundary")
            if not base.before(lo,hi):
                # A permanently reversed numeric interval is invalid schema;
                # an ordering reversal of symbolic roots at a particular t is
                # a genuine wrong parameter branch and must be refuted.
                constant_kinds=("rational","surd","infinity")
                if (part["left"].get("kind") in constant_kinds and
                    part["right"].get("kind") in constant_kinds):
                    raise Abstain("candidate_static_interval_reversed_or_empty")
                raise UndefinedCandidateAtParameter("candidate_x_interval_empty_or_reversed_at_parameter")
            pieces.append(S.Interval(lo,hi,left_open=not lc,right_open=not rc))
            continue
        raise Abstain("unrecognized_x_set_piece")
    return S.Union(*pieces) if pieces else S.EmptySet


def fixed_x_boundaries_in_candidate(branches):
    """Read and validate any numeric x endpoints before parameter cell proof.

    A fixed x endpoint e can collide with a moving root/pole inside an
    otherwise coefficient-sign-invariant parameter cell. That collision MUST
    be a parameter critical value or a single matching sample could pass a
    globally incorrect candidate. Symbolic root/pole endpoints are handled
    by the determinant and coefficient critical roots instead.
    """
    fixed=set()
    for _,solution in branches:
        if solution["kind"]!="union":
            continue
        for part in solution["parts"]:
            if not isinstance(part,dict):
                raise Abstain("invalid_x_solution_piece")
            kind=part.get("kind")
            if kind=="point" and set(part)=={"kind","value"}:
                endpoints=[part["value"]]
            elif kind=="interval" and set(part)=={
                    "kind","left","right","includeLeft","includeRight"}:
                if type(part["includeLeft"]) is not bool or type(part["includeRight"]) is not bool:
                    raise Abstain("invalid_x_interval_boolean")
                endpoints=[part["left"],part["right"]]
            else:
                raise Abstain("unknown_x_solution_piece")
            for e in endpoints:
                if not isinstance(e,dict):
                    raise Abstain("invalid_x_endpoint")
                tag=e.get("kind")
                if tag in ("num_zero","den_zero"):
                    if e!={"kind":tag}:
                        raise Abstain("symbolic_root_endpoint_has_extra_fields")
                elif tag=="infinity":
                    try:
                        base.endpoint(e)
                    except base.Abstain as err:
                        raise Abstain(str(err)) from err
                elif tag in ("rational","surd"):
                    try:
                        exact=base.endpoint(e)
                    except base.Abstain as err:
                        raise Abstain(str(err)) from err
                    if exact.is_real is not True:
                        raise Abstain("fixed_x_endpoint_not_proven_real")
                    fixed.add(exact)
                else:
                    raise Abstain("unsupported_x_endpoint")
    if len(fixed)>64:
        raise Abstain("too_many_fixed_x_endpoints")
    return fixed


def static_endpoint_crossing_parameters(A,B,C,D,values):
    """Solve N(t,e)=0 and D(t,e)=0 exactly, for every fixed candidate e."""
    out=set()
    for e in values:
        for slope,constant in ((A,B),(C,D)):
            equation=S.expand(slope*e+constant)
            param_slope=S.simplify(S.diff(equation,T))
            param_const=S.simplify(equation.subs(T,0))
            if param_slope==0:
                continue
            root=S.simplify(S.radsimp(-param_const/param_slope))
            if root.is_real is not True:
                raise Abstain("fixed_x_endpoint_parameter_collision_not_exact")
            out.add(root)
    return out


def classify_case(case):
    ident=case.get("id") if isinstance(case,dict) else None
    if not isinstance(ident,str) or not ident or len(ident)>128:
        return {"id":None,"status":"unverified","reason":"invalid_case_identity",
                "officialExamGoldCertified":False}
    info={"id":ident,"officialExamGoldCertified":False}
    try:
        if set(case).difference({"id","model","comparison","parameterBranches","expectedStatus"}):
            raise Abstain("unknown_claim_property")
        op=case.get("comparison")
        if op not in OPERATORS:
            raise Abstain("unsupported_comparison")
        A,B,C,D=model_coefficients(case.get("model"))
        raw=case.get("parameterBranches")
        if not isinstance(raw,list) or not 1<=len(raw)<=32:
            raise Abstain("invalid_parameter_partition")
        branches=[]
        for record in raw:
            if not isinstance(record,dict) or set(record)!={"when","xSolution"}:
                raise Abstain("invalid_parameter_branch")
            when=base.parse_section(record["when"])
            sol=record["xSolution"]
            # Schema check without parameter substitution; invalid schemas
            # abstain even if the particular branch is never selected.
            if not isinstance(sol,dict) or sol.get("kind") not in ("all_real","empty","union"):
                raise Abstain("invalid_x_solution_kind")
            if sol["kind"] in ("all_real","empty") and set(sol)!={"kind"}:
                raise Abstain("invalid_x_solution_metadata")
            if sol["kind"]=="union" and (set(sol)!={"kind","parts"} or
                    not isinstance(sol["parts"],list) or len(sol["parts"])>20):
                raise Abstain("invalid_x_union_schema")
            branches.append((when,sol))
        determinant=S.expand(A*D-B*C)
        fixed_x=fixed_x_boundaries_in_candidate(branches)
        critical=static_endpoint_crossing_parameters(A,B,C,D,fixed_x)
        for polynomial in (A,B,C,D,determinant):
            critical.update(base.polynomial_roots(polynomial))
        for region,_ in branches:
            if isinstance(region,S.Interval):
                for p in (region.start,region.end):
                    if p not in (-S.oo,S.oo):critical.add(p)
            else:
                critical.update(region)
        points=sorted(critical,key=cmp_to_key(base.compare))
        edges=[-S.oo,*points,S.oo]
        probes=[*points,*[base.point_between(lo,hi) for lo,hi in zip(edges,edges[1:])]]
        for t in probes:
            selected=[sol for region,sol in branches if base.member(region,t)]
            if len(selected)!=1:
                return {**info,"status":"refuted_parameter_solution_family",
                        "reason":"missing_or_overlapping_parameter_region",
                        "parameterWitness":str(t),"matchingBranches":len(selected)}
            a,b,c,d=(S.simplify(q.subs(T,t)) for q in (A,B,C,D))
            from_chart=exact_signchart(a,b,c,d,op)
            try:
                independently=original_solver(a,b,c,d,op)
                agree,xwitness=equal_sets(from_chart,independently)
            except (ValueError,TypeError,NotImplementedError,RuntimeError,RecursionError) as err:
                raise Abstain("independent_polynomial_reduction_solver_unsupported") from err
            if not agree:
                raise Abstain("independent_denominator_square_reduction_disagrees_at_t_"+
                              str(t)+"_x_"+str(xwitness))
            try:
                submitted=candidate_x_set(selected[0],a,b,c,d)
            except UndefinedCandidateAtParameter as err:
                return {**info,"status":"refuted_parameter_solution_family",
                        "reason":str(err),"parameterWitness":str(t),
                        "expectedRealSetAtWitness":str(from_chart)}
            equal,xwitness=equal_sets(from_chart,submitted)
            if not equal:
                return {**info,"status":"refuted_parameter_solution_family",
                        "reason":"wrong_full_x_solution_set",
                        "parameterWitness":str(t),
                        "xWitness":str(xwitness),
                        "expectedRealSetAtWitness":str(from_chart)}
        return {**info,"status":"verified_complete_parameter_solution_family",
                "criticalParameters":[str(v) for v in points],
                "exactParameterCellChecks":len(probes),
                "reason":"coefficient_and_resultant_roots_plus_all_parameter_partition_boundaries_checked_against_original_fraction_solver"}
    except (Abstain,base.Abstain,ValueError,TypeError,NotImplementedError,
            ZeroDivisionError,RecursionError,OverflowError) as e:
        return {**info,"status":"unverified",
                "reason":str(e) if isinstance(e,(Abstain,base.Abstain))
                         else "outside_supported_exact_rational_family"}


def check_batch(doc):
    if (not isinstance(doc,dict) or doc.get("schemaVersion")!=1 or
        doc.get("id")!=CONTRACT or doc.get("status")!="research_only_no_official_exam_gold"):
        raise ValueError("invalid_research_contract")
    cases=doc.get("cases")
    if not isinstance(cases,list) or not 1<=len(cases)<=128:
        raise ValueError("unsupported_case_count")
    ids=[x.get("id") if isinstance(x,dict) else None for x in cases]
    if any(not isinstance(v,str) or not v or len(v)>128 for v in ids) or len(set(ids))!=len(ids):
        raise ValueError("missing_or_duplicate_ids")
    done=[classify_case(c) for c in cases]
    return {"status":"exact_parameter_rational_fraction_real_sets_research_only",
            "scope":"All real parameter t, exact full real x-solution for (affine-in-x N)/(affine-in-x D) □ 0 with all four x coefficients rational affine in t and original denominator poles preserved; no free-form exam extraction.",
            "summary":{"total":len(done),
                       "verifiedComplete":sum(x["status"]=="verified_complete_parameter_solution_family" for x in done),
                       "refuted":sum(x["status"]=="refuted_parameter_solution_family" for x in done),
                       "unverified":sum(x["status"]=="unverified" for x in done),
                       "officialExamGoldReleased":0},
            "items":done}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",required=True)
    parser.add_argument("--require-decidable",action="store_true")
    args=parser.parse_args()
    with open(args.fixture,encoding="utf8") as file:
        output=check_batch(json.load(file))
    print(json.dumps(output,indent=2,ensure_ascii=False))
    return int(bool(args.require_decidable and output["summary"]["unverified"]))


if __name__=="__main__":
    sys.exit(main())
