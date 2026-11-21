# Phase 7 — 中国必修概率统计、NRW Abitur 与 SAT Algebra

2026-11-21 核读。0.7.0 在 36 个历史来源条目上增加 111 个，共 147 个。不同文种有不同计数单位。17 个州聚焦项各有一条作者提出的对照记录；考试时长、跨文件对照、上层标题与例题均在条目数之外。

## 证据与适用范围

| 来源 | 版本、字节和 SHA-256 | 本次核读边界（印刷页 / 从 1 起算的 PDF 页） |
|---|---|---|
| 中国教育部高中数学课标，课程教材研究所存档 | 2017 年版 2020 年修订，10,450,629 字节，`cc4d3a20daa09f5185037e93fbacd58f7df1147392e3dae4bf261c3700ba4195`。复核历史副本的整文件指纹与存档一致。[教育部印发通知](https://jsj.moe.gov.cn/news/2/1507.shtml) · [原件与副本链](cn-math-revision-v0.5.md) | 第四章必修主题四“内容要求”从概率到统计，止于教学提示，31–33 / 39–41。国家课程要求，指定届次、地区或卷型未知。 |
| 德国 KMK，AHR Mathematik | 2012-10-18 决议，1,632,984 字节，`a636ec6947dca2044618787a9e29116d88f68909d02e4547050e4d3fc9c77546`。[KMK 原件](https://www.kmk.org/fileadmin/Dateien/veroeffentlichungen_beschluesse/2012/2012_10_18-Bildungsstandards-Mathe-Abi.pdf) | L4 的共同及提高层 20 / 17，复用既有 15 条。国家文件没有 NRW 2027 考期属性。 |
| NRW 学校与教育部，Gymnasium/Gesamtschule 高中数学 Kernlehrplan | Heft 4720，2023-05-24 令，自 2023-08-01 起从入门阶段逐级实施，378,228 字节，`211bad803486637f541447546073d0c7678f527b366da1ba63c5b9edc5d28533`。旧 Lehrpläne 地址返回门户 HTML，本次采用州课程导航器提供的 PDF。[州课程原件](https://lehrplannavigator.nrw.de/system/files/media/document/file/gost_klp_m_2023_06_07.pdf) | 令见 5 / 5；第 2 章末段的函数与分析学，GK §2.4.1 为 24–25 / 24–25，LK §2.4.2 为 27–28 / 27–28。 |
| NRW 学校与教育部，2027 集中书面数学考试 | GG 文件，7 页，167,760 字节，`3a7cc6d16084bc61e168974d91e7ecaa71ec9f41bb4974b7ec0e04702d6a9233`。[2027 年度文件](https://www.standardsicherung.schulministerium.nrw.de/system/files/media/document/file/mathematik_2027_gg.pdf) | I（1 / 1）明确引用州课程第 2 章及资格阶段终点要求。III（4–7 / 4–7）保留全部规定。此处只枚举 6 / 6 和 7 / 7 第一列的红色聚焦条目。选择普通高中路径；同年 WBK、职业高中有单独文件。 |
| 美国 College Board，Digital SAT Suite Assessment Framework | 第 4 版，2026-09，245 页，2,668,223 字节，`e1238b7840eb4c9af93a20e1bc415eafbf316b6a8adc6c131df5345ddca9549b`。[官方框架](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf) · [官方数学规格](https://satsuite.collegeboard.org/k12-educators/about/alignment/math) | 版次及变更记录见 PDF 2、4。表 16 的 SAT 专表 75 / 84、表 21 的 Algebra 概览 80 / 89、附录 B 表 A35 的 SAT 栏 183–186 / 192–195。发布月可确认，第一个和最后一个采用此版本的具体考期未知。 |

各表仅保存定位、元数据和自撰释义。来源的公开可读性和摘要指纹不足以授权整份再发布；College Board 文件标有版权，NRW 课程计划为州版教材文件。取得的 PDF、原题和截图均在仓库之外。数字 SAT 框架的变更记录把附录 B 的引入列于 2022-12；2024-07 版澄清过数学领域描述。第 4 版还涉及历史附录、SAT Essay 等修订，此处不据此断言 Algebra 在某场考试变更。

## 枚举与分母

| 完整小节或表格栏 | 来源内最小计数单位 | 新增 |
|---|---|---:|
| 中国，必修概率 | 随机事件与概率的四条圈号条款，独立性小节唯一陈述 | 5 |
| 中国，必修统计 | 数据获取 2、抽样 3、统计图表 1、用样本估计总体 4。最后的百分位数条款续至 33 页 | 10 |
| NRW 州课程，函数与分析学 | GK 编号 A1–20，LK 编号 A1–23，各自止于几何与线性代数标题 | 43 |
| NRW 2027，函数与分析学聚焦 | GK 函数性质 5、微分 4；LK 函数性质 6、微分 2。按红色项目符号计数，黑色课程主题另有上位依据 | 17 |
| 数字 SAT，Algebra | 5 个官方考查点下，A35 的 SAT 栏各有 6、9、9、7、5 个末级表现陈述（按附录次序） | 36 |

SAT 的顺序是单变量方程、线性函数、双变量方程、二元方程组、线性不等式。双变量方程页的第五个项目下有两个末级分项；定位为 05a、05b。各行的定义说明、五个考查点标题、样题及相邻 PSAT 栏均不另计。表 15–20 区分题量、项目、领域分布和作答形式；表 21–24 划分四个领域。表 21 的约 35% / 13–15 题是 SAT Algebra 的计分题分布。其余三个领域登记为待枚举，SAT、AP Calculus AB、AP Calculus BC 的来源条款各自保留身份。

## 从国家标准追到州考试

州年度文件引用课程第 2 章是文件明示的依据。具体条款之间的语义路径由作者提出，独立审核为 0。离线报告的 `crosswalks` 使用三个可解析的端点字段。一条年度聚焦可以连接多个州课程条款和多个国家条款。

- GK 第三条微分聚焦在免工具条件下列举求导函数并要求乘积法则，州课程 GK A5 同样列举该能力。KMK L4 共同层第 5、6 项覆盖基本求导、乘积法则，未给出同样的免工具范围。路径为 `adds-specificity`。
- LK 第二条微分聚焦与 LK A6 联系；除 KMK 共同层外，还能定位提高层第 2 项的链式法则。GK 的链式法则限于自然指数与线性内函数的复合。两种课程各自保留条件。
- GK 的参数解释与确定可以定位州课程 A3、A7。已枚举的 KMK L4 中缺少足以对应这一动作的条款，国家端为空。其余 16 条聚焦路径有国家端；这些作者判断不产生独立审核数。
- NRW 文件 II(d) 的考试时间另记为格式规则。州年度视图计入 17 个聚焦项，43 个州课程要求经引用可查。三个权威层级各自有范围；第二、三列的几何与随机数学、全部过程要求及全卷分母仍待核。其他 15 州继续标为 pending。

对 46 节点图谱的候选关联新增 10 条，101 条明确未映射，累计 22 / 125。例：SAT 中熟练解一元一次方程可以关联已有方程节点；构造情境模型或在三种表征间转换另有操作要求，因此单凭题目含有直线不足以提出覆盖。州课程要求与年度聚焦各自有来源 ID；如年度聚焦的完整语义涉及工具限制，保留整条未映射。中国课程、KMK、SAT 和 AP 不共享同一来源条款。

## 中国现行版与合法取得

本次按“教材〔2025〕1号 / 高中数学 / 附件 / 实施届次”复查教育部门公开资料。2025 年 10 月印发有教材局访谈依据，无锡市教育局在初中考查文件中引用了通知文号。福建的文件涉及教辅送评。未找到从发行机关到高中数学附件的认证链，或把该版与具体高中入学届次、高考卷型及首考年绑定的实施文件。171 页 CDN 候选文件的认证继续为 pending，适用性随 0.5/0.6 的原记录重放。[访谈](https://www.pep.com.cn/rjdt/mtbd/202603/t20260330_2005956.shtml) · [无锡市教育局](https://www.wuxi.gov.cn/doc/2026/04/10/4758325.shtml) · [福建省教育厅](https://jyt.fj.gov.cn/xxgk/gggs/202603/t20260313_7109906.htm) · [历史核验](cn-math-assessment-v0.6.md)

2027 考研数学一、二、三只有出版社目录、ISBN 978-7-04-068404-9 等书目依据。取得可合法核读的馆藏或获许可的正文后，才可逐章登记。三科整纲分母均为 null。[高教社书目](https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6aa1910be119ac97297a608f)

## 离线重放

来源登记差异可直接通过 `npm run exam:inspect -- scenarios/case-system-vnext/exam-specifications/0.1.0.json src/research/data/exam-sources-v0.7.json` 查询。结果列出新增的三个文件版次与字节指纹。

使用 Node 24，运行 `npm ci` 和 `npm run build` 后，在仓库根目录执行：

```sh
npm run exam:inspect -- --requirements scenarios/case-system-vnext/exam-specifications/requirements-0.7.0.json
npm run exam:inspect -- --requirements scenarios/case-system-vnext/exam-specifications/requirements-0.4.0.json scenarios/case-system-vnext/exam-specifications/requirements-0.7.0.json
```

第一条命令包含权威来源、版次与指纹、逐条页码、概念 ID、语义路径和各考试视图。第二条列出新增的 111 个来源 ID，历史条目无删除或移位。原无参数命令及 0.1–0.6 的重放方式沿用各版本契约。
