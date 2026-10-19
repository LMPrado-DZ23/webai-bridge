#!/usr/bin/env node
/**
 * Opt-in admission probe for every candidate provider.
 *
 * For each site: open a fresh dedicated profile, classify the landing page (challenge/login/composer),
 * and, for accessible sites, try one guest turn. Nothing is bypassed: a CAPTCHA/Cloudflare/login wall
 * is reported as such and the bridge refuses to automate it.
 *
 * Usage: node scripts/probe-candidates.mjs [--send] [--only id1,id2]
 */
import { chromium } from "playwright-core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify } from "../src/classify.mjs";

const CHROME = process.env.WEB_AI_CHROME
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const CANDIDATES = [
  { id: "qwen", url: "https://chat.qwen.ai/", send: false, note: "validated live (logged-in profile)" },
  { id: "mistral", url: "https://chat.mistral.ai/", send: false },
  { id: "kimi", url: "https://www.kimi.ai/", send: true },
  { id: "zai", url: "https://chat.z.ai/", send: true },
  { id: "perplexity", url: "https://www.perplexity.ai/", send: true },
  { id: "claude", url: "https://claude.ai/new", send: false },
  { id: "gemini", url: "https://gemini.google.com/app", send: true },
  { id: "grok", url: "https://grok.com/", send: false },
  { id: "copilot", url: "https://copilot.microsoft.com/", send: false },
];

const args = process.argv.slice(2);
const only = args.includes("--only")
  ? new Set(args[args.indexOf("--only") + 1].split(","))
  : undefined;
const allowSend = args.includes("--send");

const CHALLENGE_NOTE = "Cloudflare/anti-bot challenge is never bypassed";

async function probe(candidate) {
  const profile = mkdtempSync(join(tmpdir(), `webai-candidate-${candidate.id}-`));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? await context.newPage();
  const result = { id: candidate.id, url: candidate.url, note: candidate.note ?? null };
  try {
    await page.goto(candidate.url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(8_000);
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      body: document.body.innerText.slice(0, 1_500),
      composers: document.querySelectorAll("textarea, [contenteditable='true']").length,
    })).catch(() => ({ title: "", url: candidate.url, body: "", composers: 0 }));
    Object.assign(result, {
      title: pageInfo.title,
      finalUrl: pageInfo.url,
      composers: pageInfo.composers,
      landing: classify(pageInfo.body),
    });

    if (allowSend && candidate.send && result.composers > 0) {
      const marker = `TEST-${candidate.id.toUpperCase()}-OK`;
      const composer = page.locator("textarea, [contenteditable='true']").first();
      await composer.click().catch(() => {});
      await page.keyboard.insertText(`Reply with exactly: ${marker}`).catch(() => {});
      await page.keyboard.press("Enter").catch(() => {});
      const deadline = Date.now() + 60_000;
      let body = "";
      while (Date.now() < deadline) {
        body = await page.locator("body").innerText().catch(() => "");
        if (body.includes(marker) && !body.includes(`Reply with exactly: ${marker}`)) break;
        const wall = classify(body);
        if (wall !== "open" && body.length > 0) break;
        await page.waitForTimeout(2_000);
      }
      const wall = classify(body);
      const echo = body.includes(marker);
      result.turn = echo
        ? (wall === "login_wall" ? "login_wall_after_send" : "guest_reply")
        : wall !== "open" ? wall : "no_reply";
    }
  } finally {
    await context.close().catch(() => {});
    rmSync(profile, { recursive: true, force: true });
  }
  return result;
}

const results = [];
for (const candidate of CANDIDATES) {
  if (only && !only.has(candidate.id)) continue;
  const result = await probe(candidate);
  results.push(result);
  console.log(JSON.stringify(result));
}
console.log(JSON.stringify({ candidates: results }, null, 2));
