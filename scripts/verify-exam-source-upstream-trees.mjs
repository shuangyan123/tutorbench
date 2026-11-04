#!/usr/bin/env node
/** Git tree identity check only. No image/PDF contents or exam answers are read. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultCatalog=new URL('../fixtures/research/exam-source-expansion-2022-2026-v0.1.json',import.meta.url);
function requireMatch(ok,message){if(!ok)throw Error('source_tree_mismatch: '+message);}
function indexed(tree){
  requireMatch(tree && tree.truncated===false && Array.isArray(tree.tree),'partial or malformed Git tree');
  const map=new Map();
  for(const node of tree.tree){
    requireMatch(typeof node.path==='string','missing tree path');
    requireMatch(!map.has(node.path),'duplicate tree path');
    map.set(node.path,node);
  }
  return map;
}
export function validateAgainstTrees(doc,gaokaoTree,postgradTree){
  requireMatch(doc?.id==='exam-source-expansion-2022-2026-v0.1','wrong source catalog');
  const g=indexed(gaokaoTree),k=indexed(postgradTree);
  let pdfs=0,questionImages=0,yearFolders=0;
  for(const p of doc.papers){
    if(p.exam==='gaokao'){
      const node=g.get(p.source.path);
      requireMatch(node?.type==='blob'&&node.sha===p.source.gitBlobSha,'PDF SHA drift '+p.paperId);
      pdfs++;
    } else if(p.exam==='kaoyan') {
      const sourceRoot=p.source.path+'/';
      const matches=[...k].filter(([name,node])=>name.startsWith(sourceRoot)&&
        node.type==='blob'&&/^Q\d\d_id\d+\.png$/u.test(name.slice(sourceRoot.length)));
      requireMatch(matches.length===p.questionImages.length,'image count drift '+p.paperId);
      if(p.year<2026){
        requireMatch(matches.length===22,'expected 22 image blobs '+p.paperId);
        for(const file of p.questionImages){
          const node=k.get(file.path);
          requireMatch(node?.type==='blob'&&node.sha===file.gitBlobSha,'PNG SHA drift '+p.paperId+':Q'+file.question);
          questionImages++;
        }
        yearFolders++;
      }else requireMatch(matches.length===0,'2026 indexed source would change baseline '+p.paperId);
    }else requireMatch(false,'unexpected exam type');
  }
  requireMatch(pdfs===36&&questionImages===264&&yearFolders===12,'unexpected source totals');
  return {status:'pinned_git_blob_identity_confirmed_not_math_golden',
    scope:'Git tree path and SHA comparison only, NOT source authenticity, exam image legibility, answer correctness or license clearance',
    pdfBlobMatches:pdfs,postgradQuestionBlobMatches:questionImages,postgradYearFolders:yearFolders};
}
async function main(){
  let catalog=fileURLToPath(defaultCatalog),gaokao=null,postgrad=null;
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--catalog'&&args[i+1])catalog=resolve(args[++i]);
    else if(args[i]==='--gaokao-tree'&&args[i+1])gaokao=resolve(args[++i]);
    else if(args[i]==='--postgrad-tree'&&args[i+1])postgrad=resolve(args[++i]);
    else throw Error('unknown or incomplete argument '+args[i]);
  }
  if(!gaokao||!postgrad)throw Error('both pinned upstream Git trees are required');
  const [d,g,k]=await Promise.all([catalog,gaokao,postgrad].map(path=>readFile(path,'utf8').then(JSON.parse)));
  process.stdout.write(JSON.stringify(validateAgainstTrees(d,g,k),null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
