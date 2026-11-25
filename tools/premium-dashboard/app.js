// Premium runs dashboard: rendering and interaction. All data stays in this browser tab.
// Every value from a record is written with textContent; nothing loaded is ever parsed as HTML.
(function () {
  "use strict";
  const M = globalThis.PremiumDashboardModel;

  // ---------- words ----------
  const T = {
    zh: {
      viewOverview: "概览", viewRuns: "全部对话", viewChecks: "运行检查", allBatches: "全部批次", allLangs: "中英文", latestShort: "最新版卡片", changeFilters: "更改", doneFilters: "收起",
      kicker: "TutorBench · 精品集", chartTutors: "谁教得好", chartCards: "哪张卡拉开了差距", rampLow: "通过率 低", rampHigh: "高", legendPending: "待审（不计入）",
      rateTip: "已计分 {n} 段：好 {g} · 有问题 {f} · 不合格 {x}", rateTipReview: "；另有 {r} 段待审，不计入", allOfTutor: "看这位导师的全部对话",
      cellTip: "通过 {p}/{n}", cellNone: "还没有已计分的对话", cellReview: "待审 {r}", noRate: "暂无", langZh: "中", langEn: "英",
      attentionTitle: "需要你看的", askPending: "段待审，还没有结论", askSpot: "段已计分，建议抽查", onlySpot: "建议抽查", judgesTied: "评审打平：{f}",
      costLine: "共花费 {cost}，其中重新评审 {re}。", opsTitle: "运行检查", opsNote: "看评测本身靠不靠得住：三位评审是否一致，批次是否跑完。", ties: "平票", topItems: "分歧最多的项：{list}",
      title: "评测运行", openFolder: "打开 runs 文件夹", loadSample: "载入合成示例", dropHere: "松开鼠标，载入这个 runs 文件夹",
      sourceSample: "合成示例 · {runs} 段对话 · {batches} 个批次", sourceFolder: "「{name}」· {runs} 段对话 · {batches} 个批次",
      sourceNone: "还没有数据。打开 runner 写出的 runs 文件夹（含 index.jsonl、batches/、records/），或者把文件夹拖进这个页面。",
      sampleBanner: "合成示例数据，由 runner 离线回放生成，不是任何模型的真实结果。",
      localOnly: "数据只在这个浏览器标签页里读取，不会上传。",
      warnings: "载入时发现的问题", fBatch: "批次", fVersion: "评审配置", fLang: "语言", fCards: "卡片版本",
      all: "全部", latestOnly: "只看每张卡的最新版本", allVersions: "包括旧版本",
      unscorable: "不计分",
      good: "好", flawed: "有问题", fail: "不合格", needs_review: "待审", error: "出错", student_invalid: "学生作废", other_version: "其他评审配置", scored_state: "已计分",
      spotCheck: "建议抽查", nothingPending: "没有待审的对话。",
      withheld: "规则已判 {v}，因待审暂扣", judgeError: "{j} 没有有效结果：{e}",
      rewrites: "重写 {n} 次", discarded: "作废尝试 {n}",
      judgesTitle: "评审分歧",
      judgesSummary: "{runs} 段对话里共有 {n} 处分歧。", minority: "少数票", item: "项目", invalidOutputs: "无效输出",
      batchesTitle: "批次", batch: "批次", status: "状态", progress: "完成", created: "时间",
      runsTitle: "全部对话", focus: "只看：{f}", clearFocus: "取消",
      onlyDisagree: "有分歧", showMore: "再显示 {n} 段",
      colState: "状态", colTutor: "导师", colCard: "卡片", colLang: "语言", colResult: "结论",
      colEnd: "结束", colCost: "美元", colTime: "时间",
      olderCard: "旧版卡", close: "关闭", runId: "运行 ID", repeatOf: "第 {i} / {n} 次",
      verdictBox: "结论", pendingReasons: "待审原因", evidence: "确定性失败的证据", leakAt: "第 {t} 轮泄露", leakAfter: "发生在固定考验之后",
      leakBefore: "发生在固定考验之前", tutorSaid: "导师原话", judgeQuote: "{j} 摘的证据（力度 {h}）", leftAt: "学生第 {n} 条消息走掉，停在阶段 {s}",
      capFault: "满 {t} 轮仍未解出，评审认定导师责任：", helpCurve: "每轮帮助力度", helpLevels: "0 只确认 · 1 提问指方向 · 2 给方法或检验 · 3 给出条件、步骤或答案（泄露）",
      transcript: "对话", student: "学生", tutor: "导师", msgN: "第 {n} 条", turnN: "第 {n} 轮", stage: "阶段 {s}", level: "力度 {h}",
      judgesInRun: "三位评审", judge: "评审", model: "模型", verdict: "结论", fixedTest: "固定考验", transfer: "迁移题", solved: "学生自己做出", yes: "是", no: "否",
      disagreements: "分歧", merged: "合并结果", scorings: "评分记录", current: "当前", scoringState: "结果",
      studentChecks: "学生检查", softFlags: "软标记", rejected: "被退回重写的回复", notFired: "没出现的条件行为", missingMistakes: "没犯的必犯错误", none: "无",
      attempts: "尝试", attemptN: "第 {n} 次尝试：{s}", costs: "花费", runCost: "运行（导师、学生、首次评审）", rejudgeCost: "重新评审 {id}",
      noData: "没有符合筛选条件的对话。", split: "评审分歧",
    },
    en: {
      viewOverview: "Overview", viewRuns: "All conversations", viewChecks: "Run checks", allBatches: "all batches", allLangs: "both languages", latestShort: "latest cards", changeFilters: "Change", doneFilters: "Done",
      kicker: "TutorBench · Premium set", chartTutors: "Who teaches well", chartCards: "Which cards separate the tutors", rampLow: "Pass rate low", rampHigh: "high", legendPending: "Needs review (not counted)",
      rateTip: "{n} scored: good {g} · flawed {f} · fail {x}", rateTipReview: "; {r} more need review and are not counted", allOfTutor: "All conversations for this tutor",
      cellTip: "pass {p}/{n}", cellNone: "nothing scored yet", cellReview: "{r} need review", noRate: "none yet", langZh: "zh", langEn: "en",
      attentionTitle: "Needs you", askPending: "need review, no verdict yet", askSpot: "scored, worth a spot check", onlySpot: "Worth a spot check", judgesTied: "judges tied: {f}",
      costLine: "Spent {cost}, of which rescoring {re}.", opsTitle: "Run checks", opsNote: "Whether the evaluation itself can be trusted: do the three judges agree, did the batches finish.", ties: "Ties", topItems: "Most splits: {list}",
      title: "Evaluation runs", openFolder: "Open runs folder", loadSample: "Load synthetic sample", dropHere: "Drop to load this runs folder",
      sourceSample: "Synthetic sample · {runs} conversations · {batches} batches", sourceFolder: "“{name}” · {runs} conversations · {batches} batches",
      sourceNone: "No data yet. Open the runs folder the runner wrote (index.jsonl, batches/, records/), or drop the folder on this page.",
      sampleBanner: "Synthetic sample made by the runner in offline replay. Not a real result from any model.",
      localOnly: "Files are read inside this browser tab and never uploaded.",
      warnings: "Problems found while loading", fBatch: "Batch", fVersion: "Judge configuration", fLang: "Language", fCards: "Card versions",
      all: "All", latestOnly: "Latest version of each card", allVersions: "Include older versions",
      unscorable: "Not scorable",
      good: "Good", flawed: "Flawed", fail: "Fail", needs_review: "Needs review", error: "Error", student_invalid: "Student invalid", other_version: "Other judge config", scored_state: "Scored",
      spotCheck: "Spot check", nothingPending: "Nothing needs review.",
      withheld: "Rule verdict {v} withheld while under review", judgeError: "{j} gave no valid result: {e}",
      rewrites: "rewritten {n}×", discarded: "discarded attempts: {n}",
      judgesTitle: "Judge disagreement",
      judgesSummary: "{n} disagreements across {runs} conversations.", minority: "Outvoted", item: "Item", invalidOutputs: "Invalid outputs",
      batchesTitle: "Batches", batch: "Batch", status: "Status", progress: "Done", created: "Created",
      runsTitle: "All conversations", focus: "Showing: {f}", clearFocus: "Clear",
      onlyDisagree: "Has disagreement", showMore: "Show {n} more",
      colState: "State", colTutor: "Tutor", colCard: "Card", colLang: "Lang", colResult: "Verdict",
      colEnd: "End", colCost: "USD", colTime: "Time",
      olderCard: "older card", close: "Close", runId: "Run ID", repeatOf: "Repeat {i} of {n}",
      verdictBox: "Verdict", pendingReasons: "Why it needs review", evidence: "Evidence for the deterministic failure", leakAt: "Leak at turn {t}", leakAfter: "after the fixed test",
      leakBefore: "before the fixed test", tutorSaid: "Tutor's words", judgeQuote: "{j} quoted (help level {h})", leftAt: "The student left at message {n}, still at stage {s}",
      capFault: "Not solved after {t} turns; judges blaming the tutor:", helpCurve: "Help level per turn", helpLevels: "0 confirms · 1 points with a question · 2 offers a method or check · 3 gives conditions, steps or the answer (leak)",
      transcript: "Conversation", student: "Student", tutor: "Tutor", msgN: "message {n}", turnN: "turn {n}", stage: "stage {s}", level: "level {h}",
      judgesInRun: "The three judges", judge: "Judge", model: "Model", verdict: "Verdict", fixedTest: "Fixed test", transfer: "Transfer", solved: "Solved by student", yes: "yes", no: "no",
      disagreements: "Disagreements", merged: "Merged", scorings: "Scorings", current: "current", scoringState: "Result",
      studentChecks: "Student checks", softFlags: "Soft flags", rejected: "Replies sent back for a rewrite", notFired: "Conditional behaviours that never fired", missingMistakes: "Required mistakes not made", none: "none",
      attempts: "Attempts", attemptN: "Attempt {n}: {s}", costs: "Cost", runCost: "Run (tutor, student, first scoring)", rejudgeCost: "Rescoring {id}",
      noData: "No conversations match these filters.", split: "judges split",
    },
  };
  const CODES = {
    zh: {
      not_a_record: "不是 runner 的对话记录，已跳过", not_a_batch: "不是 runner 的批次文件，已跳过", duplicate_run_differs: "同一 runId 有两份不同的记录，只用了第一份",
      card_hash_conflict: "同一卡片版本出现了两个内容哈希", batch_missing: "记录指向的批次文件不在文件夹里", index_out_of_date: "index.jsonl 和记录对不上（重新生成 index）",
      index_row_without_record: "index.jsonl 里有、records/ 里没有", record_not_in_index: "records/ 里有、index.jsonl 里没有", unreadable_file: "文件读不了，已跳过",
      incomplete_panel: "评审小组不完整", unsolved_early_exit: "没做出来就结束，原因待定", unsolved_at_cap: "15 轮没做出来，多数评审不认为是导师的责任",
      fixed_test_skip_evidence: "考验前拿到答案离开，要核对泄露证据", transfer_protocol: "导师出了迁移题（协议决定 §4 已取消这条待审）", no_scoring: "没有评分",
      leak: "泄露答案", student_left: "学生走掉", unsolved_tutor_fault: "因导师没做出来", content_error: "内容错误", dead_hints: "重复无效提示", help_level: "帮助力度不当",
      held_and_helped: "守住并给了更具体的帮助", leaked: "泄露", refused_only: "只拒绝", ignored: "没回应", not_reached: "没到考验",
      curt_exit: "做完草草结束", thanked_after_answer: "拿到答案道谢", left: "走掉", turn_cap: "满 15 轮", error: "出错", student_invalid: "学生作废",
      not_offered: "没出", declined: "学生拒绝", solved: "做对", solved_after_hint: "提示后做对", unsolved: "没做对",
      premature_idea: "没被点到就想到关键方法", fixed_test_event_missing: "说了考验原话但没报事件", fixed_test_event_without_text: "报了考验事件但没说原话",
      fixed_test_event_early: "考验事件报早了", fixed_test_event_late: "考验事件报晚了", fixed_test_text_wrong_turn: "考验原话出现在别的消息",
      invalid_json_or_fields: "格式不对", internal_state_in_message: "把内部状态写进了消息", unknown_event: "未知事件", duplicate_event: "事件重复",
      invalid_stage: "阶段跳跃或倒退", invalid_end: "结束标记不一致", fixed_test_missing: "漏了考验原话", too_long: "消息太长", role_reference: "提到了扮演或卡片",
      invalid_judge_output: "评审输出不合格", mock_not_dispatched: "评审没有被调用", provider_error: "服务出错", budget_stop: "预算停止", unknown_cost: "费用未知，停止",
      actual_over_budget: "实际花费超预算", complete: "完成", running: "进行中", sensitive_output: "输出含敏感内容", model_version_drift: "模型版本漂移", invalid_response: "返回格式不对",
      correct: "内容正确", readsState: "看准状态", helpFit: "帮助力度", noLeak: "不泄露", responds: "回应学生", helpLevel: "力度档位", fixedTest: "固定考验",
      transfer: "迁移题", solvedByStudent: "学生自己做出", judgeVerdictMajority: "评审结论多数", consistent: "前后一致", repeatedDeadHint: "重复无效提示",
      helpFollowsStudent: "帮助跟着学生走", "verdict rule / judge majority": "规则结论 vs 评审多数",
    },
    en: {
      not_a_record: "not a runner conversation record, skipped", not_a_batch: "not a runner batch file, skipped", duplicate_run_differs: "two different records share one runId; the first was used",
      card_hash_conflict: "one card version has two content hashes", batch_missing: "a record points to a batch file that is not in the folder", index_out_of_date: "index.jsonl does not match the records (rebuild the index)",
      index_row_without_record: "in index.jsonl but not in records/", record_not_in_index: "in records/ but not in index.jsonl", unreadable_file: "file could not be read, skipped",
      incomplete_panel: "incomplete judge panel", unsolved_early_exit: "ended unsolved, cause undecided", unsolved_at_cap: "unsolved after 15 turns, most judges do not blame the tutor",
      fixed_test_skip_evidence: "left with the answer before the fixed test; check the leak evidence", transfer_protocol: "tutor gave a transfer problem (dropped by protocol decision §4)", no_scoring: "no scoring",
      leak: "leak", student_left: "student left", unsolved_tutor_fault: "unsolved by tutor's fault", content_error: "content error", dead_hints: "repeated dead hints", help_level: "help level off",
      held_and_helped: "held and helped", leaked: "leaked", refused_only: "refused only", ignored: "ignored", not_reached: "not reached",
      curt_exit: "curt exit after solving", thanked_after_answer: "thanked after the answer", left: "left", turn_cap: "15-turn cap", error: "error", student_invalid: "student invalid",
      not_offered: "not offered", declined: "declined", solved: "solved", solved_after_hint: "solved after hint", unsolved: "unsolved",
      premature_idea: "key idea before the tutor pointed to it", fixed_test_event_missing: "said the fixed line, no event", fixed_test_event_without_text: "event without the fixed line",
      fixed_test_event_early: "fixed-test event early", fixed_test_event_late: "fixed-test event late", fixed_test_text_wrong_turn: "fixed line in another message",
      invalid_json_or_fields: "malformed reply", internal_state_in_message: "internal state in message", unknown_event: "unknown event", duplicate_event: "duplicate event",
      invalid_stage: "stage skipped or reversed", invalid_end: "inconsistent end", fixed_test_missing: "fixed line missing", too_long: "message too long", role_reference: "mentions role-play or the card",
      invalid_judge_output: "invalid judge output", mock_not_dispatched: "judge not called", provider_error: "provider error", budget_stop: "budget stop", unknown_cost: "unknown cost, stopped",
      actual_over_budget: "over budget", complete: "complete", running: "running", sensitive_output: "sensitive output", model_version_drift: "model version drift", invalid_response: "invalid response",
      correct: "correct", readsState: "reads state", helpFit: "help fit", noLeak: "no leak", responds: "responds", helpLevel: "help level", fixedTest: "fixed test",
      transfer: "transfer", solvedByStudent: "solved by student", judgeVerdictMajority: "judges' verdict", consistent: "consistent", repeatedDeadHint: "repeated dead hint",
      helpFollowsStudent: "help follows student", "verdict rule / judge majority": "rule verdict vs judges",
    },
  };

  // ---------- state ----------
  const VIEWS = ["overview", "runs", "checks"];
  const st = {
    lang: detectLang(), dataset: null, source: null,
    f: { batch: "all", version: null, lang: "all", cards: "latest", tutor: "all", card: "all" },
    runFilter: { state: "all", disagree: false, spot: false, focus: null }, limit: 100,
    view: initialView(), showFilters: false,
  };
  function initialView() {
    try { const h = location.hash.slice(1); if (VIEWS.includes(h)) return h; } catch { /* no hash */ }
    return "overview";
  }
  function detectLang() {
    try { const saved = localStorage.getItem("premium-dashboard-lang"); if (saved === "zh" || saved === "en") return saved; } catch { /* storage unavailable */ }
    return /^zh/iu.test(navigator.language || "") ? "zh" : "en";
  }
  const t = (key, vars) => {
    let s = (T[st.lang] && T[st.lang][key]) ?? T.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v));
    return s;
  };
  const code = c => {
    if (c == null) return t("split");
    const s = String(c);
    if (s.startsWith("no_majority:")) return (st.lang === "zh" ? "评审在「" + code(s.slice(12)) + "」上没有多数" : "no majority on " + code(s.slice(12)));
    if (s.startsWith("missing:")) return (st.lang === "zh" ? "没犯必犯的错 " : "required mistake not made: ") + s.slice(8);
    if (s.startsWith("hint_absent:")) return (st.lang === "zh" ? "报了错误但话里没有 " : "mistake reported without its words: ") + s.slice(12);
    const m = /^turn (\d+) \/ (\w+)$/u.exec(s);
    if (m) return (st.lang === "zh" ? "第 " + m[1] + " 轮 · " : "turn " + m[1] + " · ") + code(m[2]);
    return CODES[st.lang][s] ?? CODES.en[s] ?? s;
  };
  const pct = x => (x == null ? "—" : Math.round(x * 100) + "%");
  const usd = x => (x == null ? "—" : "$" + (x < 1 ? x.toFixed(4) : x.toFixed(2)));
  const when = iso => { try { return new Date(iso).toLocaleString(st.lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(iso); } };
  const whenShort = iso => { try { return new Date(iso).toLocaleString(st.lang === "zh" ? "zh-CN" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(iso); } };

  // ---------- DOM helpers ----------
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const $ = id => document.getElementById(id);
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  const svg = (tag, attrs) => { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v)); return n; };
  const verdictMark = v => el("span", { class: "state" }, pip(v), t(v));

  // ---------- loading ----------
  function load(input, source) {
    st.dataset = M.buildDataset(input);
    st.source = source;
    const versions = st.dataset.judgeVersions;
    st.f = { batch: "all", version: versions.length ? versions[0] : null, lang: "all", cards: "latest", tutor: "all", card: "all" };
    st.runFilter = { state: "all", disagree: false, spot: false, focus: null };
    st.limit = 100;
    closeDrawer();
    render();
  }
  function loadSample() {
    const s = globalThis.PREMIUM_SAMPLE;
    if (!s) return;
    load({ records: s.records, batches: s.batches, index: M.parseJsonl(s.index) }, { kind: "sample" });
  }
  async function loadFiles(files, name) {
    const input = { records: [], recordNames: [], batches: [], index: null };
    const extra = [];
    for (const f of files) {
      const path = (f.webkitRelativePath || f.fullPath || f.name).replace(/\\/gu, "/");
      try {
        if (path.endsWith("index.jsonl")) input.index = M.parseJsonl(await f.text());
        else if (/(^|\/)batches\/[^/]+\.json$/u.test(path)) input.batches.push(JSON.parse(await f.text()));
        else if (/(^|\/)records\/[^/]+\.json$/u.test(path)) { input.records.push(JSON.parse(await f.text())); input.recordNames.push(path); }
        else if (path.endsWith(".json") && !path.includes("/")) {
          const v = JSON.parse(await f.text());
          if (v && v.schema === "tutorbench.premium-batch") input.batches.push(v);
          else { input.records.push(v); input.recordNames.push(path); }
        }
      } catch (e) { extra.push({ code: "unreadable_file", detail: path + ": " + (e && e.message ? e.message : "?") }); }
    }
    load(input, { kind: "folder", name });
    st.dataset.warnings.unshift(...extra);
    render();
  }
  async function entriesToFiles(entries) {
    const out = [];
    const walk = entry => new Promise(resolve => {
      if (entry.isFile) entry.file(f => { Object.defineProperty(f, "fullPath", { value: entry.fullPath.replace(/^\//u, "") }); out.push(f); resolve(); }, () => resolve());
      else if (entry.isDirectory) {
        const reader = entry.createReader(), all = [];
        const next = () => reader.readEntries(batch => { if (!batch.length) Promise.all(all.map(walk)).then(() => resolve()); else { all.push(...batch); next(); } }, () => resolve());
        next();
      } else resolve();
    });
    for (const e of entries) await walk(e);
    return out;
  }

  // ---------- derived ----------
  function views() {
    const d = st.dataset;
    if (!d) return [];
    return d.runs
      .filter(r => st.f.batch === "all" || r.batchId === st.f.batch)
      .filter(r => st.f.lang === "all" || r.card.lang === st.f.lang)
      .filter(r => st.f.tutor === "all" || r.tutor.label === st.f.tutor)
      .filter(r => st.f.card === "all" || r.card.id === st.f.card)
      .map(r => M.runView(r, st.f.version, d.latestCard))
      .filter(v => st.f.cards === "all" || !v.olderCard);
  }
  const cardsOf = vs => [...new Set(vs.map(v => v.record.card.id))].sort();
  const softCount = v => { const c = M.studentChecks(v.record); return c.softFlags.length + c.rewrites + c.discardedAttempts; };

  // ---------- render ----------
  function render() {
    document.documentElement.lang = st.lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach(n => { n.textContent = t(n.getAttribute("data-i18n")); });
    $("lang-toggle").textContent = st.lang === "zh" ? "EN" : "中文";
    $("load-sample").hidden = !globalThis.PREMIUM_SAMPLE;
    const d = st.dataset;
    const src = $("source");
    if (!d) { src.textContent = t("sourceNone") + " " + t("localOnly"); }
    else {
      const vars = { runs: d.runs.length, batches: d.batches.length, name: st.source.name || "" };
      src.textContent = st.source.kind === "sample" ? t("sourceSample", vars) : t("sourceFolder", vars);
    }
    const banner = $("banner");
    banner.hidden = !(d && st.source.kind === "sample");
    banner.textContent = t("sampleBanner");
    renderWarnings();
    const show = { board: st.view === "overview", cards: st.view === "overview", attention: st.view === "overview", runs: st.view === "runs", ops: st.view === "checks" };
    for (const id of Object.keys(show)) { clear($(id)); $(id).hidden = !show[id]; }
    document.querySelector(".sheet").hidden = !d;
    const vs = d ? views() : [];
    renderViews(vs);
    const filters = clear($("filters"));
    filters.hidden = !(d && st.showFilters);
    if (!d) return;
    if (st.showFilters) filters.append(renderFilters());
    if (show.board) { const rows = tutorRows(vs); renderBoard(vs, rows); renderCards(vs, rows); renderAttention(vs); }
    if (show.runs) renderRuns(vs);
    if (show.ops) renderOps(vs);
  }

  function renderWarnings() {
    const box = clear($("warnings"));
    const w = st.dataset ? st.dataset.warnings : [];
    box.hidden = !w.length;
    if (!w.length) return;
    const counts = new Map();
    for (const x of w) counts.set(x.code, [...(counts.get(x.code) || []), x.detail]);
    box.append(el("strong", { text: t("warnings") }),
      el("ul", null, [...counts.entries()].map(([c, details]) => el("li", null, el("span", { text: code(c) }), " · ", el("span", { class: "muted small mono" }, details.slice(0, 4).join(", ") + (details.length > 4 ? " … +" + (details.length - 4) : ""))))));
  }

  function select(id, label, value, options, onchange) {
    return el("label", { for: id }, label, el("select", { id, onchange: e => onchange(e.target.value) },
      options.map(([v, text]) => { const o = el("option", { value: v, text }); if (v === value) o.selected = true; return o; })));
  }
  const langName = l => (l === "zh-CN" ? "中文" : l === "en" ? "English" : l);
  function renderFilters() {
    const d = st.dataset;
    return el("div", { class: "filters" },
      select("f-version", t("fVersion"), st.f.version ?? "", d.judgeVersions.map(v => [v, v]), v => { st.f.version = v; render(); }),
      select("f-batch", t("fBatch"), st.f.batch, [["all", t("all")], ...d.batches.map(b => [b.batchId, b.batchId])], v => { st.f.batch = v; render(); }),
      select("f-lang", t("fLang"), st.f.lang, [["all", t("all")], ["zh-CN", langName("zh-CN")], ["en", langName("en")]], v => { st.f.lang = v; render(); }),
      select("f-cards", t("fCards"), st.f.cards, [["latest", t("latestOnly")], ["all", t("allVersions")]], v => { st.f.cards = v; render(); }));
  }
  function filterSummary() {
    const parts = [st.f.version || "—", st.f.batch === "all" ? t("allBatches") : st.f.batch, st.f.lang === "all" ? t("allLangs") : langName(st.f.lang),
      st.f.cards === "latest" ? t("latestShort") : t("allVersions")];
    return el("div", { class: "fsum" }, el("span", { text: parts.join(" · ") }),
      el("button", { type: "button", class: "btn-quiet", "aria-expanded": st.showFilters ? "true" : "false", onclick: () => { st.showFilters = !st.showFilters; render(); } },
        st.showFilters ? t("doneFilters") : t("changeFilters")));
  }

  // One mark per conversation. Shape and colour both carry the state.
  const kindOf = v => (v.state === "scored" ? v.verdict : v.state === "error" || v.state === "student_invalid" ? "unscorable" : v.state);
  const kindLabel = v => (v.state === "scored" ? t(v.verdict) : t(v.state));
  function pip(kind) {
    const s = svg("svg", { class: "pip " + kind, viewBox: "0 0 12 12", "aria-hidden": "true", focusable: "false" });
    if (kind === "good") s.append(svg("circle", { cx: 6, cy: 6, r: 5 }));
    else if (kind === "flawed") { s.append(svg("circle", { class: "ring", cx: 6, cy: 6, r: 4.6 })); s.append(svg("path", { d: "M6 1.4 A4.6 4.6 0 0 0 6 10.6 Z" })); }
    else if (kind === "fail") s.append(svg("path", { d: "M2.4 2.4 L9.6 9.6 M9.6 2.4 L2.4 9.6" }));
    else if (kind === "needs_review") s.append(svg("circle", { cx: 6, cy: 6, r: 4.4 }));
    else s.append(svg("path", { d: "M2.5 6 H9.5" }));
    return s;
  }
  const mark = v => el("span", { class: "state" }, pip(kindOf(v)), kindLabel(v));
  const langShort = l => (l === "zh-CN" ? t("langZh") : l === "en" ? t("langEn") : l);
  function whyText(v) {
    if (v.state === "scored") return v.reasons.map(code).join("、");
    if (v.state === "needs_review") return [...v.pending.map(code), v.withheldVerdict ? t("withheld", { v: t(v.withheldVerdict) }) : null].filter(Boolean).join("；");
    if (v.state === "other_version") return v.judgeVersion || "";
    const a = (v.record.attempts || []).at(-1);
    return a && a.reason ? code(a.reason.split(",")[0]) : code(v.record.end.reason);
  }
  function legend() {
    return el("div", { class: "legend" },
      ["good", "flawed", "fail"].map(k => el("span", null, pip(k), t(k))),
      el("span", null, pip("needs_review"), t("legendPending")));
  }
  function setView(view) {
    st.view = view;
    render();
    try { history.replaceState(null, "", "#" + view); } catch { /* the hash is a convenience only */ }
  }
  function renderViews(vs) {
    const nav = clear($("views"));
    nav.hidden = !st.dataset;
    if (!st.dataset) return;
    const views = [["overview", t("viewOverview"), null], ["runs", t("viewRuns"), vs.length], ["checks", t("viewChecks"), null]];
    for (const [id, label, n] of views) nav.append(el("button", { type: "button", class: "view-tab", "aria-current": st.view === id ? "page" : null, onclick: () => setView(id) },
      label, n != null ? el("span", { class: "count", text: String(n) }) : null));
    nav.append(filterSummary());
  }

  // ---------- Overview ----------
  // Chart 1: one row per tutor, one mark per conversation. Counted marks first (good, flawed, fail),
  // then a small gap and the hollow rings that still need review. Length of the green run is the pass rate.
  const UNIT = 16;
  function glyph(kind, cx, cy, attrs) {
    const g = svg("g", Object.assign({ class: "u " + kind }, attrs || {}));
    g.append(svg("rect", { class: "hit", x: cx - UNIT / 2, y: 0, width: UNIT, height: UNIT, rx: 3 }));
    if (kind === "good") g.append(svg("circle", { cx, cy, r: 5 }));
    else if (kind === "flawed") { g.append(svg("circle", { class: "ring", cx, cy, r: 4.4 })); g.append(svg("path", { d: `M${cx} ${cy - 4.4} A4.4 4.4 0 0 0 ${cx} ${cy + 4.4} Z` })); }
    else if (kind === "fail") g.append(svg("path", { d: `M${cx - 3.6} ${cy - 3.6} L${cx + 3.6} ${cy + 3.6} M${cx + 3.6} ${cy - 3.6} L${cx - 3.6} ${cy + 3.6}` }));
    else g.append(svg("circle", { cx, cy, r: 4.2 }));
    return g;
  }
  const VERDICT_ORDER = { good: 0, flawed: 1, fail: 2 };
  const byCard = (a, b) => a.record.card.id.localeCompare(b.record.card.id) || String(a.record.card.lang).localeCompare(String(b.record.card.lang)) || a.record.repeat.index - b.record.repeat.index;
  const runLabel = v => [v.record.card.id, langShort(v.record.card.lang) + " #" + v.record.repeat.index, kindLabel(v)].join(" · ");
  const isSpot = v => v.state !== "needs_review" && (softCount(v) > 0 || v.reviewFlags.length > 0);
  function tutorRows(vs) {
    return [...M.groupBy(vs, v => v.record.tutor.label)].map(([tutor, group]) => ({ tutor, group, g: M.summarize(group) }))
      .sort((a, b) => (b.g.passRate ?? -1) - (a.g.passRate ?? -1) || b.g.scored - a.g.scored || a.tutor.localeCompare(b.tutor));
  }
  function showRuns(filter) {
    st.runFilter = Object.assign({ state: "all", disagree: false, spot: false, focus: null }, filter);
    st.limit = 100;
    setView("runs");
    window.scrollTo({ top: 0 });
  }

  function renderBoard(vs, rows) {
    const box = $("board");
    box.append(el("header", { class: "sec-head" }, el("h2", { id: "board-title", text: t("chartTutors") }), legend()));
    if (!vs.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    const strips = rows.map(({ group }) => {
      const counted = group.filter(v => v.state === "scored").sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || byCard(a, b));
      const pending = group.filter(v => v.state === "needs_review").sort(byCard);
      return { counted, pending, units: counted.length + (pending.length ? pending.length + 0.75 : 0) };
    });
    const width = Math.max(1, ...strips.map(s => s.units)) * UNIT;
    const list = el("div", { class: "tutors" });
    rows.forEach(({ tutor, group, g }, i) => {
      const { counted, pending } = strips[i];
      const models = [...new Set(group.map(v => v.record.tutor.resolvedModel).filter(Boolean))];
      const summary = t("rateTip", { n: g.scored, g: g.good, f: g.flawed, x: g.fail }) + (pending.length ? t("rateTipReview", { r: pending.length }) : "");
      const strip = svg("svg", { class: "strip", viewBox: `0 0 ${width} ${UNIT}`, preserveAspectRatio: "xMinYMid meet", style: `max-width:${width * 1.125}px`, role: "img", "aria-label": tutor + " · " + summary });
      counted.forEach((v, k) => strip.append(glyph(kindOf(v), k * UNIT + UNIT / 2, UNIT / 2, { "data-tip": runLabel(v), "data-run": v.record.runId })));
      const x0 = (counted.length + (counted.length ? 0.75 : 0)) * UNIT;
      pending.forEach((v, k) => strip.append(glyph("needs_review", x0 + k * UNIT + UNIT / 2, UNIT / 2, { "data-tip": runLabel(v) + (whyText(v) ? " · " + whyText(v) : ""), "data-run": v.record.runId })));
      strip.addEventListener("click", e => { const n = e.target.closest("[data-run]"); if (n) openRun(n.getAttribute("data-run")); });
      list.append(el("div", { class: "tutor" },
        el("button", { type: "button", class: "who", onclick: () => showRuns({ focus: { tutor } }), "data-tip": t("allOfTutor") },
          el("strong", { text: tutor }), models.length ? el("span", { class: "faint mono", text: models.join(", ") }) : null),
        el("span", { class: "rate" + (g.passRate == null ? " none" : ""), "data-tip": summary, text: g.passRate == null ? t("noRate") : pct(g.passRate) }),
        el("div", { class: "strip-box" }, strip)));
    });
    box.append(list);
  }

  // Chart 2: card × tutor. One hue, lighter = lower pass rate. Cards that separate the tutors most come first.
  const step = rate => Math.min(4, Math.floor(rate * 5));
  function ramp() {
    return el("div", { class: "ramp", "aria-hidden": "true" }, el("span", { text: t("rampLow") }),
      el("span", { class: "sw" }, [0, 1, 2, 3, 4].map(k => el("i", { class: "s" + k }))), el("span", { text: t("rampHigh") }));
  }
  function renderCards(vs, rows) {
    const box = $("cards");
    const tutors = rows.map(r => r.tutor);
    const cards = cardsOf(vs).map(card => {
      const cells = tutors.map(tutor => { const runs = vs.filter(v => v.record.card.id === card && v.record.tutor.label === tutor); return { tutor, runs, s: M.summarize(runs) }; });
      const rates = cells.map(c => c.s.passRate).filter(x => x != null);
      return { card, cells, spread: rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : -1 };
    }).sort((a, b) => b.spread - a.spread || a.card.localeCompare(b.card));
    box.append(el("header", { class: "sec-head" }, el("h2", { id: "cards-title", text: t("chartCards") }), ramp()));
    const grid = el("div", { class: "heat", role: "table", "aria-labelledby": "cards-title", style: "--n:" + tutors.length });
    grid.append(el("div", { class: "hrow", role: "row" }, el("span", { class: "corner", role: "columnheader" }),
      tutors.map(name => el("span", { class: "th", role: "columnheader", text: name }))));
    for (const { card, cells } of cards) {
      grid.append(el("div", { class: "hrow", role: "row" },
        el("span", { class: "card", role: "rowheader", text: card }),
        cells.map(({ tutor, runs, s }) => {
          const langs = ["zh-CN", "en"].map(l => { const ls = M.summarize(runs.filter(v => v.record.card.lang === l)); return ls.scored ? langShort(l) + " " + (ls.good + ls.flawed) + "/" + ls.scored : null; }).filter(Boolean);
          const tip = tutor + " · " + card + " · " + (s.scored ? t("cellTip", { p: s.good + s.flawed, n: s.scored }) + (langs.length > 1 ? "（" + langs.join("，") + "）" : "") : t("cellNone"))
            + (s.needsReview ? " · " + t("cellReview", { r: s.needsReview }) : "");
          const cls = "hc " + (s.scored ? "s" + step(s.passRate) : "empty") + (s.needsReview ? " pending" : "");
          return el("span", { role: "cell" }, el("button", { type: "button", class: cls, "data-tip": tip, "aria-label": tip, onclick: () => showRuns({ focus: { tutor, card } }) },
            s.scored ? (s.good + s.flawed) + "/" + s.scored : "—"));
        })));
    }
    box.append(el("div", { class: "heat-box" }, grid));
  }

  // What needs a person: two numbers, each opens the matching list.
  function renderAttention(vs) {
    const box = $("attention");
    const pending = vs.filter(v => v.state === "needs_review").length, spot = vs.filter(isSpot).length;
    box.append(el("header", { class: "sec-head" }, el("h2", { id: "attention-title", text: t("attentionTitle") })));
    if (!pending && !spot) { box.append(el("p", { class: "empty-note", text: t("nothingPending") })); return; }
    const ask = (n, label, go) => el("button", { type: "button", class: "ask", onclick: go, disabled: !n },
      el("span", { class: "n", text: String(n) }), el("span", { class: "l", text: label + " →" }));
    box.append(el("div", { class: "asks" },
      ask(pending, t("askPending"), () => showRuns({ state: "needs_review" })),
      ask(spot, t("askSpot"), () => showRuns({ spot: true }))));
  }
  function spotText(v) {
    const c = M.studentChecks(v.record);
    return [...c.softFlags.map(code), c.rewrites ? t("rewrites", { n: c.rewrites }) : null, c.discardedAttempts ? t("discarded", { n: c.discardedAttempts }) : null,
      ...v.reviewFlags.map(f => t("judgesTied", { f: code(f) }))].filter(Boolean).join("、");
  }

  // ---------- All conversations ----------
  function renderRunsOnly() { clear($("runs")); renderRuns(views()); }
  function renderRuns(vs) {
    const box = $("runs"), rf = st.runFilter;
    const states = [["all", t("all")], ["scored", t("scored_state")], ["needs_review", t("needs_review")], ["unscorable", t("unscorable")], ["other_version", t("other_version")]];
    const inState = (v, k) => k === "all" || (k === "unscorable" ? ["error", "student_invalid"].includes(v.state) : v.state === k);
    const scoped = vs.filter(v => !rf.focus || ((!rf.focus.tutor || v.record.tutor.label === rf.focus.tutor) && (!rf.focus.card || v.record.card.id === rf.focus.card)));
    let list = scoped.filter(v => inState(v, rf.state)).filter(v => !rf.disagree || v.disagreements.length).filter(v => !rf.spot || isSpot(v));
    box.append(el("header", { class: "sec-head" }, el("h2", { id: "runs-title" }, t("runsTitle"), el("span", { class: "count", text: String(list.length) }))));
    box.append(el("div", { class: "tabs", role: "group", "aria-label": t("colState") }, states.map(([k, label]) => el("button", { type: "button", class: "tab", "aria-pressed": rf.state === k ? "true" : "false",
      onclick: () => { rf.state = k; st.limit = 100; renderRunsOnly(); } }, label + " " + scoped.filter(v => inState(v, k)).length))));
    box.append(el("div", { class: "toggles" },
      rf.focus ? el("span", { class: "focus" }, t("focus", { f: [rf.focus.tutor, rf.focus.card].filter(Boolean).join(" · ") }), el("button", { type: "button", class: "btn-quiet", onclick: () => { rf.focus = null; renderRunsOnly(); renderViews(views()); } }, t("clearFocus"))) : null,
      el("label", null, el("input", { type: "checkbox", id: "only-disagree", checked: rf.disagree, onchange: e => { rf.disagree = e.target.checked; renderRunsOnly(); } }), t("onlyDisagree")),
      el("label", null, el("input", { type: "checkbox", id: "only-spot", checked: rf.spot, onchange: e => { rf.spot = e.target.checked; renderRunsOnly(); } }), t("onlySpot"))));
    list = list.slice().sort((a, b) => String(b.record.createdAt).localeCompare(String(a.record.createdAt)));
    if (!list.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    const head = [t("colResult"), t("colTutor"), t("colCard"), t("colLang"), t("colEnd"), t("colTime")];
    const body = el("tbody");
    for (const v of list.slice(0, st.limit)) {
      const r = v.record;
      const open = () => openRun(r.runId);
      const why = rf.spot && isSpot(v) ? spotText(v) : whyText(v);
      body.append(el("tr", { tabindex: "0", onclick: open, onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } },
        el("td", { class: "verdict" }, mark(v), why ? el("div", { class: "why", text: why }) : null),
        el("td", { text: r.tutor.label }),
        el("td", null, el("span", { text: r.card.id }), v.olderCard ? el("span", { class: "older", text: "v" + r.card.version + " · " + t("olderCard") }) : null),
        el("td", { text: langShort(r.card.lang) + " #" + r.repeat.index }),
        el("td", { class: "muted", text: code(r.end.reason) }),
        el("td", { class: "muted", text: whenShort(r.createdAt) })));
    }
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "runs" }, el("thead", null, el("tr", null, head.map(h => el("th", { text: h })))), body)));
    if (list.length > st.limit) box.append(el("button", { type: "button", class: "more", onclick: () => { st.limit += 100; renderRunsOnly(); } }, t("showMore", { n: Math.min(100, list.length - st.limit) })));
  }

  // ---------- Run checks ----------
  function renderOps(vs) {
    const box = $("ops");
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" }, el("h2", { id: "ops-title", text: t("opsTitle") }), el("p", { class: "lede", text: t("opsNote") }))));
    const sum = M.disagreementSummary(vs.filter(v => v.state !== "other_version"));
    const invalid = {};
    for (const v of vs) for (const j of v.judgeErrors) invalid[j.judgeId] = (invalid[j.judgeId] || 0) + 1;
    const judges = [...new Set([...Object.keys(sum.byJudge), ...Object.keys(invalid)])].sort();
    const items = Object.entries(sum.byItem).sort((a, b) => b[1] - a[1]);
    const maxMin = Math.max(1, ...judges.map(j => (sum.byJudge[j] || {}).minority || 0));
    const bar = (n, max) => el("div", { class: "barcell" }, el("span", { class: "hbar", "aria-hidden": "true" }, el("span", { style: "width:" + Math.round(100 * n / max) + "%" })), el("span", { class: "num", text: String(n) }));
    const left = el("div", { class: "block" }, el("h3", { text: t("judgesTitle") }),
      el("p", { class: "small muted", text: t("judgesSummary", { n: sum.total, runs: sum.runsWith }) }),
      judges.length ? el("div", { class: "scroll-x" }, el("table", null,
        el("thead", null, el("tr", null, el("th", { text: t("judge") }), el("th", { text: t("minority") }), el("th", { class: "num", text: t("ties") }), el("th", { class: "num", text: t("invalidOutputs") }))),
        el("tbody", null, judges.map(j => el("tr", null, el("td", { class: "mono", text: j }),
          el("td", null, bar((sum.byJudge[j] || {}).minority || 0, maxMin)), el("td", { class: "num", text: (sum.byJudge[j] || {}).tie || 0 }),
          el("td", { class: "num" + (invalid[j] ? " stopped" : ""), text: invalid[j] || 0 })))))) : null,
      items.length ? el("p", { class: "small muted", text: t("topItems", { list: items.slice(0, 4).map(([k, n]) => code(k) + " " + n).join(" · ") }) }) : null);
    const rows = st.dataset.batches.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const runCost = vs.reduce((n, v) => n + (M.costs(v.record).run || 0), 0);
    const reCost = vs.reduce((n, v) => n + M.costs(v.record).rescoring.reduce((m, x) => m + (x.usd || 0), 0), 0);
    const right = el("div", { class: "block" }, el("h3", { text: t("batchesTitle") }),
      el("p", { class: "small muted", text: t("costLine", { cost: usd(runCost + reCost), re: usd(reCost) }) }),
      el("div", { class: "scroll-x" }, el("table", null,
        el("thead", null, el("tr", null, [t("batch"), t("status"), t("progress")].map(h => el("th", { text: h })))),
        el("tbody", null, rows.map(b => {
          const r = b.runs || {}, done = (r.scored || 0) + (r.error || 0) + (r.studentInvalid || 0) + (r.needsReview || 0);
          const stopped = b.status && b.status !== "complete" && b.status !== "running";
          return el("tr", null, el("td", null, el("div", { class: "mono", text: b.batchId }), el("div", { class: "small faint", text: whenShort(b.createdAt) + " · " + usd(b.spentUsd) + " / " + usd(b.budgetUsd) })),
            el("td", { class: (stopped ? "stopped" : "muted"), text: (stopped ? "✕ " : "") + code(b.status) }),
            el("td", null, el("div", { class: "barcell" }, el("span", { class: "hbar", "aria-hidden": "true" }, el("span", { style: "width:" + (b.planned ? Math.min(100, Math.round(100 * done / b.planned)) : 0) + "%" })),
              el("span", { class: "num", text: done + " / " + (b.planned ?? "?") }))));
        })))));
    box.append(el("div", { class: "cols" }, left, right));
  }

  // ---------- drawer ----------
  let lastFocus = null;
  function closeDrawer() {
    $("drawer").hidden = true; $("scrim").hidden = true; openRunId = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function helpChart(m) {
    const levels = m.helpLevels || [], leaks = new Set(m.leakTurns || []);
    const W = 640, H = 150, L = 34, R = 12, TOP = 12, B = 26;
    const x = i => L + (levels.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (levels.length - 1));
    const y = h => TOP + ((3 - h) * (H - TOP - B)) / 3;
    const s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": t("helpCurve") + ": " + levels.join(", ") });
    for (let h = 0; h <= 3; h++) {
      s.append(svg("line", { x1: L, x2: W - R, y1: y(h), y2: y(h), stroke: "var(--rule)", "stroke-width": 1 }));
      const lab = svg("text", { x: L - 10, y: y(h) + 4, "text-anchor": "end" }); lab.textContent = String(h); s.append(lab);
    }
    if (levels.length > 1) s.append(svg("polyline", { points: levels.map((h, i) => x(i) + "," + y(h)).join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round" }));
    levels.forEach((h, i) => {
      const leak = leaks.has(i + 1);
      const c = svg("circle", { cx: x(i), cy: y(h), r: 5, fill: leak ? "var(--crit)" : "var(--accent)", stroke: "var(--surface)", "stroke-width": 2, "data-tip": t("turnN", { n: i + 1 }) + " · " + t("level", { h }) + (leak ? " · " + code("leak") : "") });
      s.append(c);
      if (levels.length <= 16) { const lab = svg("text", { x: x(i), y: H - 8, "text-anchor": "middle" }); lab.textContent = String(i + 1); s.append(lab); }
    });
    return el("div", null, s, el("p", { class: "small muted", text: t("helpLevels") }));
  }
  let openRunId = null;
  function openRun(runId, keepFocus) {
    const d = st.dataset, r = d.runs.find(x => x.runId === runId);
    if (!r) return;
    if (!keepFocus) lastFocus = document.activeElement;
    openRunId = runId;
    const v = M.runView(r, st.f.version, d.latestCard), s = v.scoring, m = s && s.merged;
    const box = clear($("drawer"));
    box.append(el("div", { class: "drawer-head" },
      el("div", { class: "ids" }, el("span", { class: "kicker", text: r.batchId }), el("h2", { id: "drawer-title", text: r.tutor.label + " · " + r.card.id }),
        el("span", { class: "small muted" }, r.card.lang + " · " + t("repeatOf", { i: r.repeat.index, n: r.repeat.of }) + " · " + when(r.createdAt)),
        el("span", { class: "mono muted" }, r.card.id + "@" + r.card.version + (v.olderCard ? " (" + t("olderCard") + ")" : "") + " · " + String(r.card.contentHash).slice(0, 19) + "…"),
        el("span", { class: "mono muted" }, t("runId") + " " + r.runId)),
      el("button", { type: "button", onclick: closeDrawer, id: "drawer-close" }, t("close"))));

    // Verdict and why
    const vb = el("div", { class: "verdict-box" }, mark(v));
    if (v.state === "scored" && v.reasons.length) vb.append(el("div", { class: "tags" }, v.reasons.map(x => el("span", { class: "tag" + (["leak", "student_left", "unsolved_tutor_fault"].includes(x) ? " crit" : ""), text: code(x) }))));
    if (v.pending.length) vb.append(el("div", null, el("strong", { text: t("pendingReasons") })), el("ul", null, v.pending.map(p => el("li", { text: code(p) }))));
    if (v.withheldVerdict) vb.append(el("div", { class: "tag crit", text: t("withheld", { v: t(v.withheldVerdict) }) }));
    for (const j of v.judgeErrors) vb.append(el("div", { class: "small", text: t("judgeError", { j: j.judgeId, e: code(j.error) }) }));
    if (v.reviewFlags.length) vb.append(el("div", { class: "tags" }, v.reviewFlags.map(f => el("span", { class: "tag", text: t("spotCheck") + ": " + code(f) }))));
    if (v.state === "error" || v.state === "student_invalid") {
      for (const a of r.attempts || []) vb.append(el("div", { class: "small", text: t("attemptN", { n: a.attempt, s: a.status }) + (a.reason ? " · " + a.reason.split(",").map(code).join(", ") : "") + (a.atStudentMessage ? " · " + t("msgN", { n: a.atStudentMessage }) : "") }));
    }
    box.append(el("div", { class: "section" }, el("h3", { text: t("verdictBox") }), vb));

    // Deterministic failure evidence
    const ev = M.failureEvidence(v);
    if (ev.length) {
      const sec = el("div", { class: "section" }, el("h3", { text: t("evidence") }));
      for (const e of ev) {
        if (e.kind === "leak") sec.append(el("div", { class: "evidence" }, el("strong", { text: t("leakAt", { t: e.turn }) + " · " + (e.afterFixedTest ? t("leakAfter") : t("leakBefore")) }),
          el("span", { class: "small muted", text: t("tutorSaid") }), el("blockquote", { text: e.tutorText || "" }),
          e.quotes.map(q => el("div", { class: "small" }, el("span", { class: "muted", text: t("judgeQuote", { j: q.judgeId, h: q.helpLevel }) + " " }), el("span", { text: "“" + q.evidence + "”" })))));
        if (e.kind === "student_left") sec.append(el("div", { class: "evidence" }, el("strong", { text: t("leftAt", { n: e.studentMessage, s: e.stage }) }), el("blockquote", { text: e.message || "" })));
        if (e.kind === "unsolved_tutor_fault") sec.append(el("div", { class: "evidence" }, el("strong", { text: t("capFault", { t: e.tutorTurns }) }),
          el("div", { class: "tags" }, e.votes.map(x => el("span", { class: "tag" + (x.tutorFault ? " crit" : ""), text: x.judgeId + ": " + (x.tutorFault ? t("yes") : t("no")) })))));
      }
      box.append(sec);
    }

    if (m && m.helpLevels && m.helpLevels.length) box.append(el("div", { class: "section" }, el("h3", { text: t("helpCurve") }), helpChart(m)));

    // Conversation
    const msgs = el("div", { class: "msgs" });
    let sn = 0;
    const leakTurns = new Set(m ? m.leakTurns || [] : []);
    for (const line of r.transcript || []) {
      if (line.role === "student") {
        sn++;
        const ck = line.checks || {};
        msgs.append(el("div", { class: "msg student" },
          el("div", { class: "who" }, el("strong", { text: t("student") + " " + t("msgN", { n: sn }) }), line.state ? el("span", { text: t("stage", { s: line.state.stage }) }) : null,
            (line.state && line.state.events || []).map(e => el("span", { class: "tag", text: e })),
            (ck.softFlags || []).map(f => el("span", { class: "tag", style: "border-color:var(--warn)", text: code(f) })),
            ck.regenerated ? el("span", { class: "tag", text: t("rewrites", { n: ck.regenerated }) }) : null),
          el("div", { class: "text", text: line.text })));
      } else {
        const mt = m && m.turns ? m.turns[line.turn - 1] : null;
        msgs.append(el("div", { class: "msg" + (leakTurns.has(line.turn) ? " leak" : "") },
          el("div", { class: "who" }, el("strong", { text: t("tutor") + " " + t("turnN", { n: line.turn }) }), mt ? el("span", { text: t("level", { h: mt.helpLevel }) }) : null,
            mt ? el("span", { class: "checks" }, ["correct", "readsState", "helpFit", "noLeak", "responds"].map(k => el("span", { class: "ck" + (mt[k] === false ? " no" : ""), text: (mt[k] === false ? "✕ " : mt[k] === null ? "? " : "✓ ") + code(k) }))) : null),
          el("div", { class: "text", text: line.text })));
      }
    }
    box.append(el("div", { class: "section" }, el("h3", { text: t("transcript") }), msgs));

    // Judges
    if (s) {
      const cfg = (s.judgeConfig && s.judgeConfig.judges) || [];
      const judgeRows = (s.perJudge || []).map(j => {
        const info = cfg.find(c => c.id === j.judgeId) || {};
        const o = j.output && j.output.overall;
        return el("tr", null, el("td", { class: "mono", text: j.judgeId }), el("td", { class: "small", text: (info.requestedModel || "") + (info.resolvedModel ? " (" + info.resolvedModel + ")" : "") }),
          el("td", null, o ? verdictMark(o.verdict) : el("span", { class: "tag crit", text: code(j.error || "no_scoring") })),
          el("td", { class: "small", text: j.output ? code(j.output.fixedTest.outcome) : "—" }),
          el("td", { class: "small", text: o ? code(o.transfer) : "—" }),
          el("td", { class: "small", text: o ? (o.solvedByStudent ? t("yes") : t("no")) : "—" }));
      });
      box.append(el("div", { class: "section" }, el("h3", { text: t("judgesInRun") + " · " + (s.judgeConfig ? s.judgeConfig.version : "") }),
        el("div", { class: "scroll-x" }, el("table", null, el("thead", null, el("tr", null, [t("judge"), t("model"), t("verdict"), t("fixedTest"), t("transfer"), t("solved")].map(h => el("th", { text: h })))), el("tbody", null, judgeRows)))));
      if (v.disagreements.length) {
        const ids = [...new Set(v.disagreements.flatMap(dd => Object.keys(dd.votes || {})))];
        box.append(el("div", { class: "section" }, el("h3", { text: t("disagreements") + " · " + v.disagreements.length }),
          el("div", { class: "scroll-x" }, el("table", null, el("thead", null, el("tr", null, el("th", { text: t("item") }), ids.map(i => el("th", { class: "mono", text: i })), el("th", { text: t("merged") }))),
            el("tbody", null, v.disagreements.map(dd => el("tr", null, el("td", { text: code(dd.where) }), ids.map(i => el("td", { class: "small", text: fmtVote(dd.votes[i]) })), el("td", { class: "small", text: dd.merged == null ? t("split") : fmtVote(dd.merged) }))))))));
      }
      box.append(el("div", { class: "section" }, el("h3", { text: t("scorings") }),
        el("div", { class: "scroll-x" }, el("table", null, el("thead", null, el("tr", null, ["ID", t("fVersion"), t("created"), t("scoringState"), t("colCost")].map(h => el("th", { text: h })))),
          el("tbody", null, r.scorings.map((x, i) => el("tr", null, el("td", { class: "mono" }, x.scoringId, i === r.scorings.length - 1 ? el("span", { class: "tag accent", style: "margin-left:6px", text: t("current") }) : null),
            el("td", { class: "mono", text: x.judgeConfig ? x.judgeConfig.version : "" }), el("td", { class: "small", text: when(x.createdAt) }),
            el("td", { class: "small", text: x.merged && x.merged.verdict ? t(x.merged.verdict) : (x.pending || []).map(code).join(", ") || "—" }),
            el("td", { class: "num small", text: usd(x.usage ? x.usage.totalUsd : null) }))))))));
    }

    // Student checks
    const c = M.studentChecks(r);
    const kv = el("dl", { class: "kv" },
      el("dt", { text: t("softFlags") }), el("dd", { text: c.softFlags.length ? c.softFlags.map(code).join(", ") : t("none") }),
      el("dt", { text: t("rejected") }), el("dd", { text: c.rejected.length ? String(c.rejected.length) : t("none") }),
      el("dt", { text: t("attempts") }), el("dd", { text: (r.attempts || []).map(a => t("attemptN", { n: a.attempt, s: a.status })).join(" · ") }),
      el("dt", { text: t("notFired") }), el("dd", { text: c.behavioursNotFired.length ? c.behavioursNotFired.join(", ") : t("none") }),
      el("dt", { text: t("missingMistakes") }), el("dd", { text: c.scriptedMistakesMissing.length ? c.scriptedMistakesMissing.join(", ") : t("none") }));
    const sec = el("div", { class: "section" }, el("h3", { text: t("studentChecks") }), kv);
    if (c.rejected.length) sec.append(el("details", null, el("summary", { text: t("rejected") + " · " + c.rejected.length }),
      el("ul", null, c.rejected.map(x => el("li", { class: "small" }, t("attemptN", { n: x.attempt, s: t("msgN", { n: x.studentMessage }) }) + " · " + (x.reasons || []).map(code).join(", "))))));
    box.append(sec);

    const cost = M.costs(r);
    box.append(el("div", { class: "section" }, el("h3", { text: t("costs") }), el("dl", { class: "kv" },
      el("dt", { text: t("runCost") }), el("dd", { class: "num", text: usd(cost.run) }),
      cost.rescoring.map(x => [el("dt", { text: t("rejudgeCost", { id: x.scoringId }) }), el("dd", { class: "num", text: usd(x.usd) })]))));

    const reopened = keepFocus && !box.hidden;
    $("scrim").hidden = false; box.hidden = false;
    if (!reopened) { box.scrollTop = 0; $("drawer-close").focus(); }
  }
  function fmtVote(x) { return typeof x === "boolean" ? (x ? t("yes") : t("no")) : x == null ? "—" : code(x); }

  // ---------- tooltip ----------
  const tip = $("tip");
  function showTip(target, x, y) {
    const text = target && target.getAttribute && target.getAttribute("data-tip");
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + "px";
    tip.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y - h - 10)) + "px";
  }
  document.addEventListener("mousemove", e => showTip(e.target.closest ? e.target.closest("[data-tip]") : null, e.clientX, e.clientY));
  document.addEventListener("focusin", e => { const n = e.target.closest && e.target.closest("[data-tip]"); if (n) { const b = n.getBoundingClientRect(); showTip(n, b.left, b.top); } else tip.hidden = true; });
  document.addEventListener("mouseleave", () => { tip.hidden = true; });
  document.addEventListener("click", () => { tip.hidden = true; }, true);

  // ---------- wiring ----------
  $("pick-folder").addEventListener("change", e => {
    const files = [...e.target.files];
    if (!files.length) return;
    const name = (files[0].webkitRelativePath || files[0].name).split("/")[0];
    loadFiles(files, name);
    e.target.value = "";
  });
  $("load-sample").addEventListener("click", loadSample);
  $("lang-toggle").addEventListener("click", () => {
    st.lang = st.lang === "zh" ? "en" : "zh";
    try { localStorage.setItem("premium-dashboard-lang", st.lang); } catch { /* storage unavailable */ }
    const reopen = !$("drawer").hidden ? openRunId : null;
    render();
    if (reopen) openRun(reopen, true);
  });
  $("scrim").addEventListener("click", closeDrawer);
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS.includes(h) && h !== st.view) { st.view = h; render(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("drawer").hidden) closeDrawer(); });
  let dragDepth = 0;
  document.addEventListener("dragenter", e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { dragDepth++; $("drop").hidden = false; } });
  document.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("drop").hidden = true; });
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", async e => {
    e.preventDefault(); dragDepth = 0; $("drop").hidden = true;
    const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (items.length) { const files = await entriesToFiles(items); loadFiles(files, items[0].name); }
    else if (e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files], e.dataTransfer.files[0].name);
  });

  if (globalThis.PREMIUM_SAMPLE) loadSample(); else render();
})();
