import type {
  PublicBenchmarkArtifact,
  TutorEvalPublicCase,
} from "../datasets/public.js";
import { siteIcon } from "./icons.js";
import {
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
} from "../contracts/index.js";
import {
  resolveSiteLocale,
  siteText,
  type SiteLocale,
  type SiteUiTextKey,
} from "./i18n.js";

export const SITE_GITHUB_URL = "https://github.com/shuangyan123/tutorbench";
export const TUTORBENCH_BRAND_ASSET_BASE_PATH = "/assets/brand/tutorbench";
export const TUTORBENCH_BRAND_ASSET_PATHS = [
  "web/tutorbench-mark.svg",
  "web/tutorbench-mark-mono-dark.svg",
  "web/tutorbench-mark-mono-light.svg",
  "web/tutorbench-mark-small.svg",
  "web/tutorbench-app-icon.svg",
  "raster/favicon-16.png",
  "raster/favicon-32.png",
  "raster/favicon.ico",
] as const;

type SiteFooterBenchmark = Pick<PublicBenchmarkArtifact, "statusLabel"> & {
  readonly dataset: Pick<PublicBenchmarkArtifact["dataset"], "id" | "version">;
};

export interface SiteRenderContext {
  readonly siteUrl?: string;
  readonly basePath?: string;
  readonly locale?: SiteLocale;
  readonly benchmark?: SiteFooterBenchmark;
}

export interface SitePage {
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly content: string;
}

/**
 * Normalizes the path under which a project site is hosted, such as `/tutorbench`.
 * GitHub Pages supplies this value separately from the full canonical URL.
 */
export function normalizeSiteBasePath(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }
  if (
    !trimmed.startsWith("/") ||
    trimmed.includes("//") ||
    /[\\?#\s<>"']/.test(trimmed) ||
    !/^\/[A-Za-z0-9._~!$&()*+,;=:@/-]+$/.test(trimmed)
  ) {
    throw new Error("Site base path must be a URL path such as /re.");
  }
  return trimmed.replace(/\/+$/, "");
}

function sitePath(basePath: string, route: string): string {
  if (!route.startsWith("/")) {
    return route;
  }
  return `${basePath}${route}`;
}

function brandAssetPath(basePath: string, assetPath: string): string {
  return sitePath(basePath, `${TUTORBENCH_BRAND_ASSET_BASE_PATH}/${assetPath}`);
}

/** Prefixes generated internal href/src attributes without touching external URLs or code text. */
function prefixInternalPaths(markup: string, basePath: string): string {
  if (basePath.length === 0) {
    return markup;
  }
  return markup.replace(
    /((?:href|src)=['"])(\/[^'"]*)/g,
    (match, attribute, path) =>
      path === basePath || path.startsWith(`${basePath}/`)
        ? match
        : `${attribute}${basePath}${path}`,
  );
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Safe text nodes that the small static-site script can switch at runtime. */
export function renderUiText(key: SiteUiTextKey, locale: SiteLocale): string {
  return `<span data-ui-text="${escapeHtml(key)}" data-ui-text-en="${escapeHtml(
    siteText("en", key),
  )}" data-ui-text-zh-cn="${escapeHtml(siteText("zh-CN", key))}">${escapeHtml(
    siteText(locale, key),
  )}</span>`;
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDifficulty(value: TutorEvalPublicCase["metadata"]["difficulty"]): string {
  if (typeof value !== "object" || value === null) {
    return value === undefined ? "Not specified" : humanize(String(value));
  }
  return `Learner: ${humanize(value.learnerLevel)} · Task ${value.taskDifficulty}/5 · Pedagogy ${value.pedagogicalDifficulty}/5`;
}

export function renderStatusBadge(label: string, tone = "neutral"): string {
  return `<span class="status-badge status-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

export function renderDimensionPills(values: readonly string[]): string {
  return `<div class="pill-row">${values
    .map((value) => `<span class="dimension-pill">${escapeHtml(humanize(value))}</span>`)
    .join("")}</div>`;
}

export function renderMetric(label: string, value: string, detail?: string): string {
  return `<div class="metric"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>${
    detail === undefined ? "" : `<p>${escapeHtml(detail)}</p>`
  }</div>`;
}

export function renderEmptyState(title: string, message: string, action?: string): string {
  return `<section class="empty-state" aria-label="${escapeHtml(title)}">
    <span class="empty-mark" aria-hidden="true">—</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    ${action === undefined ? "" : `<span class="empty-action">${escapeHtml(action)}</span>`}
  </section>`;
}

export function renderCodeBlock(code: string, language = "text"): string {
  return `<pre class="code-block"><code data-language="${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
}

export function renderKeyValueList(items: readonly [string, string][]): string {
  return `<dl class="key-value-list">${items
    .map(
      ([key, value]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function navLink(
  labelKey: SiteUiTextKey,
  route: string,
  activeRoute: string,
  basePath: string,
  locale: SiteLocale,
): string {
  const active =
    activeRoute === route ||
    (route === "/data/" && activeRoute.startsWith("/data/"));
  return `<a href="${escapeHtml(sitePath(basePath, route))}"${active ? ' aria-current="page"' : ""}>${renderUiText(labelKey, locale)}</a>`;
}

function renderHeader(
  activeRoute: string,
  basePath: string,
  locale: SiteLocale,
): string {
  const isCaseSurface = activeRoute === "/data/cases/" || activeRoute.startsWith("/data/cases/");
  if (activeRoute === "/" || activeRoute === "/data/" || activeRoute === "/methodology/" || activeRoute === "/leaderboard/" || activeRoute === "/about/" || activeRoute === "/blog/" || isCaseSurface) {
    const links = [
      ["Home", "/"], ["Benchmark", "/data/"], ["Method", "/methodology/"],
      ["Results", "/leaderboard/"], ["Cases", "/data/cases/"], ["About", "/about/"],
      ["Blog", "/blog/"],
    ] as const;
    const benchmarkNavLabels: Readonly<Record<string, string>> = {
      Home: "首页", Benchmark: "基准", Method: "方法", Results: "结果", Cases: "案例", About: "关于", Blog: "博客",
    };
    const headerLabel = (label: string): string => activeRoute === "/data/" || activeRoute === "/methodology/" || isCaseSurface
      ? `<span data-ui-text="benchmark-nav" data-ui-text-en="${escapeHtml(label)}" data-ui-text-zh-cn="${escapeHtml(benchmarkNavLabels[label] ?? label)}">${escapeHtml(locale === "zh-CN" ? benchmarkNavLabels[label] ?? label : label)}</span>`
      : label;
    return `<header class="site-header home-header"><div class="shell header-inner">
      <a class="wordmark" href="${escapeHtml(sitePath(basePath, "/"))}" aria-label="Teachometry home"><img class="wordmark-mark" src="${escapeHtml(brandAssetPath(basePath, "web/tutorbench-mark-small.svg"))}" width="32" height="32" alt=""><span class="wordmark-copy"><span class="wordmark-name">Teachometry</span><span class="wordmark-descriptor">Measurement infrastructure<br>for AI tutoring</span></span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button>
      <nav id="primary-navigation" class="nav-links" aria-label="Primary navigation">${links.map(([label, route]) => `<a href="${escapeHtml(sitePath(basePath, route))}"${route === activeRoute || (route === "/data/cases/" && isCaseSurface) ? ' aria-current="page"' : ""}>${headerLabel(label)}</a>`).join("")}${activeRoute === "/data/" || activeRoute === "/methodology/" || activeRoute === "/leaderboard/" || isCaseSurface ? `<label class="locale-switcher"><span class="visually-hidden">${renderUiText("selectLanguage", locale)}</span><select data-locale-switcher aria-label="${escapeHtml(siteText(locale, "selectLanguage"))}"><option value="en"${locale === "en" ? " selected" : ""}>English</option><option value="zh-CN"${locale === "zh-CN" ? " selected" : ""}>简体中文</option></select></label>` : ""}</nav>
      <div class="home-header-tools"><div class="theme-controls" role="group" aria-label="Color theme"><button type="button" data-theme-choice="light" aria-label="Light theme" title="Light theme">${siteIcon("sun")}</button><button type="button" data-theme-choice="dark" aria-label="Dark theme" title="Dark theme">${siteIcon("moon")}</button></div><a class="github-link" href="${SITE_GITHUB_URL}" aria-label="GitHub repository" title="GitHub repository">${siteIcon("github")}</a><a class="button button-primary" href="${escapeHtml(sitePath(basePath, "/run/"))}">Get Started ${siteIcon("arrow")}</a></div>
    </div></header>`;
  }
  return `<header class="site-header">
    <div class="shell header-inner">
      <a class="wordmark" href="${escapeHtml(sitePath(basePath, "/"))}" aria-label="TutorBench home">
        <img class="wordmark-mark" src="${escapeHtml(brandAssetPath(basePath, "web/tutorbench-mark-small.svg"))}" width="32" height="32" alt="">
        <span class="wordmark-copy">
          <span class="wordmark-name">TutorBench</span>
          <span class="wordmark-descriptor">AI Tutor 评测基准</span>
        </span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button>
      <nav id="primary-navigation" class="nav-links" aria-label="Primary navigation">
        ${navLink("leaderboard", "/leaderboard/", activeRoute, basePath, locale)}
        ${navLink("data", "/data/", activeRoute, basePath, locale)}
        ${navLink("run", "/run/", activeRoute, basePath, locale)}
        ${navLink("methodology", "/methodology/", activeRoute, basePath, locale)}
        ${navLink("docs", "/docs/", activeRoute, basePath, locale)}
        ${navLink("community", "/community/", activeRoute, basePath, locale)}
        <a href="${escapeHtml(sitePath(basePath, "/blog/"))}"${activeRoute.startsWith("/blog/") ? ' aria-current="page"' : ""}>Blog</a>
        <a href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">GitHub ↗</a>
        <label class="locale-switcher">
          <span class="visually-hidden">${renderUiText("selectLanguage", locale)}</span>
          <select data-locale-switcher aria-label="${escapeHtml(siteText(locale, "selectLanguage"))}">
            <option value="en"${locale === "en" ? " selected" : ""}>${escapeHtml(siteText("en", "english"))}</option>
            <option value="zh-CN"${locale === "zh-CN" ? " selected" : ""}>${escapeHtml(siteText("zh-CN", "chinese"))}</option>
          </select>
        </label>
      </nav>
    </div>
  </header>`;
}

function renderFooter(benchmark: SiteFooterBenchmark, locale: SiteLocale): string {
  return `<footer class="site-footer">
    <div class="shell footer-grid">
      <div>
        <p class="footer-title">TutorBench</p>
        <p class="muted">A public, provider-independent explorer for observable tutoring behavior.</p>
      </div>
      <div>
        <p class="footer-title">${renderUiText("status", locale)}</p>
        <p>${renderStatusBadge(benchmark.statusLabel, "preview")}</p>
        <p class="muted">${locale === "zh-CN" ? "许可信息尚未最终确定。" : "Licensing is not finalized yet."}</p>
      </div>
      <div>
        <p class="footer-title">Source</p>
        <a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">Read the repository ↗</a>
        <p><a class="text-link" href="/blog/">Read the Teachometry blog →</a></p>
        <p class="muted">Dataset ${escapeHtml(benchmark.dataset.id)}@${escapeHtml(benchmark.dataset.version)}</p>
      </div>
    </div>
  </footer>`;
}

export function renderPage(page: SitePage, context: SiteRenderContext = {}): string {
  const basePath = normalizeSiteBasePath(context.basePath);
  const locale = resolveSiteLocale(context.locale);
  const siteUrl = context.siteUrl?.replace(/\/$/, "");
  const canonicalUrl = siteUrl === undefined ? undefined : `${siteUrl}${page.route}`;
  const isCaseDetailRoute = page.route.startsWith("/data/cases/") && page.route !== "/data/cases/";
  const isBlogIndex = page.route === "/blog/";
  const pageMarkup = `<!doctype html>
<html lang="${escapeHtml(locale)}" data-ui-locale="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(page.title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    ${canonicalUrl === undefined ? "" : `<meta property="og:url" content="${escapeHtml(canonicalUrl)}"><link rel="canonical" href="${escapeHtml(canonicalUrl)}">`}
    <link rel="icon" href="${escapeHtml(brandAssetPath(basePath, "raster/favicon.ico"))}" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="${escapeHtml(brandAssetPath(basePath, "raster/favicon-32.png"))}">
    <link rel="icon" type="image/png" sizes="16x16" href="${escapeHtml(brandAssetPath(basePath, "raster/favicon-16.png"))}">
    <link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/styles.css"))}">
    ${(page.route === "/" || page.route === "/data/" || page.route === "/methodology/" || page.route === "/about/" || page.route === "/data/cases/" || isCaseDetailRoute || isBlogIndex) ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/home.css"))}">` : ""}
    ${page.route === "/data/" ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/benchmark.css"))}">` : ""}
    ${page.route === "/methodology/" ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/methodology.css"))}">` : ""}
    ${page.route === "/leaderboard/" ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/results.css"))}">` : ""}
    ${page.route === "/data/cases/" ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/cases.css"))}">` : ""}
    ${isCaseDetailRoute ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/case-detail.css"))}">` : ""}
    ${page.route === "/about/" ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/about.css"))}">` : ""}
    ${isBlogIndex ? `<link rel="stylesheet" href="${escapeHtml(sitePath(basePath, "/assets/blog.css"))}">` : ""}
    <script src="${escapeHtml(sitePath(basePath, "/assets/site.js"))}" defer></script>
  </head>
  <body${page.route === "/" ? ' class="home-page"' : page.route === "/data/" ? ' class="home-page benchmark-page"' : page.route === "/methodology/" ? ' class="methodology-page"' : page.route === "/leaderboard/" ? ' class="results-page"' : page.route === "/about/" ? ' class="about-page"' : page.route === "/data/cases/" ? ' class="cases-page"' : isCaseDetailRoute ? ' class="case-detail-page"' : isBlogIndex ? ' class="blog-page"' : ""}>
    <a class="skip-link" href="#main-content">Skip to content</a>
    ${renderHeader(page.route, basePath, locale)}
    <main id="main-content">${page.content}</main>
    ${(page.route === "/" || page.route === "/data/" || page.route === "/methodology/" || page.route === "/leaderboard/" || page.route === "/about/" || page.route === "/data/cases/" || isCaseDetailRoute || isBlogIndex) ? "" : renderFooter(context.benchmark ?? ({
      statusLabel: "Developer Preview",
      dataset: { id: TUTOR_EVAL_DATASET_ID, version: TUTOR_EVAL_DATASET_VERSION },
    }), locale)}
  </body>
</html>
`;
  return prefixInternalPaths(pageMarkup, basePath);
}
