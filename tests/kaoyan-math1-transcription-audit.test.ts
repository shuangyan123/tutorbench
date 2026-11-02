import assert from 'node:assert/strict';
import test from 'node:test';

const load=async()=>import('../scripts/audit-kaoyan-transcription.mjs') as Promise<{
  gitBlobSha:(v:string)=>string;
  auditTranscription:(v:string,manifest:unknown)=>{status:string;summary:{findings:number;foundChoiceQuestions:number};findings:Array<{code:string;question:number|null}>;source:{sourceMatched:boolean}};
}>;
function source(choice8=''){
  return ['# 一、选择题',...Array.from({length:10},(_,i)=>{
    const n=i+1;return n+'．题目\\nA．1\\nB．2\\nC．3\\nD．4\\n【答案】'+(n===8?choice8:'B');
  }).flatMap(x=>x.split(String.fromCharCode(92,110))),'# 二、填空题'].join(String.fromCharCode(10));
}
test('transcription gate finds missing answers and refuses a changed source',async()=>{
  const {gitBlobSha,auditTranscription}=await load();
  const text=source();
  const manifest={id:'ky2025-transcription-audit-v0.1',gitBlobSha:gitBlobSha(text),manualChecks:[]};
  const result=auditTranscription(text,manifest);
  assert.equal(result.source.sourceMatched,true);
  assert.equal(result.summary.foundChoiceQuestions,10);
  assert.equal(result.status,'blocked_for_gold');
  assert.ok(result.findings.some(x=>x.question===8&&x.code==='EMPTY_ANSWER_KEY'));
  const changed=auditTranscription(text+'\\nchanged',manifest);
  assert.ok(changed.findings.some(x=>x.code==='SOURCE_BLOB_MISMATCH'));
});
test('manual anchors are scoped to the correct question',async()=>{
  const {gitBlobSha,auditTranscription}=await load();
  const text=source('C');
  const manifest={id:'ky2025-transcription-audit-v0.1',gitBlobSha:gitBlobSha(text),
    manualChecks:[{question:8,needle:'【答案】',code:'REVIEW_REQUIRED',details:'manual',pdfPage:2}]};
  const result=auditTranscription(text,manifest);
  assert.ok(result.findings.some(x=>x.question===8&&x.code==='REVIEW_REQUIRED'));
  assert.equal(result.findings.some(x=>x.code==='MANUAL_ANCHOR_NOT_FOUND'),false);
  const mismatch={...manifest,manualChecks:[{question:8,needle:'1．题目',code:'REVIEW_REQUIRED',details:'manual',pdfPage:2}]};
  assert.ok(auditTranscription(text,mismatch).findings.some(x=>x.code==='MANUAL_ANCHOR_NOT_FOUND'));
});
