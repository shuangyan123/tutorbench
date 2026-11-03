#!/usr/bin/env node
/** Fail-closed gate: mathematical consistency != verified exam answer source. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultCatalog=new URL('../fixtures/research/exam-source-expansion-2022-2026-v0.1.json',import.meta.url);
const allowedMathStatus=new Set(['symbolically_equal','counterexample_found',
  'verified_complete_solution_set','refuted_solution_set','unverified']);
export function gateReferenceClaims(proposals,catalog){
  if(proposals?.schemaVersion!==1||!Array.isArray(proposals.items)||
      proposals.items.length<1||proposals.items.length>128)
    throw Error('invalid_claim_proposals');
  if(catalog?.id!=='exam-source-expansion-2022-2026-v0.1'||
      !Array.isArray(catalog.papers)||catalog.papers.length!==51)
    throw Error('unexpected_source_catalog');
  const papers=new Map(catalog.papers.map(p=>[p.paperId,p]));
  if(papers.size!==51)throw Error('duplicate_catalog_paper_id');
  const seen=new Set(),items=[];
  for(const request of proposals.items){
    if(!request||typeof request.id!=='string'||!request.id||seen.has(request.id))
      throw Error('missing_or_repeated_claim_id');
    seen.add(request.id);
    const base={id:request.id,paperId:request.paperId,question:request.question};
    if(!allowedMathStatus.has(request.mathStatus)){
      items.push({...base,mathStatus:'unverified',status:'blocked_unsupported_math_status',
        reason:'only recognized research-local math statuses can be recorded'});
      continue;
    }
    const paper=papers.get(request.paperId);
    if(!paper){
      items.push({...base,mathStatus:request.mathStatus,status:'blocked_unknown_paper',
        reason:'no pinned exam edition source record'});
      continue;
    }
    if(!Number.isInteger(request.question)||request.question<1){
      items.push({...base,mathStatus:request.mathStatus,status:'blocked_unindexed_question',
        reason:'missing/invalid question identity'});
      continue;
    }
    if(paper.exam==='kaoyan' && !paper.questionImages.some(q=>q.question===request.question)){
      items.push({...base,mathStatus:request.mathStatus,status:'blocked_unindexed_question',
        reason:'postgraduate source image not indexed at this question'});
      continue;
    }
    // The whole source corpus is discovery-only; even a mathematical proof
    // cannot authenticate a raw exam statement or its correct key.
    const trusted=paper.source.rawPaperInspected===true&&
      paper.source.answersIndependentlyVerified===true&&
      paper.answerGoldStatus==='verified';
    if(!trusted){
      items.push({...base,mathStatus:request.mathStatus,status:'blocked_source_unreviewed',
        reason:'Git object presence and symbolic computation do not validate the original exam or its answer key'});
      continue;
    }
    // This experimental gate intentionally cannot promote ANY entry. Before
    // opening the release path: require 2nd review, exact problem provenance,
    // the formal statement and mathematical proof/check artifacts.
    items.push({...base,mathStatus:request.mathStatus,status:'blocked_no_independent_evidence_contract',
      reason:'no adjudicated source-claim-math evidence bundle exists in this prototype'});
  }
  return {
    status:'no_exam_gold_releases',
    scope:'Block release of unreviewed source/discovery entries regardless of apparent symbolic math status; does not grade student responses',
    summary:{total:items.length,released:0,blocked:items.length},items};
}
async function main(){
  const argv=process.argv.slice(2);
  let catalog=fileURLToPath(defaultCatalog),proposals=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--catalog'&&argv[i+1])catalog=resolve(argv[++i]);
    else if(argv[i]==='--proposals'&&argv[i+1])proposals=resolve(argv[++i]);
    else throw Error('unknown or incomplete argument '+argv[i]);
  }
  if(!proposals)throw Error('supply --proposals <research-fixture>');
  const [req,cat]=await Promise.all([proposals,catalog].map(p=>readFile(p,'utf8').then(JSON.parse)));
  const result=gateReferenceClaims(req,cat);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
