import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  assertValidTutorEvalRunResult,
  buildTutorEvalFailureSignalMetrics,
  resolveTutorCaseLocale,
  type TutorEvalCategory,
  type TutorEvalCaseRunResult,
  type TutorEvalDataset,
  type TutorCaseLocale,
  type TutorEvalRunResult,
  type TutorEvalCaseScoringInputs,
  type TutorEvalFailureSignalMetrics,
  type TutorEvalFailureSignalRate,
} from "../contracts/index.js";
import {
  aggregateTutorEvalCategoryScores,
  aggregateTutorEvalOverallScore,
  hasMatchingTutorEvalAuthoredScoring,
} from "../scoring/index.js";
import { buildTutorEvalAuthoredScoringInputs } from "../scoring/provenance.js";

const categories: readonly TutorEvalCategory[] = [
  "correctness",
  "diagnosis",
  "guidance",
  "adaptation",
  "actionability",
];

export type TutorEvalReportLocale = "en" | "zh-CN";

interface TutorEvalReportLabels {
  readonly dataset: string;
  readonly evaluator: string;
  readonly tutor: string;
  readonly prompt: string;
  readonly judge: string;
  readonly judgePrompt: string;
  readonly judgeCalls: string;
  readonly judgeLatency: string;
  readonly judgeTokens: string;
  readonly cases: string;
  readonly runs: string;
  readonly passed: string;
  readonly failed: string;
  readonly errors: string;
  readonly criticalFailureRate: string;
  readonly answerLeakageRate: string;
  readonly overall: string;
  readonly languageContextBreakdown: string;
  readonly categories: Readonly<Record<TutorEvalCategory, string>>;
}

const reportLabels: Readonly<Record<TutorEvalReportLocale, TutorEvalReportLabels>> = {
  en: {
    dataset: "Dataset",
    evaluator: "Evaluator",
    tutor: "Tutor",
    prompt: "Prompt",
    judge: "Judge",
    judgePrompt: "Judge prompt",
    judgeCalls: "Judge calls",
    judgeLatency: "Judge latency",
    judgeTokens: "Judge tokens",
    cases: "Cases",
    runs: "runs",
    passed: "Passed",
    failed: "Failed",
    errors: "Errors",
    criticalFailureRate: "Critical failure rate",
    answerLeakageRate: "Answer leakage rate",
    overall: "Overall",
    languageContextBreakdown: "Language-context breakdown",
    categories: {
      correctness: "correctness",
      diagnosis: "diagnosis",
      guidance: "guidance",
      adaptation: "adaptation",
      actionability: "actionability",
    },
  },
  "zh-CN": {
    dataset: "数据集",
    evaluator: "评估器",
    tutor: "Tutor",
    prompt: "提示词",
    judge: "Judge",
    judgePrompt: "Judge 提示词",
    judgeCalls: "Judge 调用",
    judgeLatency: "Judge 延迟",
    judgeTokens: "Judge tokens",
    cases: "案例",
    runs: "次运行",
    passed: "通过",
    failed: "失败",
    errors: "错误",
    criticalFailureRate: "严重失败率",
    answerLeakageRate: "答案泄露率",
    overall: "总体",
    languageContextBreakdown: "语言语境分组",
    categories: {
      correctness: "正确性",
      diagnosis: "诊断能力",
      guidance: "引导能力",
      adaptation: "适应能力",
      actionability: "可执行性",
    },
  },
};

function formatScore(score: number | null): string {
  return score === null ? "n/a" : score.toFixed(2);
}

export interface TutorEvalLocaleBreakdown {
  readonly locale: TutorCaseLocale;
  /** Unique cases represented in this locale group. */
  readonly caseCount: number;
  /** Case runs represented in this locale group. */
  readonly caseRunCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly errorCount: number;
  readonly categoryScores: TutorEvalRunResult["categoryScores"];
  readonly overallScore: number | null;
  readonly criticalFailureRate: number | null;
  readonly answerLeakageRate: number | null;
  readonly failureSignalMetrics: TutorEvalFailureSignalMetrics;
  readonly plannedCaseRunCount: number;
  readonly scope: "authored_plan" | "observed_case_scope";
}

function aggregateLocaleCaseResults(
  caseResults: readonly TutorEvalCaseRunResult[],
  plannedCaseRunCount: number,
  authoredCases?: readonly TutorEvalCaseScoringInputs[],
): Omit<TutorEvalLocaleBreakdown, "locale" | "caseCount" | "caseRunCount" | "plannedCaseRunCount" | "scope"> {
  const aggregates = caseResults
    .filter((result) => result.overallScore !== null)
    .map((result) => ({
      categoryScores: result.categoryScores,
      overallScore: result.overallScore,
      qualityGate: result.qualityGate,
      passed: result.passed,
    }));
  const hasEvaluationErrors = caseResults.length !== plannedCaseRunCount || caseResults.some((result) => result.status === "error");
  const categoryScores = hasEvaluationErrors
    ? aggregateTutorEvalCategoryScores([])
    : aggregateTutorEvalCategoryScores(aggregates);
  const failureSignalMetrics = buildTutorEvalFailureSignalMetrics(caseResults, plannedCaseRunCount, authoredCases);
  return {
    passedCount: caseResults.filter((result) => result.status === "passed").length,
    failedCount: caseResults.filter((result) => result.status === "failed").length,
    errorCount: caseResults.filter((result) => result.status === "error").length,
    categoryScores,
    overallScore: hasEvaluationErrors
      ? null
      : aggregateTutorEvalOverallScore(caseResults.map((result) => result.overallScore)),
    criticalFailureRate: failureSignalMetrics.criticalFailures.rate,
    answerLeakageRate: failureSignalMetrics.answerLeakage.rate,
    failureSignalMetrics,
  };
}

/**
 * Groups an existing run result by resolved case locale. This is a breakdown
 * over the same case-level scores; it does not introduce cross-locale
 * weighting or a second scoring formula.
 */
export function buildTutorEvalLocaleBreakdowns(
  result: TutorEvalRunResult,
  dataset?: TutorEvalDataset,
): readonly TutorEvalLocaleBreakdown[] {
  assertValidTutorEvalRunResult(result);
  const boundDataset = dataset !== undefined && dataset.id === result.datasetId && dataset.version === result.datasetVersion &&
    hasMatchingTutorEvalAuthoredScoring(result, dataset) && result.caseResults.every((item) =>
      dataset.cases.some((authored) => authored.id === item.caseId && authored.version === item.caseVersion)) ? dataset : undefined;
  // 已知 authored rubric 可核对历史证据完整性，但不能替历史结果补默认评分身份。
  const authoredCases = boundDataset === undefined ? result.scoringProvenance?.cases : buildTutorEvalAuthoredScoringInputs(boundDataset);
  const datasetLocales = new Map(
    boundDataset?.cases.map((tutorEvalCase) => [
      tutorEvalCase.id,
      resolveTutorCaseLocale(tutorEvalCase.locale),
    ]) ?? [],
  );
  const grouped = new Map<TutorCaseLocale, TutorEvalCaseRunResult[]>();
  const plannedCases = boundDataset === undefined ? undefined : result.scoringProvenance === undefined
    ? boundDataset.cases.length === result.caseCount ? boundDataset.cases : undefined
    : boundDataset.cases.filter((item) => result.scoringProvenance!.cases.some((input) => input.caseId === item.id && input.caseVersion === item.version));
  if (plannedCases !== undefined) for (const item of plannedCases) grouped.set(resolveTutorCaseLocale(item.locale), []);
  for (const caseResult of result.caseResults) {
    const locale = resolveTutorCaseLocale(
      datasetLocales.get(caseResult.caseId) ?? caseResult.locale,
    );
    const cases = grouped.get(locale) ?? [];
    cases.push(caseResult);
    grouped.set(locale, cases);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([locale, caseResults]) => {
      const plannedCaseRunCount = (plannedCases === undefined ? new Set(caseResults.map((item) => item.caseId)).size
        : plannedCases.filter((item) => resolveTutorCaseLocale(item.locale) === locale).length) * result.runsPerCase;
      return {
        locale,
        caseCount: new Set(caseResults.map((caseResult) => caseResult.caseId)).size,
        caseRunCount: caseResults.length,
        plannedCaseRunCount,
        scope: plannedCases === undefined ? "observed_case_scope" as const : "authored_plan" as const,
        ...aggregateLocaleCaseResults(caseResults, plannedCaseRunCount, authoredCases),
      };
    });
}

function localeLabel(locale: TutorCaseLocale, reportLocale: TutorEvalReportLocale): string {
  if (reportLocale === "zh-CN") {
    return locale === "en"
      ? "英语语境"
      : locale === "zh-CN"
        ? "中文语境"
        : locale;
  }
  return locale === "en"
    ? "English-language context"
    : locale === "zh-CN"
      ? "Chinese-language context"
      : locale;
}

function formatLocaleBreakdown(
  breakdown: TutorEvalLocaleBreakdown,
  reportLocale: TutorEvalReportLocale,
): readonly string[] {
  const labels = reportLabels[reportLocale];
  return [
    `${localeLabel(breakdown.locale, reportLocale)} (${breakdown.locale}):`,
    `  ${labels.cases}: ${breakdown.caseCount} (${breakdown.caseRunCount} ${labels.runs})`,
    reportLocale === "zh-CN"
      ? `  证据范围: ${breakdown.scope === "authored_plan" ? "已编写案例计划" : "已观察案例范围"}；${breakdown.caseRunCount}/${breakdown.plannedCaseRunCount} 次运行`
      : `  Evidence scope: ${breakdown.scope === "authored_plan" ? "authored plan" : "observed case scope"}; ${breakdown.caseRunCount}/${breakdown.plannedCaseRunCount} case-runs`,
    `  ${labels.passed}: ${breakdown.passedCount}`,
    `  ${labels.failed}: ${breakdown.failedCount}`,
    `  ${labels.errors}: ${breakdown.errorCount}`,
    ...categories.map(
      (category) => `  ${labels.categories[category]}: ${formatScore(breakdown.categoryScores[category])}`,
    ),
    `  ${labels.criticalFailureRate}: ${formatFailureSignalRate(breakdown.failureSignalMetrics.criticalFailures, reportLocale)}`,
    `  ${labels.answerLeakageRate}: ${formatFailureSignalRate(breakdown.failureSignalMetrics.answerLeakage, reportLocale)}`,
    `  ${labels.overall}: ${formatScore(breakdown.overallScore)}`,
  ];
}

function formatFailureSignalRate(metric: TutorEvalFailureSignalRate, locale: TutorEvalReportLocale): string {
  const rate = metric.rate === null ? "n/a" : `${(metric.rate * 100).toFixed(2)}%`;
  const coverage = locale === "zh-CN"
    ? `已确认 ${metric.confirmedCount}；未观察到 ${metric.knownAbsentCount}；证据不可用 ${metric.unavailableCount}`
    : `confirmed ${metric.confirmedCount}; observed absent ${metric.knownAbsentCount}; unavailable ${metric.unavailableCount}`;
  return `${rate} (${coverage})`;
}

export function formatTutorEvalSummary(
  result: TutorEvalRunResult,
  options: { readonly reportLocale?: TutorEvalReportLocale } = {},
): string {
  assertValidTutorEvalRunResult(result);
  const reportLocale = options.reportLocale ?? "en";
  const labels = reportLabels[reportLocale];
  const failureSignalMetrics = buildTutorEvalFailureSignalMetrics(result.caseResults, result.caseCount * result.runsPerCase, result.scoringProvenance?.cases);
  const categoryLines = categories.map(
    (category) => `${labels.categories[category]}: ${formatScore(result.categoryScores[category])}`,
  );
  const judgeMetrics = result.caseResults.flatMap((caseResult) =>
    caseResult.judgeMetrics === undefined || caseResult.judgeMetrics === null
      ? []
      : [caseResult.judgeMetrics],
  );
  const judgeLines =
    result.judge === null
      ? []
      : [
          `${labels.judge}: ${result.judge.provider}/${result.judge.model}`,
          `${labels.judgePrompt}: ${result.judge.promptId ?? "unspecified"}@${result.judge.promptVersion}`,
          ...(judgeMetrics.length === 0
            ? []
            : [
                `${labels.judgeCalls}: ${judgeMetrics.length}`,
                `${labels.judgeLatency}: ${judgeMetrics.reduce(
                  (total, metrics) => total + metrics.latencyMs,
                  0,
                )}ms`,
                `${labels.judgeTokens}: ${judgeMetrics.every(
                  (metrics) => metrics.tokenUsage === null,
                )
                  ? "n/a"
                  : judgeMetrics.reduce(
                      (total, metrics) =>
                        total + (metrics.tokenUsage?.totalTokens ?? 0),
                      0,
                    )}`,
              ]),
        ];
  const localeBreakdownLines = buildTutorEvalLocaleBreakdowns(result).flatMap(
    (breakdown) => ["", ...formatLocaleBreakdown(breakdown, reportLocale)],
  );
  return [
    `${labels.dataset}: ${result.datasetId}@${result.datasetVersion}`,
    `${labels.evaluator}: ${result.evaluatorVersion ?? "legacy"}`,
    ...(reportLocale === "zh-CN"
      ? [`评分来源: ${result.scoringProvenance?.identity ?? "unknown（历史结果未记录配置）"}；总体和类别分数使用配置单位，单项 rubric score 保持归一化状态编码`]
      : [`Scoring provenance: ${result.scoringProvenance?.identity ?? "unknown (historical configuration not recorded)"}; aggregate/category scores use configured units; rubric scores remain normalized status encodings`]),
    `${labels.tutor}: ${result.tutor.provider}/${result.tutor.model}`,
    `${labels.prompt}: ${result.tutor.promptVersion}`,
    ...judgeLines,
    `${labels.cases}: ${result.caseCount} (${result.caseRunCount} ${labels.runs})`,
    `${labels.passed}: ${result.passedCount}`,
    `${labels.failed}: ${result.failedCount}`,
    `${labels.errors}: ${result.errorCount}`,
    ...categoryLines,
    `${labels.overall}: ${formatScore(result.overallScore)}`,
    `${labels.criticalFailureRate}: ${formatFailureSignalRate(failureSignalMetrics.criticalFailures, reportLocale)}`,
    `${labels.answerLeakageRate}: ${formatFailureSignalRate(failureSignalMetrics.answerLeakage, reportLocale)}`,
    "",
    `${labels.languageContextBreakdown}:`,
    ...localeBreakdownLines,
  ].join("\n");
}

export async function writeTutorEvalResult(
  result: TutorEvalRunResult,
  outputPath: string,
): Promise<void> {
  assertValidTutorEvalRunResult(result);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
