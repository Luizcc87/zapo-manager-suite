# Design: Wiki + API Docs (Scalar + VitePress)

**Data:** 2026-06-22  
**Status:** Aprovado  
**Audiência:** Devs internos + usuários externos integrando via HTTP

---

## Visão Geral

Adicionar documentação pública ao zapo-manager em duas camadas:

1. **API Reference interativa** — Scalar servido pelo backend em `/api-docs`, alimentado por `docs/openapi.yaml`
2. **Wiki narrativa** — VitePress em `docs-site/`, publicado no GitHub Pages via GitHub Actions

---

## Arquitetura

```
zapo-manager/
├── docs/
│   └── openapi.yaml          ← fonte única de verdade (editado manualmente)
├── docs-site/                ← VitePress wiki
│   ├── package.json
│   ├── .vitepress/config.ts
│   ├── index.md
│   ├── guide/
│   │   ├── quickstart.md
│   │   ├── authentication.md
│   │   ├── instances.md
│   │   ├── messages.md
│   │   ├── webhook.md
│   │   ├── proxy.md
│   │   └── registration.md
│   └── reference/
│       ├── events.md
│       └── errors.md
└── backend/src/main.ts       ← adiciona GET /api-docs (Scalar)
```

**Superfícies públicas:**
- `zapo.dominio.com/api-docs` → Scalar (API ref + Try it out)
- `luizcc87.github.io/zapo-manager-suite` → VitePress (guides + conceitos)

---

## Peça 1: `docs/openapi.yaml`

Spec OpenAPI 3.0.3 escrita manualmente cobrindo todos os 26 endpoints atuais.

**Estrutura do arquivo:**

```yaml
openapi: 3.0.3
info:
  title: Zapo Manager API
  version: 1.0.0
  description: |
    API REST para gerenciar instâncias WhatsApp via zapo-js.
    Autenticação via header `apikey` (GLOBAL_API_KEY ou chave da instância).

servers:
  - url: http://localhost:8080
    description: Local dev
  - url: https://zapo.dominio.com
    description: VPS produção

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: apikey

security:
  - ApiKeyAuth: []

tags:
  - name: Instâncias
    description: Ciclo de vida das instâncias WhatsApp
  - name: Mensagens
    description: Envio de mensagens e mídia
  - name: Configuração
    description: Webhook, proxy e settings por instância
  - name: Chat
    description: Busca de chats e mensagens
  - name: Registro
    description: Registro primário via SMS/OTP (mobile transport)
```

**Endpoints por tag (todos os 26):**

| Tag | Método | Path |
|-----|--------|------|
| Instâncias | POST | `/create` |
| Instâncias | GET | `/connect/:instanceName` |
| Instâncias | GET | `/connectionState/:instanceName` |
| Instâncias | GET | `/fetchInstances` |
| Instâncias | POST | `/syncProfile/:instanceName` |
| Instâncias | DELETE | `/logout/:instanceName` |
| Instâncias | DELETE | `/delete/:instanceName` |
| Registro | POST | `/register/requestCode` |
| Registro | POST | `/register/confirmCode` |
| Mensagens | GET | `/message/status/:instanceName/:messageId` |
| Mensagens | POST | `/message/sendText/:instanceName` |
| Mensagens | POST | `/message/sendMedia/:instanceName` |
| Mensagens | POST | `/message/sendWhatsAppAudio/:instanceName` |
| Mensagens | POST | `/message/sendSticker/:instanceName` |
| Mensagens | POST | `/message/sendButtons/:instanceName` |
| Mensagens | POST | `/message/sendList/:instanceName` |
| Mensagens | POST | `/message/sendCarousel/:instanceName` |
| Configuração | GET | `/settings/find/:instanceName` |
| Configuração | POST | `/settings/set/:instanceName` |
| Configuração | GET | `/webhook/find/:instanceName` |
| Configuração | POST | `/webhook/set/:instanceName` |
| Configuração | GET | `/proxy/find/:instanceName` |
| Configuração | POST | `/proxy/set/:instanceName` |
| Configuração | GET | `/proxy/status/:instanceName` |
| Configuração | POST | `/proxy/replace/:instanceName` |
| Chat | POST | `/chat/findChats/:instanceName` |
| Chat | POST | `/chat/findMessages/:instanceName` |

**Regra de manutenção:** ao adicionar endpoint no Express, adicionar path correspondente no `openapi.yaml` no mesmo PR/commit.

---

## Peça 2: Scalar no Backend

**Deps:**
```bash
npm install @scalar/express-api-reference
```

**Integração em `backend/src/main.ts`:**
```typescript
import { apiReference } from '@scalar/express-api-reference';
import { readFileSync } from 'fs';
import { join } from 'path';

const openapiSpec = readFileSync(
  join(__dirname, '../../docs/openapi.yaml'),
  'utf8'
);

app.use('/api-docs', apiReference({
  spec: { content: openapiSpec },
  theme: 'default',
}));
```

**Rota:** `GET /api-docs` — pública, sem autenticação (a UI pede o apikey para chamar os endpoints).

**Try it out — fluxo do usuário:**
1. Abre `zapo.dominio.com/api-docs`
2. Clica em `Servers` → seleciona ou digita URL da VPS
3. Clica em `Authorize` → cola `GLOBAL_API_KEY` no campo `apikey`
4. Expande qualquer endpoint → clica `Send` → request real ao backend

**CORS:** não necessário. Scalar está no mesmo servidor que a API. O browser chama `zapo.dominio.com/api-docs` e os requests de try-it-out vão para `zapo.dominio.com/*` (same-origin).

---

## Peça 3: VitePress Wiki

**Deps:**
```bash
# docs-site/package.json
{
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.x"
  }
}
```

**Estrutura de navegação (`docs-site/.vitepress/config.ts`):**
```typescript
export default defineConfig({
  title: 'Zapo Manager',
  description: 'Documentação do Zapo Manager',
  themeConfig: {
    nav: [
      { text: 'Guia', link: '/guide/quickstart' },
      { text: 'Referência', link: '/reference/events' },
      { text: 'API Interativa ↗', link: 'https://zapo.dominio.com/api-docs' },
    ],
    sidebar: [
      {
        text: 'Guia',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Autenticação', link: '/guide/authentication' },
          { text: 'Instâncias', link: '/guide/instances' },
          { text: 'Mensagens', link: '/guide/messages' },
          { text: 'Webhooks', link: '/guide/webhook' },
          { text: 'Proxy', link: '/guide/proxy' },
          { text: 'Registro Mobile', link: '/guide/registration' },
        ],
      },
      {
        text: 'Referência',
        items: [
          { text: 'Eventos Webhook', link: '/reference/events' },
          { text: 'Erros', link: '/reference/errors' },
        ],
      },
    ],
  },
});
```

**Conteúdo mínimo por página:**

| Página | Conteúdo |
|--------|----------|
| `quickstart.md` | Docker one-liner, primeiro create + connect, primeiro sendText |
| `authentication.md` | GLOBAL_API_KEY vs instanceToken, onde cada um é aceito |
| `instances.md` | Diferença mobile/web, ciclo de vida, mobileTransport config |
| `messages.md` | Exemplos curl para cada tipo de mensagem |
| `webhook.md` | enabled/events/url, retry policy (3x backoff), lista de eventos |
| `proxy.md` | Webshare config, auto-registro IP, replace flow |
| `registration.md` | SMS OTP flow passo-a-passo, requestCode → confirmCode |
| `events.md` | connection.update, messages.upsert, messages.update, presence.update, etc. |
| `errors.md` | Códigos HTTP esperados, erros comuns, troubleshooting |

---

## Deploy

**GitHub Actions — `.github/workflows/docs.yml`:**
```yaml
name: Deploy Docs

on:
  push:
    branches: [master]
    paths: ['docs-site/**']

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: docs-site/package-lock.json
      - run: npm --prefix docs-site ci
      - run: npm --prefix docs-site run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-site/.vitepress/dist
```

**Ativar GitHub Pages:** repo Settings → Pages → Source: `gh-pages` branch.

**Scalar:** já ativo no próximo deploy da VPS (sem CI separado — sobe junto com o backend).

---

## O que NÃO muda

- Rotas Express existentes — zero alteração
- Schema Prisma — zero alteração
- Lógica de negócio — zero alteração
- Docker/deploy da VPS — nenhum port novo (Scalar serve na porta 8080 existente)

---

## Fases de Implementação

| Fase | Entrega | Complexidade |
|------|---------|--------------|
| 1 | `docs/openapi.yaml` com todos os 26 endpoints | Alta (escrita manual) |
| 2 | Scalar em `/api-docs` no backend | Baixa (2 deps, ~10 linhas) |
| 3 | VitePress scaffold + config + homepage | Média |
| 4 | Conteúdo das páginas wiki (9 arquivos) | Alta (escrita) |
| 5 | GitHub Actions para deploy automático | Baixa |

**Ordem recomendada:** 2 → 1 → 3 → 5 → 4. Scalar sobe primeiro (mais valor imediato), spec cresce junto.
