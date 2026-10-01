import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import {
  escapeHtml,
  SITE_CONTACT_EMAIL,
  SITE_X_URL,
  type SitePage,
} from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachometryFooter } from "./home.js";

export function renderContactPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return {
    title: "Contact — Teachometry",
    description: "Contact Teachometry about TutorBench, collaboration, research, or project questions.",
    route: "/contact/",
    content: `<div class="contact-page-content">
      <section class="contact-hero" aria-labelledby="contact-title">
        <div class="shell contact-hero-grid">
          <div>
            <p class="eyebrow">Contact</p>
            <h1 id="contact-title">Questions, collaboration,<br><em>or project feedback.</em></h1>
            <p class="contact-lede">Teachometry is an open project around measurable AI tutoring behavior. Use the public channels below for project questions, research discussion, collaboration, or feedback.</p>
          </div>
          <div class="contact-note" aria-hidden="true">
            <span>Open project.<br>Clear channels.</span>
          </div>
        </div>
      </section>
      <section class="contact-channels" aria-labelledby="contact-channels-title">
        <div class="shell">
          <div class="contact-heading">
            <p class="eyebrow">Public channels</p>
            <h2 id="contact-channels-title">Choose the channel that fits.</h2>
          </div>
          <div class="contact-grid">
            <article>
              <span class="contact-icon">${icon("user")}</span>
              <p class="contact-label">Email</p>
              <h3>Project &amp; collaboration</h3>
              <p>For collaboration, research discussion, partnership questions, or longer-form project feedback.</p>
              <a href="mailto:${escapeHtml(SITE_CONTACT_EMAIL)}">${escapeHtml(SITE_CONTACT_EMAIL)} ${icon("arrow")}</a>
            </article>
            <article>
              <span class="contact-icon contact-icon-x"><img src="/assets/x-logo.svg" width="18" height="18" alt=""></span>
              <p class="contact-label">X</p>
              <h3>Updates &amp; short messages</h3>
              <p>Follow project updates or send a short public message on X.</p>
              <a href="${escapeHtml(SITE_X_URL)}" rel="noreferrer">@1Shuangyan36877 ${icon("arrow")}</a>
            </article>
            <article>
              <span class="contact-icon">${icon("github")}</span>
              <p class="contact-label">GitHub</p>
              <h3>Issues &amp; implementation</h3>
              <p>Use GitHub issues for reproducible bugs, implementation questions, or repository-specific proposals.</p>
              <a href="https://github.com/shuangyan123/tutorbench/issues" rel="noreferrer">Project support ${icon("arrow")}</a>
            </article>
          </div>
        </div>
      </section>
      <section class="contact-boundary">
        <div class="shell contact-boundary-grid">
          <div><p class="eyebrow">Project boundary</p><h2>Public project contact,<br><em>not emergency support.</em></h2></div>
          <p>These channels are for TutorBench and Teachometry project communication. They are not monitored as a crisis, safeguarding, or emergency service.</p>
        </div>
      </section>
      ${renderTeachometryFooter(artifacts)}
    </div>`,
  };
}
