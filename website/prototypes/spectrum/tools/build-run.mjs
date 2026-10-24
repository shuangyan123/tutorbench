// Builds the Run and Docs pages of the Spectrum prototype (run/index.html, docs/index.html), in English
// and 简体中文 on one page. The copy mirrors renderRunPage and renderDocsPage in src/site/pages/developer.ts:
// every English string is looked up in the live SITE_ZH_CN_COPY, so a string that drifts from the live
// page fails the build. Commands stay exactly as the live page prints them. The dataset label, case
// count and the four case IDs come from the public artifacts, as on the live pages.
// The tabs, copy buttons, search and filters are driven by run.js, a port of the live site.js handlers.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-run.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, Zor, bi, biE, biPE, frame, RENDERED } from "./site-kit.mjs";

const { DOC_COUNT_TEMPLATES, formatCurrentDataset, formatCanonicalCases } = await import(join(REPO, "dist/src/site/public-localization-formatters.js"));
const { publicEvidenceCopy } = await import(join(REPO, "dist/src/site/public-localization.js"));
const benchmark = JSON.parse(readFileSync(join(REPO, "website/dist/public-data/benchmark.json"), "utf8"));
const cases = JSON.parse(readFileSync(join(REPO, "website/dist/public-data/cases.json"), "utf8"));
const GITHUB = "https://github.com/shuangyan123/tutorbench";
const repo = (path) => `${GITHUB}/blob/main/${path}`;
const DATASET = `${benchmark.dataset.id}@${benchmark.dataset.version}`;
const CASE_IDS = cases.cases.slice(0, 4).map((c) => c.id);

const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
const OUT_ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg>`;
const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>`;
const CROSS = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>`;
const SEARCH = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/></svg>`;
/** a pair of strings for one attribute, swapped by run.js when the language changes */
const attr2 = (name, en, zh = Z(en)) => `${name}="${esc(en)}" data-${name}-en="${esc(en)}" data-${name}-zh="${esc(zh)}"`;
/** two live fragments shown as one phrase (the live page breaks them with <br>) */
const lines = (parts, zhJoin = "") => bi(parts.map(esc).join("<br>"), parts.map((p) => esc(Z(p))).join(zhJoin || "<br>"));

/* ------------------------------------------------------------------ Run */

const COVER = {
  file: "tubes.webp",
  alt: [`Four glass test tubes of clear water stand in an aluminium rack on white paper, lit by one low lamp so their long shadows fall toward the camera. Each tube carries a paper label: 01 to 04, a public case ID, and the dataset ${DATASET}.`,
    `四支盛着清水的玻璃试管立在铝制试管架上，下面是白纸；一盏低处的灯把长长的影子投向镜头。每支试管贴着纸标签：编号 01 到 04、一个公开案例 ID，以及数据集 ${DATASET}。`],
};

const PANELS = [
  {
    id: "quickstart", label: "Quickstart", copyZh: "复制 Quickstart 命令",
    title: "Get started (provider-free)",
    summary: "Clone the repository and run the deterministic Quickstart.",
    commands: ["# 1. Clone the repository", `git clone ${GITHUB}.git`, "cd tutorbench", "", "# 2. Install dependencies", "npm ci", "", "# 3. Run the Quickstart (no API key)", "npm run quickstart"],
    facts: ["Repository main · Node 24", "Runs locally without an API key", "Uses 4 fixed cases from tutor-eval-v0.1@0.1", "No Judge, no network connection", "Deterministic checks (no official score)", "Not leaderboard eligible"],
    note: "A development/smoke demonstration with no overall score; Quickstart does not weaken the canonical benchmark boundary.",
  },
  {
    id: "health", label: "Tutor Health", copyZh: "复制 Tutor Health 命令",
    title: "Diagnose an external Tutor in real-world scenarios",
    summary: "Run the repository-only, finding-first Tutor Health workflow against an HTTP Tutor.",
    commands: ["node dist/src/cli/tutorbench.js health \\", "  --http https://partner.example.com/respond \\", "  --suite productive-struggle-intervention-v0.1 \\", "  --tutor-provider partner \\", "  --tutor-model production \\", "  --prompt-version v17 \\", "  --output artifacts/partner-pilot"],
    facts: ["Writes evaluation.json, health-report.json, and health-report.txt", "Records Tutor provider, model/config, and prompt version provenance", "Reports Tutor Health Score, explicit coverage, Release Gate, Findings, and regression targets", "No-Judge runs stay UNRESOLVED and are marked as incomplete evidence"],
    note: "The current 13-scenario suite is an authored synthetic design artifact with partial health-dimension coverage; it is not a validated general tutor-quality or learner-outcome measure.",
  },
  {
    id: "benchmark", label: "Benchmark", copyZh: "复制基准命令",
    title: "Run the canonical benchmark",
    summary: "Use the current public dataset and preserve its fail-closed evaluator boundary.",
    commands: ["npm run benchmark"],
    facts: [[formatCurrentDataset(DATASET, "en"), formatCurrentDataset(DATASET, "zh-CN")], [formatCanonicalCases(benchmark.dataset.caseCount, "en"), formatCanonicalCases(benchmark.dataset.caseCount, "zh-CN")], "Judge-required criteria stay unresolved without an explicit Judge", "No score is reported when required evidence is unavailable"],
    note: "The canonical run is distinct from the four-case Quickstart and may report errors or no score without Judge configuration.",
  },
  {
    id: "external-tutor", label: "External Tutor", copyZh: "复制 HTTP 适配器命令",
    title: "Connect an external Tutor over HTTP",
    summary: "Run the repository example, then send TutorTurnInput to POST /respond.",
    commands: ["python examples/http-python-tutor/server.py", "", "tutorbench run --http http://127.0.0.1:8000/respond --limit 3"],
    facts: ["TutorTurnInput JSON in; { text, metrics? } JSON out", "Default request timeout is 30 seconds", "External requests are not retried automatically", "Product Tutor evidence remains separate from canonical model evidence"],
    note: "The adapter evaluates the Tutor response at the edge; evaluator-only evidence stays inside TutorBench.",
  },
  {
    id: "advanced", label: "Advanced", copyZh: "复制高级命令",
    title: "Freeze and inspect evidence paths",
    summary: "Collect Product Tutor or canonical model responses, then evaluate a frozen corpus offline.",
    commands: [
      "tutorbench collect --http http://127.0.0.1:8000/respond --provider <provider> --model <actual-model-id> --prompt-version product-config-v3 --provenance external --limit 3 --output artifacts/product/product.json",
      "", "tutorbench collect-model --http http://127.0.0.1:9000/generate --provider <provider> --model <actual-model-id> --limit 3 --output artifacts/real-model/model.json",
      "", "tutorbench evaluate --corpus artifacts/real-model/model.json",
      "", "# Export the semantic and canonical packets", "npm run tutor:export-execution -- -- --case fraction-misconception-001", "npm run tutor:export-cases",
      "", "# Validate and replay a frozen corpus", "npm run tutor:corpus:validate -- -- --corpus path/to/corpus.json", "npm run benchmark:corpus -- -- --corpus path/to/corpus.json",
      "", "# OpenAI Judge dry-run (no network)", "npm run judge:openai -- -- --dry-run",
      "", "# Frozen-corpus DeepSeek Judge subset", "node dist/src/cli/tutorbench.js evaluate \\", "  --corpus artifacts/real-model/baseline.json \\", "  --limit 1 \\", "  --judge-deepseek",
    ],
    facts: ["Product Tutor and canonical model collection are different paths", "TutorExecutionPacket and TutorGenerationSpec identify canonical requests", "OpenAI Responses and DeepSeek Chat Completions are explicit Judge paths", "Canonical model collection uses baseline-native-default", "Controlled optional generation parameters: none", "Local artifacts remain preliminary, uncalibrated, and not public"],
    note: [publicEvidenceCopy("collectionBoundary", "en"), publicEvidenceCopy("collectionBoundary", "zh-CN")],
  },
];
const pairOf = (v) => (Array.isArray(v) ? biE(v[0], v[1]) : biE(v));
const pairP = (tag, cls, v) => (Array.isArray(v) ? biPE(tag, cls, v[0], v[1]) : biPE(tag, cls, v));
/** commands, with comment lines dimmed as on the homepage terminal */
const code = (rows) => rows.map((r) => (r.startsWith("#") ? `<span class="c">${esc(r)}</span>` : esc(r))).join("\n");

function releaseBoundary() {
  return `<p class="rn-channel" data-release-channel-boundary>${bi(
    `Current workflows use the Node 24 repository source. Published npm 0.1.0 requires Node 22 and includes Quickstart, but has no Tutor Health CLI or API. <a class="text-link" href="${repo("docs/release.md")}#installation-channels" rel="noreferrer">Check release channels and API boundaries ${OUT_ARROW}</a>`,
    `当前工作流使用 Node 24 的仓库源码。已发布 npm 0.1.0 要求 Node 22，包含 Quickstart，但没有 Tutor Health CLI 或 API。<a class="text-link" href="${repo("docs/release.md")}#installation-channels" rel="noreferrer">查看发行渠道与 API 边界 ${OUT_ARROW}</a>`)}</p>`;
}

function panel(p, i) {
  const pkg = p.id === "quickstart" ? `
        <div class="rn-pkg" id="published-quickstart">
          <p><b>${biE("Published 0.1.0 · Node 22")}</b>${biE("Historical CLI with Quickstart; Tutor Health requires the Node 24 repository.")}</p>
          <code>npm install tutor-benchmark@0.1.0</code><code>npx --no-install tutorbench quickstart</code>
        </div>` : "";
  return `<section class="rn-panel" data-run-panel="${p.id}" role="tabpanel" id="run-panel-${p.id}" aria-labelledby="run-tab-${p.id}"${i === 0 ? "" : " hidden"}>
        <div class="rn-panel-head">
          <div><p class="rn-panel-no">${String(i + 1).padStart(2, "0")} / 05</p><h3>${biE(p.title)}</h3>${biPE("p", "", p.summary)}</div>
        </div>
        <div class="term rn-term">
          <div class="term-bar"><span></span><span></span><span></span><p>tutorbench · ${esc(p.label.toLowerCase())}</p><button class="rn-copy" type="button" data-copy-run ${attr2("aria-label", `Copy ${p.label} command`, p.copyZh)}><span class="en" data-copy-label>Copy</span><span class="zh" lang="zh-CN" data-copy-label>${esc(Z("Copy"))}</span></button></div>
<pre><code>${code(p.commands)}</code></pre>
        </div>
        <ul class="rn-facts">${p.facts.map((f) => `<li>${CHECK}<span>${pairOf(f)}</span></li>`).join("")}</ul>
        ${pairP("p", "rn-note", p.note)}${pkg}
      </section>`;
}

function console_() {
  return `<div class="rn-console run-console" id="quickstart" aria-labelledby="run-console-title">
      <div class="rn-side">
        <p class="kicker rn-side-k">${bi("Five ways to run", "五种运行方式")}</p>
        <div class="rn-tabs" role="tablist" ${attr2("aria-label", "Run workflows")}>
          ${PANELS.map((p, i) => `<button type="button" role="tab" id="run-tab-${p.id}" aria-controls="run-panel-${p.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-run-tab="${p.id}"><span class="rn-tab-no">${String(i + 1).padStart(2, "0")}</span><span class="rn-tab-l">${biE(p.label)}</span></button>`).join("\n          ")}
        </div>
        <p class="rn-annot">${bi(`${esc("Same questions.")}<br><em>${esc("Clearer evidence.")}</em>`, `${esc(Z("Same questions."))}<br><em>${esc(Z("Clearer evidence."))}</em>`)}</p>
      </div>
      <div class="rn-panels">
        <h2 id="run-console-title" class="visually-hidden">${biE("Run workflows")}</h2>
      ${PANELS.map(panel).join("\n      ")}
      </div>
    </div>`;
}

const STEPS = [
  ["Install", "Choose Node 24 repository source or the historical Node 22 package."],
  ["Run", "Start with Quickstart; Tutor Health requires the repository build."],
  ["Inspect", "Inspect findings, evidence, coverage, and versioned artifacts before the next Tutor change."],
];
const CAPS = [
  ["local", "Provider-free", ["Quickstart demonstration", "Public case/data inspection", "Frozen-corpus validation and replay", "Website and artifact workflows", "Dry-run and request validation"], "Run locally now", "#quickstart"],
  ["external", "External Tutor / model", ["HTTP Tutor adapter (POST /respond)", "Product Tutor collection", "Canonical model collection", "Explicit Judge providers (OpenAI Responses, DeepSeek, generic Chat Completions)", "Advanced offline analysis workflows"], "See configuration guide", "../docs/index.html"],
  ["blocked", "Not yet public", ["Calibrated public model results", "Human calibration and validation", "Statistical validation", "Official leaderboard rankings"], "Learn about the roadmap", "../methodology/index.html#status"],
];
const CHECKLIST = [
  ["Dataset version", [`e.g., ${DATASET}`, `例如，${DATASET}`]],
  ["Case or corpus identity", "Case IDs or frozen corpus"],
  ["Prompt / generation spec", "Prompt templates and parameters"],
  ["Provider and model snapshot", "Model name, version, and settings (if applicable)"],
  ["Run metadata", "Date, environment, configuration"],
  ["Evidence output", "Logs, traces, and evaluation results"],
];
const NEXT_RUN = [
  ["Documentation", "Setup, configuration, and usage guides.", "../docs/index.html"],
  ["Methodology", "Learn how we evaluate tutoring behavior.", "../methodology/index.html"],
  ["Results", "See benchmark results and analysis.", "../leaderboard/index.html"],
  ["Cases", "Browse and explore the evaluation scenarios.", "../data/cases/index.html"],
];

function runPage() {
  const body = `<main id="main" class="rn">
  <header class="essay-head rn-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("Run · Get started")}</span><span class="rule" aria-hidden="true"></span><span>Node 24 · ${esc(DATASET)}</span></p>
        <h1 class="essay-title" id="run-title">${bi("From research questions to <em>reproducible runs.</em>", `${esc(Z("From research"))}${esc(Zor("questions to", "问题走向"))}<em>${esc(Z("reproducible runs."))}</em>`)}</h1>
        ${biPE("p", "rn-lede", "Run TutorBench locally, then connect an external Tutor to the Tutor Health workflow to diagnose concrete teaching failures in authored real-world scenarios. The canonical benchmark and frozen-evidence paths remain available as the underlying reproducibility layer.")}
        <p class="cx-actions"><a class="cta cta-ink" href="#quickstart">${biE("Run locally now")} ${ARROW}</a><a class="cta cta-line" href="../docs/index.html">${biE("View the documentation")}</a></p>
        <ul class="rn-signals" ${attr2("aria-label", "Run principles")}><li>${biE("Open source")}</li><li>${biE("Transparent evaluation")}</li><li>${biE("Evidence-first")}</li></ul>
      </div>
      <figure class="cover-plate">
        <img src="../assets/run/${COVER.file}" alt="${esc(COVER.alt[0])}" width="900" height="1100" data-alt-en="${esc(COVER.alt[0])}" data-alt-zh="${esc(COVER.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(`${esc(["Same cases.", "Different Tutors.", "Comparable evidence."].join(" "))} ${esc(RENDERED[0])}`, `${["Same cases.", "Different Tutors.", "Comparable evidence."].map((s) => esc(Z(s))).join("")}${esc(RENDERED[1])}`)}</figcaption>
      </figure>
    </div>
  </header>

  <section class="rn-bench" aria-label="${esc("Run workflows")}">
    <div class="wrap">
      ${console_()}
      ${releaseBoundary()}
    </div>
  </section>

  <section class="wrap rn-flow" aria-labelledby="run-flow-title">
    <div class="rn-sec-l"><p class="kicker" id="run-flow-title">${biE("How to run")}</p><p class="rn-flow-note">${bi(`${esc("Traceable runs.")}<br><em>${esc("For better research.")}</em>`, `${esc(Z("Traceable runs."))}<br><em>${esc(Z("For better research."))}</em>`)}</p></div>
    <ol class="rn-steps">
      ${STEPS.map(([t, c], i) => `<li><span class="rn-step-n">${i + 1}</span><h3>${biE(t)}</h3>${biPE("p", "", c)}</li>`).join("\n      ")}
    </ol>
  </section>

  <section class="wrap rn-cap" id="run-capabilities" aria-labelledby="run-capabilities-title">
    <div class="rn-cap-main">
      <p class="kicker">${biE("Execution boundaries")}</p>
      <h2 id="run-capabilities-title" class="jx-h2">${biE("What can you run now?")}</h2>
      ${biPE("p", "jx-p", "Different workflows serve different purposes. Here is what is available, what requires additional components, and what remains outside the current public scope.")}
      <div class="rn-ledger">
        ${CAPS.map(([tone, title, items, link, href]) => `<article class="rn-col rn-${tone}"><h3>${biE(title)}</h3><ul>${items.map((it) => `<li>${tone === "blocked" ? CROSS : CHECK}<span>${biE(it)}</span></li>`).join("")}</ul><a class="text-link" href="${href}">${biE(link)} ${ARROW}</a></article>`).join("\n        ")}
      </div>
    </div>
    <aside class="rn-principle" aria-labelledby="run-principle-title">
      <p class="kicker">${biE("Our principle")}</p>
      <blockquote id="run-principle-title">${bi("“Not just outputs, but evidence you can trust.”", esc(Z("“Not just outputs,") + Z("but evidence you") + Z("can trust.”")))}</blockquote>
      ${biPE("p", "", "We design TutorBench so benchmark conditions, evaluator boundaries, and artifacts can be inspected and reproduced. When evidence is unavailable, the system should fail closed rather than silently invent a valid score.")}
      <a class="text-link" href="../methodology/index.html">${biE("Read our methodology")} ${ARROW}</a>
    </aside>
  </section>

  <section class="rn-repro" aria-labelledby="run-repro-title">
    <div class="wrap rn-repro-in">
      <div class="rn-check">
        <p class="kicker">${biE("Make the run legible")}</p>
        <h2 id="run-repro-title" class="jx-h2">${biE("Reproducibility checklist")}</h2>
        ${biPE("p", "jx-p", "Record the following information with your results to make them easy to verify, replay, and compare.")}
        <ol class="rn-form">
          ${CHECKLIST.map(([t, d], i) => `<li><span class="rn-box" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span><b>${biE(t)}</b><small>${pairOf(d)}</small></span></li>`).join("\n          ")}
        </ol>
      </div>
      <figure class="rn-artifact" aria-labelledby="run-artifact-title">
        <div class="rn-sheet">
          <p class="rn-sheet-label">${esc(DATASET)}</p>
          <h3 id="run-artifact-title">${lines(["Structured cases", "for transparent evaluation."], "")}</h3>
          <ul>${CASE_IDS.map((id, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><code>${esc(id)}</code></li>`).join("")}${CASE_IDS.length ? "" : `<li><code>No public cases loaded</code></li>`}</ul>
          <p class="rn-more" aria-hidden="true">…</p>
        </div>
        <figcaption>${bi("Same cases.<br>Different Tutors.<br><em>Comparable evidence.</em>", `${esc(Z("Same cases."))}<br>${esc(Z("Different Tutors."))}<br><em>${esc(Z("Comparable evidence."))}</em>`)}</figcaption>
      </figure>
    </div>
  </section>

  <nav class="wrap rn-next" aria-labelledby="run-next-title">
    <div class="rn-sec-l"><p class="kicker">${biE("Go deeper")}</p><h2 id="run-next-title" class="jx-h2">${biE("Next steps")}</h2>${biPE("p", "rn-next-sub", "Explore related resources to go deeper.")}</div>
    <ul>
      ${NEXT_RUN.map(([t, s, h]) => `<li><a href="${h}"><b>${biE(t)}</b>${biPE("span", "", s)}${ARROW}</a></li>`).join("\n      ")}
    </ul>
  </nav>
</main>`;
  return frame({ prefix: "../", title: "Run — Teachometry", titleZh: Z("Run — Teachometry"), description: "Run TutorBench locally, diagnose real-world tutoring behavior, and preserve reproducible evidence for retesting.", body, current: "run", css: ["journal.css", "run.css"], scripts: ["run.js"] });
}

/* ------------------------------------------------------------------ Docs */

const CATS = { "getting-started": "Getting Started", "benchmark-data": "Benchmark & Data", "execution-evidence": "Execution & Evidence", "human-review": "Human Review", governance: "Governance" };
const NAV = [
  ["Getting Started", [["Overview", "#overview"], ["Quickstart", "#quickstart"], ["Run TutorBench", "../run/index.html"], ["README", repo("README.md"), 1]]],
  ["Benchmark & Data", [["TutorEval 0.2A", repo("docs/tutor-eval-v0.2a.md"), 1], ["Portable response corpus", repo("docs/tutor-eval-v0.4a.md"), 1], ["Methodology", "../methodology/index.html"], ["Public benchmark", "../data/index.html"], ["Cases", "../data/cases/index.html"]]],
  ["Execution & Evidence", [["Real-model baselines", repo("docs/real-model-baselines.md"), 1], ["Run workflows", "../run/index.html"], ["Models registry", "../models/index.html"], ["Results status", "../leaderboard/index.html"]]],
  ["Human Review", [["Community Review protocol", repo("docs/community-review-protocol.md"), 1], ["Participation application gate", repo("docs/community-review-application-gate.md"), 1], ["Community status", "../community/index.html"]]],
  ["Governance", [["Roadmap", repo("docs/roadmap.md"), 1], ["Licensing", repo("docs/licensing.md"), 1], ["Contributing", repo("CONTRIBUTING.md"), 1], ["Security", repo("SECURITY.md"), 1]]],
];
// [label, href, external, summary, category, path]
const INDEX = [
  ["README", repo("README.md"), 1, "Repository orientation, architecture, privacy, benchmark integrity, and current project boundaries.", "getting-started", "README.md"],
  ["TutorBench Quickstart", repo("docs/quickstart.md"), 1, "The provider-free, network-free, Judge-free five-minute development demonstration.", "getting-started", "docs/quickstart.md"],
  ["Run TutorBench", "../run/index.html", 0, "Public entry point for the Quickstart, benchmark, Tutor adapters, and evidence workflows.", "getting-started", "/run/"],
  ["TutorEval 0.2A", repo("docs/tutor-eval-v0.2a.md"), 1, "Synthetic case design, five observable-behavior dimensions, rubric semantics, and disclosure boundaries.", "benchmark-data", "docs/tutor-eval-v0.2a.md"],
  ["Portable response corpus", repo("docs/tutor-eval-v0.4a.md"), 1, "The generate → freeze → evaluate → annotate → calibrate lifecycle and portable corpus contract.", "benchmark-data", "docs/tutor-eval-v0.4a.md"],
  ["Methodology", "../methodology/index.html", 0, "How the public benchmark evaluates observable tutoring behavior and where evidence remains limited.", "benchmark-data", "/methodology/"],
  ["Public benchmark", "../data/index.html", 0, "A public view into the versioned dataset, coverage, and disclosure-safe benchmark artifacts.", "benchmark-data", "/data/"],
  ["Cases", "../data/cases/index.html", 0, "Browse the authored public cases without exposing evaluator-only answers or rubrics.", "benchmark-data", "/data/cases/"],
  ["Real-model baselines", repo("docs/real-model-baselines.md"), 1, "Separate Product Tutor and canonical model collection paths, with private preliminary evidence semantics.", "execution-evidence", "docs/real-model-baselines.md"],
  ["Models registry", "../models/index.html", 0, "The public model surface and its reserved evidence contract; no calibrated public profiles are implied.", "execution-evidence", "/models/"],
  ["Results status", "../leaderboard/index.html", 0, "Readiness and evidence status for public results, without inventing ranking rows or scores.", "execution-evidence", "/leaderboard/"],
  ["Frozen corpus semantic replay", repo("docs/frozen-corpus-semantic-replay.md"), 1, "Versioned replay boundaries for validating frozen evidence without silently changing its meaning.", "execution-evidence", "docs/frozen-corpus-semantic-replay.md"],
  ["Community Review protocol", repo("docs/community-review-protocol.md"), 1, "P3 contracts, blindness, qualification boundaries, freeze semantics, agreement limits, and P4 deployment-readiness status.", "human-review", "docs/community-review-protocol.md"],
  ["Participation application gate", repo("docs/community-review-application-gate.md"), 1, "The closed-to-open launch checklist and application contract; public application and reviewer intake remain closed.", "human-review", "docs/community-review-application-gate.md"],
  ["Community status", "../community/index.html", 0, "Public participation information without an application form, reviewer login, or live campaign claim.", "human-review", "/community/"],
  ["Roadmap", repo("docs/roadmap.md"), 1, "The current phase map for benchmark, Judge, Tutor integration, review, and public product work.", "governance", "docs/roadmap.md"],
  ["Licensing", repo("docs/licensing.md"), 1, "Separate software, authored benchmark-content, and TutorBench brand licensing scopes.", "governance", "docs/licensing.md"],
  ["Contributing", repo("CONTRIBUTING.md"), 1, "Contribution categories, local quality gates, benchmark-content proposals, and evidence boundaries.", "governance", "CONTRIBUTING.md"],
  ["Security", repo("SECURITY.md"), 1, "The public Developer Preview security policy and its current reporting boundary.", "governance", "SECURITY.md"],
];
// document names and licence names the live zh page also leaves in English
const KEEP = new Set(["README", "TutorEval 0.2A", "TutorBench Quickstart", "Portable response corpus", "Real-model baselines", "Participation application gate", "Apache-2.0", "CC BY 4.0", "TutorBench Brand Policy"]);
const N = (s) => (KEEP.has(s) ? s : Z(s));
const ext = (e) => (e ? ' rel="noreferrer"' : "");

const navGroups = (cur) => NAV.map(([g, items]) => `<section class="dc-nav-g"><h2 class="kicker">${biE(g)}</h2><ul>${items.map(([l, h, e]) => `<li><a href="${h}"${ext(e)}${cur && h === "#overview" ? ' aria-current="page"' : ""}>${biE(l, N(l))}${e ? OUT_ARROW : ""}</a></li>`).join("")}</ul></section>`).join("");

function entryPoint(title, summary, label, href, e = 0) {
  return `<a class="dc-entry" href="${href}"${ext(e)}><b>${biE(title)}</b>${biPE("span", "", summary)}<em>${biE(label)} ${e ? OUT_ARROW : ARROW}</em></a>`;
}
function codeBlock(label, rows) {
  return `<div class="term dc-term"><div class="term-bar"><span></span><span></span><span></span><p>${esc(label)}</p><span class="dc-lang">bash</span></div>
<pre><code>${rows.map(esc).join("\n")}</code></pre></div>`;
}
function indexEntry([label, href, e, summary, cat, path], i) {
  const search = [label, summary, CATS[cat], N(label), Z(summary), Z(CATS[cat]), path].join(" ");
  return `<article class="dc-card" data-doc-entry data-doc-category="${cat}" data-doc-search="${esc(search)}"><a href="${href}"${ext(e)}>
        <span class="dc-card-top"><span class="dc-card-no">${String(i + 1).padStart(2, "0")}</span><span class="dc-card-cat">${biE(CATS[cat])}</span></span>
        <b>${biE(label, N(label))}</b>${biPE("span", "dc-card-sum", summary)}
        <small class="dc-card-src">${e ? "GitHub" : "Teachometry"} · <span data-source-content>${esc(path)}</span>${e ? OUT_ARROW : ""}</small>
      </a></article>`;
}

const DIM_ZH = { Correctness: "正确性", Diagnosis: "诊断", Guidance: "引导", Adaptation: "适应", Actionability: "可执行性" };
const humanize = (v) => v.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function docsPage() {
  const dims = benchmark.dimensions.score.map(humanize);
  const BOUNDS = [
    ["Quickstart ≠ official benchmark score", "It is a deterministic development/smoke demonstration, not calibrated benchmark evidence."],
    ["Collection ≠ publication", "Product Tutor and canonical model corpora remain preliminary unless publication requirements are met."],
    ["Judge ≠ ground truth", "A Judge is an evaluator boundary. Unresolved criteria stay unresolved when required evidence is unavailable."],
    ["Human review ≠ automatic gold standard", "Human evidence can strengthen the method without becoming unquestionable ground truth."],
  ];
  const LIC = [
    ["Software", "Apache-2.0", "Read LICENSE", repo("LICENSE")],
    ["Benchmark content (authored)", "CC BY 4.0", "Read content license", repo("LICENSES/CC-BY-4.0.txt")],
    ["Name & visual assets", "TutorBench Brand Policy", "Read brand policy", repo("LICENSES/BRAND-POLICY.md")],
  ];
  const TOC = [["overview", "Overview"], ["quickstart", "Quickstart"], ["documentation-index", "Documentation index"], ["evidence-boundaries", "Evidence boundaries"], ["governance", "Governance"], ["next-steps", "Next steps"]];
  const T = DOC_COUNT_TEMPLATES;
  const body = `<main id="main" class="dc docs-page">
  <header class="dc-head">
    <figure class="dc-band" aria-hidden="true"><img src="../assets/run/labels.webp" alt="" width="1600" height="560"></figure>
    <div class="wrap dc-head-in">
      <div class="dc-head-copy">
        <p class="essay-meta kicker"><span class="issue">${biE("Documentation")}</span><span class="rule" aria-hidden="true"></span><span>${INDEX.length} ${bi("references", "条参考资料")}</span></p>
        <h1 class="essay-title" id="docs-title">${biE("Documentation")}</h1>
        ${biPE("p", "essay-dek", "Reference, setup, CLI, artifacts, and evaluation workflows.")}
        ${biPE("p", "dc-head-note", "Navigate TutorBench’s versioned repository guides and public reference surfaces.")}
      </div>
      <p class="dc-trace" aria-hidden="true">${bi("Evidence<br>you can<br><em>trace.</em>", esc(Zor("Evidence", "证据")) + esc(Z("you can")) + "<em>" + esc(Z("trace.")) + "</em>")}</p>
    </div>
    <div class="wrap">
      <div class="dc-controls">
        <form class="dc-search" role="search" ${attr2("aria-label", "Search documentation")}>
          <label for="docs-search-input" class="visually-hidden">${biE("Search documentation")}</label>
          ${SEARCH}
          <input id="docs-search-input" type="search" data-doc-search ${attr2("placeholder", "Search documentation…")} autocomplete="off">
          <button type="reset" data-doc-search-clear ${attr2("aria-label", "Clear documentation search")} hidden>${CROSS}</button>
        </form>
        <div class="dc-filters" role="group" ${attr2("aria-label", "Filter documentation by category")}>
          <button type="button" data-doc-category="all" aria-pressed="true">${biE("All docs")}</button>${Object.entries(CATS).map(([k, v]) => `<button type="button" data-doc-category="${k}" aria-pressed="false">${biE(v)}</button>`).join("")}
        </div>
      </div>
    </div>
  </header>

  <div class="wrap dc-work" aria-label="${esc("Documentation center")}">
    <details class="dc-mnav"><summary>${biE("Browse documentation navigation")}</summary><nav ${attr2("aria-label", "Mobile documentation navigation")}>${navGroups(true)}</nav></details>
    <nav class="dc-side" ${attr2("aria-label", "Documentation navigation")}>${navGroups(true)}</nav>

    <article class="dc-content">
      <p class="dc-crumbs kicker" ${attr2("aria-label", "Breadcrumb", "面包屑导航")}><a href="index.html">${biE("Docs")}</a><span aria-hidden="true">›</span><span>${biE("Reference center")}</span></p>

      <section class="dc-sec" id="overview" aria-labelledby="overview-title">
        <p class="dc-kick kicker">${biE("Getting Started / Overview")}</p>
        <h2 id="overview-title" class="jx-h2">${biE("Overview")}</h2>
        ${biPE("p", "jx-p", "TutorBench is provider-neutral measurement infrastructure for observable AI tutoring behavior. This page maps the public Teachometry surface to the repository contracts and guides that define setup, execution, artifacts, and interpretation.")}
        ${biPE("p", "dc-boundary-line", "The website is a map into the repository’s existing contracts and guides. It does not replace the source documentation.")}
        <dl class="dc-facts">
          <div><dt>${biE("Canonical snapshot")}</dt><dd><code>${esc(DATASET)}</code></dd></div>
          <div><dt>${biE("Public cases")}</dt><dd class="dc-num">${benchmark.dataset.caseCount}</dd></div>
          <div><dt>${biE("Score dimensions")}</dt><dd>${bi(esc(dims.join(" · ")), esc(dims.map((d) => Zor(d, DIM_ZH[d] ?? d)).join(" · ")))}</dd></div>
        </dl>
        <div class="dc-entries">
          ${entryPoint("Set up", "Start with the real five-minute path.", "Open Quickstart", "#quickstart")}
          ${entryPoint("Run evaluations", "Choose the workflow that matches your evidence.", "Open Run", "../run/index.html")}
          ${entryPoint("Work with artifacts", "Understand packets, corpora, and replay.", "Read 0.4A guide", repo("docs/tutor-eval-v0.4a.md"), 1)}
          ${entryPoint("Understand results", "Read the method before interpreting output.", "Read methodology", "../methodology/index.html")}
        </div>
      </section>

      <section class="dc-sec" id="quickstart" aria-labelledby="quickstart-title">
        <p class="dc-kick kicker">${biE("Getting Started / Quickstart")}</p>
        <h2 id="quickstart-title" class="jx-h2">${biE("Quickstart")}</h2>
        ${biPE("p", "jx-p", "Install the repository with Node 24, then run a deterministic local demonstration without provider credentials or network access.")}
        <p class="dc-runtime"><span class="kicker">${biE("Runtime requirement")}</span><b>Node 24</b><code>&gt;=24 &lt;25</code></p>
        ${releaseBoundary()}
        <div class="dc-codes">
          ${codeBlock("Repository main · Node 24", ["git clone https://github.com/shuangyan123/tutorbench.git", "cd tutorbench", "npm ci", "npm run quickstart"])}
          ${codeBlock("Published 0.1.0 · Node 22", ["npm install tutor-benchmark@0.1.0", "npx --no-install tutorbench quickstart"])}
        </div>
        <p class="callout dc-callout">${bi(
          `<strong>Provider-free, network-free, Judge-free.</strong> Quickstart uses four fixed development/smoke cases from <code>tutor-eval-v0.1@0.1</code>. It is not the canonical scoring cohort, produces no official benchmark score, and is not leaderboard eligible.`,
          `<strong>${esc(Z("Provider-free, network-free, Judge-free."))}</strong>${esc(Z("Quickstart uses four fixed development/smoke cases from"))}<code>tutor-eval-v0.1@0.1</code>${esc(Z(". It is not the canonical scoring cohort, produces no official benchmark score, and is not leaderboard eligible."))}`)}</p>
      </section>

      <section class="dc-sec" id="documentation-index" aria-labelledby="documentation-index-title">
        <div class="dc-index-head">
          <div>
            <p class="dc-kick kicker">${biE("Reference map")}</p>
            <h2 id="documentation-index-title" class="jx-h2">${biE("Documentation index")}</h2>
            ${biPE("p", "jx-p", "A curated route into the current repository. GitHub links open the source file; site links open the corresponding public surface.")}
          </div>
          <p class="dc-status kicker" data-doc-status data-tpl-all-en="${esc(T.en.all)}" data-tpl-all-zh="${esc(T["zh-CN"].all)}" data-tpl-f-en="${esc(T.en.filtered)}" data-tpl-f-zh="${esc(T["zh-CN"].filtered)}" aria-live="polite">${bi(esc(T.en.all.replaceAll("{count}", INDEX.length)), esc(T["zh-CN"].all.replaceAll("{count}", INDEX.length)))}</p>
        </div>
        <div class="dc-grid">
      ${INDEX.map(indexEntry).join("\n      ")}
        </div>
        <p class="dc-empty" data-doc-empty role="status" hidden>${biE("No documentation matches this search and category.")}</p>
      </section>

      <section class="dc-sec" id="evidence-boundaries" aria-labelledby="evidence-title">
        <p class="dc-kick kicker">${biE("Interpretation boundaries")}</p>
        <h2 id="evidence-title" class="jx-h2">${biE("Read the evidence carefully.")}</h2>
        ${biPE("p", "jx-p", "These distinctions keep a useful development surface from making claims the repository does not support.")}
        <div class="dc-neq">
          ${BOUNDS.map(([h, p]) => { const [a, b] = h.split(" ≠ "); const [za, zb] = Z(h).split(/\s*≠\s*/); return `<article><h3>${bi(`${esc(a)} <i>≠</i> ${esc(b)}`, `${esc(za)} <i>≠</i> ${esc(zb ?? "")}`)}</h3>${biPE("p", "", p)}</article>`; }).join("\n          ")}
        </div>
      </section>

      <section class="dc-sec dc-gov" id="governance" aria-labelledby="governance-title">
        <p class="dc-kick kicker">${biE("Governance & contribution")}</p>
        <h2 id="governance-title" class="jx-h2">${biE("Defined boundaries for an open repository.")}</h2>
        ${biPE("p", "jx-p", "Software, authored benchmark content, and the TutorBench name have deliberately separate scopes. Contributions can propose software, cases, rubrics, methodology, documentation, adapters, website changes, and calibration/audit infrastructure.")}
        <p class="dc-status-note">${bi(`<strong>Community status:</strong> public participation information is available; public applications, reviewer intake, and a real Community Review campaign have not started.`, `<strong>${esc(Z("Community status:"))}</strong>${esc(Z("public participation information is available; public applications, reviewer intake, and a real Community Review campaign have not started."))}`)}</p>
        <dl class="dc-lic">
          ${LIC.map(([k, v, l, h]) => `<div><dt class="kicker">${biE(k)}</dt><dd><b>${biE(v, N(v))}</b><a class="text-link" href="${h}" rel="noreferrer">${biE(l)} ${OUT_ARROW}</a></dd></div>`).join("\n          ")}
        </dl>
        <p class="dc-gov-links"><a class="text-link" href="${repo("docs/licensing.md")}" rel="noreferrer">${biE("Licensing scope")} ${OUT_ARROW}</a><a class="text-link" href="${repo("CONTRIBUTING.md")}" rel="noreferrer">${biE("Contributing")} ${OUT_ARROW}</a><a class="text-link" href="${repo("SECURITY.md")}" rel="noreferrer">${biE("Security Policy")} ${OUT_ARROW}</a></p>
        ${biPE("p", "dc-fine", "The Security Policy does not enable GitHub Private Vulnerability Reporting and does not invent a private reporting address.")}
      </section>

      <section class="dc-sec" id="next-steps" aria-labelledby="next-steps-title">
        <p class="dc-kick kicker">${biE("Continue the reference path")}</p>
        <h2 id="next-steps-title" class="jx-h2">${biE("Next steps")}</h2>
        ${biPE("p", "jx-p", "Move from orientation to the repository surface that matches your question.")}
        <div class="dc-entries">
          ${entryPoint("Run TutorBench", "Start with the provider-free path.", "Open Run", "../run/index.html")}
          ${entryPoint("Read methodology", "Understand dimensions and evaluator boundaries.", "Read methodology", "../methodology/index.html")}
          ${entryPoint("Browse public data", "Inspect cases and public artifact context.", "Open benchmark", "../data/index.html")}
          ${entryPoint("Browse repository docs", "Read the versioned source guides.", "View GitHub", GITHUB, 1)}
        </div>
      </section>
    </article>

    <aside class="dc-toc" ${attr2("aria-label", "On this page")}>
      <p class="kicker">${biE("On this page")}</p>
      <nav>${TOC.map(([id, l], i) => `<a href="#${id}"${i === 0 ? ' aria-current="true"' : ""}>${biE(l)}</a>`).join("")}</nav>
      <div class="dc-toc-note"><b>${biE("Reference, not replacement.")}</b>${biPE("p", "", "Source files remain the authority for contracts, commands, and status.")}</div>
    </aside>
  </div>

  <section class="jx-close dc-close" aria-labelledby="docs-closing-title">
    <div class="wrap">
      <p class="kicker">${biE("Still looking?")}</p>
      <h2 id="docs-closing-title" class="jx-h2">${biE("Find more in the guides, methodology, or repository.")}</h2>
      <p class="cx-actions"><a class="cta cta-line" href="${GITHUB}" rel="noreferrer">${biE("Browse repository docs")} ${OUT_ARROW}</a><a class="cta cta-ink" href="../run/index.html">${biE("Run TutorBench")} ${ARROW}</a></p>
    </div>
  </section>
</main>`;
  return frame({ prefix: "../", title: "Docs — Teachometry", titleZh: Z("Docs — Teachometry"), description: "Repository documentation for TutorBench setup, benchmark contracts, execution workflows, evidence boundaries, and governance.", body, current: "docs", css: ["journal.css", "run.css"], scripts: ["run.js"] });
}

const out = (rel, html) => { const f = join(PROTO, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, html); };
out("run/index.html", runPage());
out("docs/index.html", docsPage());
if (globalThis.__zmiss?.size) process.stdout.write(`missing zh:\n  ${[...globalThis.__zmiss].join("\n  ")}\n`);
process.stdout.write("run + docs: two pages\n");
