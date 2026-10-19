# Provider admission — webai-bridge

A provider is only visible in `/v1/models` when its JSON is `ready` or `beta`. `planned` entries are
registered (URL, login URL, candidate selectors) but hidden and refused with
`503 provider_not_ready`, so nothing unverified is presented as working.

## Status (measured 2026-10-19; full evidence in `docs/TEST-MATRIX.md`)

| Provider | File | URL | Status | Evidence / next step |
| --- | --- | --- | --- | --- |
| **Qwen Web** | `qwen.json` | https://chat.qwen.ai/ | **ready** | Live: `QWEN-ONE`/`QWEN-TWO` in the bridge, `HUB-QWEN-CHAT`/`HUB-QWEN-RESP` in the hub |
| Kimi | `kimi.json` | https://www.kimi.ai/ | planned | Guest send opens a login modal → native login pending |
| Z.ai / GLM | `zai.json` | https://chat.z.ai/ | planned | `login_wall_after_send` → native login pending |
| Perplexity | `perplexity.json` | https://www.perplexity.ai/ | planned | `login_wall` on this host → native login pending |
| Gemini | `gemini.json` | https://gemini.google.com/app | planned | Login page; Google native login pending |
| ~~Mistral Le Chat~~ | — | https://chat.mistral.ai/ | **excluded** | Cloudflare bot challenge; no bypass attempted (removed) |
| ~~Claude Web~~ | — | https://claude.ai/new | **excluded** | Cloudflare bot challenge; no bypass attempted (removed) |
| ~~Grok~~ | — | https://grok.com/ | **not admitted** | Login wall; anti-bot risk, low gain |
| ~~Copilot~~ | — | https://copilot.microsoft.com/ | **not admitted** | Sign-in wall; anti-bot risk, low gain |

Cloudflare "verificação de segurança" is an anti-bot gate. Per project rules it is **never** bypassed,
so Mistral and Claude are left out. Grok and Copilot remain unregistered.

## Promoting a provider

1. Run `node src/index.mjs login <id>`: it opens a **normal Chrome** (no CDP) so Google SSO accepts
   the sign-in; finish any human gate yourself and **close the Chrome window** when done. The command
   then verifies the profile with Playwright.
2. Run `node src/index.mjs diagnose <id>`; adjust `selectors.composer`, `sendButton`, `assistant`
   and `loginButton` until they resolve on the authenticated page.
3. Send one real turn through the bridge (`POST /v1/chat/completions`) and confirm the reply.
4. Change `status` to `ready`, run `npm test`, and commit the updated JSON with the evidence in the
   commit message.

Human-verification gates (age, CAPTCHA, MFA, Cloudflare) are never bypassed by the bridge.
