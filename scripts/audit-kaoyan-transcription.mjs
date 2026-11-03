#!/usr/bin/env node
/**
 * Research-only transcription preflight for external exam Markdown.
 * This checks shape/source identity, not mathematical correctness.
 * Original third-party papers and solutions are never bundled here.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function gitBlobSha(content) {
  const bytes=Buffer.from(content,'utf8');
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
export function auditTranscription(markdown, manifest) {
  if(typeof markdown!=='string'||!markdown.trim())throw Error('empty paper Markdown');
  if(manifest?.id!=='ky2025-transcription-audit-v0.1')throw Error('unexpected manifest identity');
  const sha=gitBlobSha(markdown);
  const sourceMatched=sha===manifest.gitBlobSha;
  const lines=markdown.split(/\r?\n/u);
  const findings=[];
  const record=(question,code,details,sourceLine=null,origin='static_check')=>
    findings.push({question,code,details,sourceLine,origin});
  if(!sourceMatched)record(null,'SOURCE_BLOB_MISMATCH','External Markdown does not match pinned Git blob; all manual observations require re-review');
  const start=lines.findIndex(x=>/^#\s*一、选择题/u.test(x));
  const end=lines.findIndex((x,i)=>i>start && /^#\s*二、填空题/u.test(x));
  if(start<0||end<=start)record(null,'SECTION_UNDETERMINED','Cannot locate choice/blank question sections');
  const starts=[];
  if(start>=0&&end>start){
    for(let i=start+1;i<end;i++){
      const m=/^\s*(10|[1-9])．/u.exec(lines[i]);
      if(m)starts.push({number:Number(m[1]),index:i});
    }
  }
  const expected=Array.from({length:10},(_,i)=>i+1);
  if(JSON.stringify(starts.map(x=>x.number))!==JSON.stringify(expected))
    record(null,'QUESTION_COUNT_OR_ORDER','Expected numbered multiple-choice questions 1–10');
  for(let i=0;i<starts.length;i++){
    const {number,index}=starts[i];
    const next=starts[i+1]?.index??end;
    const block=lines.slice(index,next);
    const ai=block.findIndex(x=>x.includes('【答案】'));
    if(ai<0){record(number,'MISSING_KEY_FIELD','No answer marker',index+1);continue;}
    const answer=block[ai].split('【答案】').slice(1).join('【答案】').trim();
    if(!answer)record(number,'EMPTY_ANSWER_KEY','Answer field is blank',index+ai+1);
    else if(!/^[A-D]$/u.test(answer))record(number,'UNPARSEABLE_CHOICE_KEY','Not a single A–D key',index+ai+1);
    const questionText=block.slice(0,ai).join('\n');
    const optionLetters=new Set(Array.from(questionText.matchAll(/(?:^|[\s（(])([A-D])(?:[．.、）)])/gmu),m=>m[1]));
    const missing=['A','B','C','D'].filter(x=>!optionLetters.has(x));
    if(missing.length)record(number,'MISSING_OPTION_LABELS','Missing explicit labels: '+missing.join(','),index+1);
    const puaLine=block.slice(0,ai).findIndex(x=>/[\uE000-\uF8FF]/u.test(x));
    if(puaLine>=0)record(number,'CORRUPT_PRIVATE_USE_GLYPHS','Potential PDF extraction glyphs in question',index+puaLine+1);
  }
  for(const item of manifest.manualChecks??[]){
    if(!Number.isInteger(item.question)||!item.needle||!item.pdfPage)
      throw Error('invalid manual anchor');
    const qStart=starts.find(x=>x.number===item.question)?.index;
    const qEnd=starts.find(x=>x.number===item.question+1)?.index??end;
    const idx=qStart===undefined?-1:lines.findIndex((line,i)=>i>=qStart&&i<qEnd&&line.includes(item.needle));
    if(idx<0)record(item.question,'MANUAL_ANCHOR_NOT_FOUND','Previously observed text was changed; re-review PDF needed',null,'manual_anchor');
    else if(sourceMatched)record(item.question,item.code,item.details,idx+1,'manual_pdf_comparison');
  }
  return {status:findings.length?'blocked_for_gold':'requires_independent_math_and_pdf_review',
    scope:'Source-text preflight only; no verified mathematical answers or official paper authentication',
    source:{repository:manifest.repository,revision:manifest.revision,path:manifest.path,expectedGitBlobSha:manifest.gitBlobSha,actualGitBlobSha:sha,sourceMatched},
    summary:{expectedChoiceQuestions:10,foundChoiceQuestions:starts.length,findings:findings.length,
      blockedChoiceQuestions:new Set(findings.filter(x=>x.question&&x.code!=='SOURCE_BLOB_MISMATCH').map(x=>x.question)).size},
    findings};
}
async function main(){
  let input=null,manifest=new URL('../fixtures/research/kaoyan-math1-2025-transcription-audit-v0.1.json',import.meta.url),strict=false;
  const argv=process.argv.slice(2);
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input'&&argv[i+1])input=resolve(argv[++i]);
    else if(argv[i]==='--manifest'&&argv[i+1])manifest=resolve(argv[++i]);
    else if(argv[i]==='--require-clean')strict=true;
    else throw Error('unknown or incomplete argument: '+argv[i]);
  }
  if(!input)throw Error('Supply --input <downloaded third-party Markdown>; no source text is bundled');
  const result=auditTranscription(await readFile(input,'utf8'),JSON.parse(await readFile(manifest,'utf8')));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(strict&&result.status!=='requires_independent_math_and_pdf_review')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
