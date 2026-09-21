import type {
  PublicCaseArtifact,
  PublicBenchmarkArtifacts,
  TutorEvalPublicCase,
} from "../../datasets/public.js";
import {
  SITE_GITHUB_URL,
  escapeHtml,
  humanize,
  renderEmptyState,
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

function difficultyField(
  value: TutorEvalPublicCase["metadata"]["difficulty"],
  field: "learnerLevel" | "taskDifficulty" | "pedagogicalDifficulty",
): string {
  if (typeof value === "object" && value !== null) {
    const fieldValue = value[field];
    return field === "learnerLevel"
      ? humanize(String(fieldValue))
      : `${String(fieldValue)} / 5`;
  }
  return value === undefined ? "Not specified" : humanize(String(value));
}

function renderCaseFacts(
  items: readonly (readonly [string, string, string])[],
): string {
  return `<dl class="case-facts">${items
    .map(
      ([label, value, iconName]) => `<div><span class="case-fact-icon">${icon(iconName)}</span><div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div></div>`,
    )
    .join("")}</dl>`;
}

function renderCaseProfile(
  profile: TutorEvalPublicCase["tutorInput"]["studentProfile"],
  difficulty: TutorEvalPublicCase["metadata"]["difficulty"],
): string {
  const level = profile?.level ??
    (typeof difficulty === "object" && difficulty !== null
      ? difficulty.learnerLevel
      : undefined);
  const knownConcepts = profile?.knownConcepts?.length
    ? profile.knownConcepts.join(", ")
    : "Not specified";
  const goal = profile?.goal ?? "Not specified";
  return `<dl class="case-profile-list">
    <div><dt>Learner level</dt><dd>${escapeHtml(level === undefined ? "Not specified" : humanize(level))}</dd></div>
    <div><dt>Goal</dt><dd>${escapeHtml(goal)}</dd></div>
    <div><dt>Known concepts</dt><dd>${escapeHtml(knownConcepts)}</dd></div>
  </dl>`;
}

function renderCapabilityTags(tags: readonly string[]): string {
  if (tags.length === 0) {
    return `<p class="case-detail-muted">Not specified</p>`;
  }
  return `<ul class="case-capability-list">${tags
    .map((tag) => `<li>${escapeHtml(humanize(tag))}</li>`)
    .join("")}</ul>`;
}

function renderConversation(
  conversation: TutorEvalPublicCase["tutorInput"]["conversationHistory"],
  currentStudentMessage: string,
  locale: string,
): string {
  const history = conversation ?? [];
  const historyMarkup = history
    .map(
      (message) => {
        const isTutor = message.role.toLowerCase() === "tutor";
        return `<li class="case-turn ${isTutor ? "case-turn-tutor" : "case-turn-student"}">
          <span class="case-turn-avatar">${icon(isTutor ? "robot" : "user")}</span>
          <div class="case-turn-bubble"><div class="case-turn-head"><strong>${escapeHtml(humanize(message.role))}</strong><span>Prior context</span></div><p lang="${escapeHtml(locale)}">${escapeHtml(message.text)}</p></div>
        </li>`;
      },
    )
    .join("");
  return `<ol class="case-transcript" aria-label="Tutor-visible conversation">${historyMarkup}
    <li class="case-turn case-turn-student case-turn-current">
      <span class="case-turn-avatar">${icon("user")}</span>
      <div class="case-turn-bubble"><div class="case-turn-head"><strong>Student</strong><span>Current message</span></div><p lang="${escapeHtml(locale)}">${escapeHtml(currentStudentMessage)}</p></div>
    </li>
  </ol>${history.length === 0 ? `<p class="case-transcript-note"><span>${icon("info")}</span>There is no prior conversation. This case starts with the current student message.</p>` : ""}`;
}

function renderCaseBotanical(): string {
  return `<svg class="case-detail-botanical" viewBox="0 0 280 220" fill="none" aria-hidden="true" focusable="false"><circle cx="184" cy="116" r="58" fill="currentColor" opacity=".08"/><path d="M150 196c-6-40 1-75 23-103 15-19 26-36 25-67" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M171 121c-28-7-46-22-55-46 24 3 43 16 55 46ZM175 101c-4-31 3-58 26-82 8 29 1 56-26 82ZM178 145c22-8 40-25 49-51-25 7-42 23-49 51ZM155 156c-27-1-48-12-64-33 26-4 48 7 64 33Z" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M168 124c-13 24-24 47-29 70" stroke="currentColor" stroke-width=".8" stroke-linecap="round" opacity=".7"/></svg>`;
}

export function renderCaseDetailPage(
  artifacts: PublicBenchmarkArtifacts,
  caseArtifact: TutorEvalPublicCase,
): SitePage {
  const difficulty = caseArtifact.metadata.difficulty;
  const capabilityTags = caseArtifact.metadata.capabilityTags ?? [];
  const locale = caseArtifact.locale ?? "en";
  const caseSummary = [
    caseArtifact.tutorInput.problemContext,
    caseArtifact.tutorInput.learningObjective,
  ]
    .filter((value): value is string => value !== undefined && value.trim().length > 0)
    .join(" ");
  const dossierFacts: readonly (readonly [string, string, string])[] = [
    ["Case ID", caseArtifact.id, "bookmark"],
    ["Dataset", `${artifacts.cases.datasetId}@${artifacts.cases.datasetVersion}`, "database"],
    ["Version", caseArtifact.version, "refresh"],
    ["Subject", humanize(caseArtifact.metadata.subject), "book"],
    ["Topic", humanize(caseArtifact.metadata.topic), "document"],
    ["Locale", locale, "guidance"],
    ["Learner level", difficultyField(difficulty, "learnerLevel"), "adaptation"],
    ["Task difficulty", difficultyField(difficulty, "taskDifficulty"), "chart"],
    ["Pedagogical difficulty", difficultyField(difficulty, "pedagogicalDifficulty"), "chart"],
    ["Student state", humanize(caseArtifact.metadata.studentState ?? "Not specified"), "user"],
    ["Disclosure policy", humanize(caseArtifact.disclosurePolicy ?? "Not specified"), "shield"],
  ];
  return page(
    `${humanize(caseArtifact.metadata.topic)} — Teachometry`,
    `Public TutorEval case ${caseArtifact.id}: ${caseArtifact.tutorInput.learningObjective}`,
    `/data/cases/${encodeURIComponent(caseArtifact.id)}/`,
    `<div class="case-detail-main">
      <section class="case-detail-hero" aria-labelledby="case-detail-title">
        <div class="shell">
          <div class="case-detail-breadcrumbs"><nav aria-label="Breadcrumb"><a href="/data/cases/">Cases</a><span aria-hidden="true">›</span><a href="/data/cases/#case-library">Case Library</a><span aria-hidden="true">›</span><span aria-current="page">${escapeHtml(caseArtifact.id)}</span></nav><a class="case-detail-back" href="/data/cases/">← Back to case explorer</a></div>
          <div class="case-detail-hero-grid">
            <div class="case-detail-hero-copy">
              <div class="case-detail-identity"><span class="case-detail-bookmark">${icon("bookmark")}</span><span class="case-detail-id">${escapeHtml(caseArtifact.id)}</span><span class="case-detail-subject">${escapeHtml(humanize(caseArtifact.metadata.subject))}</span></div>
              <h1 id="case-detail-title">${escapeHtml(humanize(caseArtifact.metadata.topic))}</h1>
              <p class="case-detail-summary" lang="${escapeHtml(locale)}">${escapeHtml(caseSummary)}</p>
            </div>
            <div class="case-detail-hero-aside">${renderCaseBotanical()}<p>Authentic challenges.<br><em>Transparent benchmarks.</em></p><span>A closer look at an <br>authored public case.</span></div>
          </div>
        </div>
      </section>
      <section class="case-detail-section" aria-label="Public case file">
        <div class="shell case-detail-layout">
          <aside class="case-dossier" aria-labelledby="case-dossier-title">
            <div class="case-dossier-content"><div class="case-section-heading"><span class="case-section-icon">${icon("document")}</span><div><h2 id="case-dossier-title">Case dossier</h2><p>Key information at a glance.</p></div></div>${renderCaseFacts(dossierFacts)}</div>
            <div class="case-public-callout"><span class="case-callout-icon">${icon("check")}</span><div><strong>Public case</strong><p>This authored case is part of the public Teachometry development set. It is designed for research and evaluation, not a real classroom or user record.</p></div></div>
          </aside>
          <section class="case-context" aria-labelledby="case-context-title">
            <header class="case-panel-heading"><span class="case-section-icon">${icon("guidance")}</span><div><h2 id="case-context-title">Tutor-visible context and conversation</h2><p>The following context is available to the tutor in this case.</p></div></header>
            <div class="case-context-body">${caseArtifact.tutorInput.problemContext === undefined ? "" : `<div class="case-context-note" lang="${escapeHtml(locale)}"><span class="case-mini-label">Problem context</span><p>${escapeHtml(caseArtifact.tutorInput.problemContext)}</p></div>`}${renderConversation(caseArtifact.tutorInput.conversationHistory, caseArtifact.tutorInput.studentMessage, locale)}<p class="case-input-note"><span>${icon("document")}</span>This case file presents tutor-visible input context. It is not a generated trial, model response, or evaluation result.</p></div>
          </section>
          <aside class="case-annotations" aria-label="Case annotations">
            <section class="case-annotation-block" aria-labelledby="objective-title"><div class="case-annotation-heading"><span class="case-section-icon">${icon("target")}</span><h2 id="objective-title">Learning objective</h2></div><p class="case-objective" lang="${escapeHtml(locale)}">${escapeHtml(caseArtifact.tutorInput.learningObjective)}</p></section>
            <section class="case-annotation-block" aria-labelledby="profile-title"><div class="case-annotation-heading"><span class="case-section-icon">${icon("user")}</span><h2 id="profile-title">Student profile</h2></div>${renderCaseProfile(caseArtifact.tutorInput.studentProfile, difficulty)}</section>
            <section class="case-annotation-block" aria-labelledby="capabilities-title"><div class="case-annotation-heading"><span class="case-section-icon">${icon("chart")}</span><h2 id="capabilities-title">Capability focus</h2></div>${renderCapabilityTags(capabilityTags)}</section>
            <section class="case-annotation-block case-notes" aria-labelledby="notes-title"><div class="case-annotation-heading"><span class="case-section-icon">${icon("document")}</span><h2 id="notes-title">Case notes</h2></div><p>This case is an authored, structured scenario from the public Teachometry development set. It is not a real classroom record.</p></section>
          </aside>
          <section class="case-boundary" aria-labelledby="boundary-title"><div class="case-boundary-intro"><span class="case-boundary-icon">${icon("shield")}</span><div><h2 id="boundary-title">Public boundary</h2><p>To ensure a fair and transparent benchmark, only tutor-visible information is publicly released.</p></div></div><div class="case-boundary-exclusions"><strong>Not included in the public case file:</strong><ul class="case-exclusion-list"><li><span aria-hidden="true">×</span>Ground truth answers</li><li><span aria-hidden="true">×</span>Full evaluation rubrics</li><li><span aria-hidden="true">×</span>Known-misconception annotations</li><li><span aria-hidden="true">×</span>Evaluator-only evidence</li><li><span aria-hidden="true">×</span>Hidden challenge details</li><li><span aria-hidden="true">×</span>Any private or non-public data</li></ul></div></section>
        </div>
      </section>
    </div>${renderTeachometryFooter(artifacts)}`,
  );
}

interface ExplorerStat {
  readonly value: string;
  readonly label: string;
  readonly note: string;
}

interface ExplorerBreadcrumb {
  readonly label: string;
  readonly href?: string;
}

const explorerDimensionCopy: Readonly<Record<string, { readonly description: string; readonly icon: string }>> = {
  correctness: { description: "Right or wrong information", icon: "correctness" },
  diagnosis: { description: "Understanding learner needs", icon: "diagnosis" },
  guidance: { description: "Quality of next steps", icon: "guidance" },
  adaptation: { description: "Responsiveness to learner state", icon: "adaptation" },
  actionability: { description: "Usability and follow-through", icon: "actionability" },
};

const trialFieldLabels: Readonly<Record<string, string>> = {
  model: "Model identity",
  modelVersion: "Model version",
  datasetVersion: "Dataset version",
  generationSpecId: "Generation spec ID",
  generationSpecVersion: "Generation spec version",
  promptVersion: "Prompt version",
  promptSha256: "Prompt SHA-256",
  caseVersion: "Case version",
  runIndex: "Run index",
  tutorResponse: "Tutor response",
  correctness: "Correctness",
  diagnosis: "Diagnosis",
  guidance: "Guidance",
  adaptation: "Adaptation",
  actionability: "Actionability",
  rubricResults: "Rubric results",
  criticalFailures: "Critical failures",
  answerLeakage: "Answer leakage",
  judge: "Judge",
  judgePromptVersion: "Judge prompt version",
  tokens: "Tokens",
  latency: "Latency",
  cost: "Cost",
};

const trialFieldGroups = [
  {
    title: "Identity & execution",
    description: "The versioned identities that make a run addressable.",
    icon: "database",
    fields: ["model", "modelVersion", "datasetVersion", "caseVersion", "runIndex"],
  },
  {
    title: "Generation traceability",
    description: "The configuration references needed to reproduce generation.",
    icon: "package",
    fields: ["generationSpecId", "generationSpecVersion", "promptVersion", "promptSha256"],
  },
  {
    title: "Tutor evidence",
    description: "The complete public Tutor response for the case.",
    icon: "guidance",
    fields: ["tutorResponse"],
  },
  {
    title: "Evaluation evidence",
    description: "Dimension results and failure evidence attached to the response.",
    icon: "check",
    fields: ["correctness", "diagnosis", "guidance", "adaptation", "actionability", "rubricResults", "criticalFailures", "answerLeakage"],
  },
  {
    title: "Judge evidence",
    description: "The evaluator identity and prompt version, when published.",
    icon: "shield",
    fields: ["judge", "judgePromptVersion"],
  },
  {
    title: "Operational metrics",
    description: "Sanitized run signals kept distinct from pedagogical scores.",
    icon: "chart",
    fields: ["tokens", "latency", "cost"],
  },
] as const;

function explorerFieldLabel(field: string): string {
  return trialFieldLabels[field] ?? humanize(field);
}

function renderExplorerBotanical(className: string): string {
  return `<svg class="explorer-botanical ${escapeHtml(className)}" viewBox="0 0 260 340" fill="none" aria-hidden="true" focusable="false"><path d="M128 326c-4-72 8-137 42-193 22-36 38-72 42-121" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M153 224c-37-10-67-31-90-65 35 2 68 22 90 65ZM164 188c-5-45 8-84 39-118 9 43-2 82-39 118ZM177 251c35-11 63-35 83-72-38 9-67 34-83 72ZM136 278c-38-2-71-17-98-48 37-4 73 12 98 48Z" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M158 224c-18 34-31 67-39 102" stroke="currentColor" stroke-width=".8" stroke-linecap="round" opacity=".72"/></svg>`;
}

function renderExplorerStats(stats: readonly ExplorerStat[]): string {
  return `<dl class="explorer-stats" aria-label="Public explorer status">${stats.map((stat) => `<div class="explorer-stat"><dd>${escapeHtml(stat.value)}</dd><dt>${escapeHtml(stat.label)}</dt><small>${escapeHtml(stat.note)}</small></div>`).join("")}</dl>`;
}

function renderExplorerHero(options: {
  readonly kind: "heatmap" | "trials" | "detail";
  readonly breadcrumbs: readonly ExplorerBreadcrumb[];
  readonly eyebrow: string;
  readonly heading: string;
  readonly editorial: string;
  readonly description: string;
  readonly note: string;
  readonly stats?: readonly ExplorerStat[];
}): string {
  const breadcrumbMarkup = options.breadcrumbs.map((item, index) => `${index > 0 ? `<span aria-hidden="true">›</span>` : ""}${item.href === undefined ? `<span aria-current="page">${escapeHtml(item.label)}</span>` : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`}`).join("");
  return `<section class="explorer-hero explorer-${options.kind}-hero" aria-labelledby="${options.kind}-title"><div class="shell"><div class="explorer-hero-grid"><div class="explorer-hero-copy"><nav class="explorer-breadcrumbs" aria-label="Breadcrumb">${breadcrumbMarkup}</nav><p class="eyebrow">${escapeHtml(options.eyebrow)}</p><h1 id="${options.kind}-title">${escapeHtml(options.heading)}</h1><p class="explorer-hero-editorial">${escapeHtml(options.editorial).replaceAll("\n", "<br>")}</p><p class="explorer-hero-description">${escapeHtml(options.description)}</p></div><div class="explorer-hero-art">${renderExplorerBotanical(`explorer-botanical-${options.kind}`)}<p class="explorer-handwritten">${escapeHtml(options.note).replaceAll("\n", "<br>")}</p></div></div>${options.stats === undefined ? "" : renderExplorerStats(options.stats)}</div></section>`;
}

function renderExplorerTabs(items: readonly [string, string, boolean][], label: string): string {
  return `<nav class="explorer-tabs" aria-label="${escapeHtml(label)}">${items.map(([text, href, current]) => `<a href="${escapeHtml(href)}"${current ? ' aria-current="page"' : ""}>${escapeHtml(text)}</a>`).join("")}</nav>`;
}

function renderHeatmapMatrix(artifacts: PublicBenchmarkArtifacts): string {
  const visibleCases = artifacts.cases.cases.slice(0, 5);
  const remaining = Math.max(0, artifacts.benchmark.dataset.caseCount - visibleCases.length);
  return `<div class="explorer-table-frame explorer-matrix-frame"><div class="explorer-table-scroll" tabindex="0" aria-label="Scrollable evidence matrix"><table class="explorer-matrix"><caption>Case identity rows and versioned public model-run columns</caption><thead><tr><th scope="col" class="explorer-matrix-corner">Public cases ↓</th><th scope="col">Versioned public model runs →</th></tr><tr><th scope="col">Case identity</th><th scope="col" class="explorer-matrix-reserved-heading">No public model runs</th></tr></thead><tbody>${visibleCases.map((item) => `<tr><th scope="row"><a href="/data/cases/${encodeURIComponent(item.id)}/">${escapeHtml(item.id)}</a></th><td><div class="explorer-reserved-cell"><span class="explorer-reserved-grid" aria-hidden="true">${Array.from({ length: 5 }, () => "<i></i>").join("")}</span><span>${icon("clock")} No public run</span><small>Trial-linked evidence reserved</small></div></td></tr>`).join("")}${remaining > 0 ? `<tr class="explorer-more-row"><th scope="row">…</th><td>${escapeHtml(String(remaining))} more public case identities in the artifact</td></tr>` : ""}</tbody></table></div><p class="explorer-table-note">Rows are public case identities. Cells remain neutral until a versioned public model run and its trial artifact exist.</p></div>`;
}

function renderExplorerDimensions(benchmark: PublicBenchmarkArtifacts["benchmark"]): string {
  return `<section id="dimensions" class="explorer-section" aria-labelledby="dimensions-title"><div class="explorer-section-heading"><div><p class="eyebrow">Evaluation dimensions</p><h2 id="dimensions-title">Five lenses for future evidence.</h2><p>Each dimension defines a future trial-linked view of observable tutoring behavior. None is scored on this page today.</p></div></div><div class="explorer-dimension-grid">${benchmark.dimensions.score.map((dimension) => { const copy = explorerDimensionCopy[dimension] ?? { description: "Defined by the public evaluation contract", icon: "document" }; return `<article class="explorer-dimension-card"><span class="explorer-card-icon">${icon(copy.icon)}</span><h3>${escapeHtml(humanize(dimension))}</h3><p>${escapeHtml(copy.description)}</p></article>`; }).join("")}</div></section>`;
}

function renderExplorerSource(artifacts: PublicBenchmarkArtifacts): string {
  const { benchmark, cases, trials } = artifacts;
  return `<aside class="explorer-source" aria-labelledby="explorer-source-title"><span class="explorer-source-icon">${icon("database")}</span><div><p class="eyebrow">Data source</p><h2 id="explorer-source-title">Public artifact contract</h2><p>Built from versioned public artifacts only. The website does not call a Judge or run a model in the browser.</p><dl><div><dt>Dataset</dt><dd>${escapeHtml(`${benchmark.dataset.id}@${benchmark.dataset.version}`)}</dd></div><div><dt>Public cases</dt><dd>${escapeHtml(String(cases.cases.length))}</dd></div><div><dt>Trial publication</dt><dd>${trials.available ? "Available" : "Not available"}</dd></div><div><dt>Artifact schema</dt><dd>${escapeHtml(String(benchmark.schemaVersion))}</dd></div></dl></div><a class="button button-secondary" href="/data/">Explore the data ${icon("arrow")}</a></aside>`;
}

function renderExplorerClosing(title: string, copy: string, links: readonly [string, string][], className: string): string {
  return `<section class="explorer-closing ${escapeHtml(className)}" aria-labelledby="${escapeHtml(className)}-title"><div class="shell explorer-closing-grid"><div><p class="eyebrow">Public evidence, clearly bounded</p><h2 id="${escapeHtml(className)}-title">${escapeHtml(title)}</h2></div><p>${escapeHtml(copy)}</p><div class="explorer-closing-actions">${links.map(([label, href]) => `<a class="button ${href === "/methodology/" ? "button-secondary" : "button-primary"}" href="${escapeHtml(href)}">${escapeHtml(label)} ${icon("arrow")}</a>`).join("")}</div>${renderExplorerBotanical("explorer-closing-botanical")}</div></section>`;
}

export function renderHeatmapPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, models, trials } = artifacts;
  return page(
    "Evidence Matrix — Teachometry",
    "A public case-by-model evidence matrix reserved for versioned Teachometry trial artifacts.",
    "/data/heatmap/",
    `<div class="explorer-main heatmap-main">${renderExplorerHero({
      kind: "heatmap",
      breadcrumbs: [{ label: "Data", href: "/data/" }, { label: "Heatmap" }],
      eyebrow: "Benchmark explorer",
      heading: "Evidence Matrix",
      editorial: "See the landscape\nat a glance.",
      description: "The matrix will connect public benchmark cases with versioned public model runs and their trial evidence. Today, no public model trials are available yet.",
      note: "Different perspectives.\nStronger evidence.",
      stats: [
        { value: String(trials.entries.length), label: "Public model trials", note: "No trials yet" },
        { value: String(models.entries.length), label: "Public model profiles", note: "Reserved" },
        { value: String(benchmark.dataset.caseCount), label: "Public cases", note: `${benchmark.dataset.id} dataset` },
        { value: String(benchmark.dimensions.score.length), label: "Evaluation dimensions", note: benchmark.dimensions.score.map(humanize).join(" · ") },
      ],
    })}<section class="explorer-content"><div class="shell">${renderExplorerTabs([["Matrix", "#matrix", true], ["Dimensions", "#dimensions", false], ["How to read", "/methodology/", false], ["About", "/data/", false]], "Evidence matrix sections")}<section id="matrix" class="explorer-section explorer-matrix-section" aria-labelledby="matrix-title"><div class="explorer-section-heading"><div><p class="eyebrow">Case × model-run structure</p><h2 id="matrix-title">A reserved observatory for public evidence.</h2><p>Rows are real public cases. Columns are reserved for versioned model runs; each future populated cell will trace to a public trial detail record.</p></div><span class="explorer-section-mark">${icon("grid")}</span></div><div class="explorer-empty-callout"><span class="explorer-empty-icon">${icon("grid")}</span><div><h3>No public model trials available yet.</h3><p>${escapeHtml(trials.notice)} The matrix layout, dimensions, and case structure are defined and ready.</p></div><a class="button button-primary" href="/methodology/">Learn how the matrix works ${icon("arrow")}</a></div>${renderHeatmapMatrix(artifacts)}</section>${renderExplorerDimensions(benchmark)}${renderExplorerSource(artifacts)}</div></section>${renderExplorerClosing("From data to deeper understanding.", "Explore the public cases and methodology while the evidence matrix remains intentionally unpopulated.", [["View trials", "/data/trials/"], ["Read the methodology", "/methodology/"]], "heatmap-closing")}${renderTeachometryFooter(artifacts)}</div>`,
  );
}

function renderTrialLedger(artifacts: PublicBenchmarkArtifacts): string {
  const { trials } = artifacts;
  const columns = ["Trial ID", "Model ID", "Case ID", "Run index", "Evidence status"];
  const rows = trials.entries.length === 0
    ? `<tr><td colspan="${columns.length}"><div class="explorer-ledger-empty"><span class="explorer-empty-icon">${icon("document")}</span><strong>No public trials yet.</strong><p>${escapeHtml(trials.notice)}</p><small>Check back after public model runs are released.</small></div></td></tr>`
    : trials.entries.map((entry) => `<tr><th scope="row"><a href="/data/trials/${encodeURIComponent(entry.id)}/">${escapeHtml(entry.id)}</a></th><td>${escapeHtml(entry.modelId)}</td><td>${escapeHtml(entry.caseId)}</td><td>${escapeHtml(String(entry.runIndex))}</td><td>Published artifact</td></tr>`).join("");
  return `<div class="explorer-table-frame explorer-ledger-frame"><div class="explorer-table-scroll" tabindex="0" aria-label="Scrollable public trial ledger"><table class="explorer-ledger"><caption>Future public trial ledger</caption><thead><tr>${columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div><p class="explorer-table-note">The ledger exposes only the public trial summary identity contract: id, modelId, caseId, and runIndex.</p></div>`;
}

function renderTrialFieldGroups(fields: readonly string[]): string {
  const fieldSet = new Set(fields);
  const groupedFields = new Set<string>();
  const cards = trialFieldGroups.map((group) => {
    const present = group.fields.filter((field) => fieldSet.has(field));
    present.forEach((field) => groupedFields.add(field));
    if (present.length === 0) return "";
    return `<article class="explorer-field-group"><span class="explorer-card-icon">${icon(group.icon)}</span><div><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.description)}</p><ul>${present.map((field) => `<li><code>${escapeHtml(field)}</code><span>${escapeHtml(explorerFieldLabel(field))}</span></li>`).join("")}</ul></div></article>`;
  }).join("");
  const additional = fields.filter((field) => !groupedFields.has(field));
  return `${cards}${additional.length === 0 ? "" : `<article class="explorer-field-group"><span class="explorer-card-icon">${icon("list")}</span><div><h3>Additional contract fields</h3><p>Fields retained by the artifact contract but not assigned to a named evidence family.</p><ul>${additional.map((field) => `<li><code>${escapeHtml(field)}</code><span>${escapeHtml(explorerFieldLabel(field))}</span></li>`).join("")}</ul></div></article>`}`;
}

function renderTraceabilityChain(): string {
  const stages = ["Benchmark version", "Model identity", "Trial", "Case", "Tutor response", "Evaluation evidence", "Sanitized metrics"];
  return `<ol class="explorer-trace-chain" aria-label="Future trial traceability chain">${stages.map((stage) => `<li><span>${icon("arrow")}</span><strong>${escapeHtml(stage)}</strong><small>Future public evidence</small></li>`).join("")}</ol>`;
}

export function renderTrialsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, models, trials } = artifacts;
  return page(
    "Model Trials — Teachometry",
    "An audit ledger for future public Teachometry model trial evidence.",
    "/data/trials/",
    `<div class="explorer-main trials-main">${renderExplorerHero({
      kind: "trials",
      breadcrumbs: [{ label: "Data", href: "/data/" }, { label: "Trials" }],
      eyebrow: "Benchmark explorer",
      heading: "Model Trials",
      editorial: "A transparent\naudit trail.",
      description: "Future public trial records will connect model identity, case identity, execution context, Tutor response, evaluator evidence, and sanitized operational metrics.",
      note: "Shared evidence.\nStronger teaching.",
      stats: [
        { value: String(trials.entries.length), label: "Public trials", note: "No released runs yet" },
        { value: String(models.entries.length), label: "Public model profiles", note: "Reserved" },
        { value: String(benchmark.dataset.caseCount), label: "Public cases", note: benchmark.dataset.id },
        { value: trials.entries.length === 0 ? "Not available" : "Available", label: "Trial publication", note: "Public artifact state" },
      ],
    })}<section class="explorer-content"><div class="shell">${renderExplorerTabs([["All trials", "#trial-ledger", true], ["Fields", "#trial-fields", false], ["About", "/methodology/", false]], "Public trial sections")}<section id="trial-ledger" class="explorer-section explorer-ledger-section" aria-labelledby="trial-ledger-title"><div class="explorer-section-heading"><div><p class="eyebrow">Audit ledger</p><h2 id="trial-ledger-title">No row without a public artifact.</h2><p>Each future row will be an addressable evidence record. The current ledger is intentionally empty.</p></div><span class="explorer-section-mark">${icon("document")}</span></div>${renderTrialLedger(artifacts)}</section><section id="trial-fields" class="explorer-section explorer-fields-section" aria-labelledby="trial-fields-title"><div class="explorer-section-heading"><div><p class="eyebrow">Future trial schema</p><h2 id="trial-fields-title">What a trial includes.</h2><p>These families are derived from the current public trial field contract, not from a model run.</p></div></div><div class="explorer-field-grid">${renderTrialFieldGroups(trials.fields)}</div></section><section class="explorer-trace-section" aria-labelledby="trace-title"><div><p class="eyebrow">Traceability chain</p><h2 id="trace-title">From benchmark to evidence.</h2><p>Trials remain separate from model profiles and leaderboard eligibility. A future record will link these stages without implying a ranking or teaching-effectiveness claim.</p></div>${renderTraceabilityChain()}</section><aside class="explorer-relationship" aria-label="Public surface relationships"><span class="explorer-card-icon">${icon("link")}</span><p><strong>Keep the surfaces distinct.</strong> <a href="/models/">Models</a> describe published model identity; <a href="/leaderboard/">Results</a> show rankings only when publication criteria are satisfied; this page is the individual audit ledger.</p></aside></div></section>${renderExplorerClosing("Evidence you can follow.", "Future published results should remain traceable back to versioned cases, model identity, and the evidence that supports each claim.", [["View the results", "/leaderboard/"], ["Read the methodology", "/methodology/"]], "trials-closing")}${renderTeachometryFooter(artifacts)}</div>`,
  );
}

function renderDossierMeta(items: readonly (readonly [string, string, string?])[]): string {
  return `<dl class="explorer-dossier-meta">${items.map(([label, value, note]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}${note === undefined ? "" : `<small>${escapeHtml(note)}</small>`}</dd></div>`).join("")}</dl>`;
}

function renderDetailEvidenceSections(artifacts: PublicBenchmarkArtifacts): string {
  const availableFields = new Set(artifacts.trials.fields);
  const sections = [
    ["Configuration", "Model settings, environment, and execution details.", "package", ["model", "modelVersion", "generationSpecId", "generationSpecVersion", "promptVersion"]],
    ["Case set", "Versioned benchmark cases used in this trial.", "database", ["datasetVersion", "caseVersion"]],
    ["Tutor responses", "Complete Tutor responses and response metadata.", "guidance", ["tutorResponse"]],
    ["Evaluation results", "Rubric scores and dimension breakdowns.", "check", ["correctness", "diagnosis", "guidance", "adaptation", "actionability", "rubricResults", "criticalFailures", "answerLeakage"]],
    ["Artifacts", "Logs, traces, and sanitized supporting files.", "document", ["tokens", "latency", "cost"]],
    ["Reproducibility", "Instructions, identities, and checksums.", "shield", ["promptSha256", "judge", "judgePromptVersion", "runIndex"]],
  ] as const;
  return `<div class="explorer-evidence-list">${sections.map(([title, description, iconName, fields]) => { const visibleFields = fields.filter((field) => availableFields.has(field)); return `<article class="explorer-evidence-row"><span class="explorer-evidence-icon">${icon(iconName)}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${visibleFields.length === 0 ? "" : `<small>Contract fields: ${visibleFields.map(explorerFieldLabel).map(escapeHtml).join(" · ")}</small>`}</div><span class="explorer-unavailable">Not available</span></article>`; }).join("")}</div>`;
}

function renderDetailProvenance(): string {
  const stages = ["Model identity", "Execution identity", "Case identity", "Tutor response", "Evaluator evidence", "Sanitized metrics"];
  return `<ol class="explorer-provenance-chain" aria-label="Trial provenance chain">${stages.map((stage, index) => `<li><span class="explorer-provenance-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(stage)}</strong><small>Not available</small></div>${index === stages.length - 1 ? "" : `<span class="explorer-provenance-arrow" aria-hidden="true">↓</span>`}</li>`).join("")}</ol>`;
}

export function renderTrialDetailPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark } = artifacts;
  const datasetContext = `${benchmark.dataset.id}@${benchmark.dataset.version}`;
  const dimensionRows = benchmark.dimensions.score.map((dimension) => [humanize(dimension), "—"] as const);
  return page(
    "Trial Detail — Teachometry",
    "Reserved Teachometry evidence dossier for a future public model trial artifact.",
    "/data/trials/[trialId]/",
    `<div class="explorer-main detail-main">${renderExplorerHero({
      kind: "detail",
      breadcrumbs: [{ label: "Data", href: "/data/" }, { label: "Trials", href: "/data/trials/" }, { label: "Trial detail" }],
      eyebrow: "Trial details",
      heading: "Trial detail",
      editorial: "A complete record of\nevidence.",
      description: "This reserved route will show the complete record for a public model trial, including configuration, responses, evaluation results, and links to underlying artifacts.",
      note: "Traceable evidence.\nReal progress.",
    })}<section class="explorer-content"><div class="shell"><a class="explorer-back-link" href="/data/trials/">${icon("left")} Back to model trials</a><aside class="explorer-reserved-callout" aria-labelledby="reserved-title"><span class="explorer-reserved-callout-icon">${icon("clock")}</span><div><p class="eyebrow">Reserved evidence dossier</p><h2 id="reserved-title">No public trial is selected.</h2><p>This route resolves only from a public, validated trial artifact. No trial identity, model identity, Tutor response, score, metric, or trial evidence is inferred or generated here.</p></div></aside><section class="explorer-section explorer-overview-section" aria-labelledby="overview-title"><div class="explorer-section-heading"><div><p class="eyebrow">Schema-only dossier</p><h2 id="overview-title">Trial overview <span>(future)</span></h2><p>Current benchmark context is shown only to identify the public contract; it is not evidence of a model execution.</p></div></div><div class="explorer-overview-grid"><article class="explorer-dossier-card"><h3>Trial identity</h3>${renderDossierMeta([["Trial ID", "—"], ["Model", "—"], ["Model version", "—"], ["Case", "—"], ["Case version", "—"], ["Run index", "—"]])}</article><article class="explorer-dossier-card explorer-results-summary"><h3>Results summary <span>(future)</span></h3><div class="explorer-summary-empty"><span>${icon("clock")}</span><strong>No results yet</strong><p>Evaluation results will appear here once this trial is released.</p></div></article></div><article class="explorer-context-note"><span class="explorer-card-icon">${icon("database")}</span><div><strong>Current benchmark context only</strong><p>${escapeHtml(datasetContext)} · ${escapeHtml(String(benchmark.dataset.caseCount))} public cases · ${escapeHtml(String(benchmark.schemaVersion))} artifact schema. This context is not a model run, result, or trial.</p></div></article></section><section class="explorer-section explorer-evidence-section" aria-labelledby="evidence-title"><div class="explorer-section-heading"><div><p class="eyebrow">Evidence sections (future)</p><h2 id="evidence-title">A complete provenance record, when published.</h2><p>Each section remains neutral until the corresponding public artifact is available.</p></div></div>${renderDetailEvidenceSections(artifacts)}</section><section class="explorer-section explorer-dossier-fields-section" aria-labelledby="dossier-fields-title"><div class="explorer-section-heading"><div><p class="eyebrow">Evaluation contract</p><h2 id="dossier-fields-title">Dimensions and evidence fields.</h2><p>The five canonical dimensions remain separate from operational metrics and Judge metadata.</p></div></div><div class="explorer-dossier-columns"><article class="explorer-dossier-card"><h3>Evaluation dimensions</h3>${renderDossierMeta(dimensionRows)}</article><article class="explorer-dossier-card"><h3>Rubric, Judge &amp; metrics</h3>${renderDossierMeta([["Rubric results", "—"], ["Critical failures", "—"], ["Answer leakage", "—"], ["Judge", "—"], ["Judge prompt version", "—"], ["Tokens", "—"], ["Latency", "—"], ["Cost", "—"]])}</article></div></section><section class="explorer-section explorer-provenance-section" aria-labelledby="provenance-title"><div class="explorer-section-heading"><div><p class="eyebrow">Provenance chain</p><h2 id="provenance-title">Every stage must remain inspectable.</h2><p>The browser never calls a Judge to fill an unresolved stage.</p></div></div>${renderDetailProvenance()}</section></div></section>${renderExplorerClosing("From evidence to better teaching.", "Public trial records can make AI tutoring more transparent, comparable, and useful for real educational progress without overstating what the benchmark measures.", [["View all trials", "/data/trials/"], ["Read the methodology", "/methodology/"]], "detail-closing")}${renderTeachometryFooter(artifacts)}</div>`,
  );
}
