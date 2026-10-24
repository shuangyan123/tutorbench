// Builds the Cases section of the Spectrum prototype, in English and 简体中文 on one page each:
//   data/cases/index.html          the case library (search, eight filters, sort, two views, pages)
//   data/cases/<id>/index.html     one case file per public case (48), matching the live routes
//   data/index.html                the benchmark overview: snapshot, three ways in, dataset coverage
//   data/heatmap/index.html        the evidence matrix, still reserved: no public model runs exist
// It mirrors renderCasesPage / renderCaseDetailPage / renderHeatmapPage in src/site/pages/data.ts and
// reads the same public artifacts. Interface strings go through the live SITE_ZH_CN_COPY; case content
// stays in the case's own language, exactly as published.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-cases.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, Zor, bi, biE, biPE, frame, RENDERED } from "./site-kit.mjs";

const L = await import(join(REPO, "dist/src/site/public-localization.js"));
const F = await import(join(REPO, "dist/src/site/public-localization-formatters.js"));
const { humanize } = await import(join(REPO, "dist/src/site/html.js"));
const { siteText } = await import(join(REPO, "dist/src/site/i18n.js"));
const read = (f) => JSON.parse(readFileSync(join(REPO, "website/dist/public-data", f), "utf8"));
const cases = read("cases.json"), benchmark = read("benchmark.json"), trials = read("trials.json"), models = read("models.json");
const ALL = cases.cases, TOTAL = ALL.length;
const GITHUB = "https://github.com/shuangyan123/tutorbench";
const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;

/** a taxonomy value in both interface languages */
const tax = (v) => bi(esc(L.displayTaxonomyLabel(v, "en")), esc(L.displayTaxonomyLabel(v, "zh-CN")));
const NS = ["Not specified", Z("Not specified")];
const diff = (c, k) => (typeof c.metadata.difficulty === "object" && c.metadata.difficulty !== null ? String(c.metadata.difficulty[k]) : "");
const level = (c) => { const v = diff(c, "learnerLevel"); return v ? tax(v) : bi(...NS.map(esc)); };
const outOf5 = (v) => bi(`${esc(L.publicUiCopy("Level", "en"))} ${v} / 5`, `${esc(L.publicUiCopy("Level", "zh-CN"))} ${v} / 5`);
const state = (c) => (c.metadata.studentState ? tax(c.metadata.studentState) : bi(...NS.map(esc)));
const loc = (c) => c.locale ?? "en";
const localeName = (v) => (v === "en" ? bi(esc(siteText("en", "localeEnglish")), esc(siteText("zh-CN", "localeEnglish")))
  : v === "zh-CN" ? bi(esc(siteText("en", "localeChinese")), esc(siteText("zh-CN", "localeChinese"))) : esc(v));
const excerpt = (v, n) => { const t = v.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const caseHref = (prefix, id) => `${prefix}${encodeURIComponent(id)}/index.html`;

// ---------------------------------------------------------------- the library
function facets(get, label) {
  const counts = new Map();
  for (const c of ALL) for (const v of get(c)) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count, label: label(value), sortKey: typeof label(value) === "string" ? label(value) : value }))
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey), "en", { numeric: true }));
}
const enLabel = (v) => L.displayTaxonomyLabel(v, "en");
const GROUPS = [
  ["subject", "Subject", "All subjects", facets((c) => [c.metadata.subject], enLabel), (v) => tax(v)],
  ["learnerLevel", "Learner level", "All levels", facets((c) => [diff(c, "learnerLevel")], enLabel), (v) => tax(v)],
  ["taskDifficulty", "Task difficulty", "All difficulties", facets((c) => [diff(c, "taskDifficulty")], (v) => v), outOf5],
  ["pedagogicalDifficulty", "Pedagogical difficulty", "All difficulties", facets((c) => [diff(c, "pedagogicalDifficulty")], (v) => v), outOf5],
  ["capability", "Capability focus", "All capabilities", facets((c) => c.metadata.capabilityTags ?? [], enLabel), (v) => tax(v)],
  ["studentState", "Student state", "All states", facets((c) => (c.metadata.studentState ? [c.metadata.studentState] : []), enLabel), (v) => tax(v)],
  ["locale", "Locale", "All locales", facets((c) => [loc(c)], (v) => v), localeName],
  ["disclosurePolicy", "Disclosure policy", "All policies", facets((c) => (c.disclosurePolicy ? [c.disclosurePolicy] : []), enLabel), (v) => tax(v)],
];
function group([key, label, all, list, show]) {
  const opts = list.map((f) => `<label class="cx-opt"><input type="checkbox" data-case-filter="${key}" value="${esc(f.value)}"><span>${show(f.value)}</span><small>${f.count}</small></label>`).join("");
  return `<fieldset class="cx-group" data-case-filter-group="${key}"><legend><span>${biE(label)}</span><button type="button" class="cx-clear" data-case-filter-clear="${key}">${biE("Clear")}</button></legend>
          <div class="cx-opts"><label class="cx-opt cx-all"><input type="checkbox" data-case-filter="${key}" data-case-filter-all value="" checked><span>${biE(all)}</span><small>${TOTAL}</small></label>${opts}</div></fieldset>`;
}

function card(c) {
  const tags = c.metadata.capabilityTags ?? [];
  const search = [c.id, c.metadata.subject, c.metadata.topic, c.tutorInput.learningObjective, c.tutorInput.studentMessage, ...tags].join(" ");
  const attrs = `data-case-item data-case-id="${esc(c.id)}" data-case-locale="${esc(loc(c))}" data-case-subject="${esc(c.metadata.subject)}" data-case-learner-level="${esc(diff(c, "learnerLevel"))}" data-case-task-difficulty="${esc(diff(c, "taskDifficulty"))}" data-case-pedagogical-difficulty="${esc(diff(c, "pedagogicalDifficulty"))}" data-case-capabilities="${esc(tags.join(" "))}" data-case-student-state="${esc(c.metadata.studentState ?? "")}" data-case-disclosure-policy="${esc(c.disclosurePolicy ?? "")}" data-case-search-text="${esc(search)}"`;
  return `<li class="cx-card" ${attrs}>
          <a href="${caseHref("", c.id)}">
            <span class="cx-card-top"><span class="cx-id">${esc(c.id)}</span><span class="cx-subj">${tax(c.metadata.subject)}</span></span>
            <span class="cx-topic" lang="${esc(loc(c))}">${esc(humanize(c.metadata.topic))}</span>
            <span class="cx-msg" lang="${esc(loc(c))}">“${esc(excerpt(c.tutorInput.studentMessage, 170))}”</span>
            <span class="cx-tags">${tags.slice(0, 4).map((t) => `<span>${tax(t)}</span>`).join("")}</span>
            <span class="cx-meta"><span>${level(c)}</span><span>${state(c)}</span><span class="cx-loc">${esc(loc(c))}</span></span>
            <span class="cx-view">${biE("View case")} ${ARROW}</span>
          </a>
        </li>`;
}

function libraryPage(cover) {
  const example = ALL.find((c) => loc(c) === "en") ?? ALL[0];
  const headEn = `${TOTAL} teaching<br>situations. <em>One benchmark.</em>`;
  const headZh = `${esc(L.formatTeachingSituations(TOTAL, "zh-CN"))}<br><em>一套基准。</em>`;
  const proof = [
    [bi(esc(F.formatPublicCount(TOTAL, "publicCases", "en")), esc(F.formatPublicCount(TOTAL, "publicCases", "zh-CN"))), biE("Across subjects and language contexts.")],
    [biE("Authored contexts"), biE("Learner context, objective, and message.")],
    [biE("Transparent and reproducible"), biE("Public, versioned, and inspectable.")],
  ];
  const body = `<main id="main">
  <header class="essay-head cx-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("Case library")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(`${cases.datasetId}@${cases.datasetVersion}`)}</span></p>
        <h1 class="essay-title">${bi(headEn, headZh)}</h1>
        ${biPE("p", "essay-dek", "Browse structured student–tutor situations from the public Teachometry development set. Each authored case captures a learner context, learning objective, current message, difficulty, and tutoring capability focus.")}
        <p class="cx-actions"><a class="cta cta-ink" href="#case-library">${biE("Explore the cases")} ${ARROW}</a><a class="cta cta-line" href="../../methodology/index.html#scope">${biE("About our cases")}</a></p>
        <ul class="cx-proof">${proof.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join("")}</ul>
      </div>
      <figure class="cover-plate">
        <img src="../../assets/cases/${cover.file}" alt="${esc(cover.alt[0])}" width="900" height="1100" data-alt-en="${esc(cover.alt[0])}" data-alt-zh="${esc(cover.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc(cover.cap[0] + " " + RENDERED[0]), esc(cover.cap[1] + RENDERED[1]))}</figcaption>
      </figure>
    </div>
  </header>

  <section class="wrap cx-library" id="case-library" aria-labelledby="case-library-title">
    <button class="cx-filter-toggle" type="button" data-case-filter-toggle aria-expanded="false" aria-controls="case-filter-panel">${biE("Filters")} <b data-case-active-filter-count>0</b></button>
    <div class="cx-layout">
      <aside class="cx-rail" id="case-filter-panel" data-case-filter-panel aria-label="Filter public cases">
        <form id="case-filters">
          <div class="cx-search"><label for="case-search">${biE("Search cases...")}</label><input id="case-search" type="search" placeholder="Search cases..." data-ph-en="Search cases..." data-ph-zh="${esc(Z("Search cases..."))}" autocomplete="off" data-case-search><p>${biE("Search by keyword, topic, or case ID")}</p></div>
          <p class="cx-rail-head kicker"><span>${biE("Filters")}</span><span data-case-filter-summary>${biE("All cases")}</span></p>
          ${GROUPS.map(group).join("\n          ")}
          <button class="cx-reset" type="reset" id="case-filter-reset">${bi(esc(siteText("en", "resetFilters")), esc(siteText("zh-CN", "resetFilters")))}</button>
        </form>
      </aside>
      <div class="cx-results-region">
        <div class="cx-results-head">
          <div><h2 id="case-library-title">${bi(`${TOTAL} cases`, esc(Zor(`${TOTAL} cases`, `${TOTAL} 个案例`)))}</h2>
          <p id="case-result-count" class="kicker" aria-live="polite" data-tpl-en="${esc(F.CASE_COUNT_TEMPLATES.en)}" data-tpl-zh="${esc(F.CASE_COUNT_TEMPLATES["zh-CN"])}">${bi(esc(F.formatCaseCount(1, 12, TOTAL, "en")), esc(F.formatCaseCount(1, 12, TOTAL, "zh-CN")))}</p></div>
          <div class="cx-controls">
            <div class="cx-views" role="group" aria-label="Case display mode"><button type="button" data-case-view="cards" aria-pressed="true">${biE("Cards")}</button><button type="button" data-case-view="compact" aria-pressed="false">${biE("Compact")}</button></div>
            <label class="cx-sort"><span>${biE("Sort by")}</span><select data-case-sort aria-label="Sort cases">${[["case-id-asc", "Case ID (A → Z)"], ["case-id-desc", "Case ID (Z → A)"], ["subject", "Subject"], ["learner-level", "Learner level"], ["task-difficulty", "Task difficulty"]].map(([v, t]) => `<option value="${v}" data-en="${esc(t)}" data-zh="${esc(Z(t))}">${esc(t)}</option>`).join("")}</select></label>
          </div>
        </div>
        <div class="cx-results" data-case-results data-view="cards" data-page-size="12">
          <ol class="cx-grid">
        ${ALL.map(card).join("\n        ")}
          </ol>
          <div class="cx-empty" id="case-filter-empty" hidden><p class="cx-empty-t">${biE("No cases match these filters.")}</p><p>${biE("Reset the filters to return to the full public development set.")}</p></div>
          <nav class="cx-pages" data-case-pagination aria-label="Case pages"></nav>
        </div>
      </div>
    </div>
  </section>

  <section class="wrap jx-close cx-close">
    <p class="kicker">${biE("Our commitment")}</p>
    <h2 class="jx-h2">${bi("Open cases<br><em>for better learning.</em>", `${esc(Z("Open cases"))}<br><em>${esc(Z("for better learning."))}</em>`)}</h2>
    ${biPE("p", "jx-p", "These authored public development cases are released for research, education, and community use. Together, they can help us build more transparent and effective AI tutoring systems.")}
    <p class="jx-links"><a href="../index.html">${bi(esc("Benchmark"), esc(Z("Benchmark")))}</a><a href="../heatmap/index.html">${biE("Evidence Matrix")}</a><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")}</a></p>
  </section>
</main>`;
  void example;
  return frame({ prefix: "../../", title: "Cases — Teachometry", titleZh: `${Z("Cases")} — Teachometry`, description: "Browse structured, authored student–tutor situations from the public Teachometry development set.", body, current: "cases", css: ["journal.css", "cases.css"], scripts: ["cases.js"] });
}

// ---------------------------------------------------------------- one case file
function detailPage(c, i) {
  const l = loc(c), ti = c.tutorInput, d = c.metadata.difficulty;
  const tags = c.metadata.capabilityTags ?? [];
  const summary = [ti.problemContext, ti.learningObjective].filter((v) => v && v.trim()).join(" ");
  const twin = ALL.find((o) => o !== c && o.crossLocaleGroupId && o.crossLocaleGroupId === c.crossLocaleGroupId);
  const fact = (label, value, src = false) => `<div><dt>${biE(label)}</dt><dd${src ? ` lang="${esc(l)}"` : ""}>${value}</dd></div>`;
  const facts = [
    fact("Case ID", `<code>${esc(c.id)}</code>`),
    fact("Dataset", `<code>${esc(`${cases.datasetId}@${cases.datasetVersion}`)}</code>`),
    fact("Version", esc(c.version)),
    fact("Subject", tax(c.metadata.subject)),
    fact("Topic", esc(humanize(c.metadata.topic)), true),
    fact("Locale", esc(l)),
    fact("Learner level", level(c)),
    fact("Task difficulty", `${esc(diff(c, "taskDifficulty") || "—")} / 5`),
    fact("Pedagogical difficulty", `${esc(diff(c, "pedagogicalDifficulty") || "—")} / 5`),
    fact("Student state", state(c)),
    fact("Disclosure policy", c.disclosurePolicy ? tax(c.disclosurePolicy) : bi(...NS.map(esc))),
  ].join("");
  const p = ti.studentProfile ?? {};
  const lvl = p.level ?? (typeof d === "object" && d ? d.learnerLevel : undefined);
  const profile = `<dl class="cd-profile">${[
    ["Learner level", lvl === undefined ? bi(...NS.map(esc)) : tax(lvl), false],
    ["Goal", p.goal ? esc(p.goal) : bi(...NS.map(esc)), Boolean(p.goal)],
    ["Known concepts", p.knownConcepts?.length ? esc(p.knownConcepts.join(", ")) : bi(...NS.map(esc)), Boolean(p.knownConcepts?.length)],
  ].map(([k, v, src]) => `<div><dt>${biE(k)}</dt><dd${src ? ` lang="${esc(l)}"` : ""}>${v}</dd></div>`).join("")}</dl>`;
  const hist = ti.conversationHistory ?? [];
  const turn = (role, text, now) => `<li class="cd-turn${now ? " cd-now" : ""}${role === "tutor" ? " cd-tutor" : ""}"><p class="cd-who kicker"><b>${role === "tutor" ? "Tutor" : biE("Student")}</b><span>${now ? biE("Current message") : biE("Prior context")}</span></p><p class="cd-says" lang="${esc(l)}">${esc(text)}</p></li>`;
  const transcript = `<ol class="cd-transcript" aria-label="Tutor-visible conversation">${hist.map((m) => turn(m.role.toLowerCase(), m.text, false)).join("")}${turn("student", ti.studentMessage, true)}</ol>${hist.length === 0 ? `<p class="cd-note">${biE("There is no prior conversation. This case starts with the current student message.")}</p>` : ""}`;
  const prev = ALL[(i - 1 + TOTAL) % TOTAL], next = ALL[(i + 1) % TOTAL];
  const twinLine = twin ? `<p class="cd-twin kicker"><span>${bi("Same situation, other language", "同一情境，另一种语言")}</span><a href="../${encodeURIComponent(twin.id)}/index.html"><code>${esc(twin.id)}</code> ${ARROW}</a></p>` : "";
  const EXCL = ["Ground truth answers", "Full evaluation rubrics", "Known-misconception annotations", "Evaluator-only evidence", "Hidden challenge details", "Any private or non-public data"];
  const body = `<main id="main">
  <header class="essay-head cd-head">
    <div class="wrap">
      <nav class="cd-crumbs kicker" aria-label="Breadcrumb"><a href="../index.html">${biE("Cases")}</a><span aria-hidden="true">›</span><a href="../index.html#case-library">${biE("Case Library")}</a><span aria-hidden="true">›</span><span aria-current="page" class="nocase">${esc(c.id)}</span></nav>
      <div class="cd-head-grid">
        <div>
          <p class="essay-meta kicker"><span class="issue">${tax(c.metadata.subject)}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(c.id)}</span><span class="nocase">${esc(l)}</span></p>
          <h1 class="essay-title cd-title" lang="${esc(l)}">${esc(humanize(c.metadata.topic))}</h1>
          <p class="essay-dek cd-dek" lang="${esc(l)}">${esc(summary)}</p>
          ${twinLine}
        </div>
        <aside class="cd-public">
          <p class="kicker">${biE("Public case")}</p>
          ${biPE("p", "", "This authored case is part of the public Teachometry development set. It is designed for research and evaluation, not a real classroom or user record.")}
        </aside>
      </div>
    </div>
  </header>

  <div class="wrap cd-body">
    <aside class="cd-dossier" aria-labelledby="dossier-title">
      <h2 id="dossier-title" class="kicker">${biE("Case dossier")}</h2>
      <dl class="cd-facts">${facts}</dl>
    </aside>
    <section class="cd-context" aria-labelledby="context-title">
      <h2 id="context-title" class="cd-h2">${biE("Tutor-visible context and conversation")}</h2>
      ${biPE("p", "cd-sub", "The following context is available to the tutor in this case.")}
      ${ti.problemContext ? `<div class="cd-problem"><p class="kicker">${biE("Problem context")}</p><p lang="${esc(l)}">${esc(ti.problemContext)}</p></div>` : ""}
      ${transcript}
      ${biPE("p", "cd-input-note", "This case file presents tutor-visible input context. It is not a generated trial, model response, or evaluation result.")}
    </section>
    <aside class="cd-notes" aria-label="Case annotations">
      <section><h2 class="kicker">${biE("Learning objective")}</h2><p class="cd-objective" lang="${esc(l)}">${esc(ti.learningObjective)}</p></section>
      <section><h2 class="kicker">${biE("Student profile")}</h2>${profile}</section>
      <section><h2 class="kicker">${biE("Capability focus")}</h2>${tags.length ? `<ul class="cd-caps">${tags.map((t) => `<li>${tax(t)}</li>`).join("")}</ul>` : `<p>${bi(...NS.map(esc))}</p>`}</section>
      <section><h2 class="kicker">${biE("Case notes")}</h2>${biPE("p", "", "This case is an authored, structured scenario from the public Teachometry development set. It is not a real classroom record.")}</section>
    </aside>
    <section class="cd-boundary" aria-labelledby="boundary-title">
      <div><h2 id="boundary-title" class="cd-h2">${biE("Public boundary")}</h2>${biPE("p", "", "To ensure a fair and transparent benchmark, only tutor-visible information is publicly released.")}</div>
      <div><p class="kicker">${biE("Not included in the public case file:")}</p><ul class="cd-excl">${EXCL.map((x) => `<li>${biE(x)}</li>`).join("")}</ul></div>
    </section>
  </div>

  <nav class="wrap essay-nav" aria-label="More cases">
    <a class="prev" href="../${encodeURIComponent(prev.id)}/index.html"><span class="kicker">${bi("Previous case", "上一个案例")}</span><span class="t"><code>${esc(prev.id)}</code></span></a>
    <a class="all kicker" href="../index.html#case-library">${bi("All cases", "全部案例")}</a>
    <a class="next" href="../${encodeURIComponent(next.id)}/index.html"><span class="kicker">${bi("Next case", "下一个案例")}</span><span class="t"><code>${esc(next.id)}</code></span></a>
  </nav>
</main>`;
  const title = `${humanize(c.metadata.topic)} — Teachometry`;
  return frame({ prefix: "../../../", title, titleZh: title, description: F.formatCaseDescription(c.id, ti.learningObjective, "en"), body, current: "cases", css: ["journal.css", "cases.css"] });
}

// ---------------------------------------------------------------- the evidence matrix
const DIM_COPY = { correctness: "Right or wrong information", diagnosis: "Understanding learner needs", guidance: "Quality of next steps", adaptation: "Responsiveness to learner state", actionability: "Usability and follow-through" };
function heatmapPage() {
  const dims = benchmark.dimensions.score;
  const stats = [
    [String(trials.entries.length), "Public model trials", "No trials yet"],
    [String(models.entries.length), "Public model profiles", "Reserved"],
    [String(benchmark.dataset.caseCount), "Public cases", null],
    [String(dims.length), "Evaluation dimensions", null],
  ];
  const statNote = (i, n) => (n ? biE(n) : i === 2 ? bi(`${esc(benchmark.dataset.id)} dataset`, `${esc(benchmark.dataset.id)} ${esc(Zor("dataset", "数据集"))}`) : bi(esc(dims.map(humanize).join(" · ")), esc(dims.map((d) => Z(humanize(d))).join(" · "))));
  const visible = ALL.slice(0, 5), remaining = Math.max(0, benchmark.dataset.caseCount - visible.length);
  const cells = Array.from({ length: dims.length }, () => "<i></i>").join("");
  const body = `<main id="main">
  <header class="essay-head hm-head">
    <div class="wrap">
      <nav class="cd-crumbs kicker" aria-label="Breadcrumb"><a href="../cases/index.html">${biE("Cases")}</a><span aria-hidden="true">›</span><span aria-current="page">${biE("Evidence Matrix")}</span></nav>
      <p class="essay-meta kicker"><span class="issue">${biE("Benchmark explorer")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(`${benchmark.dataset.id}@${benchmark.dataset.version}`)}</span></p>
      <h1 class="essay-title">${bi("Evidence <em>Matrix</em>", esc(Z("Evidence Matrix")))}</h1>
      <p class="essay-dek">${bi("See the landscape at a glance.", "一眼看清整体图景。")}</p>
      ${biPE("p", "hm-desc", "The matrix will connect public benchmark cases with versioned public model runs and their trial evidence. Today, no public model trials are available yet.")}
      <dl class="hm-stats">${stats.map(([v, k, n], i) => `<div><dd>${esc(v)}</dd><dt>${biE(k)}</dt><small>${statNote(i, n)}</small></div>`).join("")}</dl>
    </div>
  </header>

  <div class="wrap hm-body">
    <section id="matrix" aria-labelledby="matrix-title">
      <p class="kicker">${biE("Case × model-run structure")}</p>
      <h2 id="matrix-title" class="jx-h2">${biE("A reserved observatory for public evidence.")}</h2>
      ${biPE("p", "jx-p", "Rows are real public cases. Columns are reserved for versioned model runs; each future populated cell will trace to a public trial detail record.")}
      <aside class="callout boundary hm-empty"><h3>${biE("No public model trials available yet.")}</h3>${biPE("p", "", `${L.publicUiCopy(trials.notice, "en")} The matrix layout, dimensions, and case structure are defined and ready.`, `${L.publicUiCopy(trials.notice, "zh-CN")} ${L.publicUiCopy("The matrix layout, dimensions, and case structure are defined and ready.", "zh-CN")}`)}</aside>
      <div class="tbl-wrap hm-wrap" tabindex="0" aria-label="Scrollable evidence matrix">
        <table class="hm-matrix">
          <caption>${biE("Case identity rows and versioned public model-run columns")}</caption>
          <thead><tr><th scope="col">${biE("Public cases ↓")}</th><th scope="col">${biE("Versioned public model runs →")}</th></tr>
          <tr><th scope="col">${biE("Case identity")}</th><th scope="col" class="hm-res">${biE("No public model runs")}</th></tr></thead>
          <tbody>${visible.map((c) => `<tr><th scope="row"><a href="../cases/${encodeURIComponent(c.id)}/index.html"><code>${esc(c.id)}</code></a></th><td><div class="hm-row"><span class="hm-cells" aria-hidden="true">${cells}</span><span class="hm-cell-t">${biE("No public run")}</span><small>${biE("Trial-linked evidence reserved")}</small></div></td></tr>`).join("")}${remaining ? `<tr class="hm-more"><th scope="row">…</th><td>${bi(esc(F.formatRemainingCaseIdentities(remaining, "en")), esc(F.formatRemainingCaseIdentities(remaining, "zh-CN")))}</td></tr>` : ""}</tbody>
        </table>
      </div>
      ${biPE("p", "hm-note", "Rows are public case identities. Cells remain neutral until a versioned public model run and its trial artifact exist.")}
    </section>

    <section id="dimensions" aria-labelledby="dimensions-title">
      <p class="kicker">${biE("Evaluation dimensions")}</p>
      <h2 id="dimensions-title" class="jx-h2">${biE("Five lenses for future evidence.")}</h2>
      ${biPE("p", "jx-p", "Each dimension defines a future trial-linked view of observable tutoring behavior. None is scored on this page today.")}
      <ol class="hm-dims">${dims.map((d, i) => `<li><img src="../../assets/gems/gem-${i}.webp" alt="" width="96" height="96"><b>${biE(humanize(d))}</b><span>${biE(DIM_COPY[d] ?? "Defined by the public evaluation contract")}</span></li>`).join("")}</ol>
    </section>

    <aside class="hm-source" aria-labelledby="source-title">
      <p class="kicker">${biE("Data source")}</p>
      <h2 id="source-title" class="cd-h2">${biE("Public artifact contract")}</h2>
      ${biPE("p", "", "Built from versioned public artifacts only. The website does not call a Judge or run a model in the browser.")}
      <dl class="cd-facts">${[["Dataset", `<code>${esc(`${benchmark.dataset.id}@${benchmark.dataset.version}`)}</code>`], ["Public cases", esc(String(TOTAL))], ["Trial publication", trials.available ? biE("Available") : biE("Not available")], ["Artifact schema", esc(String(benchmark.schemaVersion))]].map(([k, v]) => `<div><dt>${biE(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </aside>
  </div>

  <section class="wrap jx-close">
    <p class="kicker">${biE("Public evidence, clearly bounded")}</p>
    <h2 class="jx-h2">${biE("From data to deeper understanding.")}</h2>
    ${biPE("p", "jx-p", "Explore the public cases and methodology while the evidence matrix remains intentionally unpopulated.")}
    <p class="jx-links"><a href="../cases/index.html">${biE("Explore the cases")}</a><a href="../../methodology/index.html">${biE("Read the methodology")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../../", title: "Evidence Matrix — Teachometry", titleZh: `${Z("Evidence Matrix")} — Teachometry`, description: "A public case-by-model evidence matrix reserved for versioned Teachometry trial artifacts.", body, current: "cases", css: ["journal.css", "cases.css"] });
}

// ---------------------------------------------------------------- the benchmark overview (/data/)
// the live zh site leaves these few labels in English; our own zh fills the gap
const ZH_GAP = { Subjects: "学科", Capabilities: "能力", Heatmap: "热图", "Open data": "开放数据", "Research-oriented": "面向研究", "Community-driven": "社区驱动", "Disclosure policies": "披露政策" };
const share = (n, total) => (total === 0 ? 0 : Math.round((n / total) * 100));
const sorted = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));
const valueLabel = (v) => (v === "en" ? "English" : v === "zh-CN" ? "简体中文" : null);
const labelBi = (v) => (valueLabel(v) ? esc(valueLabel(v)) : tax(v));
function distribution(title, counts, total, multi = false) {
  const rows = sorted(counts);
  const row = ([k, n], other = false) => `<li><span class="bx-k">${other ? bi("Others", esc(L.publicUiCopy("Others", "zh-CN"))) : labelBi(k)}</span><span class="bx-bar" aria-hidden="true"><i style="width:${share(n, total)}%"></i></span><span class="bx-n">${n} <small>(${share(n, total)}%)</small></span></li>`;
  const top = rows.length > 5 ? rows.slice(0, 4) : rows, rest = rows.slice(top.length);
  const other = !multi && rest.length ? row(["", rest.reduce((t, r) => t + r[1], 0)], true) : "";
  const unit = multi && title === "Capabilities" ? "capability tags" : "categories";
  return `<article class="bx-dist"><h3><span>${bi(esc(title), esc(Zor(title, ZH_GAP[title])))}</span><b>${rows.length}</b><small>${biE(unit)}</small></h3>
          <ul>${top.map((r) => row(r)).join("")}${other}</ul>${rest.length ? `<details><summary>${bi(esc(F.formatCoverageExpansion(title, rows.length, "en")), esc(F.formatCoverageExpansion(title, rows.length, "zh-CN")))}</summary><ul>${rows.map((r) => row(r)).join("")}</ul></details>` : ""}
          <p class="bx-den">${bi(esc(F.formatCoverageDenominator(total, multi, "en")), esc(F.formatCoverageDenominator(total, multi, "zh-CN")))}</p></article>`;
}
function benchmarkPage() {
  const c = benchmark.coverage, dims = benchmark.dimensions.score;
  if (benchmark.schemaVersion !== 1 || JSON.stringify(dims) !== JSON.stringify(["correctness", "diagnosis", "guidance", "adaptation", "actionability"])) throw new Error("benchmark schema changed: review the presentation");
  const subjects = sorted(c.casesBySubject), locales = sorted(c.casesByLocale);
  const facts = [[c.caseCount, "Authored cases", "Public scenarios"], [dims.length, "Evaluation dimensions", "Versioned rubric schema"], [subjects.length, "Subjects", "Authored subject areas"], [Object.keys(c.casesByCapabilityTag).length, "Capabilities", "Tutoring taxonomy tags"]];
  const cell = (subj, l) => { const n = ALL.filter((x) => x.metadata.subject === subj && loc(x) === l).length; const max = Math.max(...subjects.map(([s]) => ALL.filter((x) => x.metadata.subject === s && loc(x) === l).length)); return `<td><span class="bx-dot" style="--s:${max ? (0.35 + 0.65 * n / max).toFixed(2) : 0}" aria-hidden="true"></span>${n}</td>`; };
  const trialNote = bi(esc(L.publicUiCopy(trials.notice, "en")), esc(L.publicUiCopy(trials.notice, "zh-CN")));
  const entries = [
    ["Cases", "Explore the cases", bi(esc(F.formatAuthoredScenarios(c.caseCount, "en")), esc(F.formatAuthoredScenarios(c.caseCount, "zh-CN"))), "cases/index.html", "View all cases", false],
    ["Heatmap", "See the big picture", biE("Explore the case × model-run matrix as public results become available. Compare outcomes with their evaluation context."), "heatmap/index.html", "Open heatmap", true],
    ["Trials", "Track evaluation runs", biE("Inspect published model runs, Tutor responses, and rubric evidence as they become available. Designed for transparency and reproducibility."), "trials/index.html", "View trial status", true],
  ];
  const body = `<main id="main">
  <header class="essay-head bx-head">
    <div class="wrap bx-head-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("The Teachometry benchmark")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(`${c.datasetId}@${c.datasetVersion}`)}</span></p>
        <h1 class="essay-title">${bi("The benchmark,<br>made <em>observable.</em>", `${esc(Z("The benchmark,"))}${esc(Z("made"))}<br><em>${esc(Z("observable."))}</em>`)}</h1>
        ${biPE("p", "essay-dek", "Teachometry turns complex tutoring behavior into a structured, transparent benchmark. Explore authored cases, rubrics, and evaluation structure to understand how AI tutors diagnose, guide, adapt, and support learners in realistic scenarios.")}
        <p class="cx-actions"><a class="cta cta-ink" href="cases/index.html">${biE("Browse Cases")} ${ARROW}</a><a class="cta cta-line" href="../methodology/index.html">${biE("Read the Methodology")}</a></p>
        <p class="bx-tags kicker">${["Open data", "Research-oriented", "Community-driven"].map((t) => `<span>${bi(esc(t), esc(Zor(t, ZH_GAP[t])))}</span>`).join("")}</p>
      </div>
      <aside class="bx-snap" aria-labelledby="snapshot-title">
        <p class="bx-snap-head kicker"><span id="snapshot-title">${biE("Dataset snapshot")}</span><span>${biE("Public development set")}</span></p>
        <dl class="bx-facts">${facts.map(([n, k, note]) => `<div><dt>${bi(esc(k), esc(Zor(k, ZH_GAP[k])))}</dt><dd>${n}</dd><small>${biE(note)}</small></div>`).join("")}</dl>
        <table class="bx-matrix"><caption class="kicker">${biE("Subject × locale · authored case counts")}</caption>
          <thead><tr><th scope="col">${biE("Subject")}</th>${locales.map(([l]) => `<th scope="col">${esc(valueLabel(l) ?? l)}</th>`).join("")}</tr></thead>
          <tbody>${subjects.map(([s]) => `<tr><th scope="row">${tax(s)}</th>${locales.map(([l]) => cell(s, l)).join("")}</tr>`).join("")}</tbody></table>
        <p class="bx-note">${biE("Darker dots = a larger share of that subject. Counts, not model scores.")} <a class="text-link" href="#benchmark-taxonomies">${biE("View all coverage")} ${ARROW}</a></p>
      </aside>
    </div>
  </header>

  <section class="wrap bx-explore" aria-labelledby="explore-title">
    <p class="kicker">${biE("Explore the benchmark")}</p>
    <h2 id="explore-title" class="jx-h2">${bi("Three ways<br>to <em>explore.</em>", `${esc(Z("Three ways"))}${esc(Z("to"))}<br><em>${esc(Z("explore."))}</em>`)}</h2>
    ${biPE("p", "jx-p", "Access cases, evaluation structure, and future results. Each entry point offers a different perspective on the same benchmark.")}
    <ol class="bx-entries">${entries.map(([name, title, copy, href, action, reserved], i) => `<li><a href="${href}"><span class="bx-no">0${i + 1}</span><span class="kicker">${bi(esc(name), esc(Zor(name, ZH_GAP[name])))}</span><b>${biE(title)}</b><span class="bx-copy">${copy}</span>${reserved ? `<span class="bx-reserved">${trialNote}</span>` : ""}<span class="cx-view">${biE(action)} ${ARROW}</span></a></li>`).join("")}</ol>
  </section>

  <section class="wrap bx-coverage" id="benchmark-taxonomies" aria-labelledby="coverage-title">
    <div class="bx-cov-intro">
      <p class="kicker">${biE("Data coverage")}</p>
      <h2 id="coverage-title" class="jx-h2">${bi("A diverse set of<br><em>realistic scenarios.</em>", `${esc(Z("A diverse set of"))}<br><em>${esc(Z("realistic scenarios."))}</em>`)}</h2>
      ${biPE("p", "jx-p", "The benchmark spans authored subjects, learner contexts, and tutoring capabilities, with structured evaluation criteria.")}
      <p class="bx-ver kicker"><span class="nocase">${esc(`${c.datasetId}@${c.datasetVersion}`)}</span><br>${bi(esc(F.formatRubricStatus(c.rubricCount, benchmark.statusLabel, "en")), esc(F.formatRubricStatus(c.rubricCount, benchmark.statusLabel, "zh-CN")))}</p>
      <a class="text-link" href="cases/index.html">${biE("Explore all cases")} ${ARROW}</a>
    </div>
    <div class="bx-dists">
      ${distribution("Subjects", c.casesBySubject, c.caseCount)}
      ${distribution("Learner levels", c.casesByLearnerLevel, c.caseCount)}
      ${distribution("Student states", c.casesByStudentState, c.caseCount)}
      ${distribution("Capabilities", c.casesByCapabilityTag, c.caseCount, true)}
      <details class="bx-more"><summary>${bi(esc(F.formatCoverageGroups(Object.keys(c.casesByLearningTask).length, Object.keys(c.casesByLocale).length, "en")), esc(F.formatCoverageGroups(Object.keys(c.casesByLearningTask).length, Object.keys(c.casesByLocale).length, "zh-CN")))}</summary>
        <div class="bx-dists">
        ${distribution("Learning tasks", c.casesByLearningTask, c.caseCount)}
        ${distribution("Locales", c.casesByLocale, c.caseCount)}
        ${distribution("Evaluation dimensions", c.casesByCategory, c.caseCount, true)}
        </div>
        <p class="bx-den">${bi(esc(F.formatCoverageVersion(benchmark.benchmarkVersion, benchmark.schemaVersion, "en")), esc(F.formatCoverageVersion(benchmark.benchmarkVersion, benchmark.schemaVersion, "zh-CN")))}</p>
        <p class="bx-den">${bi("Disclosure policies", esc(Zor("Disclosure policies", ZH_GAP["Disclosure policies"])))}： ${Object.entries(c.casesByDisclosurePolicy).map(([k, n]) => `${tax(k)}: ${n}`).join(" · ")}</p>
      </details>
    </div>
  </section>

  <section class="wrap jx-close">
    <p class="kicker">${biE("Open & reproducible")}</p>
    <h2 class="jx-h2">${biE("Transparent by design.")}</h2>
    ${biPE("p", "jx-p", "Public development cases and evaluation criteria are open for inspection. Public case artifacts exclude evaluator-only answers and rubrics. Coverage describes the authored dataset, not teaching effectiveness or learning outcomes.")}
    <p class="jx-links"><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")}</a><a href="${GITHUB}/tree/main/docs" rel="noreferrer">${biE("Read the data documentation")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../", title: "Benchmark — Teachometry", titleZh: `${Z("Benchmark")} — Teachometry`, description: "Explore authored cases, public dataset coverage, and transparent evaluation structure.", body, current: "cases", css: ["journal.css", "cases.css"] });
}

// ---------------------------------------------------------------- write
const COVER = {
  file: "catalogue.webp",
  alt: ["An oak card-catalogue drawer pulled out of its cabinet in low morning light. One index card stands above the others, typed with the public case fraction-misconception-001.", "橡木卡片目录抽屉从柜中拉出，清晨的低角度光。一张索引卡高出其余，打着公开案例 fraction-misconception-001。"],
  cap: ["Forty-eight cards, one drawer.", "四十八张卡，一个抽屉。"],
};
const out = (rel, html) => { const f = join(PROTO, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, html); };
out("data/cases/index.html", libraryPage(COVER));
ALL.forEach((c, i) => out(`data/cases/${c.id}/index.html`, detailPage(c, i)));
out("data/heatmap/index.html", heatmapPage());
out("data/index.html", benchmarkPage());
process.stdout.write(`cases: benchmark overview + library + ${TOTAL} case files + evidence matrix\n`);
