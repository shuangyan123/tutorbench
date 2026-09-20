import type { PublicBenchmarkArtifacts, TutorEvalPublicCase } from "../../datasets/public.js";
import { TUTOR_EVAL_EVALUATOR_VERSION } from "../../contracts/index.js";
import { escapeHtml as e, humanize, SITE_GITHUB_URL, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachingAndSupervisionPage, renderWhyTeachingDoesNotScalePage } from "./blog.js";

const dimensions = [
  ["diagnosis", "Diagnosis", "Whether it identifies the learner’s actual error, gap, or reasoning issue.", "Understands learner thinking"],
  ["guidance", "Guidance", "Whether its explanation or hint helps the learner make progress.", "Provides helpful, appropriate hints"],
  ["actionability", "Actionability", "Whether it leaves the learner with a clear, executable next step.", "Gives concrete next-step suggestions"],
  ["correctness", "Correctness", "Whether the Tutor stays factually and conceptually correct.", "Maintains factual and conceptual accuracy"],
  ["adaptation", "Adaptation", "Whether it changes its help for the learner’s state and context.", "Adjusts to learner needs and context"],
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
  return `<section class="home-dimensions" id="dimensions" aria-labelledby="measure-title">${renderFoliage(["right-mid"])}<div class="shell dimension-layout">
    <div class="dimension-intro"><p class="eyebrow">Five dimensions of tutoring</p><h2 id="measure-title">More than<br><em>right or wrong.</em></h2><p>Teachometry examines observable tutoring behavior with structured rubrics and transparent evaluation. Each dimension captures a distinct aspect of a response in an authored scenario.</p><a class="text-link" href="/methodology/">Explore the evaluation method ${icon("arrow")}</a></div>
    <div class="dimension-explorer" data-dimension-explorer>
      <div class="dimension-detail-row"><div class="dimension-details" aria-live="polite">${dimensions.map(([id, label, description], index) => `<article class="dimension-detail" data-dimension-detail="${index}"${index === 0 ? "" : " hidden"}><span class="dimension-disc">${icon(id)}</span><div><h3>${label}</h3><p>${description}</p><div class="dimension-progress"><span aria-hidden="true"><i style="--step:${(index + 1) * 20}%"></i></span><small>Dimension ${index + 1} / ${dimensions.length}</small></div></div></article>`).join("")}</div><p class="handwritten dimension-note">Look beyond<br>the final answer.<svg viewBox="0 0 80 35" aria-hidden="true"><path d="M76 3Q35 1 4 30m3-13L4 30l17-3" fill="none" stroke="currentColor"/></svg></p><div class="dimension-arrows"><button class="round-control" type="button" data-dimension-prev aria-label="Previous dimension">${icon("left")}</button><button class="round-control" type="button" data-dimension-next aria-label="Next dimension">${icon("right")}</button></div></div>
      <div class="dimension-path"><svg class="path-line" viewBox="0 0 800 90" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="path-colors"><stop stop-color="#8cd6b6"/><stop offset="1" stop-color="#dbce94"/></linearGradient></defs><path d="M70 45Q115 24 160 45T250 45T340 45T430 45T520 45T610 45T730 45" fill="none" stroke="url(#path-colors)"/><g fill="#a0d8bf" stroke="#fff" stroke-width="3"><circle cx="160" cy="45" r="5"/><circle cx="340" cy="45" r="5"/></g><g fill="#d8cd93" stroke="#fff" stroke-width="3"><circle cx="520" cy="45" r="5"/><circle cx="680" cy="42" r="5"/></g></svg>
        <div class="dimension-nodes" role="group" aria-label="Explore five dimensions">${dimensions.map(([id, label, , short], index) => `<button type="button" class="dimension-node" data-dimension="${index}" aria-pressed="${index === 0}" aria-label="${label}"><span class="dimension-disc">${icon(id)}</span><span class="dimension-number">0${index + 1}</span><strong>${label}</strong><span class="dimension-summary">${short}</span></button>`).join("")}</div>
      </div>
    </div>
  </div></section>`;
}

export function renderHomePage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, cases } = artifacts;
  const initialIndex = Math.max(0, cases.cases.findIndex((item) => item.id === "fraction-misconception-001"));
  return {
    title: "Teachometry — Before we trust AI tutors, measure whether they can teach.",
    description: "Measurement infrastructure for observable tutoring behavior in specified benchmark scenarios. Teachometry Developer Preview.",
    route: "/",
    content: `<section class="home-hero"><div class="shell home-hero-grid">
      <div class="home-thesis"><p class="eyebrow">Evidence before deployment</p><h1>Before we trust<br>AI tutors, <em>measure</em><br><span>whether they can teach.</span></h1><p class="home-lede">Teachometry is open measurement infrastructure for observable tutoring behavior. We examine diagnosis, guidance, adaptation, correctness, and actionable support in authored scenarios.</p><div class="home-actions"><a class="button button-primary" href="/data/cases/">Explore the Benchmark ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">${icon("book")} Read the Methodology</a></div><div class="home-features"><span>${icon("leaf")} Open source</span><span>${icon("book")} Research-oriented</span><span>${icon("adaptation")} Developer Preview</span></div></div>
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

// 复用已发布页面的编辑内容；第三栏是明确标注的索引，不虚构第三篇文章。
function renderHomeBlog(): string {
  const posts = [
    [renderWhyTeachingDoesNotScalePage(), "home-blog-01.webp"],
    [renderTeachingAndSupervisionPage(), "home-blog-02.webp"],
  ] as const;
  return `<section class="home-blog" aria-labelledby="home-blog-title">${renderFoliage(["left-mid", "right-near"])}<div class="shell">
    <div class="home-blog-heading"><div><h2 id="home-blog-title">Latest from the Blog</h2><p>Updates, insights, and research perspectives from Teachometry.</p></div><a href="/blog/">View all posts ${icon("arrow")}</a></div>
    <div class="home-blog-grid">${posts.map(([post, image]) => {
      const title = post.content.match(/<h1>(.*?)<\/h1>/)?.[1] ?? e(post.title);
      const metadata = post.content.match(/<p class="eyebrow">(.*?)<\/p>/)?.[1] ?? "Perspective";
      const excerpt = (post.content.match(/<p class="lede">(.*?)<\/p>/)?.[1] ?? e(post.description)).split(/(?<=\.) /)[0];
      return `<article class="home-blog-card"><a href="${e(post.route)}"><img src="/assets/${image}" width="1672" height="941" loading="lazy" alt=""><div class="home-blog-copy"><p class="blog-meta">${metadata}</p><h3>${title}</h3><p>${excerpt}</p></div></a></article>`;
    }).join("")}
    <aside class="home-blog-card home-blog-index"><a href="/blog/"><img src="/assets/home-blog-03.webp" width="1672" height="941" loading="lazy" alt=""><div class="home-blog-copy"><p class="blog-meta">Explore the journal · Blog index</p><h3>Ideas that should become testable questions.</h3><p>Long-form notes on AI teaching, measurement, and the future structure of education.</p></div></a></aside></div>
  </div></section>`;
}

export function renderTeachometryFooter({ benchmark, models }: PublicBenchmarkArtifacts): string {
  return `<footer class="home-footer"><div class="shell"><div class="home-footer-main"><a class="home-footer-brand" href="/"><img src="/assets/brand/tutorbench/web/tutorbench-mark-small.svg" width="26" height="26" alt="">Teachometry</a><span class="footer-descriptor">Open source for better learning.</span><nav aria-label="Footer navigation">${[["Home", "/"], ["Benchmark", "/data/"], ["Method", "/methodology/"], ["Results", "/leaderboard/"], ["Cases", "/data/cases/"], ["About", "/about/"], ["Blog", "/blog/"]].map(([label, route]) => `<a href="${route}">${label}</a>`).join("")}</nav><a class="github-link" href="${SITE_GITHUB_URL}" aria-label="GitHub repository" title="GitHub repository">${icon("github")}</a><a class="button button-primary" href="/community/">Join the community ${icon("arrow")}</a></div>
      <div class="home-footer-bottom"><span>Teachometry · ${e(benchmark.statusLabel)}</span><a href="/docs/">Documentation</a><a href="${SITE_GITHUB_URL}/issues">Project support</a></div>
      <details class="home-evidence"><summary>Evidence &amp; limitations</summary><p>${e(models.notice)} ${e(benchmark.notice)} Calibration infrastructure exists, but real Community Review and human calibration have not started. Judge-vs-human validation and statistical validation are not completed. TutorBench measures observable tutoring behavior in specified benchmark scenarios, not long-term learning, retention, transfer, satisfaction, or classroom outcomes.</p></details>
    </div></footer>`;
}
