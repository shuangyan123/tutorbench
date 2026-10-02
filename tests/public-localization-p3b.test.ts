import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset } from "../src/datasets/index.js";
import type { SiteLocale } from "../src/site/i18n.js";

let output: string;
const deployments = [
  { directory: "root", url: "https://teachometry.com", basePath: "" },
  { directory: "project", url: "https://example.test/tutorbench", basePath: "/tutorbench" },
] as const;
const routes = [
  "/blog/teaching-and-supervision-are-different-jobs/",
  "/blog/when-learning-starts-to-feel-like-failure/",
  "/community/",
] as const;

before(async () => {
  output = await mkdtemp(join(tmpdir(), "tutorbench-localization-p3b-"));
  for (const deployment of deployments) {
    await buildWebsite({ outputDirectory: join(output, deployment.directory), siteUrl: deployment.url, basePath: deployment.basePath });
  }
});
after(async () => { if (output !== undefined) await rm(output, { recursive: true, force: true }); });

function html(route: string, locale: SiteLocale, deployment: string): Promise<string> {
  return readFile(join(output, deployment, locale === "zh-CN" ? "zh-cn" : "", route.slice(1), "index.html"), "utf8");
}

test("LC-32: final quote and callout retain human rule-setting authority", async () => {
  for (const deployment of deployments) {
    const zh = await html(routes[0], "zh-CN", deployment.directory);
    const en = await html(routes[0], "en", deployment.directory);
    assert.ok(zh.includes('<div class="article-pull-quote"><p>“人类确立规则，机器负责执行。”</p>'));
    assert.ok(zh.includes("<h3>人类确立规则，机器负责执行。</h3>"));
    assert.doesNotMatch(zh, /人类授权；机器执行。/u);
    assert.ok(en.includes('<div class="article-pull-quote"><p>“Human authority; machine execution.”</p>'));
    assert.ok(en.includes("<h3>Human authority; machine execution.</h3>"));
  }
});

test("LC-33: final learning-difficulty paragraph preserves uncertainty and surrounding claims", async () => {
  for (const deployment of deployments) {
    const zh = await html(routes[1], "zh-CN", deployment.directory);
    const en = await html(routes[1], "en", deployment.directory);
    assert.ok(zh.includes("<p>一开始，问题可能只在学习上：“我不懂这个。”重复足够多次之后，它可能变成个人判断：“我不擅长这个。”再进一步变成：“我不擅长学习。”</p>"));
    assert.doesNotMatch(zh, /学术上的/u);
    assert.ok(en.includes("<p>At first, the problem may be academic: I do not understand this. After enough repetition, it can become personal: I am bad at this. Then broader: I am bad at learning.</p>"));
  }
});

test("LC-34: final application copy describes future data without opening intake or changing identities", async () => {
  const copy = "首版申请数据契约会刻意保持精简：一个用于未来邀请的联系邮箱、偏好的评审语言、简短动机、可选的相关经验，以及大致可参与的时间范围。";
  const notice = "当前尚未开放申请。本节说明未来的申请数据约定，不是申请表。";
  for (const deployment of deployments) {
    const zh = await html(routes[2], "zh-CN", deployment.directory);
    const en = await html(routes[2], "en", deployment.directory);
    assert.ok(zh.includes(`>${copy}</span>`));
    assert.equal(zh.split(`>${notice}</span>`).length - 1, 2);
    // 同一文案的静态文本与现有 locale payload 都必须一致，切换语言后不能恢复旧译法。
    for (const markup of [en, zh]) {
      assert.ok(markup.includes(`data-ui-text-zh-cn="${copy}"`));
      assert.equal(markup.split(`data-ui-text-zh-cn="${notice}"`).length - 1, 2);
      assert.doesNotMatch(markup, /首版申请合同|本节说明未来合同，不是申请表/u);
      assert.doesNotMatch(markup, /<(?:form|input|textarea)\b/u);
      assert.ok(markup.includes("<strong>community-review-application</strong>"));
    }
    assert.ok(en.includes(">The first application contract is intentionally small: one contact email, a preferred review language, a short motivation, optional relevant experience, and a coarse availability category.</span>"));
    assert.equal(en.split(">Applications are not open yet. This section describes a future contract, not a form.</span>").length - 1, 2);
    const ids = (markup: string): string[] => [...markup.matchAll(/\bid="([^"]+)"/gu)].map(match => match[1] ?? "");
    assert.deepEqual(ids(zh), ids(en));
  }
});

test("P3B final routes preserve canonical, hreflang, locale destinations, sitemap and raw public JSON", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  for (const deployment of deployments) {
    const sitemap = await readFile(join(output, deployment.directory, "sitemap.xml"), "utf8");
    for (const route of routes) {
      for (const locale of ["en", "zh-CN"] as const) {
        const markup = await html(route, locale, deployment.directory);
        const localizedRoute = `${locale === "zh-CN" ? "/zh-cn" : ""}${route}`;
        assert.ok(markup.includes(`<link rel="canonical" href="${deployment.url}${localizedRoute}">`));
        assert.ok(sitemap.includes(`<loc>${deployment.url}${localizedRoute}</loc>`));
        for (const language of ["en", "zh-CN", "x-default"]) {
          assert.ok(markup.includes(`<link rel="alternate" hreflang="${language}" href="${deployment.url}${language === "zh-CN" ? "/zh-cn" : ""}${route}">`));
        }
        assert.ok(markup.includes(`data-locale-en-url="${deployment.basePath}${route}"`));
        assert.ok(markup.includes(`data-locale-zh-cn-url="${deployment.basePath}/zh-cn${route}"`));
      }
    }
    for (const key of ["benchmark", "cases", "models", "trials"] as const) {
      const bytes = await readFile(join(output, deployment.directory, "public-data", `${key}.json`));
      assert.deepEqual(bytes, Buffer.from(JSON.stringify(artifacts[key], null, 2) + "\n"));
    }
  }
});
