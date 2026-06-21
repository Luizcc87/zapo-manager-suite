---
name: project-chat-lid-fix
description: Fix Mobile Transport @lid JID — mensagens recebidas/enviadas-pelo-app não apareciam no chat
metadata: 
  node_type: memory
  type: project
  originSessionId: f0b6b9f8-2a1b-465c-8956-633d65bcddb0
---

Mobile Transport usa JIDs no formato `@lid` (Linked ID) em vez de `@s.whatsapp.net`. O frontend navega por JID de telefone; antes do fix as mensagens eram armazenadas sob o bucket errado e nunca retornadas.

**Fix aplicado (commit a7286fe):**
- `manager.ts` handler `client.on('message')`: lê `event.key.remoteJidAlt` e normaliza `key.remoteJid → @s.whatsapp.net` antes de armazenar e emitir.
- `storeMessage()` retorna `normalized` (com `messageType`); socket emite `normalized` em vez do `msgData` bruto.
- `messageType` detection: exclui `messageContextInfo` e outros campos de metadado de `Object.keys()` para não pegar o campo errado.

**Por quê:** zapo-js inclui `key.remoteJidAlt` com o JID alternativo. Para `@lid` primary, `remoteJidAlt = @s.whatsapp.net`. Para `@s.whatsapp.net` primary (instâncias Web), `remoteJidAlt = @lid` — lógica `!altJid.endsWith('@lid')` garante usar sempre o JID de telefone.

**Endpoint de debug:** `GET /chat/debug/:instanceName` (requer instanceApiKey) retorna chats e contagem de msgs in-memory.

**How to apply:** Ao debugar mensagens que não aparecem, primeiro checar o `[msg]` log no backend para ver `jid=` e `type=`. Se `jid=...@lid` → o fix de `remoteJidAlt` não está ativo (backend não recarregou). Se `type=unknown` → novo tipo de mensagem não mapeado em `METADATA_FIELDS`.

[[project-zapo-manager]]
