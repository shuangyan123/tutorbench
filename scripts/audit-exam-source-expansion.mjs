#!/usr/bin/env node
/** Research-only exam SOURCE coverage, not answer correctness, not official gold. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const YEARS = [2022,2023,2024,2025,2026];
const GAOKAO_COUNTS = {2022:10,2023:9,2024:7,2025:5,2026:5};
const SUBJECTS = ['math-1','math-2','math-3'];
const SLUGS = {'上海':'shanghai','北京':'beijing','天津':'tianjin','浙江':'zhejiang',
  '全国乙文':'national-b-humanities','全国乙理':'national-b-science',
  '全国甲文':'national-a-humanities','全国甲理':'national-a-science',
  '新高考1':'new-gaokao-1','新高考2':'new-gaokao-2','全国文':'national-humanities',
  '全国理':'national-science','全国1':'national-1','全国2':'national-2'};
const SHA = /^[a-f0-9]{40}$/u;
const defaultManifest = new URL('../fixtures/research/exam-source-expansion-2022-2026-v0.1.json',import.meta.url);
function fail(reason){throw Error('invalid_source_manifest: '+reason);}
function ensure(ok,reason){if(!ok)fail(reason);}
function sourceChecks(entry){
  const s=entry.source;
  ensure(s && typeof s==='object','missing source object');
  ensure(SHA.test(s.revision),'unpinned repository revision');
  if(entry.exam==='gaokao')ensure(SHA.test(s.gitBlobSha),'unpinned PDF blob');
  ensure(typeof s.repository==='string'&&s.repository.includes('/'),'missing repository');
  ensure(typeof s.url==='string' && s.url.startsWith('https://github.com/'+s.repository+'/blob/'+s.revision+'/'),'source URL does not match immutable revision');
  ensure(typeof s.path==='string'&&s.path.length>8,'missing source path');
  ensure(s.rawPaperInspected===false && s.questionCountVerified===false && s.answersIndependentlyVerified===false,'unexpected unverified source promotion');
  ensure(typeof s.permissionNote==='string' && s.permissionNote.length>30,'missing copyright review warning');
  ensure(entry.answerGoldStatus==='not_verified','answer gold not independently certified');
}
export function auditExpandedSources(doc){
  ensure(doc?.schemaVersion===1&&doc?.id==='exam-source-expansion-2022-2026-v0.1','wrong manifest identity');
  ensure(doc.status==='source-discovery-only-not-an-answer-key'&&doc.sourcePolicy?.noAnswerGoldIncluded===true,'false gold or source status');
  ensure(Array.isArray(doc.papers)&&doc.papers.length===51,'must enumerate 51 distinct paper editions');
  ensure(Array.isArray(doc.years)&&JSON.stringify(doc.years)===JSON.stringify(YEARS),'wrong requested years');
  const seen=new Set();
  const summary={paperEditions:doc.papers.length,gaokaoPdfBlobs:0,postgradExamYears:0,
    postgradImageIndexedYears:0,postgradQuestionImageBlobs:0,postgrad2026NotIndexed:0,
    paperKeysCertified:0,questionResultsCertified:0,paperEditionsActuallyMathGraded:0,
    catalogCompletenessPercent:100,questionVerificationCoveragePercent:null};
  const gaokaoByYear={};
  for(const p of doc.papers){
    ensure(typeof p.paperId==='string'&&!seen.has(p.paperId),'duplicate or missing paperId');
    seen.add(p.paperId);
    ensure(YEARS.includes(p.year),'year out of scope');
    sourceChecks(p);
    if(p.exam==='gaokao'){
      ensure(p.paperId==='gaokao-'+p.year+'-'+SLUGS[p.variant],'unstable gaokao edition ID');
      ensure(p.source.fileKind==='pdf'&&p.source.presence==='repository_tree_blob_only','gaokao source must be a pinned PDF tree blob');
      ensure(p.source.repository==='deekur/gaokaomath','unexpected gaokao repository');
      ensure(p.source.path.startsWith('普通高考/'+p.year+'/'+p.year)&&p.source.path.endsWith('.pdf'),'gaokao PDF filename mismatch');
      ensure(p.questionCountFromSource===null&&Array.isArray(p.questionImages)&&p.questionImages.length===0,'gaokao questions not manually enumerated');
      gaokaoByYear[p.year]=(gaokaoByYear[p.year]??0)+1;
      summary.gaokaoPdfBlobs++;
    }else if(p.exam==='kaoyan'){
      ensure(SUBJECTS.includes(p.variant)&&p.paperId==='kaoyan-'+p.variant+'-'+p.year,'unknown or wrong postgrad paper ID');
      ensure(p.source.repository==='lx-ruc/kaoyanshuxue'&&p.source.fileKind==='question_images','postgrad source mismatch');
      ensure(Array.isArray(p.questionImages),'postgrad image inventory missing');
      summary.postgradExamYears++;
      if(p.year<=2025){
        ensure(p.source.presence==='22_question_image_paths_in_repository_tree'&&p.questionImages.length===22&&p.questionCountFromSource===22,'postgrad image inventory incomplete');
        const n=new Set();
        for(const q of p.questionImages){
          ensure(Number.isInteger(q.question) && q.question>=1&&q.question<=22 && !n.has(q.question),'duplicated/out of range postgraduate question');
          n.add(q.question);
          const namePattern=new RegExp('^Q'+String(q.question).padStart(2,'0')+'_id[0-9]+\\.png$','u');
          ensure(SHA.test(q.gitBlobSha) && q.path.startsWith(p.source.path+'/') &&
            namePattern.test(q.path.split('/').at(-1)),'untrusted postgraduate question blob path');
        }
        summary.postgradImageIndexedYears++;
        summary.postgradQuestionImageBlobs+=p.questionImages.length;
      }else{
        ensure(p.questionImages.length===0&&p.questionCountFromSource===null&&p.source.presence==='absent_from_pinned_repository','2026 postgrad not sourced from this repository');
        ensure(p.fallbackDiscovery?.status.includes('not_official_gold')||p.fallbackDiscovery?.status==='index_only_no_exam_file_pinned','2026 fallback incorrectly promoted');
        summary.postgrad2026NotIndexed++;
      }
    }else fail('unexpected exam');
  }
  for(const year of YEARS)ensure(gaokaoByYear[year]===GAOKAO_COUNTS[year],'gaokao edition count drift '+year);
  for(const kind of SUBJECTS)for(const year of YEARS)
    ensure(seen.has('kaoyan-'+kind+'-'+year),'postgrad variant missing '+kind+':'+year);
  ensure(summary.gaokaoPdfBlobs===36 && summary.postgradQuestionImageBlobs===264 &&
    summary.postgrad2026NotIndexed===3,'total source coverage incomplete');
  return {status:'source_manifest_checked_not_math_verified',
    scope:'Source discovery and file identities only; no paper/answer authenticity or mathematical validation',
    summary,gaokaoByYear};
}
async function main(){
  const args=process.argv.slice(2);let manifest=fileURLToPath(defaultManifest);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--manifest'&&args[i+1])manifest=resolve(args[++i]);
    else throw Error('unknown or incomplete argument '+args[i]);
  }
  const result=auditExpandedSources(JSON.parse(await readFile(manifest,'utf8')));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
