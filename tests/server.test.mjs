import { test } from "node:test";
import assert from "node:assert/strict";
import { createBridgeServer } from "../src/server.mjs";
import { validateProvider } from "../src/providers.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

const qwen = validateProvider({
  id: "qwen",
  label: "Qwen Web",
  status: "beta",
  url: "https://example.test/",
  loginUrl: "https://example.test/login",
  models: [{ id: "qwen3.7-plus", displayName: "Qwen3.7-Plus", contextWindow: 131072 }],
  selectors: { composer: "textarea", sendButton: "button", assistant: ".answer", loginButton: "button.login" },
});

const planned = validateProvider({
  id: "mistral",
  label: "Mistral Web",
  status: "planned",
  url: "https://example.test/",
  loginUrl: "https://example.test/login",
  models: [{ id: "le-chat" }],
  selectors: { composer: "textarea", sendButton: "button", assistant: ".answer", loginButton: "button.login" },
});

const fakeDriver = {
  async runTurn({ onDelta }) {
    onDelta?.("oi");
    return "oi";
  },
  async close() {},
};

async function start() {
  const server = createBridgeServer({
    providers: [qwen, planned],
    driverFactory: async () => fakeDriver,
  });
  const port = await listen(server);
  return { server, base: `http://127.0.0.1:${port}` };
}

test("serves admitted models and hides planned providers", async () => {
  const hub = await start();
  try {
    const body = await (await fetch(`${hub.base}/v1/models`)).json();
    assert.deepEqual(body.data.map(model => model.id), ["qwen/qwen3.7-plus"]);
    const health = await (await fetch(`${hub.base}/health`)).json();
    assert.deepEqual(health.providers.map(provider => provider.id), ["qwen", "mistral"]);
  } finally {
    await close(hub.server);
  }
});

test("non-stream and stream turns use the provider driver", async () => {
  const hub = await start();
  try {
    const nonStream = await fetch(`${hub.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen/qwen3.7-plus", messages: [{ role: "user", content: "oi" }] }),
    });
    assert.equal(nonStream.status, 200);
    assert.equal((await nonStream.json()).choices[0].message.content, "oi");

    const streamed = await fetch(`${hub.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen/qwen3.7-plus", stream: true, messages: [{ role: "user", content: "oi" }] }),
    });
    assert.equal(streamed.status, 200);
    const text = await streamed.text();
    assert.match(text, /"delta":\{"content":"oi"\}/);
    assert.match(text, /data: \[DONE\]/);
  } finally {
    await close(hub.server);
  }
});

test("unknown and planned models fail closed", async () => {
  const hub = await start();
  try {
    const unknown = await fetch(`${hub.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "nope/nope", messages: [] }),
    });
    assert.equal(unknown.status, 404);
    const plannedModel = await fetch(`${hub.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "mistral/le-chat", messages: [{ role: "user", content: "oi" }] }),
    });
    assert.equal(plannedModel.status, 503);
  } finally {
    await close(hub.server);
  }
});
