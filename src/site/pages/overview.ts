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
  renderKeyValueList,
  renderMetric,
  renderStatusBadge,
  renderUiText,
  type SitePage,
} from "../html.js";

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

function renderSectionHeading(
  eyebrow: string,
  title: string,
  copy?: string,
  headingId?: string,
): string {
  return `<div class="section-heading">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h2${headingId === undefined ? "" : ` id="${escapeHtml(headingId)}"`}>${escapeHtml(title)}</h2>
    ${copy === undefined ? "" : `<p class="section-copy">${escapeHtml(copy)}</p>`}
  </div>`;
}

export { renderHomePage } from "./home.js";

function renderLeaderboardSchema(benchmark: PublicBenchmarkArtifact): string {
  const scoreFields = benchmark.dimensions.score.map((field) => humanize(field));
  const operationalFields = benchmark.dimensions.operational.map((field) => humanize(field));
  return `<div class="schema-grid">
    <div><p class="eyebrow">Tutor capability score</p>${renderDimensionPills(benchmark.dimensions.score)}</div>
    <div><p class="eyebrow">Operational signals</p>${renderDimensionPills(benchmark.dimensions.operational)}</div>
    <div><p class="eyebrow">Traceability fields</p>${renderDimensionPills([...PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS, "promptSha256", "runs"])}</div>
    <p class="muted">The future table will show: ${escapeHtml(scoreFields.join(", "))}. Operational fields include ${escapeHtml(operationalFields.join(", "))}. Results from different generation profiles are separate cohorts and are not silently mixed.</p>
  </div>`;
}

function renderEmptyLeaderboardTable(): string {
  const columns = [
    "Rank",
    "Model",
    "Overall",
    "Correctness",
    "Diagnosis",
    "Guidance",
    "Adaptation",
    "Actionability",
    "Status",
  ];
  return `<div class="table-wrap"><table class="leaderboard-table"><caption>Future public model leaderboard</caption><thead><tr>${columns
    .map((column) => `<th scope="col">${escapeHtml(column)}</th>`)
    .join("")}</tr></thead><tbody><tr><td class="leaderboard-empty-cell" colspan="${columns.length}">No public model rows are available yet.</td></tr></tbody></table><div class="mobile-ranking-empty">No public model rows are available yet.</div></div>`;
}

export function renderLeaderboardPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark, models } = artifacts;
  return page(
    "Leaderboard — Tutor Benchmark",
    "A transparent leaderboard schema for Tutor Benchmark. Public model rankings are not available yet.",
    "/leaderboard/",
    `<section class="page-intro">
      <div class="shell narrow-shell">
        <div class="eyebrow-row">${renderStatusBadge(benchmark.statusLabel, "preview")}<span class="eyebrow">Public result artifact</span></div>
        <h1>Leaderboard</h1>
        <p class="lede">A future ranking surface for versioned Tutor capability results. Until the corpus is reproducible and calibrated, this page stays explicit about what is not known.</p>
        <p class="notice-line">${escapeHtml(models.notice)} ${escapeHtml(benchmark.notice)}</p>
      </div>
    </section>
    <section class="section">
      <div class="shell">
        <div class="panel leaderboard-empty">
          ${renderEmptyState("Leaderboard coming soon", "No real model results are checked into the public artifact. Synthetic demonstrations are not presented as rankings.")}
          ${renderEmptyLeaderboardTable()}
          ${renderLeaderboardSchema(benchmark)}
        </div>
      </div>
    </section>
    <section class="section section-muted" aria-labelledby="leaderboard-fields-title">
      <div class="shell">
        ${renderSectionHeading("Future filters", "Designed for comparison without hiding context", "The v0.1 shell leaves room for benchmark, prompt, subject, provider, model, and metric sorting without implementing a complex filter engine yet.", "leaderboard-fields-title")}
        <div class="filter-preview">
          ${renderKeyValueList([
            ["Version", "Benchmark version · prompt version · dataset version"],
            ["Scope", "Subject · model provider · model"],
            ["Sort", "Overall · correctness · diagnosis · guidance · adaptation · actionability · cost · latency"],
          ])}
        </div>
      </div>
    </section>`,
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

export function renderDataIndexPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const { benchmark } = artifacts;
  return page(
    "Data Explorer — Tutor Benchmark",
    "Browse public TutorEval cases, coverage, heatmap contracts, and trial traceability.",
    "/data/",
    `<section class="page-intro">
      <div class="shell narrow-shell">
        <div class="eyebrow-row">${renderStatusBadge(benchmark.statusLabel, "preview")}<span class="eyebrow">Read-only benchmark data</span></div>
        <h1>Data explorer</h1>
        <p class="lede">The public data layer separates checked-in benchmark artifacts from the UI. Current cases are real synthetic development data; model results and trials remain empty until they can be published responsibly.</p>
      </div>
    </section>
    <section class="section">
      <div class="shell data-hub-grid">
        <a class="route-card" href="/data/cases/"><span class="eyebrow">01 · Dataset</span><h2>Cases</h2><p>${escapeHtml(String(benchmark.dataset.caseCount))} public cases with subject, difficulty, learner state, capability, and disclosure metadata.</p><span class="text-link">Browse cases ↗</span></a>
        <a class="route-card" href="/data/heatmap/"><span class="eyebrow">02 · Matrix</span><h2>Heatmap</h2><p>A reusable case × model-run contract, currently without public model trials.</p><span class="text-link">View heatmap status ↗</span></a>
        <a class="route-card" href="/data/trials/"><span class="eyebrow">03 · Audit trail</span><h2>Trials</h2><p>Trace future leaderboard numbers to a case, Tutor response, rubric evidence, and sanitized metrics.</p><span class="text-link">View trial status ↗</span></a>
      </div>
    </section>
    <section class="section section-muted">
      <div class="shell">
        ${renderSectionHeading("Coverage", "What is inside the current dataset", "Coverage is computed from the canonical dataset at build time, then serialized for the read-only website.")}
        <div class="metric-grid">
          ${renderMetric("Cases", String(benchmark.coverage.caseCount), "TutorEval 0.2A")}
          ${renderMetric("Locales", String(Object.keys(benchmark.coverage.casesByLocale).length), Object.entries(benchmark.coverage.casesByLocale).map(([locale, count]) => `${locale}: ${count}`).join(" · "))}
          ${renderMetric("Subjects", String(Object.keys(benchmark.coverage.casesBySubject).length), Object.keys(benchmark.coverage.casesBySubject).map(humanize).join(" · "))}
          ${renderMetric("Capabilities", String(Object.keys(benchmark.coverage.casesByCapabilityTag).length), "Taxonomy tags")}
          ${renderMetric("Policies", String(Object.keys(benchmark.coverage.casesByDisclosurePolicy).length), "Disclosure-policy buckets")}
        </div>
      </div>
    </section>`,
  );
}

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
