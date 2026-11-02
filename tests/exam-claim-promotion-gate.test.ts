import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const source='fixtures/research/exam-source-expansion-2022-2026-v0.1.json';
const negative='fixtures/research/exam-claim-promotion-negative-controls-v0.1.json';
const cli='scripts/gate-exam-reference-claims.mjs';
interface Outcome {id:string;paperId:string;mathStatus:string;status:string;}
interface GateResult {status:string;summary:{total:number;released:number;blocked:number};items:Outcome[];}
test('mathematical proof-looking local statuses never certify unreviewed exam sources',async()=>{
  const result=JSON.parse(execFileSync(process.execPath,[cli,'--catalog',source,'--proposals',negative],{encoding:'utf8'})) as GateResult;
  assert.equal(result.status,'no_exam_gold_releases');
  assert.deepEqual(result.summary,{total:8,released:0,blocked:8});
  const byId=(id:string)=>{const found=result.items.find(x=>x.id===id);assert.ok(found);return found;};
  for(const id of ['math2-2025-local-symbolic-success','math3-2025-local-counterexample',
    'gaokao-2025-national-2-identity','gaokao-2022-beijing-unknown'])
    assert.equal(byId(id).status,'blocked_source_unreviewed');
  assert.equal(byId('math2-2026-not-in-index').status,'blocked_unindexed_question');
  assert.equal(byId('math1-2025-out-of-range').status,'blocked_unindexed_question');
  assert.equal(byId('invented-paper').status,'blocked_unknown_paper');
  assert.equal(byId('unsupported-result').status,'blocked_unsupported_math_status');
});
test('source metadata cannot silently enable exam answer certification',async()=>{
  const catalog=JSON.parse(await readFile(source,'utf8')) as {
    papers:Array<{paperId:string;source:{rawPaperInspected:boolean;answersIndependentlyVerified:boolean};answerGoldStatus:string}>;
  };
  const input={schemaVersion:1,items:[{id:'Q1',paperId:'kaoyan-math-2-2025',
    question:1,mathStatus:'verified_complete_solution_set'}]};
  const url=pathToFileURL(resolve('scripts/gate-exam-reference-claims.mjs')).href;
  const {gateReferenceClaims}=await import(url) as {
    gateReferenceClaims:(proposals:unknown,catalog:unknown)=>GateResult
  };
  const before=gateReferenceClaims(input,catalog);
  assert.equal(before.items[0]!.status,'blocked_source_unreviewed');
  const paper=catalog.papers.find(p=>p.paperId==='kaoyan-math-2-2025');assert.ok(paper);
  paper.source.rawPaperInspected=true;
  paper.source.answersIndependentlyVerified=true;
  paper.answerGoldStatus='verified';
  const after=gateReferenceClaims(input,catalog);
  assert.equal(after.items[0]!.status,'blocked_no_independent_evidence_contract');
  assert.equal(after.summary.released,0);
});
