import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = 'scripts/verify-exam-math-pilot.mjs';
const fixture = 'fixtures/research/exam-real-paper-pilot-v0.1.json';
const catalog = 'fixtures/research/exam-paper-source-catalog-v0.1.json';
interface Result {
  status:string;
  summary:{total:number;verifiedTrue:number;verifiedFalse:number;unverified:number;papersInCatalog:number;papersWithExamples:number};
  items:Array<{id:string;status:string;reference:string|null;claim?:string;reason:string}>;
}
const run=(path=fixture)=>JSON.parse(execFileSync(process.execPath,[script,'--fixture',path,'--catalog',catalog],{encoding:'utf8'})) as Result;
const item=(out:Result,id:string)=>{const result=out.items.find(x=>x.id===id);assert.ok(result);return result;};

test('pilot reports bounded coverage, exact references and unresolved case',()=>{
  const output=run();
  assert.equal(output.status,'research-only-noncanonical');
  assert.deepEqual(output.summary,{total:8,verifiedTrue:7,verifiedFalse:0,unverified:1,papersInCatalog:10,papersWithExamples:4});
  assert.equal(item(output,'gk25-q14').reference,'61/25');
  assert.equal(item(output,'ky26-q16').reference,'4');
  assert.equal(item(output,'ky25-q2').status,'unverified');
  assert.equal(JSON.stringify(output).includes('humanRatings'),false);
});
test('mutated incorrect exact answers are verified false and equivalent decimal true',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tb-exam-math-negative-'));
  try{
    const original=JSON.parse(await readFile(fixture,'utf8')) as {items:Array<{id:string;candidateAnswer:string}>};
    const changed=structuredClone(original);
    for(const [id,answer] of [['gk25-q1','D'],['gk25-q13','4'],['gk25-q14','61/24'],['ky26-q16','3']] as const){
      const entry=changed.items.find(x=>x.id===id);assert.ok(entry);entry.candidateAnswer=answer;
    }
    const decimal=changed.items.find(x=>x.id==='gk25-q12');assert.ok(decimal);decimal.candidateAnswer='4.00';
    const path=join(dir,'changed.json');await writeFile(path,JSON.stringify(changed));
    const output=run(path);
    assert.equal(output.summary.verifiedFalse,4);
    for(const id of ['gk25-q1','gk25-q13','gk25-q14','ky26-q16'])assert.equal(item(output,id).status,'verified_false');
    assert.equal(item(output,'gk25-q12').status,'verified_true');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('unknown phrasing, zero denominator, unsupported math and drift fail closed',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tb-exam-math-unknown-'));
  try{
    const original=JSON.parse(await readFile(fixture,'utf8')) as {items:Array<{id:string;candidateAnswer:string;sourcePage:number}>};
    const changed=structuredClone(original);
    const change=(id:string)=>{const entry=changed.items.find(x=>x.id===id);assert.ok(entry);return entry;};
    change('gk25-q12').candidateAnswer='four';
    change('gk25-q14').candidateAnswer='61/0';
    change('gk25-q1').candidateAnswer='C and D';
    change('gk25-q2').sourcePage=3;
    const path=join(dir,'unknown.json');await writeFile(path,JSON.stringify(changed));
    const output=run(path);
    assert.equal(output.summary.unverified,5);
    for(const id of ['gk25-q12','gk25-q14','gk25-q1','gk25-q2','ky25-q2'])assert.equal(item(output,id).status,'unverified');
    const strict=spawnSync(process.execPath,[script,'--fixture',path,'--require-full-coverage'],{encoding:'utf8'});
    assert.equal(strict.status,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
