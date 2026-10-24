#!/usr/bin/env node
// Real-browser hit test for the published Spectrum site (website/dist after `npm run website:build`).
//
// It serves the built site and drives a local Chrome/Chromium through the DevTools protocol
// (scripts/website-browser.mjs) to check that:
//   - every visible control in the top bar (wordmark, section links, Menu, language, Run) owns the
//     points inside its own box, and the bar stays inside the viewport;
//   - no page scrolls sideways, at 320 px and at 200% text;
//   - the Menu button opens the site menu where the section links are hidden, and real clicks on
//     menu and bar links open their own destination;
//   - the language toggle opens the other language's URL.
// Scenarios cover 320/390/1024/1100/1440 px, English and /zh-cn/, and 200% text (every element's
// computed font size doubled).
//
// Usage: node scripts/website-spectrum-hit-test.mjs [--dir website/dist]
// Browser: $CHROME_PATH, or google-chrome / chromium on PATH.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, launchBrowser, openPage } from "./website-browser.mjs";
import { serve } from "./website-hit-test.mjs";

/* global document, getComputedStyle, innerWidth, requestAnimationFrame */

function scaleText(factor) {
  const all = [...document.querySelectorAll("body, body *")];
  const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize));
  all.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * factor}px`, "important"));
  return true;
}

export function barProbe() {
  const pointsOf = (r) => [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 4, r.top + r.height / 2], ["right", r.right - 4, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 3], ["bottom", r.left + r.width / 2, r.bottom - 3]];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden") return false;
    }
    return true;
  };
  const bar = document.querySelector("header.bar");
  if (!bar) return { count: 0, problems: ["bar missing"] };
  const controls = [...bar.querySelectorAll(".wordmark, .nav a, [data-menu-toggle], [data-lang-toggle], .run-btn")].filter(visible);
  const problems = [];
  for (const el of controls) {
    for (const [name, x, y] of pointsOf(el.getBoundingClientRect())) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) problems.push(`${el.getAttribute("href") || el.className} @${name} -> ${hit ? (hit.closest("a, button") || hit).outerHTML.slice(0, 60) : "nothing"}`);
    }
  }
  const viewport = document.documentElement.clientWidth;
  for (const el of [bar, ...controls]) {
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > viewport + 1) problems.push(`bar overflow: ${el.className || el.tagName}`);
  }
  if (!controls.some((el) => el.matches(".nav a")) && !controls.some((el) => el.matches("[data-menu-toggle]"))) {
    problems.push("neither section links nor the Menu button are visible");
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`page scrolls sideways by ${document.documentElement.scrollWidth - innerWidth}px`);
  return { count: controls.length, problems };
}

async function openMenu() {
  const button = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!button || !menu) return { problem: "menu missing" };
  const r = button.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.width > 0 && getComputedStyle(button).display !== "none" };
}

async function locate(selector, index) {
  const el = [...document.querySelectorAll(selector)].filter((x) => x.getBoundingClientRect().width > 0)[index];
  if (!el) return null;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const r = el.getBoundingClientRect();
  return { href: el.href, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export async function runSpectrumHitTest(directory, executable = findBrowser()) {
  let browser, server;
  const failures = [];
  const errors = [];
  let checks = 0;
  try {
    server = await serve(directory);
    browser = await launchBrowser(executable);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await openPage(browser);
    // Pin the browser language: a Chinese browser is sent from / to /zh-cn/ by design.
    const { userAgent } = await browser.send("Browser.getVersion");
    await page.send("Emulation.setUserAgentOverride", { userAgent, acceptLanguage: "en-US" });
    const visit = async (url, zoom) => {
      await page.goto(url);
      if (zoom !== 1) await page.call(scaleText, zoom);
      await page.settled();
    };
    for (const width of [320, 390, 1024, 1100, 1440]) {
      await page.viewport(width, 800);
      for (const path of ["/", "/methodology/", "/data/cases/", "/blog/", "/zh-cn/", "/zh-cn/blog/"]) {
        for (const zoom of [1, 2]) {
          await visit(origin + path, zoom);
          const { count, problems } = await page.call(barProbe);
          checks += count;
          problems.forEach((problem) => failures.push(`bar ${width}px ${path} x${zoom}: ${problem}`));
        }
      }
    }
    // Menu: opens, and its page links (not in-page anchors) open their own destination.
    for (const [width, path] of [[390, "/about/"], [1024, "/zh-cn/about/"]]) {
      await page.viewport(width, 800);
      await visit(origin + path, 1);
      const links = await page.evaluate("[...document.querySelectorAll('[data-menu] a')].filter((a) => !a.hash && a.origin === location.origin).length");
      for (let index = 0; index < links; index += 1) {
        await visit(origin + path, 1);
        const button = await page.call(openMenu);
        if (!button.visible) { failures.push(`menu ${width}px ${path}: Menu button hidden`); break; }
        await page.click(button.x, button.y);
        await page.settled();
        const shown = await page.evaluate("!document.querySelector('[data-menu]').hidden");
        if (!shown) { failures.push(`menu ${width}px ${path}: menu did not open`); break; }
        const target = await page.call(locate, "[data-menu] a:not([href*='#']):not([href^='http'])", index);
        if (!target) continue;
        const landed = await page.navigation(() => page.click(target.x, target.y));
        checks += 1;
        if (landed !== target.href) failures.push(`menu ${width}px ${path}: ${target.href} opened ${landed}`);
      }
    }
    // Bar section links on a section page and the language toggle.
    await page.viewport(1440, 800);
    await visit(origin + "/blog/", 1);
    const nav = await page.evaluate("document.querySelectorAll('header.bar .nav a').length");
    for (let index = 0; index < nav; index += 1) {
      await visit(origin + "/blog/", 1);
      const target = await page.call(locate, "header.bar .nav a", index);
      const landed = await page.navigation(() => page.click(target.x, target.y));
      checks += 1;
      if (landed.split("#")[0] !== target.href.split("#")[0]) failures.push(`bar link ${target.href} opened ${landed}`);
    }
    for (const [from, to] of [["/about/", "/zh-cn/about/"], ["/zh-cn/about/", "/about/"]]) {
      await visit(origin + from, 1);
      const toggle = await page.call(locate, "[data-lang-toggle]", 0);
      const landed = await page.navigation(() => page.click(toggle.x, toggle.y));
      checks += 1;
      if (landed !== origin + to) failures.push(`language toggle on ${from} opened ${landed}`);
    }
    if (browser.failure) throw browser.failure;
  } catch (error) { errors.push(error); }
  finally {
    try { await browser?.close(); } catch (error) { errors.push(error); }
    if (server) {
      server.closeAllConnections();
      try {
        await new Promise((done, fail) => {
          const timer = setTimeout(() => fail(new Error("Preview server cleanup timed out")), 2000);
          server.close((error) => { clearTimeout(timer); if (error) fail(error); else done(); });
        });
      } catch (error) { errors.push(error); }
    }
  }
  if (errors.length) throw new AggregateError(errors, "Spectrum hit test or cleanup failed");
  if (failures.length > 0) {
    console.error(`Spectrum hit test failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    throw new Error(`Spectrum hit test failed (${failures.length})`);
  }
  console.log(`Spectrum hit test passed: ${checks} controls and clicks checked.`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf("--dir");
  try {
    if (dirFlag >= 0 && (!args[dirFlag + 1] || args[dirFlag + 1].startsWith("--"))) throw new Error("--dir requires a directory");
    await runSpectrumHitTest(resolve(dirFlag >= 0 ? args[dirFlag + 1] : "website/dist"));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 1000).unref();
  }
}
