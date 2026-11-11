# 学科知识点研究复盘：来源、用途与准入（v0.1，2026-11-11）

**范围说明**：针对 TutorBench 的数学、物理、化学、生物知识关联，比较若干成熟研究与公开课程资源。本研究是**选定来源的证据盘点，不是穷尽性系统综述**；没有复制、下载或导入受限测评题目、教材正文、图像或标准全文。

## 1. 先复用已经做过的工作

- 数学：`src/research/mathematics-linkage-audit.ts`，44 个原有图谱节点、31 个限定来源对象（24 条未审候选链接与 7 条明确未匹配），主知识点/辅助知识点分开。
- 自然科学：`src/research/natural-sciences-linkage.ts`，物理、化学、生物各自控制内部概念结构；17 个限定来源（15 条未审候选链接、2 条不确定归属），实验性 Health 维度不代表默认 Health 覆盖。
- 新增 `src/research/subject-knowledge-linkage.ts` 是**共同结构层**：原始且精确的来源身份、学科命名空间知识节点、主/辅关联、缺口与完整性审计。原先两个学科特定模块仍分别负责来源真实性与教育语义。它**不是第三份知识图谱，不计算认知掌握概率，不修改任何评分**。

## 2. 可借鉴研究与资源（按用途而非学科树分类）

| 价值 | 来源 | 实质成果 | 可借鉴方式 | 必须保留的边界 |
| --- | --- | --- | --- | --- |
| **A** | [NRC 2012 K–12 Science Framework](https://nap.nationalacademies.org/resource/13165/reportbrief.html)、[NGSS 三维结构](https://www.nextgenscience.org/glossary/three-dimensions) | 分清学科核心知识 DCI、跨学科概念 CCC、科学/工程实践 SEP | **知识节点 × 推理/实践能力 × 跨学科主题**的多轴关联，避免仅按教材目录分层 | 美国 K–12 设计范式并非中国高中/高考的官方覆盖范围；全文复用需单独核权 |
| **A** | [AAAS Project 2061 与 Atlas of Science Literacy 的研究综述](https://pmc.ncbi.nlm.nih.gov/articles/PMC3203679/) | 相关科学概念跨年级的联系图和主题发展路径 | 引入关系类型「contributes_to / supports」与有证据范围的学段建议 | 不是全部学生的硬先修；Atlas 原图与文字不等于可无条件复制 |
| **A** | [Learning Progressions 文献回顾](https://doi.org/10.1002/sce.21525)、[National Academies 对经验性轨迹的说明](https://www.nationalacademies.org/read/21836/chapter/4) | 研究科学理解由直觉性表述转向更成熟解释的可能轨迹，强调学习进展具有情境性 | 可添加**候选进阶假设**、目标学生群体、适用环境和实证等级 | 不把年级等同认知阶段，不把作者绘制顺序视为所有学生固定路径 |
| **A** | [Evidence-Centered Design（ETS/CRESST）](https://cresst.org/publication/a-brief-introduction-to-evidence-centered-design/) | 建构对知识/能力主张、任务行为、观察证据的可审计推断链 | 采用**概念主张 → 诱发行为的评测任务 → 可观测证据**的设计纪律 | 题目存在不代表评价有效；一个 Tutor 通过案例不证明学生学会 |
| **A** | [教育部义务教育课程标准 2022 正式发布](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)、[高中 2017/2020 修订正式通知](https://www.moe.gov.cn/srcsite/A26/s8001/202006/t20200603_462199.html) | 中国物理、化学、生物不同学段课程范围与标准版本 | 作为**独立课程/考试对齐层**，逐条审查具体版本与要求的对应关系 | 标准是课程目标，不是科学事实本体或学生心理先修；公开可读不等于允许全文 AI 导入 |
| **A** | [BioCore Guide / Vision and Change（Brownell 等，2014）](https://pmc.ncbi.nlm.nih.gov/articles/PMC4041499/) | 大学生物教育中五大核心概念（进化、结构与功能、信息流、能量物质、系统），向下细化原则/声明 | 建生物特有的**大概念 → 机制/子概念 → 跨尺度解释**结构 | 研究对象主要是本科生物教育，不能直接宣称符合中国初高中课程 |
| **A** | [Johnstone 化学三重表征 / Taber 2013 修订讨论](https://pubs.rsc.org/en/content/articlehtml/2013/rp/c3rp00012e) | 宏观现象、粒子机制和符号表述之间的协调是化学学习难点 | 将三重**表征层次作为任务标签**，观察学生能否在不同表征间转换 | 不是三叉学科树；多种表征没有固定的、对每个学生都必然成立的学习顺序 |
| **B** | [物理 FCI 研究测评](https://www.physport.org/assessments/assessment.cfm?I=5) 与 [PhysPort 受限资源规则](https://www.physport.org/webdocs/AccessRestricted.cfm) | 研究概念误解、干扰项、访谈与统计验证 | 借鉴诊断工具**怎样产生证据**，自行设计且独立审核原创题目 | **不得将受限题、答案或衍生变体放入公开产品**；PhysPort 禁止相关内容的再发布 |
| **B** | [化学 CCI 的量化效度研究](https://pubs.acs.org/doi/10.1021/ed3004353) 与 [反应过程效度研究](https://pubs.acs.org/doi/10.1021/ed400716p) | 化学替代概念的测评，也显示量表部分内容集中于少量概念 | 用于设计**概念覆盖蓝图**和访谈/专家证据计划 | 不能因量表总分可用便推出整门化学的全面效度，也不复制版权题 |
| **B** | [Biology Concept Inventory 研究（Klymkowsky & Garvin-Doxas，2008）](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.0060003) | 用学生想法、误解和研究性访谈改进生物概念测评 | 借鉴学生错误样本的收集、可观察行为与诊断验证方法 | 文章开放许可不自动授予所有测评题/附件的公开分发权限，需逐项核验 |
| **B** | [Q-matrix/CDM 属性层次研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC6512166/)、[跨国应用中误设矩阵的风险](https://link.springer.com/article/10.1186/s40536-022-00138-4) | 一道题对应多项潜在属性，Q-matrix 误设会改变诊断结论 | 作为**多知识点和主次关系的测量研究视角**，预先定义并邀请专家审核 | **现在的知识链接不是经过心理测量验证的 Q-matrix**，禁止未经真实学生数据校准便报告掌握概率 |
| **C** | [Wikidata 结构化数据 CC0](https://www.wikidata.org/wiki/Wikidata%3ALicensing) | 多语言实体与一般知识关系 | 供**实体名称/别名对齐**，同时另建教育领域证据链 | 通用百科继承关系绝不是教学上的必然先修关系 |
| **C（权限风险）** | [OpenStax Biology 2e 版权说明](https://openstax.org/books/biology-2e/pages/preface)、[University Physics 版权说明](https://openstax.org/books/university-physics-volume-1/pages/preface) | 章节组织、已同行审查的专业教材、习题体系 | 可作为**人工对照阅读与来源链接**，逐书逐版记录许可 | **目前查验版本标示 CC BY-NC-SA 和未经书面许可不得用于 LLM 训练/AI 提供物摄入**，尤其不能批量导入正文、题库、图像；旧版许可可能不同，须逐版本核权 |

## 3. 最可操作的学科落地方法

**物理**：把已有「位置—时间图像」「力平衡」「理想串联电路」拆成**概念定义 + 物理模型的适用条件 + 推理实践 + 可能错误理解**。例如「图像最高点代表速度最大」只是某类学情误解假设，需真实学员回答独立支持。FCI 研究方法有帮助，但不能复制受限题。

**化学**：给已有「Mg + O₂ → MgO 配平」增加**原子守恒目标、公式/系数的符号关系、可能的微观粒子解释**等不同类型的标签；给「动力学控制变量」记录温度、浓度、测量与对照条件。Johnstone 三重表征最适合做**跨表征能力的侧向维度**，不是知识节点层级的替代物。

**生物**：参照 BioCore 的科学大概念，但保持分子/细胞/个体/生态等**不同尺度的解释关系**；为光合作用、渗透作用、实验对照分别设定机制证据与不能推出的结论。重视「有助理解/相关联」与「学习上必要先修」的区别。

## 4. 科研准入和产品决策

至少区分五种数据责任：

1. **知识主张**：概念 ID、精确科学定义、学科、适用范围、参考证据；
2. **关系主张**：例如 `part_of`、`supports`、`contrasts_with`、`prerequisite_hypothesis`，带独立审查/实证状态；
3. **案例关联**：精确 suite/case/decision 版本、主要/辅助知识点、审核状态；
4. **Eval / Health 评测证据**：实际运行、Tutor/Judge 原始记录、coverage、评分约束；
5. **学生学习结果**：独立学生测评、迁移、保留与效果估计。

**研究流程**：来源元信息与版本登记 → 许可及使用方式确认 → 自主表述候选概念 → 双人独立学科/评测审查 → 显式关系类型和分歧保留 → 原创案例设计 → 运行与证据校验 → 必要时真实学生研究/心理测量校准。除非完成相应证据门槛，`unreviewed`、`unmapped`、`not_measured` 不得自动晋级。

**优先级**：先用国内官方课程标准作考试/学段映射，用 NRC 三维科学框架与 BioCore/Johnstone 作内部结构启发，用 ECD 规定证据链；再借助 learning progressions、FCI/CCI/BCI 的研究方法改善任务与审核；最后考虑 Wikidata 实体对齐、OpenStax 人工参照。**这不是购买/导入外部测评题库的授权。**

## 5. 限制

这是若干代表性可靠资料的定向核查，不是系统文献综述。来源研究在某些情境获得证据，并不意味着本项目的某条具体知识关系通过了独立审核。学校阶段、可观察行为、评测对象（AI Tutor）和学习对象（真实学生）应分离。所有当前链接继续标注**作者候选、未独立评审**；未获得权利人必要许可前，不复制受保护题库、教材正文及图像，也不把可读网页自动视为可用于 AI 产品的数据来源。
