#!/usr/bin/env python3
"""Research-only exact equivalence and domain-preservation certificates for Q(x).

Bounded typed univariate rational AST; original undefined subexpressions retained.
Does not parse natural language, arbitrary radicals, parameters, exam answer keys or proofs.
"""
import argparse
from dataclasses import dataclass
from fractions import Fraction
from functools import cmp_to_key
import json
import sys
import sympy as S

X=S.Symbol('x', real=True)
MAX_NODES=48
MAX_DEPTH=9
MAX_DEGREE=2
MAX_BITS=192
MAX_CASES=96
MAX_CHAIN=8
MAX_INTEGER_WITNESS=512
COMPARISONS=frozenset(('eq','ne','lt','le','gt','ge'))
CONTRACT='exact-rational-transformations-v0.1'


class Unverified(Exception): pass


class Undefined(Exception): pass


def trim(p):
    p=tuple(p)
    while len(p)>1 and p[-1]==0:p=p[:-1]
    if len(p)-1>MAX_DEGREE:raise Unverified('degree_exceeds_two')
    if any(abs(v.numerator).bit_length()>MAX_BITS or v.denominator.bit_length()>MAX_BITS for v in p):
        raise Unverified('polynomial_coefficient_exceeds_bit_budget')
    return p


ZERO=(Fraction(0),)
ONE=(Fraction(1),)
VAR=(Fraction(0),Fraction(1))


def add(a,b):return trim([sum((v[i] if i<len(v) else 0 for v in (a,b)),Fraction(0)) for i in range(max(len(a),len(b)))])


def neg(a):return trim([-v for v in a])


def mul(a,b):
    if a==ZERO or b==ZERO:return ZERO
    if len(a)+len(b)-2>MAX_DEGREE:raise Unverified('degree_exceeds_two')
    result=[Fraction(0)]*(len(a)+len(b)-1)
    for i,aa in enumerate(a):
        for j,bb in enumerate(b):result[i+j]+=aa*bb
    return trim(result)


def identity_difference(a,b):
    # Cross products of two supported rational degree<=2 expressions can
    # have degree<=4; that is an identity check, not an admitted AST node.
    def product(u,v):
        result=[Fraction(0)]*(len(u)+len(v)-1)
        for i,left in enumerate(u):
            for j,right in enumerate(v):result[i+j]+=left*right
        if len(result)>5 or any(abs(z.numerator).bit_length()>256 or z.denominator.bit_length()>256 for z in result):
            raise Unverified('identity_cross_product_budget_exceeded')
        return result
    left=product(a.p,b.q)
    right=product(b.p,a.q)
    result=[(left[i] if i<len(left) else 0)-(right[i] if i<len(right) else 0)
            for i in range(max(len(left),len(right)))]
    while len(result)>1 and result[-1]==0:result.pop()
    return tuple(result)


def iszero(a):return a==ZERO


def poly_at(a,v):
    value=S.Integer(0)
    for c in reversed(a):value=value*v+S.Rational(c.numerator,c.denominator)
    return S.simplify(value)


def nonzero(v):
    if v==0:return False
    if v.is_zero is False:return True
    if S.Eq(v,0)==S.false:return True
    raise Unverified('exact_zero_test_not_decidable')


def sg(v):
    if v==0:return 0
    if v.is_positive is True:return 1
    if v.is_negative is True:return -1
    raise Unverified('exact_sign_not_decidable')


def less(a,b):
    if a==b:return False
    if a==-S.oo or b==S.oo:return True
    if b==-S.oo or a==S.oo:return False
    rel=S.Lt(a,b)
    if rel==S.true:return True
    if rel==S.false:return False
    raise Unverified('algebraic_order_not_decidable')


def cmp(a,b):return 0 if a==b else (-1 if less(a,b) else 1)


def roots(p):
    if iszero(p):return []
    degree=len(p)-1
    if degree==0:return []
    a=lambda i:S.Rational(p[i].numerator,p[i].denominator)
    if degree==1:return [S.simplify(-a(0)/a(1))]
    disc=S.simplify(a(1)**2-4*a(2)*a(0))
    sign=sg(disc)
    if sign<0:return []
    if sign==0:return [S.simplify(-a(1)/(2*a(2)))]
    sq=S.sqrt(disc)
    return sorted(set([S.simplify((-a(1)-sq)/(2*a(2))),S.simplify((-a(1)+sq)/(2*a(2)))]),key=cmp_to_key(cmp))


def sample_between(a,b):
    if a==-S.oo and b==S.oo:return S.Integer(0)
    if a==-S.oo:return S.floor(b)-1
    if b==S.oo:return S.ceiling(a)+1
    return S.simplify((a+b)/2)


def parse_rational(doc):
    if not isinstance(doc,dict) or set(doc)!= {'kind','num','den'} or doc['kind']!='const':
        raise Unverified('invalid_constant_schema')
    n,d=doc['num'],doc['den']
    if type(n) is not int or type(d) is not int or abs(n)>100000 or not 1<=d<=100000:
        raise Unverified('invalid_rational_constant_bounds')
    return Fraction(n,d)


@dataclass(frozen=True)
class Function:
    p:tuple
    q:tuple
    # Zero-set of each explicitly required nonzero syntactic subexpression.
    guards:tuple
    ast:dict


class ParseBudget:
    def __init__(self):self.nodes=0


def parse_expr(node,budget,depth=0):
    if depth>MAX_DEPTH:raise Unverified('expression_depth_limit')
    budget.nodes+=1
    if budget.nodes>MAX_NODES:raise Unverified('expression_node_limit')
    if not isinstance(node,dict):raise Unverified('expression_not_typed_object')
    kind=node.get('kind')
    if kind=='x' and set(node)=={'kind'}:return Function(VAR,ONE,(),node)
    if kind=='const':return Function(trim((parse_rational(node),)),ONE,(),node)
    if kind=='neg' and set(node)=={'kind','arg'}:
        a=parse_expr(node['arg'],budget,depth+1)
        return Function(neg(a.p),a.q,a.guards,node)
    if kind=='pow' and set(node)=={'kind','base','exponent'}:
        exp=node['exponent']
        if type(exp) is not int or not 0<=exp<=2:raise Unverified('unsupported_power_exponent')
        a=parse_expr(node['base'],budget,depth+1)
        pp,qq=ONE,ONE
        for _ in range(exp):pp,qq=mul(pp,a.p),mul(qq,a.q)
        return Function(pp,qq,a.guards,node)
    if kind in ('add','mul') and set(node)=={'kind','args'}:
        args=node['args']
        if not isinstance(args,list) or not 2<=len(args)<=8:raise Unverified('invalid_expression_children')
        values=[parse_expr(x,budget,depth+1) for x in args]
        result=values[0]
        for v in values[1:]:
            if kind=='add':p=add(mul(result.p,v.q),mul(v.p,result.q));q=mul(result.q,v.q)
            else:p=mul(result.p,v.p);q=mul(result.q,v.q)
            result=Function(p,q,result.guards+v.guards,node)
        return Function(result.p,result.q,result.guards,node)
    if kind=='div' and set(node)=={'kind','numerator','denominator'}:
        a=parse_expr(node['numerator'],budget,depth+1)
        b=parse_expr(node['denominator'],budget,depth+1)
        # Requirement: denominator expression *exists* and is not zero;
        # even if the quotient later simplifies to a constant.
        return Function(mul(a.p,b.q),mul(a.q,b.p),a.guards+b.guards+(b.p,),node)
    raise Unverified('unsupported_expression_node_or_fields')


def domain_at(fn,point):
    return all(not iszero(g) and nonzero(poly_at(g,point)) for g in fn.guards)


def raw_eval(node,value):
    kind=node['kind']
    if kind=='x':return value
    if kind=='const':
        v=parse_rational(node)
        return S.Rational(v.numerator,v.denominator)
    if kind=='neg':return -raw_eval(node['arg'],value)
    if kind=='pow':return raw_eval(node['base'],value)**node['exponent']
    if kind=='add':return sum((raw_eval(n,value) for n in node['args']),S.Integer(0))
    if kind=='mul':
        res=S.Integer(1)
        for n in node['args']:
            res*=raw_eval(n,value)
        return res
    if kind=='div':
        top=raw_eval(node['numerator'],value)
        bot=raw_eval(node['denominator'],value)
        if not nonzero(S.simplify(bot)):raise Undefined()
        return top/bot
    raise Unverified('raw_eval_unsupported_node')


def independent_value(fn,point):
    defined=domain_at(fn,point)
    if not defined:
        try:
            raw_eval(fn.ast,point)
        except Undefined:return False,None
        raise Unverified('original_ast_domain_disagrees_with_guard_trace')
    raw=S.simplify(raw_eval(fn.ast,point))
    if not nonzero(poly_at(fn.q,point)):
        raise Unverified('canonical_denominator_zero_inside_domain')
    canonical=S.simplify(poly_at(fn.p,point)/poly_at(fn.q,point))
    if S.simplify(raw-canonical)!=0:
        raise Unverified('canonical_polynomial_disagrees_with_original_ast')
    return True,raw


def critical(*fns):
    polynomials=[]
    for fn in fns:
        polynomials.extend(fn.guards)
        polynomials.extend((fn.p,fn.q))
    boundary=set()
    for p in polynomials:
        if not iszero(p):boundary.update(roots(p))
    return sorted(boundary,key=cmp_to_key(cmp))


def samples(*fns):
    boundary=critical(*fns)
    edges=[-S.oo,*boundary,S.oo]
    return [*boundary,*[sample_between(lo,hi) for lo,hi in zip(edges,edges[1:])]]


def sign_truth(v,op):
    s=sg(v)
    return {'eq':s==0,'ne':s!=0,'lt':s<0,'le':s<=0,'gt':s>0,'ge':s>=0}[op]


def original_statement(fn,op,v):
    defined,value=independent_value(fn,v)
    if not defined:return False,False
    sign=sg(value)
    canonical=sg(S.simplify(poly_at(fn.p,v)*poly_at(fn.q,v)))
    # P/Q and P*Q have the same sign on Q!=0.
    if sign!=canonical:raise Unverified('original_ast_relation_disagrees_with_polynomial_sign')
    return True,sign_truth(value,op)


def witness(v):return str(v)


def shared_defined_point(a,b):
    for i in range(MAX_INTEGER_WITNESS):
        for probe in ([S.Integer(0)] if i==0 else [S.Integer(i),S.Integer(-i)]):
            if domain_at(a,probe) and domain_at(b,probe) and nonzero(poly_at(a.q,probe)) and nonzero(poly_at(b.q,probe)):
                return probe
    raise Unverified('cannot_produce_exact_common_domain_witness')


def proof_function(left,right):
    budget=ParseBudget()
    a=parse_expr(left,budget)
    b=parse_expr(right,budget)
    points=samples(a,b)
    if not any(domain_at(a,x) for x in points) or not any(domain_at(b,x) for x in points):
        raise Unverified('empty_function_domain_not_certified')
    for p in points:
        da,va=independent_value(a,p)
        db,vb=independent_value(b,p)
        if da!=db:
            return {'status':'refuted','reason':'expression_domain_changed','xWitness':witness(p),
                    'leftDefined':da,'rightDefined':db}
    difference=identity_difference(a,b)
    if not iszero(difference):
        p=shared_defined_point(a,b)
        da,va=independent_value(a,p)
        db,vb=independent_value(b,p)
        if da and db and S.simplify(va-vb)!=0:
            return {'status':'refuted','reason':'different_defined_values','xWitness':witness(p),
                    'leftValue':str(va),'rightValue':str(vb)}
        # The first viable point might be a coincidence root of the difference.
        for n in range(1,MAX_INTEGER_WITNESS):
            for t in [S.Integer(n),S.Integer(-n)]:
                if domain_at(a,t) and domain_at(b,t) and nonzero(poly_at(difference,t)):
                    da,va=independent_value(a,t)
                    db,vb=independent_value(b,t)
                    if da and db and S.simplify(va-vb)!=0:
                        return {'status':'refuted','reason':'different_defined_values','xWitness':witness(t),
                                'leftValue':str(va),'rightValue':str(vb)}
        raise Unverified('nonidentity_but_no_verified_difference_witness')
    return {'status':'verified_domain_and_function_equivalence',
            'reason':'full_original_domain_sets_equal_and_exact_polynomial_identity'}


def parse_statement(v,budget):
    if not isinstance(v,dict) or set(v)!={'expression','comparison'}:
        raise Unverified('invalid_relation_statement_schema')
    op=v['comparison']
    if op not in COMPARISONS:raise Unverified('unsupported_comparison')
    return parse_expr(v['expression'],budget),op


def proof_relation_parts(a,op_a,b,op_b,require_domain):
    if any(iszero(g) for g in a.guards):raise Unverified('empty_left_domain')
    if any(iszero(g) for g in b.guards):raise Unverified('empty_right_domain')
    points=samples(a,b)
    changed=False
    for p in points:
        da,ta=original_statement(a,op_a,p)
        db,tb=original_statement(b,op_b,p)
        if da!=db:
            changed=True
            if require_domain:
                return {'status':'refuted','reason':'relation_domain_changed','xWitness':witness(p),
                        'leftDefined':da,'rightDefined':db}
        if ta!=tb:
            return {'status':'refuted','reason':'different_solution_sets','xWitness':witness(p),
                    'leftTrue':ta,'rightTrue':tb,'domainChanged':changed}
    return {'status':'verified_solution_equivalence_domain_changed' if changed else 'verified_relation_and_domain_equivalence',
            'reason':'all_exact_sign_cells_and_endpoint_truth_values_match',
            'domainChanged':changed,'checkedCellsAndBoundaries':len(points)}


def verify(case):
    ident=case.get('id') if isinstance(case,dict) else None
    base={'id':ident if isinstance(ident,str) and len(ident)<=128 else None,'officialExamGoldCertified':False}
    try:
        if base['id'] is None or not base['id']:raise Unverified('invalid_case_identity')
        if not isinstance(case,dict):raise Unverified('invalid_case')
        mode=case.get('mode')
        if mode=='function':
            if set(case)-{'id','mode','left','right','expectedStatus'}:raise Unverified('unexpected_case_fields')
            outcome=proof_function(case.get('left'),case.get('right'))
        elif mode=='relation':
            if set(case)-{'id','mode','left','right','requireSameDomain','expectedStatus'}:
                raise Unverified('unexpected_case_fields')
            strict=case.get('requireSameDomain')
            if type(strict) is not bool:raise Unverified('requireSameDomain_boolean_required')
            budget=ParseBudget()
            left,lop=parse_statement(case.get('left'),budget)
            right,rop=parse_statement(case.get('right'),budget)
            outcome=proof_relation_parts(left,lop,right,rop,strict)
        elif mode=='chain':
            if set(case)-{'id','mode','steps','requireSameDomain','expectedStatus'}:
                raise Unverified('unexpected_case_fields')
            strict=case.get('requireSameDomain')
            if type(strict) is not bool:raise Unverified('requireSameDomain_boolean_required')
            chain=case.get('steps')
            if not isinstance(chain,list) or not 2<=len(chain)<=MAX_CHAIN:
                raise Unverified('invalid_transformation_chain_length')
            budget=ParseBudget()
            statements=[parse_statement(s,budget) for s in chain]
            stages=[]
            for i,((left,lop),(right,rop)) in enumerate(zip(statements,statements[1:])):
                output=proof_relation_parts(left,lop,right,rop,strict)
                stages.append({'transition':i,**output})
                if output['status']=='refuted':return {**base,**output,'failedTransition':i,'checkedTransitions':len(stages)}
            return {**base,'status':'verified_transformation_chain',
                    'reason':'every_adjacent_transformation_exactly_preserves_requested_semantics',
                    'checkedTransitions':len(stages),
                    'domainChanged':any(stage['domainChanged'] for stage in stages)}
        else:raise Unverified('unknown_claim_mode')
        return {**base,**outcome}
    except (Unverified,ValueError,TypeError,ZeroDivisionError,RecursionError,OverflowError) as err:
        return {**base,'status':'unverified','reason':str(err) if isinstance(err,Unverified) else 'outside_supported_exact_transform_contract'}


def batch(doc):
    if not isinstance(doc,dict) or doc.get('schemaVersion')!=1 or doc.get('id')!=CONTRACT or doc.get('status')!='research_only_no_official_gold':
        raise ValueError('invalid_transform_contract')
    rows=doc.get('cases')
    if not isinstance(rows,list) or not 1<=len(rows)<=MAX_CASES:
        raise ValueError('invalid_case_count')
    ids=[r.get('id') if isinstance(r,dict) else None for r in rows]
    if any(not isinstance(i,str) or not i for i in ids) or len(set(ids))!=len(ids):
        raise ValueError('duplicate_or_missing_case_id')
    done=[verify(r) for r in rows]
    counts={status:sum(t['status']==status for t in done) for status in (
        'verified_domain_and_function_equivalence','verified_relation_and_domain_equivalence',
        'verified_solution_equivalence_domain_changed','verified_transformation_chain','refuted','unverified')}
    return {'status':'research_exact_rational_transformation_semantics_no_official_gold',
            'scope':'Exact rational Q[x] expressions with bounded typed AST and degree<=2 intermediate polynomials; function, relation or chain equivalence with original domains and exact witnesses, not arbitrary proofs or raw exam parsing',
            'summary':{'total':len(done),**counts,'officialExamGoldReleased':0},'items':done}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--fixture',required=True)
    parser.add_argument('--require-decidable',action='store_true')
    args=parser.parse_args()
    with open(args.fixture,encoding='utf8') as f:result=batch(json.load(f))
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return int(bool(args.require_decidable and result['summary']['unverified']))


if __name__=='__main__':sys.exit(main())
