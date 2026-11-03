#!/usr/bin/env node
/**
 * Audit structural question identifiers in a SHA-pinned third-party Markdown transcription.
 * This is not a PDF checker, a mathematics verifier, or an answer-key validator.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha1GitBlob=content=>{
  const data=Buffer.from(content,'utf8');
  return createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
};
function questionHeading(line){
  const m=/^\s*(?:【(\d{1,2})】|(\d{1,2})[．.])(?=\s|[^\d])/u.exec(line);
  return m?Number(m[1]??m[2]):null;
}
export function auditHeadings(markdown,manifest){
  if(!markdown?.trim()||manifest?.id!=='kaoyan-math1-2024-markdown-integrity-v0.1')
    throw Error('unexpected source or manifest');
  const actualSha=sha1GitBlob(markdown);
  const expectedSha=manifest.source?.gitBlobSha;
  if(!/^[a-f0-9]{40}$/u.test(expectedSha))throw Error('invalid pinned blob SHA');
  const lines=markdown.split(/\r?\n/u);
  const headings=[],embedded=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const q=questionHeading(line);
    if(q!==null)headings.push({question:q,line:i+1});
    for(const m of line.matchAll(/【(\d{1,2})】/gu)){
      const n=Number(m[1]);
      if(n!==q)embedded.push({question:n,line:i+1});
    }
  }
  const expected=manifest.expectedQuestionNumbers;
  if(!Array.isArray(expected)||expected.length!==22||expected.some((q,i)=>q!==i+1))
    throw Error('invalid expected question identifiers');
  const counts=new Map();
  for(const row of headings)counts.set(row.question,(counts.get(row.question)??0)+1);
  const missing=expected.filter(n=>!counts.has(n));
  const duplicates=[...counts].filter(([q,n])=>expected.includes(q)&&n!==1).map(([q])=>q);
  const unexpected=[...counts.keys()].filter(q=>!expected.includes(q));
  const mismatched=actualSha!==expectedSha;
  return {
    status:mismatched||missing.length||duplicates.length||unexpected.length||embedded.length?'blocked_for_gold':'structure_only_not_gold',
    sourceMatched:!mismatched,actualGitBlobSha:actualSha,expectedGitBlobSha:expectedSha,
    scope:'Only detects question identifiers, not OCR accuracy, official exam provenance, mathematical solutions or answer correctness.',
    summary:{expectedQuestions:22,recognizedHeadings:headings.length,missing:missing.length,embedded:embedded.length,duplicates:duplicates.length,unexpected:unexpected.length},
    missing,duplicates,unexpected,embedded,headings,
  };
}
async function main(){
  const args=process.argv.slice(2);
  let input=null,manifest=fileURLToPath(new URL('../fixtures/research/kaoyan-math1-2024-markdown-integrity-v0.1.json',import.meta.url)),strict=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--input'&&args[i+1])input=resolve(args[++i]);
    else if(args[i]==='--manifest'&&args[i+1])manifest=resolve(args[++i]);
    else if(args[i]==='--require-clean')strict=true;
    else throw Error('unknown or incomplete argument: '+args[i]);
  }
  if(!input)throw Error('Provide --input <externally-downloaded-Markdown>');
  const result=auditHeadings(await readFile(input,'utf8'),JSON.parse(await readFile(manifest,'utf8')));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(strict&&result.status!=='structure_only_not_gold')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
}
