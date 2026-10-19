#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadProviders, findProvider, exposedProviders } from "./providers.mjs";
import { WebChatDriver } from "./driver.mjs";
import { createBridgeServer } from "./server.mjs";

const USAGE = `webai-bridge 0.1.0

Usage:
  webai-bridge serve [--port N]              Start the OpenAI-compatible bridge (default :8788)
  webai-bridge login [provider]              Open a headed Chrome to log in once (dedicated profile)
  webai-bridge diagnose [provider]           Dump selector counts for the current profile
  webai-bridge probe [provider]              Report whether the profile looks logged in
  webai-bridge models                        List admitted models

Environment:
  WEB_AI_BRIDGE_PORT     Default port (8788)
  WEB_AI_BRIDGE_TOKEN    Optional bearer token required by /v1/*
  WEB_AI_PROFILE_DIR     Base directory for dedicated Chrome profiles
  WEB_AI_CHROME          Chrome/Chromium executable (default: system Chrome)
`;

const args = process.argv.slice(2);
const command = args.shift() ?? "help";
const providers = loadProviders();
const providerId = args[0] && !args[0].startsWith("--") ? args.shift() : (providers[0]?.id ?? "qwen");

function profileDir(provider) {
  const base = process.env.WEB_AI_PROFILE_DIR
    ?? join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? process.cwd(), "AppData", "Local"), "dsh-webai");
  return join(base, `${provider.id}-profile`);
}

function chromePath() {
  if (process.env.WEB_AI_CHROME) return process.env.WEB_AI_CHROME;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? "chrome";
}

function driverFor(provider) {
  return new WebChatDriver({
    provider,
    profileDir: profileDir(provider),
    chromePath: chromePath(),
  });
}

try {
  if (command === "help" || command === "-h" || command === "--help") {
    process.stdout.write(USAGE);
  } else if (command === "models") {
    process.stdout.write(`${JSON.stringify(exposedProviders(providers).flatMap(provider => provider.models), null, 2)}\n`);
  } else if (command === "login" || command === "diagnose" || command === "probe") {
    const provider = findProvider(providers, providerId);
    const driver = driverFor(provider);
    if (command === "login") {
      await driver.login();
      process.stdout.write(`Logged in to ${provider.label}. Profile: ${profileDir(provider)}\n`);
    } else if (command === "diagnose") {
      const report = await driver.diagnose();
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      const loggedIn = await driver.isLoggedIn();
      process.stdout.write(`${JSON.stringify({ provider: provider.id, loggedIn }, null, 2)}\n`);
      if (!loggedIn) process.exitCode = 1;
    }
    await driver.close();
  } else if (command === "serve") {
    const portIndex = args.indexOf("--port");
    const port = portIndex >= 0 ? Number(args[portIndex + 1]) : Number(process.env.WEB_AI_BRIDGE_PORT ?? 8788);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("--port must be 1..65535");
    const server = createBridgeServer({
      providers,
      driverFactory: async provider => driverFor(provider),
    });
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(
        `webai-bridge 0.1.0 listening on http://127.0.0.1:${port}/v1 (`
          + `${exposedProviders(providers).length} provider(s))\n`,
      );
    });
    const shutdown = async () => {
      await server.closeDrivers();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    throw new Error(`Unknown command: ${command}\n\n${USAGE}`);
  }
} catch (error) {
  process.stderr.write(`webai-bridge: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
