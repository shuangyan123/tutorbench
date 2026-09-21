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
  renderTeachingAndSupervisionPage,
  renderWhyTeachingDoesNotScalePage,
} from "../src/site/pages/blog.js";

test("Teachometry blog renderers keep hypotheses separate from benchmark claims", () => {
  const index = renderBlogIndexPage();
  const teaching = renderWhyTeachingDoesNotScalePage();
  const supervision = renderTeachingAndSupervisionPage();

  assert.equal(index.route, "/blog/");
  assert.equal(teaching.route, "/blog/why-teaching-does-not-scale/");
  assert.equal(supervision.route, "/blog/teaching-and-supervision-are-different-jobs/");

  assert.match(index.content, /Hypotheses are not benchmark results/);
  assert.match(teaching.content, /The scarce resource is attention/);
  assert.match(teaching.content, /This essay is a project thesis, not a benchmark result/);
  assert.match(supervision.content, /Human authority; machine execution/);
  assert.match(supervision.content, /A research program, not a prediction/);
  assert.doesNotMatch(supervision.content, /90%.*will|will.*90%/i);

  assert.equal(articleHeadingId("Today's teacher is several jobs in one"), "todays-teacher-is-several-jobs-in-one");
  assert.match(teaching.content, /aria-label="On this page"/);
  assert.match(teaching.content, /id="the-scarce-resource-is-attention"/);
  assert.match(teaching.content, /id="why-teachometry-exists"/);
  assert.match(teaching.content, /class="article-ideas"/);
  assert.match(teaching.content, /Next article/);
  assert.doesNotMatch(teaching.content, /Previous article/);
  assert.match(supervision.content, /id="instructional-autonomy-is-the-quantity-worth-measuring"/);
  assert.match(supervision.content, /class="article-progression"/);
  assert.match(supervision.content, /Previous article/);
  assert.doesNotMatch(supervision.content, /Next article/);
  assert.doesNotMatch(teaching.content, />Introduction<|>The real constraint<|>Implications<|>Open questions<|>Conclusion</);
  assert.doesNotMatch(supervision.content, />Introduction<|>The real constraint<|>Implications<|>Open questions<|>Conclusion</);
});

test("the Blog index exposes only explicit published metadata and base-path-safe links", () => {
  assert.equal(BLOG_POSTS.length, 2);
  assert.deepEqual(BLOG_POSTS.map((post) => post.route), [
    "/blog/why-teaching-does-not-scale/",
    "/blog/teaching-and-supervision-are-different-jobs/",
  ]);
  assert.ok(BLOG_POSTS.every((post) => post.publishedDate === "September 17, 2026"));

  const html = renderPage(renderBlogIndexPage(), { basePath: "/preview" });
  assert.match(html, /href="\/preview\/assets\/blog\.css"/);
  assert.match(html, /src="\/preview\/assets\/home-blog-01\.webp"/);
  assert.match(html, /href="\/preview\/blog\/why-teaching-does-not-scale\/"/);
  assert.match(html, /href="\/preview\/methodology\/"/);
  assert.doesNotMatch(html, /Beyond Correct Answers|Measuring What Matters|RSS feed|Subscribe|Topics/);

  const articleHtml = renderPage(renderWhyTeachingDoesNotScalePage(), { basePath: "/preview" });
  assert.match(articleHtml, /<body class="blog-page blog-article-page">/);
  assert.match(articleHtml, /href="\/preview\/assets\/blog\.css"/);
  assert.match(articleHtml, /href="\/preview\/assets\/home\.css"/);
  assert.match(articleHtml, /src="\/preview\/assets\/home-blog-01\.webp"/);
  assert.match(articleHtml, /href="\/preview\/blog\/teaching-and-supervision-are-different-jobs\/"/);
  assert.match(articleHtml, /href="#the-scarce-resource-is-attention"/);
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
    const teachingHtml = await readFile(
      join(outputDirectory, "blog", "why-teaching-does-not-scale", "index.html"),
      "utf8",
    );
    const supervisionHtml = await readFile(
      join(outputDirectory, "blog", "teaching-and-supervision-are-different-jobs", "index.html"),
      "utf8",
    );

    assert.match(indexHtml, /Teachometry Blog/);
    assert.match(indexHtml, /Why Teaching Does Not Scale/);
    assert.match(indexHtml, /Teaching and Supervision Are Different Jobs/);
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
