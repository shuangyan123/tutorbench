import type { PublicBenchmarkArtifact } from "../datasets/public.js";
import { siteFaq } from "./faq.js";
import { SITE_CONTACT_EMAIL, SITE_GITHUB_URL, type SitePage } from "./html.js";

/** The pages llms.txt points to, in reading order. Their titles and descriptions come from the pages. */
const KEY_ROUTES = ["/about/", "/methodology/", "/data/cases/", "/data/", "/run/", "/micro-review/", "/work-with-us/", "/blog/"] as const;

const shortTitle = (title: string): string => title.replace(/\s+[—-]\s+Teachometry(?: Blog| 博客)?$/u, "");

/**
 * llms.txt (llmstxt.org): a plain Markdown map of the site for AI assistants and the tools that
 * read for them. It holds no copy of its own: the summary, the answers and every link text come
 * from the pages and from the About page's questions, so it cannot say what the site does not.
 */
export function renderLlmsTxt(options: {
  readonly siteUrl: string;
  readonly pages: readonly SitePage[];
  readonly benchmark: Pick<PublicBenchmarkArtifact, "dataset" | "dimensions">;
}): string {
  const root = options.siteUrl.replace(/\/$/u, "");
  const page = (route: string): SitePage => {
    const found = options.pages.find((candidate) => candidate.route === route);
    if (found === undefined) throw new Error(`llms.txt links ${route}, which the build has no page for.`);
    return found;
  };
  const home = page("/");
  const faq = siteFaq(options.benchmark, "en");
  return [
    "# Teachometry",
    "",
    `> ${home.description}`,
    "",
    ...faq.flatMap(({ question, answer }) => [`**${question}** ${answer}`, ""]),
    "Every page has a Simplified Chinese version: add /zh-cn/ after the domain.",
    "",
    "## Key pages",
    "",
    ...KEY_ROUTES.map((route) => {
      const { title, description } = page(route);
      return `- [${shortTitle(title)}](${root}${route}): ${description}`;
    }),
    "",
    "## Data",
    "",
    `- [Public cases (JSON)](${root}/public-data/cases.json): every public case, released under CC BY 4.0.`,
    `- [Benchmark summary (JSON)](${root}/public-data/benchmark.json): dataset version, counts, score dimensions and status.`,
    `- [Essays feed (RSS)](${root}/blog/feed.xml): the Journal's essays, newest first.`,
    "",
    "## Optional",
    "",
    `- [Source code](${SITE_GITHUB_URL}): the TutorBench software, open source under Apache-2.0.`,
    `- [Contact](${root}/contact/): ${SITE_CONTACT_EMAIL}`,
    "",
  ].join("\n");
}
