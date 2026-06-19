---
name: reference-key-files
description: Arquivos-chave do projeto e onde encontrar o quê
metadata: 
  node_type: memory
  type: reference
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

**Frontend:**
- Queries pattern: `frontend/src/lib/queries/<feature>/` — fetch*.ts + manage*.tsx + types.ts
- Provider guard: `frontend/src/lib/queries/token.ts` → `getProvider()` retorna `"api"` ou `"go"`
- Two axios instances: `frontend/src/lib/queries/api.ts` — `api` (instanceToken) + `apiGlobal` (global token)
- i18n: `frontend/src/translate/languages/` — pt-BR.json, en-US.json, es-ES.json, fr-FR.json
- Dashboard: `frontend/src/pages/Dashboard/index.tsx`
- Formulário nova instância (provider "api"): `frontend/src/pages/Dashboard/NewInstance.tsx`
- Formulário nova instância (provider "go"): `frontend/src/pages/Dashboard/GoNewInstance.tsx`
- Registro Primário UI: `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx`
- Tipos Evolution: `frontend/src/types/evolution.types.ts`

**Backend:**
- Entry routes: `backend/src/routes/instance.routes.ts`
- Manager (ZapoManager class): `backend/src/manager.ts`
- Schema Prisma: `backend/prisma/schema.prisma`
- Plano Fase 2 backend: `docs/superpowers/plans/2026-06-19-primary-registration-sms-otp.md`

**Docs:**
- Modos de conexão WhatsApp: `docs/zapo_connection_modes.md`
