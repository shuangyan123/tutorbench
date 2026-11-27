// Premium runs dashboard: rendering and interaction. All data stays in this browser tab.
// Every value from a record is written with textContent; nothing loaded is ever parsed as HTML.
(function () {
  "use strict";
  const M = globalThis.PremiumDashboardModel;

  // ---------- words ----------
  const T = {
    zh: {
      viewOverview: "概览", viewCompare: "对照", viewRuns: "全部对话", compareTitle: "两套配置，哪里不一样，谁更好", compareNote: "选两套配置。页面先列出它们哪里不一样，只在两边都跑过的卡上比较。", sideA: "A（基准）", sideB: "B（对照）", swap: "交换 A 和 B", diffTitle: "哪里不一样", partSame: "相同", part_tutor: "导师", part_tutorModel: "导师模型", part_tutorPrompt: "导师 prompt", part_tutorParams: "导师参数", part_studentModel: "模拟学生模型", part_studentParams: "模拟学生参数", part_judgeConfig: "评审配置", part_rules: "规则版本", promptFromCard: "跟着卡片走", cmpSame: "两边是同一套配置。选两套不同的再比。", cmpOne: "只变了一样：{p}", cmpMany: "变了 {n} 样：{p}。这个差别说不清是哪一样造成的，只作参考。", cmpMixed: "{s} 里混了不同的{p}，先用顶部筛选把它们分开。", cmpNoCells: "两边没有跑过同样的卡，没法比。", cmpBvsA: "个百分点 · B 比 A", cmpCells: "按两边都跑过的 {n} 组卡片和语言比较", cmpOverall: "全部", setupOption: "{t} · {m} · 学生 {s} · {n} 段 · {d}", cmpNone: "至少要有两套已计分的配置才能对照。", mixedRow: "{t} 的对话混了不同的{p}，可以去「对照」里分开看。", viewChecks: "运行检查", allBatches: "全部批次", allLangs: "中英文", latestShort: "最新版卡片", changeFilters: "更改", doneFilters: "收起",
      kicker: "Teachometry · TutorBench 精品集", chartTutors: "谁教得好", chartCards: "哪张卡拉开了差距", legendPending: "待审（不计入）",
      plate: "图版 {n}", keyHead: "头", keyHeadIs: "结局", keyStem: "茎", keyStemIs: "一节是导师的一轮", keyLeaf: "叶", keyLeafIs: "这一轮的帮助力度 0–3",
      keyRed: "红叶", keyRedIs: "这一轮泄露了答案", turnsN: "{n} 轮", spreadNote: "字母是导师，横向位置是它在这张卡上的通过率。右上角带小虚圈的，这张卡还有待审对话。", spreadCol: "差距", unratedN: "{n} 位未计分",
      rateTip: "已计分 {n} 段：好 {g} · 有问题 {f} · 不合格 {x}", rateTipReview: "；另有 {r} 段待审，不计入", allOfTutor: "看这位导师的全部对话",
      cellTip: "通过 {p}/{n}", ciTip: "95% 区间 {lo}%–{hi}%", ciNote: "数字下的细线是 95% 区间：按已计分的对话数，真实通过率大概落在这一段。两位导师的细线重叠得多，差距可能只是运气。", cellNone: "还没有已计分的对话", cellReview: "待审 {r}", noRate: "暂无", langZh: "中", langEn: "英",
      attentionTitle: "需要你看的", chartVersions: "换了版本，变好还是变差", versionsNote: "每一格是一位导师的几个版本。点是通过率，竖线是 95% 区间，大数字是最新版比上一版的变化。", versionsNone: "目前每位导师只有一个版本。同一位导师换了新版本再跑以后，这里会画出它变好还是变差。", versionsBasis: "只比每个版本都跑过的 {n} 组卡片和语言", versionsNoBasis: "这些版本没有跑过同样的卡，没法比", vsPrev: "比上一版", sigClear: "超出误差范围", sigNoise: "在误差范围内，可能是运气", firstRun: "首次运行 {d}", olderNote: "这里只算每位导师的最新版本，旧版本见图版 IV。", chartValue: "值不值", axisCost: "每段花费", axisTime: "每次回复等待", valueAxis: "横轴", cornerCost: "↖ 更好，也更省", cornerTime: "↖ 更好，也更快", valueTip: "每段花费 {c}（中位数，{n} 段） · 每次回复 {s}（中位数）", valueEstimated: "，其中 {k} 段有按预留价估算的调用", valueNote: "只算导师自己的调用，模拟学生和评审的花费在「运行检查」里。花费按价格表估算，横轴是对数刻度。等待时间受网络和服务器忙闲影响，只作参考。不比较 token 数，因为各家模型切 token 的方式不同。", valueMissing: "{n} 位导师缺这项数据，没画。", valueNone: "还没有可画的数据。", sec: "{v} 秒", pts: "个百分点", askPending: "段待审，还没有结论", askSpot: "段已计分，建议抽查", onlySpot: "建议抽查",
      costLine: "按价格表估算共花费 {cost}，其中重新评审 {re}。", opsTitle: "运行检查", opsNote: "看评测本身靠不靠得住：三位评审是否一致，批次是否跑完。", ties: "平票", topItems: "分歧最多的项：{list}",
      title: "观测台", openFolder: "打开 runs 文件夹", loadSample: "载入合成示例", dropHere: "松开鼠标，载入这个 runs 文件夹",
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
      calibration: "校准", superseded: "已被替代", onlyCalibration: "这些筛选里只有校准对话。校准不打分，到「全部对话」里看。",
      calibNote: "校准批次只检查模拟学生，不评审、不打分，也不计入通过率。", supersededShort: "预算中断，已重跑",
      supersededNote: "预算中断了这段对话，追加预算后已经重跑。这份记录留着备查，不计入。", openSuccessor: "看重跑的那段",
      restartNote: "这是预算中断后的重跑，替代了被打断的那段。", openPredecessor: "看被打断的那段",
      fixedTestSkipped: "考验之前就拿到答案离开", judgeRepaired: "{j} 第一次输出无效，补调 1 次后有效：{r}", judgeRepairFailed: "{j} 补调后仍然无效：{r}",
      estimatedCalls: "其中 {n} 次调用没有返回用量，按预留额计", hardCap: "硬上限 {v}", hardCapReached: "已到硬上限", alsoStopped: "同一次调用也停在：{r}",
      cmpNameOnly: "两边导师名字不同，但开发方、服务方和模型都一样，名字不算一项改动。", cmpSameNamed: "除了导师名字，两边是同一套配置。", noPrompt: "无导师 prompt",
      topUp: "追加预算 {from} → {to}", reconciled: "{p} 账单 {a}，估算 {e}，差 {d}", supersededRuns: "被替代 {n}",
    },
    en: {
      viewOverview: "Overview", viewCompare: "Compare", viewRuns: "All conversations", compareTitle: "Two setups: what differs, which is better", compareNote: "Pick two setups. The page first lists what differs, then compares only on the cards both ran.", sideA: "A (baseline)", sideB: "B (compared)", swap: "Swap A and B", diffTitle: "What differs", partSame: "same", part_tutor: "Tutor", part_tutorModel: "Tutor model", part_tutorPrompt: "Tutor prompt", part_tutorParams: "Tutor parameters", part_studentModel: "Simulated student model", part_studentParams: "Simulated student parameters", part_judgeConfig: "Judge configuration", part_rules: "Rules version", promptFromCard: "comes from the card", cmpSame: "Both sides are the same setup. Pick two different ones.", cmpOne: "Only one thing changed: {p}", cmpMany: "{n} things changed: {p}. The difference cannot be put down to any one of them; read it as a guide.", cmpMixed: "{s} mixes more than one {p}; use the filters at the top to separate them.", cmpNoCells: "The two sides never ran the same cards, so they cannot be compared.", cmpBvsA: "points · B against A", cmpCells: "Compared on the {n} card–language pairs both sides ran", cmpOverall: "All", setupOption: "{t} · {m} · student {s} · {n} runs · {d}", cmpNone: "Comparing needs at least two setups with scored runs.", mixedRow: "{t} mixes runs from more than one {p}; Compare can separate them.", viewChecks: "Run checks", allBatches: "all batches", allLangs: "both languages", latestShort: "latest cards", changeFilters: "Change", doneFilters: "Done",
      kicker: "Teachometry · TutorBench premium set", chartTutors: "Who teaches well", chartCards: "Which cards separate the tutors", legendPending: "Needs review (not counted)",
      plate: "Plate {n}", keyHead: "Head", keyHeadIs: "outcome", keyStem: "Stem", keyStemIs: "one node per tutor turn", keyLeaf: "Leaf", keyLeafIs: "help level that turn, 0–3",
      keyRed: "Red leaf", keyRedIs: "that turn leaked the answer", turnsN: "{n} turns", spreadNote: "Letters are tutors, placed at their pass rate on this card. A small dashed ring means some of its runs on this card still need review.", spreadCol: "Spread", unratedN: "{n} not scored",
      rateTip: "{n} scored: good {g} · flawed {f} · fail {x}", rateTipReview: "; {r} more need review and are not counted", allOfTutor: "All conversations for this tutor",
      cellTip: "pass {p}/{n}", ciTip: "95% range {lo}%–{hi}%", ciNote: "The hairline under each rate is its 95% range: where the true pass rate probably sits, given how many runs were scored. When two tutors' lines overlap a lot, the gap may be luck.", cellNone: "nothing scored yet", cellReview: "{r} need review", noRate: "none yet", langZh: "zh", langEn: "en",
      attentionTitle: "Needs you", chartVersions: "Did the new version get better", versionsNote: "Each panel is one tutor's versions. Dots are pass rates, vertical lines their 95% ranges; the big number is the newest version against the one before.", versionsNone: "Every tutor has one version so far. When a tutor runs again on a new version, this plate shows whether it got better or worse.", versionsBasis: "Compared only on the {n} card–language pairs every version ran", versionsNoBasis: "These versions never ran the same cards, so they cannot be compared", vsPrev: "vs the version before", sigClear: "outside the error range", sigNoise: "within the error range, may be luck", firstRun: "first run {d}", olderNote: "Only each tutor's newest version counts here; older versions are on Plate IV.", chartValue: "Is it worth it", axisCost: "Cost per conversation", axisTime: "Wait per reply", valueAxis: "Horizontal axis", cornerCost: "↖ better and cheaper", cornerTime: "↖ better and faster", valueTip: "{c} per conversation (median of {n}) · {s} per reply (median)", valueEstimated: "; {k} with calls charged at their reservation", valueNote: "Only the tutor's own calls count; the simulated student and judges are under Run checks. Costs are price-table estimates on a log scale. Waits depend on the network and provider load, so read them as a guide. Tokens are not compared, because each model counts them differently.", valueMissing: "{n} tutors lack this data and are not drawn.", valueNone: "Nothing to draw yet.", sec: "{v} s", pts: "points", askPending: "need review, no verdict yet", askSpot: "scored, worth a spot check", onlySpot: "Worth a spot check",
      costLine: "Price-table estimate: {cost}, of which rescoring {re}.", opsTitle: "Run checks", opsNote: "Whether the evaluation itself can be trusted: do the three judges agree, did the batches finish.", ties: "Ties", topItems: "Most splits: {list}",
      title: "Observatory", openFolder: "Open runs folder", loadSample: "Load synthetic sample", dropHere: "Drop to load this runs folder",
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
      calibration: "Calibration", superseded: "Superseded", onlyCalibration: "Only calibration runs match these filters. Calibration is not scored; see All conversations.",
      calibNote: "A calibration batch checks the simulated student only. It is not judged, not scored and never counted.", supersededShort: "budget stop, restarted",
      supersededNote: "The budget interrupted this conversation and it was restarted after a top-up. This record is kept for the audit and not counted.", openSuccessor: "Open the restart",
      restartNote: "This is a restart after a budget interruption. It replaces the interrupted run.", openPredecessor: "Open the interrupted run",
      fixedTestSkipped: "Left with the answer before the fixed test", judgeRepaired: "{j} gave an invalid ballot, valid after one retry: {r}", judgeRepairFailed: "{j} still invalid after a retry: {r}",
      estimatedCalls: "{n} calls returned no usage and are charged at their reservation", hardCap: "hard cap {v}", hardCapReached: "hard cap reached", alsoStopped: "the same call also stopped it: {r}",
      cmpNameOnly: "The tutor names differ, but the developer, provider and model are the same; a name is not a change.", cmpSameNamed: "Apart from the tutor's name, both sides are the same setup.", noPrompt: "no tutor prompt",
      topUp: "budget topped up {from} → {to}", reconciled: "{p} invoice {a}, estimate {e}, difference {d}", supersededRuns: "{n} superseded",
    },
  };
  const CODES = {
    zh: {
      not_a_record: "不是 runner 的对话记录，已跳过", not_a_batch: "不是 runner 的批次文件，已跳过", duplicate_run_differs: "同一 runId 有两份不同的记录，只用了第一份",
      card_hash_conflict: "同一卡片版本出现了两个内容哈希", tutor_prompt_conflict: "同一导师 prompt 版本出现了两个哈希", prompt_batch_mismatch: "记录里的导师 prompt 和批次登记的不一样", batch_missing: "记录指向的批次文件不在文件夹里", index_out_of_date: "index.jsonl 和记录对不上（重新生成 index）",
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
      left_too_early: "比卡片规定的最早时间更早走掉", curt_exit_unsolved: "没做出来就草草结束", fixed_test_early: "考验原话出现得太早",
      answer_claim_unconfirmed: "学生拿到答案道谢，但评审没认定泄露", solved_claim_unconfirmed: "学生说做完了，但评审不认为是自己做出",
      fixed_test_split: "固定考验三票各不相同", transfer_split: "迁移题三票各不相同", verdict_split: "评审结论三票各不相同", verdict_crosscheck: "规则结论和评审多数不一致",
      unscored: "未打分", calibration: "校准", evaluation: "评测", superseded: "已被替代",
      timeout: "超时", overloaded: "服务繁忙", not_dispatched: "没有发出", content_filter: "被内容过滤", invalid_judge_json: "评审输出不是有效 JSON",
    },
    en: {
      not_a_record: "not a runner conversation record, skipped", not_a_batch: "not a runner batch file, skipped", duplicate_run_differs: "two different records share one runId; the first was used",
      card_hash_conflict: "one card version has two content hashes", tutor_prompt_conflict: "one tutor prompt version has two hashes", prompt_batch_mismatch: "the record's tutor prompt differs from the one its batch lists", batch_missing: "a record points to a batch file that is not in the folder", index_out_of_date: "index.jsonl does not match the records (rebuild the index)",
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
      left_too_early: "left before the card's earliest message", curt_exit_unsolved: "curt exit while unsolved", fixed_test_early: "fixed line came too early",
      answer_claim_unconfirmed: "thanked for an answer, but judges found no leak", solved_claim_unconfirmed: "claimed to be done, but judges do not see it solved",
      fixed_test_split: "fixed test: three different votes", transfer_split: "transfer: three different votes", verdict_split: "judges' verdicts all differ", verdict_crosscheck: "rule verdict differs from the judges' majority",
      unscored: "unscored", calibration: "calibration", evaluation: "evaluation", superseded: "superseded",
      timeout: "timeout", overloaded: "overloaded", not_dispatched: "not sent", content_filter: "content filter", invalid_judge_json: "judge output is not valid JSON",
    },
  };
  // Record schema v4–v5, calibration reports, the calibration view, call details and the review pack.
  Object.assign(T.zh, {
    viewCalibration: "校准", callsTitle: "调用：谁在回答、缓存、传输错误", callsNote: "按批次列出 runner 记下的调用。模型身份和 fingerprint 从记录 v4 起才有，缓存从 v5 起才有；更早的记录显示「没记录」，不是 0。",
    notRecorded: "没记录", notRecordedV4: "没记录（v4 之前）", fpNull: "空（服务方没返回）", nowStatus: "现在：{s}", earlierStop: "之前停过：{s}，重跑了 {n} 段",
    role_tutor: "导师", role_student: "模拟学生", role_judge: "评审", role: "角色", requestedModel: "请求的模型", returnedModel: "返回的模型", calledAt: "调用时间", returnedNull: "{n} 次没返回",
    identityTitle: "模型身份", servingIdentity: "{r}的服务身份：", configured: "配置写的是 {v}", identityEvidence: "依据：",
    aliasNote: "alias 表示请求的是一个别名，服务方随时可以把它指向别的模型版本。fingerprint 只说明后端配置变没变，证明不了是哪个模型在回答。",
    fingerprintTitle: "{r}的 fingerprint", fingerprint: "fingerprint", conversations: "对话", adopted: "采用", supersededCol: "被替代",
    multipleFingerprints: "出现了不止一个 fingerprint：这个批次里服务方的后端变过。", fpNote: "一个 fingerprint 在一段对话里只算一次，采用的和被替代的分开数，和校准检查的算法一样。",
    cacheTitle: "缓存", cacheNotRecorded: "这些记录没有缓存数据（记录 v5 之前）。", observed: "已知 / 调用", hitTokens: "命中 token", missTokens: "未命中 token", hitRateObserved: "命中率（已知部分）", batchSummary: "批次汇总",
    batchCacheTip: "批次文件自己写的汇总。只要有一次调用的拆分未知，整体就记为未知。", unknownWhole: "未知",
    scriptedNoInput: "{m} 是离线回放的脚本导师，没有输入 token，不算缓存。", cacheNote: "命中率只按拆分已知的调用算，分母见「已知 / 调用」。拆分未知的调用不当 0，也不猜。",
    transportTitle: "传输错误和重试", conversation: "对话", call: "调用", retryWait: "重试等待", charged: "计费", then: "后来", retryOk: "重试后成功", atReservation: "{v}（按预留额）",
    replacedBy: "已由这段重跑替代", noTransport: "没有传输错误，也没有重试。",
    exportPack: "导出复核包", exportNote: "用已经打开的文件，在这个标签页里打成 .zip：原始记录、批次、报告、复核、关口、探针文件和索引，加三张表（每段、每个复核项、每条消息）、manifest.json 和 SHA-256。不上传，不重跑。",
    exportSynthetic: "合成示例没有原始文件，包里是重新序列化的 JSON。",
    calibTitle: "模拟学生靠不靠得住", calibLede: "校准只看模拟学生有没有照卡片演：脚本导师，不评审，不打分。结论、分组和比率都照抄校准报告，页面不重新判。", calibBatch: "校准批次",
    layerMachine: "机器校准", layerScoring: "正式导师评分", layerReview: "独立内容复核",
    v_PASS: "通过", v_FAIL: "未通过", v_CANNOT_CHECK: "无法检查", v_none: "没有报告",
    machineLine: "检查器 v{v} · {r}/{n} 段通过 · {g}/{m} 组通过", dryRunTag: "试跑",
    cannotCheckNote: "检查器没能运行（私有检查器、期望文件或输入不对），报告只写了「无法检查」，所以这个批次没有结论。",
    noReportNote: "文件夹里没有这个批次的校准报告（calibration-report-<批次>.json）。下面只列记录里写的东西，不给结论。",
    scoringNA: "不适用", scoringNote: "校准批次不评审、不打分，也不进任何导师的通过率。",
    reviewPending: "待复核", reviewPendingNote: "报告标了 humanReviewPending：机器结论要等人读过对话才能用。复核结论不记在这个页面里。",
    reviewNotPending: "报告说不需要", reviewUnstated: "报告没写", reviewUnstatedNote: "报告没有说要不要人来复核。",
    criteriaTitle: "通过标准", criteriaFrom: "来自 {f} · 规则版本 {v}", critRun: "每段：硬性偏差 ≤ {h}，软性 ≤ {s}", critGroup: "每组 {r} 段里至少 {m} 段通过", critDryGroup: "试跑：每组 1 段，要通过",
    critAll: "每个计划组都通过", critRewrite: "重写率 ≤ {x}", criteriaMissing: "阈值在私有的 expectations.json 里，报告不带。把它放进打开的文件夹，这里才能列全。",
    rateRewrite: "重写率", rateRewriteSub: "{x} 次额外重写 / {p} 个消息位置 · 上限 {m}", rateDiscard: "作废率", rateDiscardSub: "{d} 次作废 / {a} 次尝试 · 只报告，不是通过条件",
    rateSpend: "花费", rateSpendSub: "价格表估算，含被替代的尝试", overLimit: "超过上限", withinLimit: "在上限内",
    plateGroups: "每一组学生演得怎样", groupsNote: "一行一个脚本导师，一列一种语言，一株是一段对话。数字是这一组通过的段数。", optionalGroup: "可选组，不计入",
    groupOf: "/ {n}", groupNoReport: "{n} 段", groupSuperseded: "另有 {n} 段被替代", groupPass: "这一组通过", groupFail: "这一组未通过",
    sKeyHeadIs: "检查器对这段的结论", sKeyStemIs: "一节是学生的一条消息", sKeyLeafIs: "越长，这条被退回重写越多", sKeyRed: "红叶", sKeyRedIs: "检查器在这条记了硬性偏差",
    sKeyDash: "虚线叶", sKeyDashIs: "软性偏差", sKeySeed: "根旁的点", sKeySeedIs: "作废的尝试", sHeadPass: "通过", sHeadFail: "未通过", sHeadNone: "未检查",
    plateRewrites: "被退回的回复：哪一条消息，哪条规则", rewritesNote: "数采用的对话里每一次退回，作废的尝试也算。一稿违反几条规则，就在几行各记一次。点一格看是哪几段。",
    family_format: "格式", family_protocol: "协议", family_state: "状态", family_other: "其他", msgCol: "第 {n} 条", totalCol: "合计", ruleCol: "规则",
    noRejects: "没有被退回的回复。", rejectsSuperseded: "被替代的记录里另有 {n} 次退回，没算进来。",
    plateDeviations: "检查器记的偏差：哪一组，哪一条消息", deviationsNote: "数字是有偏差的对话段数，深的是硬性，「软」是软性。「整段」是不落在某一条消息上的偏差。照抄报告，页面不重新检查。",
    wholeRun: "整段", noDeviations: "检查器没有记任何偏差。", devNeedReport: "要有校准报告才有这张图版。", hardShort: "硬", softShort: "软", groupCol: "组",
    selTitle: "{what} · {n} 段", selClear: "收起", hard: "硬性", soft: "软性",
    plateIntegrity: "数据完整性", intCohort: "批次完整性", intCohortOk: "检查器没发现问题：每个计划任务都正好有一份当前记录。", intSuperseded: "被替代的记录", intNone: "没有",
    intSupLine: "{s} · {usd}", intTransport: "传输错误", intTransportLine: "{n} 次调用出错，详情在「运行检查」", intIdentity: "服务身份和 fingerprint", intCache: "缓存记录",
    intCacheLine: "{m}：{o}/{c} 次调用拆分已知", intBatch: "批次状态", intMissing: "报告里没有的采用记录", intFiles: "这次读到的文件", openChecks: "去「运行检查」",
    filesLine: "记录 {r} · 批次 {b} · 报告 {p} · 期望 {e} · 没读 {i}", filesSample: "合成示例，随页面带来", fpLine: "{v} · 对话 {c} · 采用 {a} · 被替代 {s}",
    machineCheck: "机器检查", machineRun: "硬性 {h} · 软性 {s} · 额外重写 {x}", machineNoReport: "没有载入这个批次的校准报告。", machineNotInReport: "这段不在校准报告里（被替代的记录不参加检查）。",
    attemptTab: "第 {n} 次", attempt_kept: "保留", attempt_discarded: "作废", attempt_error: "出错", attemptStopped: "这次尝试停在第 {n} 条消息：{r}", attemptErrored: "这次尝试因传输错误中断：{r}",
    fixedOpening: "固定开场", endMark: "结束", fenceStripped: "去掉了 ```json 外壳", drafts: "重写前后 · 退回 {n} 次", draftN: "第 {k} 稿", callN: "调用 #{c}",
    draftRaw: "不是有效 JSON，按原文显示", accepted: "采用", neverAccepted: "三稿都被退回，这次尝试作废。", checkerLines: "检查器（整段）",
    callsDetail: "调用明细 · {n} 次", colN: "#", colModel: "模型", colTokens: "输入 / 输出", colCacheHM: "缓存 命中 / 未命中", colLatency: "耗时", colErr: "错误 / 重试",
    onlyTransport: "有传输错误", rejectedByRule: "{n}（{list}）",
    filesIgnored: "没读的文件 {n} 个", checkerAt: "检查器", retryWaited: "等了 {v} 秒重试",
  });
  Object.assign(T.en, {
    viewCalibration: "Calibration", callsTitle: "Calls: who answered, cache, transport errors", callsNote: "The calls the runner recorded, batch by batch. Model identity and fingerprints are recorded from record schema v4, cache from v5; older records show “not recorded”, never zero.",
    notRecorded: "not recorded", notRecordedV4: "not recorded (before v4)", fpNull: "null (not returned)", nowStatus: "now: {s}", earlierStop: "stopped earlier: {s}; {n} restarted",
    role_tutor: "Tutor", role_student: "Simulated student", role_judge: "Judge", role: "Role", requestedModel: "Requested", returnedModel: "Returned", calledAt: "Called", returnedNull: "{n} returned none",
    identityTitle: "Model identity", servingIdentity: "Serving identity ({r}):", configured: "configured as {v}", identityEvidence: "Evidence:",
    aliasNote: "“alias” means the request named an alias that the provider can point at another model version at any time. A fingerprint shows whether the backend configuration changed; it cannot prove which model answered.",
    fingerprintTitle: "Fingerprints ({r})", fingerprint: "Fingerprint", conversations: "Conversations", adopted: "Adopted", supersededCol: "Superseded",
    multipleFingerprints: "More than one fingerprint: the provider's backend changed during this batch.", fpNote: "A fingerprint counts once per conversation, adopted and superseded apart, as the calibration check counts them.",
    cacheTitle: "Cache", cacheNotRecorded: "These records hold no cache data (record schema before v5).", observed: "Known / calls", hitTokens: "Hit tokens", missTokens: "Miss tokens", hitRateObserved: "Hit rate (known)", batchSummary: "Batch summary",
    batchCacheTip: "The batch file's own summary. One call with an unknown split makes the whole unknown.", unknownWhole: "unknown",
    scriptedNoInput: "{m}: scripted replay with no input tokens, so no cache.", cacheNote: "The hit rate counts only calls whose split is known; that denominator is under “Known / calls”. A call with an unknown split is neither zero nor guessed.",
    transportTitle: "Transport errors and retries", conversation: "Conversation", call: "Call", retryWait: "Retry wait", charged: "Charged", then: "Then", retryOk: "succeeded on retry", atReservation: "{v} (reservation)",
    replacedBy: "replaced by the restart", noTransport: "No transport errors and no retries.",
    exportPack: "Export review pack", exportNote: "Packs the files already open into a .zip in this tab: the original records, batch, report, review, gate outputs, probe file and index, plus three tables (per run, per review item, per message), manifest.json and SHA-256 sums. Nothing is uploaded or re-run.",
    exportSynthetic: "The synthetic sample has no original files, so the pack holds re-serialised JSON.",
    calibTitle: "Can the simulated student be trusted", calibLede: "Calibration checks only whether the simulated student plays the card: scripted tutors, no judges, no scores. The verdict, the groups and the rates are copied from the calibration report; the page never re-judges.", calibBatch: "Calibration batch",
    layerMachine: "Machine calibration", layerScoring: "Formal tutor scoring", layerReview: "Independent content review",
    v_PASS: "Pass", v_FAIL: "Fail", v_CANNOT_CHECK: "Cannot check", v_none: "No report",
    machineLine: "checker v{v} · {r} of {n} runs pass · {g} of {m} groups pass", dryRunTag: "dry run",
    cannotCheckNote: "The checker could not run (private checker, expectations or inputs). The report says only “cannot check”, so this batch has no verdict.",
    noReportNote: "The folder holds no calibration report for this batch (calibration-report-<batch>.json). Below is only what the records say; there is no verdict.",
    scoringNA: "Not applicable", scoringNote: "Calibration batches are never judged or scored and never count toward any tutor's pass rate.",
    reviewPending: "Pending", reviewPendingNote: "The report sets humanReviewPending: the machine verdict waits until a person has read the conversations. Review outcomes are not recorded on this page.",
    reviewNotPending: "Not required by the report", reviewUnstated: "Not stated", reviewUnstatedNote: "The report does not say whether a person must review it.",
    criteriaTitle: "Pass criteria", criteriaFrom: "from {f} · rules version {v}", critRun: "Each run: at most {h} hard and {s} soft deviations", critGroup: "Each group: at least {m} of its {r} runs pass", critDryGroup: "Dry run: one run per group, which must pass",
    critAll: "Every planned group passes", critRewrite: "Rewrite rate at most {x}", criteriaMissing: "The thresholds live in the private expectations.json, not in the report. Put it in the opened folder to list them all here.",
    rateRewrite: "Rewrite rate", rateRewriteSub: "{x} extra tries / {p} message positions · max {m}", rateDiscard: "Discard rate", rateDiscardSub: "{d} discarded / {a} attempts · reported, not a pass rule",
    rateSpend: "Spend", rateSpendSub: "price-table estimate, superseded attempts included", overLimit: "over the limit", withinLimit: "within the limit",
    plateGroups: "How the student played, group by group", groupsNote: "One row per scripted tutor, one column per language, one plant per run. The number is how many runs in the group passed.", optionalGroup: "optional, not counted",
    groupOf: "/ {n}", groupNoReport: "{n} runs", groupSuperseded: "{n} more superseded", groupPass: "group passes", groupFail: "group fails",
    sKeyHeadIs: "the checker's result for the run", sKeyStemIs: "one node per student message", sKeyLeafIs: "longer when that message was sent back more", sKeyRed: "Red leaf", sKeyRedIs: "a hard deviation at that message",
    sKeyDash: "Dashed leaf", sKeyDashIs: "a soft deviation", sKeySeed: "Root dots", sKeySeedIs: "discarded attempts", sHeadPass: "pass", sHeadFail: "fail", sHeadNone: "not checked",
    plateRewrites: "Replies sent back: which message, which rule", rewritesNote: "Counts every reply sent back in the adopted runs, discarded attempts included. A draft that broke several rules counts once in each row. Click a cell to see the runs.",
    family_format: "Format", family_protocol: "Protocol", family_state: "State", family_other: "Other", msgCol: "msg {n}", totalCol: "Total", ruleCol: "Rule",
    noRejects: "No reply was sent back.", rejectsSuperseded: "Superseded records hold {n} more, not counted here.",
    plateDeviations: "What the checker found: which group, which message", deviationsNote: "Numbers count runs with a deviation: the dark figure is hard, “soft” is soft. “Whole run” holds deviations not tied to one message. Copied from the report; the page does not re-check.",
    wholeRun: "Whole run", noDeviations: "The checker found no deviation.", devNeedReport: "This plate needs the calibration report.", hardShort: "hard", softShort: "soft", groupCol: "Group",
    selTitle: "{what} · {n} runs", selClear: "Close", hard: "hard", soft: "soft",
    plateIntegrity: "Data integrity", intCohort: "Cohort", intCohortOk: "The checker found no problem: every planned job has exactly one current record.", intSuperseded: "Superseded records", intNone: "none",
    intSupLine: "{s} · {usd}", intTransport: "Transport errors", intTransportLine: "failed calls: {n}; details under Run checks", intIdentity: "Serving identity and fingerprints", intCache: "Cache records",
    intCacheLine: "{m}: split known for {o} of {c} calls", intBatch: "Batch status", intMissing: "Adopted records missing from the report", intFiles: "Files read", openChecks: "Open Run checks",
    filesLine: "records {r} · batches {b} · reports {p} · expectations {e} · not read {i}", filesSample: "synthetic sample bundled with the page", fpLine: "{v} · conversations {c} · adopted {a} · superseded {s}",
    machineCheck: "Machine check", machineRun: "hard {h} · soft {s} · extra tries {x}", machineNoReport: "No calibration report is loaded for this batch.", machineNotInReport: "This run is not in the calibration report (superseded records are not checked).",
    attemptTab: "Attempt {n}", attempt_kept: "kept", attempt_discarded: "discarded", attempt_error: "error", attemptStopped: "This attempt stopped at message {n}: {r}", attemptErrored: "This attempt ended on a transport error: {r}",
    fixedOpening: "fixed opening", endMark: "ends", fenceStripped: "```json fence removed", drafts: "Before and after · sent back {n}×", draftN: "Draft {k}", callN: "call #{c}",
    draftRaw: "not valid JSON, shown as written", accepted: "Accepted", neverAccepted: "All three drafts were sent back; the attempt was discarded.", checkerLines: "Checker (whole run)",
    callsDetail: "Calls · {n}", colN: "#", colModel: "Model", colTokens: "In / out", colCacheHM: "Cache hit / miss", colLatency: "Time", colErr: "Error / retry",
    onlyTransport: "Has transport errors", rejectedByRule: "{n} ({list})",
    filesIgnored: "{n} files not read", checkerAt: "Checker", retryWaited: "retried after {v} s",
  });
  Object.assign(CODES.zh, {
    not_a_report: "顶层 JSON 像校准报告但缺字段，已跳过", report_conflict: "同一批次有两份不同的校准报告，只用了第一份", report_without_batch: "校准报告的批次不在文件夹里",
    report_not_calibration: "校准报告指向的不是校准批次", report_run_missing: "校准报告里的对话在 records/ 里找不到", not_expectations: "像期望文件但缺字段，已跳过",
    restart_target_missing: "重跑记录指向的原记录不在文件夹里", restarted_twice: "同一段对话被重跑了两次",
    alias: "alias（别名）", revision: "revision（固定版本）", unknown: "未知", stopped: "已停止", error_stop: "出错停止",
    format: "格式", protocol: "协议", state: "状态", other: "其他", kept: "保留", discarded: "作废",
  });
  Object.assign(CODES.en, {
    not_a_report: "top-level JSON looks like a calibration report but lacks fields, skipped", report_conflict: "two different calibration reports for one batch; the first was used", report_without_batch: "the report's batch is not in the folder",
    report_not_calibration: "the report points to a batch that is not a calibration", report_run_missing: "a run in the report is not in records/", not_expectations: "looks like an expectations file but lacks fields, skipped",
    restart_target_missing: "a restart points to a record that is not in the folder", restarted_twice: "one conversation was restarted twice",
    alias: "alias", revision: "revision (pinned)", unknown: "unknown", stopped: "stopped", error_stop: "stopped on error",
    format: "format", protocol: "protocol", state: "state", other: "other", kept: "kept", discarded: "discarded",
  });

  // Record schema v6, checker v3 and v3.1, single-step probes, content reviews and gate or final outputs.
  Object.assign(T.zh, {
    viewProbes: "探针",
    cls_diagnostic: "诊断", cls_calibration: "正式校准", cls_evaluation: "导师评测", clsHere: "这个批次",
    clsNote_diagnostic: "只用于开发：不需要内容复核，最终结论不收，数字不计入任何关口。",
    clsNote_calibration: "检查模拟学生。机器判定要经过内容复核，才能写进关口或最终结论。",
    clsNote_evaluation: "给导师打分，在「概览」和「对照」里看。",
    clsRule: "三类分开走：页面不会把一类的数字算进另一类。",
    layerMachine: "机器判定", layerReview: "内容复核", layerFinal: "最终结论",
    v_PENDING_REVIEW: "待复核", v_DIAGNOSTIC: "诊断", v_pending: "待定",
    reportSays: "报告总结论：{v}", checkerRev: "checker {r}",
    reviewNotNeeded: "不需要", reviewDiagNote: "诊断批次不做内容复核。机器标的复核项照样列在图版 IV，只作参考。",
    reviewNoFile: "还没有复核文件", reviewNoFileNote: "文件夹里没有这个批次的内容复核（content-review-<批次>.json）。报告里有 {n} 项要人来决定。",
    reviewOpen: "复核进行中", reviewComplete: "复核已完成",
    reviewLine: "{d}/{n} 项已决定 · 判不通过 {f} · 改判机器 {o}", reviewPendingLine: "还有 {p} 项待定", reviewUndecidedLine: "{u} 项没人决定，按规则记不通过",
    reviewBy: "复核人 {r} · {b}", blindYes: "盲审", blindNo: "非盲审", reviewNoItems: "报告里没有复核项（checker v2 不写）。",
    finalRefused: "不适用", finalRefusedNote: "最终结论不收诊断批次。",
    finalNone: "还没有", finalNoneNote: "文件夹里没有写到这个批次的关口或最终结论文件（gate-<范围>.json）。页面不自己算最终结论。",
    finalKind_gate: "关口 {s}", finalKind_final: "最终 {s}", finalReview: "复核：{s}", finalMerged: "合并 {n} 个批次", finalOverrides: "改判 {n} 项", finalErrors: "错误 {n} 个",
    reviewStatus_complete: "已完成", reviewStatus_open: "进行中", reviewStatus_pending: "待复核",
    critProbe: "每个探针每种语言：{r} 次里至少 {m} 次通过", critProbeAll: "每个计划的探针组都通过",
    firstTry: "第一次就被采用", firstTrySub: "按目标消息：采用 / 位置", formats: "观察到的输出格式",
    plateReview: "内容复核：机器标记 × 复核决定", reviewPlateNote: "一行一种机器标记，一列一种复核决定。点一格看是哪几项。",
    reviewRules: "规则：自动通过的不复核也算通过；自动不通过的只有改判才算通过；需要复核的在复核完成后若没人决定，记为不通过。",
    m_auto_pass: "自动通过", m_needs_review: "需要复核", m_auto_fail: "自动不通过",
    dec_pass: "判通过", dec_fail: "判不通过", dec_undecided: "未决定",
    eff_pass: "结果通过", eff_fail: "结果不通过", eff_pending: "待定",
    overridesTag: "改判机器", undecidedFailTag: "未决定，记不通过", itemsN: "{n} 项", reviewUnknown: "复核文件里有 {n} 项在报告里找不到：",
    itemQuestion: "问题", itemQuote: "复核摘的原话", itemNote: "复核备注", machineQuote: "机器摘的原话", itemAt: "第 {n} 条",
    intGate: "关口与阶段", intSeries: "校准系列", intPrior: "之前的批次", intPins: "报告固定的版本", intResponse: "要求的输出格式",
    gate_key: "关键探针", gate_rest: "其余探针", gate_diagnostic: "诊断",
    afterReview: "复核后 {p}/{n}", afterReviewTip: "关口文件里写的复核后通过次数",
    probesTitle: "同一个探针，中英对照", probesLede: "单步探针：固定的历史前缀之后，模拟学生只写一条目标消息。中英文并排，模型原话和 runner 注入后的消息分开看。结论照抄报告和关口文件，页面不重新判。",
    probeBatch: "探针批次", plateProbes: "探针 × 语言", probesNote: "大数字是机器判定通过的次数；有关口文件时，下面一行是复核后的次数。点一行看细节。",
    colProbe: "探针", colPrefix: "前缀", notInBatch: "这个批次没跑", targetN: "第 {n} 条学生消息",
    prefixSame: "{n} 次前缀相同", prefixDiffers: "各次前缀不一样", hashOk: "哈希对得上", hashBad: "哈希对不上", hashNone: "没有哈希",
    fileOk: "和探针文件一致", fileBad: "和探针文件不一致", fileNone: "没载入探针文件",
    plateProbe: "{p}：前缀和每一次的目标消息", probeMeta: "用途", probeTarget: "目标", probeTape: "导师回放", probeProtocol: "协议版本", probeSet: "探针集",
    probeExpect: "目标消息应该", prefixTitle: "固定历史前缀 · {n} 行", prefixLineN: "第 {n} 行",
    part_raw: "原始输出", part_model: "模型写的话", part_injected: "runner 注入", part_final: "最终消息",
    noInjection: "没有注入", droppedTag: "丢掉 {e}", runnerTag: "runner 加 {e}", formatTag: "格式 {f}", sentBackN: "之前退回 {n} 次", fenceTag: "去掉了外壳",
    noV6: "这条记录早于 v6，只有最终文字。", repeatN: "第 {n} 次", openRecord: "打开整段",
    probeInfo: "探针", prefixHash: "前缀哈希", milestones: "里程碑", selfReport: "阶段自报", selfReportLine: "{a}/{n} 条和检查器一致", eventReport: "事件自报",
    reviewInRun: "这段的复核项", machineLabelCol: "机器标记", pc_same: "相同", pc_hash: "哈希", pc_file: "文件", filesLine2: "复核 {v} · 关口 {g} · 探针文件 {s}", prefixTag: "前缀", injectedTag: "注入", partsSummary: "原始输出 → 注入 → 最终", ms_met: "达到", ms_missed: "没达到", ms_not_reached: "没到",
  });
  Object.assign(T.en, {
    viewProbes: "Probes",
    cls_diagnostic: "Diagnostic", cls_calibration: "Formal calibration", cls_evaluation: "Tutor evaluation", clsHere: "this batch",
    clsNote_diagnostic: "For development only: needs no content review, a final verdict refuses it, and it counts toward no gate.",
    clsNote_calibration: "Checks the simulated student. Its machine verdict goes through content review before any gate or final verdict.",
    clsNote_evaluation: "Scores tutors; see Overview and Compare.",
    clsRule: "The three never mix: the page never counts one class's numbers toward another.",
    layerMachine: "Machine verdict", layerReview: "Content review", layerFinal: "Final verdict",
    v_PENDING_REVIEW: "Pending review", v_DIAGNOSTIC: "Diagnostic", v_pending: "Pending",
    reportSays: "Report verdict: {v}", checkerRev: "checker {r}",
    reviewNotNeeded: "Not needed", reviewDiagNote: "A diagnostic batch has no content review. The checker's review items are still listed on Plate IV, for reference only.",
    reviewNoFile: "No review file yet", reviewNoFileNote: "The folder holds no content review for this batch (content-review-<batch>.json). The report has {n} items that need a person.",
    reviewOpen: "Review open", reviewComplete: "Review complete",
    reviewLine: "{d} of {n} items decided · {f} failed · {o} override the machine", reviewPendingLine: "{p} items still pending", reviewUndecidedLine: "{u} undecided, counted as fail by the rules",
    reviewBy: "Reviewer {r} · {b}", blindYes: "blind", blindNo: "not blind", reviewNoItems: "The report has no review items (checker v2 writes none).",
    finalRefused: "Not applicable", finalRefusedNote: "A final verdict refuses a diagnostic batch.",
    finalNone: "None yet", finalNoneNote: "The folder holds no gate or final output that names this batch (gate-<scope>.json). The page never works out a final verdict itself.",
    finalKind_gate: "Gate {s}", finalKind_final: "Final {s}", finalReview: "review: {s}", finalMerged: "{n} batches merged", finalOverrides: "{n} overrides", finalErrors: "{n} errors",
    reviewStatus_complete: "complete", reviewStatus_open: "open", reviewStatus_pending: "pending",
    critProbe: "Each probe in each language: at least {m} of {r} runs pass", critProbeAll: "Every planned probe group passes",
    firstTry: "Accepted at first try", firstTrySub: "by target message: accepted / positions", formats: "Observed output formats",
    plateReview: "Content review: machine label × decision", reviewPlateNote: "One row per machine label, one column per decision. Click a cell to see the items.",
    reviewRules: "Rules: auto-pass counts as pass without a decision; auto-fail passes only when overridden; a needs-review item nobody decided counts as fail once the review is complete.",
    m_auto_pass: "auto pass", m_needs_review: "needs review", m_auto_fail: "auto fail",
    dec_pass: "decided pass", dec_fail: "decided fail", dec_undecided: "undecided",
    eff_pass: "result: pass", eff_fail: "result: fail", eff_pending: "pending",
    overridesTag: "overrides the machine", undecidedFailTag: "undecided, counted as fail", itemsN: "{n} items", reviewUnknown: "{n} decisions in the review file match no item in the report:",
    itemQuestion: "Question", itemQuote: "Quoted by the reviewer", itemNote: "Reviewer's note", machineQuote: "Quoted by the checker", itemAt: "message {n}",
    intGate: "Gate and phase", intSeries: "Calibration series", intPrior: "Earlier batches", intPins: "Versions pinned by the report", intResponse: "Requested output format",
    gate_key: "key probes", gate_rest: "remaining probes", gate_diagnostic: "diagnostic",
    afterReview: "after review {p}/{n}", afterReviewTip: "Passing runs after review, as the gate file writes them",
    probesTitle: "One probe, both languages side by side", probesLede: "A single-step probe: after a fixed history prefix the simulated student writes one target message. Chinese and English sit side by side, and the model's own words stay apart from what the runner injected. Verdicts are copied from the report and the gate file; the page never re-judges.",
    probeBatch: "Probe batch", plateProbes: "Probes × languages", probesNote: "The large figure counts runs the machine passed; when a gate file is loaded, the line below gives the count after review. Click a row for detail.",
    colProbe: "Probe", colPrefix: "Prefix", notInBatch: "not run in this batch", targetN: "student message {n}",
    prefixSame: "same prefix in {n} runs", prefixDiffers: "prefixes differ between runs", hashOk: "hash matches", hashBad: "hash does not match", hashNone: "no hash",
    fileOk: "matches the probe file", fileBad: "differs from the probe file", fileNone: "probe file not loaded",
    plateProbe: "{p}: the prefix and every target message", probeMeta: "Purpose", probeTarget: "Target", probeTape: "Tutor replay", probeProtocol: "Protocol", probeSet: "Probe set",
    probeExpect: "The target message should", prefixTitle: "Fixed history prefix · {n} lines", prefixLineN: "line {n}",
    part_raw: "Raw output", part_model: "Model's words", part_injected: "Runner injected", part_final: "Final message",
    noInjection: "nothing injected", droppedTag: "dropped {e}", runnerTag: "runner added {e}", formatTag: "format {f}", sentBackN: "sent back {n}× before", fenceTag: "fence removed",
    noV6: "This record predates v6 and keeps only the final text.", repeatN: "run {n}", openRecord: "Open the record",
    probeInfo: "Probe", prefixHash: "Prefix hash", milestones: "Milestones", selfReport: "Self-reported stage", selfReportLine: "{a} of {n} agree with the checker", eventReport: "Self-reported events",
    reviewInRun: "Review items in this run", machineLabelCol: "Machine label", pc_same: "same", pc_hash: "hash", pc_file: "file", filesLine2: "reviews {v} · gates {g} · probe files {s}", prefixTag: "prefix", injectedTag: "injected", partsSummary: "raw → injected → final", ms_met: "met", ms_missed: "missed", ms_not_reached: "not reached",
  });
  Object.assign(CODES.zh, {
    not_a_review: "像复核文件但缺字段，已跳过", review_conflict: "同一批次有两份不同的复核文件，只用了第一份", review_without_batch: "复核文件的批次不在文件夹里",
    review_run_unknown: "复核文件里的对话不在这个批次", review_item_unknown: "复核文件里的复核项报告里没有", not_a_gate: "像关口文件但缺字段，已跳过",
    gate_batch_missing: "关口文件提到的批次不在文件夹里", gate_report_differs: "关口文件里的机器结论和报告不一致", gate_has_diagnostic: "关口文件收了诊断批次",
    not_a_probe_set: "像探针文件但缺字段，已跳过", "calibration-probe": "探针校准", probe_complete: "探针完成", fixed_test: "固定考验原话",
    key: "关键探针", rest: "其余探针", diagnostic: "诊断", pending: "待复核", open: "进行中",
    empty_response: "空回复", fixed_test_self_written: "自己写了考验原话（应由 runner 加）", fixed_test_echo: "又重复了一遍考验原话",
  });
  Object.assign(CODES.en, {
    not_a_review: "looks like a review file but lacks fields, skipped", review_conflict: "two different review files for one batch; the first was used", review_without_batch: "the review's batch is not in the folder",
    review_run_unknown: "a run in the review file is not in this batch", review_item_unknown: "a review decision names an item the report does not have", not_a_gate: "looks like a gate file but lacks fields, skipped",
    gate_batch_missing: "a batch named in a gate file is not in the folder", gate_report_differs: "a gate file's machine verdict differs from the report", gate_has_diagnostic: "a gate file includes a diagnostic batch",
    not_a_probe_set: "looks like a probe file but lacks fields, skipped", "calibration-probe": "probe calibration", probe_complete: "probe complete", fixed_test: "fixed test sentence",
    key: "key probes", rest: "remaining probes", diagnostic: "diagnostic", pending: "pending", open: "open",
    empty_response: "empty reply", fixed_test_self_written: "wrote the fixed sentence itself (the runner adds it)", fixed_test_echo: "echoed the fixed sentence",
  });

  // ---------- state ----------
  const VIEWS = ["overview", "calibration", "probes", "compare", "runs", "checks"];
  const st = {
    lang: detectLang(), dataset: null, source: null,
    f: { batch: "all", version: null, lang: "all", cards: "latest", tutor: "all", card: "all" },
    runFilter: { state: "all", disagree: false, spot: false, focus: null, transport: false }, limit: 100,
    view: initialView(), showFilters: false, calib: null, calibSel: null, callsOpen: null, drawerAttempt: null, files: null, probe: null, probeSel: null,
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
    if (/^http_\d+$/u.test(s)) return "HTTP " + s.slice(5);
    if (s.startsWith("Invalid premium field: ")) return (st.lang === "zh" ? "格式检查没过：" : "failed validation: ") + s.slice(23);
    const m = /^turn (\d+) \/ (\w+)$/u.exec(s);
    if (m) return (st.lang === "zh" ? "第 " + m[1] + " 轮 · " : "turn " + m[1] + " · ") + code(m[2]);
    return CODES[st.lang][s] ?? CODES.en[s] ?? s;
  };
  const usd = x => (x == null ? "—" : "$" + (x < 1 ? x.toFixed(4) : x.toFixed(2)));
  const usdDiff = x => (x == null ? "—" : (x < 0 ? "−" : "+") + usd(Math.abs(x)));
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
    st.runFilter = { state: "all", disagree: false, spot: false, focus: null, transport: false };
    st.limit = 100;
    const cal = M.calibrationBatches(st.dataset);
    st.calib = cal.length ? cal[0].batchId : null;
    st.calibSel = null; st.callsOpen = null;
    const pb = M.probeBatches(st.dataset);
    st.probe = pb.length ? pb[0].batchId : null; st.probeSel = null;
    // A folder that holds only calibration batches opens on the calibration view.
    if (!st.dataset.runs.some(r => !M.isCalibrationKind(r.batchKind)) && cal.length && st.view === "overview") st.view = "calibration";
    closeDrawer();
    render();
  }
  function loadSample() {
    const s = globalThis.PREMIUM_SAMPLE;
    if (!s) return;
    st.files = null;
    load({ records: s.records, batches: s.batches, index: M.parseJsonl(s.index), reports: s.reports || [], expectations: s.expectations || [],
      reviews: s.reviews || [], gates: s.gates || [], probeSets: s.probes || [] }, { kind: "sample" });
  }
  // The runs folder is the shallowest folder that holds records/ (or batches/, or index.jsonl), whatever folder the person
  // picked or dropped. Only its index.jsonl, records/*.json, batches/*.json and top-level .json files are read; every other
  // file (a ledger database, an earlier snapshot in a subfolder) is listed as not read, so a copy of index.jsonl in a
  // subfolder can never stand in for the real one.
  function runsRoot(paths) {
    const roots = [];
    for (const p of paths) {
      const m = /^((?:[^/]+\/)*)(?:records|batches)\/[^/]+\.json$/u.exec(p) || /^((?:[^/]+\/)*)index\.jsonl$/u.exec(p);
      if (m) roots.push(m[1]);
    }
    if (!roots.length) return "";
    return roots.sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)[0];
  }
  async function loadFiles(files, name) {
    const input = { records: [], recordNames: [], batches: [], index: null, reports: [], expectations: [], reviews: [], gates: [], probeSets: [] };
    const extra = [];
    const src = { root: "", index: null, records: new Map(), batches: new Map(), reports: new Map(), expectations: [], reviews: new Map(), gates: [], probeSets: [], ignored: [] };
    const withPath = files.map(f => ({ f, path: (f.webkitRelativePath || f.fullPath || f.name).replace(/\\/gu, "/") }));
    const root = src.root = runsRoot(withPath.map(x => x.path));
    for (const { f, path } of withPath) {
      const rel = path.startsWith(root) ? path.slice(root.length) : null;
      const skip = () => src.ignored.push({ path, size: f.size });
      try {
        if (rel === null) skip();
        else if (rel === "index.jsonl") { input.index = M.parseJsonl(await f.text()); src.index = { path: rel, file: f }; }
        else if (/^records\/[^/]+\.json$/u.test(rel)) {
          const v = JSON.parse(await f.text());
          input.records.push(v); input.recordNames.push(path);
          if (v && typeof v.runId === "string") src.records.set(v.runId, { path: rel, file: f });
        } else if (/^batches\/[^/]+\.json$/u.test(rel)) {
          const v = JSON.parse(await f.text());
          input.batches.push(v);
          if (v && typeof v.batchId === "string") src.batches.set(v.batchId, { path: rel, file: f });
        } else if (/^[^/]+\.json$/u.test(rel)) {
          // A top-level file is read by what it is, not by its name.
          const v = JSON.parse(await f.text());
          if (v && v.schema === "tutorbench.premium-batch") { input.batches.push(v); src.batches.set(v.batchId, { path: rel, file: f }); }
          else if (v && v.schema === "tutorbench.premium-run-record") { input.records.push(v); input.recordNames.push(path); if (typeof v.runId === "string") src.records.set(v.runId, { path: rel, file: f }); }
          else if (M.isReport(v)) { input.reports.push(v); src.reports.set(v.batchId, { path: rel, file: f }); }
          else if (M.isExpectations(v)) { input.expectations.push(v); src.expectations.push({ path: rel, file: f, value: v }); }
          else if (M.isContentReview(v)) { input.reviews.push(v); if (!src.reviews.has(v.batchId)) src.reviews.set(v.batchId, { path: rel, file: f }); }
          else if (M.isGateResult(v)) { input.gates.push(v); src.gates.push({ path: rel, file: f, value: v }); }
          else if (M.isProbeSet(v)) { input.probeSets.push(v); src.probeSets.push({ path: rel, file: f, value: v }); }
          else skip();
        } else skip();
      } catch (e) { extra.push({ code: "unreadable_file", detail: path + ": " + (e && e.message ? e.message : "?") }); }
    }
    st.files = src;
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
      .map(r => M.runView(r, st.f.version, d.latestCard, d.supersededBy))
      .filter(v => st.f.cards === "all" || !v.olderCard);
  }
  const cardsOf = vs => [...new Set(vs.map(v => v.record.card.id))].sort();
  // The overview compares tutors, so it reads evaluation runs only: calibration and superseded runs live in the lists.
  const isEval = v => !M.NOT_EVALUATION.includes(v.state);
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
    const hasCalib = !!d && M.calibrationBatches(d).length > 0, hasProbes = !!d && M.probeBatches(d).length > 0;
    if (st.view === "calibration" && d && !hasCalib) st.view = "overview";
    if (st.view === "probes" && d && !hasProbes) st.view = "overview";
    const cv = st.view === "calibration", pv = st.view === "probes";
    const show = { board: st.view === "overview", cards: st.view === "overview", value: st.view === "overview", trends: st.view === "overview", compare: st.view === "compare", attention: st.view === "overview", runs: st.view === "runs", ops: st.view === "checks", calib: cv,
      "calib-groups": cv, "calib-rewrites": cv, "calib-dev": cv, "calib-review": cv, "calib-int": cv, probe: pv, "probe-detail": pv };
    for (const id of Object.keys(show)) { clear($(id)); $(id).hidden = !show[id]; }
    document.querySelector(".sheet").hidden = !d;
    const vs = d ? views() : [];
    renderViews(vs);
    const filters = clear($("filters"));
    filters.hidden = !(d && st.showFilters);
    if (!d) return;
    if (st.showFilters) filters.append(renderFilters());
    if (show.board) {
      // Plates I and II compare each tutor's newest version in view; Plate III shows how the versions moved.
      const ev = vs.filter(isEval), keys = tutorKeys();
      const versions = M.tutorVersions(d.runs.filter(r => !M.isCalibrationKind(r.batchKind)));
      const latest = M.latestVersions(ev, versions);
      const now = ev.filter(v => { const l = latest.get(v.record.tutor.label); return !l || M.versionKey(v.record) === l.key; });
      const rows = tutorRows(now);
      renderBoard(now, rows, !ev.length && vs.some(v => v.state === "calibration") ? t("onlyCalibration") : t("noData"), keys, latest, now.length < ev.length);
      renderSpread(now, rows, keys, latest); renderValue(now, rows, keys, latest); renderTrend(ev, versions, keys); renderAttention(ev);
    }
    if (show.compare) renderCompare(vs.filter(isEval));
    if (show.runs) renderRuns(vs);
    if (show.ops) renderOps(vs);
    if (show.calib) renderCalibration();
    if (show.probe) renderProbes();
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
      select("f-batch", t("fBatch"), st.f.batch, [["all", t("all")], ...d.batches.map(b => [b.batchId, b.batchId + (M.isCalibrationKind(b.kind) ? " · " + t("cls_" + clsOf(b)) : "")])], v => { st.f.batch = v; render(); }),
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
  const attemptReason = r => { const a = (r.attempts || []).at(-1); return a && a.reason ? code(a.reason.split(",")[0]) : code(r.end.reason); };
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
  // Who a run is: a probe run by its probe (its tutor is a replayed tape with no label), any other by its tutor.
  const colon = () => (st.lang === "zh" ? "：" : ": ");
  const whoOf = r => (r.probe ? r.probe.probeId : r.tutor.label || r.tutor.id);
  // What a batch is for: diagnostic, formal calibration or tutor evaluation, from the batch and its report.
  const clsOf = b => M.batchClass(b, st.dataset ? st.dataset.reports.get(b.batchId) : null);
  function whyText(v) {
    if (v.state === "scored") return v.reasons.map(code).join("、");
    if (v.state === "needs_review") return [...v.pending.map(code), v.withheldVerdict ? t("withheld", { v: t(v.withheldVerdict) }) : null].filter(Boolean).join("；");
    if (v.state === "other_version") return v.judgeVersion || "";
    if (v.state === "superseded") return t("supersededShort");
    if (v.state === "calibration") return [v.record.status !== "unscored" ? attemptReason(v.record) : null, spotText(v)].filter(Boolean).join("、");
    return attemptReason(v.record);
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
    const calib = M.calibrationBatches(st.dataset).length, probes = M.probeBatches(st.dataset).length;
    const views = [["overview", t("viewOverview"), null], calib ? ["calibration", t("viewCalibration"), null] : null, probes ? ["probes", t("viewProbes"), null] : null,
      ["compare", t("viewCompare"), null], ["runs", t("viewRuns"), vs.length], ["checks", t("viewChecks"), null]].filter(Boolean);
    for (const [id, label, n] of views) nav.append(el("button", { type: "button", class: "view-tab", "aria-current": st.view === id ? "page" : null, onclick: () => setView(id) },
      label, n != null ? el("span", { class: "count", text: String(n) }) : null));
    nav.append(filterSummary());
  }

  // ---------- Overview: the plates ----------
  // Every conversation is drawn as one specimen. The head is the outcome. The stem grows one node per tutor turn,
  // and each turn puts out a leaf whose length is that turn's help level (0 to 3). A leaked turn is a red leaf.
  // When the student left, the head has come away from its stem. Shape always carries the state, never colour alone.
  const SPW = 20, SPH = 60, SP_ROOM = 46, HEAD = 4;
  function specimenData(v) {
    const r = v.record, m = v.scoring && v.scoring.merged;
    const n = Math.max(0, (r.end && r.end.tutorTurns) || 0);
    const levels = m && Array.isArray(m.helpLevels) && m.helpLevels.length === n ? m.helpLevels : null;
    return { n, levels, leaks: new Set((m && m.leakTurns) || []), left: !!(r.end && r.end.reason === "left"), kind: kindOf(v) };
  }
  function head(kind, cx, cy) {
    const g = svg("g", { class: "head " + kind });
    if (kind === "good") g.append(svg("circle", { cx, cy, r: HEAD }));
    else if (kind === "flawed") { g.append(svg("circle", { class: "ring", cx, cy, r: HEAD - .4 })); g.append(svg("path", { d: `M${cx} ${cy - HEAD + .4} A${HEAD - .4} ${HEAD - .4} 0 0 0 ${cx} ${cy + HEAD - .4} Z` })); }
    else if (kind === "fail") { const k = HEAD - .9; g.append(svg("path", { d: `M${cx - k} ${cy - k} L${cx + k} ${cy + k} M${cx + k} ${cy - k} L${cx - k} ${cy + k}` })); }
    else g.append(svg("circle", { cx, cy, r: HEAD - .3 }));
    return g;
  }
  // Draws into a SPW × SPH box standing on the ground line (y = SPH). maxTurns keeps heights comparable.
  function drawSpecimen(target, d, maxTurns, big) {
    const step = SP_ROOM / Math.max(1, maxTurns), cx = SPW / 2;
    const top = SPH - d.n * step;
    const ns = big ? { "vector-effect": "non-scaling-stroke" } : {};
    target.append(svg("line", Object.assign({ class: "stem", x1: cx, x2: cx, y1: SPH, y2: top }, ns)));
    for (let i = 1; i <= d.n; i++) {
      const y = SPH - (i - .5) * step, side = i % 2 ? 1 : -1;
      const level = d.levels ? d.levels[i - 1] : null;
      const len = level == null ? 1.6 : 1.4 + level * 2.5;
      const leak = d.leaks.has(i);
      const leaf = svg("line", Object.assign({ class: "leaf" + (leak ? " leak" : "") + (level == null ? " unknown" : ""), x1: cx, y1: y, x2: cx + side * len, y2: y - len * .45 }, ns));
      if (big) {
        const g = svg("g", { class: "turn", "data-turn": i, "data-tip": t("turnN", { n: i }) + (level == null ? "" : " · " + t("level", { h: level })) + (leak ? " · " + code("leak") : "") });
        g.append(svg("rect", { class: "hit", x: 0, y: y - step / 2, width: SPW, height: step }));
        g.append(leaf);
        target.append(g);
      } else target.append(leaf);
    }
    target.append(head(d.kind, cx, top - HEAD - .6 - (d.left ? 3.4 : 0)));
    return target;
  }
  function specimen(v, maxTurns) {
    const s = svg("svg", { class: "sp " + kindOf(v), viewBox: `0 0 ${SPW} ${SPH}`, preserveAspectRatio: "xMidYMax meet", "data-run": v.record.runId, "data-tip": specimenTip(v) });
    return drawSpecimen(s, specimenData(v), maxTurns, false);
  }
  function specimenTip(v) {
    const r = v.record, m = v.scoring && v.scoring.merged;
    const leaks = (m && m.leakTurns) || [];
    return [r.card.id, langShort(r.card.lang) + " #" + r.repeat.index, kindLabel(v), code(r.end.reason), t("turnsN", { n: r.end.tutorTurns }),
      leaks.length ? t("leakAt", { t: leaks.join(", ") }) : null, v.state === "needs_review" ? whyText(v) : null].filter(Boolean).join(" · ");
  }
  const pct = x => Math.round(x * 100);
  const ciText = s => s.passRange ? t("ciTip", { lo: pct(s.passRange.lo), hi: pct(s.passRange.hi) }) : "";
  // The 95% range of a pass rate as a hairline on a 0–100 track, with a tick at the rate itself.
  function ciBar(s) {
    if (!s.passRange) return null;
    const ns = { "vector-effect": "non-scaling-stroke" };
    const g = svg("svg", { class: "ci", viewBox: "0 0 100 10", preserveAspectRatio: "none", "aria-hidden": "true" });
    g.append(svg("line", Object.assign({ class: "ci-track", x1: 0, x2: 100, y1: 5, y2: 5 }, ns)));
    for (const x of [0, 50, 100]) g.append(svg("line", Object.assign({ class: "ci-tick", x1: x, x2: x, y1: 3, y2: 7 }, ns)));
    g.append(svg("line", Object.assign({ class: "ci-range", x1: s.passRange.lo * 100, x2: s.passRange.hi * 100, y1: 5, y2: 5 }, ns)));
    g.append(svg("line", Object.assign({ class: "ci-point", x1: s.passRate * 100, x2: s.passRate * 100, y1: 1, y2: 9 }, ns)));
    return g;
  }
  const maxTurnsOf = vs => Math.max(15, ...vs.map(v => (v.record.end && v.record.end.tutorTurns) || 0));

  const VERDICT_ORDER = { good: 0, flawed: 1, fail: 2 };
  const byCard = (a, b) => a.record.card.id.localeCompare(b.record.card.id) || String(a.record.card.lang).localeCompare(String(b.record.card.lang)) || a.record.repeat.index - b.record.repeat.index;
  const isSpot = v => isEval(v) && v.state !== "needs_review" && (softCount(v) > 0 || v.reviewFlags.length > 0);
  function tutorRows(vs) {
    return [...M.groupBy(vs, v => v.record.tutor.label)].map(([tutor, group]) => ({ tutor, group, g: M.summarize(group) }))
      .sort((a, b) => (b.g.passRate ?? -1) - (a.g.passRate ?? -1) || b.g.scored - a.g.scored || a.tutor.localeCompare(b.tutor));
  }
  // A letter per tutor, shared by all plates. It follows the tutor, never its rank, so filters never reletter anyone. Tutors
  // are lettered in order of their first run, so a tutor added later (say, the same model with a prompt of its own) takes
  // the next letter instead of relettering the others.
  function tutorKeys() {
    const names = [...new Set(st.dataset.runs.filter(r => !M.isCalibrationKind(r.batchKind)).map(r => r.tutor.label))];
    const letter = i => (i < 26 ? "" : String.fromCharCode(65 + Math.floor(i / 26) - 1)) + String.fromCharCode(65 + (i % 26));
    return new Map(names.map((n, i) => [n, letter(i)]));
  }
  function showRuns(filter) {
    st.runFilter = Object.assign({ state: "all", disagree: false, spot: false, focus: null, transport: false }, filter);
    st.limit = 100;
    setView("runs");
    window.scrollTo({ top: 0 });
  }
  function plateHead(no, id, title, extra) {
    return el("header", { class: "plate-head" }, el("div", { class: "title" }, no ? el("span", { class: "plate-no", text: t("plate", { n: no }) }) : null, el("h2", { id, text: title })), extra || null);
  }

  // Plate I: who teaches well. One row per tutor; counted specimens first (good, flawed, fail), then a break
  // and the specimens that still need review, which stand on a dashed ground because they are not counted.
  function specimenKey() {
    const example = { n: 7, levels: [1, 2, 1, 2, 3, 1, 1], leaks: new Set([5]), left: false, kind: "fail" };
    const fig = drawSpecimen(svg("svg", { class: "sp key-sp", viewBox: `0 0 ${SPW} ${SPH}`, "aria-hidden": "true" }), example, 9, true);
    fig.querySelectorAll("[data-tip]").forEach(n => n.removeAttribute("data-tip"));
    return el("figure", { class: "key" }, fig,
      el("dl", null,
        el("div", null, el("dt", { text: t("keyHead") }), el("dd", { text: t("keyHeadIs") })),
        el("div", null, el("dt", { text: t("keyStem") }), el("dd", { text: t("keyStemIs") })),
        el("div", null, el("dt", { text: t("keyLeaf") }), el("dd", { text: t("keyLeafIs") })),
        el("div", { class: "crit" }, el("dt", { text: t("keyRed") }), el("dd", { text: t("keyRedIs") }))),
      el("div", { class: "heads" }, ["good", "flawed", "fail", "needs_review"].map(k => el("span", null, pip(k), k === "needs_review" ? t("legendPending") : t(k)))));
  }
  function renderBoard(vs, rows, emptyNote, keys, latest, olderHidden) {
    const box = $("board");
    box.append(plateHead("I", "board-title", t("chartTutors"), specimenKey()));
    if (!vs.length) { box.append(el("p", { class: "empty-note", text: emptyNote })); return; }
    const maxTurns = maxTurnsOf(vs);
    const list = el("div", { class: "tutors" });
    for (const { tutor, group, g } of rows) {
      const counted = group.filter(v => v.state === "scored").sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || byCard(a, b));
      const pending = group.filter(v => v.state === "needs_review").sort(byCard);
      const models = [...new Set(group.map(v => v.record.tutor.resolvedModel).filter(Boolean))];
      const summary = t("rateTip", { n: g.scored, g: g.good, f: g.flawed, x: g.fail }) + (pending.length ? t("rateTipReview", { r: pending.length }) : "");
      const field = el("div", { class: "field", role: "img", "aria-label": tutor + " · " + summary });
      counted.forEach(v => field.append(specimen(v, maxTurns)));
      if (counted.length && pending.length) field.append(el("span", { class: "break", "aria-hidden": "true" }));
      pending.forEach(v => field.append(specimen(v, maxTurns)));
      field.addEventListener("click", e => { const n = e.target.closest("[data-run]"); if (n) openRun(n.getAttribute("data-run")); });
      list.append(el("div", { class: "tutor" },
        el("button", { type: "button", class: "who", onclick: () => showRuns({ focus: { tutor, version: latest.has(tutor) ? latest.get(tutor).key : null } }), "data-tip": t("allOfTutor") },
          el("span", { class: "tkey", text: keys.get(tutor) || "?" }),
          el("span", { class: "name" }, el("strong", { text: tutor }), models.length ? el("span", { class: "faint mono", text: models.join(", ") }) : null)),
        el("div", { class: "rate" + (g.passRate == null ? " none" : ""), "data-tip": summary + (g.passRange ? " · " + ciText(g) : "") },
          el("span", { class: "num" }, g.passRate == null ? t("noRate") : String(pct(g.passRate)), g.passRate == null ? null : el("small", { text: "%" })),
          ciBar(g)),
        field));
    }
    box.append(list);
    // A row should hold one setup. If the student, rules or tutor settings changed between batches, say so.
    const mixed = rows.map(r => {
      const counted = r.group.filter(v => v.state === "scored");
      const parts = ["tutorPrompt", "tutorParams", "studentModel", "studentParams", "rules"].filter(p => new Set(counted.map(v => String(M.setupOf(v)[p]))).size > 1);
      return parts.length ? t("mixedRow", { t: r.tutor, p: parts.map(partInText).join(st.lang === "zh" ? "、" : ", ") }) : null;
    }).filter(Boolean);
    const foot = [rows.some(r => r.g.passRange) ? t("ciNote") : null, olderHidden ? t("olderNote") : null, ...mixed].filter(Boolean);
    if (foot.length) box.append(el("p", { class: "plate-foot", text: foot.join(st.lang === "zh" ? "" : " ") }));
  }

  // Plate II: which cards separate the tutors. One row per card on a 0–100% pass-rate scale. Each tutor is its
  // lettered key; a hairline spans the lowest to the highest tutor. Cards with the widest spread come first.
  function renderSpread(vs, rows, keys, latest) {
    const box = $("cards");
    box.append(plateHead("II", "cards-title", t("chartCards"), el("p", { class: "plate-note", text: t("spreadNote") })));
    const tutors = rows.map(r => r.tutor);
    const cards = cardsOf(vs).map(card => {
      const cells = tutors.map(tutor => { const runs = vs.filter(v => v.record.card.id === card && v.record.tutor.label === tutor); return { tutor, runs, s: M.summarize(runs) }; })
        .filter(c => c.runs.length);
      const rated = cells.filter(c => c.s.passRate != null);
      const rates = rated.map(c => c.s.passRate);
      return { card, cells, rated, lo: rates.length ? Math.min(...rates) : null, hi: rates.length ? Math.max(...rates) : null, spread: rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : -1 };
    }).sort((a, b) => b.spread - a.spread || a.card.localeCompare(b.card));
    if (!cards.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    const chart = el("div", { class: "spread", role: "table", "aria-labelledby": "cards-title" });
    chart.append(el("div", { class: "srow axis-row", role: "row" }, el("span", { role: "columnheader" }),
      el("div", { class: "track axis", role: "columnheader" }, [0, 25, 50, 75, 100].map(x => el("span", { style: "left:" + x + "%", text: x + (x === 100 ? "%" : "") }))),
      el("span", { class: "delta", role: "columnheader", text: t("spreadCol") })));
    for (const c of cards) {
      // Tutors at the same pass rate stack upward instead of hiding each other.
      const buckets = new Map();
      for (const cell of c.rated) { const k = Math.round(cell.s.passRate * 50); buckets.set(k, [...(buckets.get(k) || []), cell]); }
      const tallest = Math.max(1, ...[...buckets.values()].map(b => b.length));
      const track = el("div", { class: "track", role: "cell", style: "--stack:" + tallest });
      if (c.rated.length > 1) track.append(el("i", { class: "range", style: `left:${c.lo * 100}%;width:${(c.hi - c.lo) * 100}%` }));
      for (const list of buckets.values()) list.forEach((cell, k) => {
        const { tutor, runs, s } = cell;
        const langs = ["zh-CN", "en"].map(l => { const ls = M.summarize(runs.filter(v => v.record.card.lang === l)); return ls.scored ? langShort(l) + " " + (ls.good + ls.flawed) + "/" + ls.scored : null; }).filter(Boolean);
        const tip = tutor + " · " + c.card + " · " + t("cellTip", { p: s.good + s.flawed, n: s.scored }) + " · " + ciText(s) + (langs.length > 1 ? "（" + langs.join("，") + "）" : "") + (s.needsReview ? " · " + t("cellReview", { r: s.needsReview }) : "");
        track.append(el("button", { type: "button", class: "mk" + (s.needsReview ? " pending" : ""), style: `left:${s.passRate * 100}%;--k:${k}`, "data-tip": tip, "aria-label": tip,
          onclick: () => showRuns({ focus: { tutor, card: c.card, version: latest.has(tutor) ? latest.get(tutor).key : null } }) }, keys.get(tutor) || "?"));
      });
      const unrated = c.cells.filter(x => x.s.passRate == null);
      chart.append(el("div", { class: "srow", role: "row" },
        el("span", { class: "card", role: "rowheader" }, c.card, unrated.length ? el("span", { class: "faint small", "data-tip": unrated.map(x => x.tutor).join("、") + " · " + t("cellNone") }, " · " + t("unratedN", { n: unrated.length })) : null),
        track,
        el("span", { class: "delta num", role: "cell", text: c.spread >= 0 ? String(Math.round(c.spread * 100)) : "—" })));
    }
    box.append(el("div", { class: "spread-box" }, chart));
  }

  // Plate III: is it worth it. Pass rate (with its 95% range) against what the tutor itself costs per conversation, or
  // how long each reply takes, on a log scale, so up and to the left is better. Only the tutor's own calls count.
  const secs = ms => t("sec", { v: (ms / 1000).toFixed(ms < 10000 ? 1 : 0) });
  const tickText = (mode, v) => (mode === "cost" ? "$" + String(Number(v.toPrecision(1))) : secs(v));
  function renderValue(vs, rows, keys, latest) {
    const box = $("value");
    const mode = st.valueAxis === "time" ? "time" : "cost";
    const toggle = el("div", { class: "seg", role: "group", "aria-label": t("valueAxis") }, ["cost", "time"].map(k => el("button", { type: "button", class: "tab",
      "aria-pressed": mode === k ? "true" : "false", onclick: () => { st.valueAxis = k; clear(box); renderValue(vs, rows, keys, latest); } }, t(k === "cost" ? "axisCost" : "axisTime"))));
    box.append(plateHead("III", "value-title", t("chartValue"), toggle));
    const pts = rows.filter(r => r.g.passRate != null).map(r => {
      const e = M.economyOf(r.group.filter(v => v.state === "scored"));
      return { tutor: r.tutor, g: r.g, e, x: mode === "cost" ? e.usdPerRun : e.latencyMs };
    });
    const shown = pts.filter(p => p.x != null && p.x > 0);
    if (!shown.length) { box.append(el("p", { class: "empty-note", text: t("valueNone") })); return; }
    const L = Math.log10, lo = Math.min(...shown.map(p => p.x)) / 1.8, hi = Math.max(...shown.map(p => p.x)) * 1.8;
    const xpos = x => ((L(x) - L(lo)) / (L(hi) - L(lo))) * 100;
    let ticks = [];
    for (let k = Math.floor(L(lo)); k <= Math.ceil(L(hi)); k++) for (const m of [1, 2, 5]) { const v = m * 10 ** k; if (v >= lo && v <= hi) ticks.push(v); }
    if (ticks.length > 7) ticks = ticks.filter(v => Math.abs(L(v) - Math.round(L(v))) < 1e-9);
    const plot = el("div", { class: "vplot" });
    for (const y of [0, 25, 50, 75, 100]) plot.append(el("span", { class: "vgy", style: `bottom:${y}%`, "aria-hidden": "true" }, el("b", { text: y + (y === 100 ? "%" : "") })));
    for (const v of ticks) plot.append(el("span", { class: "vgx" + (xpos(v) > 92 ? " edge" : ""), style: `left:${xpos(v)}%`, "aria-hidden": "true" }, el("b", { text: tickText(mode, v) })));
    plot.append(el("span", { class: "vcorner", text: t(mode === "cost" ? "cornerCost" : "cornerTime"), "aria-hidden": "true" }));
    for (const p of shown) {
      const tip = [p.tutor, t("cellTip", { p: p.g.good + p.g.flawed, n: p.g.scored }), ciText(p.g),
        t("valueTip", { c: usd(p.e.usdPerRun), n: p.e.priced, s: p.e.latencyMs == null ? "—" : secs(p.e.latencyMs) }) + (p.e.estimated ? t("valueEstimated", { k: p.e.estimated }) : "")].join(" · ");
      if (p.g.passRange) plot.append(el("i", { class: "whisker", style: `left:${xpos(p.x)}%;bottom:${p.g.passRange.lo * 100}%;height:${(p.g.passRange.hi - p.g.passRange.lo) * 100}%`, "aria-hidden": "true" }));
      plot.append(el("button", { type: "button", class: "vmk", style: `left:${xpos(p.x)}%;bottom:${p.g.passRate * 100}%`, "data-tip": tip, "aria-label": tip,
        onclick: () => showRuns({ focus: { tutor: p.tutor, version: latest.has(p.tutor) ? latest.get(p.tutor).key : null } }) }, keys.get(p.tutor) || "?"));
      // Direct label beside the mark, on the left near the right edge.
      plot.append(el("span", { class: "vname" + (xpos(p.x) > 72 ? " left" : ""), style: `left:${xpos(p.x)}%;bottom:${p.g.passRate * 100}%`, "aria-hidden": "true", text: p.tutor }));
    }
    box.append(el("div", { class: "vbox", role: "img", "aria-labelledby": "value-title" }, plot));
    const missing = pts.length - shown.length;
    box.append(el("p", { class: "plate-foot", text: t("valueNote") + (missing ? (st.lang === "zh" ? "" : " ") + t("valueMissing", { n: missing }) : "") }));
  }

  // Plate IV: did the new version get better. One small panel per tutor with more than one version in view: the pass
  // rate of each version with its 95% range, compared only on the cards every version scored (see M.versionTrend).
  function renderTrend(vs, versions, keys) {
    const box = $("trends");
    box.append(plateHead("IV", "trends-title", t("chartVersions"), el("p", { class: "plate-note", text: t("versionsNote") })));
    const trend = M.versionTrend(vs, versions).sort((a, b) => (keys.get(a.tutor) || a.tutor).localeCompare(keys.get(b.tutor) || b.tutor));
    if (!trend.length) { box.append(el("p", { class: "empty-note", text: t("versionsNone") })); return; }
    const grid = el("div", { class: "trends" });
    for (const tr of trend) {
      const n = tr.points.length, x = i => 8 + i * 84 / (n - 1);
      const plot = el("div", { class: "tplot" });
      for (const y of [0, 50, 100]) plot.append(el("span", { class: "tgrid", style: `bottom:${y}%`, "aria-hidden": "true" }, el("b", { text: y + (y === 100 ? "%" : "") })));
      const line = svg("svg", { class: "tline", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" });
      const ys = tr.points.map(p => (p.s.passRate == null ? null : 100 - p.s.passRate * 100));
      for (let i = 1; i < n; i++) if (ys[i - 1] != null && ys[i] != null) {
        line.append(svg("line", { class: "seg" + (i === n - 1 ? " last" : ""), x1: x(i - 1), y1: ys[i - 1], x2: x(i), y2: ys[i], "vector-effect": "non-scaling-stroke" }));
      }
      plot.append(line);
      tr.points.forEach((p, i) => {
        if (p.s.passRate == null) return;
        const tip = [p.label, t("cellTip", { p: p.s.good + p.s.flawed, n: p.s.scored }), ciText(p.s), p.firstAt ? t("firstRun", { d: whenShort(p.firstAt) }) : null].filter(Boolean).join(" · ");
        plot.append(el("i", { class: "whisker", style: `left:${x(i)}%;bottom:${p.s.passRange.lo * 100}%;height:${(p.s.passRange.hi - p.s.passRange.lo) * 100}%`, "aria-hidden": "true" }));
        plot.append(el("button", { type: "button", class: "pt" + (i === n - 1 ? " last" : ""), style: `left:${x(i)}%;bottom:${p.s.passRate * 100}%`,
          "data-tip": tip, "aria-label": tr.tutor + " · " + tip, onclick: () => showRuns({ focus: { tutor: tr.tutor, version: p.key } }) }));
      });
      const ticks = el("div", { class: "tx", "aria-hidden": "true" }, tr.points.map((p, i) => el("span", { class: i === 0 ? "first" : i === n - 1 ? "last" : "", style: `left:${x(i)}%;max-width:calc(${84 / (n - 1)}% - 10px)`, title: p.label, text: p.label })));
      const d = tr.delta, sign = d == null ? "" : d > 0 ? "+" : d < 0 ? "−" : "±";
      const deltaBox = el("div", { class: "tdelta" + (tr.clear ? (d < 0 ? " down" : " up") : "") },
        el("span", { class: "d", text: d == null ? "—" : sign + Math.abs(Math.round(d * 100)) }),
        el("span", { class: "u" }, d == null ? t("versionsNoBasis") : t("pts") + " · " + t("vsPrev"), d == null ? null : el("br"), d == null ? null : (tr.clear ? t("sigClear") : t("sigNoise"))));
      grid.append(el("figure", { class: "trend" },
        el("figcaption", null, el("span", { class: "tkey", text: keys.get(tr.tutor) || "?" }), el("strong", { text: tr.tutor })),
        deltaBox, plot, ticks,
        el("p", { class: "tbasis", text: tr.cells ? t("versionsBasis", { n: tr.cells }) : "" })));
    }
    box.append(grid);
  }

  // Compare: two setups side by side. What differs comes first, because a result only means something when exactly one
  // thing changed. Runs are matched on the card versions and languages both sides scored (see M.compareSetups).
  // A setup part's name inside a sentence: lower case in English ("mixes more than one tutor prompt").
  const partInText = part => (st.lang === "zh" ? t("part_" + part) : t("part_" + part).toLowerCase());
  const shortHash = x => String(x).replace(/sha256:([0-9a-f]{8})[0-9a-f]+/g, "$1");
  // A tutor prompt by its name and version, with the start of its hash (the hash is what the comparison uses).
  function promptName(hash) {
    if (!hash || hash === "null") return null;
    const p = ((st.dataset && st.dataset.tutorPrompts) || []).find(x => x.hash === hash);
    return (p && p.id ? p.id + " " + (p.version || "") + " · " : "") + shortHash(hash);
  }
  function partValue(part, value) {
    if (part === "tutorPrompt" && (value === "null" || value == null)) return t("promptFromCard");
    if (part === "tutorPrompt") return promptName(value);
    if (/Params$/.test(part)) { try { const o = JSON.parse(value); return o ? Object.entries(o).map(([k, v]) => k + "=" + v).join(", ") : "—"; } catch { return value; } }
    return value === "null" || value == null ? "—" : shortHash(value);
  }
  function renderCompare(vs) {
    const box = $("compare");
    box.append(plateHead("", "compare-title", t("compareTitle"), el("p", { class: "plate-note", text: t("compareNote") })));
    const list = M.setups(vs).filter(g => g.views.some(v => v.state === "scored"));
    if (list.length < 2) { box.append(el("p", { class: "empty-note", text: t("cmpNone") })); return; }
    const keys = list.map(g => g.key);
    if (!keys.includes(st.cmpA) || !keys.includes(st.cmpB)) {
      // Default: the tutor with the most setups, its previous setup against its newest; else the first two.
      const byTutor = M.groupBy(list, g => g.setup.tutor);
      const most = [...byTutor.values()].sort((a, b) => b.length - a.length)[0];
      [st.cmpA, st.cmpB] = most.length > 1 ? [most[most.length - 2].key, most[most.length - 1].key] : [keys[0], keys[1]];
    }
    const option = g => [g.key, t("setupOption", { t: g.setup.tutor, m: g.setup.tutorModel + (g.setup.tutorPrompt ? " · " + promptName(g.setup.tutorPrompt) : ""), s: g.setup.studentModel || "—", n: g.views.filter(v => v.state === "scored").length,
      d: whenShort(g.firstAt).split(/[ ,]/)[0] + (g.firstAt.slice(0, 10) !== g.lastAt.slice(0, 10) ? "–" + whenShort(g.lastAt).split(/[ ,]/)[0] : "") })];
    const rerender = () => { clear(box); renderCompare(vs); };
    box.append(el("div", { class: "pickers" },
      el("div", { class: "picker a" }, select("cmp-a", t("sideA"), st.cmpA, list.map(option), v => { st.cmpA = v; rerender(); })),
      el("button", { type: "button", class: "btn-quiet swap", "aria-label": t("swap"), "data-tip": t("swap"), onclick: () => { [st.cmpA, st.cmpB] = [st.cmpB, st.cmpA]; rerender(); } }, "⇄"),
      el("div", { class: "picker b" }, select("cmp-b", t("sideB"), st.cmpB, list.map(option), v => { st.cmpB = v; rerender(); }))));
    const A = list.find(g => g.key === st.cmpA), B = list.find(g => g.key === st.cmpB);
    const c = M.compareSetups(A.views, B.views);

    // What differs: every part, the differing ones first and in ink, the same ones quiet.
    const differs = new Set(c.diff.map(d => d.part));
    const rows = [...M.SETUP_PARTS].sort((x, y) => (differs.has(y) ? 1 : 0) - (differs.has(x) ? 1 : 0)).map(part => {
      const a = partValue(part, String(M.setupOf(A.views[0])[part])), b = partValue(part, String(M.setupOf(B.views[0])[part]));
      const nameOnly = c.diff.some(x => x.part === part && x.nameOnly);
      return el("div", { class: "drow" + (differs.has(part) ? " differs" : "") + (nameOnly ? " name-only" : ""), role: "row" },
        el("span", { class: "dpart", role: "rowheader", text: t("part_" + part) }),
        el("span", { class: "dval mono", role: "cell", text: a }),
        el("span", { class: "dval mono", role: "cell", text: differs.has(part) ? b : t("partSame") }));
    });
    box.append(el("div", { class: "block" }, el("h3", { text: t("diffTitle") }),
      el("div", { class: "dtable", role: "table" }, el("div", { class: "drow head", role: "row" }, el("span", { role: "columnheader" }), el("span", { role: "columnheader", text: "A" }), el("span", { role: "columnheader", text: "B" })), rows)));

    // The verdict.
    const names = c.diff.filter(d => !d.nameOnly && !(d.part === "tutorModel" && differs.has("tutor"))).map(d => t("part_" + d.part)).join(st.lang === "zh" ? "、" : ", ");
    const notes = [];
    if (!c.diff.length) notes.push(t("cmpSame"));
    else if (!c.changes) notes.push(t("cmpSameNamed"));
    else if (c.changes === 1) notes.push(t("cmpOne", { p: names }));
    else notes.push(t("cmpMany", { n: c.changes, p: names }));
    if (c.nameOnly && c.changes) notes.push(t("cmpNameOnly"));
    for (const m of c.mixed) notes.push(t("cmpMixed", { s: m.side.toUpperCase(), p: partInText(m.part) }));
    if (c.diff.length && !c.cells) notes.push(t("cmpNoCells"));
    const d = c.delta, sign = d == null ? "" : d > 0 ? "+" : d < 0 ? "−" : "±";
    const verdict = el("div", { class: "cmp-verdict" + (c.changes > 1 || c.mixed.length ? " unsure" : "") },
      c.changes && c.cells ? el("div", { class: "tdelta" + (c.clear && c.changes === 1 && !c.mixed.length ? (d < 0 ? " down" : " up") : "") },
        el("span", { class: "d", text: d == null ? "—" : sign + Math.abs(Math.round(d * 100)) }),
        el("span", { class: "u" }, t("cmpBvsA"), el("br"), c.clear ? t("sigClear") : t("sigNoise"))) : null,
      el("div", { class: "cmp-notes" }, notes.map(n => el("p", { text: n }))));
    box.append(verdict);
    if (!c.changes || !c.cells) return;

    // Overall and per card–language: A and B as letters on a 0–100% track, joined by a hairline.
    const chart = el("div", { class: "spread cmp", role: "table", "aria-label": t("cmpCells", { n: c.cells }) });
    chart.append(el("div", { class: "srow axis-row", role: "row" }, el("span", { role: "columnheader" }),
      el("div", { class: "track axis", role: "columnheader" }, [0, 25, 50, 75, 100].map(x => el("span", { style: "left:" + x + "%", text: x + (x === 100 ? "%" : "") }))),
      el("span", { class: "delta", role: "columnheader", text: "B − A" })));
    const row = (label, sa, sb, strong) => {
      const track = el("div", { class: "track", role: "cell", style: "--stack:" + (sa.passRate != null && sb.passRate != null && Math.round(sa.passRate * 50) === Math.round(sb.passRate * 50) ? 2 : 1) });
      if (sa.passRate != null && sb.passRate != null) track.append(el("i", { class: "range", style: `left:${Math.min(sa.passRate, sb.passRate) * 100}%;width:${Math.abs(sb.passRate - sa.passRate) * 100}%` }));
      const same = sa.passRate != null && sb.passRate != null && Math.round(sa.passRate * 50) === Math.round(sb.passRate * 50);
      [["A", sa, 0], ["B", sb, same ? 1 : 0]].forEach(([k, s, stack]) => {
        if (s.passRate == null) return;
        const tip = k + " · " + label + " · " + t("cellTip", { p: s.good + s.flawed, n: s.scored }) + " · " + ciText(s);
        track.append(el("span", { class: "mk " + k.toLowerCase(), style: `left:${s.passRate * 100}%;--k:${stack}`, "data-tip": tip, "aria-label": tip, tabindex: "0" }, k));
      });
      const dd = sa.passRate != null && sb.passRate != null ? Math.round((sb.passRate - sa.passRate) * 100) : null;
      return el("div", { class: "srow" + (strong ? " overall" : ""), role: "row" }, el("span", { class: "card", role: "rowheader", text: label }), track,
        el("span", { class: "delta num", role: "cell", text: dd == null ? "—" : (dd > 0 ? "+" : dd < 0 ? "−" : "±") + Math.abs(dd) }));
    };
    chart.append(row(t("cmpOverall"), c.a, c.b, true));
    for (const x of c.byCell) { const [id, lang] = x.cell.split("/"); chart.append(row(id.replace(/@.*/, "") + " · " + langShort(lang), x.a, x.b, false)); }
    box.append(el("div", { class: "spread-box" }, chart), el("p", { class: "plate-foot", text: t("cmpCells", { n: c.cells }) }));
  }

  // What needs a person: two numbers, each opens the matching list.
  function renderAttention(vs) {
    const box = $("attention");
    const pending = vs.filter(v => v.state === "needs_review").length, spot = vs.filter(isSpot).length;
    box.append(plateHead("V", "attention-title", t("attentionTitle")));
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
      ...v.reviewFlags.map(code), v.fixedTestSkipped ? t("fixedTestSkipped") : null].filter(Boolean).join("、");
  }

  // ---------- All conversations ----------
  const hasTransport = v => M.transportOf([v.record], null).some(x => x.error);
  function renderRunsOnly() { clear($("runs")); renderRuns(views()); }
  function renderRuns(vs) {
    const box = $("runs"), rf = st.runFilter;
    const inState = (v, k) => k === "all" || (k === "unscorable" ? ["error", "student_invalid"].includes(v.state) : v.state === k);
    const scoped = vs.filter(v => !rf.focus || ((!rf.focus.tutor || v.record.tutor.label === rf.focus.tutor) && (!rf.focus.card || v.record.card.id === rf.focus.card)
      && (!rf.focus.version || M.versionKey(v.record) === rf.focus.version)));
    // Superseded and calibration tabs appear only when such runs are loaded.
    const states = [["all", t("all")], ["scored", t("scored_state")], ["needs_review", t("needs_review")], ["unscorable", t("unscorable")], ["other_version", t("other_version")],
      ["superseded", t("superseded")], ["calibration", t("calibration")]].filter(([k]) => !M.NOT_EVALUATION.includes(k) || rf.state === k || scoped.some(v => v.state === k));
    let list = scoped.filter(v => inState(v, rf.state)).filter(v => !rf.disagree || v.disagreements.length).filter(v => !rf.spot || isSpot(v)).filter(v => !rf.transport || hasTransport(v));
    box.append(el("header", { class: "sec-head" }, el("h2", { id: "runs-title" }, t("runsTitle"), el("span", { class: "count", text: String(list.length) }))));
    box.append(el("div", { class: "tabs", role: "group", "aria-label": t("colState") }, states.map(([k, label]) => el("button", { type: "button", class: "tab", "aria-pressed": rf.state === k ? "true" : "false",
      onclick: () => { rf.state = k; st.limit = 100; renderRunsOnly(); } }, label + " " + scoped.filter(v => inState(v, k)).length))));
    box.append(el("div", { class: "toggles" },
      rf.focus ? el("span", { class: "focus" }, t("focus", { f: [rf.focus.tutor, rf.focus.version, rf.focus.card].filter(Boolean).join(" · ") }), el("button", { type: "button", class: "btn-quiet", onclick: () => { rf.focus = null; renderRunsOnly(); renderViews(views()); } }, t("clearFocus"))) : null,
      el("label", null, el("input", { type: "checkbox", id: "only-disagree", checked: rf.disagree, onchange: e => { rf.disagree = e.target.checked; renderRunsOnly(); } }), t("onlyDisagree")),
      el("label", null, el("input", { type: "checkbox", id: "only-spot", checked: rf.spot, onchange: e => { rf.spot = e.target.checked; renderRunsOnly(); } }), t("onlySpot")),
      rf.transport || scoped.some(hasTransport) ? el("label", null, el("input", { type: "checkbox", id: "only-transport", checked: rf.transport, onchange: e => { rf.transport = e.target.checked; renderRunsOnly(); } }), t("onlyTransport")) : null));
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
        el("td", { text: whoOf(r) }),
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
        el("tbody", null, rows.map(raw => {
          const b = M.batchInfo(raw);
          const stopped = b.status && b.status !== "complete" && b.status !== "running";
          // Spend is the runner's price-table estimate; an invoice, when reconciled, is shown beside it.
          const money = [whenShort(b.createdAt), usd(b.spentUsd) + " / " + usd(b.budgetUsd), b.hardCapUsd != null ? t("hardCap", { v: usd(b.hardCapUsd) }) : null].filter(Boolean).join(" · ");
          return el("tr", null, el("td", null,
            el("div", null, el("span", { class: "mono", text: b.batchId }), M.isCalibrationKind(b.kind) ? el("span", { class: "tag cls-" + clsOf(raw), style: "margin-left:8px", text: t("cls_" + clsOf(raw)) }) : null),
            el("div", { class: "small faint", text: money }),
            b.tutorSetups.map(x => el("div", { class: "small faint", "data-tip": x.prompt && x.prompt.hash ? x.prompt.hash : null,
              text: x.tutor + ": " + [x.prompt ? (x.prompt.id + " " + x.prompt.version + (x.prompt.hash ? " · " + shortHash(x.prompt.hash) : "")) : null,
                x.params ? Object.entries(x.params).map(([k, v]) => k + "=" + v).join(", ") : null].filter(Boolean).join(" · ") })),
            b.hardCapReached ? el("div", { class: "small stopped", text: "✕ " + t("hardCapReached") }) : null,
            b.alsoStopped ? el("div", { class: "small stopped", text: "✕ " + t("alsoStopped", { r: code(b.alsoStopped) }) }) : null,
            b.topUps.map(x => el("div", { class: "small faint", text: t("topUp", { from: usd(x.from), to: usd(x.to) }) })),
            b.reconciled.map(x => el("div", { class: "small faint", "data-tip": x.reason || null, text: t("reconciled", { p: x.provider, a: usd(x.actualUsd), e: usd(x.estimatedUsd), d: usdDiff(x.diffUsd) }) }))),
            el("td", { class: (stopped ? "stopped" : "muted"), text: (stopped ? "✕ " : "") + code(b.status) }),
            el("td", null, el("div", { class: "barcell" }, el("span", { class: "hbar", "aria-hidden": "true" }, el("span", { style: "width:" + (b.planned ? Math.min(100, Math.round(100 * b.done / b.planned)) : 0) + "%" })),
              el("span", { class: "num", text: b.done + " / " + (b.planned ?? "?") })),
              b.superseded ? el("div", { class: "small faint", text: t("supersededRuns", { n: b.superseded }) }) : null));
        })))));
    box.append(el("div", { class: "cols" }, left, right));
    // The calls of each batch in view: who answered, fingerprints, cache, transport errors and recoveries.
    const inView = rows.filter(b => st.f.batch === "all" || b.batchId === st.f.batch);
    if (inView.length) box.append(el("div", { class: "block calls-block" }, el("h3", { text: t("callsTitle") }), el("p", { class: "small muted", text: t("callsNote") }),
      inView.map((b, i) => batchCalls(b, st.callsOpen ? b.batchId === st.callsOpen : i === 0))));
  }

  // ---------- Run checks: calls of each batch (record schema v4 and v5) ----------
  const fmtInt = n => (n == null ? "—" : Number(n).toLocaleString(st.lang === "zh" ? "zh-CN" : "en-GB"));
  const pct1 = x => (x == null ? "—" : (x * 100).toFixed(1) + "%");
  const shortRun = id => String(id).replace(/^run-/u, "").slice(0, 8);
  const fpText = v => (v === undefined ? t("notRecorded") : v === null ? t("fpNull") : v);
  const runButton = id => el("button", { type: "button", class: "btn-quiet mono run-link", onclick: () => openRun(id), "data-tip": id }, shortRun(id));
  const smallTable = (head, rows, cls) => el("div", { class: "scroll-x" }, el("table", { class: "mini" + (cls ? " " + cls : "") },
    el("thead", null, el("tr", null, head.map(h => el("th", { class: h.num ? "num" : null, text: h.text || h })))), el("tbody", null, rows)));
  function batchCalls(raw, open) {
    const d = st.dataset, recs = d.runs.filter(r => r.batchId === raw.batchId);
    const h = M.batchHistory(raw), id = M.identityOf(raw, recs, d.supersededBy), cache = M.cacheOf(raw, recs), tr = M.transportOf(recs, d.supersededBy);
    const restarts = recs.filter(r => r.restartOf).length;
    const status = [t("nowStatus", { s: code(h.status) }), h.earlierStop ? t("earlierStop", { s: code(h.earlierStop), n: restarts }) : null,
      ...h.topUps.map(x => t("topUp", { from: usd(x.from), to: usd(x.to) }))].filter(Boolean).join(" · ");
    const box = el("details", { class: "bcalls", id: "calls-" + raw.batchId, open: open || null },
      el("summary", null, el("span", { class: "mono", text: raw.batchId }), M.isCalibrationKind(raw.kind) ? el("span", { class: "tag cls-" + clsOf(raw), text: t("cls_" + clsOf(raw)) }) : null,
        el("span", { class: "small muted", text: status })));

    // Who answered.
    const idRows = id.roles.map(g => el("tr", null, el("td", { text: t("role_" + g.role) }),
      el("td", { class: "mono small", text: g.requested.join(", ") || "—" }),
      el("td", { class: "mono small", text: g.unrecorded === g.calls ? t("notRecordedV4") : [g.returned.join(", "), g.returnedNull ? t("returnedNull", { n: g.returnedNull }) : null].filter(Boolean).join(" · ") || "—" }),
      el("td", { class: "small muted", text: g.first ? whenShort(g.first) + (g.last && g.last !== g.first ? " – " + whenShort(g.last) : "") : "—" })));
    const si = id.servingIdentity;
    const ev = id.evidence;
    const idBlock = el("div", { class: "block" }, el("h4", { text: t("identityTitle") }),
      el("p", { class: "small" }, t("servingIdentity", { r: t("role_" + id.target) }) + " ", el("strong", { text: si ? code(si) : t("notRecorded") }),
        id.configured && id.configured !== si ? el("span", { class: "muted", text: " · " + t("configured", { v: code(id.configured) }) }) : null),
      si === "alias" ? el("p", { class: "small muted", text: t("aliasNote") }) : null,
      ev ? el("p", { class: "small muted" }, t("identityEvidence") + " ", ev.url ? el("span", { class: "mono", text: ev.url }) : null, ev.retrievedAt ? " · " + ev.retrievedAt : null, ev.quote ? el("q", { text: ev.quote }) : null) : null,
      idRows.length ? smallTable([t("role"), t("requestedModel"), t("returnedModel"), t("calledAt")], idRows) : null);

    // Fingerprints of the observed role (the student in calibration, the tutor in evaluation).
    const target = id.roles.find(g => g.role === id.target);
    const fpBlock = el("div", { class: "block" }, el("h4", { text: t("fingerprintTitle", { r: t("role_" + id.target) }) }),
      !target ? el("p", { class: "small muted", text: t("none") }) :
        smallTable([t("fingerprint"), { text: t("conversations"), num: true }, { text: t("adopted"), num: true }, { text: t("supersededCol"), num: true }],
          target.fingerprints.map(f => el("tr", null, el("td", { class: "mono small", text: fpText(f.value) }), el("td", { class: "num", text: f.conversations }),
            el("td", { class: "num", text: f.adopted }), el("td", { class: "num", text: f.superseded })))),
      id.multipleFingerprints ? el("p", { class: "small stopped", text: t("multipleFingerprints") }) : null,
      el("p", { class: "small faint", text: t("fpNote") }));

    // Cache: the observed calls with their denominator, and the batch's own summary as written.
    const scripted = cache.models.filter(m => m.observed === 0 && m.unknown === 0 && m.noInput > 0);
    const cRows = cache.models.filter(m => !scripted.includes(m)).map(m => el("tr", null, el("td", { class: "mono small", text: m.model }),
      el("td", { class: "num", text: m.calls === m.unrecorded ? t("notRecorded") : m.observed + " / " + m.calls }),
      el("td", { class: "num", text: m.observed ? fmtInt(m.hitTokens) : "—" }), el("td", { class: "num", text: m.observed ? fmtInt(m.missTokens) : "—" }),
      el("td", { class: "num", text: pct1(m.hitRate) }),
      el("td", { class: "num small", "data-tip": t("batchCacheTip"), text: !m.batch ? "—" : m.batch.hitRate != null ? pct1(m.batch.hitRate) : t("unknownWhole") })));
    const cacheBlock = el("div", { class: "block" }, el("h4", { text: t("cacheTitle") }),
      !cache.recorded ? el("p", { class: "small muted", text: t("cacheNotRecorded") }) :
        smallTable([t("model"), { text: t("observed"), num: true }, { text: t("hitTokens"), num: true }, { text: t("missTokens"), num: true }, { text: t("hitRateObserved"), num: true }, { text: t("batchSummary"), num: true }], cRows),
      scripted.length ? el("p", { class: "small faint", text: t("scriptedNoInput", { m: scripted.map(m => m.model).join(", ") }) }) : null,
      cache.recorded ? el("p", { class: "small faint", text: t("cacheNote") }) : null);

    // Transport errors and retries, with what became of the conversation.
    const tRows = tr.map(x => el("tr", null, el("td", null, runButton(x.runId)), el("td", { class: "num", text: "#" + x.n }), el("td", { text: t("role_" + x.role) }),
      el("td", { class: x.error ? "stopped" : "muted", text: x.error ? code(x.error) : t("retryOk") }),
      el("td", { class: "num small", text: x.retry ? (x.retryDelayMs / 1000).toFixed(1) + " s" : "—" }),
      el("td", { class: "num small", text: x.costEstimated ? t("atReservation", { v: usd(x.usd) }) : usd(x.usd) }),
      el("td", { class: "small" }, x.replacedBy ? [t("replacedBy") + " ", runButton(x.replacedBy)] : code(x.status === "unscored" ? x.endReason : x.status))));
    const trBlock = el("div", { class: "block" }, el("h4", { text: t("transportTitle") }),
      tr.length ? smallTable([t("conversation"), { text: t("call"), num: true }, t("role"), t("error"), { text: t("retryWait"), num: true }, { text: t("charged"), num: true }, t("then")], tRows)
        : el("p", { class: "small muted", text: t("noTransport") }));

    box.append(el("div", { class: "bcalls-body" }, idBlock, fpBlock, cacheBlock, trBlock,
      el("div", { class: "bcalls-foot" }, el("button", { type: "button", class: "btn-quiet", onclick: () => exportPack(raw.batchId) }, t("exportPack") + " ↓"),
        el("span", { class: "small faint", text: t("exportNote") }))));
    return box;
  }

  // ---------- review pack ----------
  // Builds a .zip in this tab from the files already opened: the batch's records (superseded ones too), its batch file,
  // report, expectations, content review, gate or final outputs, probe file and index lines, byte for byte, plus derived
  // tables (one row per record, per review item and per student message), a manifest an agent can read first, a README
  // and SHA-256 sums. Nothing is uploaded and nothing is re-run.
  async function exportPack(batchId) {
    const d = st.dataset, P = globalThis.PremiumReviewPack;
    if (!d || !P) return;
    const src = st.files, synthetic = !src;
    const folder = "review-pack-" + batchId + "/";
    const files = [], notes = [];
    const raw = async (s, value) => (s ? new Uint8Array(await s.file.arrayBuffer()) : JSON.stringify(value) + "\n");
    const add = (path, data, role, extra) => files.push({ path, data, role, ...(extra || {}) });
    const base = p => p.split("/").pop();
    const recs = d.runs.filter(r => r.batchId === batchId);
    const sup = d.supersededBy || {};
    for (const r of recs) add("records/" + r.runId + ".json", await raw(src && src.records.get(r.runId), r), "record", { runId: r.runId, adopted: !sup[r.runId] });
    const batch = d.batches.find(b => b.batchId === batchId);
    if (batch) add("batches/" + batchId + ".json", await raw(src && src.batches.get(batchId), batch), "batch");
    const report = d.reports.get(batchId);
    if (report) add("calibration-report-" + batchId + ".json", await raw(src && src.reports.get(batchId), report), "checker-report");
    const c = M.calibrationOf(d, batchId), L = M.packLayers(d, batchId);
    if (c.expectations) {
      const s = src && src.expectations.find(x => x.value === c.expectations);
      add(s ? base(s.path) : "expectations.json", await raw(s, c.expectations), "expectations");
    }
    // The content review and every gate or final output that names this batch, as the reviewer and the checker wrote them.
    const review = d.reviews.get(batchId);
    if (review) add("content-review-" + batchId + ".json", await raw(src && src.reviews.get(batchId), review), "content-review");
    for (const o of c.final.outputs) {
      const s = src && src.gates.find(x => x.value === o.gate);
      add(s ? base(s.path) : "gate-" + o.scope + ".json", await raw(s, o.gate), o.kind === "final" ? "final-output" : "gate-output");
    }
    if (c.probeSet) {
      const s = src && src.probeSets.find(x => x.value === c.probeSet);
      add(s ? base(s.path) : "probes.json", await raw(s, c.probeSet), "probe-set");
    }
    // index.jsonl: only this batch's lines, each line exactly as it was.
    const indexText = src ? (src.index ? await src.index.file.text() : null) : (globalThis.PREMIUM_SAMPLE && globalThis.PREMIUM_SAMPLE.index);
    if (indexText != null) {
      // Each line keeps its own line end. (No look-behind here: older Safari lacks it.)
      const lines = (indexText.match(/[^\n]*\n|[^\n]+$/gu) || []).filter(line => { try { return JSON.parse(line).batchId === batchId; } catch { return false; } });
      add("index.jsonl", lines.join(""), "index");
    }
    const exportedAt = new Date().toISOString();
    const reviewRows = M.reviewItemRows(d, batchId), messageRows = M.messageRows(d, batchId);
    add("review-index.csv", P.csv(M.REVIEW_COLUMNS, M.reviewIndex(d, batchId)), "derived-table", { rows: recs.length, columns: M.REVIEW_COLUMNS });
    if (reviewRows.length) add("review-items.csv", P.csv(M.REVIEW_ITEM_COLUMNS, reviewRows), "derived-table", { rows: reviewRows.length, columns: M.REVIEW_ITEM_COLUMNS });
    add("messages.csv", P.csv(M.MESSAGE_COLUMNS, messageRows), "derived-table", { rows: messageRows.length, columns: M.MESSAGE_COLUMNS });
    const hasRole = role => files.some(f => f.role === role);
    const yesNo = (ok, what) => (ok ? "included / 已附" : "not loaded / 未载入") + (what ? " (" + what + ")" : "");
    const m = L.machine, rv = L.review;
    const lines = [
      "TutorBench Observatory · review pack / 复核包",
      "Batch / 批次: " + batchId + (batch && batch.kind ? " (" + batch.kind + (L.gate ? ", gate " + L.gate : "") + (L.phase ? ", " + L.phase : "") + ")" : ""),
      "Class / 类别: " + L.class + " / " + { diagnostic: "诊断", calibration: "正式校准", evaluation: "导师评测" }[L.class],
      "Exported / 导出: " + exportedAt,
      "Source / 来源: " + (synthetic ? "synthetic sample bundled with the page; JSON re-serialised, NOT original bytes / 合成示例，重新序列化，不是原始字节"
        : "folder \"" + (st.source.name || "") + "\", original bytes / 打开的文件夹，原始字节"),
      "",
      "Read first / 先读: manifest.json (what is here, the three layers, every file with its role and SHA-256 / 包里有什么、三层结论、每个文件的用途和哈希)",
      "",
      "Inside / 包里有",
      "- records/: " + recs.length + " records of this batch, " + recs.filter(r => sup[r.runId]).length + " superseded / 本批全部记录，含被替代的",
      "- " + [batch ? "batches/" + batchId + ".json" : null, report ? "calibration-report-" + batchId + ".json" : null, indexText != null ? "index.jsonl (this batch's lines, unchanged / 本批的行，原样)" : null].filter(Boolean).join(", "),
      "- expectations: " + yesNo(hasRole("expectations")),
      "- content review / 内容复核: " + yesNo(hasRole("content-review"), review ? review.status : null),
      "- gate or final outputs / 关口或最终结论: " + (c.final.outputs.length ? c.final.outputs.map(o => o.kind + " " + o.scope + " " + o.verdict).join(", ") : "none / 没有"),
      "- probe file / 探针文件: " + (c.probes ? yesNo(hasRole("probe-set"), (batch && batch.probeSetVersion) || null) : "not a probe batch / 不是探针批次"),
      "- review-index.csv: one row per record. Checker results are copied from the report; counts come from the records. / 每段一行：检查器结论照抄报告，计数来自记录。",
      "- review-items.csv: " + (reviewRows.length ? "one row per checker review item, machine label beside the reviewer's decision and the result by the rules / 每个复核项一行：机器标记、复核决定、按规则的结果" : "not written, the report has no review items / 报告没有复核项，没有这张表"),
      "- messages.csv: one row per student message of every attempt, kept or sent back: raw output, model text and events, injected text, runner and dropped events, final text / 每条学生消息一行（含退回的）：原始输出、模型原话和事件、注入、runner 加的和丢掉的事件、最终消息",
      "- SHA256SUMS.txt: SHA-256 of every other file here / 包内其余文件的 SHA-256",
      "",
      "Three layers, kept apart / 三层分开",
      "- Machine verdict / 机器判定: " + (m ? m.verdict + (m.reportVerdict !== m.verdict ? " (report verdict / 报告总结论 " + m.reportVerdict + ")" : "") + " · checker " + (m.checkerRevision || "v" + m.checkerVersion)
        + " · " + m.runsPassing + "/" + m.runs + " runs, " + m.groupsPassing + "/" + m.groups + " groups" : c.cannotCheck ? "CANNOT_CHECK" : "no report loaded / 未载入报告"),
      "- Content review / 内容复核: " + (L.class === "diagnostic" ? "not required for a diagnostic batch / 诊断批次不需要" : !rv.required && !review ? (report && report.humanReviewPending === true ? "pending (report: humanReviewPending) / 待复核" : "no review items / 没有复核项")
        : !review ? "no review file loaded / 未载入复核文件" : rv.status + " · " + rv.counts.decided + "/" + rv.counts.items + " decided, " + rv.counts.fails + " failed, " + rv.counts.overrides + " overrides, " + rv.counts.pending + " pending"),
      "- Final verdict / 最终结论: " + (L.final.refused ? "refused, a final verdict never takes a diagnostic batch / 不适用，最终结论不收诊断批次"
        : L.final.outputs.length ? L.final.outputs.map(o => o.kind + " " + o.scope + ": " + o.verdict + (o.reviewStatus ? " (review " + o.reviewStatus + ")" : "")).join("; ") : "none loaded; the page never works one out / 未载入，页面不自己算"),
      "",
      "Not included / 没有放进来",
    ];
    if (L.class === "diagnostic") notes.push("- DIAGNOSTIC: for development only. Do not count these runs toward any gate or final verdict. / 诊断批次只用于开发，不计入任何关口或最终结论。");
    const ignored = src ? src.ignored : [];
    if (ignored.length) for (const x of ignored) lines.push("- " + x.path + " (" + x.size + " bytes): in the opened folder, not read by the page / 文件夹里有，页面不读取");
    else lines.push("- (no other files in the opened folder / 打开的文件夹里没有其他文件)");
    if (!report && batch && M.isCalibrationKind(batch.kind)) lines.push("- No calibration report was loaded for this batch / 这个批次没有载入校准报告");
    lines.push(
      "- Cards, student prompts, the checker, build outputs and launch evidence are not part of a runs folder; attach them separately if the reviewer needs them. / 卡片、学生提示、检查器、编译产物和启动证据不在 runs 文件夹里，需要时另附。",
      "",
      "Limits / 限制",
      ...notes,
      "- The page does not read the ledger database (.premium.sqlite), re-run the checker or check provider invoices. / 页面不读账本数据库，不重跑检查器，不核对厂商账单。",
      "- Costs are the runner's price-table estimates unless an invoice was reconciled. / 费用是价格表估算，除非已对账。",
      "- A SHA-256 sum shows a file has not changed since this export. It is not a signature. / 哈希只说明导出后没变，不是签名。", "");
    add("README.txt", lines.join("\n"), "readme");
    // The manifest lists every file above with its role and hash, then the layers as the page read them.
    const manifest = {
      schema: "tutorbench.observatory-review-pack", schemaVersion: 1, exportedAt,
      source: synthetic ? { kind: "synthetic-sample", originalBytes: false } : { kind: "folder", name: st.source.name || null, originalBytes: true },
      ...L,
      counts: { records: recs.length, adopted: recs.filter(r => !sup[r.runId]).length, superseded: recs.filter(r => sup[r.runId]).length, reviewItems: reviewRows.length, studentMessages: messageRows.length },
      files: files.map(f => ({ path: f.path, role: f.role, bytes: P.bytesOf(f.data).length, sha256: P.sha256(P.bytesOf(f.data)),
        ...(f.runId ? { runId: f.runId, adopted: f.adopted } : {}), ...(f.columns ? { rows: f.rows, columns: f.columns } : {}) })),
      notRead: ignored.map(x => ({ path: x.path, bytes: x.size })),
      rules: [
        "Machine verdict, content review and final verdict are separate layers; the page copies each from its own file and never derives one from another.",
        "A diagnostic batch needs no content review, and no gate or final verdict may count it.",
        "An undecided needs_review item counts as fail once the review is complete; auto_fail passes only with an override.",
      ],
    };
    add("manifest.json", JSON.stringify(manifest, null, 2) + "\n", "manifest");
    files.push({ path: "SHA256SUMS.txt", data: files.map(f => P.sha256(P.bytesOf(f.data)) + "  " + f.path).join("\n") + "\n" });
    const bytes = P.zip(files.map(f => ({ path: folder + f.path, data: f.data })), exportedAt);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const a = el("a", { href: url, download: "review-pack-" + batchId + ".zip", hidden: true });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // ---------- Calibration ----------
  // One calibration batch at a time. Three layers stay apart: the machine check (copied from the report), formal tutor
  // scoring (never, for a calibration batch) and the independent content review (only the report's pending flag; this page
  // records no review outcome). Nothing here re-checks a run: verdicts, groups and rates come from the report.
  const pctText = x => (x == null ? "—" : String(Math.round(x * 1000) / 10) + "%");
  const tOr = (key, fallback) => (T[st.lang][key] != null || T.en[key] != null ? t(key) : fallback);
  const expPath = e => { const s = st.files && st.files.expectations.find(x => x.value === e); return s ? s.path : "expectations.json"; };
  const runLabel = r => whoOf(r) + " · " + langShort(r.card.lang) + " #" + r.repeat.index;
  function renderCalibration() {
    const d = st.dataset, list = M.calibrationBatches(d);
    if (!list.some(b => b.batchId === st.calib)) st.calib = list.length ? list[0].batchId : null;
    if (!st.calib) return;
    const c = M.calibrationOf(d, st.calib);
    const box = $("calib");
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" }, el("h2", { id: "calib-title", text: t("calibTitle") }), el("p", { class: "lede", text: t("calibLede") })),
      list.length > 1 ? el("div", { class: "filters" }, select("calib-batch", t("calibBatch"), st.calib, list.map(b => [b.batchId, batchOption(b)]),
        v => { st.calib = v; st.calibSel = null; render(); })) : el("span", { class: "mono muted", text: st.calib })));
    box.append(classStrip(c.cls), calibLayers(c), el("div", { class: "calib-facts" }, calibCriteria(c), calibRates(c)));
    renderCalibGroups(c); renderCalibRewrites(c); renderCalibDeviations(c); renderCalibReview(c); renderCalibIntegrity(c);
  }
  // A batch in a picker: its id, what it is for and, when it has no report, that.
  const batchOption = b => [b.batchId, t("cls_" + clsOf(b)), b.kind === "calibration-probe" && b.gate !== "diagnostic" ? (b.phase || (b.gate ? tOr("gate_" + b.gate, b.gate) : null)) : null,
    st.dataset.reports.has(b.batchId) ? null : t("v_none")].filter(Boolean).join(" · ");
  // What this batch is for, among the three, with the rule that keeps them apart.
  function classStrip(cls) {
    return el("div", { class: "cls-strip" },
      el("ol", { class: "cls-list" }, ["diagnostic", "calibration", "evaluation"].map(k => el("li", { class: "cls cls-" + k + (k === cls ? " on" : ""), "aria-current": k === cls ? "true" : null },
        el("span", { class: "cls-name" }, t("cls_" + k), k === cls ? el("span", { class: "cls-here", text: t("clsHere") }) : null),
        el("span", { class: "cls-note", text: t("clsNote_" + k) })))),
      el("p", { class: "cls-rule", text: t("clsRule") }));
  }
  // Three layers, never mixed: what the checker decided, what the reviewer decided, and the gate or final verdict written
  // from both. Each is copied from its own file; the page never turns one into another.
  function calibLayers(c) {
    const m = c.machine, rv = c.review, fin = c.final, verdict = c.cannotCheck ? "CANNOT_CHECK" : m ? m.verdict : "none";
    const layer = (no, title, kind, value, notes, cls) => el("div", { class: "layer " + cls, role: "listitem" },
      el("span", { class: "layer-no", text: no }), el("h3", { text: title }),
      el("p", { class: "layer-value" }, pip(kind), el("span", { text: value })),
      notes.filter(Boolean).map(n => (n instanceof Node ? n : el("p", { class: "small muted", text: n }))));
    const vKind = v => (v === "PASS" ? "good" : v === "FAIL" ? "fail" : v === "PENDING_REVIEW" ? "needs_review" : "calibration");
    const machine = layer("1", t("layerMachine"), vKind(verdict), tOr("v_" + verdict, verdict),
      [m ? t("machineLine", { v: m.checkerRevision || m.checkerVersion, r: m.runsPassing, n: m.runs, g: m.groupsPassing, m: m.groups }) + (m.dryRun ? " · " + t("dryRunTag") : "") : null,
        m && m.reportVerdict && m.reportVerdict !== m.verdict ? t("reportSays", { v: tOr("v_" + m.reportVerdict, m.reportVerdict) }) : null,
        c.cannotCheck ? t("cannotCheckNote") : !c.report ? t("noReportNote") : null], "machine v-" + verdict.toLowerCase());
    let review;
    if (c.cls === "diagnostic") review = layer("2", t("layerReview"), "calibration", t("reviewNotNeeded"), [t("reviewDiagNote")], "review");
    else if (!rv.counts.items && !rv.file) {
      // Checker v2 writes no review items; the report's pending flag is all there is.
      review = layer("2", t("layerReview"), c.contentReview === "pending" ? "needs_review" : "calibration",
        t(c.contentReview === "pending" ? "reviewPending" : c.contentReview === "not_pending" ? "reviewNotPending" : "reviewUnstated"),
        [c.contentReview === "pending" ? t("reviewPendingNote") : c.contentReview === "unstated" ? t("reviewUnstatedNote") : null, c.checked && m.checkerVersion >= 3 ? t("reviewNoItems") : null], "review");
    } else if (!rv.file) review = layer("2", t("layerReview"), "needs_review", t("reviewNoFile"), [t("reviewNoFileNote", { n: rv.counts.needsReview + rv.counts.autoFail })], "review");
    else {
      const k = rv.counts;
      review = layer("2", t("layerReview"), rv.complete ? (k.fails || k.undecidedFail ? "fail" : "good") : "needs_review", t(rv.complete ? "reviewComplete" : "reviewOpen"),
        [t("reviewLine", { d: k.decided, n: k.items, f: k.fails, o: k.overrides }), k.pending ? t("reviewPendingLine", { p: k.pending }) : null,
          k.undecidedFail ? t("reviewUndecidedLine", { u: k.undecidedFail }) : null,
          t("reviewBy", { r: rv.reviewer || "—", b: rv.blind == null ? "—" : t(rv.blind ? "blindYes" : "blindNo") }), rv.scope ? el("p", { class: "small faint", text: rv.scope }) : null], "review");
    }
    let final;
    if (fin.diagnostic) final = layer("3", t("layerFinal"), "calibration", t("finalRefused"), [t("finalRefusedNote")], "final");
    else if (!fin.outputs.length) final = layer("3", t("layerFinal"), "calibration", t("finalNone"), [t("finalNoneNote")], "final");
    else {
      const o = fin.outputs[fin.outputs.length - 1];
      final = layer("3", t("layerFinal"), vKind(o.verdict), tOr("v_" + o.verdict, o.verdict),
        fin.outputs.map(x => [t("finalKind_" + x.kind, { s: x.scope }), x.reviewStatus ? t("finalReview", { s: tOr("reviewStatus_" + x.reviewStatus, x.reviewStatus) }) : null,
          x.batches.length > 1 ? t("finalMerged", { n: x.batches.length }) : null, x.overrides.length ? t("finalOverrides", { n: x.overrides.length }) : null,
          x.errors.length ? t("finalErrors", { n: x.errors.length }) : null].filter(Boolean).join(" · ")), "final v-" + String(o.verdict).toLowerCase());
    }
    return el("div", { class: "layers", role: "list" }, machine, review, final);
  }
  function calibCriteria(c) {
    const cr = c.criteria, e = c.expectations, items = [];
    if (e) {
      items.push(t("critRun", { h: cr.maxHard, s: cr.maxSoft }));
      if (c.machine && c.machine.dryRun) items.push(t("critDryGroup"));
      else items.push(t(cr.probes ? "critProbe" : "critGroup", { r: cr.groupRuns, m: cr.minPassingRuns }));
      items.push(t(cr.probes ? "critProbeAll" : "critAll"));
    }
    if (cr && cr.rewriteRateMax != null) items.push(t("critRewrite", { x: pctText(cr.rewriteRateMax) }));
    return el("div", { class: "criteria" }, el("h3", { text: t("criteriaTitle") }), items.length ? el("ul", null, items.map(x => el("li", { text: x }))) : null,
      el("p", { class: "small faint", text: e ? t("criteriaFrom", { f: expPath(e), v: cr.rulesVersion || "—" }) : t("criteriaMissing") }));
  }
  function calibRates(c) {
    const m = c.machine;
    if (!m) return null;
    const fig = (label, value, sub, flag, cls) => el("div", { class: "rate-fig" + (cls ? " " + cls : "") }, el("span", { class: "rf-label", text: label }),
      el("span", { class: "rf-num", text: value }), flag ? el("span", { class: "rf-flag", text: flag }) : null, el("span", { class: "rf-sub", text: sub }));
    const w = m.rewrite, dc = m.discard, ft = m.firstTryByMessage, fm = m.observedFormats;
    // Checker v3 also counts, per student message, how often the first reply was accepted, and the formats it saw.
    const extra = ft || fm ? el("div", { class: "rates-more" },
      ft ? el("div", null, el("span", { class: "rf-label", text: t("firstTry") }), el("span", { class: "rf-sub", text: t("firstTrySub") }),
        el("div", { class: "ft" }, Object.entries(ft).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, x]) => el("span", { class: "ft-cell" },
          el("span", { class: "small faint", text: t("msgCol", { n }) }), el("span", { class: "ft-num", text: x.accepted + "/" + x.positions }))))) : null,
      fm ? el("div", null, el("span", { class: "rf-label", text: t("formats") }),
        el("div", { class: "tags" }, Object.entries(fm).sort((a, b) => b[1] - a[1]).map(([k, n]) => el("span", { class: "tag" + (k === "json" ? "" : " soft"), text: k + " " + n })))) : null) : null;
    return el("div", { class: "rates-wrap" }, el("div", { class: "rates" },
      w ? fig(t("rateRewrite"), pctText(w.rate), t("rateRewriteSub", { x: w.extraRewrites, p: w.positions, m: pctText(w.max) }),
        w.pass === false ? "✕ " + t("overLimit") : w.pass === true ? "✓ " + t("withinLimit") : null, w.pass === false ? "over" : null) : null,
      dc ? fig(t("rateDiscard"), pctText(dc.rate), t("rateDiscardSub", { d: dc.discarded, a: dc.attempts }), null) : null,
      fig(t("rateSpend"), usd(m.spentUsd), t("rateSpendSub") + (m.batchStatus ? " · " + code(m.batchStatus) : ""), null)), extra);
  }

  // A student specimen: the stem grows one node per student message; each message the model wrote puts out a leaf that
  // grows with the times it was sent back. A red leaf is a hard deviation the checker found at that message, a dashed
  // one a soft deviation. The head is the checker's result. Dots by the root are discarded attempts.
  function studentData(rec, check) {
    const atts = M.attemptsOf(rec), last = atts[atts.length - 1];
    const students = last.lines.filter(l => l.role === "student");
    const dev = new Map();
    if (check) {
      for (const line of check.hard || []) { const p = M.parseCheckerLine(line); if (p.n != null) dev.set(p.n, "hard"); }
      for (const line of check.soft || []) { const p = M.parseCheckerLine(line); if (p.n != null && !dev.has(p.n)) dev.set(p.n, "soft"); }
    }
    return { n: students.length, fixed: students.map(s => !!s.fixed || !!s.prefix), rewrites: students.map(s => (s.checks && s.checks.regenerated) || 0), dev,
      seeds: atts.filter(a => a.status === "discarded").length, left: !!(rec.end && rec.end.reason === "left"), kind: check ? (check.pass ? "good" : "fail") : "calibration" };
  }
  function drawStudent(target, d, maxN, big) {
    const step = SP_ROOM / Math.max(1, maxN), cx = SPW / 2, top = SPH - d.n * step;
    target.append(svg("line", { class: "stem", x1: cx, x2: cx, y1: SPH, y2: top }));
    for (let i = 1; i <= d.n; i++) {
      const dev = d.dev.get(i), k = d.rewrites[i - 1] || 0;
      if (d.fixed[i - 1] && !dev) continue;
      const y = SPH - (i - .5) * step, side = i % 2 ? 1 : -1, len = 1.6 + k * 2.6 + (dev ? 1.2 : 0);
      const leaf = svg("line", { class: "leaf" + (dev ? " " + dev : "") + (k || dev ? "" : " bud"), x1: cx, y1: y, x2: cx + side * len, y2: y - len * .45 });
      if (!big) { target.append(leaf); continue; }
      // In the drawer each leaf is a target that jumps to its message.
      const g = svg("g", { class: "turn", "data-msg": i, "data-tip": t("msgN", { n: i }) + (k ? " · " + t("rewrites", { n: k }) : "") + (dev ? " · " + t("checkerAt") + " " + t(dev) : "") });
      g.append(svg("rect", { class: "hit", x: 0, y: y - step / 2, width: SPW, height: step }), leaf);
      target.append(g);
    }
    for (let s = 0; s < d.seeds; s++) target.append(svg("circle", { class: "seed", cx: cx - 3.4 - s * 2.6, cy: SPH - 1.2, r: 1 }));
    target.append(head(d.kind, cx, top - HEAD - .6 - (d.left ? 3.4 : 0)));
    return target;
  }
  function studentTip(rec, check, d) {
    return [runLabel(rec), check ? t(check.pass ? "sHeadPass" : "sHeadFail") + " · " + t("machineRun", { h: check.hard.length, s: check.soft.length, x: check.extraRewrites }) : t("sHeadNone"),
      code(rec.end && rec.end.reason), d.seeds ? t("discarded", { n: d.seeds }) : null].filter(Boolean).join(" · ");
  }
  function studentSpecimen(rec, check, maxN) {
    const d = studentData(rec, check);
    return drawStudent(svg("svg", { class: "sp student " + d.kind, viewBox: `0 0 ${SPW} ${SPH}`, preserveAspectRatio: "xMidYMax meet", "data-run": rec.runId, "data-tip": studentTip(rec, check, d) }), d, maxN);
  }
  function studentKey() {
    const ex = { n: 7, fixed: [true], rewrites: [0, 2, 0, 1, 0, 0, 0], dev: new Map([[4, "hard"], [6, "soft"]]), seeds: 1, left: false, kind: "fail" };
    const fig = drawStudent(svg("svg", { class: "sp key-sp", viewBox: `0 0 ${SPW} ${SPH}`, "aria-hidden": "true" }), ex, 9);
    const row = (k, v, cls) => el("div", { class: cls || null }, el("dt", { text: k }), el("dd", { text: v }));
    return el("figure", { class: "key" }, fig,
      el("dl", null, row(t("keyHead"), t("sKeyHeadIs")), row(t("keyStem"), t("sKeyStemIs")), row(t("keyLeaf"), t("sKeyLeafIs")), row(t("sKeyRed"), t("sKeyRedIs"), "crit"),
        row(t("sKeyDash"), t("sKeyDashIs")), row(t("sKeySeed"), t("sKeySeedIs"))),
      el("div", { class: "heads" }, [["good", "sHeadPass"], ["fail", "sHeadFail"], ["calibration", "sHeadNone"]].map(([k, l]) => el("span", null, pip(k), t(l)))));
  }

  // Plate I: one row per scripted tutor, one column per language, one student specimen per adopted run.
  function renderCalibGroups(c) {
    const box = $("calib-groups"), sup = st.dataset.supersededBy || {};
    box.append(plateHead("I", "calib-groups-title", t("plateGroups"), studentKey()));
    if (!c.groups.length) { box.append(el("p", { class: "empty-note", text: t("noData") })); return; }
    const maxN = Math.max(8, ...c.adopted.map(r => (r.transcript || []).filter(l => l.role === "student").length));
    const grid = el("div", { class: "cgrid", style: "--langs:" + c.langs.length, role: "table", "aria-labelledby": "calib-groups-title" });
    grid.append(el("div", { class: "crow head", role: "row" }, el("span", { role: "columnheader" }), c.langs.map(l => el("span", { role: "columnheader", text: langName(l) }))));
    for (const g of c.groups) {
      grid.append(el("div", { class: "crow" + (g.optional ? " optional" : ""), role: "row" },
        el("div", { class: "cwho", role: "rowheader" }, el("strong", { text: g.label }), g.purpose ? el("span", { class: "small muted cpurpose", text: g.purpose }) : null,
          g.optional ? el("span", { class: "small faint", text: t("optionalGroup") }) : null),
        g.cells.map(cell => {
          const field = el("div", { class: "field cfield" });
          for (const x of cell.runs) field.append(studentSpecimen(x.record, x.check, maxN));
          field.addEventListener("click", e => { const n = e.target.closest("[data-run]"); if (n) openRun(n.getAttribute("data-run")); });
          const replaced = c.records.filter(r => sup[r.runId] && M.runKey(r) === g.key && r.card.lang === cell.lang).length;
          const gr = cell.group, after = afterReview(c, g.key, cell.lang);
          return el("div", { class: "ccell", role: "cell" },
            el("span", { class: "clang", text: langName(cell.lang) }),
            el("div", { class: "cnum" + (gr ? (gr.optional ? "" : gr.pass ? " pass" : " fail") : " none") },
              gr ? [el("span", { class: "n", text: String(gr.passing) }), el("span", { class: "of", text: t("groupOf", { n: gr.runs }) })] : el("span", { class: "of", text: t("groupNoReport", { n: cell.runs.length }) }),
              gr && !gr.optional ? el("span", { class: "gmark" }, pip(gr.pass ? "good" : "fail"), t(gr.pass ? "groupPass" : "groupFail")) : null,
              after ? el("span", { class: "gmark after" + (after.pass ? "" : " fail"), "data-tip": t("afterReviewTip") }, t("afterReview", { p: after.passing, n: after.runs })) : null),
            el("div", { class: "cbody" }, field, replaced ? el("span", { class: "small faint", text: t("groupSuperseded", { n: replaced }) }) : null));
        })));
    }
    box.append(el("div", { class: "cgrid-box" }, grid), el("p", { class: "plate-foot", text: t("groupsNote") }));
  }

  // The group as the newest gate or final output that names this batch writes it, after the content review.
  const afterReview = (c, key, lang) => {
    const o = c.final.outputs[c.final.outputs.length - 1];
    return o ? o.groups.find(x => x.key === key && x.lang === lang) || null : null;
  };
  // A heat cell: the count in a single-hue wash, darker for more. Empty cells stay blank.
  const heatLevel = (k, max) => (k ? Math.max(1, Math.ceil((4 * k) / Math.max(1, max))) : 0);
  function selectionList(title, entries, onClear) {
    return el("div", { class: "sel" }, el("div", { class: "sel-head" }, el("strong", { text: title }), el("button", { type: "button", class: "btn-quiet", onclick: onClear }, t("selClear"))),
      el("ul", null, entries));
  }

  // Plate II: replies sent back, by rule (grouped by family) and by student message.
  function renderCalibRewrites(c) {
    const box = $("calib-rewrites");
    box.append(plateHead("II", "calib-rw-title", t("plateRewrites"), el("p", { class: "plate-note", text: t("rewritesNote") })));
    const rows = c.rejects.filter(x => !x.superseded), supN = c.rejects.length - rows.length;
    const foot = supN ? el("p", { class: "plate-foot", text: t("rejectsSuperseded", { n: supN }) }) : null;
    if (!rows.length) { box.append(el("p", { class: "empty-note", text: t("noRejects") }), foot); return; }
    const ns = [...new Set(rows.map(x => x.n))].sort((a, b) => a - b);
    const fam = ["format", "protocol", "state", "other"];
    const rules = [...new Set(rows.flatMap(x => x.reasons))].map(r => [r, M.ruleFamily([r])]).sort((a, b) => fam.indexOf(a[1]) - fam.indexOf(b[1]) || a[0].localeCompare(b[0]));
    const hits = (rule, n) => rows.filter(x => x.reasons.includes(rule) && (n == null || x.n === n));
    const max = Math.max(1, ...rules.flatMap(([r]) => ns.map(n => hits(r, n).length)));
    const sel = st.calibSel && st.calibSel.plate === "rw" && st.calibSel.batchId === c.batchId ? st.calibSel : null;
    const rerender = () => { clear(box); renderCalibRewrites(c); };
    const cell = (rule, n) => {
      const k = hits(rule, n).length, on = sel && sel.rule === rule && sel.n === n;
      return el("td", { class: "hc" }, k ? el("button", { type: "button", class: "heat h" + heatLevel(k, max) + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        "data-tip": code(rule) + " · " + t("msgN", { n }) + " · " + k, onclick: () => { st.calibSel = on ? null : { plate: "rw", batchId: c.batchId, rule, n }; rerender(); } }, String(k)) : null);
    };
    const body = el("tbody");
    for (const f of fam) {
      const inFam = rules.filter(x => x[1] === f);
      if (!inFam.length) continue;
      body.append(el("tr", { class: "fam" }, el("th", { scope: "rowgroup", colspan: String(ns.length + 2), text: t("family_" + f) })));
      for (const [rule] of inFam) body.append(el("tr", null, el("th", { scope: "row", class: "rule", text: code(rule) }), ns.map(n => cell(rule, n)), el("td", { class: "num total", text: String(hits(rule).length) })));
    }
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "heatmap" },
      el("thead", null, el("tr", null, el("th", { text: t("ruleCol") }), ns.map(n => el("th", { class: "num", text: t("msgCol", { n }) })), el("th", { class: "num", text: t("totalCol") }))), body)));
    if (sel) {
      const picked = hits(sel.rule, sel.n), byRun = M.groupBy(picked, x => x.runId);
      box.append(selectionList(t("selTitle", { what: code(sel.rule) + " · " + t("msgN", { n: sel.n }), n: byRun.size }),
        [...byRun].map(([runId, xs]) => {
          const r = st.dataset.runs.find(y => y.runId === runId);
          return el("li", null, el("button", { type: "button", class: "btn-quiet run-link", onclick: () => openRun(runId, false, { attempt: xs[0].attempt, n: sel.n }) }, r ? runLabel(r) : shortRun(runId)),
            el("span", { class: "small muted", text: " " + xs.map(x => t("attemptTab", { n: x.attempt }) + (x.attemptStatus !== "kept" ? "（" + tOr("attempt_" + x.attemptStatus, code(x.attemptStatus)) + "）" : "")).join(" · ") }));
        }), () => { st.calibSel = null; rerender(); }));
    }
    if (foot) box.append(foot);
  }

  // Plate III: the checker's deviations, by group (tutor × language) and by student message. Copied from the report.
  function renderCalibDeviations(c) {
    const box = $("calib-dev");
    box.append(plateHead("III", "calib-dev-title", t("plateDeviations"), el("p", { class: "plate-note", text: t("deviationsNote") })));
    if (!c.checked) { box.append(el("p", { class: "empty-note", text: t("devNeedReport") })); return; }
    if (!c.deviations.length) { box.append(el("p", { class: "empty-note", text: t("noDeviations") })); return; }
    const ns = [...new Set(c.deviations.filter(x => x.n != null).map(x => x.n))].sort((a, b) => a - b);
    const cols = c.deviations.some(x => x.n == null) ? [...ns, null] : ns;
    const groups = c.groups.flatMap(g => g.cells.map(cell => ({ tutor: g.tutor, lang: cell.lang, label: g.label + " · " + langShort(cell.lang), runs: cell.runs.length })));
    const at = (g, n, kind) => c.deviations.filter(x => x.tutor === g.tutor && x.lang === g.lang && x.n === n && (!kind || x.kind === kind));
    const runsOf = xs => new Set(xs.map(x => x.runId)).size;
    const max = Math.max(1, ...groups.flatMap(g => cols.map(n => runsOf(at(g, n, "hard")))));
    const sel = st.calibSel && st.calibSel.plate === "dev" && st.calibSel.batchId === c.batchId ? st.calibSel : null;
    const rerender = () => { clear(box); renderCalibDeviations(c); };
    const body = el("tbody", null, groups.map(g => el("tr", null, el("th", { scope: "row", class: "rule", text: g.label }), cols.map(n => {
      const h = runsOf(at(g, n, "hard")), s = runsOf(at(g, n, "soft")), on = sel && sel.tutor === g.tutor && sel.lang === g.lang && sel.n === n;
      if (!h && !s) return el("td", { class: "hc" });
      return el("td", { class: "hc" }, el("button", { type: "button", class: "heat h" + heatLevel(h, max) + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        "data-tip": g.label + " · " + (n == null ? t("wholeRun") : t("msgN", { n })) + " · " + t("hard") + " " + h + " · " + t("soft") + " " + s,
        onclick: () => { st.calibSel = on ? null : { plate: "dev", batchId: c.batchId, tutor: g.tutor, lang: g.lang, n }; rerender(); } },
        h ? el("span", { class: "hn", text: String(h) }) : null, s ? el("span", { class: "sn", text: t("softShort") + " " + s }) : null));
    }))));
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "heatmap dev" },
      el("thead", null, el("tr", null, el("th", { text: t("groupCol") }), cols.map(n => el("th", { class: "num", text: n == null ? t("wholeRun") : t("msgCol", { n }) })))), body)));
    if (sel) {
      const g = groups.find(x => x.tutor === sel.tutor && x.lang === sel.lang);
      const picked = g ? at(g, sel.n) : [];
      const byRun = M.groupBy(picked, x => x.runId);
      box.append(selectionList(t("selTitle", { what: (g ? g.label : "") + " · " + (sel.n == null ? t("wholeRun") : t("msgN", { n: sel.n })), n: byRun.size }),
        [...byRun].map(([runId, xs]) => {
          const r = st.dataset.runs.find(y => y.runId === runId);
          return el("li", null, el("button", { type: "button", class: "btn-quiet run-link", onclick: () => openRun(runId, false, sel.n == null ? null : { n: sel.n }) }, r ? runLabel(r) : shortRun(runId)),
            xs.map(x => el("div", { class: "small" }, el("span", { class: "tag" + (x.kind === "hard" ? " crit" : ""), text: t(x.kind) }), " ", el("span", { class: "mono", text: x.text }))));
        }), () => { st.calibSel = null; rerender(); }));
    }
  }

  // Plate IV: the content review. Rows are the checker's labels, columns the reviewer's decisions; each cell lists its
  // items. Decisions are copied from the review file, and the result of an undecided item follows the stated rules.
  function renderCalibReview(c) {
    const box = $("calib-review"), rv = c.review;
    box.append(plateHead("IV", "calib-review-title", t("plateReview"), el("p", { class: "plate-note", text: t("reviewPlateNote") })));
    if (!c.checked) { box.append(el("p", { class: "empty-note", text: t("devNeedReport") })); return; }
    if (!rv.items.length) { box.append(el("p", { class: "empty-note", text: t("reviewNoItems") })); return; }
    if (c.cls === "diagnostic") box.append(el("p", { class: "small muted", text: t("reviewDiagNote") }));
    const rows = ["auto_pass", "needs_review", "auto_fail", ...Object.keys(rv.byMachine).filter(k => !["auto_pass", "needs_review", "auto_fail"].includes(k))];
    const cols = ["pass", "fail", "undecided"];
    const at = (m, dcs) => rv.items.filter(x => x.machine === m && (x.decision || "undecided") === dcs);
    const max = Math.max(1, ...rows.flatMap(m => cols.map(k => at(m, k).length)));
    const sel = st.calibSel && st.calibSel.plate === "rv" && st.calibSel.batchId === c.batchId ? st.calibSel : null;
    const rerender = () => { clear(box); renderCalibReview(c); };
    const body = el("tbody", null, rows.map(m => el("tr", null, el("th", { scope: "row", class: "rule", text: tOr("m_" + m, m) }), cols.map(k => {
      const xs = at(m, k), n = xs.length, on = sel && sel.m === m && sel.k === k;
      if (!n) return el("td", { class: "hc" });
      // Within a cell, items that override the machine or count as fail by the rules are marked.
      const flag = xs.some(x => x.overridesMachine) ? " ↺" : xs.some(x => x.undecidedFail) ? " ✕" : "";
      return el("td", { class: "hc" }, el("button", { type: "button", class: "heat h" + heatLevel(n, max) + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        "data-tip": tOr("m_" + m, m) + " · " + t("dec_" + k) + " · " + t("itemsN", { n }),
        onclick: () => { st.calibSel = on ? null : { plate: "rv", batchId: c.batchId, m, k }; rerender(); } }, String(n) + flag));
    }), el("td", { class: "num total", text: String(rv.items.filter(x => x.machine === m).length) }))));
    box.append(el("div", { class: "scroll-x" }, el("table", { class: "heatmap review" },
      el("thead", null, el("tr", null, el("th", { text: t("machineLabelCol") }), cols.map(k => el("th", { class: "num", text: t("dec_" + k) })), el("th", { class: "num", text: t("totalCol") }))), body)));
    if (sel) {
      const picked = at(sel.m, sel.k);
      box.append(selectionList(t("selTitle", { what: tOr("m_" + sel.m, sel.m) + " · " + t("dec_" + sel.k), n: new Set(picked.map(x => x.runId)).size }),
        picked.map(x => el("li", { class: "ritem" },
          el("div", { class: "ritem-head" }, el("button", { type: "button", class: "btn-quiet run-link", onclick: () => openRun(x.runId, false, x.messages.length ? { n: x.messages[0] } : null) },
            x.record ? runLabel(x.record) : shortRun(x.runId)),
          el("span", { class: "mono small", text: x.itemId }), x.messages.length ? el("span", { class: "small faint", text: x.messages.map(n => t("itemAt", { n })).join(" · ") }) : null,
          el("span", { class: "tag" + (x.effective === "fail" ? " crit" : x.effective === "pending" ? " soft" : ""), text: t("eff_" + x.effective) }),
          x.overridesMachine ? el("span", { class: "tag accent", text: t("overridesTag") }) : null, x.undecidedFail ? el("span", { class: "tag crit", text: t("undecidedFailTag") }) : null),
          x.question ? el("div", { class: "small muted", text: t("itemQuestion") + colon() + x.question }) : null,
          x.machineQuote ? el("div", { class: "small" }, el("span", { class: "faint", text: t("machineQuote") + " " }), el("q", { text: x.machineQuote })) : null,
          x.quote ? el("div", { class: "small" }, el("span", { class: "faint", text: t("itemQuote") + " " }), el("q", { text: x.quote })) : null,
          x.note ? el("div", { class: "small muted", text: t("itemNote") + colon() + x.note }) : null)),
        () => { st.calibSel = null; rerender(); }));
    }
    if (rv.unknown.length) box.append(el("p", { class: "small stopped" }, t("reviewUnknown", { n: rv.unknown.length }) + " ",
      el("span", { class: "mono", text: rv.unknown.slice(0, 6).map(x => shortRun(x.recordId) + "/" + x.itemId).join(", ") })));
    box.append(el("p", { class: "plate-foot", text: t("reviewRules") }));
  }

  // Plate V: whether the batch itself is whole, from the report where it says so and from the records otherwise.
  // Why a record stopped: its last attempt's reason when the record has attempts (v4+), else its end.
  const stopReason = r => { const a = Array.isArray(r.attempts) && r.attempts.length ? r.attempts[r.attempts.length - 1] : null; return (a && a.status !== "kept" && a.reason) || (r.end && r.end.reason); };
  function renderCalibIntegrity(c) {
    const box = $("calib-int"), d = st.dataset, sup = d.supersededBy || {}, m = c.machine;
    box.append(plateHead("V", "calib-int-title", t("plateIntegrity")));
    const dl = el("dl", { class: "kv integrity" });
    const row = (k, ...v) => dl.append(el("dt", { text: k }), el("dd", null, ...v));
    const none = () => el("span", { class: "muted", text: t("intNone") });
    if (c.checked) {
      row(t("intCohort"), m.cohortErrors.length ? el("ul", null, m.cohortErrors.map(x => el("li", { class: "small stopped mono", text: x }))) : el("span", { class: "muted", text: t("intCohortOk") }));
      const inReport = new Set(c.report.runs.map(x => x.runId)), missing = c.adopted.filter(r => !inReport.has(r.runId));
      if (missing.length) row(t("intMissing"), el("div", { class: "tags" }, missing.map(r => runButton(r.runId))));
    }
    const replaced = c.records.filter(r => sup[r.runId]);
    row(t("intSuperseded"), replaced.length ? el("div", { class: "sup-list" }, replaced.map(r => el("div", { class: "small" }, runButton(r.runId),
      " " + t("intSupLine", { s: code(r.status) + " · " + code(stopReason(r)), usd: usd(r.usage ? r.usage.totalUsd : null) }) + " → ", runButton(sup[r.runId])))) : none());
    const tr = M.transportOf(c.records, sup).filter(x => x.error);
    row(t("intTransport"), tr.length ? [el("span", { text: t("intTransportLine", { n: tr.length }) + " " }),
      el("button", { type: "button", class: "btn-quiet", onclick: () => { st.callsOpen = c.batchId; setView("checks"); const n = $("calls-" + c.batchId); if (n) n.scrollIntoView({ block: "start" }); } }, t("openChecks") + " →")] : none());
    const id = M.identityOf(c.batch, c.records, sup);
    const fps = m && m.fingerprints ? m.fingerprints.map(f => ({ value: f.system_fingerprint, conversations: f.conversations, adopted: f.adopted, superseded: f.superseded }))
      : ((id.roles.find(g => g.role === "student") || {}).fingerprints || []);
    const si = (m && m.servingIdentity) || id.servingIdentity;
    row(t("intIdentity"), el("div", { class: "small" }, t("servingIdentity", { r: t("role_student") }) + " ", el("strong", { text: si ? code(si) : t("notRecorded") })),
      fps.map(f => el("div", { class: "small mono", text: t("fpLine", { v: fpText(f.value), c: f.conversations, a: f.adopted, s: f.superseded }) })),
      (m ? m.multipleFingerprints : id.multipleFingerprints) ? el("div", { class: "small stopped", text: t("multipleFingerprints") }) : null);
    const cache = M.cacheOf(c.batch, c.records), learner = cache.models.filter(x => x.role === "student");
    row(t("intCache"), !cache.recorded ? el("span", { class: "muted", text: t("cacheNotRecorded") }) : learner.map(x => el("div", { class: "small", text: t("intCacheLine", { m: x.model, o: x.observed, c: x.calls }) })));
    const h = M.batchHistory(c.batch || {});
    row(t("intBatch"), el("span", { text: [t("nowStatus", { s: code(h.status) }), h.earlierStop ? t("earlierStop", { s: code(h.earlierStop), n: c.records.filter(r => r.restartOf).length }) : null,
      ...h.topUps.map(x => t("topUp", { from: usd(x.from), to: usd(x.to) }))].filter(Boolean).join(" · ") }));
    const b = c.batch || {};
    if (b.gate || b.phase) row(t("intGate"), el("span", { text: [b.phase, b.gate ? tOr("gate_" + b.gate, b.gate) : null, b.probeSetVersion ? t("probeSet") + " " + b.probeSetVersion : null].filter(Boolean).join(" · ") }));
    if (b.calibrationSeries) row(t("intSeries"), el("span", { class: "mono small", text: b.calibrationSeries + (b.seriesSpentUsd != null ? " · " + usd(b.seriesSpentUsd) : "") }));
    if (b.priorBatchIds && b.priorBatchIds.length) row(t("intPrior"), el("span", { class: "mono small", text: b.priorBatchIds.join(", ") }));
    if (b.responseFormat) row(t("intResponse"), el("span", { class: "mono small", text: JSON.stringify(b.responseFormat) }));
    if (m && m.pins) row(t("intPins"), Object.entries(m.pins).map(([k, v]) => el("div", { class: "small mono", "data-tip": typeof v === "string" ? v : null,
      text: k + ": " + (v && typeof v === "object" ? [v.id, v.version, v.contentHash ? shortHash(v.contentHash) : null].filter(Boolean).join(" ") : shortHash(String(v))) })));
    const f = st.files;
    row(t("intFiles"), el("span", { class: "small", text: f ? t("filesLine", { r: f.records.size, b: f.batches.size, p: f.reports.size, e: f.expectations.length, i: f.ignored.length }) + " · " + t("filesLine2", { v: f.reviews.size, g: f.gates.length, s: f.probeSets.length }) : t("filesSample") }),
      f && f.ignored.length ? el("details", { class: "ignored" }, el("summary", { class: "small faint", text: t("filesIgnored", { n: f.ignored.length }) }),
        el("ul", null, f.ignored.slice(0, 200).map(x => el("li", { class: "small mono", text: x.path })))) : null);
    box.append(dl, el("div", { class: "bcalls-foot" }, el("button", { type: "button", onclick: () => exportPack(c.batchId) }, t("exportPack") + " ↓"),
      el("span", { class: "small faint", text: t("exportNote") + (f ? "" : " " + t("exportSynthetic")) })));
  }

  // ---------- Probes ----------
  // One probe batch at a time: each probe in both languages, the fixed history prefix it starts from, and every repeat's
  // target message as its parts (what the model returned, what it wrote, what the runner injected, what was kept).
  // Machine counts come from the report and counts after review from the gate file; the page never re-judges.
  const shaHex = text => { const P = globalThis.PremiumReviewPack; return P ? P.sha256(P.bytesOf(text)) : null; };
  function renderProbes() {
    const d = st.dataset, list = M.probeBatches(d);
    if (!list.some(b => b.batchId === st.probe)) { st.probe = list.length ? list[0].batchId : null; st.probeSel = null; }
    if (!st.probe) return;
    const pv = M.probeView(d, st.probe, shaHex), c = pv.calibration;
    if (!pv.probes.some(p => p.probeId === st.probeSel)) st.probeSel = pv.probes.length ? pv.probes[0].probeId : null;
    const box = $("probe");
    box.append(el("header", { class: "sec-head" }, el("div", { class: "title" }, el("h2", { id: "probe-title", text: t("probesTitle") }), el("p", { class: "lede", text: t("probesLede") })),
      list.length > 1 ? el("div", { class: "filters" }, select("probe-batch", t("probeBatch"), st.probe, list.map(b => [b.batchId, batchOption(b)]),
        v => { st.probe = v; st.probeSel = null; render(); })) : el("span", { class: "mono muted", text: st.probe })));
    box.append(classStrip(c.cls), calibLayers(c));
    renderProbeMatrix(box, pv);
    renderProbeDetail(pv);
  }
  // A check that is true, false or unknown, as a short mark with its full words in a tip.
  const pcheck = (ok, short, yes, no, unknown) => el("span", { class: "pcheck " + (ok === true ? "ok" : ok === false ? "bad" : "na"), "data-tip": ok === true ? yes : ok === false ? no : unknown },
    (ok === true ? "✓ " : ok === false ? "✕ " : "– ") + short);
  const prefixChecks = x => el("span", { class: "pchecks" },
    pcheck(x.runs.length ? x.sameAcrossRuns : null, t("pc_same"), t("prefixSame", { n: x.runs.length }), t("prefixDiffers"), t("hashNone")),
    pcheck(x.hashMatches, t("pc_hash"), t("hashOk"), t("hashBad"), t("hashNone")),
    pcheck(x.matchesFile, t("pc_file"), t("fileOk"), t("fileBad"), t("fileNone")));
  // Plate I: probes down, languages across. The large figure is the machine count; the gate's count after review sits below.
  function renderProbeMatrix(box, pv) {
    const c = pv.calibration;
    box.append(plateHead("I", "probe-matrix-title", t("plateProbes"), el("p", { class: "plate-note", text: t("probesNote") })));
    const head = el("tr", null, el("th", { text: t("colProbe") }), pv.langs.map(l => el("th", { text: langName(l) })));
    const rows = pv.probes.map(p => {
      const on = p.probeId === st.probeSel;
      return el("tr", { class: "prow" + (on ? " on" : "") },
        el("th", { scope: "row" }, el("div", { class: "pwho" }, el("button", { type: "button", class: "pname", "aria-pressed": on ? "true" : "false", onclick: () => { st.probeSel = p.probeId; clear($("probe-detail")); renderProbeDetail(pv); markSel(); $("probe-detail").scrollIntoView({ block: "start" }); } },
          el("strong", { class: "mono", text: p.probeId }), p.gate ? el("span", { class: "tag", text: tOr("gate_" + p.gate, p.gate) }) : null),
          p.purpose ? el("span", { class: "small muted ppurpose", text: p.purpose }) : null,
          p.target ? el("span", { class: "small faint", text: t("probeTarget") + " · " + t("targetN", { n: p.target }) }) : null)),
        pv.langs.map(l => {
          const x = p.langs[l], g = x.group, after = afterReview(c, p.probeId, l);
          return el("td", { class: "pcell" }, el("span", { class: "pc-lang small faint", text: langName(l) }),
            el("div", { class: "cnum" + (g ? (g.pass ? " pass" : " fail") : " none") },
              g ? [el("span", { class: "n", text: String(g.passing) }), el("span", { class: "of", text: t("groupOf", { n: g.runs }) })] : el("span", { class: "of", text: t("groupNoReport", { n: x.runs.length }) }),
              g && !g.optional ? el("span", { class: "gmark" }, pip(g.pass ? "good" : "fail"), t(g.pass ? "groupPass" : "groupFail")) : null,
              after ? el("span", { class: "gmark after" + (after.pass ? "" : " fail"), "data-tip": t("afterReviewTip") }, t("afterReview", { p: after.passing, n: after.runs })) : null),
            el("div", { class: "pfield" }, x.runs.map(r => studentSpecimen(r.record, r.check, Math.max(4, p.target || 4)))),
            prefixChecks(x));
        }));
    });
    const others = pv.others.map(p => el("tr", { class: "prow off" }, el("th", { scope: "row" }, el("div", { class: "pwho" }, el("span", { class: "pname off" }, el("strong", { class: "mono", text: p.probeId }),
      p.gate ? el("span", { class: "tag", text: tOr("gate_" + p.gate, p.gate) }) : null), p.purpose ? el("span", { class: "small faint ppurpose", text: p.purpose }) : null)),
    el("td", { class: "small faint", colspan: String(pv.langs.length), text: t("notInBatch") })));
    const table = el("table", { class: "ptable", "aria-labelledby": "probe-matrix-title" }, el("thead", null, head), el("tbody", null, rows, others));
    table.addEventListener("click", e => { const n = e.target.closest("[data-run]"); if (n) openRun(n.getAttribute("data-run")); });
    box.append(el("div", { class: "scroll-x" }, table));
    function markSel() { table.querySelectorAll(".prow").forEach((tr, i) => { const p = pv.probes[i], on = !!p && p.probeId === st.probeSel; tr.classList.toggle("on", on); const b = tr.querySelector(".pname"); if (b && p) b.setAttribute("aria-pressed", on ? "true" : "false"); }); }
  }
  // Plate II: one probe in detail. The prefix lines up across languages; then each repeat's target message, zh beside en.
  function renderProbeDetail(pv) {
    const box = $("probe-detail"), p = pv.probes.find(x => x.probeId === st.probeSel);
    if (!p) return;
    box.append(plateHead("II", "probe-detail-title", t("plateProbe", { p: p.probeId }),
      el("dl", { class: "kv pmeta" }, [[t("probeMeta"), p.purpose], [t("probeTarget"), p.target ? t("targetN", { n: p.target }) : null], [t("probeTape"), p.tutorSource],
        [t("probeProtocol"), p.protocolVersion], [t("probeSet"), pv.set ? pv.set.probeSetVersion : (pv.calibration.batch || {}).probeSetVersion]].filter(x => x[1])
        .flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]))));
    // What the expectations ask of the target message, in each language.
    const human = p.expectation && p.expectation.human;
    if (human) box.append(el("div", { class: "pexpect", style: "--langs:" + pv.langs.length }, pv.langs.map(l => el("div", null,
      el("span", { class: "small faint", text: t("probeExpect") + " · " + langName(l) }), el("p", { text: human[l] || "—" })))));
    // The fixed prefix, line by line, the languages side by side.
    const lens = pv.langs.map(l => p.langs[l].prefix.length), n = Math.max(0, ...lens);
    const pre = el("details", { class: "prefix" }, el("summary", null, el("span", { text: t("prefixTitle", { n }) }), pv.langs.map(l => el("span", { class: "small faint" }, langName(l) + " ", prefixChecks(p.langs[l])))));
    const grid = el("div", { class: "pgrid", style: "--langs:" + pv.langs.length });
    grid.append(...pv.langs.map(l => el("div", { class: "pgh small faint" }, langName(l), " · ", el("span", { class: "mono", "data-tip": p.langs[l].prefixHash || null, text: p.langs[l].prefixHash ? shortHash(p.langs[l].prefixHash) : t("hashNone") }))));
    for (let i = 0; i < n; i++) for (const l of pv.langs) {
      const line = p.langs[l].prefix[i];
      grid.append(line ? el("div", { class: "pline " + line.role },
        el("div", { class: "who small" }, el("span", { class: "pl-lang faint", text: langName(l) }), el("strong", { text: line.role === "student" ? t("student") : t("tutor") }),
          line.role === "student" ? (line.fixed ? el("span", { class: "tag", text: t("fixedOpening") }) : null) : el("span", { text: t("turnN", { n: line.turn }) }),
          line.state ? el("span", { text: t("stage", { s: line.state.stage }) }) : null, line.state ? (line.state.events || []).map(e => el("span", { class: "tag", text: e })) : null,
          line.source ? el("span", { class: "mono faint", text: line.source }) : null),
        el("div", { class: "text", text: line.text })) : el("div", { class: "pline empty" }));
    }
    pre.append(grid);
    box.append(pre);
    // The repeats: run i in one language beside run i in the other.
    const reps = Math.max(0, ...pv.langs.map(l => p.langs[l].runs.length));
    const rgrid = el("div", { class: "rgrid", style: "--langs:" + pv.langs.length });
    rgrid.append(...pv.langs.map(l => el("div", { class: "rgh" }, el("strong", { text: langName(l) }))));
    for (let i = 0; i < reps; i++) for (const l of pv.langs) {
      const x = p.langs[l].runs[i];
      rgrid.append(x ? targetCard(x, l) : el("div", { class: "tcard empty" }));
    }
    box.append(rgrid);
  }
  // One run's target message as four parts. Dropped events are struck through; the runner's additions are marked.
  function targetCard(x, lang) {
    const r = x.record, pt = x.parts, ck = x.check;
    const head = el("div", { class: "tc-head" },
      el("span", { class: "tc-lang small faint", text: langName(lang) }),
      el("strong", { text: t("repeatN", { n: r.repeat.index }) }),
      ck ? el("span", { class: "state" }, pip(ck.pass ? "good" : "fail"), t(ck.pass ? "v_PASS" : "v_FAIL")) : el("span", { class: "small faint", text: t("sHeadNone") }),
      pt && pt.format ? el("span", { class: "tag" + (pt.format === "json" ? "" : " soft"), text: t("formatTag", { f: pt.format }) }) : null,
      x.rejected.length ? el("span", { class: "tag soft", "data-tip": x.rejected.map(rj => (rj.reasons || []).map(code).join(", ")).join(" · "), text: t("sentBackN", { n: x.rejected.length }) }) : null,
      x.discarded ? el("span", { class: "tag", text: t("discarded", { n: x.discarded }) }) : null,
      pt && pt.fenceStripped ? el("span", { class: "tag", text: t("fenceTag") }) : null,
      el("button", { type: "button", class: "btn-quiet run-link", onclick: () => openRun(r.runId, false, x.n ? { n: x.n } : null) }, t("openRecord") + " →"));
    const card = el("article", { class: "tcard" }, head);
    if (ck && (ck.hard.length || ck.soft.length)) card.append(el("div", { class: "cklines" }, [...ck.hard.map(h => ckLine({ kind: "hard", ...M.parseCheckerLine(h) })), ...ck.soft.map(h => ckLine({ kind: "soft", ...M.parseCheckerLine(h) }))]));
    if (!pt) { card.append(el("p", { class: "small faint", text: t("noData") })); return card; }
    card.append(partsView(pt));
    if (x.review.length) card.append(reviewBadges(x.review));
    return card;
  }
  // The four parts of a model-written student message. A record before v6 has only the final text.
  function partsView(pt) {
    const part = (k, ...body) => el("div", { class: "part part-" + k }, el("span", { class: "part-name", text: t("part_" + k) }), ...body);
    const evTags = (list, cls) => (list || []).map(e => el("span", { class: "tag" + (cls ? " " + cls : ""), text: e }));
    const dropped = new Set(pt.droppedEvents || []);
    if (!pt.v6) return el("div", { class: "parts" }, part("final", el("div", { class: "text", text: pt.final ?? "" }), el("p", { class: "small faint", text: t("noV6") })));
    return el("div", { class: "parts" },
      part("raw", el("pre", { class: "raw mono", text: pt.raw ?? "" })),
      part("model", el("div", { class: "text", text: pt.modelMessage ?? "" }),
        el("div", { class: "tags" }, (pt.modelEvents || []).map(e => el("span", { class: "tag" + (dropped.has(e) ? " struck" : ""), "data-tip": dropped.has(e) ? t("droppedTag", { e }) : null, text: e })),
          [...dropped].filter(e => !(pt.modelEvents || []).includes(e)).map(e => el("span", { class: "tag struck", "data-tip": t("droppedTag", { e }), text: e })))),
      part("injected", pt.injected ? [el("div", { class: "text inj", text: pt.injected.text ?? "" }), el("div", { class: "tags" }, el("span", { class: "tag", text: code(pt.injected.kind) }), evTags(pt.runnerEvents, "accent"))]
        : (pt.runnerEvents || []).length ? el("div", { class: "tags" }, evTags(pt.runnerEvents, "accent")) : el("span", { class: "small faint", text: t("noInjection") })),
      part("final", el("div", { class: "text", text: pt.final ?? "" }),
        pt.state ? el("div", { class: "tags" }, el("span", { class: "small faint", text: t("stage", { s: pt.state.stage }) }), evTags(pt.state.events), pt.state.end ? el("span", { class: "tag", text: t("endMark") }) : null) : null));
  }
  // Review items of one run: machine label, then the decision and the result by the rules.
  const reviewBadges = items => el("div", { class: "rbadges" }, items.map(i => el("span", { class: "rbadge " + i.effective,
    "data-tip": [i.question, i.quote ? "“" + i.quote + "”" : null, i.note].filter(Boolean).join(" · ") || null },
  el("span", { class: "mono", text: i.itemId }), " ", tOr("m_" + i.machine, i.machine), " → ", i.decision ? t("dec_" + i.decision) : t("eff_" + i.effective),
  i.overridesMachine ? " ↺" : i.undecidedFail ? " ✕" : "")));

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
  // focus, when given, is { attempt, n }: open that attempt and scroll to student message n.
  function openRun(runId, keepFocus, focus) {
    const d = st.dataset, r = d.runs.find(x => x.runId === runId);
    if (!r) return;
    if (!keepFocus) lastFocus = document.activeElement;
    if (openRunId !== runId) st.drawerAttempt = null;
    if (focus && focus.attempt != null) st.drawerAttempt = focus.attempt;
    openRunId = runId;
    const v = M.runView(r, st.f.version, d.latestCard, d.supersededBy), s = v.scoring, m = s && s.merged;
    const box = clear($("drawer"));
    box.append(el("div", { class: "drawer-head" },
      el("div", { class: "ids" }, el("span", { class: "kicker", text: r.batchId + (M.isCalibrationKind(r.batchKind) ? " · " + t("cls_" + clsOf(d.batches.find(b => b.batchId === r.batchId) || { batchId: r.batchId, kind: r.batchKind })) : "") }),
        el("h2", { id: "drawer-title", text: whoOf(r) + " · " + r.card.id }),
        el("span", { class: "small muted" }, r.card.lang + " · " + t("repeatOf", { i: r.repeat.index, n: r.repeat.of }) + " · " + when(r.createdAt)),
        el("span", { class: "mono muted" }, r.card.id + "@" + r.card.version + (v.olderCard ? " (" + t("olderCard") + ")" : "") + " · " + String(r.card.contentHash).slice(0, 19) + "…"),
        el("span", { class: "mono muted" }, r.probe ? t("probeTape") + " " + r.tutor.id + (r.tutor.provider ? " · " + r.tutor.provider : "")
          : [M.versionKey(r), r.tutor.tutorPromptHash ? promptName(r.tutor.tutorPromptHash) : t("noPrompt")].join(" · ")),
        el("span", { class: "mono muted" }, t("runId") + " " + r.runId)),
      el("button", { type: "button", onclick: closeDrawer, id: "drawer-close" }, t("close"))));

    // Verdict and why
    const vb = el("div", { class: "verdict-box" }, mark(v));
    const jump = (label, id) => el("button", { type: "button", class: "btn-quiet", onclick: () => openRun(id, true) }, label + " →");
    if (v.calibration) vb.append(el("p", { class: "small muted", text: t("calibNote") }));
    const cal = M.isCalibrationKind(r.batchKind), rr = cal ? M.reportRun(d, r.runId) : null, rep = d.reports.get(r.batchId);
    if (rr) vb.append(el("div", { class: "machine-line" }, el("span", { class: "small muted", text: t("machineCheck") }),
      el("span", { class: "state" }, pip(rr.run.pass ? "good" : "fail"), t(rr.run.pass ? "v_PASS" : "v_FAIL")),
      el("span", { class: "small muted", text: t("machineRun", { h: rr.run.hard.length, s: rr.run.soft.length, x: rr.run.extraRewrites ?? "—" }) + " · checker v" + (rr.norm.checkerRevision || rr.report.checkerVersion) })));
    else if (cal) vb.append(el("p", { class: "small muted", text: !rep ? t("machineNoReport") : rep.verdict === "CANNOT_CHECK" ? t("cannotCheckNote") : t("machineNotInReport") }));
    if (v.supersededBy) vb.append(el("p", { class: "small muted" }, t("supersededNote") + " ", jump(t("openSuccessor"), v.supersededBy)));
    if (v.restartOf) vb.append(el("p", { class: "small muted" }, t("restartNote") + " ", jump(t("openPredecessor"), v.restartOf)));
    if (v.state === "scored" && v.reasons.length) vb.append(el("div", { class: "tags" }, v.reasons.map(x => el("span", { class: "tag" + (["leak", "student_left", "unsolved_tutor_fault"].includes(x) ? " crit" : ""), text: code(x) }))));
    if (v.pending.length) vb.append(el("div", null, el("strong", { text: t("pendingReasons") })), el("ul", null, v.pending.map(p => el("li", { text: code(p) }))));
    if (v.withheldVerdict) vb.append(el("div", { class: "tag crit", text: t("withheld", { v: t(v.withheldVerdict) }) }));
    for (const j of v.judgeErrors) vb.append(el("div", { class: "small", text: t("judgeError", { j: j.judgeId, e: code(j.error) }) }));
    if (v.reviewFlags.length) vb.append(el("div", { class: "tags" }, v.reviewFlags.map(f => el("span", { class: "tag", text: t("spotCheck") + ": " + code(f) }))));
    if (v.fixedTestSkipped) vb.append(el("div", { class: "tags" }, el("span", { class: "tag", text: t("fixedTestSkipped") })));
    if (["error", "student_invalid", "superseded"].includes(v.state) || (v.calibration && r.status !== "unscored")) {
      for (const a of r.attempts || []) vb.append(el("div", { class: "small", text: t("attemptN", { n: a.attempt, s: code(a.status) }) + (a.reason ? " · " + a.reason.split(",").map(code).join(", ") : "") + (a.atStudentMessage ? " · " + t("msgN", { n: a.atStudentMessage }) : "") }));
    }
    // The conversation's own specimen, large: each leaf is a tutor turn and jumps to it in the transcript.
    let big = null;
    if (cal) {
      const sd = studentData(r, rr ? rr.run : null), maxN = Math.max(8, sd.n);
      const y0 = Math.max(0, SPH - sd.n * (SP_ROOM / maxN) - 2 * HEAD - 5.5);
      big = drawStudent(svg("svg", { class: "sp big student " + sd.kind, viewBox: `0 ${y0} ${SPW} ${SPH - y0}`, style: `height:${((SPH - y0) / SPW) * 64}px`, role: "img", "aria-label": studentTip(r, rr ? rr.run : null, sd) }), sd, maxN, true);
      big.addEventListener("click", e => {
        const g = e.target.closest("[data-msg]"), msg = g && $("smsg-" + g.getAttribute("data-msg"));
        if (!msg) return;
        msg.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        msg.classList.remove("flash"); void msg.offsetWidth; msg.classList.add("flash");
      });
    } else if (r.end && r.end.tutorTurns > 0) {
      // Same scale as Plate I, cropped to the plant so a short conversation does not float in empty space.
      const d = specimenData(v), maxTurns = maxTurnsOf([v]);
      const y0 = Math.max(0, SPH - d.n * (SP_ROOM / maxTurns) - 2 * HEAD - 5.5);
      big = drawSpecimen(svg("svg", { class: "sp big " + kindOf(v), viewBox: `0 ${y0} ${SPW} ${SPH - y0}`, style: `height:${((SPH - y0) / SPW) * 64}px`, role: "img", "aria-label": specimenTip(v) }), d, maxTurns, true);
      big.addEventListener("click", e => {
        const g = e.target.closest("[data-turn]");
        const msg = g && $("turn-" + g.getAttribute("data-turn"));
        if (!msg) return;
        msg.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        msg.classList.remove("flash"); void msg.offsetWidth; msg.classList.add("flash");
      });
    }
    box.append(el("div", { class: "section" }, el("h3", { text: t("verdictBox") }), el("div", { class: "verdict-row" }, big, vb)));
    if (r.probe) box.append(probeSection(r));
    if (rr && rr.norm.v3) { const sec = runV3Section(r, rr); if (sec) box.append(sec); }

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

    // Conversation: every attempt the runner kept, each student message with its self-reported state and events, the
    // replies sent back before it (before and after, with the rules they broke) and the checker's lines for it.
    const atts = M.attemptsOf(r);
    const ckLines = rr ? [...(rr.run.hard || []).map(x => ({ kind: "hard", ...M.parseCheckerLine(x) })), ...(rr.run.soft || []).map(x => ({ kind: "soft", ...M.parseCheckerLine(x) }))] : [];
    let ai = atts.findIndex(a => a.attempt === st.drawerAttempt);
    if (ai < 0) ai = atts.length - 1;
    const tsec = el("div", { class: "section" }, el("h3", { text: t("transcript") }));
    const tbody = el("div", { class: "tbody" });
    const drawAttempt = () => { clear(tbody); tbody.append(transcriptView(atts[ai], ai === atts.length - 1, m, ckLines, r.probe ? r.probe.targetStudentMessage : null)); };
    if (atts.length > 1) tsec.append(el("div", { class: "tabs attempts", role: "group", "aria-label": t("attempts") }, atts.map((a, i) => el("button", { type: "button", class: "tab", "aria-pressed": i === ai ? "true" : "false",
      onclick: () => { ai = i; st.drawerAttempt = a.attempt; tsec.querySelectorAll(".attempts .tab").forEach((b, k) => b.setAttribute("aria-pressed", k === i ? "true" : "false")); drawAttempt(); } },
      t("attemptTab", { n: a.attempt }) + " · " + tOr("attempt_" + a.status, code(a.status))))));
    const whole = ckLines.filter(x => x.n == null);
    if (whole.length) tsec.append(el("div", { class: "cklines whole" }, el("span", { class: "small muted", text: t("checkerLines") }), whole.map(ckLine)));
    tsec.append(tbody);
    drawAttempt();
    box.append(tsec);

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
        el("div", { class: "scroll-x" }, el("table", null, el("thead", null, el("tr", null, [t("judge"), t("model"), t("verdict"), t("fixedTest"), t("transfer"), t("solved")].map(h => el("th", { text: h })))), el("tbody", null, judgeRows))),
        v.judgeRepairs.map(j => el("p", { class: "small muted", text: t(j.recovered ? "judgeRepaired" : "judgeRepairFailed", { j: j.judgeId, r: [...new Set(j.reasons)].map(code).join(", ") }) }))));
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
      el("dt", { text: t("rejected") }), el("dd", { text: c.rejected.length ? t("rejectedByRule", { n: c.rejected.length, list: ruleCounts(c.rejected) }) : t("none") }),
      el("dt", { text: t("attempts") }), el("dd", { text: (r.attempts || []).map(a => t("attemptN", { n: a.attempt, s: code(a.status) })).join(" · ") }),
      el("dt", { text: t("notFired") }), el("dd", { text: c.behavioursNotFired.length ? c.behavioursNotFired.join(", ") : t("none") }),
      el("dt", { text: t("missingMistakes") }), el("dd", { text: c.scriptedMistakesMissing.length ? c.scriptedMistakesMissing.join(", ") : t("none") }));
    box.append(el("div", { class: "section" }, el("h3", { text: t("studentChecks") }), kv));

    const cost = M.costs(r);
    box.append(el("div", { class: "section" }, el("h3", { text: t("costs") }), el("dl", { class: "kv" },
      el("dt", { text: t("runCost") }), el("dd", { class: "num", text: usd(cost.run) }),
      cost.rescoring.map(x => [el("dt", { text: t("rejudgeCost", { id: x.scoringId }) }), el("dd", { class: "num", text: usd(x.usd) })])),
      cost.estimatedCalls ? el("p", { class: "small muted", text: t("estimatedCalls", { n: cost.estimatedCalls }) }) : null));

    if ((r.calls || []).length) box.append(el("div", { class: "section" }, el("details", { class: "calls" }, el("summary", { text: t("callsDetail", { n: r.calls.length }) }), callsTable(r.calls))));

    const reopened = keepFocus && !box.hidden;
    $("scrim").hidden = false; box.hidden = false;
    if (!reopened) { box.scrollTop = 0; $("drawer-close").focus(); }
    const target = focus && focus.n ? $("smsg-" + focus.n) : null;
    if (target) { target.scrollIntoView({ block: "center" }); target.classList.remove("flash"); void target.offsetWidth; target.classList.add("flash"); }
  }
  // A probe run: which probe, where its fixed prefix came from, and whether the prefix is the one the probe file holds.
  function probeSection(r) {
    const pb = r.probe, prefix = M.prefixOf(r), hash = pb.prefixHash || null, h = shaHex(JSON.stringify(prefix));
    const set = (st.dataset.probeSets || []).find(x => x.probeSetVersion === pb.probeSetVersion) || null;
    const def = set ? set.probes.find(x => x.probeId === pb.probeId) || null : null;
    const fileText = def && def.prefix && def.prefix[r.card.lang] ? JSON.stringify(def.prefix[r.card.lang]) : null;
    return el("div", { class: "section" }, el("h3", { text: t("probeInfo") }), el("dl", { class: "kv" },
      el("dt", { text: t("colProbe") }), el("dd", null, el("span", { class: "mono", text: pb.probeId }), def && def.gate ? [" ", el("span", { class: "tag", text: tOr("gate_" + def.gate, def.gate) })] : null),
      def && def.purpose ? [el("dt", { text: t("probeMeta") }), el("dd", { text: def.purpose })] : null,
      el("dt", { text: t("probeTarget") }), el("dd", { text: t("targetN", { n: pb.targetStudentMessage }) }),
      el("dt", { text: t("probeSet") }), el("dd", { class: "mono", text: pb.probeSetVersion }),
      el("dt", { text: t("probeTape") }), el("dd", { class: "mono", text: pb.tutorSource }),
      el("dt", { text: t("probeProtocol") }), el("dd", { class: "mono", text: pb.protocolVersion }),
      el("dt", { text: t("prefixHash") }), el("dd", null, el("span", { class: "mono", "data-tip": hash, text: hash ? shortHash(hash) : t("hashNone") }), " ",
        pcheck(hash && h ? "sha256:" + h === hash : null, t("pc_hash"), t("hashOk"), t("hashBad"), t("hashNone")), " ",
        pcheck(fileText == null ? null : fileText === JSON.stringify(prefix), t("pc_file"), t("fileOk"), t("fileBad"), t("fileNone")))));
  }
  // What checker v3 adds for one run: its review items, the milestones it found and how the self-reports compare.
  function runV3Section(r, rr) {
    const x = rr.run, items = M.reviewOf(st.dataset, r.batchId).items.filter(i => i.runId === r.runId);
    const kv = el("dl", { class: "kv" });
    if ((x.milestones || []).length) kv.append(el("dt", { text: t("milestones") }), el("dd", null, el("div", { class: "tags" }, x.milestones.map(ms => el("span", { class: "tag" + (ms.status === "met" ? "" : " soft"),
      text: ms.id + " · " + tOr("ms_" + ms.status, ms.status) + (ms.message != null ? " · " + t("msgN", { n: ms.message }) : "") })))));
    if (x.selfReportStage) kv.append(el("dt", { text: t("selfReport") }), el("dd", { text: t("selfReportLine", { a: x.selfReportStage.agree, n: x.selfReportStage.total }) }));
    if (x.eventSelfReport && Object.keys(x.eventSelfReport).length) kv.append(el("dt", { text: t("eventReport") }), el("dd", { class: "mono small", text: Object.entries(x.eventSelfReport).map(([k, v]) => k + " " + v).join(" · ") }));
    if (!kv.childNodes.length && !items.length) return null;
    return el("div", { class: "section" }, el("h3", { text: t("reviewInRun") }), items.length ? el("ul", { class: "ritems" }, items.map(i => el("li", { class: "ritem" },
      el("div", { class: "ritem-head" }, el("span", { class: "mono small", text: i.itemId }), el("span", { class: "small muted", text: tOr("m_" + i.machine, i.machine) + " → " + (i.decision ? t("dec_" + i.decision) : t("dec_undecided")) }),
        el("span", { class: "tag" + (i.effective === "fail" ? " crit" : i.effective === "pending" ? " soft" : ""), text: t("eff_" + i.effective) }),
        i.overridesMachine ? el("span", { class: "tag accent", text: t("overridesTag") }) : null, i.undecidedFail ? el("span", { class: "tag crit", text: t("undecidedFailTag") }) : null,
        i.messages.length ? el("span", { class: "small faint", text: i.messages.map(n => t("itemAt", { n })).join(" · ") }) : null),
      i.question ? el("div", { class: "small muted", text: t("itemQuestion") + colon() + i.question }) : null,
      i.quote ? el("div", { class: "small" }, el("span", { class: "faint", text: t("itemQuote") + " " }), el("q", { text: i.quote })) : null,
      i.note ? el("div", { class: "small muted", text: t("itemNote") + colon() + i.note }) : null))) : null, kv.childNodes.length ? kv : null);
  }
  const ruleCounts = rejected => {
    const n = new Map();
    for (const x of rejected) for (const k of x.reasons || []) n.set(k, (n.get(k) || 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).map(([k, v]) => code(k) + " " + v).join(st.lang === "zh" ? "、" : ", ");
  };
  const ckLine = x => el("div", { class: "ckline " + x.kind }, el("span", { class: "tag" + (x.kind === "hard" ? " crit" : ""), text: t("checkerAt") + " · " + t(x.kind) }), el("span", { class: "mono", text: x.text }));
  function transcriptView(att, isLast, m, ckLines, target) {
    const wrap = el("div", { class: "attempt" });
    if (!att.legacy && att.status === "error") wrap.append(el("p", { class: "small stopped", text: t("attemptErrored", { r: code(att.reason) }) }));
    else if (!att.legacy && att.status !== "kept") wrap.append(el("p", { class: "small stopped", text: t("attemptStopped", { n: att.atStudentMessage ?? "?", r: String(att.reason || "").split(",").filter(Boolean).map(code).join(st.lang === "zh" ? "、" : ", ") }) }));
    const msgs = el("div", { class: "msgs" });
    const leakTurns = new Set(m && isLast ? m.leakTurns || [] : []);
    const shown = new Set();
    // A probe's fixed prefix folds into one block: it is the same in every repeat and nobody in this run wrote it.
    const pre = att.lines.filter(l => l.prefix);
    let preBox = null;
    if (pre.length) { preBox = el("div", { class: "msgs" }); msgs.append(el("details", { class: "prefix-lines" }, el("summary", { text: t("prefixTitle", { n: pre.length }) }), preBox)); }
    for (const line of att.lines) {
      const into = line.prefix ? preBox : msgs;
      if (line.role === "student") {
        shown.add(line.n);
        into.append(studentLine(line, att.byMessage.get(line.n) || [], isLast ? ckLines.filter(x => x.n === line.n) : [], att, target));
      } else if (line.prefix) {
        into.append(el("div", { class: "msg prefix" }, el("div", { class: "who" }, el("strong", { text: t("tutor") + " " + t("turnN", { n: line.turn }) }), el("span", { class: "tag", text: t("prefixTag") }),
          line.source ? el("span", { class: "mono faint", text: line.source }) : null), el("div", { class: "text", text: line.text })));
      } else {
        const mt = isLast && m && m.turns ? m.turns[line.turn - 1] : null;
        msgs.append(el("div", { class: "msg" + (leakTurns.has(line.turn) ? " leak" : ""), id: isLast ? "turn-" + line.turn : null },
          el("div", { class: "who" }, el("strong", { text: t("tutor") + " " + t("turnN", { n: line.turn }) }), mt ? el("span", { text: t("level", { h: mt.helpLevel }) }) : null,
            mt ? el("span", { class: "checks" }, ["correct", "readsState", "helpFit", "noLeak", "responds"].map(k => el("span", { class: "ck" + (mt[k] === false ? " no" : ""), text: (mt[k] === false ? "✕ " : mt[k] === null ? "? " : "✓ ") + code(k) }))) : null),
          el("div", { class: "text", text: line.text })));
      }
    }
    // Replies sent back for a message that was never accepted: the attempt stopped there.
    for (const [n, list] of att.byMessage) if (!shown.has(n)) msgs.append(studentLine({ role: "student", n, text: null }, list, [], att));
    wrap.append(msgs);
    return wrap;
  }
  function studentLine(line, drafts, cks, att, target) {
    const s = line.state || {}, ck = line.checks || {};
    const out = el("div", { class: "msg student" + (line.prefix ? " prefix" : "") + (target != null && line.n === target ? " target" : ""), id: "smsg-" + line.n },
      el("div", { class: "who" }, el("strong", { text: t("student") + " " + t("msgN", { n: line.n }) }),
        line.fixed ? el("span", { class: "tag", text: t("fixedOpening") }) : null, line.prefix ? el("span", { class: "tag", text: t("prefixTag") }) : null,
        target != null && line.n === target ? el("span", { class: "tag accent", text: t("probeTarget") }) : null,
        line.injected ? el("span", { class: "tag accent", text: t("injectedTag") }) : null,
        line.state ? el("span", { text: t("stage", { s: s.stage }) }) : null,
        (s.events || []).map(e => el("span", { class: "tag", text: e })),
        s.end ? el("span", { class: "tag", text: t("endMark") }) : null,
        ck.fenceStripped ? el("span", { class: "tag", text: t("fenceStripped") }) : null,
        (ck.softFlags || []).map(f => el("span", { class: "tag soft", text: code(f) })),
        ck.regenerated ? el("span", { class: "tag", text: t("rewrites", { n: ck.regenerated }) }) : null,
        !drafts.length && line.callInfo ? el("span", { class: "faint mono", text: t("callN", { c: line.callInfo.n }) }) : null,
        line.callInfo && line.callInfo.retryDelayMs > 0 ? el("span", { class: "faint small", text: t("retryWaited", { v: (line.callInfo.retryDelayMs / 1000).toFixed(1) }) }) : null));
    if (drafts.length) out.append(el("details", { class: "drafts", open: true }, el("summary", { text: t("drafts", { n: drafts.length }) }),
      el("ol", null, drafts.map((x, k) => el("li", { class: "draft" },
        el("div", { class: "dh" }, el("span", { text: t("draftN", { k: k + 1 }) }), x.call ? el("span", { class: "faint mono", text: t("callN", { c: x.call }) }) : null,
          (x.reasons || []).map(rs => el("span", { class: "tag crit", "data-tip": t("family_" + M.ruleFamily([rs])), text: "✕ " + code(rs) })),
          x.fenceStripped ? el("span", { class: "tag", text: t("fenceStripped") }) : null),
        el("div", { class: "small faint", text: x.reply.json ? [t("stage", { s: x.reply.stage ?? "?" }), ...x.reply.events, x.reply.end ? t("endMark") : null].filter(Boolean).join(" · ") : t("draftRaw") }),
        el("div", { class: "text", text: x.reply.message })))),
      line.text != null ? el("div", { class: "accepted-label", text: "↓ " + t("accepted") + (line.callInfo ? " · " + t("callN", { c: line.callInfo.n }) : "") }) : null));
    if (line.text != null) out.append(el("div", { class: "text", text: line.text }));
    else if (att.status === "discarded") out.append(el("p", { class: "small stopped", text: t("neverAccepted") }));
    // Record schema v6 keeps what the model returned and what the runner changed. Shown open where they differ.
    if (line.model) {
      const pt = M.messageParts(line);
      const differs = !!pt.injected || pt.droppedEvents.length > 0 || pt.runnerEvents.length > 0 || pt.fenceStripped || (target != null && line.n === target);
      out.append(el("details", { class: "parts-box", open: differs || null }, el("summary", { text: t("partsSummary") + (pt.format ? " · " + t("formatTag", { f: pt.format }) : "") }), partsView(pt)));
    }
    if (cks.length) out.append(el("div", { class: "cklines" }, cks.map(ckLine)));
    return out;
  }
  function callsTable(calls) {
    const tok = u => (u ? fmtInt(u.inputTokens) + " / " + fmtInt(u.outputTokens) : "—");
    const cacheText = c => (!has(c, "cache") ? t("notRecorded") : c.cache && c.cache.hitTokens != null && c.cache.missTokens != null ? fmtInt(c.cache.hitTokens) + " / " + fmtInt(c.cache.missTokens) : t("unknownWhole"));
    const model = c => [c.model, c.requestedModel && c.requestedModel !== c.model ? "(" + c.requestedModel + ")" : null, has(c, "returnedModel") ? "→ " + (c.returnedModel ?? "—") : null].filter(Boolean).join(" ");
    return smallTable([t("colN"), t("role"), t("colModel"), t("fingerprint"), { text: t("colTokens"), num: true }, { text: t("colCacheHM"), num: true }, { text: t("colCost"), num: true },
      { text: t("colLatency"), num: true }, t("colErr"), t("calledAt")],
    calls.map(c => el("tr", { class: c.error ? "err" : null }, el("td", { class: "num", text: String(c.n) }), el("td", { class: "small", text: t("role_" + c.role) }),
      el("td", { class: "mono", text: model(c) }), el("td", { class: "mono", text: has(c, "system_fingerprint") ? fpText(c.system_fingerprint) : t("notRecorded") }),
      el("td", { class: "num small", text: tok(c.usage) }), el("td", { class: "num small", text: cacheText(c) }),
      el("td", { class: "num small", text: (c.costEstimated ? "≈ " : "") + usd(c.usd) }), el("td", { class: "num small", text: c.latencyMs == null ? "—" : secs(c.latencyMs) }),
      el("td", { class: "small" + (c.error ? " stopped" : "") }, c.error ? code(c.error) : null, c.retryDelayMs > 0 ? (c.error ? " · " : "") + t("retryWaited", { v: (c.retryDelayMs / 1000).toFixed(1) }) : null),
      el("td", { class: "small muted", text: c.calledAt ? whenShort(c.calledAt) : "—" }))), "calls-table");
  }
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
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
