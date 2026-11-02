import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

interface Review {
  schemaVersion:number;
  status:string;
  paper:{expectedQuestions:number;markdownGitBlobSha:string};
  items:Array<{id:string;question:number;pdfPages:number[];kind:string;
    independentlyChecked:boolean;sourceQuality:string;verifiedAsOfficialKey:boolean;
    provisionalReference:string|null;reviewNote:string}>;
}
test('2025 Math-I full inventory is complete, source-pin-aware, and never official gold', async()=>{
  const file = new URL('../../fixtures/research/kaoyan-math1-2025-all-questions-review-v0.1.json',import.meta.url);
  const data = JSON.parse(await readFile(file,'utf8')) as Review;
  assert.equal(data.schemaVersion,1);
  assert.equal(data.status,'research-only-no-official-key');
  assert.equal(data.paper.expectedQuestions,22);
  assert.equal(data.paper.markdownGitBlobSha,'582683c6623fd24b1e3f46c8ef45112fa31b5beb');
  assert.deepEqual(data.items.map(x=>x.question),Array.from({length:22},(_,i)=>i+1));
  assert.equal(new Set(data.items.map(x=>x.id)).size,22);
  assert.equal(data.items.filter(x=>x.independentlyChecked).length,13);
  for(const item of data.items) {
    assert.equal(item.verifiedAsOfficialKey,false);
    assert.ok(item.pdfPages.length>0&&item.pdfPages.every(x=>Number.isInteger(x)&&x>=1&&x<=4),item.id);
    assert.ok(item.sourceQuality.length>5&&item.reviewNote.length>15,item.id);
    if(item.independentlyChecked)assert.ok(item.provisionalReference!==null,item.id);
  }
  const find=(n:number)=>data.items[n-1];
  assert.equal(find(8).sourceQuality,'empty_markdown_key');
  assert.equal(find(17).sourceQuality,'source_solution_value_corrupted');
  assert.equal(find(19).kind,'proof');
  assert.equal(find(19).independentlyChecked,false);
  assert.equal(find(20).sourceQuality,'source_solution_mathematically_wrong');
  assert.equal(find(20).provisionalReference,'-2*sqrt(3)*pi/3');
  assert.equal(find(21).sourceQuality,'source_solution_incomplete');
});
