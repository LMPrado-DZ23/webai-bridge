# Provider admission — webai-bridge

A provider is only visible in `/v1/models` when its JSON is `ready` or `beta`. `planned` entries are
registered (URL, login URL, candidate selectors) but hidden and refused with
`503 provider_not_ready`, so nothing unverified is presented as working.

## Status

| Provider | File | URL | Status | Next step |
| --- | --- | --- | --- | --- |
| Qwen Web | `qwen.json` | https://chat.qwen.ai/ | **beta** | user logs in once → live turn → promote to `ready` |
| Mistral Le Chat | `mistral.json` | https://chat.mistral.ai/ | planned | login + selector spike |
| Kimi | `kimi.json` | https://kimi.com/ | planned | login + selector spike |
| Z.ai / GLM | `zai.json` | https://chat.z.ai/ | planned | login + selector spike |
| Perplexity | `perplexity.json` | https://www.perplexity.ai/ | planned | login + citations/model spike |
| Claude Web | `claude.json` | https://claude.ai/new | planned (conditional) | anti-bot/spike before admission |
| Gemini Web | `gemini.json` | https://gemini.google.com/app | planned (conditional) | anti-bot/spike before admission |

Grok and Copilot are **not registered**: login/anti-bot risk with low gain. They stay out until a
concrete use case justifies a spike.

## Promoting a provider

1. Run `node src/index.mjs login <id>`: it opens a **normal Chrome** (no CDP) so Google SSO accepts
   the sign-in; finish any human gate yourself and **close the Chrome window** when done. The command
   then verifies the profile with Playwright.
2. Run `node src/index.mjs diagnose <id>`; adjust `selectors.composer`, `sendButton`, `assistant`
   and `loginButton` until they resolve on the authenticated page.
3. Send one real turn through the bridge (`POST /v1/chat/completions`) and confirm the reply.
4. Change `status` to `ready`, run `npm test`, and commit the updated JSON with the evidence in the
   commit message.

Human-verification gates (age, CAPTCHA, MFA) are never bypassed by the bridge.
