import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import test from 'node:test';

const script='scripts/audit-exam-markdown-headings.mjs';
const sha=(s:string)=>{const data=Buffer.from(s,'utf8');return createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');};
const heading=(n:number)=>'【'+n+'】Question '+n;
const document=(mutate=false)=>[
  '# 一、选择题',
  ...Array.from({length:10},(_,i)=>mutate&&i===5?'garbled 【6】Question 6':heading(i+1)),
  '# 二、填空题',
  ...Array.from({length:6},(_,i)=>mutate&&i===1?'broken 【12】Question 12':heading(i+11)),
  '# 三、解答题',
  ...Array.from({length:6},(_,i)=>heading(i+17)),
].join('\n');
test('2024 structural audit flags embedded numbers but never calls them mathematical gold',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tb-math-2024-headings-'));
  try{
    const md=document(true);
    const manifest={id:'kaoyan-math1-2024-markdown-integrity-v0.1',source:{gitBlobSha:sha(md)},expectedQuestionNumbers:Array.from({length:22},(_,i)=>i+1)};
    const input=join(dir,'source.md'),config=join(dir,'manifest.json');
    await writeFile(input,md);await writeFile(config,JSON.stringify(manifest));
    const data=JSON.parse(execFileSync(process.execPath,[script,'--input',input,'--manifest',config],{encoding:'utf8'})) as {
      status:string;sourceMatched:boolean;missing:number[];embedded:Array<{question:number}>;
      summary:{recognizedHeadings:number;expectedQuestions:number}
    };
    assert.equal(data.status,'blocked_for_gold');
    assert.equal(data.sourceMatched,true);
    assert.equal(data.summary.expectedQuestions,22);
    assert.equal(data.summary.recognizedHeadings,20);
    assert.deepEqual(data.missing,[6,12]);
    assert.deepEqual(data.embedded.map(x=>x.question),[6,12]);
    const strict=spawnSync(process.execPath,[script,'--input',input,'--manifest',config,'--require-clean'],{encoding:'utf8'});
    assert.equal(strict.status,1);
    const fixed=document(false);await writeFile(input,fixed);
    const drift=JSON.parse(execFileSync(process.execPath,[script,'--input',input,'--manifest',config],{encoding:'utf8'})) as {sourceMatched:boolean;status:string};
    assert.equal(drift.sourceMatched,false);
    assert.equal(drift.status,'blocked_for_gold');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('2024 source audit metadata is pinned and disallows gold promotion',async()=>{
  const x=JSON.parse(await readFile('fixtures/research/kaoyan-math1-2024-markdown-integrity-v0.1.json','utf8')) as {
    status:string;expectedQuestionNumbers:number[];alternativeTranscriptions:Array<{gitBlobSha:string}>;source:{gitBlobSha:string};
  };
  assert.equal(x.status,'source-text-only-not-mathematical-gold');
  assert.deepEqual(x.expectedQuestionNumbers,Array.from({length:22},(_,i)=>i+1));
  assert.match(x.source.gitBlobSha,/^[a-f0-9]{40}$/u);
  assert.equal(x.alternativeTranscriptions.length,2);
});
