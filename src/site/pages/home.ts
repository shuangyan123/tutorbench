import type { PublicBenchmarkArtifacts, TutorEvalPublicCase } from "../../datasets/public.js";
import { TUTOR_EVAL_EVALUATOR_VERSION } from "../../contracts/index.js";
import { escapeHtml as e, humanize, SITE_GITHUB_URL, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { BLOG_POSTS } from "./blog.js";

const dimensions = [
  ["diagnosis", "Diagnosis", "Whether it identifies the learner’s actual error, gap, or reasoning issue.", "Understands learner thinking", "Did it understand the learner?"],
  ["guidance", "Guidance", "Whether its explanation or hint helps the learner make progress.", "Provides helpful, appropriate hints", "Did it help the learner move forward?"],
  ["actionability", "Actionability", "Whether it leaves the learner with a clear, executable next step.", "Gives concrete next-step suggestions", "Does the learner know what to do next?"],
  ["correctness", "Correctness", "Whether the Tutor stays factually and conceptually correct.", "Maintains factual and conceptual accuracy", "Is the help actually correct?"],
  ["adaptation", "Adaptation", "Whether it changes its help for the learner’s state and context.", "Adjusts to learner needs and context", "Did it respond to this learner, not just any learner?"],
] as const;

// 装饰层不参与内容、读屏或点击；仅 Home 使用随包提供的透明前景。
function renderFoliage(layers: readonly string[]): string {
  return `<div class="home-foliage" aria-hidden="true">${layers.map((layer) => `<img class="foliage-layer foliage-${layer}" src="/assets/foliage-${layer}.webp" alt="" width="1536" height="1024" loading="lazy">`).join("")}</div>`;
}

function renderCase(item: TutorEvalPublicCase, index: number, count: number, selected: boolean): string {
  const key = `walkthrough-${index}`;
  const level = typeof item.metadata.difficulty === "object"
    ? humanize(item.metadata.difficulty.learnerLevel) : item.tutorInput.studentProfile?.level;
  const tabs = ["Learner", "Tutor (AI)", "Rubric", "Analysis"];
  // 只展示 public case 输入；没有公开运行时不生成 Tutor 回复或评估成绩。
  return `<article data-home-case${selected ? "" : " hidden"} aria-label="Case ${index + 1} of ${count}">
    <div class="walkthrough-meta"><span class="eyebrow">CASE ${String(index + 1).padStart(2, "0")} <span class="case-total">/ ${count}</span></span><span class="case-badge">${e([level, humanize(item.metadata.subject)].filter(Boolean).join(" · "))}</span></div>
    <h2 class="walkthrough-title">${e(humanize(item.metadata.topic))}</h2>
    <div class="walkthrough-tabs" role="tablist" aria-label="Case walkthrough">
      ${tabs.map((label, tabIndex) => `<button type="button" role="tab" id="${key}-tab-${tabIndex}" aria-controls="${key}-panel-${tabIndex}" aria-selected="${tabIndex === 0}" tabindex="${tabIndex === 0 ? 0 : -1}">${label}</button>`).join("")}
    </div>
    <div class="walkthrough-body">
      <div class="walkthrough-content">
        <div role="tabpanel" id="${key}-panel-0" aria-labelledby="${key}-tab-0" tabindex="0">
          <blockquote class="learner-message" lang="${e(item.locale ?? "en")}">${e(item.tutorInput.studentMessage)}</blockquote>
          <div class="tutor-objective"><span class="micro-label">Authored learning objective</span><p lang="${e(item.locale ?? "en")}">${e(item.tutorInput.learningObjective)}</p></div>
        </div>
        <div role="tabpanel" id="${key}-panel-1" aria-labelledby="${key}-tab-1" tabindex="0" hidden><div class="tutor-objective"><span class="micro-label">Tutor (AI) · no public response</span><p>This walkthrough shows a synthetic case input. No model response or model score is published here.</p><a href="/run/">Run TutorBench ${icon("arrow")}</a></div></div>
        <div role="tabpanel" id="${key}-panel-2" aria-labelledby="${key}-tab-2" tabindex="0" hidden><div class="tutor-objective"><span class="micro-label">Rubric preview</span><p>Each authored rubric belongs to a primary scoring dimension. This public case view does not expose evaluator-only annotations.</p><a href="/methodology/">Read the rubric method ${icon("arrow")}</a></div></div>
        <div role="tabpanel" id="${key}-panel-3" aria-labelledby="${key}-tab-3" tabindex="0" hidden><div class="tutor-objective"><span class="micro-label">Case context · ${e(item.locale ?? "en")}</span><p>${e(humanize(item.metadata.studentState ?? item.metadata.learningTask ?? item.metadata.topic))}</p><p>${e((item.metadata.capabilityTags ?? []).map(humanize).join(" · "))}</p></div></div>
      </div>
      <aside class="rubric-preview" aria-label="Five dimensions, not scored"><p class="micro-label">Evaluation dimensions</p>${dimensions.map(([, label]) => `<div class="rubric-row"><span>${label}</span><span class="score-track" aria-hidden="true"></span><span class="score-pending">N/A</span></div>`).join("")}<p class="score-caption">Not scored · no model run</p></aside>
    </div>
    <div class="walkthrough-bottom"><a class="case-open" href="/data/cases/${encodeURIComponent(item.id)}/">Open the full case ${icon("arrow")}</a><span class="walkthrough-status">${icon("book")} Illustrative case walkthrough</span></div>
  </article>`;
}

function renderDimensions(): string {
  return `<section class="home-dimensions" id="dimensions" data-home-story aria-labelledby="measure-title"><div class="shell home-story-layout">
    <div class="home-story-copy">
      <header class="home-story-intro"><p class="eyebrow">Five dimensions of tutoring</p><h2 id="measure-title">More than<br><em>right or wrong.</em></h2><p>Teachometry examines observable tutoring behavior with structured rubrics and transparent evaluation. Each dimension captures a distinct aspect of a response in an authored scenario.</p><a class="text-link" href="/methodology/">Explore the evaluation method ${icon("arrow")}</a></header>
      <div class="home-story-chapters">${dimensions.map(([id, label, description, summary, question], index) => `<article class="home-story-chapter" data-home-story-chapter="${index}" aria-labelledby="home-story-question-${id}">
        <p class="home-story-index"><span>0${index + 1}</span><span class="home-story-total" aria-hidden="true"> / 0${dimensions.length}</span></p>
        <h3 id="home-story-question-${id}">${question}</h3>
        <p class="home-story-dimension">${label}</p>
        <p class="home-story-description">${description}</p>
        <p class="home-story-summary">${summary}</p>
      </article>`).join("")}</div>
    </div>
    <figure class="home-story-stage" data-home-story-visual data-home-story-active="0">
      <div class="home-story-stage-heading"><figcaption>Response under evaluation</figcaption><span data-home-story-current aria-hidden="true">01 / 05</span></div>
      <svg class="home-story-response" viewBox="0 0 760 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
        <g class="home-response-specimen" fill="none" stroke="var(--line-strong)" stroke-linecap="square" stroke-width="2" opacity=".72">
          <g class="home-response-paragraph"><path d="M112 88h468M112 106h326M112 124h418"/></g>
          <g class="home-response-paragraph"><path d="M112 178h392M112 196h468M112 214h295"/></g>
          <g class="home-response-paragraph"><path d="M112 284h472M112 302h352"/></g>
          <g class="home-response-paragraph"><path d="M112 385h434M112 403h320M112 421h486"/></g>
        </g>
        <g class="home-story-state" data-home-story-state="0" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter">
          <rect x="103" y="162" width="410" height="32" fill="var(--accent-soft)" fill-opacity=".42" stroke="none"/>
          <path d="M91 160v36M91 160h10M91 196h10M76 178h11" stroke-dasharray="2 5" opacity=".72"/>
          <path d="M112 178h392" stroke-width="2.8"/>
        </g>
        <g class="home-story-state" data-home-story-state="1" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M90 98v194M90 106h13M90 178h13M90 284h13" stroke-dasharray="1 6" opacity=".58"/>
          <path d="M112 106h214M112 178h266M112 284h314" stroke-width="2.7"/>
          <path d="M90 106h9M90 178h9M90 284h9" stroke-width="2.4"/>
        </g>
        <g class="home-story-state" data-home-story-state="2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M580 106h72v252M580 196h72M584 284h68" stroke="var(--line)" stroke-width="1.6" stroke-dasharray="2 6" opacity=".78"/>
          <path d="M652 358h17v31M104 386v35M104 386h9M104 421h9M669 386v35M669 386h-9M669 421h-9" stroke="var(--accent)" stroke-width="2"/>
          <rect x="111" y="389" width="328" height="28" fill="var(--accent-soft)" fill-opacity=".44" stroke="none"/>
          <path d="M112 403h320M683 397v13" stroke="var(--accent)" stroke-width="2.8"/>
        </g>
        <g class="home-story-state" data-home-story-state="3" fill="none" stroke="var(--accent)" stroke-linecap="square">
          <rect x="105" y="270" width="365" height="27" fill="var(--accent-soft)" fill-opacity=".38" stroke="none"/>
          <path d="M112 284h352M104 311h490" stroke-width="2.3"/>
          <path d="M112 307v9M352 307v9M584 307v9" stroke-width="1.6" opacity=".78"/>
        </g>
        <g class="home-story-state" data-home-story-state="4" fill="none" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M70 284v36M70 284h11M70 320h11M81 302h15M96 302v-18h9M96 302v18h9" stroke="var(--line-strong)" stroke-width="1.8"/>
          <path d="M104 284h8M104 302h8" stroke="var(--line-strong)" stroke-width="1.6" opacity=".72"/>
          <rect x="110" y="271" width="367" height="25" fill="var(--accent-soft)" fill-opacity=".38" stroke="none"/>
          <path d="M112 284h352" stroke="var(--accent)" stroke-width="2.8"/>
        </g>
      </svg>
    </figure>
  </div></section>`;
}

export function renderHomePage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, cases } = artifacts;
  const initialIndex = Math.max(0, cases.cases.findIndex((item) => item.id === "fraction-misconception-001"));
  return {
    title: "Teachometry — Test how AI tutors behave before you ship them.",
    description: "Scenario-based evaluation and regression infrastructure for observable AI tutoring behavior. Teachometry Developer Preview.",
    route: "/",
    content: `<section class="home-hero"><div class="shell home-hero-grid">
      <div class="home-thesis"><p class="eyebrow">Evidence before deployment</p><h1>Test how AI tutors<br><em>behave</em> before<br><span>you ship them.</span></h1><p class="home-lede">Teachometry turns authored learning situations into reproducible Tutor Health evaluations: inspect teaching decisions, diagnose concrete failures, and keep the evidence needed to fix and retest them.</p><div class="home-actions"><a class="button button-primary" href="/run/">Run an Evaluation ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">${icon("book")} Read the Methodology</a></div><div class="home-features"><span>${icon("leaf")} Open source</span><span>${icon("book")} Evidence-first</span><span>${icon("adaptation")} Developer Preview</span></div></div>
      <div class="case-walkthrough" data-case-walkthrough data-initial-case="${initialIndex}"><div class="case-controls"><button type="button" aria-label="Previous case" data-case-prev>${icon("left")}</button><button type="button" aria-label="Next case" data-case-next>${icon("right")}</button></div>${cases.cases.map((item, index) => renderCase(item, index, cases.cases.length, index === initialIndex)).join("")}<span class="visually-hidden" aria-live="polite" data-case-announcement></span></div>
    </div><div class="shell hero-foot"><a class="scroll-cue" href="#dimensions"><span>${icon("arrow")}</span>Scroll to explore</a><p class="handwritten hero-note">Evidence for<br>human-centered AI tutoring.</p></div></section>
    ${renderDimensions()}
    <section class="home-data" aria-labelledby="home-data-title">${renderFoliage(["left-near"])}<div class="shell home-data-grid">
      <div class="home-data-statement"><p class="eyebrow">Measurement infrastructure for AI tutoring</p><h2 id="home-data-title">Open data.<br>Transparent evaluation.<br><em>Observable behavior.</em></h2><a class="button data-link" href="/data/">Explore the data ${icon("arrow")}</a></div>
      <dl class="home-facts"><div><dt>Synthetic cases</dt><dd>${benchmark.dataset.caseCount}</dd><dd class="fact-note">Public development scenarios</dd></div><div><dt>Authored rubrics</dt><dd>${benchmark.dataset.rubricCount}</dd><dd class="fact-note">Case-specific evaluation criteria</dd></div><div><dt>Current dataset</dt><dd>${e(benchmark.dataset.version)}</dd><dd class="fact-note">${e(benchmark.dataset.id)}</dd></div><div><dt>Evaluator version</dt><dd>${e(TUTOR_EVAL_EVALUATOR_VERSION)}</dd><dd class="fact-note">Open and reproducible</dd></div></dl>
    </div></section>
    ${renderHomeBlog()}
    ${renderTeachometryFooter(artifacts)}`,
  };
}

// 第三栏是明确标注的索引，不虚构第三篇文章；文章卡片使用集中维护的真实元数据。
function renderHomeBlog(): string {
  const posts = BLOG_POSTS;
  return `<section class="home-blog" aria-labelledby="home-blog-title">${renderFoliage(["left-mid", "right-near"])}<div class="shell">
    <div class="home-blog-heading"><div><h2 id="home-blog-title">Latest from the Blog</h2><p>Updates, insights, and research perspectives from Teachometry.</p></div><a href="/blog/">View all posts ${icon("arrow")}</a></div>
    <div class="home-blog-grid">${posts.map((post) => `<article class="home-blog-card"><a href="${e(post.route)}"><img src="/assets/${e(post.image)}" width="1672" height="941" loading="lazy" alt=""><div class="home-blog-copy"><p class="blog-meta">${e(post.category)} · ${e(post.publishedDate)}</p><h3>${e(post.title)}</h3><p>${e(post.excerpt)}</p></div></a></article>`).join("")}
    <aside class="home-blog-card home-blog-index"><a href="/blog/"><img src="/assets/home-blog-03.webp" width="1672" height="941" loading="lazy" alt=""><div class="home-blog-copy"><p class="blog-meta">Explore the journal · Blog index</p><h3>Ideas that should become testable questions.</h3><p>Long-form notes on AI teaching, measurement, and the future structure of education.</p></div></a></aside></div>
  </div></section>`;
}

export function renderTeachometryFooter({ benchmark, models }: PublicBenchmarkArtifacts): string {
  return `<footer class="home-footer"><div class="shell"><div class="home-footer-main"><a class="home-footer-brand" href="/"><img src="/assets/brand/tutorbench/web/tutorbench-mark-small.svg" width="26" height="26" alt="">Teachometry</a><span class="footer-descriptor">Open source for better learning.</span><nav aria-label="Footer navigation">${[["Home", "/"], ["Benchmark", "/data/"], ["Method", "/methodology/"], ["Results", "/leaderboard/"], ["Cases", "/data/cases/"], ["About", "/about/"], ["Blog", "/blog/"]].map(([label, route]) => `<a href="${route}">${label}</a>`).join("")}</nav><a class="github-link" href="${SITE_GITHUB_URL}" aria-label="GitHub repository" title="GitHub repository">${icon("github")}</a><a class="button button-primary" href="/community/">Join the community ${icon("arrow")}</a></div>
      <div class="home-footer-bottom"><span>Teachometry · ${e(benchmark.statusLabel)}</span><a href="/docs/">Documentation</a><a href="${SITE_GITHUB_URL}/issues">Project support</a></div>
      <details class="home-evidence"><summary>Evidence &amp; limitations</summary><p>${e(models.notice)} ${e(benchmark.notice)} Calibration infrastructure exists, but real Community Review and human calibration have not started. Judge-vs-human validation and statistical validation are not completed. TutorBench measures observable tutoring behavior in specified benchmark scenarios, not long-term learning, retention, transfer, satisfaction, or classroom outcomes.</p></details>
    </div></footer>`;
}
