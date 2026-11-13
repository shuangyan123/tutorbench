import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";
import { minifyCss, shareCardFor, withShareImage } from "../src/cli/spectrum-site.js";
import { arroganceSectionId, beyondWinningSectionId, learningAccessSectionId } from "../src/cli/blog-series.js";

// The public site is the Spectrum redesign (website/prototypes/spectrum). It must keep every URL the
// generated site had, in English and under /zh-cn/, keep the search metadata of each route, and every
// link and asset must resolve inside the published folder.

const SITE_URL = "https://example.org/tb";
const BASE = "/tb";
let root = "";
let spectrum = "";
let legacy = "";

async function htmlFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await htmlFiles(directory, relative)));
    else if (entry.name.endsWith(".html")) files.push(relative);
  }
  return files;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

const page = (path: string): Promise<string> => readFile(join(spectrum, path), "utf8");

test.before(async () => {
  root = await mkdtemp(join(tmpdir(), "tutorbench-spectrum-site-"));
  spectrum = join(root, "spectrum");
  legacy = join(root, "legacy");
  await buildWebsite({ outputDirectory: spectrum, siteUrl: SITE_URL, basePath: BASE, site: "spectrum" });
  await buildWebsite({ outputDirectory: legacy, siteUrl: SITE_URL, basePath: BASE });
});

test.after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("every existing page URL is still published, in English and Chinese", async () => {
  const published = new Set(await htmlFiles(spectrum));
  const existing = (await htmlFiles(legacy)).filter((file) => !file.startsWith("spectrum/"));
  assert.ok(existing.length > 120);
  for (const file of existing) assert.ok(published.has(file), `missing ${file}`);
  assert.ok(published.has("zh-cn/models/[modelId]/index.html"));
  assert.ok(!published.has("journal-sample.html"));
  assert.deepEqual((await htmlFiles(spectrum)).filter((file) => file.startsWith("spectrum/")), ["spectrum/index.html"]);
});

test("public data and discovery files are unchanged by the redesign", async () => {
  for (const file of ["benchmark.json", "cases.json", "models.json", "trials.json"]) {
    assert.equal(
      await readFile(join(spectrum, "public-data", file), "utf8"),
      await readFile(join(legacy, "public-data", file), "utf8"),
    );
  }
  assert.equal(
    await readFile(join(spectrum, "robots.txt"), "utf8"),
    await readFile(join(legacy, "robots.txt"), "utf8"),
  );
  const spectrumSitemap = await readFile(join(spectrum, "sitemap.xml"), "utf8");
  const legacySitemap = await readFile(join(legacy, "sitemap.xml"), "utf8");
  for (const loc of [...legacySitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1])) {
    assert.ok(spectrumSitemap.includes(`<loc>${loc}</loc>`), `existing sitemap entry lost: ${loc}`);
  }
  const slug = "why-learning-resources-fail-to-reach-learners";
  const old = [
    ["who-owns-the-past-exam-paper", 3],
    ["libraries-should-buy-access-not-databases", 5],
    ["a-university-id-is-not-a-research-ability", 4],
    ["you-cannot-search-for-a-course-you-dont-know-exists", 2],
    ["best-courses-plus-personalized-ai-help", 7],
  ] as const;
  for (const locale of ["", "zh-cn/"]) {
    const route = `${locale}blog/${slug}/`;
    assert.ok(await isFile(join(spectrum, route, "index.html")), route);
    assert.ok(spectrumSitemap.includes(`<loc>${SITE_URL}/${route}</loc>`), route);
    const article = await page(route + "index.html");
    assert.match(article, /<meta name="robots" content="index,follow(?:,|")/u);
    assert.match(article, /class="essay-text"/u);
    assert.ok(article.includes(`id="${learningAccessSectionId(9)}"`), "essay has all nine sections");
    assert.doesNotMatch(article, /\*\*/u, "markdown emphasis left in the text");
    assert.match(article, /<meta property="article:published_time" content="2026-11-03">/u);
    assert.ok(article.includes("Why Good Learning Resources Fail to Reach the People Who Need Them"));
    assert.ok(article.includes("为什么优质教育资源没有抵达需要它的人？"));
    const english = `${SITE_URL}/blog/${slug}/`;
    const chinese = `${SITE_URL}/zh-cn/blog/${slug}/`;
    assert.ok(article.includes(`<link rel="canonical" href="${SITE_URL}/${route}">`), route);
    assert.ok(article.includes(`<link rel="alternate" hreflang="en" href="${english}">`), route);
    assert.ok(article.includes(`<link rel="alternate" hreflang="zh-CN" href="${chinese}">`), route);
    const head = article.slice(0, article.indexOf("</head>"));
    assert.ok(head.includes(`assets/share/essay-access-${locale ? "zh" : "en"}.jpg`), `essay share card: ${route}`);
    assert.match(head, /<meta name="twitter:card" content="summary_large_image">/u);
    assert.ok(!head.includes("why-teaching-does-not-scale"), `inherited prior essay metadata: ${route}`);
    assert.match(article, /<h2 id="sources"[ >]/u);
    assert.match(article, /<a class="fn" href="#source-6"/u);
    assert.match(article, /https:\/\/doi\.org\/10\.1073\/pnas\.2422633122/u);

    const index = await page(`${locale}blog/index.html`);
    assert.ok(index.includes(`href="${slug}/"`), "new essay not linked on Journal index");
    assert.ok(index.includes(locale ? "7 篇文章" : "7 essays"), "index count was not updated");

    for (const [oldSlug, section] of old) {
      const oldRoute = `${locale}blog/${oldSlug}/`;
      assert.ok(await isFile(join(spectrum, oldRoute, "index.html")), oldRoute);
      const redirect = await page(oldRoute + "index.html");
      assert.match(redirect, /<meta name="robots" content="noindex,follow">/u);
      assert.ok(redirect.includes(`../${slug}/#${learningAccessSectionId(section)}`), oldRoute);
      assert.ok(redirect.includes(`<link rel="canonical" href="${SITE_URL}/${route}">`), oldRoute);
      assert.ok(!spectrumSitemap.includes(`<loc>${SITE_URL}/${oldRoute}</loc>`), "old short essay should not remain indexed");
    }
  }

  // "Arrogance Is Not What You Need": its own route, metadata, share card, sources, and place on the index and home page
  const arrogance = "arrogance-is-not-what-you-need";
  for (const locale of ["", "zh-cn/"]) {
    const route = `${locale}blog/${arrogance}/`;
    assert.ok(await isFile(join(spectrum, route, "index.html")), route);
    assert.ok(spectrumSitemap.includes(`<loc>${SITE_URL}/${route}</loc>`), route);
    const article = await page(route + "index.html");
    assert.match(article, /<meta name="robots" content="index,follow(?:,|")/u);
    assert.ok(article.includes(`id="${arroganceSectionId(8)}"`), "essay has all eight sections");
    assert.doesNotMatch(article, /\*\*/u, "markdown emphasis left in the text");
    assert.doesNotMatch(article, />&gt; /u, "quote marker left in the text");
    assert.match(article, /<meta property="article:published_time" content="2026-11-06">/u);
    assert.ok(article.includes("Arrogance Is Not What You Need"));
    assert.ok(article.includes("傲慢是你所不需要的"));
    assert.ok(article.includes(`<link rel="canonical" href="${SITE_URL}/${route}">`), route);
    assert.ok(article.includes(`<link rel="alternate" hreflang="zh-CN" href="${SITE_URL}/zh-cn/blog/${arrogance}/">`), route);
    const head = article.slice(0, article.indexOf("</head>"));
    assert.ok(head.includes(`assets/share/essay-arrogance-${locale ? "zh" : "en"}.jpg`), `essay share card: ${route}`);
    assert.ok(!head.includes(slug), `inherited prior essay metadata: ${route}`);
    assert.match(article, /<a class="fn" href="#source-5"/u);
    for (const doi of ["10.3102/00028312040004905", "10.1016/j.lmot.2024.102015", "10.1177/01461672231225364", "10.1073/pnas.2422633122"]) {
      assert.ok(article.includes(`https://doi.org/${doi}`), `source link ${doi}`);
    }
    assert.ok(article.includes("assets/journal/piano.webp"), "cover plate");
    const index = await page(`${locale}blog/index.html`);
    assert.ok(index.indexOf(`href="${arrogance}/"`) >= 0 && index.indexOf(`href="${arrogance}/"`) < index.indexOf(`href="${slug}/"`), "essays are listed newest first");
    const home = await page(`${locale}index.html`);
    assert.ok(home.includes(`blog/${arrogance}/`), "essay not on the home page");
  }

  // the newest essay, "After You’ve Beaten Everyone, Then What?"
  const winning = "after-you-have-beaten-everyone";
  for (const locale of ["", "zh-cn/"]) {
    const route = `${locale}blog/${winning}/`;
    assert.ok(await isFile(join(spectrum, route, "index.html")), route);
    assert.ok(spectrumSitemap.includes(`<loc>${SITE_URL}/${route}</loc>`), route);
    const article = await page(route + "index.html");
    assert.match(article, /<meta name="robots" content="index,follow(?:,|")/u);
    assert.ok(article.includes(`id="${beyondWinningSectionId(7)}"`), "essay has all seven sections");
    assert.doesNotMatch(article, /\*\*/u, "markdown emphasis left in the text");
    assert.doesNotMatch(article, /〔资料/u, "citation marker left in the text");
    assert.match(article, /<meta property="article:published_time" content="2026-11-11">/u);
    assert.ok(article.includes("After You’ve Beaten Everyone, Then What?"));
    assert.ok(article.includes("当你赢过所有人之后呢？"));
    assert.ok(article.includes(`<link rel="canonical" href="${SITE_URL}/${route}">`), route);
    assert.ok(article.includes(`<link rel="alternate" hreflang="zh-CN" href="${SITE_URL}/zh-cn/blog/${winning}/">`), route);
    const head = article.slice(0, article.indexOf("</head>"));
    assert.ok(head.includes(`assets/share/essay-winning-${locale ? "zh" : "en"}.jpg`), `essay share card: ${route}`);
    assert.ok(!head.includes(arrogance), `inherited prior essay metadata: ${route}`);
    assert.match(article, /<a class="fn" href="#source-10"/u);
    for (const doi of ["10.1596/1813-9450-11125", "10.1038/nsmb.2119", "10.1111/bjet.13544"]) {
      assert.ok(article.includes(`https://doi.org/${doi}`), `source link ${doi}`);
    }
    assert.ok(article.includes("assets/journal/podium.webp"), "cover plate");
    assert.ok(article.includes("期刊 · 第 1 篇，共 7 篇"), "essay number");
    const index = await page(`${locale}blog/index.html`);
    assert.ok(index.indexOf(`href="${winning}/"`) >= 0 && index.indexOf(`href="${winning}/"`) < index.indexOf(`href="${arrogance}/"`), "newest essay leads the Journal index");
    const home = await page(`${locale}index.html`);
    assert.ok(home.includes(`blog/${winning}/`), "newest essay not on the home page");
    assert.ok(home.indexOf(`blog/${winning}/`) < home.indexOf(`blog/${arrogance}/`), "newest essay leads the home page list");
  }
});

test("each page keeps its route's title, description, robots and canonical metadata", async () => {
  for (const file of ["index.html", "about/index.html", "zh-cn/index.html", "zh-cn/blog/index.html", "data/cases/fraction-misconception-001/index.html"]) {
    const html = await page(file);
    const before = await readFile(join(legacy, file), "utf8");
    for (const pattern of [/<title>[^<]*<\/title>/u, /<meta name="description" content="[^"]*">/u, /<meta name="robots" content="[^"]*">/u, /<link rel="canonical" href="[^"]*">/u]) {
      assert.equal(html.match(pattern)?.[0], before.match(pattern)?.[0], `${file} ${pattern}`);
    }
    assert.doesNotMatch(html, /Design prototype|设计原型|Teachometry · Spectrum/u);
  }
  const home = await page("index.html");
  assert.match(home, /<title>TutorBench by Teachometry — AI Tutor Evaluation<\/title>/u);
  assert.match(home, /<meta name="robots" content="index,follow/u);
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.org\/tb\/">/u);
  assert.match(home, /<html lang="en" data-lang="en" data-route-lang="en" data-route-depth="0">/u);
  const docs = await page("docs/index.html");
  assert.match(docs, /<title>TutorBench Documentation — Teachometry<\/title>/u);
  assert.ok(docs.includes('<link rel="canonical" href="https://example.org/tb/docs/">'));
  const zhDocs = await page("zh-cn/docs/index.html");
  assert.match(zhDocs, /<title>TutorBench 文档 — Teachometry<\/title>/u);
  assert.ok(zhDocs.includes('<link rel="canonical" href="https://example.org/tb/zh-cn/docs/">'));
  const zhHome = await page("zh-cn/index.html");
  assert.match(zhHome, /<html lang="zh-CN" data-lang="zh" data-route-lang="zh" data-route-depth="0">/u);
  assert.match(zhHome, /<link rel="canonical" href="https:\/\/example\.org\/tb\/zh-cn\/">/u);
  assert.match(await page("zh-cn/data/cases/index.html"), /<html lang="zh-CN" data-lang="zh" data-route-lang="zh" data-route-depth="2">/u);
  assert.match(await page("models/[modelId]/index.html"), /<meta name="robots" content="noindex,follow">/u);
});

test("template routes without a page of their own redirect, and the preview path points home", async () => {
  assert.match(await page("data/trials/[trialId]/index.html"), /http-equiv="refresh" content="0; url=\.\.\/"/u);
  assert.match(await page("zh-cn/data/trials/[trialId]/index.html"), /http-equiv="refresh" content="0; url=\.\.\/"/u);
  assert.match(await page("spectrum/index.html"), /http-equiv="refresh" content="0; url=\.\.\/"/u);
});

test("every link and asset in every page resolves inside the published site", async () => {
  const files = await htmlFiles(spectrum);
  let checked = 0;
  for (const file of files) {
    const html = (await page(file)).replace(/(<script\b[^>]*>)[\s\S]*?<\/script[^>]*>/giu, "$1</script>");
    const urls = [...html.matchAll(/\s(?:href|src)="([^"]*)"/gu)].map((match) => match[1] ?? "");
    for (const srcset of html.matchAll(/\ssrcset="([^"]*)"/gu)) {
      urls.push(...(srcset[1] ?? "").split(",").map((candidate) => candidate.trim().split(/\s+/u)[0] ?? ""));
    }
    for (const url of urls) {
      if (url === "" || /^(?:#|[a-z][a-z0-9+.-]*:)/iu.test(url)) continue;
      const path = decodeURI(url.replace(/[?#].*$/u, ""));
      let target: string;
      if (path.startsWith("/")) {
        assert.ok(path.startsWith(`${BASE}/`), `${file}: ${url} is outside the base path`);
        target = path.slice(BASE.length + 1);
      } else {
        // the 404 page is served at any depth, so its URLs must not be relative
        assert.ok(!file.endsWith("404.html"), `${file}: relative URL ${url}`);
        target = posix.normalize(posix.join(posix.dirname(file), path));
      }
      if (target === "." || target === "") target = "index.html";
      else if (target.endsWith("/") || !posix.basename(target).includes(".")) target = posix.join(target, "index.html");
      assert.ok(!target.startsWith(".."), `${file}: ${url} leaves the site`);
      assert.ok(await isFile(join(spectrum, target)), `${file}: ${url} -> ${target} does not exist`);
      checked += 1;
    }
  }
  assert.ok(checked > 5000, `only ${checked} references checked`);
});

test("product facts stay on the published pages", async () => {
  const contact = await page("contact/index.html");
  assert.match(contact, /shuangyan12341234@gmail\.com/u);
  assert.match(contact, /https:\/\/x\.com\/1Shuangyan36877/u);
  assert.match(await page("leaderboard/index.html"), /No calibrated public model runs yet\./u);
  assert.match(await page("zh-cn/micro-review/index.html"), /<html lang="zh-CN"/u);
});

const PROTOTYPE = join(process.cwd(), "website", "prototypes", "spectrum");

async function prototypeText(directory = PROTOTYPE, prefix = ""): Promise<string> {
  let text = "";
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (relative !== "render" && relative !== "tools") text += await prototypeText(directory, relative);
    } else if (/\.(?:html|js|css)$/u.test(entry.name) && relative !== "journal-sample.html") {
      text += await readFile(join(directory, relative), "utf8");
    }
  }
  return text;
}

test("the site serves its own fonts, and they cover every Chinese character on the pages", async () => {
  for (const file of await htmlFiles(spectrum)) {
    assert.doesNotMatch(await page(file), /fonts\.(?:googleapis|gstatic)\.com/u, file);
  }
  const fonts = await page("fonts.css");
  const sources = [...fonts.matchAll(/url\(([^)]+)\)/gu)].map((match) => match[1] ?? "");
  assert.ok(sources.length >= 10);
  for (const source of sources) assert.ok(await isFile(join(spectrum, source)), `fonts.css: ${source} is missing`);
  // tools/build-fonts.py cuts the Chinese faces to the characters in the pages; rerun it when this fails
  const covered = new Set(await readFile(join(PROTOTYPE, "assets", "fonts", "cjk-coverage.txt"), "utf8"));
  const missing = [...new Set(await prototypeText())].filter((char) => (char.codePointAt(0) ?? 0) >= 0x2e80 && !covered.has(char));
  assert.deepEqual(missing, [], "run: python3 website/prototypes/spectrum/tools/build-fonts.py");
});

/** The font file fonts.css sends a character of a family to (the last rule that claims it wins). */
function fontFileFor(fonts: string, family: string, codePoint: number): string | undefined {
  let file: string | undefined;
  for (const rule of fonts.matchAll(/@font-face\s*\{[^}]*\}/gu)) {
    if (!rule[0].includes(`font-family: "${family}"`)) continue;
    const claimed = (/unicode-range:([^;}]+)/u.exec(rule[0])?.[1] ?? "").split(",").some((range) => {
      const [from, to] = range.trim().replace(/^U\+/iu, "").split("-").map((value) => Number.parseInt(value, 16));
      return from !== undefined && codePoint >= from && codePoint <= (to ?? from);
    });
    if (claimed) file = /url\(([^)]+)\)/u.exec(rule[0])?.[1];
  }
  return file;
}

test("an English page fetches a small file, not a whole Chinese face, for the language switch", async () => {
  const fonts = await page("fonts.css");
  const code = (char: string): number => char.codePointAt(0) ?? 0;
  for (const family of ["Noto Sans SC", "Noto Serif SC"]) {
    // every page shows the "中" of the language switch; it used to pull in about 360 KB
    const core = fontFileFor(fonts, family, code("中"));
    assert.match(core ?? "", /-core\.woff2$/u, family);
    assert.ok((await stat(join(spectrum, core ?? ""))).size < 40 * 1024, `${core} should stay small`);
    // Letters and punctuation are shaped with their neighbours (kerning, the tightening of "）。"),
    // which only works inside one file: they must not be spread over several.
    const base = fontFileFor(fonts, family, code("A"));
    for (const char of ["z", "7", "，", "。", "：", "（", "）", "“", "”", "、"]) {
      assert.equal(fontFileFor(fonts, family, code(char)), base, `${family}: ${char}`);
    }
    assert.notEqual(fontFileFor(fonts, family, code("教")), undefined);
  }
});

test("published stylesheets are minified without changing strings or selectors", () => {
  assert.equal(
    minifyCss('a  { color : red ; /* note */ background: url("data:x;a  b") }\n@media (max-width: 4px) {\n  .a > .b, .c { x: calc(1px + 2px); }\n}\n'),
    'a{color : red;background: url("data:x;a  b")}@media (max-width: 4px){.a > .b, .c{x: calc(1px + 2px)}}\n',
  );
});

test("every page shares its own section's preview card, in its own language", async () => {
  const card = async (page: string): Promise<string> => {
    const html = await readFile(join(spectrum, page), "utf8");
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/u, page);
    const image = /<meta property="og:image" content="([^"]+)">/u.exec(html)?.[1];
    assert.ok(image, `${page} has no og:image`);
    assert.equal(/<meta name="twitter:image" content="([^"]+)">/u.exec(html)?.[1], image, page);
    assert.ok(image.startsWith(`${SITE_URL}/assets/share/`), image);
    assert.ok(await isFile(join(spectrum, image.slice(SITE_URL.length + 1))), `${image} is not published`);
    return image.slice(image.lastIndexOf("/") + 1);
  };
  assert.equal(await card("index.html"), "home-en.jpg");
  assert.equal(await card("zh-cn/index.html"), "home-zh.jpg");
  assert.equal(await card("methodology/index.html"), "methodology-en.jpg");
  assert.equal(await card("zh-cn/blog/why-teaching-does-not-scale/index.html"), "essay-scale-zh.jpg");
  assert.equal(await card("data/cases/fraction-misconception-001/index.html"), "cases-en.jpg");
  assert.equal(await card("zh-cn/models/[modelId]/index.html"), "models-zh.jpg");
  assert.equal(await card("404.html"), "home-en.jpg");
});

test("share cards: longest route prefix wins, and no site URL means no image", () => {
  const cards = [{ id: "home", routes: [""] }, { id: "data", routes: ["data/"] }, { id: "cases", routes: ["data/cases/"] }];
  assert.equal(shareCardFor(cards, "data/cases/x/index.html"), "cases");
  assert.equal(shareCardFor(cards, "data/index.html"), "data");
  assert.equal(shareCardFor(cards, "about/index.html"), "home");
  const head = '<title>T</title>\n<meta name="twitter:card" content="summary">';
  assert.equal(withShareImage(head, "assets/share/home-en.jpg", ""), head);
});

test("an old page's own preview image is replaced by the card, not doubled", () => {
  const head = [
    '<meta property="og:url" content="https://example.org/tb/blog/x/">',
    '<meta property="og:image" content="https://example.org/tb/assets/old.webp">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:description" content="d">',
    '<meta name="twitter:image" content="https://example.org/tb/assets/old.webp">',
  ].join("\n");
  const out = withShareImage(head, "assets/share/essay-en.jpg", "/tb");
  assert.doesNotMatch(out, /old\.webp/u);
  assert.equal(out.match(/og:image"/gu)?.length, 1);
  assert.equal(out.match(/twitter:image"/gu)?.length, 1);
  assert.match(out, /content="https:\/\/example\.org\/tb\/assets\/share\/essay-en\.jpg"/u);
});
