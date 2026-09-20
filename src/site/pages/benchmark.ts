import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import { escapeHtml as e, humanize, SITE_GITHUB_URL, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachometryFooter } from "./home.js";

type Counts = Readonly<Record<string, number>>;
const rows = (counts: Counts): [string, number][] => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));
const label = (value: string): string => value === "en" ? "English" : value === "zh-CN" ? "简体中文" : humanize(value);
const percent = (count: number, total: number): number => total === 0 ? 0 : Math.round(count / total * 100);

function distribution(title: string, counts: Counts, total: number, glyph: string, multi = false): string {
  const entries = rows(counts);
  const item = ([key, count]: [string, number]): string => `<li><span>${e(label(key))}</span><span class="benchmark-track"><i style="width:${percent(count, total)}%"></i></span><span>${count} <small>(${total === 0 ? "—" : `${percent(count, total)}%`})</small></span></li>`;
  // 多标签不能相加当作病例占比；只截取 Top-N，并保留完整展开入口。
  const top = entries.length > 5 ? entries.slice(0, 4) : entries;
  const remainder = entries.slice(top.length);
  const other = !multi && remainder.length ? item(["Others", remainder.reduce((sum, row) => sum + row[1], 0)]) : "";
  return `<article class="benchmark-distribution"><h3><span class="benchmark-icon">${icon(glyph)}</span>${e(title)}</h3><div class="benchmark-distribution-body"><div class="benchmark-total">${entries.length}<small>${multi && title === "Capabilities" ? "capability tags" : "categories"}</small></div><ul>${top.map(item).join("")}${other}</ul></div>${entries.length === 0 ? '<p>No coverage data available.</p>' : ""}${remainder.length ? `<details><summary>View all ${entries.length} ${e(title.toLowerCase())}</summary><ul>${entries.map(item).join("")}</ul></details>` : ""}<p class="benchmark-denominator">${multi ? "Cases with each category; categories overlap." : "Share of all cases."} n = ${total}${total === 0 ? "; percentages unavailable" : ""}</p></article>`;
}

function snapshot(artifacts: PublicBenchmarkArtifacts): string {
  const { benchmark, cases } = artifacts;
  const c = benchmark.coverage;
  const subjects = rows(c.casesBySubject);
  const locales = rows(c.casesByLocale);
  const shown = subjects.slice(0, 5);
  const shownLocales = locales.slice(0, 3);
  const matrixRows = shown.map(([subject]) => ({ name: label(subject), cases: cases.cases.filter(item => item.metadata.subject === subject) }));
  if (subjects.length > 5) matrixRows.push({ name: "Others", cases: cases.cases.filter(item => !shown.some(([subject]) => item.metadata.subject === subject)) });
  const columns = shownLocales.map(([locale]) => ({ name: label(locale), matches: (value: string) => value === locale }));
  if (locales.length > 3) columns.push({ name: "Others", matches: value => !shownLocales.some(([locale]) => locale === value) });
  return `<aside class="benchmark-snapshot" aria-labelledby="snapshot-title"><div class="benchmark-snapshot-heading"><h2 id="snapshot-title" class="eyebrow">Dataset snapshot</h2><span>Public development set</span></div><dl class="benchmark-facts">${[[c.caseCount, "Authored cases", "Public scenarios"], [benchmark.dimensions.score.length, "Evaluation dimensions", "Versioned rubric schema"], [subjects.length, "Subjects", "Authored subject areas"], [Object.keys(c.casesByCapabilityTag).length, "Capabilities", "Tutoring taxonomy tags"]].map(([count, title, note]) => `<div><dt>${title}</dt><dd>${count}</dd><small>${note}</small></div>`).join("")}</dl><div class="benchmark-matrix-wrap" tabindex="0" role="region" aria-label="Subject by locale coverage"><table class="benchmark-matrix"><caption>Subject × locale · authored case counts</caption><thead><tr><th scope="col">Subject</th>${columns.map(col => `<th scope="col">${e(col.name)}</th>`).join("")}</tr></thead><tbody>${matrixRows.map(row => `<tr><th scope="row">${e(row.name)}</th>${columns.map(col => { const count = row.cases.filter(item => col.matches(item.locale ?? "en")).length; return `<td><span class="benchmark-dot" style="opacity:${count === 0 ? 0 : 0.25 + 0.75 * count / Math.max(1, row.cases.length)}" aria-hidden="true"></span>${count}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div><p class="benchmark-denominator">Darker dots = a larger share of that subject. Counts, not model scores.${c.caseCount === 0 ? " No public cases available." : ""}</p><a class="benchmark-small-link" href="#benchmark-taxonomies">View all coverage ${icon("arrow")}</a></aside>`;
}

export function renderDataIndexPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, trials } = artifacts;
  // 数据集增量可自动扩展；评价架构变化必须显式审查这个版本化展示契约。
  const schemaV1 = ["correctness", "diagnosis", "guidance", "adaptation", "actionability"];
  if (benchmark.schemaVersion !== 1 || benchmark.benchmarkVersion !== "0.1" || JSON.stringify(benchmark.dimensions.score) !== JSON.stringify(schemaV1)) {
    throw new Error("Benchmark page schema changed: explicitly version and review the presentation contract.");
  }
  const c = benchmark.coverage;
  return { title: "Benchmark — Teachometry", description: "Explore authored cases, public dataset coverage, and transparent evaluation structure.", route: "/data/", content: `
    <section class="benchmark-hero"><div class="shell benchmark-hero-grid"><div class="benchmark-thesis"><p class="eyebrow">The Teachometry benchmark</p><h1>The benchmark,<br>made <em>observable.</em></h1><p class="benchmark-lede">Teachometry turns complex tutoring behavior into a structured, transparent benchmark. Explore authored cases, rubrics, and evaluation structure to understand how AI tutors diagnose, guide, adapt, and support learners in realistic scenarios.</p><div class="button-row"><a class="button button-primary" href="/data/cases/">Browse Cases ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">${icon("book")} Read the Methodology</a></div><div class="benchmark-principles"><span>${icon("guidance")} Open data</span><span>${icon("actionability")} Research-oriented</span><span>${icon("adaptation")} Community-driven</span></div></div>${snapshot(artifacts)}</div></section>
    <section class="benchmark-explore"><div class="shell benchmark-explore-grid"><div class="benchmark-section-intro"><p class="eyebrow">Explore the benchmark</p><h2>Three ways<br>to <em>explore.</em></h2><p>Access cases, evaluation structure, and future results. Each entry point offers a different perspective on the same benchmark.</p></div>${[
      ["Cases", "Explore the cases", `Browse ${c.caseCount} authored tutoring scenarios with rich context, learner profiles, and public case metadata.`, "/data/cases/", "View all cases", "book"],
      ["Heatmap", "See the big picture", "Explore the case × model-run matrix as public results become available. Compare outcomes with their evaluation context.", "/data/heatmap/", "Open heatmap", "actionability"],
      ["Trials", "Track evaluation runs", "Inspect published model runs, Tutor responses, and rubric evidence as they become available. Designed for transparency and reproducibility.", "/data/trials/", "View trial status", "diagnosis"],
    ].map(([name, title, copy, href, action, glyph]) => `<article class="benchmark-entry"><span class="benchmark-entry-icon">${icon(glyph ?? "book")}</span><p class="eyebrow">${name}</p><h3>${title}</h3><p>${copy}</p>${name === "Cases" ? "" : `<p class="benchmark-trial-notice">${e(trials.notice)}</p>`}<a class="text-link" href="${href}">${action} ${icon("arrow")}</a></article>`).join("")}</div></section>
    <section class="benchmark-coverage" id="benchmark-taxonomies"><div class="shell benchmark-coverage-grid"><div class="benchmark-section-intro"><p class="eyebrow">Data coverage</p><h2>A diverse set of<br><em>realistic scenarios.</em></h2><p class="benchmark-lede">The benchmark spans authored subjects, learner contexts, and tutoring capabilities, with structured evaluation criteria.</p><a class="text-link" href="/data/cases/">Explore all cases ${icon("arrow")}</a><p class="benchmark-version">${e(c.datasetId)}@${e(c.datasetVersion)}<br>${c.rubricCount} rubrics · ${e(benchmark.statusLabel)}</p></div><div class="benchmark-coverage-cards">${distribution("Subjects", c.casesBySubject, c.caseCount, "book")}${distribution("Learner levels", c.casesByLearnerLevel, c.caseCount, "adaptation")}${distribution("Student states", c.casesByStudentState, c.caseCount, "guidance")}${distribution("Capabilities", c.casesByCapabilityTag, c.caseCount, "actionability", true)}<details class="benchmark-more"><summary>Learning tasks (${Object.keys(c.casesByLearningTask).length}), locales (${Object.keys(c.casesByLocale).length}) &amp; evaluation coverage</summary><div class="benchmark-coverage-cards">${distribution("Learning tasks", c.casesByLearningTask, c.caseCount, "book")}${distribution("Locales", c.casesByLocale, c.caseCount, "guidance")}${distribution("Evaluation dimensions", c.casesByCategory, c.caseCount, "actionability", true)}</div><p>Dimension coverage counts cases with at least one rubric in each category; categories overlap. Benchmark ${e(benchmark.benchmarkVersion)} · artifact schema ${benchmark.schemaVersion}. Dataset growth recalculates coverage; schema changes require an explicit presentation version review.</p><p>Disclosure policies: ${Object.entries(c.casesByDisclosurePolicy).map(([key, count]) => `${e(humanize(key))}: ${count}`).join(" · ")}</p></details></div></div></section>
    <section class="shell benchmark-open"><span class="benchmark-entry-icon">${icon("leaf")}</span><div><p class="eyebrow">Open &amp; reproducible</p><h2>Transparent by design.</h2><p>Public development cases and evaluation criteria are open for inspection. Public case artifacts exclude evaluator-only answers and rubrics. Coverage describes the authored dataset, not teaching effectiveness or learning outcomes.</p></div><div class="benchmark-open-links"><a class="button button-secondary" href="${SITE_GITHUB_URL}">${icon("github")} View on GitHub</a><a class="button button-secondary" href="/docs/">${icon("book")} Read the data documentation</a></div></section>
    ${renderTeachometryFooter(artifacts)}` };
}
