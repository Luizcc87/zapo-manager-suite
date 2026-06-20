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

**Fase 3 — Companion QR Code & Proxy Visuals (Concluída em 2026-06-20):**
- **Bypass de mobileTransport:** Quando `ownerJid` está vazio (primeira conexão), o backend ignora `mobileTransport` para permitir o pareamento inicial por QR Code/WebSocket. Após o pareamento, o status passa a conectado e as reconexões usam o modo TCP.
- **Restauração de Controles no Frontend:** A Dashboard da instância agora exibe as opções de gerar QR Code e código de pareamento mesmo para instâncias móveis, permitindo registrar como Companion ou Primário.
- **Fallback de Versão Móvel:** Corrigida a leitura de versão móvel para novas instâncias que ainda não possuem `deviceInfo` salvo no DB, caindo no dispositivo padrão do runtime.
- **Status de Proxy no Dashboard:** Integrado o painel `ProxyStatusPanel` no dashboard da instância se o proxy estiver ativo.

**Status de Pendências:**
- *Prisma client:* O comando `npx prisma generate` foi executado e a listagem `fetchInstances` foi atualizada de `$queryRaw` para `findMany()` tipado usando as propriedades nativas.

**Why:** Permite usar número tanto como Primário (via SMS OTP) quanto Companion/Vinculado (via Tablet QR Code TCP) mantendo alta estabilidade e feedback em tempo real do proxy na dashboard.
