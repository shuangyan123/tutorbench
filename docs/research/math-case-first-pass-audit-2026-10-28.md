# TutorBench 数学实验案例首轮审查（2026-10-28）

> **审查性质：** 内部、可追溯的 Finding-first 设计审查；不是数学教育专家认证、真实学生学习效度或 Judge 误判率的实测结果。
>
> **固定基线：** PR #306 合并提交 `483edc61efcf93a39e5e48b9d0f27cdd29798ec6`。
> 本文仅记录审查结论，**不变更 canonical benchmark、20 个实验案例、评分配置、Judge 或历史成绩**。

## 1. 原始材料、方法、范围

- [可执行实验案例](../../scenarios/experimental/mathematics-challenge-v0.1/suite.json)：学生可见上下文、学习轨迹、披露要求、决策及评分条件。
- [数学任务证据](../../scenarios/experimental/mathematics-challenge-v0.1/evidence.json)：16 种结构的参考答案、替代方法、合成难度假设。
- [数学知识图谱](../../scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json)：任务与知识节点的引用及候选先修关系。
- [评测契约](../../src/contracts/tutor-scenario-vnext.ts) 与 [验证器](../../src/contracts/tutor-scenario-vnext-validation.ts)。

审查步骤：（1）按 `identity.id` 与任务证据对齐；（2）独立重解关键数学题，分别检查条件、定义域、概率样本空间、边界及反例，部分使用 Python/SymPy 整数、有理数和符号计算交叉核验；（3）对照 20 个学生发言与 `knownConcepts`、`teachingPolicy.disclosure`；（4）逐一阅读 40 条 rubric，构造可能被误判的合理/不合理 Tutor 回应；（5）将风险与已观察到的缺陷区分。

**明确缺少：** 真实学生数据、独立专家标注、真实 Tutor/Judge 回放及对照分歧率、各国官方大纲逐条映射。当前不能测得案例区分度、Judge 误判率或学习增益。

统计：**16 种数学任务 / 20 个合成教学场景 / 40 条评分条件**。披露：`hint_only` 9、`partial_solution` 1、`full_solution_allowed` 10。决策：`offer_conceptual_hint` 14、`fade_support` 3、`protect_learning_integrity` 2、`escalate_support` 1。40 个 `failureFinding.severity` 均为 `minor`。

## 2. 数学参考答案复核

以下为**数学正确性首轮检查**，不是教学评分有效性通过。

| 任务结构 | 独立复核的关键结果 | 结果 |
|---|---|---|
| `quadratic-positive-roots` | Δ = 4(a−2)(a+1)，两不同正根 a>2；两不同负根 −2<a<−1 | 未发现数学错误 |
| `conditional-two-red` | 两抽：10/(36−6)=1/3；三抽：10/(84−4)=1/8 | 未发现数学错误 |
| `fraction-unit-repair` | 2/3+1/4=11/12 | 未发现数学错误 |
| `successive-percentage-base` | 200×1.2×0.8=192 | 未发现数学错误 |
| `rational-equation-excluded-root` | 化简候选 x=1，但原分母为 0，无解 | 未发现数学错误 |
| `function-composition-domains` | f∘g: x≤−1 或 x≥1；g∘f: x≥1 | 未发现数学错误 |
| `decreasing-logarithm-inequality` | 1<x<3 | 未发现数学错误 |
| `similar-geometry-area-scale` | 面积比 (3/2)²=9/4 | 未发现数学错误 |
| `circle-line-tangency-constraint` | 联立得 x[(1+m²)x+10m]=0，仅 m=0 为相切 | 未发现数学错误 |
| `permutations-with-indistinguishable-objects` | AAB、ABA、BAA、ABB、BAB、BBA，共 6 种字符串 | 未发现数学错误 |
| `base-rate-inverse-probability` | 90/(90+495)=2/13 | 未发现数学错误 |
| `simpson-paradox-unequal-mixtures` | A 合计 29/110，B 合计 81/110，两组内均 A 占优 | 未发现数学错误 |
| `recurrence-mathematical-induction` | aₙ=2ⁿ−1，基例和归纳步骤成立 | 未发现数学错误 |
| `inequality-conditions-and-counterexample` | x>0 时 ≥2；x=−1 反驳对全部 x≠0 成立 | 未发现数学错误 |
| `closed-interval-optimization-endpoints` | 最大值 2 在 x=−1,2；最小值 −2 在 x=−2,1 | 未发现数学错误 |
| `linear-system-consistency-versus-rank` | 系数矩阵秩 1，增广矩阵秩 2，无解 | 未发现数学错误 |

条件概率中特别注意：学生写的 `(5/9)*(4/8)` **确实是正确的无条件两红概率**（抽到一颗红球后还剩四颗红球），其错误在于没有对“至少一颗红球”的条件重新归一化。因为蓝球也恰好有四颗，表达式的语义很容易被草率误读；审查不能因此误判学生的乘法错误。

## 3. Finding-first 风险清单

### R-01 — P1 评分公平性风险：`mc-composition-domain`

**证据：** 用户明确说 *I only want a pointer*，`disclosure=hint_only`；正确性 rubric 却要求“identify that x²≥1 includes values x≤−1 as well as x≥1”。

**潜在误判：** “先试试把 x=−2 代入 f(g(x))，根号内会发生什么？再和 g(f(x)) 的要求比较。”这是合理、不泄漏两个完整定义域的针对性提示，但 rubric 可能因为没有直接点出整个 x≤−1 区间而拒绝。

**建议修改方向：** 允许使用反例代入或提示 `x²−1≥0` 的正确定义域检查，而不要求直接宣布最终区间；禁止错误认同 x≥1 是两个复合函数的共同定义域。

**验证：** 人工建立两种可接受提示、两种数学错误回答、两种过度透露答案的对照回答，并用实际 Judge 比较结果。当前**尚未实测**。

### R-02 — P1 评分公平性风险：`mc-endpoint-optimization`

**证据：** 用户表示自己会代入计算，不想再听导数基础，且 `disclosure=hint_only`；正确性 rubric 要求指出端点“can tie the interior extrema”。

**潜在误判：** “驻点找对了。但题目给的是闭区间，别漏掉两端点；比较 f(−2)、f(2) 与 f(−1)、f(1)，然后判断‘唯一’是否成立。”这是精确且尊重提示边界的回应，却没有提前透露端点会与驻点并列。

**建议修改方向：** 正确性要求聚焦“端点必须参与全局极值比较，当前唯一性的结论尚未证成”，无需直接泄漏并列位置和极值。数学完整参考仍放在 evaluator-only。

**验证：** 正确低透露提示与不正确“只看导数为零”回答成对盲评；同时检测直接报出极值是否违反提示要求。当前**尚未实测**。

### R-03 — P2 诊断精度风险：`mc-conditional-normalization`

**证据：** 学生给出的 `5/9×4/8` 对无条件两红事件是正确计算；真正错在忽视条件概率的新样本空间。现有 rubric 没有显式强调保留这一正确中间结果。

**建议修改方向：** 正确性 rubric 明确承认该乘法是合法的无条件概率，同时要求指导学生重新确定条件事件的分母；不得一概称学生乘法错误。仍不得透露最终条件概率。

**验证：** 将“你算的无条件两红概率对，但还需条件化”列为合理回应；将“你的 4/8 算错了”列为错误诊断探针。

### R-04 — P2 报告语义风险：全部 20 个场景

**证据：** 40 条 `evaluationCriteria[].failureFinding.severity` 全为 `minor`，包括数学正确性错误、过度帮助和诊断错误。

**判断：** 不能据此断言生产报告存在严重度 bug；但如果使用这些字段排序风险，就无法区分内容错误与轻微表达问题。

**建议：** 先确认该实验套件是否有意统一用 `minor`，以及 severity 与评分维度、报告排序的关系；再设计可溯源的严重度规则，不直接把全部正确性错误粗暴升级。

### R-05 — P2 对话连续性风险：`mc-fraction-units`

学生提到 “When you say use the same-sized pieces”，但 `conversationHistory` 中没有对应的前一条 Tutor 发言。学生复述了提示内容，当前回合仍可理解，不过不利于检验 Tutor 是否对**此前具体提示失败**作出适当升级。

**建议：** 如计划评测多轮递进，补充可见的前序 Tutor 提示；若只评测独立单回合，则改写为“我听说要把它们分成相同大小的份……”以保持自洽。

### R-06 — P2 解释边界：迁移场景的 `near_mastery`

`mc-quadratic-transfer`、`mc-conditional-transfer` 使用作者标记的 `near_mastery`。这可以作为合成情境标签，但**不能从一次正确作答推断真实学习者接近掌握**。预期 `fade_support` 仅表示此回合适当减少不必要的教学支架，不等于授予掌握认证。应保持报告边界。

## 4. 20 个案例逐项状态

“未发现首轮阻塞”并不等于 Judge 有效性或实证有效性验证通过。

| 案例 ID | 数学参考 | 当前审查结果 |
|---|---|---|
| `mc-quadratic-condition` | 未发现错误 | 首轮无具体阻塞 |
| `mc-quadratic-prerequisite` | 未发现错误 | 首轮无具体阻塞 |
| `mc-quadratic-transfer` | 未发现错误 | R-06 解释边界 |
| `mc-conditional-normalization` | 未发现错误 | R-03 诊断精度 |
| `mc-conditional-prerequisite` | 未发现错误 | 首轮无具体阻塞；需显式意识到各颗球可区分 |
| `mc-conditional-transfer` | 未发现错误 | R-06 解释边界 |
| `mc-fraction-units` | 未发现错误 | R-05 对话连续性 |
| `mc-percent-reversal` | 未发现错误 | 首轮无具体阻塞 |
| `mc-rational-domain` | 未发现错误 | 首轮无具体阻塞 |
| `mc-composition-domain` | 未发现错误 | R-01 P1 评分风险 |
| `mc-logarithm-base` | 未发现错误 | 首轮无具体阻塞 |
| `mc-similarity-area` | 未发现错误 | 首轮无具体阻塞 |
| `mc-circle-tangency` | 未发现错误 | 首轮无具体阻塞 |
| `mc-repeated-symbols` | 未发现错误 | 首轮无具体阻塞 |
| `mc-bayes-base-rate` | 未发现错误 | 首轮无具体阻塞 |
| `mc-simpson-aggregation` | 未发现错误 | 首轮无具体阻塞 |
| `mc-induction-recurrence` | 未发现错误 | 首轮无具体阻塞 |
| `mc-amgm-domain` | 未发现错误 | 首轮无具体阻塞 |
| `mc-endpoint-optimization` | 未发现错误 | R-02 P1 评分风险 |
| `mc-linear-dependence` | 未发现错误 | 首轮无具体阻塞 |

## 5. 修订和最终验收的顺序

1. **先执行评分探针，确认 R-01 / R-02 是否真实造成 Judge false negative**；在未复现前不应凭主观偏好改 rubric。
2. 明确 R-03 所保护的正确中间推理，并用一正一反的诊断样例核验。
3. 查明 `severity=minor` 的报告定义与用途；只在有明确分级政策时调整。
4. 对 R-05 / R-06 以独立回合和多回合设计目标决定是否修订场景。
5. 不增加随意凑数的新题，不修改本轮原始试题的数学参考或 canonical 评分。
6. 后续必须保留问题 ID、修改前后的案例文本、预期 Judge 判断、实际回放、人工意见与未解决分歧。只有回放证据充分，才将“评分风险”改为“已复现缺陷”。

## 6. 本轮结论

**数学正确性：** 16 种任务的首轮独立检查未发现重大数学错误。

**设计有效性：** 识别两项 P1 的潜在提示公平性风险与四项 P2 的诊断、报告或解释边界；仍需模型/Judge 对照回放才能确定真实误判。

**合并规则：** 本记录可单独审阅；任何对可执行实验案例或评分规则的实质修改，都应另行审查并经过回归测试。此记录本身不应被误当作已完成案例专家认证。


## 7. 固定评分反例语料与真实 Judge 回放入口

**实现：** [13 条反例样本](../../fixtures/judge/math-rubric-counterexamples-v0.1.json)、[诊断回放脚本](../../scripts/math-rubric-counterexample-probe.mjs)、[离线回归测试](../../tests/math-rubric-counterexample-probe.test.ts)。

- `R-01`（复合函数定义域）4 条：最小有效反例、正确定义域约束提示、错误认同、过度完整解答。
- `R-02`（闭区间极值）4 条：最小端点提示、四点比较提示、错误唯一性结论、直接给全部极值。
- `R-03`（条件概率）5 条：保留正确无条件计算的两种提示、错误诊断、错误条件答案、过度泄漏答案。
- 13 条各标注两项 rubric 的作者预期 `PASS`/`FAIL`；这些标签仅是**诊断假设**，不构成人工校准金标准或 Judge 正确率。

本仓库已有 Judge 运行器可复用，未创建第二套评分引擎，也未直接修改现有 20 个案例的 rubric。执行方式（先安装依赖并编译）：

```powershell
npm ci
npm run build
node scripts/math-rubric-counterexample-probe.mjs --dry-run
```

离线模式输出 `VALIDATED: 3 cases, 13 synthetic responses, 0 Judge calls.`，只说明数据与回放接口通过结构验证，**不是 13 次 Judge 判分**。

若用户决定执行真实调用，需自行在本地安全配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_JUDGE_MODEL`，再明确选择：

```powershell
node scripts/math-rubric-counterexample-probe.mjs --judge-deepseek --output artifacts/math-rubric-probe.json
```

该命令最多按 13 条样本分别发起 Judge 评测（不调用 Tutor 模型）；报告将区分 `available`、`unavailable`、与作者预期一致或不一致，保存各 rubric 的观测标签和必要诊断证据。报告生成前不推测 Judge 结果；未获得实际回放前，R-01/R-02 保持“潜在评分风险”，不能宣布误判已复现。

**验证门槛：** 先检查结构与 CI，再人工复核每条正反例是否符合学习者意图，最后在同一个固定 Judge prompt/model 版本下重复运行，记录分歧与不可用情况。每次修改 rubric 必须保留原文、变更原因与回归对照，不得将 Judge 可用性失败算成数学或教学能力 FAIL。


## 8. DeepSeek 实际回放：第一次固定样本试验（2026-10-28）

**证据来源：** 使用者提供的本地 `math-rubric-probe.json` 派生统计。原始文件含已筛选的结构化观察，并**不包含 API 原文或无效输出的原始内容**；没有独立留存原始模型响应，不应猜测具体解析失败原因。

**已确认元数据：** `deepseek/deepseek-flash`、`tutor-eval-pedagogy-judge-system@0.9`、`math-rubric-counterexamples-v0.1@0.1.0`。13 条 Judge 调用记录、9 条有效、4 条不可用（均为 `judge_result_invalid`）、9 条有效中 8 条与作者预期全项一致，1 条有评分分歧。成功评估的 18 个 rubric 判断中 17 个与作者预期一致；这只是诊断性一致比例，不是 Judge 准确率或人工标注一致率。

| 案例 | 正确简短提示 | 正确引导提示 | 错误回答探针 | 完整答案接管 |
| --- | --- | --- | --- | --- |
| `mc-composition-domain` | 双 PASS | 双 PASS | `judge_result_invalid`，不可用 | 正确性 PASS、指导 FAIL、major answer_leakage |
| `mc-endpoint-optimization` | 双 PASS | 双 PASS | `judge_result_invalid`，不可用 | 正确性 PASS、适应性 FAIL、major answer_leakage |
| `mc-conditional-normalization` | 双 PASS | 双 PASS | 两条均 `judge_result_invalid`，不可用 | 正确性 PARTIAL、指导 FAIL、major answer_leakage |

**R-01 / R-02：** 两种不同正确提示都得到完整 PASS，原先担忧的“最小提示被误扣”**本轮未复现**，不应在此时更改 rubrics；仍需不同模型或重复运行做稳定性测试。

**R-03：** 失配发生在 `answer-takeover` 的正确性：作者预期 PASS，Judge 给 PARTIAL；指导 FAIL 和 major `answer_leakage` 均符合预期。其候选回答给出了正确条件概率却没有明确承认并解释学生原先的无条件计算，因此 PARTIAL 可能是有根据的；应首先人工重审作者预期，不得直接宣称 Judge 错判。

**优先处理的可用性问题：** 4 条专门设计的错误回答全部失败，并且错误代码相同（`judge_result_invalid`）。这造成定向的失败样本盲区：没有合法 Judge 结果就**不能**把这些回答记为 FAIL，更不能仅凭“均失败”判断模型的错误诊断能力。究竟是缺少字段、无效枚举、文本格式还是其他解析不一致，当前报告无法细分。

**下一步最省成本的复验：** PR 内测试脚本已添加 `--variant` 重复筛选，仅回放上述 4 条：

```powershell
npm run build
node scripts/math-rubric-counterexample-probe.mjs --dry-run `
  --variant wrong-agreement `
  --variant wrong-diagnosis `
  --variant wrong-endorsement
# 验证应为 3 cases, 4 synthetic responses, 0 Judge calls
node scripts/math-rubric-counterexample-probe.mjs --judge-deepseek `
  --variant wrong-agreement `
  --variant wrong-diagnosis `
  --variant wrong-endorsement `
  --output artifacts/math-rubric-probe-retry.json
```

任何额外输出诊断都应优先记录**结构化、非秘密的错误种类和模型配置**；不得随意记录原始密钥、隐藏推理或完整供应商请求体。先复测与归类，再决定是否改 Judge 提示、输出格式处理或实验 rubric。

