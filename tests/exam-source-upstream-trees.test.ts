import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

const source='fixtures/research/exam-source-expansion-2022-2026-v0.1.json';
const cli='scripts/verify-exam-source-upstream-trees.mjs';
interface Paper {
  exam:string;year:number;paperId:string;
  source:{path:string;gitBlobSha?:string};
  questionImages:Array<{path:string;gitBlobSha:string}>;
}
test('exact upstream Git SHA comparison detects changed and missing image/pdf sources',async()=>{
  const doc=JSON.parse(await readFile(source,'utf8')) as {papers:Paper[]};
  const dir=await mkdtemp(join(tmpdir(),'tb-exam-upstream-'));
  try{
    const gaokao={truncated:false,tree:doc.papers.filter(p=>p.exam==='gaokao').map(p=>
      ({path:p.source.path,type:'blob',sha:p.source.gitBlobSha}))};
    const postgrad={truncated:false,tree:doc.papers.flatMap(p=>p.questionImages).map(p=>
      ({path:p.path,type:'blob',sha:p.gitBlobSha}))};
    const g=join(dir,'gaokao.json'),k=join(dir,'postgrad.json');
    const save=async()=>{await writeFile(g,JSON.stringify(gaokao));await writeFile(k,JSON.stringify(postgrad));};
    const args=['--gaokao-tree',g,'--postgrad-tree',k];
    await save();
    const good=JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8'})) as {
      status:string;pdfBlobMatches:number;postgradQuestionBlobMatches:number;
    };
    assert.equal(good.status,'pinned_git_blob_identity_confirmed_not_math_golden');
    assert.equal(good.pdfBlobMatches,36);
    assert.equal(good.postgradQuestionBlobMatches,264);
    gaokao.tree[0]!.sha='tampered';
    await save();
    let bad=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.notEqual(bad.status,0);
    assert.match(bad.stderr,/PDF SHA drift/u);
    gaokao.tree[0]!.sha=doc.papers.find(p=>p.exam==='gaokao')!.source.gitBlobSha;
    postgrad.tree[0]!.sha='tampered';
    await save();
    bad=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.notEqual(bad.status,0);
    assert.match(bad.stderr,/PNG SHA drift/u);
    postgrad.truncated=true;postgrad.tree[0]!.sha=doc.papers.flatMap(p=>p.questionImages)[0]!.gitBlobSha;
    await save();
    bad=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.notEqual(bad.status,0);
    assert.match(bad.stderr,/partial or malformed Git tree/u);
  }finally{await rm(dir,{recursive:true,force:true});}
});
