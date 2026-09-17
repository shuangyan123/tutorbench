import type { SitePage } from "../html.js";

const BLOG_PUBLISHED_DATE = "September 17, 2026";

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

export function renderBlogIndexPage(): SitePage {
  return page(
    "Blog — Teachometry",
    "Long-form notes on AI teaching, measurement, instructional autonomy, and the future structure of education.",
    "/blog/",
    `<section class="page-intro"><div class="shell narrow-shell"><p class="eyebrow">Teachometry Blog</p><h1>Ideas that should become testable questions.</h1><p class="lede">The benchmark should stay evidence-first. The blog is where we make the underlying hypotheses explicit: what teaching is, what AI might change, and what would have to be measured before stronger claims are justified.</p></div></section>
    <section class="section"><div class="shell doc-grid">
      <a class="route-card" href="/blog/why-teaching-does-not-scale/"><span class="eyebrow">Perspective · ${BLOG_PUBLISHED_DATE}</span><h2>Why Teaching Does Not Scale</h2><p>The central scarcity in education is not information. It is sustained, individualized teaching attention.</p><span class="text-link">Read essay →</span></a>
      <a class="route-card" href="/blog/teaching-and-supervision-are-different-jobs/"><span class="eyebrow">Perspective · ${BLOG_PUBLISHED_DATE}</span><h2>Teaching and Supervision Are Different Jobs</h2><p>If AI can carry more of the instructional load, the remaining human role may increasingly center on supervision, responsibility, safety, and social life.</p><span class="text-link">Read essay →</span></a>
    </div></section>
    <section class="section section-muted"><div class="shell narrow-shell"><p class="eyebrow">Editorial boundary</p><h2>Hypotheses are not benchmark results.</h2><p class="section-copy">These essays describe a long-run research direction. They do not claim that current AI systems have already demonstrated long-term learning gains, autonomous K12 teaching, or any particular level of workforce replacement. Those are empirical questions, and the purpose of Teachometry is to make them measurable.</p></div></section>`,
  );
}

export function renderWhyTeachingDoesNotScalePage(): SitePage {
  return page(
    "Why Teaching Does Not Scale — Teachometry Blog",
    "Why individualized teaching attention is scarce, what private tutoring reveals, and why AI teaching must be measured before it can be trusted.",
    "/blog/why-teaching-does-not-scale/",
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/blog/">← Blog</a><p class="eyebrow">Perspective · ${BLOG_PUBLISHED_DATE}</p><h1>Why Teaching Does Not Scale</h1><p class="lede">The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.</p></div></section>
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
    "Teaching and Supervision Are Different Jobs — Teachometry Blog",
    "Why AI may unbundle instruction from supervision, and how instructional autonomy could reshape education without pretending human responsibility disappears.",
    "/blog/teaching-and-supervision-are-different-jobs/",
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/blog/">← Blog</a><p class="eyebrow">Perspective · ${BLOG_PUBLISHED_DATE}</p><h1>Teaching and Supervision Are Different Jobs</h1><p class="lede">A teacher's job bundles instruction with authority, supervision, safety, social coordination, and responsibility. AI may be able to unbundle those functions.</p></div></section>
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
