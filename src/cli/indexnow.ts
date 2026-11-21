import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * IndexNow tells Bing and the other engines that share it (not Google) which pages changed, so they
 * are crawled again within hours instead of weeks; ChatGPT search and Copilot read Bing's index.
 * The key is public by design: an engine accepts a submission only after fetching
 * `/<key>.txt` from the same site and finding the key in it, so the key proves control of the
 * site, not of an account. The build writes that file; the Pages workflow submits after deploying.
 */
export const INDEXNOW_KEY = "f8d7b6b511ce3090da54a2b6341391ba";
export const INDEXNOW_KEY_FILE = `${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowPayload {
  readonly host: string;
  readonly key: string;
  readonly keyLocation: string;
  readonly urlList: readonly string[];
}

const XML_ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** The page addresses a sitemap lists, in order. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) =>
    (match[1] ?? "").trim().replace(/&(?:amp|lt|gt|quot|apos);/gu, (entity) => XML_ENTITIES[entity] ?? entity));
}

/** Where the build wrote the page served at this address, or undefined for an address off the site. */
export function builtFileForUrl(outputDirectory: string, siteUrl: string, url: string): string | undefined {
  const root = siteUrl.replace(/\/$/u, "");
  if (url !== root && !url.startsWith(`${root}/`)) return undefined;
  const path = decodeURIComponent(url.slice(root.length)) || "/";
  if (path.split("/").includes("..")) return undefined;
  return join(outputDirectory, path.endsWith("/") ? `${path}index.html` : path);
}

/** The live bytes at an address, or undefined when it does not answer 200. */
export type FetchLivePage = (url: string) => Promise<Uint8Array | undefined>;

const fetchLivePage: FetchLivePage = async (url) => {
  try {
    const response = await fetch(url, { headers: { "cache-control": "no-cache" }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
    return response.status === 200 ? new Uint8Array(await response.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The sitemap pages this build changes: each built page is compared with what the live site serves
 * now, before the deploy replaces it. A page the live site does not serve yet counts as changed.
 */
export async function changedSitemapUrls(options: {
  readonly outputDirectory: string;
  readonly siteUrl: string;
  readonly fetchPage?: FetchLivePage;
  readonly concurrency?: number;
}): Promise<string[]> {
  const fetchPage = options.fetchPage ?? fetchLivePage;
  const urls = sitemapUrls(await readFile(join(options.outputDirectory, "sitemap.xml"), "utf8"));
  const changed = new Array<boolean>(urls.length).fill(false);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const index = next++;
      const url = urls[index] ?? "";
      const file = builtFileForUrl(options.outputDirectory, options.siteUrl, url);
      if (file === undefined) continue;
      const [built, live] = await Promise.all([readFile(file), fetchPage(url)]);
      changed[index] = live === undefined || !Buffer.from(live).equals(built);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 8) }, worker));
  return urls.filter((_, index) => changed[index]);
}

export function indexNowPayload(siteUrl: string, urls: readonly string[]): IndexNowPayload {
  const site = new URL(siteUrl);
  const root = siteUrl.replace(/\/$/u, "");
  return { host: site.host, key: INDEXNOW_KEY, keyLocation: `${root}/${INDEXNOW_KEY_FILE}`, urlList: urls };
}

/**
 * Usage: node dist/src/cli/indexnow.js <built site directory> <site URL>
 * Prints `payload=<json>` (GitHub Actions output syntax) for the pages this build changes, or
 * `payload=` when none changed. The workflow posts the payload once the deploy has finished.
 */
async function main(): Promise<void> {
  const [outputDirectory, siteUrl] = process.argv.slice(2);
  if (outputDirectory === undefined || siteUrl === undefined || !/^https:\/\/[^/]+\/?$/u.test(siteUrl)) {
    throw new Error("Usage: indexnow <built site directory> <site URL at a host root, such as https://teachometry.com>");
  }
  const urls = await changedSitemapUrls({ outputDirectory, siteUrl });
  console.error(`IndexNow: ${urls.length} changed page(s).`);
  console.log(`payload=${urls.length === 0 ? "" : JSON.stringify(indexNowPayload(siteUrl, urls))}`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "IndexNow failed.");
    process.exitCode = 1;
  }
}
