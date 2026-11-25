// Premium runs dashboard: rendering and interaction. All data stays in this browser tab.
// Every value from a record is written with textContent; nothing loaded is ever parsed as HTML.
(function () {
  "use strict";
  const M = globalThis.PremiumDashboardModel;

  // ---------- words ----------
  const T = {
    zh: {
      kicker: "TutorBench · 精品集", boardTitle: "导师成绩单",
      boardNote: "每个导师一行，按正式通过率排序。通过 = 好 + 有问题；待审、不计分和其他评审配置的对话都不算进通过率。",
      noRate: "暂无", passSub: "已计分 {n} · 好 {g} · 有问题 {f} · 不合格 {x}", notCountedMark: "不计分 / 其他配置", pipHint: "每个标记是一段对话，点它看详情。",
      showThese: "在下面列出这些对话", langZh: "中", langEn: "英", open: "看详情 →",
      totals: "合计已计分 {scored} 段。待审 {review} 段（其中评审未完成 {incomplete}），不计分 {unscorable} 段，其他评审配置 {other} 段，这三类都不算进通过率。花费 {cost}，其中重新评审 {re}。",
      attentionTitle: "需要你看的", attentionNote: "「待审」的对话还没有结论，不算进通过率。「建议抽查」的已经计分，但学生演得有点偏，或评审打平了，值得抽查。",
      pendingGroup: "待审", spotGroup: "建议抽查", judgesTied: "评审打平：{f}", colNotes: "备注", splitsN: "评审分歧 {n}", flagsN: "学生标记 {n}",
      opsTitle: "运行检查", opsNote: "看评测本身靠不靠得住：三位评审是否一致，批次是否跑完。", ties: "平票", topItems: "分歧最多的项：{list}",
      title: "评测运行", openFolder: "打开 runs 文件夹", loadSample: "载入合成示例", dropHere: "松开鼠标，载入这个 runs 文件夹",
      sourceSample: "合成示例数据：{runs} 段对话，{batches} 个批次。", sourceFolder: "已载入「{name}」：{runs} 段对话，{batches} 个批次。",
      sourceNone: "还没有数据。打开 runner 写出的 runs 文件夹（含 index.jsonl、batches/、records/），或者把文件夹拖进这个页面。",
      sampleBanner: "现在看的是合成示例数据，由 runner 离线回放生成，不是任何模型的真实结果。",
      localOnly: "数据只在这个浏览器标签页里读取，不会上传。",
      warnings: "载入时发现的问题", fBatch: "批次", fVersion: "评审配置", fLang: "语言", fCards: "卡片版本", fTutor: "导师", fCard: "卡片",
      all: "全部", latestOnly: "只看每张卡的最新版本", allVersions: "包括旧版本",
      passRate: "正式通过率", passFoot: "已计分 {n} 段里，没有判不合格的比例", passNone: "还没有已计分的对话",
      notCounted: "待审 {r}、不计分 {e}{o} 都不计入。", otherVersionNote: "、当前评分属于其他评审配置 {o}",
      scored: "已计分", scoredFoot: "好 {g} · 有问题 {f} · 不合格 {x}", review: "待审", reviewFoot: "其中评审未完成 {k}",
      unscorable: "不计分", unscorableFoot: "出错 {e} · 学生作废 {s}", cost: "花费（美元）", costFoot: "运行 {r} · 重新评审 {j}",
      byTutor: "按导师", byTutorNote: "条长是已计分对话里好、有问题、不合格的比例。右侧是正式通过率。点一行，下面的对话列表只看这个导师。",
      tutorMeta: "已计分 {n} · 待审 {r} · 不计分 {e}", matrix: "导师 × 卡片", matrixNote: "每格是这张卡上这个导师的已计分结果。点一格，下面只看这些对话。",
      cellText: "{n} 段 · 通过 {p}", cellReview: "待审 {r}",
      good: "好", flawed: "有问题", fail: "不合格", needs_review: "待审", error: "出错", student_invalid: "学生作废", other_version: "其他评审配置", scored_state: "已计分",
      reviewTitle: "要人看的", reviewNote: "左边的待审对话没有最终结论，不计入通过率。右边是学生演跑偏的信号：记录照常计入，但值得抽查。",
      pendingList: "待审（不计入）", softList: "学生检查（软标记）", spotCheck: "建议抽查", nothingPending: "没有待审的对话。", nothingSoft: "没有学生软标记、重写或作废的尝试。",
      withheld: "规则已判 {v}，因待审暂扣", judgeError: "{j} 没有有效结果：{e}",
      rewrites: "重写 {n} 次", discarded: "作废尝试 {n}",
      judgesTitle: "评审分歧", judgesNote: "一处分歧是三个评审在某一项上投票不一致。条长是这位评审成为少数票的次数。",
      judgesSummary: "{runs} 段对话里共有 {n} 处分歧。", minority: "少数票", byItem: "分歧出现在哪一项", item: "项目", count: "次数", invalidOutputs: "无效输出",
      batchesTitle: "批次", batch: "批次", purpose: "用途", status: "状态", progress: "完成", spent: "花费", created: "时间",
      runsTitle: "全部对话", runsNote: "点一行看整段对话、评审和证据。", focus: "只看导师：{f}", clearFocus: "取消",
      onlyDisagree: "有分歧", onlySoft: "有学生软标记", showMore: "再显示 {n} 段",
      colState: "状态", colTutor: "导师", colCard: "卡片", colLang: "语言", colRepeat: "次", colResult: "结论", colFixed: "固定考验",
      colEnd: "结束", colTurns: "轮", colStudent: "学生检查", colDisagree: "分歧", colCost: "美元", colTime: "时间",
      olderCard: "旧版卡", close: "关闭", runId: "运行 ID", repeatOf: "第 {i} / {n} 次",
      verdictBox: "结论", reasons: "原因", pendingReasons: "待审原因", evidence: "确定性失败的证据", leakAt: "第 {t} 轮泄露", leakAfter: "发生在固定考验之后",
      leakBefore: "发生在固定考验之前", tutorSaid: "导师原话", judgeQuote: "{j} 摘的证据（力度 {h}）", leftAt: "学生第 {n} 条消息走掉，停在阶段 {s}",
      capFault: "满 {t} 轮仍未解出，评审认定导师责任：", helpCurve: "每轮帮助力度", helpLevels: "0 只确认 · 1 提问指方向 · 2 给方法或检验 · 3 给出条件、步骤或答案（泄露）",
      transcript: "对话", student: "学生", tutor: "导师", msgN: "第 {n} 条", turnN: "第 {n} 轮", stage: "阶段 {s}", level: "力度 {h}",
      judgesInRun: "三位评审", judge: "评审", model: "模型", verdict: "结论", fixedTest: "固定考验", transfer: "迁移题", solved: "学生自己做出", yes: "是", no: "否",
      disagreements: "分歧", merged: "合并结果", scorings: "评分记录", current: "当前", scoringState: "结果",
      studentChecks: "学生检查", softFlags: "软标记", rejected: "被退回重写的回复", notFired: "没出现的条件行为", missingMistakes: "没犯的必犯错误", none: "无",
      attempts: "尝试", attemptN: "第 {n} 次尝试：{s}", costs: "花费", runCost: "运行（导师、学生、首次评审）", rejudgeCost: "重新评审 {id}",
      noData: "没有符合筛选条件的对话。", split: "评审分歧", noScoring: "没有评分",
    },
    en: {
      kicker: "TutorBench · Premium set", boardTitle: "Tutor scorecard",
      boardNote: "One row per tutor, sorted by formal pass rate. Pass = good + flawed. Conversations that need review, are not scorable or were scored under another judge configuration are not counted.",
      noRate: "none yet", passSub: "Scored {n} · good {g} · flawed {f} · fail {x}", notCountedMark: "Not counted", pipHint: "Each mark is one conversation; select it for details.",
      showThese: "List these conversations below", langZh: "zh", langEn: "en", open: "Details →",
      totals: "In total {scored} conversations are scored. {review} need review ({incomplete} with scoring not finished), {unscorable} are not scorable and {other} were scored under another judge configuration; none of these count. Cost {cost}, of which rescoring {re}.",
      attentionTitle: "Needs you", attentionNote: "Conversations under Needs review have no verdict yet and are not counted. Those under Spot check are scored, but the simulated student drifted or the judges tied, so they are worth a look.",
      pendingGroup: "Needs review", spotGroup: "Spot check", judgesTied: "judges tied: {f}", colNotes: "Notes", splitsN: "{n} judge splits", flagsN: "{n} student flags",
      opsTitle: "Run checks", opsNote: "Whether the evaluation itself can be trusted: do the three judges agree, did the batches finish.", ties: "Ties", topItems: "Most splits: {list}",
      title: "Evaluation runs", openFolder: "Open runs folder", loadSample: "Load synthetic sample", dropHere: "Drop to load this runs folder",
      sourceSample: "Synthetic sample: {runs} conversations in {batches} batches.", sourceFolder: "Loaded “{name}”: {runs} conversations in {batches} batches.",
      sourceNone: "No data yet. Open the runs folder the runner wrote (index.jsonl, batches/, records/), or drop the folder on this page.",
      sampleBanner: "You are looking at synthetic sample data made by the runner in offline replay. These are not real results from any model.",
      localOnly: "Files are read inside this browser tab and never uploaded.",
      warnings: "Problems found while loading", fBatch: "Batch", fVersion: "Judge configuration", fLang: "Language", fCards: "Card versions", fTutor: "Tutor", fCard: "Card",
      all: "All", latestOnly: "Latest version of each card", allVersions: "Include older versions",
      passRate: "Formal pass rate", passFoot: "Share of the {n} scored conversations not judged a fail", passNone: "No scored conversations yet",
      notCounted: "Needs review {r} and not scorable {e}{o} are not counted.", otherVersionNote: ", scored under another configuration {o}",
      scored: "Scored", scoredFoot: "Good {g} · Flawed {f} · Fail {x}", review: "Needs review", reviewFoot: "Scoring not finished {k}",
      unscorable: "Not scorable", unscorableFoot: "Error {e} · Student invalid {s}", cost: "Cost (USD)", costFoot: "Runs {r} · Rescoring {j}",
      byTutor: "By tutor", byTutorNote: "Bar length is the share of good, flawed and fail among scored conversations. The number is the formal pass rate. Select a row to filter the run list.",
      tutorMeta: "Scored {n} · Needs review {r} · Not scorable {e}", matrix: "Tutor × card", matrixNote: "Each cell is one tutor's scored results on one card. Select a cell to filter the run list.",
      cellText: "{n} runs · pass {p}", cellReview: "Review {r}",
      good: "Good", flawed: "Flawed", fail: "Fail", needs_review: "Needs review", error: "Error", student_invalid: "Student invalid", other_version: "Other judge config", scored_state: "Scored",
      reviewTitle: "Needs a person", reviewNote: "Runs on the left have no final verdict and are not counted. Runs on the right are counted, but the simulated student showed signs of drifting from its card.",
      pendingList: "Needs review (not counted)", softList: "Student checks (soft flags)", spotCheck: "Spot check", nothingPending: "Nothing needs review.", nothingSoft: "No soft flags, rewrites or discarded attempts.",
      withheld: "Rule verdict {v} withheld while under review", judgeError: "{j} gave no valid result: {e}",
      rewrites: "rewritten {n}×", discarded: "discarded attempts: {n}",
      judgesTitle: "Judge disagreement", judgesNote: "A disagreement is one item where the three judges did not all vote the same. Bar length counts how often a judge was outvoted.",
      judgesSummary: "{n} disagreements across {runs} conversations.", minority: "Outvoted", byItem: "Where judges disagree", item: "Item", count: "Count", invalidOutputs: "Invalid outputs",
      batchesTitle: "Batches", batch: "Batch", purpose: "Purpose", status: "Status", progress: "Done", spent: "Spent", created: "Created",
      runsTitle: "All conversations", runsNote: "Select a row to see the conversation, the judges and the evidence.", focus: "Tutor: {f}", clearFocus: "Clear",
      onlyDisagree: "Has disagreement", onlySoft: "Has student flags", showMore: "Show {n} more",
      colState: "State", colTutor: "Tutor", colCard: "Card", colLang: "Lang", colRepeat: "#", colResult: "Verdict", colFixed: "Fixed test",
      colEnd: "End", colTurns: "Turns", colStudent: "Student checks", colDisagree: "Splits", colCost: "USD", colTime: "Time",
      olderCard: "older card", close: "Close", runId: "Run ID", repeatOf: "Repeat {i} of {n}",
      verdictBox: "Verdict", reasons: "Reasons", pendingReasons: "Why it needs review", evidence: "Evidence for the deterministic failure", leakAt: "Leak at turn {t}", leakAfter: "after the fixed test",
      leakBefore: "before the fixed test", tutorSaid: "Tutor's words", judgeQuote: "{j} quoted (help level {h})", leftAt: "The student left at message {n}, still at stage {s}",
      capFault: "Not solved after {t} turns; judges blaming the tutor:", helpCurve: "Help level per turn", helpLevels: "0 confirms · 1 points with a question · 2 offers a method or check · 3 gives conditions, steps or the answer (leak)",
      transcript: "Conversation", student: "Student", tutor: "Tutor", msgN: "message {n}", turnN: "turn {n}", stage: "stage {s}", level: "level {h}",
      judgesInRun: "The three judges", judge: "Judge", model: "Model", verdict: "Verdict", fixedTest: "Fixed test", transfer: "Transfer", solved: "Solved by student", yes: "yes", no: "no",
      disagreements: "Disagreements", merged: "Merged", scorings: "Scorings", current: "current", scoringState: "Result",
      studentChecks: "Student checks", softFlags: "Soft flags", rejected: "Replies sent back for a rewrite", notFired: "Conditional behaviours that never fired", missingMistakes: "Required mistakes not made", none: "none",
      attempts: "Attempts", attemptN: "Attempt {n}: {s}", costs: "Cost", runCost: "Run (tutor, student, first scoring)", rejudgeCost: "Rescoring {id}",
      noData: "No conversations match these filters.", split: "judges split", noScoring: "no scoring",
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
  const st = {
    lang: detectLang(), dataset: null, source: null,
    f: { batch: "all", version: null, lang: "all", cards: "latest", tutor: "all", card: "all" },
    runFilter: { state: "all", disagree: false, soft: false, focus: null }, limit: 100,
  };
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
    st.runFilter = { state: "all", disagree: false, soft: false, focus: null };
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
      src.textContent = (st.source.kind === "sample" ? t("sourceSample", vars) : t("sourceFolder", vars)) + " " + t("localOnly");
    }
    const banner = $("banner");
    banner.hidden = !(d && st.source.kind === "sample");
    banner.textContent = t("sampleBanner");
    renderWarnings();
    for (const id of ["board", "attention", "runs", "ops"]) clear($(id));
    document.querySelector(".sheet").hidden = !d;
    if (!d) return;
    const vs = views();
    renderBoard(vs);
    renderAttention(vs);
    renderRuns(vs);
    renderOps(vs);
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
  function renderFilters() {
    const d = st.dataset;
    return el("div", { class: "filters" },
      select("f-version", t("fVersion"), st.f.version ?? "", d.judgeVersions.map(v => [v, v]), v => { st.f.version = v; render(); }),
      select("f-batch", t("fBatch"), st.f.batch, [["all", t("all")], ...d.batches.map(b => [b.batchId, b.batchId])], v => { st.f.batch = v; render(); }),
      select("f-lang", t("fLang"), st.f.lang, [["all", t("all")], ["zh-CN", "中文"], ["en", "English"]], v => { st.f.lang = v; render(); }),
      select("f-cards", t("fCards"), st.f.cards, [["latest", t("latestOnly")], ["all", t("allVersions")]], v => { st.f.cards = v; render(); }));
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
  const langShort = l => t(l === "zh-CN" ? "langZh" : l === "en" ? "langEn" : "") || l;
  const runName = v => [v.record.tutor.label, v.record.card.id, langShort(v.record.card.lang) + " #" + v.record.repeat.index].join(" · ");
  function whyText(v) {
    if (v.state === "scored") return v.reasons.map(code).join("、");
    if (v.state === "needs_review") return [...v.pending.map(code), v.withheldVerdict ? t("withheld", { v: t(v.withheldVerdict) }) : null].filter(Boolean).join("；");
    if (v.state === "other_version") return v.judgeVersion || "";
    const a = (v.record.attempts || []).at(-1);
    return a && a.reason ? code(a.reason.split(",")[0]) : code(v.record.end.reason);
  }
  function legend() {
    return el("div", { class: "legend" },
      ["good", "flawed", "fail", "needs_review"].map(k => el("span", null, pip(k), t(k))),
      el("span", null, pip("unscorable"), t("notCountedMark")),
      el("span", { class: "hint", text: t("pipHint") }));
  }
  function setFocus(focus, state) {
    st.runFilter.focus = focus;
    if (state) st.runFilter.state = state;
    st.limit = 100;
    renderRunsOnly();
  }
  function goToRuns() { $("runs").scrollIntoView({ behavior: "smooth", block: "start" }); }

  // ---------- 1. Tutor scorecard ----------
  function renderBoard(vs) {
    const box = $("board"), s = M.summarize(vs);
    box.append(el("header", { class: "sec-head" },
      el("div", { class: "title" }, el("h2", { id: "board-title", text: t("boardTitle") }), el("p", { class: "lede", text: t("boardNote") })),
      renderFilters()));
    if (!vs.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    box.append(legend());
    const cards = cardsOf(vs);
    const rows = [...M.groupBy(vs, v => v.record.tutor.label)].map(([tutor, group]) => ({ tutor, group, s: M.summarize(group) }))
      .sort((a, b) => (b.s.passRate ?? -1) - (a.s.passRate ?? -1) || b.s.scored - a.s.scored || a.tutor.localeCompare(b.tutor));
    const head = el("tr", null, el("th", { text: t("colTutor") }), el("th", { text: t("passRate") }),
      cards.map(c => el("th", null, el("div", { class: "cardhead" }, el("span", { text: c }), el("span", { class: "faint mono", text: "v" + st.dataset.latestCard[c] })))),
      el("th", { class: "num", text: t("needs_review") }), el("th", { class: "num", text: t("unscorable") }));
    const body = el("tbody");
    for (const { tutor, group, s: g } of rows) {
      const models = [...new Set(group.map(v => v.record.tutor.resolvedModel).filter(Boolean))];
      const unscorable = g.error + g.studentInvalid;
      body.append(el("tr", null,
        el("td", null, el("div", { class: "who" }, el("strong", { text: tutor }), models.length ? el("span", { class: "faint mono", text: models.join(", ") }) : null)),
        el("td", null, el("div", { class: "pass" },
          el("span", { class: "rate" + (g.passRate == null ? " none" : ""), text: g.passRate == null ? t("noRate") : pct(g.passRate) }),
          g.passRate == null ? null : el("div", { class: "meter", "aria-hidden": "true" }, el("span", { style: "width:" + Math.round(g.passRate * 100) + "%" })),
          el("span", { class: "sub", text: t("passSub", { n: g.scored, g: g.good, f: g.flawed, x: g.fail }) }))),
        cards.map(card => el("td", null, cardCell(group.filter(v => v.record.card.id === card)))),
        el("td", { class: "num" }, g.needsReview
          ? el("button", { type: "button", class: "link", "data-tip": t("showThese"), onclick: () => { setFocus({ tutor }, "needs_review"); goToRuns(); } }, String(g.needsReview))
          : el("span", { class: "faint", text: "0" })),
        el("td", { class: "num" }, el("span", { class: unscorable ? "" : "faint", text: String(unscorable) }))));
    }
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "board" }, el("thead", null, head), body)));
    const runCost = vs.reduce((n, v) => n + (M.costs(v.record).run || 0), 0);
    const reCost = vs.reduce((n, v) => n + M.costs(v.record).rescoring.reduce((m, x) => m + (x.usd || 0), 0), 0);
    box.append(el("p", { class: "totals", text: t("totals", { scored: s.scored, review: s.needsReview, incomplete: s.scoringIncomplete,
      unscorable: s.error + s.studentInvalid, other: s.otherVersion, cost: usd(runCost + reCost), re: usd(reCost) }) }));
  }
  function cardCell(group) {
    if (!group.length) return el("span", { class: "faint", text: "—" });
    const cell = el("div", { class: "cell" });
    for (const lang of ["zh-CN", "en", ...new Set(group.map(v => v.record.card.lang))].filter((x, i, a) => a.indexOf(x) === i)) {
      const runs = group.filter(v => v.record.card.lang === lang).sort((a, b) => a.record.repeat.index - b.record.repeat.index || String(a.record.createdAt).localeCompare(String(b.record.createdAt)));
      if (!runs.length) continue;
      cell.append(el("div", { class: "langrow" }, el("span", { class: "lang", text: langShort(lang) }),
        runs.map(v => {
          const label = langShort(lang) + " #" + v.record.repeat.index + " · " + kindLabel(v) + (whyText(v) ? " · " + whyText(v) : "");
          return el("button", { type: "button", class: "pip-btn", "data-tip": label, "aria-label": label, onclick: () => openRun(v.record.runId) }, pip(kindOf(v)));
        })));
    }
    return cell;
  }

  // ---------- 2. What needs a person ----------
  function attentionRow(v, why) {
    return el("button", { type: "button", class: "row", onclick: () => openRun(v.record.runId) },
      pip(kindOf(v)), el("span", { class: "name", text: runName(v) }), el("span", { class: "go", text: t("open") }),
      why ? el("span", { class: "why", text: why }) : null);
  }
  function renderAttention(vs) {
    const box = $("attention");
    const pending = vs.filter(v => v.state === "needs_review");
    const spot = vs.filter(v => v.state !== "needs_review" && (softCount(v) > 0 || v.reviewFlags.length));
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" }, el("h2", { id: "attention-title", text: t("attentionTitle") }), el("p", { class: "lede", text: t("attentionNote") }))));
    const left = el("div", { class: "list" }, el("h3", null, t("pendingGroup"), el("span", { class: "count", text: String(pending.length) })));
    if (!pending.length) left.append(el("p", { class: "empty-note", text: t("nothingPending") }));
    for (const v of pending) {
      const extra = v.judgeErrors.map(j => t("judgeError", { j: j.judgeId, e: code(j.error) }));
      left.append(attentionRow(v, [whyText(v), ...extra].filter(Boolean).join("；")));
    }
    const right = el("div", { class: "list" }, el("h3", null, t("spotGroup"), el("span", { class: "count", text: String(spot.length) })));
    if (!spot.length) right.append(el("p", { class: "empty-note", text: t("nothingSoft") }));
    for (const v of spot) {
      const c = M.studentChecks(v.record);
      const bits = [...c.softFlags.map(code), c.rewrites ? t("rewrites", { n: c.rewrites }) : null, c.discardedAttempts ? t("discarded", { n: c.discardedAttempts }) : null,
        ...v.reviewFlags.map(f => t("judgesTied", { f: code(f) }))].filter(Boolean);
      right.append(attentionRow(v, kindLabel(v) + " · " + bits.join("、")));
    }
    box.append(el("div", { class: "cols" }, left, right));
  }

  // ---------- 3. All conversations ----------
  function renderRunsOnly() { clear($("runs")); renderRuns(views()); }
  function renderRuns(vs) {
    const box = $("runs"), rf = st.runFilter;
    const states = [["all", t("all")], ["scored", t("scored_state")], ["needs_review", t("needs_review")], ["unscorable", t("unscorable")], ["other_version", t("other_version")]];
    const inState = (v, k) => k === "all" || (k === "unscorable" ? ["error", "student_invalid"].includes(v.state) : v.state === k);
    let list = vs.filter(v => inState(v, rf.state))
      .filter(v => !rf.disagree || v.disagreements.length).filter(v => !rf.soft || softCount(v) > 0)
      .filter(v => !rf.focus || ((!rf.focus.tutor || v.record.tutor.label === rf.focus.tutor) && (!rf.focus.card || v.record.card.id === rf.focus.card)));
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" },
      el("h2", { id: "runs-title" }, t("runsTitle"), el("span", { class: "count", text: String(list.length) })), el("p", { class: "lede", text: t("runsNote") }))));
    box.append(el("div", { class: "tabs", role: "group", "aria-label": t("colState") }, states.map(([k, label]) => el("button", { type: "button", class: "tab", "aria-pressed": rf.state === k ? "true" : "false",
      onclick: () => { rf.state = k; st.limit = 100; renderRunsOnly(); } }, label + " " + vs.filter(v => inState(v, k)).length))));
    box.append(el("div", { class: "toggles" },
      el("label", null, el("input", { type: "checkbox", id: "only-disagree", checked: rf.disagree, onchange: e => { rf.disagree = e.target.checked; renderRunsOnly(); } }), t("onlyDisagree")),
      el("label", null, el("input", { type: "checkbox", id: "only-soft", checked: rf.soft, onchange: e => { rf.soft = e.target.checked; renderRunsOnly(); } }), t("onlySoft")),
      rf.focus ? el("span", { class: "focus" }, t("focus", { f: rf.focus.tutor || "" }), el("button", { type: "button", class: "btn-quiet", onclick: () => setFocus(null) }, t("clearFocus"))) : null));
    list = list.slice().sort((a, b) => String(b.record.createdAt).localeCompare(String(a.record.createdAt)));
    if (!list.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    const head = [t("colResult"), t("colTutor"), t("colCard"), t("colLang"), t("colFixed"), t("colEnd"), t("colTurns"), t("colNotes"), t("colTime")];
    const body = el("tbody");
    for (const v of list.slice(0, st.limit)) {
      const r = v.record, m = v.scoring && v.scoring.merged, c = M.studentChecks(r);
      const open = () => openRun(r.runId);
      const notes = [v.disagreements.length ? t("splitsN", { n: v.disagreements.length }) : null,
        softCount(v) ? t("flagsN", { n: c.softFlags.length + c.rewrites + c.discardedAttempts }) : null].filter(Boolean).join(" · ");
      const why = whyText(v);
      body.append(el("tr", { tabindex: "0", onclick: open, onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } },
        el("td", { class: "verdict" }, mark(v), why ? el("div", { class: "why", text: why }) : null),
        el("td", { text: r.tutor.label }),
        el("td", null, el("span", { class: "mono", text: r.card.id }), v.olderCard ? el("span", { class: "older", text: "v" + r.card.version + " · " + t("olderCard") }) : null),
        el("td", { text: langShort(r.card.lang) + " #" + r.repeat.index }),
        el("td", { class: "small", text: m ? code(m.fixedTest) : "—" }),
        el("td", { class: "small", text: code(r.end.reason) }),
        el("td", { class: "num", text: r.end.tutorTurns }),
        el("td", { class: "small muted", text: notes }),
        el("td", { class: "small muted", text: whenShort(r.createdAt) })));
    }
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "runs" }, el("thead", null, el("tr", null, head.map((h, i) => el("th", { class: i === 6 ? "num" : null, text: h })))), body)));
    if (list.length > st.limit) box.append(el("button", { type: "button", onclick: () => { st.limit += 100; renderRunsOnly(); } }, t("showMore", { n: Math.min(100, list.length - st.limit) })));
  }

  // ---------- 4. How the run itself behaved ----------
  function renderOps(vs) {
    const box = $("ops");
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" }, el("h2", { id: "ops-title", text: t("opsTitle") }), el("p", { class: "lede", text: t("opsNote") }))));
    const sum = M.disagreementSummary(vs.filter(v => v.state !== "other_version"));
    const invalid = {};
    for (const v of vs) for (const j of v.judgeErrors) invalid[j.judgeId] = (invalid[j.judgeId] || 0) + 1;
    const judges = [...new Set([...Object.keys(sum.byJudge), ...Object.keys(invalid)])].sort();
    const items = Object.entries(sum.byItem).sort((a, b) => b[1] - a[1]);
    const left = el("div", { class: "list" }, el("h3", { text: t("judgesTitle") }),
      el("p", { class: "small muted", style: "padding-top:8px", text: t("judgesSummary", { n: sum.total, runs: sum.runsWith }) }),
      judges.length ? el("div", { class: "scroll-x" }, el("table", null,
        el("thead", null, el("tr", null, el("th", { text: t("judge") }), el("th", { class: "num", text: t("minority") }), el("th", { class: "num", text: t("ties") }), el("th", { class: "num", text: t("invalidOutputs") }))),
        el("tbody", null, judges.map(j => el("tr", null, el("td", { class: "mono", text: j }),
          el("td", { class: "num", text: (sum.byJudge[j] || {}).minority || 0 }), el("td", { class: "num", text: (sum.byJudge[j] || {}).tie || 0 }),
          el("td", { class: "num" + (invalid[j] ? " stopped" : ""), text: invalid[j] || 0 })))))) : null,
      items.length ? el("p", { class: "small muted", style: "padding-top:10px", text: t("topItems", { list: items.slice(0, 5).map(([k, n]) => code(k) + " " + n).join(" · ") }) }) : null);
    const rows = st.dataset.batches.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const right = el("div", { class: "list" }, el("h3", { text: t("batchesTitle") }),
      el("div", { class: "scroll-x" }, el("table", null,
        el("thead", null, el("tr", null, [t("batch"), t("status"), t("progress"), t("spent")].map((h, i) => el("th", { class: i >= 2 ? "num" : null, text: h })))),
        el("tbody", null, rows.map(b => {
          const r = b.runs || {}, done = (r.scored || 0) + (r.error || 0) + (r.studentInvalid || 0) + (r.needsReview || 0);
          const stopped = b.status && b.status !== "complete" && b.status !== "running";
          return el("tr", null, el("td", null, el("div", { class: "mono", text: b.batchId }), el("div", { class: "small muted", text: (b.purpose || "") + " · " + when(b.createdAt) })),
            el("td", { class: "small" + (stopped ? " stopped" : ""), text: (stopped ? "✕ " : "") + code(b.status) }),
            el("td", { class: "num", text: done + " / " + (b.planned ?? "?") }),
            el("td", { class: "num", text: usd(b.spentUsd) + " / " + usd(b.budgetUsd) }));
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
