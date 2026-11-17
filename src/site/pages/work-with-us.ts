import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import { escapeHtml, SITE_CONTACT_EMAIL, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachometryFooter } from "./home.js";

/**
 * Work with us: how teams can work with Teachometry. AI education evaluation leads; research and
 * advisory follow; engineering work is a short, selective aside. There are no prices, no
 * purchase and no form: the only way in is an email, and every engagement is scoped and agreed in
 * writing first. The independence rules and the TutorBench limits stay on the page.
 *
 * The English copy lives here and its Chinese in SITE_ZH_CN_COPY; the published page
 * (website/prototypes/spectrum/tools/build-about.mjs) is set from this same copy.
 */
export const WORK_WITH_US = {
  title: "Work with us — Teachometry",
  description: "Work with Teachometry on AI education evaluation, research and advisory, and selected engineering projects. Scope, deliverables and fees are agreed for each project.",
  nav: "Work with us",
  hero: {
    line: "Evaluation first. Selected collaborations.",
    titleLead: "See how your AI tutor",
    titleAccent: "actually teaches.",
    lede: "Teachometry builds tools to understand and improve AI teaching quality. We also collaborate with teams on evaluation, technical research, advisory work, and selected engineering projects.",
    primary: "Discuss a project",
    secondary: "How we work",
    mailSubject: "Project enquiry",
  },
  cover: {
    caption: "Made to measure: a paper pattern pinned to wool, a tailor’s tape laid across it, five pins in the colours of the five dimensions. An evaluation is cut to the product in front of it.",
    alt: "A paper pattern piece for the front of a bodice, drafted in pencil on white dot-and-cross pattern paper, lies on periwinkle wool twill. A yellow tailor’s tape measure runs from its brass end along the hem, off the paper and up in a half twist. Three glass-headed pins hold the side seam and two lie loose on the paper; the five heads are ruby, citrine, emerald, sapphire and amethyst.",
  },
  what: {
    kicker: "What we do",
    title: "Evaluation first.",
    intro: "AI education evaluation is the core of our work. Research and advisory grow out of it, and engineering projects are taken on selectively.",
    core: {
      label: "Core",
      title: "AI education evaluation",
      audience: "For teams building AI tutors and AI education products, education technology companies, and research groups.",
      items: [
        ["Teaching-quality evaluation and independent review", "How your AI tutor behaves with learners, observed across structured cases. We can also act as an independent reviewer of its teaching."],
        ["Custom scenarios and evaluation criteria", "Scenarios built around your subject, your learners and your product, with the criteria agreed before any results are seen."],
        ["Diagnosis, evidence reports and regression tests", "Where the teaching goes wrong, shown case by case with the evidence, then kept as tests you can run again after every change."],
        ["Product-quality research and evaluation partnerships", "Longer studies of the quality of AI education products, carried out together with your team."],
      ],
    },
    advisory: {
      label: "Collaboration",
      title: "Research & advisory",
      text: "AI system evaluation, technical research, product-quality advice, prototype validation, research collaboration, and ongoing advisory work.",
    },
    engineering: {
      label: "Supplementary",
      title: "Selected engineering work",
      text: "We take on a small number of remote software projects: API integrations, AI tools, automation and technical delivery. This work helps fund the research, so we only accept what leaves room for it.",
    },
    open: "Not sure where your question fits? Bring it as it is. Working out the scope together is part of the work.",
  },
  how: {
    kicker: "How we work",
    title: "From a first conversation to delivery.",
    intro: "Every engagement is scoped with you and agreed in writing before work starts.",
    steps: [
      ["Discuss", "You tell us what you are building and what you need to know. We ask questions until the problem is clear."],
      ["Scope", "Together we settle the scope, the deliverables, the timeline and the fee."],
      ["Agreement", "The terms are put in writing and agreed by both sides before any work begins."],
      ["Delivery", "We carry out the work as agreed and hand over what was promised, with the evidence behind it."],
    ],
    formsLabel: "Forms of engagement",
    forms: [
      ["By project", "One defined piece of work with a fixed scope."],
      ["In milestones", "Larger work in stages, each one agreed and delivered in turn."],
      ["Ongoing advisory", "Regular advice over a longer period."],
    ],
    formsNote: "Which of these we can offer depends on the work and on our capacity at the time; not every form is always available.",
    pricing: "We don’t publish fixed prices, and nothing is sold online. Fees are agreed for each piece of work.",
  },
  independence: {
    kicker: "Independence and boundaries",
    titleLead: "Fees pay for the work,",
    titleAccent: "not for the findings.",
    intro: "These rules apply to every engagement, whoever it is with.",
    items: [
      ["Findings are not for sale.", "Independent research and public results are never tied to sponsorship or consulting fees. An evaluation reports what the evidence shows, whoever pays for it."],
      ["Two roles, kept apart.", "Evaluating a product independently and helping to build it are different roles, and they can conflict. We say up front which role we are in, and if we have helped build something, we say so before we evaluate it."],
      ["TutorBench stays whole.", "An engagement does not transfer the intellectual property of TutorBench as a whole. What each project delivers, and who owns it, is set out in the agreement."],
      ["Honest about the instrument.", "TutorBench is a Developer Preview. Its results are not yet calibrated, and it cannot show that learners learn more. No report of ours will claim otherwise."],
    ],
    link: "Read the methodology and its limits",
  },
  discuss: {
    kicker: "Discuss a project",
    title: "Tell us what you are building.",
    firstEmail: "A useful first email covers",
    checklist: [
      "what your product does, and who its learners are",
      "the question you want answered",
      "any timeline or budget you already have in mind",
      "constraints such as data, privacy, or who will see the results",
    ],
    dataNote: "Please don’t send real learner data or private transcripts in a first email. How data is handled is agreed before any of it is shared.",
    other: "Other ways to reach us",
  },
} as const;

export const WORK_WITH_US_ROUTE = "/work-with-us/";

/** The address the page's buttons open, with a subject line in the page's language. */
export function workWithUsMailto(subject: string): string {
  return `mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function renderWorkWithUsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const c = WORK_WITH_US;
  const e = escapeHtml;
  const mailto = e(workWithUsMailto(c.hero.mailSubject));
  return {
    title: c.title,
    description: c.description,
    route: WORK_WITH_US_ROUTE,
    content: `<div class="contact-page-content work-page-content">
      <section class="contact-hero" aria-labelledby="work-title">
        <div class="shell contact-hero-grid">
          <div>
            <p class="eyebrow">${e(c.nav)}</p>
            <h1 id="work-title">${e(c.hero.titleLead)}<br><em>${e(c.hero.titleAccent)}</em></h1>
            <p class="contact-lede">${e(c.hero.lede)}</p>
            <p><a class="button button-primary" href="${mailto}">${e(c.hero.primary)} ${icon("arrow")}</a> <a class="text-link" href="#work-how">${e(c.hero.secondary)}</a></p>
          </div>
          <div class="contact-note" aria-hidden="true"><span>${e(c.hero.line)}</span></div>
        </div>
      </section>
      <section class="contact-channels" aria-labelledby="work-what-title">
        <div class="shell">
          <div class="contact-heading">
            <p class="eyebrow">${e(c.what.kicker)}</p>
            <h2 id="work-what-title">${e(c.what.title)}</h2>
            <p>${e(c.what.intro)}</p>
          </div>
          <div class="contact-grid">
            <article>
              <p class="contact-label">${e(c.what.core.label)}</p>
              <h3>${e(c.what.core.title)}</h3>
              <p>${e(c.what.core.audience)}</p>
              <ol>${c.what.core.items.map(([title, text]) => `<li><strong>${e(title)}</strong><br>${e(text)}</li>`).join("")}</ol>
            </article>
            <article>
              <p class="contact-label">${e(c.what.advisory.label)}</p>
              <h3>${e(c.what.advisory.title)}</h3>
              <p>${e(c.what.advisory.text)}</p>
            </article>
            <article>
              <p class="contact-label">${e(c.what.engineering.label)}</p>
              <h3>${e(c.what.engineering.title)}</h3>
              <p>${e(c.what.engineering.text)}</p>
            </article>
          </div>
          <p>${e(c.what.open)}</p>
        </div>
      </section>
      <section class="contact-channels" id="work-how" aria-labelledby="work-how-title">
        <div class="shell">
          <div class="contact-heading">
            <p class="eyebrow">${e(c.how.kicker)}</p>
            <h2 id="work-how-title">${e(c.how.title)}</h2>
            <p>${e(c.how.intro)}</p>
          </div>
          <ol>${c.how.steps.map(([name, text]) => `<li><strong>${e(name)}</strong><br>${e(text)}</li>`).join("")}</ol>
          <h3>${e(c.how.formsLabel)}</h3>
          <dl>${c.how.forms.map(([name, text]) => `<dt>${e(name)}</dt><dd>${e(text)}</dd>`).join("")}</dl>
          <p>${e(c.how.formsNote)}</p>
          <p>${e(c.how.pricing)}</p>
        </div>
      </section>
      <section class="contact-boundary" aria-labelledby="work-independence-title">
        <div class="shell contact-boundary-grid">
          <div><p class="eyebrow">${e(c.independence.kicker)}</p><h2 id="work-independence-title">${e(c.independence.titleLead)}<br><em>${e(c.independence.titleAccent)}</em></h2></div>
          <div>
            <p>${e(c.independence.intro)}</p>
            <ol>${c.independence.items.map(([title, text]) => `<li><strong>${e(title)}</strong><br>${e(text)}</li>`).join("")}</ol>
            <p><a class="text-link" href="/methodology/">${e(c.independence.link)} ${icon("arrow")}</a></p>
          </div>
        </div>
      </section>
      <section class="contact-boundary" aria-labelledby="work-discuss-title">
        <div class="shell contact-boundary-grid">
          <div><p class="eyebrow">${e(c.discuss.kicker)}</p><h2 id="work-discuss-title">${e(c.discuss.title)}</h2></div>
          <div>
            <p><a href="${mailto}">${e(SITE_CONTACT_EMAIL)} ${icon("arrow")}</a></p>
            <p>${e(c.discuss.firstEmail)}</p>
            <ul>${c.discuss.checklist.map((item) => `<li>${e(item)}</li>`).join("")}</ul>
            <p>${e(c.discuss.dataNote)}</p>
            <p><a class="text-link" href="/contact/">${e(c.discuss.other)} ${icon("arrow")}</a></p>
          </div>
        </div>
      </section>
      ${renderTeachometryFooter(artifacts)}
    </div>`,
  };
}
