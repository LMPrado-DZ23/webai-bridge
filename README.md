# webai-bridge

Local bridge that drives **logged-in web AI chats** through a dedicated Chrome profile and exposes
them as an **OpenAI-compatible** `chat/completions` endpoint. First admitted provider: **Qwen Web**
(`chat.qwen.ai`). No provider API keys, no local models.

> 📘 **Guia completo de uso:** [`docs/USAGE.md`](docs/USAGE.md) — login por provedor, endpoints,
> como adicionar um provedor novo, regras de gate e diagnóstico.

## Relação com o hub `multi-ai-web`

Esta ponte **funciona sozinha**: qualquer cliente OpenAI pode chamar
`http://127.0.0.1:8788/v1/chat/completions` diretamente.

Ela também é a **dependência dos 7 provedores web** do hub
[`multi-ai-web`](https://github.com/LMPrado-DZ23/multi-ai-web): o hub sozinho não fala com sites —
sem esta ponte no ar (`:8788`), Qwen, Kimi, Gemini, Perplexity, MiMo, Meta e Grok ficam
`unreachable`. O catálogo completo do hub também usa:

- [`deepseek-web-bridge`](https://github.com/LMPrado-DZ23/deepseek-web-bridge) — `:8787` (DeepSeek Web)
- [`codex-chatgpt-web`](https://github.com/LMPrado-DZ23/codex-chatgpt-web) — `:17841` (ChatGPT Web)

Instalação mínima para usar o hub: `multi-ai-web` **+** `webai-bridge`.

> **Stable release 1.0.0:** `ready` providers — **Qwen, Kimi, Gemini, Perplexity, MiMo Studio,
> Meta AI and Grok** (13/13 tests). Each needs a one-time interactive login in its own Chrome
> profile; the bridge never reads cookies from, or touches, your personal Chrome profile.
> Excluded without bypass: Mistral/Claude/Perchance/Craiyon/Poe (Cloudflare), Z.ai (slider
> CAPTCHA), HuggingChat (CloudFront), Copilot (login does not persist).

## Quick start

```bash
npm install
node src/index.mjs login qwen     # once: sign in in the normal Chrome window, then close it
node src/index.mjs serve          # http://127.0.0.1:8788
node src/index.mjs models
```

`login` opens a **normal Chrome** (not automation): Google SSO rejects CDP-driven browsers, so the
sign-in happens without Playwright attached. Close the Chrome window when done; the bridge then
verifies the profile and later reuses it for automation. `login.cmd` and `start.cmd` do the same on
Windows (default port 8788).

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /health` | providers and status (`ready`/`beta`/`planned`) |
| `GET /v1/models` | admitted models (`qwen/qwen3.7-plus`) |
| `POST /v1/chat/completions` | one turn; `stream: true` emits SSE chunks + `[DONE]` |

Optional bearer token: set `WEB_AI_BRIDGE_TOKEN`; `/v1/*` then requires `Authorization: Bearer …`.

## Commands

```bash
node src/index.mjs login [provider]     # headed Chrome, dedicated profile, waits for login
node src/index.mjs diagnose [provider]  # selector counts + gate detection for the current profile
node src/index.mjs probe [provider]     # is the profile logged in?
node src/index.mjs serve [--port N]     # default 8788
node src/index.mjs models
```

## Using it from the multi-AI hub

Add the bridge as a `chat` provider in `multi-ai-web/config.json`:

```json
{
  "id": "qwen-web",
  "label": "Qwen Web",
  "baseUrl": "http://127.0.0.1:8788",
  "dialect": "chat",
  "healthPath": "/health",
  "models": [{
    "id": "qwen3.7-plus",
    "hubId": "qwen-web/qwen3.7-plus",
    "upstreamModel": "qwen/qwen3.7-plus",
    "displayName": "Qwen Web (3.7-Plus)",
    "contextWindow": 131072
  }]
}
```

Restart the hub; the model then appears to Codex (Responses, translated) and DSH/Open WebUI (Chat,
native).

## Admission order (most feasible first)

| # | Provider | Status | Notes |
| --- | --- | --- | --- |
| 1 | Qwen Web | ✅ ready | validated: `QWEN-ONE`/`QWEN-TWO` + `HUB-QWEN-*` |
| 2 | Kimi | ✅ ready | validated: `KIMI-BRIDGE`/`KIMI-STREAM` + `HUB-KIMI-*` |
| 3 | Gemini | ✅ ready | validated: `GEMINI-OK`/`GEMINI-STREAM` + `HUB-GEMINI-*` |
| 4 | Perplexity | ✅ ready | validated: `PERPLEXITY-OK`/`PERPLEXITY-STREAM` + `HUB-PERPLEXITY-*`; site-selected model is labelled |
| 5 | Mistral Le Chat | ⛔ excluded | Cloudflare bot challenge; never bypassed |
| 6 | Claude Web | ⛔ excluded | Cloudflare bot challenge; never bypassed |
| 7 | Z.ai / GLM | ⛔ excluded | slider CAPTCHA; never bypassed |
| 8 | Grok, Copilot | 🚫 not admitted | login/anti-bot risk, low gain |

A provider is only exposed when its JSON moves to `ready`/`beta`; `planned` entries are registered
but hidden from `/v1/models` and refuse turns with `503 provider_not_ready`.

## Limits

- **Human-verification gates are never bypassed** (age confirmation, CAPTCHA, MFA). If a gate
  appears, the bridge fails with an explicit message and you complete it in the login window.
- Text only; attachments/images are not sent. No tool calling.
- Streaming is DOM polling: the assistant message is read as it is rendered.
- The site DOM can change; run `diagnose` after a provider update.
- Automating a web chat can conflict with the provider's Terms of Service and risks account
  restrictions. Use your own accounts locally, at your own risk.

## Tests

```bash
npm test    # provider validation, driver polling with a fake page, bridge endpoints
```

## Provenance

Architecture follows the MIT `deepseek-web-bridge` and the `multi-ai-web` hub plan (bridges as
upstreams). Browser automation uses `playwright-core` (Apache-2.0) with the system Chrome; no
browser download. See `THIRD_PARTY_NOTICES.md`.
