---
name: project-primary-registration
description: Estado do fluxo de Registro Primário via SMS/OTP (Fases 1 e 2) — o que foi entregue e o que resta
metadata: 
  node_type: memory
  type: project
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

Fluxo completo para registrar número WhatsApp como Primário (sem QR Code) via SMS OTP. Implementado em 2026-06-19.

**Fase 1 — Frontend (concluída):**
- `frontend/src/lib/queries/instance/registrationApi.ts` — `requestRegistrationCode()` + `confirmRegistrationCode()`
- `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx` — dialog 3-step (aviso → form → OTP)
- Dashboard: botão "Registrar como Primário" visível só para provider `"api"`
- i18n em 4 idiomas

**Fase 2 — Backend real via Baileys (concluída):**
- Baileys downgraded para v6.6.0 (v7 removeu API mobile)
- `POST /instance/register/requestCode` — chama `makeRegistrationSocket` + `requestRegistrationCode`; persiste `registeredPhone` no DB via `$executeRaw`
- `POST /instance/register/confirmCode` — chama `sock.register(code)`; mapeia `AuthenticationCreds` → `WaAuthCredentials`; salva via `ZapoManager.saveCredentials()`; dispara `ZapoManager.connectClient()` em background
- `backend/prisma/schema.prisma` tem campo `registeredPhone String?` (aplicado via raw SQL, Prisma client ainda não regenerado)
- Bug fixes: domínios `preKey`/`session`/`identity` no store, sanitização de keyPrefix Redis para nomes com hífen

**Pendente:**
- Rodar `npx prisma generate` no `backend/` após parar o dev server (para Prisma client conhecer `registeredPhone`)
- Substituir `$queryRaw` no `fetchInstances` por `findMany()` tipado após regenerar

**Why:** Permite usar número como Primário sem QR Code — chip não precisa estar acessível depois do registro, menor risco de ban.

**How to apply:** Ao trabalhar neste fluxo, verificar se `registeredPhone` já está no Prisma client gerado. Se não, usar `$executeRaw` / `$queryRaw`.
