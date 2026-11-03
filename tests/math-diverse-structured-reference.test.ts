import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = 'scripts/verify-math-diverse-candidates.mjs';
const candidatePath = 'fixtures/judge/math-diverse-human-review-candidates-v0.1.json';
type Status = 'verified_true'|'verified_false'|'no_final_result_claim'|'unverified';
interface Result {
  status: string;
  summary: { total:number; verifiedTrue:number; verifiedFalse:number; noFinalResultClaim:number; unverified:number };
  items: Array<{id:string;status:Status;reference:Record<string,unknown>;claim:unknown;reason:string}>;
}
function invoke(file=candidatePath,strict=true):Result {
  const args=[script,'--candidates',file,...(strict?['--require-full-coverage']:[])];
  return JSON.parse(execFileSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8'})) as Result;
}
function byId(result:Result,id:string) {
  const item=result.items.find(x=>x.id==='math-diverse-'+id);
  assert.ok(item);
  return item;
}
test('twelve independent task references separate truth, false assertions and non-final hints', () => {
  const result=invoke();
  assert.equal(result.status,'research-math-assertions-only');
  assert.deepEqual(result.summary,{total:12,verifiedTrue:4,verifiedFalse:4,noFinalResultClaim:4,unverified:0});
  assert.deepEqual(result.items.filter(x=>x.status==='verified_true').map(x=>x.id),['math-diverse-05','math-diverse-09','math-diverse-11','math-diverse-12']);
  assert.deepEqual(result.items.filter(x=>x.status==='verified_false').map(x=>x.id),['math-diverse-02','math-diverse-04','math-diverse-07','math-diverse-10']);
  assert.deepEqual(result.items.filter(x=>x.status==='no_final_result_claim').map(x=>x.id),['math-diverse-01','math-diverse-03','math-diverse-06','math-diverse-08']);
  assert.deepEqual(byId(result,'01').reference.solution,{numerator:6,denominator:1});
  assert.equal(byId(result,'01').reference.studentLhs,6);
  assert.deepEqual(byId(result,'02').reference.sum,{numerator:5,denominator:6});
  assert.deepEqual(byId(result,'03').reference.targetPrice,{numerator:63,denominator:2});
  assert.deepEqual(byId(result,'03').reference.correctMultiplier,{numerator:7,denominator:4});
  assert.equal(byId(result,'04').reference.hypotenuse,10);
  assert.deepEqual(byId(result,'05').reference.allHeadsGivenAtLeastOneHead,{numerator:1,denominator:7});
  assert.deepEqual(byId(result,'06').reference.bound,{numerator:-3,denominator:1});
  assert.equal(byId(result,'06').reference.relation,'<');
  assert.equal(byId(result,'07').reference.relation,'>');
  assert.equal(byId(result,'07').reference.lowerBound,3);
  assert.match(String(byId(result,'08').reference.derivative),/sin\(x\).*cos\(x\)/u);
  assert.deepEqual(byId(result,'09').reference.roots,[2,3]);
  assert.equal(byId(result,'10').reference.percent,25);
  assert.deepEqual(byId(result,'11').reference.x,{numerator:4,denominator:1});
  assert.deepEqual(byId(result,'11').reference.y,{numerator:3,denominator:1});
  assert.deepEqual(byId(result,'12').reference.solutions,[1,7]);
  assert.equal(JSON.stringify(result).includes('reviewerReason'),false);
  assert.equal(JSON.stringify(result).includes('answerLeakage'),false);
});
test('same task references change verdict when claimed final numbers change',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tutorbench-math-refs-'));
  try{
    const original=JSON.parse(await readFile(candidatePath,'utf8')) as {
      items:Array<{id:string;studentMessage:string;tutorResponse:string;humanRatings:null}>;
    };
    const variants=[
      ['02','Yes, 5/6 is correct. You can continue.','verified_true'],
      ['04','Yes, 10 is correct. Go ahead.','verified_true'],
      ['05','The conditional probability is 1/8.','verified_false'],
      ['07','Yes, x>3 is correct. That is the final answer.','verified_true'],
      ['09','The roots are x=2 and x=4.','verified_false'],
      ['10',"Correct, it grew by 25%. That's the answer.",'verified_true'],
      ['11','Adding both equations gives 2x=8, so x=3. Then y=4. Both equations check.','verified_false'],
      ['12','The inside can be 3 or -3: x-4=3 gives x=7, and x-4=-3 gives x=2. Both work when substituted.','verified_false'],
    ] as const;
    const mutated=structuredClone(original);
    for(const [suffix,response] of variants){
      const candidate=mutated.items.find(x=>x.id==='math-diverse-'+suffix);
      assert.ok(candidate);
      candidate.tutorResponse=response;
    }
    const file=join(dir,'changed-claims.json');
    await writeFile(file,JSON.stringify(mutated));
    const result=invoke(file);
    for(const [suffix,,expected] of variants) assert.equal(byId(result,suffix).status,expected,suffix);
    assert.equal(result.summary.unverified,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('repeated claimed roots cannot pass for two distinct reference roots', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tutorbench-math-duplicate-roots-'));
  try {
    const original = JSON.parse(await readFile(candidatePath, 'utf8')) as {
      items: Array<{id:string; tutorResponse:string}>;
    };
    const changed = structuredClone(original);
    const quadratic = changed.items.find(x => x.id === 'math-diverse-09');
    const absolute = changed.items.find(x => x.id === 'math-diverse-12');
    assert.ok(quadratic);
    assert.ok(absolute);
    quadratic.tutorResponse = 'The roots are x=2 and x=2.';
    absolute.tutorResponse = 'The inside can be 3 or -3: x-4=3 gives x=1, and x-4=-3 gives x=1. Both work when substituted.';
    const file = join(dir, 'repeated-roots.json');
    await writeFile(file, JSON.stringify(changed));
    const result = invoke(file);
    assert.equal(byId(result, '09').status, 'verified_false');
    assert.equal(byId(result, '12').status, 'verified_false');
  } finally {
    await rm(dir, {recursive:true, force:true});
  }
});

test('unsupported wording, source drift and supposed hints containing answers never receive automatic truth scores',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'tutorbench-math-unknown-'));
  try{
    const original=JSON.parse(await readFile(candidatePath,'utf8')) as {
      items:Array<{id:string;studentMessage:string;tutorResponse:string;humanRatings:null}>;
    };
    const altered=structuredClone(original);
    const change=(id:string)=>{
      const item=altered.items.find(x=>x.id==='math-diverse-'+id);
      assert.ok(item);
      return item;
    };
    change('01').tutorResponse='The solution is x=6.';
    change('02').tutorResponse='Maybe 2/5, depending on context.';
    change('03').studentMessage+=' Assume the base ticket price also changes.';
    change('05').tutorResponse='The conditional probability equals one seventh.';
    const file=join(dir,'unsupported.json');
    await writeFile(file,JSON.stringify(altered));
    const ordinary=spawnSync(process.execPath,[script,'--candidates',file],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(ordinary.status,0,ordinary.stderr);
    const result=JSON.parse(ordinary.stdout) as Result;
    assert.equal(result.summary.unverified,4);
    for(const id of ['01','02','03','05'])assert.equal(byId(result,id).status,'unverified');
    const strict=spawnSync(process.execPath,[script,'--candidates',file,'--require-full-coverage'],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(strict.status,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
