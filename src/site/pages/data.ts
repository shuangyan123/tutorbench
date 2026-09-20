import type {
  PublicCaseArtifact,
  PublicBenchmarkArtifacts,
  TutorEvalPublicCase,
} from "../../datasets/public.js";
import {
  SITE_GITHUB_URL,
  escapeHtml,
  formatDifficulty,
  humanize,
  renderDimensionPills,
  renderEmptyState,
  renderKeyValueList,
  renderStatusBadge,
  renderUiText,
  type SitePage,
} from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { siteText } from "../i18n.js";
import { renderTeachometryFooter } from "./home.js";

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

type CaseFilterKey =
  | "subject"
  | "learnerLevel"
  | "taskDifficulty"
  | "pedagogicalDifficulty"
  | "capability"
  | "studentState"
  | "locale"
  | "disclosurePolicy";

interface CaseFacet {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

function facetValues(
  cases: readonly TutorEvalPublicCase[],
  getValues: (item: TutorEvalPublicCase) => readonly string[],
  labelFor: (value: string) => string = humanize,
): readonly CaseFacet[] {
  const counts = new Map<string, number>();
  for (const item of cases) {
    for (const value of getValues(item)) {
      if (value.length > 0) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labelFor(value), count }))
    .sort((left, right) => left.label.localeCompare(right.label, "en", { numeric: true }));
}

function localeLabel(value: string): string {
  if (value === "en") {
    return siteText("en", "localeEnglish");
  }
  if (value === "zh-CN") {
    return siteText("en", "localeChinese");
  }
  return value;
}

function difficultyValue(
  item: TutorEvalPublicCase,
  key: "learnerLevel" | "taskDifficulty" | "pedagogicalDifficulty",
): string {
  const difficulty = item.metadata.difficulty;
  if (typeof difficulty !== "object" || difficulty === null) {
    return "";
  }
  return String(difficulty[key]);
}

function difficultyLabel(key: "learnerLevel" | "taskDifficulty" | "pedagogicalDifficulty", value: string): string {
  return key === "learnerLevel" ? humanize(value) : `Level ${value} / 5`;
}

function excerpt(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

function subjectTone(subject: string): string {
  const tones = ["blue", "mint", "rose", "lilac", "sand"] as const;
  let hash = 0;
  for (const character of subject) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return tones[Math.abs(hash) % tones.length] ?? "blue";
}

function subjectIcon(subject: string): string {
  const normalized = subject.toLowerCase();
  if (normalized.includes("math")) return "actionability";
  if (normalized.includes("science")) return "spark";
  if (normalized.includes("language")) return "book";
  if (normalized.includes("history") || normalized.includes("social")) return "document";
  return "guidance";
}

function renderFilterGroup(
  key: CaseFilterKey,
  label: string,
  facets: readonly CaseFacet[],
  total: number,
  allLabel: string,
): string {
  const options = facets
    .map(
      (facet) => `<label class="case-filter-option"><input type="checkbox" data-case-filter="${escapeHtml(key)}" value="${escapeHtml(facet.value)}"><span>${escapeHtml(facet.label)}</span><small>${facet.count}</small></label>`,
    )
    .join("");
  return `<fieldset class="case-filter-group" data-case-filter-group="${escapeHtml(key)}"><legend><span>${escapeHtml(label)}</span><button type="button" class="case-filter-clear" data-case-filter-clear="${escapeHtml(key)}">Clear</button></legend><div class="case-filter-options"><label class="case-filter-option case-filter-all"><input type="checkbox" data-case-filter="${escapeHtml(key)}" data-case-filter-all value="" checked><span>${escapeHtml(allLabel)}</span><small>${total}</small></label>${options}</div></fieldset>`;
}

function renderCaseAttributes(caseArtifact: PublicCaseArtifact["cases"][number]): string {
  const tags = caseArtifact.metadata.capabilityTags ?? [];
  const locale = caseArtifact.locale ?? "en";
  const searchText = [
    caseArtifact.id,
    caseArtifact.metadata.subject,
    caseArtifact.metadata.topic,
    caseArtifact.tutorInput.learningObjective,
    caseArtifact.tutorInput.studentMessage,
    ...tags,
  ].join(" ");
  return `data-case-item data-case-tone="${escapeHtml(subjectTone(caseArtifact.metadata.subject))}" data-case-id="${escapeHtml(caseArtifact.id)}" data-case-locale="${escapeHtml(locale)}" data-case-subject="${escapeHtml(caseArtifact.metadata.subject)}" data-case-learner-level="${escapeHtml(difficultyValue(caseArtifact, "learnerLevel"))}" data-case-task-difficulty="${escapeHtml(difficultyValue(caseArtifact, "taskDifficulty"))}" data-case-pedagogical-difficulty="${escapeHtml(difficultyValue(caseArtifact, "pedagogicalDifficulty"))}" data-case-capabilities="${escapeHtml(tags.join(" "))}" data-case-student-state="${escapeHtml(caseArtifact.metadata.studentState ?? "")}" data-case-disclosure-policy="${escapeHtml(caseArtifact.disclosurePolicy ?? "")}" data-case-search-text="${escapeHtml(searchText)}"`;
}

function renderCaseCard(caseArtifact: PublicCaseArtifact["cases"][number]): string {
  const level = difficultyValue(caseArtifact, "learnerLevel");
  const subject = humanize(caseArtifact.metadata.subject);
  const topic = humanize(caseArtifact.metadata.topic);
  const state = humanize(caseArtifact.metadata.studentState ?? "Not specified");
  const locale = caseArtifact.locale ?? "en";
  const tags = caseArtifact.metadata.capabilityTags ?? [];
  const message = excerpt(caseArtifact.tutorInput.studentMessage, 170);
  const objective = excerpt(caseArtifact.tutorInput.learningObjective, 140);
  return `<article class="case-item" ${renderCaseAttributes(caseArtifact)}>
    <div class="case-card-face">
      <div class="case-card-banner"><span class="case-card-id">${escapeHtml(caseArtifact.id)}</span><span class="case-card-subject">${icon(subjectIcon(caseArtifact.metadata.subject))}${escapeHtml(subject)}</span></div>
      <div class="case-card-body"><p class="case-card-topic">${escapeHtml(topic)}</p><blockquote>“${escapeHtml(message)}”</blockquote><div class="case-card-tags">${tags.slice(0, 4).map((tag) => `<span>${escapeHtml(humanize(tag))}</span>`).join("")}</div><div class="case-card-meta"><span>${icon("adaptation")} ${escapeHtml(level.length > 0 ? humanize(level) : "Not specified")}</span><span>${icon("guidance")} ${escapeHtml(state)}</span><span class="case-card-locale">${escapeHtml(locale)}</span></div></div>
      <a class="case-card-link" href="/data/cases/${encodeURIComponent(caseArtifact.id)}/">View case ${icon("arrow")}</a>
    </div>
    <div class="case-compact-face"><div><span class="case-card-id">${escapeHtml(caseArtifact.id)}</span><strong>${escapeHtml(subject)}</strong></div><span>${escapeHtml(topic)}</span><span>${escapeHtml(level.length > 0 ? humanize(level) : "Not specified")}</span><span>${escapeHtml(state)}</span><span>${escapeHtml(locale)}</span><span>${escapeHtml(tags.slice(0, 3).map(humanize).join(" · "))}</span><a class="case-card-link" href="/data/cases/${encodeURIComponent(caseArtifact.id)}/">View case ${icon("arrow")}</a><p>${escapeHtml(objective)}</p></div>
  </article>`;
}

function renderCaseSpecimen(caseArtifact: TutorEvalPublicCase | undefined): string {
  if (caseArtifact === undefined) {
    return `<div class="cases-hero-specimen cases-hero-specimen-empty"><p class="eyebrow">Example case</p><p>No public example case is available.</p></div>`;
  }
  const difficulty = caseArtifact.metadata.difficulty;
  const learnerLevel = typeof difficulty === "object" && difficulty !== null ? humanize(difficulty.learnerLevel) : "Not specified";
  const subject = humanize(caseArtifact.metadata.subject);
  const tags = caseArtifact.metadata.capabilityTags ?? [];
  return `<div class="cases-hero-specimen" aria-label="Example public case ${escapeHtml(caseArtifact.id)}"><span class="specimen-leaf specimen-leaf-one" aria-hidden="true"></span><span class="specimen-leaf specimen-leaf-two" aria-hidden="true"></span><div class="specimen-paper specimen-paper-back" aria-hidden="true"></div><div class="specimen-paper specimen-paper-mid" aria-hidden="true"></div><article class="specimen-paper specimen-paper-front"><div class="specimen-heading"><span>Example case</span><span>${escapeHtml(subject)} · ${escapeHtml(learnerLevel)}</span></div><div class="specimen-message"><span class="specimen-message-mark">${icon("guidance")}</span><div><strong>Student</strong><p>${escapeHtml(excerpt(caseArtifact.tutorInput.studentMessage, 165))}</p></div></div><div class="specimen-meta"><span><b>Learner level</b><em>${escapeHtml(learnerLevel)}</em></span><span><b>Student state</b><em>${escapeHtml(humanize(caseArtifact.metadata.studentState ?? "Not specified"))}</em></span><span><b>Capability focus</b><em>${escapeHtml(tags.length > 0 ? humanize(tags[0] ?? "Public metadata") : "Public metadata")}${tags.length > 1 ? ` <small>+${tags.length - 1}</small>` : ""}</em></span></div><span class="specimen-case-id">${escapeHtml(caseArtifact.id)}</span></article><p class="specimen-note specimen-note-top">Structured context.<br>Inspectable cases.</p><p class="specimen-note specimen-note-bottom">Authored situations.<br>Transparent evidence.</p></div>`;
}

export function renderCasesPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const publicCases = artifacts.cases.cases;
  const total = publicCases.length;
  const exampleCase = publicCases.find((item) => (item.locale ?? "en") === "en") ?? publicCases[0];
  const subjects = facetValues(publicCases, (item) => [item.metadata.subject]);
  const learnerLevels = facetValues(publicCases, (item) => {
    const value = difficultyValue(item, "learnerLevel");
    return value.length > 0 ? [value] : [];
  }, (value) => difficultyLabel("learnerLevel", value));
  const taskDifficulties = facetValues(publicCases, (item) => {
    const value = difficultyValue(item, "taskDifficulty");
    return value.length > 0 ? [value] : [];
  }, (value) => difficultyLabel("taskDifficulty", value));
  const pedagogicalDifficulties = facetValues(publicCases, (item) => {
    const value = difficultyValue(item, "pedagogicalDifficulty");
    return value.length > 0 ? [value] : [];
  }, (value) => difficultyLabel("pedagogicalDifficulty", value));
  const capabilities = facetValues(publicCases, (item) => item.metadata.capabilityTags ?? []);
  const studentStates = facetValues(publicCases, (item) => item.metadata.studentState === undefined ? [] : [item.metadata.studentState]);
  const locales = facetValues(publicCases, (item) => [item.locale ?? "en"], localeLabel);
  const disclosurePolicies = facetValues(publicCases, (item) => item.disclosurePolicy === undefined ? [] : [item.disclosurePolicy]);
  const initialEnd = Math.min(12, total);
  return page(
    "Cases — Teachometry",
    "Browse structured, authored student–tutor situations from the public Teachometry development set.",
    "/data/cases/",
    `<div class="cases-main">
      <section class="cases-hero" aria-labelledby="cases-title"><div class="shell cases-hero-grid"><div class="cases-hero-copy"><p class="eyebrow">Case library</p><h1 id="cases-title">${escapeHtml(String(total))} teaching<br>situations. <em>One benchmark.</em></h1><p class="cases-hero-lede">Browse structured student–tutor situations from the public Teachometry development set. Each authored case captures a learner context, learning objective, current message, difficulty, and tutoring capability focus.</p><div class="cases-hero-actions"><a class="button button-primary" href="#case-library">Explore the cases ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/#method-scope">${icon("book")} About our cases</a></div><div class="cases-proof"><span><i>${icon("document")}</i><b>${total} public cases</b><small>Across subjects and language contexts.</small></span><span><i>${icon("book")}</i><b>Authored contexts</b><small>Learner context, objective, and message.</small></span><span><i>${icon("check")}</i><b>Transparent and reproducible</b><small>Public, versioned, and inspectable.</small></span></div></div>${renderCaseSpecimen(exampleCase)}</div></section>
      <section class="cases-library" id="case-library" aria-labelledby="case-library-title"><div class="shell cases-shell"><button class="cases-filter-toggle" type="button" data-case-filter-toggle aria-expanded="false" aria-controls="case-filter-panel">${icon("filter")}<span>Filters</span><b data-case-active-filter-count>0</b></button><div class="cases-library-layout"><aside class="cases-filter-rail" id="case-filter-panel" data-case-filter-panel aria-label="Filter public cases"><form id="case-filters"><div class="cases-search"><label for="case-search">Search cases...</label><div class="cases-search-control">${icon("search")}<input id="case-search" type="search" placeholder="Search cases..." autocomplete="off" data-case-search></div><p>Search by keyword, topic, or case ID</p></div><div class="cases-filter-heading"><p class="eyebrow">Filters</p><span data-case-filter-summary>All cases</span></div>${renderFilterGroup("subject", "Subject", subjects, total, "All subjects")}${renderFilterGroup("learnerLevel", "Learner level", learnerLevels, total, "All levels")}${renderFilterGroup("taskDifficulty", "Task difficulty", taskDifficulties, total, "All difficulties")}${renderFilterGroup("pedagogicalDifficulty", "Pedagogical difficulty", pedagogicalDifficulties, total, "All difficulties")}${renderFilterGroup("capability", "Capability focus", capabilities, total, "All capabilities")}${renderFilterGroup("studentState", "Student state", studentStates, total, "All states")}${renderFilterGroup("locale", "Locale", locales, total, "All locales")}${renderFilterGroup("disclosurePolicy", "Disclosure policy", disclosurePolicies, total, "All policies")}<button class="cases-reset" type="reset" id="case-filter-reset">${icon("refresh")} ${renderUiText("resetFilters", "en")}</button></form></aside><div class="cases-results-region"><div class="cases-results-head"><div><div class="cases-results-title"><h2 id="case-library-title">${escapeHtml(String(total))} cases</h2><span id="case-result-count" aria-live="polite" data-case-count-value="${total}" data-case-count-start="${total === 0 ? 0 : 1}" data-case-count-end="${initialEnd}" data-case-count-template-en="Showing {start}–{end} of {count} cases" data-case-count-template-zh-cn="显示 {start}–{end} / 共 {count} 个案例">Showing ${total === 0 ? 0 : 1}–${initialEnd} of ${total} cases</span></div></div><div class="cases-results-controls"><div class="cases-view-toggle" role="group" aria-label="Case display mode"><button type="button" data-case-view="cards" aria-pressed="true">${icon("grid")} Cards</button><button type="button" data-case-view="compact" aria-pressed="false">${icon("list")} Compact</button></div><label class="cases-sort"><span>Sort by</span><select data-case-sort aria-label="Sort cases"><option value="case-id-asc">Case ID (A → Z)</option><option value="case-id-desc">Case ID (Z → A)</option><option value="subject">Subject</option><option value="learner-level">Learner level</option><option value="task-difficulty">Task difficulty</option></select></label></div></div><div class="case-results" data-case-results data-view="cards" data-page-size="12"><div class="case-card-grid">${publicCases.map(renderCaseCard).join("")}</div><div class="case-filter-empty" id="case-filter-empty" hidden>${renderEmptyState("No cases match these filters.", "Reset the filters to return to the full public development set.")}</div><nav class="case-pagination" data-case-pagination aria-label="Case pages"></nav></div></div></div></div></section>
      <section class="cases-commitment"><div class="shell cases-commitment-grid"><div><p class="eyebrow">Our commitment</p><h2><span>${icon("leaf")}</span>Open cases<br>for better learning.</h2></div><p>These authored public development cases are released for research, education, and community use. Together, they can help us build more transparent and effective AI tutoring systems.</p><div class="cases-commitment-actions"><a class="button button-primary" href="/docs/">Browse the documentation ${icon("arrow")}</a><a class="button button-secondary" href="${SITE_GITHUB_URL}" rel="noreferrer">${icon("github")} View on GitHub</a></div></div></section>
    </div>${renderTeachometryFooter(artifacts)}`,
  );
}

function renderProfile(profile: TutorEvalPublicCase["tutorInput"]["studentProfile"]): string {
  if (profile === undefined) {
    return `<p class="muted">No additional public profile metadata.</p>`;
  }
  const items: Array<[string, string]> = [];
  if (profile.level !== undefined) {
    items.push(["Level", humanize(profile.level)]);
  }
  if (profile.goal !== undefined) {
    items.push(["Goal", profile.goal]);
  }
  if (profile.knownConcepts !== undefined && profile.knownConcepts.length > 0) {
    items.push(["Known concepts", profile.knownConcepts.join(", ")]);
  }
  return renderKeyValueList(items);
}

function renderConversation(
  conversation: TutorEvalPublicCase["tutorInput"]["conversationHistory"],
): string {
  if (conversation === undefined || conversation.length === 0) {
    return `<p class="muted">No prior conversation. This case starts with the current student message.</p>`;
  }
  return `<ol class="conversation-list">${conversation
    .map(
      (message) => `<li><span class="conversation-role">${escapeHtml(humanize(message.role))}</span><p>${escapeHtml(message.text)}</p></li>`,
    )
    .join("")}</ol>`;
}

export function renderCaseDetailPage(
  artifacts: PublicBenchmarkArtifacts,
  caseArtifact: TutorEvalPublicCase,
): SitePage {
  const difficulty = formatDifficulty(caseArtifact.metadata.difficulty);
  const capabilityTags = caseArtifact.metadata.capabilityTags ?? [];
  return page(
    `${humanize(caseArtifact.metadata.topic)} — Tutor Benchmark`,
    `Public TutorEval case ${caseArtifact.id}: ${caseArtifact.tutorInput.learningObjective}`,
    `/data/cases/${encodeURIComponent(caseArtifact.id)}/`,
    `<section class="page-intro">
      <div class="shell narrow-shell">
        <a class="back-link" href="/data/cases/">← Back to case explorer</a>
        <div class="eyebrow-row">${renderStatusBadge("Public case", "preview")}<span class="eyebrow">${escapeHtml(caseArtifact.id)}</span></div>
        <h1>${escapeHtml(humanize(caseArtifact.metadata.topic))}</h1>
        <p class="lede">${escapeHtml(caseArtifact.tutorInput.learningObjective)}</p>
      </div>
    </section>
    <section class="section">
      <div class="shell detail-grid">
        <div class="detail-main">
          <section class="panel detail-section" aria-labelledby="student-context-title">
            <div class="panel-heading"><div><p class="eyebrow">Tutor-visible context</p><h2 id="student-context-title">Student context</h2></div>${renderStatusBadge(humanize(caseArtifact.metadata.studentState ?? "Unspecified"), "muted")}</div>
            <div class="student-message"><p class="quote-label">Current student message</p><p>“${escapeHtml(caseArtifact.tutorInput.studentMessage)}”</p></div>
            ${caseArtifact.tutorInput.problemContext === undefined ? "" : `<div class="context-copy"><p class="quote-label">Problem context</p><p>${escapeHtml(caseArtifact.tutorInput.problemContext)}</p></div>`}
            <div class="context-copy"><p class="quote-label">Learning objective</p><p>${escapeHtml(caseArtifact.tutorInput.learningObjective)}</p></div>
          </section>
          <section class="panel detail-section" aria-labelledby="conversation-title">
            <p class="eyebrow">Context window</p><h2 id="conversation-title">Conversation history</h2>
            ${renderConversation(caseArtifact.tutorInput.conversationHistory)}
          </section>
          <section class="panel detail-section" aria-labelledby="privacy-title">
            <p class="eyebrow">Public boundary</p><h2 id="privacy-title">What this page does not expose</h2>
            <p>This public development artifact intentionally excludes ground truth answers, known-misconception annotations, rubrics, and evaluator-only evidence. A future hidden challenge dataset must use the same fail-closed serialization boundary.</p>
          </section>
        </div>
        <aside class="detail-side">
          <section class="panel detail-section" aria-labelledby="case-meta-title">
            <p class="eyebrow">Case metadata</p><h2 id="case-meta-title">Identity &amp; scope</h2>
            ${renderKeyValueList([
              ["Case ID", caseArtifact.id],
              ["Case version", caseArtifact.version],
              ["Dataset", `${artifacts.cases.datasetId}@${artifacts.cases.datasetVersion}`],
              ["Subject", humanize(caseArtifact.metadata.subject)],
              ["Topic", humanize(caseArtifact.metadata.topic)],
              ["Difficulty", difficulty],
              ["Disclosure policy", humanize(caseArtifact.disclosurePolicy ?? "Not specified")],
            ])}
            <p class="localized-case-locale">${renderUiText("targetLocale", "en")}: <code>${escapeHtml(caseArtifact.locale ?? "en")}</code></p>
            ${caseArtifact.crossLocaleGroupId === undefined ? "" : `<p class="localized-case-locale">${renderUiText("crossLocaleGroup", "en")}: <code>${escapeHtml(caseArtifact.crossLocaleGroupId)}</code></p>`}
          </section>
          <section class="panel detail-section" aria-labelledby="profile-title">
            <p class="eyebrow">Student profile</p><h2 id="profile-title">Known public context</h2>
            ${renderProfile(caseArtifact.tutorInput.studentProfile)}
          </section>
          <section class="panel detail-section" aria-labelledby="capabilities-title">
            <p class="eyebrow">Taxonomy</p><h2 id="capabilities-title">Capability tags</h2>
            ${renderDimensionPills(capabilityTags)}
          </section>
        </aside>
      </div>
    </section>`,
  );
}

export function renderHeatmapPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, trials } = artifacts;
  return page(
    "Heatmap — Tutor Benchmark",
    "A case-by-model trial matrix for future Tutor Benchmark public results.",
    "/data/heatmap/",
    `<section class="page-intro"><div class="shell narrow-shell"><div class="eyebrow-row">${renderStatusBadge(benchmark.statusLabel, "preview")}<span class="eyebrow">Case × model runs</span></div><h1>Heatmap</h1><p class="lede">A reusable matrix contract for comparing case-level outcomes. The first public release does not manufacture cells for models that have not been run.</p></div></section>
    <section class="section"><div class="shell"><div class="panel">${renderEmptyState("No public model trials available yet.", trials.notice, "Rows will be cases; columns will be versioned model runs; each cell will link to a trial detail record.")}
      <div class="matrix-contract"><p class="eyebrow">Future matrix</p><div class="matrix"><div class="matrix-corner">Cases / Runs</div><div class="matrix-head">Model run A</div><div class="matrix-head">Model run B</div><div class="matrix-row-label">case-id</div><div class="matrix-cell">score / pass / failure</div><div class="matrix-cell">score / pass / failure</div></div></div>
    </div></div></section>`,
  );
}

export function renderTrialsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, trials } = artifacts;
  return page(
    "Trials — Tutor Benchmark",
    "Audit-ready trial records for future Tutor Benchmark results.",
    "/data/trials/",
    `<section class="page-intro"><div class="shell narrow-shell"><div class="eyebrow-row">${renderStatusBadge(benchmark.statusLabel, "preview")}<span class="eyebrow">Audit trail</span></div><h1>Trials</h1><p class="lede">A leaderboard number should eventually trace to a model identity, case version, Tutor response, rubric evidence, and sanitized operational metrics.</p></div></section>
    <section class="section"><div class="shell"><div class="panel">${renderEmptyState("No public trials available yet.", trials.notice, "Trial detail pages are reserved for public result artifacts; this website never calls a Judge from the browser.")}
      <div class="traceability"><p class="eyebrow">Traceability contract</p><div class="trace-line"><span>Leaderboard</span><b>→</b><span>Model</span><b>→</b><span>Trial</span><b>→</b><span>Tutor response</span><b>→</b><span>Rubric evidence</span></div></div>
      <div class="field-list"><p class="eyebrow">Future trial fields</p>${renderDimensionPills(trials.fields)}</div>
    </div></div></section>`,
  );
}

export function renderTrialDetailPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return page(
    "Trial Detail — Tutor Benchmark",
    "Reserved trial detail route for future public Tutor Benchmark result artifacts.",
    "/data/trials/[trialId]/",
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/data/trials/">← Back to trials</a><div class="eyebrow-row">${renderStatusBadge(artifacts.benchmark.statusLabel, "preview")}<span class="eyebrow">Trial detail contract</span></div><h1>Trial detail</h1><p class="lede">Trial pages are the future audit path from a leaderboard number to a case, Tutor response, rubric evidence, and sanitized metrics.</p></div></section><section class="section"><div class="shell">${renderEmptyState("No trial selected", "A future /data/trials/[trialId] route will be populated only from public, validated trial artifacts. The website will never execute a Judge to fill this page.")}</div></section>`,
  );
}
