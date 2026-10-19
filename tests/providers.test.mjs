import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProviders, validateProvider, exposedProviders, findModel } from "../src/providers.mjs";

test("loads the Qwen provider and exposes it as ready", () => {
  const providers = loadProviders();
  const qwen = providers.find(provider => provider.id === "qwen");
  assert.ok(qwen);
  assert.equal(qwen.status, "ready");
  assert.equal(qwen.models[0].key, "qwen/qwen3.7-plus");
  assert.equal(qwen.timeouts.loginMs, 1_800_000);
  assert.deepEqual(exposedProviders(providers).map(provider => provider.id), ["qwen"]);
  assert.equal(findModel(providers, "qwen/qwen3.7-plus").provider.id, "qwen");
  assert.equal(findModel(providers, "qwen/unknown"), undefined);
});

test("rejects malformed provider definitions", () => {
  const base = {
    id: "demo",
    label: "Demo",
    status: "beta",
    url: "https://example.test/",
    loginUrl: "https://example.test/login",
    models: [{ id: "demo" }],
    selectors: { composer: "textarea", sendButton: "button", assistant: ".answer", loginButton: "button.login" },
  };
  assert.throws(() => validateProvider({ ...base, status: "enabled" }), /status/);
  assert.throws(() => validateProvider({ ...base, url: "ftp://x" }), /http/);
  assert.throws(() => validateProvider({ ...base, selectors: { ...base.selectors, assistant: "" } }), /assistant/);
  assert.throws(() => validateProvider({ ...base, models: [] }), /models/);
  assert.doesNotThrow(() => validateProvider(base));
});

test("planned providers are registered but never exposed", () => {
  const providers = loadProviders();
  assert.deepEqual(providers.map(provider => provider.id).sort(), [
    "claude", "gemini", "kimi", "mistral", "perplexity", "qwen", "zai",
  ]);
  assert.deepEqual(exposedProviders(providers).map(provider => provider.id), ["qwen"]);
});
