import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { articleHeadingId } from "../site/pages/blog.js";
import { LEARNING_ACCESS_ESSAY } from "./learning-access-essay.js";

/**
 * The Journal essay "Why Good Learning Resources Fail to Reach the People Who Need Them".
 *
 * The page itself is built like every other essay, by the Spectrum Journal generator
 * (website/prototypes/spectrum/tools/build-journal.mjs, from LEARNING_ACCESS_ESSAY). The generated
 * site has no page for it, so this module supplies the search and sharing metadata the Spectrum
 * install takes from that site for each route, and after the install writes the sitemap entries
 * and the redirects from the five short essays it replaced.
 */
export interface LearningAccessOptions {
  outputDirectory: string;
  siteUrl?: string;
}

export const LEARNING_ACCESS_SLUG = LEARNING_ACCESS_ESSAY.slug;
const PUBLISHED = "2026-11-03";

/** The short essays first published on 2026-11-03, each now a section of the full essay (by its heading). */
const LEGACY_ARTICLE_SECTIONS = [
  { slug: "who-owns-the-past-exam-paper", section: 3 },
  { slug: "libraries-should-buy-access-not-databases", section: 5 },
  { slug: "a-university-id-is-not-a-research-ability", section: 4 },
  { slug: "you-cannot-search-for-a-course-you-dont-know-exists", section: 2 },
  { slug: "best-courses-plus-personalized-ai-help", section: 7 },
] as const;

/** The anchor of section `n` (1-based) of the essay: the same id the Journal generator gives its heading. */
export function learningAccessSectionId(n: number): string {
  const heading = LEARNING_ACCESS_ESSAY.en.sections[n - 1]?.heading;
  if (heading === undefined) throw new Error(`The essay has no section ${n}`);
  return articleHeadingId(heading);
}

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const page = (zh: boolean): string => `${zh ? "zh-cn/" : ""}blog/${LEARNING_ACCESS_SLUG}/`;

/**
 * The essay's metadata block for the Spectrum install, keyed like the generated site's pages
 * ("blog/<slug>/index.html" and its zh-cn twin). Each value runs from <title> to the icon link,
 * the shape the install reads; the preview image is added there from tools/share-cards.json.
 */
export function learningAccessMetadataPages(siteUrl: string | undefined): Map<string, string> {
  const site = siteUrl?.replace(/\/$/u, "");
  const absolute = (path: string): string => (site === undefined ? `/${path}` : `${site}/${path}`);
  const pages = new Map<string, string>();
  for (const zh of [false, true]) {
    const copy = zh ? LEARNING_ACCESS_ESSAY.zh : LEARNING_ACCESS_ESSAY.en;
    const title = `${copy.title} — ${zh ? "Teachometry 博客" : "Teachometry Blog"}`;
    const url = absolute(page(zh));
    const english = absolute(page(false));
    const chinese = absolute(page(true));
    const posting = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: copy.title,
      description: copy.description,
      url,
      mainEntityOfPage: url,
      datePublished: PUBLISHED,
      inLanguage: zh ? "zh-CN" : "en",
      image: absolute("assets/journal/ladder.webp"),
      author: { "@type": "Organization", name: "Teachometry", url: absolute("") },
      publisher: { "@type": "Organization", name: "Teachometry", url: absolute("") },
    };
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: zh ? "博客" : "Blog", item: absolute(zh ? "zh-cn/blog/" : "blog/") },
        { "@type": "ListItem", position: 2, name: copy.title, item: url },
      ],
    };
    const json = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");
    const lines = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(copy.description)}">`,
      '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
      '<meta property="og:type" content="article">',
      '<meta property="og:site_name" content="Teachometry">',
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(copy.description)}">`,
      `<meta property="og:locale" content="${zh ? "zh_CN" : "en_US"}">`,
      ...(site === undefined ? [] : [`<meta property="og:url" content="${esc(url)}">`]),
      `<link rel="canonical" href="${esc(url)}">`,
      `<link rel="alternate" hreflang="en" href="${esc(english)}">`,
      `<link rel="alternate" hreflang="zh-CN" href="${esc(chinese)}">`,
      `<link rel="alternate" hreflang="x-default" href="${esc(english)}">`,
      `<meta property="article:published_time" content="${PUBLISHED}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(copy.description)}">`,
      `<script type="application/ld+json">${json(posting)}</script>`,
      `<script type="application/ld+json">${json(breadcrumb)}</script>`,
      '<link rel="icon" href="/favicon.svg">',
    ];
    pages.set(`${page(zh)}index.html`, lines.join("\n"));
  }
  return pages;
}

function legacyRedirect(section: number, zh: boolean, canonical: string): string {
  const target = `../${LEARNING_ACCESS_SLUG}/#${learningAccessSectionId(section)}`;
  const title = zh ? "本文已整合进新的完整文章" : "This essay has been incorporated into a fuller argument";
  return `<!doctype html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${esc(canonical)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<title>${esc(title)} · Teachometry</title>
</head>
<body>
<p><a href="${esc(target)}">${zh ? "前往新版文章" : "Read the revised essay"}</a></p>
</body>
</html>
`;
}

function withSitemapEntries(sitemap: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/u, "");
  const en = `${base}/${page(false)}`;
  const zh = `${base}/${page(true)}`;
  const entries = [en, zh].filter((loc) => !sitemap.includes(`<loc>${loc}</loc>`)).map((loc) =>
    `<url><loc>${esc(loc)}</loc><xhtml:link rel="alternate" hreflang="en" href="${esc(en)}"/><xhtml:link rel="alternate" hreflang="zh-CN" href="${esc(zh)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(en)}"/></url>`);
  return entries.length === 0 ? sitemap : sitemap.replace("</urlset>", `${entries.join("\n")}\n</urlset>`);
}

/** After the Spectrum install: the old short essays' URLs point at their sections, and the sitemap lists the essay. */
export async function publishLearningAccessRoutes(options: LearningAccessOptions): Promise<void> {
  const site = options.siteUrl?.replace(/\/$/u, "");
  for (const zh of [false, true]) {
    const canonical = site === undefined ? `/${page(zh)}` : `${site}/${page(zh)}`;
    for (const legacy of LEGACY_ARTICLE_SECTIONS) {
      const directory = join(options.outputDirectory, zh ? "zh-cn" : "", "blog", legacy.slug);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "index.html"), legacyRedirect(legacy.section, zh, canonical), "utf8");
    }
  }
  if (site !== undefined) {
    const sitemap = join(options.outputDirectory, "sitemap.xml");
    await writeFile(sitemap, withSitemapEntries(await readFile(sitemap, "utf8"), site), "utf8");
  }
}
