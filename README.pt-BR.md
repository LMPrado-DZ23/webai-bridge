# webai-bridge (pt-BR)

Ponte local que dirige **chats web de IA logados** em um perfil Chrome dedicado e os expõe como
endpoint **OpenAI-compatível** (`chat/completions`). Primeiro provedor admitido: **Qwen Web**
(`chat.qwen.ai`). Sem API key de provider e sem modelo local.

> **Status:** Qwen em `beta`. Exige **login interativo uma vez** no perfil dedicado; a ponte nunca lê
> cookies nem toca no seu perfil pessoal do Chrome.

## Início rápido

```bash
npm install
node src/index.mjs login qwen     # uma vez: faça login na janela do Chrome que abrir
node src/index.mjs serve          # http://127.0.0.1:8788
node src/index.mjs models
```

No Windows: `login.cmd` e `start.cmd` (porta padrão 8788).

## Endpoints

- `GET /health` — provedores e status (`ready`/`beta`/`planned`)
- `GET /v1/models` — modelos admitidos (`qwen/qwen3.7-plus`)
- `POST /v1/chat/completions` — turno; `stream: true` emite SSE + `[DONE]`

Token opcional: `WEB_AI_BRIDGE_TOKEN` protege `/v1/*`.

## Integração com o hub

Adicione em `multi-ai-web/config.json` um provider `chat` apontando para `http://127.0.0.1:8788`
(veja o exemplo no README em inglês). Depois reinicie o hub; o modelo aparece para Codex (Responses,
traduzido) e DSH (Chat, nativo).

## Limites

- **Gates humanos nunca são burlados** (confirmação de idade, CAPTCHA, MFA): a ponte falha com
  mensagem explícita e você resolve na janela de login.
- Somente texto; sem anexos/imagens; sem tool calling.
- Streaming é leitura do DOM por polling; o DOM pode mudar (`diagnose`).
- Automação de chat web pode contrariar o ToS do provedor e restringir a conta. Use suas contas,
  localmente, por sua conta e risco.

## Ordem de admissão

Qwen (beta) → Mistral → Kimi → Z.ai/GLM → Perplexity → Claude/Gemini (condicionais) → Grok/Copilot
(não admitidos). Um provedor só aparece em `/v1/models` quando o JSON dele está em `ready`/`beta`.

Licença MIT.
