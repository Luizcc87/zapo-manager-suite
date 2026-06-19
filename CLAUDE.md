# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**zapo-manager** é um fork do Evolution Manager v2 — painel web React para gerenciar instâncias WhatsApp via Evolution API. Todo o código ativo está em `frontend/`.

## Commands

```bash
cd frontend

npm run dev          # Dev server em http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint com auto-fix
npm run lint:check   # ESLint sem fix
npm run type-check   # tsc --noEmit
npm run format       # Prettier (write)
npm run format:check # Prettier (check)
```

Não há testes (script `test` é no-op).

## Architecture

### Provider Duality

O sistema suporta dois backends via `TOKEN_ID.PROVIDER` no `localStorage`:
- `"api"` → Evolution API v2 (Node.js/Baileys) — suporta todos os recursos
- `"go"` → Evolution Go API (Go/whatsmeow) — suporta subconjunto limitado

A matriz de features em [src/lib/provider/features.ts](frontend/src/lib/provider/features.ts) define o que cada provider suporta. `ProtectedRoute` recebe um `feature` prop e renderiza `<IntegrationDisabled>` se o provider ativo não suportar.

### Auth & Credentials

Sem backend de auth. Credenciais salvas em `localStorage` via `TOKEN_ID` enum em [src/lib/queries/token.ts](frontend/src/lib/queries/token.ts):
- `apiUrl` — URL base da Evolution API
- `token` — global API key (usado pelo `apiGlobal` axios instance)
- `instanceToken` — token da instância selecionada (usado pelo `api` axios instance)
- `provider` — `"api"` ou `"go"`

### Two Axios Instances

[src/lib/queries/api.ts](frontend/src/lib/queries/api.ts):
- `api` — usa `instanceToken` no header `apikey`; para chamadas dentro de uma instância
- `apiGlobal` — usa `token` global no header `apikey`; para CRUD de instâncias e chamadas globais

### Routing

Todas as rotas autenticadas ficam sob `/manager/`. Rotas de instância seguem o padrão `/manager/instance/:instanceId/<feature>`. O `ProtectedRoute` verifica auth via localStorage e feature flags via provider.

```
/manager/           → Dashboard (lista de instâncias)
/manager/instance/:instanceId/dashboard
/manager/instance/:instanceId/<feature>  (chat, settings, webhook, openai, typebot, dify, n8n, evoai, evolutionBot, flowise, rabbitmq, sqs, websocket, proxy, chatwoot)
/manager/embed-chat  → Chat embeddável (sem auth)
```

### Layouts

Dois layouts wrapeiam as páginas:
- `MainLayout` — sidebar global + header (Dashboard)
- `InstanceLayout` — sidebar da instância com navegação por feature

### Queries Pattern

Cada integração em `src/lib/queries/<integration>/` tem estrutura uniforme:
- `fetch*.ts` — GET calls
- `manage*.tsx` — mutações (create/update/delete) com `react-query`
- `types.ts` — tipos TypeScript da API
- `settingsFind.ts` — busca configurações padrão (quando aplicável)

### i18n

4 idiomas em `src/translate/languages/`: `pt-BR.json`, `en-US.json`, `es-ES.json`, `fr-FR.json`. Default: `en-US`. Para adicionar texto novo, adicionar em todos os 4 arquivos.

### Contexts

- `InstanceContext` — instância selecionada (dados + status)
- `EmbedInstanceContext` — contexto para chat embeddável
- `EmbedColorsContext` — customização de cores do embed
- `ReplyingMessageContext` — mensagem sendo respondida no chat

## Docker

```bash
cd frontend
docker-compose up -d   # Usa nginx interno em porta 80
```

O `.docker/` contém configs nginx incluindo SPA fallback, SSL e cache headers.

## Environment Variables

```env
VITE_EVOLUTION_API_URL=http://localhost:8080   # Opcional: pré-configura URL
VITE_EVOLUTION_API_KEY=your-api-key            # Opcional: pré-configura token
```

Sem essas variáveis, o usuário configura via tela de login.
