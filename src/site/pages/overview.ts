import {
  PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS,
  type PublicBenchmarkArtifacts,
  type PublicBenchmarkArtifact,
  type PublicCaseArtifact,
} from "../../datasets/public.js";
import {
  escapeHtml,
  formatDifficulty,
  humanize,
  renderDimensionPills,
  renderEmptyState,
  renderStatusBadge,
  renderUiText,
  SITE_GITHUB_URL,
  type SitePage,
} from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachometryFooter } from "./home.js";

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

export { renderHomePage } from "./home.js";

interface ResultsTableColumn {
  readonly key: string;
  readonly label: string;
  readonly detail?: string;
}

function resultsFieldLabel(field: string): string {
  const labels: Readonly<Record<string, string>> = {
    rank: "#",
    model: "Model",
    provider: "Provider",
    modelVersion: "Model version",
    overallTutorCapabilityScore: "Overall",
    correctness: "Correctness",
    diagnosis: "Diagnosis",
    guidance: "Guidance",
    adaptation: "Adaptation",
    actionability: "Actionability",
    cost: "Cost",
    latencyMs: "Latency",
    tokens: "Tokens",
    datasetVersion: "Dataset cohort",
    generationSpecId: "Generation spec ID",
    generationSpecVersion: "Generation spec version",
    promptVersion: "Prompt version",
    promptId: "Prompt ID",
    promptSha256: "Prompt SHA-256",
    maxOutputTokens: "Max output tokens",
    runs: "Runs",
  };
  return labels[field] ?? humanize(field);
}

function renderResultsHeroArt(): string {
  return `<svg class="results-hero-svg" viewBox="0 0 720 410" role="img" aria-label="Decorative line drawing of a report and leaves">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path class="results-leaf-stem" d="M94 322C156 256 188 186 192 66" />
      <path class="results-leaf-stem" d="M90 320C62 262 47 218 53 172" />
      <path class="results-leaf" d="M168 144C133 120 116 91 124 60C155 74 174 101 168 144Z" />
      <path class="results-leaf" d="M136 205C97 194 68 168 66 135C102 137 130 163 136 205Z" />
      <path class="results-leaf" d="M104 257C73 252 44 233 37 207C69 202 96 221 104 257Z" />
      <path class="results-leaf" d="M191 105C211 79 232 67 253 70C244 96 223 112 191 105Z" />
      <path class="results-paper results-paper-back" d="M214 57 516 38 555 329 252 354Z" />
      <path class="results-paper results-paper-mid" d="m276 65 284-4 22 281-284 13Z" />
      <path class="results-paper results-paper-front" d="m328 84 278 12 4 251-280 2Z" />
      <path class="results-paper-line" d="M364 139h159M364 164h118M364 189h169M364 214h130" />
      <path class="results-paper-chart" d="M365 293v-42M397 293v-72M429 293v-27M461 293v-91M493 293v-54M365 293h151" />
      <path class="results-paper-chart" d="m365 236 31-20 33 15 32-40 32 27 22-26" />
      <path class="results-paper-mark" d="M365 116h72" />
      <path class="results-leaf-stem" d="M633 353C647 294 666 247 704 207" />
      <path class="results-leaf" d="M650 292C617 278 601 255 605 230C631 236 648 258 650 292Z" />
      <path class="results-leaf" d="M673 253C680 225 698 208 719 208C716 235 699 252 673 253Z" />
    </g>
  </svg>`;
}

function renderResultsBotanical(): string {
  return `<svg class="results-botanical" viewBox="0 0 220 260" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M108 258C108 207 119 158 147 113C166 83 184 54 193 16" stroke-width="1.4" />
      <path d="M127 177C99 153 73 125 50 92M116 216C83 206 55 190 24 166M141 132C165 120 188 99 208 75" stroke-width="1" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="1">
      <path d="M50 92C37 76 28 57 32 42C49 47 62 63 64 80C60 86 56 90 50 92Z" />
      <path d="M24 166C12 149 8 131 16 116C33 125 42 142 39 158C34 162 29 165 24 166Z" />
      <path d="M208 75C207 56 215 38 229 29C232 50 224 68 212 78Z" />
      <path d="M193 16C196 35 190 51 179 62C170 50 171 35 181 24C185 20 189 17 193 16Z" />
    </g>
  </svg>`;
}

function renderResultsTable(benchmark: PublicBenchmarkArtifact, models: PublicBenchmarkArtifacts["models"]): string {
  const modelFields = new Set(models.fields);
  const columns: ResultsTableColumn[] = [
    { key: "rank", label: resultsFieldLabel("rank") },
    { key: "model", label: resultsFieldLabel("model") },
    { key: "overallTutorCapabilityScore", label: resultsFieldLabel("overallTutorCapabilityScore"), detail: "↑" },
    ...benchmark.dimensions.score.map((field) => ({ key: field, label: resultsFieldLabel(field) })),
    ...(modelFields.has("cost") ? [{ key: "cost", label: resultsFieldLabel("cost"), detail: "USD / 1K" }] : []),
    ...(modelFields.has("latencyMs") ? [{ key: "latencyMs", label: resultsFieldLabel("latencyMs"), detail: "s" }] : []),
    { key: "benchmarkVersion", label: "Benchmark version" },
    ...(modelFields.has("promptVersion") ? [{ key: "promptVersion", label: resultsFieldLabel("promptVersion") }] : []),
    ...(modelFields.has("datasetVersion") ? [{ key: "datasetVersion", label: resultsFieldLabel("datasetVersion") }] : []),
  ];
  return `<div class="results-table-frame">
    <div class="results-table-scroll" tabindex="0" aria-label="Scrollable future leaderboard schema">
      <table class="results-table" data-result-schema="future-public-leaderboard">
        <caption>Future public model leaderboard schema</caption>
        <thead><tr>${columns.map((column) => `<th scope="col" data-schema-field="${escapeHtml(column.key)}"><span>${escapeHtml(column.label)}</span>${column.detail === undefined ? "" : `<small>${escapeHtml(column.detail)}</small>`}</th>`).join("")}</tr></thead>
        <tbody><tr><td colspan="${columns.length}"><div class="results-table-empty"><span class="results-empty-icon">${icon("document")}</span><strong>No public model rows are available yet.</strong><p>${escapeHtml(models.notice)} Synthetic demonstrations and preliminary model artifacts are not public rankings.</p></div></td></tr></tbody>
      </table>
    </div>
    <p class="results-table-mobile-note">Swipe horizontally to inspect the future schema. No result values are published in this preview.</p>
  </div>`;
}

function renderReadinessRow(
  title: string,
  status: string,
  description: string,
  tone: "available" | "ready" | "pending",
): string {
  return `<li class="results-readiness-row"><span class="results-readiness-marker results-marker-${tone}" aria-hidden="true">${tone === "pending" ? "" : icon("check")}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><span class="results-status results-status-${tone}">${escapeHtml(status)}</span></li>`;
}

function renderResultsReadiness(benchmark: PublicBenchmarkArtifact): string {
  const infrastructureAvailable = benchmark.calibration.infrastructure === "available";
  const humanCalibrationStarted = benchmark.calibration.independentHumanCalibration !== "not_completed";
  const judgeValidationCompleted = benchmark.calibration.judgeVsHumanValidation !== "not_completed";
  const statisticalValidationCompleted = benchmark.calibration.statisticalValidation !== "not_completed";
  return `<ol class="results-readiness-list">
    ${renderReadinessRow("Evaluation infrastructure", infrastructureAvailable ? "Available" : "Not available", "Benchmark, evaluators, and scoring pipeline are available.", infrastructureAvailable ? "available" : "pending")}
    ${renderReadinessRow("Calibration infrastructure", infrastructureAvailable ? "Available" : "Not available", "Tools and workflows for calibration are in place.", infrastructureAvailable ? "available" : "pending")}
    ${renderReadinessRow("Community Review infrastructure", "Deployment-ready", "Public reviewer intake remains closed, and the real Community Review campaign has not started.", "ready")}
    ${renderReadinessRow("Human calibration (P5)", humanCalibrationStarted ? "In progress" : "Not started", "No real human calibration data is available yet.", humanCalibrationStarted ? "ready" : "pending")}
    ${renderReadinessRow("Judge-vs-human validation", judgeValidationCompleted ? "Completed" : "Not completed", "A Judge result is not presented as human-reference validation.", judgeValidationCompleted ? "ready" : "pending")}
    ${renderReadinessRow("Statistical validation", statisticalValidationCompleted ? "Completed" : "Not completed", "No statistical validation claim is made for the current benchmark.", statisticalValidationCompleted ? "ready" : "pending")}
  </ol>`;
}

function renderResultsReadingGuide(benchmark: PublicBenchmarkArtifact): string {
  const scoreLabels = benchmark.dimensions.score.map(humanize).join(", ");
  const traceabilityLabels = PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS.map(resultsFieldLabel).join(", ");
  const guideItems = [
    ["document", "Same benchmark, same version", `Compare models only within the same benchmark version and evaluation configuration. Dataset ${benchmark.dataset.version} and traceability fields such as ${traceabilityLabels} remain part of the context.`],
    ["actionability", "Context matters", "Results belong to specific authored cases and benchmark scope. Model family, snapshot, access method, and generation identity must stay visible."],
    ["adaptation", "Not a universal ranking", "Results reflect performance on structured, authored benchmark cases, not general classroom teaching effectiveness."],
    ["chart", "Multiple dimensions", `Look beyond the overall score. Different models may have different strengths across ${scoreLabels}.`],
    ["correctness", "Reproducible and auditable", "Future results should remain tied to public, versioned artifacts and traceability data."],
  ] as const;
  return `<aside class="results-reading-guide" aria-labelledby="results-reading-title"><h2 id="results-reading-title">How to read future results</h2><p class="results-reading-lede">When results are available, keep the following in mind:</p><ul>${guideItems.map(([iconName, title, copy]) => `<li><span class="results-guide-icon">${icon(iconName)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></span></li>`).join("")}</ul></aside>`;
}

function renderResultsScorePreview(benchmark: PublicBenchmarkArtifact): string {
  return `<div class="results-score-preview"><div class="results-score overall"><span>Overall</span><strong>—</strong></div>${benchmark.dimensions.score.map((dimension) => `<div class="results-score"><span>${escapeHtml(resultsFieldLabel(dimension))}</span><strong>—</strong></div>`).join("")}</div>`;
}

function renderResultsContractPanel(
  title: string,
  content: string,
  className = "",
): string {
  return `<section class="results-contract-panel${className.length === 0 ? "" : ` ${className}`}" aria-label="${escapeHtml(title)}"><h4>${escapeHtml(title)}</h4>${content}</section>`;
}

function renderResultsModelContract(benchmark: PublicBenchmarkArtifact, models: PublicBenchmarkArtifacts["models"]): string {
  const subjects = Object.keys(benchmark.coverage.casesBySubject).slice(0, 3);
  const capabilities = Object.keys(benchmark.coverage.casesByCapabilityTag).slice(0, 3);
  const operationalFields = ["cost", "latencyMs", "tokens"].filter((field) => benchmark.dimensions.operational.includes(field));
  const subjectRows = (subjects.length === 0 ? ["Authored subjects"] : subjects).map((subject) => `<li><span>${escapeHtml(humanize(subject))}</span><b>—</b></li>`).join("");
  const capabilityRows = (capabilities.length === 0 ? ["Case-level capabilities"] : capabilities).map((capability) => `<li><span>${escapeHtml(humanize(capability))}</span><b>—</b></li>`).join("");
  const efficiencyRows = operationalFields.map((field) => `<li><span>${escapeHtml(resultsFieldLabel(field))}</span><b>—</b></li>`).join("");
  const traceabilityFields = ["Provider snapshot", "Model version", "Benchmark version", "Prompt version", "Dataset cohort", "GenerationSpecId", "Execution identity"];
  return `<article class="results-model-contract" aria-label="Future public model result contract">
    <div class="results-model-heading"><span class="results-model-icon">${icon("document")}</span><div><p class="eyebrow">Model result contract</p><h3>Future public model result</h3><p>Versioned model identity and evidence fields; no public row is available yet.</p></div><span class="results-contract-caret" aria-hidden="true">⌄</span></div>
    ${renderResultsScorePreview(benchmark)}
    <div class="results-contract-grid">
      ${renderResultsContractPanel("Subject breakdown", `<ul>${subjectRows}</ul>`)}
      ${renderResultsContractPanel("Capability breakdown", `<ul>${capabilityRows}</ul>`)}
      ${renderResultsContractPanel("Efficiency", `<ul>${efficiencyRows.length === 0 ? `<li><span>Operational signals</span><b>—</b></li>` : efficiencyRows}</ul>`)}
      ${renderResultsContractPanel("Metadata & traceability", `<ul>${traceabilityFields.map((field) => `<li><span>${escapeHtml(field)}</span><b>${field === "Benchmark version" ? escapeHtml(benchmark.benchmarkVersion) : field === "Dataset cohort" ? escapeHtml(`${benchmark.dataset.id}@${benchmark.dataset.version}`) : "—"}</b></li>`).join("")}</ul><p class="results-contract-note">${escapeHtml(models.fields.includes("generationSpecId") ? "Generation identity and execution fields remain part of the future public contract." : "Additional traceability fields will follow the public artifact contract.")}</p>`)}
    </div>
  </article>`;
}

function renderResultsClosing(artifacts: PublicBenchmarkArtifacts): string {
  return `<section class="results-closing" aria-labelledby="results-closing-title"><div class="shell results-closing-grid"><div><p class="eyebrow">Our commitment</p><h2 id="results-closing-title"><span class="results-closing-leaf">${icon("leaf")}</span>No ranking without evidence.<br>No score without context.</h2></div><p>We are building an open, transparent, and community-driven benchmark for AI tutoring. Thank you for your interest and support.</p><div class="results-closing-actions"><a class="button button-primary" href="/methodology/#methodology-status">Follow our progress ${icon("arrow")}</a><a class="button button-secondary" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">View on GitHub ${icon("arrow")}</a></div></div></section>${renderTeachometryFooter(artifacts)}`;
}

export function renderLeaderboardPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, models } = artifacts;
  return page(
    "Results — Teachometry",
    "Transparent, versioned benchmark results with evidence and context. Public model rankings are not available yet.",
    "/leaderboard/",
    `<div class="results-main">
      <section class="results-hero" aria-labelledby="results-title"><div class="shell results-hero-grid"><div class="results-hero-copy"><p class="eyebrow">Results</p><h1 id="results-title">Results,<br>with the <em>context</em> intact.</h1><p class="results-hero-lede">Teachometry will publish benchmark results after the evaluation corpus, calibration, and validation processes are complete. We prioritize trustworthy, reproducible, and well-contextualized results over premature rankings.</p><div class="button-row"><a class="button button-primary" href="/methodology/">Read the methodology ${icon("arrow")}</a><a class="button button-secondary" href="/data/">Explore the benchmark ${icon("arrow")}</a></div></div><div class="results-hero-art">${renderResultsHeroArt()}<p class="results-hero-note results-hero-note-top">Evidence<br>over hype.</p><p class="results-hero-note results-hero-note-bottom">A more<br>transparent future<br>for AI tutoring.</p></div></div></section>
      <section class="results-status-band" aria-labelledby="results-status-title"><div class="shell results-status-inner"><span class="results-status-mark">${icon("chart")}</span><div><p class="results-status-kicker">Public benchmark results</p><h2 id="results-status-title">Not yet published.</h2><p>No public model rankings are available in the current public artifact. ${escapeHtml(models.notice)} Calibration and validation evidence remain incomplete.</p></div><p class="results-principle">No ranking without evidence.<br>No score without context.</p></div></section>
      <section class="results-section results-schema-section" aria-labelledby="results-schema-title"><div class="shell"><div class="results-section-heading results-schema-heading"><h2 id="results-schema-title">Future leaderboard schema</h2><p>The table below shows the structure of the future public leaderboard.<br>It illustrates what information will be reported for each model. No model results are shown yet.</p></div>${renderResultsTable(benchmark, models)}</div></section>
      <section class="results-section results-readiness-section" aria-labelledby="results-readiness-title"><div class="shell results-readiness-layout"><div><div class="results-section-heading"><h2 id="results-readiness-title">Readiness and evidence status</h2><p>We follow a staged process to ensure that public results are meaningful and trustworthy.</p></div>${renderResultsReadiness(benchmark)}</div>${renderResultsReadingGuide(benchmark)}</div></section>
      <section class="results-section results-preview-section" aria-labelledby="results-preview-title"><div class="shell results-preview-layout"><div><div class="results-section-heading"><h2 id="results-preview-title">Example result view (preview)</h2><p>This schema-only preview shows how individual model results will be presented.</p></div>${renderResultsModelContract(benchmark, models)}</div><aside class="results-interpretation" aria-labelledby="results-interpretation-title"><p class="eyebrow">Interpretation</p><h2 id="results-interpretation-title">A note on interpretation</h2><p>Teachometry evaluates observable tutoring behavior in structured, authored benchmark cases. It does not currently measure long-term learner outcomes, retention, transfer, student satisfaction, or real classroom teaching effectiveness.</p><a class="text-link" href="/methodology/#method-scope">Learn more about our methodology ${icon("arrow")}</a><p class="results-interpretation-quote">Better<br>evidence for a<br>brighter future.</p>${renderResultsBotanical()}</aside></div></section>
      ${renderResultsClosing(artifacts)}
    </div>`,
  );
}

export function renderModelsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, models } = artifacts;
  return page(
    "Models — Tutor Benchmark",
    "Model identity and versioning for future Tutor Benchmark result artifacts.",
    "/models/",
    `<section class="page-intro">
      <div class="shell narrow-shell">
        <div class="eyebrow-row">${renderStatusBadge(benchmark.statusLabel, "preview")}<span class="eyebrow">Model catalog</span></div>
        <h1>Models</h1>
        <p class="lede">Model pages will be derived from public, versioned result artifacts. They will not contain free-form AI summaries of strengths or weaknesses.</p>
      </div>
    </section>
    <section class="section">
      <div class="shell">
        ${renderEmptyState("No public model profiles yet.", models.notice, "A model detail page will appear only when its identity, snapshot, dataset, prompt, and trial records are available.")}
        <div class="panel schema-panel">
          <p class="eyebrow">Model detail contract</p>
          ${renderDimensionPills(["model identity", "provider", "snapshot/version", "overall score", "five category scores", "subject breakdown", "capability breakdown", "cost", "latency", "tokens"])}
          <p class="muted">Strengths and weaknesses will be computed from the highest and lowest verified categories, failure rates, and other stored metrics—not generated after the fact by an LLM.</p>
        </div>
      </div>
    </section>`,
  );
}

export function renderModelDetailPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return page(
    "Model Detail — Tutor Benchmark",
    "Reserved model detail route for future public Tutor Benchmark result artifacts.",
    "/models/[modelId]/",
    `<section class="page-intro"><div class="shell narrow-shell"><a class="back-link" href="/models/">← Back to models</a><div class="eyebrow-row">${renderStatusBadge(artifacts.benchmark.statusLabel, "preview")}<span class="eyebrow">Model detail contract</span></div><h1>Model detail</h1><p class="lede">Model-specific pages are reserved for versioned public result artifacts. No model identity or score is fabricated in the Developer Preview.</p></div></section><section class="section"><div class="shell">${renderEmptyState("No model selected", "A future /models/[modelId] route will resolve a model identity, snapshot, five category scores, and traceable trials from public data.")}</div></section>`,
  );
}

export { renderDataIndexPage } from "./benchmark.js";

export function renderCaseSummary(caseArtifact: PublicCaseArtifact["cases"][number]): string {
  const difficulty = formatDifficulty(caseArtifact.metadata.difficulty);
  const tags = caseArtifact.metadata.capabilityTags ?? [];
  const caseLocale = caseArtifact.locale ?? "en";
  return `<article class="case-card" data-case-card data-case-locale="${escapeHtml(caseLocale)}" data-case-subject="${escapeHtml(caseArtifact.metadata.subject)}" data-case-learner-level="${escapeHtml(
    typeof caseArtifact.metadata.difficulty === "object" && caseArtifact.metadata.difficulty !== null
      ? caseArtifact.metadata.difficulty.learnerLevel
      : "",
  )}" data-case-task-difficulty="${escapeHtml(
    typeof caseArtifact.metadata.difficulty === "object" && caseArtifact.metadata.difficulty !== null
      ? String(caseArtifact.metadata.difficulty.taskDifficulty)
      : "",
  )}" data-case-pedagogical-difficulty="${escapeHtml(
    typeof caseArtifact.metadata.difficulty === "object" && caseArtifact.metadata.difficulty !== null
      ? String(caseArtifact.metadata.difficulty.pedagogicalDifficulty)
      : "",
  )}" data-case-capabilities="${escapeHtml(tags.join(" "))}" data-case-disclosure-policy="${escapeHtml(
    caseArtifact.disclosurePolicy ?? "",
  )}" data-case-student-state="${escapeHtml(caseArtifact.metadata.studentState ?? "")}">
    <div class="case-card-head"><span class="eyebrow">${escapeHtml(caseArtifact.id)}</span>${renderStatusBadge(caseArtifact.metadata.subject, "muted")}</div>
    <h2>${escapeHtml(humanize(caseArtifact.metadata.topic))}</h2>
    <p>${escapeHtml(caseArtifact.tutorInput.learningObjective)}</p>
    <dl class="case-meta">
      <div><dt>Level</dt><dd>${escapeHtml(
        typeof caseArtifact.metadata.difficulty === "object" && caseArtifact.metadata.difficulty !== null
          ? humanize(caseArtifact.metadata.difficulty.learnerLevel)
          : "Not specified",
      )}</dd></div>
      <div><dt>Difficulty</dt><dd>${escapeHtml(difficulty)}</dd></div>
      <div><dt>Student state</dt><dd>${escapeHtml(humanize(caseArtifact.metadata.studentState ?? "Not specified"))}</dd></div>
      <div><dt>Disclosure</dt><dd>${escapeHtml(humanize(caseArtifact.disclosurePolicy ?? "Not specified"))}</dd></div>
      <div><dt>${renderUiText("targetLocale", "en")}</dt><dd><code>${escapeHtml(caseLocale)}</code></dd></div>
    </dl>
    <div class="tag-list">${tags.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(humanize(tag))}</span>`).join("")}</div>
    <a class="card-link" href="/data/cases/${encodeURIComponent(caseArtifact.id)}/">View case <span aria-hidden="true">↗</span></a>
  </article>`;
}
