import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_PREVIOUS_DATASET_VERSION,
} from "../contracts/index.js";
import {
  buildPublicBenchmarkArtifacts,
  loadTutorEvalDataset,
  type PublicBenchmarkArtifacts,
} from "../datasets/index.js";
import {
  parseTutorEvaluationAuditArtifact,
  type TutorEvaluationAuditArtifact,
} from "../reporting/index.js";
import {
  createReviewTranslationLookup,
  parseReviewTranslationArtifact,
  type ReviewTranslationArtifact,
  type ReviewTranslationLookup,
} from "../review-translation/index.js";
import {
  renderPage,
  siteLocaleRoute,
  TUTORBENCH_BRAND_ASSET_PATHS,
  type SitePage,
} from "../site/html.js";
import {
  resolveSiteLocale,
  SITE_LOCALES,
  type SiteLocale,
} from "../site/i18n.js";
import {
  PUBLIC_SITE_BOTANICAL_ASSET_PATHS,
  PUBLIC_SITE_RASTER_ASSETS,
} from "../site/assets.js";
import {
  renderDataIndexPage,
  renderHomePage,
  renderLeaderboardPage,
  renderModelDetailPage,
  renderModelsPage,
} from "../site/pages/overview.js";
import {
  renderCaseDetailPage,
  renderCasesPage,
  renderHeatmapPage,
  renderTrialDetailPage,
  renderTrialsPage,
} from "../site/pages/data.js";
import {
  auditRoute,
  renderTutorEvaluationAuditIndexPage,
  renderTutorEvaluationAuditPage,
} from "../site/pages/audit.js";
import {
  renderAboutPage,
  renderDocsPage,
  renderMethodologyPage,
  renderRunPage,
} from "../site/pages/developer.js";
import { renderCommunityPage } from "../site/pages/community.js";
import { renderContactPage } from "../site/pages/contact.js";
import { renderTeachometryFooter } from "../site/pages/home.js";
import { renderNotFoundPage } from "../site/pages/not-found.js";
import {
  renderBlogIndexPage,
  renderClassroomDoesNotNeedRobotsPage,
  renderTeachingAndSupervisionPage,
  renderWhenLearningStartsToFeelLikeFailurePage,
  renderWhyTeachingDoesNotScalePage,
} from "../site/pages/blog.js";

const websiteRoot = resolve(process.cwd(), "website");
const defaultOutputDirectory = resolve(websiteRoot, "dist");
const privateOutputDirectory = resolve(websiteRoot, "private-dist");
const brandAssetRoot = resolve(process.cwd(), "assets", "brand", "tutorbench");

function requestedDatasetVersion(datasetId: string, datasetVersion: string): string | undefined {
  return datasetId === TUTOR_EVAL_DATASET_ID && datasetVersion === "0.2a"
    ? TUTOR_EVAL_PREVIOUS_DATASET_VERSION
    : datasetVersion;
}

function isWithinDirectory(candidate: string, directory: string): boolean {
  const resolvedCandidate = resolve(candidate);
  return resolvedCandidate === directory || resolvedCandidate.startsWith(`${directory}${process.platform === "win32" ? "\\" : "/"}`);
}

export interface BuildOptions {
  readonly outputDirectory?: string;
  readonly siteUrl?: string;
  readonly basePath?: string;
  readonly locale?: SiteLocale;
  /** Explicit local-only input; never loaded by the default public build. */
  readonly evaluationPath?: string;
  /** Optional local-only review translation sidecar for the private audit build. */
  readonly reviewTranslationPath?: string;
}

interface RoutePage {
  readonly outputRoute: string;
  readonly page: SitePage;
}

function pageOutputPath(outputDirectory: string, route: string): string {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, "");
  return normalizedRoute.length === 0
    ? join(outputDirectory, "index.html")
    : join(outputDirectory, normalizedRoute, "index.html");
}

async function writeJson(outputDirectory: string, filename: string, value: unknown): Promise<void> {
  const outputPath = join(outputDirectory, "public-data", filename);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function publicIndexablePages(pages: readonly SitePage[]): readonly SitePage[] {
  const seen = new Set<string>();
  return pages.filter((page) => {
    if (page.route === "/404.html" || page.route.includes("[") || page.seo?.noIndex === true || seen.has(page.route)) {
      return false;
    }
    seen.add(page.route);
    return true;
  });
}

async function writeDiscoveryFiles(
  outputDirectory: string,
  pages: readonly SitePage[],
  siteUrl: string | undefined,
  isPrivateBuild: boolean,
): Promise<void> {
  if (isPrivateBuild) {
    await writeFile(join(outputDirectory, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
    return;
  }
  const normalizedSiteUrl = siteUrl?.replace(/\/$/, "");
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    ...(normalizedSiteUrl === undefined ? [] : ["", `Sitemap: ${normalizedSiteUrl}/sitemap.xml`]),
    "",
  ].join("\n");
  await writeFile(join(outputDirectory, "robots.txt"), robots, "utf8");
  if (normalizedSiteUrl === undefined) return;
  const urls = publicIndexablePages(pages)
    .flatMap((page) =>
      SITE_LOCALES.map((locale) => {
        const loc = `${normalizedSiteUrl}${siteLocaleRoute(page.route, locale)}`;
        const alternates = [
          ...SITE_LOCALES.map(
            (alternateLocale) =>
              `    <xhtml:link rel="alternate" hreflang="${alternateLocale}" href="${xmlEscape(`${normalizedSiteUrl}${siteLocaleRoute(page.route, alternateLocale)}`)}"/>`,
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(`${normalizedSiteUrl}${siteLocaleRoute(page.route, "en")}`)}"/>`,
        ].join("\n");
        return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n${alternates}\n  </url>`;
      }),
    )
    .join("\n");
  await writeFile(
    join(outputDirectory, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
    "utf8",
  );
}

async function writePage(
  outputDirectory: string,
  page: SitePage,
  artifacts: PublicBenchmarkArtifacts,
  siteUrl: string | undefined,
  basePath: string | undefined,
  locale: SiteLocale,
  localizedRoutes: boolean,
): Promise<void> {
  const outputPath = pageOutputPath(
    outputDirectory,
    localizedRoutes ? siteLocaleRoute(page.route, locale) : page.route,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    renderPage(page, {
      benchmark: artifacts.benchmark,
      ...(siteUrl === undefined ? {} : { siteUrl }),
      ...(basePath === undefined ? {} : { basePath }),
      locale,
      localizedRoutes,
    }),
    "utf8",
  );
}

async function copyBrandAssets(outputDirectory: string): Promise<void> {
  const outputBrandRoot = join(outputDirectory, "assets", "brand", "tutorbench");
  for (const relativePath of TUTORBENCH_BRAND_ASSET_PATHS) {
    const sourcePath = join(brandAssetRoot, relativePath);
    const outputPath = join(outputBrandRoot, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);
  }
}

interface LocalAuditBuildData {
  readonly artifact: TutorEvaluationAuditArtifact;
  readonly dataset: Awaited<ReturnType<typeof loadTutorEvalDataset>>;
  readonly reviewTranslation?: ReviewTranslationArtifact;
}

function routePages(
  artifacts: PublicBenchmarkArtifacts,
  audit: LocalAuditBuildData | undefined,
  locale: SiteLocale,
  packageVersion: string,
): readonly RoutePage[] {
  const reviewTranslationLookup: ReviewTranslationLookup | undefined = audit === undefined
    ? undefined
    : createReviewTranslationLookup(audit.artifact.evaluation, audit.reviewTranslation);
  const pages: RoutePage[] = [
    { outputRoute: "/", page: renderHomePage(artifacts, locale) },
    { outputRoute: "/leaderboard/", page: renderLeaderboardPage(artifacts, locale) },
    { outputRoute: "/models/", page: renderModelsPage(artifacts, locale) },
    { outputRoute: "/models/[modelId]/", page: renderModelDetailPage(artifacts, locale) },
    { outputRoute: "/data/", page: renderDataIndexPage(artifacts, locale) },
    { outputRoute: "/data/cases/", page: renderCasesPage(artifacts, locale) },
    { outputRoute: "/data/heatmap/", page: renderHeatmapPage(artifacts, locale) },
    { outputRoute: "/data/trials/", page: renderTrialsPage(artifacts, locale) },
    { outputRoute: "/data/trials/[trialId]/", page: renderTrialDetailPage(artifacts, locale) },
    { outputRoute: "/run/", page: renderRunPage(artifacts, locale) },
    { outputRoute: "/methodology/", page: renderMethodologyPage(artifacts, locale) },
    { outputRoute: "/docs/", page: renderDocsPage(artifacts, locale) },
    { outputRoute: "/about/", page: renderAboutPage(artifacts, packageVersion, locale) },
    { outputRoute: "/community/", page: renderCommunityPage(artifacts, locale) },
    { outputRoute: "/contact/", page: renderContactPage(artifacts) },
  ];
  const routePages = [
    ...pages,
    ...artifacts.cases.cases.map((caseArtifact) => ({
      outputRoute: `/data/cases/${encodeURIComponent(caseArtifact.id)}/`,
      page: renderCaseDetailPage(artifacts, caseArtifact, locale),
    })),
  ];
  if (audit !== undefined) {
    routePages.push({
      outputRoute: `/audit/runs/${encodeURIComponent(audit.artifact.evaluation.runId)}/`,
      page: renderTutorEvaluationAuditIndexPage({
        artifact: audit.artifact,
        dataset: audit.dataset,
        locale,
        ...(reviewTranslationLookup === undefined ? {} : { reviewTranslation: reviewTranslationLookup }),
      }),
    });
    for (const caseResult of audit.artifact.evaluation.caseResults) {
      routePages.push({
        outputRoute: auditRoute(
          audit.artifact.evaluation.runId,
          caseResult.caseId,
          caseResult.runIndex,
        ),
        page: renderTutorEvaluationAuditPage({
          artifact: audit.artifact,
          dataset: audit.dataset,
          caseId: caseResult.caseId,
          runIndex: caseResult.runIndex,
          locale,
          ...(reviewTranslationLookup === undefined ? {} : { reviewTranslation: reviewTranslationLookup }),
        }),
      });
    }
  }
  return routePages;
}

export async function buildWebsite(options: BuildOptions = {}): Promise<number> {
  const outputDirectory = options.outputDirectory ?? defaultOutputDirectory;
  if (options.evaluationPath !== undefined && !isWithinDirectory(outputDirectory, privateOutputDirectory)) {
    throw new Error("Evaluation artifacts can only be rendered under website/private-dist.");
  }
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
  const artifacts = buildPublicBenchmarkArtifacts(dataset);
  const packageMetadata = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf8"),
  ) as unknown;
  if (
    typeof packageMetadata !== "object" ||
    packageMetadata === null ||
    typeof (packageMetadata as { readonly version?: unknown }).version !== "string"
  ) {
    throw new Error("package.json must expose a string version for the public website ledger.");
  }
  const packageVersion = (packageMetadata as { readonly version: string }).version;
  const locale = options.locale ?? "en";
  let audit: LocalAuditBuildData | undefined;
  if (options.evaluationPath !== undefined) {
    const evaluationValue = JSON.parse(
      await readFile(options.evaluationPath, "utf8"),
    ) as unknown;
    const artifact = parseTutorEvaluationAuditArtifact(evaluationValue);
    let reviewTranslation: ReviewTranslationArtifact | undefined;
    if (options.reviewTranslationPath !== undefined) {
      try {
        reviewTranslation = parseReviewTranslationArtifact(
          JSON.parse(await readFile(options.reviewTranslationPath, "utf8")) as unknown,
        );
      } catch {
        // Review translation is optional review evidence; invalid or missing
        // sidecars must leave the original audit artifact fully readable.
        reviewTranslation = undefined;
      }
    }
    audit = {
      artifact,
      dataset: await loadTutorEvalDataset(
        artifact.evaluation.datasetId,
        requestedDatasetVersion(
          artifact.evaluation.datasetId,
          artifact.evaluation.datasetVersion,
        ),
      ),
      ...(reviewTranslation === undefined ? {} : { reviewTranslation }),
    };
  }
  const stylesheet = await readFile(join(websiteRoot, "src", "styles.css"), "utf8");
  const clientScript = await readFile(join(websiteRoot, "src", "site.js"), "utf8");

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(join(outputDirectory, "assets"), { recursive: true });
  await writeFile(join(outputDirectory, "assets", "styles.css"), stylesheet, "utf8");
  await writeFile(join(outputDirectory, "assets", "site.js"), clientScript, "utf8");
  await copyFile(join(websiteRoot, "src", "home.css"), join(outputDirectory, "assets", "home.css"));
  await copyFile(join(websiteRoot, "src", "benchmark.css"), join(outputDirectory, "assets", "benchmark.css"));
  await copyFile(join(websiteRoot, "src", "methodology.css"), join(outputDirectory, "assets", "methodology.css"));
  await copyFile(join(websiteRoot, "src", "results.css"), join(outputDirectory, "assets", "results.css"));
  await copyFile(join(websiteRoot, "src", "cases.css"), join(outputDirectory, "assets", "cases.css"));
  await copyFile(join(websiteRoot, "src", "case-detail.css"), join(outputDirectory, "assets", "case-detail.css"));
  await copyFile(join(websiteRoot, "src", "about.css"), join(outputDirectory, "assets", "about.css"));
  await copyFile(join(websiteRoot, "src", "community.css"), join(outputDirectory, "assets", "community.css"));
  await copyFile(join(websiteRoot, "src", "blog.css"), join(outputDirectory, "assets", "blog.css"));
  await copyFile(join(websiteRoot, "src", "models.css"), join(outputDirectory, "assets", "models.css"));
  await copyFile(join(websiteRoot, "src", "teachometry.css"), join(outputDirectory, "assets", "teachometry.css"));
  await copyFile(join(websiteRoot, "src", "explorers.css"), join(outputDirectory, "assets", "explorers.css"));
  await copyFile(join(websiteRoot, "src", "run.css"), join(outputDirectory, "assets", "run.css"));
  await copyFile(join(websiteRoot, "src", "docs.css"), join(outputDirectory, "assets", "docs.css"));
  await copyFile(join(websiteRoot, "src", "contact.css"), join(outputDirectory, "assets", "contact.css"));
  await copyFile(join(websiteRoot, "src", "x-logo.svg"), join(outputDirectory, "assets", "x-logo.svg"));
  await copyFile(join(websiteRoot, "src", "not-found.css"), join(outputDirectory, "assets", "not-found.css"));
  for (const asset of PUBLIC_SITE_RASTER_ASSETS) {
    const destination = join(outputDirectory, "assets", asset);
    await copyFile(join(websiteRoot, "src", "images", asset), destination);
  }
  for (const asset of PUBLIC_SITE_BOTANICAL_ASSET_PATHS) {
    const destination = join(outputDirectory, "assets", asset);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(websiteRoot, "src", "assets", asset), destination);
  }
  await copyBrandAssets(outputDirectory);
  await writeJson(outputDirectory, "benchmark.json", artifacts.benchmark);
  await writeJson(outputDirectory, "cases.json", artifacts.cases);
  await writeJson(outputDirectory, "models.json", artifacts.models);
  await writeJson(outputDirectory, "trials.json", artifacts.trials);

  const isPrivateBuild = options.evaluationPath !== undefined;
  const buildLocales: readonly SiteLocale[] = isPrivateBuild ? [locale] : SITE_LOCALES;
  let routeCount = 0;
  let discoveryPages: readonly SitePage[] = [];

  for (const buildLocale of buildLocales) {
    const pages = routePages(artifacts, audit, buildLocale, packageVersion);
    routeCount ||= pages.length;
    for (const routePage of pages) {
      await writePage(
        outputDirectory,
        routePage.page,
        artifacts,
        options.siteUrl,
        options.basePath,
        buildLocale,
        !isPrivateBuild,
      );
    }

    const blogPages = [
      renderBlogIndexPage(renderTeachometryFooter(artifacts)),
      renderWhenLearningStartsToFeelLikeFailurePage(renderTeachometryFooter(artifacts), buildLocale),
      renderClassroomDoesNotNeedRobotsPage(renderTeachometryFooter(artifacts), buildLocale),
      renderWhyTeachingDoesNotScalePage(renderTeachometryFooter(artifacts), buildLocale),
      renderTeachingAndSupervisionPage(renderTeachometryFooter(artifacts), buildLocale),
    ];
    for (const blogPage of blogPages) {
      await writePage(
        outputDirectory,
        blogPage,
        artifacts,
        options.siteUrl,
        options.basePath,
        buildLocale,
        !isPrivateBuild,
      );
    }

    if (buildLocale === "en" || discoveryPages.length === 0) {
      discoveryPages = [...pages.map((entry) => entry.page), ...blogPages];
    }

    const notFoundPath =
      !isPrivateBuild && buildLocale === "zh-CN"
        ? join(outputDirectory, "zh-cn", "404.html")
        : join(outputDirectory, "404.html");
    await mkdir(dirname(notFoundPath), { recursive: true });
    await writeFile(
      notFoundPath,
      renderPage(renderNotFoundPage(artifacts), {
        benchmark: artifacts.benchmark,
        ...(options.siteUrl === undefined ? {} : { siteUrl: options.siteUrl }),
        ...(options.basePath === undefined ? {} : { basePath: options.basePath }),
        locale: buildLocale,
        localizedRoutes: !isPrivateBuild,
      }),
      "utf8",
    );
  }

  await writeDiscoveryFiles(
    outputDirectory,
    discoveryPages,
    options.siteUrl,
    isPrivateBuild,
  );

  return routeCount;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const outputArgumentIndex = args.indexOf("--output");
  const outputArgument =
    outputArgumentIndex === -1 ? undefined : args[outputArgumentIndex + 1];
  if (outputArgumentIndex !== -1 && (outputArgument === undefined || outputArgument.startsWith("--"))) {
    throw new Error("Website output directory is required after --output.");
  }
  const outputDirectory =
    outputArgument === undefined ? defaultOutputDirectory : resolve(process.cwd(), outputArgument);
  const evaluationArgumentIndex = args.indexOf("--evaluation");
  const evaluationArgument = evaluationArgumentIndex === -1
    ? undefined
    : args[evaluationArgumentIndex + 1];
  if (
    evaluationArgumentIndex !== -1 &&
    (evaluationArgument === undefined || evaluationArgument.startsWith("--"))
  ) {
    throw new Error("Evaluation artifact path is required after --evaluation.");
  }
  const reviewTranslationArgumentIndex = args.indexOf("--review-translation");
  const reviewTranslationArgument = reviewTranslationArgumentIndex === -1
    ? undefined
    : args[reviewTranslationArgumentIndex + 1];
  if (
    reviewTranslationArgumentIndex !== -1 &&
    (reviewTranslationArgument === undefined || reviewTranslationArgument.startsWith("--"))
  ) {
    throw new Error("Review translation sidecar path is required after --review-translation.");
  }
  if (reviewTranslationArgument !== undefined && evaluationArgument === undefined) {
    throw new Error("--review-translation requires --evaluation.");
  }
  const localeArgumentIndex = args.indexOf("--locale");
  const localeArgument = localeArgumentIndex === -1
    ? undefined
    : args[localeArgumentIndex + 1];
  if (
    localeArgumentIndex !== -1 &&
    (localeArgument === undefined || localeArgument.startsWith("--"))
  ) {
    throw new Error("Locale is required after --locale.");
  }
  const websitePrefix = `${websiteRoot}${process.platform === "win32" ? "\\" : "/"}`;
  if (
    outputDirectory !== websiteRoot &&
    !outputDirectory.startsWith(websitePrefix)
  ) {
    throw new Error("Website output must stay inside the website directory.");
  }
  if (
    evaluationArgument !== undefined &&
    !isWithinDirectory(outputDirectory, privateOutputDirectory)
  ) {
    throw new Error("--evaluation requires an output directory under website/private-dist.");
  }
  const siteUrl = process.env.TUTOR_BENCHMARK_SITE_URL?.trim() || undefined;
  const basePath = process.env.TUTOR_BENCHMARK_SITE_BASE_PATH?.trim() || undefined;
  const routeCount = await buildWebsite({
    outputDirectory,
    locale: resolveSiteLocale(localeArgument),
    ...(evaluationArgument === undefined
      ? {}
      : { evaluationPath: resolve(process.cwd(), evaluationArgument) }),
    ...(reviewTranslationArgument === undefined
      ? {}
      : { reviewTranslationPath: resolve(process.cwd(), reviewTranslationArgument) }),
    ...(siteUrl === undefined ? {} : { siteUrl }),
    ...(basePath === undefined ? {} : { basePath }),
  });
  console.log(`Built Tutor Benchmark website: ${outputDirectory}`);
  console.log(`Routes: ${routeCount}`);
  console.log(
    evaluationArgument === undefined
      ? `UI locales: ${SITE_LOCALES.join(", ")}`
      : `UI locale: ${resolveSiteLocale(localeArgument)}`,
  );
  if (evaluationArgument !== undefined) {
    console.log("Local audit pages: enabled (private-dist only)");
  }
  console.log("Public model rankings: none");
  console.log("Secrets required: none");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Website build failed.");
    process.exitCode = 1;
  }
}
