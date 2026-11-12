// Builds the Journal section of the Spectrum prototype: blog/index.html (contents) and one page per
// essay at blog/<slug>/index.html, in English and 简体中文 on the same page (the homepage's language
// toggle). Essay text is read from the live site's own source (BLOG_POSTS and SITE_ZH_CN_COPY in the
// compiled site), so nothing is retyped; only the figures, covers and captions below are new.
// usage (from the repo root, after `npm run build`): node website/prototypes/spectrum/tools/build-journal.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, bi, biE, biP, frame } from "./site-kit.mjs";

const { BLOG_POSTS: SITE_POSTS, articleHeadingId } = await import(join(REPO, "dist/src/site/pages/blog.js"));
const { LEARNING_ACCESS_ESSAY: LA } = await import(join(REPO, "dist/src/cli/learning-access-essay.js"));
const { ARROGANCE_ESSAY: AR } = await import(join(REPO, "dist/src/cli/arrogance-essay.js"));
const { BEYOND_WINNING_ESSAY: BW } = await import(join(REPO, "dist/src/cli/beyond-winning-essay.js"));
const { SITE_ZH_CN_COPY } = await import(join(REPO, "dist/src/site/locale-copy.js"));

// "Why Good Learning Resources Fail to Reach the People Who Need Them" (2026-11-03) is written as two
// parallel essays (src/cli/learning-access-essay.ts) rather than English plus the site's zh-CN copy.
// Its Chinese is registered as that copy here, so the essay goes through the same page as the others.
const LA_BOUNDARY = ["This essay proposes directions for education policy and product design. It is not a TutorBench result, a finding of wrongdoing, or proof of learning impact.",
  "本文讨论教育政策和产品设计方向，不是 TutorBench 的评测结果，也不构成对任何机构违法行为的认定或对学习成效的实证证明。"];
const LA_SOURCES_EN = [
  "MIT Open Learning: MIT OpenCourseWare (free courses and terms of use)",
  "Peking University Library: off-campus access notice (who may use licensed resources)",
  "Tsinghua University Library: notice on protecting the intellectual property of electronic resources",
  "CALIS Smart Services: e得 document delivery and interlibrary sharing",
  "National Science and Technology Library: foreign journals opened nationwide",
  "Bastani et al. (2025), PNAS: Generative AI without guardrails can harm learning",
];
function register(en, zh) {
  const have = SITE_ZH_CN_COPY[en];
  if (have !== undefined && have !== zh) throw new Error(`zh-CN copy already has a different translation for: ${en.slice(0, 60)}`);
  SITE_ZH_CN_COPY[en] = zh;
}
const learningAccess = {
  route: `/blog/${LA.slug}/`, category: "Perspective", publishedDate: "November 3, 2026",
  title: LA.en.title, excerpt: LA.en.dek, description: LA.en.description, evidenceBoundary: LA_BOUNDARY[0],
  sections: LA.en.sections.map((sec) => ({ heading: sec.heading, paragraphs: sec.paragraphs })),
  sources: LA.sources.map((src, i) => ({ en: LA_SOURCES_EN[i], zh: src.label, url: src.url })),
};
if (LA.sources.length !== LA_SOURCES_EN.length) throw new Error("learning access: sources changed, update LA_SOURCES_EN");
register(LA.en.title, LA.zh.title); register(LA.en.dek, LA.zh.dek); register(LA.en.description, LA.zh.description);
register(LA_BOUNDARY[0], LA_BOUNDARY[1]); register("November 3, 2026", "2026年11月3日");
LA.en.sections.forEach((sec, i) => {
  const zh = LA.zh.sections[i];
  if (zh === undefined || zh.paragraphs.length !== sec.paragraphs.length) throw new Error(`learning access: section ${i + 1} differs between languages`);
  register(sec.heading, zh.heading);
  sec.paragraphs.forEach((para, k) => register(para, zh.paragraphs[k]));
});
// "Arrogance Is Not What You Need" (2026-11-06): the Chinese is the original, the English a parallel
// translation (src/cli/arrogance-essay.ts). It opens with untitled paragraphs before §1.
const arrogance = {
  route: `/blog/${AR.slug}/`, category: "Perspective", publishedDate: "November 6, 2026",
  title: AR.en.title, excerpt: AR.en.dek, description: AR.en.description, evidenceBoundary: AR.en.boundary,
  intro: AR.en.intro,
  sections: AR.en.sections.map((sec) => ({ heading: sec.heading, paragraphs: sec.paragraphs })),
  sources: AR.sources,
};
register(AR.en.title, AR.zh.title); register(AR.en.dek, AR.zh.dek); register(AR.en.description, AR.zh.description);
register(AR.en.boundary, AR.zh.boundary); register("November 6, 2026", "2026年11月6日");
if (AR.zh.intro.length !== AR.en.intro.length) throw new Error("arrogance: the opening differs between languages");
AR.en.intro.forEach((para, k) => register(para, AR.zh.intro[k]));
AR.en.sections.forEach((sec, i) => {
  const zh = AR.zh.sections[i];
  if (zh === undefined || zh.paragraphs.length !== sec.paragraphs.length) throw new Error(`arrogance: section ${i + 1} differs between languages`);
  register(sec.heading, zh.heading);
  sec.paragraphs.forEach((para, k) => register(para, zh.paragraphs[k]));
});
// "After You’ve Beaten Everyone, Then What?" (2026-11-11): built the same way as the arrogance essay,
// from parallel Chinese and English in src/cli/beyond-winning-essay.ts.
const beyondWinning = {
  route: `/blog/${BW.slug}/`, category: "Perspective", publishedDate: "November 11, 2026",
  title: BW.en.title, excerpt: BW.en.dek, description: BW.en.description, evidenceBoundary: BW.en.boundary,
  intro: BW.en.intro,
  sections: BW.en.sections.map((sec) => ({ heading: sec.heading, paragraphs: sec.paragraphs })),
  sources: BW.sources,
};
register(BW.en.title, BW.zh.title); register(BW.en.dek, BW.zh.dek); register(BW.en.description, BW.zh.description);
register(BW.en.boundary, BW.zh.boundary); register("November 11, 2026", "2026年11月11日");
if (BW.zh.intro.length !== BW.en.intro.length) throw new Error("beyond winning: the opening differs between languages");
BW.en.intro.forEach((para, k) => register(para, BW.zh.intro[k]));
BW.en.sections.forEach((sec, i) => {
  const zh = BW.zh.sections[i];
  if (zh === undefined || zh.paragraphs.length !== sec.paragraphs.length) throw new Error(`beyond winning: section ${i + 1} differs between languages`);
  register(sec.heading, zh.heading);
  sec.paragraphs.forEach((para, k) => register(para, zh.paragraphs[k]));
});
// newest first, as the Journal has always been ordered
const BLOG_POSTS = [beyondWinning, arrogance, learningAccess, ...SITE_POSTS];

const slug = (p) => p.route.split("/").filter(Boolean).pop();
const zhWords = (s) => s.replace(/\s/g, "").length;
function readingTime(p) {
  const all = [p.excerpt, ...(p.intro ?? []), ...p.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.progression ?? []).map((x) => x.text), s.callout?.body ?? ""])].filter(Boolean);
  const en = all.join(" ").split(/\s+/).length;
  const zh = all.map((x) => zhWords(Z(x))).reduce((a, b) => a + b, 0);
  return { en: Math.max(1, Math.round(en / 230)), zh: Math.max(1, Math.round(zh / 420)) };
}
const DATE_ISO = { "November 11, 2026": "2026-11-11", "November 6, 2026": "2026-11-06", "November 3, 2026": "2026-11-03", "September 17, 2026": "2026-09-17", "September 28, 2026": "2026-09-28", "September 30, 2026": "2026-09-30" };

// ---------------------------------------------------------------- covers and figures (design content)
const COVERS = {
  [BW.slug]: {
    img: "podium.webp",
    alt: ["An empty wooden winners’ podium in a wet meadow at dawn, a medal hanging from the top step, the grass running on into fog.", "黎明时分，湿漉漉的草地上立着一座空的木制领奖台，最高一级挂着一枚奖牌，草地一直延伸进雾里。"],
    cap: ["The top step stands empty. The meadow goes on into the fog.", "最高的一级空着，草地一直延伸进雾里。"],
  },
  [AR.slug]: {
    img: "piano.webp",
    alt: ["An upright piano with its lid closed over the keys and an open score on the music desk, in soft daylight through a sheer curtain.", "一架立式钢琴，琴盖合在琴键上，谱架上摊着一份打开的乐谱，薄纱窗帘透进柔和的日光。"],
    cap: ["The tune is on the page. Through the closed lid, only knocks.", "旋律写在谱上；隔着合上的琴盖，只剩敲击声。"],
  },
  [LA.slug]: {
    img: "ladder.webp",
    alt: ["A wall of library shelves at dusk with a rolling ladder hooked onto its brass rail; high up, one red book has been drawn half out of its row.", "黄昏的图书馆书墙，一架移动梯挂在黄铜横杆上；高处有一本红色的书被抽出了一半。"],
    cap: ["The books are on the shelf. The question is the way up.", "书一直在架上，难的是怎么够到它。"],
  },
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
      cap: ["Thirty desks, one blackboard. The room is built for one person’s attention to be shared.", "三十张课桌，一块黑板。整间教室的设计，就是让一个人的注意力被大家分着用。"] },
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
      cap: ["The example from this section, worked on paper: how the parameter a changes y = ax², then the same curve moved along the axis.", "本节的例子在纸上的样子：参数 a 如何改变 y = ax² 的图像，再把同一条曲线沿坐标轴平移。"] },
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
FIGS[LA.slug] = [
  { at: "after:1.1", body: `<ol class="ladder reach">
            ${[["Available", "开放", "Published under usable terms", "资源已经以明确方式提供"],
               ["Discoverable", "可发现", "Found without already knowing the institution, title or acronym", "不知道提供者名称的人，也有合理机会找到它"],
               ["Usable", "可利用", "Its language, sequence, prerequisites, format and exercises let this learner make progress", "语言、难度、先修知识、结构与练习，能支持具体的人开始学习"],
               ["Improves independent learning", "提高独立学习能力", "Needs evidence beyond a visit or a download", "需要另外验证：一次访问、一次下载不等于学习成效"]].map(([en, zh, nen, nzh], i) => `<li${i === 3 ? ' class="now"' : ""}><span class="l-no">${String(i + 1).padStart(2, "0")}</span><span class="l-name">${bi(esc(en), esc(zh))}</span><span class="l-note">${bi(esc(nen), esc(nzh))}</span></li>`).join("")}
          </ol>`,
    cap: ["The three conditions this section separates, and the fourth, which a visit or a download cannot show.", "本节区分的三个条件，以及访问量和下载量证明不了的第四个。"] },
  { at: "end:4", body: `<div class="ratio">
            ${biP("p", "rt-name", "Fulfilment rate", "文献需求满足率")}
            <p class="rt-frac"><span class="rt-num">${bi("valid requests legally fulfilled within a specified period", "在约定时限内合法满足的有效请求数")}</span><span class="rt-den">${bi("all valid requests", "全部有效请求数")}</span></p>
            ${biP("p", "rt-h", "Recorded for each request, and nothing more", "每条需求只记录")}
            <ul class="rt-log">${[["Is there an authorised open copy?", "是否有合法开放版本？"], ["Does the institution hold the licence?", "机构是否已有授权？"], ["Was lawful document delivery tried?", "是否尝试合规文献传递？"], ["Time, cost to the reader, outcome", "等待多久、支付多少、最终是否取得"]].map(([en, zh]) => `<li>${bi(esc(en), esc(zh))}</li>`).join("")}</ul>
          </div>`,
    cap: ["The measure this section proposes in place of counting database packages. Personal reading histories are not published.", "本节建议用来代替“买了多少数据库”的指标。个人阅读记录不公开。"] },
  { at: "end:7", body: `<ol class="studies">
            ${[["Discoverability task", "资源发现实验", "Whether learners with varied backgrounds find a suitable free course, how long it takes, which prerequisites they miss", "不同背景的学习者能否找到合适的免费课程、花多少时间、遗漏了哪些先修要求", "They find courses but cannot complete them", "找到了课程，却无法完成学习"],
               ["Document-request audit", "学术文献需求审计", "Lawful fulfilment rate, delay and cost for a sample of valid requests", "抽样有效请求的合法全文获取率、等待时间和成本", "Collective purchasing raises costs without improving fulfilment", "联合采购增加了成本，却没有提升全文获取率"],
               ["Instructional comparison", "教学效果比较", "Later, unaided transfer on unfamiliar problems, not just engagement", "不只看体验和投入，还看延迟的、离开 AI 后的独立迁移表现", "AI-assisted answers improve while independent solutions weaken", "AI 让练习答案更好看，却降低了独立解题能力"]].map(([en, zh, men, mzh, fen, fzh], i) => `<li><span class="s-no">${String(i + 1).padStart(2, "0")}</span><span class="s-name">${bi(esc(en), esc(zh))}</span><span class="s-k">${bi("Records", "记录")}</span><span class="s-v">${bi(esc(men), esc(mzh))}</span><span class="s-k s-fail">${bi("It has failed if", "失败信号")}</span><span class="s-v">${bi(esc(fen), esc(fzh))}</span></li>`).join("")}
          </ol>`,
    cap: ["The three studies this section proposes, each with the result that would count against the idea it tests.", "本节提出的三项研究，以及会推翻各自设想的结果。"] },
];
FIGS[AR.slug] = [
  { at: "after:0.1", body: `<div class="odds">
            <div class="od-col">
              ${biP("p", "od-k", "The tappers’ guess", "敲的人估计")}
              ${biP("p", "od-v", "about 1 in 2", "约一半")}
              ${biP("p", "od-n", "of the songs would be named", "的歌能被猜出来")}
            </div>
            <div class="od-col od-real">
              ${biP("p", "od-k", "What the listeners named", "听的人实际猜中")}
              ${biP("p", "od-v", "fewer than 3 in 100", "不到百分之三")}
              ${biP("p", "od-n", "almost none", "几乎全没猜出来")}
            </div>
            <p class="od-foot">${bi("The tapper hears the melody", "敲的人听见旋律")}<span aria-hidden="true">·</span>${bi("The listener hears knocks", "听的人只听见敲击")}</p>
          </div>`,
    cap: ["The tapping study in this section: what the tappers expected, and what the listeners managed. Figures from Newton’s 1990 dissertation.", "本节的敲歌实验：敲的人的估计，和听的人的实际结果。数字出自 Newton 1990 年的博士论文。"] },
  { at: "after:1.4", body: `<ol class="probe">
            ${[["Ask", "提问", "Which is bigger, 0.3 or 0.25?", "0.3 和 0.25，哪个大？", "“0.25.”", "“0.25。”"],
               ["Guess", "猜测", "Is the student reading the digits after the point as a whole number? 25 is bigger than 3.", "是不是把小数点后面当成了整数？25 比 3 大。", "", ""],
               ["Test", "检验", "What about 0.3 and 0.30?", "那 0.3 和 0.30 呢？", "“0.30.” The guess holds. “Equal” would have meant a new guess.", "“0.30。”猜测成立。如果答“一样大”，就换一个猜测。"],
               ["Explain differently", "换个讲法", "Thirty cents or a quarter: which is more?", "三角和两角五分，哪个多？", "Answered at once.", "马上答对。"]].map(([ten, tzh, qen, qzh, aen, azh], i) => `<li${i === 3 ? ' class="now"' : ""}><span class="pb-tag">${bi(esc(ten), esc(tzh))}</span><span class="pb-q">${bi(esc(qen), esc(qzh))}</span>${aen ? `<span class="pb-a">${bi(esc(aen), esc(azh))}</span>` : ""}</li>`).join("")}
          </ol>`,
    cap: ["The decimal question from this section, followed through: guess, check, guess again, then explain it another way. The money is in dollars in English and in jiao and fen in Chinese.", "本节的小数题，一步步走下来：猜测、检验、再修正，然后换一种讲法。英文版换成了美元，中文版是角和分。"] },
  { at: "after:2.1", body: `<ol class="leap">
            ${[["Seen", "看到的", "Misses the same problem a few times in a row", "连着几次没听懂同一道题"],
               ["Inferred", "推断", "“Slow to catch on”", "“反应慢”"],
               ["Inferred", "推断", "“Lacks the ability to learn”", "“没有学习能力”"],
               ["Inferred", "推断", "“Born that way”", "“天生就不行”"]].map(([ken, kzh, en, zh], i) => `<li${i === 0 ? ' class="seen"' : ""}><span class="lp-k">${bi(esc(ken), esc(kzh))}</span><span class="lp-v">${bi(esc(en), esc(zh))}</span></li>`).join("")}
            <li class="lp-end"><span class="lp-k">${bi("Then", "然后")}</span><span class="lp-v">${bi("Patience ends", "耐心到此为止")}</span></li>
          </ol>`,
    cap: ["The chain of judgements this section describes. Only the first step is something anyone actually saw.", "本节描述的一连串判断。只有第一步是真正看到的。"] },
];
// a cell of the Korea table: the number, then its unit and note on a smaller line
const tallyCell = (ven, vzh, uen, uzh) => `<td><span class="tl-v">${bi(esc(ven), esc(vzh))}</span>${uen ? `<span class="tl-u">${bi(esc(uen), esc(uzh))}</span>` : ""}</td>`;
FIGS[BW.slug] = [
  { at: "after:0.5", body: `<table class="tally">
            <thead><tr><th scope="col">${bi("South Korea, primary and secondary", "韩国中小学")}</th><th scope="col">2024</th><th scope="col">2025</th></tr></thead>
            <tbody>
              <tr><th scope="row">${bi("Students", "学生人数")}</th>${tallyCell("5.13", "513", "million · down 1.5%", "万人 · 减少 1.5%")}${tallyCell("5.02", "502", "million · down 2.3%", "万人 · 减少 2.3%")}</tr>
              <tr><th scope="row">${bi("Spent on private tutoring", "校外教育支出总额")}</th>${tallyCell("29.2", "29.2", "trillion won · a record, fourth year running", "万亿韩元 · 连续第四年新高")}${tallyCell("27.5", "27.5", "trillion won · down 5.7%", "万亿韩元 · 减少 5.7%")}</tr>
              <tr><th scope="row">${bi("Share of students tutored", "参加辅导的学生比例")}</th>${tallyCell("80%", "80%", "", "")}${tallyCell("75.7%", "75.7%", "", "")}</tr>
              <tr class="now"><th scope="row">${bi("Each month, per student tutored", "参加辅导的学生，每人每月")}</th>${tallyCell("592,000", "59.2", "won", "万韩元")}${tallyCell("604,000", "60.4", "won · a record", "万韩元 · 新高")}</tr>
            </tbody>
          </table>`,
    cap: ["South Korea’s official survey of private education, as reported in sources 3 and 4. In 2025 the total fell, yet each student still being tutored cost more than ever.", "韩国官方的校外教育支出调查，数字据资料 3、4 的报道。2025 年总额回落，可仍在参加辅导的学生，每人每月的花费创了新高。"] },
  { at: "after:3.13", body: `<div class="mazes">
            ${biP("p", "mz-q", "In the next maze, will you still need what this one teaches?", "在下一座迷宫里，还用不用得上这一座要教的东西？")}
            <ol class="mz-list">
              ${[["A cancer researcher", "研究癌症的人", "Solving a protein structure by X-ray crystallography", "用 X 射线晶体学解出蛋白质结构", "Rarely: the work that follows seldom asks for it by hand", "很少：接下来的工作，很少要求亲手重复", "Obstacle: hand it to a tool", "障碍：可以交给工具", "pass"],
                 ["A cancer researcher", "研究癌症的人", "Knowing where a predicted structure might be wrong", "知道预测出来的结构可能在哪里出错", "Always: every judgement after it rests on it", "一直需要：之后的每一个判断都建在它上面", "Foundation: learn it", "地基：自己学会", ""],
                 ["A child adding fractions", "学分数加法的孩子", "Fractional units", "分数单位", "Always: ratio, probability and algebra are built on them", "一直需要：比例、概率、代数都建在它上面", "Foundation: an answer handed over pulls it out", "地基：直接给答案，就是在拆它", ""]].map(([wen, wzh, nen, nzh, aen, azh, ven, vzh, cls]) => `<li${cls ? ` class="mz-${cls}"` : ""}><span class="mz-who">${bi(esc(wen), esc(wzh))}</span><span class="mz-name">${bi(esc(nen), esc(nzh))}</span><span class="mz-a">${bi(esc(aen), esc(azh))}</span><span class="mz-v">${bi(esc(ven), esc(vzh))}</span></li>`).join("")}
            </ol>
          </div>`,
    cap: ["The test from this section, applied to its two examples. Whether a step can be handed to AI depends on the next maze, not on the step itself.", "本节的判断标准，用在文中的两个例子上。一步能不能交给 AI，看的不是这一步本身，而是下一座迷宫。"] },
  { at: "after:4.4", body: `<div class="aims">
            <p class="am-not"><span class="am-k">${bi("Not enough on its own", "单看这些不够")}</span><span class="am-v">${bi("Questions the AI answered", "AI 回答了多少问题")}</span><span class="am-v">${bi("Exercises completed", "学生完成了多少练习")}</span></p>
            <ol class="am-list">
              ${[["An exam", "考试", "Knowledge and strategy, used under that exam’s conditions", "特定考试条件下的知识运用和策略表现"],
                 ["Learning", "学习", "Understanding, retention and transfer", "知识的理解、保持和迁移"],
                 ["Research and creation", "研究和创造", "The questions learners can ask with AI, the hypotheses they can test, the work they can finish that was out of reach before", "借助 AI 能提出什么问题、检验什么假设、完成什么原本做不到的工作"]].map(([gen, gzh, een, ezh], i) => `<li${i === 2 ? ' class="now"' : ""}><span class="am-k">${bi("Goal", "目标")}</span><span class="am-g">${bi(esc(gen), esc(gzh))}</span><span class="am-k">${bi("Look at", "要看")}</span><span class="am-e">${bi(esc(een), esc(ezh))}</span></li>`).join("")}
            </ol>
          </div>`,
    cap: ["The evidence this section asks for, goal by goal. The last row adds to the ones above it rather than replacing them.", "本节按目标列出的证据。最后一行是在前两行之上再加的要求，不是取而代之。"] },
];
// the pull quote goes after this section (skipped when it repeats the dek or a callout)
const PULL_AFTER = { "when-learning-starts-to-feel-like-failure": "after:5.0", "the-classroom-does-not-need-30-robots": "end:0" };

// ---------------------------------------------------------------- essay page
function prose(text, zh = false) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(zh ? /〔资料 ?(\d+)〕/g : /\s?\[(\d+)\]/g, (m, n) => `<a class="fn" href="#source-${n}" aria-label="${zh ? `资料 ${n}` : `Source ${n}`}">${n}</a>`);
}
// Chinese headings break only between words (a long one otherwise splits a word across lines)
const seg = new Intl.Segmenter("zh-CN", { granularity: "word" });
// words the segmenter splits but a reader does not: no line break inside these
const ZH_KEEP = ["所有人"];
function zhWordCuts(text) {
  const cuts = []; let at = 0;
  for (const { segment } of seg.segment(text)) { at += segment.length; cuts.push(at); }
  const inside = (c) => ZH_KEEP.some((w) => { for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + 1)) if (c > i && c < i + w.length) return true; return false; });
  const words = []; let from = 0;
  for (const c of cuts) if (!inside(c)) { words.push(text.slice(from, c)); from = c; }
  return words;
}
const zhHead = (en) => zhWordCuts(Z(en)).map(esc).join("<wbr>");
const biH = (en) => bi(esc(en), zhHead(en));
function sources(list) {
  return `<section class="sources" aria-labelledby="sources">
          <h2 id="sources" class="src-h">${biE("Sources and further reading", "资料来源与延伸阅读")}</h2>
          <ol class="notes-list">${list.map((src, i) => `<li id="source-${i + 1}"><span><a href="${esc(src.url)}" rel="noopener">${bi(esc(src.en), esc(src.zh))}</a></span></li>`).join("")}</ol>
        </section>`;
}
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
  // a paragraph starting with "> " is a spoken line, set apart. The drop cap goes on the essay's first
  // paragraph, or, when it opens with a lead-in and spoken lines, on the first full paragraph after them.
  const dropAt = (p.intro ?? []).findIndex((x) => !x.startsWith("> ") && x.length > 80);
  const para = (text, first) => {
    const zh = Z(text), said = text.startsWith("> ");
    const cls = said ? "said" : first ? "first" : "";
    return "        " + biP("p", cls, prose(said ? text.slice(2) : text), prose(said ? zh.slice(2) : zh, true));
  };
  (p.intro ?? []).forEach((text, k) => body.push(para(text, k === dropAt)));
  p.sections.forEach((sec, i) => {
    body.push(`        <h2 id="${articleHeadingId(sec.heading)}"><span class="no">§${i + 1}</span><span>${biH(sec.heading)}</span></h2>`);
    body.push(figAt(`before:${i}`));
    sec.paragraphs.forEach((text, k) => {
      body.push(para(text, i === 0 && k === 0 && !p.intro));
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
        <h1 class="essay-title">${biH(p.title)}</h1>
        ${biP("p", "essay-dek", esc(p.excerpt), esc(Z(p.excerpt)))}
        <p class="essay-byline kicker"><span>Teachometry</span><span>${bi(`${p.sections.length} sections · about ${rt.en} min`, `${p.sections.length} 节 · 约 ${rt.zh} 分钟`)}</span></p>
      </div>
      <figure class="cover-plate">
        <img src="../../assets/journal/${cover.img}" alt="${esc(cover.alt[0])}" width="900" height="1100" data-alt-en="${esc(cover.alt[0])}" data-alt-zh="${esc(cover.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc(cover.cap[0]), esc(cover.cap[1]))}</figcaption>
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
${p.sources ? "        " + sources(p.sources) : ""}
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
