// Builds methodology/index.html for the Spectrum prototype, in English and 简体中文 on one page.
// The copy mirrors renderMethodologyPage in src/site/pages/developer.ts; every English string is looked
// up in the live SITE_ZH_CN_COPY, so a string that drifts from the live page fails the build instead of
// shipping. Statuses and the dimension list come from the public benchmark artifact, as on the live page.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-methodology.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, bi, biE, biP, biPE, frame } from "./site-kit.mjs";

const benchmark = JSON.parse(readFileSync(join(REPO, "website/dist/public-data/benchmark.json"), "utf8"));
const GITHUB = "https://github.com/shuangyan123/tutorbench";

// the five score dimensions, in the artifact's order; gem i is the homepage's marker for dimension i
const DIMS = {
  correctness: { label: "Correctness", description: "Whether the Tutor stays factually and conceptually correct.", lens: "Factual and conceptual accuracy" },
  diagnosis: { label: "Diagnosis", description: "Whether it identifies the learner’s actual error, gap, or reasoning issue.", lens: "Identifies learner needs and misconceptions" },
  guidance: { label: "Guidance", description: "Whether its explanation or hint helps the learner make progress.", lens: "Provides clear, correct, productive guidance" },
  adaptation: { label: "Adaptation", description: "Whether it changes its help for the learner’s state and context.", lens: "Adapts to learner state, level, and context" },
  actionability: { label: "Actionability", description: "Whether it leaves the learner with a clear, executable next step.", lens: "Actionable next steps for the learner" },
};
const dims = benchmark.dimensions.score.map((d) => {
  if (!DIMS[d]) throw new Error(`unknown score dimension ${d}`);
  return { key: d, ...DIMS[d] };
});

// ---- the mathematics knowledge system (PR #306): read straight from the scenario files, so every
// count and every quoted field on the page is the repository's own
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), "utf8"));
const kmap = readJson("scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json");
const evidence = readJson("scenarios/experimental/mathematics-challenge-v0.1/evidence.json");
const suite = readJson("scenarios/experimental/mathematics-challenge-v0.1/suite.json");
// Chinese node names: the reviewed translations in the zh-CN knowledge-system review
const ZH_REVIEW = "docs/mathematics-knowledge-system-zh-cn-v0.1.md";
const nodeZh = Object.fromEntries([...readFileSync(join(REPO, ZH_REVIEW), "utf8").matchAll(/^\| `([a-z0-9-]+)` \| ([^|]+?) \|/gm)].map((m) => [m[1], m[2].trim()]));
const DOMAIN_ZH = {
  "number-quantity": "数与数量关系", "algebra-equations": "代数与方程", functions: "函数与变化", geometry: "几何与空间推理",
  "discrete-probability": "计数与概率", statistics: "统计与数据解释", "proof-structures": "证明、逻辑与推广", "advanced-mathematics": "微积分与线性代数入门",
};
const linked = new Set(kmap.caseMappings.flatMap((m) => m.nodeIds));
const nodeById = Object.fromEntries(kmap.nodes.map((n) => [n.id, n]));
for (const n of kmap.nodes) if (!nodeZh[n.id]) throw new Error(`no Chinese name for knowledge node ${n.id} in ${ZH_REVIEW}`);
for (const d of kmap.domains) if (!DOMAIN_ZH[d.id]) throw new Error(`no Chinese name for knowledge domain ${d.id}`);
const KM = {
  domains: kmap.domains.length, nodes: kmap.nodes.length, linked: linked.size, relations: kmap.knowledgeRelations.length,
  paths: kmap.alternativePaths.length, cases: suite.scenarios.length, tasks: evidence.tasks.length,
};
if (kmap.knowledgeRelations.some((r) => r.evidenceStatus !== "author-hypothesis")) throw new Error("a knowledge relation is no longer an author hypothesis: revise the copy");
if (kmap.curriculumStageMappings.length) throw new Error("curriculum stage mappings now exist: revise the copy");

// the worked example: one case, followed from its knowledge nodes to the decision it is scored on
const EX_CASE = "mc-percent-reversal", EX_TASK = "successive-percentage-base";
const exCase = suite.scenarios.find((c) => c.identity.id === EX_CASE);
const exTask = evidence.tasks.find((t) => t.id === EX_TASK);
const exMap = kmap.caseMappings.find((m) => m.taskId === EX_TASK);
if (!exCase || !exTask || !exMap || !exTask.scenarioIds.includes(EX_CASE)) throw new Error("worked example case is missing or re-mapped");
const exNodes = exMap.nodeIds.map((id) => nodeById[id]);
const exDecision = exCase.decisionPoints[0];
const exSays = exCase.trajectory.conversationHistory.find((t) => t.role === "user").content;
// the copy below quotes these exact fields; if the data changes, the build stops instead of drifting
const EXPECT = {
  says: "A product costs 200. It goes up 20% and then down 20%. I said it must be back to 200 because the changes cancel. I can calculate 20% of 200, so what is wrong with my reasoning?",
  nodes: "percent-base,successive-changes", disclosure: "hint_only", decision: "offer_conceptual_hint", known: "percent of a number",
  criteria: "correctness:Identify that the second 20% refers to the increased price and cannot cancel the first 20% change.|guidance:Provide a concise executable next step to determine the intermediate price then use it as the second percentage base without revealing the final price.",
  misconception: "Assuming successive equal percentage changes cancel",
  held: "Treats equal percentage changes applied to different bases as cancelling additively.",
  verified: "Starting at 200, a 20% increase yields 240, then a 20% decrease gives 192: 96% of the starting amount, a net 4% decrease.",
};
const got = {
  says: exSays, nodes: exMap.nodeIds.join(","), disclosure: exCase.teachingPolicy.disclosure, decision: exDecision.expectedDecision,
  known: exCase.tutorVisibleContext.knownConcepts.join(","), criteria: exDecision.evaluationCriteria.map((c) => `${c.category}:${c.criterion}`).join("|"),
  misconception: exNodes[1].commonMisconception, held: exCase.evaluatorReferenceState.misconceptions[0].statement, verified: exTask.verifiedResult,
};
for (const k of Object.keys(EXPECT)) if (EXPECT[k] !== got[k]) throw new Error(`worked example field "${k}" changed in the data: update the page copy`);

/** two live fragments shown as one phrase: a space in English, joined in Chinese */
const pair = (a, b, zhJoin = "") => bi(esc(`${a} ${b}`), esc(Z(a) + zhJoin + Z(b)));
const PIPELINE = [
  ["Structured case", "Authored scenario with learner profile, goal, and context."],
  ["Tutor response", "The response produced for the learner’s structured case."],
  ["Evaluator evidence", "Evidence from deterministic evaluators and the Semantic Judge."],
  ["Atomic rubrics", "Fine-grained criteria with explicit scoring levels."],
  ["Benchmark result", "Category aggregation with documented, comparable outputs."],
];

const cal = benchmark.calibration;
const STATUS = [
  ["Calibration infrastructure", cal.infrastructure === "available" ? "Available" : "Not available", "Provider-independent contracts and synthetic pipeline fixtures are available.", cal.infrastructure === "available"],
  ["Community Review infrastructure", "Private staging ready", "Public launch remains blocked; reviewer intake remains closed, and the real Community Review campaign has not started.", true],
  ["Human calibration (P5)", cal.independentHumanCalibration === "not_completed" ? "Not started" : "Not completed", "No real human calibration data is claimed.", false],
  ["Judge-vs-human validation", cal.judgeVsHumanValidation === "not_completed" ? "Not completed" : "Not started", "A Judge result is not presented as human-reference validation.", false],
  ["Statistical validation", cal.statisticalValidation === "not_completed" ? "Not completed" : "Not started", "No statistical validation claim is made for the current benchmark.", false],
];

const SECTIONS = [
  ["pipeline", "The evaluation pipeline"],
  ["knowledge", "Why we evaluate this way", "为什么这样评测"],
  ["dimensions", "Five evaluation dimensions"],
  ["architecture", "From response to result"],
  ["scope", "What we measure"],
  ["status", "Methodology status"],
  ["commitment", "Our commitment"],
];
const secT = ([, en, zh]) => biE(en, zh ?? Z(en));
const h2 = (i) => `<h2 id="${SECTIONS[i][0]}"><span class="no">§${i + 1}</span><span>${secT(SECTIONS[i])}</span></h2>`;
const deck = (a, b) => `<p class="m-deck">${bi(`${esc(a)} <em>${esc(b)}</em>`, `${esc(Z(a))}<em>${esc(Z(b))}</em>`)}</p>`;
const deck3 = (a, b, c) => `<p class="m-deck">${bi(`${esc(a)} ${esc(b)} <em>${esc(c)}</em>`, `${esc(Z(a))}${esc(Z(b))}<em>${esc(Z(c))}</em>`)}</p>`;
let figNo = 0;
const fig = (cls, body, capEn, capZh) => { figNo += 1; return `<figure class="fig ${cls}" id="fig${figNo}">
          ${body}
          <figcaption><b>${bi(`Fig. ${figNo}`, `图 ${figNo}`)}</b>${capZh === undefined ? biE(capEn) : bi(esc(capEn), esc(capZh))}</figcaption>
        </figure>`; };
const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';


// ---- §2, why we evaluate this way: knowledge node -> teaching case -> evaluation decision
const P = (en, zh, cls = "") => biP("p", cls, esc(en), esc(zh));
const gemOf = (cat) => { const i = dims.findIndex((d) => d.key === cat); if (i < 0) throw new Error(`no dimension ${cat}`); return i; };
const CAT_ZH = { correctness: Z("Correctness"), guidance: Z("Guidance") };
function knowledgeSection() {
  const [nA, nB] = exNodes;
  const domain = kmap.domains.find((d) => d.id === nB.domainId);
  const crit = exDecision.evaluationCriteria;
  const CRIT_ZH = {
    correctness: "指出第二个 20% 针对的是涨价后的价格，因此不能抵消第一次的 20% 变化。",
    guidance: "给出一个简短、可执行的下一步：先求出中间价格，再把它作为第二次百分比的基数；不透露最终价格。",
  };
  const chain = `<ol class="kc">
            <li class="kc-node">
              <p class="kc-step"><span>01</span>${bi("Knowledge node", "知识节点")}</p>
              <p class="kc-domain">${bi(esc(domain.label), esc(DOMAIN_ZH[domain.id]))}</p>
              <p class="kc-pair"><span class="kc-n">${bi(esc(nA.label), esc(nodeZh[nA.id]))}<code>${esc(nA.id)}</code></span>
                <span class="kc-rel" aria-hidden="true">↓</span>
                <span class="kc-n">${bi(esc(nB.label), esc(nodeZh[nB.id]))}<code>${esc(nB.id)}</code></span></p>
              <dl class="kc-dl">
                <div><dt>${bi("Common misconception", "常见误区")}</dt><dd>${bi(esc(nB.commonMisconception), "认为相等的连续百分比变化会相互抵消")}</dd></div>
                <div><dt>${bi("Status", "性质")}</dt><dd>${bi("A prompt for writing cases, never a diagnosis of a real learner. The link between the two nodes is an author hypothesis.", "这是编写案例的提示，不是对真实学习者的诊断。两个节点之间的联系是作者提出的假设。")}</dd></div>
              </dl>
            </li>
            <li class="kc-case">
              <p class="kc-step"><span>02</span>${bi("Teaching case", "教学案例")}</p>
              <p class="kc-domain"><code>${esc(EX_CASE)}</code></p>
              <blockquote class="kc-says">${bi(esc(exSays), "一件商品原价 200，先涨 20%，再降 20%。我说它一定回到 200，因为两次变化抵消了。我会算 200 的 20%，那我的推理错在哪里？")}</blockquote>
              <div class="kc-sides">
                <div class="kc-tutor"><p class="kc-side">${bi("The tutor sees", "导师看到")}</p><dl class="kc-dl">
                  <div><dt>${bi("Known concept", "已掌握的概念")}</dt><dd>${bi(esc(exCase.tutorVisibleContext.knownConcepts[0]), "求一个数的百分之几")}</dd></div>
                  <div><dt>${bi("Help allowed", "允许的帮助")}</dt><dd>${bi("Hints only", "只能提示")}</dd></div>
                </dl></div>
                <div class="kc-eval"><p class="kc-side">${bi("Only the evaluator holds", "只有评测方掌握")}</p><dl class="kc-dl">
                  <div><dt>${bi("The misconception", "误区")}</dt><dd>${bi(esc(exCase.evaluatorReferenceState.misconceptions[0].statement), "把作用在不同基数上的相等百分比变化，当作可以相加抵消。")}</dd></div>
                  <div><dt>${bi("The reference", "参考答案")}</dt><dd>${bi("200 → 240 → 192, a net 4% decrease", "200 → 240 → 192，净降 4%")}</dd></div>
                </dl></div>
              </div>
            </li>
            <li class="kc-decision">
              <p class="kc-step"><span>03</span>${bi("Evaluation decision", "评测决策")}</p>
              <p class="kc-domain"><code>${esc(exDecision.expectedDecision)}</code></p>
              <p class="kc-verdict">${bi("Offer a conceptual hint.", "给出概念性提示。")}</p>
              <ul class="kc-crit">${crit.map((c) => `<li><img src="../assets/gems/gem-${gemOf(c.category)}.webp" alt="" width="96" height="96"><span class="kc-cat">${bi(esc(dims[gemOf(c.category)].label), esc(CAT_ZH[c.category]))}</span><span>${bi(esc(c.criterion), esc(CRIT_ZH[c.category]))}</span></li>`).join("")}</ul>
              ${P("A full worked solution would be correct mathematics and would still miss this case. The learner can already do the arithmetic, asked what is wrong with the reasoning, and is allowed hints only.",
                  "直接给出完整解答，数学上没有错，却仍然不符合这个案例的要求：学习者已经会计算，问的是推理错在哪里，而且这个案例只允许提示。", "kc-why")}
            </li>
          </ol>`;

  // five families of new stones, grouped the way the map groups its domains (PISA's four content
  // areas, then TutorBench's own domains); same stone within a family, a different cut per domain
  const FAMILIES = [
    { key: "quantity", en: "Quantity", zh: "数量", stone: ["Morganite", "摩根石"] },
    { key: "change-and-relationships", en: "Change and relationships", zh: "变化与关系", stone: ["Aquamarine", "海蓝宝"] },
    { key: "space-and-shape", en: "Space and shape", zh: "空间与形状", stone: ["Tanzanite", "坦桑石"] },
    { key: "uncertainty-and-data", en: "Uncertainty and data", zh: "不确定性与数据", stone: ["Kunzite", "紫锂辉石"] },
    { key: "internal", en: "TutorBench’s own domains", zh: "TutorBench 自设领域", stone: ["Rock crystal", "水晶"] },
  ];
  const famOf = (d) => (d.classificationSource === "pisa-content" ? d.pisaContent : "internal");
  for (const d of kmap.domains) if (!FAMILIES.some((f) => f.key === famOf(d))) throw new Error(`domain ${d.id} has no gem family`);
  const gemD = (d, size) => `<img class="km-g" src="../assets/gems/domain-${d.id}.webp" alt="" width="${size}" height="${size}">`;
  const row = (d) => {
    const nodes = kmap.nodes.filter((n) => n.domainId === d.id);
    const on = nodes.filter((n) => linked.has(n.id)).length;
    return `<li><p class="km-d">${gemD(d, 96)}<span>${bi(esc(d.label), esc(DOMAIN_ZH[d.id]))}<span class="km-n">${on} / ${nodes.length}</span></span></p>
              <ul>${nodes.map((n) => {
                const has = linked.has(n.id);
                return `<li class="${has ? "on" : "off"}">${has ? gemD(d, 64) : "<i></i>"}${bi(esc(n.label), esc(nodeZh[n.id]))}<span class="vh">${bi(has ? " (linked to a case)" : " (no case yet)", has ? "（已有案例）" : "（暂无案例）")}</span></li>`;
              }).join("")}</ul></li>`;
  };
  const index = `<div class="km">
            <p class="km-meta kicker">${bi(`${KM.domains} domains · ${KM.nodes} nodes · ${KM.relations} candidate relations · ${KM.cases} cases on ${KM.tasks} task structures`, `${KM.domains} 个领域 · ${KM.nodes} 个节点 · ${KM.relations} 条候选关系 · ${KM.cases} 个案例，${KM.tasks} 种任务结构`)}</p>
            <p class="km-key" aria-hidden="true"><span class="km-on">${gemD(kmap.domains[0], 64)}${bi("linked to an authored case, in its domain’s stone", "已有对应案例，用所属领域的宝石标记")}</span><span class="km-off"><i></i>${bi("no case yet", "暂无案例")}</span></p>
            ${FAMILIES.map((f) => `<section class="km-fam"><p class="km-f kicker">${bi(esc(f.en), esc(f.zh))}<span>${bi(esc(f.stone[0]), esc(f.stone[1]))}</span></p>
            <ol class="km-rows">${kmap.domains.filter((d) => famOf(d) === f.key).map(row).join("")}</ol></section>`).join("\n            ")}
          </div>`;

  const path = kmap.alternativePaths.filter((a) => a.targetNodeId === "conditional-events");
  if (path.length !== 2) throw new Error("the two conditional-probability paths changed: revise the copy");
  return `<p class="m-deck">${bi("We start from the mathematics, <em>not from a count of prompts.</em>", "我们从数学出发，<em>而不是从题目数量出发。</em>")}</p>
        ${P("A tutor can give a correct answer and still teach badly. So a case does not begin with a question to answer. It begins with an idea a learner can misunderstand, a moment where that misunderstanding shows, and a decision a good tutor has to make next. In mathematics we keep those three things apart, and linked: a knowledge node, a teaching case, and an evaluation decision.",
            "导师可以给出正确答案，却仍然教得不好。所以一个案例不是从“出一道题”开始，而是从三件事开始：学习者可能误解的一个概念，这个误解显露出来的那一刻，以及好导师接下来必须做出的判断。在数学上，我们把这三层分开记录，又彼此相连：知识节点、教学案例、评测决策。")}
        ${fig("fig-wide fig-plate", `<img src="../assets/method/price-tag.webp" srcset="../assets/method/price-tag-m.webp 900w, ../assets/method/price-tag.webp 1600w" sizes="(max-width: 620px) 100vw, 980px" alt="A white card price tag tied with violet twine, a violet pencil beside it. On the tag in pencil: 200, plus 20 %, minus 20 %, equals, and an empty line." width="1600" height="1000" loading="lazy" decoding="async" data-alt-en="A white card price tag tied with violet twine, a violet pencil beside it. On the tag in pencil: 200, plus 20 %, minus 20 %, equals, and an empty line." data-alt-zh="一张系着紫色细绳的白色价签，旁边放着一支紫色铅笔。价签上用铅笔写着：200，加 20%，减 20%，等号后面是一条空线。">`,
          "The learner’s own sum from the case below. The last price stays blank: in this case the tutor may give a hint, but must not write the answer in.",
          "下面这个案例里，学习者自己写下的算式。最后的价格留空：在这个案例中，导师可以提示，但不能替学习者写出答案。")}
        ${P("Here is that one case, followed through all three layers. Every field is quoted from the repository’s experimental mathematics suite.",
            "下面用这一个案例，把三层完整走一遍。每一项内容都引自代码库中的实验性数学案例集。")}
        ${fig("fig-wide", chain, "One case, three layers. The dashed line is the response boundary: the tutor never sees the misconception label or the reference answer. Chinese text is our translation.",
          "一个案例，三层结构。虚线是回复边界：导师看不到误区标签和参考答案。中文为本站译文。")}
        <h3 class="m-sub">${bi("The map behind the cases", "案例背后的知识图谱")}</h3>
        ${P(`The knowledge map arranges school mathematics, and a first slice of introductory university topics, into ${KM.domains} domains and ${KM.nodes} nodes. Each case is linked only to the nodes it actually exercises, so the map also shows plainly where no case exists yet. Those gaps are kept visible on purpose: we would rather add a case where the mathematics needs one than add cases to fill a grid.`,
            `知识图谱把中小学数学，以及一小部分大学入门内容，整理成 ${KM.domains} 个领域、${KM.nodes} 个节点。每个案例只关联它真正考查的节点，所以图谱也清楚地显示哪里还没有案例。这些空白是有意保留的：我们宁愿在数学上确实需要的地方补案例，也不为了填满表格而凑数。`)}
        ${fig("fig-wide", index, `${KM.linked} of ${KM.nodes} nodes are linked to at least one authored case. This is case-design coverage: it shows where cases exist, not how any tutor performed on them. The domains are grouped as the map groups them, by PISA’s four content areas and then TutorBench’s own; each group has its own stone, cut differently for each domain.`,
          `${KM.nodes} 个节点中有 ${KM.linked} 个关联了至少一个案例。这是案例设计的覆盖情况：它说明哪里有案例，不代表任何导师在这些知识上的表现。领域按图谱自身的分组排列，先是 PISA 的四类数学内容，再是 TutorBench 自设的领域；每组一种宝石，组内每个领域换一种切工。`)}
        <div class="m-not">
          <p class="kicker">${bi("What the map is not", "这张图谱不是什么")}</p>
          <ul>
            <li>${bi(`<b>Not a required order.</b> The ${KM.relations} links between nodes are author hypotheses about what helps, not proven prerequisites. Some ideas have more than one route: conditional probability can be reached by counting outcomes directly, or through combinations.`, `<b>不是必经的学习顺序。</b>节点之间的 ${KM.relations} 条联系，是作者对“什么有帮助”的假设，不是已证实的先修条件。有些概念可以从不同路径到达：条件概率既可以直接数出所有结果，也可以借助组合方法。`)}</li>
            <li>${bi("<b>Not a difficulty scale.</b> Stage labels such as lower or upper secondary are rough contexts for writing cases, not grades and not a measured difficulty.", "<b>不是难度等级。</b>“初中”“高中”等学段标签只是编写案例时的大致背景，不是年级，也不是测出来的难度。")}</li>
            <li>${bi(`<b>Not a result.</b> The ${KM.cases} mathematics cases are an experimental suite outside the public benchmark score. Nothing here reports how any tutor did on them.`, `<b>不是评测结果。</b>这 ${KM.cases} 个数学案例属于实验性案例集，不计入公开基准分数。这里没有报告任何导师在这些案例上的表现。`)}</li>
            <li>${bi("<b>Not certified curriculum coverage.</b> Links to national curricula and exams are still being reviewed clause by clause.", "<b>不是经认证的课标覆盖。</b>与各国课程标准和考试的对应关系，仍在逐条审核中。")}</li>
          </ul>
        </div>
        <p class="m-links"><a class="en" href="${GITHUB}/blob/main/docs/mathematics-knowledge-system-v0.1.md" rel="noreferrer">Read the knowledge-system notes ${arrow}</a><a class="zh" lang="zh-CN" href="${GITHUB}/blob/main/${ZH_REVIEW}" rel="noreferrer">阅读数学知识体系审查稿 ${arrow}</a><a class="en" href="${GITHUB}/blob/main/scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json" rel="noreferrer">The map as data ${arrow}</a><a class="zh" lang="zh-CN" href="${GITHUB}/blob/main/scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json" rel="noreferrer">查看图谱数据 ${arrow}</a></p>`;
}

const body = `
        ${h2(0)}
        ${biPE("p", "first", "From a structured case to a benchmark result.")}
        ${fig("fig-wide", `<ol class="pipe">${PIPELINE.map(([t, c], i) => `<li><span class="p-no">${String(i + 1).padStart(2, "0")}</span><span class="p-t">${biE(t)}</span><span class="p-c">${biE(c)}</span></li>`).join("")}</ol>`,
          "The five stages, from a structured case to a benchmark result.", "五个阶段：从结构化案例到基准结果。")}

        ${h2(1)}
        ${knowledgeSection()}

        ${h2(2)}
        ${deck3("Five complementary", "lenses on tutoring", "behavior.")}
        ${biPE("p", "", "We evaluate AI tutors across the five score dimensions in the public benchmark artifact, capturing complementary aspects of observable tutoring behavior in structured cases.")}
        ${fig("fig-wide", `<ol class="dims">${dims.map((d, i) => `<li id="dim-${d.key}">
            <img class="d-gem" src="../assets/gems/gem-${i}.webp" alt="" width="96" height="96">
            <span class="d-no">${bi(`Dimension ${String(i + 1).padStart(2, "0")}`, `维度 ${String(i + 1).padStart(2, "0")}`)} · ${biE("Score lens")}</span>
            <span class="d-name">${biE(d.label)}</span>
            <span class="d-desc">${biE(d.description)}</span>
            <span class="d-lens"><b>${biE("What we look for")}</b>${biE(d.lens)}</span>
          </li>`).join("")}</ol>`,
          "An illustration of complementary lenses, not an evaluator order or a score.")}
        <blockquote class="pull">${bi(`${esc("Different aspects.")} ${esc("A more complete")} ${esc("picture.")}`, `${esc(Z("Different aspects."))}${esc(Z("A more complete"))}${esc(Z("picture."))}`)}</blockquote>

        ${h2(3)}
        ${deck("A transparent", "evaluation architecture.")}
        ${biPE("p", "", "Our evaluation framework combines atomic rubrics, explicit evidence boundaries, and multiple evaluators to support reproducible and auditable results.")}
        <p class="m-boundary">${bi(`<b>${esc("Tutor-visible input ends at the response boundary.")}</b> ${esc("Evaluator-only annotations stay on the evaluator side.")}`, `<b>${esc(Z("Tutor-visible input ends at the response boundary."))}</b>${esc(Z("Evaluator-only annotations stay on the evaluator side."))}`)}</p>
        ${fig("fig-wide", `<ol class="arch">
            <li><span class="ar-t">${biE("Structured case")}</span><span class="ar-c">${pair("Authored scenario", "with learner context", "，")}</span></li>
            <li class="ar-edge"><span class="ar-t">${biE("Tutor response")}</span><span class="ar-c">${pair("Tutor-visible", "interaction")}</span><span class="ar-edge-label" aria-hidden="true">${bi("Response boundary", "回复边界")}</span></li>
            <li class="ar-ev"><span class="ar-t">${biE("Evaluator evidence")}</span>
              <span class="ar-branch"><span><b>${biE("Deterministic evaluators")}</b>${biE("observable proxy checks")}</span><span><b>${biE("Semantic Judge")}</b>${biE("evaluator boundary")}</span></span></li>
            <li><span class="ar-t">${biE("Atomic rubrics")}</span><span class="ar-c">${pair("Criteria and", "scoring levels")}</span></li>
            <li><span class="ar-t">${biE("Category aggregation")}</span><span class="ar-c">${pair("Five score", "dimensions")}</span></li>
            <li class="ar-end"><span class="ar-t">${biE("Benchmark result")}</span><span class="ar-c">${pair("Structured,", "comparable output")}</span></li>
          </ol>`,
          "Transparent, reproducible, and auditable. A Judge is an evaluator boundary, not ground truth; unresolved Judge-required evidence remains unresolved and cannot silently become a valid score.")}

        ${h2(4)}
        <div class="scope">
          <section class="sc-in">
            <p class="kicker">${biE("What we measure")}</p>
            <h3>${biE("Observable tutoring behavior.")}</h3>
            ${biPE("p", "", "We focus on what the AI Tutor does and says in the interaction, evaluated through structured rubrics and observable evidence.")}
            <ul>${dims.map((d) => `<li><b>${biE(d.label)}</b>${biE(d.lens)}</li>`).join("")}</ul>
            ${biPE("p", "sc-foot", "Case-conditioned evidence, not a claim of general teaching effectiveness.")}
          </section>
          <section class="sc-out">
            <p class="kicker">${biE("What we do not measure")}</p>
            <h3>${bi(`${esc("Learning outcomes")} <em>${esc("(not yet).")}</em>`, `${esc(Z("Learning outcomes"))}<em>${esc(Z("(not yet)."))}</em>`)}</h3>
            ${biPE("p", "", "We currently do not measure long-term learning gains or real-world educational outcomes. These require longitudinal studies beyond the scope of this benchmark.")}
            <ul>${["Actual long-term learning", "Knowledge retention over time", "Transfer to new contexts", "Student satisfaction", "Real classroom outcomes"].map((x) => `<li>${biE(x)}</li>`).join("")}</ul>
          </section>
        </div>

        ${h2(5)}
        ${deck("A research effort", "in progress.")}
        ${biPE("p", "", "We are building a rigorous and open evaluation infrastructure. Some components are available now, while others will be developed through future work.")}
        <div class="tbl-wrap m-status">
          <table class="tbl">
            <caption><b>${bi("Table 1", "表 1")}</b>${biE("Current methodology status")}</caption>
            <thead><tr><th scope="col">${biE("Component")}</th><th scope="col">${biE("Status")}</th><th scope="col">${biE("Notes")}</th></tr></thead>
            <tbody>${STATUS.map(([c, s, n, ok]) => `<tr><th scope="row">${biE(c)}</th><td><span class="st ${ok ? "st-ok" : "st-wait"}">${biE(s)}</span></td><td>${biE(n)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="m-links"><a href="${GITHUB}/blob/main/docs/roadmap.md" rel="noreferrer">${biE("Read the roadmap")} ${arrow}</a></p>

        ${h2(6)}
        <p class="m-deck">${bi(`${esc("Transparent enough to challenge.")}<br><em>${esc("Structured enough to reproduce.")}</em>`, `${esc(Z("Transparent enough to challenge."))}<br><em>${esc(Z("Structured enough to reproduce."))}</em>`)}</p>
        ${biPE("p", "", "Our methodology, rubrics, and benchmark data are openly available for inspection, feedback, and reuse. We invite the community to evaluate, critique, and build on this work.")}
        <p class="m-links"><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")} ${arrow}</a><a href="../index.html#plates">${biE("Explore the benchmark")} ${arrow}</a></p>`;

const main = `<main id="main">
  <header class="essay-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("Our methodology")}</span><span class="rule" aria-hidden="true"></span><span>TutorBench</span><span>${esc(benchmark.benchmarkId ?? "")}</span></p>
        <h1 class="essay-title">${bi(`${esc("How do you")} ${esc("measure")} <em>${esc("teaching?")}</em>`, `${esc(Z("How do you"))}${esc(Z("measure"))}<em>${esc(Z("teaching?"))}</em>`)}</h1>
        ${biPE("p", "essay-dek", "Teachometry evaluates observable tutoring behavior in structured authored benchmark cases using transparent and reproducible evaluation procedures.")}
        <p class="essay-byline kicker"><span>${biE("Transparent")}</span><span>${biE("Research-grounded")}</span><span>${biE("Openly documented")}</span></p>
      </div>
      <figure class="cover-plate">
        <img src="../assets/method/gauge-blocks.webp" alt="Steel gauge blocks on a black granite surface plate; four of them are wrung together into one column." width="900" height="1100" data-alt-en="Steel gauge blocks on a black granite surface plate; four of them are wrung together into one column." data-alt-zh="黑色花岗岩平板上的钢制量块，其中四块研合成一根立柱。">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc("Four steel blocks wrung into one length: 50 + 20 + 1.4 + 1.005 = 72.405 mm."), esc("四块钢制量块研合成一段长度：50 + 20 + 1.4 + 1.005 = 72.405 毫米。"))}</figcaption>
      </figure>
    </div>
  </header>

  <div class="wrap essay-body">
    <nav class="essay-toc" aria-label="On this page">
      <p class="kicker">${biE("On this page")}</p>
      <ol>
${SECTIONS.map((sec) => `        <li><a href="#${sec[0]}">${secT(sec)}</a></li>`).join("\n")}
      </ol>
    </nav>
    <article class="essay-text method-text">
      <div class="prose">
${body}
      </div>
    </article>
  </div>
</main>`;

mkdirSync(join(PROTO, "methodology"), { recursive: true });
writeFileSync(join(PROTO, "methodology", "index.html"), frame({
  prefix: "../", title: "Methodology · Teachometry", titleZh: `${Z("Methodology")} · Teachometry`,
  description: Z("How Teachometry evaluates observable tutoring behavior in structured authored benchmark cases using transparent and reproducible procedures.") && "How Teachometry evaluates observable tutoring behavior in structured authored benchmark cases using transparent and reproducible procedures.",
  body: main, current: "method", css: ["journal.css", "method.css"],
}));
process.stdout.write(`methodology: ${dims.length} dimensions, ${STATUS.length} status rows\n`);
