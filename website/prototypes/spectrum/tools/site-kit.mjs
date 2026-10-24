// Shared pieces for the Spectrum section generators (build-journal.mjs, build-methodology.mjs, ...):
// the live site's zh-CN copy, bilingual markup helpers, and the page frame (head, bar, footer) taken
// from the homepage prototype so every section stays in the same magazine.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const PROTO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = join(PROTO, "..", "..", "..");
const { SITE_ZH_CN_COPY } = await import(join(REPO, "dist/src/site/locale-copy.js"));

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** the live site's own Chinese for an English string; throws rather than letting a gap through */
export function Z(en) {
  const zh = SITE_ZH_CN_COPY[en];
  if (zh === undefined) {
    // ZLIST=1 lists every gap in one run instead of stopping at the first
    if (globalThis.process?.env.ZLIST) { (globalThis.__zmiss ??= new Set()).add(en); return `⟦${en}⟧`; }
    throw new Error(`No zh-CN copy for: ${en.slice(0, 80)}`);
  }
  return zh;
}
/** inline pair (already-escaped HTML) */
export const bi = (en, zh = Z(en)) => `<span class="en">${en}</span><span class="zh" lang="zh-CN">${zh}</span>`;
/** inline pair from plain text */
export const biE = (en, zh = Z(en)) => bi(esc(en), esc(zh));
/** block pair */
export const biP = (tag, cls, en, zh) => `<${tag} class="en${cls ? " " + cls : ""}">${en}</${tag}><${tag} class="zh${cls ? " " + cls : ""}" lang="zh-CN">${zh}</${tag}>`;
export const biPE = (tag, cls, en, zh = Z(en)) => biP(tag, cls, esc(en), esc(zh));
/** the live Chinese when the site has it, otherwise our own (for strings the live site leaves untranslated) */
export const Zor = (en, zh) => SITE_ZH_CN_COPY[en] ?? zh;

export const RENDERED = ["Rendered in Blender.", "Blender 渲染。"];

const INDEX = readFileSync(join(PROTO, "index.html"), "utf8");
const cut = (a, b) => { const i = INDEX.indexOf(a); const j = INDEX.indexOf(b, i); if (i < 0 || j < 0) throw new Error(`frame: ${a}`); return INDEX.slice(i, j + b.length); };
function rel(html, prefix) {
  return html.replace(/(href|src)="([^"]*)"/g, (m, attr, v) => {
    if (/^(https?:|mailto:|data:|\/)/.test(v)) return m;
    if (v.startsWith("#")) return `${attr}="${prefix}index.html${v === "#top" ? "" : v}"`;
    return `${attr}="${prefix}${v}"`;
  });
}
// homepage anchors that now have a page of their own
const PAGES = { essays: ["blog/index.html", "journal"], dispersion: ["methodology/index.html", "method"], plates: ["data/cases/index.html", "cases"], results: ["leaderboard/index.html", "results"] };

export function frame({ prefix, title, titleZh, description, body, current, css = [], scripts = [] }) {
  let head = INDEX.slice(0, INDEX.indexOf("</head>"));
  head = head.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace('<link rel="stylesheet" href="spectrum.css">', ['<link rel="stylesheet" href="spectrum.css">', ...css.map((c) => `<link rel="stylesheet" href="${c}">`)].join("\n"));
  head = rel(head, prefix);
  let bar = rel(cut('<header class="bar"', "</header>"), prefix);
  let foot = rel(cut('<footer class="foot"', "</footer>"), prefix);
  for (const [anchor, [page, key]] of Object.entries(PAGES)) {
    bar = bar.replace(`<a href="${prefix}index.html#${anchor}">`, `<a href="${prefix}${page}"${current === key ? ' aria-current="page"' : ""}>`);
    foot = foot.replace(`<a href="${prefix}index.html#${anchor}">`, `<a href="${prefix}${page}">`);
  }
  foot = foot.replace("The cover kaleidoscope and gems are rendered in Blender (Cycles).", "The section covers and photographs are rendered in Blender (Cycles).")
    .replace("封面万花筒与宝石由 Blender（Cycles）渲染。", "各栏目封面与图版由 Blender（Cycles）渲染。");
  return `${head}</head>
<body>
<a class="skip" href="#main">${bi("Skip to content", "跳到正文")}</a>

${bar}

${body}

${foot}

<script src="${prefix}spectrum.js"></script>
${scripts.map((js) => `<script src="${prefix}${js}"></script>\n`).join("")}<script>
  // bilingual alt text and tab title follow the language toggle
  (function () {
    var T = { en: ${JSON.stringify(title)}, zh: ${JSON.stringify(titleZh)} };
    function apply() {
      var zh = document.documentElement.getAttribute("data-lang") === "zh";
      document.title = zh ? T.zh : T.en;
      Array.prototype.forEach.call(document.querySelectorAll("img[data-alt-en]"), function (im) { im.alt = im.getAttribute(zh ? "data-alt-zh" : "data-alt-en"); });
    }
    apply(); document.addEventListener("langchange", apply);
  })();
</script>
</body>
</html>
`;
}
