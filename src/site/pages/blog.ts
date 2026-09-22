import { escapeHtml as e, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderEditorialBotanical } from "../illustrations.js";

const BLOG_PUBLISHED_DATE = "September 17, 2026";

export interface BlogPostSummary {
  readonly category: "Perspective";
  readonly publishedDate: string;
  readonly title: string;
  readonly description: string;
  readonly excerpt: string;
  readonly route: string;
  readonly image: string;
  readonly imageAlt: string;
}

export interface BlogCallout {
  readonly label: string;
  readonly title?: string;
  readonly body: string;
}

export interface BlogArticleSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly progression?: readonly { readonly label: string; readonly text: string }[];
  readonly callout?: BlogCallout;
}

export interface BlogArticle extends BlogPostSummary {
  readonly sections: readonly BlogArticleSection[];
  readonly pullQuote: string;
  readonly evidenceBoundary: string;
}

const WHY_TEACHING_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "The scarce resource is attention",
    paragraphs: [
      "One teacher can explain an idea to a room, but cannot continuously observe every learner, diagnose every misconception, choose a different explanation for each student, verify genuine understanding, and adjust the next task for everyone at once. That is a capacity constraint even when the teacher is excellent and conscientious.",
      "K12 systems therefore work at the level of groups. They need classrooms to remain orderly, curricula to move forward, exams to be administered, and students to cross common thresholds. Individual optimization is desirable, but it competes with the practical requirement to teach many people at the same time.",
    ],
  },
  {
    heading: "Scores create a powerful external structure",
    paragraphs: [
      "Much K12 learning is not purely voluntary. Families and schools use grades, exams, schedules, expectations, and supervision to make learning happen even when a student is not intrinsically interested in the subject. Students who perform well often receive more recognition and confidence; students who repeatedly fall behind can experience the opposite.",
      "This means an education system is doing at least two jobs at once: teaching, and creating an environment in which learning is difficult to avoid. Any serious AI education system has to understand both jobs.",
    ],
  },
  {
    heading: "Private tutoring reveals what families are really buying",
    paragraphs: [
      "A private tutor is valuable not only because the tutor may explain a subject well. The product also includes dedicated attention, direct accountability to the family, supervision of the student, visible progress, and a trust signal built from credentials, experience, reputation, or past results.",
      "The expensive part is that all of this is tied to a person's time. High-quality one-to-one attention is difficult to distribute broadly because each additional learner requires another block of human labor.",
    ],
  },
  {
    heading: "AI changes the cost structure only if it can actually teach",
    paragraphs: [
      "If an AI system can reliably diagnose a learner, select an appropriate explanation, generate practice, detect false mastery, revisit weak knowledge, adapt over time, and verify learning rather than merely produce answers, then individualized teaching attention becomes much more reproducible.",
    ],
    callout: {
      label: "Working hypothesis",
      title: "Teaching could become computationally scalable.",
      body: "Instead of many students sharing one teacher's limited instructional attention, each student could have a persistent teaching system while human attention is reserved for the tasks that still require human presence and responsibility.",
    },
  },
  {
    heading: "The standard cannot be “the student got the answer”",
    paragraphs: [
      "An AI can make a learner look more capable by doing cognitive work on the learner's behalf. That is not the same as learning. The stronger test is whether the student can retain, transfer, and apply the knowledge after the AI is removed.",
      "For that reason, AI education should not be trusted because a model sounds intelligent or because it solves benchmark questions. It should be trusted only to the extent that we can show that its teaching changes the learner in durable and useful ways.",
    ],
  },
  {
    heading: "Why Teachometry exists",
    paragraphs: [
      "The long-run question is not simply whether an AI can answer correctly. It is whether an AI can take responsibility for progressively larger parts of teaching. That requires measurement at several levels: observable tutoring behavior, actual learning effectiveness, and eventually instructional autonomy over longer periods.",
      "Teachometry exists to turn those claims into testable questions. The goal is not to assume that AI has already replaced the teacher. The goal is to build the evidence needed to know what it can reliably do, for whom, under what conditions, and where human teaching remains necessary.",
    ],
  },
];

const TEACHING_AND_SUPERVISION_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "Today's teacher is several jobs in one",
    paragraphs: [
      "A classroom teacher explains content, diagnoses mistakes, prepares exercises, grades work, answers questions, motivates students, manages behavior, communicates with families, and remains responsible for a room full of minors. These functions are packaged together because historically the same adult had to be present to perform the teaching.",
      "That packaging should not be mistaken for a law of nature. If instruction can be delivered reliably by another system, the human functions that remain can be designed separately.",
    ],
  },
  {
    heading: "AI has no inherent authority",
    paragraphs: [
      "A student can ignore an AI tutor, close the page, ask it for the answer, or simply stop working. That makes supervision a first-class design problem. Pretending that an AI persona is a strict teacher does not create real authority.",
      "A more realistic model is that families or schools provide the legitimate rules, while software executes them transparently: scheduled study periods, required tasks, mastery checks, progress records, escalation when work is not completed, and clear visibility for the responsible adult.",
    ],
    callout: {
      label: "System model",
      title: "Human authority; machine execution.",
      body: "The institution or family defines the obligation to learn. The AI carries out the instructional process, measures progress, and surfaces exceptions. Human attention is then concentrated where judgment, care, safety, or physical presence is required.",
    },
  },
  {
    heading: "If instruction becomes autonomous, staffing economics change",
    paragraphs: [
      "Schools currently need many subject teachers because teaching capacity scales with teacher time. If an AI system can independently handle diagnosis, explanation, practice, feedback, assessment, review, and adaptation for each learner, the number of adults needed for instruction no longer has to scale in the same way.",
      "That does not mean schools become adult-free. Supervision, child protection, conflict resolution, physical activities, laboratory work, special needs, social development, and accountability can still require people. But the staffing model could shift from “many adults teaching groups” toward “many AI tutors teaching individuals, with fewer adults supervising and handling exceptions.”",
    ],
  },
  {
    heading: "Job reduction would be an outcome, not the measurement target",
    paragraphs: [
      "It is plausible that sufficiently capable AI would reduce demand for some forms of routine instructional labor. It is not responsible to turn a number such as 50% or 90% into a present-day forecast. The useful question is more precise: which teaching tasks can be delegated, for which learners, in which subjects, for how long, and with what level of human oversight?",
      "Those answers can change the labor structure naturally. If one adult can safely supervise a learning environment in which each student receives high-quality individualized instruction from AI, fewer human hours may be required to deliver the same or better instructional output.",
    ],
  },
  {
    heading: "Instructional autonomy is the quantity worth measuring",
    paragraphs: [
      "A future evaluation system should move beyond a single tutor score and ask how much of a teaching process an AI can own without a human teacher repairing its work. A possible progression is:",
      "The final level is the one that matters for structural change. If it becomes reliable, teaching and supervision no longer need to be performed by the same person.",
    ],
    progression: [
      { label: "Assistance", text: "answer questions and provide explanations." },
      { label: "Guided tutoring", text: "diagnose and adapt within a human-designed lesson." },
      { label: "Independent lesson delivery", text: "teach a bounded objective end to end." },
      { label: "Longitudinal adaptation", text: "maintain a learner model and plan across sessions." },
      { label: "Instructional autonomy", text: "sustain learning outcomes over time with human supervision but without routine human teaching." },
    ],
  },
  {
    heading: "A research program, not a prediction",
    paragraphs: [
      "The ambition is to make high-quality individualized teaching computationally scalable. Whether that ultimately automates a small share or a very large share of instructional work should be an empirical result, not a slogan.",
      "Teachometry's role is to make the boundary visible: what AI can teach reliably today, what still requires human intervention, and how that boundary moves as systems improve.",
    ],
  },
];

const WHY_TEACHING_DOES_NOT_SCALE: BlogArticle = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Why Teaching Does Not Scale",
  description: "Why individualized teaching attention is scarce, what private tutoring reveals, and why AI teaching must be measured before it can be trusted.",
  excerpt: "The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.",
  route: "/blog/why-teaching-does-not-scale/",
  image: "home-blog-01.webp",
  imageAlt: "A sunlit desk with a notebook, pen, and coffee beside a window",
  sections: WHY_TEACHING_SECTIONS,
  pullQuote: "The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.",
  evidenceBoundary: "This essay is a project thesis, not a benchmark result. The current benchmark evaluates observable tutoring behavior. Long-term learning gain, retention, transfer, autonomous K12 teaching, and workforce effects require separate empirical validation.",
};

const TEACHING_AND_SUPERVISION: BlogArticle = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Teaching and Supervision Are Different Jobs",
  description: "Why AI may unbundle instruction from supervision, and how instructional autonomy could reshape education without pretending human responsibility disappears.",
  excerpt: "A teacher's job bundles instruction with authority, supervision, safety, social coordination, and responsibility. AI may be able to unbundle those functions.",
  route: "/blog/teaching-and-supervision-are-different-jobs/",
  image: "home-blog-02.webp",
  imageAlt: "A sunlit garden path leading through trees toward a school-like building",
  sections: TEACHING_AND_SUPERVISION_SECTIONS,
  pullQuote: "Human authority; machine execution.",
  evidenceBoundary: "This essay describes a possible system architecture and labor consequence. It does not establish that current AI systems can autonomously teach K12 students, provide adequate supervision, or replace any specific share of education jobs.",
};

/** Explicit editorial metadata is the source for the index and Home cards. */
export const BLOG_POSTS = [
  WHY_TEACHING_DOES_NOT_SCALE,
  TEACHING_AND_SUPERVISION,
] as const;

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

function renderBotanical(): string {
  return renderEditorialBotanical("blog-botanical");
}

function renderPostCard(post: BlogPostSummary): string {
  return `<article class="blog-post-card"><a href="${e(post.route)}"><img src="/assets/${e(post.image)}" width="1672" height="941" loading="lazy" alt=""><div class="blog-post-card-copy"><p class="blog-post-meta">${e(post.category)} <span>·</span> ${e(post.publishedDate)}</p><h3>${e(post.title)}</h3><p>${e(post.excerpt)}</p><span class="text-link">Read the essay ${icon("arrow")}</span></div></a></article>`;
}

/** Stable, human-readable anchors keep the generated TOC usable under any base path. */
export function articleHeadingId(heading: string): string {
  const id = heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id.length > 0 ? id : "section";
}

function renderArticleToc(article: BlogArticle, mobile = false): string {
  const navigation = `<nav class="article-toc${mobile ? " article-toc-mobile-nav" : " article-toc-desktop"}" aria-label="On this page">
    <p class="eyebrow">On this page</p>
    <ol>${article.sections.map((section) => `<li><a href="#${e(articleHeadingId(section.heading))}">${e(section.heading)}</a></li>`).join("")}</ol>
  </nav>`;
  return mobile
    ? `<details class="article-toc-disclosure"><summary>On this page</summary>${navigation}</details>`
    : navigation;
}

function renderArticleCallout(callout: BlogCallout, evidence = false): string {
  return `<aside class="article-callout${evidence ? " article-evidence-boundary" : ""}" aria-label="${e(callout.label)}">
    <p class="eyebrow">${e(callout.label)}</p>
    ${callout.title === undefined ? "" : `<h3>${e(callout.title)}</h3>`}
    <p>${e(callout.body)}</p>
  </aside>`;
}

function renderArticleSection(section: BlogArticleSection): string {
  const progression = section.progression === undefined
    ? ""
    : `<ul class="article-progression">${section.progression.map((item) => `<li><strong>${e(item.label)}:</strong><span>${e(item.text)}</span></li>`).join("")}</ul>`;
  return `<section class="article-section" aria-labelledby="${e(articleHeadingId(section.heading))}">
    <h2 id="${e(articleHeadingId(section.heading))}">${e(section.heading)}</h2>
    ${section.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}
    ${progression}
    ${section.callout === undefined ? "" : renderArticleCallout(section.callout)}
  </section>`;
}

function findArticleNeighbor(article: BlogArticle, offset: -1 | 1): BlogArticle | undefined {
  const index = BLOG_POSTS.findIndex((post) => post.route === article.route);
  return index === -1 ? undefined : BLOG_POSTS[index + offset];
}

function renderArticleNeighbor(post: BlogArticle | undefined, direction: "previous" | "next"): string {
  if (post === undefined) {
    return "";
  }
  const label = direction === "previous" ? "Previous article" : "Next article";
  const arrow = direction === "previous" ? icon("left") : icon("right");
  return `<a class="article-nav-link article-nav-${direction}" href="${e(post.route)}" aria-label="${e(`${label}: ${post.title}`)}">
    <img src="/assets/${e(post.image)}" width="120" height="78" loading="lazy" alt="">
    <span class="article-nav-copy"><span class="article-nav-label">${label} ${arrow}</span><strong>${e(post.title)}</strong></span>
  </a>`;
}

function renderArticleNavigation(article: BlogArticle): string {
  return `<nav class="article-nav" aria-label="Article navigation">
    ${renderArticleNeighbor(findArticleNeighbor(article, -1), "previous")}
    <a class="article-nav-index" href="/blog/"><span>${icon("grid")}</span><span>Back to all posts</span></a>
    ${renderArticleNeighbor(findArticleNeighbor(article, 1), "next")}
  </nav>`;
}

function renderArticleTransition(): string {
  return `<section class="article-ideas" aria-labelledby="article-ideas-title"><div class="shell article-ideas-grid">
    <div><p class="eyebrow">Ideas to evidence</p><h2 id="article-ideas-title">Better questions lead<br><em>to better measurement.</em></h2></div>
    <div class="article-ideas-copy"><p>The <a href="/blog/">Blog</a> explores ideas and perspectives. The <a href="/methodology/">Methodology</a> explains evaluation procedures, the <a href="/data/">Benchmark</a> exposes structured cases and data, and <a href="/leaderboard/">Results</a> contain evidence when it is actually publishable.</p><div class="article-ideas-actions"><a class="button button-primary" href="/data/">Explore the benchmark ${icon("arrow")}</a><a class="button button-secondary" href="/blog/">Read more essays ${icon("arrow")}</a></div></div>
  </div></section>`;
}

function renderBlogArticlePage(article: BlogArticle, footer = ""): SitePage {
  return page(
    `${article.title} — Teachometry Blog`,
    article.description,
    article.route,
    `<article class="blog-article" aria-labelledby="article-title">
      <header class="article-hero"><div class="shell article-hero-grid"><div class="article-hero-copy">
        <a class="article-back-link" href="/blog/">${icon("left")}<span>Blog</span><span aria-hidden="true">/</span><span>Back to all posts</span></a>
        <p class="article-post-meta">${e(article.category)} <span aria-hidden="true">·</span> ${e(article.publishedDate)}</p>
        <h1 id="article-title">${e(article.title)}</h1>
        <p class="lede">${e(article.excerpt)}</p>
      </div><div class="article-hero-art" aria-hidden="true">${renderBotanical()}<p class="article-handwritten">Questions before<br>conclusions.</p><span class="article-art-rule"></span></div></div></header>
      <div class="shell article-media-shell"><figure class="article-media"><img src="/assets/${e(article.image)}" width="1672" height="941" fetchpriority="high" alt="${e(article.imageAlt)}"></figure></div>
      <div class="shell article-mobile-toc">${renderArticleToc(article, true)}</div>
      <div class="shell article-layout"><aside class="article-rail">${renderArticleToc(article)}<div class="article-pull-quote"><p>“${e(article.pullQuote)}”</p></div></aside><div class="article-content">${article.sections.map(renderArticleSection).join("")}${renderArticleCallout({ label: "Evidence boundary", body: article.evidenceBoundary }, true)}</div></div>
      <div class="shell article-nav-shell">${renderArticleNavigation(article)}</div>
    </article>
    ${renderArticleTransition()}
    ${footer}`,
  );
}

export function renderBlogIndexPage(footer = ""): SitePage {
  const [featuredPost, ...latestPosts] = BLOG_POSTS;
  return page(
    "Blog — Teachometry",
    "Long-form notes on AI teaching, measurement, instructional autonomy, and the future structure of education.",
    "/blog/",
    `<div class="blog-index">
      <section class="blog-hero" aria-labelledby="blog-title"><div class="shell blog-hero-grid"><div class="blog-hero-copy"><p class="eyebrow">Teachometry Blog <span aria-hidden="true">→</span></p><h1 id="blog-title">Ideas that should become<br><em>testable questions.</em></h1><p class="blog-hero-lede">The benchmark should stay evidence-first. The blog is where we make the underlying hypotheses explicit: what teaching is, what AI might change, and what would have to be measured before stronger claims are justified.</p><div class="blog-hero-actions"><a class="button button-primary" href="#latest-essays">Browse the essays ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">See the methodology ${icon("arrow")}</a></div></div><div class="blog-hero-art">${renderBotanical()}<p class="blog-handwritten blog-hero-note">Better evidence.<br>Brighter learning.</p><div class="blog-hero-rail"><span>Ideas<br>Evidence<br>Human learning<br>Future questions.</span><i></i></div></div></div></section>
      <section class="blog-feature-section" aria-labelledby="featured-essay-title"><div class="shell blog-feature-grid"><article class="blog-featured"><a class="blog-featured-link" href="${e(featuredPost.route)}"><figure class="blog-featured-media"><img src="/assets/${e(featuredPost.image)}" width="1672" height="941" fetchpriority="high" alt=""></figure><div class="blog-featured-copy"><p class="blog-post-meta">${e(featuredPost.category)} <span>·</span> ${e(featuredPost.publishedDate)}</p><h2 id="featured-essay-title">${e(featuredPost.title)}</h2><p>${e(featuredPost.excerpt)}</p><span class="text-link">Read the essay ${icon("arrow")}</span></div></a></article><aside class="blog-journal-note"><p class="eyebrow">Journal premise</p><h2>Questions before conclusions.</h2><p>The Teachometry Blog is a place for the ideas behind the benchmark: perspectives on teaching, AI, education, and measurement that should eventually become testable.</p><div class="blog-note-rule" aria-hidden="true"></div><nav aria-label="Editorial links" class="blog-note-links"><a href="/methodology/">How we measure ${icon("arrow")}</a><a href="/data/">Explore the benchmark ${icon("arrow")}</a></nav></aside></div></section>
      <section class="blog-latest-section" id="latest-essays" aria-labelledby="latest-essays-title"><div class="shell blog-latest-grid"><div class="blog-latest-main"><div class="blog-section-heading"><div><p class="eyebrow">The journal</p><h2 id="latest-essays-title">Latest essays</h2></div><span class="blog-post-count">Current perspectives</span></div><div class="blog-post-list${latestPosts.length === 1 ? " blog-post-list-single" : ""}">${latestPosts.map(renderPostCard).join("")}</div></div><aside class="blog-editorial-panel"><figure class="blog-editorial-image"><img src="/assets/home-blog-03.webp" width="1672" height="941" loading="lazy" alt=""></figure><div class="blog-editorial-copy"><p class="eyebrow">Editorial boundary</p><h2>Hypotheses are not benchmark results.</h2><p>These essays describe a long-run research direction. They do not establish that current AI systems have demonstrated:</p><ul><li>long-term learning gains</li><li>retention or transfer</li><li>autonomous K12 teaching</li><li>workforce replacement</li><li>real classroom effectiveness</li></ul><p class="blog-editorial-footnote">Those remain empirical questions. The benchmark keeps observable tutoring evidence separate from these broader claims.</p></div></aside></div></section>
      <section class="blog-evidence-section" aria-labelledby="blog-evidence-title"><div class="shell blog-evidence-grid"><div><p class="eyebrow">A working distinction</p><h2 id="blog-evidence-title">Make the idea clear.<br><em>Then make it measurable.</em></h2></div><p>The Blog holds the hypotheses; Benchmark and Methodology hold the procedures and observable evidence. Keeping those surfaces distinct is part of the work.</p><div class="blog-evidence-actions"><a class="button button-secondary" href="/data/">View the benchmark ${icon("arrow")}</a><a class="text-link" href="/about/">About Teachometry ${icon("arrow")}</a></div></div></section>
      ${footer}
    </div>`,
  );
}

export function renderWhyTeachingDoesNotScalePage(footer = ""): SitePage {
  return renderBlogArticlePage(WHY_TEACHING_DOES_NOT_SCALE, footer);
}

export function renderTeachingAndSupervisionPage(footer = ""): SitePage {
  return renderBlogArticlePage(TEACHING_AND_SUPERVISION, footer);
}
