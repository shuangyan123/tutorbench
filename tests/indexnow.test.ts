import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtFileForUrl, changedSitemapUrls, INDEXNOW_KEY, indexNowPayload, sitemapUrls } from "../src/cli/indexnow.js";

const SITE = "https://teachometry.com";

test("IndexNow reads the sitemap's addresses and finds the file the build wrote for each", () => {
  const xml = `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/zh-cn/about/</loc><xhtml:link href="${SITE}/about/"/></url><url><loc>${SITE}/a?b=1&amp;c=2</loc></url></urlset>`;
  assert.deepEqual(sitemapUrls(xml), [`${SITE}/`, `${SITE}/zh-cn/about/`, `${SITE}/a?b=1&c=2`]);
  assert.equal(builtFileForUrl("/out", SITE, `${SITE}/`), join("/out", "/index.html"));
  assert.equal(builtFileForUrl("/out", `${SITE}/`, `${SITE}/zh-cn/about/`), join("/out", "/zh-cn/about/index.html"));
  assert.equal(builtFileForUrl("/out", SITE, `${SITE}/llms.txt`), join("/out", "/llms.txt"));
  // nothing outside the site, or outside the built folder, is read
  assert.equal(builtFileForUrl("/out", SITE, "https://example.org/"), undefined);
  assert.equal(builtFileForUrl("/out", SITE, `${SITE}.evil.example/`), undefined);
  assert.equal(builtFileForUrl("/out", SITE, `${SITE}/%2e%2e/secret`), undefined);
});

test("IndexNow submits only the pages whose built bytes differ from what the live site serves", async () => {
  const out = await mkdtemp(join(tmpdir(), "tutorbench-indexnow-"));
  try {
    const pages: Record<string, string> = { "/": "home v2", "/about/": "about", "/new/": "a new page" };
    for (const [route, body] of Object.entries(pages)) {
      await mkdir(join(out, route), { recursive: true });
      await writeFile(join(out, route, "index.html"), body);
    }
    await writeFile(join(out, "sitemap.xml"), Object.keys(pages).map((route) => `<url><loc>${SITE}${route}</loc></url>`).join(""));
    const live: Record<string, string> = { [`${SITE}/`]: "home v1", [`${SITE}/about/`]: "about" };
    const asked: string[] = [];
    const changed = await changedSitemapUrls({
      outputDirectory: out,
      siteUrl: SITE,
      concurrency: 2,
      fetchPage: async (url) => {
        asked.push(url);
        const body = live[url];
        return body === undefined ? undefined : new TextEncoder().encode(body);
      },
    });
    assert.deepEqual(changed, [`${SITE}/`, `${SITE}/new/`]);
    assert.deepEqual(asked.sort(), Object.keys(pages).map((route) => `${SITE}${route}`).sort());
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("the IndexNow payload names the host and the key file the build serves at the site root", () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/u);
  assert.deepEqual(indexNowPayload(`${SITE}/`, [`${SITE}/about/`]), {
    host: "teachometry.com",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: [`${SITE}/about/`],
  });
});
