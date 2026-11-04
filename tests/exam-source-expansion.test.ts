import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const source='fixtures/research/exam-source-expansion-2022-2026-v0.1.json';
const cmd='scripts/audit-exam-source-expansion.mjs';
interface Paper {
  paperId:string;exam:string;variant:string;year:number;questionImages:Array<{question:number;path:string;gitBlobSha:string}>;
  source:{gitBlobSha?:string;revision:string;rawPaperInspected:boolean;answersIndependentlyVerified:boolean};
  answerGoldStatus:string;questionCountFromSource:number|null;
}
interface Manifest {id:string;schemaVersion:number;status:string;years:number[];papers:Paper[];}
const run=(f=source)=>JSON.parse(execFileSync(process.execPath,[cmd,'--manifest',f],{encoding:'utf8'})) as {
  status:string;summary:{paperEditions:number;gaokaoPdfBlobs:number;postgradExamYears:number;
  postgradQuestionImageBlobs:number;postgradImageIndexedYears:number;postgrad2026NotIndexed:number;
  paperKeysCertified:number;questionResultsCertified:number;questionVerificationCoveragePercent:null;};
  gaokaoByYear:Record<string,number>;
};
const reject=(f:string)=>spawnSync(process.execPath,[cmd,'--manifest',f],{encoding:'utf8'});
test('fixed exam/year/edition coverage never substitutes for mathematical grading',async()=>{
  const report=run();
  assert.equal(report.status,'source_manifest_checked_not_math_verified');
  assert.equal(report.summary.paperEditions,51);
  assert.equal(report.summary.gaokaoPdfBlobs,36);
  assert.equal(report.summary.postgradExamYears,15);
  assert.equal(report.summary.postgradImageIndexedYears,12);
  assert.equal(report.summary.postgradQuestionImageBlobs,264);
  assert.equal(report.summary.postgrad2026NotIndexed,3);
  assert.equal(report.summary.paperKeysCertified,0);
  assert.equal(report.summary.questionResultsCertified,0);
  assert.equal(report.summary.questionVerificationCoveragePercent,null);
  assert.deepEqual(report.gaokaoByYear,{'2022':10,'2023':9,'2024':7,'2025':5,'2026':5});
});
test('freeze provenance, prevent one province or repeated file becoming another edition',async()=>{
  const doc=JSON.parse(await readFile(source,'utf8')) as Manifest;
  assert.equal(doc.status,'source-discovery-only-not-an-answer-key');
  assert.deepEqual(doc.years,[2022,2023,2024,2025,2026]);
  assert.equal(new Set(doc.papers.map(p=>p.paperId)).size,51);
  assert.equal(doc.papers.filter(p=>p.exam==='gaokao').length,36);
  assert.equal(doc.papers.filter(p=>p.exam==='kaoyan').length,15);
  assert.ok(doc.papers.every(p=>p.answerGoldStatus==='not_verified' &&
    p.source.rawPaperInspected===false && p.source.answersIndependentlyVerified===false));
  assert.ok(doc.papers.every(p=>/^[a-f0-9]{40}$/u.test(p.source.revision)));
  const questions=doc.papers.flatMap(p=>p.questionImages);
  assert.equal(questions.length,264);
  assert.ok(questions.every(q=>/^[a-f0-9]{40}$/u.test(q.gitBlobSha)));
});
test('duplication, tampering, missing question, fake gold and paper edition drift fail closed',async()=>{
  const doc=JSON.parse(await readFile(source,'utf8')) as Manifest;
  const dir=await mkdtemp(join(tmpdir(),'exam-corpus-integrity-'));
  try{
    const file=join(dir,'altered.json');
    const check=async(change:(copy:Manifest)=>void)=>{
      const copy=structuredClone(doc);
      change(copy);await writeFile(file,JSON.stringify(copy));
      const output=reject(file);
      assert.notEqual(output.status,0,'Altered source MUST NOT pass audit');
      assert.match(output.stderr,/invalid_source_manifest/u);
    };
    await check(copy=>copy.papers[0]!.answerGoldStatus='verified');
    await check(copy=>copy.papers[0]!.source.rawPaperInspected=true);
    await check(copy=>copy.papers[0]!.source.revision='moved-main');
    await check(copy=>copy.papers.push(structuredClone(copy.papers[0]!)));
    await check(copy=>copy.papers.splice(0,1));
    await check(copy=>{
      const p=copy.papers.find(x=>x.exam==='kaoyan'&&x.year===2025)!;
      p.questionImages.pop();
    });
    await check(copy=>{
      const p=copy.papers.find(x=>x.exam==='kaoyan'&&x.year===2024)!;
      p.questionImages[1]!.question=1;
    });
    await check(copy=>{
      const p=copy.papers.find(x=>x.exam==='gaokao'&&x.year===2026)!;
      p.source.gitBlobSha='not-a-git-object';
    });
  }finally{await rm(dir,{recursive:true,force:true});}
});
