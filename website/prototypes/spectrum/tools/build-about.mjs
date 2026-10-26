// Builds the project pages of the Spectrum prototype: about/index.html, community/index.html,
// contact/index.html and 404.html, in English and 简体中文 on one page.
// The copy mirrors the live renderers: renderAboutPage (src/site/pages/developer.ts), renderCommunityPage
// (community.ts, through the live siteText keys), renderContactPage (contact.ts) and renderNotFoundPage
// (not-found.ts). English strings are looked up in the live SITE_ZH_CN_COPY, so a string that drifts from
// the live page fails the build. Status lines (website, package, dataset, cases, model runs) come from the
// public artifacts and package.json, as on the live About page. Applications stay closed: no form anywhere.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-about.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, Zor, bi, biE, biPE, frame } from "./site-kit.mjs";

const { formatPublicCount } = await import(join(REPO, "dist/src/site/public-localization-formatters.js"));
const { publicArtifactNotice } = await import(join(REPO, "dist/src/site/public-localization.js"));
const { siteText } = await import(join(REPO, "dist/src/site/i18n.js"));
const { SITE_CONTACT_EMAIL, SITE_X_URL, SITE_GITHUB_URL } = await import(join(REPO, "dist/src/site/html.js"));
const benchmark = JSON.parse(readFileSync(join(REPO, "website/dist/public-data/benchmark.json"), "utf8"));
const models = JSON.parse(readFileSync(join(REPO, "website/dist/public-data/models.json"), "utf8"));
const PKG = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).version;
const GITHUB = SITE_GITHUB_URL;
const repo = (path) => `${GITHUB}/blob/main/${path}`;
const DATASET = `${benchmark.dataset.id}@${benchmark.dataset.version}`;

const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
const OUT_ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg>`;
const CROSS = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>`;
const attr2 = (name, en, zh = Z(en)) => `${name}="${esc(en)}" data-${name}-en="${esc(en)}" data-${name}-zh="${esc(zh)}"`;
/** live fragments the live page breaks with <br>: one phrase here, spaced in English, joined in Chinese */
const run = (parts, zhJoin = "") => bi(esc(parts.join(" ")), esc(parts.map(Z).join(zhJoin)));
/** a Community string by its live siteText key */
const T = (key) => bi(esc(siteText("en", key)), esc(siteText("zh-CN", key)));
const TP = (tag, cls, key) => biPE(tag, cls, siteText("en", key), siteText("zh-CN", key));
const out = (rel, html) => { const f = join(PROTO, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, html); };

/* ------------------------------------------------------------------ About */

const DIMS = {
  correctness: ["Correctness", "Whether the Tutor stays factually and conceptually correct."],
  diagnosis: ["Diagnosis", "Whether it identifies the learner’s actual error, gap, or reasoning issue."],
  guidance: ["Guidance", "Whether its explanation or hint helps the learner make progress."],
  adaptation: ["Adaptation", "Whether it changes its help for the learner’s state and context."],
  actionability: ["Actionability", "Whether it leaves the learner with a clear, executable next step."],
};
const DIM_ZH = { Correctness: "正确性", Diagnosis: "诊断", Guidance: "引导", Adaptation: "适应", Actionability: "可执行性" };
const dims = benchmark.dimensions.score.map((d) => { if (!DIMS[d]) throw new Error(`unknown score dimension ${d}`); return DIMS[d]; });

const PRINCIPLES = [
  [["Observable", "over assumed"], "Evaluate what a tutor says and does in the interaction, not inferred intentions or claimed capabilities."],
  [["Evidence", "over hype"], "Favor transparent methods, reproducible artifacts, and inspectable evidence over marketing narratives."],
  [["Context", "over a single score"], "Results belong to specific cases, versions, dimensions, and evaluation contexts—not a universal number."],
  [["Open methods", "over black boxes"], "Publish cases, methodology, contracts, and public artifacts so claims can be inspected and challenged."],
];
const RESOURCES = [
  ["Licensing scope", "Read the boundaries", repo("docs/licensing.md")],
  ["Software license", "Apache-2.0", repo("LICENSE")],
  ["Benchmark content", "CC BY 4.0", repo("LICENSES/CC-BY-4.0.txt")],
  ["TutorBench Brand Policy", "Usage guidelines", repo("LICENSES/BRAND-POLICY.md")],
  ["Contributing", "Get involved", repo("CONTRIBUTING.md")],
  ["Security", "Report an issue", repo("SECURITY.md")],
  ["GitHub", "View repository", GITHUB],
];
// names the live zh page leaves in English
const KEEP = new Set(["Apache-2.0", "CC BY 4.0", "GitHub", "TutorBench Brand Policy"]);
const N = (s) => (KEEP.has(s) ? s : Z(s));

const ABOUT_COVER = [
  `One line of lead type, ANSWERS ≠ TEACHING, set in a steel composing stick, its faces inked in five colours. In front lies the proof pulled from it, the colours blending across the line; behind, a brayer rests on a glass slab rolled out with the same five inks.`,
  `一行铅字 ANSWERS ≠ TEACHING 排在钢制排字手托里，字面上着五种颜色的墨。前面是从这行字拓下的样张，颜色沿着一行字渐次相融；后面，墨辊停在玻璃墨台上，墨台上滚开的是同样的五种墨。`,
];

/* the vision: a 42 s film (render/film/) and the letter it is cut from. The film never plays on its own;
   the subtitles are page text following the site language (and WebVTT tracks for fullscreen). */
const FILM_CUES = JSON.parse(readFileSync(join(PROTO, "render/film/cues.json"), "utf8")); // [start, end, zh, en] seconds
const LETTER = {
  salutation: ["Dear learner,", "亲爱的学习者："],
  open: [
    ["We believe everyone deserves a chance at the best education. Not the most expensive. Not the most exclusive. The kind that begins where you are, and stays with you until you understand.",
      "我们相信，每个人都应该有机会，享有最好的教育。不是最昂贵的，也不是最难进入的，而是从你所在的地方出发，一直陪你走到真正明白的那一种。"],
    ["This is a letter about the future we hope to help build. It holds three hopes.",
      "这封信，关于我们希望一起去往的未来。信里装着三个愿望。"],
  ],
  hopes: [
    [["I", "一"], ["Ask freely.", "自由地提问"],
      ["Think of a question you kept to yourself: because it seemed too simple, because everyone else seemed to get it already, because the way you saw it was different. We hope for a future where that question is welcome. Asked as many times as you need, at your own pace, in your own words.",
        "也许你曾把一个问题咽了回去：怕它太简单，怕别人早就懂了，怕自己想得和大家不一样。我们希望有这样一个未来：那个问题会被认真接住。你可以问很多遍，按自己的节奏，用自己的话。"]],
    [["II", "二"], ["Explore because you want to.", "主动地探索"],
      ["So much learning still runs on pressure: the next exam, the next deadline, someone watching over your shoulder. We hope for learning that runs on something quieter, and stronger: the wish to understand. Curiosity that is noticed, fed, and followed wherever it leads.",
        "太多学习仍然靠压力推动：下一场考试，下一个截止日期，一双盯着你的眼睛。我们期待另一种力量，更安静，也更持久，那就是想要弄明白的好奇。它被看见，被呵护，被认真回应，并带你走向更远的地方。"]],
    [["III", "三"], ["Dare to make something new.", "大胆地创造"],
      ["Education should not end at remembering what is already known, finding the expected answer, finishing the standard task. We hope everyone gets the chance to form a view of their own, to ask the question no one has asked yet, and to try making something that does not exist.",
        "教育不该止步于记住已知、找到标准答案、完成规定动作。我们希望每个人都有机会形成自己的看法，提出还没有人问过的问题，去尝试做出世界上还没有的东西。"]],
  ],
  honest: ["These are long hopes. We have not reached them, and we will not pretend that we have.", "这些是很长远的愿望。我们还没有抵达，也不会假装已经抵达。"],
  close: [
    ["So we are starting somewhere smaller, and more careful: learning to see clearly what good teaching looks like. TutorBench is that start. It studies how to observe, evaluate, and improve the way AI teaches, one authored case at a time. It cannot yet show that anyone learns more because of it. It can help us look closely, and honestly.",
      "所以，我们从更小、也更需要严谨的一步开始：先学会看清，什么是好的教学。TutorBench 就是这一步。它研究如何观察、评估并改进 AI 的教学，从一个个精心编写的案例做起。它还不能证明有人因此学得更好，但它能帮我们看得更仔细，也更诚实。"],
    ["We will keep writing as we learn. Until then, keep asking.", "我们会一边学，一边继续写下去。在那之前，请继续提问。"],
  ],
  sign: ["— Teachometry", "—— Teachometry"],
  ps: ["P.S. If this letter leaves you with a question, ask us. That is rather the point.", "附言：如果这封信让你想问点什么，欢迎来问我们。毕竟，这正是重点。"],
};
const FILM_ALT = [
  "A 42-second silent film in six shots: a dandelion clock backlit in violet-blue mist; one seed letting go; seeds drifting; a seed touching still water and sending out rings; the focus finding one seed's crown; the clock again, with a gap where seeds have left. Every line in it is from the letter below.",
  "一部 42 秒的无声短片，共六个镜头：雾蓝紫色里逆光的一朵蒲公英；一颗种子松开；许多种子在空中飘；一颗种子落在静水上，涟漪散开；焦点落到一颗种子的冠毛上；再回到那朵蒲公英，它少了一角。片中的每一句话都出自下面这封信。",
];
const PLAY = `<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M3 2v20l17-10z"/></svg>`;

function visionSection() {
  const p = ([en, zh], cls = "") => `<p${cls ? ` class="${cls}"` : ""}>${bi(esc(en), esc(zh))}</p>`;
  return `<section class="ab-vision" id="letter" aria-labelledby="about-letter-title">
    <div class="wrap">
      <div class="ab-vision-head">
        <p class="kicker fount-k">${bi("A letter to learners", "致每一个正在学习的人")}</p>
        <h2 class="ab-neq" id="about-letter-title">${bi("Keep <i>asking.</i>", "请继续<i>提问。</i>")}</h2>
      </div>
      <figure class="ab-reel" data-film data-cues="${esc(JSON.stringify(FILM_CUES))}">
        <div class="ab-screen">
          <video preload="none" playsinline poster="../assets/about/vision-poster.webp" data-poster-m="../assets/about/vision-poster-m.webp" width="1920" height="1080" aria-describedby="about-film-desc" ${attr2("aria-label", "Film: Keep asking", "短片：请继续提问")}>
            <source src="../assets/about/vision.webm" type='video/webm; codecs="av01.0.08M.10"'>
            <source src="../assets/about/vision.mp4" type="video/mp4">
            <track kind="subtitles" srclang="en" label="English" src="../assets/about/vision.en.vtt">
            <track kind="subtitles" srclang="zh-CN" label="中文" src="../assets/about/vision.zh.vtt">
          </video>
          <p class="ab-sub" aria-hidden="true"></p>
          <button type="button" class="ab-play" data-play ${attr2("aria-label", "Play the film (42 seconds, no sound)", "播放短片（42 秒，无声）")}><span>${PLAY}</span></button>
        </div>
        <figcaption class="kicker"><span><b>${bi("Film", "短片")}</b> · ${bi(`42 seconds, silent. Every line is from the letter below.`, `42 秒，无声。片中每一句都出自下面这封信。`)}</span><span class="visually-hidden" id="about-film-desc">${bi(esc(FILM_ALT[0]), esc(FILM_ALT[1]))}</span></figcaption>
      </figure>
      <div class="ab-letter" id="about-letter-body">
        ${p(LETTER.salutation, "ab-letter-salute")}
        ${LETTER.open.map((x) => p(x)).join("\n        ")}
        <ol class="ab-hopes">
          ${LETTER.hopes.map(([n, h, t]) => `<li><span class="n">${bi(n[0], n[1])}</span><h3>${bi(esc(h[0]), esc(h[1]))}</h3>${p(t)}</li>`).join("\n          ")}
        </ol>
        ${p(LETTER.honest, "ab-letter-honest")}
        ${LETTER.close.map((x) => p(x)).join("\n        ")}
        ${p(LETTER.sign, "ab-letter-sign")}
        <p class="ab-letter-ps">${bi(esc(LETTER.ps[0]).replace("ask us", `<a href="../contact/index.html">ask us</a>`), esc(LETTER.ps[1]).replace("欢迎来问我们", `<a href="../contact/index.html">欢迎来问我们</a>`))}</p>
      </div>
    </div>
  </section>`;
}

function aboutPage() {
  const modelStatus = models.available
    ? [formatPublicCount(models.entries.length, "modelRuns", "en"), formatPublicCount(models.entries.length, "modelRuns", "zh-CN")]
    : [publicArtifactNotice(models.notice, "en"), publicArtifactNotice(models.notice, "zh-CN")];
  const LEDGER = [
    ["Website", [benchmark.statusLabel, Z(benchmark.statusLabel)]],
    ["Package", [`tutor-benchmark@${PKG} published`, `已发布 tutor-benchmark@${PKG}`]],
    ["Dataset", [DATASET, DATASET]],
    ["Public cases", [formatPublicCount(benchmark.dataset.caseCount, "syntheticCases", "en"), formatPublicCount(benchmark.dataset.caseCount, "syntheticCases", "zh-CN")]],
    ["Public model runs", modelStatus, true],
    ["Calibration", ["Not completed; results remain preliminary and uncalibrated where applicable."].map((s) => [s, Z(s)])[0], true],
  ];
  const [neqA, neqB] = [Z("Answers"), Z("Teaching.")];
  const body = `<main id="main" class="ab">
  <header class="essay-head ab-head">
    <div class="wrap">
      <p class="essay-meta kicker"><span class="issue">${biE("About Teachometry")}</span><span class="rule" aria-hidden="true"></span><span>${bi("Open measurement infrastructure for AI tutoring", "面向 AI 教学的开放测量基础设施")}</span></p>
      <div class="ab-head-grid">
        <h1 class="essay-title" id="about-title">${bi(`A model can know the answer <em>without being a good tutor.</em>`, `${esc(Z("A model can know"))}${esc(Z("the answer"))}<em>${esc(Z("without being"))}${esc(Z("a good tutor."))}</em>`)}</h1>
        <div>
          ${biPE("p", "ab-lede", "Teachometry is open measurement infrastructure for AI tutoring. We evaluate observable tutoring behavior in structured cases—not just whether the answer is right.")}
          <p class="cx-actions"><a class="cta cta-ink" href="../methodology/index.html">${biE("Read our approach")} ${ARROW}</a><a class="cta cta-line" href="../data/index.html">${biE("Explore the benchmark")}</a></p>
        </div>
      </div>
      <figure class="ab-plate">
        <img src="../assets/about/press.webp" alt="${esc(ABOUT_COVER[0])}" width="1600" height="960" data-alt-en="${esc(ABOUT_COVER[0])}" data-alt-zh="${esc(ABOUT_COVER[1])}">
        <figcaption class="kicker"><span><b>${bi("Cover", "封面")}</b> · ${bi(`Five inks on one roller, blending across the line as the five dimensions do across one reply.`, `五种墨在同一根墨辊上，沿着一行字彼此相融，正如五个维度在同一条回复里交织。`)}</span></figcaption>
      </figure>
    </div>
  </header>

  <section class="wrap ab-row ab-why" aria-labelledby="about-why-title">
    <div class="ab-why-head">
      <p class="kicker">${biE("Why Teachometry exists")}</p>
      <h2 class="ab-neq" id="about-why-title">${bi("Answers <i>≠</i> Teaching.", `${esc(neqA)} <i>≠</i> ${esc(neqB)}`)}</h2>
    </div>
    <div class="ab-why-arg">
      ${biPE("p", "", "AI models can often produce correct answers, but tutoring asks for more: noticing where a learner is stuck, guiding reasoning, adapting help, and leaving an actionable next step. A correct answer is evidence of correctness—not evidence that the interaction taught well.")}
      ${biPE("p", "ab-quote", "To evaluate AI tutoring, we need evidence of what models do with learners—not only what they know.")}
    </div>
    <div>
      ${biPE("p", "ab-dims-intro", "The public benchmark keeps these questions separate, so each result remains tied to a case, a dimension, and its observable evidence.")}
      <ol class="ab-dims" ${attr2("aria-label", "Canonical benchmark score dimensions", "标准基准评分维度")}>
        ${dims.map(([label, desc], i) => `<li><span class="n">0${i + 1}</span><span><strong>${biE(label, Zor(label, DIM_ZH[label]))}</strong><small>${biE(desc)}</small></span><img class="gem" src="../assets/gems/gem-${i}.webp" alt="" width="96" height="96" loading="lazy"></li>`).join("\n        ")}
      </ol>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="about-boundary-title">
    <div>
      <p class="kicker">${biE("Our position")}</p>
      <p class="ab-side-note">${bi("Same cases.<br><em>Clear criteria.</em>", `${esc(Z("Same cases."))}<br><em>${esc(Zor("Clear criteria.", "清晰标准。"))}</em>`)}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="about-boundary-title">${bi("We measure tutors.<br>We don’t build the tutor.", `${esc(Z("We measure tutors."))}<br>${esc(Z("We don’t build the tutor."))}`)}</h2>
      <p class="jx-p">${bi(`Teachometry's TutorBench engine evaluates a <code>TutorUnderTest</code> through a provider-neutral adapter boundary. Provider-specific behavior enters at the edge; the engine’s cases, contracts, evaluators, and reports remain independent.`, `${esc(Z("Teachometry's TutorBench engine evaluates a"))} <code>TutorUnderTest</code> ${esc(Z("through a provider-neutral adapter boundary. Provider-specific behavior enters at the edge; the engine’s cases, contracts, evaluators, and reports remain independent."))}`)}</p>
      <figure class="ab-flow">
        <div class="ab-flow-row">
          ${boundaryList(["Chat application", "Prompt playground"])}
          <div class="ab-core">
            <div class="ab-node"><strong><code>TutorUnderTest</code></strong><small>${biE("provider adapter boundary")}</small></div>
            ${ARROW}
            <div class="ab-node"><strong>Teachometry ${biE("evaluation")}</strong><small>${biE("cases · rubrics · reports")}</small></div>
          </div>
          ${boundaryList(["Model fine-tuning", "Admin dashboard", "Review Workspace module"])}
        </div>
        <figcaption>${biE("Same cases. Clear criteria. Reproducible evaluation.")}</figcaption>
      </figure>
      <p class="cx-actions"><a class="text-link" href="${GITHUB}" rel="noreferrer">${biE("Inspect the repository")} ${OUT_ARROW}</a></p>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="about-principles-title">
    <div>
      <p class="kicker" id="about-principles-title">${biE("What we believe")}</p>
      <p class="ab-side-note">${bi("Open science<br><em>for better learning.</em>", "开放科学，<br><em>为了更好的学习。</em>")}</p>
    </div>
    <div class="ab-principles">
      ${PRINCIPLES.map(([h, p], i) => `<article><span class="n">0${i + 1}</span><h3>${run(h)}</h3>${biPE("p", "", p)}</article>`).join("\n      ")}
    </div>
  </section>

  ${visionSection()}

  <section class="wrap ab-row" aria-labelledby="about-status-title">
    <div>
      <p class="kicker">${biE("Where we are now")}</p>
      <h2 class="ab-status-h" id="about-status-title">${biE(benchmark.statusLabel)}</h2>
      ${biPE("p", "jx-p", "Teachometry is in active development. The public site packages approved development metadata and public cases; it does not publish private runs or claim completed calibration.")}
      <p class="cx-actions"><a class="text-link" href="${repo("docs/release.md")}" rel="noreferrer">${biE("View current release notes")} ${OUT_ARROW}</a></p>
    </div>
    <dl class="ab-ledger">
      ${LEDGER.map(([k, [en, zh], pending]) => `<div${pending ? ' class="pending"' : ""}><dt>${biE(k)}</dt><dd>${biE(en, zh)}</dd></div>`).join("\n      ")}
    </dl>
  </section>

  <section class="wrap ab-row" aria-labelledby="about-open-title">
    <div>
      <p class="kicker">${biE("Open by design")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="about-open-title">${run(["A shared resource", "for the AI tutoring community."])}</h2>
      ${biPE("p", "jx-p", "Teachometry is developed in the open, with separate boundaries for software, authored benchmark content, and the TutorBench name and brand assets.")}
      <div class="ab-res">
        ${RESOURCES.map(([t, d, h]) => `<a href="${h}" rel="noreferrer"><strong>${biE(t, N(t))}</strong><small>${biE(d, N(d))}</small>${OUT_ARROW}</a>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="jx-close" aria-labelledby="about-close-title">
    <div class="wrap">
      <p class="kicker fount-k">${bi("Write to us", "写信给我们")}</p>
      <h2 id="about-close-title" class="jx-h2">${run(["Questions, collaboration,", "or project feedback."])}</h2>
      <p class="cx-actions"><a class="cta cta-ink" href="../contact/index.html">${biE("Contact")} ${ARROW}</a><a class="cta cta-line" href="../community/index.html">${bi("Community", "社区")}</a></p>
    </div>
  </section>
</main>`;
  return frame({ prefix: "../", title: "About — Teachometry", titleZh: Z("About — Teachometry"), description: "Teachometry measures observable AI tutoring behavior, not merely whether a model produces a correct answer.", body, current: "about", css: ["journal.css", "about.css"], scripts: ["about.js"] });
}

function boundaryList(items) {
  return `<div class="ab-out"><p>${biE("Outside our scope")}</p><ul>${items.map((it) => `<li>${CROSS}<span>${biE(it)}</span></li>`).join("")}</ul></div>`;
}

/* ------------------------------------------------------------------ Community */

const COMMUNITY_COVER = [
  "Three pairs of reading glasses on one printed review card for the public case correct-answer-wrong-reasoning-001: black acetate standing open, its lenses magnifying the student’s message “I know 3 x 4 is 12 because 3 + 4 = 7, and then I add 5 more to get 12.”; a gold wire pair and a tortoiseshell pair folded beside it. The five dimension boxes on the card are all empty.",
  "三副老花镜放在同一张打印的评审卡上，卡上是公开案例 correct-answer-wrong-reasoning-001：一副黑色板材眼镜打开立着，镜片放大了学生的话“I know 3 x 4 is 12 because 3 + 4 = 7, and then I add 5 more to get 12.”；一副金丝眼镜和一副玳瑁眼镜折起放在一旁。卡上五个维度的方框都还空着。",
];

function communityPage() {
  const steps = [["communityStepApplication", "communityStepApplicationNote"], ["communityStepManualReview", "communityStepManualReviewNote"], ["communityStepInvitation", "communityStepInvitationNote"], ["communityStepConsent", "communityStepConsentNote"], ["communityStepQualification", "communityStepQualificationNote"], ["communityStepBlindReview", "communityStepBlindReviewNote"]];
  const tasks = [["communityEcosystemRead", "communityTaskRead"], ["communityEcosystemJudge", "communityTaskJudge"], ["communityEcosystemSubmit", "communityTaskSubmit"], ["communityEcosystemQualify", "communityTaskQualify"]];
  const available = [["../data/cases/index.html", "communityAvailableCases", "communityAvailableCasesCopy"], ["../methodology/index.html", "communityAvailableMethodology", "communityAvailableMethodologyCopy"], ["../data/index.html", "communityAvailableBenchmark", "communityAvailableBenchmarkCopy"], [GITHUB, "communityAvailableRepository", "communityAvailableRepositoryCopy"]];
  const closed = [["communityStatusInfo", "communityStatusInfoValue", "communityStatusInfoValue", "open"], ["communityStatusIntake", "communityNotOpenApplicationsCopy", "communityStatusIntakeValue", "pending"], ["communityStatusCampaign", "communityNotOpenCampaignCopy", "communityStatusCampaignValue", "planned"], ["communityStatusCalibration", "communityNotOpenCalibrationCopy", "communityStatusCalibrationValue", "planned"]];
  const neq = [["communityEvidenceFirst", "communityEvidenceFirstCopy"], ["communityEvidenceAgreement", "communityEvidenceAgreementCopy"], ["communityEvidenceQualification", "communityEvidenceQualificationCopy"], ["communityEvidenceGold", "communityEvidenceGoldCopy"]];
  const principles = [["communityPrincipleEvidence", "communityPrincipleEvidenceCopy"], ["communityPrincipleMethods", "communityPrincipleMethodsCopy"], ["communityPrincipleContext", "communityPrincipleContextCopy"], ["communityPrinciplePerspectives", "communityPrinciplePerspectivesCopy"]];
  const neqTitle = (key) => {
    const [en, zh] = [siteText("en", key), siteText("zh-CN", key)];
    const mark = (s) => esc(s).replace(" ≠ ", " <i>≠</i> ");
    return bi(mark(en), mark(zh));
  };
  const contract = ["communityApplicationContact", "communityApplicationLocale", "communityApplicationMotivation", "communityApplicationExperience", "communityApplicationAvailability"];
  const body = `<main id="main" class="cm">
  <header class="essay-head cm-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${T("community")}</span><span class="rule" aria-hidden="true"></span><span>${T("communityEcosystemCenter")}</span></p>
        <h1 class="essay-title" id="community-title">${T("communityHeroTitle")} <em>${T("communityHeroTitleAccent")}</em></h1>
        ${TP("p", "ab-lede", "communityHeroDescription")}
        <p class="cx-actions"><a class="cta cta-ink" href="#community-process">${T("communityHeroPrimary")} ${ARROW}</a><a class="cta cta-line" href="../methodology/index.html">${T("communityHeroSecondary")}</a></p>
        <p class="cm-status" role="status"><strong>${T("communityParticipationClosed")}</strong><span>${T("communityHeroStatusDetail")}</span></p>
      </div>
      <figure class="cover-plate">
        <img src="../assets/community/glasses.webp" alt="${esc(COMMUNITY_COVER[0])}" width="900" height="1100" data-alt-en="${esc(COMMUNITY_COVER[0])}" data-alt-zh="${esc(COMMUNITY_COVER[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(`${esc(siteText("en", "communityEcosystemNoteOne"))} ${esc(siteText("en", "communityEcosystemNoteTwo"))}`, `${esc(siteText("zh-CN", "communityEcosystemNoteOne"))}${esc(siteText("zh-CN", "communityEcosystemNoteTwo"))}`)}</figcaption>
      </figure>
    </div>
  </header>

  <section class="wrap ab-row" aria-labelledby="community-why-title">
    <div>
      <p class="kicker">${T("communityWhyEyebrow")}</p>
      <p class="ab-side-note">${bi(`${esc(siteText("en", "communityEcosystemNoteOne"))}<br><em>${esc(siteText("en", "communityEcosystemNoteTwo"))}</em>`, `${esc(siteText("zh-CN", "communityEcosystemNoteOne"))}<br><em>${esc(siteText("zh-CN", "communityEcosystemNoteTwo"))}</em>`)}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-why-title">${T("communityWhyTitle")}</h2>
      ${TP("p", "jx-p", "communityWhyCopy")}
      <ul class="cm-obs">
        ${["communityWhyDifficulty", "communityWhyNextStep", "communityWhyContext", "communityWhyTutor"].map((k) => `<li>${T(k)}</li>`).join("\n        ")}
      </ul>
      ${TP("p", "cm-note", "communityWhyEvidence")}
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="community-tasks-title">
    <div>
      <p class="kicker">${T("communityWhatEyebrow")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-tasks-title">${T("communityWhatTitle")}</h2>
      ${TP("p", "jx-p", "communityWhatCopy")}
      <div class="cm-tasks">
        ${tasks.map(([t, c], i) => `<article><span class="n">0${i + 1}</span><h3>${T(t)}</h3>${TP("p", "", c)}<span class="cm-tag">${T("communityFutureTaskLabel")}</span></article>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="community-application-title">
    <div>
      <p class="kicker">${T("communityApplicationEyebrow")}</p>
    </div>
    <div class="ab-head-grid cm-app">
      <div>
        <h2 class="jx-h2" id="community-application-title">${T("communityApplicationTitle")}</h2>
        ${TP("p", "jx-p", "communityApplicationCopy")}
      </div>
      <div class="cm-contract">
        <div class="cm-contract-top"><span class="kicker">${T("communityApplicationContractLabel")}</span><code>community-review-application</code></div>
        <ul>${contract.map((k) => `<li>${T(k)}</li>`).join("")}</ul>
        ${TP("p", "cm-closed", "communityApplicationClosedNotice")}
      </div>
    </div>
  </section>

  <section class="wrap ab-row" id="community-process" aria-labelledby="community-process-title">
    <div>
      <p class="kicker">${T("communityHowEyebrow")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-process-title">${T("communityHowTitle")}</h2>
      ${TP("p", "jx-p", "communityHowCopy")}
      <ol class="cm-steps">
        ${steps.map(([t, n], i) => `<li><span class="n">${i + 1}</span><h3>${T(t)}</h3>${TP("p", "", n)}</li>`).join("\n        ")}
      </ol>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="community-status-title">
    <div>
      <p class="kicker">${T("communityStatusEyebrow")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-status-title">${T("communityStatusTitle")}</h2>
      ${TP("p", "jx-p", "communityStatusCopy")}
      <div class="cm-ledgers">
        <section class="cm-ledger" aria-labelledby="community-available-title">
          <p class="kicker">${T("communityAvailableEyebrow")}</p>
          <h3 id="community-available-title">${T("communityAvailableTitle")}</h3>
          ${TP("p", "", "communityAvailableCopy")}
          <div class="cm-ledger-rows">
            ${available.map(([h, l, c]) => `<a class="cm-ledger-row" href="${h}"${h.startsWith("http") ? ' rel="noreferrer"' : ""}><strong>${T(l)}</strong><small>${T(c)}</small><span class="st st-open">${T("communityAvailableStatus")}</span></a>`).join("\n            ")}
          </div>
        </section>
        <section class="cm-ledger" aria-labelledby="community-not-open-title">
          <p class="kicker">${T("communityNotOpenEyebrow")}</p>
          <h3 id="community-not-open-title">${T("communityNotOpenTitle")}</h3>
          ${TP("p", "", "communityNotOpenCopy")}
          <div class="cm-ledger-rows">
            ${closed.map(([l, d, s, tone]) => `<div class="cm-ledger-row"><strong>${T(l)}</strong><small>${T(d)}</small><span class="st st-${tone}">${T(s)}</span></div>`).join("\n            ")}
          </div>
        </section>
      </div>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="community-evidence-title">
    <div>
      <p class="kicker">${T("communityEvidenceEyebrow")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-evidence-title">${T("communityEvidenceTitle")}</h2>
      ${TP("p", "jx-p", "communityEvidenceCopy")}
      <div class="cm-neq">
        ${neq.map(([t, c]) => `<article><h3>${neqTitle(t)}</h3>${TP("p", "", c)}</article>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="wrap ab-row" aria-labelledby="community-principles-title">
    <div>
      <p class="kicker">${T("communityPrinciplesEyebrow")}</p>
    </div>
    <div>
      <h2 class="jx-h2" id="community-principles-title">${T("communityPrinciplesTitle")}</h2>
      ${TP("p", "jx-p", "communityPrinciplesCopy")}
      <div class="ab-principles">
        ${principles.map(([t, c], i) => `<article><span class="n">0${i + 1}</span><h3>${T(t)}</h3>${TP("p", "", c)}</article>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="jx-close" aria-labelledby="community-closing-title">
    <div class="wrap">
      <p class="kicker fount-k">${T("communityWatchEyebrow")}</p>
      <h2 id="community-closing-title" class="jx-h2">${T("communityWatchTitle")}</h2>
      ${TP("p", "jx-p", "communityWatchCopy")}
      <p class="cx-actions"><a class="cta cta-ink" href="${GITHUB}" rel="noreferrer">${bi(esc(siteText("en", "communityWatchGitHub").replace(" ↗", "")), esc(siteText("zh-CN", "communityWatchGitHub").replace(" ↗", "")))} ${OUT_ARROW}</a><a class="cta cta-line" href="../data/index.html">${T("communityWatchHomepage")}</a><a class="text-link" href="../methodology/index.html">${T("communityWatchMethodology")} ${ARROW}</a></p>
    </div>
  </section>
</main>`;
  return frame({ prefix: "../", title: siteText("en", "communityPageTitle"), titleZh: siteText("zh-CN", "communityPageTitle"), description: siteText("en", "communityMetaDescription"), body, current: "community", css: ["journal.css", "about.css"] });
}

/* ------------------------------------------------------------------ Contact */

function contactPage() {
  const copyBtn = `<button class="ct-copy" type="button" data-copy-text="${esc(SITE_CONTACT_EMAIL)}" aria-controls="contact-email" data-idle-en="Copy" data-idle-zh="复制" data-done-en="Copied" data-done-zh="已复制" data-select-en="Selected · press Ctrl+C" data-select-zh="已选中 · 请按 Ctrl+C"><span data-copy-label aria-live="polite">Copy</span></button>`;
  const CH = [
    ["Email", "Project & collaboration", "For collaboration, research discussion, partnership questions, or longer-form project feedback.",
      `<span class="v" id="contact-email">${esc(SITE_CONTACT_EMAIL)}</span>${copyBtn}`],
    ["X", "Updates & short messages", "Follow project updates or send a short public message on X.",
      `<a class="v" href="${esc(SITE_X_URL)}" rel="noreferrer">@1Shuangyan36877</a>`],
    ["GitHub", "Issues & implementation", "Use GitHub issues for reproducible bugs, implementation questions, or repository-specific proposals.",
      `<a class="v" href="${GITHUB}/issues" rel="noreferrer">${bi("Project support", Zor("Project support", "项目支持"))}</a>`],
  ];
  const body = `<main id="main" class="ct">
  <header class="essay-head">
    <div class="wrap">
      <p class="essay-meta kicker"><span class="issue">${biE("Contact")}</span><span class="rule" aria-hidden="true"></span><span>${run(["Open project.", "Clear channels."])}</span></p>
      <div class="ab-head-grid">
        <h1 class="essay-title" id="contact-title">${bi(`Questions, collaboration, <em>or project feedback.</em>`, `${esc(Z("Questions, collaboration,"))}<em>${esc(Z("or project feedback."))}</em>`)}</h1>
        ${biPE("p", "ab-lede", "Teachometry is an open project around measurable AI tutoring behavior. Use the public channels below for project questions, research discussion, collaboration, or feedback.")}
      </div>
    </div>
  </header>

  <section class="wrap" aria-labelledby="contact-channels-title">
    <p class="kicker fount-k">${biE("Public channels")}</p>
    <h2 class="jx-h2" id="contact-channels-title">${biE("Choose the channel that fits.")}</h2>
    <div class="ct-channels">
      ${CH.map(([k, h, p, v]) => `<article class="ct-ch"><p class="kicker">${k === "X" || k === "GitHub" ? k : biE(k)}</p><div><h3>${biE(h)}</h3>${biPE("p", "", p)}</div><div class="ct-addr">${v}</div></article>`).join("\n      ")}
    </div>
  </section>

  <section class="wrap ct-bound" aria-labelledby="contact-boundary-title">
    <div>
      <p class="kicker">${biE("Project boundary")}</p>
      <h2 class="jx-h2" id="contact-boundary-title">${bi("Public project contact,<br><em>not emergency support.</em>", `${esc(Z("Public project contact,"))}<br><em>${esc(Z("not emergency support."))}</em>`)}</h2>
    </div>
    ${biPE("p", "", "These channels are for TutorBench and Teachometry project communication. They are not monitored as a crisis, safeguarding, or emergency service.")}
  </section>
</main>`;
  return frame({ prefix: "../", title: "Contact — Teachometry", titleZh: Z("Contact — Teachometry"), description: "Contact Teachometry about TutorBench, collaboration, research, or project questions.", body, current: "contact", css: ["journal.css", "about.css"], scripts: ["about.js"] });
}

/* ------------------------------------------------------------------ 404 */

function notFoundPage() {
  const body = `<main id="main" class="nf">
  <div class="wrap">
    <article class="nf-slip" aria-labelledby="not-found-title">
      <div class="nf-top kicker"><span>${bi("Erratum", "勘误")}</span><span>Teachometry · ${bi("Developer Preview", Zor("Developer Preview", "开发者预览"))}</span></div>
      <span class="nf-num" aria-hidden="true">404</span>
      <h1 id="not-found-title"><span class="visually-hidden">404 · </span>${biE("This trail doesn’t lead to a public artifact.")}</h1>
      <dl class="nf-err">
        <dt>${bi("Missing", "缺页")}</dt><dd>${biE("The page you’re looking for isn’t part of the public Teachometry site.")}</dd>
        <dt>${bi("Likely cause", "可能原因")}</dt><dd>${biE("You might have followed an outdated link or typed the address incorrectly.")}</dd>
      </dl>
      <nav class="nf-actions" ${attr2("aria-label", "Helpful public routes", "有用的公开路径")}>
        <a class="cta cta-ink" href="index.html">${biE("Return home")} ${ARROW}</a>
        <a class="cta cta-line" href="data/index.html">${biE("Explore the benchmark")}</a>
        <a class="cta cta-line" href="docs/index.html">${biE("Read the documentation")}</a>
      </nav>
    </article>
  </div>
</main>`;
  return frame({ prefix: "", title: "Page not found — Teachometry", titleZh: Z("Page not found — Teachometry"), description: "The requested page is not part of the public Teachometry site.", body, current: "404", css: ["journal.css", "about.css"] });
}

out("about/index.html", aboutPage());
out("community/index.html", communityPage());
out("contact/index.html", contactPage());
out("404.html", notFoundPage());
if (globalThis.__zmiss?.size) process.stdout.write(`missing zh:\n  ${[...globalThis.__zmiss].join("\n  ")}\n`);
process.stdout.write("about + community + contact + 404: four pages\n");
