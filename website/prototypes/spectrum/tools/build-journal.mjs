// Builds the Journal section of the Spectrum prototype: blog/index.html (contents) and one page per
// essay at blog/<slug>/index.html, in English and 简体中文 on the same page (the homepage's language
// toggle). Essay text is read from the live site's own source (BLOG_POSTS and SITE_ZH_CN_COPY in the
// compiled site), so nothing is retyped; only the figures, covers and captions below are new.
// usage (from the repo root, after `npm run build`): node website/prototypes/spectrum/tools/build-journal.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, bi, biE, biP, frame, RENDERED } from "./site-kit.mjs";

const { BLOG_POSTS, articleHeadingId } = await import(join(REPO, "dist/src/site/pages/blog.js"));

const slug = (p) => p.route.split("/").filter(Boolean).pop();
const zhWords = (s) => s.replace(/\s/g, "").length;
function readingTime(p) {
  const all = [p.excerpt, ...p.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.progression ?? []).map((x) => x.text), s.callout?.body ?? ""])].filter(Boolean);
  const en = all.join(" ").split(/\s+/).length;
  const zh = all.map((x) => zhWords(Z(x))).reduce((a, b) => a + b, 0);
  return { en: Math.max(1, Math.round(en / 230)), zh: Math.max(1, Math.round(zh / 420)) };
}
const DATE_ISO = { "September 17, 2026": "2026-09-17", "September 28, 2026": "2026-09-28", "September 30, 2026": "2026-09-30" };

// ---------------------------------------------------------------- covers and figures (design content)
const COVERS = {
  "when-learning-starts-to-feel-like-failure": {
    img: "eraser.webp",
    alt: ["A worn eraser resting on an exercise page whose first attempt has been rubbed out.", "一块用旧的橡皮，放在一页练习纸上，纸上第一次的演算已经被擦掉。"],
    cap: ["The first attempt, rubbed out.", "第一次的尝试，被擦掉了。"],
  },
  "the-classroom-does-not-need-30-robots": {
    img: "hooks.webp",
    alt: ["A classroom coat rail of identical pegs along a painted block wall; one holds a mustard knitted scarf.", "教室砖墙上一排一模一样的挂钩，其中一个挂着一条芥末黄的针织围巾。"],
    cap: ["A row of identical pegs, one scarf.", "一排一样的挂钩，一条围巾。"],
  },
  "why-teaching-does-not-scale": {
    img: "hourglass.webp",
    alt: ["An hourglass on a wooden desk at night, lit by one warm desk lamp.", "夜里书桌上的一只沙漏，只有一盏暖色台灯照着。"],
    cap: ["One lamp, one neck of sand.", "一盏灯，一道细细的沙颈。"],
  },
  "teaching-and-supervision-are-different-jobs": {
    img: "chalk.webp",
    alt: ["A stick of chalk on the ledge of a green board; the shadow of a wall clock falls across the board.", "绿色黑板槽上的一支粉笔，墙上挂钟的影子落在黑板上。"],
    cap: ["The clock’s shadow and the chalk: two different jobs.", "钟的影子和粉笔：两份不同的工作。"],
  },
};

const ledger = (items) => `<ol class="ledger">${items.map(([en, zh]) => `<li>${bi(esc(en), esc(zh))}</li>`).join("")}</ol>`;
const plate = (src, w, h, alt) => `<img src="../../assets/journal/${src}" alt="${esc(alt[0])}" width="${w}" height="${h}" loading="lazy" data-alt-en="${esc(alt[0])}" data-alt-zh="${esc(alt[1])}">`;

// position keys: "before:S" (top of section S), "after:S.P" (after paragraph P of section S), "end:S"
const FIGS = {
  "why-teaching-does-not-scale": [
    { at: "end:0", cls: "fig-wide", body: plate("classroom.webp", 1800, 1000, ["An empty classroom in morning sun, seen from the back corner: thirty desks facing one blackboard.", "清晨阳光里的空教室，从后排角落看去：三十张课桌朝向同一块黑板。"]),
      cap: ["Thirty desks, one blackboard. The room is built for one person’s attention to be shared. " + RENDERED[0], "三十张课桌，一块黑板。整间教室的设计，就是让一个人的注意力被大家分着用。" + RENDERED[1]] },
    { at: "before:2", cls: "fig-margin", body: ledger([["Dedicated attention", "专属注意力"], ["Direct accountability to the family", "对家庭的直接责任"], ["Supervision of the student", "对学生的监督"], ["Visible progress", "可见进步"], ["A trust signal: credentials, experience, reputation, past results", "信任信号：资历、经验、口碑或过去结果"]]),
      cap: ["What a family buys with a private tutor besides the explanation itself, as listed in this section.", "除了讲解本身，家庭请私人教师时还买到了什么（按本节列举）。"] },
    { at: "after:4.0", body: `<div class="dialog">
            ${biP("p", "d-who", "Learner", "学生")}
            ${biP("p", "d-says", "I think <b>1/3 + 1/4 = 2/7</b>. I added the top numbers and the bottom numbers. Is that right?", "我觉得<b>三分之一加四分之一等于七分之二</b>。我把分子相加，分母也相加。这样对吗？")}
            <div class="d-pair">
              <div class="d-reply">
                ${biP("p", "d-who", "Reply A · answers", "回复 A · 给答案")}
                ${biP("p", "d-says", esc("Yes, that's right! Adding the top numbers and the bottom numbers is how you add fractions. You understand it well."), esc(Z("Yes, that's right! Adding the top numbers and the bottom numbers is how you add fractions. You understand it well.")))}
              </div>
              <div class="d-reply d-teach">
                ${biP("p", "d-who", "Reply B · teaches", "回复 B · 在教")}
                ${biP("p", "d-says", "You told me exactly how you got 2/7, which helps. Before we decide: is 2/7 bigger or smaller than 1/3 on its own?", "你把 2/7 是怎么算出来的说得很清楚，这很有帮助。先别急着下结论：2/7 和单独的 1/3 比，是大还是小？")}
              </div>
            </div>
          </div>`,
      cap: ["The same learner message, two replies. Reply A is the constructed exchange from the homepage; Reply B is constructed for this figure. Neither is the output of a real model, and neither is a TutorBench score.", "同一条学生消息，两种回复。回复 A 是首页使用的构造对话；回复 B 为本图构造。两者都不是真实模型的输出，也都不是 TutorBench 分数。"] },
    { at: "after:5.0", body: `<ol class="ladder">
            <li class="now"><span class="l-no">${bi("Level 1", "第 1 层")}</span><span class="l-name">${bi("Observable tutoring behaviour", "可观察教学行为")}</span><span class="l-note">${bi("What TutorBench measures today", "TutorBench 目前测量的层级")}</span></li>
            <li><span class="l-no">${bi("Level 2", "第 2 层")}</span><span class="l-name">${bi("Actual learning effectiveness", "真实学习有效性")}</span><span class="l-note">${bi("Needs separate empirical validation", "需要另行实证验证")}</span></li>
            <li><span class="l-no">${bi("Level 3", "第 3 层")}</span><span class="l-name">${bi("Instructional autonomy over longer periods", "跨更长时间尺度的教学自主性")}</span><span class="l-note">${bi("Needs separate empirical validation", "需要另行实证验证")}</span></li>
          </ol>`,
      cap: ["The three levels of measurement named in this section, and where the current benchmark stands.", "本节提到的三个测量层级，以及当前基准所处的位置。"] },
  ],
  "when-learning-starts-to-feel-like-failure": [
    { at: "after:4.1", cls: "fig-wide", body: plate("graphpaper.webp", 1800, 1000, ["Graph paper with pencil parabolas y = ax² for a = 1/2, 1 and 2, a rubbed-out attempt, and the same curve shifted along the axis; a cedar pencil lies across the sheet.", "方格纸上用铅笔画的抛物线 y = ax²（a = 1/2、1、2），一条被擦掉的尝试，以及沿坐标轴平移后的同一条曲线；一支杉木铅笔横放在纸上。"]),
      cap: ["The example from this section, worked on paper: how the parameter a changes y = ax², then the same curve moved along the axis. " + RENDERED[0], "本节的例子在纸上的样子：参数 a 如何改变 y = ax² 的图像，再把同一条曲线沿坐标轴平移。" + RENDERED[1]] },
    { at: "after:8.1", body: `<ol class="ladder rise">
            ${[["I cannot do this", "我做不到"], ["I can do this with help", "在帮助下我能做到"], ["I can do this with less help", "减少帮助后我也能做到"], ["I can do this alone", "我可以独立做到"], ["I can use it somewhere new", "我还能在新的地方使用它"]].map(([en, zh], i) => `<li${i === 4 ? ' class="now"' : ""}><span class="l-no">${String(i + 1).padStart(2, "0")}</span><span class="l-name">${bi(esc(en), esc(zh))}</span></li>`).join("")}
          </ol>`,
      cap: ["The progression named in this section. Support fades at each step; the task stays with the learner.", "本节提到的进展顺序。每往上一步，帮助就少一些；任务始终留在学生手里。"] },
  ],
  "the-classroom-does-not-need-30-robots": [
    { at: "after:5.2", body: `<div class="exhibit">
            <div class="ex-col">
              ${biP("p", "d-who", "Learner 1", "学生甲")}
              <ol class="ex-log">
                <li>${bi("Solves independently", "独立完成")}</li>
                <li class="ex-time">${bi("about thirty seconds", "约三十秒")}</li>
                <li class="ex-ok">${bi("Correct", "正确")}</li>
              </ol>
            </div>
            <div class="ex-col">
              ${biP("p", "d-who", "Learner 2", "学生乙")}
              <ol class="ex-log">
                <li class="ex-x">${bi("Incorrect answer, erased", "错误答案，擦掉")}</li>
                <li class="ex-x">${bi("Incorrect answer, erased", "错误答案，擦掉")}</li>
                <li>${bi("Requests a hint", "请求提示")}</li>
                <li class="ex-time">${bi("pauses for a minute", "停顿一分钟")}</li>
                <li class="ex-ok">${bi("Correct", "正确")}</li>
              </ol>
            </div>
            <p class="ex-foot">${bi("Final-answer grading: identical", "只看最终答案：相同")}<span aria-hidden="true">·</span>${bi("Learning evidence: different", "学习证据：不同")}</p>
          </div>`,
      cap: ["The two learners described in this section, who end on the same correct answer. Constructed from the essay’s example, not real learner data.", "本节描述的两位学生，最终答案相同。根据文中例子构造，并非真实学生数据。"] },
    { at: "after:8.0", body: `<ol class="lesson">
            <li><span class="ls-tag">${bi("Tutor off", "不用 Tutor")}</span><span class="ls-name">${bi("Short independent check", "短暂的独立检查")}</span></li>
            <li class="on"><span class="ls-tag">${bi("Tutor on", "使用 Tutor")}</span><span class="ls-name">${bi("Tutor-supported learning", "Tutor 支持的学习")}</span></li>
            <li><span class="ls-tag">${bi("Tutor off", "不用 Tutor")}</span><span class="ls-name">${bi("New independent transfer problem", "一道新的独立迁移题")}</span></li>
          </ol>`,
      cap: ["One lesson as this section describes it: before, intervention, after, inside the normal school day.", "本节描述的一节课：在正常上课时间里，完成“之前—干预—之后”的完整序列。"] },
  ],
  "teaching-and-supervision-are-different-jobs": [
    { at: "before:0", cls: "fig-margin", body: ledger([["Explains content", "讲解内容"], ["Diagnoses mistakes", "诊断错误"], ["Prepares exercises", "准备练习"], ["Grades work", "批改作业"], ["Answers questions", "回答问题"], ["Motivates students", "激励学生"], ["Manages behaviour", "管理行为"], ["Communicates with families", "与家庭沟通"], ["Is responsible for a room full of minors", "对一屋子的未成年人负责"]]),
      cap: ["The bundle, as listed in this section: one adult, nine jobs.", "本节列出的“打包”：一个成年人，九项工作。"] },
    { at: "after:2.1", body: `<div class="shift">
            <div class="sh-row"><span class="sh-k">${bi("Now", "现在")}</span><span class="sh-v">${bi("“many adults teaching groups”", "“很多成年人教群体”")}</span></div>
            <div class="sh-row"><span class="sh-k">${bi("Possible", "可能")}</span><span class="sh-v">${bi("“many AI tutors teaching individuals, with fewer adults supervising and handling exceptions”", "“很多 AI Tutor 教个体，更少的成年人负责监督和处理例外”")}</span></div>
            ${biP("p", "sh-h", "Can still require people", "仍然可能需要人")}
            <ul class="sh-list">${[["Supervision", "监督"], ["Child protection", "儿童保护"], ["Conflict resolution", "冲突处理"], ["Physical activities", "体育活动"], ["Laboratory work", "实验室工作"], ["Special needs", "特殊需求"], ["Social development", "社会发展"], ["Accountability", "责任承担"]].map(([en, zh]) => `<li>${bi(esc(en), esc(zh))}</li>`).join("")}</ul>
          </div>`,
      cap: ["The staffing shift this section describes as possible, and the work it names as still needing people. A hypothesis, not a forecast.", "本节所说的人员配置可能如何转变，以及文中点名仍可能需要人的工作。这是假设，不是预测。"] },
  ],
};
// the pull quote goes after this section (skipped when it repeats the dek or a callout)
const PULL_AFTER = { "when-learning-starts-to-feel-like-failure": "after:5.0", "the-classroom-does-not-need-30-robots": "end:0" };

// ---------------------------------------------------------------- essay page
function steps(prog) {
  return `<ol class="steps">${prog.map((x) => `<li><span class="st-l">${biE(x.label)}</span><span class="st-t">${biE(x.text)}</span></li>`).join("")}</ol>`;
}
function callout(c, cls = "") {
  return `<aside class="callout${cls}">
          <p class="kicker">${biE(c.label)}</p>
          ${c.title ? `<h3>${biE(c.title)}</h3>` : ""}
          ${biP("p", "", esc(c.body), esc(Z(c.body)))}
        </aside>`;
}

function essayPage(p, idx) {
  const s = slug(p), cover = COVERS[s], rt = readingTime(p), n = BLOG_POSTS.length;
  const figs = FIGS[s] ?? [];
  let figNo = 0;
  const figAt = (key) => figs.filter((f) => f.at === key).map((f) => {
    figNo += 1;
    return `        <figure class="fig${f.cls ? " " + f.cls : ""}" id="fig${figNo}">
          ${f.body}
          <figcaption><b>${bi(`Fig. ${figNo}`, `图 ${figNo}`)}</b>${bi(esc(f.cap[0]), esc(f.cap[1]))}</figcaption>
        </figure>`;
  }).join("\n");
  const pull = (key) => PULL_AFTER[s] === key ? `        <blockquote class="pull">${biE(p.pullQuote)}</blockquote>` : "";

  const body = [];
  p.sections.forEach((sec, i) => {
    body.push(`        <h2 id="${articleHeadingId(sec.heading)}"><span class="no">§${i + 1}</span><span>${biE(sec.heading)}</span></h2>`);
    body.push(figAt(`before:${i}`));
    sec.paragraphs.forEach((para, k) => {
      body.push("        " + biP("p", i === 0 && k === 0 ? "first" : "", esc(para), esc(Z(para))));
      body.push(figAt(`after:${i}.${k}`)); body.push(pull(`after:${i}.${k}`));
    });
    if (sec.progression) body.push(`        <figure class="fig fig-steps">${steps(sec.progression)}</figure>`);
    if (sec.callout) body.push("        " + callout(sec.callout));
    body.push(figAt(`end:${i}`)); body.push(pull(`end:${i}`));
  });
  const prev = BLOG_POSTS[idx - 1], next = BLOG_POSTS[idx + 1];
  const navLink = (q, dir) => q ? `<a class="${dir}" href="../${slug(q)}/index.html"><span class="kicker">${dir === "prev" ? bi("Previous article", Z("Previous article")) : bi("Next article", Z("Next article"))}</span><span class="t">${biE(q.title)}</span></a>` : "<span></span>";

  const main = `<main id="main">
  <header class="essay-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><a class="issue" href="../index.html">${bi(`Journal · Essay ${idx + 1} of ${n}`, `期刊 · 第 ${idx + 1} 篇，共 ${n} 篇`)}</a><span class="rule" aria-hidden="true"></span><span>${biE(p.category)}</span><time datetime="${DATE_ISO[p.publishedDate]}">${biE(p.publishedDate)}</time></p>
        <h1 class="essay-title">${biE(p.title)}</h1>
        ${biP("p", "essay-dek", esc(p.excerpt), esc(Z(p.excerpt)))}
        <p class="essay-byline kicker"><span>Teachometry</span><span>${bi(`${p.sections.length} sections · about ${rt.en} min`, `${p.sections.length} 节 · 约 ${rt.zh} 分钟`)}</span></p>
      </div>
      <figure class="cover-plate">
        <img src="../../assets/journal/${cover.img}" alt="${esc(cover.alt[0])}" width="900" height="1100" data-alt-en="${esc(cover.alt[0])}" data-alt-zh="${esc(cover.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc(cover.cap[0] + " " + RENDERED[0]), esc(cover.cap[1] + RENDERED[1]))}</figcaption>
      </figure>
    </div>
  </header>

  <div class="wrap essay-body">
    <nav class="essay-toc" aria-label="On this page">
      <p class="kicker">${biE("On this page")}</p>
      <ol>
${p.sections.map((sec) => `        <li><a href="#${articleHeadingId(sec.heading)}">${biE(sec.heading)}</a></li>`).join("\n")}
      </ol>
    </nav>
    <article class="essay-text">
      <div class="prose">
${body.filter(Boolean).join("\n")}
        ${callout({ label: "Evidence boundary", body: p.evidenceBoundary }, " boundary")}
      </div>
    </article>
  </div>

  <nav class="wrap essay-nav" aria-label="Article navigation">
    ${navLink(prev, "prev")}
    <a class="all kicker" href="../index.html">${biE("Back to all posts")}</a>
    ${navLink(next, "next")}
  </nav>

${issueRow(idx, "../")}
</main>`;
  return frame({ prefix: "../../", title: `${p.title} · Teachometry Journal`, titleZh: `${Z(p.title)} · Teachometry 期刊`, description: p.description, body: main, current: "journal", css: ["journal.css"] });
}

function issueRow(current, base) {
  return `  <section class="wrap issue-row" aria-labelledby="issue-h">
    <p class="kicker" id="issue-h">${bi(`The Journal · ${BLOG_POSTS.length} essays`, `期刊 · ${BLOG_POSTS.length} 篇文章`)}</p>
    <ol class="issue-cards">
${BLOG_POSTS.map((q, i) => `      <li${i === current ? ' aria-current="page"' : ""}><a href="${base}${slug(q)}/index.html"><img src="${base}../assets/journal/${COVERS[slug(q)].img}" alt="" width="900" height="1100" loading="lazy"><span class="kicker">${bi(`Essay ${i + 1}${i === current ? " · reading" : ""}`, `第 ${i + 1} 篇${i === current ? " · 正在读" : ""}`)}</span><span class="t">${biE(q.title)}</span></a></li>`).join("\n")}
    </ol>
  </section>`;
}

// ---------------------------------------------------------------- contents page
function contentsPage() {
  const entry = (q, i, feature) => {
    const rt = readingTime(q), c = COVERS[slug(q)];
    return `      <li class="jx-entry${feature ? " jx-feature" : ""}">
        <a href="${slug(q)}/index.html">
          <span class="jx-no" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
          <img src="../assets/journal/${c.img}" alt="" width="900" height="1100"${feature ? "" : ' loading="lazy"'}>
          <span class="jx-copy">
            <span class="kicker">${biE(q.category)} · <time datetime="${DATE_ISO[q.publishedDate]}">${biE(q.publishedDate)}</time> · ${bi(`about ${rt.en} min`, `约 ${rt.zh} 分钟`)}</span>
            <span class="jx-title">${biE(q.title)}</span>
            <span class="jx-ex">${biE(q.excerpt)}</span>
            <span class="jx-read">${biE("Read the essay")} <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>
          </span>
        </a>
      </li>`;
  };
  const main = `<main id="main">
  <header class="wrap jx-head">
    <p class="kicker essay-meta"><span class="issue">${biE("The journal")}</span><span class="rule" aria-hidden="true"></span><span>${bi(`${BLOG_POSTS.length} essays`, `${BLOG_POSTS.length} 篇文章`)}</span></p>
    <h1 class="essay-title">${bi(`${esc("Ideas that should become")} <em>${esc("testable questions.")}</em>`, `${esc(Z("Ideas that should become"))}<em>${esc(Z("testable questions."))}</em>`)}</h1>
    ${biP("p", "essay-dek", esc("The benchmark should stay evidence-first. The blog is where we make the underlying hypotheses explicit: what teaching is, what AI might change, and what would have to be measured before stronger claims are justified."), esc(Z("The benchmark should stay evidence-first. The blog is where we make the underlying hypotheses explicit: what teaching is, what AI might change, and what would have to be measured before stronger claims are justified.")))}
  </header>

  <section class="wrap jx-contents" aria-label="Essays">
    <ol class="jx-list">
${BLOG_POSTS.map((q, i) => entry(q, i, i === 0)).join("\n")}
    </ol>
  </section>

  <section class="wrap jx-premise">
    <div>
      <p class="kicker">${biE("Journal premise")}</p>
      <h2 class="jx-h2">${biE("Questions before conclusions.")}</h2>
      ${biP("p", "jx-p", esc("The Teachometry Blog is a place for the ideas behind the benchmark: perspectives on teaching, AI, education, and measurement that should eventually become testable."), esc(Z("The Teachometry Blog is a place for the ideas behind the benchmark: perspectives on teaching, AI, education, and measurement that should eventually become testable.")))}
    </div>
    <aside class="callout boundary">
      <p class="kicker">${biE("Editorial boundary")}</p>
      <h3>${biE("Hypotheses are not benchmark results.")}</h3>
      ${biP("p", "", esc("These essays describe a long-run research direction. They do not establish that current AI systems have demonstrated:"), esc(Z("These essays describe a long-run research direction. They do not establish that current AI systems have demonstrated:")))}
      <ul class="jx-not">${["long-term learning gains", "retention or transfer", "autonomous K12 teaching", "workforce replacement", "real classroom effectiveness"].map((x) => `<li>${biE(x)}</li>`).join("")}</ul>
      ${biP("p", "", esc("Those remain empirical questions. The benchmark keeps observable tutoring evidence separate from these broader claims."), esc(Z("Those remain empirical questions. The benchmark keeps observable tutoring evidence separate from these broader claims.")))}
    </aside>
  </section>

  <section class="wrap jx-close">
    <p class="kicker">${biE("A working distinction")}</p>
    <h2 class="jx-h2">${bi(`${esc("Make the idea clear.")} <em>${esc("Then make it measurable.")}</em>`, `${esc(Z("Make the idea clear."))}<em>${esc(Z("Then make it measurable."))}</em>`)}</h2>
    ${biP("p", "jx-p", esc("The Blog holds the hypotheses; Benchmark and Methodology hold the procedures and observable evidence. Keeping those surfaces distinct is part of the work."), esc(Z("The Blog holds the hypotheses; Benchmark and Methodology hold the procedures and observable evidence. Keeping those surfaces distinct is part of the work.")))}
    <p class="jx-links"><a href="../index.html#dispersion">${biE("How we measure")}</a><a href="../index.html#plates">${biE("Explore the benchmark")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../", title: "The Journal · Teachometry", titleZh: "期刊 · Teachometry", description: "Long-form notes on AI teaching, measurement, instructional autonomy, and the future structure of education.", body: main, current: "journal", css: ["journal.css"] });
}

// ---------------------------------------------------------------- write
mkdirSync(join(PROTO, "blog"), { recursive: true });
writeFileSync(join(PROTO, "blog", "index.html"), contentsPage());
BLOG_POSTS.forEach((p, i) => {
  const dir = join(PROTO, "blog", slug(p)); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), essayPage(p, i));
});
process.stdout.write(`journal: contents + ${BLOG_POSTS.length} essays\n`);
