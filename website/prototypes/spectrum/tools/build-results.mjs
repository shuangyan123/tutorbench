// Builds the Results section of the Spectrum prototype, in English and 简体中文 on one page each:
//   leaderboard/index.html     Results: not yet published, the future leaderboard schema, readiness,
//                              how to read future results, the schema-only result view
//   models/index.html          the model registry: empty, with the profile contract it must carry
//   models/profile/index.html  the reserved model dossier (live route /models/[modelId]/)
//   data/trials/index.html     the trial ledger: empty, with the trial field families
// It mirrors renderLeaderboardPage / renderModelsPage / renderModelDetailPage (src/site/pages/overview.ts)
// and renderTrialsPage (src/site/pages/data.ts) and reads the same public artifacts. No score, rank or
// model appears anywhere: every value cell is a dash until a public, versioned run exists.
// usage (from the repo root, after `npm run build` and `npm run website:build`):
//   node website/prototypes/spectrum/tools/build-results.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";
import { PROTO, REPO, esc, Z, Zor, bi, biE, biP, biPE, frame, RENDERED } from "./site-kit.mjs";

const L = await import(join(REPO, "dist/src/site/public-localization.js"));
const F = await import(join(REPO, "dist/src/site/public-localization-formatters.js"));
const { PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS: TRACE } = await import(join(REPO, "dist/src/datasets/public.js"));
const read = (f) => JSON.parse(readFileSync(join(REPO, "website/dist/public-data", f), "utf8"));
const benchmark = read("benchmark.json"), models = read("models.json"), trials = read("trials.json");
const GITHUB = "https://github.com/shuangyan123/tutorbench";
const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
const COHORT = `${benchmark.dataset.id}@${benchmark.dataset.version}`;
const DASH = "—";

/** both languages from a live helper that takes a locale */
const both = (fn) => bi(esc(fn("en")), esc(fn("zh-CN")));
/** the live zh, or ours where the live site leaves an English label untranslated */
const G = (en, zh) => biE(en, Zor(en, zh));
const tax = (v) => bi(esc(L.displayTaxonomyLabel(v, "en")), esc(L.displayTaxonomyLabel(v, "zh-CN")));
const evidence = (k) => both((l) => L.publicEvidenceCopy(k, l));
const notice = (n) => both((l) => L.publicArtifactNotice(n, l));

const FIELD = {
  rank: "#", model: "Model", provider: "Provider", modelVersion: "Model version", overallTutorCapabilityScore: "Overall",
  correctness: "Correctness", diagnosis: "Diagnosis", guidance: "Guidance", adaptation: "Adaptation", actionability: "Actionability",
  cost: "Cost", latencyMs: "Latency", tokens: "Tokens", datasetVersion: "Dataset cohort", generationSpecId: "Generation spec ID",
  generationSpecVersion: "Generation spec version", promptVersion: "Prompt version", promptId: "Prompt ID", promptSha256: "Prompt SHA-256",
  maxOutputTokens: "Max output tokens", runs: "Runs",
};
const MODEL_FIELD = { ...FIELD, modelVersion: "Snapshot / version", criticalFailureRate: "Critical-failure rate", answerLeakageRate: "Answer-leakage rate", promptId: "Prompt identity", runs: "Trial runs" };
const fl = (map, f) => G(map[f] ?? f, map[f] ?? f);

// ---------------------------------------------------------------- results
function table() {
  const mf = new Set(models.fields);
  const cols = [["rank"], ["model"], ["overallTutorCapabilityScore", "↑"], ...benchmark.dimensions.score.map((d) => [d]),
    ...(mf.has("cost") ? [["cost", "USD / 1K"]] : []), ...(mf.has("latencyMs") ? [["latencyMs", "s"]] : []), ["benchmarkVersion"],
    ...(mf.has("promptVersion") ? [["promptVersion"]] : []), ...(mf.has("datasetVersion") ? [["datasetVersion"]] : [])];
  const label = (k) => (k === "benchmarkVersion" ? biE("Benchmark version") : k === "rank" ? "#" : fl(FIELD, k));
  return `<div class="tbl-wrap rs-table-wrap" tabindex="0" aria-label="Scrollable future leaderboard schema">
        <table class="rs-table" data-result-schema="future-public-leaderboard">
          <caption>${biE("Future public model leaderboard schema")}</caption>
          <thead><tr>${cols.map(([k, unit]) => `<th scope="col" data-schema-field="${k}"${k === "model" ? ' class="rs-model"' : ""}><span>${label(k)}</span>${unit ? `<small>${esc(unit)}</small>` : ""}</th>`).join("")}</tr></thead>
          <tbody>
            <tr class="rs-ghost" aria-hidden="true">${cols.map(([k]) => `<td${k === "model" ? ' class="rs-model"' : ""}>${DASH}</td>`).join("")}</tr>
            <tr><td colspan="${cols.length}"><div class="rs-empty"><b>${biE("No public model rows are available yet.")}</b><p>${notice(models.notice)} ${evidence("syntheticNotRanking")}</p></div></td></tr>
          </tbody>
        </table>
      </div>
      <p class="rs-swipe">${biE("Swipe horizontally to inspect the future schema. No result values are published in this preview.")}</p>`;
}

function readiness() {
  const c = benchmark.calibration, avail = c.infrastructure === "available";
  const human = c.independentHumanCalibration !== "not_completed", judge = c.judgeVsHumanValidation !== "not_completed", stat = c.statisticalValidation !== "not_completed";
  const rows = [
    ["Evaluation infrastructure", avail ? "Available" : "Not available", "Benchmark, evaluators, and scoring pipeline are available.", avail ? "ok" : "wait"],
    ["Calibration infrastructure", avail ? "Available" : "Not available", "Tools and workflows for calibration are in place.", avail ? "ok" : "wait"],
    ["Community Review infrastructure", "Private staging ready", "Public launch remains blocked; reviewer intake remains closed, and the real Community Review campaign has not started.", "part"],
    ["Human calibration (P5)", human ? "In progress" : "Not started", "No real human calibration data is available yet.", human ? "part" : "wait"],
    ["Judge-vs-human validation", judge ? "Completed" : "Not completed", "A Judge result is not presented as human-reference validation.", judge ? "ok" : "wait"],
    ["Statistical validation", stat ? "Completed" : "Not completed", "No statistical validation claim is made for the current benchmark.", stat ? "ok" : "wait"],
  ];
  return `<ol class="rs-ready">${rows.map(([t, s, d, tone], i) => `<li class="rs-${tone}"><span class="rs-step">${i + 1}</span><div><b>${biE(t)}</b><p>${biE(d)}</p></div><span class="rs-chip">${biE(s)}</span></li>`).join("")}</ol>`;
}

function guide() {
  const dims = benchmark.dimensions.score;
  const traceLabel = (l) => TRACE.map((f) => (l === "zh-CN" ? Zor(FIELD[f], FIELD[f]) : FIELD[f]));
  const items = [
    ["Same benchmark, same version", both((l) => L.formatModelComparison(benchmark.dataset.version, traceLabel(l), l))],
    ["Context matters", biE("Results belong to specific authored cases and benchmark scope. Model family, snapshot, access method, and generation identity must stay visible.")],
    ["Not a universal ranking", evidence("classroomBoundary")],
    ["Multiple dimensions", both((l) => L.formatDimensionReadingGuide(dims.map((d) => L.displayTaxonomyLabel(d, l)), l))],
    ["Reproducible and auditable", biE("Future results should remain tied to public, versioned artifacts and traceability data.")],
  ];
  return `<aside class="rs-guide" aria-labelledby="guide-title">
        <h2 id="guide-title" class="jx-h2">${biE("How to read future results")}</h2>
        <p class="rs-guide-lede">${biE("When results are available, keep the following in mind:")}</p>
        <ol>${items.map(([t, d]) => `<li><b>${biE(t)}</b><span>${d}</span></li>`).join("")}</ol>
      </aside>`;
}

function contract() {
  const subjects = Object.keys(benchmark.coverage.casesBySubject).slice(0, 3);
  const caps = Object.keys(benchmark.coverage.casesByCapabilityTag).slice(0, 3);
  const ops = ["cost", "latencyMs", "tokens"].filter((f) => benchmark.dimensions.operational.includes(f));
  const trace = ["Provider snapshot", "Model version", "Benchmark version", "Prompt version", "Dataset cohort", "GenerationSpecId", "Execution identity"];
  const row = (k, v = DASH) => `<li><span>${k}</span><b>${v}</b></li>`;
  const panel = (t, rows, note = "") => `<section><h4 class="kicker">${biE(t)}</h4><ul>${rows}</ul>${note}</section>`;
  return `<article class="rs-contract" aria-label="Future public model result contract">
        <header><p class="kicker">${biE("Model result contract")}</p><h3>${biE("Future public model result")}</h3><p>${biE("Versioned model identity and evidence fields; no public row is available yet.")}</p></header>
        <dl class="rs-scores"><div class="rs-overall"><dt>${biE("Overall")}</dt><dd>${DASH}</dd></div>${benchmark.dimensions.score.map((d, i) => `<div><dt><img src="../assets/gems/gem-${i}.webp" alt="" width="96" height="96">${fl(FIELD, d)}</dt><dd>${DASH}</dd></div>`).join("")}</dl>
        <div class="rs-panels">
          ${panel("Subject breakdown", subjects.map((s) => row(tax(s))).join(""))}
          ${panel("Capability breakdown", caps.map((s) => row(tax(s))).join(""))}
          ${panel("Efficiency", ops.map((f) => row(fl(FIELD, f))).join(""))}
          ${panel("Metadata & traceability", trace.map((t) => row(G(t, t), t === "Benchmark version" ? esc(benchmark.benchmarkVersion) : t === "Dataset cohort" ? `<code>${esc(COHORT)}</code>` : DASH)).join(""),
            `<p class="rs-note">${models.fields.includes("generationSpecId") ? biE("Generation identity and execution fields remain part of the future public contract.") : biE("Additional traceability fields will follow the public artifact contract.")}</p>`)}
        </div>
      </article>`;
}

function resultsPage(cover) {
  const body = `<main id="main">
  <header class="essay-head rs-head">
    <div class="wrap essay-grid">
      <div>
        <p class="essay-meta kicker"><span class="issue">${biE("Results")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(COHORT)}</span></p>
        <h1 class="essay-title">${bi("Results,<br>with the <em>context</em> intact.", `${esc(Z("Results,"))}<br>${esc(Z("with the"))}<em>${esc(Z("context"))}</em>${esc(Z("intact."))}`)}</h1>
        ${biPE("p", "essay-dek", "Teachometry will publish benchmark results after the evaluation corpus, calibration, and validation processes are complete. We prioritize trustworthy, reproducible, and well-contextualized results over premature rankings.")}
        <p class="cx-actions"><a class="cta cta-ink" href="../methodology/index.html">${biE("Read the methodology")} ${ARROW}</a><a class="cta cta-line" href="../data/index.html">${biE("Explore the benchmark")}</a></p>
        <p class="rs-notes">${bi("Evidence<br>over hype.", `${esc(Z("Evidence"))}<br>${esc(Z("over hype."))}`)}<span aria-hidden="true"></span>${bi("A more transparent future<br>for AI tutoring.", "让 AI 教学拥有<br>更透明的未来。")}</p>
      </div>
      <figure class="cover-plate">
        <img src="../assets/results/${cover.file}" alt="${esc(cover.alt[0])}" width="900" height="1100" data-alt-en="${esc(cover.alt[0])}" data-alt-zh="${esc(cover.alt[1])}">
        <figcaption class="kicker"><b>${bi("Cover", "封面")}</b> · ${bi(esc(cover.cap[0] + " " + RENDERED[0]), esc(cover.cap[1] + RENDERED[1]))}</figcaption>
      </figure>
    </div>
  </header>

  <section class="rs-band" aria-labelledby="status-title">
    <div class="wrap rs-band-in">
      <div>
        <p class="kicker">${biE("Public benchmark results")}</p>
        <h2 id="status-title">${biE("Not yet published.")}</h2>
        <p>${evidence("rankingsUnavailable")} ${notice(models.notice)} ${evidence("incompleteValidation")}</p>
      </div>
      <p class="rs-principle">${bi("No ranking without evidence.<br>No score without context.", `${esc(Z("No ranking without evidence."))}<br>${esc(Z("No score without context."))}`)}</p>
    </div>
  </section>

  <section class="wrap rs-sec" aria-labelledby="schema-title">
    <h2 id="schema-title" class="jx-h2">${biE("Future leaderboard schema")}</h2>
    <p class="jx-p">${biE("The table below shows the structure of the future public leaderboard.")} ${biE("It illustrates what information will be reported for each model. No model results are shown yet.")}</p>
    ${table()}
  </section>

  <section class="wrap rs-sec rs-two" aria-labelledby="ready-title">
    <div>
      <h2 id="ready-title" class="jx-h2">${biE("Readiness and evidence status")}</h2>
      ${biPE("p", "jx-p", "We follow a staged process to ensure that public results are meaningful and trustworthy.")}
      ${readiness()}
    </div>
    ${guide()}
  </section>

  <section class="wrap rs-sec rs-two rs-preview" aria-labelledby="preview-title">
    <div>
      <h2 id="preview-title" class="jx-h2">${biE("Example result view (preview)")}</h2>
      ${biPE("p", "jx-p", "This schema-only preview shows how individual model results will be presented.")}
      ${contract()}
    </div>
    <aside class="rs-interp" aria-labelledby="interp-title">
      <p class="kicker">${biE("Interpretation")}</p>
      <h2 id="interp-title" class="cd-h2">${biE("A note on interpretation")}</h2>
      ${biPE("p", "", "Teachometry evaluates observable tutoring behavior in structured, authored benchmark cases. It does not currently measure long-term learner outcomes, retention, transfer, student satisfaction, or real classroom teaching effectiveness.")}
      <a class="text-link" href="../methodology/index.html#scope">${biE("Learn more about our methodology")} ${ARROW}</a>
      <p class="rs-quote">${bi("Better<br>evidence for a<br>brighter future.", `${esc(Z("Better"))}<br>${esc(Z("evidence for a"))}<br>${esc(Z("brighter future."))}`)}</p>
    </aside>
  </section>

  <section class="wrap jx-close rs-close">
    <p class="kicker">${biE("Our commitment")}</p>
    <h2 class="jx-h2">${bi("No ranking without evidence.<br><em>No score without context.</em>", `${esc(Z("No ranking without evidence."))}<br><em>${esc(Z("No score without context."))}</em>`)}</h2>
    ${biPE("p", "jx-p", "We are building an open, transparent, and community-driven benchmark for AI tutoring. Thank you for your interest and support.")}
    <p class="jx-links"><a href="../methodology/index.html#status">${biE("Follow our progress")}</a><a href="../models/index.html">${biE("Models")}</a><a href="../data/trials/index.html">${G("Trials", "评测记录")}</a><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../", title: "Results — Teachometry", titleZh: `${Z("Results")} — Teachometry`, description: "Transparent, versioned benchmark results with evidence and context. Public model rankings are not available yet.", body, current: "results", css: ["journal.css", "results.css"] });
}

// ---------------------------------------------------------------- models
function contractRows() {
  const mf = new Set(models.fields);
  const pick = (list) => list.filter((f, i, a) => mf.has(f) && a.indexOf(f) === i);
  return {
    identity: pick(["model", "provider", "modelVersion"]),
    evaluation: pick(["overallTutorCapabilityScore", ...benchmark.dimensions.score, ...benchmark.dimensions.operational]),
    traceability: pick([...TRACE, "promptId", "promptSha256", "maxOutputTokens", "runs"]),
  };
}
const schemaRows = (rows) => rows.map(([f, v, note]) => `<div data-schema-field="${f}"><dt>${fl(MODEL_FIELD, f)}</dt><dd>${v ?? DASH}</dd>${note ? `<small>${note}</small>` : ""}</div>`).join("");
const schemaPanel = (title, desc, rows) => `<section class="md-panel"><p class="kicker">${biE(title)}</p><p class="md-desc">${biE(desc)}</p><dl>${schemaRows(rows)}</dl></section>`;

function modelsPage() {
  const r = contractRows(), n = models.entries.length;
  const status = [
    ["Public model artifact / schema", models.fields.length ? "Available" : "Not available", biE("The public contract is defined; entries remain empty.")],
    ["Calibrated public model runs", models.available ? null : "None", biE(models.notice)],
    ["Public model profiles", n ? null : "None", biE("Profiles require identity plus traceable evidence.")],
    ["Official public rankings", "None", biE("Results / Leaderboard remains the ranking surface.")],
    ["Human calibration", benchmark.calibration.independentHumanCalibration === "not_completed" ? "Not completed" : benchmark.calibration.independentHumanCalibration, biE("No human reference set is available.")],
    ["Judge-vs-human validation", benchmark.calibration.judgeVsHumanValidation === "not_completed" ? "Not completed" : benchmark.calibration.judgeVsHumanValidation, biE("No validation claim is made.")],
    ["Statistical validation", benchmark.calibration.statisticalValidation === "not_completed" ? "Not completed" : benchmark.calibration.statisticalValidation, biE("No statistical validation claim is made.")],
  ];
  const principles = [["Evidence-first", "Profiles are derived from structured, versioned artifacts."], ["Traceable", "Keep the model, cohort, generation identity, and trials attached."], ["Not a ranking", "A profile is an evidence record, not a claim of superiority."]];
  const body = `<main id="main">
  <header class="essay-head md-head">
    <div class="wrap md-head-grid">
      <div>
        <nav class="cd-crumbs kicker" aria-label="Breadcrumb"><a href="../leaderboard/index.html">${biE("Results")}</a><span aria-hidden="true">›</span><span aria-current="page">${biE("Models")}</span></nav>
        <h1 class="essay-title">${bi("A transparent catalog<br>of <em>model evidence</em><br>for AI tutoring.", "面向 AI 教学的<br>透明<em>模型<br>证据目录</em>。")}</h1>
        ${biPE("p", "essay-dek", "Public model profiles will be derived from versioned benchmark result artifacts. Each profile keeps model identity, execution context, benchmark cohort, and traceable evidence attached.")}
        <p class="cx-actions"><a class="cta cta-ink" href="#profile-contract">${biE("See the profile contract")} ${ARROW}</a><a class="cta cta-line" href="../methodology/index.html">${biE("Read the methodology")}</a></p>
        <p class="md-boundary">${notice(models.notice)} ${evidence("profileBoundary")}</p>
      </div>
      <aside class="md-rail" aria-label="Model evidence principles">
        <p class="md-motto">${bi("Identity.<br>Context.<br><em>Evidence.</em>", `${esc(Z("Identity."))}<br>${esc(Z("Context."))}<br><em>${esc(Z("Evidence."))}</em>`)}</p>
        <ol>${principles.map(([t, d]) => `<li><b>${biE(t)}</b><span>${biE(d)}</span></li>`).join("")}</ol>
      </aside>
    </div>
  </header>

  <section class="wrap md-tools" aria-label="Public model registry controls">
    <div class="md-toolbar">
      <span class="kicker">${biE("Filter models")}</span>
      <select disabled aria-label="Provider filter"><option>${esc("All providers")}</option></select>
      <select disabled aria-label="Model type filter"><option>${esc("All model types")}</option></select>
      <select disabled aria-label="Evidence status filter"><option>${esc("Evidence status")}</option></select>
      <input type="search" disabled placeholder="Search models…" aria-label="Search models">
    </div>
    <p class="md-tools-note">${both((l) => F.formatPublicCount(n, "publicModels", l))} · ${bi("Filters become available when public model profiles exist.", "有公开模型档案后开放筛选")}</p>
  </section>

  <section class="wrap md-registry" aria-labelledby="registry-title">
    <div class="md-registry-head"><div><p class="kicker">${biE("Model registry")}</p><h2 id="registry-title" class="jx-h2">${biE("Model identity and evidence")}</h2></div><span class="rs-chip">${both((l) => F.formatPublicCount(n, "publicProfiles", l))}</span></div>
    <div class="md-registry-body">
      <div class="md-empty">
        <p class="kicker">${biE("No public profiles")}</p>
        <h3>${biE("No public model profiles yet.")}</h3>
        <p>${biE(models.notice)}</p>
        <p>${biE("A profile will appear only when model identity, snapshot/version, benchmark cohort, generation identity, and traceable trial records are available in a public artifact.")}</p>
        <a class="text-link" href="../leaderboard/index.html">${biE("View Results status")} ${ARROW}</a>
      </div>
      <article id="profile-contract" class="md-contract" aria-labelledby="contract-title">
        <header><p class="kicker">${biE("Future profile contract")}</p><h3 id="contract-title">${biE("What a public model profile must carry")}</h3><p>${biE("Schema labels show the evidence boundary. Dashes are placeholders, not model results.")}</p></header>
        <dl class="md-context">${schemaRows([["benchmarkVersion", esc(benchmark.benchmarkVersion), biE("Registry context only; no model run is implied.")], ["datasetVersion", `<code>${esc(COHORT)}</code>`, biE("The cohort a future public artifact must identify.")]])}</dl>
        <div class="md-panels">
          ${schemaPanel("Identity", "Identity is only publishable when it resolves to a versioned artifact.", r.identity.map((f) => [f]))}
          ${schemaPanel("Evaluation evidence", "Scores appear only when valid result records and their evaluation context are public.", r.evaluation.map((f) => [f]))}
          ${schemaPanel("Traceability", "Generation and trial identity keep a profile auditable and comparable.", r.traceability.map((f) => [f]))}
        </div>
        <p class="rs-note">${biE("Future strengths and weaknesses may be derived from stored category metrics, failure rates, and verified result evidence—not from a free-form post-hoc AI summary.")}</p>
      </article>
    </div>
  </section>

  <section class="wrap rs-sec rs-two md-interp" aria-labelledby="approach-title">
    <article>
      <p class="kicker">${biE("Our approach")}</p>
      <h2 id="approach-title" class="jx-h2">${bi("Comparable evidence,<br><em>not claims.</em>", `${esc(Z("Comparable evidence,"))}<br><em>${esc(Z("not claims."))}</em>`)}</h2>
      <p class="jx-p">${evidence("profileInterpretation")}</p>
      <a class="text-link" href="../methodology/index.html#scope">${biE("Read the methodology")} ${ARROW}</a>
    </article>
    <article>
      <p class="kicker">${biE("Current model-publication status")}</p>
      <h2 class="jx-h2">${biE("Evidence before conclusions.")}</h2>
      ${biPE("p", "jx-p", "There are no calibrated public model runs or public profiles yet. The registry stays empty until the publication boundary is met.")}
      <dl class="md-status">${status.map(([k, v, note]) => `<div><dt>${biE(k)}</dt><dd><b>${v === null ? both((l) => F.formatPublicCount(n, "available", l)) : biE(v)}</b><small>${note}</small></dd></div>`).join("")}</dl>
    </article>
  </section>

  <section class="wrap jx-close">
    <p class="kicker">${biE("Looking ahead")}</p>
    <h2 class="jx-h2">${biE("Better evidence before more conclusions.")}</h2>
    ${biPE("p", "jx-p", "The registry will grow only from public, versioned artifacts that satisfy the project’s publication and traceability boundaries.")}
    <p class="jx-links"><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")}</a><a href="../leaderboard/index.html">${biE("View Results status")}</a><a href="profile/index.html">${G("Model profile contract", "模型档案契约")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../", title: "Models — Teachometry", titleZh: `${Z("Models")} — Teachometry`, description: "A transparent registry for model identity, benchmark context, and traceable public evidence.", body, current: "results", css: ["journal.css", "results.css"] });
}

function profilePage() {
  const r = contractRows();
  const until = biE("— until a real public artifact resolves this route.");
  const ctx = [["benchmarkVersion", esc(benchmark.benchmarkVersion), biE("Registry context only; this does not show a model execution.")], ["datasetVersion", `<code>${esc(COHORT)}</code>`, biE("Required cohort identity for a future public artifact.")],
    ...r.traceability.filter((f) => f !== "datasetVersion").map((f) => [f, DASH, until])];
  const body = `<main id="main">
  <header class="essay-head md-head">
    <div class="wrap md-head-grid">
      <div>
        <nav class="cd-crumbs kicker" aria-label="Breadcrumb"><a href="../index.html">${biE("Back to Models")}</a></nav>
        <p class="essay-meta kicker"><span class="issue">${biE("Model profile contract")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">/models/[modelId]/</span></p>
        <h1 class="essay-title">${biE("No model selected")}</h1>
        ${biPE("p", "essay-dek", "This route is reserved for future public result artifacts. No model identity, score, strength, weakness, or trial is inferred until a real versioned artifact resolves the route.")}
        <p class="cx-actions"><a class="cta cta-ink" href="../index.html#profile-contract">${biE("View the profile contract")} ${ARROW}</a><a class="cta cta-line" href="../../leaderboard/index.html">${biE("View Results status")}</a></p>
      </div>
      <aside class="md-card"><p class="kicker">${biE("No public model dossier")}</p><p>${biE(models.notice)}</p></aside>
    </div>
  </header>

  <section class="wrap md-registry" aria-labelledby="dossier-title">
    <div class="md-registry-head"><div><p class="kicker">${biE("Evidence dossier")}</p><h2 id="dossier-title" class="jx-h2">${biE("Schema-only profile")}</h2></div><span class="rs-chip">${biE("Future result contract")}</span></div>
    ${biPE("p", "jx-p", "The fields below describe what a resolved public profile must contain. Placeholder dashes are intentional and do not represent current result data.")}
    <div class="md-panels md-dossier">
      ${schemaPanel("Identity", "A selected model must resolve from a stored public identity and snapshot.", [["model"], ["provider"], ["modelVersion"]])}
      <section class="md-panel"><p class="kicker">${biE("Benchmark context")}</p><p class="md-desc">${biE("These values describe the current registry environment, not a model run.")}</p><dl>${schemaRows(ctx)}</dl></section>
      ${schemaPanel("Result dimensions", "Scores remain unavailable until verified public trials and evaluation evidence exist.", [["overallTutorCapabilityScore"], ...benchmark.dimensions.score.map((d) => [d])])}
    </div>
    <aside class="callout boundary md-trials"><p class="kicker">${biE("Trials")}</p><h3>${biE("No public model trials available yet.")}</h3><p>${notice(trials.notice)} ${evidence("trialAuditPath")}</p><a class="text-link" href="../../data/trials/index.html">${biE("See the trial contract")} ${ARROW}</a></aside>
  </section>

  <section class="wrap rs-sec rs-two" aria-labelledby="boundary-title">
    <div>
      <p class="kicker">${biE("Publication boundary")}</p>
      <h2 id="boundary-title" class="jx-h2">${biE("Profiles appear when the evidence is ready.")}</h2>
      ${biPE("p", "jx-p", "A model profile does not automatically imply leaderboard inclusion, a calibrated score, an official ranking, general model quality, or real classroom teaching effectiveness.")}
    </div>
    <ol class="md-checks">${["Identity, snapshot, cohort, and generation context stay attached.", "Strengths and weaknesses come from stored metrics and failure evidence.", "Free-form post-hoc AI summaries do not become evidence."].map((t) => `<li>${biE(t)}</li>`).join("")}</ol>
  </section>

  <section class="wrap jx-close">
    <p class="kicker">${biE("Looking ahead")}</p>
    <h2 class="jx-h2">${biE("Better evidence before more conclusions.")}</h2>
    ${biPE("p", "jx-p", "The registry will grow only from public, versioned artifacts that satisfy the project’s publication and traceability boundaries.")}
    <p class="jx-links"><a href="${GITHUB}" rel="noreferrer">${biE("View on GitHub")}</a><a href="../../methodology/index.html">${biE("Read the methodology")}</a><a href="../../leaderboard/index.html">${biE("View Results status")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../../", title: "Model Detail — Teachometry", titleZh: `${Zor("Model Detail", "模型档案")} — Teachometry`, description: "Reserved evidence dossier route for future public model result artifacts.", body, current: "results", css: ["journal.css", "results.css"] });
}

// ---------------------------------------------------------------- trials
const TRIAL_FIELD = { model: "Model identity", modelVersion: "Model version", datasetVersion: "Dataset version", generationSpecId: "Generation spec ID", generationSpecVersion: "Generation spec version", promptVersion: "Prompt version", promptSha256: "Prompt SHA-256", caseVersion: "Case version", runIndex: "Run index", tutorResponse: "Tutor response", correctness: "Correctness", diagnosis: "Diagnosis", guidance: "Guidance", adaptation: "Adaptation", actionability: "Actionability", rubricResults: "Rubric results", criticalFailures: "Critical failures", answerLeakage: "Answer leakage", judge: "Judge", judgePromptVersion: "Judge prompt version", tokens: "Tokens", latency: "Latency", cost: "Cost" };
const FAMILIES = [
  ["Identity & execution", "The versioned identities that make a run addressable.", ["model", "modelVersion", "datasetVersion", "caseVersion", "runIndex"]],
  ["Generation traceability", "The configuration references needed to reproduce generation.", ["generationSpecId", "generationSpecVersion", "promptVersion", "promptSha256"]],
  ["Tutor evidence", "The complete public Tutor response for the case.", ["tutorResponse"]],
  ["Evaluation evidence", "Dimension results and failure evidence attached to the response.", ["correctness", "diagnosis", "guidance", "adaptation", "actionability", "rubricResults", "criticalFailures", "answerLeakage"]],
  ["Judge evidence", "The evaluator identity and prompt version, when published.", ["judge", "judgePromptVersion"]],
  ["Operational metrics", "Sanitized run signals kept distinct from pedagogical scores.", ["tokens", "latency", "cost"]],
];
function trialsPage() {
  const fs = new Set(trials.fields), seen = new Set();
  const fams = FAMILIES.map(([t, d, list]) => [t, d, list.filter((f) => fs.has(f))]).filter(([, , p]) => p.length);
  fams.forEach(([, , p]) => p.forEach((f) => seen.add(f)));
  const extra = trials.fields.filter((f) => !seen.has(f));
  if (extra.length) fams.push(["Additional contract fields", "Fields retained by the artifact contract but not assigned to a named evidence family.", extra]);
  const stats = [
    [String(trials.entries.length), "Public trials", biE("No released runs yet")],
    [String(models.entries.length), "Public model profiles", biE("Reserved")],
    [String(benchmark.dataset.caseCount), "Public cases", esc(benchmark.dataset.id)],
    [trials.entries.length ? "Available" : "Not available", "Trial publication", biE("Public artifact state")],
  ];
  const chain = ["Benchmark version", "Model identity", "Trial", "Case", "Tutor response", "Evaluation evidence", "Sanitized metrics"];
  const body = `<main id="main">
  <header class="essay-head tr-head">
    <div class="wrap">
      <nav class="cd-crumbs kicker" aria-label="Breadcrumb"><a href="../index.html">${biE("Data")}</a><span aria-hidden="true">›</span><span aria-current="page">${G("Trials", "评测记录")}</span></nav>
      <p class="essay-meta kicker"><span class="issue">${biE("Benchmark explorer")}</span><span class="rule" aria-hidden="true"></span><span class="nocase">${esc(COHORT)}</span></p>
      <h1 class="essay-title">${biE("Model Trials")}</h1>
      <p class="essay-dek">${bi("A transparent audit trail.", "透明的审计轨迹。")}</p>
      ${biPE("p", "hm-desc", "Future public trial records will connect model identity, case identity, execution context, Tutor response, evaluator evidence, and sanitized operational metrics.")}
      <dl class="tr-stats">${stats.map(([v, k, n]) => `<div><dd>${/^\d+$/.test(v) ? esc(v) : biE(v)}</dd><dt>${biE(k)}</dt><small>${n}</small></div>`).join("")}</dl>
      <p class="tr-motto">${bi("Shared evidence.<br>Stronger teaching.", "共享证据，<br>改进教学。")}</p>
    </div>
  </header>

  <nav class="wrap tr-tabs kicker" aria-label="Public trial sections"><a href="#trial-ledger" aria-current="true">${biE("All trials")}</a><a href="#trial-fields">${biE("Fields")}</a><a href="../../methodology/index.html">${biE("About")}</a></nav>

  <section class="wrap rs-sec" id="trial-ledger" aria-labelledby="ledger-title">
    <p class="kicker">${biE("Audit ledger")}</p>
    <h2 id="ledger-title" class="jx-h2">${biE("No row without a public artifact.")}</h2>
    ${biPE("p", "jx-p", "Each future row will be an addressable evidence record. The current ledger is intentionally empty.")}
    <div class="tbl-wrap rs-table-wrap" tabindex="0" aria-label="Scrollable public trial ledger">
      <table class="rs-table tr-ledger"><caption>${biE("Future public trial ledger")}</caption>
        <thead><tr>${["Trial ID", "Model ID", "Case ID", "Run index", "Evidence status"].map((c) => `<th scope="col">${biE(c)}</th>`).join("")}</tr></thead>
        <tbody><tr class="rs-ghost" aria-hidden="true">${"<td>—</td>".repeat(5)}</tr><tr><td colspan="5"><div class="rs-empty"><b>${biE("No public trials yet.")}</b><p>${biE(trials.notice)} ${biE("Check back after public model runs are released.")}</p></div></td></tr></tbody>
      </table>
    </div>
    <p class="rs-swipe">${biE("The ledger exposes only the public trial summary identity contract: id, modelId, caseId, and runIndex.")}</p>
  </section>

  <section class="wrap rs-sec" id="trial-fields" aria-labelledby="fields-title">
    <p class="kicker">${biE("Future trial schema")}</p>
    <h2 id="fields-title" class="jx-h2">${biE("What a trial includes.")}</h2>
    ${biPE("p", "jx-p", "These families are derived from the current public trial field contract, not from a model run.")}
    <ol class="tr-fams">${fams.map(([t, d, list], i) => `<li><span class="rs-step">${i + 1}</span><b>${biE(t)}</b><p>${biE(d)}</p><ul>${list.map((f) => `<li><code>${esc(f)}</code><span>${G(TRIAL_FIELD[f] ?? f, TRIAL_FIELD[f] ?? f)}</span></li>`).join("")}</ul></li>`).join("")}</ol>
  </section>

  <section class="wrap rs-sec" aria-labelledby="trace-title">
    <p class="kicker">${biE("Traceability chain")}</p>
    <h2 id="trace-title" class="jx-h2">${biE("From benchmark to evidence.")}</h2>
    ${biPE("p", "jx-p", "Trials remain separate from model profiles and leaderboard eligibility. A future record will link these stages without implying a ranking or teaching-effectiveness claim.")}
    <ol class="tr-chain">${chain.map((s) => `<li><b>${G(s, s === "Trial" ? "评测记录" : s)}</b><small>${biE("Future public evidence")}</small></li>`).join("")}</ol>
    <aside class="callout boundary tr-rel"><p>${bi(`<b>Keep the surfaces distinct.</b> <a href="../../models/index.html">Models</a> describe published model identity; <a href="../../leaderboard/index.html">Results</a> show rankings only when publication criteria are satisfied; this page is the individual audit ledger.`, `<b>${esc(Z("Keep the surfaces distinct."))}</b> <a href="../../models/index.html">${esc(Z("Models"))}</a>${esc(Zor("describe published model identity;", "描述已发布的模型身份；"))}<a href="../../leaderboard/index.html">${esc(Z("Results"))}</a>${esc(Zor("show rankings only when publication criteria are satisfied; this page is the individual audit ledger.", "只在满足发布标准时展示排名；本页是逐条的审计台账。"))}`)}</p></aside>
  </section>

  <section class="wrap jx-close">
    <p class="kicker">${biE("Public evidence, clearly bounded")}</p>
    <h2 class="jx-h2">${biE("Evidence you can follow.")}</h2>
    ${biPE("p", "jx-p", "Future published results should remain traceable back to versioned cases, model identity, and the evidence that supports each claim.")}
    <p class="jx-links"><a href="../../leaderboard/index.html">${biE("View the results")}</a><a href="../../methodology/index.html">${biE("Read the methodology")}</a></p>
  </section>
</main>`;
  return frame({ prefix: "../../", title: "Model Trials — Teachometry", titleZh: `${Z("Model Trials")} — Teachometry`, description: "An audit ledger for future public Teachometry model trial evidence.", body, current: "results", css: ["journal.css", "results.css"] });
}

// ---------------------------------------------------------------- write
const COVER = {
  file: "sealed.webp",
  alt: ["The back of an archive envelope on slate-blue bookcloth, its flap closed with ruby sealing wax pressed with the Teachometry seal. The printed form reads: dataset cohort tutor-eval-v0.2a@0.2a.6, benchmark version 0.1, calibrated public model runs none yet, status not yet published.",
    "石板蓝书布上的一只档案信封背面，封口用红宝石色火漆封住，压着 Teachometry 印章。信封上印的表格写着：数据集 tutor-eval-v0.2a@0.2a.6，基准版本 0.1，校准后的公开模型运行：尚无，状态：尚未发布。"],
  cap: ["Sealed until the evidence is ready.", "证据齐备之前，封存。"],
};
void biP;
const out = (rel, html) => { const f = join(PROTO, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, html); };
out("leaderboard/index.html", resultsPage(COVER));
out("models/index.html", modelsPage());
out("models/profile/index.html", profilePage());
out("data/trials/index.html", trialsPage());
if (globalThis.__zmiss?.size) process.stdout.write(`missing zh:\n  ${[...globalThis.__zmiss].join("\n  ")}\n`);
process.stdout.write("results: leaderboard + models + model profile + trials\n");
