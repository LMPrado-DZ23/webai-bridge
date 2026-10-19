# Provider admission — webai-bridge

A provider is only visible in `/v1/models` when its JSON is `ready` or `beta`. `planned` entries are
registered (URL, login URL, candidate selectors) but hidden and refused with
`503 provider_not_ready`, so nothing unverified is presented as working.

## Status (measured 2026-10-19; full evidence in `docs/TEST-MATRIX.md`)

| Provider | File | URL | Status | Evidence / next step |
| --- | --- | --- | --- | --- |
| **Qwen Web** | `qwen.json` | https://chat.qwen.ai/ | **ready** | `QWEN-ONE`/`QWEN-TWO` (bridge) + `HUB-QWEN-CHAT`/`HUB-QWEN-RESP` (hub) |
| **Kimi** | `kimi.json` | https://www.kimi.ai/ | **ready** | `KIMI-BRIDGE`/`KIMI-STREAM` + `HUB-KIMI-CHAT`/`HUB-KIMI-RESP` |
| **Gemini** | `gemini.json` | https://gemini.google.com/app | **ready** | `GEMINI-OK`/`GEMINI-STREAM` + `HUB-GEMINI-CHAT`/`HUB-GEMINI-RESP` |
| **Perplexity** | `perplexity.json` | https://www.perplexity.ai/ | **ready** | `PERPLEXITY-OK`/`PERPLEXITY-STREAM` + `HUB-PERPLEXITY-CHAT`/`HUB-PERPLEXITY-RESP`; site-selected model is labelled in `displayName` |
| ~~Mistral Le Chat~~ | — | https://chat.mistral.ai/ | **excluded** | Cloudflare bot challenge; no bypass attempted (removed) |
| ~~Claude Web~~ | — | https://claude.ai/new | **excluded** | Cloudflare bot challenge; no bypass attempted (removed) |
| ~~Z.ai / GLM~~ | — | https://chat.z.ai/ | **excluded** | Slider security verification ("drag the slider to complete the puzzle"); no bypass attempted (removed) |
| ~~Grok~~ | — | https://grok.com/ | **not admitted** | Login wall; anti-bot risk, low gain |
| ~~Copilot~~ | — | https://copilot.microsoft.com/ | **not admitted** | Sign-in wall; anti-bot risk |

Cloudflare challenges and CAPTCHA sliders are anti-bot gates. Per project rules they are **never**
bypassed, so Mistral, Claude and Z.ai are left out. Grok and Copilot remain unregistered.

## Promoting a provider

1. Run `node src/index.mjs login <id>`: it opens a **normal Chrome** (no CDP) so Google SSO accepts
   the sign-in; finish any human gate yourself and **close the Chrome window** when done. The command
   then verifies the profile with Playwright (waiting for the SPA to boot).
2. Run `node src/index.mjs diagnose <id>`; adjust `selectors.composer`, `sendButton`, `assistant`
   and `loginButton` until they resolve on the authenticated page.
3. Send one real turn through the bridge (`POST /v1/chat/completions`) and confirm the reply.
4. Change `status` to `ready`, run `npm test`, and commit the updated JSON with the evidence in the
   commit message.

Human-verification gates (age, CAPTCHA, MFA, Cloudflare, sliders) are never bypassed by the bridge.
