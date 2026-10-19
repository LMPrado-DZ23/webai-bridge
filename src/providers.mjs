import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const PROVIDER_STATUSES = new Set(["ready", "beta", "planned"]);

export function loadProviders(directory = fileURLToPath(new URL("../providers/", import.meta.url))) {
  const providers = readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => {
      // Editors on Windows may add a UTF-8 BOM; JSON.parse rejects it.
      const text = readFileSync(join(directory, file), "utf8").replace(/^\uFEFF/, "");
      return validateProvider(JSON.parse(text), file);
    });
  const ids = new Set();
  for (const provider of providers) {
    if (ids.has(provider.id)) throw new Error(`provider id ${provider.id} is duplicated`);
    ids.add(provider.id);
  }
  return providers;
}

export function validateProvider(raw, source = "provider") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${source} must be an object`);
  if (typeof raw.id !== "string" || !/^[a-z][a-z0-9-]{1,30}$/.test(raw.id)) throw new Error(`${source}.id is invalid`);
  if (typeof raw.label !== "string" || !raw.label.trim()) throw new Error(`${source}.label is invalid`);
  if (!PROVIDER_STATUSES.has(raw.status)) throw new Error(`${source}.status must be ready|beta|planned`);
  for (const key of ["url", "loginUrl"]) {
    if (typeof raw[key] !== "string" || !isHttpUrl(raw[key])) throw new Error(`${source}.${key} must be an http(s) URL`);
  }
  if (!Array.isArray(raw.models) || raw.models.length === 0) throw new Error(`${source}.models must be non-empty`);
  const models = raw.models.map((model, index) => {
    if (!model || typeof model !== "object" || Array.isArray(model)) throw new Error(`${source}.models[${index}] must be an object`);
    if (typeof model.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,60}$/.test(model.id)) {
      throw new Error(`${source}.models[${index}].id is invalid`);
    }
    return {
      id: model.id,
      key: `${raw.id}/${model.id}`,
      displayName: typeof model.displayName === "string" && model.displayName.trim()
        ? model.displayName.trim()
        : `${raw.label} (${model.id})`,
      contextWindow: Number.isSafeInteger(model.contextWindow) && model.contextWindow > 0 ? model.contextWindow : null,
    };
  });
  if (!raw.selectors || typeof raw.selectors !== "object" || Array.isArray(raw.selectors)) {
    throw new Error(`${source}.selectors must be an object`);
  }
  for (const key of ["composer", "sendButton", "assistant", "loginButton"]) {
    if (typeof raw.selectors[key] !== "string" || !raw.selectors[key].trim()) {
      throw new Error(`${source}.selectors.${key} is required`);
    }
  }
  const timeouts = raw.timeouts ?? {};
  return {
    id: raw.id,
    label: raw.label,
    status: raw.status,
    url: raw.url,
    loginUrl: raw.loginUrl,
    models,
    selectors: {
      composer: raw.selectors.composer,
      sendButton: raw.selectors.sendButton,
      assistant: raw.selectors.assistant,
      loginButton: raw.selectors.loginButton,
      stopButton: raw.selectors.stopButton ?? "",
      completion: raw.selectors.completion ?? "",
    },
    timeouts: {
      loginMs: Number.isSafeInteger(timeouts.loginMs) ? timeouts.loginMs : 600_000,
      replyMs: Number.isSafeInteger(timeouts.replyMs) ? timeouts.replyMs : 180_000,
      stableMs: Number.isSafeInteger(timeouts.stableMs) ? timeouts.stableMs : 1_800,
    },
  };
}

export function exposedProviders(providers) {
  return providers.filter(provider => provider.status === "ready" || provider.status === "beta");
}

export function findProvider(providers, id) {
  const provider = providers.find(candidate => candidate.id === id);
  if (!provider) throw new Error(`Unknown provider: ${id}. Known: ${providers.map(item => item.id).join(", ")}`);
  return provider;
}

export function findModel(providers, key) {
  for (const provider of providers) {
    const model = provider.models.find(candidate => candidate.key === key);
    if (model) return { provider, model };
  }
  return undefined;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
