# Candidate test matrix (measured 2026-10-19)

Repeatable probe:

```bash
node scripts/probe-candidates.mjs                 # landing-page classification only
node scripts/probe-candidates.mjs --send          # + one guest turn attempt per accessible site
node scripts/probe-candidates.mjs --send --only kimi,zai
```

The script opens a **fresh throwaway profile per site**, never a personal profile, and never tries to
solve a CAPTCHA/Cloudflare/login wall. Results below are from this host.

| Candidate | Landing | Send attempt | Outcome | Final action |
| --- | --- | --- | --- | --- |
| **Qwen Web** | composer | live turn | **`QWEN-ONE` / `QWEN-TWO`** | ✅ ready in bridge + hub |
| **Kimi** | composer + login links | login modal | **`KIMI-BRIDGE` / `KIMI-STREAM`** after native login | ✅ ready in bridge + hub |
| **Gemini** | composer + login page | Google login | **`GEMINI-OK` / `GEMINI-STREAM`** after native login | ✅ ready in bridge + hub |
| **Perplexity** | composer + "Entrar" | logged-in turn | **`PERPLEXITY-OK` / `PERPLEXITY-STREAM`** | ✅ ready in bridge + hub (site-selected model labelled) |
| Mistral Le Chat | Cloudflare challenge | not attempted | ⛔ anti-bot | **Excluded** (no bypass) |
| Claude Web | Cloudflare challenge | not attempted | ⛔ anti-bot | **Excluded** (no bypass) |
| Z.ai / GLM | composer | slider verification shown | ⛔ anti-bot ("Please drag the slider to complete the puzzle") | **Excluded** (no bypass) |
| Grok | composer + login | not attempted | 🔑 login wall | Not admitted |
| Copilot | sign-in page | not attempted | 🔑 login wall | Not admitted |

Notes:

- `login_wall` is a conservative keyword classification (nav text such as "Entrar" counts). Qwen,
  Kimi, Gemini and Perplexity were validated end-to-end after their native login.
- Cloudflare's "verificação de segurança" and Z.ai's slider are anti-bot gates. Per project rules
  they are **never** bypassed; those providers stay out.
- A bare "captcha" mention on a long page is not a gate; `detectGateText` only flags it on small
  challenge pages, and the driver also ignores it when a chat composer is rendered.

## Second wave (2026-10-19, new candidates)

| Candidate | Landing | Send attempt | Outcome | Final action |
| --- | --- | --- | --- | --- |
| **MiMo Studio** (aistudio.xiaomimimo.com) | Xiaomi Account sign-in (Google option) | not attempted | 🔑 login required | Native login window opened; pending validation |
| HuggingChat | composer | blocked | ⛔ CloudFront "Request blocked" | Excluded |
| Poe | Cloudflare challenge | not attempted | ⛔ anti-bot | Excluded |
| Meta AI | login page | not attempted | 🔑 login wall | Candidate (not started) |
| Doubao | region ban page | not attempted | ⛔ region-restricted | Excluded |
| Ernie (Baidu) | login wall | not attempted | 🔑 login wall | Candidate (not started) |
