import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";
import { minifyCss, shareCardFor, withShareImage } from "../src/cli/spectrum-site.js";

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
  for (const file of ["robots.txt", "sitemap.xml"]) {
    assert.equal(await readFile(join(spectrum, file), "utf8"), await readFile(join(legacy, file), "utf8"));
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
  assert.match(home, /<title>Teachometry — Test how AI tutors behave before you ship them\.<\/title>/u);
  assert.match(home, /<meta name="robots" content="index,follow/u);
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.org\/tb\/">/u);
  assert.match(home, /<html lang="en" data-lang="en" data-route-lang="en" data-route-depth="0">/u);
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
