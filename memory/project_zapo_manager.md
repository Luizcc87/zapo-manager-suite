---
name: project-zapo-manager
description: "Contexto do projeto zapo-manager — stack, arquitetura, estado atual (atualizado 2026-06-22)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

Fork do Evolution Manager v2. Painel web para gerenciar instâncias WhatsApp via zapo-js (protocolo nativo).

**Stack frontend** (`frontend/`): React 18, TypeScript, Vite, Tailwind CSS, react-hook-form + zod, @tanstack/react-query, axios, react-i18next (pt-BR / en-US / es-ES / fr-FR), lucide-react, react-toastify.

**Stack backend** (`backend/`): Node.js + Express, TypeScript, Prisma (PostgreSQL + SQLite fallback), zapo-js (protocolo WhatsApp nativo), @whiskeysockets/baileys v6.6.0 (apenas para registro móvel SMS/OTP — v7 removeu a API mobile).

**Provider duality**: `localStorage TOKEN_ID.PROVIDER` — `"api"` (Evolution API/Zapo, full features) ou `"go"` (Evolution Go API, subset). Botões e componentes específicos de cada provider ficam guardados por `getProvider()`. Zapo usa `provider !== "go"` como guard em fetchInstances, fetchInstance, footer e sidebar.

**Auth**: sem backend de auth — credenciais em `localStorage` via `TOKEN_ID` enum (`apiUrl`, `token`, `instanceToken`, `provider`). Dois axios instances: `api` (usa `instanceToken`) e `apiGlobal` (usa `token` global).

**Tipos de instância (3 estados):**
- **Web** (QR Code WebSocket) — `mobileTransport=false`
- **Mobile/Companion** (TCP nativo via zapo-js) — `mobileTransport=true`, `ownerJid` vazio → pareamento QR/código; `ownerJid` preenchido → reconecta TCP
- **Primário** (SMS/OTP via Baileys) — `mobileTransport=true`, `registeredPhone` preenchido

**Features implementadas (estado 2026-06-22):**
- Registro primário SMS/OTP (Fases 1–5 concluídas, ver `project_primary_registration.md`)
- Proxy por instância (HTTP/HTTPS/SOCKS4/SOCKS5) com sticky session, status visual, substituição IP
- Sincronização de perfil (foto + nome) automática e manual
- Chat real-time com Socket.io + persistência Prisma (wa_messages, wa_chats)
- Mensagens interativas (buttons, list single_select, carousel) com viewOnceMessage wrapping
- Helper `resolveJid` com cache em memória para números BR com/sem dígito 9
- Sistema de locks Redis para Docker Swarm (replicas: 1, stop-first)
- QR code limit (QRCODE_LIMIT, padrão 5)
- Scalar API Reference em `/api-docs` + `openapi.yaml`
- Suíte de testes Playwright (zapo.spec.ts, zapo-settings-webhook.spec.ts, zapo-primary-registration.spec.ts)
- Sincronização completa de histórico (`requireFullSync` + `history_sync_chunk` listener)

**Why:** Personalização do Evolution Manager upstream para incluir modo Zapo Mobile (TCP nativo, menor ban), registro primário via SMS/OTP e funcionalidades operacionais para WhatsApp a escala.

**How to apply:** Ao modificar frontend, seguir padrão de queries em `src/lib/queries/` (fetch*.ts + manage*.tsx + types.ts). Ao modificar backend, rodar `npx tsc --noEmit` para validar antes de commitar. Nunca criar branch — commitar direto em master.
