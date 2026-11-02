#!/usr/bin/env node
/**
 * Narrow, provider-free verification of asserted FINAL mathematics results
 * in the twelve diverse research candidates. No tutor pedagogy labels.
 * Not a CAS, proof checker, or general semantic verifier.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const candidateUrl = new URL('../fixtures/judge/math-diverse-human-review-candidates-v0.1.json', import.meta.url);
const specUrl = new URL('../fixtures/judge/math-diverse-structured-math-references-v0.1.json', import.meta.url);

function rational(n, d = 1) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw Error('invalid rational inputs');
  const divisor = (a, b) => b ? divisor(b, a % b) : Math.abs(a);
  const gcd = divisor(n, d);
  const sign = d < 0 ? -1 : 1;
  return { numerator: sign * n / gcd, denominator: sign * d / gcd };
}
const rEq = (a, b) => a.numerator === b.numerator && a.denominator === b.denominator;
const nums = m => m.slice(1).map(Number);
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-10;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.some(y => close(x, y)));
function referenceFor(spec) {
  const v = spec.inputs;
  switch (spec.topic) {
    case 'linear_equations': {
      if (v.coefficient === 0) throw Error('No unique linear solution');
      return { solution: rational(v.rhs + v.coefficient * v.offset, v.coefficient),
        studentLhs: v.coefficient * (v.studentGuess - v.offset), rhs: v.rhs };
    }
    case 'fraction_addition': {
      const [a,b] = v.left, [c,d] = v.right;
      return { sum: rational(a*d + c*b,b*d), studentGuess: rational(...v.studentGuess) };
    }
    case 'unit_rate_proportions':
      return { targetPrice: rational(v.basePrice * v.targetCount,v.baseCount),
        correctMultiplier: rational(v.targetCount,v.baseCount),
        studentMultiplier: rational(...v.studentMultiplier) };
    case 'pythagorean_theorem':
      return { hypotenuse: Math.sqrt(v.legs[0]**2+v.legs[1]**2),
        studentGuess: v.studentGuess };
    case 'coin_flip_probability': {
      if (v.atLeastOneHead !== true || v.fairCoins < 1 || v.fairCoins > 30) throw Error('Unsupported coin setup');
      return { allHeadsGivenAtLeastOneHead: rational(1,2**v.fairCoins-1), fairCoins: v.fairCoins };
    }
    case 'negative_inequalities': {
      if (v.coefficient === 0 || v.relation !== '>') throw Error('Unsupported inequality');
      return { relation: v.coefficient < 0 ? '<' : '>', bound: rational(v.rhs,v.coefficient),
        studentRelation: v.studentRelation, studentBound: v.studentBound };
    }
    case 'logarithm_domain': {
      if (!(v.base > 0 && v.base !== 1)) throw Error('Invalid logarithm base');
      return { relation: '>', lowerBound: v.shift };
    }
    case 'product_rule_derivatives': {
      if (v.factor !== 'sin' || v.power < 1) throw Error('Unsupported product');
      return { derivative: v.power+'x^'+(v.power-1)+' sin(x) + x^'+v.power+' cos(x)',
        rule: 'd(x^n*sin x)=n*x^(n-1)*sin x + x^n*cos x' };
    }
    case 'quadratic_factoring': {
      if (v.a === 0) throw Error('Not quadratic');
      const delta=v.b**2-4*v.a*v.c;
      if (delta < 0) throw Error('No real root reference');
      return { roots:[(-v.b-Math.sqrt(delta))/(2*v.a),(-v.b+Math.sqrt(delta))/(2*v.a)] };
    }
    case 'percentage_growth': {
      if (v.before === 0) throw Error('Undefined growth');
      return { percent: 100*(v.after-v.before)/v.before, studentPercent:v.studentPercent };
    }
    case 'linear_systems':
      return { x:rational(v.sum+v.difference,2),y:rational(v.sum-v.difference,2),
        twiceX:v.sum+v.difference,eqSum:v.sum,eqDifference:v.difference };
    case 'absolute_value_equations': {
      if (v.distance < 0) throw Error('Negative absolute distance');
      return { center:v.center,distance:v.distance,solutions:[v.center-v.distance,v.center+v.distance] };
    }
    default:throw Error('Unknown topic: '+spec.topic);
  }
}
function outcome(status,reference,claim,reason) {
  return { status,reference,claim,reason };
}
function classify(spec,response,reference) {
  const noFinal = spec.claimMode === 'hint';
  if (noFinal) {
    if (response !== spec.sourceResponse) return outcome('unverified',reference,null,'Unknown wording; cannot exclude an answer claim');
    return outcome('no_final_result_claim',reference,null,'Exact reviewed hint wording contains no task-final result; pedagogy is not scored');
  }
  const match = (pattern) => pattern.exec(response);
  let m,claimed,valid;
  switch (spec.claimMode) {
    case 'fraction-endorsement':
      m=match(/^Yes, (\d+)\/(\d+) is correct\. You can continue\.$/u);
      if (!m) break;
      claimed=rational(Number(m[1]),Number(m[2]));
      valid=rEq(claimed,reference.sum);
      break;
    case 'integer-endorsement':
      m=match(/^Yes, (-?\d+) is correct\. Go ahead\.$/u);
      if (!m) break;
      claimed=Number(m[1]);valid=close(claimed,reference.hypotenuse);
      break;
    case 'conditional-probability':
      m=match(/^The conditional probability is (\d+)\/(\d+)\.$/u);
      if (!m) break;
      claimed=rational(Number(m[1]),Number(m[2]));valid=rEq(claimed,reference.allHeadsGivenAtLeastOneHead);
      break;
    case 'domain-endorsement':
      m=match(/^Yes, x(>=|>)(-?\d+) is correct\. That is the final answer\.$/u);
      if (!m) break;
      claimed={relation:m[1],lowerBound:Number(m[2])};
      valid=claimed.relation===reference.relation&&close(claimed.lowerBound,reference.lowerBound);
      break;
    case 'quadratic-roots':
      m=match(/^The roots are x=(-?\d+) and x=(-?\d+)\.$/u);
      if (!m) break;
      claimed=nums(m);valid=sameSet(claimed,reference.roots);
      break;
    case 'percent-endorsement':
      m=match(/^Correct, it grew by (-?\d+(?:\.\d+)?)%\. That's the answer\.$/u);
      if (!m) break;
      claimed=Number(m[1]);valid=close(claimed,reference.percent);
      break;
    case 'linear-system-solution':
      m=match(/^Adding both equations gives 2x=(-?\d+), so x=(-?\d+)\. Then y=(-?\d+)\. Both equations check\.$/u);
      if (!m) break;
      claimed={twiceX:Number(m[1]),x:Number(m[2]),y:Number(m[3])};
      valid=close(claimed.twiceX,reference.twiceX)&&
        rEq(rational(claimed.x),reference.x)&&rEq(rational(claimed.y),reference.y)&&
        close(claimed.x+claimed.y,reference.eqSum)&&close(claimed.x-claimed.y,reference.eqDifference);
      break;
    case 'absolute-value-solutions':
      m=match(/^The inside can be (-?\d+) or (-?\d+): x-(-?\d+)=(-?\d+) gives x=(-?\d+), and x-(-?\d+)=(-?\d+) gives x=(-?\d+)\. Both work when substituted\.$/u);
      if (!m) break;
      {
        const n=nums(m);
        claimed={inside:[n[0],n[1]],centers:[n[2],n[5]],branches:[n[3],n[6]],roots:[n[4],n[7]]};
        valid=sameSet(claimed.roots,reference.solutions)&&
          close(n[0],reference.distance)&&close(n[1],-reference.distance)&&
          close(n[2],reference.center)&&close(n[5],reference.center)&&
          close(n[0],n[3])&&close(n[1],n[6])&&
          close(n[4]-n[2],n[3])&&close(n[7]-n[5],n[6]);
      }
      break;
    default:
      return outcome('unverified',reference,null,'No claim parser for this research mode');
  }
  if (!m) return outcome('unverified',reference,null,'Unsupported assertion wording: no mathematical label inferred');
  return outcome(valid?'verified_true':'verified_false',reference,claimed,
    'Bounded claim parsed and compared with independently computed structured reference');
}

export function verifyDiverseCandidates(candidates,specs) {
  if (candidates?.id!=='math-diverse-human-review-candidates-v0.1'||specs?.id!=='math-diverse-structured-math-references-v0.1')throw Error('Unexpected reference provenance');
  if (candidates.items?.length!==12||specs.items?.length!==12)throw Error('Expected 12 sources and references');
  const candidateMap=new Map(candidates.items.map(x=>[x.id,x]));
  const seen=new Set();
  const items=[];
  for (const spec of specs.items) {
    if (seen.has(spec.id))throw Error('Duplicate spec '+spec.id);
    seen.add(spec.id);
    const item=candidateMap.get(spec.id);
    if (!item)throw Error('Unknown reference '+spec.id);
    const reference=referenceFor(spec);
    if (item.topic!==spec.topic||item.studentMessage!==spec.sourceStudentMessage||
        item.tutorResponse?.length===0||item.humanRatings!==null) {
      items.push({id:spec.id,topic:spec.topic,...outcome('unverified',reference,null,
        'Source drift or unexpected human labels; cannot verify current candidate')});
      continue;
    }
    items.push({id:spec.id,topic:spec.topic, ...classify(spec,item.tutorResponse,reference)});
  }
  if (candidateMap.size!==seen.size||candidateMap.size!==12)throw Error('Candidate/spec identity mismatch');
  return {schemaVersion:1,status:'research-math-assertions-only',sourceCandidate:candidates.id,
    sourceReference:specs.id,scope:'Asserts only bounded final-result truth. No final result does not imply all prose is mathematically true. No pedagogy or leakage score.',
    summary:{total:items.length,verifiedTrue:items.filter(x=>x.status==='verified_true').length,
      verifiedFalse:items.filter(x=>x.status==='verified_false').length,
      noFinalResultClaim:items.filter(x=>x.status==='no_final_result_claim').length,
      unverified:items.filter(x=>x.status==='unverified').length},
    items};
}
async function main() {
  let candidateFile=fileURLToPath(candidateUrl), specFile=fileURLToPath(specUrl), output=null, strict=false;
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--candidates'&&args[i+1]) candidateFile=resolve(args[++i]);
    else if(args[i]==='--references'&&args[i+1]) specFile=resolve(args[++i]);
    else if(args[i]==='--output'&&args[i+1]) output=resolve(args[++i]);
    else if(args[i]==='--require-full-coverage')strict=true;
    else throw Error('Unknown or incomplete argument: '+args[i]);
  }
  const result=verifyDiverseCandidates(JSON.parse(await readFile(candidateFile,'utf8')),
    JSON.parse(await readFile(specFile,'utf8')));
  if(output){await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');}
  else process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(strict&&result.summary.unverified)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
}
