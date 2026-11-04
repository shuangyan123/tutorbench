"""Research-only regression tests for exact abs/radical/piecewise full real solution sets."""
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
import sympy as sp

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / 'scripts/research/verify_abs_radical_piecewise.py'
FIXTURE = ROOT / 'fixtures/research/abs-radical-piecewise-v0.1.json'
spec = importlib.util.spec_from_file_location('abs_piecewise_research', MODULE)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

Q = lambda num, den=1: {'kind': 'rational', 'num': num, 'den': den}
A = lambda a, b: {'kind': 'affine', 'a': {'num': a, 'den': 1}, 'b': {'num': b, 'den': 1}}
ABS = lambda a, b: {'kind': 'abs_affine', 'a': {'num': a, 'den': 1}, 'b': {'num': b, 'den': 1}}
ROOT_EXPR = lambda a, b: {'kind': 'sqrt_affine', 'a': {'num': a, 'den': 1}, 'b': {'num': b, 'den': 1}}


class CompleteAbsRadicalPiecewiseSets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(FIXTURE.read_text(encoding='utf8'))
        cls.rows = {r['id']: r for r in cls.fixture['cases']}

    def test_90_exact_expected_complete_sets_refutations_and_refusals(self):
        report = engine.verify_batch(self.fixture)
        self.assertEqual(report['summary'], {'total': 90, 'verifiedComplete': 60,
                          'refuted': 13, 'unverified': 17, 'officialExamGoldReleased': 0})
        self.assertEqual({x['id']: x['status'] for x in report['items']},
                         {x['id']: x['expectedStatus'] for x in self.fixture['cases']})
        self.assertTrue(all(x['officialExamGoldCertified'] is False for x in report['items']))

    def test_all_thirteen_wrong_solution_sets_have_exact_distinguishing_witness(self):
        for row in self.fixture['cases']:
            if row['expectedStatus'] != 'refuted_solution_set':
                continue
            calculated = engine.solve_model(row)
            candidate = engine.typed_set(row['candidateSolution'])
            same, witness = engine.sets_equal_or_witness(calculated, candidate)
            self.assertFalse(same, row['id'])
            self.assertIsNotNone(witness, row['id'])
            self.assertNotEqual(engine.member(calculated, witness),
                                engine.member(candidate, witness), row['id'])

    def test_radical_squaring_extra_roots_and_negative_rhs_do_not_pass(self):
        for name in ('sqrt-eq-extraneous-negative-branch',
                     'sqrt-eq-4minusx-extraneous',
                     'sqrt-eq-2xminusone-extraneous'):
            self.assertEqual(engine.verify_one(self.rows[name])['status'],
                             'refuted_solution_set', name)
        self.assertEqual(engine.verify_one(self.rows['sqrt-eq-negative-one-empty'])['status'],
                         'verified_complete_solution_set')
        self.assertEqual(engine.verify_one(self.rows['sqrt-negative-constant-outside-real-domain'])['status'],
                         'unverified')

    def test_piecewise_guard_overlap_missing_branch_and_boundary_fail_closed(self):
        names = ('piecewise-overlapping-at-zero', 'piecewise-overlapping-interior',
                 'piecewise-missing-interval', 'piecewise-missing-zero-point',
                 'piecewise-empty-branch', 'piecewise-guard-domain-limited-false-excludes-endpoint')
        for name in names:
            self.assertEqual(engine.verify_one(self.rows[name])['status'],
                             self.rows[name]['expectedStatus'], name)
        self.assertEqual(engine.verify_one(self.rows['piecewise-abs-sqrt-eq-zero'])['status'],
                         'verified_complete_solution_set')

    def test_450_seeded_independent_sympy_vs_exact_sign_branch_cases(self):
        rng = random.Random(20261103)
        successfully_decided = 0
        for i in range(450):
            typ = rng.choice(('affine', 'abs_affine', 'sqrt_affine'))
            a, b, c, d = [rng.randint(-3, 3) for _ in range(4)]
            comparison = rng.choice(sorted(engine.REL))
            lhs = {'affine': A, 'abs_affine': ABS, 'sqrt_affine': ROOT_EXPR}[typ](a, b)
            rhs = A(c, d)
            try:
                direct = engine.piece_by_branch(lhs, rhs, comparison)
                oracle = engine.oracle(lhs, rhs, comparison)
                equal, witness = engine.sets_equal_or_witness(direct, oracle)
            except (NotImplementedError, ValueError, engine.OutOfScope):
                continue
            self.assertTrue(equal, (i, typ, a, b, c, d, comparison, witness))
            successfully_decided += 1
        # Four negative constant radicands require abstention; never counted as passed.
        self.assertGreaterEqual(successfully_decided, 440)

    def test_360_metamorphic_complements_and_disjointness_on_natural_domain(self):
        rng = random.Random(202611031)
        checks = 0
        for _ in range(120):
            typ = rng.choice(('affine', 'abs_affine', 'sqrt_affine'))
            a, b, c, d = [rng.randint(-4, 4) for _ in range(4)]
            lhs = {'affine': A, 'abs_affine': ABS, 'sqrt_affine': ROOT_EXPR}[typ](a, b)
            rhs = A(c, d)
            natural = engine.sign_set(a*engine.x+b, 'ge') if typ == 'sqrt_affine' else sp.S.Reals
            for first, second in (('eq', 'ne'), ('lt', 'ge'), ('gt', 'le')):
                positive = engine.piece_by_branch(lhs, rhs, first)
                negative = engine.piece_by_branch(lhs, rhs, second)
                same, witness = engine.sets_equal_or_witness(positive.union(negative), natural)
                self.assertTrue(same, (typ, a, b, c, d, first, second, witness))
                empty, witness = engine.sets_equal_or_witness(
                    positive.intersect(negative), sp.S.EmptySet)
                self.assertTrue(empty, (typ, a, b, c, d, first, second, witness))
                checks += 1
        self.assertEqual(checks, 360)

    def test_positive_scaling_abs_and_square_scaling_sqrt_preserve_sets(self):
        for a, b, c, d in ((1, -1, 0, 2), (-2, 3, 1, 1), (3, 2, -1, 3)):
            for op in engine.REL:
                prior = engine.piece_by_branch(ABS(a, b), A(c, d), op)
                for factor in (2, 3):
                    after = engine.piece_by_branch(ABS(factor*a, factor*b),
                                                   A(factor*c, factor*d), op)
                    self.assertTrue(engine.sets_equal_or_witness(prior, after)[0])
        for a, b, c, d in ((1, 1, 1, -1), (2, -1, 1, -1), (-1, 4, 1, -1)):
            for op in engine.REL:
                prior = engine.piece_by_branch(ROOT_EXPR(a, b), A(c, d), op)
                for factor in (2, 3):
                    after = engine.piece_by_branch(
                        ROOT_EXPR(factor*factor*a, factor*factor*b),
                        A(factor*c, factor*d), op)
                    self.assertTrue(engine.sets_equal_or_witness(prior, after)[0])

    def test_oracle_corruption_causes_abstention_not_false_positive(self):
        with patch.object(engine, 'oracle', return_value=sp.S.EmptySet):
            result = engine.verify_one(self.rows['sqrt-eq-2xminusone'])
            self.assertEqual(result['status'], 'unverified')
            self.assertIn('direct_solver_disagrees', result['reason'])
        with patch.object(engine, 'oracle', return_value=sp.S.Reals):
            self.assertEqual(engine.verify_one(self.rows['abs-two-roots'])['status'],
                             'unverified')

    def test_untrusted_input_and_missing_guards_do_not_execute(self):
        row = copy.deepcopy(self.rows['abs-two-roots'])
        row['branches'][0]['lhs']['a']['num'] = "__import__('os').system('echo unsafe')"
        self.assertEqual(engine.verify_one(row)['status'], 'unverified')
        row = copy.deepcopy(self.rows['abs-two-roots'])
        row['candidateSolution'] = {'kind': 'point',
                                    'value': {'kind': 'infinity', 'side': 'negative'}}
        self.assertEqual(engine.verify_one(row)['status'], 'unverified')
        row = copy.deepcopy(self.rows['abs-two-roots'])
        row['branches'] = []
        self.assertEqual(engine.verify_one(row)['status'], 'unverified')
        duplicated = copy.deepcopy(self.fixture)
        duplicated['cases'] = [self.fixture['cases'][0], self.fixture['cases'][0]]
        with self.assertRaisesRegex(ValueError, 'duplicate_case_id'):
            engine.verify_batch(duplicated)

    def test_strict_cli_fails_if_any_answers_cannot_be_verified(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'contract.json'
            path.write_text(json.dumps(self.fixture), encoding='utf8')
            run = subprocess.run([sys.executable, str(MODULE), '--fixture',
                                  str(path), '--require-decidable'],
                                 capture_output=True, text=True, check=False)
            self.assertEqual(run.returncode, 1, run.stderr)
            self.assertEqual(json.loads(run.stdout)['summary']['unverified'], 17)


if __name__ == '__main__':
    unittest.main()
