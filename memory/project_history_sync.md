---
name: project-history-sync
description: "Sincronização completa do histórico WhatsApp — como funciona, o que foi implementado, limitações (2026-06-22)"
metadata:
  node_type: memory
  type: project
---

## Feature: Sincronizar histórico completo ao ler o QR Code

Toggle na UI: Settings > Comportamento > "Sincronizar o histórico completo ao ler o QR Code" → `syncFullHistory: boolean` salvo em `settingsConfig` no DB.

## Como o protocolo funciona

O WhatsApp envia histórico em chunks (blobs comprimidos) após o pareamento. Cada chunk é processado pelo zapo-js em `history-sync.js` via `writeBehind.persistMessageAsync()` (zapo store interno). O evento `history_sync_chunk` emite **apenas metadados** — não os dados brutos das mensagens.

**Tipos de sync:** `INITIAL_BOOTSTRAP`, `RECENT`, `FULL`, `PUSH_NAME`, `ON_DEMAND`, `NON_BLOCKING_DATA`.

## O que foi implementado (2026-06-22)

**`backend/src/manager.ts`:**

1. **`requireFullSync`** em `clientOptions.history`:
   ```typescript
   history: {
     enabled: process.env.SAVE_DATA_HISTORIC === 'true' || settings.syncFullHistory || false,
     requireFullSync: settings.syncFullHistory ?? false,  // ← instrui WA a enviar FULL, não RECENT
   }
   ```

2. **`buildStore()` — providers ativados quando `syncFullHistory=true`:**
   ```typescript
   messages: (saveMessages || persistHistory) && pgStore ? 'pg' : 'none',
   threads:  persistHistory && pgStore ? 'pg' : 'none',  // antes era sempre 'none'
   ```
   Garante que zapo-js persiste mensagens e threads históricos no store PostgreSQL/SQLite.

3. **`client.on('history_sync_chunk', ...)` listener** (só registrado quando `syncFullHistory=true`):
   - Log no terminal: `chunk=N progress=X% msgs=Y convs=Z syncType=T`
   - Emite evento `'history.sync'` via webhook e socket para o frontend

## Limitação arquitetural importante

`WaHistorySyncChunkEvent` contém APENAS:
```typescript
{ syncType, messagesCount, conversationsCount, pushnamesCount, inlineContactsCount, chunkOrder?, progress? }
```

As mensagens históricas NÃO passam pelo evento `message` do cliente — elas são escritas diretamente no zapo store interno via `writeBehind`. Por isso NÃO é possível inserir mensagens históricas nas tabelas Prisma (`wa_messages`) via este evento.

**Consequência:** Mensagens históricas ficam no store interno do zapo-js (PostgreSQL `wa_*` tables gerenciadas pelo `@zapo-js/store-postgres`), não nas tabelas Prisma que a UI consulta. Para exibição no chat do Manager, configurar `SAVE_DATA_NEW_MESSAGE=true` (cobre mensagens novas via evento `message`).

## Potencial evolução futura

Para integrar histórico com a UI do Manager, seria necessário:
- Expor uma query sobre o store interno do zapo-js (`writeBehind.getMessages()` — API não documentada)
- OU modificar `getMessageList()` para também consultar as tabelas internas do zapo-js no PostgreSQL

**How to apply:** Ao debugar histórico não aparecendo no chat: verificar que `syncFullHistory=true` nas settings, que o store usa PostgreSQL (não SQLite), e que `SAVE_DATA_NEW_MESSAGE=true`. Verificar logs de terminal por `[HistorySync]` para confirmar que chunks estão chegando.
