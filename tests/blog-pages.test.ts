import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildWebsite } from "../src/cli/website-build.js";
import { renderPage } from "../src/site/html.js";
import {
  BLOG_POSTS,
  articleHeadingId,
  renderBlogIndexPage,
  renderClassroomDoesNotNeedRobotsPage,
  renderTeachingAndSupervisionPage,
  renderWhenLearningStartsToFeelLikeFailurePage,
  renderWhyTeachingDoesNotScalePage,
} from "../src/site/pages/blog.js";

test("Teachometry blog renderers keep hypotheses separate from benchmark claims", () => {
  const index = renderBlogIndexPage();
  const learningFailure = renderWhenLearningStartsToFeelLikeFailurePage();
  const classroom = renderClassroomDoesNotNeedRobotsPage();
  const teaching = renderWhyTeachingDoesNotScalePage();
  const supervision = renderTeachingAndSupervisionPage();

  assert.equal(index.route, "/blog/");
  assert.equal(learningFailure.route, "/blog/when-learning-starts-to-feel-like-failure/");
  assert.equal(classroom.route, "/blog/the-classroom-does-not-need-30-robots/");
  assert.equal(teaching.route, "/blog/why-teaching-does-not-scale/");
  assert.equal(supervision.route, "/blog/teaching-and-supervision-are-different-jobs/");

  assert.match(index.content, /Hypotheses are not benchmark results/);
  assert.match(learningFailure.content, /A classroom has to choose a starting point/);
  assert.match(learningFailure.content, /“I do not understand” should be a valid input/);
  assert.match(learningFailure.content, /A Tutor also shapes the emotional experience of learning/);
  assert.match(learningFailure.content, /blog-learning-failure-triptych\.webp/);
  assert.match(learningFailure.content, /This essay presents a product and educational hypothesis/);
  assert.match(classroom.content, /One robot still scales like one teacher/);
  assert.match(classroom.content, /A pause is an observation, not a diagnosis/);
  assert.match(classroom.content, /This essay is a product and classroom-design hypothesis/);
  assert.match(teaching.content, /The scarce resource is attention/);
  assert.match(teaching.content, /This essay is a project thesis, not a benchmark result/);
  assert.match(supervision.content, /Human authority; machine execution/);
  assert.match(supervision.content, /A research program, not a prediction/);
  assert.doesNotMatch(supervision.content, /90%.*will|will.*90%/i);

  assert.equal(articleHeadingId("Today's teacher is several jobs in one"), "todays-teacher-is-several-jobs-in-one");
  assert.match(teaching.content, /aria-label="On this page"/);
  assert.match(teaching.content, /id="the-scarce-resource-is-attention"/);
  assert.match(teaching.content, /id="why-teachometry-exists"/);
  assert.match(classroom.content, /class="article-ideas"/);
  assert.match(classroom.content, /Next article/);
  assert.doesNotMatch(classroom.content, /Previous article/);
  assert.match(teaching.content, /class="article-ideas"/);
  assert.match(teaching.content, /Next article/);
  assert.match(teaching.content, /Previous article/);
  assert.match(supervision.content, /id="instructional-autonomy-is-the-quantity-worth-measuring"/);
  assert.match(supervision.content, /class="article-progression"/);
  assert.match(supervision.content, /Previous article/);
  assert.doesNotMatch(supervision.content, /Next article/);
  assert.doesNotMatch(teaching.content, />Introduction<|>The real constraint<|>Implications<|>Open questions<|>Conclusion</);
  assert.doesNotMatch(supervision.content, />Introduction<|>The real constraint<|>Implications<|>Open questions<|>Conclusion</);
});

test("the Blog index exposes only explicit published metadata and base-path-safe links", () => {
  assert.equal(BLOG_POSTS.length, 4);
  assert.deepEqual(BLOG_POSTS.map((post) => post.route), [
    "/blog/when-learning-starts-to-feel-like-failure/",
    "/blog/the-classroom-does-not-need-30-robots/",
    "/blog/why-teaching-does-not-scale/",
    "/blog/teaching-and-supervision-are-different-jobs/",
  ]);
  assert.equal(BLOG_POSTS[0]?.publishedDate, "September 30, 2026");
  assert.equal(BLOG_POSTS[1]?.publishedDate, "September 28, 2026");
  assert.ok(BLOG_POSTS.slice(2).every((post) => post.publishedDate === "September 17, 2026"));

  const html = renderPage(renderBlogIndexPage(), { basePath: "/preview" });
  assert.match(html, /href="\/preview\/assets\/blog\.css"/);
  assert.match(html, /src="\/preview\/assets\/blog-learning-failure-hero\.webp"/);
  assert.match(html, /href="\/preview\/blog\/when-learning-starts-to-feel-like-failure\/"/);
  assert.match(html, /href="\/preview\/blog\/the-classroom-does-not-need-30-robots\/"/);
  assert.match(html, /href="\/preview\/blog\/why-teaching-does-not-scale\/"/);
  assert.match(html, /href="\/preview\/methodology\/"/);
  assert.doesNotMatch(html, /Beyond Correct Answers|Measuring What Matters|RSS feed|Subscribe|Topics/);

  const articleHtml = renderPage(renderClassroomDoesNotNeedRobotsPage(), { basePath: "/preview" });
  assert.match(articleHtml, /<body class="blog-page blog-article-page">/);
  assert.match(articleHtml, /href="\/preview\/assets\/blog\.css"/);
  assert.match(articleHtml, /href="\/preview\/assets\/home\.css"/);
  assert.match(articleHtml, /src="\/preview\/assets\/home-blog-03\.webp"/);
  assert.match(articleHtml, /href="\/preview\/blog\/why-teaching-does-not-scale\/"/);
  assert.match(articleHtml, /href="#one-robot-still-scales-like-one-teacher"/);
  assert.match(articleHtml, /aria-current="page"/);
});

test("website build publishes the Teachometry blog index and essays", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "teachometry-blog-"));
  try {
    const routeCount = await buildWebsite({
      outputDirectory,
      siteUrl: "https://teachometry.com",
    });

    // Blog pages are editorial surfaces layered onto the current benchmark route count.
    assert.equal(routeCount, 62);

    const indexHtml = await readFile(join(outputDirectory, "blog", "index.html"), "utf8");
    const learningFailureHtml = await readFile(
      join(outputDirectory, "blog", "when-learning-starts-to-feel-like-failure", "index.html"),
      "utf8",
    );
    const classroomHtml = await readFile(
      join(outputDirectory, "blog", "the-classroom-does-not-need-30-robots", "index.html"),
      "utf8",
    );
    const teachingHtml = await readFile(
      join(outputDirectory, "blog", "why-teaching-does-not-scale", "index.html"),
      "utf8",
    );
    const supervisionHtml = await readFile(
      join(outputDirectory, "blog", "teaching-and-supervision-are-different-jobs", "index.html"),
      "utf8",
    );

    assert.match(indexHtml, /Teachometry Blog/);
    assert.match(indexHtml, /When Learning Starts to Feel Like Failure/);
    assert.match(indexHtml, /The Classroom Does Not Need 30 Robots/);
    assert.match(indexHtml, /Why Teaching Does Not Scale/);
    assert.match(indexHtml, /Teaching and Supervision Are Different Jobs/);
    assert.match(
      learningFailureHtml,
      /<link rel="canonical" href="https:\/\/teachometry\.com\/blog\/when-learning-starts-to-feel-like-failure\/">/,
    );
    assert.match(learningFailureHtml, /blog-learning-failure-hero\.webp/);
    assert.match(learningFailureHtml, /blog-learning-failure-triptych\.webp/);
    assert.match(learningFailureHtml, /The goal is not dependence on the Tutor/);
    assert.match(
      classroomHtml,
      /<link rel="canonical" href="https:\/\/teachometry\.com\/blog\/the-classroom-does-not-need-30-robots\/">/,
    );
    assert.match(classroomHtml, /Record events instead of asking AI to guess them/);
    assert.match(classroomHtml, /Let homework be learning and move verification into class/);
    assert.match(classroomHtml, /Next article/);
    assert.doesNotMatch(classroomHtml, /Previous article/);
    assert.match(
      teachingHtml,
      /<link rel="canonical" href="https:\/\/teachometry\.com\/blog\/why-teaching-does-not-scale\/">/,
    );
    assert.match(teachingHtml, /<body class="blog-page blog-article-page">/);
    assert.match(teachingHtml, /class="home-footer"/);
    assert.match(teachingHtml, /home-blog-01\.webp/);
    assert.match(teachingHtml, /Why Teachometry exists/);
    assert.match(teachingHtml, /Next article/);
    assert.match(supervisionHtml, /Instructional autonomy is the quantity worth measuring/);
    assert.match(supervisionHtml, /home-blog-02\.webp/);
    assert.match(supervisionHtml, /Previous article/);
    assert.doesNotMatch(supervisionHtml, /Next article/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
