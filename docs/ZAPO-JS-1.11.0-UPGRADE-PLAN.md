# Plano de Upgrade `zapo-js` 1.11.0

Data: 2026-11-15

## 1. Release Summary

### Estado local atual vs. últimas versões publicadas no npm

| Pacote | Instalado (`backend/package.json`) | Última no npm (`latest`) | Ação Recomendada |
|---|---|---|---|
| `zapo-js` | `^1.8.2` | `1.11.0` | **Atualizar (`1.8.2` → `1.11.0`)** |
| `@zapo-js/store-sqlite` | `^1.2.0` | `1.3.0` | **Atualizar (`1.2.0` → `1.3.0`)** |
| `@zapo-js/fake-server` (dev) | `^1.3.0` | `1.3.1` | **Atualizar (`1.3.0` → `1.3.1`)** |
| `@zapo-js/store-postgres` | `^1.2.0` | `1.2.0` | Manter (`1.2.0`) |
| `@zapo-js/store-redis` | `^1.3.0` | `1.3.0` | Manter (`1.3.0`) |
| `@zapo-js/media-utils` | `^1.0.0` | `1.0.0` | Manter (`1.0.0`) |

### Mudanças Upstream Acumuladas (`v1.9.0`, `v1.10.0`, `v1.11.0`)

#### `v1.9.0` (2026-09-20)
- **Features:**
  - `feat(transport): support iOS in the mobile-primary login payload` (PR #285) — compatível com a infraestrutura iOS já presente em `backend/src/config/device.ts` e `fetchIosWaVersion.ts`.
  - `feat(mobile): support HTTP proxy after SMS registration` (PR #276) — suporte a proxy HTTP no transporte mobile pós-registro.
  - `feat(store-sqlite): add a node:sqlite driver and make better-sqlite3 optional` (PR #284) — `@zapo-js/store-sqlite@1.3.0` adiciona fallback para `node:sqlite` mantendo compatibilidade total em disco com `better-sqlite3`.
  - `feat(voip): add bidirectional video calls` (PR #274).
- **Fixes:**
  - `fix(send): classify AI rich-response family as text so the stanza delivers` (PR #273).
  - `fix(voip): populate callerPn on incoming call state` (PR #279), `dial relays on the web client port` (PR #254), `increase live audio buffer headroom` (PR #280).

#### `v1.10.0` (2026-10-07)
- **Features:**
  - `feat(store): add an idle TTL to the cacheLayer L1` (PR #300) — reduz consumo de memória em instâncias de longa duração.
  - `feat(voip)`: feedback de banda, relay IPv6, transporte UDP raw (off por padrão), mute/screen share/reactions (PRs #287, #289, #291).
- **Fixes:**
  - `fix(client): never let ignoreKey drop peer messages from our own devices` (PR #294) — evita perda de mensagens enviadas por outros aparelhos vinculados à mesma conta (`fromMe`).
  - `fix(media): correct the media reupload contract for re-keyed answers` (PR #286) — melhora recuperação de mídias expiradas.
  - `fix(message): send a group list as media next to its biz node` (PR #298) — corrige entrega de listas interativas (`single_select`) em grupos.
  - `refactor(voip): move call media to @zapo-js/voip-media` (PR #303).

#### `v1.11.0` (2026-10-28)
- **Features:**
  - `feat(message): accept messageContextInfo on typed sends` (PR #320).
  - `feat(signal): report a status for each phone number in the lid sync result` (PR #325) — `getLidsByPhoneNumbers` agora inclui `status` (`'in' | 'out' | 'invalid' | 'error' | 'unanswered'`) e detalhes de erro, preservando `exists` e `invalid`.
  - `feat(client): stream history sync to a history.sink callback` (PR #329) — adiciona `history.sink` opcional sem alterar o contrato de `history_sync_chunk`.
  - `feat(client): let syncSignalSession rebuild an existing session` (PR #331).
- **Fixes Críticos:**
  - `fix(client): send history.requireFullSync in the pairing DeviceProps` (PR #326) — corrige bug onde `history.requireFullSync` (já configurado em `backend/src/manager.ts:880`) era ignorado no `DeviceProps` durante o pareamento.
  - `fix(auth): register a pending pairing code again after a reconnect` (PR #327) — re-registra `pairingCode` pendente se o socket reconectar durante a espera; caso falhe, dispara `auth_pairing_required` com `forceManual: true`.
  - `fix(auth): wait for the server to restart the connection after pairing` (PR #328) — aguarda o `stream:error 515` do servidor após `pair-device-sign` antes de reconectar (evitando desconexão precoce de 3ms que fazia o celular remover o companion). **Nota importante:** o `@zapo-js/fake-server@1.3.1` foi atualizado em conjunto para emitir o `515` pós-pareamento; sem atualizar o `@zapo-js/fake-server`, o smoke test cairia no fallback timer de 15s e daria timeout em `waitForConnected` (10s).
  - `fix(transport): bind socket events and noise sessions to their connection` (PR #323) — evita condição de corrida entre sockets antigos e novos em reconexões rápidas.
  - `fix(message): album enc media type, SKDM carriers and skmsg retry` (PR #302).
  - `fix(message): name the form_message native flow in the biz companion node` (PR #321).

---

## 2. Implementation Checklist

1. **Criar branch dedicada para o upgrade:**
   ```powershell
   git checkout -b chore/zapo-js-1.11.0
   ```

2. **Executar script formal de triagem (gerando registro em `tmp/`):**
   ```powershell
   node scripts/zapo-release-triage.mjs --release-url https://github.com/vinikjkkj/zapo/releases/tag/v1.11.0 --tag v1.11.0 --mode zapo --output tmp/zapo-js-v1.11.0-triage.md
   ```

3. **Atualizar `zapo-js`, `@zapo-js/store-sqlite` e `@zapo-js/fake-server` no `backend/`:**
   ```powershell
   cd backend
   npm install zapo-js@1.11.0 @zapo-js/store-sqlite@1.3.0 --save-exact=false --legacy-peer-deps
   npm install -D @zapo-js/fake-server@1.3.1 --legacy-peer-deps
   cd ..
   ```

4. **Verificar diff em `backend/package.json` e `backend/package-lock.json`:**
   ```powershell
   git diff -- backend/package.json backend/package-lock.json
   ```

5. **Revisar pontos de código locais em `backend/src/manager.ts`:**
   - **Refresh de Pairing Code (`PR #327`):** Em `backend/src/manager.ts:925-943`, `handlePairing()` verifica `if (phoneNumber && !activeData.pairingCode)`. Quando `auth_pairing_required` dispara (expiração de código ou `forceManual: true` após reconexão), `activeData.pairingCode` já está preenchido com o código antigo e impediria a renovação. Ajustar `client.on('auth_pairing_required')` para limpar `activeData.pairingCode = undefined` antes de chamar `await handlePairing()`.
   - **History Sync (`PR #326` & `PR #329`):** Confirmar que `history: { enabled, requireFullSync }` em `backend/src/manager.ts:874-881` e o listener `history_sync_chunk` compilam sem alteração de tipos.
   - **Call Reject (`PR #279`):** Confirmar tipagem de `event.callerPnJid ?? event.callCreatorJid` no listener `client.on('call')` (`backend/src/manager.ts:1235`).

6. **Revisar pontos de código em `backend/src/routes/message.routes.ts`:**
   - **Resolução de JID / LID (`PR #325`):** Em `resolveJid` (`backend/src/routes/message.routes.ts:464-468`), confirmar que `client.profile.getLidsByPhoneNumbers([cleanNum, alternateNum])` continua retornando `r.exists`, `r.phoneJid` e `r.lidJid` com tipagem compatível.

7. **Atualizar documentação de sincronização e changelog:**
   - Adicionar seção `Release v1.9.0 a v1.11.0 do Zapo` em `docs/SYNC-UPSTREAM.md`.
   - Adicionar entrada da nova versão no topo do `CHANGELOG.md`.

---

## 3. Active Production Instances Impact Warning

| Área de Mudança | Nível de Risco | Impacto e Mitigação |
|---|---|---|
| **Sessão, Auth & Pareamento (`PR #323`, `#327`, `#328`)** | 🟡 Médio | O novo fluxo pós-pareamento aguarda o `stream:error 515` do servidor antes de reiniciar a conexão, evitando que o dispositivo principal desconecte o companion recém-pareado. Sessões já autenticadas não sofrem migração de chaves. |
| **Swarm Locks (`lock:zapo:<instanceName>`)** | 🟢 Baixo (Inalterado) | O controle de lock distribuído no Redis (`TTL 30s`, renovação `10s`) permanece 100% gerenciado por `backend/src/manager.ts`. Manter `replicas: 1` e `stop-first` no deploy. |
| **Store Cache L1 (`PR #300`) & SQLite (`PR #284`)** | 🟢 Baixo | O cache L1 ganha TTL de ociosidade no `zapo-js`, reduzindo uso de RAM em instâncias antigas. O formato SQLite em disco é idêntico e `better-sqlite3` continua instalado em `backend/package.json`. |
| **Mobile Transport (`PR #276`, `#285`)** | 🟢 Baixo | Amplia suporte a iOS e proxy HTTP pós-SMS sem quebrar o device Android Business atual (`backend/src/config/device.ts`). |
| **Strict Proxy Guard** | 🟢 Baixo (Inalterado) | A validação pré-conexão `testProxyConnectivity` e o bloqueio anti-leak permanecem intactos antes de `new WaClient()`. |
| **Payloads de Mensagem, Listas em Grupo & JID (`PR #294`, `#298`, `#325`)** | 🟢 Positivo | Corrige entrega de `single_select` em grupos, evita descarte de mensagens `fromMe` enviadas por outros companions da conta e enriquece o status de lookup USync/LID. |

---

## 4. Test Checklist

1. **Checagem estática de tipos e build completo:**
   ```powershell
   npm --prefix backend run build
   npm run build:all
   ```

2. **Testes unitários e de migração do backend:**
   ```powershell
   node --test backend/src/tests/zapo-migration.test.ts
   node --test backend/src/tests/chat-corrections.test.ts
   ```

3. **Suíte de contratos da API do Manager (Playwright):**
   ```powershell
   npm run test:manager:api
   ```

4. **Suíte de UI do Manager (Playwright):**
   ```powershell
   npm run test:manager:ui
   ```

5. **Smoke Test Offline com `FakeWaServer` v1.3.1 (Essencial para validar PR #328 — restart 515 pós-pareamento):**
   ```powershell
   npm run test:manager:smoke:fake
   ```

*(Nota: Não executar `npm run test:smoke:real` sem confirmação explícita e instância real de teste).*

---

## 5. CHANGELOG.md Update

Entrada sugerida para `CHANGELOG.md`:

```markdown
## [1.6.29] - 2026-11-15

### Upgrade `zapo-js` v1.11.0, `@zapo-js/store-sqlite` v1.3.0 & `@zapo-js/fake-server` v1.3.1

- **Core & Upstream Sync:**
  - `zapo-js`: atualizado de `1.8.2` para `1.11.0` (acumulando releases `v1.9.0`, `v1.10.0` e `v1.11.0`).
  - `@zapo-js/store-sqlite`: atualizado de `1.2.0` para `1.3.0` (suporte adicional ao driver nativo `node:sqlite` mantendo compatibilidade com `better-sqlite3`).
  - `@zapo-js/fake-server`: atualizado de `1.3.0` para `1.3.1` (emissão de `stream:error 515` pós-pareamento alinhada ao servidor real do WhatsApp).
- **Principais Correções e Melhorias do Motor (`v1.9.0` → `v1.11.0`):**
  - **Pareamento & Auth:** espera pelo sinal de restart (`515`) do servidor após `pair-device-sign` (evitando remoção precoce do companion), re-registro automático de `pairingCode` pendente após reconexão e vínculo estrito de sessões Noise ao socket de origem.
  - **Histórico (`syncFullHistory`):** `history.requireFullSync` agora é enviado corretamente no `DeviceProps` durante o pareamento inicial.
  - **Mensagens & Grupos:** correção no envio de listas interativas em grupos (`biz` node), preservação de mensagens `fromMe` originadas em outros dispositivos vinculados (`ignoreKey`), suporte a `messageContextInfo` em envios tipados e correção no contrato de re-upload de mídia.
  - **Store & Memória:** adição de TTL de ociosidade na camada L1 de cache do store.
  - **Signal / LID Sync:** `getLidsByPhoneNumbers` passa a informar `status` detalhado (`in`, `out`, `invalid`, `error`, `unanswered`) por número consultado.
- **Backend (`backend/src/manager.ts`):**
  - Ajustado listener `auth_pairing_required` para limpar `activeData.pairingCode` antes de solicitar renovação do código expirado/invalidado.
```

---

## 6. Local Impact Map

- [backend/package.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package.json) e [backend/package-lock.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package-lock.json)
  - Atualizar `zapo-js` para `^1.11.0`, `@zapo-js/store-sqlite` para `^1.3.0` e `@zapo-js/fake-server` para `^1.3.1`.
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts)
  - Linhas `874-881` (`history.requireFullSync`): passa a surtir efeito real no handshake de pareamento graças ao PR #326.
  - Linhas `925-943` (`handlePairing` / `auth_pairing_required`): limpar `activeData.pairingCode` quando `auth_pairing_required` disparar para permitir refresh de código (PR #327).
  - Linhas `1021-1058` (`auth_qr` / `auth_paired`): beneficiados diretamente pelo PR #328 (espera pelo `515` antes do reconnect pós-pareamento).
- [backend/src/routes/message.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/message.routes.ts)
  - Linhas `464-468` (`resolveJid` → `client.profile.getLidsByPhoneNumbers`): mantém compatibilidade (`r.exists`), agora com diagnóstico de `r.status` disponível.
  - Envio de listas interativas (`single_select`) para grupos passa a funcionar com o fix do `biz` node (PR #298).
- [tests/zapo-smoke-fake.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-smoke-fake.spec.ts)
  - Requer `@zapo-js/fake-server@1.3.1` para que o fluxo de QR pairing no `FakeWaServer` envie o `515` esperado pelo `zapo-js@1.11.0`.

---

## 7. Likely Code Touchpoints

**Alteração obrigatória:**
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/manager.ts` (reset de `activeData.pairingCode` no evento `auth_pairing_required`)
- `docs/SYNC-UPSTREAM.md`
- `CHANGELOG.md`

**Verificação sem alteração esperada (salvo ajuste de tipagem):**
- `backend/src/routes/message.routes.ts`
- `backend/src/routes/instance.routes.ts`
- `backend/src/config/device.ts`
- `tests/zapo-smoke-fake.spec.ts`

---

## 8. Decision

**Recomendação:** **Aprovar e executar o upgrade para `zapo-js@1.11.0`, `@zapo-js/store-sqlite@1.3.0` e `@zapo-js/fake-server@1.3.1`.**

**Justificativa:**
As três versões (`1.9.0`, `1.10.0` e `1.11.0`) trazem correções críticas diretamente alinhadas com problemas reais de operação do Zapo-Manager:
1. Estabilidade no pós-pareamento (`wait for 515 after pair-device-sign`), impedindo desconexão/remoção silenciosa de companions recém-vinculados.
2. Efetivação real da opção `history.requireFullSync` que já estava configurada em `manager.ts` mas era ignorada pelo motor em `1.8.2`.
3. Correção de entrega de listas interativas em grupos e preservação de mensagens `fromMe` de múltiplos dispositivos.
4. Redução de footprint de memória com TTL na camada L1 do store.
