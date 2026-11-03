#!/usr/bin/env node
/** Research-only typed mathematics verifier for source-reviewed exam examples.
 * Never scores pedagogy, proofs, or unparsed natural language. No provider calls.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const defaultFixture = new URL('../fixtures/research/exam-real-paper-pilot-v0.1.json', import.meta.url);
const defaultCatalog = new URL('../fixtures/research/exam-paper-source-catalog-v0.1.json', import.meta.url);

const isInt = Number.isSafeInteger;
function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;}
function rat(n,d=1n){
  if(d===0n)throw Error('zero denominator');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d);return {n:n/g,d:d/g};
}
function safeInt(n){if(!isInt(n))throw Error('unsafe structured integer');return BigInt(n);}
const sub=(a,b)=>rat(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>rat(a.n*b.n,a.d*b.d);
const equal=(a,b)=>a.n===b.n && a.d===b.d;
const pretty=q=>q.d===1n?q.n.toString():q.n+'/'+q.d;
function parseNumber(value){
  if(typeof value!=='string'||value.length>64)return null;
  const s=value.trim();let m=/^([+-]?\d{1,30})(?:\/(\d{1,30}))?$/.exec(s);
  if(m){try{return rat(BigInt(m[1]),BigInt(m[2]??'1'));}catch{return null;}}
  m=/^([+-]?)(\d{1,25})\.(\d{1,25})$/.exec(s);
  if(m){try{return rat(BigInt((m[1]||'')+m[2]+m[3]),10n**BigInt(m[3].length));}catch{return null;}}
  return null;
}
function reference(task){
  const p=task.parameters;
  switch(task.family){
    case 'complex-times-i-imaginary':
      if(p.multiplyBy!=='i')throw Error('unsupported complex multiplier');
      safeInt(p.imaginary);return rat(safeInt(p.real));
    case 'finite-complement-count':{
      const n=safeInt(p.universeMaxExclusive);
      if(n<2n||n>10000n||!Array.isArray(p.excluded))throw Error('unsupported finite universe');
      const excluded=new Set(p.excluded.map(x=>safeInt(x).toString()));
      if(excluded.size!==p.excluded.length)throw Error('duplicate excluded elements');
      for(const v of excluded)if(BigInt(v)<1n||BigInt(v)>=n)throw Error('excluded item outside universe');
      return rat(n-1n-BigInt(excluded.size));
    }
    case 'exp-linear-tangent-shift':{
      const [b,c,m,k,x0]=[p.expCoefficient,p.linearCoefficient,p.tangentSlope,p.tangentIntercept,p.tangentAt];
      if(x0!==0||b<=0||![b,c,m,k].every(isInt)||m!==b+c)throw Error('unsupported tangent configuration');
      return rat(BigInt(k-b));
    }
    case 'positive-geometric-ratio-from-sums':{
      const s4=safeInt(p.sum4),s8=safeInt(p.sum8);
      if(s4<=0n||s8<=s4)throw Error('unsupported geometric sums');
      const q4=rat(s8-s4,s4);
      if(q4.d!==1n||q4.n>1000n**4n)throw Error('non-integral or out-of-scope root');
      for(let k=1n;k<=1000n;k++)if(k**4n===q4.n)return rat(k);
      throw Error('non-integral positive ratio not in current grammar');
    }
    case 'distinct-draws-expectation':{
      const n=safeInt(p.numberedObjects),k=safeInt(p.draws);
      if(n<1n||n>1000n||k<0n||k>100n||p.replacement!==true)throw Error('unsupported draws');
      return sub(rat(n),mul(rat(n),rat((n-1n)**k,n**k)));
    }
    case 'odd-sample-median':{
      if(!Array.isArray(p.values)||p.values.length<1||p.values.length%2===0||p.values.length>101)throw Error('unsupported median');
      const sorted=p.values.map(safeInt).sort((a,b)=>a<b?-1:a>b?1:0);
      return rat(sorted[(sorted.length-1)/2]);
    }
    case 'poisson-xy-independent-difference':{
      const x=safeInt(p.lambdaX),y=safeInt(p.lambdaY);
      if(x<0n||y<x||p.independence!=='X independent of X_minus_Y')throw Error('unsupported Poisson assumptions');
      // Cov(X,Y)=Var(X) when X is independent of X-Y; E[XY]=lambdaX*(lambdaY+1).
      return rat(x*(y+1n));
    }
    default:throw Error('no verified solver for task family');
  }
}
function evaluate(task,sources){
  const base={id:task.id,exam:task.exam,year:task.year,question:task.question};
  const source=sources.get(task.exam+':'+task.year);
  if(!source||source.status!=='page_checked'||source.url!==task.sourceUrl||
    !isInt(task.sourcePage)||task.sourcePage<1||
    !Array.isArray(source.checkedPages)||!source.checkedPages.includes(task.sourcePage)){
    return {...base,status:'unverified',reason:'source provenance not page-checked',reference:null};
  }
  try{
    const expected=reference(task);
    let claim;
    if(task.answerFormat==='option'){
      if(typeof task.candidateAnswer!=='string'||!/^[A-D]$/.test(task.candidateAnswer)||
        !task.options||Object.keys(task.options).sort().join('')!=='ABCD')throw Error('unsupported choice formatting');
      claim=parseNumber(task.options[task.candidateAnswer]);
    }else if(task.answerFormat==='numeric')claim=parseNumber(task.candidateAnswer);
    else throw Error('unsupported answer format');
    if(!claim)throw Error('non-numeric or ambiguous candidate');
    return {...base,status:equal(claim,expected)?'verified_true':'verified_false',
      reference:pretty(expected),claim:pretty(claim),
      reason:'exact typed-family comparison; no proof of source transcription or pedagogy'};
  }catch(e){return {...base,status:'unverified',reference:null,reason:String(e.message??e)};}
}
export function verifyExamPilot(fixture,catalog){
  if(fixture?.id!=='exam-real-paper-pilot-v0.1'||catalog?.id!=='exam-paper-source-catalog-v0.1')
    throw Error('unexpected fixture identity');
  if(!Array.isArray(fixture.items)||!Array.isArray(catalog.papers)||catalog.papers.length!==10)
    throw Error('invalid corpus manifest');
  const sources=new Map(catalog.papers.map(x=>[x.exam+':'+x.year,x]));
  if(sources.size!==10)throw Error('duplicate paper in catalog');
  const seen=new Set(),items=[];
  for(const task of fixture.items){
    if(seen.has(task.id))throw Error('duplicate item id');
    seen.add(task.id);items.push(evaluate(task,sources));
  }
  return {status:'research-only-noncanonical',
    scope:'Bounded mathematical answers for hand-transcribed real-paper examples, not automatic examination scoring',
    summary:{total:items.length,verifiedTrue:items.filter(x=>x.status==='verified_true').length,
      verifiedFalse:items.filter(x=>x.status==='verified_false').length,
      unverified:items.filter(x=>x.status==='unverified').length,papersInCatalog:catalog.papers.length,
      papersWithExamples:new Set(items.map(x=>x.exam+':'+x.year)).size},items};
}
async function main(){
  const args=process.argv.slice(2);
  let strict=false,fixture=fileURLToPath(defaultFixture),catalog=fileURLToPath(defaultCatalog);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--require-full-coverage')strict=true;
    else if(args[i]==='--fixture'&&args[i+1])fixture=resolve(args[++i]);
    else if(args[i]==='--catalog'&&args[i+1])catalog=resolve(args[++i]);
    else throw Error('unknown argument '+args[i]);
  }
  const result=verifyExamPilot(JSON.parse(await readFile(fixture,'utf8')),JSON.parse(await readFile(catalog,'utf8')));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(strict&&result.summary.unverified)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
