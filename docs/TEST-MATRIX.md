# Candidate test matrix (measured 2026-10-19)

Repeatable probe:

```bash
node scripts/probe-candidates.mjs                 # landing-page classification only
node scripts/probe-candidates.mjs --send          # + one guest turn attempt per accessible site
node scripts/probe-candidates.mjs --send --only zai,perplexity
```

The script opens a **fresh throwaway profile per site**, never a personal profile, and never tries to
solve a CAPTCHA/Cloudflare/login wall. Results below are from this host.

| Candidate | Landing | Guest turn | Classification | Action |
| --- | --- | --- | --- | --- |
| **Qwen Web** | composer | **`QWEN-ONE` / `QWEN-TWO` (live)** | ✅ ready | Admitted; validated through the bridge and the hub (`HUB-QWEN-CHAT`, `HUB-QWEN-RESP`) |
| Mistral Le Chat | Cloudflare challenge | not attempted | ⛔ anti-bot | **Excluded** (no bypass attempted) |
| Claude Web | Cloudflare challenge | not attempted | ⛔ anti-bot | **Excluded** (no bypass attempted) |
| Kimi (kimi.ai) | composer + login links | login modal after send | 🔑 login required | Native login window opened; pending validation |
| Z.ai / GLM | composer + login links | `login_wall_after_send` | 🔑 login required | Native login pending |
| Perplexity | composer + "Entrar" | `login_wall` | 🔑 login required | Native login pending |
| Gemini | composer count 2, login page | not reached (login page) | 🔑 login required | Native login pending |
| Grok | composer + login | not attempted | 🔑 login wall | Not admitted (login/anti-bot, low gain) |
| Copilot | sign-in page | not attempted | 🔑 login wall | Not admitted |

Notes:

- `login_wall` is a conservative keyword classification (nav text such as "Entrar" counts). For Kimi
  and Z.ai the send attempt confirmed a real login requirement; Perplexity/Gemini were not sent
  because the page itself is a sign-in surface on this host.
- Cloudflare's "verificação de segurança" is an anti-bot gate. Per project rules it is **never**
  bypassed; those providers stay out.
- Qwen is the only candidate validated end-to-end from this host so far.
