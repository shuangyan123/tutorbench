#!/usr/bin/env python3
"""Exact complete real-root families for a(t)x²+b(t)x+c(t)=0, affine-rational coefficients.

Typed, bounded research model. No human reviewer, no LLM, no official exam gold.
A branch rule implicitly denotes the complete root expression, not just count:
all_reals, empty, linear(-C/B), double(-B/(2A)),
quadratic_pair((-B±sqrt(B²-4AC))/(2A)).
"""
import argparse
from functools import cmp_to_key
import json
import sys
import sympy as S

T, X = S.symbols('t x', real=True)
MAX = 1000000
RULES = {'all_reals', 'empty', 'linear', 'double', 'quadratic_pair'}
CONTRACT = 'parameter-affine-quadratic-real-roots-v0.1'


class Abstain(Exception):
    pass


def rational(v):
    if not isinstance(v, dict) or set(v) != {'num','den'}:
        raise Abstain('invalid_rational')
    n, d = v['num'], v['den']
    if type(n) is not int or type(d) is not int or abs(n)>MAX or not 1<=d<=MAX:
        raise Abstain('rational_out_of_bounds')
    return S.Rational(n,d)


def affine(coeff):
    if not isinstance(coeff, dict) or set(coeff) != {'constant','parameter'}:
        raise Abstain('invalid_parameter_affine_coefficient')
    return rational(coeff['constant'])+rational(coeff['parameter'])*T


def read_model(model):
    if not isinstance(model,dict) or set(model) != {'quadratic','linear','constant'}:
        raise Abstain('invalid_equation_model')
    return tuple(affine(model[key]) for key in ('quadratic','linear','constant'))


def endpoint(v):
    if not isinstance(v,dict):
        raise Abstain('invalid_parameter_boundary')
    if v.get('kind')=='infinity' and set(v)=={'kind','side'} and v['side'] in ('negative','positive'):
        return -S.oo if v['side']=='negative' else S.oo
    if v.get('kind')=='rational' and set(v)=={'kind','num','den'}:
        return rational({'num':v['num'],'den':v['den']})
    if v.get('kind')=='surd' and set(v)=={'kind','a','b','radicand','den'}:
        a,b,r,d = (v[k] for k in ('a','b','radicand','den'))
        if any(type(z) is not int for z in (a,b,r,d)) or r<0 or d<1 or max(abs(a),abs(b),r,d)>MAX:
            raise Abstain('invalid_quadratic_surd')
        return S.simplify((S.Integer(a)+S.Integer(b)*S.sqrt(r))/d)
    raise Abstain('unknown_parameter_boundary')


def before(a,b):
    if a==b:
        return False
    if a==-S.oo or b==S.oo:
        return True
    if b==-S.oo or a==S.oo:
        return False
    test = S.Lt(a,b)
    if test==S.true: return True
    if test==S.false: return False
    raise Abstain('parameter_boundary_order_unknown')


def compare(a,b):
    return 0 if a==b else (-1 if before(a,b) else 1)


def parse_section(section):
    if not isinstance(section,dict):
        raise Abstain('invalid_candidate_section')
    kind=section.get('kind')
    if kind=='point' and set(section)=={'kind','value'}:
        value=endpoint(section['value'])
        if value in (-S.oo,S.oo): raise Abstain('infinite_parameter_point')
        return S.FiniteSet(value)
    if kind=='interval' and set(section)=={'kind','left','right','includeLeft','includeRight'}:
        l,r=endpoint(section['left']),endpoint(section['right'])
        lc,rc=section['includeLeft'],section['includeRight']
        if type(lc) is not bool or type(rc) is not bool or not before(l,r):
            raise Abstain('bad_parameter_interval')
        if (l==-S.oo and lc) or (r==S.oo and rc) or l==S.oo or r==-S.oo:
            raise Abstain('bad_infinite_parameter_interval')
        return S.Interval(l,r,left_open=not lc,right_open=not rc)
    raise Abstain('unknown_parameter_section')


def polynomial_roots(p):
    polynomial=S.Poly(S.expand(p),T,domain=S.QQ)
    if polynomial.is_zero: return []
    if polynomial.degree()>2: raise Abstain('unsupported_discriminant_degree')
    out=[]
    for root in S.roots(polynomial.as_expr(),T):
        if root.is_real is True: out.append(root)
        elif root.is_real is None: raise Abstain('unresolved_parameter_root_reality')
    return sorted(set(out),key=cmp_to_key(compare))


def point_between(a,b):
    if a==-S.oo and b==S.oo:return S.Integer(0)
    if a==-S.oo:return S.floor(b)-1
    if b==S.oo:return S.ceiling(a)+1
    # Every nonempty interval between distinct real algebraic endpoints contains
    # a rational. Avoid nested radicals in the independent solver where possible.
    for power in range(80):
        size=S.Integer(2)**power
        probe=(S.floor(a*size)+1)/size
        if before(a,probe) and before(probe,b):
            return probe
    raise Abstain('parameter_cell_too_narrow_for_exact_probe')


def sign(v):
    v=S.simplify(v)
    if v==0:return 0
    if v.is_positive is True:return 1
    if v.is_negative is True:return -1
    raise Abstain('parameter_sign_not_proven')


def rule_at(a,b,c,t):
    av,bv,cv=(S.simplify(q.subs(T,t)) for q in (a,b,c))
    if av==0:
        if bv==0:return 'all_reals' if cv==0 else 'empty'
        return 'linear'
    disc=S.simplify(bv*bv-4*av*cv)
    result=sign(disc)
    return 'empty' if result<0 else ('double' if result==0 else 'quadratic_pair')


def explicit_set_at(a,b,c,t,rule):
    av,bv,cv=(S.simplify(q.subs(T,t)) for q in (a,b,c))
    if rule=='all_reals':return S.S.Reals
    if rule=='empty':return S.EmptySet
    if rule=='linear':
        if av!=0 or bv==0:raise Abstain('linear_rule_invalid_at_parameter')
        return S.FiniteSet(S.simplify(-cv/bv))
    if av==0:raise Abstain('quadratic_formula_at_degenerate_parameter')
    disc=S.simplify(bv*bv-4*av*cv)
    if rule=='double':
        if sign(disc)!=0:raise Abstain('double_root_formula_invalid_at_parameter')
        return S.FiniteSet(S.simplify(-bv/(2*av)))
    if rule=='quadratic_pair':
        if sign(disc)!=1:raise Abstain('quadratic_pair_invalid_at_parameter')
        root=S.sqrt(disc)
        return S.FiniteSet(S.simplify((-bv-root)/(2*av)),S.simplify((-bv+root)/(2*av)))
    raise Abstain('unknown_solution_formula')


def oracle_at(a,b,c,t):
    expr=S.expand(a.subs(T,t)*X**2+b.subs(T,t)*X+c.subs(T,t))
    return S.solveset(expr,X,domain=S.S.Reals)


def member(s,t):
    result=s.contains(t)
    if result==S.true:return True
    if result==S.false:return False
    raise Abstain('parameter_section_membership_not_decidable')


def same_solution_sets(left,right):
    if left==right:return True
    if isinstance(left,S.FiniteSet) and isinstance(right,S.FiniteSet):
        if len(left)!=len(right):return False
        for l in left:
            if not any(S.simplify(l-r)==0 for r in right):return False
        return True
    return False


def check_claim(claim):
    ident=claim.get('id') if isinstance(claim,dict) else None
    if not isinstance(ident,str) or not ident or len(ident)>128:
        return {'id':None,'status':'unverified','reason':'invalid_case_identity','officialExamGoldCertified':False}
    base={'id':ident,'officialExamGoldCertified':False}
    try:
        if not set(claim).issubset({'id','equation','parameterBranches','expectedStatus'}):
            raise Abstain('unexpected_claim_fields')
        a,b,c=read_model(claim.get('equation'))
        raw=claim.get('parameterBranches')
        if not isinstance(raw,list) or not 1<=len(raw)<=32:
            raise Abstain('missing_or_too_many_parameter_branches')
        branches=[]
        for candidate in raw:
            if not isinstance(candidate,dict) or set(candidate)!={'when','solution'}:
                raise Abstain('invalid_candidate_branch')
            r=candidate['solution']
            if not isinstance(r,dict) or set(r)!={'kind'} or r['kind'] not in RULES:
                raise Abstain('invalid_solution_formula_template')
            branches.append((parse_section(candidate['when']),r['kind']))
        delta=S.expand(b*b-4*a*c)
        critical=set()
        for polynomial in (a,b,c,delta): critical.update(polynomial_roots(polynomial))
        for region,_ in branches:
            if isinstance(region,S.Interval):
                for v in (region.start,region.end):
                    if v not in (-S.oo,S.oo):critical.add(v)
            else: critical.update(region)
        points=sorted(critical,key=cmp_to_key(compare))
        edges=[-S.oo,*points,S.oo]
        samples=[*points,*[point_between(i,j) for i,j in zip(edges,edges[1:])]]
        checks=0
        for t in samples:
            chosen=[r for region,r in branches if member(region,t)]
            if len(chosen)!=1:
                return {**base,'status':'refuted_parameter_solution_family',
                        'reason':'missing_or_overlapping_parameter_case',
                        'parameterWitness':str(t),'matchedBranches':len(chosen)}
            correct=rule_at(a,b,c,t)
            try:
                independently=oracle_at(a,b,c,t)
                exact=explicit_set_at(a,b,c,t,correct)
            except (ValueError,NotImplementedError,TypeError) as err:
                raise Abstain('independent_solver_unsupported') from err
            if not same_solution_sets(independently,exact):
                raise Abstain('independent_exact_solver_disagrees_at_'+str(t))
            checks+=1
            if chosen[0]!=correct:
                return {**base,'status':'refuted_parameter_solution_family',
                        'reason':'incorrect_complete_root_family',
                        'parameterWitness':str(t),'expectedSolutionRule':correct,
                        'actualSolutionRule':chosen[0],
                        'expectedRootsAtWitness':str(exact)}
        return {**base,'status':'verified_complete_parameter_solution_family',
                'reason':'all_coefficient_and_discriminant_critical_points_plus_exact_open_cells_checked',
                'criticalParameters':[str(v) for v in sorted(critical,key=cmp_to_key(compare))],
                'sampleChecks':checks,
                'answerSemantics':'Each branch solution template expands into the full exact x-root formula for its parameter region.'}
    except (Abstain,ValueError,TypeError,NotImplementedError,RecursionError) as err:
        return {**base,'status':'unverified',
                'reason':str(err) if isinstance(err,Abstain) else 'unsupported_symbolic_parameter_case'}


def check_batch(doc):
    if not isinstance(doc,dict) or doc.get('schemaVersion')!=1 or doc.get('id')!=CONTRACT or doc.get('status')!='research_only_no_official_exam_gold':
        raise ValueError('invalid_research_contract')
    claims=doc.get('cases')
    if not isinstance(claims,list) or not 1<=len(claims)<=128:
        raise ValueError('invalid_case_collection')
    ids=[row.get('id') if isinstance(row,dict) else None for row in claims]
    if any(not isinstance(i,str) or not i for i in ids) or len(set(ids))!=len(ids):
        raise ValueError('invalid_or_duplicate_case_id')
    outcomes=[check_claim(row) for row in claims]
    return {'status':'research_exact_parameter_quadratic_root_families_no_exam_gold',
            'scope':'All real parameter values for degree<=2 real x equations with coefficients affine in rational parameter; candidate solution branches use exact canonical formula templates; no arbitrary student prose or official paper authentication.',
            'summary':{'total':len(outcomes),
                       'verifiedComplete':sum(x['status']=='verified_complete_parameter_solution_family' for x in outcomes),
                       'refuted':sum(x['status']=='refuted_parameter_solution_family' for x in outcomes),
                       'unverified':sum(x['status']=='unverified' for x in outcomes),
                       'officialExamGoldReleased':0},'items':outcomes}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--fixture',required=True)
    parser.add_argument('--require-decidable',action='store_true')
    args=parser.parse_args()
    with open(args.fixture,encoding='utf8') as f:doc=json.load(f)
    result=check_batch(doc)
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return int(bool(args.require_decidable and result['summary']['unverified']))


if __name__=='__main__':
    sys.exit(main())
