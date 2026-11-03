#!/usr/bin/env python3
"""Research-only exact solution sets for bounded absolute-value, radical and piecewise relations.

An explicitly typed math verifier, NOT natural-language exam parsing, proof grading,
or certification of third-party examination answer keys. No manual reviewer required.
"""
import argparse
from functools import cmp_to_key
import json
import sys
import sympy as sp
from sympy.solvers.inequalities import reduce_abs_inequality, solve_univariate_inequality

x = sp.Symbol('x', real=True)
MAX_COEFFICIENT = 1000000
REL = frozenset(('eq', 'ne', 'lt', 'le', 'gt', 'ge'))
MODELS = frozenset(('affine', 'abs_affine', 'sqrt_affine'))
CONTRACT = 'abs-radical-piecewise-solution-sets-v0.1'


class OutOfScope(Exception):
    pass


def rat(obj):
    if not isinstance(obj, dict) or set(obj) != {'num', 'den'}:
        raise OutOfScope('invalid_rational')
    n, d = obj['num'], obj['den']
    if type(n) is not int or type(d) is not int or abs(n) > MAX_COEFFICIENT or not 1 <= d <= MAX_COEFFICIENT:
        raise OutOfScope('invalid_rational_bounds')
    return sp.Rational(n, d)


def expression(model):
    if not isinstance(model, dict) or set(model) != {'kind', 'a', 'b'} or model['kind'] not in MODELS:
        raise OutOfScope('invalid_expression_type')
    a, b = rat(model['a']), rat(model['b'])
    arg = a*x+b
    if model['kind'] == 'affine':
        return arg
    if model['kind'] == 'abs_affine':
        return sp.Abs(arg, evaluate=False)
    return sp.sqrt(arg, evaluate=False)


def atom(obj):
    if not isinstance(obj, dict):
        raise OutOfScope('invalid_endpoint')
    if obj.get('kind') == 'infinity' and set(obj) == {'kind', 'side'} and obj['side'] in ('negative', 'positive'):
        return -sp.oo if obj['side'] == 'negative' else sp.oo
    if obj.get('kind') == 'rational' and set(obj) == {'kind', 'num', 'den'}:
        return rat({'num': obj['num'], 'den': obj['den']})
    if obj.get('kind') == 'surd' and set(obj) == {'kind', 'a', 'b', 'radicand', 'den'}:
        a, b, rad, d = (obj[key] for key in ('a', 'b', 'radicand', 'den'))
        if any(type(y) is not int for y in (a, b, rad, d)) or rad < 0 or d < 1 or max(abs(a), abs(b), rad, d) > MAX_COEFFICIENT:
            raise OutOfScope('invalid_quadratic_surd')
        return sp.simplify((sp.Integer(a)+sp.Integer(b)*sp.sqrt(rad))/d)
    raise OutOfScope('unsupported_endpoint')


def strict_less(a, b):
    if a == b:
        return False
    if a == -sp.oo or b == sp.oo:
        return True
    if b == -sp.oo or a == sp.oo:
        return False
    cmp = sp.Lt(a, b)
    if cmp == sp.true:
        return True
    if cmp == sp.false:
        return False
    raise OutOfScope('algebraic_endpoint_order_unknown')


def comp(a, b):
    return 0 if a == b else (-1 if strict_less(a, b) else 1)


def typed_set(doc):
    if isinstance(doc, dict) and doc.get('kind') in ('interval', 'point'):
        doc = {'kind': 'union', 'parts': [doc]}
    if doc == {'kind': 'all_real'}:
        return sp.S.Reals
    if doc == {'kind': 'empty'}:
        return sp.S.EmptySet
    if not isinstance(doc, dict) or set(doc) != {'kind', 'parts'} or doc['kind'] != 'union' or not isinstance(doc['parts'], list) or len(doc['parts']) > 24:
        raise OutOfScope('invalid_real_set_schema')
    parts = []
    for part in doc['parts']:
        if not isinstance(part, dict):
            raise OutOfScope('invalid_set_piece')
        if part.get('kind') == 'point' and set(part) == {'kind', 'value'}:
            p = atom(part['value'])
            if p in (-sp.oo, sp.oo):
                raise OutOfScope('infinite_singleton')
            parts.append(sp.FiniteSet(p))
        elif part.get('kind') == 'interval' and set(part) == {'kind', 'left', 'right', 'includeLeft', 'includeRight'}:
            a, b = atom(part['left']), atom(part['right'])
            left, right = part['includeLeft'], part['includeRight']
            if type(left) is not bool or type(right) is not bool or not strict_less(a, b):
                raise OutOfScope('invalid_interval')
            if (a == -sp.oo and left) or (b == sp.oo and right) or a == sp.oo or b == -sp.oo:
                raise OutOfScope('invalid_infinite_interval')
            parts.append(sp.Interval(a, b, left_open=not left, right_open=not right))
        else:
            raise OutOfScope('unknown_set_piece')
    return sp.Union(*parts) if parts else sp.S.EmptySet


def roots_quadratic(poly):
    p = sp.Poly(poly, x, domain=sp.QQ)
    if p.is_zero:
        return []
    if p.degree() > 2:
        raise OutOfScope('degree_above_two')
    roots = sp.roots(p.as_expr(), x)
    out = []
    for root in roots:
        if root.is_real is True:
            out.append(root)
        elif root.is_real is None:
            raise OutOfScope('root_reality_unknown')
    return sorted(set(out), key=cmp_to_key(comp))


def midpoint(a, b):
    if a == -sp.oo and b == sp.oo:
        return sp.Integer(0)
    if a == -sp.oo:
        return sp.floor(b)-1
    if b == sp.oo:
        return sp.ceiling(a)+1
    return sp.simplify((a+b)/2)


def eval_sign(poly, value):
    v = sp.simplify(poly.subs(x, value))
    if v == 0:
        return 0
    if v.is_positive is True:
        return 1
    if v.is_negative is True:
        return -1
    raise OutOfScope('sign_not_exactly_proven')


def compare_sign(sign, op):
    return {'eq': sign == 0, 'ne': sign != 0, 'lt': sign < 0, 'le': sign <= 0,
            'gt': sign > 0, 'ge': sign >= 0}[op]


def sign_set(poly, op):
    # Exact rational-quadratic sign cells, not numeric root sampling.
    if op not in REL:
        raise OutOfScope('unsupported_relation')
    if sp.Poly(poly, x, domain=sp.QQ).is_zero:
        return sp.S.Reals if compare_sign(0, op) else sp.S.EmptySet
    breaks = roots_quadratic(poly)
    edges = [-sp.oo, *breaks, sp.oo]
    pieces = []
    for a, b in zip(edges, edges[1:]):
        if compare_sign(eval_sign(poly, midpoint(a, b)), op):
            pieces.append(sp.Interval(a, b, True, True))
    if compare_sign(0, op):
        pieces.extend(sp.FiniteSet(v) for v in breaks)
    return sp.Union(*pieces) if pieces else sp.S.EmptySet


def piece_by_branch(lhs, rhs, op):
    if rhs['kind'] != 'affine':
        raise OutOfScope('right_side_must_be_affine')
    raw = rat(lhs['a'])*x+rat(lhs['b'])
    linear_rhs = rat(rhs['a'])*x+rat(rhs['b'])
    if lhs['kind'] == 'affine':
        return sign_set(raw-linear_rhs, op)
    if lhs['kind'] == 'abs_affine':
        # |a|=a if a>=0, otherwise -a. At zero branches are disjoint.
        return sp.Union(sign_set(raw, 'ge').intersect(sign_set(raw-linear_rhs, op)),
                        sign_set(raw, 'lt').intersect(sign_set(-raw-linear_rhs, op)))
    if lhs['kind'] == 'sqrt_affine':
        valid = sign_set(raw, 'ge')
        squared = raw-linear_rhs**2
        if op == 'eq':
            return valid.intersect(sign_set(linear_rhs, 'ge')).intersect(sign_set(squared, 'eq'))
        if op == 'ne':
            equal = valid.intersect(sign_set(linear_rhs, 'ge')).intersect(sign_set(squared, 'eq'))
            return valid-equal
        if op == 'lt':
            return valid.intersect(sign_set(linear_rhs, 'gt')).intersect(sign_set(squared, 'lt'))
        if op == 'le':
            return valid.intersect(sign_set(linear_rhs, 'ge')).intersect(sign_set(squared, 'le'))
        if op == 'gt':
            return valid.intersect(sp.Union(sign_set(linear_rhs, 'lt'),
                           sign_set(linear_rhs, 'ge').intersect(sign_set(squared, 'gt'))))
        if op == 'ge':
            return valid.intersect(sp.Union(sign_set(linear_rhs, 'le'),
                           sign_set(linear_rhs, 'gt').intersect(sign_set(squared, 'ge'))))
    raise OutOfScope('invalid_branch_type')


def oracle(lhs, rhs, op):
    # DIFFERENT solver path on the original unsquared expression. Shares SymPy,
    # so this is differential validation, not an independent proof kernel.
    l = expression(lhs)
    r = expression(rhs)
    raw = rat(lhs['a'])*x+rat(lhs['b'])
    valid = sign_set(raw, 'ge') if lhs['kind'] == 'sqrt_affine' else sp.S.Reals
    if lhs['kind'] == 'abs_affine' and op not in ('eq', 'ne'):
        reduction = reduce_abs_inequality(l-r, {'lt': '<', 'le': '<=', 'gt': '>', 'ge': '>='}[op], x)
        target = reduction.as_set()
    elif op in ('eq', 'ne'):
        eq = sp.solveset(sp.Eq(l, r, evaluate=False), x, domain=sp.S.Reals).intersect(valid)
        target = eq if op == 'eq' else valid-eq
    else:
        relation = {'lt': sp.Lt, 'le': sp.Le, 'gt': sp.Gt, 'ge': sp.Ge}[op](l, r, evaluate=False)
        target = solve_univariate_inequality(relation, x, relational=False, domain=sp.S.Reals).intersect(valid)
    return target.intersect(valid)


def boundary_list(s):
    if s == sp.S.Reals or s == sp.S.EmptySet:
        return []
    if isinstance(s, sp.Interval):
        return [v for v in (s.start, s.end) if v not in (-sp.oo, sp.oo)]
    if isinstance(s, sp.FiniteSet):
        return list(s)
    if isinstance(s, sp.Union):
        return [v for t in s.args for v in boundary_list(t)]
    if isinstance(s, sp.Complement):
        return boundary_list(s.args[0])+boundary_list(s.args[1])
    if isinstance(s, sp.Intersection):
        return [v for t in s.args for v in boundary_list(t)]
    raise OutOfScope('unsupported_set_representation')


def member(s, point):
    found = s.contains(point)
    if found == sp.true:
        return True
    if found == sp.false:
        return False
    raise OutOfScope('exact_membership_not_resolved')


def sets_equal_or_witness(a, b):
    if a == b:
        return True, None
    breaks = sorted(set(boundary_list(a)+boundary_list(b)), key=cmp_to_key(comp))
    samples = breaks[:]
    edges = [-sp.oo, *breaks, sp.oo]
    samples += [midpoint(u, v) for u, v in zip(edges, edges[1:])]
    for p in samples:
        if member(a, p) != member(b, p):
            return False, p
    # Valid for the restricted finite unions of intervals and points.
    return True, None


def solve_model(case):
    if not isinstance(case, dict) or case.get('comparison') not in REL:
        raise OutOfScope('invalid_comparison')
    op = case['comparison']
    domain = typed_set(case.get('domain'))
    if domain == sp.S.EmptySet:
        raise OutOfScope('empty_requested_domain')
    branches = case.get('branches')
    if not isinstance(branches, list) or not 1 <= len(branches) <= 8:
        raise OutOfScope('missing_or_too_many_branches')
    guards, exact_results = [], []
    for b in branches:
        if not isinstance(b, dict) or set(b) != {'when', 'lhs', 'rhs'}:
            raise OutOfScope('malformed_branch')
        lhs, rhs = b['lhs'], b['rhs']
        expression(lhs)
        expression(rhs)
        if rhs['kind'] != 'affine':
            raise OutOfScope('rhs_outside_family')
        if lhs['kind'] == 'sqrt_affine' and sign_set(rat(lhs['a'])*x+rat(lhs['b']), 'ge') == sp.S.EmptySet:
            raise OutOfScope('empty_real_square_root_domain')
        guard = typed_set(b['when'])
        if guard == sp.S.EmptySet:
            raise OutOfScope('empty_piecewise_guard')
        for prior in guards:
            overlap = guard.intersect(prior)
            disjoint, where = sets_equal_or_witness(overlap, sp.S.EmptySet)
            if not disjoint:
                raise OutOfScope('overlapping_piecewise_guards')
        guards.append(guard)
        algebraic = piece_by_branch(lhs, rhs, op).intersect(guard).intersect(domain)
        independent = oracle(lhs, rhs, op).intersect(guard).intersect(domain)
        agreed, witness = sets_equal_or_witness(algebraic, independent)
        if not agreed:
            raise OutOfScope('direct_solver_disagrees_at_'+str(witness))
        exact_results.append(algebraic)
    covered = sp.Union(*guards)
    covered_exactly, witness = sets_equal_or_witness(domain, covered)
    if not covered_exactly:
        raise OutOfScope('piecewise_guards_do_not_partition_domain_'+str(witness))
    return sp.Union(*exact_results)


def verify_one(case):
    id_ = case.get('id') if isinstance(case, dict) else None
    if not isinstance(id_, str) or not id_ or len(id_) > 128:
        return {'id': None, 'status': 'unverified', 'reason': 'invalid_claim_id',
                'officialExamGoldCertified': False}
    base = {'id': id_, 'officialExamGoldCertified': False}
    try:
        actual = solve_model(case)
        proposed = typed_set(case.get('candidateSolution'))
        same, witness = sets_equal_or_witness(actual, proposed)
        return {**base, 'status': 'verified_complete_solution_set' if same else 'refuted_solution_set',
                'referenceSet': str(actual), 'witness': None if same else str(witness),
                'reason': 'exact_branch_sign_proofs_and_direct_symbolic_oracle_agree'}
    except (OutOfScope, NotImplementedError, ValueError, TypeError, ZeroDivisionError, RecursionError) as err:
        return {**base, 'status': 'unverified',
                'reason': str(err) if isinstance(err, OutOfScope) else 'unsupported_symbolic_case'}


def verify_batch(doc):
    if not isinstance(doc, dict) or doc.get('schemaVersion') != 1 or doc.get('id') != CONTRACT or doc.get('status') != 'research_only_no_exam_gold':
        raise ValueError('invalid_fixture_contract')
    rows = doc.get('cases')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 128:
        raise ValueError('invalid_fixture_size')
    ids = [r.get('id') if isinstance(r, dict) else None for r in rows]
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('missing_or_duplicate_case_id')
    done = [verify_one(r) for r in rows]
    return {'status': 'research_exact_abs_radical_piecewise_no_official_gold',
            'summary': {'total': len(done),
                        'verifiedComplete': sum(t['status'] == 'verified_complete_solution_set' for t in done),
                        'refuted': sum(t['status'] == 'refuted_solution_set' for t in done),
                        'unverified': sum(t['status'] == 'unverified' for t in done),
                        'officialExamGoldReleased': 0},
            'scope': 'Exact complete real solution sets for bounded abs/sqrt/affine piecewise relations to affine targets with explicit guards and domains; not paper parsing or arbitrary proof grading',
            'items': done}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture', required=True)
    parser.add_argument('--require-decidable', action='store_true')
    args = parser.parse_args()
    with open(args.fixture, encoding='utf8') as f:
        result = verify_batch(json.load(f))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(bool(args.require_decidable and result['summary']['unverified']))


if __name__ == '__main__':
    sys.exit(main())
