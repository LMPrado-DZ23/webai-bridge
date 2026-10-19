# Third-party notices

| Component | License | Role |
| --- | --- | --- |
| [playwright-core](https://github.com/microsoft/playwright) | Apache-2.0 | Browser automation (uses the installed Google Chrome; no browser download) |
| Google Chrome | Proprietary | Browser used through the dedicated profile |
| Node.js built-ins | MIT | Runtime |

## Provenance

- Architecture and login/profile invariants follow the MIT `deepseek-web-bridge`
  (https://github.com/LMPrado-DZ23/deepseek-web-bridge).
- Provider admission and transport rules follow the local `multi-ai-web` plan (bridges as upstreams,
  web-only, human-verification gates are never bypassed).
- No provider SDK, API client, cookies or credentials are included.

## Trademarks

Qwen, Mistral, Kimi, Z.ai/GLM, Perplexity, Claude, Gemini, Grok and Copilot are trademarks of their
respective owners. This project is unofficial and not affiliated with them.
