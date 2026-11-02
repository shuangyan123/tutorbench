import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Standalone editorial series. Separate from TutorBench measurements and public benchmark data. */
interface Copy {
  title: string;
  description: string;
  dek: string;
  sections: { heading: string; paragraphs: string[] }[];
}
interface Article {
  slug: string;
  en: Copy;
  zh: Copy;
  sources: { label: string; url: string }[];
}
interface PublishOptions {
  outputDirectory: string;
  siteUrl?: string;
  basePath?: string;
}
const PUBLISHED = "2026-11-02";
const POSTS: Article[] = [
  {
    "slug": "who-owns-the-past-exam-paper",
    "en": {
      "title": "Who Should Publish the Exam Paper?",
      "description": "Why completed public examinations need authoritative, accessible archives—and why an evening PDF does not establish its source.",
      "dek": "When an exam is over, why must students depend on fragmented commercial copies to find out what was asked?",
      "sections": [
        {
          "heading": "The paradox of an unavailable original",
          "paragraphs": [
            "A public examination sets the terms of a consequential selection process. Students are often forbidden from taking the paper out of the room, yet scans, retyped PDFs, and unofficial answers may circulate after the exam. The presence of a complete-looking PDF is not proof of an official leak: a reconstructed document, a photograph, and a source file are different objects. Still, the basic question remains. Where can an ordinary learner obtain a verified copy?",
            "An official archive would give students something that an enthusiastic reconstruction cannot guarantee: an authoritative version, a correction history, and a stable address. That is especially important in mathematics, where one missing condition, mislabeled diagram, or altered symbol can change the problem itself."
          ]
        },
        {
          "heading": "Compensation and access are different questions",
          "paragraphs": [
            "Teachers and institutions may spend real time collecting and checking a paper. They deserve recognition and may be paid for original explanations, indexing, or teaching. But paying for useful work does not require every learner to purchase access to the underlying public-exam questions. A public institution could publish the source when permitted, commission verification, or buy a suitably broad license to make a high-quality reconstruction available to all.",
            "Where schools purchase a commercial question bank, the student should not have to pay again for the same essential classroom access. Yet school-only licensing misses independent learners and students at poorly resourced institutions. A public archive would reduce that gap."
          ]
        },
        {
          "heading": "Release by rule, not by rumor",
          "paragraphs": [
            "Exam secrecy before and during administration protects fairness. The precise point at which material may be released, the status of reusable questions, and copyright obligations require examination-specific rules. Those are reasons to design a release policy, not reasons to leave historical publication opaque.",
            "We propose a plain public timetable: keep active papers secure; release eligible original questions after the relevant exam period; issue errata when needed; and retain them permanently in accessible formats. If a paper remains withheld, the organizer should explain the applicable restriction and review date."
          ]
        },
        {
          "heading": "A question that can be audited",
          "paragraphs": [
            "The immediate reform is not to accuse a particular institution of selling or leaking papers. It is to ask which years and subjects have an official public copy, which do not, who controls release, and how much an authoritative archive would cost to maintain. Those are measurable questions, and they are a better basis for policy than a collection of suspicious timestamps."
          ]
        }
      ]
    },
    "zh": {
      "title": "考完的试卷，究竟应该由谁公布？",
      "description": "公共考试结束后，为什么获取权威原题仍需依赖零散的商业资料？",
      "dek": "考试已经结束，学生却还要在各种“完整版”之间辨别真伪。公共考试能否拥有可靠、免费、长期开放的真题档案？",
      "sections": [
        {
          "heading": "找不到原件的悖论",
          "paragraphs": [
            "公共考试决定着重要的选拔机会。考生不能将试卷带离考场，考试结束后，网络上却可能迅速出现扫描图、重排版 PDF 和民间答案。完整 PDF 的出现并不能直接证明内部泄题：考卷照片、后期重建和命题机构的原始电子文件不是同一种东西。但一个基础问题依然成立：普通学习者究竟该去哪里获取经过核验的原题？",
            "官方真题档案能提供民间整理难以保证的东西：权威版本、明确的勘误记录以及长期稳定的访问地址。数学尤其如此，少一个条件、错一个符号或图形标签，都可能改变整道题的含义。"
          ]
        },
        {
          "heading": "支付劳动报酬，不等于让学生购买访问权",
          "paragraphs": [
            "教师和机构整理试题确实需要劳动，原创解析、分类索引和教学服务也可以获得报酬。但承认劳动价值，不代表每个学生都必须为接触公共考试原题重复付费。公共部门可以在允许发布时提供原卷，也可以委托校对，或者购买足够开放的使用许可，让高质量整理版面向公众免费开放。",
            "学校集中采购题库，可以减轻学生个人付费的负担；但如果资源只能由在校学生使用，复读生、自学者与资源薄弱学校的学生仍可能被排除。因此，学校采购可以是过渡措施，长期公共档案才更接近普遍可及。"
          ]
        },
        {
          "heading": "用规则发布，而不是靠传闻流通",
          "paragraphs": [
            "考前和考试期间保密是维护公平的必要安排。试题能否复用、保密期何时结束、版权如何处理，也需要具体考试的适用规则。但这些问题更像是制定透明发布政策的理由，而不是长期不说明历史试题如何获取的理由。",
            "我们建议建立明确的流程：正在使用的试题严格保密；考试阶段结束且满足公开条件后发布权威原卷；发现错误及时勘误；以可搜索、可下载的格式长期保存。确实不能公开的，应说明限制依据和复核时间。"
          ]
        },
        {
          "heading": "先把问题变成可核查的事实",
          "paragraphs": [
            "改革的起点并不是指控哪家机构出售或泄露试卷，而是逐年核对：哪些科目已有官方原卷，哪些仍缺失，发布决定由谁负责，建设维护档案需要多少实际支出。比起凭一张“当天晚上”的截图推测来源，这些才是可以审计和推动改变的问题。"
          ]
        }
      ]
    },
    "sources": [
      {
        "label": "广州市教育局：2025年高考期间对校外培训机构的告知",
        "url": "https://jyj.gz.gov.cn/gkmlpt/content/10/10292/post_10292634.html"
      }
    ]
  },
  {
    "slug": "libraries-should-buy-access-not-databases",
    "en": {
      "title": "Libraries Should Buy Access, Not Just Databases",
      "description": "The case for measuring academic library procurement by successful full-text access rather than subscription count.",
      "dek": "A library can spend millions on subscriptions and still fail at the moment a researcher needs one paper.",
      "sections": [
        {
          "heading": "Subscriptions are inputs, not learning outcomes",
          "paragraphs": [
            "A 2024 Chinese university-library report summarized 4.670 billion yuan in electronic-resource purchases among 1,202 institutions that submitted valid data. This is not a national total for every university, and it does not measure waste. It does establish the scale of spending that deserves a serious account of value.",
            "Counting database packages is an administrative convenience. A doctoral student may search Google Scholar, find a paper outside the subscribed collection, and still face a paywall. That experience cannot be explained by an institution's subscription count alone."
          ]
        },
        {
          "heading": "Joint procurement already exists",
          "paragraphs": [
            "China has national library-sharing infrastructure through CALIS and collective digital-resource negotiation through DRAA. It would be inaccurate to say that no one has attempted coordinated purchasing. The question is whether these arrangements achieve the coverage that actual learners and researchers need, including researchers at smaller universities.",
            "A nationwide contract can increase bargaining power, but publishers may price it according to the newly covered population. Nor is every specialized database useful to every institution. Centralization creates value only if the net cost and accessible content improve against a credible baseline."
          ]
        },
        {
          "heading": "The missing denominator is demand",
          "paragraphs": [
            "Imagine recording each legitimate request for a DOI or book chapter, the institution's available license, lawful open versions, document-delivery attempts, time to full text, and the eventual outcome. A simple primary metric would be the share of valid requests fulfilled legally within a stated time limit. We would also measure the distribution across universities, subjects, and independent scholars.",
            "Procurement should then be layered: broadly needed resources may receive national licenses; specialized fields may negotiate through consortia; institutions may buy local supplements; uncovered material may be supplied through lawful document delivery or targeted acquisition. Open-access repositories should be checked first, rather than making every request another purchase."
          ]
        },
        {
          "heading": "Run a controlled purchasing pilot",
          "paragraphs": [
            "Before claiming savings, compare actual contracts, license scopes, authentication, costs, and anonymized demand logs. Pilot a new arrangement across institutions with different budgets and disciplines. Test both financial cost and lawful full-text fulfillment; neither can be inferred from an impressive headline budget."
          ]
        }
      ]
    },
    "zh": {
      "title": "大学图书馆不该只购买数据库，而应该保障文献获取",
      "description": "从采购多少数据库转向真实文献需求的满足率，重新思考高校电子资源经费。",
      "dek": "学校可能花费数百万元订阅数据库，但当研究者真正需要某篇论文时，屏幕上依然出现几十美元的付费墙。",
      "sections": [
        {
          "heading": "订阅是投入，不是学习成果",
          "paragraphs": [
            "《2024年全国高校图书馆发展报告》的相关整理显示，在提交有效数据的1,202所高校中，电子资源购置费合计约46.70亿元。这不是全国所有高校的完整支出，也不能据此断言存在浪费。但如此规模的投入，理应能够接受关于实际使用价值的检验。",
            "统计采购了多少个数据库很方便，却无法回答研究者最关心的问题：他在 Google 学术上找到的那篇论文，到底能不能读到全文？即使订购数量很多，未覆盖的论文仍可能要求单篇付费。"
          ]
        },
        {
          "heading": "联合采购并非从未存在",
          "paragraphs": [
            "中国已有 CALIS 文献保障体系，也有 DRAA 高校图书馆数字资源采购联盟。说国内完全没有统筹采购并不准确。需要继续检验的是：现有机制究竟能满足多少真实学习与科研需求，资源相对薄弱的高校是否也得到了充分覆盖？",
            "全国授权可能增强议价能力，但出版商也可能根据扩大的用户群体重新定价。专业资源又未必适合所有学校。集中采购只有在保持或扩大有效覆盖的同时降低净成本，才真正产生了价值。"
          ]
        },
        {
          "heading": "最重要的分母，是没有被满足的需求",
          "paragraphs": [
            "设想一个系统记录每次有效的 DOI 或图书章节请求，检查机构授权、合法开放版本和文献传递渠道，并追踪从申请到获得全文所需的时间。关键指标应当是：在明确时限内，合法获得所需全文的请求占比。还要按学校、学科和是否拥有高校身份分别比较。",
            "采购结构也应分层：普遍需要的核心资源可探索国家许可；专门学科继续联盟谈判；地方特色资源由学校自主补充；未覆盖的材料通过合规文献传递和按需采购保障。已有开放获取版本的，不必重复为阅读权付费。"
          ]
        },
        {
          "heading": "不要先承诺节省多少亿元",
          "paragraphs": [
            "专业评估应从采购合同、授权用户范围、实际支付金额和匿名化请求记录开始。在不同预算和学科结构的高校开展试点，同时检验净成本、全文获取率和等待时间。只有这样，才能分辨改革是否真的有效，而不是将删减订阅包装成节省。"
          ]
        }
      ]
    },
    "sources": [
      {
        "label": "高校图书馆购置费统计整理",
        "url": "https://wap.sciencenet.cn/blog-213646-1552531.html"
      },
      {
        "label": "清华大学图书馆：CALIS 工程文献信息中心",
        "url": "https://lib.tsinghua.edu.cn/info/1019/7510.htm"
      },
      {
        "label": "Google Scholar：Library Links",
        "url": "https://scholar.google.com/intl/en-US/scholar/libraries.html"
      }
    ]
  },
  {
    "slug": "a-university-id-is-not-a-research-ability",
    "en": {
      "title": "A University ID Is Not a Measure of Research Ability",
      "description": "Why access to scholarly literature should not be determined solely by enrollment and institutional affiliation.",
      "dek": "Two people may ask the same rigorous research question. Only one may have the campus login needed to read the answer.",
      "sections": [
        {
          "heading": "An affiliation gate is not a quality test",
          "paragraphs": [
            "A student at a well-resourced university may open a licensed journal with one click. Another student, or a graduate working independently, may see a pay-per-article screen. The difference comes from licenses and budgets, not necessarily from either person's capacity to understand the article.",
            "Tsinghua University Library's electronic-resource policy explicitly prohibits users from supplying acquired documents or their accounts to people outside the university. This is a real contractual and legal boundary, not a reason to suggest sharing credentials as a workaround."
          ]
        },
        {
          "heading": "The barrier has several owners",
          "paragraphs": [
            "Universities do not necessarily own the copyright to databases they pay to access. They cannot simply convert an institution-specific license into global access. Publishers, consortia, government funders, and universities must all participate in any meaningful reform.",
            "Nor should every dataset be released by default. Identifiable research data, protected archives, restricted field materials, and sensitive experimental records require distinct governance. Scholarly articles available under broad licenses are a different case from personal or confidential data."
          ]
        },
        {
          "heading": "Make cross-institution access ordinary",
          "paragraphs": [
            "A public discovery gateway could check open-access copies first, then recognized institutional subscriptions, then lawful interlibrary document delivery, and finally a transparent request for targeted purchase. The user should not need to know in advance which elite institution has the license.",
            "There are legitimate costs to serving unaffiliated learners. They should be made visible and budgeted, rather than hidden behind the expectation that every serious learner already belongs to a rich institution. The reform target is not identical library collections everywhere; it is a credible path from need to lawful access."
          ]
        },
        {
          "heading": "What equal opportunity can mean here",
          "paragraphs": [
            "We cannot erase differences in mentorship, laboratories, time, or research funding through a website. But we can ask for a narrower and more measurable outcome: does a motivated learner without a prestigious university account have a reasonable chance of obtaining the scholarly material their project needs?"
          ]
        }
      ]
    },
    "zh": {
      "title": "大学身份不等于研究能力",
      "description": "为什么阅读学术文献的机会，不应该仅由学校身份和机构采购决定。",
      "dek": "两个人可能在研究同一个严肃问题，却因为一张校园卡的差别，面对截然不同的文献访问权限。",
      "sections": [
        {
          "heading": "学校身份不是能力测试",
          "paragraphs": [
            "资源充足的大学学生，可能点击一次就能打开外文期刊；普通高校学生或毕业后的独立研究者，却可能看到按篇收费页面。造成差异的主要是授权合同与采购预算，并不必然反映两个人理解论文的能力差距。",
            "清华大学图书馆的电子资源规定明确禁止向校外人员提供取得的文献或转借个人账号。这是现实存在的权限边界，也意味着不能把共享校园账号当成合理解决方案。"
          ]
        },
        {
          "heading": "限制并不完全由学校决定",
          "paragraphs": [
            "高校购买的往往只是限定用户范围的使用许可，而不是数据库全部版权。学校想开放，也未必有权单方面扩大授权。因此出版商、联盟、政府资助者与学校都需要参与改革。",
            "也不能把所有研究数据混为一谈。包含个人信息、保密内容或受伦理限制的实验数据，需要独立的治理安排。可广泛授权阅读的论文，与不能随意公开的敏感数据并不是一回事。"
          ]
        },
        {
          "heading": "让跨校获取成为常规服务",
          "paragraphs": [
            "统一的公共学术入口可以先查询合法开放版本，再匹配已有机构授权，之后尝试合规馆际文献传递，仍无法满足时提供透明的按需采购申请。使用者不应该先认识某所名校的人，才知道如何获得一篇论文。",
            "服务校外研究者会产生真实成本，但这些成本应该被计算和安排，而不是隐含地要求严肃学习者必须属于资源丰富的高校。改革并不要求每所大学拥有完全一样的馆藏，而是为有实际需要的人建立可信赖的合法获取路径。"
          ]
        },
        {
          "heading": "什么才是这里的机会平等？",
          "paragraphs": [
            "一个文献平台无法抹平导师、实验设备、学习时间与科研经费的全部差异。但至少可以提出一个更具体的目标：没有名校身份的学习者，是否仍能以合理成本获取完成研究所必需的学术资料？"
          ]
        }
      ]
    },
    "sources": [
      {
        "label": "清华大学图书馆：电子资源知识产权公告",
        "url": "https://lib.tsinghua.edu.cn/info/1115/2623.htm"
      },
      {
        "label": "清华大学图书馆：CALIS 共享服务",
        "url": "https://lib.tsinghua.edu.cn/info/1019/7510.htm"
      }
    ]
  },
  {
    "slug": "you-cannot-search-for-a-course-you-dont-know-exists",
    "en": {
      "title": "You Cannot Search for a Course You Don't Know Exists",
      "description": "Why availability, discoverability, and usability are three separate dimensions of educational access.",
      "dek": "A course can be free, excellent, and available to everyone—and still remain invisible to the learner who most needs it.",
      "sections": [
        {
          "heading": "The hidden prerequisite to initiative",
          "paragraphs": [
            "MIT OpenCourseWare publishes learning materials from more than 2,500 MIT courses without charging for access. That is a major act of educational openness. But a student who has never heard of MIT OCW cannot be reasonably judged for failing to search its name.",
            "Telling a learner 'the material was online all along' treats prior knowledge of the resource as universal. In reality, teachers, families, peers, language, and search habits influence what people learn exists. Discovery is an educational opportunity in its own right."
          ]
        },
        {
          "heading": "Three distinct doors",
          "paragraphs": [
            "Availability means the resource is actually published. Discoverability means a learner can encounter it without already knowing the provider. Usability means its language, prerequisite level, structure, and exercises allow that learner to make progress. Passing the first test does not guarantee passing the next two.",
            "A university can publish thousands of courses and still ask independent learners to navigate unfamiliar subject names, course codes, prerequisites, and formats. Good catalog design, open search indexing, translations, and honest difficulty descriptions all matter."
          ]
        },
        {
          "heading": "Promotion is not advertising",
          "paragraphs": [
            "Schools and public learning platforms could recommend high-quality external courses by learning goals rather than by university prestige. A person asking to learn calculus should see suitable options, the knowledge required first, how complete the materials are, and what practice is available. A famous institution's logo is not a substitute for a fit assessment.",
            "This would also make educational opportunity less dependent on being lucky enough to meet the person who knows the right link. No platform can notify everyone of every resource; that does not absolve public education services of making valuable resources easy to find."
          ]
        },
        {
          "heading": "Test whether discovery actually improves",
          "paragraphs": [
            "Measure whether learners with different prior experience can find appropriate courses, how long it takes, whether they can identify prerequisites, and whether the recommendation leads to sustained, independent learning. Page views alone cannot answer that question."
          ]
        }
      ]
    },
    "zh": {
      "title": "你怎么搜索一门自己根本不知道存在的课程？",
      "description": "免费开放只是起点：优质教育资源还需要可发现、可理解、可使用。",
      "dek": "一门课程可以完全免费、质量优秀、面向所有人开放，却仍然没有出现在真正需要它的学生面前。",
      "sections": [
        {
          "heading": "主动学习之前，还有一个隐藏的前提",
          "paragraphs": [
            "MIT OpenCourseWare 免费提供超过2,500门 MIT 课程的相关教学材料，是教育开放的重要实践。但一个从未听说过 MIT OCW 的学生，不应该因为没有搜索过这个名字就被归咎于不够主动。",
            "“网上明明有，你为什么不去看？”这句话默认了每个人都提前知道资源的存在。事实上，教师介绍、家庭背景、同伴圈子、语言能力与检索习惯，都会影响一个人最终知道哪些学习机会。发现机会，本身就是教育机会的一部分。"
          ]
        },
        {
          "heading": "开放、发现、使用是三道不同的门",
          "paragraphs": [
            "资源开放，是课程确实已经发布；资源可发现，是不知道提供者名称的人也能找到它；资源可利用，则要求语言、难度、先修知识、结构和练习能支持这个人真正学习。第一道门打开，不意味着另外两道门也打开了。",
            "即使大学公开了数千门课程，自学者仍可能面对陌生的学科名称、课程编号、难度层级和内容格式。可靠的检索、翻译、先修要求说明、课程完整度标注，比一句“自己搜去”更有帮助。"
          ]
        },
        {
          "heading": "推广不等于广告",
          "paragraphs": [
            "学校和公共学习平台可以按学习目标推荐优质课程，而不是只按学校名气排列。想学微积分的人，应当看到适合自己基础的课程、需要先补的知识、有哪些练习，以及课程是否完整。名校标志不能代替适配性判断。",
            "这样也能减少教育机会对偶然关系的依赖：不必幸运地遇到一个知道正确链接的人，才发现原来可以免费学习。公共系统不可能介绍全世界所有课程，但应当认真承担优质资源可发现性的责任。"
          ]
        },
        {
          "heading": "推广是否有效，也需要验证",
          "paragraphs": [
            "可以比较不同学习经历的人找到适当课程所需的时间，能否理解先修要求，以及推荐是否最终带来了持续、独立的学习。仅仅统计网页访问量，无法说明教育机会真的改善。"
          ]
        }
      ]
    },
    "sources": [
      {
        "label": "MIT Open Learning：OpenCourseWare 项目",
        "url": "https://openlearning.mit.edu/courses-programs/mit-opencourseware"
      },
      {
        "label": "MIT OCW：Get Started",
        "url": "https://ocw.mit.edu/pages/get-started/"
      }
    ]
  },
  {
    "slug": "best-courses-plus-personalized-ai-help",
    "en": {
      "title": "The Best Course for This Learner, With AI Help Along the Way",
      "description": "A testable vision of future education: vetted courses, personalized tutoring, and independent evidence of learning.",
      "dek": "The future of AI education may be less about replacing every teacher with a model—and more about helping every learner reach the right material with the right support.",
      "sections": [
        {
          "heading": "Do not make the model reinvent the curriculum",
          "paragraphs": [
            "Human teachers, universities, textbook authors, and open-education projects have already produced remarkable explanations, assignments, experiments, and examples. An AI learning system should begin by discovering and evaluating this work, not assuming that its own generated explanation is automatically superior.",
            "The question is not 'What is the best calculus course?' in the abstract. It is 'Which sequence of lessons and exercises is best for this learner's current knowledge, goals, language, and time?' The answer may combine more than one course and may change as the learner makes progress."
          ]
        },
        {
          "heading": "Keep the course and the tutor distinct",
          "paragraphs": [
            "The course provides a coherent knowledge sequence, while a personal AI tutor interprets the learner's questions, detects possible misconceptions, adjusts explanations, and chooses useful practice. The tutor should know which lesson, diagram, or task it is supporting, and should cite that source rather than inventing curriculum authority.",
            "A learner preparing for an exam may need concept explanations and near-transfer practice. Another pursuing proofs may need formal argument and counterexamples. Personalization should be driven by evidence of knowledge and progress, not superficial changes to names or stories."
          ]
        },
        {
          "heading": "Answers are not the same as learning",
          "paragraphs": [
            "A 2025 PNAS field experiment in high-school mathematics found that unrestricted generative-AI help could improve assisted practice while reducing performance when AI was removed. The study also found that tutor-specific safeguards could mitigate this effect. These findings belong to a particular experiment; they are not a universal verdict on AI learning.",
            "We would therefore make independent checks part of the learning loop: diagnose prerequisites, recommend a lesson, support an attempt, reduce hints, verify a new problem without AI, and revisit later. The goal is not that the learner always needs a tutor. It is that the learner can eventually do more alone."
          ]
        },
        {
          "heading": "A research program, not an accomplished product",
          "paragraphs": [
            "For Teachometry, this is a direction to investigate, not a claim that the system already delivers optimal courses or proven long-term learning gains. TutorBench evaluates observable AI tutoring decisions; Recall and other learning-loop ideas could investigate memory, practice, and transfer, but these require separate empirical validation.",
            "The central outcome to measure is not how many questions AI answers or how many famous courses it recommends. It is whether people with different starting points can discover appropriate learning opportunities and gain durable understanding without becoming dependent on the AI."
          ]
        }
      ]
    },
    "zh": {
      "title": "适合这个人的好课程，加上恰到好处的 AI 辅导",
      "description": "以经过验证的优质课程为基础，通过 AI 个性化辅导与独立测验形成真正的学习闭环。",
      "dek": "未来 AI 教育的价值，也许不在于让模型重新讲授世界上每一门课程，而在于让每个人找到适合自己的优质内容，并获得恰当的学习支持。",
      "sections": [
        {
          "heading": "不要让模型重复发明全部课程",
          "paragraphs": [
            "人类教师、大学、教材作者和开放教育项目已经积累了大量优秀讲解、习题、实验与示例。AI 教育系统应当先去发现、评价和利用这些成果，而不是默认自己临时生成的解释一定更好。",
            "重要的问题也不是抽象地评选“全世界最好的微积分课”，而是判断：在这个学习者当前的知识、目标、语言和时间条件下，哪些课程片段与练习更适合他？答案可能来自不同教师，也应随着学习进展不断变化。"
          ]
        },
        {
          "heading": "让课程主线与 AI 导师各司其职",
          "paragraphs": [
            "课程负责提供连贯的知识结构，AI 导师则处理具体问题：理解学生困惑、识别可能的误解、调整解释方式、选择合适练习。它应当知道自己正在辅助哪节课、哪张图、哪道题，并能够回到原始资料，而不是凭空假装拥有课程权威。",
            "备考学生可能更需要概念辨析和变式题；研究数学证明的人可能更需要严谨推导与反例。真正的个性化应当根据知识状态和学习表现调整，而不是只把习题故事里的名字换成学生喜欢的角色。"
          ]
        },
        {
          "heading": "会回答，不代表真的学会",
          "paragraphs": [
            "2025年发表于《美国国家科学院院刊》（PNAS）的一项高中数学现场实验发现，无约束的生成式 AI 帮助可能提高有 AI 时的练习表现，却损害拿走 AI 后的独立表现；针对教学设计的保护措施可以缓解这种问题。它是特定实验的结果，不能被扩大为对所有 AI 教育产品的结论。",
            "因此，学习闭环应该包括：诊断先修知识、选择课程、支持尝试、逐步减少提示、用新题检验独立解答、隔一段时间再回顾。最终目标不是让学生永远离不开导师，而是让他能够独自完成越来越多的事情。"
          ]
        },
        {
          "heading": "这是一项研究计划，还不是已经实现的产品",
          "paragraphs": [
            "对 Teachometry 而言，这首先是值得验证的研究方向，并不意味着现有系统已经做到最优课程推荐或证明长期学习收益。TutorBench 目前评价的是可观察的 AI 教学行为；Recall 等学习闭环设想可以进一步探索记忆、练习和迁移，但都需要独立的实证检验。",
            "真正应该测量的，不是 AI 回答了多少问题，也不是推荐了多少门名校课，而是不同基础的人能否发现适合自己的学习机会，并形成持久、可独立运用的理解。"
          ]
        }
      ]
    },
    "sources": [
      {
        "label": "MIT OCW：免费教学资料",
        "url": "https://ocw.mit.edu/pages/get-started/"
      },
      {
        "label": "PNAS (2025)：Generative AI without guardrails can harm learning",
        "url": "https://doi.org/10.1073/pnas.2422633122"
      }
    ]
  }
];

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function pair(en: string, zh: string): string {
  return '<span class="en">' + esc(en) + '</span><span class="zh" lang="zh-CN">' + esc(zh) + '</span>';
}
function mainArticle(post: Article, index: number): string {
  const sections = post.en.sections.map((sec, i) => {
    const z = post.zh.sections[i];
    if (z === undefined || z.paragraphs.length !== sec.paragraphs.length) {
      throw new Error("Bilingual series mismatch: " + post.slug + " section " + i);
    }
    const paragraphs = sec.paragraphs.map((p, j) =>
      '<p class="en">' + esc(p) + '</p><p class="zh" lang="zh-CN">' + esc(z.paragraphs[j] ?? "") + '</p>').join("\n");
    return '<section><h2 id="section-' + (i + 1) + '"><span class="no">§' + (i + 1) + '</span><span>' + pair(sec.heading,z.heading) + '</span></h2>' + paragraphs + '</section>';
  }).join("\n");
  const sourceLinks = post.sources.map((s) =>
    '<li><a href="' + esc(s.url) + '" rel="noopener noreferrer">' + esc(s.label) + '</a></li>').join("");
  const neighbor = (p: Article | undefined, labelEn: string, labelZh: string) =>
    p ? '<a href="../' + esc(p.slug) + '/index.html" class="next"><span class="kicker">' + pair(labelEn,labelZh) + '</span><span class="t">' + pair(p.en.title,p.zh.title) + '</span></a>' : '<span></span>';
  return '<main id="main"><header class="essay-head"><div class="wrap essay-grid"><div>' +
    '<p class="essay-meta kicker"><a class="issue" href="../index.html">' + pair("Journal · Learning Access series","期刊 · 学习机会系列") +
    '</a><span class="rule" aria-hidden="true"></span><span>' + pair("Perspective","观点") + '</span><time datetime="' + PUBLISHED + '">' + pair("November 2, 2026","2026年11月2日") + '</time></p>' +
    '<h1 class="essay-title">' + pair(post.en.title,post.zh.title) + '</h1>' +
    '<p class="en essay-dek">' + esc(post.en.dek) + '</p><p class="zh essay-dek" lang="zh-CN">' + esc(post.zh.dek) + '</p>' +
    '<p class="essay-byline kicker">Teachometry <span>' + pair("Essay "+(index+1)+" of "+POSTS.length, "系列第"+(index+1)+"篇，共"+POSTS.length+"篇") + '</span></p></div>' +
    '<figure class="cover-plate" aria-label="Learning Access editorial typographic cover"><div style="min-height:22rem;display:flex;flex-direction:column;justify-content:space-between;gap:5rem;padding:2rem;background:linear-gradient(145deg,#e8eee9,#c9d8e7 55%,#eee7d9);border:1px solid #d0d4d4;color:#263a46"><span style="font-size:.75rem;letter-spacing:.12em">TEACHOMETRY · LEARNING ACCESS</span><strong style="font-size:clamp(3rem,6vw,5.5rem);line-height:1;font-weight:400;font-family:serif">0'+(index+1)+'</strong><span>' + pair("Open knowledge needs an open path.","知识开放，也需要可抵达的道路。") + '</span></div><figcaption class="kicker">' + pair("Series · Access, discovery, learning","系列 · 获取、发现与学习") + '</figcaption></figure></div></header>' +
    '<div class="wrap essay-body"><nav class="essay-toc" aria-label="On this page"><p class="kicker">'+pair("On this page","本文目录")+'</p><ol>'+
    post.en.sections.map((s,i)=>'<li><a href="#section-'+(i+1)+'">'+pair(s.heading,post.zh.sections[i]?.heading??"")+'</a></li>').join("")+
    '</ol></nav><article class="essay-text"><div class="prose">' + sections +
    '<aside class="callout boundary"><p class="kicker">'+pair("Evidence boundary","证据边界")+'</p><h3>'+pair("A perspective, not a measured result.","这是观点，不是已验证的评测结果。")+'</h3><p class="en">This essay proposes directions for education policy and product design. It is not a TutorBench result, a finding of wrongdoing, or proof of learning impact.</p><p class="zh" lang="zh-CN">本文讨论教育政策和产品设计方向，不是 TutorBench 的评测结果，也不构成对任何机构违法行为的认定或对学习成效的实证证明。</p></aside>' +
    '<section><h2 id="sources">'+pair("Sources and further reading","资料来源与延伸阅读")+'</h2><ol>'+sourceLinks+'</ol></section></div></article></div>' +
    '<nav class="wrap essay-nav" aria-label="Article navigation">' + neighbor(POSTS[index-1],"Previous in series","上一篇") +
    '<a class="all kicker" href="../index.html">'+pair("Back to all essays","返回全部文章")+'</a>' + neighbor(POSTS[index+1],"Next in series","下一篇") + '</nav></main>';
}
function rewriteMetadata(html: string, post: Article, zh: boolean, url: string): string {
  const copy = zh ? post.zh : post.en;
  const description = esc(copy.description);
  const title = esc(copy.title + " · Teachometry Journal");
  return html
    .replace(/<title>[\s\S]*?<\/title>/u, "<title>" + title + "</title>")
    .replace(/<meta name="description" content="[^"]*">/u, '<meta name="description" content="' + description + '">')
    .replace(/<link rel="canonical" href="[^"]*">/u, '<link rel="canonical" href="' + esc(url) + '">')
    .replace(/<meta property="og:title" content="[^"]*">/u, '<meta property="og:title" content="' + title + '">')
    .replace(/<meta property="og:description" content="[^"]*">/u, '<meta property="og:description" content="' + description + '">')
    .replace(/<meta property="og:url" content="[^"]*">/u, '<meta property="og:url" content="' + esc(url) + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/u, '<meta name="twitter:title" content="' + title + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/u, '<meta name="twitter:description" content="' + description + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gu, "")
    .replace(/<meta property="article:published_time" content="[^"]*">/u, '<meta property="article:published_time" content="'+PUBLISHED+'">');
}
function seriesContents(): string {
  return '<section class="wrap jx-premise" aria-labelledby="learning-access-series"><div><p class="kicker">' +
    pair("New series · November 2026","新系列 · 2026年11月") + '</p><h2 class="jx-h2" id="learning-access-series">' +
    pair("Who gets to learn?","谁有机会获得知识？") + '</h2><p class="jx-p">' +
    pair("Five connected essays on public exam papers, scholarly literature, course discovery, and AI-supported learning.","五篇相互关联的随笔：公共考试真题、学术文献、课程发现与 AI 辅助学习。") +
    '</p></div><div><ol style="list-style:decimal;padding-left:1.5rem;line-height:1.9">' +
    POSTS.map((p) => '<li><a href="'+esc(p.slug)+'/index.html">'+pair(p.en.title,p.zh.title)+'</a></li>').join("") +
    '</ol></div></section>';
}
function updateSitemap(sitemap: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/u,"");
  const entries = POSTS.flatMap((p) => ["", "zh-cn/"].map((locale) => {
    const url = base + "/" + locale + "blog/" + p.slug + "/";
    const en = base + "/blog/" + p.slug + "/";
    const zh = base + "/zh-cn/blog/" + p.slug + "/";
    return '<url><loc>'+esc(url)+'</loc><xhtml:link rel="alternate" hreflang="en" href="'+esc(en)+'"/><xhtml:link rel="alternate" hreflang="zh-CN" href="'+esc(zh)+'"/><xhtml:link rel="alternate" hreflang="x-default" href="'+esc(en)+'"/></url>';
  })).join("\n");
  return sitemap.replace("</urlset>",entries+"\n</urlset>");
}
export async function publishLearningAccessSeries(options: PublishOptions): Promise<void> {
  const site = options.siteUrl?.replace(/\/$/u,"") ?? "";
  for (const locale of ["", "zh-cn/"]) {
    const root = join(options.outputDirectory, locale);
    const template = await readFile(join(root,"blog/why-teaching-does-not-scale/index.html"),"utf8");
    const indexPath = join(root,"blog/index.html");
    const index = await readFile(indexPath,"utf8");
    if (!index.includes('class="jx-premise"')) throw new Error("Journal index structure changed");
    const updated = index.replace('<section class="wrap jx-premise"', seriesContents() + '\n<section class="wrap jx-premise"')
      .replaceAll("4 essays","9 essays").replaceAll("4 篇文章","9 篇文章");
    await writeFile(indexPath, updated,"utf8");
    for (const [i,post] of POSTS.entries()) {
      const dest = join(root,"blog",post.slug,"index.html");
      await mkdir(join(root,"blog",post.slug),{recursive:true});
      const url = site ? site + "/" + locale + "blog/" + post.slug + "/" : "/" + locale + "blog/" + post.slug + "/";
      const changed = rewriteMetadata(template.replace(/<main id="main">[\s\S]*?<\/main>/u, mainArticle(post,i)),post,locale !== "",url);
      if (!changed.includes(post.en.title) || !changed.includes("sources")) throw new Error("Article render failed: "+post.slug);
      await writeFile(dest, changed, "utf8");
    }
  }
  if (site) {
    const sitemap = join(options.outputDirectory,"sitemap.xml");
    await writeFile(sitemap,updateSitemap(await readFile(sitemap,"utf8"),site),"utf8");
  }
}
