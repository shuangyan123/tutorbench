# 国内考研与国际数学考试体系对照（中文版 v0.2）

> **状态：实验性考试映射清单，非官方考试题库。** 适用于 TutorBench 的数学知识覆盖和案例审查。官方原始大纲决定考试范围；已有 44 个知识节点只是可逐步扩充的内部索引，**现有 20 个英语合成 Tutor 案例不是这些考试的真实试卷样本**。
>
> 结构化版本：[mathematics-exam-alignment-v0.1.json](../scenarios/case-system-vnext/mathematics-exam-alignment-v0.1.json)，目前包含中国中考/高考/国考、2027 考研数学（一）（二）（三），以及十个具有独立版本的国际考试配置。所有中文术语、学段与案例映射都需由项目负责人继续审查。

## 一、为什么要分别建模，而不是简单按“高中/大学”划分

**一个知识点在不同考试中的作用不同。** 例如：
- 导数、积分：在中国考研数学中属于必需考虑的重要高等数学模块；AP Calculus 同样覆盖，但其解释、图像与自由作答要求不同；**GRE Quantitative Reasoning 不考微积分**。
- 数与比、百分数、基本代数：可以同时关联中考、SAT、GRE、GMAT 和国考资料分析，但他们的**题型、数据情境、计算器权限和速度要求**不同。
- 数学证明：适合某些数学课程及考试中的严谨论证；不能假定 GRE 数学要求构造证明。
- IB AA 与 AI：一个更偏数学分析与方法，一个强调应用解释和技术工具，但两者各分 SL、HL；不能简单贴上“难/易”标签。

所以采用：
**数学知识节点（Concept） → 对应课程大纲（Syllabus） → 考试配置（Exam Profile） → 题目结构与表现标准（Item Task） → Tutor 教学案例（Teaching Decision）。**

每一层都有独立的证据来源。跨考制共享知识事实，**不共享未经验证的难度、得分或效率参数**。

## 二、中国研究生招生考试：2027年数学（一）（二）（三）

**2027版已发布。** 教育部教育考试院编制的《2027年全国硕士研究生招生考试数学考试大纲》由高等教育出版社于 **2026年9月29日**出版；教育部的《2027年全国硕士研究生招生工作管理规定》明确全国统一命题科目包含数学（一）（二）（三）。普通统考业务课（一）的考试时段为 **2026年12月20日8:30–11:30**。具体报考院校与专业是否采用数学（一）（二）（三）仍必须依据其招生专业目录确认。

| 科目 | 主干结构（供框架初步分类） | 不能混用的边界 |
| --- | --- | --- |
| **数学（一）** | 高等数学、线性代数、概率论与数理统计 | 不能用几道常规导数题代表积分、多元微积分、级数、概率分布和矩阵等范围 |
| **数学（二）** | 高等数学、线性代数 | **不要把概率论与数理统计当成数学（二）的必考模块**；准确高数及线代范围仍须逐条对照2027正式大纲 |
| **数学（三）** | 微积分、线性代数、概率论与数理统计等相应范围 | 面向对应报考专业的不同考试要求；不能复制数一的章节权重、深度和题型 |

**当前图谱主要缺口：** 高等数学缺积分、多元微分与积分、级数等大量细目；线性代数缺矩阵运算、向量空间等多个主题；概率统计缺随机变量分布、数字特征、常见概率分布等。以上是**覆盖缺口**，不是对2027大纲的逐条审计完成声明。

官方来源：
- [教育部：2027年全国硕士研究生招生工作管理规定](https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/202609/t20260923_1451734.html)
- [高等教育出版社：2027年研究生招生考试数学考试大纲](https://www.hep.com.cn/book/show/2097490366090555393)

**重要边界：** 大学自命题数学、管理类综合能力、经济类综合能力、数学（农）均为不同考试配置，不能直接列入数一/二/三的统一考点。本轮尚未建立这些独立配置。

## 三、国外与国际数学考试：首批代表性覆盖

| 体系与版本 | 数学考查方向 | TutorBench 需重点区分 |
| --- | --- | --- |
| **美国 Digital SAT Math，2026** | Algebra、Advanced Math、Problem-Solving & Data Analysis、Geometry & Trigonometry | 代数/数据建模能力、数字化考试的题目呈现与作答，不等于 AP 微积分 |
| **英国 AQA GCSE Maths 8300，2026** | Number、Algebra、Ratio、Geometry & Measures、Probability、Statistics | Foundation 与 Higher 分层、计算器/非计算器试卷、逐步解答要求；AQA 不等于所有英国考试局 |
| **Cambridge IGCSE 0580，2026（适用2025–2027大纲）** | 数、代数、几何度量、概率统计 | Core 与 Extended、非计算器题；**2028–2030大纲已发布但不是2026现行大纲** |
| **Cambridge AS/A Level 9709，2026（适用2026–2027大纲）** | Pure Mathematics，以及依报考路径选择 Mechanics 和/或 Probability & Statistics | 不同试卷组合不能用一个数学成绩替代；**2028–2030大纲已发布供未来考试使用** |
| **IB DP Mathematics AA，2026现行** | 数学分析、代数函数、微积分、证明与方法等 | SL/HL 分级，数学分析取向；2029起首次评估的新版本另行建档 |
| **IB DP Mathematics AI，2026现行** | 应用、统计与概率、建模、技术工具、数学解释等 | SL/HL 分级与建模解释，不能当成简单版AA；2029新版本另建 |
| **美国 AP Calculus AB，2027** | 极限、导数、积分与微分方程等 | 函数图像/表格/代数/文字多表征，合理使用计算器；2027试卷形式已更新 |
| **美国 AP Calculus BC，2027** | AB 内容外，增含参数与极坐标、无穷级数等 | 必须补专门的BC知识和高阶分析案例；不是“AB题目更难” |
| **GRE General Test Quantitative Reasoning，2026** | Arithmetic、Algebra、Geometry、Data Analysis | 官方明确不考三角函数、微积分、推断统计或构造证明；海外研究生入学考试不一定考大学数学 |
| **GMAT Exam Quantitative Reasoning / Data Insights，2026** | 算术初等代数与数量逻辑；表格图表、多源数据、充分性判断等 | Quant 部分不允许计算器，Data Insights 可用屏幕计算器；两部分不能混成同一类计算题 |

### 官方入口（版本选择必须按考试年份）

- [College Board：Digital SAT 数学考查领域](https://international.collegeboard.org/toolkit/sat-policy/understanding-sat/format-digital-content-scoring)
- [AQA：GCSE Mathematics 8300 考纲](https://www.aqa.org.uk/subjects/mathematics/gcse/mathematics-8300/specification/specification-at-a-glance)
- [Cambridge：IGCSE Mathematics 0580 官方大纲及年份](https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-mathematics-0580/)
- [Cambridge：AS/A Level Mathematics 9709 官方大纲及年份](https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/)
- [IB：AA、AI 当前课程及2029新课程](https://ibo.org/programmes/diploma-programme/curriculum/mathematics/)
- [AP：2026–27 AP Calculus BC课程与考试变化](https://apcentral.collegeboard.org/courses/ap-calculus-bc)
- [ETS：GRE Quantitative Reasoning 内容](https://www.ets.org/gre/test-takers/general-test/prepare/content/quantitative-reasoning.html)
- [GMAC：GMAT考试各部分内容](https://www.mba.com/exams/gmat-exam/about/exam-content)

## 四、按考试要求增加案例时，必须新增哪些元数据？

| 字段（设计目标） | 为什么需要 |
| --- | --- |
| `examProfileId`、`examYear`、`syllabusVersion` | 防止用错年份的考试大纲 |
| `paperRoute`、`tier`、`level` | 区分数一/二/三、GCSE Foundation/Higher、IB SL/HL、Cambridge 可选试卷等 |
| `syllabusObjective`、`knowledgeNodeIds` | 题型来源和所需知识分离记录 |
| `questionForm`、`answerEvidence`、`scoringBasis` | 区分选择题、解答题、证明题、资料分析、充分性判断 |
| `calculatorPolicy`、`timePolicy` | 有的场景禁用计算器，有的依赖工具；用时要求只能从可靠来源写入 |
| `commonWrongTurn`、`diagnosticEvidence` | 描述典型失分推理而不凭空断言某学生的知识状态 |
| `hintBoundary`、`goalStage` | 区分平时教学、考前训练、严格限时模考及答案复盘 |

**这些字段是后续扩展提案**，当前 PR 只加入考试配置与知识/案例映射，没有假装它们已经集成进现有 TutorEval 评分器。

## 五、下一轮案例设计的优先级

**第一优先：补课程基础缺口。** 在不扩张总分体系的情况下补考研的积分/线代/概率基础，及高中集合、向量、立体几何等缺口，完善通用数学知识底座。

**第二优先：不同考试的特殊题型。** 例如考研含参数的积分与线代综合、高考分层设问、SAT 的数学填空、GCSE 非计算器题、Cambridge Mechanics、IB AA 证明或AI应用、AP BC 级数、GRE 数量比较、GMAT Data Sufficiency、国考增长率和资料分析。

**第三优先：考试条件和 Tutor 决策。** 同一个知识点分别测试“概念教学、限时策略、错因复盘、迁移训练”。避免让只追求短答案的系统通过技巧化教学掩盖基础断层。

这三层均属于**工程建议**；没有收集学生考试成绩或真实教学增益数据，因此不应宣传为“已证明提高成绩”。

## 六、当前未覆盖且应显式保留的国外体系

本轮不是全球数学考试目录。其他值得逐一考证的体系包括：日本大学入学共通测试、韩国大学修学能力考试、Singapore O-/A-Level、澳大利亚 VCE/HSC、美国 ACT 数学及不同州课程标准、英国 Edexcel/OCR 的 GCSE/A-level，以及 GRE Mathematics **Subject Test**（它和 GRE General Quant 是不同考试）。

**原则：** 每种考试应以颁发机构的具体年份大纲为准；只在有可追溯内容依据后才注册专用配置，不以英语/中文语言差异替代真实的考试结构。
