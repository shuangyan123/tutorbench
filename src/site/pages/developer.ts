import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import {
  escapeHtml,
  humanize,
  renderCodeBlock,
  SITE_GITHUB_URL,
  type SitePage,
} from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { PUBLIC_SITE_BOTANICAL_ASSETS } from "../assets.js";
import { renderBotanicalSvg } from "../illustrations.js";
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
  return `<svg class="run-botanical ${className}" viewBox="0 0 260 350" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M126 344C126 298 129 251 138 207C149 151 168 94 208 24" stroke-width="1.55"/>
      <path d="M136 221C108 192 83 159 61 116M131 269C98 252 67 228 36 195M147 178C176 156 200 126 224 91M126 309C93 296 59 278 27 252M162 139C190 124 217 103 239 78" stroke-width="1.05"/>
      <path d="M68 119C86 128 101 142 113 160M42 197C64 204 83 214 99 226M222 93C205 102 190 113 177 128M31 253C53 258 73 266 91 278M238 80C218 86 201 95 186 106" stroke-width=".8" opacity=".72"/>
    </g>
    <g fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-linejoin="round">
      <path d="M61 116C45 96 35 73 40 53C62 61 78 81 79 103C74 109 68 113 61 116Z" stroke-width="1"/>
      <path d="M36 195C22 175 16 152 24 132C44 142 58 163 55 182C49 188 43 192 36 195Z" stroke-width="1"/>
      <path d="M224 91C223 69 230 46 247 31C254 52 248 76 232 93C229 93 226 92 224 91Z" stroke-width="1"/>
      <path d="M27 252C20 233 23 213 38 199C53 217 53 237 41 253C36 254 31 254 27 252Z" stroke-width="1"/>
      <path d="M239 78C239 58 247 39 262 29C267 48 261 68 249 80C245 81 242 80 239 78Z" stroke-width="1"/>
      <path d="M207 25C210 48 206 70 194 89C182 79 178 61 184 45C190 35 197 28 207 25Z" stroke-width="1"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".45">
      <path d="M53 59C58 73 62 88 61 113M31 139C36 152 38 166 36 191M245 38C240 53 234 68 225 88M39 207C35 221 31 235 28 249M258 35C252 48 246 62 240 76M190 48C198 59 202 71 194 86" stroke-width=".65"/>
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
      id: "health",
      label: "Tutor Health",
      title: "Diagnose an external Tutor in real-world scenarios",
      summary: "Run the finding-first Productive Struggle & Intervention suite against an HTTP Tutor.",
      commands: [
        "tutorbench health \\",
        "  --http https://partner.example.com/respond \\",
        "  --suite productive-struggle-intervention-v0.1 \\",
        "  --tutor-provider partner \\",
        "  --tutor-model production \\",
        "  --prompt-version v17 \\",
        "  --output artifacts/partner-pilot",
      ].join("\n"),
      facts: [
        "Writes evaluation.json, health-report.json, and health-report.txt",
        "Records Tutor provider, model/config, and prompt version provenance",
        "Reports Tutor Health Score, explicit coverage, Release Gate, Findings, and regression targets",
        "No-Judge runs stay UNRESOLVED and are marked as incomplete evidence",
      ],
      note: "The current 13-scenario suite is an authored synthetic design artifact with partial health-dimension coverage; it is not a validated general tutor-quality or learner-outcome measure.",
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
    "Run TutorBench locally, diagnose real-world tutoring behavior, and preserve reproducible evidence for retesting.",
    "/run/",
    `<section class="run-hero" aria-labelledby="run-title"><div class="shell run-hero-grid"><div class="run-hero-copy"><p class="eyebrow">Run · Get started</p><h1 id="run-title">From research<br>questions to<br><em>reproducible runs.</em></h1><p class="run-hero-lede">Run TutorBench locally, then connect an external Tutor to the Tutor Health workflow to diagnose concrete teaching failures in authored real-world scenarios. The canonical benchmark and frozen-evidence paths remain available as the underlying reproducibility layer.</p><div class="run-hero-actions"><a class="button button-primary" href="#quickstart">Run locally now ${icon("arrow")}</a><a class="button button-secondary" href="/docs/">${icon("book")} View the documentation</a></div><div class="run-hero-signals" aria-label="Run principles"><span>${icon("book")} Open source</span><span>${icon("shield")} Transparent evaluation</span><span>${icon("database")} Evidence-first</span></div></div><div class="run-hero-console"><p class="run-hero-annotation">Same questions.<br>Clearer evidence.</p>${renderRunConsole(artifacts)}</div></div></section>
    <section class="run-flow-section" aria-labelledby="run-flow-title"><div class="shell run-flow-shell"><p class="eyebrow" id="run-flow-title">How to run</p><ol class="run-flow-list">${renderRunStep("1", "Install", "Clone the repository or install the published package.", "laptop")}${renderRunStep("2", "Run", "Start with Quickstart, then run Tutor Health against an external Tutor.", "play")}${renderRunStep("3", "Inspect", "Inspect findings, evidence, coverage, and versioned artifacts before the next Tutor change.", "document", true)}</ol><div class="run-flow-note"><p>Traceable runs.<br><em>For better research.</em></p>${renderRunBotanical("run-botanical-flow")}</div></div></section>
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

function methodologyVisualKind(dimension: string): string {
  return methodologyDimensionDetails[dimension] ? dimension : "general";
}

type MethodologyVisualLine = "main" | "secondary" | "reference" | "arrow" | "tick";
type MethodologyVisualPoint = "default" | "step" | "target" | "split" | "focus";

function methodologyVisualPath(kind: MethodologyVisualLine, d: string): string {
  return '<path class="method-story-line method-story-line--' + kind + '" d="' + d + '"/>';
}

function methodologyVisualPoint(kind: MethodologyVisualPoint, x: number, y: number, radius: number): string {
  const modifier = kind === "default" ? "" : " method-story-point--" + kind;
  return '<circle class="method-story-point' + modifier + '" cx="' + x + '" cy="' + y + '" r="' + radius + '"/>';
}

function renderMethodologyVisualMotif(visualKind: string): string {
  switch (visualKind) {
    case "correctness":
      return [
        methodologyVisualPath("reference", "M70 210H408"),
        methodologyVisualPath("main", "M76 116C151 116 177 172 248 181S351 211 410 210C442 209 458 227 458 252C458 278 477 286 486 299"),
        methodologyVisualPath("secondary", "M76 292C149 292 177 238 248 232S354 210 410 210"),
        methodologyVisualPath("tick", "M408 201V219"),
        methodologyVisualPoint("default", 76, 292, 4),
        methodologyVisualPoint("target", 410, 210, 8),
        methodologyVisualPoint("focus", 285, 210, 3),
      ].join("");
    case "diagnosis":
      return [
        methodologyVisualPath("reference", "M72 254H538"),
        methodologyVisualPath("main", "M72 254H185C219 254 230 222 249 194C269 166 293 133 319 150C340 164 337 193 315 194C293 194 286 169 300 153C317 134 347 143 350 170C354 205 327 222 324 251C319 281 354 305 360 336"),
        methodologyVisualPath("tick", "M266 164H276M356 164H366M316 113V123M316 215V225"),
        '<circle class="method-story-point method-story-point--inspection" cx="316" cy="169" r="39"/>',
        methodologyVisualPoint("focus", 316, 169, 4),
      ].join("");
    case "guidance":
      return [
        methodologyVisualPath("main", "M76 416C127 406 154 373 188 365C223 356 236 374 262 348C288 322 282 299 320 284C355 271 376 278 396 248C413 224 422 200 452 183C472 171 490 168 510 174"),
        methodologyVisualPath("secondary", "M510 174C568 212 554 281 526 344"),
        methodologyVisualPoint("step", 188, 365, 6),
        methodologyVisualPoint("step", 320, 284, 7),
        methodologyVisualPoint("step", 396, 248, 5),
        methodologyVisualPoint("target", 506, 173, 8),
      ].join("");
    case "adaptation":
      return [
        methodologyVisualPath("main", "M76 230H194C232 230 242 187 274 151C304 117 345 80 383 99C421 118 411 176 438 205C454 222 465 237 474 254C490 284 507 313 513 342"),
        methodologyVisualPath("secondary", "M194 230C234 230 244 278 275 311C308 346 356 371 397 339C433 312 452 278 474 254"),
        methodologyVisualPoint("split", 194, 230, 9),
        methodologyVisualPoint("target", 383, 99, 8),
        methodologyVisualPoint("default", 397, 339, 5),
        methodologyVisualPoint("step", 474, 254, 7),
      ].join("");
    case "actionability":
      return [
        methodologyVisualPath("main", "M76 82C153 82 190 141 247 177C278 197 300 209 336 214"),
        methodologyVisualPath("main", "M76 214C159 214 243 214 336 214"),
        methodologyVisualPath("main", "M76 340C153 340 190 285 247 250C278 231 300 219 336 214"),
        methodologyVisualPath("main", "M344 214H546"),
        methodologyVisualPath("arrow", "M533 201L546 214L533 227"),
        methodologyVisualPoint("default", 76, 214, 4),
        methodologyVisualPoint("default", 76, 340, 4),
        methodologyVisualPoint("target", 350, 214, 8),
      ].join("");
    default:
      return [
        methodologyVisualPath("main", "M76 220C160 220 192 208 264 220S358 260 398 288C435 315 462 333 492 343"),
        methodologyVisualPoint("default", 76, 220, 5),
        methodologyVisualPoint("target", 398, 288, 9),
      ].join("");
  }
}

function methodologyVisualIndexPosition(visualKind: string): readonly [number, number] {
  switch (visualKind) {
    case "diagnosis": return [72, 254];
    case "guidance": return [76, 416];
    case "adaptation": return [76, 230];
    case "actionability": return [76, 82];
    default: return [76, 116];
  }
}

function methodologyVisualAnchor(visualKind: string): readonly [number, number] {
  switch (visualKind) {
    case "correctness": return [486, 365];
    case "diagnosis": return [360, 402];
    case "guidance": return [526, 410];
    case "adaptation": return [535, 408];
    case "actionability": return [520, 424];
    default: return [492, 390];
  }
}

function renderMethodologyVisual(dimension: string, index: number, number: string): string {
  const visualKind = methodologyVisualKind(dimension);
  const [indexX, indexY] = methodologyVisualIndexPosition(visualKind);
  const [anchorX, anchorY] = methodologyVisualAnchor(visualKind);

  return '<g class="method-story-visual" data-method-story-visual="' + index + '" data-method-visual-state="' + visualKind + '">' +
    '<circle class="method-story-orbit" cx="' + anchorX + '" cy="' + anchorY + '" r="66"/>' +
    '<g class="method-story-spoke" data-method-story-spoke="' + index + '">' + renderMethodologyVisualMotif(visualKind) + '</g>' +
    '<g class="method-story-node" data-method-story-node="' + index + '"><circle cx="' + indexX + '" cy="' + indexY + '" r="19"></circle><text x="' + indexX + '" y="' + indexY + '">' + number + '</text></g></g>';
}

function renderMethodologyLens(scoreDimensions: readonly string[]): string {
  const dimensions = scoreDimensions.map((dimension, index) => {
    const details = methodologyDimension(dimension);
    return { dimension, details, index, number: String(index + 1).padStart(2, "0") };
  });
  const total = String(dimensions.length).padStart(2, "0");
  const chapterMarkup = dimensions.map(({ details, index, number }) =>
    '<li class="method-story-chapter" data-method-story-chapter data-method-story-index="' + index + '">' +
    '<p class="method-story-number"><span>DIMENSION ' + number + '</span><span>Score lens</span></p>' +
    '<h3>' + escapeHtml(details.label) + '</h3>' +
    '<p class="method-story-description">' + escapeHtml(details.description) + '</p>' +
    '<p class="method-story-lens"><span>What we look for</span>' + escapeHtml(details.lens) + '</p></li>'
  ).join("");
  const visualMarkup = dimensions.map(({ dimension, index, number }) => renderMethodologyVisual(dimension, index, number)).join("");
  const overviewNodes = dimensions.map(({ index, number }) => {
    const x = dimensions.length <= 1 ? 320 : 48 + (index * 482) / (dimensions.length - 1);
    return '<g class="method-story-overview-node"><circle cx="' + x.toFixed(2) + '" cy="42" r="14"></circle><text x="' + x.toFixed(2) + '" y="42">' + number + '</text></g>';
  }).join("");

  return '<div class="method-story" data-method-story>' +
    '<ol class="method-story-chapters" aria-label="' + escapeHtml(String(dimensions.length)) + ' benchmark score dimensions">' + chapterMarkup + '</ol>' +
    '<figure class="method-story-stage" data-method-story-stage>' +
    '<p class="method-story-stage-index" aria-hidden="true"><span data-method-story-current>01</span><span> / ' + total + '</span></p>' +
    '<svg class="method-story-map" viewBox="0 0 640 520" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">' +
    '<g class="method-story-visuals">' + visualMarkup + '</g></svg>' +
    '<svg class="method-story-overview" viewBox="0 0 640 84" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">' +
    '<path class="method-story-overview-track" d="M48 42H580"/><g class="method-story-overview-nodes">' + overviewNodes + '</g><circle class="method-story-overview-core" cx="592" cy="42" r="6"/></svg>' +
    '<figcaption class="method-story-center">Observable<br>tutoring<br>behavior</figcaption></figure></div>';
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
  return `<svg class="method-botanical ${className}" viewBox="0 0 260 350" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M128 345C126 298 129 249 139 203C151 146 171 88 210 20" stroke-width="1.5"/>
      <path d="M137 218C110 187 86 153 62 111M131 268C100 251 68 228 34 193M149 174C178 151 202 120 225 86M125 309C94 297 61 279 28 252M164 135C191 120 217 99 241 74M121 327C98 333 72 335 45 331" stroke-width="1.05"/>
      <path d="M70 113C86 123 101 138 113 156M42 195C62 202 82 213 99 224M223 88C206 98 191 110 178 124M31 253C51 258 72 266 90 277M239 76C220 83 203 92 188 103M50 330C69 322 88 318 108 319" stroke-width=".8" opacity=".72"/>
    </g>
    <g fill="currentColor" fill-opacity=".065" stroke="currentColor" stroke-linejoin="round">
      <path d="M62 111C45 91 35 68 40 48C62 56 78 76 80 99C74 105 69 109 62 111Z" stroke-width="1"/>
      <path d="M34 193C21 174 16 151 24 131C45 141 58 162 55 181C49 187 42 191 34 193Z" stroke-width="1"/>
      <path d="M225 86C224 65 231 43 248 28C255 49 249 73 233 89C230 89 227 88 225 86Z" stroke-width="1"/>
      <path d="M28 252C21 233 24 213 39 198C54 216 54 237 42 253C37 254 32 254 28 252Z" stroke-width="1"/>
      <path d="M241 74C241 54 248 36 263 26C268 45 262 65 250 77C246 78 243 77 241 74Z" stroke-width="1"/>
      <path d="M210 20C213 43 209 65 197 84C185 74 181 57 187 40C193 31 201 23 210 20Z" stroke-width="1"/>
      <path d="M45 331C31 322 23 309 25 294C43 299 56 312 59 326C55 329 50 331 45 331Z" stroke-width="1"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".42">
      <path d="M53 54C59 69 62 85 62 108M31 137C37 152 38 166 35 189M247 35C241 51 235 66 226 83M40 206C36 221 31 236 29 249M260 33C253 47 247 60 242 72M192 43C200 55 203 67 197 81M31 299C38 309 43 318 45 328" stroke-width=".65"/>
    </g>
  </svg>`;
}

function renderAboutBotanical(className: string): string {
  return renderBotanicalSvg(`about-botanical ${className}`, PUBLIC_SITE_BOTANICAL_ASSETS.about);
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

type DocsNavigationItem = {
  readonly label: string;
  readonly href: string;
  readonly glyph: string;
  readonly external?: boolean;
};

type DocsNavigationGroup = {
  readonly label: string;
  readonly items: readonly DocsNavigationItem[];
};

type DocsIndexEntry = DocsNavigationItem & {
  readonly summary: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly pathLabel: string;
};

function docsRepositoryHref(path: string): string {
  return `${SITE_GITHUB_URL}/blob/main/${path}`;
}

const docsNavigation: readonly DocsNavigationGroup[] = [
  {
    label: "Getting Started",
    items: [
      { label: "Overview", href: "#overview", glyph: "book" },
      { label: "Quickstart", href: "#quickstart", glyph: "play" },
      { label: "Run TutorBench", href: "/run/", glyph: "laptop" },
      { label: "README", href: docsRepositoryHref("README.md"), glyph: "document", external: true },
    ],
  },
  {
    label: "Benchmark & Data",
    items: [
      { label: "TutorEval 0.2A", href: docsRepositoryHref("docs/tutor-eval-v0.2a.md"), glyph: "grid", external: true },
      { label: "Portable response corpus", href: docsRepositoryHref("docs/tutor-eval-v0.4a.md"), glyph: "database", external: true },
      { label: "Methodology", href: "/methodology/", glyph: "flask" },
      { label: "Public benchmark", href: "/data/", glyph: "chart" },
      { label: "Cases", href: "/data/cases/", glyph: "grid" },
    ],
  },
  {
    label: "Execution & Evidence",
    items: [
      { label: "Real-model baselines", href: docsRepositoryHref("docs/real-model-baselines.md"), glyph: "cloud", external: true },
      { label: "Run workflows", href: "/run/", glyph: "play" },
      { label: "Models registry", href: "/models/", glyph: "robot" },
      { label: "Results status", href: "/leaderboard/", glyph: "chart" },
    ],
  },
  {
    label: "Human Review",
    items: [
      { label: "Community Review protocol", href: docsRepositoryHref("docs/community-review-protocol.md"), glyph: "user", external: true },
      { label: "Participation application gate", href: docsRepositoryHref("docs/community-review-application-gate.md"), glyph: "shield", external: true },
      { label: "Community status", href: "/community/", glyph: "user" },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Roadmap", href: docsRepositoryHref("docs/roadmap.md"), glyph: "bookmark", external: true },
      { label: "Licensing", href: docsRepositoryHref("docs/licensing.md"), glyph: "document", external: true },
      { label: "Contributing", href: docsRepositoryHref("CONTRIBUTING.md"), glyph: "user", external: true },
      { label: "Security", href: docsRepositoryHref("SECURITY.md"), glyph: "shield", external: true },
    ],
  },
];

const docsIndex: readonly DocsIndexEntry[] = [
  {
    label: "README",
    href: docsRepositoryHref("README.md"),
    glyph: "document",
    external: true,
    summary: "Repository orientation, architecture, privacy, benchmark integrity, and current project boundaries.",
    category: "getting-started",
    categoryLabel: "Getting Started",
    pathLabel: "README.md",
  },
  {
    label: "TutorBench Quickstart",
    href: docsRepositoryHref("docs/quickstart.md"),
    glyph: "play",
    external: true,
    summary: "The provider-free, network-free, Judge-free five-minute development demonstration.",
    category: "getting-started",
    categoryLabel: "Getting Started",
    pathLabel: "docs/quickstart.md",
  },
  {
    label: "Run TutorBench",
    href: "/run/",
    glyph: "laptop",
    summary: "Public entry point for the Quickstart, benchmark, Tutor adapters, and evidence workflows.",
    category: "getting-started",
    categoryLabel: "Getting Started",
    pathLabel: "/run/",
  },
  {
    label: "TutorEval 0.2A",
    href: docsRepositoryHref("docs/tutor-eval-v0.2a.md"),
    glyph: "grid",
    external: true,
    summary: "Synthetic case design, five observable-behavior dimensions, rubric semantics, and disclosure boundaries.",
    category: "benchmark-data",
    categoryLabel: "Benchmark & Data",
    pathLabel: "docs/tutor-eval-v0.2a.md",
  },
  {
    label: "Portable response corpus",
    href: docsRepositoryHref("docs/tutor-eval-v0.4a.md"),
    glyph: "database",
    external: true,
    summary: "The generate → freeze → evaluate → annotate → calibrate lifecycle and portable corpus contract.",
    category: "benchmark-data",
    categoryLabel: "Benchmark & Data",
    pathLabel: "docs/tutor-eval-v0.4a.md",
  },
  {
    label: "Methodology",
    href: "/methodology/",
    glyph: "flask",
    summary: "How the public benchmark evaluates observable tutoring behavior and where evidence remains limited.",
    category: "benchmark-data",
    categoryLabel: "Benchmark & Data",
    pathLabel: "/methodology/",
  },
  {
    label: "Public benchmark",
    href: "/data/",
    glyph: "chart",
    summary: "A public view into the versioned dataset, coverage, and disclosure-safe benchmark artifacts.",
    category: "benchmark-data",
    categoryLabel: "Benchmark & Data",
    pathLabel: "/data/",
  },
  {
    label: "Cases",
    href: "/data/cases/",
    glyph: "grid",
    summary: "Browse the authored public cases without exposing evaluator-only answers or rubrics.",
    category: "benchmark-data",
    categoryLabel: "Benchmark & Data",
    pathLabel: "/data/cases/",
  },
  {
    label: "Real-model baselines",
    href: docsRepositoryHref("docs/real-model-baselines.md"),
    glyph: "cloud",
    external: true,
    summary: "Separate Product Tutor and canonical model collection paths, with private preliminary evidence semantics.",
    category: "execution-evidence",
    categoryLabel: "Execution & Evidence",
    pathLabel: "docs/real-model-baselines.md",
  },
  {
    label: "Models registry",
    href: "/models/",
    glyph: "robot",
    summary: "The public model surface and its reserved evidence contract; no calibrated public profiles are implied.",
    category: "execution-evidence",
    categoryLabel: "Execution & Evidence",
    pathLabel: "/models/",
  },
  {
    label: "Results status",
    href: "/leaderboard/",
    glyph: "chart",
    summary: "Readiness and evidence status for public results, without inventing ranking rows or scores.",
    category: "execution-evidence",
    categoryLabel: "Execution & Evidence",
    pathLabel: "/leaderboard/",
  },
  {
    label: "Frozen corpus semantic replay",
    href: docsRepositoryHref("docs/frozen-corpus-semantic-replay.md"),
    glyph: "refresh",
    external: true,
    summary: "Versioned replay boundaries for validating frozen evidence without silently changing its meaning.",
    category: "execution-evidence",
    categoryLabel: "Execution & Evidence",
    pathLabel: "docs/frozen-corpus-semantic-replay.md",
  },
  {
    label: "Community Review protocol",
    href: docsRepositoryHref("docs/community-review-protocol.md"),
    glyph: "user",
    external: true,
    summary: "P3 contracts, blindness, qualification boundaries, freeze semantics, agreement limits, and P4 deployment-readiness status.",
    category: "human-review",
    categoryLabel: "Human Review",
    pathLabel: "docs/community-review-protocol.md",
  },
  {
    label: "Participation application gate",
    href: docsRepositoryHref("docs/community-review-application-gate.md"),
    glyph: "shield",
    external: true,
    summary: "The closed-to-open launch checklist and application contract; public application and reviewer intake remain closed.",
    category: "human-review",
    categoryLabel: "Human Review",
    pathLabel: "docs/community-review-application-gate.md",
  },
  {
    label: "Community status",
    href: "/community/",
    glyph: "user",
    summary: "Public participation information without an application form, reviewer login, or live campaign claim.",
    category: "human-review",
    categoryLabel: "Human Review",
    pathLabel: "/community/",
  },
  {
    label: "Roadmap",
    href: docsRepositoryHref("docs/roadmap.md"),
    glyph: "bookmark",
    external: true,
    summary: "The current phase map for benchmark, Judge, Tutor integration, review, and public product work.",
    category: "governance",
    categoryLabel: "Governance",
    pathLabel: "docs/roadmap.md",
  },
  {
    label: "Licensing",
    href: docsRepositoryHref("docs/licensing.md"),
    glyph: "document",
    external: true,
    summary: "Separate software, authored benchmark-content, and TutorBench brand licensing scopes.",
    category: "governance",
    categoryLabel: "Governance",
    pathLabel: "docs/licensing.md",
  },
  {
    label: "Contributing",
    href: docsRepositoryHref("CONTRIBUTING.md"),
    glyph: "user",
    external: true,
    summary: "Contribution categories, local quality gates, benchmark-content proposals, and evidence boundaries.",
    category: "governance",
    categoryLabel: "Governance",
    pathLabel: "CONTRIBUTING.md",
  },
  {
    label: "Security",
    href: docsRepositoryHref("SECURITY.md"),
    glyph: "shield",
    external: true,
    summary: "The public Developer Preview security policy and its current reporting boundary.",
    category: "governance",
    categoryLabel: "Governance",
    pathLabel: "SECURITY.md",
  },
];

function renderDocsBotanical(className: string): string {
  return `<svg class="docs-botanical ${escapeHtml(className)}" viewBox="0 0 240 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.35" />
      <path d="M133 190C103 155 76 123 54 83M126 236C93 219 56 198 22 166M143 140C170 119 194 91 215 58M119 277C88 265 53 250 16 224M153 103C179 91 204 71 228 44" stroke-width="1.05" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width=".9" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width=".9" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width=".9" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width=".9" />
      <path d="M228 44C228 27 235 12 248 4C252 21 246 38 236 47C233 47 230 46 228 44Z" stroke-width=".9" />
    </g>
  </svg>`;
}

function renderDocsNavigation(groups: readonly DocsNavigationGroup[]): string {
  return groups.map((group) => `<section class="docs-nav-group"><h2>${escapeHtml(group.label)}</h2><ul>${group.items.map((item) => `<li><a class="docs-nav-link" href="${escapeHtml(item.href)}"${item.external ? ' rel="noreferrer"' : ""}${item.href === "#overview" ? ' aria-current="page"' : ""}>${icon(item.glyph)}<span>${escapeHtml(item.label)}</span>${item.external ? `<span class="docs-nav-external" aria-hidden="true">${icon("arrow")}</span>` : ""}</a></li>`).join("")}</ul></section>`).join("");
}

function renderDocsCodeBlock(label: string, code: string): string {
  return `<div class="docs-code"><div class="docs-code-heading"><span>${escapeHtml(label)}</span><span class="docs-code-language">bash</span></div><pre><code>${escapeHtml(code)}</code></pre></div>`;
}

function renderDocsEntryPoint(glyph: string, title: string, summary: string, label: string, href: string, external = false): string {
  return `<a class="docs-entry-point" href="${escapeHtml(href)}"${external ? ' rel="noreferrer"' : ""}><span class="docs-entry-icon">${icon(glyph)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(summary)}</small><em>${escapeHtml(label)} ${icon("arrow")}</em></span></a>`;
}

function renderDocsIndexEntry(entry: DocsIndexEntry): string {
  const searchText = [entry.label, entry.summary, entry.categoryLabel, entry.pathLabel].join(" ");
  return `<article class="docs-index-entry" data-doc-entry data-doc-category="${escapeHtml(entry.category)}" data-doc-search="${escapeHtml(searchText)}"><a href="${escapeHtml(entry.href)}"${entry.external ? ' rel="noreferrer"' : ""}><span class="docs-index-icon">${icon(entry.glyph)}</span><span class="docs-index-copy"><span class="docs-index-category">${escapeHtml(entry.categoryLabel)}</span><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.summary)}</span><small class="docs-index-source">${escapeHtml(entry.external ? "GitHub" : "Teachometry")} · ${escapeHtml(entry.pathLabel)}${entry.external ? ` ${icon("arrow")}` : ""}</small></span></a></article>`;
}

export function renderDocsPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const datasetLabel = `${artifacts.benchmark.dataset.id}@${artifacts.benchmark.dataset.version}`;
  const scoreDimensions = artifacts.benchmark.dimensions.score.map(humanize).join(" · ");
  const quickstartRepository = [
    "git clone https://github.com/shuangyan123/tutorbench.git",
    "cd tutorbench",
    "npm ci",
    "npm run quickstart",
  ].join("\n");
  const quickstartPackage = ["npm install tutor-benchmark", "tutorbench quickstart"].join("\n");
  return page(
    "Docs — Teachometry",
    "Repository documentation for TutorBench setup, benchmark contracts, execution workflows, evidence boundaries, and governance.",
    "/docs/",
    `<section class="docs-hero" aria-labelledby="docs-title"><div class="shell docs-hero-shell"><div class="docs-hero-copy"><p class="eyebrow">Documentation</p><h1 id="docs-title">Documentation</h1><p class="docs-hero-lede">Reference, setup, CLI, artifacts, and evaluation workflows.</p><p class="docs-hero-note">Navigate TutorBench’s versioned repository guides and public reference surfaces.</p></div><div class="docs-hero-art"><p>Evidence<br>you can<br>trace.</p>${renderDocsBotanical("docs-botanical-hero")}</div><div class="docs-hero-controls"><form class="docs-search" role="search" aria-label="Search documentation"><label for="docs-search-input">Search documentation</label><span class="docs-search-icon">${icon("search")}</span><input id="docs-search-input" type="search" data-doc-search placeholder="Search documentation…" autocomplete="off"><button type="reset" data-doc-search-clear aria-label="Clear documentation search" hidden>${icon("close")}</button></form><div class="docs-category-filters" role="group" aria-label="Filter documentation by category"><button type="button" data-doc-category="all" aria-pressed="true">All docs</button><button type="button" data-doc-category="getting-started" aria-pressed="false">Getting Started</button><button type="button" data-doc-category="benchmark-data" aria-pressed="false">Benchmark &amp; Data</button><button type="button" data-doc-category="execution-evidence" aria-pressed="false">Execution &amp; Evidence</button><button type="button" data-doc-category="human-review" aria-pressed="false">Human Review</button><button type="button" data-doc-category="governance" aria-pressed="false">Governance</button></div></div></div></section>
    <section class="docs-workspace" aria-label="Documentation center"><div class="shell docs-shell"><details class="docs-mobile-nav"><summary>Browse documentation navigation</summary><nav aria-label="Mobile documentation navigation">${renderDocsNavigation(docsNavigation)}</nav></details><div class="docs-layout"><nav class="docs-sidebar" aria-label="Documentation navigation">${renderDocsNavigation(docsNavigation)}</nav><article class="docs-content"><div class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/docs/">Docs</a><span aria-hidden="true">›</span><span>Reference center</span></div>
      <section class="docs-section docs-overview" id="overview" aria-labelledby="overview-title"><p class="docs-section-kicker">Getting Started / Overview</p><h2 id="overview-title">Overview</h2><p class="docs-lede">TutorBench is provider-neutral measurement infrastructure for observable AI tutoring behavior. This page maps the public Teachometry surface to the repository contracts and guides that define setup, execution, artifacts, and interpretation.</p><p class="docs-boundary-line">The website is a map into the repository’s existing contracts and guides. It does not replace the source documentation.</p><div class="docs-facts"><div><span>Canonical snapshot</span><strong>${escapeHtml(datasetLabel)}</strong></div><div><span>Public cases</span><strong>${escapeHtml(String(artifacts.benchmark.dataset.caseCount))}</strong></div><div><span>Score dimensions</span><strong>${escapeHtml(scoreDimensions)}</strong></div></div><div class="docs-entry-points">${renderDocsEntryPoint("laptop", "Set up", "Start with the real five-minute path.", "Open Quickstart", "#quickstart")}${renderDocsEntryPoint("play", "Run evaluations", "Choose the workflow that matches your evidence.", "Open Run", "/run/")}${renderDocsEntryPoint("database", "Work with artifacts", "Understand packets, corpora, and replay.", "Read 0.4A guide", docsRepositoryHref("docs/tutor-eval-v0.4a.md"), true)}${renderDocsEntryPoint("chart", "Understand results", "Read the method before interpreting output.", "Read methodology", "/methodology/")}</div></section>
      <section class="docs-section docs-quickstart" id="quickstart" aria-labelledby="quickstart-title"><div class="docs-section-heading"><p class="docs-section-kicker">Getting Started / Quickstart</p><h2 id="quickstart-title">Quickstart</h2><p>Install the repository with Node 24, then run a deterministic local demonstration without provider credentials or network access.</p></div><div class="docs-runtime"><span>Runtime requirement</span><strong>Node 24</strong><code>&gt;=24 &lt;25</code></div><div class="docs-code-grid">${renderDocsCodeBlock("Repository clone", quickstartRepository)}${renderDocsCodeBlock("Published npm package", quickstartPackage)}</div><div class="docs-callout docs-callout-positive"><span class="docs-callout-mark">✓</span><p><strong>Provider-free, network-free, Judge-free.</strong> Quickstart uses four fixed development/smoke cases from <code>tutor-eval-v0.1@0.1</code>. It is not the canonical scoring cohort, produces no official benchmark score, and is not leaderboard eligible.</p></div></section>
      <section class="docs-section docs-index-section" id="documentation-index" aria-labelledby="documentation-index-title"><div class="docs-section-heading docs-index-heading"><div><p class="docs-section-kicker">Reference map</p><h2 id="documentation-index-title">Documentation index</h2><p>A curated route into the current repository. GitHub links open the source file; site links open the corresponding public surface.</p></div><p class="docs-index-status" data-doc-status aria-live="polite">Showing ${docsIndex.length} references</p></div><div class="docs-index-grid">${docsIndex.map(renderDocsIndexEntry).join("")}</div><p class="docs-no-results" data-doc-empty role="status" hidden>No documentation matches this search and category.</p></section>
      <section class="docs-section docs-evidence" id="evidence-boundaries" aria-labelledby="evidence-title"><div class="docs-section-heading"><p class="docs-section-kicker">Interpretation boundaries</p><h2 id="evidence-title">Read the evidence carefully.</h2><p>These distinctions keep a useful development surface from making claims the repository does not support.</p></div><div class="docs-boundary-grid"><article><span>${icon("play")}</span><h3>Quickstart ≠ official benchmark score</h3><p>It is a deterministic development/smoke demonstration, not calibrated benchmark evidence.</p></article><article><span>${icon("cloud")}</span><h3>Collection ≠ publication</h3><p>Product Tutor and canonical model corpora remain preliminary unless publication requirements are met.</p></article><article><span>${icon("shield")}</span><h3>Judge ≠ ground truth</h3><p>A Judge is an evaluator boundary. Unresolved criteria stay unresolved when required evidence is unavailable.</p></article><article><span>${icon("user")}</span><h3>Human review ≠ automatic gold standard</h3><p>Human evidence can strengthen the method without becoming unquestionable ground truth.</p></article></div></section>
      <section class="docs-section docs-governance" id="governance" aria-labelledby="governance-title"><div class="docs-governance-intro"><p class="docs-section-kicker">Governance &amp; contribution</p><h2 id="governance-title">Defined boundaries for an open repository.</h2><p>Software, authored benchmark content, and the TutorBench name have deliberately separate scopes. Contributions can propose software, cases, rubrics, methodology, documentation, adapters, website changes, and calibration/audit infrastructure.</p><p class="docs-status-note"><strong>Community status:</strong> public participation information is available; public applications, reviewer intake, and a real Community Review campaign have not started.</p></div><div class="docs-license-panel"><div><span>Software</span><strong>Apache-2.0</strong><a href="${escapeHtml(docsRepositoryHref("LICENSE"))}" rel="noreferrer">Read LICENSE ${icon("arrow")}</a></div><div><span>Benchmark content (authored)</span><strong>CC BY 4.0</strong><a href="${escapeHtml(docsRepositoryHref("LICENSES/CC-BY-4.0.txt"))}" rel="noreferrer">Read content license ${icon("arrow")}</a></div><div><span>Name &amp; visual assets</span><strong>TutorBench Brand Policy</strong><a href="${escapeHtml(docsRepositoryHref("LICENSES/BRAND-POLICY.md"))}" rel="noreferrer">Read brand policy ${icon("arrow")}</a></div></div><div class="docs-governance-links"><a href="${escapeHtml(docsRepositoryHref("docs/licensing.md"))}" rel="noreferrer">Licensing scope ${icon("arrow")}</a><a href="${escapeHtml(docsRepositoryHref("CONTRIBUTING.md"))}" rel="noreferrer">Contributing ${icon("arrow")}</a><a href="${escapeHtml(docsRepositoryHref("SECURITY.md"))}" rel="noreferrer">Security Policy ${icon("arrow")}</a><p>The Security Policy does not enable GitHub Private Vulnerability Reporting and does not invent a private reporting address.</p></div></section>
      <section class="docs-section docs-next-steps" id="next-steps" aria-labelledby="next-steps-title"><div class="docs-section-heading"><p class="docs-section-kicker">Continue the reference path</p><h2 id="next-steps-title">Next steps</h2><p>Move from orientation to the repository surface that matches your question.</p></div><div class="docs-next-grid">${renderDocsEntryPoint("play", "Run TutorBench", "Start with the provider-free path.", "Open Run", "/run/")}${renderDocsEntryPoint("flask", "Read methodology", "Understand dimensions and evaluator boundaries.", "Read methodology", "/methodology/")}${renderDocsEntryPoint("grid", "Browse public data", "Inspect cases and public artifact context.", "Open benchmark", "/data/")}${renderDocsEntryPoint("github", "Browse repository docs", "Read the versioned source guides.", "View GitHub", SITE_GITHUB_URL, true)}</div></section></article><aside class="docs-toc" aria-label="On this page"><p>On this page</p><nav><a href="#overview" aria-current="true">Overview</a><a href="#quickstart">Quickstart</a><a href="#documentation-index">Documentation index</a><a href="#evidence-boundaries">Evidence boundaries</a><a href="#governance">Governance</a><a href="#next-steps">Next steps</a></nav><div class="docs-toc-note"><span>Reference, not replacement.</span><p>Source files remain the authority for contracts, commands, and status.</p></div></aside></div></div></section>
    <section class="docs-closing" aria-labelledby="docs-closing-title"><div class="shell docs-closing-inner"><div><p class="docs-section-kicker">Still looking?</p><h2 id="docs-closing-title">Find more in the guides, methodology, or repository.</h2></div><div class="docs-closing-actions"><a class="button button-secondary" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">Browse repository docs ${icon("arrow")}</a><a class="button button-primary" href="/run/">Run TutorBench ${icon("arrow")}</a></div>${renderDocsBotanical("docs-botanical-closing")}</div></section>
    ${renderTeachometryFooter(artifacts)}`,
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
    `<section class="about-hero" aria-labelledby="about-title"><div class="shell about-hero-grid"><div class="about-hero-copy"><p class="eyebrow">About Teachometry</p><h1 id="about-title">A model can know <br>the answer <br><em>without being <br>a good tutor.</em></h1><p class="about-hero-lede">Teachometry is open measurement infrastructure for AI tutoring. We evaluate observable tutoring behavior in structured cases—not just whether the answer is right.</p><div class="button-row"><a class="button button-primary" href="/methodology/">Read our approach ${icon("arrow")}</a><a class="button button-secondary" href="/data/">Explore the benchmark</a></div></div><div class="about-hero-art" aria-hidden="true">${renderAboutBotanical("about-botanical-hero")}<p class="about-handwritten about-hero-note">More than<br>correct answers.</p><p class="about-handwritten about-hero-note-two">Toward<br>truly helpful AI<br>tutors.</p><div class="about-hero-rail"><span>Better<br>measurement.<br>A more human<br>learning future.</span><i></i></div></div></div></section>
    <section class="about-why" aria-labelledby="about-why-title"><div class="shell about-why-grid"><div class="about-why-copy"><p class="eyebrow">Why Teachometry exists</p><h2 id="about-why-title">Answers <span>≠</span> Teaching.</h2><p>AI models can often produce correct answers, but tutoring asks for more: noticing where a learner is stuck, guiding reasoning, adapting help, and leaving an actionable next step. A correct answer is evidence of correctness—not evidence that the interaction taught well.</p><div class="about-rule"></div><p class="about-pull-quote">To evaluate AI tutoring, we need evidence of what models do with learners—not only what they know.</p></div><div class="about-dimensions"><p class="about-dimensions-intro">The public benchmark keeps these questions separate, so each result remains tied to a case, a dimension, and its observable evidence.</p>${renderAboutDimensionList(scoreDimensions)}</div><aside class="about-why-art"><img class="about-botanical-photo" src="/assets/botanical/images/about-botanical-photo.jpg" width="1122" height="1402" loading="lazy" decoding="async" alt=""><div class="about-art-wash"></div>${renderAboutBotanical("about-botanical-why")}<p>Same<br>problems.<br><em>Deeper<br>questions.</em></p><span class="about-art-rule"></span></aside></div></section>
    <section class="about-boundary" aria-labelledby="about-boundary-title"><div class="shell about-boundary-layout"><div class="about-boundary-copy"><p class="eyebrow">Our position</p><h2 id="about-boundary-title">We measure tutors.<br>We don’t build the tutor.</h2><p>Teachometry's TutorBench engine evaluates a <code>TutorUnderTest</code> through a provider-neutral adapter boundary. Provider-specific behavior enters at the edge; the engine’s cases, contracts, evaluators, and reports remain independent.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">Inspect the repository ${icon("arrow")}</a></div><figure class="about-boundary-figure"><div class="about-boundary-flow"><div class="about-boundary-external">${renderAboutBoundaryList(["Chat application", "Prompt playground"], "Outside our scope")}</div><div class="about-boundary-core"><div class="about-flow-node"><span>${icon("robot")}</span><strong>TutorUnderTest</strong><small>provider adapter boundary</small></div><span class="about-flow-arrow" aria-hidden="true">${icon("arrow")}</span><div class="about-flow-node about-flow-evaluation"><span>${icon("book")}</span><strong>Teachometry<br>evaluation</strong><small>cases · rubrics · reports</small></div></div><div class="about-boundary-external">${renderAboutBoundaryList(["Model fine-tuning", "Admin dashboard", "Review Workspace module"], "Outside our scope")}</div></div><figcaption>Same cases. Clear criteria. Reproducible evaluation.</figcaption></figure></div></section>
    <section class="about-principles" aria-labelledby="about-principles-title"><div class="shell about-principles-shell"><div class="about-principles-heading"><p class="eyebrow" id="about-principles-title">What we believe</p></div><div class="about-principles-grid"><article class="about-principle"><span>01</span><h3>Observable<br>over assumed</h3><p>Evaluate what a tutor says and does in the interaction, not inferred intentions or claimed capabilities.</p></article><article class="about-principle"><span>02</span><h3>Evidence<br>over hype</h3><p>Favor transparent methods, reproducible artifacts, and inspectable evidence over marketing narratives.</p></article><article class="about-principle"><span>03</span><h3>Context<br>over a single score</h3><p>Results belong to specific cases, versions, dimensions, and evaluation contexts—not a universal number.</p></article><article class="about-principle"><span>04</span><h3>Open methods<br>over black boxes</h3><p>Publish cases, methodology, contracts, and public artifacts so claims can be inspected and challenged.</p></article></div><div class="about-principles-art" aria-hidden="true">${renderAboutBotanical("about-botanical-principles")}<p class="about-handwritten">Open science<br>for better<br>learning.</p><span class="about-art-rule"></span></div></div></section>
    <section class="about-status" aria-labelledby="about-status-title"><div class="shell about-status-grid"><div class="about-status-intro"><p class="eyebrow">Where we are now</p><h2 id="about-status-title">${escapeHtml(benchmark.statusLabel)}</h2><p>Teachometry is in active development. The public site packages approved development metadata and public cases; it does not publish private runs or claim completed calibration.</p><a class="text-link" href="${escapeHtml(licenseRoot)}/docs/release.md" rel="noreferrer">View current release notes ${icon("arrow")}</a></div><dl class="about-ledger"><div><dt>${icon("bookmark")} Website</dt><dd>${escapeHtml(benchmark.statusLabel)}</dd></div><div><dt>${icon("package")} Package</dt><dd>tutor-benchmark@${escapeHtml(packageVersion)} published</dd></div><div><dt>${icon("database")} Dataset</dt><dd>${escapeHtml(datasetLabel)}</dd></div><div><dt>${icon("list")} Public cases</dt><dd>${escapeHtml(String(benchmark.dataset.caseCount))} synthetic cases</dd></div><div><dt>${icon("chart")} Public model runs</dt><dd>${escapeHtml(publicModelStatus)}</dd></div><div><dt>${icon("shield")} Calibration</dt><dd>Not completed; results remain preliminary and uncalibrated where applicable.</dd></div></dl></div></section>
    <section class="about-open" aria-labelledby="about-open-title"><div class="shell about-open-layout"><div class="about-open-intro"><p class="eyebrow">Open by design</p><h2 id="about-open-title">A shared resource<br>for the AI tutoring community.</h2><p>Teachometry is developed in the open, with separate boundaries for software, authored benchmark content, and the TutorBench name and brand assets.</p></div><div class="about-resource-grid">${renderAboutResource("Licensing scope", "Read the boundaries", `${licenseRoot}/docs/licensing.md`, "document")}${renderAboutResource("Software license", "Apache-2.0", `${licenseRoot}/LICENSE`, "code")}${renderAboutResource("Benchmark content", "CC BY 4.0", `${licenseRoot}/LICENSES/CC-BY-4.0.txt`, "bookmark")}${renderAboutResource("TutorBench Brand Policy", "Usage guidelines", `${licenseRoot}/LICENSES/BRAND-POLICY.md`, "shield")}${renderAboutResource("Contributing", "Get involved", `${licenseRoot}/CONTRIBUTING.md`, "user")}${renderAboutResource("Security", "Report an issue", `${licenseRoot}/SECURITY.md`, "shield")}${renderAboutResource("GitHub", "View repository", SITE_GITHUB_URL, "github")}</div></div></section>
    ${renderTeachometryFooter(artifacts)}`,
  );
}
