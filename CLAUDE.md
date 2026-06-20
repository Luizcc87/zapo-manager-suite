# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**zapo-manager** (repositório: `zapo-manager-suite`) é um fork do Evolution Manager v2 — painel web React para gerenciar instâncias WhatsApp via Evolution API.

Estrutura do monorepo:
- `frontend/` — painel React (subtree do `evolution-manager-v2`; **não é submódulo**)
- `backend/` — servidor Node.js com Prisma (zapo-js)
- `docs/` — documentação operacional

### Git remotes

| Remote | URL | Propósito |
|---|---|---|
| `origin` | `git@github.com:Luizcc87/zapo-manager-suite.git` | repositório principal |
| `upstream-frontend` | `https://github.com/evolution-foundation/evolution-manager-v2.git` | sync de atualizações do painel |

Clone simples (sem `--recurse-submodules`):
```bash
git clone https://github.com/Luizcc87/zapo-manager-suite.git
```

Para sincronizar `frontend/` com o upstream, ver [docs/SYNC-UPSTREAM.md](docs/SYNC-UPSTREAM.md).

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

## Versões do WhatsApp — Como o Sistema Trata

Existem **dois espaços de versão independentes** que o sistema precisa manter atualizados:

### 1. Versão WA Web (conexões QR / browser)

Formato: `2.3000.x` — usada quando `mobileTransport` está desativado.

O Zapo tem **auto-recovery nativo**: ao receber `failure_client_too_old` (HTTP 405), o `recoverFromClientTooOld: true` (ativado em `manager.ts`) busca automaticamente a versão atual de `web.whatsapp.com/sw.js` e reconecta. Nenhuma ação manual necessária.

### 2. Versão WA Business Android (conexões mobile TCP)

Formato: `2.24.x.x` — campo `appVersion` dentro de `deviceInfo` do `mobileTransport`.

O Zapo **não tem auto-recovery** para este espaço de versão. `recoverFromClientTooOld` só corrige a versão Web — injetá-la numa conexão mobile não resolve.

**Solução implementada:**
- Fonte única de configuração: [`backend/src/config/device.ts`](backend/src/config/device.ts)
- No startup, [`backend/src/config/fetchAndroidWaVersion.ts`](backend/src/config/fetchAndroidWaVersion.ts) busca a versão atual do WA Business no Google Play Store e chama `setAppVersion()` antes de `ZapoManager.loadAll()`
- Se o fetch falhar (rede, mudança de HTML do Play Store), usa o valor hardcoded em `DEFAULT_MOBILE_DEVICE.appVersion` como fallback

**Para atualizar o fallback manualmente** (quando o Play Store mudar o HTML e o fetch parar de funcionar):
1. Verificar a versão atual: https://play.google.com/store/apps/details?id=com.whatsapp.w4b
2. Atualizar `appVersion` em [`backend/src/config/device.ts`](backend/src/config/device.ts)
3. Se os patterns do fetcher quebrarem, atualizar `VERSION_PATTERNS` em [`backend/src/config/fetchAndroidWaVersion.ts`](backend/src/config/fetchAndroidWaVersion.ts)

---

## Backend Database Migrations

**Regra:** toda mudança de schema Prisma **deve** ter uma migration SQL manual em `backend/prisma/migrations/`.

### Por quê manual?

- `prisma migrate dev` reseta o banco em ambientes com tabelas pré-existentes — **nunca rodar em produção**
- `prisma db push` destrói dados ao detectar divergências — **proibido**
- O backend roda `prisma migrate deploy` automaticamente no startup (ver `main.ts`) — migrations são aplicadas em todo deploy/redeploy sem intervenção manual

### Como criar uma migration

```bash
# 1. Gerar o scaffold da migration com timestamp automático usando a flag --create-only
cd backend
npx prisma migrate dev --create-only --name nome_da_mudanca

# 2. Editar o arquivo migration.sql gerado dentro da nova pasta para garantir que seja idempotente
```

### Regras do SQL da migration

Toda migration **deve ser idempotente** para funcionar em DB novo e em DB existente:

```sql
-- Tabela nova
CREATE TABLE IF NOT EXISTS "MinhaTabela" ( ... );

-- Índice novo
CREATE UNIQUE INDEX IF NOT EXISTS "MinhaTabela_campo_key" ON "MinhaTabela"("campo");

-- Coluna nova em tabela existente
ALTER TABLE "MinhaTabela" ADD COLUMN IF NOT EXISTS "novaColuna" TEXT;

-- NUNCA usar:
-- DROP TABLE ...
-- ALTER TABLE ... DROP COLUMN ...
-- (mudanças destrutivas exigem aprovação explícita e backup)
```

### Fluxo completo ao alterar schema

1. Editar `backend/prisma/schema.prisma` com a mudança desejada.
2. Gerar a migration com `npx prisma migrate dev --create-only --name <nome_da_mudanca>`.
3. Ajustar o arquivo SQL gerado para ser idempotente.
4. Parar o dev server e rodar `npx prisma generate` no `backend/` para regenerar o client.
5. Reiniciar — `prisma migrate deploy` aplica as alterações automaticamente no bootstrap.

### Atenção: Prisma Client gerado

O arquivo `query_engine-windows.dll.node` fica locked enquanto o dev server roda. `npx prisma generate` falha com `EPERM` se o servidor estiver ativo. Solução: parar o servidor → gerar → reiniciar.

Enquanto o client não for regenerado após uma mudança de schema, usar `$executeRaw`/`$queryRaw` para acessar campos novos (ex: `registeredPhone`).

## Docker

```bash
cd frontend
docker-compose up -d   # Usa nginx interno em porta 80
```

O `.docker/` contém configs nginx incluindo SPA fallback, SSL e cache headers.

## Environment Variables

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8080             # Opcional: pré-configura/sobrescreve a URL do backend
VITE_API_KEY=your-api-key                      # Opcional: pré-configura a chave API global no formulário
# Também há suporte legível para VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY
```

Sem essas variáveis, o usuário configura via tela de login.

### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GLOBAL_API_KEY` | **Sim** | Chave mestra da API. Gerar: `openssl rand -hex 32` |
| `DATABASE_URL` | **Sim** | PostgreSQL connection string |
| `REDIS_URL` | Não | Redis para distributed locks (Docker Swarm multi-réplica) |
| `SERVER_URL` | Não | URL pública do servidor (ex: `https://zapo.dominio.com`) |
| `WEBHOOK_URL` | Não | Fallback global de webhook (sobreposto por config por-instância) |
| `SESSION_DEVICE_BROWSER` | Não | Browser anunciado ao WhatsApp (`chrome`, `firefox`, etc.) |
| `SESSION_DEVICE_OS` | Não | SO exibido em "Dispositivos Vinculados" (ex: `Linux`) |
| `PROXY_API_KEY` | Não | Chave da API do provedor de proxies para auto-registro de IP |
| `PROXY_IP_AUTH_URL` | Não | Endpoint de autorização de IPs (POST `{ip_address}` no startup) |
| `PROXY_REPLACE_API_URL` | Não | Endpoint de substituição de proxy (botão "Substituir IP" no painel) |
| `PROXY_REPLACE_API_KEY` | Não | Chave para o endpoint de substituição (pode ser igual a `PROXY_API_KEY`) |

**Proxy — fluxo de auto-registro:** se `PROXY_API_KEY` e `PROXY_IP_AUTH_URL` estiverem definidos, o backend detecta o IP público do servidor via `api.ipify.org` e o registra no provedor a cada startup. Útil em Docker Swarm onde o IP do nó pode mudar.

**Proxy — sticky session:** campos `country` e `session` no formulário de proxy por-instância. Se `session` estiver vazio, o backend usa automaticamente o nome da instância como ID de sessão (evita rotação de IP mid-session pelo WhatsApp).

## CHANGELOG — Regra Obrigatória

**Toda implementação relevante deve ser registrada em [CHANGELOG.md](CHANGELOG.md) antes ou junto ao commit.**

- Ler `CHANGELOG.md` ao iniciar nova sessão — evita reimplementar o que já existe
- Seção `[Unreleased]` para trabalho em curso; manter ordem cronológica reversa
- Atualizar seção **Pendências ativas** ao concluir ou adicionar itens
- Ver formato completo e regras de o que registrar em `AGENTS.md` → seção CHANGELOG
