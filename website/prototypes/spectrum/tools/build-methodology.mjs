// Builds methodology/index.html for the Spectrum prototype, in English and 简体中文 on one page.
// The copy mirrors renderMethodologyPage in src/site/pages/developer.ts; every English string is looked
// up in the live SITE_ZH_CN_COPY, so a string that drifts from the live page fails the build instead of
// shipping. Statuses and the dimension list come from the public benchmark artifact, as on the live page.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-methodology.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, bi, biE, biPE, frame, RENDERED } from "./site-kit.mjs";

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
  ["dimensions", "Five evaluation dimensions"],
  ["architecture", "From response to result"],
  ["scope", "What we measure"],
  ["status", "Methodology status"],
  ["commitment", "Our commitment"],
];
const h2 = (i) => `<h2 id="${SECTIONS[i][0]}"><span class="no">§${i + 1}</span><span>${biE(SECTIONS[i][1])}</span></h2>`;
const deck = (a, b) => `<p class="m-deck">${bi(`${esc(a)} <em>${esc(b)}</em>`, `${esc(Z(a))}<em>${esc(Z(b))}</em>`)}</p>`;
const deck3 = (a, b, c) => `<p class="m-deck">${bi(`${esc(a)} ${esc(b)} <em>${esc(c)}</em>`, `${esc(Z(a))}${esc(Z(b))}<em>${esc(Z(c))}</em>`)}</p>`;
let figNo = 0;
const fig = (cls, body, capEn, capZh) => { figNo += 1; return `<figure class="fig ${cls}" id="fig${figNo}">
          ${body}
          <figcaption><b>${bi(`Fig. ${figNo}`, `图 ${figNo}`)}</b>${capZh === undefined ? biE(capEn) : bi(esc(capEn), esc(capZh))}</figcaption>
        </figure>`; };
const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

const body = `
        ${h2(0)}
        ${biPE("p", "first", "From a structured case to a benchmark result.")}
        ${fig("fig-wide", `<ol class="pipe">${PIPELINE.map(([t, c], i) => `<li><span class="p-no">${String(i + 1).padStart(2, "0")}</span><span class="p-t">${biE(t)}</span><span class="p-c">${biE(c)}</span></li>`).join("")}</ol>`,
          "The five stages, from a structured case to a benchmark result.", "五个阶段：从结构化案例到基准结果。")}

        ${h2(1)}
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

        ${h2(2)}
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

        ${h2(3)}
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

        ${h2(4)}
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

        ${h2(5)}
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
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc("Four steel blocks wrung into one length: 50 + 20 + 1.4 + 1.005 = 72.405 mm. " + RENDERED[0]), esc("四块钢制量块研合成一段长度：50 + 20 + 1.4 + 1.005 = 72.405 毫米。" + RENDERED[1]))}</figcaption>
      </figure>
    </div>
  </header>

  <div class="wrap essay-body">
    <nav class="essay-toc" aria-label="On this page">
      <p class="kicker">${biE("On this page")}</p>
      <ol>
${SECTIONS.map(([id, t]) => `        <li><a href="#${id}">${biE(t)}</a></li>`).join("\n")}
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
