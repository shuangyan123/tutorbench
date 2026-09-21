export const SITE_LOCALES = ["en", "zh-CN"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const DEFAULT_SITE_LOCALE = "en" as const;

export type SiteUiTextKey =
  | "leaderboard"
  | "data"
  | "run"
  | "methodology"
  | "docs"
  | "case"
  | "runLabel"
  | "studentInput"
  | "conversationContext"
  | "evaluationCriteria"
  | "tutorResponse"
  | "originalTutorResponse"
  | "judgeResult"
  | "pass"
  | "partial"
  | "fail"
  | "error"
  | "correctness"
  | "diagnosis"
  | "guidance"
  | "adaptation"
  | "actionability"
  | "criticalFailure"
  | "answerLeakage"
  | "score"
  | "reason"
  | "evidence"
  | "missing"
  | "notAvailable"
  | "preliminary"
  | "calibration"
  | "coverage"
  | "caseId"
  | "caseVersion"
  | "dataset"
  | "datasetVersion"
  | "category"
  | "capability"
  | "targetLocale"
  | "studentMessage"
  | "problemContext"
  | "learningObjective"
  | "history"
  | "noConversationHistory"
  | "noEvaluationCriteria"
  | "noJudgeResult"
  | "noTutorResponse"
  | "actualGeneratedText"
  | "rawText"
  | "evaluatorDiagnostic"
  | "insufficientInformation"
  | "judgeRawResult"
  | "language"
  | "chinese"
  | "english"
  | "selectLanguage"
  | "backToAudit"
  | "auditRun"
  | "auditCases"
  | "status"
  | "model"
  | "provider"
  | "prompt"
  | "promptVersion"
  | "generationSpec"
  | "evaluatorVersion"
  | "noCriticalFailures"
  | "noAnswerLeakage"
  | "privateAudit"
  | "corpus"
  | "qualityGate"
  | "latency"
  | "tokenUsage"
  | "cost"
  | "attempts"
  | "judge"
  | "metrics"
  | "caseLocale"
  | "allLocales"
  | "localeEnglish"
  | "localeChinese"
  | "resetFilters"
  | "showingCases"
  | "localeBreakdown"
  | "crossLocaleGroup"
  | "studentProfile"
  | "knownConcepts"
  | "misconceptions"
  | "level"
  | "goal"
  | "reviewTranslation"
  | "reviewTranslationOnly"
  | "viewOriginal"
  | "translationUnavailable"
  | "translationStale"
  | "translationFailed"
  | "community"
  | "communityPageTitle"
  | "communityMetaDescription"
  | "communityHeroTitle"
  | "communityHeroTitleAccent"
  | "communityHeroDescription"
  | "communityParticipationClosed"
  | "communityHeroStatusDetail"
  | "communityHeroPrimary"
  | "communityHeroSecondary"
  | "communityFutureTaskLabel"
  | "communityEcosystemCenter"
  | "communityEcosystemSubline"
  | "communityEcosystemRead"
  | "communityEcosystemJudge"
  | "communityEcosystemSubmit"
  | "communityEcosystemQualify"
  | "communityEcosystemNoteOne"
  | "communityEcosystemNoteTwo"
  | "communityWhyEyebrow"
  | "communityWhyTitle"
  | "communityWhyCopy"
  | "communityWhyEvidence"
  | "communityWhyDifficulty"
  | "communityWhyNextStep"
  | "communityWhyContext"
  | "communityWhyTutor"
  | "communityWhatEyebrow"
  | "communityWhatTitle"
  | "communityWhatCopy"
  | "communityTaskRead"
  | "communityTaskJudge"
  | "communityTaskSubmit"
  | "communityTaskQualify"
  | "communityApplicationEyebrow"
  | "communityApplicationContractLabel"
  | "communityApplicationTitle"
  | "communityApplicationCopy"
  | "communityApplicationClosedNotice"
  | "communityApplicationContact"
  | "communityApplicationLocale"
  | "communityApplicationMotivation"
  | "communityApplicationExperience"
  | "communityApplicationAvailability"
  | "communityHowEyebrow"
  | "communityHowTitle"
  | "communityHowCopy"
  | "communityStepApplication"
  | "communityStepManualReview"
  | "communityStepInvitation"
  | "communityStepConsent"
  | "communityStepQualification"
  | "communityStepBlindReview"
  | "communityStepApplicationNote"
  | "communityStepManualReviewNote"
  | "communityStepInvitationNote"
  | "communityStepConsentNote"
  | "communityStepQualificationNote"
  | "communityStepBlindReviewNote"
  | "communityStatusEyebrow"
  | "communityStatusTitle"
  | "communityStatusCopy"
  | "communityStatusInfo"
  | "communityStatusInfoValue"
  | "communityStatusIntake"
  | "communityStatusIntakeValue"
  | "communityStatusCampaign"
  | "communityStatusCampaignValue"
  | "communityStatusCalibration"
  | "communityStatusCalibrationValue"
  | "communityEvidenceEyebrow"
  | "communityEvidenceTitle"
  | "communityEvidenceCopy"
  | "communityEvidenceFirst"
  | "communityEvidenceFirstCopy"
  | "communityEvidenceAgreement"
  | "communityEvidenceAgreementCopy"
  | "communityEvidenceQualification"
  | "communityEvidenceQualificationCopy"
  | "communityEvidenceGold"
  | "communityEvidenceGoldCopy"
  | "communityPrinciplesEyebrow"
  | "communityPrinciplesTitle"
  | "communityPrinciplesCopy"
  | "communityPrincipleEvidence"
  | "communityPrincipleEvidenceCopy"
  | "communityPrincipleMethods"
  | "communityPrincipleMethodsCopy"
  | "communityPrincipleContext"
  | "communityPrincipleContextCopy"
  | "communityPrinciplePerspectives"
  | "communityPrinciplePerspectivesCopy"
  | "communityAvailableEyebrow"
  | "communityAvailableTitle"
  | "communityAvailableCopy"
  | "communityAvailableCases"
  | "communityAvailableCasesCopy"
  | "communityAvailableMethodology"
  | "communityAvailableMethodologyCopy"
  | "communityAvailableBenchmark"
  | "communityAvailableBenchmarkCopy"
  | "communityAvailableRepository"
  | "communityAvailableRepositoryCopy"
  | "communityAvailableStatus"
  | "communityNotOpenEyebrow"
  | "communityNotOpenTitle"
  | "communityNotOpenCopy"
  | "communityNotOpenApplications"
  | "communityNotOpenApplicationsCopy"
  | "communityNotOpenCampaign"
  | "communityNotOpenCampaignCopy"
  | "communityNotOpenCalibration"
  | "communityNotOpenCalibrationCopy"
  | "communityWatchEyebrow"
  | "communityWatchTitle"
  | "communityWatchCopy"
  | "communityWatchHomepage"
  | "communityWatchCases"
  | "communityWatchMethodology"
  | "communityWatchGitHub";

const translations: Record<SiteLocale, Record<SiteUiTextKey, string>> = {
  en: {
    leaderboard: "Leaderboard",
    data: "Data",
    run: "Run",
    methodology: "Methodology",
    docs: "Docs",
    case: "Case",
    runLabel: "Run",
    studentInput: "Student input",
    conversationContext: "Conversation context",
    evaluationCriteria: "Evaluation criteria",
    tutorResponse: "Tutor response",
    originalTutorResponse: "Original Tutor response",
    judgeResult: "Judge result",
    pass: "Pass",
    partial: "Partial",
    fail: "Fail",
    error: "Error",
    correctness: "Correctness",
    diagnosis: "Diagnosis",
    guidance: "Guidance",
    adaptation: "Adaptation",
    actionability: "Actionability",
    criticalFailure: "Critical failure",
    answerLeakage: "Answer leakage",
    score: "Score",
    reason: "Reason",
    evidence: "Evidence",
    missing: "Missing",
    notAvailable: "Not available",
    preliminary: "Preliminary",
    calibration: "Calibration",
    coverage: "Coverage",
    caseId: "Case ID",
    caseVersion: "Case version",
    dataset: "Dataset",
    datasetVersion: "Dataset version",
    category: "Category",
    capability: "Capability",
    targetLocale: "Target locale",
    studentMessage: "Student message",
    problemContext: "Problem context",
    learningObjective: "Learning objective",
    history: "Conversation history",
    noConversationHistory: "No prior conversation.",
    noEvaluationCriteria: "No rubric or evaluation criteria were stored for this case.",
    noJudgeResult: "No Judge result was stored for this run.",
    noTutorResponse: "No Tutor response was stored for this run.",
    actualGeneratedText: "Actual model-generated text",
    rawText: "Raw text",
    evaluatorDiagnostic: "Evaluator diagnostic",
    insufficientInformation: "Insufficient information",
    judgeRawResult: "Judge raw result",
    language: "Language",
    chinese: "中文",
    english: "English",
    selectLanguage: "Select interface language",
    backToAudit: "Back to audit run",
    auditRun: "Audit run",
    auditCases: "Audit cases",
    status: "Status",
    model: "Model",
    provider: "Provider",
    prompt: "Prompt",
    promptVersion: "Prompt version",
    generationSpec: "Generation spec",
    evaluatorVersion: "Evaluator version",
    noCriticalFailures: "No critical failures recorded.",
    noAnswerLeakage: "No answer leakage recorded.",
    privateAudit: "Private audit",
    corpus: "Corpus",
    qualityGate: "Quality gate",
    latency: "Latency",
    tokenUsage: "Token usage",
    cost: "Cost",
    attempts: "Attempts",
    judge: "Judge",
    metrics: "Metrics",
    caseLocale: "Case locale",
    allLocales: "All",
    localeEnglish: "English-language context",
    localeChinese: "Chinese-language context",
    resetFilters: "Reset filters",
    showingCases: "Showing {count} cases",
    localeBreakdown: "Language-context breakdown",
    crossLocaleGroup: "Construct cohort group",
    studentProfile: "Student profile",
    knownConcepts: "Known concepts",
    misconceptions: "Misconceptions",
    level: "Level",
    goal: "Goal",
    reviewTranslation: "Review translation",
    reviewTranslationOnly: "Review translation only — not used for evaluation.",
    viewOriginal: "View original",
    translationUnavailable: "No Chinese review translation is available.",
    translationStale: "This Chinese review translation is out of date.",
    translationFailed: "The Chinese review translation is unavailable for this field.",
    community: "Community",
    communityPageTitle: "Community — Teachometry",
    communityMetaDescription: "Learn why future structured human review may help validate Teachometry's evaluation method. Applications are not open yet.",
    communityHeroTitle: "A stronger evaluation system",
    communityHeroTitleAccent: "is a shared effort.",
    communityHeroDescription: "Teachometry is building an open benchmark for observable AI tutoring behavior. Some judgments cannot be validated reliably through deterministic checks or an LLM Judge alone, so future structured human review is part of the research program.",
    communityParticipationClosed: "Applications not open yet",
    communityHeroStatusDetail: "Future participation would initially be invite-only.",
    communityHeroPrimary: "Explore how participation will work",
    communityHeroSecondary: "Read the methodology",
    communityFutureTaskLabel: "Future task · not an open role",
    communityEcosystemCenter: "Structured human review",
    communityEcosystemSubline: "Evidence relationship",
    communityEcosystemRead: "Read",
    communityEcosystemJudge: "Judge",
    communityEcosystemSubmit: "Submit",
    communityEcosystemQualify: "Qualify",
    communityEcosystemNoteOne: "Different perspectives.",
    communityEcosystemNoteTwo: "Stronger evidence.",
    communityWhyEyebrow: "Why human review",
    communityWhyTitle: "Teaching quality is more than a correct answer.",
    communityWhyCopy: "TutorBench evaluates whether a Tutor identifies the learner's difficulty, provides a useful next step, adapts to learner state and context, and behaves appropriately as a Tutor. Some of that work depends on context and judgment.",
    communityWhyEvidence: "Deterministic evaluators and an LLM Judge alone cannot establish every aspect reliably. Human review is a future evidence source — not automatic ground truth.",
    communityWhyDifficulty: "Identifies the learner's difficulty",
    communityWhyNextStep: "Provides a useful next step",
    communityWhyContext: "Adapts to learner state and context",
    communityWhyTutor: "Behaves appropriately as a Tutor",
    communityWhatEyebrow: "Future reviewer tasks",
    communityWhatTitle: "A clear process for each review.",
    communityWhatCopy: "If the program opens, reviewers would work from the same visible task, criteria, and submission contract. These are future tasks, not current openings.",
    communityTaskRead: "Read an AI Tutor response and the evaluation task",
    communityTaskJudge: "Judge the response using the provided criteria",
    communityTaskSubmit: "Submit a structured review",
    communityTaskQualify: "Complete a short qualification step before reviewing real assignments",
    communityApplicationEyebrow: "Future application contract",
    communityApplicationContractLabel: "Future contract",
    communityApplicationTitle: "What we expect to ask when applications open",
    communityApplicationCopy: "The first application contract is intentionally small: one contact email, a preferred review language, a short motivation, optional relevant experience, and a coarse availability category.",
    communityApplicationClosedNotice: "Applications are not open yet. This section describes a future contract, not a form.",
    communityApplicationContact: "One contact email for a future invitation",
    communityApplicationLocale: "Preferred review language",
    communityApplicationMotivation: "A short motivation for participating",
    communityApplicationExperience: "Optional relevant experience summary",
    communityApplicationAvailability: "Approximate availability category",
    communityHowEyebrow: "How participation could work",
    communityHowTitle: "From application to blind review.",
    communityHowCopy: "Participation would initially be invite-only. Submitting an application in the future would not automatically create a reviewer account.",
    communityStepApplication: "Application",
    communityStepManualReview: "Manual review",
    communityStepInvitation: "Invitation",
    communityStepConsent: "Consent",
    communityStepQualification: "Qualification",
    communityStepBlindReview: "Blind review",
    communityStepApplicationNote: "Share the future application fields.",
    communityStepManualReviewNote: "A manual eligibility and fit review.",
    communityStepInvitationNote: "An invite-only next step.",
    communityStepConsentNote: "Confirm the review boundaries.",
    communityStepQualificationNote: "Complete the eligibility gate.",
    communityStepBlindReviewNote: "Review real assignments blind.",
    communityStatusEyebrow: "Current status",
    communityStatusTitle: "Available now. Not open yet.",
    communityStatusCopy: "Public information is open. Applications, reviewer intake, the real Community Review campaign, and P5 human calibration are not open or not started.",
    communityStatusInfo: "Public information",
    communityStatusInfoValue: "Open",
    communityStatusIntake: "Applications and reviewer intake",
    communityStatusIntakeValue: "Not open",
    communityStatusCampaign: "Real Community Review campaign",
    communityStatusCampaignValue: "Not started",
    communityStatusCalibration: "P5 human calibration",
    communityStatusCalibrationValue: "Not started",
    communityEvidenceEyebrow: "Evidence boundary",
    communityEvidenceTitle: "Human review adds evidence. It does not create ground truth.",
    communityEvidenceCopy: "Early Community Review would help improve and validate the evaluation method. Each distinction keeps future human evidence proportionate to what it can actually show.",
    communityEvidenceFirst: "Evidence first",
    communityEvidenceFirstCopy: "Human judgments become structured evidence tied to visible tasks and criteria.",
    communityEvidenceAgreement: "Agreement ≠ correctness",
    communityEvidenceAgreementCopy: "Inter-reviewer agreement can indicate consistency; agreement alone does not prove a judgment is correct.",
    communityEvidenceQualification: "Qualification ≠ calibration",
    communityEvidenceQualificationCopy: "Passing qualification determines eligibility to review; it does not establish calibrated human-reference performance.",
    communityEvidenceGold: "Human review ≠ gold standard",
    communityEvidenceGoldCopy: "Early Community Review is a method-validation input, not an automatic Human Reference or ground truth.",
    communityPrinciplesEyebrow: "Shared principles",
    communityPrinciplesTitle: "A healthier research culture for AI tutoring.",
    communityPrinciplesCopy: "Observable evidence, transparent methods, context, and multiple perspectives keep claims proportionate.",
    communityPrincipleEvidence: "Evidence before claims",
    communityPrincipleEvidenceCopy: "Observable evidence comes before conclusions.",
    communityPrincipleMethods: "Transparent methods",
    communityPrincipleMethodsCopy: "Tasks, rubrics, and evaluation procedures should remain inspectable.",
    communityPrincipleContext: "Context matters",
    communityPrincipleContextCopy: "Tutoring judgments depend on learner state and instructional context.",
    communityPrinciplePerspectives: "Multiple perspectives",
    communityPrinciplePerspectivesCopy: "Human review can expose blind spots without being treated as infallible.",
    communityAvailableEyebrow: "Available now",
    communityAvailableTitle: "Explore the public work.",
    communityAvailableCopy: "The benchmark, cases, methodology, repository, and project updates are available to inspect today.",
    communityAvailableCases: "Browse benchmark cases",
    communityAvailableCasesCopy: "Inspect public cases and their authored context.",
    communityAvailableMethodology: "Read Methodology",
    communityAvailableMethodologyCopy: "See what the benchmark measures and does not measure.",
    communityAvailableBenchmark: "Explore the benchmark",
    communityAvailableBenchmarkCopy: "Review public artifacts and coverage boundaries.",
    communityAvailableRepository: "View GitHub repository",
    communityAvailableRepositoryCopy: "Inspect the source, contracts, and roadmap.",
    communityAvailableStatus: "Available",
    communityNotOpenEyebrow: "Not open yet",
    communityNotOpenTitle: "Research participation remains closed.",
    communityNotOpenCopy: "No public intake or live reviewer program is running. No dates are promised.",
    communityNotOpenApplications: "Reviewer applications",
    communityNotOpenApplicationsCopy: "Public intake is not open.",
    communityNotOpenCampaign: "Real Community Review campaign",
    communityNotOpenCampaignCopy: "Not started.",
    communityNotOpenCalibration: "P5 human calibration",
    communityNotOpenCalibrationCopy: "Not started.",
    communityWatchEyebrow: "Follow the work",
    communityWatchTitle: "Be part of what comes next.",
    communityWatchCopy: "Applications are not open yet. Follow the project for future Community Review announcements and inspect the public benchmark in the meantime. This page has no application form, waitlist, or reviewer login.",
    communityWatchHomepage: "Explore the benchmark",
    communityWatchCases: "Browse benchmark cases",
    communityWatchMethodology: "Read methodology",
    communityWatchGitHub: "Follow the repository on GitHub ↗",
  },
  "zh-CN": {
    leaderboard: "排行榜",
    data: "数据",
    run: "运行",
    methodology: "方法论",
    docs: "文档",
    case: "案例",
    runLabel: "运行",
    studentInput: "学生输入",
    conversationContext: "对话上下文",
    evaluationCriteria: "评价要求",
    tutorResponse: "Tutor 回复",
    originalTutorResponse: "Tutor 原始回复",
    judgeResult: "Judge 结论",
    pass: "通过",
    partial: "部分通过",
    fail: "失败",
    error: "错误",
    correctness: "正确性",
    diagnosis: "诊断能力",
    guidance: "引导能力",
    adaptation: "适应能力",
    actionability: "可执行性",
    criticalFailure: "严重失败",
    answerLeakage: "答案泄露",
    score: "分数",
    reason: "理由",
    evidence: "证据",
    missing: "缺失",
    notAvailable: "不可用",
    preliminary: "初步结果",
    calibration: "校准",
    coverage: "覆盖情况",
    caseId: "案例 ID",
    caseVersion: "案例版本",
    dataset: "数据集",
    datasetVersion: "数据集版本",
    category: "类别",
    capability: "能力标签",
    targetLocale: "目标语言区域",
    studentMessage: "学生消息",
    problemContext: "题目上下文",
    learningObjective: "学习目标",
    history: "对话历史",
    noConversationHistory: "没有此前对话。",
    noEvaluationCriteria: "此案例没有保存 rubric 或评价要求。",
    noJudgeResult: "此运行没有保存 Judge 结论。",
    noTutorResponse: "此运行没有保存 Tutor 回复。",
    actualGeneratedText: "模型实际生成的文本",
    rawText: "原始文本",
    evaluatorDiagnostic: "Evaluator 诊断",
    insufficientInformation: "信息不足",
    judgeRawResult: "Judge 原始结果",
    language: "界面语言",
    chinese: "中文",
    english: "English",
    selectLanguage: "选择界面语言",
    backToAudit: "返回审计运行",
    auditRun: "审计运行",
    auditCases: "审计案例",
    status: "状态",
    model: "模型",
    provider: "Provider",
    prompt: "Prompt",
    promptVersion: "Prompt 版本",
    generationSpec: "生成规格",
    evaluatorVersion: "Evaluator 版本",
    noCriticalFailures: "没有记录严重失败。",
    noAnswerLeakage: "没有记录答案泄露。",
    privateAudit: "私有审计",
    corpus: "Corpus",
    qualityGate: "质量门",
    latency: "延迟",
    tokenUsage: "Token 用量",
    cost: "成本",
    attempts: "尝试次数",
    judge: "Judge",
    metrics: "运行指标",
    caseLocale: "案例语言",
    allLocales: "全部",
    localeEnglish: "英文语境",
    localeChinese: "中文语境",
    resetFilters: "重置筛选",
    showingCases: "显示 {count} 个案例",
    localeBreakdown: "按教学语境分组",
    crossLocaleGroup: "构念分组",
    studentProfile: "学生画像",
    knownConcepts: "已知概念",
    misconceptions: "常见误解",
    level: "水平",
    goal: "目标",
    reviewTranslation: "中文辅助翻译",
    reviewTranslationOnly: "辅助翻译，仅供人工阅读，不参与评测。",
    viewOriginal: "查看原文",
    translationUnavailable: "暂无中文辅助翻译。",
    translationStale: "辅助翻译已过期。",
    translationFailed: "此字段的中文辅助翻译不可用。",
    community: "社区",
    communityPageTitle: "社区 — Teachometry",
    communityMetaDescription: "了解未来的结构化人工评审为什么可能帮助验证 Teachometry 的评测方法。当前暂未开放参与申请。",
    communityHeroTitle: "更强的评测系统",
    communityHeroTitleAccent: "需要共同完成。",
    communityHeroDescription: "Teachometry 正在构建一个面向可观察 AI 教学行为的开放 benchmark。有些判断无法仅靠确定性检查或 LLM Judge 可靠验证，因此未来的结构化人工评审会成为研究计划中的一种证据来源。",
    communityParticipationClosed: "参与申请暂未开放",
    communityHeroStatusDetail: "未来参与初期将采用受邀制。",
    communityHeroPrimary: "了解未来参与方式",
    communityHeroSecondary: "阅读方法论",
    communityFutureTaskLabel: "未来任务 · 不是开放岗位",
    communityEcosystemCenter: "结构化人工评审",
    communityEcosystemSubline: "证据关系",
    communityEcosystemRead: "阅读",
    communityEcosystemJudge: "判断",
    communityEcosystemSubmit: "提交",
    communityEcosystemQualify: "资格验证",
    communityEcosystemNoteOne: "不同视角，",
    communityEcosystemNoteTwo: "更有力的证据。",
    communityWhyEyebrow: "为什么需要人工评审",
    communityWhyTitle: "教学质量不只是答案是否正确。",
    communityWhyCopy: "TutorBench 评估 Tutor 是否识别学生的困难、提供合适的下一步、根据学生状态和语境调整帮助，并以合适的方式完成 Tutor 的工作。其中一些行为依赖语境和判断。",
    communityWhyEvidence: "确定性评估器和单独的 LLM Judge 无法可靠建立全部这些判断。人工评审会是未来的一种证据来源，而不是自动产生的 ground truth。",
    communityWhyDifficulty: "识别学生的困难",
    communityWhyNextStep: "提供合适的下一步",
    communityWhyContext: "根据学生状态和语境调整",
    communityWhyTutor: "以合适的方式完成 Tutor 的工作",
    communityWhatEyebrow: "未来评审任务",
    communityWhatTitle: "每次评审都遵循清晰的流程。",
    communityWhatCopy: "如果项目开放，参与者会根据同一份可见任务、评审标准和提交契约工作。这些是未来任务，不是当前招聘或开放岗位。",
    communityTaskRead: "阅读 AI Tutor 的回答和评审任务",
    communityTaskJudge: "按提供的标准进行判断",
    communityTaskSubmit: "提交结构化评审",
    communityTaskQualify: "在评审真实任务前完成简短的资格验证",
    communityApplicationEyebrow: "未来申请契约",
    communityApplicationContractLabel: "未来契约",
    communityApplicationTitle: "开放申请后预计会询问什么",
    communityApplicationCopy: "首版申请合同会刻意保持最小：一个用于未来邀请的联系邮箱、偏好的评审语言、简短动机、可选的相关经验，以及粗粒度的可用程度。",
    communityApplicationClosedNotice: "当前尚未开放申请。本节说明未来合同，不是申请表。",
    communityApplicationContact: "用于未来邀请的一个联系邮箱",
    communityApplicationLocale: "偏好的评审语言",
    communityApplicationMotivation: "参与原因的简短说明",
    communityApplicationExperience: "可选的相关经验概述",
    communityApplicationAvailability: "粗粒度的可用程度",
    communityHowEyebrow: "未来参与方式",
    communityHowTitle: "从申请到盲评任务。",
    communityHowCopy: "初期参与将采用受邀制。未来提交申请不会自动创建 reviewer 账号。",
    communityStepApplication: "提交申请",
    communityStepManualReview: "人工审核",
    communityStepInvitation: "收到邀请",
    communityStepConsent: "阅读并确认参与说明",
    communityStepQualification: "资格验证",
    communityStepBlindReview: "盲评任务",
    communityStepApplicationNote: "填写未来申请字段。",
    communityStepManualReviewNote: "进行人工资格与匹配审核。",
    communityStepInvitationNote: "进入受邀制的下一步。",
    communityStepConsentNote: "确认评审边界与参与说明。",
    communityStepQualificationNote: "完成参与资格门槛。",
    communityStepBlindReviewNote: "对真实任务进行盲评。",
    communityStatusEyebrow: "当前状态",
    communityStatusTitle: "现在可了解，参与尚未开放。",
    communityStatusCopy: "公开信息已经开放；参与申请、reviewer intake、真实 Community Review 和 P5 人工校准目前尚未开放或尚未开始。",
    communityStatusInfo: "公开参与说明",
    communityStatusInfoValue: "已开放",
    communityStatusIntake: "参与申请与 reviewer intake",
    communityStatusIntakeValue: "尚未开放",
    communityStatusCampaign: "真实 Community Review",
    communityStatusCampaignValue: "尚未启动",
    communityStatusCalibration: "P5 人工校准",
    communityStatusCalibrationValue: "尚未开始",
    communityEvidenceEyebrow: "证据边界",
    communityEvidenceTitle: "人工评审增加证据，但不会创造 ground truth。",
    communityEvidenceCopy: "早期 Community Review 会用于改进和验证评测方法。明确这些边界，才能让未来的人类证据与它实际能够说明的内容保持一致。",
    communityEvidenceFirst: "证据先于结论",
    communityEvidenceFirstCopy: "人工判断会成为与可见任务和标准绑定的结构化证据。",
    communityEvidenceAgreement: "一致性 ≠ 正确性",
    communityEvidenceAgreementCopy: "评审者之间的一致性可以说明稳定程度，但一致性本身不能证明判断正确。",
    communityEvidenceQualification: "资格验证 ≠ 校准",
    communityEvidenceQualificationCopy: "通过资格验证只说明具备参与评审的条件，不等于建立了校准的人类参考表现。",
    communityEvidenceGold: "人工评审 ≠ 金标准",
    communityEvidenceGoldCopy: "早期 Community Review 是验证方法的输入，不会自动成为 Human Reference 或 ground truth。",
    communityPrinciplesEyebrow: "共同原则",
    communityPrinciplesTitle: "为 AI 教学建立更健康的研究文化。",
    communityPrinciplesCopy: "可观察证据、透明方法、语境和多元视角，让研究结论保持与证据相称。",
    communityPrincipleEvidence: "证据先于主张",
    communityPrincipleEvidenceCopy: "先有可观察证据，再形成结论。",
    communityPrincipleMethods: "方法保持透明",
    communityPrincipleMethodsCopy: "任务、rubric 和评测流程应当保持可检查。",
    communityPrincipleContext: "语境很重要",
    communityPrincipleContextCopy: "教学判断依赖学生状态和教学语境。",
    communityPrinciplePerspectives: "保留多种视角",
    communityPrinciplePerspectivesCopy: "人工评审可以暴露自动化评测的盲点，但不应被视为绝对正确。",
    communityAvailableEyebrow: "现在可做",
    communityAvailableTitle: "先了解公开工作。",
    communityAvailableCopy: "benchmark、案例、方法论、代码仓库和项目更新目前都可以公开查看。",
    communityAvailableCases: "浏览 benchmark 案例",
    communityAvailableCasesCopy: "查看公开案例及其作者提供的语境。",
    communityAvailableMethodology: "阅读方法论",
    communityAvailableMethodologyCopy: "了解当前 benchmark 测量什么、不测量什么。",
    communityAvailableBenchmark: "探索 benchmark",
    communityAvailableBenchmarkCopy: "查看公开产物和覆盖边界。",
    communityAvailableRepository: "查看 GitHub 仓库",
    communityAvailableRepositoryCopy: "检查源代码、契约和 roadmap。",
    communityAvailableStatus: "已开放",
    communityNotOpenEyebrow: "尚未开放",
    communityNotOpenTitle: "研究参与仍处于关闭状态。",
    communityNotOpenCopy: "当前没有公开 intake，也没有正在运行的 reviewer 项目；不承诺具体日期。",
    communityNotOpenApplications: "评审申请",
    communityNotOpenApplicationsCopy: "公开 intake 尚未开放。",
    communityNotOpenCampaign: "真实 Community Review",
    communityNotOpenCampaignCopy: "尚未启动。",
    communityNotOpenCalibration: "P5 人工校准",
    communityNotOpenCalibrationCopy: "尚未开始。",
    communityWatchEyebrow: "关注项目",
    communityWatchTitle: "成为下一步的一部分。",
    communityWatchCopy: "当前尚未开放申请。请关注项目未来的 Community Review 公告，同时先查看公开 benchmark。本页面没有申请表、候补名单或 reviewer 登录入口。",
    communityWatchHomepage: "查看 benchmark",
    communityWatchCases: "浏览 benchmark 案例",
    communityWatchMethodology: "阅读方法论",
    communityWatchGitHub: "在 GitHub 关注仓库 ↗",
  },
};

export function resolveSiteLocale(value: string | undefined): SiteLocale {
  return value?.toLowerCase().startsWith("zh") ? "zh-CN" : DEFAULT_SITE_LOCALE;
}

export function siteText(locale: SiteLocale, key: SiteUiTextKey): string {
  return translations[locale][key];
}
