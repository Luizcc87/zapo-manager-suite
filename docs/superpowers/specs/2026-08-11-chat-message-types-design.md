# Design: Cobertura completa de tipos de mensagem no Chat do Manager

Data: 2026-08-11

## Contexto

Chat do Manager (`/manager/instance/:id/chat`) hoje envia/renderiza só um subconjunto
dos tipos de mensagem suportados pelo zapo-js: texto, imagem/vídeo/áudio/documento,
PTT, sticker simples, buttons/list/carousel (interactive). Backend
(`message.routes.ts`) já expõe mais rotas do que o frontend consome
(sendButtons/sendList/sendCarousel não usadas na UI de chat).

Faltam: reação, localização, contato (envio — recepção já existe), enquete,
apagar/revoke, evento, sticker-pack, ptv (vídeo redondo).

## Decisões

- Backend mantém contrato compat Evolution API (rotas `/message/send*`), não migra
  pra chamadas nativas zapo-js direto no frontend.
- Escopo cobre envio E recebimento/renderização, não só um lado.
- Reações via UI dedicada no `MessageOptions` (hover/click, emoji picker).
- Poll V1: só pergunta + opções exibidas, sem contagem de votos agregada
  (evita construir state agregado de `pollUpdateMessage` agora).
- Revoke: revoke real via protocolo (`type:'revoke'`), não só ocultar local.
- Sticker-pack e Event (evento/agenda) entram no escopo, mesmo sendo baixo uso
  em chat 1:1 — pedido explícito.

## Backend — novas rotas (`backend/src/routes/message.routes.ts`)

Todas seguem padrão existente: `checkStrictInstanceApiKey`, `resolveJid`,
`ZapoManager.getActive`, `ZapoManager.recordSentMessage`, logs
`[MESSAGE SENDING]`/`[MESSAGE SENT]`.

1. `POST /message/sendReaction/:instanceName`
   Body: `{ key: {remoteJid, fromMe, id, participant?}, reaction: string }`
   `client.message.send(jid, { type:'reaction', target: key, emoji: reaction })`
   `reaction: ""` remove a reação (comportamento nativo WhatsApp).

2. `POST /message/sendLocation/:instanceName`
   Body: `{ number, latitude, longitude, name?, address? }`
   Raw `Proto.IMessage`: `{ locationMessage: { degreesLatitude, degreesLongitude, name, address } }`

3. `POST /message/sendContact/:instanceName`
   Body: `{ number, contact: { fullName, phoneNumber, organization? } }`
   Gera vCard 3.0 simples server-side, envia raw
   `{ contactMessage: { displayName: fullName, vcard } }`

4. `POST /message/sendPoll/:instanceName`
   Body: `{ number, name, options: string[], selectableCount? }`
   `client.message.send(jid, { type:'poll', name, options, selectableCount })`

5. `POST /message/revoke/:instanceName`
   Body: `{ key }`
   `client.message.send(jid, { type:'revoke', target: key })`
   Requer `key.fromMe === true` (só se pode revocar mensagem própria) — validar no backend.

6. `POST /message/sendEvent/:instanceName`
   Body: `{ number, name, startTime, description?, endTime?, location?, joinLink? }`
   `client.message.send(jid, { type:'event', name, startTime, ... })`

7. `POST /message/sendStickerPack/:instanceName`
   Multipart: `stickers[]` (múltiplos arquivos webp) + `cover` (thumbnail) + campos
   `stickerPackId, name, publisher`.
   `client.message.send(jid, { type:'sticker-pack', stickers, coverThumbnail, ... })`

### Incoming (manager.ts)

Nenhuma mudança estrutural — handler `client.on('message', ...)` genérico já
normaliza e emite `messages.upsert` via socket para qualquer `messageType`
(incluindo reactionMessage, protocolMessage, pollCreationMessageV3,
pollUpdateMessage, eventMessage, stickerPackMessage, ptvMessage). Validar durante
implementação que `ZapoManager.storeMessage`/`resolveMessageTypeAttr` não caem em
`unknown` pra esses tipos novos; ajustar normalização pontualmente se necessário.

## API pública — validação e documentação obrigatórias

Cada rota nova (`sendReaction`, `sendLocation`, `sendContact`, `sendPoll`,
`revoke`, `sendEvent`, `sendStickerPack`) é entregável só quando os três itens
abaixo estiverem prontos, não só o handler funcionando manualmente:

- **Validação de request**: 400 com mensagem clara pra campos obrigatórios
  ausentes/malformados (`number`, `key`, `options` vazio, etc.), seguindo o
  padrão já usado nas rotas existentes (`if (!number) return res.status(400)...`).
- **Teste funcional do endpoint**: request real contra instância conectada
  (ou mock equivalente ao já usado em `backend/src/tests/`), cobrindo caminho
  feliz e pelo menos um caso de erro (instância offline `503`, payload inválido
  `400`).
- **Documentação OpenAPI**: entrada correspondente em `docs/openapi.yaml`
  (`paths`, request body schema, exemplos, respostas 201/400/503), no mesmo
  padrão das rotas existentes (`/message/sendText`, `/message/sendMedia`,
  `/message/sendButtons`, etc. — ver linhas 469-890).
- **Cobertura via `zapo-release-triage.mjs`**: rodar `--evolution-api` para
  validar que o contrato local bate com `docs/openapi.yaml` (regra já definida
  em `CLAUDE.md` → Upstreams e trilhos de validação), garantindo que a doc não
  fique dessincronizada da implementação.

Nenhuma rota nova é considerada concluída no plano de implementação sem esses
quatro pontos fechados.

## Frontend — queries (`frontend/src/lib/queries/chat/sendMessage.ts`)

Novos hooks, mesmo padrão `useManageMutation` + invalidate
`["chats","findMessages"]`/`["chats","findChats"]`:

- `useSendReaction`
- `useSendLocation`
- `useSendContact`
- `useSendPoll`
- `useRevokeMessage`
- `useSendEvent`
- `useSendStickerPack`

## Frontend — envio UI

- **`Messages/message-options.tsx`**: emoji picker (reusa
  `InputMessage/whatsapp-emoji-box.tsx`) pra reagir a mensagens; item "Apagar"
  passa a chamar `useRevokeMessage` de verdade (visível só quando `fromMe`).
- **`InputMessage/media-options.tsx`**: dropdown ganha itens "Localização",
  "Contato" (reusa lista de `useContacts` já existente no projeto), "Enquete",
  "Evento".
- Novos componentes em `InputMessage/`:
  - `poll-composer.tsx` — modal pergunta + lista dinâmica de opções (add/remove)
  - `location-picker.tsx` — modal com input lat/lng manual (sem mapa embutido nessa
    entrega — YAGNI, adicionar mapa depois se pedido)
  - `contact-picker.tsx` — modal lista contatos da instância pra selecionar
  - `event-composer.tsx` — modal nome + data/hora + descrição opcional

## Frontend — recebimento/render

- **`Messages/message-renderer.tsx`**: novos `case`:
  - `pollCreationMessageV3` → pergunta + lista de opções, sem contagem
  - `eventMessage` → nome, data formatada, local se houver
  - `stickerPackMessage` → grid pequeno dos stickers do pacote
  - `ptvMessage` → reusa render de `videoMessage` (mesmo player, round video)
- **`Messages/message-content.tsx`**: mensagens-alvo de `reactionMessage` e
  `protocolMessage` (REVOKE) recebidas não geram bolha própria — a lista de
  mensagens (hook `findMessages`) precisa:
  - agrupar `reactionMessage`s por `key.id` do alvo e popular
    `message.reactions[]` da mensagem original (tipo `Reaction[]` já existe,
    hoje nunca populado)
  - marcar mensagem-alvo de `protocolMessage` REVOKE como apagada
    (`message.isDeleted`) e renderizar "🚫 mensagem apagada" no lugar do
    conteúdo original
  - Esse agrupamento acontece client-side em
    `frontend/src/lib/queries/chat/findMessages.ts`, sem mudança de schema
    backend/Prisma.

## Riscos / simplificações assumidas

- Poll: sem envio/exibição de voto (`pollUpdateMessage` só é consumido pra nada
  nessa entrega — fica pronto pra próxima iteração se pedirem contagem).
- vCard gerado é simples (nome + telefone), sem endereço/email/foto.
- Localização sem mapa visual — só coordenadas cruas + link pro Maps.
- Sticker-pack upload multipart pode exigir validação de tamanho/formato mínima
  (reusar padrão de `sendMedia`/`sendSticker`).
