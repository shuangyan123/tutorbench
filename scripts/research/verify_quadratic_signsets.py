#!/usr/bin/env python3
"""Research-only exact complete real solution sets for bounded rational functions.

Input: explicitly typed polynomial numerator/denominator degree <= 2 over Q,
comparison to zero and real-domain intervals. No exam NLP or proof evaluation.
"""
import argparse
import json
from functools import cmp_to_key
import sys
import sympy as S
from sympy.solvers.inequalities import solve_univariate_inequality

X = S.Symbol('x', real=True)
LIMIT = 1000000
MAX_CLAIMS = 128
RELATIONS = {'eq', 'ne', 'lt', 'le', 'gt', 'ge'}


class Abstain(Exception):
    pass


def q(node):
    if not isinstance(node, dict) or (set(node) not in ({'num', 'den'}, {'kind', 'num', 'den'})) or (('kind' in node) and node['kind'] != 'rational'):
        raise Abstain('invalid_rational')
    num, den = node['num'], node['den']
    if type(num) is not int or type(den) is not int or abs(num) > LIMIT or not 1 <= den <= LIMIT:
        raise Abstain('rational_outside_bounds')
    return S.Rational(num, den)


def coeff_poly(obj):
    if not isinstance(obj, dict) or set(obj) != {'coefficients'}:
        raise Abstain('invalid_polynomial')
    coeffs = obj['coefficients']
    if not isinstance(coeffs, list) or not 1 <= len(coeffs) <= 3:
        raise Abstain('only_degree_at_most_two_supported')
    vals = [q(c) for c in coeffs]
    return S.Poly(sum(c * X**i for i, c in enumerate(vals)), X, domain=S.QQ)


def atom(t):
    if not isinstance(t, dict) or not isinstance(t.get('kind'), str):
        raise Abstain('invalid_endpoint')
    kind = t['kind']
    if kind == 'rational' and set(t) == {'kind', 'num', 'den'}:
        return q({'num': t['num'], 'den': t['den']})
    if kind == 'surd' and set(t) == {'kind', 'a', 'b', 'radicand', 'den'}:
        a, b, rad, den = t['a'], t['b'], t['radicand'], t['den']
        if any(type(x) is not int for x in (a, b, rad, den)) or any(abs(x) > LIMIT for x in (a, b, rad, den)) or rad < 0 or den < 1:
            raise Abstain('unsupported_surd')
        return S.simplify((S.Integer(a) + S.Integer(b)*S.sqrt(rad))/den)
    if kind == 'root_of' and set(t) == {'kind', 'polynomial', 'index'}:
        index = t['index']
        if type(index) is not int or index not in (0, 1):
            raise Abstain('unsupported_root_index')
        poly = coeff_poly(t['polynomial'])
        if poly.is_zero:
            raise Abstain('infinite_root_set_as_endpoint')
        candidates = roots_poly(poly)
        if index >= len(candidates):
            raise Abstain('root_index_out_of_range_or_nonreal')
        return candidates[index]
    if kind == 'infinity' and set(t) == {'kind', 'side'} and t['side'] in ('negative', 'positive'):
        return -S.oo if t['side'] == 'negative' else S.oo
    raise Abstain('unsupported_endpoint')


def lt(a, b):
    if a == b:
        return False
    if a == -S.oo or b == S.oo:
        return True
    if a == S.oo or b == -S.oo:
        return False
    cond = S.Lt(a, b)
    if cond == S.true:
        return True
    if cond == S.false:
        return False
    raise Abstain('endpoint_order_undecidable')


def compare(a, b):
    if a == b:
        return 0
    return -1 if lt(a, b) else 1


def simplify_set(parts):
    return S.Union(*parts) if parts else S.EmptySet


def typed_set(doc):
    if doc == {'kind': 'all_real'}:
        return S.S.Reals
    if doc == {'kind': 'empty'}:
        return S.EmptySet
    if not isinstance(doc, dict) or set(doc) != {'kind', 'parts'} or doc['kind'] != 'union':
        raise Abstain('invalid_real_set')
    parts = doc['parts']
    if not isinstance(parts, list) or len(parts) > 16:
        raise Abstain('invalid_real_set_parts')
    result = []
    for p in parts:
        if not isinstance(p, dict):
            raise Abstain('invalid_real_set_piece')
        if p.get('kind') == 'point' and set(p) == {'kind', 'value'}:
            val = atom(p['value'])
            if val in (-S.oo, S.oo):
                raise Abstain('infinite_singleton')
            result.append(S.FiniteSet(val))
        elif p.get('kind') == 'interval' and set(p) == {'kind', 'left', 'right', 'includeLeft', 'includeRight'}:
            a, b = atom(p['left']), atom(p['right'])
            if type(p['includeLeft']) is not bool or type(p['includeRight']) is not bool:
                raise Abstain('invalid_interval_inclusion')
            if not lt(a, b):
                raise Abstain('reversed_or_empty_interval')
            if (a == -S.oo and p['includeLeft']) or (b == S.oo and p['includeRight']) or a == S.oo or b == -S.oo:
                raise Abstain('invalid_infinite_interval')
            result.append(S.Interval(a, b, left_open=not p['includeLeft'], right_open=not p['includeRight']))
        else:
            raise Abstain('invalid_real_set_piece')
    return simplify_set(result)


def roots_poly(poly):
    if poly.is_zero:
        return []
    roots = S.roots(poly.as_expr(), X)
    if len(roots) > 2:
        raise Abstain('unexpected_root_cardinality')
    candidates = []
    for r in roots:
        real = r.is_real
        if real is None:
            raise Abstain('root_reality_not_proven')
        if real:
            candidates.append(r)
    return sorted(set(candidates), key=cmp_to_key(compare))


def sample_between(a, b):
    if a == -S.oo and b == S.oo:
        return S.Integer(0)
    if a == -S.oo:
        return S.floor(b)-1
    if b == S.oo:
        return S.ceiling(a)+1
    return S.simplify((a+b)/2)


def predicate(sign, operator):
    return {'eq': sign == 0, 'ne': sign != 0, 'lt': sign < 0, 'le': sign <= 0,
            'gt': sign > 0, 'ge': sign >= 0}[operator]


def sgn(p, at):
    val = S.simplify(p.eval(at))
    if val == 0:
        return 0
    if val.is_positive is True:
        return 1
    if val.is_negative is True:
        return -1
    raise Abstain('polynomial_sign_not_exactly_decidable')


def signchart_set(numerator, denominator, op):
    bounds = sorted(set(roots_poly(numerator)+roots_poly(denominator)), key=cmp_to_key(compare))
    edges = [-S.oo, *bounds, S.oo]
    pieces = []
    for a, b in zip(edges, edges[1:]):
        point = sample_between(a, b)
        sn, sd = sgn(numerator, point), sgn(denominator, point)
        if sd == 0:
            raise Abstain('signchart_sample_on_pole')
        sign = 0 if sn == 0 else sn*sd
        if predicate(sign, op):
            pieces.append(S.Interval(a, b, left_open=True, right_open=True))
    for x in bounds:
        if sgn(denominator, x) == 0:
            continue
        if predicate(sgn(numerator, x)*sgn(denominator, x), op):
            pieces.append(S.FiniteSet(x))
    return simplify_set(pieces)


def oracle_set(numerator, denominator, op):
    # Cross-check SymPy inequality solver against our sign chart, but shares
    # SymPy foundations; NOT an independent formal proof kernel.
    rat = S.Mul(numerator.as_expr(), S.Pow(denominator.as_expr(), -1, evaluate=False), evaluate=False)
    poles = S.FiniteSet(*roots_poly(denominator))
    valid = S.S.Reals-poles
    if op == 'eq':
        return S.solveset(S.Eq(rat, 0), X, domain=S.S.Reals).intersect(valid)
    if op == 'ne':
        return (valid-S.solveset(S.Eq(rat, 0), X, domain=S.S.Reals))
    relation = {'lt': S.Lt, 'le': S.Le, 'gt': S.Gt, 'ge': S.Ge}[op](rat, 0, evaluate=False)
    return solve_univariate_inequality(relation, X, relational=False, domain=S.S.Reals).intersect(valid)


def endpoints_of_set(set_):
    if set_ == S.EmptySet or set_ == S.S.Reals:
        return []
    if isinstance(set_, S.Interval):
        return [v for v in (set_.start, set_.end) if v not in (-S.oo, S.oo)]
    if isinstance(set_, S.FiniteSet):
        return list(set_)
    if isinstance(set_, S.Union):
        return [v for arg in set_.args for v in endpoints_of_set(arg)]
    if isinstance(set_, S.Complement):
        return endpoints_of_set(set_.args[0])+endpoints_of_set(set_.args[1])
    raise Abstain('unsupported_oracle_set_form')


def member(set_, value):
    val = set_.contains(value)
    if val == S.true:
        return True
    if val == S.false:
        return False
    raise Abstain('set_membership_undecidable')


def compare_sets(a, b):
    if a == b:
        return True, None
    boundaries = sorted(set(endpoints_of_set(a)+endpoints_of_set(b)), key=cmp_to_key(compare))
    points = [*boundaries]
    edges = [-S.oo, *boundaries, S.oo]
    points += [sample_between(x, y) for x, y in zip(edges, edges[1:])]
    for point in points:
        if member(a, point) != member(b, point):
            return False, point
    return True, None


def encode_witness(value):
    # Reproducible SymPy expression is never parsed from untrusted input.
    return str(value)


def check_one(case):
    ident = case.get('id') if isinstance(case, dict) else None
    if not isinstance(ident, str) or not ident or len(ident) > 128:
        return {'id': None, 'status': 'unverified', 'reason': 'invalid_case_identity'}
    base = {'id': ident}
    try:
        operator = case.get('comparison')
        if operator not in RELATIONS:
            raise Abstain('unknown_comparison')
        numerator = coeff_poly(case.get('numerator'))
        denominator = coeff_poly(case.get('denominator'))
        if denominator.is_zero:
            raise Abstain('identically_zero_denominator')
        domain = typed_set(case.get('domain'))
        if domain == S.EmptySet:
            raise Abstain('empty_requested_domain')
        proposed = typed_set(case.get('candidateSolution'))
        predicted = signchart_set(numerator, denominator, operator).intersect(domain)
        independently = oracle_set(numerator, denominator, operator).intersect(domain)
        agree, example = compare_sets(predicted, independently)
        if not agree:
            raise Abstain('independent_solver_disagrees_at_'+encode_witness(example))
        good, witness = compare_sets(predicted, proposed)
        return {**base, 'status': 'verified_complete_solution_set' if good else 'refuted_solution_set',
                'reason': 'exact_signchart_and_independent_symbolic_solver_agree',
                'mathScope': 'rational_function_degree_at_most_two_with_explicit_real_domain',
                'witness': None if good else encode_witness(witness),
                'referenceSet': str(predicted),
                'officialExamGoldCertified': False}
    except (Abstain, NotImplementedError, ValueError, TypeError, ZeroDivisionError, RecursionError) as exc:
        return {**base, 'status': 'unverified',
                'reason': str(exc) if isinstance(exc, Abstain) else 'symbolic_solver_outside_supported_set',
                'officialExamGoldCertified': False}


def check_batch(doc):
    if not isinstance(doc, dict) or doc.get('schemaVersion') != 1 or doc.get('id') != 'quadratic-rational-signsets-v0.1' or doc.get('status') != 'research_only_typed_math_not_official_gold':
        raise ValueError('unexpected_fixture_identity')
    cases = doc.get('cases')
    if not isinstance(cases, list) or not 1 <= len(cases) <= MAX_CLAIMS:
        raise ValueError('invalid_fixture_size')
    ids = [c.get('id') if isinstance(c, dict) else None for c in cases]
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('duplicated_or_missing_id')
    outcomes = [check_one(c) for c in cases]
    return {'status': 'research_complete_real_signset_comparison_not_official_exam_gold',
            'scope': 'Exact complete real solutions for bounded rational coefficient quadratic numerator/denominator and typed real domains; no raw paper NLP/proofs/parameter families',
            'summary': {'total': len(outcomes),
                        'verifiedComplete': sum(x['status'] == 'verified_complete_solution_set' for x in outcomes),
                        'refuted': sum(x['status'] == 'refuted_solution_set' for x in outcomes),
                        'unverified': sum(x['status'] == 'unverified' for x in outcomes),
                        'officialExamGoldReleased': 0}, 'items': outcomes}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture', required=True)
    parser.add_argument('--require-decidable', action='store_true')
    args = parser.parse_args()
    with open(args.fixture, encoding='utf-8') as handle:
        result = check_batch(json.load(handle))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return int(bool(args.require_decidable and result['summary']['unverified']))


if __name__ == '__main__':
    sys.exit(main())
