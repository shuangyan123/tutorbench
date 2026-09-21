import { escapeHtml as e, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";

const BLOG_PUBLISHED_DATE = "September 17, 2026";

export interface BlogPostSummary {
  readonly category: "Perspective";
  readonly publishedDate: string;
  readonly title: string;
  readonly description: string;
  readonly excerpt: string;
  readonly route: string;
  readonly image: string;
}

const WHY_TEACHING_DOES_NOT_SCALE: BlogPostSummary = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Why Teaching Does Not Scale",
  description: "Why individualized teaching attention is scarce, what private tutoring reveals, and why AI teaching must be measured before it can be trusted.",
  excerpt: "The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.",
  route: "/blog/why-teaching-does-not-scale/",
  image: "home-blog-01.webp",
};

const TEACHING_AND_SUPERVISION: BlogPostSummary = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Teaching and Supervision Are Different Jobs",
  description: "Why AI may unbundle instruction from supervision, and how instructional autonomy could reshape education without pretending human responsibility disappears.",
  excerpt: "A teacher's job bundles instruction with authority, supervision, safety, social coordination, and responsibility. AI may be able to unbundle those functions.",
  route: "/blog/teaching-and-supervision-are-different-jobs/",
  image: "home-blog-02.webp",
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
  return `<svg class="blog-botanical" viewBox="0 0 240 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.6" />
      <path d="M133 190C103 155 76 123 54 83" stroke-width="1.15" />
      <path d="M126 236C93 219 56 198 22 166" stroke-width="1.15" />
      <path d="M143 140C170 119 194 91 215 58" stroke-width="1.15" />
      <path d="M119 277C88 265 53 250 16 224" stroke-width="1.15" />
      <path d="M153 103C179 91 204 71 228 44" stroke-width="1.15" />
      <path d="M115 295C91 302 61 305 32 300" stroke-width="1.05" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width="1.05" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width="1.05" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width="1.05" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width="1.05" />
      <path d="M228 44C228 27 235 12 248 4C252 21 246 38 236 47C233 47 230 46 228 44Z" stroke-width="1.05" />
      <path d="M32 300C20 289 13 275 17 261C34 267 46 280 46 294C42 298 37 300 32 300Z" stroke-width="1.05" />
      <path d="M192 18C194 39 191 57 180 73C171 64 168 48 174 35C179 27 185 21 192 18Z" stroke-width="1.05" />
    </g>
  </svg>`;
}

function renderPostCard(post: BlogPostSummary): string {
  return `<article class="blog-post-card"><a href="${e(post.route)}"><img src="/assets/${e(post.image)}" width="1672" height="941" loading="lazy" alt=""><div class="blog-post-card-copy"><p class="blog-post-meta">${e(post.category)} <span>·</span> ${e(post.publishedDate)}</p><h3>${e(post.title)}</h3><p>${e(post.excerpt)}</p><span class="text-link">Read the essay ${icon("arrow")}</span></div></a></article>`;
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

export function renderWhyTeachingDoesNotScalePage(): SitePage {
  return page(
    `${WHY_TEACHING_DOES_NOT_SCALE.title} — Teachometry Blog`,
    WHY_TEACHING_DOES_NOT_SCALE.description,
    WHY_TEACHING_DOES_NOT_SCALE.route,
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/blog/">← Blog</a><p class="eyebrow">${e(WHY_TEACHING_DOES_NOT_SCALE.category)} · ${e(WHY_TEACHING_DOES_NOT_SCALE.publishedDate)}</p><h1>${e(WHY_TEACHING_DOES_NOT_SCALE.title)}</h1><p class="lede">${e(WHY_TEACHING_DOES_NOT_SCALE.excerpt)}</p></div></section>
    <section class="section"><div class="shell narrow-shell">
      <h2>The scarce resource is attention</h2>
      <p>One teacher can explain an idea to a room, but cannot continuously observe every learner, diagnose every misconception, choose a different explanation for each student, verify genuine understanding, and adjust the next task for everyone at once. That is a capacity constraint even when the teacher is excellent and conscientious.</p>
      <p>K12 systems therefore work at the level of groups. They need classrooms to remain orderly, curricula to move forward, exams to be administered, and students to cross common thresholds. Individual optimization is desirable, but it competes with the practical requirement to teach many people at the same time.</p>

      <h2>Scores create a powerful external structure</h2>
      <p>Much K12 learning is not purely voluntary. Families and schools use grades, exams, schedules, expectations, and supervision to make learning happen even when a student is not intrinsically interested in the subject. Students who perform well often receive more recognition and confidence; students who repeatedly fall behind can experience the opposite.</p>
      <p>This means an education system is doing at least two jobs at once: teaching, and creating an environment in which learning is difficult to avoid. Any serious AI education system has to understand both jobs.</p>

      <h2>Private tutoring reveals what families are really buying</h2>
      <p>A private tutor is valuable not only because the tutor may explain a subject well. The product also includes dedicated attention, direct accountability to the family, supervision of the student, visible progress, and a trust signal built from credentials, experience, reputation, or past results.</p>
      <p>The expensive part is that all of this is tied to a person's time. High-quality one-to-one attention is difficult to distribute broadly because each additional learner requires another block of human labor.</p>

      <h2>AI changes the cost structure only if it can actually teach</h2>
      <p>If an AI system can reliably diagnose a learner, select an appropriate explanation, generate practice, detect false mastery, revisit weak knowledge, adapt over time, and verify learning rather than merely produce answers, then individualized teaching attention becomes much more reproducible.</p>
      <div class="panel"><p class="eyebrow">Working hypothesis</p><h3>Teaching could become computationally scalable.</h3><p>Instead of many students sharing one teacher's limited instructional attention, each student could have a persistent teaching system while human attention is reserved for the tasks that still require human presence and responsibility.</p></div>

      <h2>The standard cannot be “the student got the answer”</h2>
      <p>An AI can make a learner look more capable by doing cognitive work on the learner's behalf. That is not the same as learning. The stronger test is whether the student can retain, transfer, and apply the knowledge after the AI is removed.</p>
      <p>For that reason, AI education should not be trusted because a model sounds intelligent or because it solves benchmark questions. It should be trusted only to the extent that we can show that its teaching changes the learner in durable and useful ways.</p>

      <h2>Why Teachometry exists</h2>
      <p>The long-run question is not simply whether an AI can answer correctly. It is whether an AI can take responsibility for progressively larger parts of teaching. That requires measurement at several levels: observable tutoring behavior, actual learning effectiveness, and eventually instructional autonomy over longer periods.</p>
      <p>Teachometry exists to turn those claims into testable questions. The goal is not to assume that AI has already replaced the teacher. The goal is to build the evidence needed to know what it can reliably do, for whom, under what conditions, and where human teaching remains necessary.</p>

      <div class="panel"><p class="eyebrow">Evidence boundary</p><p>This essay is a project thesis, not a benchmark result. The current benchmark evaluates observable tutoring behavior. Long-term learning gain, retention, transfer, autonomous K12 teaching, and workforce effects require separate empirical validation.</p></div>
    </div></section>`,
  );
}

export function renderTeachingAndSupervisionPage(): SitePage {
  return page(
    `${TEACHING_AND_SUPERVISION.title} — Teachometry Blog`,
    TEACHING_AND_SUPERVISION.description,
    TEACHING_AND_SUPERVISION.route,
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/blog/">← Blog</a><p class="eyebrow">${e(TEACHING_AND_SUPERVISION.category)} · ${e(TEACHING_AND_SUPERVISION.publishedDate)}</p><h1>${e(TEACHING_AND_SUPERVISION.title)}</h1><p class="lede">${e(TEACHING_AND_SUPERVISION.excerpt)}</p></div></section>
    <section class="section"><div class="shell narrow-shell">
      <h2>Today's teacher is several jobs in one</h2>
      <p>A classroom teacher explains content, diagnoses mistakes, prepares exercises, grades work, answers questions, motivates students, manages behavior, communicates with families, and remains responsible for a room full of minors. These functions are packaged together because historically the same adult had to be present to perform the teaching.</p>
      <p>That packaging should not be mistaken for a law of nature. If instruction can be delivered reliably by another system, the human functions that remain can be designed separately.</p>

      <h2>AI has no inherent authority</h2>
      <p>A student can ignore an AI tutor, close the page, ask it for the answer, or simply stop working. That makes supervision a first-class design problem. Pretending that an AI persona is a strict teacher does not create real authority.</p>
      <p>A more realistic model is that families or schools provide the legitimate rules, while software executes them transparently: scheduled study periods, required tasks, mastery checks, progress records, escalation when work is not completed, and clear visibility for the responsible adult.</p>
      <div class="panel"><p class="eyebrow">System model</p><h3>Human authority; machine execution.</h3><p>The institution or family defines the obligation to learn. The AI carries out the instructional process, measures progress, and surfaces exceptions. Human attention is then concentrated where judgment, care, safety, or physical presence is required.</p></div>

      <h2>If instruction becomes autonomous, staffing economics change</h2>
      <p>Schools currently need many subject teachers because teaching capacity scales with teacher time. If an AI system can independently handle diagnosis, explanation, practice, feedback, assessment, review, and adaptation for each learner, the number of adults needed for instruction no longer has to scale in the same way.</p>
      <p>That does not mean schools become adult-free. Supervision, child protection, conflict resolution, physical activities, laboratory work, special needs, social development, and accountability can still require people. But the staffing model could shift from “many adults teaching groups” toward “many AI tutors teaching individuals, with fewer adults supervising and handling exceptions.”</p>

      <h2>Job reduction would be an outcome, not the measurement target</h2>
      <p>It is plausible that sufficiently capable AI would reduce demand for some forms of routine instructional labor. It is not responsible to turn a number such as 50% or 90% into a present-day forecast. The useful question is more precise: which teaching tasks can be delegated, for which learners, in which subjects, for how long, and with what level of human oversight?</p>
      <p>Those answers can change the labor structure naturally. If one adult can safely supervise a learning environment in which each student receives high-quality individualized instruction from AI, fewer human hours may be required to deliver the same or better instructional output.</p>

      <h2>Instructional autonomy is the quantity worth measuring</h2>
      <p>A future evaluation system should move beyond a single tutor score and ask how much of a teaching process an AI can own without a human teacher repairing its work. A possible progression is:</p>
      <ul class="plain-list">
        <li><strong>Assistance:</strong> answer questions and provide explanations.</li>
        <li><strong>Guided tutoring:</strong> diagnose and adapt within a human-designed lesson.</li>
        <li><strong>Independent lesson delivery:</strong> teach a bounded objective end to end.</li>
        <li><strong>Longitudinal adaptation:</strong> maintain a learner model and plan across sessions.</li>
        <li><strong>Instructional autonomy:</strong> sustain learning outcomes over time with human supervision but without routine human teaching.</li>
      </ul>
      <p>The final level is the one that matters for structural change. If it becomes reliable, teaching and supervision no longer need to be performed by the same person.</p>

      <h2>A research program, not a prediction</h2>
      <p>The ambition is to make high-quality individualized teaching computationally scalable. Whether that ultimately automates a small share or a very large share of instructional work should be an empirical result, not a slogan.</p>
      <p>Teachometry's role is to make the boundary visible: what AI can teach reliably today, what still requires human intervention, and how that boundary moves as systems improve.</p>

      <div class="panel"><p class="eyebrow">Evidence boundary</p><p>This essay describes a possible system architecture and labor consequence. It does not establish that current AI systems can autonomously teach K12 students, provide adequate supervision, or replace any specific share of education jobs.</p></div>
    </div></section>`,
  );
}
