# Guia de uso — webai-bridge 1.0.0

Ponte local que dirige **chats web logados** num perfil Chrome dedicado e os expõe como endpoint
OpenAI-compatível (`/v1/chat/completions`). Este guia cobre instalação, login, provedores, adição de
um novo provedor e os erros mais comuns.

---

## 1. Requisitos

- Node.js 20+ (testado com 24)
- Google Chrome em `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Windows (os comandos abaixo são PowerShell)

Porta padrão: **8788** (loopback).

---

## 2. Instalação

```powershell
git clone https://github.com/LMPrado-DZ23/webai-bridge
cd webai-bridge
npm install
npm test          # 13/13
```

---

## 3. Subir a ponte

```powershell
.\start.cmd
# ou: node src/index.mjs serve
# health: http://127.0.0.1:8788/health
```

Com o hub `multi-ai-web` rodando, ele consome esta ponte em `http://127.0.0.1:8788`.

---

## 4. Provedores e login

| Provedor | ID | Estado | Modelo exposto |
| --- | --- | --- | --- |
| Qwen Web | `qwen` | ready | `qwen/qwen3.7-plus` |
| Kimi | `kimi` | ready | `kimi/kimi-k2` |
| Gemini | `gemini` | ready | `gemini/gemini-pro` |
| Perplexity | `perplexity` | ready | `perplexity/perplexity-web` |
| MiMo Studio | `mimo` | ready | `mimo/mimo-v2.6` |
| Meta AI | `meta` | ready | `meta/meta-ai` |
| Grok | `grok` | ready | `grok/grok-web` |

Cada provedor usa um perfil Chrome **dedicado** (`%LOCALAPPDATA%\dsh-webai\<id>-profile`). O login
é feito uma vez, em janela normal do Chrome (não CDP), para o Google SSO aceitar:

```powershell
.\login.cmd qwen
# a janela abre no site do provedor; faça o login, espere a caixa de mensagem aparecer
# e FECHE a janela por completo
```

Depois valide os seletores:

```powershell
node src/index.mjs diagnose qwen
```

Sessão expirou → repita o `login.cmd` do provedor.

### Gates humanos

Cloudflare, slider CAPTCHA, confirmação de idade e login wall **nunca** são contornados. Se o site
exigir um gate, o provedor fica `planned`/excluído até você passar o gate manualmente na janela.

---

## 5. Endpoints

```powershell
# lista de modelos expostos (ready/beta)
Invoke-RestMethod http://127.0.0.1:8788/v1/models

# turno de chat
$body = @{
  model = "qwen/qwen3.7-plus"
  stream = $false
  messages = @(@{ role = "user"; content = "Olá!" })
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri http://127.0.0.1:8788/v1/chat/completions `
  -Method POST -ContentType application/json -Body $body
```

Streaming (`"stream": true`) devolve SSE com deltas e `[DONE]`.

---

## 6. Adicionar um provedor novo

1. Crie `providers/<id>.json` (sem BOM):

```json
{
  "id": "exemplo",
  "label": "Exemplo",
  "status": "planned",
  "url": "https://exemplo.ai/",
  "loginUrl": "https://exemplo.ai/",
  "models": [{ "id": "exemplo-web", "displayName": "Exemplo (web)" }],
  "selectors": {
    "composer": "textarea, [contenteditable='true']",
    "sendButton": "button[aria-label*='Send' i], button[type='submit']",
    "assistant": "[data-role='assistant'], .markdown, [class*='markdown']",
    "loginButton": "button:has-text('Sign in'), a:has-text('Sign in')"
  },
  "timeouts": { "replyMs": 180000, "stableMs": 2500 }
}
```

> Opcional: `"completion": "texto que aparece quando a resposta termina"` (regex). Use quando a UI
> renderiza um bloco de raciocínio antes da resposta — o driver espera o marcador e lê só a resposta.

2. `node src/index.mjs login exemplo` → faça login na janela → feche.
3. `node src/index.mjs diagnose exemplo` → ajuste os seletores até `composer`/`assistant` casarem.
4. Envie um turno real, mude `status` para `ready` e rode `npm test`.

`status: planned` fica **oculto** de `/v1/models` e responde `503 provider_not_ready` — nada
quebrado é exposto.

---

## 7. Regras do driver

- Fluxo serial: uma aba por provedor; turnos concorrentes entram numa fila.
- O composer é um `<textarea>` → usa `fill()`; caso contrário, clique + `insertText`.
- Prefere o **composer visível** (páginas de marketing têm inputs duplicados escondidos).
- Streaming por polling do DOM; `stableMs` define quando a resposta estabilizou.
- Se `selectors.completion` existir, espera uma **nova** ocorrência do marcador (turnos antigos não
  confundem).
- Gates são detectados por texto/seletor e o turno falha explicitamente — sem bypass.

---

## 8. Diagnóstico e erros comuns

```powershell
node src/index.mjs diagnose <id>
Invoke-RestMethod http://127.0.0.1:8788/health
```

| Sintoma | Causa | Correção |
| --- | --- | --- |
| `browserType.launchPersistentContext: Target page… closed` | perfil travado por Chrome antigo | feche as janelas do perfil e mate os processos `*-profile` (veja abaixo) |
| resposta vazia / placeholder | seletor `assistant` pegou elemento errado | rode `diagnose`, ajuste para o container da resposta |
| resposta captura o raciocínio | bloco de “thinking” antes da resposta | use `selectors.completion` com o marcador de término |
| `login_wall` mesmo logado | seletor de login ainda presente | ajuste `loginButton` ou refaça o login |
| `anti_bot_challenge` | Cloudflare/slider | provedor excluído; não há bypass |
| 503 `provider_not_ready` | JSON em `planned` | mude para `ready` após validar |
| JSON inválido | arquivo salvo com BOM | `Set-Content -Encoding utf8` adiciona BOM no PS 5.1; grave sem BOM |

Limpar processos presos do perfil:

```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -match 'qwen-profile' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

---

## 9. Verificação

```powershell
npm test                                  # 13/13
node src/index.mjs serve                  # :8788
Invoke-RestMethod http://127.0.0.1:8788/health
Invoke-RestMethod http://127.0.0.1:8788/v1/models
```

Evidências e matriz de candidatos: `docs/TEST-MATRIX.md`. Regras de admissão: `docs/ADMISSION.md`.
