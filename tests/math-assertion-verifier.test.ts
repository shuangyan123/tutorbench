import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

interface VerifierItem {
  pairId: string;
  armId: string;
  caseId: string;
  status: 'verified_true' | 'verified_false' | 'unverified';
  claim: unknown;
  reference: unknown;
}
interface VerifierResult {
  status: string;
  summary: { total: number; verifiedTrue: number; verifiedFalse: number; unverified: number };
  items: VerifierItem[];
  reference: {
    'mc-conditional-normalization': { conditionalTwoRed: { numerator: number; denominator: number }; counts: { twoRed: number; givenAtLeastOneRed: number } };
    'mc-endpoint-optimization': { extrema: { maxAt: number[]; minAt: number[] } };
    'mc-composition-domain': { counterexample: { x: number; fOfGDefined: boolean; gOfFDefined: boolean } };
  };
}
const script = 'scripts/verify-math-assertions.mjs';
const fixturePath = 'fixtures/judge/math-wrong-endorsement-controlled-pairs-v0.1.json';
function verify(fixture: string): VerifierResult {
  return JSON.parse(execFileSync(process.execPath, [script, '--fixture', fixture, '--require-full-coverage'], {
    cwd: process.cwd(), encoding: 'utf8',
  })) as VerifierResult;
}

test('reference mathematics is calculated independently of human blind ratings', () => {
  const result = verify(fixturePath);
  assert.equal(result.status, 'research-math-claims-only');
  assert.deepEqual(result.summary, { total: 14, verifiedTrue: 1, verifiedFalse: 13, unverified: 0 });
  assert.deepEqual(result.reference['mc-conditional-normalization'].conditionalTwoRed, { numerator: 1, denominator: 3 });
  assert.deepEqual(result.reference['mc-conditional-normalization'].counts, { twoRed: 10, givenAtLeastOneRed: 30 });
  assert.deepEqual(result.reference['mc-endpoint-optimization'].extrema.maxAt, [-1, 2]);
  assert.deepEqual(result.reference['mc-endpoint-optimization'].extrema.minAt, [-2, 1]);
  assert.deepEqual(result.reference['mc-composition-domain'].counterexample, { x: -2, fOfGDefined: true, gOfFDefined: false });
  const trueClaims = result.items.filter(x => x.status === 'verified_true');
  assert.deepEqual(trueClaims.map(x => [x.caseId, x.armId]), [['mc-conditional-normalization', 'B']]);
  const trueClaim = trueClaims[0];
  assert.ok(trueClaim);
  assert.match(trueClaim.pairId, /numerical-truth/u);
  assert.equal(new Set(result.items.map(x => x.pairId + ':' + x.armId)).size, 14);
});

test('unknown or tampered wording is unverified, never silently considered correct or incorrect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tutorbench-math-truth-'));
  try {
    const original = JSON.parse(await readFile(fixturePath, 'utf8')) as {
      pairs: Array<{ arms: Array<{ tutorResponse: string }> }>;
    };
    const changed = structuredClone(original);
    const arm = changed.pairs[0]?.arms[0];
    assert.ok(arm);
    arm.tutorResponse = 'This is probably the right formula, trust me.';
    const altered = join(dir, 'altered.json');
    await writeFile(altered, JSON.stringify(changed));
    const run = spawnSync(process.execPath, [script, '--fixture', altered], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout) as VerifierResult;
    assert.deepEqual(result.summary, { total: 14, verifiedTrue: 1, verifiedFalse: 12, unverified: 1 });
    assert.equal(result.items[0]?.status, 'unverified');
    assert.equal(run.stdout.includes('user-blind-review'), false);
    const strict = spawnSync(process.execPath, [script, '--fixture', altered, '--require-full-coverage'], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    assert.equal(strict.status, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
