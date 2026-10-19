import { chromium } from "playwright-core";

/**
 * Drives one provider's web chat through a dedicated persistent Chrome profile.
 *
 * It never touches the personal Chrome profile and never reads cookies: the profile directory
 * passed in is the only browser state involved.
 */
export class WebChatDriver {
  constructor({ provider, profileDir, chromePath, headless = true, pageFactory }) {
    this.provider = provider;
    this.profileDir = profileDir;
    this.chromePath = chromePath;
    this.headless = headless;
    this.pageFactory = pageFactory;
    this.context = null;
    this.page = null;
  }

  async open({ headed = false } = {}) {
    if (this.page) return this.page;
    if (this.pageFactory) {
      this.page = await this.pageFactory(this.provider);
      return this.page;
    }
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      executablePath: this.chromePath,
      headless: headed ? false : this.headless,
      args: ["--no-first-run", "--no-default-browser-check"],
      viewport: { width: 1280, height: 900 },
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    await this.page.goto(this.provider.url, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState?.("networkidle", { timeout: 20_000 }).catch(() => {});
    await this.page.locator(this.provider.selectors.composer).first()
      .waitFor({ timeout: 30_000 }).catch(() => {});
    return this.page;
  }

  async login({ timeoutMs = this.provider.timeouts.loginMs } = {}) {
    const page = await this.open({ headed: true });
    await page.goto(this.provider.loginUrl, { waitUntil: "domcontentloaded" });
    process.stdout.write(
      `Log in to ${this.provider.label} in the opened Chrome window.\n`
        + `Waiting up to ${Math.round(timeoutMs / 60_000)} minute(s) for a logged-in composer...\n`,
    );
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const composer = await page.locator(this.provider.selectors.composer).count().catch(() => 0);
      const loginButtons = await page.locator(this.provider.selectors.loginButton).count().catch(() => 0);
      if (composer > 0 && loginButtons === 0) return true;
      await page.waitForTimeout(1_500);
    }
    throw new Error(`Login timed out for ${this.provider.label}`);
  }

  async isLoggedIn() {
    const page = await this.open();
    const composer = await page.locator(this.provider.selectors.composer).count().catch(() => 0);
    const loginButtons = await page.locator(this.provider.selectors.loginButton).count().catch(() => 0);
    return composer > 0 && loginButtons === 0;
  }

  async diagnose() {
    const page = await this.open();
    const counts = {};
    for (const [name, selector] of Object.entries(this.provider.selectors)) {
      if (!selector) continue;
      counts[name] = await page.locator(selector).count().catch(() => -1);
    }
    const body = await page.locator("body").innerText().catch(() => "");
    return {
      provider: this.provider.id,
      url: page.url?.() ?? this.provider.url,
      title: await page.title?.().catch?.(() => "") ?? "",
      counts,
      gate: detectGate(body),
      loggedIn: await this.isLoggedIn().catch(() => false),
    };
  }

  /** Human-verification gates are never bypassed; the login window is where they get completed. */
  async assertNoGate() {
    const body = await this.page?.locator("body").innerText().catch(() => "");
    const gate = detectGate(body ?? "");
    if (gate) {
      throw new Error(`${this.provider.label} requires human verification (${gate}). Complete it in the login window, then retry.`);
    }
  }

  /**
   * Sends one prompt and streams the assistant message by polling the rendered text.
   * Web UIs stream into the DOM; polling is the stable cross-provider strategy.
   */
  async runTurn({ prompt, onDelta, signal }) {
    const page = await this.open();
    if (!await this.isLoggedIn()) {
      throw new Error(`Not logged in to ${this.provider.label}. Run: node src/index.mjs login ${this.provider.id}`);
    }
    await this.assertNoGate();
    await page.locator(this.provider.selectors.composer).first().click();
    await page.keyboard.insertText(prompt);
    await page.keyboard.press("Enter");

    const assistant = page.locator(this.provider.selectors.assistant).last();
    try {
      await assistant.waitFor({ timeout: 60_000 });
    } catch {
      // Some composers need an explicit send click instead of Enter.
      await page.locator(this.provider.selectors.sendButton).first().click().catch(() => {});
      await assistant.waitFor({ timeout: 30_000 });
    }

    let previous = "";
    let stableSince = Date.now();
    const started = Date.now();
    while (Date.now() - started < this.provider.timeouts.replyMs) {
      if (signal?.aborted) throw new Error("Turn cancelled");
      const text = (await assistant.innerText().catch(() => "")) ?? "";
      if (text.length > previous.length) {
        onDelta?.(text.slice(previous.length));
        previous = text;
        stableSince = Date.now();
      } else if (previous && Date.now() - stableSince >= this.provider.timeouts.stableMs) {
        break;
      }
      await page.waitForTimeout(250);
    }
    return previous;
  }

  async close() {
    await this.context?.close().catch(() => {});
    this.context = null;
    this.page = null;
  }
}

function detectGate(body) {
  const patterns = [
    /confirme sua idade/i,
    /confirme que voc[eê] [eé] humano/i,
    /verify you are human/i,
    /are you a robot/i,
    /captcha/i,
  ];
  return patterns.find(pattern => pattern.test(body))?.toString() ?? null;
}
