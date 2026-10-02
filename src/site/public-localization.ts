import type { SiteLocale } from "./i18n.js";
import type { PublicBenchmarkArtifacts } from "../datasets/public.js";
import { humanize } from "./html.js";
import { SITE_ZH_CN_COPY } from "./locale-copy.js";

// 标点由调用方按结构添加；固定文案仍使用已有的精确节点词典。
export function publicUiCopy(value: string, locale: SiteLocale): string {
  return locale === "zh-CN" ? SITE_ZH_CN_COPY[value] ?? value : value;
}

// 只转换公开展示标签；机器值、筛选参数与案例原文不进入这个映射。
const TAXONOMY_ZH_CN: Readonly<Record<string, string>> = {
  mathematics: "数学",
  programming: "编程",
  science: "科学",
  history_or_social_studies: "历史或社会研究",
  language: "语言",
  beginner: "入门",
  elementary: "小学",
  "middle-school": "初中",
  secondary: "中学",
  "upper-elementary": "小学高年级",
  novice: "初学者",
  conceptual_misconception: "概念误解",
  correct_answer_wrong_reasoning: "答案正确但推理错误",
  overconfident_incorrect: "过度自信但答案错误",
  partial_understanding: "理解不完整",
  procedural_error: "步骤错误",
  stuck_without_attempt: "未尝试便卡住",
  uncertain_but_correct: "答案正确但不确定",
  answer_checking: "答案检查",
  concept_explanation: "概念解释",
  error_diagnosis: "错误诊断",
  guided_problem_solving: "引导式解题",
  hint_request: "提示请求",
  knowledge_recall: "知识回忆",
  reasoning_checking: "推理检查",
  transfer_preparation: "迁移准备",
  full_solution_allowed: "允许完整解答",
  full_solution_required: "要求完整解答",
  hint_only: "仅提供提示",
  no_answer: "不提供答案",
  partial_solution: "部分解答",
  answer_non_disclosure: "不泄露答案",
  check_for_understanding: "检查理解",
  clear_next_step: "明确下一步",
  conceptual_correctness: "概念正确性",
  conceptual_prompting: "概念提示",
  counterfactual_adaptation: "反事实适应",
  difficulty_adaptation: "难度适应",
  error_detection: "错误检测",
  error_localization: "错误定位",
  explanation_depth_adaptation: "解释深度适应",
  factual_correctness: "事实正确性",
  hint_calibration: "提示校准",
  knowledge_gap_identification: "识别知识缺口",
  misconception_identification: "识别概念误解",
  misconception_specific_adaptation: "针对概念误解的适应",
  misleading_simplification: "误导性简化",
  overhelping_avoidance: "避免过度帮助",
  prior_knowledge_adaptation: "依据已有知识调整",
  procedural_correctness: "步骤正确性",
  procedural_prompting: "步骤提示",
  productive_question: "有效提问",
  reasoning_consistency: "推理一致性",
  scaffolding: "学习支架",
  student_agency: "学生自主性",
  student_executable_action: "学生可执行的行动",
  uncertainty_detection: "不确定性检测",
  correctness: "正确性",
  diagnosis: "诊断能力",
  guidance: "引导能力",
  adaptation: "适应能力",
  actionability: "可执行性",
};

export function displayTaxonomyLabel(value: string, locale: SiteLocale): string {
  return locale === "zh-CN" ? TAXONOMY_ZH_CN[value] ?? humanize(value) : humanize(value);
}

export function formatTeachingSituations(count: number, locale: SiteLocale): string {
  return locale === "zh-CN" ? count + " 个教学情境。" : count + " teaching situations.";
}

const EVIDENCE_COPY = {
  rankingsUnavailable: {
    en: "No public model rankings are available in the current public artifact.",
    "zh-CN": "当前公开产物尚未提供模型排名。",
  },
  modelNotice: {
    en: "No calibrated public model runs yet.",
    "zh-CN": "目前尚无校准后的公开模型运行记录。",
  },
  incompleteValidation: {
    en: "Calibration and validation evidence remain incomplete.",
    "zh-CN": "校准与验证证据仍不完整。",
  },
  syntheticNotRanking: {
    en: "Synthetic demonstrations and preliminary model artifacts are not public rankings.",
    "zh-CN": "合成演示和初步模型产物不构成公开排名。",
  },
  classroomBoundary: {
    en: "Results reflect performance on structured, authored benchmark cases, not general classroom teaching effectiveness.",
    "zh-CN": "结果反映模型在结构化、人工编写的基准案例上的表现，不代表一般课堂教学有效性。",
  },
  profileBoundary: {
    en: "Profiles are evidence records, not rankings.",
    "zh-CN": "档案是证据记录，不是排名。",
  },
  profileInterpretation: {
    en: "Future model profiles should be interpreted only within matched benchmark versions, dataset cohorts, generation conditions, and evaluation procedures. Teachometry measures observable tutoring behavior in structured authored cases—not long-term learning gains, retention, transfer, student satisfaction, or general classroom teaching effectiveness.",
    "zh-CN": "未来模型档案只能在基准版本、数据集案例组、生成条件和评测程序相匹配的条件下解读。Teachometry 测量结构化、人工编写案例中的可观察教学行为，不衡量长期学习增益、知识留存、迁移、学生满意度或一般课堂教学有效性。",
  },
  trialAuditPath: {
    en: "Trial records are the audit path from a future result to a case, Tutor response, evaluator evidence, and sanitized metrics.",
    "zh-CN": "评测记录是从未来结果追溯到案例、Tutor 回复、评估器证据和已脱敏指标的审计路径。",
  },
  trialNotice: {
    en: "No public model trials available yet.",
    "zh-CN": "目前尚无公开模型评测记录。",
  },
  collectionBoundary: {
    en: "Collection is not publication, calibration, or leaderboard eligibility; frozen evidence can be inspected and replayed offline. The baseline-native-default profile leaves optional temperature, reasoning, and seed controls unconstrained so provider-native behavior is not misrepresented as identical across vendors. tutor:export-cases is the semantic Tutor-visible adapter packet; tutor:export-execution is the canonical benchmark packet used to make model runs comparable. Neither packet includes evaluator-only annotations. The same benchmark does not imply that every provider exposes identical inference knobs.",
    "zh-CN": "采集不等于发布、校准或取得排行榜资格；冻结证据可以离线检查和重放。baseline-native-default 配置不约束可选的 temperature、reasoning 和 seed 控制项，避免将不同服务提供方的原生行为误称为一致。tutor:export-cases 是 Tutor 可见的语义适配器数据包；tutor:export-execution 是用于使模型运行可比较的标准基准数据包。两者均不包含仅供评估器使用的注释。使用同一基准并不意味着每个服务提供方都提供相同的推理控制项。",
  },
} as const;

export function publicEvidenceCopy(key: keyof typeof EVIDENCE_COPY, locale: SiteLocale): string {
  return EVIDENCE_COPY[key][locale];
}

export function publicArtifactNotice(
  notice: PublicBenchmarkArtifacts["models"]["notice"] | PublicBenchmarkArtifacts["trials"]["notice"],
  locale: SiteLocale,
): string {
  if (locale === "zh-CN") {
    if (notice === EVIDENCE_COPY.modelNotice.en) return EVIDENCE_COPY.modelNotice[locale];
    if (notice === EVIDENCE_COPY.trialNotice.en) return EVIDENCE_COPY.trialNotice[locale];
  }
  return notice;
}

export function formatModelComparison(version: string, fields: readonly string[], locale: SiteLocale): string {
  return locale === "zh-CN"
    ? "仅在相同基准版本和评测配置下比较模型。数据集 " + version + " 及 " + fields.join("、") + " 等可追踪字段仍是解读语境的一部分。"
    : "Compare models only within the same benchmark version and evaluation configuration. Dataset " + version + " and traceability fields such as " + fields.join(", ") + " remain part of the context.";
}

export function formatDimensionReadingGuide(labels: readonly string[], locale: SiteLocale): string {
  return locale === "zh-CN"
    ? "不要只看总分。不同模型在" + labels.join("、") + "等维度上可能各有优势。"
    : "Look beyond the overall score. Different models may have different strengths across " + labels.join(", ") + ".";
}
