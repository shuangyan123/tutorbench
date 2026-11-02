import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

interface Candidate {
  id: string;
  topic: string;
  learnerState: string;
  disclosurePolicy: string;
  studentMessage: string;
  tutorResponse: string;
  probeIntent: string;
  mathVerification: string;
  humanRatings: null;
}

test('research candidates vary mathematical tasks and policies without inventing human gold', async () => {
  const text = await readFile(new URL('../../fixtures/judge/math-diverse-human-review-candidates-v0.1.json', import.meta.url), 'utf8');
  const data = JSON.parse(text) as { id: string; status: string; provenance: string; policy: Record<string, unknown>; items: Candidate[] };
  assert.equal(data.id, 'math-diverse-human-review-candidates-v0.1');
  assert.equal(data.status, 'research-candidates-unreviewed');
  assert.match(data.provenance, /synthetic/u);
  assert.equal(data.items.length, 12);
  assert.equal(new Set(data.items.map(x => x.id)).size, 12);
  assert.equal(new Set(data.items.map(x => x.topic)).size, 12);
  assert.ok(new Set(data.items.map(x => x.learnerState)).size >= 5);
  assert.equal(data.items.filter(x => x.disclosurePolicy === 'hint_only').length, 10);
  assert.equal(data.items.filter(x => x.disclosurePolicy === 'full_solution_allowed').length, 2);
  assert.equal(new Set(data.items.map(x => x.studentMessage)).size, 12);
  assert.equal(new Set(data.items.map(x => x.tutorResponse)).size, 12);
  for (const item of data.items) {
    assert.ok(item.studentMessage.length >= 60, item.id);
    assert.ok(item.tutorResponse.length >= 25, item.id);
    assert.ok(item.probeIntent.length >= 15, item.id);
    assert.equal(item.mathVerification, 'structured_reference_available_unadjudicated');
    assert.equal(item.humanRatings, null);
  }
  assert.equal(text.includes('"goldLabel"'), false);
  assert.equal(text.includes('"answerLeakage"'), false);
});
