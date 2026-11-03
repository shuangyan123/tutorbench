import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LEARNING_ACCESS_ESSAY } from "./learning-access-essay.js";

/** Standalone editorial series. Separate from TutorBench measurements and public benchmark data. */
interface Copy {
  title: string;
  description: string;
  dek: string;
  sections: { heading: string; paragraphs: string[] }[];
}
interface Article {
  slug: string;
  en: Copy;
  zh: Copy;
  sources: { label: string; url: string }[];
}
interface PublishOptions {
  outputDirectory: string;
  siteUrl?: string;
  basePath?: string;
}
const PUBLISHED = "2026-11-03";
const POSTS: Article[] = [LEARNING_ACCESS_ESSAY];
/** Previously published short essays redirect to the relevant section of the revised argument. */
const LEGACY_ARTICLE_ANCHORS = [
  { slug: "who-owns-the-past-exam-paper", section: 3 },
  { slug: "libraries-should-buy-access-not-databases", section: 5 },
  { slug: "a-university-id-is-not-a-research-ability", section: 4 },
  { slug: "you-cannot-search-for-a-course-you-dont-know-exists", section: 2 },
  { slug: "best-courses-plus-personalized-ai-help", section: 7 },
] as const;

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function pair(en: string, zh: string): string {
  return '<span class="en">' + esc(en) + '</span><span class="zh" lang="zh-CN">' + esc(zh) + '</span>';
}
function mainArticle(post: Article, index: number): string {
  const sections = post.en.sections.map((sec, i) => {
    const z = post.zh.sections[i];
    if (z === undefined || z.paragraphs.length !== sec.paragraphs.length) {
      throw new Error("Bilingual series mismatch: " + post.slug + " section " + i);
    }
    const paragraphs = sec.paragraphs.map((p, j) =>
      '<p class="en">' + esc(p) + '</p><p class="zh" lang="zh-CN">' + esc(z.paragraphs[j] ?? "") + '</p>').join("\n");
    return '<section><h2 id="section-' + (i + 1) + '"><span class="no">§' + (i + 1) + '</span><span>' + pair(sec.heading,z.heading) + '</span></h2>' + paragraphs + '</section>';
  }).join("\n");
  const sourceLinks = post.sources.map((s) =>
    '<li><a href="' + esc(s.url) + '" rel="noopener noreferrer">' + esc(s.label) + '</a></li>').join("");
  const neighbor = (p: Article | undefined, labelEn: string, labelZh: string) =>
    p ? '<a href="../' + esc(p.slug) + '/index.html" class="next"><span class="kicker">' + pair(labelEn,labelZh) + '</span><span class="t">' + pair(p.en.title,p.zh.title) + '</span></a>' : '<span></span>';
  return '<main id="main"><header class="essay-head"><div class="wrap essay-grid"><div>' +
    '<p class="essay-meta kicker"><a class="issue" href="../index.html">' + pair("Journal · Education and access","期刊 · 教育与获取") +
    '</a><span class="rule" aria-hidden="true"></span><span>' + pair("Perspective","观点") + '</span><time datetime="' + PUBLISHED + '">' + pair("November 3, 2026","2026年11月3日") + '</time></p>' +
    '<h1 class="essay-title">' + pair(post.en.title,post.zh.title) + '</h1>' +
    '<p class="en essay-dek">' + esc(post.en.dek) + '</p><p class="zh essay-dek" lang="zh-CN">' + esc(post.zh.dek) + '</p>' +
    '<p class="essay-byline kicker">Teachometry <span>' + pair("Long-form essay · "+post.en.sections.length+" sections", "深度文章 · "+post.zh.sections.length+" 节") + '</span></p></div>' +
    '<figure class="cover-plate" aria-label="Learning Access editorial typographic cover"><div style="min-height:22rem;display:flex;flex-direction:column;justify-content:space-between;gap:5rem;padding:2rem;background:linear-gradient(145deg,#e8eee9,#c9d8e7 55%,#eee7d9);border:1px solid #d0d4d4;color:#263a46"><span style="font-size:.75rem;letter-spacing:.12em">TEACHOMETRY · LEARNING ACCESS</span><strong style="font-size:clamp(3rem,6vw,5.5rem);line-height:1;font-weight:400;font-family:serif">0'+(index+1)+'</strong><span>' + pair("Open knowledge needs an open path.","知识开放，也需要可抵达的道路。") + '</span></div><figcaption class="kicker">' + pair("Essay · From knowledge to independent learning","长文 · 从知识获取到独立掌握") + '</figcaption></figure></div></header>' +
    '<div class="wrap essay-body"><nav class="essay-toc" aria-label="On this page"><p class="kicker">'+pair("On this page","本文目录")+'</p><ol>'+
    post.en.sections.map((s,i)=>'<li><a href="#section-'+(i+1)+'">'+pair(s.heading,post.zh.sections[i]?.heading??"")+'</a></li>').join("")+
    '</ol></nav><article class="essay-text"><div class="prose">' + sections +
    '<aside class="callout boundary"><p class="kicker">'+pair("Evidence boundary","证据边界")+'</p><h3>'+pair("A perspective, not a measured result.","这是观点，不是已验证的评测结果。")+'</h3><p class="en">This essay proposes directions for education policy and product design. It is not a TutorBench result, a finding of wrongdoing, or proof of learning impact.</p><p class="zh" lang="zh-CN">本文讨论教育政策和产品设计方向，不是 TutorBench 的评测结果，也不构成对任何机构违法行为的认定或对学习成效的实证证明。</p></aside>' +
    '<section><h2 id="sources">'+pair("Sources and further reading","资料来源与延伸阅读")+'</h2><ol>'+sourceLinks+'</ol></section></div></article></div>' +
    '<nav class="wrap essay-nav" aria-label="Article navigation">' + neighbor(POSTS[index-1],"Previous in series","上一篇") +
    '<a class="all kicker" href="../index.html">'+pair("Back to all essays","返回全部文章")+'</a>' + neighbor(POSTS[index+1],"Next in series","下一篇") + '</nav></main>';
}
function rewriteMetadata(
  html: string,
  post: Article,
  zh: boolean,
  url: string,
  englishUrl: string,
  chineseUrl: string,
): string {
  const copy = zh ? post.zh : post.en;
  const description = esc(copy.description);
  const title = esc(copy.title + " · Teachometry Journal");
  // The generated article is based on a prior essay for its layout. Replace its SEO
  // metadata as a single block instead of carrying over that essay's canonical,
  // hreflang, social preview, published date, or inaccurate share image.
  const metadata = [
    "<title>" + title + "</title>",
    '<meta name="description" content="' + description + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="Teachometry">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:locale" content="' + (zh ? "zh_CN" : "en_US") + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<link rel="alternate" hreflang="en" href="' + esc(englishUrl) + '">',
    '<link rel="alternate" hreflang="zh-CN" href="' + esc(chineseUrl) + '">',
    '<link rel="alternate" hreflang="x-default" href="' + esc(englishUrl) + '">',
    '<meta property="article:published_time" content="' + PUBLISHED + '">',
    // No original social preview card exists for these essays yet. A summary
    // is preferable to incorrectly displaying a different article's headline.
    '<meta name="twitter:card" content="summary">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + description + '">',
    "",
  ].join("\n");
  if (!/<title>[\s\S]*?(?=<link rel="icon")/u.test(html)) {
    throw new Error("Source journal article metadata structure changed");
  }
  return html
    .replace(/<title>[\s\S]*?(?=<link rel="icon")/u, metadata)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gu, "");
}
function featureContents(): string {
  const post = POSTS[0];
  if (post === undefined) throw new Error("Missing editorial feature");
  return '<section class="wrap jx-premise" aria-labelledby="learning-access-feature"><div>' +
    '<p class="kicker">' + pair("New essay · November 2026","新文章 · 2026年11月") + '</p>' +
    '<h2 class="jx-h2" id="learning-access-feature">' + pair(post.en.title,post.zh.title) + '</h2>' +
    '<p class="jx-p">' + pair(post.en.dek,post.zh.dek) + '</p></div>' +
    '<div><p class="jx-p">' +
    pair("One continuous argument, from being able to discover a course, to legally obtaining sources, to learning with the right support—and verifying independent understanding.", "从发现免费课程、合法获得试题与论文，到获得适当教学支持并检验独立掌握：这些不是五个孤立话题，而是同一条学习机会链上的不同断点。") +
    '</p><p class="jx-links"><a href="' + esc(post.slug) + '/index.html">' +
    pair("Read the full essay","阅读全文") + '</a></p></div></section>';
}
function legacyRedirect(slug: string, section: number, zh: boolean, canonical: string): string {
  const target = "../" + POSTS[0]!.slug + "/index.html#section-" + section;
  const title = zh ? "本文已整合进新的完整文章" : "This essay has been incorporated into a fuller argument";
  const description = zh
    ? "原先的短文已重新编辑，保留这条旧链接并指向新版文章的对应章节。"
    : "The original short essay has been edited into a fuller argument. This URL continues to point to the relevant section.";
  return '<!doctype html><html lang="' + (zh ? "zh-CN" : "en") +
    '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + ' · Teachometry</title><meta name="description" content="' + esc(description) + '">' +
    '<meta name="robots" content="noindex,follow"><link rel="canonical" href="' + esc(canonical) + '">' +
    '<meta http-equiv="refresh" content="0; url=' + esc(target) + '">' +
    '<link rel="stylesheet" href="../../journal.css"></head><body><main style="max-width:55rem;margin:8vh auto;padding:1.5rem">' +
    '<h1>' + esc(title) + '</h1><p>' + esc(description) + '</p><p><a href="' + esc(target) + '">' +
    (zh ? "前往新版文章" : "Read the revised essay") + '</a></p></main></body></html>';
}
function updateSitemap(sitemap: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/u,"");
  const entries = POSTS.flatMap((p) => ["", "zh-cn/"].map((locale) => {
    const url = base + "/" + locale + "blog/" + p.slug + "/";
    const en = base + "/blog/" + p.slug + "/";
    const zh = base + "/zh-cn/blog/" + p.slug + "/";
    return '<url><loc>'+esc(url)+'</loc><xhtml:link rel="alternate" hreflang="en" href="'+esc(en)+'"/><xhtml:link rel="alternate" hreflang="zh-CN" href="'+esc(zh)+'"/><xhtml:link rel="alternate" hreflang="x-default" href="'+esc(en)+'"/></url>';
  })).join("\n");
  return sitemap.replace("</urlset>",entries+"\n</urlset>");
}
export async function publishLearningAccessSeries(options: PublishOptions): Promise<void> {
  const site = options.siteUrl?.replace(/\/$/u, "") ?? "";
  const post = POSTS[0];
  if (post === undefined) throw new Error("No learning access feature article");
  for (const locale of ["", "zh-cn/"]) {
    const zh = locale !== "";
    const root = join(options.outputDirectory, locale);
    const template = await readFile(join(root, "blog/why-teaching-does-not-scale/index.html"), "utf8");
    const indexPath = join(root, "blog/index.html");
    const index = await readFile(indexPath, "utf8");
    const anchor = '<section class="wrap jx-contents"';
    if (!index.includes(anchor)) throw new Error("Journal index structure changed");
    const updated = index.replace(anchor, featureContents() + "\n" + anchor)
      .replaceAll("4 essays", "5 essays")
      .replaceAll("4 篇文章", "5 篇文章");
    await writeFile(indexPath, updated, "utf8");

    const sitePath = locale + "blog/" + post.slug + "/";
    const url = site ? site + "/" + sitePath : "/" + sitePath;
    const englishUrl = site ? site + "/blog/" + post.slug + "/" : "/blog/" + post.slug + "/";
    const chineseUrl = site ? site + "/zh-cn/blog/" + post.slug + "/" : "/zh-cn/blog/" + post.slug + "/";
    const changed = rewriteMetadata(
      template.replace(/<main id="main">[\s\S]*?<\/main>/u, mainArticle(post, 0)),
      post, zh, url, englishUrl, chineseUrl,
    );
    if (!changed.includes(post.en.title) || !changed.includes(post.zh.title) || !changed.includes('id="section-9"')) {
      throw new Error("Essay render failed");
    }
    const destination = join(root, "blog", post.slug, "index.html");
    await mkdir(join(root, "blog", post.slug), { recursive: true });
    await writeFile(destination, changed, "utf8");

    for (const legacy of LEGACY_ARTICLE_ANCHORS) {
      const legacyDir = join(root, "blog", legacy.slug);
      await mkdir(legacyDir, { recursive: true });
      await writeFile(join(legacyDir, "index.html"), legacyRedirect(legacy.slug, legacy.section, zh, url), "utf8");
    }
  }
  if (site) {
    const sitemap = join(options.outputDirectory, "sitemap.xml");
    await writeFile(sitemap, updateSitemap(await readFile(sitemap, "utf8"), site), "utf8");
  }
}
