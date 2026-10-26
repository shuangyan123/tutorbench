// Builds the Micro-Review page of the Spectrum prototype (micro-review/index.html), in English and
// 简体中文 on one page. It mirrors renderMicroReviewPage (src/site/pages/micro-review.ts) and keeps
// everything the live demo does and promises: one constructed conversation, three choices, a short
// analysis shown only after a choice, nothing sent or saved, and the same exits (contact, Reviewer
// plan, Run, Methodology). The script that drives it is micro.js, a port of the live micro-review.js.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-micro.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, esc, Z, Zor, bi, biE, biPE, frame } from "./site-kit.mjs";

const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
/** a math expression read aloud in the page's language */
const math = (text, en, zh, cls = "") => `<span class="en${cls}" role="math" aria-label="${esc(en)}">${text}</span><span class="zh${cls}" lang="zh-CN" role="math" aria-label="${esc(zh)}">${text}</span>`;
/** a stacked fraction */
const fr = (n, d) => `<span class="mr-frac"><span>${n}</span><span>${d}</span></span>`;

const COVER = {
  file: "selector.webp",
  alt: ["A selector knob cut from citrine, set in a knurled steel collar on a blue instrument panel. Its three positions read Basically suitable, Has a teaching problem and Not sure; the pointer rests on an unmarked ring, before any choice.",
    "一枚黄水晶切割的选择旋钮，嵌在滚花钢圈里，装在蓝色仪器面板上。三个档位写着“基本合适”“存在教学问题”“不确定”；指针停在一个空白小圆圈上，还没有做出选择。"],
  cap: ["The pointer rests: no judgment yet.", "指针停在原位：还没有判断。"],
};

const OPTIONS = [["suitable", "Basically suitable"], ["problem", "Has a teaching problem"], ["unsure", "Not sure"]];

function page() {
  const body = `<main id="main" class="mr">
  <header class="essay-head mr-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("Micro-Review")}</span><span class="rule" aria-hidden="true"></span><span>${bi("≈ 60 s", "约 60 秒")}</span></p>
        <h1 class="essay-title">${bi("Would this help a student <em>learn?</em>", "这样的回复，能帮助学生<em>学习</em>吗？")}</h1>
        ${biPE("p", "essay-dek", "One conversation. One judgment. About 60 seconds.")}
        <p class="mr-meta">${biE("No account. No installation. No personal details.")}</p>
      </div>
      <figure class="cover-plate">
        <img src="../assets/micro/${COVER.file}" alt="${esc(COVER.alt[0])}" width="900" height="1100" data-alt-en="${esc(COVER.alt[0])}" data-alt-zh="${esc(COVER.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc(COVER.cap[0]), esc(COVER.cap[1]))}</figcaption>
      </figure>
    </div>
  </header>

  <div class="wrap mr-desk">
    <section class="mr-read" aria-labelledby="micro-review-example-title">
      <p class="kicker mr-step"><span class="mr-n">1</span>${bi("The conversation", "对话")}</p>
      <h2 id="micro-review-example-title" class="mr-h2">${biE("Read the conversation")}</h2>
      <p class="mr-prov">${biE("Constructed example · not a real model output")}</p>
      <ol class="mr-transcript">
        <li class="mr-turn">
          <p class="mr-who"><span class="mr-t">T1</span>${biE("Student")}</p>
          <p class="mr-said">${bi(`I think <span class="mr-sum" role="math" aria-label="one third plus one quarter equals two sevenths">1/3 + 1/4 = 2/7</span>. I added the top numbers and the bottom numbers. Is that right?`,
            `${esc(Z("I think"))} <span class="mr-sum" role="math" aria-label="${esc(Zor("one third plus one quarter equals two sevenths", "三分之一加四分之一等于七分之二"))}">1/3 + 1/4 = 2/7</span>。${esc(Zor("I added the top numbers and the bottom numbers. Is that right?", "我把分子相加，分母也相加。这样对吗？"))}`)}</p>
        </li>
        <li class="mr-turn mr-ai">
          <p class="mr-who"><span class="mr-t">T2</span>${biE("AI tutor · constructed reply")}</p>
          <p class="mr-said">${biE("Yes, that's right! Adding the top numbers and the bottom numbers is how you add fractions. You understand it well.")}</p>
        </li>
      </ol>
    </section>

    <section class="mr-judge" aria-labelledby="mr-judge-label">
      <p class="kicker mr-step" id="mr-judge-label"><span class="mr-n">2</span>${bi("Your teaching judgment", "你的教学判断")}</p>
      <p class="mr-unavailable" data-micro-review-unavailable>${biE("Enable JavaScript to choose a judgment and see the analysis. No sign-in is needed.")}</p>
      <form data-micro-review-form aria-describedby="micro-review-choice-help" hidden>
        <fieldset>
          <legend class="mr-h2">${biE("How suitable is the AI reply for teaching?")}</legend>
          <p id="micro-review-choice-help" class="mr-help">${biE("Choose one, then see a short analysis.")}</p>
          <div class="mr-options">
            ${OPTIONS.map(([v, l], i) => `<label class="mr-opt"><input type="radio" name="judgment" value="${v}" required><span class="mr-dial" aria-hidden="true">${"ABC"[i]}</span><span class="mr-opt-l">${biE(l)}</span></label>`).join("\n            ")}
          </div>
        </fieldset>
        <button class="cta cta-ink mr-submit" type="submit">${biE("See the analysis")} ${ARROW}</button>
      </form>
      <p class="mr-status" data-micro-review-status role="status"></p>
      <span data-micro-review-complete-message hidden>${biE("Your judgment is shown above. It has not been sent or saved.")}</span>
    </section>
  </div>

  <section class="mr-result" data-micro-review-result aria-labelledby="micro-review-analysis-title" hidden>
    <div class="wrap mr-result-in">
      <div class="mr-analysis">
        <p class="kicker mr-step"><span class="mr-n">3</span>${biE("A closer look")}</p>
        <h2 id="micro-review-analysis-title" class="jx-h2" tabindex="-1">${biE("There is a teaching problem.")}</h2>
        ${biPE("p", "jx-p", "The reply praises a misconception instead of helping the student check it. Fractions need a common denominator before adding:")}
        <p class="mr-equation">${math(`${fr(1, 3)}<i>+</i>${fr(1, 4)}<i>=</i>${fr(4, 12)}<i>+</i>${fr(3, 12)}<i>=</i>${fr(7, 12)}`, "one third plus one quarter equals four twelfths plus three twelfths equals seven twelfths", Zor("one third plus one quarter equals four twelfths plus three twelfths equals seven twelfths", "三分之一加四分之一，等于十二分之四加十二分之三，等于十二分之七"))}</p>
        <div class="mr-strip" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i class="${i < 4 ? "a" : i < 7 ? "b" : ""}"></i>`).join("")}</div>
        ${biPE("p", "jx-p", "A better next step: ask the student to imagine one whole split into 12 equal pieces. How many pieces are one third and one quarter? Then guide them to add 4 and 3.")}
        ${biPE("p", "mr-editorial", "This is an explanation written for the demo, not an expert review or a score of you or a model.")}
      </div>
      <aside class="callout mr-invite" aria-labelledby="micro-review-invitation-title">
        <h3 id="micro-review-invitation-title">${biE("Curious about independent review?")}</h3>
        ${biPE("p", "", "Future independent Reviewers would examine AI teaching with shared criteria. You can stop here, or voluntarily learn about the plan.")}
        ${biPE("p", "", "Teachers, education researchers, and others in education are welcome to contact us. For now, we are only discussing interest in participating.")}
        <p class="cx-actions"><a class="cta cta-ink" data-micro-review-contact-link href="../contact/index.html">${biE("Contact the project")} ${ARROW}</a><a class="cta cta-line" data-micro-review-reviewer-link href="../community/index.html#community-process">${biE("Explore the Reviewer plan")}</a></p>
        ${biPE("p", "mr-fine", "Formal Reviewer applications are not open yet. This demo does not enroll you.")}
      </aside>
    </div>
  </section>

  <div class="mr-boundary">
    <div class="wrap mr-boundary-in">
      ${biPE("p", "", "Your choice stays on this page. It is not sent to a server or saved. Reloading starts over.")}
      ${biPE("p", "", "This public demo is separate from Expert Review, benchmark results, and validity research.")}
    </div>
  </div>

  <nav class="wrap mr-next" aria-labelledby="micro-review-next-title">
    <h2 id="micro-review-next-title" class="mr-h2">${biE("Where to go next")}</h2>
    <ul>
      <li><a href="../index.html#reproduce" data-micro-review-run-link><b>${biE("Run a real evaluation with TutorBench")}</b>${biPE("span", "", "Evaluate your own AI Tutor on your machine. Requires the repository and Node.js.")}${ARROW}</a></li>
      <li><a href="../methodology/index.html" data-micro-review-methodology-link><b>${biE("Read the Methodology")}</b>${biPE("span", "", "How formal TutorBench evaluations are designed and scored.")}${ARROW}</a></li>
    </ul>
  </nav>
</main>`;
  return frame({ prefix: "../", title: "Micro-Review — Teachometry", titleZh: Z("Micro-Review — Teachometry"), description: "Try one AI teaching judgment in about 60 seconds. A constructed example, no account or installation needed.", body, current: "micro", css: ["journal.css", "micro.css"], scripts: ["micro.js"] });
}

const out = (rel, html) => { const f = join(PROTO, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, html); };
out("micro-review/index.html", page());
if (globalThis.__zmiss?.size) process.stdout.write(`missing zh:\n  ${[...globalThis.__zmiss].join("\n  ")}\n`);
process.stdout.write("micro-review: one page\n");
