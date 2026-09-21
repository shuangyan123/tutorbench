import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import {
  escapeHtml,
  humanize,
  renderCodeBlock,
  renderStatusBadge,
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

type RunConsolePanel = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly commands: string;
  readonly facts: readonly string[];
  readonly note: string;
};

function renderRunBotanical(className: string): string {
  return `<svg class="run-botanical ${className}" viewBox="0 0 240 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.6" />
      <path d="M133 190C103 155 76 123 54 83M126 236C93 219 56 198 22 166M143 140C170 119 194 91 215 58M119 277C88 265 53 250 16 224M153 103C179 91 204 71 228 44" stroke-width="1.15" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width="1.05" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width="1.05" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width="1.05" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width="1.05" />
      <path d="M228 44C228 27 235 12 248 4C252 21 246 38 236 47C233 47 230 46 228 44Z" stroke-width="1.05" />
    </g>
  </svg>`;
}

function renderRunConsolePanel(panel: RunConsolePanel, packagePath = false): string {
  return `<section class="run-console-panel" data-run-panel="${escapeHtml(panel.id)}" role="tabpanel" id="run-panel-${escapeHtml(panel.id)}" aria-labelledby="run-tab-${escapeHtml(panel.id)}"${panel.id === "quickstart" ? "" : " hidden"}>
    <div class="run-console-panel-heading"><div><h3>${escapeHtml(panel.title)}</h3><p>${escapeHtml(panel.summary)}</p></div><button class="run-copy" type="button" data-copy-run aria-label="Copy ${escapeHtml(panel.label)} command">${icon("copy")}<span data-copy-label>Copy</span></button></div>
    ${renderCodeBlock(panel.commands, "bash")}
    <ul class="run-console-facts">${panel.facts.map((fact) => `<li>${icon("check")}<span>${escapeHtml(fact)}</span></li>`).join("")}</ul>
    <p class="run-console-note">${escapeHtml(panel.note)}</p>
    ${packagePath ? `<div class="run-console-package" id="published-quickstart"><div><strong>Prefer the published package?</strong><span>Install the released CLI, then run the same deterministic demo.</span></div><code>npm install tutor-benchmark</code><code>tutorbench quickstart</code></div>` : ""}
  </section>`;
}

function renderRunConsole(artifacts: PublicBenchmarkArtifacts): string {
  const datasetLabel = artifacts.benchmark.dataset.id + "@" + artifacts.benchmark.dataset.version;
  const panels: readonly RunConsolePanel[] = [
    {
      id: "quickstart",
      label: "Quickstart",
      title: "Get started (provider-free)",
      summary: "Clone the repository and run the deterministic Quickstart.",
      commands: [
        "# 1. Clone the repository",
        "git clone " + SITE_GITHUB_URL + ".git",
        "cd tutorbench",
        "",
        "# 2. Install dependencies",
        "npm ci",
        "",
        "# 3. Run the Quickstart (no API key)",
        "npm run quickstart",
      ].join("\n"),
      facts: [
        "Runs locally without an API key",
        "Uses 4 fixed cases from tutor-eval-v0.1@0.1",
        "No Judge, no network connection",
        "Deterministic checks (no official score)",
        "Not leaderboard eligible",
      ],
      note: "A development/smoke demonstration with no overall score; Quickstart does not weaken the canonical benchmark boundary.",
    },
    {
      id: "benchmark",
      label: "Benchmark",
      title: "Run the canonical benchmark",
      summary: "Use the current public dataset and preserve its fail-closed evaluator boundary.",
      commands: "npm run benchmark",
      facts: [
        "Current dataset: " + datasetLabel,
        String(artifacts.benchmark.dataset.caseCount) + " public cases in the canonical artifact",
        "Judge-required criteria stay unresolved without an explicit Judge",
        "No score is reported when required evidence is unavailable",
      ],
      note: "The canonical run is distinct from the four-case Quickstart and may report errors or no score without Judge configuration.",
    },
    {
      id: "external-tutor",
      label: "External Tutor",
      title: "Connect an external Tutor over HTTP",
      summary: "Run the repository example, then send TutorTurnInput to POST /respond.",
      commands: [
        "python examples/http-python-tutor/server.py",
        "",
        "tutorbench run --http http://127.0.0.1:8000/respond --limit 3",
      ].join("\n"),
      facts: [
        "TutorTurnInput JSON in; { text, metrics? } JSON out",
        "Default request timeout is 30 seconds",
        "External requests are not retried automatically",
        "Product Tutor evidence remains separate from canonical model evidence",
      ],
      note: "The adapter evaluates the Tutor response at the edge; evaluator-only evidence stays inside TutorBench.",
    },
    {
      id: "advanced",
      label: "Advanced",
      title: "Freeze and inspect evidence paths",
      summary: "Collect Product Tutor or canonical model responses, then evaluate a frozen corpus offline.",
      commands: [
        "tutorbench collect --http http://127.0.0.1:8000/respond --provider <provider> --model <actual-model-id> --prompt-version product-config-v3 --provenance external --limit 3 --output artifacts/product/product.json",
        "",
        "tutorbench collect-model --http http://127.0.0.1:9000/generate --provider <provider> --model <actual-model-id> --limit 3 --output artifacts/real-model/model.json",
        "",
        "tutorbench evaluate --corpus artifacts/real-model/model.json",
        "",
        "# Export the semantic and canonical packets",
        "npm run tutor:export-execution -- -- --case fraction-misconception-001",
        "npm run tutor:export-cases",
        "",
        "# Validate and replay a frozen corpus",
        "npm run tutor:corpus:validate -- -- --corpus path/to/corpus.json",
        "npm run benchmark:corpus -- -- --corpus path/to/corpus.json",
        "",
        "# OpenAI Judge dry-run (no network)",
        "npm run judge:openai -- -- --dry-run",
        "",
        "# Frozen-corpus DeepSeek Judge subset",
        "node dist/src/cli/tutorbench.js evaluate \\",
        "  --corpus artifacts/real-model/baseline.json \\",
        "  --limit 1 \\",
        "  --judge-deepseek",
      ].join("\n"),
      facts: [
        "Product Tutor and canonical model collection are different paths",
        "TutorExecutionPacket and TutorGenerationSpec identify canonical requests",
        "OpenAI Responses and DeepSeek Chat Completions are explicit Judge paths",
        "Canonical model collection uses baseline-native-default",
        "Controlled optional generation parameters: none",
        "Local artifacts remain preliminary, uncalibrated, and not public",
      ],
      note: "Collection is not publication, calibration, or leaderboard eligibility; frozen evidence can be inspected and replayed offline. The baseline-native-default profile leaves optional temperature, reasoning, and seed controls unconstrained so provider-native behavior is not misrepresented as identical across vendors. tutor:export-cases is the semantic Tutor-visible adapter packet; tutor:export-execution is the canonical benchmark packet used to make model runs comparable. Neither packet includes evaluator-only annotations. The same benchmark does not imply that every provider exposes identical inference knobs.",
    },
  ];
  return `<div class="run-console" id="quickstart" aria-labelledby="run-console-title"><div class="run-console-tabs" role="tablist" aria-label="Run workflows">${panels.map((panel, index) => `<button type="button" role="tab" id="run-tab-${escapeHtml(panel.id)}" aria-controls="run-panel-${escapeHtml(panel.id)}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-run-tab="${escapeHtml(panel.id)}">${escapeHtml(panel.label)}</button>`).join("")}</div><div class="run-console-panels"><h2 id="run-console-title" class="visually-hidden">Run workflows</h2>${panels.map((panel) => renderRunConsolePanel(panel, panel.id === "quickstart")).join("")}</div></div>`;
}

function renderRunStep(number: string, title: string, copy: string, glyph: string, last = false): string {
  return `<li class="run-flow-step"><div class="run-flow-step-top"><span class="run-flow-number">${number}</span><span class="run-flow-icon">${icon(glyph)}</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>${last ? "" : `<span class="run-flow-arrow" aria-hidden="true">${icon("arrow")}</span>`}</li>`;
}

function renderRunCapabilityCard(
  tone: string,
  glyph: string,
  title: string,
  items: readonly string[],
  linkLabel: string,
  href: string,
): string {
  return `<article class="run-capability-card run-capability-${escapeHtml(tone)}"><span class="run-capability-icon">${icon(glyph)}</span><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${icon(tone === "blocked" ? "close" : "check")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul><a class="text-link" href="${escapeHtml(href)}">${escapeHtml(linkLabel)} ${icon("arrow")}</a></article>`;
}

function renderRunChecklistItem(glyph: string, title: string, detail: string): string {
  return `<li><span class="run-checklist-icon">${icon(glyph)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span></li>`;
}

function renderRunArtifact(artifacts: PublicBenchmarkArtifacts): string {
  const datasetLabel = artifacts.benchmark.dataset.id + "@" + artifacts.benchmark.dataset.version;
  const caseIds = artifacts.cases.cases.slice(0, 4).map((item) => item.id);
  return `<figure class="run-artifact" aria-labelledby="run-artifact-title"><div class="run-artifact-sheet run-artifact-sheet-back"></div><div class="run-artifact-sheet run-artifact-sheet-mid"></div><div class="run-artifact-card"><div class="run-artifact-fold"></div><p class="run-artifact-label">${escapeHtml(datasetLabel)}</p><h3 id="run-artifact-title">Structured cases<br>for transparent evaluation.</h3><ul>${caseIds.map((caseId) => `<li>${icon("document")}<code>${escapeHtml(caseId)}</code></li>`).join("")}${caseIds.length === 0 ? `<li>${icon("document")}<code>No public cases loaded</code></li>` : ""}</ul><span class="run-artifact-more">…</span></div><figcaption>Same cases.<br>Different Tutors.<br><em>Comparable evidence.</em></figcaption></figure>`;
}

export function renderRunPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const datasetLabel = artifacts.benchmark.dataset.id + "@" + artifacts.benchmark.dataset.version;
  return page(
    "Run — Teachometry",
    "Run TutorBench locally, generate reproducible evidence, and inspect where a Tutor succeeds or fails.",
    "/run/",
    `<section class="run-hero" aria-labelledby="run-title"><div class="shell run-hero-grid"><div class="run-hero-copy"><p class="eyebrow">Run · Get started</p><h1 id="run-title">From research<br>questions to<br><em>reproducible runs.</em></h1><p class="run-hero-lede">Run TutorBench locally, generate reproducible evidence, and inspect where each Tutor succeeds—and where it still falls short. Start with the deterministic Quickstart, then move to the full benchmark or external Tutor/model evidence paths when needed.</p><div class="run-hero-actions"><a class="button button-primary" href="#quickstart">Run locally now ${icon("arrow")}</a><a class="button button-secondary" href="/docs/">${icon("book")} View the documentation</a></div><div class="run-hero-signals" aria-label="Run principles"><span>${icon("book")} Open source</span><span>${icon("shield")} Transparent evaluation</span><span>${icon("database")} Evidence-first</span></div></div><div class="run-hero-console"><p class="run-hero-annotation">Same questions.<br>Clearer evidence.</p>${renderRunConsole(artifacts)}</div></div></section>
    <section class="run-flow-section" aria-labelledby="run-flow-title"><div class="shell run-flow-shell"><p class="eyebrow" id="run-flow-title">How to run</p><ol class="run-flow-list">${renderRunStep("1", "Install", "Clone the repository or install the published package.", "laptop")}${renderRunStep("2", "Run", "Start with Quickstart, then use the benchmark or external Tutor paths.", "play")}${renderRunStep("3", "Inspect", "Review outputs, frozen corpora, logs, evidence, and unresolved criteria.", "document", true)}</ol><div class="run-flow-note"><p>Traceable runs.<br><em>For better research.</em></p>${renderRunBotanical("run-botanical-flow")}</div></div></section>
    <section class="run-capability-section" id="run-capabilities" aria-labelledby="run-capabilities-title"><div class="shell run-capability-layout"><div class="run-capability-main"><div class="run-section-heading"><div><p class="eyebrow">Execution boundaries</p><h2 id="run-capabilities-title">What can you run now?</h2><p>Different workflows serve different purposes. Here is what is available, what requires additional components, and what remains outside the current public scope.</p></div></div><div class="run-capability-grid">${renderRunCapabilityCard("local", "laptop", "Provider-free", ["Quickstart demonstration", "Public case/data inspection", "Frozen-corpus validation and replay", "Website and artifact workflows", "Dry-run and request validation"], "Run locally now", "#quickstart")}${renderRunCapabilityCard("external", "cloud", "External Tutor / model", ["HTTP Tutor adapter (POST /respond)", "Product Tutor collection", "Canonical model collection", "Explicit Judge providers (OpenAI Responses, DeepSeek)", "Advanced offline analysis workflows"], "See configuration guide", "/docs/")}${renderRunCapabilityCard("blocked", "ban", "Not yet public", ["Calibrated public model results", "Human calibration and validation", "Statistical validation", "Official leaderboard rankings"], "Learn about the roadmap", "/methodology/#methodology-status")}</div></div><aside class="run-principle" aria-labelledby="run-principle-title"><p class="eyebrow">Our principle</p><blockquote id="run-principle-title">“Not just outputs,<br>but evidence you<br>can trust.”</blockquote><p>We design TutorBench so benchmark conditions, evaluator boundaries, and artifacts can be inspected and reproduced. When evidence is unavailable, the system should fail closed rather than silently invent a valid score.</p><a class="text-link" href="/methodology/">Read our methodology ${icon("arrow")}</a></aside></div></section>
    <section class="run-repro-section" aria-labelledby="run-repro-title"><div class="shell run-repro-grid"><div class="run-checklist"><p class="eyebrow">Make the run legible</p><h2 id="run-repro-title">Reproducibility checklist</h2><p>Record the following information with your results to make them easy to verify, replay, and compare.</p><ul>${renderRunChecklistItem("database", "Dataset version", "e.g., " + datasetLabel)}${renderRunChecklistItem("bookmark", "Case or corpus identity", "Case IDs or frozen corpus")}${renderRunChecklistItem("target", "Prompt / generation spec", "Prompt templates and parameters")}${renderRunChecklistItem("robot", "Provider and model snapshot", "Model name, version, and settings (if applicable)")}${renderRunChecklistItem("list", "Run metadata", "Date, environment, configuration")}${renderRunChecklistItem("document", "Evidence output", "Logs, traces, and evaluation results")}</ul></div>${renderRunArtifact(artifacts)}<nav class="run-next-steps" aria-labelledby="run-next-title"><p class="eyebrow">Go deeper</p><h2 id="run-next-title">Next steps</h2><p>Explore related resources to go deeper.</p><div class="run-next-links"><a href="/docs/"><span>${icon("book")}<span><strong>Documentation</strong><small>Setup, configuration, and usage guides.</small></span></span>${icon("arrow")}</a><a href="/methodology/"><span>${icon("flask")}<span><strong>Methodology</strong><small>Learn how we evaluate tutoring behavior.</small></span></span>${icon("arrow")}</a><a href="/leaderboard/"><span>${icon("chart")}<span><strong>Results</strong><small>See benchmark results and analysis.</small></span></span>${icon("arrow")}</a><a href="/data/cases/"><span>${icon("grid")}<span><strong>Cases</strong><small>Browse and explore the evaluation scenarios.</small></span></span>${icon("arrow")}</a></div></nav></div></section>
    ${renderTeachometryFooter(artifacts)}`,
  );
}

type MethodologyDimensionDetails = {
  readonly label: string;
  readonly description: string;
  readonly lens: string;
  readonly icon: string;
};

const methodologyDimensionDetails: Readonly<Record<string, MethodologyDimensionDetails>> = {
  correctness: {
    label: "Correctness",
    description: "Whether the Tutor stays factually and conceptually correct.",
    lens: "Factual and conceptual accuracy",
    icon: "correctness",
  },
  diagnosis: {
    label: "Diagnosis",
    description: "Whether it identifies the learner’s actual error, gap, or reasoning issue.",
    lens: "Identifies learner needs and misconceptions",
    icon: "diagnosis",
  },
  guidance: {
    label: "Guidance",
    description: "Whether its explanation or hint helps the learner make progress.",
    lens: "Provides clear, correct, productive guidance",
    icon: "guidance",
  },
  adaptation: {
    label: "Adaptation",
    description: "Whether it changes its help for the learner’s state and context.",
    lens: "Adapts to learner state, level, and context",
    icon: "adaptation",
  },
  actionability: {
    label: "Actionability",
    description: "Whether it leaves the learner with a clear, executable next step.",
    lens: "Actionable next steps for the learner",
    icon: "actionability",
  },
};

const methodologyPipeline = [
  ["01", "Structured case", "Authored scenario with learner profile, goal, and context.", "document"],
  ["02", "Tutor response", "The response produced for the learner’s structured case.", "guidance"],
  ["03", "Evaluator evidence", "Evidence from deterministic evaluators and the Semantic Judge.", "list"],
  ["04", "Atomic rubrics", "Fine-grained criteria with explicit scoring levels.", "grid"],
  ["05", "Benchmark result", "Category aggregation with documented, comparable outputs.", "chart"],
] as const;

function methodologyDimension(dimension: string): MethodologyDimensionDetails {
  return methodologyDimensionDetails[dimension] ?? {
    label: humanize(dimension),
    description: "A versioned score dimension supplied by the public benchmark artifact.",
    lens: "A complementary observable-behavior lens",
    icon: "grid",
  };
}

function renderMethodologyPipeline(): string {
  return `<ol class="method-pipeline-list" aria-label="Five-stage evaluation pipeline">${methodologyPipeline.map(([number, title, copy, glyph], index) => `<li class="method-pipeline-stage"><div class="method-stage-icon">${icon(glyph)}</div><div><p class="method-stage-number">${number}</p><h3>${title}</h3></div><p>${copy}</p>${index === methodologyPipeline.length - 1 ? "" : `<span class="method-pipeline-arrow" aria-hidden="true">${icon("arrow")}</span>`}</li>`).join("")}</ol>`;
}

function renderMethodologyLens(scoreDimensions: readonly string[]): string {
  return `<div class="method-lens" aria-label="Five complementary evaluation dimensions around observable tutoring behavior">
    <svg class="method-lens-lines" viewBox="0 0 620 360" preserveAspectRatio="none" aria-hidden="true"><path d="M310 180 310 34M310 180 553 105M310 180 532 302M310 180 84 302M310 180 67 105"/></svg>
    <div class="method-lens-core"><span>Observable<br>tutoring<br>behavior</span></div>
    <ul class="method-lens-nodes">${scoreDimensions.map((dimension, index) => {
      const details = methodologyDimension(dimension);
      return `<li class="method-lens-node method-lens-node-${index + 1}"><span class="method-lens-disc">${icon(details.icon)}</span><span class="method-lens-copy"><strong>${escapeHtml(details.label)}</strong><small>${escapeHtml(details.lens)}</small></span></li>`;
    }).join("")}</ul>
  </div>`;
}

function renderMethodologyArchitecture(): string {
  return `<figure class="method-architecture-figure" aria-labelledby="method-architecture-title">
    <div class="method-architecture-flow">
      <div class="method-flow-node"><span class="method-flow-icon">${icon("document")}</span><strong>Structured case</strong><small>Authored scenario<br>with learner context</small></div>
      <span class="method-flow-arrow" aria-hidden="true">${icon("arrow")}</span>
      <div class="method-flow-node"><span class="method-flow-icon">${icon("guidance")}</span><strong>Tutor response</strong><small>Tutor-visible<br>interaction</small></div>
      <span class="method-flow-arrow" aria-hidden="true">${icon("arrow")}</span>
      <div class="method-flow-node method-flow-evidence"><span class="method-flow-icon">${icon("list")}</span><strong>Evaluator evidence</strong><div class="method-evidence-branch"><span>${icon("check")}<span class="method-evidence-label">Deterministic evaluators<small>observable proxy checks</small></span></span><span>${icon("spark")}<span class="method-evidence-label">Semantic Judge<small>evaluator boundary</small></span></span></div></div>
      <span class="method-flow-arrow" aria-hidden="true">${icon("arrow")}</span>
      <div class="method-flow-node"><span class="method-flow-icon">${icon("grid")}</span><strong>Atomic rubrics</strong><small>Criteria and<br>scoring levels</small></div>
      <span class="method-flow-arrow" aria-hidden="true">${icon("arrow")}</span>
      <div class="method-flow-node"><span class="method-flow-icon">${icon("actionability")}</span><strong>Category aggregation</strong><small>Five score<br>dimensions</small></div>
      <span class="method-flow-arrow" aria-hidden="true">${icon("arrow")}</span>
      <div class="method-flow-node method-flow-result"><span class="method-flow-icon">${icon("chart")}</span><strong>Benchmark result</strong><small>Structured,<br>comparable output</small></div>
    </div>
    <figcaption>Transparent, reproducible, and auditable. A Judge is an evaluator boundary, not ground truth; unresolved Judge-required evidence remains unresolved and cannot silently become a valid score.</figcaption>
  </figure>`;
}

function renderMethodologyStatus(artifacts: PublicBenchmarkArtifacts): string {
  const calibration = artifacts.benchmark.calibration;
  const rows = [
    [
      "Calibration infrastructure",
      calibration.infrastructure === "available" ? "Available" : "Not available",
      "Provider-independent contracts and synthetic pipeline fixtures are available.",
      calibration.infrastructure === "available" ? "available" : "pending",
    ],
    [
      "Community Review infrastructure",
      "Deployment-ready",
      "Public reviewer intake remains closed; the real Community Review campaign has not started.",
      "available",
    ],
    [
      "Human calibration (P5)",
      calibration.independentHumanCalibration === "not_completed" ? "Not started" : "Not completed",
      "No real human calibration data is claimed.",
      "pending",
    ],
    [
      "Judge-vs-human validation",
      calibration.judgeVsHumanValidation === "not_completed" ? "Not completed" : "Not started",
      "A Judge result is not presented as human-reference validation.",
      "pending",
    ],
    [
      "Statistical validation",
      calibration.statisticalValidation === "not_completed" ? "Not completed" : "Not started",
      "No statistical validation claim is made for the current benchmark.",
      "pending",
    ],
  ] as const;
  return `<table class="method-status-table"><caption class="visually-hidden">Current methodology status</caption><thead><tr><th scope="col">Component</th><th scope="col">Status</th><th scope="col">Notes</th></tr></thead><tbody>${rows.map(([component, status, notes, tone]) => `<tr><th scope="row">${component}</th><td><span class="method-status-value method-status-${tone}"><span aria-hidden="true"></span>${status}</span></td><td>${notes}</td></tr>`).join("")}</tbody></table>`;
}

function renderMethodologyBotanical(className: string): string {
  return `<svg class="method-botanical ${className}" viewBox="0 0 240 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.6" />
      <path d="M133 190C103 155 76 123 54 83" stroke-width="1.15" />
      <path d="M126 236C93 219 56 198 22 166" stroke-width="1.15" />
      <path d="M143 140C170 119 194 91 215 58" stroke-width="1.15" />
      <path d="M119 277C88 265 53 250 16 224" stroke-width="1.15" />
      <path d="M153 103C179 91 204 71 228 44" stroke-width="1.15" />
      <path d="M115 295C91 302 61 305 32 300" stroke-width="1.05" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width="1.05" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width="1.05" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width="1.05" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width="1.05" />
      <path d="M228 44C228 27 235 12 248 4C252 21 246 38 236 47C233 47 230 46 228 44Z" stroke-width="1.05" />
      <path d="M32 300C20 289 13 275 17 261C34 267 46 280 46 294C42 298 37 300 32 300Z" stroke-width="1.05" />
      <path d="M192 18C194 39 191 57 180 73C171 64 168 48 174 35C179 27 185 21 192 18Z" stroke-width="1.05" />
    </g>
  </svg>`;
}

export function renderMethodologyPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const scoreDimensions = artifacts.benchmark.dimensions.score;
  return page(
    "Methodology — Teachometry",
    "How Teachometry evaluates observable tutoring behavior in structured authored benchmark cases using transparent and reproducible procedures.",
    "/methodology/",
    `<section class="method-hero" aria-labelledby="method-title">${renderMethodologyBotanical("method-botanical-left")}<div class="shell method-hero-grid"><div class="method-hero-copy"><p class="eyebrow">Our methodology</p><h1 id="method-title">How do you<br>measure <em>teaching?</em></h1><p class="method-hero-lede">Teachometry evaluates observable tutoring behavior in structured authored benchmark cases using transparent and reproducible evaluation procedures.</p><div class="button-row"><a class="button button-primary" href="/data/">Explore the benchmark ${icon("arrow")}</a><a class="button button-secondary" href="#method-pipeline">${icon("book")} Read the methodology</a></div><div class="method-hero-principles"><span>${icon("diagnosis")} Transparent</span><span>${icon("guidance")} Research-grounded</span><span>${icon("document")} Openly documented</span></div></div><div class="method-hero-art" aria-hidden="true">${renderMethodologyBotanical("method-botanical-right")}<p class="method-hero-note">From<br>cases to insights.<span>⌁</span></p><p class="method-hero-aside">A transparent<br><em>approach</em> to<br>evaluating<br>AI tutoring.</p></div></div></section>
    <section class="method-pipeline" id="method-pipeline" aria-labelledby="pipeline-title"><div class="shell"><div class="method-section-bar"><p class="eyebrow" id="pipeline-title">The evaluation pipeline</p><p>From a structured case to a benchmark result.</p></div>${renderMethodologyPipeline()}</div></section>
    <section class="method-dimensions" id="method-dimensions" aria-labelledby="dimensions-title"><div class="shell method-dimensions-grid"><div class="method-dimensions-intro"><p class="eyebrow">Five evaluation dimensions</p><h2 id="dimensions-title">Five complementary<br>lenses on tutoring<br><em>behavior.</em></h2><p>We evaluate AI tutors across the five score dimensions in the public benchmark artifact, capturing complementary aspects of observable tutoring behavior in structured cases.</p><a class="text-link" href="/docs/">Learn more about the dimensions ${icon("arrow")}</a></div>${renderMethodologyLens(scoreDimensions)}<p class="method-dimensions-note">Different aspects.<br><em>A more complete<br>picture.</em></p></div></section>
    <section class="method-architecture" aria-labelledby="method-architecture-title"><div class="shell method-architecture-grid"><div class="method-architecture-intro"><p class="eyebrow">From response to result</p><h2 id="method-architecture-title">A transparent<br><em>evaluation architecture.</em></h2><p>Our evaluation framework combines atomic rubrics, explicit evidence boundaries, and multiple evaluators to support reproducible and auditable results.</p><p class="method-boundary-copy"><strong>Tutor-visible input ends at the response boundary.</strong> Evaluator-only annotations stay on the evaluator side.</p></div>${renderMethodologyArchitecture()}</div></section>
    <section class="method-scope" aria-labelledby="method-scope-title"><div class="method-scope-measure"><div class="shell method-scope-inner"><p class="eyebrow">What we measure</p><h2 id="method-scope-title">Observable tutoring behavior.</h2><p>We focus on what the AI Tutor does and says in the interaction, evaluated through structured rubrics and observable evidence.</p><ul>${scoreDimensions.map((dimension) => { const details = methodologyDimension(dimension); return `<li><span class="method-scope-mark">${icon("check")}</span><span><strong>${escapeHtml(details.label)}</strong><small>${escapeHtml(details.lens)}</small></span></li>`; }).join("")}</ul><p class="method-scope-footnote">Case-conditioned evidence, not a claim of general teaching effectiveness.</p></div></div><div class="method-scope-not-measure">${renderMethodologyBotanical("method-scope-botanical")}<div class="shell method-scope-inner"><p class="eyebrow">What we do not measure</p><h2>Learning outcomes <em>(not yet).</em></h2><p>We currently do not measure long-term learning gains or real-world educational outcomes. These require longitudinal studies beyond the scope of this benchmark.</p><ul><li><span class="method-scope-mark">${icon("close")}</span><span>Actual long-term learning</span></li><li><span class="method-scope-mark">${icon("close")}</span><span>Knowledge retention over time</span></li><li><span class="method-scope-mark">${icon("close")}</span><span>Transfer to new contexts</span></li><li><span class="method-scope-mark">${icon("close")}</span><span>Student satisfaction</span></li><li><span class="method-scope-mark">${icon("close")}</span><span>Real classroom outcomes</span></li></ul></div></div></section>
    <section class="method-status" id="methodology-status" aria-labelledby="method-status-title"><div class="shell method-status-grid"><div class="method-status-intro"><p class="eyebrow">Methodology status</p><h2 id="method-status-title">A research effort<br><em>in progress.</em></h2><p>We are building a rigorous and open evaluation infrastructure. Some components are available now, while others will be developed through future work.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/roadmap.md" rel="noreferrer">Read the roadmap ${icon("arrow")}</a></div><div class="method-status-ledger">${renderMethodologyStatus(artifacts)}</div></div></section>
    <section class="method-closing" aria-labelledby="method-closing-title"><div class="shell method-closing-grid"><div class="method-closing-title"><p class="eyebrow">Our commitment</p><h2 id="method-closing-title"><span class="method-closing-leaf">${icon("leaf")}</span>Transparent enough to challenge.<br>Structured enough to reproduce.</h2></div><p>Our methodology, rubrics, and benchmark data are openly available for inspection, feedback, and reuse. We invite the community to evaluate, critique, and build on this work.</p><div class="method-closing-actions"><a class="button button-primary" href="#method-pipeline">Read the methodology ${icon("arrow")}</a><a class="button button-secondary" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">${icon("github")} View on GitHub</a></div></div></section>
    ${renderTeachometryFooter(artifacts)}`,
  );
}

export function renderDocsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return page(
    "Docs — Tutor Benchmark",
    "Repository guides for TutorEval, adapters, corpora, Judge boundaries, licensing, and the public Developer Preview.",
    "/docs/",
    `<section class="page-intro"><div class="shell narrow-shell"><div class="eyebrow-row">${renderStatusBadge(artifacts.benchmark.statusLabel, "preview")}<span class="eyebrow">Repository guides</span></div><h1>Docs</h1><p class="lede">The website is a map into the repository’s existing contracts and guides. It does not replace the source documentation.</p></div></section>
    <section class="section"><div class="shell doc-grid">
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/README.md" rel="noreferrer"><span class="eyebrow">Start here</span><h2>README</h2><p>Architecture, quick start, privacy, benchmark integrity, and current roadmap position.</p><span class="text-link">Read README ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/tutor-eval-v0.2a.md" rel="noreferrer"><span class="eyebrow">Dataset</span><h2>TutorEval 0.2A</h2><p>Taxonomy, case design, disclosure policies, counterfactual pairs, and integrity checks.</p><span class="text-link">Read dataset guide ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/tutor-eval-v0.4a.md" rel="noreferrer"><span class="eyebrow">Adapters</span><h2>Response corpus</h2><p>Stable Tutor response corpus boundaries and offline replay behavior.</p><span class="text-link">Read corpus guide ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/real-model-baselines.md" rel="noreferrer"><span class="eyebrow">Evidence</span><h2>Real-model baselines</h2><p>Collect, validate, replay, and evaluate local preliminary Tutor evidence without publishing it automatically.</p><span class="text-link">Read collection guide ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/community-review-protocol.md" rel="noreferrer"><span class="eyebrow">Human review</span><h2>Community Review protocol</h2><p>P3 contracts, blindness, qualification boundaries, freeze semantics, agreement limits, and P4 deployment-readiness status.</p><span class="text-link">Read protocol guide ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/community-review-application-gate.md" rel="noreferrer"><span class="eyebrow">Human review</span><h2>Participation application gate</h2><p>Future application contract, applicant/reviewer separation, and the hard closed-to-open launch checklist. Public application intake remains closed.</p><span class="text-link">Read application gate ↗</span></a>
      <a class="route-card" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/roadmap.md" rel="noreferrer"><span class="eyebrow">Status</span><h2>Roadmap</h2><p>Methodology phases and the separate public website/productization track.</p><span class="text-link">Read roadmap ↗</span></a>
    </div></section>
    <section class="section section-muted"><div class="shell two-column"><div><p class="eyebrow">License & governance</p><h2>Defined for the Developer Preview.</h2></div><div><p class="section-copy"><strong>Software</strong> — Apache-2.0<br><strong>Benchmark content</strong> — CC BY 4.0<br><strong>Brand</strong> — TutorBench Brand Policy</p><p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/licensing.md" rel="noreferrer">Read the licensing scope ↗</a><br><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/LICENSE" rel="noreferrer">Read the software license ↗</a><br><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/LICENSES/CC-BY-4.0.txt" rel="noreferrer">Read the content license pointer ↗</a><br><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/LICENSES/BRAND-POLICY.md" rel="noreferrer">Read the TutorBench Brand Policy ↗</a></p><p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/CONTRIBUTING.md" rel="noreferrer">Contribute ↗</a> · <a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/SECURITY.md" rel="noreferrer">Security Policy ↗</a></p></div></div></section>`,
  );
}

function renderAboutDimensionList(scoreDimensions: readonly string[]): string {
  return `<ol class="about-dimension-list" aria-label="Canonical benchmark score dimensions">${scoreDimensions.map((dimension, index) => {
    const details = methodologyDimension(dimension);
    return `<li><span class="about-dimension-icon">${icon(details.icon)}</span><span><strong>${escapeHtml(details.label)}</strong><small>${escapeHtml(details.description)}</small></span><span class="about-dimension-number">0${index + 1}</span></li>`;
  }).join("")}</ol>`;
}

function renderAboutBoundaryList(items: readonly string[], label: string): string {
  return `<div class="about-boundary-list"><p class="about-boundary-list-label">${escapeHtml(label)}</p><ul>${items.map((item) => `<li>${icon("close")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul></div>`;
}

function renderAboutResource(
  title: string,
  detail: string,
  href: string,
  glyph: string,
): string {
  return `<a class="about-resource" href="${escapeHtml(href)}" rel="noreferrer"><span class="about-resource-icon">${icon(glyph)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span></a>`;
}

export function renderAboutPage(
  artifacts: PublicBenchmarkArtifacts,
  packageVersion: string,
): SitePage {
  const { benchmark, models } = artifacts;
  const scoreDimensions = benchmark.dimensions.score;
  const datasetLabel = `${benchmark.dataset.id}@${benchmark.dataset.version}`;
  const publicModelStatus = models.available
    ? `${models.entries.length} public model runs available`
    : models.notice;
  const licenseRoot = `${SITE_GITHUB_URL}/blob/main`;
  return page(
    "About — Teachometry",
    "Teachometry measures observable AI tutoring behavior, not merely whether a model produces a correct answer.",
    "/about/",
    `<section class="about-hero" aria-labelledby="about-title"><div class="shell about-hero-grid"><div class="about-hero-copy"><p class="eyebrow">About Teachometry</p><h1 id="about-title">A model can know <br>the answer <br><em>without being <br>a good tutor.</em></h1><p class="about-hero-lede">Teachometry is open measurement infrastructure for AI tutoring. We evaluate observable tutoring behavior in structured cases—not just whether the answer is right.</p><div class="button-row"><a class="button button-primary" href="/methodology/">Read our approach ${icon("arrow")}</a><a class="button button-secondary" href="/data/">Explore the benchmark</a></div></div><div class="about-hero-art" aria-hidden="true">${renderMethodologyBotanical("about-botanical-hero")}<p class="about-handwritten about-hero-note">More than<br>correct answers.</p><p class="about-handwritten about-hero-note-two">Toward<br>truly helpful AI<br>tutors.</p><div class="about-hero-rail"><span>Better<br>measurement.<br>A more human<br>learning future.</span><i></i></div></div></div></section>
    <section class="about-why" aria-labelledby="about-why-title"><div class="shell about-why-grid"><div class="about-why-copy"><p class="eyebrow">Why Teachometry exists</p><h2 id="about-why-title">Answers <span>≠</span> Teaching.</h2><p>AI models can often produce correct answers, but tutoring asks for more: noticing where a learner is stuck, guiding reasoning, adapting help, and leaving an actionable next step. A correct answer is evidence of correctness—not evidence that the interaction taught well.</p><div class="about-rule"></div><p class="about-pull-quote">To evaluate AI tutoring, we need evidence of what models do with learners—not only what they know.</p></div><div class="about-dimensions"><p class="about-dimensions-intro">The public benchmark keeps these questions separate, so each result remains tied to a case, a dimension, and its observable evidence.</p>${renderAboutDimensionList(scoreDimensions)}</div><aside class="about-why-art"><div class="about-art-wash"></div>${renderMethodologyBotanical("about-botanical-why")}<p>Same<br>problems.<br><em>Deeper<br>questions.</em></p><span class="about-art-rule"></span></aside></div></section>
    <section class="about-boundary" aria-labelledby="about-boundary-title"><div class="shell about-boundary-layout"><div class="about-boundary-copy"><p class="eyebrow">Our position</p><h2 id="about-boundary-title">We measure tutors.<br>We don’t build the tutor.</h2><p>TutorBench evaluates a <code>TutorUnderTest</code> through a provider-neutral adapter boundary. Provider-specific behavior enters at the edge; the benchmark’s cases, contracts, evaluators, and reports remain independent.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">Inspect the repository ${icon("arrow")}</a></div><figure class="about-boundary-figure"><div class="about-boundary-flow"><div class="about-boundary-external">${renderAboutBoundaryList(["Chat application", "Prompt playground"], "Outside our scope")}</div><div class="about-boundary-core"><div class="about-flow-node"><span>${icon("robot")}</span><strong>TutorUnderTest</strong><small>provider adapter boundary</small></div><span class="about-flow-arrow" aria-hidden="true">${icon("arrow")}</span><div class="about-flow-node about-flow-evaluation"><span>${icon("book")}</span><strong>Teachometry<br>evaluation</strong><small>cases · rubrics · reports</small></div></div><div class="about-boundary-external">${renderAboutBoundaryList(["Model fine-tuning", "Admin dashboard", "Review Workspace module"], "Outside our scope")}</div></div><figcaption>Same cases. Clear criteria. Reproducible evaluation.</figcaption></figure></div></section>
    <section class="about-principles" aria-labelledby="about-principles-title"><div class="shell about-principles-shell"><div class="about-principles-heading"><p class="eyebrow" id="about-principles-title">What we believe</p></div><div class="about-principles-grid"><article class="about-principle"><span>01</span><h3>Observable<br>over assumed</h3><p>Evaluate what a tutor says and does in the interaction, not inferred intentions or claimed capabilities.</p></article><article class="about-principle"><span>02</span><h3>Evidence<br>over hype</h3><p>Favor transparent methods, reproducible artifacts, and inspectable evidence over marketing narratives.</p></article><article class="about-principle"><span>03</span><h3>Context<br>over a single score</h3><p>Results belong to specific cases, versions, dimensions, and evaluation contexts—not a universal number.</p></article><article class="about-principle"><span>04</span><h3>Open methods<br>over black boxes</h3><p>Publish cases, methodology, contracts, and public artifacts so claims can be inspected and challenged.</p></article></div><div class="about-principles-art" aria-hidden="true">${renderMethodologyBotanical("about-botanical-principles")}<p class="about-handwritten">Open science<br>for better<br>learning.</p><span class="about-art-rule"></span></div></div></section>
    <section class="about-status" aria-labelledby="about-status-title"><div class="shell about-status-grid"><div class="about-status-intro"><p class="eyebrow">Where we are now</p><h2 id="about-status-title">${escapeHtml(benchmark.statusLabel)}</h2><p>Teachometry is in active development. The public site packages approved development metadata and public cases; it does not publish private runs or claim completed calibration.</p><a class="text-link" href="${escapeHtml(licenseRoot)}/docs/release.md" rel="noreferrer">View current release notes ${icon("arrow")}</a></div><dl class="about-ledger"><div><dt>${icon("bookmark")} Website</dt><dd>${escapeHtml(benchmark.statusLabel)}</dd></div><div><dt>${icon("package")} Package</dt><dd>tutor-benchmark@${escapeHtml(packageVersion)} published</dd></div><div><dt>${icon("database")} Dataset</dt><dd>${escapeHtml(datasetLabel)}</dd></div><div><dt>${icon("list")} Public cases</dt><dd>${escapeHtml(String(benchmark.dataset.caseCount))} synthetic cases</dd></div><div><dt>${icon("chart")} Public model runs</dt><dd>${escapeHtml(publicModelStatus)}</dd></div><div><dt>${icon("shield")} Calibration</dt><dd>Not completed; results remain preliminary and uncalibrated where applicable.</dd></div></dl></div></section>
    <section class="about-open" aria-labelledby="about-open-title"><div class="shell about-open-layout"><div class="about-open-intro"><p class="eyebrow">Open by design</p><h2 id="about-open-title">A shared resource<br>for the AI tutoring community.</h2><p>Teachometry is developed in the open, with separate boundaries for software, authored benchmark content, and the TutorBench name and brand assets.</p></div><div class="about-resource-grid">${renderAboutResource("Licensing scope", "Read the boundaries", `${licenseRoot}/docs/licensing.md`, "document")}${renderAboutResource("Software license", "Apache-2.0", `${licenseRoot}/LICENSE`, "code")}${renderAboutResource("Benchmark content", "CC BY 4.0", `${licenseRoot}/LICENSES/CC-BY-4.0.txt`, "bookmark")}${renderAboutResource("TutorBench Brand Policy", "Usage guidelines", `${licenseRoot}/LICENSES/BRAND-POLICY.md`, "shield")}${renderAboutResource("Contributing", "Get involved", `${licenseRoot}/CONTRIBUTING.md`, "user")}${renderAboutResource("Security", "Report an issue", `${licenseRoot}/SECURITY.md`, "shield")}${renderAboutResource("GitHub", "View repository", SITE_GITHUB_URL, "github")}</div></div></section>
    ${renderTeachometryFooter(artifacts)}`,
  );
}
