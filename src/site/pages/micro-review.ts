import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import { type SitePage } from "../html.js";
import { renderTeachometryFooter } from "./home.js";

/** 构造体验仅属于网站展示层，不创建 Case、Expert Review 或评测结果。 */
export function renderMicroReviewPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return {
    title: "Micro-Review — Teachometry",
    description: "Try one AI teaching judgment in about 60 seconds. A constructed example, no account or installation needed.",
    route: "/micro-review/",
    content: `<div class="shell micro-review">
      <header class="micro-review-intro">
        <p class="eyebrow">Micro-Review</p>
        <h1>Would this help a student learn?</h1>
        <p>One conversation. One judgment. About 60 seconds.</p>
        <p class="micro-review-meta">No account. No installation. No personal details.</p>
      </header>
      <div class="micro-review-grid">
        <section aria-labelledby="micro-review-example-title">
          <h2 id="micro-review-example-title">Read the conversation</h2>
          <p class="micro-review-provenance">Constructed example · not a real model output</p>
          <div class="micro-review-conversation">
            <div>
              <h3>Student</h3>
              <p>I think <span role="math" aria-label="one third plus one quarter equals two sevenths">1/3 + 1/4 = 2/7</span>. I added the top numbers and the bottom numbers. Is that right?</p>
            </div>
            <div>
              <h3>AI tutor · constructed reply</h3>
              <p>Yes, that's right! Adding the top numbers and the bottom numbers is how you add fractions. You understand it well.</p>
            </div>
          </div>
        </section>
        <section aria-label="Your teaching judgment">
          <p data-micro-review-unavailable>Enable JavaScript to choose a judgment and see the analysis. No sign-in is needed.</p>
          <form data-micro-review-form aria-describedby="micro-review-choice-help" hidden>
            <fieldset>
              <legend>How suitable is the AI reply for teaching?</legend>
              <p id="micro-review-choice-help">Choose one, then see a short analysis.</p>
              <div class="micro-review-options">
                <label><input type="radio" name="judgment" value="suitable" required><span>Basically suitable</span></label>
                <label><input type="radio" name="judgment" value="problem" required><span>Has a teaching problem</span></label>
                <label><input type="radio" name="judgment" value="unsure" required><span>Not sure</span></label>
              </div>
            </fieldset>
            <button class="button button-primary" type="submit">See the analysis</button>
          </form>
          <p class="micro-review-status" data-micro-review-status role="status"></p>
          <span data-micro-review-complete-message hidden>Your judgment is shown above. It has not been sent or saved.</span>
        </section>
      </div>
      <section class="micro-review-result" data-micro-review-result aria-labelledby="micro-review-analysis-title" hidden>
        <p class="eyebrow">A closer look</p>
        <h2 id="micro-review-analysis-title" tabindex="-1">There is a teaching problem.</h2>
        <p>The reply praises a misconception instead of helping the student check it. Fractions need a common denominator before adding:</p>
        <p class="micro-review-equation" role="math" aria-label="one third plus one quarter equals four twelfths plus three twelfths equals seven twelfths">1/3 + 1/4 = 4/12 + 3/12 = 7/12</p>
        <p>A better next step: ask the student to imagine one whole split into 12 equal pieces. How many pieces are one third and one quarter? Then guide them to add 4 and 3.</p>
        <p class="micro-review-editorial">This is an explanation written for the demo, not an expert review or a score of you or a model.</p>
        <aside class="micro-review-invitation" aria-labelledby="micro-review-invitation-title">
          <h3 id="micro-review-invitation-title">Curious about independent review?</h3>
          <p>Future independent Reviewers would examine AI teaching with shared criteria. You can stop here, or voluntarily learn about the plan.</p>
          <p>Teachers, education researchers, and others in education are welcome to contact us. For now, we are only discussing interest in participating.</p>
          <div class="button-row">
            <a class="button button-primary" data-micro-review-contact-link href="/contact/">Contact the project</a>
            <a class="button button-secondary" data-micro-review-reviewer-link href="/community/#community-process">Explore the Reviewer plan</a>
          </div>
          <p class="micro-review-meta">Formal Reviewer applications are not open yet. This demo does not enroll you.</p>
        </aside>
      </section>
      <div class="micro-review-boundary">
        <p>Your choice stays on this page. It is not sent to a server or saved. Reloading starts over.</p>
        <p>This public demo is separate from Expert Review, benchmark results, and validity research.</p>
      </div>
    </div>
    ${renderTeachometryFooter(artifacts)}`,
  };
}
