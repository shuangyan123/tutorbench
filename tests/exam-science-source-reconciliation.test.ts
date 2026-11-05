import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/** Research-only frozen metadata consistency; not an exam truth or byte audit. */
const root = 'fixtures/research/';
const input = JSON.parse(await readFile(root + 'exam-science-upstream-intake-snapshot-2022-2026-v0.1.json','utf8'));
const cross = JSON.parse(await readFile(root + 'exam-science-source-reconciliation-2022-2026-v0.1.json','utf8'));
const prior = JSON.parse(await readFile(root + 'exam-source-expansion-2022-2026-v0.1.json','utf8'));

test('four-subject snapshot counts are self-consistent and never assert gold',()=>{
  assert.equal(input.schemaVersion,1);
  assert.equal(input.id,'exam-science-upstream-intake-snapshot-2022-2026-v0.1');
  assert.equal(input.status,'upstream_metadata_only_not_question_verified');
  assert.equal(input.source.gitBlobSha,'38d188f067065c597ad1e3903dd4130b10d653e2');
  assert.equal(input.source.revision,'b33ea3dd5427afa963a944808d3a6c0183fc454e');
  assert.deepEqual(input.examWindow,{firstYear:2022,lastYear:2026,yearBasis:'exam_year_not_collection_year'});
  const subjects=['数学','物理','化学','生物'];
  assert.deepEqual(Object.keys(input.subjects),subjects);
  let total=0,withSha=0;
  const statuses={discovered:0,indexed:0,verified:0};
  const licenses={unknown:0,permitted:0,restricted:0};
  for(const name of subjects){
    const group=input.subjects[name];
    let subjectTotal=0,subjectWithSha=0;
    const byStatus={discovered:0,indexed:0,verified:0};
    const byLicense={unknown:0,permitted:0,restricted:0};
    for(const year of [2022,2023,2024,2025,2026]){
      const entry=group.byYear[String(year)];
      subjectTotal+=entry.candidates; subjectWithSha+=entry.withSha256;
      for(const key of Object.keys(byStatus))byStatus[key]+=entry.upstreamDeclaredStatus[key];
      for(const key of Object.keys(byLicense))byLicense[key]+=entry.upstreamLicenseStatus[key];
      assert.equal(Object.values(entry.upstreamDeclaredStatus).reduce((a,b)=>a+b,0),entry.candidates);
      assert.equal(Object.values(entry.upstreamLicenseStatus).reduce((a,b)=>a+b,0),entry.candidates);
      assert.ok(entry.withSha256<=entry.candidates);
    }
    assert.equal(subjectTotal,group.candidates);assert.equal(subjectWithSha,group.withSha256);
    assert.deepEqual(byStatus,group.upstreamDeclaredStatus);
    assert.deepEqual(byLicense,group.upstreamLicenseStatus);
    total+=group.candidates;withSha+=group.withSha256;
    for(const key of Object.keys(statuses))statuses[key]+=byStatus[key];
    for(const key of Object.keys(licenses))licenses[key]+=byLicense[key];
  }
  assert.equal(total,217);assert.equal(withSha,216);
  assert.equal(input.upstreamStats.candidates,total);
  assert.equal(input.upstreamStats.withSha256,withSha);
  assert.deepEqual(input.upstreamStats.upstreamDeclaredStatus,statuses);
  assert.deepEqual(input.upstreamStats.upstreamLicenseStatus,licenses);
  assert.deepEqual(statuses,{discovered:1,indexed:172,verified:44});
  assert.equal(input.assurance.certifiedExamGoldItems,0);
  assert.equal(input.assurance.filesDownloadedByTutorBench,false);
  assert.equal(input.assurance.answerKeysIndependentlyVerifiedByTutorBench,false);
  assert.equal(input.assurance.liveModelCalls,0);
});

test('crosswalk retains only exact source-path associations; no implicit deduplication',()=>{
  assert.equal(cross.schemaVersion,1);
  assert.equal(cross.status,'provenance_crosswalk_only_not_content_verified');
  assert.deepEqual(cross.source,{
    repository:input.source.repository,revision:input.source.revision,
    path:input.source.path,gitBlobSha:input.source.gitBlobSha,
  });
  const gaokao=new Map(prior.papers.filter(p=>p.exam==='gaokao').map(p=>[p.paperId,p]));
  assert.equal(gaokao.size,36);
  assert.equal(cross.existingTutorBench.mathGaokaoEditions,36);
  assert.equal(cross.sample.candidateRows,217);
  assert.equal(cross.sample.rowsWithSha256,216);
  assert.equal(cross.sample.identicalSha256AcrossCandidateRecords,0);
  assert.equal(cross.sample.mathCandidateRows,51);
  assert.equal(cross.sample.mathExactSourcePathMatches,25);
  assert.equal(cross.sample.mathUnresolvedRows,26);
  assert.equal(cross.mathExactSourcePathMatches.length,25);
  assert.equal(cross.mathUnresolved.length,26);
  const matchedIds=new Set();
  for(const match of cross.mathExactSourcePathMatches){
    assert.equal(match.relation,'exact_source_path_match_only');
    assert.equal(match.artifactHashCompared,false);
    assert.equal(match.sourceRepository,'deekur/gaokaomath');
    assert.ok(!matchedIds.has(match.upstreamRecordId));
    matchedIds.add(match.upstreamRecordId);
    const paper=gaokao.get(match.tutorBenchPaperId);
    assert.ok(paper,'matched paper must already exist');
    assert.equal(paper.source.path,match.upstreamSourcePath);
    assert.match(paper.source.revision,/^[0-9a-f]{40}$/u);
    assert.equal(paper.answerGoldStatus,'not_verified');
  }
  const unresolvedIds=new Set(cross.mathUnresolved.map(x=>x.upstreamRecordId));
  assert.equal(unresolvedIds.size,26);
  assert.ok([...unresolvedIds].every(id=>!matchedIds.has(id)));
  assert.equal(cross.coarseIdentityCollisions.length,18);
  assert.equal(cross.sample.coarseIdentityCollisionGroups,18);
  const collisionIds=new Set();
  for(const group of cross.coarseIdentityCollisions){
    assert.equal(group.disposition,'ambiguous_coarse_key_do_not_deduplicate');
    assert.ok(group.recordIds.length>=2);
    assert.equal(new Set(group.recordIds).size,group.recordIds.length);
    for(const id of group.recordIds){assert.ok(!collisionIds.has(id));collisionIds.add(id);}
  }
  assert.ok(cross.boundaries.some(x=>x.includes('not byte')||x.includes('not identical file bytes')));
});
