import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

/**
 * Publishes the Spectrum redesign (website/prototypes/spectrum) as the public site.
 *
 * The redesign is written as one bilingual page per route, with relative links. The public site
 * keeps every existing URL, so each page is written twice: in English at its route and in
 * Chinese under /zh-cn/. The search and sharing metadata (title, description, robots, Open Graph,
 * canonical, hreflang, structured data) is taken from the existing generated page for the same
 * route, so those facts do not change with the new design.
 */
export interface SpectrumSiteOptions {
  readonly prototypeRoot: string;
  readonly outputDirectory: string;
  /** Normalized project-site path such as "/tutorbench", or "" at the domain root. */
  readonly basePath: string;
  /** Existing generated pages by output path ("about/index.html", "zh-cn/about/index.html"). */
  readonly legacyPages: ReadonlyMap<string, string>;
}

const ZH_PREFIX = "zh-cn/";
const NOT_FOUND = "404.html";
/** The model detail template has its own folder in the redesign; the public URL stays /models/[modelId]/. */
const PAGE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "models/profile/index.html": ["models/profile/index.html", "models/[modelId]/index.html"],
};
/** Existing routes without a page of their own in the redesign: they send the reader to the closest page. */
const REDIRECTS: Readonly<Record<string, string>> = {
  "data/trials/[trialId]/index.html": "data/trials/index.html",
};

export function isSpectrumSiteFile(relativePath: string): boolean {
  const [top] = relativePath.split("/");
  if (top === "render" || top === "tools") return false;
  if (relativePath === "README.md" || relativePath === "journal-sample.html") return false;
  // only the K_ cover sequence is used; earlier cover renders stay in the repository
  return !/^assets\/cover\/(?!K_)/.test(relativePath);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function shippedFiles(prototypeRoot: string): Promise<string[]> {
  const entries = await readdir(prototypeRoot, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(prototypeRoot.length + 1).replaceAll("\\", "/"))
    .filter(isSpectrumSiteFile)
    .sort();
}

const cleanPage = (path: string): string => path.replace(/(^|\/)index\.html$/u, "$1");

interface PageContext {
  /** the page's path in the prototype */
  readonly source: string;
  /** where it is published */
  readonly output: string;
  readonly zh: boolean;
  /** write root-relative URLs (the 404 page is served at any depth) */
  readonly absolute: boolean;
  readonly pages: ReadonlySet<string>;
  readonly basePath: string;
}

function mapUrl(value: string, context: PageContext): string {
  if (value === "" || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/iu.test(value)) return value;
  const match = /^([^?#]*)(.*)$/su.exec(value);
  const path = match?.[1] ?? "";
  const suffix = match?.[2] ?? "";
  let target = posix.normalize(posix.join(posix.dirname(context.source), path));
  if (target === "." || target === "./") target = "";
  if (target.startsWith("..")) throw new Error(`Spectrum page ${context.source} links outside the site: ${value}`);
  const pageTarget = target === "" || target.endsWith("/") ? `${target}index.html` : target;
  const isPage = context.pages.has(pageTarget) || context.pages.has(`${target}/index.html`);
  let mapped = target;
  if (isPage) {
    mapped = cleanPage(context.pages.has(pageTarget) ? pageTarget : `${target}/index.html`);
    if (context.zh) mapped = `${ZH_PREFIX}${mapped}`;
  }
  if (context.absolute) return `${context.basePath}/${mapped}${suffix}`;
  const directoryLike = mapped === "" || mapped.endsWith("/");
  let relative = posix.relative(posix.dirname(context.output), mapped);
  if (directoryLike) relative = relative === "" ? "./" : `${relative}/`;
  return `${relative}${suffix}`;
}

function rewriteUrls(html: string, context: PageContext): string {
  // inline scripts build markup from strings: rewrite a <script> element's own tag, never its body
  return html
    .split(/(<script\b[^>]*>[\s\S]*?<\/script>)/u)
    .map((part, index) => index % 2 === 1
      ? part.replace(/^<script\b[^>]*>/u, (tag) => rewriteAttributes(tag, context))
      : rewriteAttributes(part, context))
    .join("");
}

function rewriteAttributes(html: string, context: PageContext): string {
  return html
    .replace(/(\s(?:href|src|poster))="([^"]*)"/gu, (_match, attribute: string, value: string) => `${attribute}="${mapUrl(value, context)}"`)
    .replace(/(\ssrcset)="([^"]*)"/gu, (_match, attribute: string, value: string) => `${attribute}="${value
      .split(",")
      .map((candidate) => {
        const [url = "", ...descriptor] = candidate.trim().split(/\s+/u);
        return [mapUrl(url, context), ...descriptor].join(" ");
      })
      .join(", ")}"`);
}

function legacyHead(html: string, key: string): string {
  const start = html.indexOf("<title>");
  const end = html.indexOf('<link rel="icon"');
  if (start < 0 || end < start) throw new Error(`Existing page ${key} has no metadata block.`);
  return html
    .slice(start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

const escapeAttribute = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

function counterpart(output: string): string {
  return output.startsWith(ZH_PREFIX) ? output.slice(ZH_PREFIX.length) : `${ZH_PREFIX}${output}`;
}

function renderPage(html: string, context: PageContext, head: string): string {
  const metadata = /<title>[\s\S]*?<meta name="robots" content="[^"]*">/u;
  if (!metadata.test(html)) throw new Error(`Spectrum page ${context.source} has no title/description/robots block.`);
  const target = cleanPage(counterpart(context.output));
  const relative = posix.relative(posix.dirname(context.output), target);
  const alternate = target === "" || target.endsWith("/") ? (relative === "" ? "./" : `${relative}/`) : relative;
  const language = context.zh ? "zh" : "en";
  // The 404 page answers at any address, so it switches language in place (browser language or the
  // reader's saved choice) instead of sending the reader to the other language's 404.
  const root = context.absolute
    ? `<html lang="${context.zh ? "zh-CN" : "en"}" data-lang="${language}">`
    : `<html lang="${context.zh ? "zh-CN" : "en"}" data-lang="${language}" data-route-lang="${language}" data-alt-href="${escapeAttribute(alternate)}">`;
  if (!/<html lang="en" data-lang="en">/u.test(html)) throw new Error(`Spectrum page ${context.source} has an unexpected <html> tag.`);
  return rewriteUrls(
    html.replace(/<html lang="en" data-lang="en">/u, root).replace(metadata, () => head),
    context,
  );
}

function redirectPage(target: string, output: string, zh: boolean): string {
  const relative = posix.relative(posix.dirname(output), cleanPage(target));
  const href = relative === "" ? "./" : target.endsWith("index.html") ? `${relative}/` : relative;
  return `<!doctype html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${escapeAttribute(href)}">
<title>Teachometry</title>
</head>
<body>
<p><a href="${escapeAttribute(href)}">${zh ? "前往 Teachometry" : "Continue to Teachometry"}</a></p>
</body>
</html>
`;
}

export async function installSpectrumSite(options: SpectrumSiteOptions): Promise<number> {
  const { prototypeRoot, outputDirectory, basePath, legacyPages } = options;
  const files = await shippedFiles(prototypeRoot);
  const pages = new Set(files.filter((file) => file.endsWith(".html")));
  const written = new Set<string>();
  const write = async (output: string, content: string): Promise<void> => {
    if (written.has(output)) throw new Error(`Spectrum site writes ${output} twice.`);
    written.add(output);
    const destination = join(outputDirectory, output);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");
  };

  for (const file of files) {
    if (pages.has(file)) continue;
    const destination = join(outputDirectory, file);
    if (await exists(destination)) throw new Error(`Spectrum asset ${file} would replace an existing site file.`);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(prototypeRoot, file), destination);
  }

  for (const source of pages) {
    const html = await readFile(join(prototypeRoot, source), "utf8");
    for (const target of PAGE_ALIASES[source] ?? [source]) {
      for (const zh of [false, true]) {
        const output = zh ? `${ZH_PREFIX}${target}` : target;
        // the redesign's own model template folder has no existing page: it borrows the
        // /models/[modelId]/ metadata, which is already noindex
        const legacyKey = target === "models/profile/index.html" ? output.replace("models/profile/", "models/[modelId]/") : output;
        const legacy = legacyPages.get(legacyKey);
        if (legacy === undefined) throw new Error(`Spectrum page ${output} has no existing page to take metadata from.`);
        const context: PageContext = { source, output, zh, absolute: source === NOT_FOUND, pages, basePath };
        await write(output, renderPage(html, context, legacyHead(legacy, legacyKey)));
      }
    }
  }

  for (const [route, target] of Object.entries(REDIRECTS)) {
    for (const zh of [false, true]) {
      const output = zh ? `${ZH_PREFIX}${route}` : route;
      await write(output, redirectPage(zh ? `${ZH_PREFIX}${target}` : target, output, zh));
    }
  }
  // the review preview moved to the root
  await write("spectrum/index.html", redirectPage("index.html", "spectrum/index.html", false));

  const missing = [...legacyPages.keys()].filter((key) => !written.has(key));
  if (missing.length > 0) throw new Error(`Spectrum site drops existing routes: ${missing.join(", ")}`);
  return written.size;
}
