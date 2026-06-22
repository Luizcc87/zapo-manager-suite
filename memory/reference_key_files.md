---
name: reference-key-files
description: "Arquivos-chave do projeto e onde encontrar o quê (atualizado 2026-06-22)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

## Backend

| Arquivo | O que contém |
|---|---|
| `backend/src/manager.ts` | ZapoManager class — connect, store, events, webhooks, history sync |
| `backend/src/main.ts` | Express server, Socket.io, bootstrap, daily version checks |
| `backend/src/routes/instance.routes.ts` | CRUD instâncias, QR, connect, disconnect, delete, register/confirmCode |
| `backend/src/routes/message.routes.ts` | Envio de mensagens (texto, mídia, botões, lista, carrossel, sticker, doc) |
| `backend/src/routes/chat.routes.ts` | Listagem de chats + mensagens por instância |
| `backend/src/routes/config.routes.ts` | Settings, webhook, proxy (get/set) |
| `backend/src/config/device.ts` | DEFAULT_MOBILE_DEVICE, getMobileDevice(), versões Android/iOS runtime |
| `backend/src/config/fetchAndroidWaVersion.ts` | Busca versão WA Business Android no Play Store |
| `backend/src/config/fetchIosWaVersion.ts` | Busca versão WA Business iOS na iTunes Search API |
| `backend/src/config/proxyUtils.ts` | buildRegistrationFetchOptions() para proxy no OTP |
| `backend/src/middleware/auth.ts` | checkGlobalApiKey, checkInstanceApiKey, checkStrictInstanceApiKey |
| `backend/src/lib/prisma.ts` | Prisma client singleton |
| `backend/prisma/schema.prisma` | Schema: Instance, Message (wa_messages), ChatEntry (wa_chats) |
| `backend/src/tests/` | Testes unitários (vitest) — device-proxy-otp, chat-corrections, webhook-delivery |

## Frontend

| Arquivo | O que contém |
|---|---|
| `frontend/src/lib/queries/<feature>/` | Padrão: fetch*.ts + manage*.tsx + types.ts |
| `frontend/src/lib/queries/token.ts` | getProvider() — retorna "api" ou "go" |
| `frontend/src/lib/queries/api.ts` | Dois axios: `api` (instanceToken) + `apiGlobal` (global token) |
| `frontend/src/types/evolution.types.ts` | Tipos: Instance, Message, Webhook, Proxy, Settings |
| `frontend/src/translate/languages/` | i18n: pt-BR.json, en-US.json, es-ES.json, fr-FR.json |
| `frontend/src/pages/Dashboard/index.tsx` | Dashboard principal |
| `frontend/src/pages/Dashboard/NewInstance.tsx` | Formulário nova instância (provider "api") |
| `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx` | Dialog registro primário SMS/OTP 3 steps |
| `frontend/src/pages/instance/DashboardInstance/index.tsx` | Dashboard da instância (QR, pareamento, perfil, proxy) |
| `frontend/src/pages/instance/Chat/` | Chat real-time — index.tsx + messages.tsx |
| `frontend/src/pages/instance/Proxy/index.tsx` | ProxyStatusPanel + configuração de proxy |
| `frontend/src/components/instance-card.tsx` | Card de instância na listagem com badges |
| `frontend/src/components/base-header.tsx` | Header base com ReactNode para title |
| `frontend/src/services/websocket/socket.ts` | Socket.io client wrapper com offHandler() |

## Testes E2E

| Arquivo | O que contém |
|---|---|
| `playwright.config.ts` | Configuração Playwright — timeout, backend webServer |
| `tests/global-setup.ts` | Limpeza locks Redis antes dos testes |
| `tests/zapo.spec.ts` | Suíte principal (instâncias, ciclo de vida, auth) |
| `tests/zapo-settings-webhook.spec.ts` | Settings e webhook CRUD |
| `tests/zapo-primary-registration.spec.ts` | Registro primário (Suite A CI-safe + Suite B real OTP) |
| `tests/zapo-webhook-delivery.real.spec.ts` | Entrega de webhook com receiver local (opt-in) |

## Docs

| Arquivo | O que contém |
|---|---|
| `docs/TESTING.md` | Guia de testes — comandos, variáveis de ambiente, suítes |
| `docs/DOCKER.md` | Build multi-arch, publicação Docker Hub |
| `docs/SYNC-UPSTREAM.md` | Sincronização com evolution-foundation/evolution-manager-v2 |
| `docs/BMAD_METHOD.md` | Metodologia BMAD v6.9.0 |
| `backend/openapi.yaml` | Spec OpenAPI (Scalar API Reference em /api-docs) |
| `CHANGELOG.md` | Registro cronológico de todas as mudanças |
| `AGENTS.md` | Guia para desenvolvedores e agentes de IA |
