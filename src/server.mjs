import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { exposedProviders, findModel } from "./providers.mjs";

const PORT = Number(process.env.WEB_AI_BRIDGE_PORT ?? 8788);
const HOST = "127.0.0.1";
const AUTH_TOKEN = process.env.WEB_AI_BRIDGE_TOKEN ?? "";

class HttpError extends Error {
  constructor(status, type, message) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

class ProviderQueues {
  constructor() {
    this.chains = new Map();
  }

  run(providerId, task) {
    const previous = this.chains.get(providerId) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.chains.set(providerId, next.then(() => undefined, () => undefined));
    return next;
  }
}

/**
 * One HTTP bridge for every admitted web chat. Qwen is the first provider; the others are added
 * as `ready`/`beta` in providers/*.json once their DOM contract is validated.
 */
export function createBridgeServer({ providers, driverFactory, token = AUTH_TOKEN }) {
  const queues = new ProviderQueues();
  const drivers = new Map();
  const server = createServer((request, response) => {
    handle(request, response, { providers, driverFactory, token, queues, drivers }).catch(error => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendJson(response, error instanceof HttpError ? error.status : 500, {
        error: {
          type: error instanceof HttpError ? error.type : "bridge_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    });
  });
  server.bridgeQueues = queues;
  server.closeDrivers = async () => {
    for (const driver of drivers.values()) await driver.close?.().catch?.(() => {});
    drivers.clear();
  };
  return server;
}

async function handle(request, response, deps) {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      providers: deps.providers.map(provider => ({
        id: provider.id,
        label: provider.label,
        status: provider.status,
        models: provider.models.map(model => model.key),
      })),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/models") {
    requireAuth(request, deps.token);
    sendJson(response, 200, {
      object: "list",
      data: exposedProviders(deps.providers).flatMap(provider => provider.models.map(model => ({
        id: model.key,
        object: "model",
        created: 0,
        owned_by: provider.id,
        provider: provider.id,
        display_name: model.displayName,
        context_window: model.contextWindow,
      }))),
    });
    return;
  }
  if (url.pathname === "/v1/chat/completions") {
    if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST only");
    requireAuth(request, deps.token);
    const body = await readJson(request);
    const found = findModel(deps.providers, body.model);
    if (!found) throw new HttpError(404, "model_not_found", `Unknown model: ${String(body.model)}`);
    if (found.provider.status === "planned") {
      throw new HttpError(503, "provider_not_ready", `${found.provider.label} is registered but not admitted yet`);
    }
    const prompt = promptFromMessages(body.messages);
    if (!prompt) throw new HttpError(400, "invalid_request_error", "messages must contain a user message");
    const driver = await getDriver(found.provider, deps);
    if (body.stream === true) {
      await streamTurn(response, request, { driver, prompt, model: found.model.key, queues: deps.queues, providerId: found.provider.id });
    } else {
      const text = await deps.queues.run(found.provider.id, () => driver.runTurn({ prompt }));
      sendJson(response, 200, completionJson(text, found.model.key));
    }
    return;
  }
  throw new HttpError(404, "not_found", `Unknown route: ${request.method} ${url.pathname}`);
}

async function getDriver(provider, deps) {
  if (!deps.drivers.has(provider.id)) deps.drivers.set(provider.id, await deps.driverFactory(provider));
  return deps.drivers.get(provider.id);
}

async function streamTurn(response, request, { driver, prompt, model, queues, providerId }) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    "x-accel-buffering": "no",
  });
  const controller = new AbortController();
  request.on("close", () => controller.abort());
  const id = `chatcmpl-${Date.now().toString(36)}`;
  const created = Math.floor(Date.now() / 1000);
  const emit = delta => {
    response.write(`data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: null }],
    })}\n\n`);
  };
  try {
    await queues.run(providerId, () => driver.runTurn({
      prompt,
      signal: controller.signal,
      onDelta: delta => emit({ content: delta }),
    }));
    response.write(`data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n`);
    response.end("data: [DONE]\n\n");
  } catch (error) {
    response.end(`data: ${JSON.stringify({ error: { type: "bridge_error", message: error instanceof Error ? error.message : String(error) } })}\n\ndata: [DONE]\n\n`);
  }
}

function promptFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  const user = messages.filter(message => message?.role === "user").map(message => String(message.content ?? ""));
  return user.join("\n\n").trim();
}

function completionJson(text, model) {
  return {
    id: `chatcmpl-${Date.now().toString(36)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function requireAuth(request, token) {
  if (!token) return;
  const header = request.headers.authorization;
  const expected = `Bearer ${token}`;
  if (typeof header !== "string" || !safeEqual(header, expected)) {
    throw new HttpError(401, "invalid_api_key", "Missing or invalid bearer token");
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new HttpError(413, "request_too_large", "body exceeds 5 MiB");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_request_error", "invalid JSON body");
  }
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}
