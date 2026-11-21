import { createHash } from "node:crypto";

// GitHub Pages cannot send response headers, so each published page carries its own security
// policy in a <meta> tag, right after <meta charset> so that it covers everything after it.
// Scripts come from the site itself, plus the page's own inline scripts, each allowed by its hash.
// Styles keep 'unsafe-inline': the pages set CSS custom properties in style attributes (--v, --c).
// blob: images are the cover's scroll frames, which cover.js fetches and shows as object URLs.

const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
// a <script> runs only with no type, a JavaScript type or "module": any other type (JSON-LD) is a data block
const RUNNABLE_TYPE = /^(?:module|(?:text|application)\/(?:java|ecma)script)$/iu;
const CHARSET = /<meta charset="utf-8">/giu;

/** The sha256 source expressions of the page's inline scripts, in page order, without repeats. */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(SCRIPT_ELEMENT)) {
    const attributes = match[1] ?? "";
    if (/\bsrc\s*=/iu.test(attributes)) continue;
    const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(attributes);
    const value = (type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim();
    if (value !== "" && !RUNNABLE_TYPE.test(value)) continue;
    // the browser hashes the script text after turning CR LF and lone CR into LF
    const text = (match[2] ?? "").replace(/\r\n?/gu, "\n");
    hashes.add(`'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...inlineScriptHashes(html)].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** The page with its Content-Security-Policy and referrer policy, added right after <meta charset>. */
export function withSecurityPolicy(html: string, source = "page"): string {
  if (/http-equiv="Content-Security-Policy"/iu.test(html)) throw new Error(`${source} already has a security policy.`);
  const charsets = html.match(CHARSET)?.length ?? 0;
  if (charsets !== 1) throw new Error(`${source} needs exactly one <meta charset="utf-8"> to place its security policy after (found ${charsets}).`);
  const policy = contentSecurityPolicy(html);
  return html.replace(CHARSET, (tag) =>
    `${tag}\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`);
}
