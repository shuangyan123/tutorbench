import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import {
  escapeHtml,
  humanize,
  renderCodeBlock,
  renderKeyValueList,
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

export function renderRunPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  const quickstartCommands = `git clone ${SITE_GITHUB_URL}.git
cd tutorbench
npm ci
npm run quickstart

# Published v0.1.0 package:
npm install tutor-benchmark
tutorbench quickstart`;
  const fullBenchmarkCommands = `npm run benchmark`;
  const corpusCommands = `npm run tutor:export-execution -- -- --case fraction-misconception-001
npm run tutor:export-cases
npm run tutor:corpus:validate -- -- --corpus path/to/corpus.json
npm run benchmark:corpus -- -- --corpus path/to/corpus.json`;
  const collectionCommands = `tutorbench collect \\
  --http http://127.0.0.1:8000/respond \\
  --provider <provider> \\
  --model <actual-model-id> \\
  --prompt-version product-config-v3 \\
  --provenance external \\
  --limit 3 \\
  --output artifacts/product/product.json

tutorbench collect-model \\
  --http http://127.0.0.1:9000/generate \\
  --provider <provider> \\
  --model <actual-model-id> \\
  --limit 3 \\
  --output artifacts/real-model/model.json

tutorbench evaluate \\
  --corpus artifacts/real-model/model.json`;
  return page(
    "Run the Benchmark — Tutor Benchmark",
    "Run Tutor Benchmark locally with an adapter or a frozen Tutor response corpus.",
    "/run/",
    `<section class="page-intro"><div class="shell narrow-shell"><div class="eyebrow-row">${renderStatusBadge(artifacts.benchmark.statusLabel, "preview")}<span class="eyebrow">Developer workflow</span></div><h1>Run TutorBench locally</h1><p class="lede">Start with a five-minute deterministic demonstration, then move to the full benchmark or the advanced evidence paths when you need them.</p></div></section>
    <section class="section"><div class="shell run-grid"><div><p class="eyebrow">Quickstart</p><h2>Run the provider-free demo</h2><p>Quickstart needs no API key, Judge, or network connection. It runs four fixed cases from <code>tutor-eval-v0.1@0.1</code>, an existing development/smoke subset, and reports deterministic checks without an official score.</p>${renderCodeBlock(quickstartCommands, "bash")}</div><aside class="panel run-aside"><p class="eyebrow">Quickstart boundary</p>${renderKeyValueList([["Dataset", "tutor-eval-v0.1@0.1 (development smoke)"],["Cases", "4 fixed cases"],["Judge", "Not required"],["Network", "Disabled"],["Official score", "No"],["Leaderboard", "Not eligible"]])}<a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/quickstart.md" rel="noreferrer">Read the Quickstart guide ↗</a></aside></div></section>
    <section class="section section-muted"><div class="shell run-grid"><div><p class="eyebrow">Full benchmark</p><h2>Run the canonical evaluation path</h2><p><code>npm run benchmark</code> remains the full local benchmark for <code>${escapeHtml(`${artifacts.benchmark.dataset.id}@${artifacts.benchmark.dataset.version}`)}</code>. Its semantic boundary includes Judge-required rubrics. Without an explicitly configured Judge, those criteria remain unresolved and the normal run reports errors with no score; Quickstart does not replace or weaken that behavior.</p>${renderCodeBlock(fullBenchmarkCommands, "bash")}</div><aside class="panel run-aside"><p class="eyebrow">Canonical status</p>${renderKeyValueList([["Dataset", `${artifacts.benchmark.dataset.id}@${artifacts.benchmark.dataset.version}`],["Cases", String(artifacts.benchmark.dataset.caseCount)],["Judge", "Explicitly configured when needed"],["No-Judge result", "Unresolved errors; no score"]])}<a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/release.md" rel="noreferrer">Read the release boundary ↗</a></aside></div></section>
    <section class="section section-muted"><div class="shell run-grid"><div><p class="eyebrow">Use any language</p><h2>Connect an external Tutor over HTTP</h2><p>Any runtime that accepts JSON and serves <code>POST /respond</code> can implement the Tutor boundary. The adapter sends Tutor-visible input only and keeps Judge evidence on the evaluator side.</p>${renderCodeBlock(`python examples/http-python-tutor/server.py\n\n# Published package:\ntutorbench run \\\n  --http http://127.0.0.1:8000/respond \\\n  --limit 3\n\n# From a clone after npm run build:\nnode dist/src/cli/tutorbench.js run \\\n  --http http://127.0.0.1:8000/respond \\\n  --limit 3`, "bash")}</div><aside class="panel run-aside"><p class="eyebrow">HTTP v1</p><p><code>TutorTurnInput</code> JSON in; <code>{ text, metrics? }</code> JSON out. The default timeout is 30 seconds and the adapter does not retry external requests.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/examples/http-python-tutor/README.md" rel="noreferrer">Open the Python example ↗</a></aside></div></section>
    <section class="section"><div class="shell run-grid"><div><p class="eyebrow">Real-model evidence</p><h2>Separate Product Tutor and canonical model evidence</h2><p>The Product path freezes TutorTurnInput responses without a generation spec. The canonical model path freezes exact execution-packet responses with a generation spec. Both keep failed case/runs in a sanitized report and replay offline; neither discovers credentials, retries calls, or writes website public data.</p>${renderCodeBlock(collectionCommands, "bash")}</div><aside class="panel run-aside"><p class="eyebrow">Preliminary only</p><p>Real-model artifacts are local and ignored by default. They remain preliminary, uncalibrated, and ineligible for the public leaderboard until host review, human/Judge calibration, and a publication review exist.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}/blob/main/docs/real-model-baselines.md" rel="noreferrer">Read the collection guide ↗</a></aside></div></section>
    <section class="section section-muted"><div class="shell"><p class="eyebrow">Canonical execution mode</p><h2>Freeze the benchmark conditions first</h2><p class="section-copy">Export a <code>TutorExecutionPacket</code> with the versioned <code>TutorGenerationSpec</code>, exact prompt identity, canonical messages, and output cap. The default <code>baseline-native-default</code> profile leaves optional temperature, reasoning, and seed controls unconstrained so provider-native behavior is not misrepresented as identical across vendors.</p>${renderCodeBlock(corpusCommands, "bash")}<div class="callout"><strong>Controlled optional generation parameters: none</strong><p><code>tutor:export-cases</code> is the semantic Tutor-visible adapter packet. <code>tutor:export-execution</code> is the canonical benchmark packet used to make model runs comparable. Neither packet includes evaluator-only annotations. The same benchmark does not imply that every provider exposes identical inference knobs.</p></div></div></section>
    <section class="section"><div class="shell adapter-grid"><div><p class="eyebrow">Minimal adapter shape</p><h2>Keep the provider at the edge</h2><p class="section-copy">The adapter receives a typed, Tutor-visible input and returns a text response. Provider metadata stays outside the core benchmark result contract.</p></div>${renderCodeBlock(`import type { TutorUnderTest } from "./src/contracts/tutor.js";

const tutor: TutorUnderTest = {
  id: "my-tutor",
  async respond(input) {
    return {
      text: await myTutor(input.currentStudentMessage),
    };
  },
};`, "ts")}</div></section>
    <section class="section section-dark"><div class="shell"><p class="eyebrow">Optional Judge path</p><h2>Explicit, offline by default</h2><p class="section-copy">The repository has separate opt-in OpenAI Responses and DeepSeek Chat Completions Judge providers. Dry-run/request tests stay offline; live execution requires explicit local configuration. The website build never calls a Judge provider and the browser never receives credentials.</p>${renderCodeBlock(`npm run judge:openai -- -- --dry-run

# Frozen-corpus DeepSeek Judge subset:
node dist/src/cli/tutorbench.js evaluate \\
  --corpus artifacts/real-model/baseline.json \\
  --limit 1 \\
  --judge-deepseek`, "bash")}</div></section>`,
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

export function renderAboutPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return page(
    "About — Tutor Benchmark",
    "The philosophy and public status of Tutor Benchmark.",
    "/about/",
    `<section class="page-intro"><div class="shell narrow-shell"><div class="eyebrow-row">${renderStatusBadge(artifacts.benchmark.statusLabel, "preview")}<span class="eyebrow">Philosophy</span></div><h1>A model can know the answer without being a good tutor.</h1><p class="lede">Tutor Benchmark asks what a model does with a learner’s actual state—not only whether it can produce a correct answer.</p></div></section>
    <section class="section"><div class="shell quote-section"><blockquote>“A model can know the answer without being a good tutor.”</blockquote><p>That is why this project focuses on observable tutoring behavior: diagnosis, guidance, adaptation, and the learner’s next action, alongside correctness.</p></div></section>
    <section class="section section-muted"><div class="shell two-column"><div><p class="eyebrow">Independent by design</p><h2>Benchmark, not tutor product.</h2></div><div><p class="section-copy">Tutor Benchmark evaluates a <code>TutorUnderTest</code>. It is not a chat application, a prompt playground, an admin dashboard, or a Review Workspace module. Provider-specific behavior enters through an adapter boundary.</p><a class="text-link" href="${escapeHtml(SITE_GITHUB_URL)}" rel="noreferrer">Inspect the source ↗</a></div></div></section>
    <section class="section"><div class="shell about-grid"><div class="panel"><p class="eyebrow">Current release posture</p>${renderKeyValueList([["Website", "Developer Preview"],["Package", "v0.1.0 published"],["Dataset", `${artifacts.benchmark.dataset.id}@${artifacts.benchmark.dataset.version}`],["Leaderboard", "No calibrated public runs"],["License", "Apache-2.0 / CC BY 4.0 / Brand Policy"]])}</div><div class="panel"><p class="eyebrow">Public boundary</p><p>The site is read-only and secret-free. It packages public development metadata, not credentials, raw provider payloads, private calibration files, production conversations, or hidden reasoning.</p></div></div></section>`,
  );
}
