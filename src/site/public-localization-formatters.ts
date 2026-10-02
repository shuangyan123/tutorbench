import type { SiteLocale } from "./i18n.js";
import { publicUiCopy } from "./public-localization.js";

// 静态渲染与客户端通过 data attribute 共用模板，避免首次加载后措辞跳变。
export const CASE_COUNT_TEMPLATES = {
  en: "Showing {start}–{end} of {count} cases",
  "zh-CN": "显示 {start}–{end} / 共 {count} 个案例",
} as const;

export const DOC_COUNT_TEMPLATES = {
  en: { all: "Showing {count} references", filtered: "Showing {visible} of {count} references" },
  "zh-CN": { all: "显示 {count} 条参考资料", filtered: "显示 {visible} / {count} 条参考资料" },
} as const;

export function formatCaseCount(start: number, end: number, count: number, locale: SiteLocale): string {
  return CASE_COUNT_TEMPLATES[locale].replaceAll("{start}", String(start))
    .replaceAll("{end}", String(end)).replaceAll("{count}", String(count));
}

export function formatDocCount(count: number, locale: SiteLocale): string {
  return DOC_COUNT_TEMPLATES[locale].all.replaceAll("{count}", String(count));
}

export function formatCasePositionAriaLabel(current: number, total: number, locale: SiteLocale): string {
  return locale === "zh-CN" ? `第 ${current} 个案例，共 ${total} 个` : `Case ${current} of ${total}`;
}

export function formatExampleCaseAriaLabel(caseId: string, locale: SiteLocale): string {
  return `${locale === "zh-CN" ? "公开示例案例" : "Example public case"} ${caseId}`;
}

export function formatCaseDescription(caseId: string, learningObjective: string, locale: SiteLocale): string {
  // 只翻译 metadata 外层模板；学习目标属于原始案例输入。
  return locale === "zh-CN"
    ? `公开 TutorEval 案例 ${caseId}：${learningObjective}`
    : `Public TutorEval case ${caseId}: ${learningObjective}`;
}

const COUNT_UNITS = {
  publicCases: [" public cases", " 个公开案例"],
  syntheticCases: [" synthetic cases", " 个合成案例"],
  publicModels: [" public models", " 个公开模型"],
  publicProfiles: [" public profiles", " 份公开档案"],
  available: [" available", " 个可用"],
  modelRuns: [" public model runs available", " 个公开模型运行记录可用"],
  scoreDimensions: [" benchmark score dimensions", " 个基准评分维度"],
} as const;

export function formatPublicCount(count: number, unit: keyof typeof COUNT_UNITS, locale: SiteLocale): string {
  return String(count) + COUNT_UNITS[unit][locale === "zh-CN" ? 1 : 0];
}

export function formatAuthoredScenarios(count: number, locale: SiteLocale): string {
  return locale === "zh-CN"
    ? `浏览 ${count} 个人工编写的教学情境，包含丰富语境、学生档案和公开案例元数据。`
    : `Browse ${count} authored tutoring scenarios with rich context, learner profiles, and public case metadata.`;
}

export function formatRubricStatus(count: number, status: string, locale: SiteLocale): string {
  return `${count}${locale === "zh-CN" ? " 项评分标准" : " rubrics"} · ${publicUiCopy(status, locale)}`;
}

export function formatCurrentDataset(identity: string, locale: SiteLocale): string {
  return `${locale === "zh-CN" ? "当前数据集：" : "Current dataset: "}${identity}`;
}

export function formatCanonicalCases(count: number, locale: SiteLocale): string {
  return locale === "zh-CN" ? `标准产物中的 ${count} 个公开案例` : `${count} public cases in the canonical artifact`;
}

export function formatCoverageDenominator(count: number, overlapping: boolean, locale: SiteLocale): string {
  if (locale === "zh-CN") {
    return `${overlapping ? "各类别案例数，类别可重叠" : "占全部案例的比例"}；n = ${count}${count === 0 ? "；百分比不可用" : ""}。`;
  }
  return `${overlapping ? "Cases with each category; categories overlap." : "Share of all cases."} n = ${count}${count === 0 ? "; percentages unavailable" : ""}`;
}

export function formatCoverageExpansion(title: string, count: number, locale: SiteLocale): string {
  if (locale === "en") return `View all ${count} ${title.toLowerCase()}`;
  if (title === "Student states") return `查看全部 ${count} 种学生状态`;
  if (title === "Capabilities") return `查看全部 ${count} 项能力`;
  return `查看全部 ${count} 个${publicUiCopy(title, locale)}`;
}

export function formatCoverageGroups(tasks: number, locales: number, locale: SiteLocale): string {
  return locale === "zh-CN"
    ? `学习任务（${tasks}）、语言（${locales}）与评测覆盖情况`
    : `Learning tasks (${tasks}), locales (${locales}) & evaluation coverage`;
}

export function formatCoverageVersion(version: string, schema: number, locale: SiteLocale): string {
  return locale === "zh-CN"
    ? `维度覆盖统计各类别中至少包含一项评分标准的案例数，类别可重叠。基准 ${version} · 产物 schema ${schema}。数据集增长会重新计算覆盖情况；schema 变更需要显式审查展示版本。`
    : `Dimension coverage counts cases with at least one rubric in each category; categories overlap. Benchmark ${version} · artifact schema ${schema}. Dataset growth recalculates coverage; schema changes require an explicit presentation version review.`;
}

export function formatRemainingCaseIdentities(count: number, locale: SiteLocale): string {
  return locale === "zh-CN" ? `产物中还有 ${count} 个公开案例标识` : `${count} more public case identities in the artifact`;
}

export function formatTrialContext(identity: string, count: number, schema: number, locale: SiteLocale): string {
  return locale === "zh-CN"
    ? `${identity} · ${count} 个公开案例 · 产物 schema ${schema}。此语境不是模型运行、结果或评测记录。`
    : `${identity} · ${count} public cases · ${schema} artifact schema. This context is not a model run, result, or trial.`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatPublicationDate(value: string, locale: SiteLocale): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  const legacy = value.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/u);
  const year = Number(iso?.[1] ?? legacy?.[3]);
  const month = iso === null ? MONTHS.indexOf(legacy?.[1] ?? "") + 1 : Number(iso[2]);
  const day = Number(iso?.[3] ?? legacy?.[2]);
  // 明确 UTC，避免 YYYY-MM-DD 在不同时区被显示为前一天。
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (!Number.isInteger(year) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid publication date: ${value}`);
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(date);
}
