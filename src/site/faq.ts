import type { PublicBenchmarkArtifact } from "../datasets/public.js";
import type { SiteLocale } from "./i18n.js";

export interface SiteFaqEntry {
  readonly question: string;
  readonly answer: string;
}

type FaqBenchmark = Pick<PublicBenchmarkArtifact, "dataset" | "dimensions">;

const DIMENSION_NAMES: Readonly<Record<string, readonly [en: string, zh: string]>> = {
  correctness: ["correctness", "正确性"],
  diagnosis: ["diagnosis", "诊断"],
  guidance: ["guidance", "引导"],
  adaptation: ["adaptation", "适应"],
  actionability: ["actionability", "可执行性"],
};

function dimensionList(benchmark: FaqBenchmark, zh: boolean): string {
  const names = benchmark.dimensions.score.map((dimension) => {
    const name = DIMENSION_NAMES[dimension];
    if (name === undefined) throw new Error(`The FAQ has no name for the score dimension ${dimension}.`);
    return zh ? name[1] : name[0];
  });
  if (zh) return `${names.slice(0, -1).join("、")}和${names.at(-1) ?? ""}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/**
 * Short, plain answers to what people (and the AI assistants they ask) want to know about
 * Teachometry. One source for the About page's questions, their FAQPage structured data and
 * llms.txt. Counts come from the published benchmark, so the answers cannot drift from the data.
 * The naming answer repeats the README's naming note: the two projects share a name, nothing else.
 */
export function siteFaq(benchmark: FaqBenchmark, locale: SiteLocale): readonly SiteFaqEntry[] {
  const zh = locale === "zh-CN";
  const { caseCount, subjectCount, crossLocaleGroupCount } = benchmark.dataset;
  const dimensions = dimensionList(benchmark, zh);
  const count = benchmark.dimensions.score.length;
  if (zh) {
    return [
      {
        question: "Teachometry 是什么？",
        answer: "Teachometry 为教学质量造公开的测量仪器。第一件仪器 TutorBench 用来评测 AI Tutor 怎么教：在结构化的案例里，它对学习者做了什么，而不只是最后的答案对不对。",
      },
      {
        question: "TutorBench 测什么？",
        answer: `${count} 个维度，分开评：${dimensions}。每一条发现都对应具体的案例、维度，以及 Tutor 回复里的证据。`,
      },
      {
        question: "它和 Scale AI 的 TutorBench 有关系吗？",
        answer: "没有。Teachometry 的 TutorBench 是独立项目，与 Scale AI 另行发布的同名 TutorBench 数据集没有关联。",
      },
      {
        question: "现在有评测结果或排名了吗？",
        answer: "还没有。TutorBench 目前是开发者预览版：案例和方法都已公开，但还没有发布经过校准的公开评测，所以结果表是有意留空的。",
      },
      {
        question: "公开案例集里有什么？",
        answer: `${caseCount} 个案例，覆盖 ${subjectCount} 个学科：${crossLocaleGroupCount} 个学习情境，每个都有英文版和简体中文版，以 CC BY 4.0 许可发布，可以下载 JSON。每个案例都站在学习者一边来写：说了什么、相信什么、想做到什么。`,
      },
      {
        question: "我可以自己运行吗？",
        answer: "可以。软件以 Apache-2.0 开源。Quickstart 用 4 个固定案例做确定性检查，不需要 API Key。之后可以接入你自己的 Tutor。",
      },
    ];
  }
  return [
    {
      question: "What is Teachometry?",
      answer: "Teachometry builds open instruments for measuring teaching quality. Its first instrument, TutorBench, evaluates how an AI tutor teaches: what it does with a learner in a structured case, not only whether its final answer is right.",
    },
    {
      question: "What does TutorBench measure?",
      answer: `${count === 5 ? "Five" : String(count)} dimensions, kept separate: ${dimensions}. Each finding stays tied to a case, a dimension and the evidence in the tutor’s reply.`,
    },
    {
      question: "Is it related to Scale AI’s TutorBench?",
      answer: "No. Teachometry’s TutorBench is an independent project. It is not affiliated with Scale AI’s separately named TutorBench dataset.",
    },
    {
      question: "Are there results or rankings yet?",
      answer: "Not yet. TutorBench is in Developer Preview: the cases and the method are public, but no calibrated public run has been published, so the results table is empty on purpose.",
    },
    {
      question: "What is in the public case set?",
      answer: `${caseCount} cases across ${subjectCount} subjects: ${crossLocaleGroupCount} learning situations, each written in English and in Simplified Chinese, released under CC BY 4.0 and downloadable as JSON. Each case is written from the learner’s side: what they say, what they believe and what they are trying to do.`,
    },
    {
      question: "Can I run it myself?",
      answer: "Yes. The software is open source under Apache-2.0. The Quickstart runs four fixed cases with deterministic checks and needs no API key. After that you can connect your own tutor.",
    },
  ];
}
