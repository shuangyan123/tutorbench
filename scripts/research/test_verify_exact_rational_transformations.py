"""Reproducible no-human-review exact rational transformation checks."""
import copy
import importlib.util
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import sympy as S
from sympy.solvers.inequalities import solve_univariate_inequality

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'scripts/research/verify_exact_rational_transformations.py'
FIXTURE=ROOT/'fixtures/research/exact-rational-transformations-v0.1.json'
spec=importlib.util.spec_from_file_location('exact_transform_math',SRC)
math=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=math
spec.loader.exec_module(math)

K=lambda n,d=1:{'kind':'const','num':n,'den':d}
X={'kind':'x'}
ADD=lambda *v:{'kind':'add','args':list(v)}
MUL=lambda *v:{'kind':'mul','args':list(v)}
DIV=lambda a,b:{'kind':'div','numerator':a,'denominator':b}
POW=lambda a,n:{'kind':'pow','base':a,'exponent':n}
NE=lambda v:{'kind':'neg','arg':v}
LINE=lambda a,b:ADD(MUL(K(a),X),K(b))
SENTENCE=lambda expr,op:{'expression':expr,'comparison':op}


class ExactTransformationSemantics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(FIXTURE.read_text(encoding='utf8'))
        cls.by_id={r['id']:r for r in cls.fixture['cases']}

    def test_all_81_expected_decisions_and_exam_gold_prohibition(self):
        output=math.batch(self.fixture)
        self.assertEqual(output['status'],'research_exact_rational_transformation_semantics_no_official_gold')
        self.assertEqual(output['summary'],{
            'total':81,'verified_domain_and_function_equivalence':16,
            'verified_relation_and_domain_equivalence':10,
            'verified_solution_equivalence_domain_changed':9,
            'verified_transformation_chain':4,'refuted':28,'unverified':14,
            'officialExamGoldReleased':0})
        self.assertEqual({r['id']:r['status'] for r in output['items']},
                         {r['id']:r['expectedStatus'] for r in self.fixture['cases']})
        self.assertTrue(all(r['officialExamGoldCertified'] is False for r in output['items']))

    def test_cancellation_does_not_change_the_original_defined_domain(self):
        for name,missing in (('false-cancel-x-x-domain','0'),
                             ('false-cancel-x-minus1-domain','1'),
                             ('false-zero-times-undefined-as-zero','1'),
                             ('false-pow-zero-erases-domain','0')):
            result=math.verify(self.by_id[name])
            self.assertEqual(result['status'],'refuted',name)
            self.assertEqual(result['reason'],'expression_domain_changed')
            self.assertEqual(result['xWitness'],missing)
        for name in ('function-removable-hole-same-domain',
                     'function-zero-times-undefined-preserved',
                     'function-nested-div-retains-hole'):
            self.assertEqual(math.verify(self.by_id[name])['status'],
                             'verified_domain_and_function_equivalence',name)

    def test_strict_crossmultiplication_can_preserve_answers_but_not_domains(self):
        relaxed=math.verify(self.by_id['solution-only-crossmultiply-strict'])
        self.assertEqual(relaxed['status'],'verified_solution_equivalence_domain_changed')
        self.assertTrue(relaxed['domainChanged'])
        strict=math.verify(self.by_id['false-crossmultiply-demand-domain'])
        self.assertEqual(strict['reason'],'relation_domain_changed')
        self.assertEqual(strict['xWitness'],'1')
        weak=math.verify(self.by_id['false-crossmultiply-weak-includes-pole'])
        self.assertEqual(weak['reason'],'different_solution_sets')
        self.assertEqual(weak['xWitness'],'1')

    def test_equation_set_is_different_from_value_and_domain_equivalence(self):
        self.assertEqual(math.verify(self.by_id['relation-equation-factor-with-hole'])['status'],
                         'verified_relation_and_domain_equivalence')
        self.assertEqual(math.verify(self.by_id['solution-only-zero-not-eq'])['status'],
                         'verified_solution_equivalence_domain_changed')
        self.assertEqual(math.verify(self.by_id['false-hole-zero-numerator-equation'])['status'],
                         'refuted')

    def test_exact_irrational_pole_boundaries_and_sign_preservation(self):
        irrational=ADD(POW(X,2),K(-2))
        fraction=DIV(K(1),irrational)
        for op,expected in (('gt','verified_solution_equivalence_domain_changed'),
                            ('lt','verified_solution_equivalence_domain_changed'),
                            ('ge','refuted'),('le','refuted')):
            result=math.verify({'id':'surd-'+op,'mode':'relation',
                'left':SENTENCE(fraction,op),'right':SENTENCE(irrational,op),
                'requireSameDomain':False})
            self.assertEqual(result['status'],expected,op)
            if op in ('ge','le'):
                self.assertIn(result['xWitness'],('sqrt(2)','-sqrt(2)'))

    def test_chain_reports_first_mathematically_invalid_transformation(self):
        good=math.verify(self.by_id['chain-crossmultiply-strict-solution-only'])
        self.assertEqual(good['status'],'verified_transformation_chain')
        self.assertTrue(good['domainChanged'])
        second=math.verify(self.by_id['chain-fails-at-second-weakening'])
        self.assertEqual(second['status'],'refuted')
        self.assertEqual(second['failedTransition'],1)
        self.assertEqual(second['xWitness'],'0')
        first=math.verify(self.by_id['chain-fails-first-crossmultiply-domain'])
        self.assertEqual(first['failedTransition'],0)
        self.assertEqual(first['xWitness'],'1')

    def test_all_refuted_results_provide_distinguishing_witness(self):
        for case in self.fixture['cases']:
            if case['expectedStatus']!='refuted':continue
            with self.subTest(id=case['id']):
                result=math.verify(case)
                self.assertEqual(result['status'],'refuted')
                self.assertIsNotNone(result['xWitness'])
                self.assertNotIn('...',result['xWitness'])

    def test_45_random_affine_fractions_have_a_domain_preserving_scaled_form(self):
        rng=random.Random(20261103)
        for i in range(45):
            a,b,c,d=(rng.randint(-4,4) for _ in range(4))
            if c==0 and d==0:d=1
            n,den=LINE(a,b),LINE(c,d)
            result=math.verify({'id':'random-'+str(i),'mode':'function',
                'left':DIV(n,den),'right':DIV(MUL(n,den),POW(den,2))})
            self.assertEqual(result['status'],'verified_domain_and_function_equivalence',(a,b,c,d,result))

    def test_40_random_strict_crossmultiplications_keep_solution_sets(self):
        rng=random.Random(3141519)
        for i in range(40):
            a,b,c,d=(rng.randint(-4,4) for _ in range(4))
            if c==0 and d==0:d=1
            n,den=LINE(a,b),LINE(c,d)
            for op in ('gt','lt'):
                result=math.verify({'id':'strict-'+str(i)+'-'+op,'mode':'relation',
                    'left':SENTENCE(DIV(n,den),op),
                    'right':SENTENCE(MUL(n,den),op),
                    'requireSameDomain':False})
                expected=('verified_solution_equivalence_domain_changed' if c!=0
                          else 'verified_relation_and_domain_equivalence')
                self.assertEqual(result['status'],expected,(a,b,c,d,op,result))

    def test_30_random_weak_crossmultiplications_preserve_poles_as_counterexamples(self):
        rng=random.Random(271828)
        for i in range(30):
            a,b,c,d=(rng.randint(-3,3) for _ in range(4))
            if c==0:c=1
            n,den=LINE(a,b),LINE(c,d)
            result=math.verify({'id':'weak-'+str(i),'mode':'relation',
                'left':SENTENCE(DIV(n,den),'ge'),
                'right':SENTENCE(MUL(n,den),'ge'),
                'requireSameDomain':False})
            self.assertEqual(result['status'],'refuted',(a,b,c,d,result))
            self.assertEqual(result['reason'],'different_solution_sets')
            self.assertEqual(S.sympify(result['xWitness']),S.Rational(-d,c))

    def test_30_random_complement_paired_relations_cover_original_domain(self):
        rng=random.Random(20261113)
        for _ in range(30):
            a,b,c,d=(rng.randint(-3,3) for _ in range(4))
            if c==d==0:d=1
            fn=math.parse_expr(DIV(LINE(a,b),LINE(c,d)),math.ParseBudget())
            for op1,op2 in (('eq','ne'),('lt','ge'),('gt','le')):
                for value in math.samples(fn):
                    defined,yes=math.original_statement(fn,op1,value)
                    defined2,no=math.original_statement(fn,op2,value)
                    self.assertEqual(defined,defined2)
                    self.assertEqual(int(yes)+int(no),int(defined))

    def test_random_sympy_polynomial_oracle_agrees_on_original_defined_domain(self):
        rng=random.Random(20261114)
        x=math.X
        confirmed=0
        for _ in range(26):
            a,b,c,d=(S.Integer(rng.randint(-3,3)) for _ in range(4))
            if c==d==0:d=S.Integer(1)
            op=rng.choice(sorted(math.COMPARISONS))
            fn=math.parse_expr(DIV(LINE(int(a),int(b)),LINE(int(c),int(d))),math.ParseBudget())
            N=a*x+b;D=c*x+d
            pole=-d/c if c!=0 else None
            valid=S.S.Reals if pole is None else S.S.Reals-S.FiniteSet(pole)
            if op=='eq':
                expected=S.solveset(S.Eq(N,0),x,domain=S.S.Reals).intersect(valid)
            elif op=='ne':
                expected=valid-S.solveset(S.Eq(N,0),x,domain=S.S.Reals)
            else:
                product=S.expand(N*D)
                relation={'lt':S.Lt,'le':S.Le,'gt':S.Gt,'ge':S.Ge}[op](product,0,evaluate=False)
                expected=solve_univariate_inequality(relation,x,relational=False,domain=S.S.Reals).intersect(valid)
            for probe in math.samples(fn):
                defined,actual=math.original_statement(fn,op,probe)
                canonical=expected.contains(probe)
                self.assertIn(canonical,(S.true,S.false))
                self.assertEqual(actual,canonical==S.true,(a,b,c,d,op,probe))
                confirmed+=1
        self.assertGreater(confirmed,50)

    def test_corrupted_canonical_polynomial_or_original_ast_abstains(self):
        original=math.poly_at
        with patch.object(math,'poly_at',side_effect=lambda p,x: original(p,x)+1):
            result=math.verify(self.by_id['function-rational-common-factor'])
            self.assertEqual(result['status'],'unverified')
        original_eval=math.raw_eval
        def defective(node,v):
            if node.get('kind')=='div':return S.Integer(1)
            return original_eval(node,v)
        with patch.object(math,'raw_eval',side_effect=defective):
            result=math.verify(self.by_id['function-rational-common-factor'])
            self.assertEqual(result['status'],'unverified')

    def test_malformed_and_unbounded_ast_fail_closed(self):
        unsupported=[c for c in self.fixture['cases'] if c['expectedStatus']=='unverified']
        self.assertEqual(len(unsupported),14)
        for r in unsupported:
            self.assertEqual(math.verify(r)['status'],'unverified',r['id'])
        duplicate=copy.deepcopy(self.fixture)
        duplicate['cases']=[self.fixture['cases'][0],self.fixture['cases'][0]]
        with self.assertRaisesRegex(ValueError,'duplicate_or_missing_case_id'):
            math.batch(duplicate)
        too_many=copy.deepcopy(self.fixture)
        too_many['cases']=[copy.deepcopy(self.fixture['cases'][0]) for _ in range(97)]
        with self.assertRaisesRegex(ValueError,'invalid_case_count'):
            math.batch(too_many)

    def test_strict_cli_exits_one_when_unverified_remain(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'claims.json'
            path.write_text(json.dumps(self.fixture),encoding='utf8')
            completed=subprocess.run([sys.executable,str(SRC),'--fixture',str(path),'--require-decidable'],
                                     capture_output=True,text=True,check=False,timeout=60)
            self.assertEqual(completed.returncode,1,completed.stderr)
            payload=json.loads(completed.stdout)
            self.assertEqual(payload['summary']['unverified'],14)
            self.assertEqual(payload['summary']['officialExamGoldReleased'],0)


if __name__=='__main__':unittest.main()
