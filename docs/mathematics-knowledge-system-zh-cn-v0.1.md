# TutorBench 数学知识体系：中文版逐节点审查稿 v0.1
> **定位：课程内容目录与候选学习依赖图谱的审核材料。** 本稿来自当前实验分支的 8 领域、44 节点 JSON，方便项目负责人提出修改意见；不是已认证课程纲要，更不是“数学全部知识”的完整覆盖。英文节点 ID 与当前机器数据保持一致。
>
> **最重要的溯源说明：当前 44 节点由项目自拟，尚未逐条完成官方课标条款/页码对应；以下“课程模块对照”属于初步概念级映射，不能视作逐条课标认证。**

## 一、参照哪些现有知识体系

| 参考体系 | 官方来源 | 在知识图谱中的定位与边界 |
|---|---|---|
| **中国义务教育数学课程标准（2022年版）** | https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html | 小学/初中内容主轴：数与代数、图形与几何、统计与概率、综合与实践。当前图谱漏掉不少测量、立体几何、数据收集、综合实践等内容。 |
| **中国普通高中数学课程标准（2017年版2020年修订）** | https://www.moe.gov.cn/srcsite/A26/s8001/202006/t20200603_462199.html | 高中必修/选择性必修主轴：预备知识、函数、几何与代数、概率统计、数学建模与探究；部分具体主题有集合、复数、向量、立体几何、数列、导数等。现有图谱未全部覆盖。 |
| **Common Core State Standards for Mathematics** | https://corestandards.org/wp-content/uploads/2023/09/Math_Standards1.pdf | 作为跨国课程范围比较，尤其是 Number & Quantity、Algebra、Functions、Geometry、Statistics & Probability 和数学实践；不替代中国课标。 |
| **PISA 2022 数学框架** | https://www.oecd.org/en/publications/pisa-2022-assessment-and-analytical-framework_dfe0bf9c-en/full-report/component-3.html | 重点用于四种数学内容现象：数量、变化与关系、空间与形状、不确定性与数据；不是小学至大学的学科目录或逐节点先修标准。 |
| **TIMSS 2023 数学框架** | https://timssandpirls.bc.edu/timss2023/frameworks/index.html | 用于小学四年级与初中八年级内容分布，以及 Knowing / Applying / Reasoning 的任务性质对照；不能直接用于高中或大学的知识排序。 |

**四项信息必须分开存放：** 学科内容归属、官方课程对应、项目假设的先修关系、任务需要的认知实践。不能从“公式更复杂”直接推断学生难度更高。

## 先修依赖图的理论起点：Knowledge Space Theory

除了“数学学哪些知识”之外，还有一个独立问题：**知识点之间究竟具有什么可检验的依赖关系？**

这里比 PISA/TIMSS 分类更贴近的是 **Doignon 与 Falmagne 的知识空间理论（Knowledge Space Theory, KST）**，以及其后续的 Learning Space Theory。它研究一个知识领域的题目/能力状态及它们之间的关系，用以描述个体可能掌握的知识集合，并探索不同的学习路径。

- [Doignon & Falmagne, Knowledge Spaces and Learning Spaces](https://escholarship.org/uc/item/94b9x5sw)
- [ALEKS 对其知识空间方法的说明](https://www.aleks.com/about_aleks/knowledge_space_theory)

**但当前 TutorBench 的 44 节点有向图并不等于知识空间理论已被正确实现。** 目前节点更接近“概念/主题”，不是基于验证结果定义的题目类别；边是编辑者提出的候选先修联系，既未由学生作答数据检验，也没有建立或校准可行知识状态集合。

应明确三层不同的对象：

1. **课程知识分类：** 由中国课标 / Common Core 等提供内容覆盖范围。
2. **潜在先修关联：** 由认知研究、典型教学路径和明确的解题必要条件提出候选边；可有替代路径。
3. **证据支持的学习状态：** 需要题目-技能映射、独立作答证据及足够检验；目前没有建立，不应由一次对话推断。

未来可把“一个主题”拆成更细的可观测技能/题型，把 **必需前提、常见有益前提、替代策略** 分开。这样比将所有学生强制放在同一条教学顺序上更符合因人而异的目标。

## 二、8 个领域与 44 个节点（保留可追溯 ID）

每条边 `A → B` 只表示工程编写时*可能*需要先掌握 A 才更容易学习 B，并不是不可替代的学习路线，也不是某个真实学生一定缺少 A 的诊断。“待补”表示当前实验案例未直接映射该节点；不代表没有任何数学价值。


### 数与运算、数量关系

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `units-whole` | 整体与单位基准 | — | 待补 | 确定同一个整体，理解单位与整体的关系 |
| `integers-operations` | 整数与运算规则 | — | 待补 | 整数运算、正负号和算式意义 |
| `fractions-units` | 分数单位与分母 | `units-whole` | 已映射 | 分母表示等分的份数；不能把不同分数单位直接相加 |
| `fraction-equivalence` | 分数等值与通分 | `fractions-units`、`integers-operations` | 已映射 | 同一个量可以使用不同等分方式表示 |
| `ratios` | 比、比例与倍数关系 | `fractions-units` | 待补 | 区分乘性关系与加性差值 |
| `percent-base` | 百分数及其参照量 | `ratios` | 已映射 | 百分比必须附带参照基数 |
| `successive-changes` | 连续百分比变化 | `percent-base` | 已映射 | 复合变化依次作用于新的基数 |

### 代数式、方程与不等式

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `variable-symbols` | 变量、代数式与等式 | `integers-operations` | 待补 | 字母可以表示数量、关系和未知量；等号不是计算指令 |
| `linear-equations` | 一元一次方程与等价变形 | `variable-symbols` | 待补 | 方程变形须保持等式成立 |
| `polynomial-factorization` | 整式展开与因式分解 | `variable-symbols` | 待补 | 解释结构变换的数学根据 |
| `rational-domain` | 分式及定义域限制 | `polynomial-factorization`、`linear-equations` | 已映射 | 约分不能恢复原分母为零的非法取值 |
| `inequality-signs` | 不等式变形与符号 | `linear-equations` | 待补 | 乘除负数应改变不等号方向 |
| `quadratic-discriminant` | 二次方程与判别式 | `polynomial-factorization` | 已映射 | 判别式约束实根数量，不自动保证根的符号 |
| `root-sign-conditions` | 二次方程根的正负条件 | `quadratic-discriminant`、`inequality-signs` | 已映射 | 区分实根存在性与根和、根积的必要约束 |

### 函数、数列与变化

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `coordinate-graph` | 坐标系与图像读数 | `variable-symbols` | 待补 | 区分自变量和因变量 |
| `function-definition` | 函数概念、定义域与对应关系 | `coordinate-graph` | 待补 | 先检验允许输入，再解释函数输出 |
| `function-composition` | 复合函数与定义域 | `function-definition` | 已映射 | 两个函数嵌套时要同时满足内外限制 |
| `inverse-functions` | 反函数与单射限制 | `function-definition` | 待补 | 反函数存在与定义域、单射条件有关 |
| `exponential-laws` | 指数运算与指数变化 | `function-definition`、`polynomial-factorization` | 待补 | 指数增长是乘性变化，不是固定增量 |
| `logarithm-inequalities` | 对数不等式与底数单调性 | `exponential-laws`、`inequality-signs` | 已映射 | 真数条件和底数范围共同约束解集 |
| `limits-continuity` | 极限与连续性 | `function-composition` | 待补 | 函数点值与极限并非同一概念 |

### 图形、几何与空间

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `length-area` | 长度、面积与度量单位 | `units-whole` | 待补 | 线性比例与面积比例不同 |
| `angles-triangles` | 角与三角形性质 | `length-area` | 待补 | 图形直观不是证明 |
| `similarity-scale` | 相似与比例缩放 | `angles-triangles`、`ratios` | 已映射 | 长度比、面积比、体积比有不同指数关系 |
| `pythagoras` | 勾股定理及使用条件 | `angles-triangles` | 待补 | 必须确认直角条件 |
| `coordinate-geometry` | 解析几何及直线圆关系 | `coordinate-graph`、`pythagoras`、`quadratic-discriminant` | 已映射 | 经过圆上一点并不一定与圆相切 |
| `trigonometry` | 三角比、三角函数与几何关系 | `similarity-scale`、`pythagoras` | 待补 | 理解定义域和不同三角概念的适用范围 |

### 计数原理与概率

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `counting-principle` | 分类、分步计数原理 | `integers-operations` | 已映射 | 计数结果由可区分的对象及顺序要求决定 |
| `combinations` | 组合与不计顺序的选取 | `counting-principle`、`fractions-units` | 已映射 | 不能把有序方案直接当作无序方案 |
| `probability-events` | 随机事件与样本空间 | `fractions-units`、`counting-principle` | 待补 | 分子分母必须对应同一抽样机制和事件 |
| `conditional-events` | 条件概率与样本空间限制 | `probability-events`、`combinations` | 已映射 | 条件发生后必须重新限定参照空间 |
| `bayes-base-rate` | 基准率与逆向条件概率 | `conditional-events` | 已映射 | 混淆 P(检出|有病) 与 P(有病|检出) |

### 统计、数据与推断

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `statistics-weighted` | 统计汇总与加权平均 | `percent-base` | 待补 | 权重不同不能简单平均比例 |
| `statistics-conditioning` | 分层统计与辛普森悖论 | `statistics-weighted` | 已映射 | 合并统计和分组统计的结论可能不一致 |
| `statistics-variability` | 离散程度与数据分布 | `statistics-weighted` | 待补 | 均值不能独立代表数据差异 |
| `statistics-inference` | 抽样、统计推断与因果区分 | `statistics-variability`、`conditional-events` | 待补 | 相关性不单独证明因果关系 |

### 逻辑、证明与数学探究

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `sequences-recursive` | 数列与递推关系 | `variable-symbols`、`exponential-laws` | 已映射 | 有限项符合某公式不是一般结论的证明 |
| `logic-quantifiers` | 逻辑量词、命题与反例 | `variable-symbols` | 已映射 | 全称结论需要证明，一例不能证明所有情况 |
| `mathematical-induction` | 数学归纳法 | `sequences-recursive`、`logic-quantifiers` | 已映射 | 基例与归纳步骤必须完整 |
| `inequality-proofs` | 不等式证明及等号条件 | `inequality-signs`、`logic-quantifiers` | 已映射 | 定理前提、适用域和等号条件要核验 |

### 高等数学入门（扩展层）

| 节点 ID | 中文名称 | 候选前置节点 | 当前案例 | 审查焦点 |
|---|---|---|---|---|
| `derivatives-rate` | 导数与瞬时变化率 | `limits-continuity`、`polynomial-factorization` | 待补 | 导数为零只是候选驻点，未必是全局最值 |
| `optimization-boundary` | 闭区间优化与边界分析 | `derivatives-rate`、`inequality-signs` | 已映射 | 全局最值须同时考虑端点和内部候选点 |
| `systems-equations` | 线性方程组与相容性 | `linear-equations` | 待补 | 并非所有方程组都有唯一解 |
| `linear-algebra-rank` | 矩阵秩、线性相关与解空间 | `systems-equations`、`variable-symbols` | 已映射 | 系数矩阵奇异不意味着一定有无穷多解 |

## 三、按照中国课程结构重排后的缺口

1. **小学/初中：** 小数、负数的数感发展、数量估计、度量与单位、几何作图、轴对称/平移/旋转、统计调查与数据整理、真实情境综合实践仍缺少独立的知识节点与案例。
2. **高中：** 集合与常用逻辑用语，向量、复数、立体几何、完整的三角函数、数列系统、函数建模、解析几何多样问题，以及统计与随机变量的覆盖不足。
3. **跨领域数学实践：** 数学建模、问题提出、证明与反证、抽象化、表示转换、运算检验和数学语言表达，不应全部被挤在“证明”这一学科分支；它们很多是跨知识节点的任务属性。
4. **大学扩展层：** 微积分与线性代数在现图只是非常窄的探索性样本，**不应暗示已覆盖大学数学体系**。后续可独立建立微积分、线性代数、离散数学与统计学知识专题。
5. **先修关系需要独立审核：** 例如“函数复合”不要求先完整掌握分式定义域；“统计分层”未必以条件概率为硬性前提。图谱应把 `required`（必要）、`helpful`（有益）和 `alternative`（可替代路径）区分，现版本所有边仅视为候选。

## 四、与案例的映射和审查原则

当前 16 个数学任务结构关联了 22 个节点，另有 22 个节点未被实验套件直接映射。详细关联保存在：
`scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json`。

项目负责人审查时，建议主要看：

- **内容遗漏：** 按小学/初中/高中各自课标，哪些必备主题没有出现？
- **粒度不均：** 一个节点是否包含太多本应独立评价的知识，如“条件概率”与“事件表示”？
- **依赖方向：** 某概念是否真的是另一个概念的*必要*前提，还是仅一种讲法？
- **问题真实性：** 误区是否在数学上成立且值得评测？学生话语是否给出了诊断证据？
- **能力与知识区别：** “逻辑推理”“建模”“策略选择”应作为可跨学科复用的数学实践标签，不等于某个年级的章节。

## 五、明确的工程结论

本图谱已经有可检查的知识 ID 和候选依赖边，但**仍属于课程映射缺口较大的提纲**。下一步应先补“课程标准层 → 主题/知识节点 → 子技能与可替代先修路径 → 案例”的映射，随后按覆盖缺口而非随意追求难题数量新增任务。

**版本说明：** 中文节点名称是供审查使用的人工译名；未修改机器 ID、评分、Judge 或旧案例。中文审查意见可先以中文提出，工程实现可以继续保持稳定 ID。

## 考试导向配置（2026-10 增补）

数学内容范围与考试考查目标应分别建模。现有知识图谱保持稳定；针对中考、高考及国考行测的考试要求、时间条件、知识映射与具体缺口，见 [考试导向数学案例设计中文版](mathematics-exam-oriented-zh-cn-v0.1.md)。对应结构化配置位于 `scenarios/case-system-vnext/mathematics-exam-alignment-v0.1.json`。考试配置不是官方真题蓝图，也不修改历史 TutorEval 评分。

## 国内考研与国际考试版图（2026-10 增补）

最新的[考研数学（一）（二）（三）与国外主要数学考试中文版对照](mathematics-global-exam-systems-zh-cn-v0.2.md)，按官方考试机构及考试年份列明 2027考研数学、SAT、AQA GCSE、Cambridge IGCSE/AS-A Level、IB AA/AI、AP Calculus、GRE Quant 和 GMAT Quant/Data Insights。它们在一个可扩展的知识底座上运行**独立考试配置**，不得混用难度、计算器政策、题型或正式分值。详见 `scenarios/case-system-vnext/mathematics-exam-alignment-v0.1.json`。


## 六、结构审查修订（2026-10-27）

- 每个节点增加 `prerequisiteEvidence: "author-hypothesis"`，明确 61 条边均是编辑者提出的候选先修关系，绝不可据此自动诊断真实学生的知识缺陷。未来区分必需、有益及替代策略时，应先增加独立关系注册表与证据，不得把旧边默认为已验证的必需前提。
- `limits-continuity` 的实验性学段标签与 `derivatives-rate` 对齐为高中阶段，仅指初步直观的极限与连续性概念。严格的大学实分析不在本节点范围内；不同考试的官方学段仍由各自课程配置决定。
- 当前 `cross-cutting` 是 TutorBench 的内部辅助类别，并非 PISA 官方第五种数学内容类型。后续正式课程映射应分离官方内容分类与项目内部学科类别。
- 本轮不追加未核实的课标节点，也不改动 20 个可执行案例的数学答案、评测条件和历史评分。
