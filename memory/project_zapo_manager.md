---
name: project-zapo-manager
description: "Contexto do projeto zapo-manager — stack, arquitetura, estado atual"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

Fork do Evolution Manager v2. Painel web para gerenciar instâncias WhatsApp via Evolution API compatível.

**Stack frontend** (`frontend/`): React 18, TypeScript, Vite, Tailwind CSS, react-hook-form + zod, @tanstack/react-query, axios, react-i18next (pt-BR / en-US / es-ES / fr-FR), @evoapi/design-system, lucide-react, react-toastify.

**Stack backend** (`backend/`): Node.js + Express, TypeScript, Prisma (PostgreSQL ou SQLite), zapo-js (biblioteca interna de protocolo WhatsApp), @whiskeysockets/baileys v6.6.0 (para registro móvel — v7 removeu a API mobile).

**Provider duality**: `localStorage TOKEN_ID.PROVIDER` — `"api"` (Evolution API/Baileys, full features) ou `"go"` (Evolution Go API, subset). Botões e componentes específicos de cada provider ficam guardados por `getProvider()`.

**Auth**: sem backend de auth — credenciais em `localStorage` via `TOKEN_ID` enum (`apiUrl`, `token`, `instanceToken`, `provider`). Dois axios instances: `api` (usa `instanceToken`) e `apiGlobal` (usa `token` global).

**Why:** Personalização do Evolution Manager upstream para incluir modo Zapo Mobile (TCP nativo, menor ban) e registro primário via SMS/OTP.

**How to apply:** Ao modificar frontend, seguir padrão de queries em `src/lib/queries/` (fetch*.ts + manage*.tsx + types.ts). Ao modificar backend, usar `$executeRaw` / `$queryRaw` enquanto Prisma client não for regenerado após schema changes.
