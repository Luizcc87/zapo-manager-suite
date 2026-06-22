---
name: project-primary-registration
description: "Estado do fluxo de Registro Primário via SMS/OTP — todas as fases entregues (atualizado 2026-06-22)"
metadata: 
  node_type: memory
  type: project
---

Fluxo completo para registrar número WhatsApp como Primário (sem QR Code) via SMS OTP.

## Fases implementadas

**Fase 1 — Frontend (concluída 2026-06-19):**
- `frontend/src/lib/queries/instance/registrationApi.ts` — `requestRegistrationCode()` + `confirmRegistrationCode()`
- `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx` — dialog 3-step (aviso → form → OTP)
- Dashboard: botão "Registrar como Primário" visível só para provider `"api"` e `provider !== "go"`
- i18n em 4 idiomas

**Fase 2 — Backend real via Baileys (concluída 2026-06-19):**
- Baileys downgraded para v6.6.0 (v7 removeu API mobile)
- `POST /instance/register/requestCode` — chama `makeRegistrationSocket` + `requestRegistrationCode`; persiste `registeredPhone` no DB
- `POST /instance/register/confirmCode` — chama `sock.register(code)`; mapeia `AuthenticationCreds` → `WaAuthCredentials`; salva via `ZapoManager.saveCredentials()`; dispara `ZapoManager.connectClient()` em background
- Bug fixes: domínios `preKey`/`session`/`identity` no store, sanitização de keyPrefix Redis para nomes com hífen

**Fase 3 — Companion QR Code & Proxy Visuals (Concluída 2026-06-20):**
- Bypass de mobileTransport: quando `ownerJid` vazio, backend ignora `mobileTransport` para pareamento inicial por QR
- Restauração de controles no frontend para instâncias móveis
- Fallback de versão móvel para instâncias sem `deviceInfo` no DB
- `ProxyStatusPanel` integrado na dashboard da instância

**Fase 4 — Proxy na criação + badges (Concluída 2026-06-21):**
- Proxy configurável na criação (NewInstance.tsx + PrimaryRegistration/index.tsx)
- Badges responsivos Proxy OK/ERR/— e Webhook ON/OFF no card de instância
- Fix `resetAll()` não resetava `proxyEnabled`/`proxyProtocol`
- Pre-fill de proxy ao reabrir dialog para instância existente

**Fase 5 — Fixes Baileys para OTP funcionar (Concluída 2026-06-21):**

Cadeia de erros encontrados e corrigidos:

1. **`old_version`** → `appVersion` do fallback `2.24.4.76` muito antigo + Play Store fetch falhando no servidor. Fix: bump para `2.26.23.73`.

2. **`old_version` (persistente)** → Baileys v6 hardcoda `MOBILE_USERAGENT = 'WhatsApp/2.23.14.82 iOS/15.3.1'` em `Defaults/index.js`. Fix: `patchBaileysDefaults()` em `instance.routes.ts` sobrescreve `BaileysMobileDefaults.MOBILE_USERAGENT` em runtime antes de cada `makeRegistrationSocket`.

3. **`bad_token`** → `MOBILE_TOKEN` (Defaults/index.js linha 25) é computado em módulo-load com versão antiga. Fix: `patchBaileysDefaults()` também recalcula `MOBILE_TOKEN = Buffer.from('0a1mLfGUIBVrMKF1RdvLI5lkRBvof6vn0fD2QRSM' + md5(iosVersion))`.

4. **`blocked`** → Versão Android (`2.26.23.73` do Play Store) sendo usada em UA iOS → WA detecta mismatch versão↔OS. Fix: `fetchIosWaVersion.ts` busca versão iOS do WA Business na iTunes Search API (id=1386412985); `_iosVersion` em `device.ts` separado de `_appVersion` (Android).

5. **iOS device too old** → `iPhone_7 / iOS 15.3.1` não suportado mais pelo WA. Fix: atualizado para `Apple-iPhone_15 / iOS 17.5.1`.

**Fase 6 — Proxy forwarding + fingerprint consistency (Concluída 2026-06-22):**
- `proxyUtils.ts`: helper puro `buildRegistrationFetchOptions()` para injetar proxy no `mobileRegisterFetch` do Baileys
- `instance.routes.ts`: `POST /register/requestCode` injeta `options` com proxy ao criar `makeRegistrationSocket`
- `device.ts`: `DEFAULT_MOBILE_DEVICE.osVersion` ajustado para `15` (coerência com `osBuildNumber`)
- Testes unitários `device-proxy-otp.test.ts` cobrindo fingerprint Android, independência versões, helpers Baileys, agentes proxy

## Arquivos-chave

- `backend/src/routes/instance.routes.ts` — `patchBaileysDefaults()` (patcha MOBILE_TOKEN + MOBILE_USERAGENT), `parsePhoneNumber()`, requestCode, confirmCode
- `backend/src/config/device.ts` — `_iosVersion`, `_appVersion`, `setIosVersion()`, `getMobileDevice()`
- `backend/src/config/fetchIosWaVersion.ts` — iTunes API fetch (id=1386412985)
- `backend/src/config/fetchAndroidWaVersion.ts` — Play Store fetch + VERSION_PATTERNS
- `backend/src/config/proxyUtils.ts` — `buildRegistrationFetchOptions()`
- `backend/src/main.ts` — fetch iOS + Android no startup + daily scheduler

## Status de pendências

- ✅ Prisma client regenerado. `registeredPhone` disponível tipado.
- ✅ Testes E2E criados (`tests/zapo-primary-registration.spec.ts`) com Suite A (CI-safe) + Suite B (real OTP opt-in).
- ⚠️ Números testados podem estar em cooldown WA (24-48h). Usar número virgem para validar fluxo completo.

**Why:** Permite usar número tanto como Primário (via SMS OTP) quanto Companion (via QR Code TCP) mantendo alta estabilidade e feedback em tempo real.
