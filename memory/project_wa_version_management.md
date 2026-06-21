---
name: project-wa-version-management
description: Como zapo-manager gerencia versões WA Web e WA Business Android — modelo reativo vs proativo
metadata:
  node_type: memory
  type: project
---

## Dois espaços de versão independentes

### WA Web (conexões QR)
- Formato: `2.3000.x`
- **Gerenciado por:** zapo-js internamente
- **Modelo:** REATIVO — ao receber `client_too_old`, zapo-js auto-busca versão atual de `web.whatsapp.com/sw.js` e reconecta
- **Ação necessária:** nenhuma. `fetchLatestWaWebVersion` do Baileys NÃO é compatível com zapo-js (não expõe API de injeção de versão)

### WA Business Android (conexões mobile TCP)
- Formato: `2.24.x.x` / `2.26.x.x`
- **Gerenciado por:** nosso código em `backend/src/config/`
- **Modelo:** PROATIVO — duas camadas:
  1. **Startup:** `fetchLatestAndroidWaVersion()` busca Play Store (`com.whatsapp.w4b`) antes de `ZapoManager.loadAll()`
  2. **Diário às 03:00:** `scheduleDailyVersionCheck()` em `main.ts` — setTimeout recursivo, re-agenda após cada execução
- **Fallback hardcoded:** `DEFAULT_MOBILE_DEVICE.appVersion` em `backend/src/config/device.ts`
- **Versão atual no fallback:** `2.26.23.73` (atualizado 2026-06-21)

**Why:** zapo-js tem `recoverFromClientTooOld: true` apenas para WA Web. Para mobile TCP, não há mecanismo interno — versão velha causa `old_version` no fluxo de registro OTP e `failure_client_too_old` em reconexões.

**How to apply:** ao atualizar fallback manualmente, verificar Play Store e atualizar `appVersion` em `device.ts`. Patterns do fetcher em `VERSION_PATTERNS` (fetchAndroidWaVersion.ts) podem quebrar se Play Store mudar HTML.
