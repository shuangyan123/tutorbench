import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { extendKnowledgeGraph } from "../src/research/exam-knowledge-coverage.js";
import type { inspectGeometryPilot } from "../src/research/math-geometry-pilot.js";
import snapshot from "../scenarios/case-system-vnext/exam-specifications/requirements-1.1.0.json" with { type: "json" };

const path = (version: string) => "scenarios/case-system-vnext/exam-specifications/requirements-" + version + ".json";
const cli = (...args: string[]) => execFileSync(process.execPath,
  ["dist/src/cli/exam-specifications.js", "--requirements", ...args], { maxBuffer: 2_000_000 });
const previous = cli(path("1.0.0"));
const base = JSON.parse(previous.toString()) as Parameters<typeof inspectGeometryPilot>[1];
const report = JSON.parse(cli(path("1.1.0")).toString()) as ReturnType<typeof inspectGeometryPilot>;
function task(id: string) {
  const row = report.tasks.find(t => t.taskId === id);
  assert.ok(row);
  return row;
}

test("1.1 inventory reconciles two circled-item boundaries including both page continuations", () => {
  assert.equal(createHash("sha256").update(previous).digest("hex"), "d83e3bce3b4c0fd53e78118521caf41757503a902b539fed84c9c3a2516faeb5");
  assert.deepEqual(report.scopes.slice(-2).map(s => s.requirements_in_scope), [12,14]);
  const rows = report.requirements.slice(366);
  assert.deepEqual(rows.map(r => r.anchor), ["1.1","1.2","2.1","2.2","3.1","3.2","3.3","3.4","4.1","4.2","4.3","4.4",
    "1.1","1.2","1.3","1.4","1.5","1.6","2.1","2.2","2.3","3.1","3.2","3.3","3.4","3.5"]);
  assert.ok(rows.every(r => "starred" in r && r.starred === false && r.curriculumTrack === "选择性必修" &&
    r.source_sha256 === snapshot.sourceSha256 && r.source_edition === snapshot.sourceEdition && r.pdfPage === r.printedPage + 8));
  assert.match(rows[8]!.locator, /printed 42–43, PDF 50–51/);
  assert.match(rows[17]!.locator, /printed 43–44, PDF 51–52/);
  assert.match(rows[1]!.summary, /各棱分别平行于坐标轴/);
  assert.match(report.scopes.at(-1)!.excludes, /\*平面解析几何的形成与发展/);
  assert.deepEqual(report.knowledgeGraph.nodes.slice(0,93), base.knowledgeGraph.nodes);
  assert.deepEqual(report.requirements.slice(0,366).map(r => [r.requirement_id,r.locator]), base.requirements.map(r => [r.requirement_id,r.locator]));
  const diff = JSON.parse(cli(path("1.0.0"),path("1.1.0")).toString()) as {changes:Record<string,string[]>};
  assert.deepEqual(Object.values(diff.changes).map(a=>a.length), [26,0,0,366]);
  assert.equal(report.gapReview.length,4);
  assert.equal(report.gapReview.filter(r => r.concept).length,1);
  assert.deepEqual([report.scopes.length,report.unique_source_clauses,report.unique_linked_requirements,report.explicitlyUnmapped,
    report.knowledgeGraph.nodes.length,report.candidateLinks,report.uniqueCandidateConcepts],[51,392,272,120,98,347,86]);
  const unsafe = structuredClone(snapshot.graphDelta);
  unsafe.knowledgeRelations[0]!.relationType = "necessary";
  assert.throws(() => extendKnowledgeGraph(base.knowledgeGraph,unsafe,base.aliases));
  const cyclic = structuredClone(snapshot.graphDelta);
  cyclic.addedNodes[0]!.prerequisiteIds = [cyclic.addedNodes[0]!.id];
  cyclic.knowledgeRelations[0]!.fromNodeId = cyclic.addedNodes[0]!.id;
  assert.throws(() => extendKnowledgeGraph(base.knowledgeGraph,cyclic,base.aliases));
});

test("rights, case identity, clause fit and bounded process evidence remain separate from scores", () => {
  assert.equal(report.tasks.length,8);
  assert.equal(new Set(report.tasks.map(t => t.taskId)).size,8);
  assert.equal(report.tasks.filter(t => t.asset && t.sourceKind === "existing-synthetic-project-case").length,6);
  assert.equal(report.tasks.filter(t => !t.asset && t.sourceKind === "original-exam-style").length,2);
  for (const t of report.tasks) {
    assert.ok(t.prompt && t.solution && t.alternative && t.restrictions && t.required && t.diagnosticLimit);
    assert.ok(t.rights === "project-authored" && t.diagnosticStatus === "author-hypothesis" && t.review === "author-proposed");
    assert.ok(t.sourceEvidence.every(s => s.edition && s.sha256 && s.locator && s.fit && s.sourceOperation));
  }
  for (const c of report.contrasts) assert.ok(c.tasks.every(id => task(id)));
  assert.deepEqual([report.independentlyReviewed,report.independentConstructReviews,report.learnerOutcomes,report.wholeExamDenominator,
    report.mappingAccuracy], [0,0,null,null,null]);
});

test("independent algebra and geometry checks preserve missing-premise counterexamples", () => {
  const circle = task("circle-line-tangency-constraint");
  // 半径 (0,5) 与直线方向 (1,m) 的内积为 5m；相切等价于正交。
  assert.deepEqual(circle.answer.tangentSlopes, [0]);
  for (const m of [-3,-1,0,1,3]) assert.equal(circle.answer.tangentSlopes?.includes(m), 5*m === 0);
  assert.ok([[0,5],[-5,0]].every(([x,y]) => x!**2+y!**2 === 25 && y === x!+5)); // m=1 passes through two points.
  const q = task("quadratic-positive-roots").answer;
  assert.deepEqual(q,{lower:2,lowerInclusive:false,upper:null});
  for (const a of [-4,-2,-1.5,-1,0,1,2,2.01,3,8]) {
    const radicand = a*a-a-2;
    const roots = [a-Math.sqrt(radicand),a+Math.sqrt(radicand)];
    assert.equal(radicand>0 && roots.every(x=>x>0), a>q.lower!);
  }
  // 清分母后得到 (x−1)²=0，必须回到原分母。
  assert.deepEqual(task("rational-equation-excluded-root").answer.realSolutions, [1].filter(x=>x-1 !== 0));
  const amgm = task("inequality-conditions-and-counterexample").answer;
  assert.equal(amgm.validDomain,"positive-reals");
  assert.equal(amgm.equality! + 1/amgm.equality!,2);
  assert.ok(amgm.counterexample! !== 0 && amgm.counterexample! + 1/amgm.counterexample! < 2);
  for (const x of [-8,-1,-0.25,0.25,1,8]) assert.equal(x+1/x >= 2, x>0);
  const price = task("successive-percentage-base").answer;
  const increased = 200 + 200/5, final = increased-increased/5;
  assert.deepEqual(price,{afterIncrease:increased,finalPrice:final,netPercent:100*(final-200)/200});
  const system = task("linear-system-consistency-versus-rank").answer;
  const det = (a:number,b:number,c:number,d:number) => a*d-b*c;
  assert.equal(det(1,2,2,4),0);
  assert.notEqual(det(1,3,2,7),0);
  assert.deepEqual(system,{realSolutions:[],coefficientRank:1,augmentedRank:2});
  assert.equal(circle.operation,task("linear-system-consistency-versus-rank").operation);
});

test("derive both lines from the actual tabular and plotted inputs, accepting equivalent equations", () => {
  const table = task("line-from-value-table"), plot = task("line-from-coordinate-plot");
  const tabulated = [...table.prompt!.replaceAll("−","-").matchAll(/^\| (-?\d+) \| (-?\d+) \|$/gm)].map(m=>[Number(m[1]),Number(m[2])]);
  const plotted = [...plot.prompt!.matchAll(/^(\d+) \| (.+)$/gm)].flatMap(m=>
    m[2]!.trim().split(/\s+/).flatMap((mark,x)=>mark==="●"?[[x,Number(m[1])]]:[]));
  for (const [t,points] of [[table,tabulated],[plot,plotted]] as const) {
    assert.equal(points.length,2);
    const [[x1,y1],[x2,y2]] = points as [[number,number],[number,number]];
    const normal = [y1-y2,x2-x1,x1*y2-x2*y1];
    const reported = t.answer.generalForm!;
    assert.ok(normal[0] || normal[1]);
    assert.ok(reported[0] || reported[1]);
    for (const [i,j] of [[0,1],[1,2],[0,2]] as const) assert.equal(normal[i]!*reported[j]!-normal[j]!*reported[i]!,0);
  }
  assert.equal(table.operation,plot.operation);
  assert.notDeepEqual(table.input,plot.input);
  assert.deepEqual(table.concepts,plot.concepts);
  assert.notEqual(table.answer.generalForm![1],0);
  assert.equal(plot.answer.generalForm![1],0);
});
