import { test } from "node:test";
import assert from "node:assert/strict";
import { WebChatDriver } from "../src/driver.mjs";
import { validateProvider } from "../src/providers.mjs";

function fakePage({ composerCount = 1, loginCount = 0, pieces = ["Olá", " mundo"] } = {}) {
  let text = "";
  let step = 0;
  const isComposer = selector => selector.includes("contenteditable") || selector.includes("textarea");
  const isAssistant = selector => selector.includes("markdown") || selector.includes("assistant");
  const isLogin = selector => selector.includes("login");
  return {
    async goto() {},
    async waitForTimeout() {
      if (step < pieces.length) {
        text += pieces[step];
        step += 1;
      }
    },
    keyboard: {
      async insertText() {},
      async press() {},
    },
    locator(selector) {
      const count = isComposer(selector)
        ? composerCount
        : isLogin(selector)
          ? loginCount
          : isAssistant(selector) ? 1 : 0;
      const locator = {
        first() { return locator; },
        last() { return locator; },
        async count() { return count; },
        async click() {},
        async waitFor() {
          if (count === 0) throw new Error(`selector not found: ${selector}`);
        },
        async innerText() { return isAssistant(selector) ? text : ""; },
      };
      return locator;
    },
    url() { return "https://example.test/"; },
    async title() { return "Fake page"; },
  };
}

const provider = validateProvider({
  id: "demo",
  label: "Demo Web",
  status: "beta",
  url: "https://example.test/",
  loginUrl: "https://example.test/login",
  models: [{ id: "demo" }],
  selectors: { composer: "textarea", sendButton: "button.send", assistant: ".markdown-body", loginButton: "button.login" },
  timeouts: { replyMs: 2_000, stableMs: 10 },
});

test("streams assistant text by polling the rendered DOM", async () => {
  const driver = new WebChatDriver({ provider, profileDir: "unused", chromePath: "unused", pageFactory: async () => fakePage() });
  const deltas = [];
  const text = await driver.runTurn({ prompt: "oi", onDelta: delta => deltas.push(delta) });
  assert.equal(text, "Olá mundo");
  assert.deepEqual(deltas, ["Olá", " mundo"]);
});

test("refuses to send when the profile is not logged in", async () => {
  const driver = new WebChatDriver({
    provider,
    profileDir: "unused",
    chromePath: "unused",
    pageFactory: async () => fakePage({ composerCount: 0, loginCount: 1 }),
  });
  await assert.rejects(() => driver.runTurn({ prompt: "oi" }), /Not logged in/);
  assert.equal(await driver.isLoggedIn(), false);
});
