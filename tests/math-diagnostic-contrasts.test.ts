import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { diagnosticEvidence, inspectDiagnosticContrasts, inspectDiagnosticSubmission, prepareDiagnosticReview } from "../src/research/math-diagnostic-contrasts.js";

const cli = (...args: string[]) => execFileSync(process.execPath, ["dist/src/cli/exam-specifications.js","--requirements",...args], { maxBuffer: 2_000_000 });
const old = cli("scenarios/case-system-vnext/exam-specifications/requirements-1.1.0.json");
const base = JSON.parse(old.toString()) as Parameters<typeof inspectDiagnosticContrasts>[0];
const report = inspectDiagnosticContrasts(base);
const traces = report.cases.flatMap(c => c.traces);
function trace(id: string) {
  const t = traces.find(t => t.id === id);
  assert.ok(t);
  return t;
}
test("archived task evidence, excerpts and source fit still resolve; synthetic observations do not confer review", () => {
  assert.equal(createHash("sha256").update(old).digest("hex"),"ffe8bd4999575f43d4bf12f8bec7270b44696365a0245d7b289f97e203909dea");
  assert.deepEqual(JSON.parse(cli("--diagnostic-contrasts").toString()),report);
  assert.equal(base.requirements.length,392);
  assert.equal(base.knowledgeGraph.nodes.length,98);
  assert.deepEqual(report.cases.map(c=>c.taskId),base.tasks.map(t=>t.taskId));
  for (const c of report.cases) {
    const original = base.tasks.find(t=>t.taskId===c.taskId)!;
    assert.deepEqual([c.prompt,c.solution,c.sourceEvidence,c.operation,c.required],
      [original.prompt,original.solution,original.sourceEvidence,original.operation,original.required]);
    assert.ok(c.proposedClarification && c.cannotInfer && c.traces.some(t=>t.reasoning==="sufficient"));
    for (const t of c.traces) {
      if (t.origin === "project-prompt-excerpt") assert.ok(c.asset && c.prompt.includes(t.response));
      assert.ok(t.synthetic && !t.conceptDeficitEstablished && t.hypotheses.length >= 2 && t.fact && t.inferenceClaim);
    }
  }
  assert.equal(traces.filter(t=>t.origin==="project-prompt-excerpt").length,6);
  assert.equal(traces.length,24);
  assert.equal(new Set(traces.map(t=>t.id)).size,24);
  assert.equal(report.metrics.diagnosticAccuracy,null);
  assert.equal(report.metrics.perDimensionAgreement,null);
  assert.equal(report.metrics.independentSubmissions,0);
});

test("intersection, domain and sign counterexamples dissociate a result from a proof", () => {
  const good = trace("circle-normal"), invalid = trace("circle-coincidence");
  assert.equal(good.claim,invalid.claim);
  assert.deepEqual([good.reasoning,invalid.reasoning],["sufficient","invalid"]);
  // 切点处的半径与方向 (1,m) 的内积是 5m。另一条过该点的直线还有第二个交点。
  assert.equal(5*Number(good.claim.split("=")[1]),0);
  assert.ok([[0,5],[-5,0]].every(([x,y]) => y === x!+5 && x!**2+y!**2===25));
  assert.equal(trace("circle-source").answerStatus,"incorrect");
  const a=-3, disc=4*(a-2)*(a+1);
  assert.ok(disc>0 && 2*a<0);
  assert.equal(trace("roots-source").claim,"a<-1 or a>2");
  assert.equal(trace("roots-intersection").claim,trace("roots-brief").claim);
  assert.equal(trace("roots-brief").reasoning,"absent");
  const candidate=Number(trace("domain-source").claim.split(" ")[1]);
  assert.equal(candidate+1,2);
  assert.equal(candidate-1,0);
  assert.equal(trace("domain-source").claimEvidence,"underdetermined"); // 原话以疑问句结尾。
  assert.equal(trace("domain-first").claim,trace("domain-undefined").claim);
  assert.notEqual(2-1,0); // 反驳“对每个输入分母为零”。
  assert.equal(trace("domain-undefined").reasoning,"invalid");
  assert.equal(-1+1/(-1),-2);
  assert.equal(trace("amgm-source").claim,"all nonzero");
  for (const x of [-8,-1,-0.5,0.5,1,8]) assert.equal(x+1/x-2,(x-1)**2/x);
  assert.equal(trace("amgm-square").claim,trace("amgm-premise").claim);
  assert.deepEqual([trace("amgm-square").reasoning,trace("amgm-premise").reasoning],["sufficient","incomplete"]);
});

test("valid methods, isolated slips and short replies have distinct evidence", () => {
  const slip=trace("price-slip");
  const numbers=slip.response.match(/(\d+)−(\d+)=(\d+)/)!.slice(1).map(Number);
  const [price,discount,stated]=numbers as [number,number,number];
  assert.equal(price,200*6/5);
  assert.equal(discount,price/5);
  assert.equal(price-discount,Number(trace("price-factors").claim));
  assert.notEqual(price-discount,stated);
  assert.equal(stated,Number(slip.claim));
  assert.equal(slip.claimEvidence,"contradicted");
  assert.notEqual(Number(trace("price-source").claim),price-discount);
  assert.equal(1*4-2*2,0);
  assert.notEqual(3/2,7/4);
  assert.equal(trace("system-source").claim,"infinite");
  assert.equal(trace("system-parallel").claim,trace("system-brief").claim);
  assert.deepEqual([trace("system-parallel").reasoning,trace("system-brief").reasoning],["sufficient","absent"]);
  assert.ok(report.cases.find(c=>c.taskId==="linear-system-consistency-versus-rank")!.prompt.includes("answer key"));
});

test("equations are checked against both the original points and the learner's transcription", () => {
  const table=report.cases.find(t=>t.taskId==="line-from-value-table")!;
  const plot=report.cases.find(t=>t.taskId==="line-from-coordinate-plot")!;
  const tabulated=[...table.prompt.replaceAll("−","-").matchAll(/^\| (-?\d+) \| (-?\d+) \|$/gm)].map(m=>[Number(m[1]),Number(m[2])]);
  const plotted=[...plot.prompt.matchAll(/^(\d+) \| (.+)$/gm)].flatMap(m=>
    m[2]!.trim().split(/\s+/).flatMap((v,x)=>v==="●"?[[x,Number(m[1])]]:[]));
  const equations: Record<string,(x:number,y:number)=>boolean> = {
    "x+2y=2": (x,y)=>x+2*y===2, "2x+y=2": (x,y)=>2*x+y===2, "y=1": (_,y)=>y===1,
    "x=2": x=>x===2, "y=2": (_,y)=>y===2,
  };
  for (const [id,source,correct] of [["table-transpose",tabulated,"table-general"],["plot-transpose",plotted,"plot-vertical"]] as const) {
    const t=trace(id);
    const copied=[...t.response.replaceAll("−","-").matchAll(/\((-?\d+),(-?\d+)\)/g)].map(m=>[Number(m[1]),Number(m[2])]);
    assert.equal(copied.length,2);
    assert.deepEqual(new Set(copied.map(p=>p.join(","))),new Set(source.map(([x,y])=>[y,x].join(","))));
    assert.ok(copied.every(([x,y])=>equations[t.claim]!(x!,y!)));
    assert.ok(source.some(([x,y])=>!equations[t.claim]!(x!,y!)));
    assert.ok(source.every(([x,y])=>equations[trace(correct).claim]!(x!,y!)));
  }
  assert.equal(trace("table-brief").claim,trace("table-transpose").claim);
  assert.ok(trace("table-brief").hypotheses.length>1 && trace("table-brief").reasoning==="absent");
  assert.equal(plot.operation,table.operation);
  assert.notDeepEqual(plot.input,table.input);
  assert.equal(plotted[0]![0],plotted[1]![0]);
  assert.equal(plotted.filter(([x,y])=>equations[trace("plot-slope").claim]!(x!,y!)).length,1);
  const circle=report.cases.find(c=>c.taskId==="circle-line-tangency-constraint")!;
  assert.ok(circle.concepts.some(n=>table.concepts.some(m=>m.id===n.id)));
  assert.notEqual(circle.operation,table.operation);
});

test("blind packets isolate claims, omit answer keys, reproduce assignments and bind both slots", () => {
  const forbidden = /"(?:fact|claimEvidence|hypotheses|mode|sourceKey|reasoning|answerStatus|cannotInfer|priorAnswer|diagnosticAccuracy)":/;
  for (const [dimension,expected] of [["mathematics",32],["construct",14],["attribution",24]] as const) {
    const a=prepareDiagnosticReview(report,dimension,"reviewer-a");
    const b=prepareDiagnosticReview(report,dimension,"reviewer-b");
    assert.equal(a.packet.tasks.length,expected);
    assert.deepEqual(a,prepareDiagnosticReview(report,dimension,"reviewer-a"));
    assert.doesNotMatch(JSON.stringify(a.packet),forbidden);
    assert.equal(a.packet.taskSetFingerprint,b.packet.taskSetFingerprint);
    assert.notEqual(a.packet.packetFingerprint,b.packet.packetFingerprint);
    assert.deepEqual(a.manifest.tasks.map(t=>t.sourceKey).sort(),b.manifest.tasks.map(t=>t.sourceKey).sort());
    assert.deepEqual(JSON.parse(cli("--diagnostic-contrasts","export",dimension,"reviewer-a").toString()),{packet:a.packet,template:a.template});
    const visible=a.packet.tasks[0]!;
    assert.equal("proposedInference" in visible,dimension==="attribution");
    assert.equal("sources" in visible,dimension==="construct");
    assert.throws(()=>inspectDiagnosticSubmission(a.template,a));
    const fixture={...a.template,reviews:a.template.reviews.map(t=>({...t,outcome:"insufficient-evidence",reason:"Fixture only.",alternative:"Other method.",uncertainty:"Unknown."}))};
    assert.equal(inspectDiagnosticSubmission(fixture,a).independenceVerified,false);
    if (dimension === "attribution") {
      const file = join(tmpdir(), "synthetic-review-" + randomUUID() + ".json");
      writeFileSync(file,JSON.stringify(fixture),{flag:"wx"});
      try {
        const imported = JSON.parse(cli("--diagnostic-contrasts","import",dimension,"reviewer-a",file).toString());
        assert.deepEqual(imported,inspectDiagnosticSubmission(fixture,a));
        assert.equal(imported.status,"structure-validated-only");
      } finally { unlinkSync(file); }
    }
    assert.throws(()=>inspectDiagnosticSubmission(fixture,b));
    assert.throws(()=>inspectDiagnosticSubmission({...fixture,reviews:fixture.reviews.slice(1)},a));
    assert.throws(()=>inspectDiagnosticSubmission({...fixture,reviews:fixture.reviews.map(()=>fixture.reviews[0])},a));
    for (const patch of [{outcome:"gold"},{reason:" "},{uncertainty:""},{alternative:""},{expertApproved:true}])
      assert.throws(()=>inspectDiagnosticSubmission({...fixture,reviews:fixture.reviews.map(t=>({...t,...patch}))},a));
    assert.throws(()=>inspectDiagnosticSubmission({...fixture,packetFingerprint:"sha256:"+"0".repeat(64)},a));
    assert.throws(()=>inspectDiagnosticSubmission({...fixture,independenceVerified:true},a));
  }
});

test("frozen evidence view abstains on causal attribution across all 24 contrasts", () => {
  const evidence = diagnosticEvidence(report);
  assert.deepEqual(JSON.parse(cli("--diagnostic-contrasts", "evidence").toString()), evidence);
  // 每组三段共享原题。只有可从书面步骤核实的陈述可作为肯定判断输出。
  const matrix = [
    ["circle-normal", "circle-source", "circle-coincidence"],
    ["roots-intersection", "roots-source", "roots-brief"],
    ["domain-first", "domain-source", "domain-undefined"],
    ["amgm-square", "amgm-source", "amgm-premise"],
    ["price-factors", "price-source", "price-slip"],
    ["system-parallel", "system-source", "system-brief"],
    ["table-general", "table-transpose", "table-brief"],
    ["plot-vertical", "plot-transpose", "plot-slope"],
  ];
  assert.deepEqual(new Set(evidence.map(row => row.traceId)), new Set(matrix.flat()));
  for (const [supported, ...probes] of matrix) {
    const reference = evidence.find(row => row.traceId === supported)!;
    assert.equal(reference.supportedStep, trace(supported!).inferenceClaim);
    for (const id of probes) {
      const probe = evidence.find(row => row.traceId === id)!;
      assert.equal(reference.taskId, probe.taskId);
      assert.equal(probe.supportedStep, null);
      assert.ok(!JSON.stringify(probe).includes(trace(id).inferenceClaim));
    }
  }
  for (const row of evidence) {
    assert.equal(row.observation, trace(row.traceId).fact);
    assert.equal(row.causalAttribution, "insufficient-evidence");
    assert.ok(new Set(row.alternativeExplanations).size >= 2);
    assert.ok(row.cannotInfer);
    assert.equal(row.reviewStatus, "pending-independent-review");
  }
  // 同一结论既可来自充分推理，也可来自错误、缺失或未呈现的推理。
  for (const [complete, probe, reasoning] of [
    ["circle-normal", "circle-coincidence", "invalid"],
    ["domain-first", "domain-undefined", "invalid"],
    ["roots-intersection", "roots-brief", "absent"],
    ["amgm-square", "amgm-premise", "incomplete"],
    ["system-parallel", "system-brief", "absent"],
    ["table-transpose", "table-brief", "absent"],
  ] as const) {
    assert.equal(trace(complete).claim, trace(probe).claim);
    const first = evidence.find(r => r.traceId === complete)!;
    const second = evidence.find(r => r.traceId === probe)!;
    assert.equal(first.conclusion, second.conclusion);
    assert.notEqual(first.reasoning, second.reasoning);
    assert.equal(second.reasoning, reasoning);
  }
});
