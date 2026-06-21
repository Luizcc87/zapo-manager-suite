---
name: project-wa-version-management
description: Como zapo-manager gerencia versões WA Web, WA Business Android (TCP) e WA Business iOS (Baileys OTP)
metadata:
  node_type: memory
  type: project
---

## Três espaços de versão independentes

### WA Web (conexões QR)
- Formato: `2.3000.x`
- **Gerenciado por:** zapo-js internamente
- **Modelo:** REATIVO — ao receber `client_too_old`, zapo-js auto-busca versão atual de `web.whatsapp.com/sw.js` e reconecta
- **Ação necessária:** nenhuma. `fetchLatestWaWebVersion` do Baileys NÃO é compatível com zapo-js (não expõe API de injeção de versão)

### WA Business Android (conexões mobile TCP via zapo-js)
- Formato: `2.26.x.x`
- **Gerenciado por:** `backend/src/config/device.ts` (`_appVersion`) + `fetchAndroidWaVersion.ts`
- **Modelo:** PROATIVO — duas camadas:
  1. **Startup:** `fetchLatestAndroidWaVersion()` busca Play Store (`com.whatsapp.w4b`) antes de `ZapoManager.loadAll()`
  2. **Diário às 03:00:** `scheduleDailyVersionCheck()` em `main.ts` — setTimeout recursivo
- **Fallback hardcoded:** `DEFAULT_MOBILE_DEVICE.appVersion = '2.26.23.73'` (atualizado 2026-06-21)
- **API:** `setAppVersion()` / `getCurrentAppVersion()` / `getMobileDevice()`

### WA Business iOS (Baileys OTP registration)
- Formato: `2.24.x.x` (App Store retorna `24.x.x`; prepend `2.`)
- **Gerenciado por:** `backend/src/config/device.ts` (`_iosVersion`) + `fetchIosWaVersion.ts`
- **Modelo:** PROATIVO — busca iTunes Search API (`id=1386412985`) no startup + às 03:00
- **Fallback hardcoded:** `_iosVersion = '2.24.17.80'` (atualizado 2026-06-21)
- **API:** `setIosVersion()` / `getCurrentIosVersion()`
- **Device:** `iPhone_15 / iOS 17.5.1` (iPhone 7/iOS 15 não suportado mais pelo WA)

**Why (separação Android/iOS):** Baileys v6 foi reverse-engineered do app iOS. Para OTP registration usa User-Agent iOS. Usar versão Android (Play Store) no UA iOS causa `blocked` — WA valida consistência versão↔OS. As duas versões são independentes e devem vir de fontes diferentes.

**How to apply:**
- Versão Android → `getMobileDevice().appVersion` → zapo-js `deviceInfo.appVersion`
- Versão iOS → `getCurrentIosVersion()` → `patchBaileysDefaults()` antes de `makeRegistrationSocket`
- Fallbacks: atualizar `_iosVersion` em `device.ts` se iTunes API mudar; atualizar `appVersion` se Play Store mudar. Patterns em `VERSION_PATTERNS` (fetchAndroidWaVersion.ts) podem quebrar se Play Store mudar HTML.

## Cadeia de erros de registro OTP (diagnóstico)

| Erro WA | Causa | Fix |
|---------|-------|-----|
| `old_version` | `appVersion` muito antigo (Android ou iOS) | Atualizar versão |
| `bad_token` | `MOBILE_TOKEN` calculado com WA_VERSION errado (Baileys hardcoda `2.23.14.82`) | `patchBaileysDefaults()` recalcula `MOBILE_TOKEN` com versão iOS atual |
| `blocked` | Versão Android em UA iOS (mismatch OS↔versão), IP de datacenter, ou muitas tentativas | Usar versão iOS do App Store, proxy residencial, aguardar 24-48h |
| iOS device too old | `iOS/15.3.1 Device/Apple-iPhone_7` não suportado pelo WA | Atualizar para `iOS/17.5.1 Device/Apple-iPhone_15` |
