# Cobertura completa de tipos de mensagem no Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Manager enviar e receber/renderizar todos os tipos de mensagem restantes suportados pelo zapo-js — reação, localização, contato, enquete, revoke/apagar, evento, sticker-pack, ptv — com rotas de API validadas, testadas e documentadas no OpenAPI.

**Architecture:** Backend Express mantém contrato compat Evolution API (`/message/send*`), cada rota nova chama `client.message.send(jid, content, ...)` do zapo-js (nativo pra reaction/revoke/poll/event/sticker-pack, raw `Proto.IMessage` pra location/contact). Frontend React consome via hooks React Query (`useManageMutation`) e renderiza no `MessageRenderer` (switch por `messageType`). Reações e revokes recebidos são correlacionados client-side no hook `findMessages` por `key.id`, sem mudança de schema Prisma (campo `Message.message` já é `Json?`).

**Tech Stack:** Express + zapo-js (backend), React 19 + TanStack Query + Tailwind (frontend), `node:test` + `supertest` (testes backend).

## Global Constraints

- Backend mantém contrato compat Evolution API — não migrar frontend pra chamadas nativas zapo-js diretas.
- Toda rota nova precisa: validação 400 de campos obrigatórios, teste funcional (caminho feliz + erro), entrada em `docs/openapi.yaml`, e passar `zapo-release-triage.mjs --evolution-api`.
- Poll V1: só pergunta + opções exibidas, sem contagem de votos agregada.
- Revoke: revoke real via protocolo (`type:'revoke'`), restrito a mensagens `fromMe === true`.
- Sticker-pack e Event entram no escopo desta entrega.
- Toda mudança de schema Prisma precisa migration SQL idempotente manual em `backend/prisma/migrations/` — mas esta feature não precisa de nenhuma (campo `message: Json?` já comporta tudo).
- CHANGELOG.md deve ser atualizado com o trabalho antes do commit final (regra do `CLAUDE.md` do repo).

---

## Visão geral dos arquivos

**Backend**
- Modificar: `backend/src/routes/message.routes.ts` — 7 rotas novas
- Criar: `backend/src/tests/message-new-types.test.ts` — testes das 7 rotas
- Modificar: `docs/openapi.yaml` — 7 entradas de path novas

**Frontend**
- Modificar: `frontend/src/types/evolution.types.ts` — tipos `SendReaction`, `SendLocation`, `SendContact`, `SendPoll`, `RevokeMessage`, `SendEvent`, `SendStickerPack`
- Modificar: `frontend/src/lib/queries/chat/sendMessage.ts` — 7 hooks novos
- Modificar: `frontend/src/lib/queries/chat/findMessages.ts` — agrupamento de reactions/revoke client-side
- Modificar: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx` — cases novos (poll, event, sticker-pack, ptv, deleted)
- Modificar: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-options.tsx` — emoji picker de reação + apagar real
- Modificar: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/media-options.tsx` — itens Localização/Contato/Enquete/Evento
- Criar: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/poll-composer.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/location-picker.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/contact-picker.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/event-composer.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/Messages/poll-message.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/Messages/event-message.tsx`
- Criar: `frontend/src/pages/instance/EmbedChatMessage/Messages/sticker-pack-message.tsx`

---

### Task 1: Backend — rota sendReaction

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Test: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendReaction/:instanceName` — body `{ key: {remoteJid, fromMe, id, participant?}, reaction: string }` → `201 { accepted, key, message: {reactionMessage:{text}}, messageTimestamp, status }`

- [ ] **Step 1: Escrever teste funcional (caminho feliz + validação)**

Criar `backend/src/tests/message-new-types.test.ts` seguindo o padrão de mock já usado em `backend/src/tests/chat-corrections.test.ts` (stub `prisma.instance.findUnique`, mock `ZapoManager.getActive`/`client.message.send`, `supertest` sobre `express()` com `messageRouter` montado em `/message`).

```typescript
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';

import messageRouter from '../routes/message.routes';
import { ZapoManager } from '../manager';
import { prisma } from '../lib/prisma';

process.env.GLOBAL_API_KEY = 'test_global_key';

describe('Message routes — new types', () => {
  let app: express.Express;
  const instanceName = 'test-instance';
  const apiKey = 'test_instance_key';
  let lastSendCall: { jid: string; content: any } | null = null;

  before(() => {
    (prisma.instance.findUnique as any) = async (args: any) => {
      if (args.where.instanceName === instanceName) {
        return { instanceName, apiKey, status: 'connected' };
      }
      return null;
    };

    app = express();
    app.use(express.json());
    app.use('/message', messageRouter);
  });

  beforeEach(() => {
    lastSendCall = null;
    (ZapoManager.getActive as any) = (name: string) => {
      if (name !== instanceName) return null;
      return {
        client: {
          sessionId: instanceName,
          message: {
            send: async (jid: string, content: any) => {
              lastSendCall = { jid, content };
              return { id: 'MOCKED_MSG_ID' };
            },
          },
        },
      };
    };
    (ZapoManager.recordSentMessage as any) = () => {};
  });

  describe('POST /message/sendReaction/:instanceName', () => {
    test('envia reação com sucesso', async () => {
      const res = await request(app)
        .post(`/message/sendReaction/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'ABC123' },
          reaction: '👍',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(res.body.key.id, 'MOCKED_MSG_ID');
      assert.strictEqual(lastSendCall?.content.type, 'reaction');
      assert.strictEqual(lastSendCall?.content.emoji, '👍');
      assert.strictEqual(lastSendCall?.content.target.id, 'ABC123');
    });

    test('retorna 400 quando key ausente', async () => {
      const res = await request(app)
        .post(`/message/sendReaction/${instanceName}`)
        .set('apikey', apiKey)
        .send({ reaction: '👍' });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando reaction ausente', async () => {
      const res = await request(app)
        .post(`/message/sendReaction/${instanceName}`)
        .set('apikey', apiKey)
        .send({ key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'ABC123' } });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendReaction/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'ABC123' },
          reaction: '👍',
        });

      assert.strictEqual(res.status, 503);
    });
  });
});
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL — rota `/message/sendReaction/:instanceName` retorna 404 (rota não existe ainda)

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, logo após o bloco `// 6. Enviar Carousel` (antes de `export default router;`):

```typescript
// 7. Enviar Reação
router.post('/sendReaction/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { key, reaction } = req.body;

    if (!key || !key.id || !key.remoteJid) {
      return res.status(400).json({ error: 'key.id and key.remoteJid are required' });
    }
    if (typeof reaction !== 'string') {
      return res.status(400).json({ error: 'reaction is required (use empty string to remove)' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = key.remoteJid;

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=reaction, to=${jid}, target=${key.id}, emoji=${reaction}`);
    const sentMsg = await active.client.message.send(jid, {
      type: 'reaction',
      target: key,
      emoji: reaction,
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=reaction, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: { reactionMessage: { key, text: reaction } },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: { reactionMessage: { key, text: reaction } },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendReaction error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — 4 testes do describe `sendReaction` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o bloco `/message/sendCarousel/{instanceName}:` (ver padrão em torno da linha 953):

```yaml
  /message/sendReaction/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Reagir a uma mensagem com emoji
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [key, reaction]
              properties:
                key:
                  type: object
                  required: [id, remoteJid]
                  properties:
                    id:
                      type: string
                      example: "ABC123"
                    remoteJid:
                      type: string
                      example: "{{number}}@s.whatsapp.net"
                    fromMe:
                      type: boolean
                    participant:
                      type: string
                reaction:
                  type: string
                  description: Emoji da reação. String vazia remove a reação existente.
                  example: "👍"
            examples:
              reagir:
                value:
                  key: { id: "ABC123", remoteJid: "{{number}}@s.whatsapp.net", fromMe: false }
                  reaction: "👍"
              remover:
                value:
                  key: { id: "ABC123", remoteJid: "{{number}}@s.whatsapp.net", fromMe: false }
                  reaction: ""
      responses:
        '201':
          description: Reação enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: key ou reaction ausentes
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendReaction com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — rota sendLocation

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendLocation/:instanceName` — body `{ number, latitude, longitude, name?, address? }` → `201 { accepted, key, message: {locationMessage}, messageTimestamp, status }`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`, dentro do `describe('Message routes — new types')`, após o describe de `sendReaction`:

```typescript
  describe('POST /message/sendLocation/:instanceName', () => {
    test('envia localização com sucesso', async () => {
      const res = await request(app)
        .post(`/message/sendLocation/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          number: '5511999999999',
          latitude: -23.55052,
          longitude: -46.633308,
          name: 'Praça da Sé',
          address: 'São Paulo, SP',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.locationMessage.degreesLatitude, -23.55052);
      assert.strictEqual(lastSendCall?.content.locationMessage.degreesLongitude, -46.633308);
      assert.strictEqual(lastSendCall?.content.locationMessage.name, 'Praça da Sé');
    });

    test('retorna 400 quando number ausente', async () => {
      const res = await request(app)
        .post(`/message/sendLocation/${instanceName}`)
        .set('apikey', apiKey)
        .send({ latitude: -23.55052, longitude: -46.633308 });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando latitude ou longitude ausentes', async () => {
      const res = await request(app)
        .post(`/message/sendLocation/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', latitude: -23.55052 });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendLocation/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', latitude: -23.55052, longitude: -46.633308 });

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `sendLocation` — rota não existe

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, após a rota `sendReaction`:

```typescript
// 8. Enviar Localização
router.post('/sendLocation/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, latitude, longitude, name, address } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude (numbers) are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const locationContent = {
      locationMessage: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      },
    };

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=location, to=${jid}, lat=${latitude}, lng=${longitude}`);
    const sentMsg = await active.client.message.send(jid, locationContent);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=location, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: locationContent,
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: locationContent,
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendLocation error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes de `sendReaction` e `sendLocation` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `sendReaction`:

```yaml
  /message/sendLocation/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar localização
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, latitude, longitude]
              properties:
                number:
                  type: string
                  example: "{{number}}"
                latitude:
                  type: number
                  example: -23.55052
                longitude:
                  type: number
                  example: -46.633308
                name:
                  type: string
                  example: "Praça da Sé"
                address:
                  type: string
                  example: "São Paulo, SP"
      responses:
        '201':
          description: Localização enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: number, latitude ou longitude ausentes/inválidos
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendLocation com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — rota sendContact

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendContact/:instanceName` — body `{ number, contact: {fullName, phoneNumber, organization?} }` → `201 { accepted, key, message: {contactMessage}, messageTimestamp, status }`
- Produces (helper interno): `buildVCard(fullName: string, phoneNumber: string, organization?: string): string`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`:

```typescript
  describe('POST /message/sendContact/:instanceName', () => {
    test('envia contato com sucesso', async () => {
      const res = await request(app)
        .post(`/message/sendContact/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          number: '5511999999999',
          contact: { fullName: 'João Silva', phoneNumber: '5511988887777' },
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.contactMessage.displayName, 'João Silva');
      assert.match(lastSendCall?.content.contactMessage.vcard, /FN:João Silva/);
      assert.match(lastSendCall?.content.contactMessage.vcard, /TEL.*5511988887777/);
    });

    test('retorna 400 quando number ausente', async () => {
      const res = await request(app)
        .post(`/message/sendContact/${instanceName}`)
        .set('apikey', apiKey)
        .send({ contact: { fullName: 'João Silva', phoneNumber: '5511988887777' } });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando contact.fullName ou phoneNumber ausentes', async () => {
      const res = await request(app)
        .post(`/message/sendContact/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', contact: { fullName: 'João Silva' } });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendContact/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          number: '5511999999999',
          contact: { fullName: 'João Silva', phoneNumber: '5511988887777' },
        });

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `sendContact` — rota não existe

- [ ] **Step 3: Implementar helper vCard + rota**

Adicionar em `backend/src/routes/message.routes.ts`, próximo aos outros helpers (após `saveTempFile`):

```typescript
// Gera vCard 3.0 simples (nome + telefone + organização opcional)
function buildVCard(fullName: string, phoneNumber: string, organization?: string): string {
  const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fullName}`,
    `TEL;type=CELL;waid=${cleanPhone.replace(/^\+/, '')}:${cleanPhone}`,
  ];
  if (organization) lines.push(`ORG:${organization}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}
```

Adicionar rota após `sendLocation`:

```typescript
// 9. Enviar Contato
router.post('/sendContact/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, contact } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    if (!contact?.fullName || !contact?.phoneNumber) {
      return res.status(400).json({ error: 'contact.fullName and contact.phoneNumber are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const vcard = buildVCard(contact.fullName, contact.phoneNumber, contact.organization);
    const contactContent = {
      contactMessage: {
        displayName: contact.fullName,
        vcard,
      },
    };

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=contact, to=${jid}, contactName=${contact.fullName}`);
    const sentMsg = await active.client.message.send(jid, contactContent);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=contact, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: contactContent,
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: contactContent,
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendContact error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes de `sendReaction`, `sendLocation`, `sendContact` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `sendLocation`:

```yaml
  /message/sendContact/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar cartão de contato (vCard)
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, contact]
              properties:
                number:
                  type: string
                  example: "{{number}}"
                contact:
                  type: object
                  required: [fullName, phoneNumber]
                  properties:
                    fullName:
                      type: string
                      example: "João Silva"
                    phoneNumber:
                      type: string
                      example: "5511988887777"
                    organization:
                      type: string
                      example: "Empresa XYZ"
      responses:
        '201':
          description: Contato enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: number ou contact ausentes/inválidos
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendContact com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Backend — rota sendPoll

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendPoll/:instanceName` — body `{ number, name, options: string[], selectableCount? }` → `201 { accepted, key, message: {pollCreationMessageV3}, messageTimestamp, status }`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`:

```typescript
  describe('POST /message/sendPoll/:instanceName', () => {
    test('envia enquete com sucesso', async () => {
      const res = await request(app)
        .post(`/message/sendPoll/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          number: '5511999999999',
          name: 'Qual sua cor favorita?',
          options: ['Azul', 'Verde', 'Vermelho'],
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.type, 'poll');
      assert.strictEqual(lastSendCall?.content.name, 'Qual sua cor favorita?');
      assert.deepStrictEqual(lastSendCall?.content.options, ['Azul', 'Verde', 'Vermelho']);
    });

    test('retorna 400 quando number ausente', async () => {
      const res = await request(app)
        .post(`/message/sendPoll/${instanceName}`)
        .set('apikey', apiKey)
        .send({ name: 'Pergunta', options: ['A', 'B'] });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando options tem menos de 2 itens', async () => {
      const res = await request(app)
        .post(`/message/sendPoll/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', name: 'Pergunta', options: ['Só uma'] });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando name ausente', async () => {
      const res = await request(app)
        .post(`/message/sendPoll/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', options: ['A', 'B'] });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendPoll/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', name: 'Pergunta', options: ['A', 'B'] });

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `sendPoll` — rota não existe

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, após `sendContact`:

```typescript
// 10. Enviar Enquete
router.post('/sendPoll/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, name, options, selectableCount } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'name (poll question) is required' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'options must be an array with at least 2 items' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const pollPayload: any = {
      type: 'poll',
      name,
      options,
    };
    if (selectableCount !== undefined) pollPayload.selectableCount = selectableCount;

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=poll, to=${jid}, name=${name}, optionsCount=${options.length}`);
    const sentMsg = await active.client.message.send(jid, pollPayload);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=poll, to=${jid}, id=${sentMsg.id}`);

    const returnedMsg = {
      pollCreationMessageV3: {
        name,
        options: options.map((opt: string) => ({ optionName: opt })),
        selectableOptionsCount: selectableCount ?? 1,
      },
    };

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendPoll error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes até `sendPoll` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `sendContact`:

```yaml
  /message/sendPoll/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar enquete
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, name, options]
              properties:
                number:
                  type: string
                  example: "{{number}}"
                name:
                  type: string
                  description: Pergunta da enquete
                  example: "Qual sua cor favorita?"
                options:
                  type: array
                  minItems: 2
                  items:
                    type: string
                  example: ["Azul", "Verde", "Vermelho"]
                selectableCount:
                  type: integer
                  description: Quantidade de opções que o votante pode selecionar (padrão 1)
                  example: 1
      responses:
        '201':
          description: Enquete enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: number, name ou options ausentes/inválidos
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendPoll com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Backend — rota revoke

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/revoke/:instanceName` — body `{ key: {remoteJid, fromMe, id, participant?} }` → `201 { accepted, key, message: {protocolMessage}, messageTimestamp, status }`; `403` se `key.fromMe !== true`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`:

```typescript
  describe('POST /message/revoke/:instanceName', () => {
    test('revoga mensagem própria com sucesso', async () => {
      const res = await request(app)
        .post(`/message/revoke/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, id: 'ABC123' },
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.type, 'revoke');
      assert.strictEqual(lastSendCall?.content.target.id, 'ABC123');
    });

    test('retorna 403 quando key.fromMe é false', async () => {
      const res = await request(app)
        .post(`/message/revoke/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'ABC123' },
        });

      assert.strictEqual(res.status, 403);
    });

    test('retorna 400 quando key ausente', async () => {
      const res = await request(app)
        .post(`/message/revoke/${instanceName}`)
        .set('apikey', apiKey)
        .send({});

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/revoke/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, id: 'ABC123' },
        });

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `revoke` — rota não existe

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, após `sendPoll`:

```typescript
// 11. Apagar/Revogar Mensagem
router.post('/revoke/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { key } = req.body;

    if (!key || !key.id || !key.remoteJid) {
      return res.status(400).json({ error: 'key.id and key.remoteJid are required' });
    }
    if (key.fromMe !== true) {
      return res.status(403).json({ error: 'Only own messages (key.fromMe=true) can be revoked' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = key.remoteJid;

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=revoke, to=${jid}, target=${key.id}`);
    const sentMsg = await active.client.message.send(jid, {
      type: 'revoke',
      target: key,
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=revoke, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: { protocolMessage: { type: 'REVOKE', key } },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: { protocolMessage: { type: 'REVOKE', key } },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] revoke error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes até `revoke` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `sendPoll`:

```yaml
  /message/revoke/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Apagar/revogar mensagem própria para todos
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [key]
              properties:
                key:
                  type: object
                  required: [id, remoteJid, fromMe]
                  properties:
                    id:
                      type: string
                      example: "ABC123"
                    remoteJid:
                      type: string
                      example: "{{number}}@s.whatsapp.net"
                    fromMe:
                      type: boolean
                      description: Deve ser true — só mensagens próprias podem ser revogadas
                      example: true
                    participant:
                      type: string
      responses:
        '201':
          description: Mensagem revogada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: key ausente/inválida
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Tentativa de revogar mensagem que não é própria
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota revoke com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Backend — rota sendEvent

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendEvent/:instanceName` — body `{ number, name, startTime, description?, endTime?, location?: {latitude, longitude, name?, address?}, joinLink? }` → `201 { accepted, key, message: {eventMessage}, messageTimestamp, status }`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`:

```typescript
  describe('POST /message/sendEvent/:instanceName', () => {
    test('envia evento com sucesso', async () => {
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const res = await request(app)
        .post(`/message/sendEvent/${instanceName}`)
        .set('apikey', apiKey)
        .send({
          number: '5511999999999',
          name: 'Reunião de time',
          startTime,
          description: 'Alinhamento semanal',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.type, 'event');
      assert.strictEqual(lastSendCall?.content.name, 'Reunião de time');
      assert.strictEqual(lastSendCall?.content.startTime, startTime);
    });

    test('retorna 400 quando number ausente', async () => {
      const res = await request(app)
        .post(`/message/sendEvent/${instanceName}`)
        .set('apikey', apiKey)
        .send({ name: 'Reunião', startTime: Math.floor(Date.now() / 1000) + 3600 });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando name ou startTime ausentes', async () => {
      const res = await request(app)
        .post(`/message/sendEvent/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', name: 'Reunião' });

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendEvent/${instanceName}`)
        .set('apikey', apiKey)
        .send({ number: '5511999999999', name: 'Reunião', startTime: Math.floor(Date.now() / 1000) + 3600 });

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `sendEvent` — rota não existe

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, após `revoke`:

```typescript
// 12. Enviar Evento
router.post('/sendEvent/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, name, startTime, description, endTime, location, joinLink } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }
    if (!name || typeof startTime !== 'number') {
      return res.status(400).json({ error: 'name and startTime (unix seconds) are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const eventPayload: any = {
      type: 'event',
      name,
      startTime,
    };
    if (description !== undefined) eventPayload.description = description;
    if (endTime !== undefined) eventPayload.endTime = endTime;
    if (joinLink !== undefined) eventPayload.joinLink = joinLink;
    if (location?.latitude !== undefined && location?.longitude !== undefined) {
      eventPayload.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        ...(location.name ? { name: location.name } : {}),
        ...(location.address ? { address: location.address } : {}),
      };
    }

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=event, to=${jid}, name=${name}, startTime=${startTime}`);
    const sentMsg = await active.client.message.send(jid, eventPayload);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=event, to=${jid}, id=${sentMsg.id}`);

    const returnedMsg = {
      eventMessage: {
        name,
        startTime,
        ...(description !== undefined ? { description } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(joinLink !== undefined ? { joinLink } : {}),
      },
    };

    const msgData = {
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendEvent error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes até `sendEvent` passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `revoke`:

```yaml
  /message/sendEvent/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar evento/agenda
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, name, startTime]
              properties:
                number:
                  type: string
                  example: "{{number}}"
                name:
                  type: string
                  example: "Reunião de time"
                startTime:
                  type: integer
                  description: Unix timestamp em segundos
                  example: 1739462400
                description:
                  type: string
                  example: "Alinhamento semanal"
                endTime:
                  type: integer
                  example: 1739466000
                joinLink:
                  type: string
                  example: "https://meet.google.com/abc-defg-hij"
                location:
                  type: object
                  properties:
                    latitude:
                      type: number
                    longitude:
                      type: number
                    name:
                      type: string
                    address:
                      type: string
      responses:
        '201':
          description: Evento enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: number, name ou startTime ausentes/inválidos
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendEvent com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Backend — rota sendStickerPack

**Files:**
- Modify: `backend/src/routes/message.routes.ts`
- Modify: `backend/src/tests/message-new-types.test.ts`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: `POST /message/sendStickerPack/:instanceName` (multipart) — campos `number`, `stickerPackId`, `name`, `publisher`, arquivos `stickers` (múltiplos) + `cover` (thumbnail) → `201 { accepted, key, message: {stickerPackMessage}, messageTimestamp, status }`

- [ ] **Step 1: Escrever teste funcional**

Adicionar em `backend/src/tests/message-new-types.test.ts`:

```typescript
  describe('POST /message/sendStickerPack/:instanceName', () => {
    test('envia pacote de figurinhas com sucesso', async () => {
      const res = await request(app)
        .post(`/message/sendStickerPack/${instanceName}`)
        .set('apikey', apiKey)
        .field('number', '5511999999999')
        .field('stickerPackId', 'pack-001')
        .field('name', 'Meu Pacote')
        .field('publisher', 'Zapo Manager')
        .attach('stickers', Buffer.from('fake-webp-1'), 'sticker1.webp')
        .attach('stickers', Buffer.from('fake-webp-2'), 'sticker2.webp')
        .attach('cover', Buffer.from('fake-cover'), 'cover.webp');

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(lastSendCall?.content.type, 'sticker-pack');
      assert.strictEqual(lastSendCall?.content.stickerPackId, 'pack-001');
      assert.strictEqual(lastSendCall?.content.name, 'Meu Pacote');
      assert.strictEqual(lastSendCall?.content.stickers.length, 2);
    });

    test('retorna 400 quando number ausente', async () => {
      const res = await request(app)
        .post(`/message/sendStickerPack/${instanceName}`)
        .set('apikey', apiKey)
        .field('stickerPackId', 'pack-001')
        .field('name', 'Meu Pacote')
        .field('publisher', 'Zapo Manager')
        .attach('stickers', Buffer.from('fake-webp-1'), 'sticker1.webp')
        .attach('cover', Buffer.from('fake-cover'), 'cover.webp');

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando nenhum sticker é anexado', async () => {
      const res = await request(app)
        .post(`/message/sendStickerPack/${instanceName}`)
        .set('apikey', apiKey)
        .field('number', '5511999999999')
        .field('stickerPackId', 'pack-001')
        .field('name', 'Meu Pacote')
        .field('publisher', 'Zapo Manager')
        .attach('cover', Buffer.from('fake-cover'), 'cover.webp');

      assert.strictEqual(res.status, 400);
    });

    test('retorna 400 quando cover ausente', async () => {
      const res = await request(app)
        .post(`/message/sendStickerPack/${instanceName}`)
        .set('apikey', apiKey)
        .field('number', '5511999999999')
        .field('stickerPackId', 'pack-001')
        .field('name', 'Meu Pacote')
        .field('publisher', 'Zapo Manager')
        .attach('stickers', Buffer.from('fake-webp-1'), 'sticker1.webp');

      assert.strictEqual(res.status, 400);
    });

    test('retorna 503 quando instância offline', async () => {
      (ZapoManager.getActive as any) = () => null;
      const res = await request(app)
        .post(`/message/sendStickerPack/${instanceName}`)
        .set('apikey', apiKey)
        .field('number', '5511999999999')
        .field('stickerPackId', 'pack-001')
        .field('name', 'Meu Pacote')
        .field('publisher', 'Zapo Manager')
        .attach('stickers', Buffer.from('fake-webp-1'), 'sticker1.webp')
        .attach('cover', Buffer.from('fake-cover'), 'cover.webp');

      assert.strictEqual(res.status, 503);
    });
  });
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: FAIL no describe `sendStickerPack` — rota não existe

- [ ] **Step 3: Implementar rota no backend**

Adicionar em `backend/src/routes/message.routes.ts`, após `sendEvent`. Usa `upload.fields` (multer) pra aceitar dois campos de arquivo distintos:

```typescript
// 13. Enviar Pacote de Figurinhas
router.post(
  '/sendStickerPack/:instanceName',
  checkStrictInstanceApiKey,
  upload.fields([{ name: 'stickers', maxCount: 30 }, { name: 'cover', maxCount: 1 }]),
  async (req: Request, res: Response) => {
    const tempPaths: string[] = [];
    try {
      const { instanceName } = req.params;
      const { number, stickerPackId, name, publisher } = req.body;
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
      const stickerFiles = files?.stickers ?? [];
      const coverFile = files?.cover?.[0];

      if (!number) {
        return res.status(400).json({ error: 'number is required' });
      }
      if (stickerFiles.length === 0) {
        return res.status(400).json({ error: 'at least one file in stickers[] is required' });
      }
      if (!coverFile) {
        return res.status(400).json({ error: 'cover file is required' });
      }
      if (!stickerPackId || !name || !publisher) {
        return res.status(400).json({ error: 'stickerPackId, name and publisher are required' });
      }

      const active = ZapoManager.getActive(instanceName);
      if (!active) {
        return res.status(503).json({ error: 'Instance is disconnected or offline' });
      }

      const jid = await resolveJid(active.client, number);

      const stickers = stickerFiles.map((file) => {
        const tempPath = saveTempFile(file.buffer, file.originalname);
        tempPaths.push(tempPath);
        return { image: tempPath };
      });
      const coverPath = saveTempFile(coverFile.buffer, coverFile.originalname);
      tempPaths.push(coverPath);

      const stickerPackPayload = {
        type: 'sticker-pack',
        stickerPackId,
        name,
        publisher,
        stickers,
        coverThumbnail: coverPath,
        trayIcon: { fileName: 'tray.webp' },
      };

      console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=sticker-pack, to=${jid}, stickerPackId=${stickerPackId}, count=${stickers.length}`);
      const sentMsg = await active.client.message.send(jid, stickerPackPayload);
      console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=sticker-pack, to=${jid}, id=${sentMsg.id}`);

      const returnedMsg = {
        stickerPackMessage: { stickerPackId, name, publisher },
      };

      const msgData = {
        key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
        message: returnedMsg,
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: undefined,
      };
      ZapoManager.recordSentMessage(instanceName, msgData);

      return res.status(201).json({
        accepted: true,
        key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
        message: returnedMsg,
        messageTimestamp: Math.floor(Date.now() / 1000),
        status: 'PENDING',
      });
    } catch (err: any) {
      console.error(`[MessageRoutes] sendStickerPack error:`, err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      for (const p of tempPaths) {
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) {}
        }
      }
    }
  }
);
```

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `cd backend && npx tsx --test src/tests/message-new-types.test.ts`
Expected: PASS — todos os testes das 7 rotas passam

- [ ] **Step 5: Documentar no OpenAPI**

Adicionar em `docs/openapi.yaml`, após o path `sendEvent`:

```yaml
  /message/sendStickerPack/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar pacote de figurinhas
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [number, stickerPackId, name, publisher, stickers, cover]
              properties:
                number:
                  type: string
                  example: "{{number}}"
                stickerPackId:
                  type: string
                  example: "pack-001"
                name:
                  type: string
                  example: "Meu Pacote"
                publisher:
                  type: string
                  example: "Zapo Manager"
                stickers:
                  type: array
                  items:
                    type: string
                    format: binary
                  description: Arquivos webp das figurinhas (até 30)
                cover:
                  type: string
                  format: binary
                  description: Thumbnail de capa do pacote
      responses:
        '201':
          description: Pacote de figurinhas enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '400':
          description: campos obrigatórios ausentes (number, stickers, cover, stickerPackId, name, publisher)
        '401':
          $ref: '#/components/responses/Unauthorized'
        '503':
          description: Instância desconectada
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/message.routes.ts backend/src/tests/message-new-types.test.ts docs/openapi.yaml
git commit -m "feat(backend): adiciona rota sendStickerPack com testes e doc OpenAPI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Backend — validar triagem de contrato OpenAPI

**Files:**
- Nenhum arquivo novo — validação de consistência

**Interfaces:**
- Consumes: todas as 7 rotas implementadas nas Tasks 1-7 e suas entradas em `docs/openapi.yaml`

- [ ] **Step 1: Rodar script de triagem em modo Evolution API**

Run: `cd "d:/Projetos Dev/Outros/apis-whatsapp-doc-testes/zapo-manager" && node scripts/zapo-release-triage.mjs --evolution-api`

Expected: script reporta as 7 rotas novas como cobertas em `docs/openapi.yaml` (sem gaps de contrato). Se reportar divergência, corrigir o path YAML correspondente até o script passar limpo.

- [ ] **Step 2: Rodar suite completa de testes do backend**

Run: `cd backend && npm test`
Expected: PASS — todos os testes (existentes + `message-new-types.test.ts`) passam sem regressão.

- [ ] **Step 3: Commit (se houve correções)**

```bash
git add docs/openapi.yaml
git commit -m "docs(openapi): corrige divergencias de contrato apontadas pela triagem

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Se nenhuma correção foi necessária, pular este commit.

---

### Task 9: Frontend — tipos e hooks de envio

**Files:**
- Modify: `frontend/src/types/evolution.types.ts`
- Modify: `frontend/src/lib/queries/chat/sendMessage.ts`

**Interfaces:**
- Consumes: rotas backend das Tasks 1-7 (`/message/sendReaction`, `/sendLocation`, `/sendContact`, `/sendPoll`, `/revoke`, `/sendEvent`, `/sendStickerPack`)
- Produces: `useSendReaction()`, `useSendLocation()`, `useSendContact()`, `useSendPoll()`, `useRevokeMessage()`, `useSendEvent()`, `useSendStickerPack()` — cada um retorna `{ sendX: UseMutationResult }` no padrão de `useSendMessage`

- [ ] **Step 1: Adicionar tipos em `evolution.types.ts`**

Adicionar após `SendAudio` (linha 156) em `frontend/src/types/evolution.types.ts`:

```typescript
export type SendReaction = {
  key: Key;
  reaction: string;
};

export type SendLocation = {
  number: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export type SendContact = {
  number: string;
  contact: {
    fullName: string;
    phoneNumber: string;
    organization?: string;
  };
};

export type SendPoll = {
  number: string;
  name: string;
  options: string[];
  selectableCount?: number;
};

export type RevokeMessage = {
  key: Key;
};

export type SendEvent = {
  number: string;
  name: string;
  startTime: number;
  description?: string;
  endTime?: number;
  joinLink?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
};

export type SendStickerPack = {
  number: string;
  stickerPackId: string;
  name: string;
  publisher: string;
  stickers: File[];
  cover: File;
};
```

- [ ] **Step 2: Adicionar hooks em `sendMessage.ts`**

Modificar `frontend/src/lib/queries/chat/sendMessage.ts` — trocar o import do topo:

```typescript
import { SendText, SendMedia, SendAudio, SendReaction, SendLocation, SendContact, SendPoll, RevokeMessage, SendEvent, SendStickerPack } from "@/types/evolution.types";
```

Adicionar antes de `export function useSendMessage()`:

```typescript
interface SendReactionParams {
  instanceName: string;
  token: string;
  data: SendReaction;
}

interface SendLocationParams {
  instanceName: string;
  token: string;
  data: SendLocation;
}

interface SendContactParams {
  instanceName: string;
  token: string;
  data: SendContact;
}

interface SendPollParams {
  instanceName: string;
  token: string;
  data: SendPoll;
}

interface RevokeMessageParams {
  instanceName: string;
  token: string;
  data: RevokeMessage;
}

interface SendEventParams {
  instanceName: string;
  token: string;
  data: SendEvent;
}

interface SendStickerPackParams {
  instanceName: string;
  token: string;
  data: SendStickerPack;
}

const sendReaction = async ({ instanceName, token, data }: SendReactionParams) => {
  const response = await api.post(`/message/sendReaction/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendLocation = async ({ instanceName, token, data }: SendLocationParams) => {
  const response = await api.post(`/message/sendLocation/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendContact = async ({ instanceName, token, data }: SendContactParams) => {
  const response = await api.post(`/message/sendContact/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendPoll = async ({ instanceName, token, data }: SendPollParams) => {
  const response = await api.post(`/message/sendPoll/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const revokeMessage = async ({ instanceName, token, data }: RevokeMessageParams) => {
  const response = await api.post(`/message/revoke/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendEvent = async ({ instanceName, token, data }: SendEventParams) => {
  const response = await api.post(`/message/sendEvent/${instanceName}`, data, {
    headers: { apikey: token, "content-type": "application/json" },
  });
  return response.data;
};

const sendStickerPack = async ({ instanceName, token, data }: SendStickerPackParams) => {
  const formData = new FormData();
  formData.append("number", data.number);
  formData.append("stickerPackId", data.stickerPackId);
  formData.append("name", data.name);
  formData.append("publisher", data.publisher);
  data.stickers.forEach((file) => formData.append("stickers", file));
  formData.append("cover", data.cover);

  const response = await api.post(`/message/sendStickerPack/${instanceName}`, formData, {
    headers: { apikey: token, "content-type": "multipart/form-data" },
  });
  return response.data;
};
```

Adicionar após `export function useSendAudio()` (final do arquivo, antes do fechamento):

```typescript
export function useSendReaction() {
  const sendReactionMutation = useManageMutation(sendReaction, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendReaction: sendReactionMutation };
}

export function useSendLocation() {
  const sendLocationMutation = useManageMutation(sendLocation, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendLocation: sendLocationMutation };
}

export function useSendContact() {
  const sendContactMutation = useManageMutation(sendContact, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendContact: sendContactMutation };
}

export function useSendPoll() {
  const sendPollMutation = useManageMutation(sendPoll, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendPoll: sendPollMutation };
}

export function useRevokeMessage() {
  const revokeMessageMutation = useManageMutation(revokeMessage, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { revokeMessage: revokeMessageMutation };
}

export function useSendEvent() {
  const sendEventMutation = useManageMutation(sendEvent, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendEvent: sendEventMutation };
}

export function useSendStickerPack() {
  const sendStickerPackMutation = useManageMutation(sendStickerPack, {
    invalidateKeys: MESSAGES_INVALIDATE_KEYS,
  });
  return { sendStickerPack: sendStickerPackMutation };
}
```

Nota: `MESSAGES_INVALIDATE_KEYS` já está definida no arquivo (linha 98) — só reusar.

- [ ] **Step 2: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS — sem erros de tipo

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/evolution.types.ts frontend/src/lib/queries/chat/sendMessage.ts
git commit -m "feat(frontend): adiciona tipos e hooks de envio para reaction/location/contact/poll/revoke/event/sticker-pack

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Frontend — agrupamento de reactions/revoke em findMessages

**Files:**
- Modify: `frontend/src/lib/queries/chat/findMessages.ts`
- Modify: `frontend/src/types/evolution.types.ts`

**Interfaces:**
- Consumes: `Message` type (`key.id`, `messageType`, `message.reactionMessage.key.id`, `message.protocolMessage`)
- Produces: `Message & { reactions?: Reaction[]; isDeleted?: boolean }` no array retornado por `useFindMessages` — mensagens de tipo `reactionMessage`/`protocolMessage` (REVOKE) são filtradas do array final e anexadas como metadados na mensagem-alvo.

- [ ] **Step 1: Adicionar tipo `Reaction` em `evolution.types.ts`**

Adicionar após `export type Key = {...}` em `frontend/src/types/evolution.types.ts`:

```typescript
export type Reaction = {
  emoji: string;
  sender: string;
  messageId: string;
};
```

- [ ] **Step 2: Implementar agrupamento em `findMessages.ts`**

Reescrever `frontend/src/lib/queries/chat/findMessages.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindMessagesResponse } from "./types";
import { Message, Reaction } from "@/types/evolution.types";

interface IParams {
  instanceName: string;
  remoteJid: string;
}

const queryKey = (params: Partial<IParams>) => ["chats", "findMessages", JSON.stringify(params)];

/**
 * Agrupa reactionMessage e protocolMessage(REVOKE) recebidos como
 * metadados anexados à mensagem-alvo (por key.id), em vez de renderizá-los
 * como bolhas próprias na timeline.
 */
function groupReactionsAndRevokes(rawMessages: Message[]): (Message & { reactions?: Reaction[]; isDeleted?: boolean })[] {
  const reactionsByTargetId = new Map<string, Reaction[]>();
  const deletedIds = new Set<string>();

  for (const msg of rawMessages) {
    if (msg.messageType === "reactionMessage" && msg.message?.reactionMessage) {
      const targetId = msg.message.reactionMessage.key?.id;
      const emoji = msg.message.reactionMessage.text;
      if (!targetId) continue;
      const list = reactionsByTargetId.get(targetId) ?? [];
      // Remove reação anterior do mesmo sender pra esse alvo (WhatsApp permite 1 reação por pessoa/mensagem)
      const filtered = list.filter((r) => r.sender !== msg.key.remoteJid);
      if (emoji) {
        filtered.push({ emoji, sender: msg.key.remoteJid, messageId: msg.key.id });
      }
      reactionsByTargetId.set(targetId, filtered);
      continue;
    }

    if (msg.messageType === "protocolMessage" && msg.message?.protocolMessage?.type === "REVOKE") {
      const targetId = msg.message.protocolMessage.key?.id;
      if (targetId) deletedIds.add(targetId);
      continue;
    }
  }

  return rawMessages
    .filter((msg) => msg.messageType !== "reactionMessage" && msg.messageType !== "protocolMessage")
    .map((msg) => ({
      ...msg,
      reactions: reactionsByTargetId.get(msg.key.id),
      isDeleted: deletedIds.has(msg.key.id),
    }));
}

export const findMessages = async ({ instanceName, remoteJid }: IParams) => {
  const response = await api.post(`/chat/findMessages/${instanceName}`, {
    where: { key: { remoteJid } },
  });
  const records = response.data?.messages?.records ?? response.data;
  return groupReactionsAndRevokes(records);
};

export const useFindMessages = (props: UseQueryParams<FindMessagesResponse> & Partial<IParams>) => {
  const { instanceName, remoteJid, ...rest } = props;
  return useQuery<FindMessagesResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, remoteJid }),
    queryFn: () => findMessages({ instanceName: instanceName!, remoteJid: remoteJid! }),
    enabled: !!instanceName && !!remoteJid,
  });
};
```

- [ ] **Step 3: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS — sem erros de tipo

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/queries/chat/findMessages.ts frontend/src/types/evolution.types.ts
git commit -m "feat(frontend): agrupa reactions e revokes recebidos na mensagem-alvo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Frontend — renderização de mensagem apagada e ptv

**Files:**
- Modify: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-content.tsx`
- Modify: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx`

**Interfaces:**
- Consumes: `message.isDeleted` (produzido na Task 10), `message.messageType === 'ptvMessage'`

- [ ] **Step 1: Renderizar "mensagem apagada" em `message-content.tsx`**

Modificar `frontend/src/pages/instance/EmbedChatMessage/Messages/message-content.tsx` — trocar a assinatura de `MessageContentProps` pra incluir `isDeleted`:

```typescript
interface MessageContentProps {
  message: Message & { reactions?: Reaction[]; isDeleted?: boolean };
  quotedMessage?: Message;
  chat?: Chat;
  fromMe: boolean;
}
```

Adicionar `Reaction` ao import do topo (já existe `Message, Chat` de `@/types/evolution.types` — trocar por `Message, Chat, Reaction`).

No corpo da função `MessageContent`, logo após a abertura de `<MessageBubble.Content>`, adicionar checagem antes do `<div className="flex flex-col">`:

```typescript
  if (message.isDeleted) {
    return (
      <MessageBubble.Content fromMe={fromMe}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1 italic text-muted-foreground">🚫 Mensagem apagada</div>
          <MessageBubble.Footer fromMe={fromMe}>{renderTimestamp()}</MessageBubble.Footer>
        </div>
      </MessageBubble.Content>
    );
  }
```

- [ ] **Step 2: Adicionar case `ptvMessage` em `message-renderer.tsx`**

Modificar `frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx` — no `switch`, adicionar `case "ptvMessage":` reusando exatamente a lógica de `videoMessage` (round video usa o mesmo player). Trocar:

```typescript
    case "videoMessage":
```

por:

```typescript
    case "videoMessage":
    case "ptvMessage": {
```

E fechar o bloco existente do case `videoMessage` com `}` antes do próximo `case "audioMessage":` (o corpo já usa `message.message.videoMessage?.caption` — funciona igual pra ptv porque o campo populado no proto é `ptvMessage`, então ajustar a leitura de caption pra aceitar os dois):

```typescript
    case "videoMessage":
    case "ptvMessage": {
      // Ensure proper data URI format for video base64
      const videoBase64 = message.message.base64 ? (message.message.base64.startsWith("data:") ? message.message.base64 : `data:video/mp4;base64,${message.message.base64}`) : null;

      return (
        <div className="mb-2 flex flex-col gap-2">
          {videoBase64 ? (
            <video
              src={videoBase64}
              width="400px"
              controls
              style={{
                maxHeight: "400px",
              }}
            />
          ) : (
            <div className="rounded bg-gray-100 p-4 dark:bg-gray-800">
              <p className="text-center text-muted-foreground">Video couldn't be loaded</p>
              <p className="text-center text-xs text-muted-foreground mt-1">Missing base64 data</p>
            </div>
          )}
          <MarkdownWrapper>{message.message.videoMessage?.caption ?? message.message.ptvMessage?.caption}</MarkdownWrapper>
        </div>
      );
    }
```

- [ ] **Step 3: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS — sem erros de tipo

- [ ] **Step 4: Rodar lint**

Run: `cd frontend && npm run lint:check`
Expected: PASS — sem erros de lint

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/instance/EmbedChatMessage/Messages/message-content.tsx frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx
git commit -m "feat(frontend): renderiza mensagem apagada e ptvMessage no chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Frontend — renderização de poll, event e sticker-pack

**Files:**
- Create: `frontend/src/pages/instance/EmbedChatMessage/Messages/poll-message.tsx`
- Create: `frontend/src/pages/instance/EmbedChatMessage/Messages/event-message.tsx`
- Create: `frontend/src/pages/instance/EmbedChatMessage/Messages/sticker-pack-message.tsx`
- Modify: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx`

**Interfaces:**
- Produces: `PollMessage({ pollMessage: {name, options: {optionName}[]} })`, `EventMessage({ eventMessage: {name, startTime, description?, endTime?, joinLink?} })`, `StickerPackMessage({ stickerPackMessage: {name, publisher, stickers?: {fileName}[]} })`

- [ ] **Step 1: Criar `poll-message.tsx`**

```typescript
interface PollMessageProps {
  pollMessage: {
    name: string;
    options: { optionName: string }[];
  };
  fromMe: boolean;
}

function PollMessage({ pollMessage, fromMe }: PollMessageProps) {
  if (!pollMessage?.name) return null;

  return (
    <div
      className={`-m-2 mb-1 flex min-w-[220px] flex-col gap-2 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">📊 Enquete</div>
      <div className="text-md font-medium">{pollMessage.name}</div>
      <div className="flex flex-col gap-1">
        {pollMessage.options?.map((opt, idx) => (
          <div key={`${opt.optionName}-${idx}`} className="rounded border border-current/20 px-2 py-1 text-sm">
            {opt.optionName}
          </div>
        ))}
      </div>
    </div>
  );
}

export { PollMessage };
```

- [ ] **Step 2: Criar `event-message.tsx`**

```typescript
interface EventMessageProps {
  eventMessage: {
    name: string;
    startTime: number;
    description?: string;
    endTime?: number;
    joinLink?: string;
  };
  fromMe: boolean;
}

function formatEventDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventMessage({ eventMessage, fromMe }: EventMessageProps) {
  if (!eventMessage?.name) return null;

  return (
    <div
      className={`-m-2 mb-1 flex min-w-[220px] flex-col gap-1 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">📅 Evento</div>
      <div className="text-md font-medium">{eventMessage.name}</div>
      <div className="text-sm text-muted-foreground">{formatEventDate(eventMessage.startTime)}</div>
      {eventMessage.description && <div className="text-sm">{eventMessage.description}</div>}
      {eventMessage.joinLink && (
        <a href={eventMessage.joinLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
          {eventMessage.joinLink}
        </a>
      )}
    </div>
  );
}

export { EventMessage };
```

- [ ] **Step 3: Criar `sticker-pack-message.tsx`**

```typescript
interface StickerPackMessageProps {
  stickerPackMessage: {
    name: string;
    publisher: string;
  };
  fromMe: boolean;
}

function StickerPackMessage({ stickerPackMessage, fromMe }: StickerPackMessageProps) {
  if (!stickerPackMessage?.name) return null;

  return (
    <div
      className={`-m-2 mb-1 flex flex-col gap-1 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">🎨 Pacote de figurinhas</div>
      <div className="text-md font-medium">{stickerPackMessage.name}</div>
      <div className="text-sm text-muted-foreground">{stickerPackMessage.publisher}</div>
    </div>
  );
}

export { StickerPackMessage };
```

- [ ] **Step 4: Adicionar os 3 cases em `message-renderer.tsx`**

Adicionar imports no topo de `frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx`:

```typescript
import { EventMessage } from "./event-message";
import { PollMessage } from "./poll-message";
import { StickerPackMessage } from "./sticker-pack-message";
```

Adicionar cases no `switch`, antes de `default:`:

```typescript
    case "pollCreationMessageV3":
      return <PollMessage pollMessage={message.message.pollCreationMessageV3} fromMe={fromMe} />;

    case "eventMessage":
      return <EventMessage eventMessage={message.message.eventMessage} fromMe={fromMe} />;

    case "stickerPackMessage":
      return <StickerPackMessage stickerPackMessage={message.message.stickerPackMessage} fromMe={fromMe} />;
```

- [ ] **Step 5: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 6: Rodar lint**

Run: `cd frontend && npm run lint:check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/instance/EmbedChatMessage/Messages/poll-message.tsx frontend/src/pages/instance/EmbedChatMessage/Messages/event-message.tsx frontend/src/pages/instance/EmbedChatMessage/Messages/sticker-pack-message.tsx frontend/src/pages/instance/EmbedChatMessage/Messages/message-renderer.tsx
git commit -m "feat(frontend): renderiza poll, event e sticker-pack no chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Frontend — UI de reação e apagar em MessageOptions

**Files:**
- Modify: `frontend/src/pages/instance/EmbedChatMessage/Messages/message-options.tsx`

**Interfaces:**
- Consumes: `useSendReaction()` (Task 9), `useRevokeMessage()` (Task 9), `WhatsAppEmojiBox` (componente existente em `InputMessage/whatsapp-emoji-box.tsx`)

- [ ] **Step 1: Verificar assinatura de `WhatsAppEmojiBox`**

Run: `cd frontend && grep -n "handleEmojiClick\|interface\|export default\|export {" src/pages/instance/EmbedChatMessage/InputMessage/whatsapp-emoji-box.tsx`

Confirmar prop de callback do componente antes de integrar (usado hoje em `InputMessage/index.tsx` como `<WhatsAppEmojiBox handleEmojiClick={handleEmojiClick} />`).

- [ ] **Step 2: Implementar reação e apagar real**

Reescrever `frontend/src/pages/instance/EmbedChatMessage/Messages/message-options.tsx`:

```typescript
import { ChevronDown, ReplyIcon, DeleteIcon, SmilePlusIcon } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";

import { useEmbedColors } from "@/contexts/EmbedColorsContext";
import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { ReplyMessageContext } from "@/contexts/ReplyingMessage/ReplyingMessageContext";

import { useSendReaction, useRevokeMessage } from "@/lib/queries/chat/sendMessage";

import { Message } from "@/types/evolution.types";

import WhatsAppEmojiBox from "../InputMessage/whatsapp-emoji-box";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MessageOptions = ({ message, fromMe }: { message: Message; fromMe: boolean }) => {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { fromMeBubbleColor, fromOtherBubbleColor } = useEmbedColors();
  const { sendReaction } = useSendReaction();
  const { revokeMessage } = useRevokeMessage();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleReact = (emoji: string) => {
    if (!instance?.name || !instance?.token) return;
    sendReaction(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key, reaction: emoji },
      },
      {
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async () => {
    if (!instance?.name || !instance?.token) return;
    if (!message.key.fromMe) return;
    revokeMessage(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key },
      },
      {
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
  };

  return (
    <div className="invisible absolute right-0 top-0 z-50 flex gap-1 opacity-0 transition-all duration-300 group-hover:visible group-hover:opacity-100">
      <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full"
            style={{ backgroundColor: fromMe ? fromMeBubbleColor : fromOtherBubbleColor }}>
            <SmilePlusIcon className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">{t("chat.message.react")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex gap-1 p-2">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" className="rounded p-1 text-lg hover:bg-muted" onClick={() => handleReact(emoji)}>
              {emoji}
            </button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            id="message-options"
            className="rounded-full"
            style={{ backgroundColor: fromMe ? fromMeBubbleColor : fromOtherBubbleColor }}>
            <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">{t("chat.message.options")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setReplyingMessage(message)} className="cursor-pointer">
            <ReplyIcon className="mr-2 h-4 w-4" />
            {t("chat.message.reply")}
          </DropdownMenuItem>
          {instance?.integration !== "WHATSAPP-BUSINESS" && fromMe && (
            <DropdownMenuItem onClick={handleDeleteMessage} className="cursor-pointer">
              <DeleteIcon className="mr-2 h-4 w-4" />
              {t("chat.message.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export { MessageOptions };
```

Nota: `handleEmojiClick` de `WhatsAppEmojiBox` não é usado aqui — trocado por picker de reações rápidas fixo (`QUICK_REACTIONS`), YAGNI evita reusar o emoji-box completo (teclado inteiro) só pra reagir; ajustar import se `WhatsAppEmojiBox` acabar não sendo referenciado (remover import não usado).

- [ ] **Step 3: Remover import não usado se aplicável**

Se `WhatsAppEmojiBox` não for chamado no componente final (ver nota acima), remover a linha de import `import WhatsAppEmojiBox from "../InputMessage/whatsapp-emoji-box";`.

- [ ] **Step 4: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 5: Rodar lint**

Run: `cd frontend && npm run lint:check`
Expected: PASS — sem import não usado, sem erro

- [ ] **Step 6: Adicionar chaves i18n**

Adicionar em `frontend/src/translate/languages/pt-BR.json`, `en-US.json`, `es-ES.json`, `fr-FR.json` dentro do objeto `chat.message`:

pt-BR:
```json
"react": "Reagir"
```

en-US:
```json
"react": "React"
```

es-ES:
```json
"react": "Reaccionar"
```

fr-FR:
```json
"react": "Réagir"
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/instance/EmbedChatMessage/Messages/message-options.tsx frontend/src/translate/languages/pt-BR.json frontend/src/translate/languages/en-US.json frontend/src/translate/languages/es-ES.json frontend/src/translate/languages/fr-FR.json
git commit -m "feat(frontend): adiciona reacao rapida e apagar real no MessageOptions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Frontend — modais de composição (Localização, Contato, Enquete, Evento)

**Files:**
- Create: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/location-picker.tsx`
- Create: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/contact-picker.tsx`
- Create: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/poll-composer.tsx`
- Create: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/event-composer.tsx`

**Interfaces:**
- Consumes: `useSendLocation`, `useSendContact`, `useSendPoll`, `useSendEvent` (Task 9)
- Produces: `LocationPicker({ open, onOpenChange, remoteJid })`, `ContactPicker({ open, onOpenChange, remoteJid })`, `PollComposer({ open, onOpenChange, remoteJid })`, `EventComposer({ open, onOpenChange, remoteJid })` — cada um é um `Dialog` autocontido que envia e fecha ao concluir.

- [ ] **Step 1: Verificar componente `Dialog` disponível no design system**

Run: `cd frontend && grep -rn "from \"@evoapi/design-system/dialog\"" src/pages/instance | head -5`

Confirmar API do `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` usada em outro lugar do projeto antes de escrever os 4 componentes (usar exatamente o mesmo padrão de import/composição já estabelecido).

- [ ] **Step 2: Criar `location-picker.tsx`**

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@evoapi/design-system/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendLocation } from "@/lib/queries/chat/sendMessage";

interface LocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function LocationPicker({ open, onOpenChange, remoteJid }: LocationPickerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendLocation } = useSendLocation();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error(t("chat.location.invalidCoordinates"));
      return;
    }

    setIsSending(true);
    await sendLocation(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, latitude: lat, longitude: lng, name: name || undefined, address: address || undefined },
      },
      {
        onSuccess: () => {
          setLatitude("");
          setLongitude("");
          setName("");
          setAddress("");
          onOpenChange(false);
        },
        onError: () => toast.error(t("chat.toast.sendError")),
        onSettled: () => setIsSending(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.location.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.location.latitude")} value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          <Input placeholder={t("chat.location.longitude")} value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          <Input placeholder={t("chat.location.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={t("chat.location.address")} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !latitude || !longitude} onClick={handleSend}>
            {t("chat.location.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { LocationPicker };
```

- [ ] **Step 3: Criar `contact-picker.tsx`**

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@evoapi/design-system/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendContact } from "@/lib/queries/chat/sendMessage";

interface ContactPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function ContactPicker({ open, onOpenChange, remoteJid }: ContactPickerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendContact } = useSendContact();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    if (!fullName.trim() || !phoneNumber.trim()) {
      toast.error(t("chat.contact.missingFields"));
      return;
    }

    setIsSending(true);
    await sendContact(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, contact: { fullName, phoneNumber } },
      },
      {
        onSuccess: () => {
          setFullName("");
          setPhoneNumber("");
          onOpenChange(false);
        },
        onError: () => toast.error(t("chat.toast.sendError")),
        onSettled: () => setIsSending(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.contact.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.contact.fullName")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder={t("chat.contact.phoneNumber")} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !fullName || !phoneNumber} onClick={handleSend}>
            {t("chat.contact.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ContactPicker };
```

- [ ] **Step 4: Criar `poll-composer.tsx`**

```typescript
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@evoapi/design-system/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendPoll } from "@/lib/queries/chat/sendMessage";

interface PollComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function PollComposer({ open, onOpenChange, remoteJid }: PollComposerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendPoll } = useSendPoll();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isSending, setIsSending] = useState(false);

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === idx ? value : opt)));
  };

  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (idx: number) => setOptions((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      toast.error(t("chat.poll.missingFields"));
      return;
    }

    setIsSending(true);
    await sendPoll(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, name: question, options: validOptions },
      },
      {
        onSuccess: () => {
          setQuestion("");
          setOptions(["", ""]);
          onOpenChange(false);
        },
        onError: () => toast.error(t("chat.toast.sendError")),
        onSettled: () => setIsSending(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.poll.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.poll.question")} value={question} onChange={(e) => setQuestion(e.target.value)} />
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input placeholder={`${t("chat.poll.option")} ${idx + 1}`} value={opt} onChange={(e) => updateOption(idx, e.target.value)} />
              {options.length > 2 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(idx)}>
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" className="gap-1" onClick={addOption}>
            <PlusIcon className="h-4 w-4" />
            {t("chat.poll.addOption")}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !question} onClick={handleSend}>
            {t("chat.poll.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PollComposer };
```

- [ ] **Step 5: Criar `event-composer.tsx`**

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@evoapi/design-system/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendEvent } from "@/lib/queries/chat/sendMessage";

interface EventComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function EventComposer({ open, onOpenChange, remoteJid }: EventComposerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendEvent } = useSendEvent();

  const [name, setName] = useState("");
  const [datetime, setDatetime] = useState("");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    if (!name.trim() || !datetime) {
      toast.error(t("chat.event.missingFields"));
      return;
    }
    const startTime = Math.floor(new Date(datetime).getTime() / 1000);
    if (Number.isNaN(startTime)) {
      toast.error(t("chat.event.invalidDate"));
      return;
    }

    setIsSending(true);
    await sendEvent(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, name, startTime, description: description || undefined },
      },
      {
        onSuccess: () => {
          setName("");
          setDatetime("");
          setDescription("");
          onOpenChange(false);
        },
        onError: () => toast.error(t("chat.toast.sendError")),
        onSettled: () => setIsSending(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.event.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.event.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          <Textarea placeholder={t("chat.event.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !name || !datetime} onClick={handleSend}>
            {t("chat.event.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EventComposer };
```

- [ ] **Step 6: Adicionar chaves i18n nos 4 arquivos de idioma**

Adicionar em `frontend/src/translate/languages/pt-BR.json` dentro de `chat`:

```json
"location": {
  "title": "Enviar localização",
  "latitude": "Latitude",
  "longitude": "Longitude",
  "name": "Nome do local (opcional)",
  "address": "Endereço (opcional)",
  "send": "Enviar",
  "invalidCoordinates": "Latitude e longitude devem ser números válidos"
},
"contact": {
  "title": "Enviar contato",
  "fullName": "Nome completo",
  "phoneNumber": "Telefone (com DDI)",
  "send": "Enviar",
  "missingFields": "Preencha nome e telefone"
},
"poll": {
  "title": "Criar enquete",
  "question": "Pergunta",
  "option": "Opção",
  "addOption": "Adicionar opção",
  "send": "Enviar",
  "missingFields": "Preencha a pergunta e ao menos 2 opções"
},
"event": {
  "title": "Criar evento",
  "name": "Nome do evento",
  "description": "Descrição (opcional)",
  "send": "Enviar",
  "missingFields": "Preencha nome e data",
  "invalidDate": "Data inválida"
}
```

Adicionar traduções equivalentes em `en-US.json`, `es-ES.json`, `fr-FR.json` seguindo o mesmo padrão de chaves com texto traduzido pro respectivo idioma.

- [ ] **Step 7: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 8: Rodar lint**

Run: `cd frontend && npm run lint:check`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/instance/EmbedChatMessage/InputMessage/location-picker.tsx frontend/src/pages/instance/EmbedChatMessage/InputMessage/contact-picker.tsx frontend/src/pages/instance/EmbedChatMessage/InputMessage/poll-composer.tsx frontend/src/pages/instance/EmbedChatMessage/InputMessage/event-composer.tsx frontend/src/translate/languages/pt-BR.json frontend/src/translate/languages/en-US.json frontend/src/translate/languages/es-ES.json frontend/src/translate/languages/fr-FR.json
git commit -m "feat(frontend): adiciona modais de composicao para localizacao, contato, enquete e evento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Frontend — integrar modais no MediaOptions

**Files:**
- Modify: `frontend/src/pages/instance/EmbedChatMessage/InputMessage/media-options.tsx`

**Interfaces:**
- Consumes: `LocationPicker`, `ContactPicker`, `PollComposer`, `EventComposer` (Task 14) — todos recebem `{ open, onOpenChange, remoteJid }`

- [ ] **Step 1: Adicionar itens de menu e state dos modais**

Modificar `frontend/src/pages/instance/EmbedChatMessage/InputMessage/media-options.tsx`. Trocar os imports do topo para incluir `useSearchParams`, os ícones novos e os 4 componentes:

```typescript
import { PlusIcon, ImagesIcon, FilePlus, MapPinIcon, UserIcon, BarChart3Icon, CalendarIcon } from "lucide-react";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";

import { useEmbedColors } from "@/contexts/EmbedColorsContext";

import { Instance } from "@/types/evolution.types";

import { ContactPicker } from "./contact-picker";
import { EventComposer } from "./event-composer";
import { LocationPicker } from "./location-picker";
import { PollComposer } from "./poll-composer";
```

No corpo do componente `MediaOptions`, adicionar após `const [openDropdown, setOpenDropdown] = useState(false);`:

```typescript
  const [searchParams] = useSearchParams();
  const remoteJid = searchParams.get("remoteJid") ?? "";
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [showEventComposer, setShowEventComposer] = useState(false);
```

No `DropdownMenuContent`, adicionar após o item `chat.media.photosAndVideos`:

```typescript
          <DropdownMenuItem onClick={() => setShowLocationPicker(true)}>
            <MapPinIcon className="mr-2 h-4 w-4" />
            {t("chat.media.location")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowContactPicker(true)}>
            <UserIcon className="mr-2 h-4 w-4" />
            {t("chat.media.contact")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowPollComposer(true)}>
            <BarChart3Icon className="mr-2 h-4 w-4" />
            {t("chat.media.poll")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEventComposer(true)}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {t("chat.media.event")}
          </DropdownMenuItem>
```

Antes do `</>` de fechamento do componente (depois do `</DropdownMenu>`), adicionar:

```typescript
      <LocationPicker open={showLocationPicker} onOpenChange={setShowLocationPicker} remoteJid={remoteJid} />
      <ContactPicker open={showContactPicker} onOpenChange={setShowContactPicker} remoteJid={remoteJid} />
      <PollComposer open={showPollComposer} onOpenChange={setShowPollComposer} remoteJid={remoteJid} />
      <EventComposer open={showEventComposer} onOpenChange={setShowEventComposer} remoteJid={remoteJid} />
```

- [ ] **Step 2: Adicionar chaves i18n `chat.media.location/contact/poll/event`**

Adicionar em `frontend/src/translate/languages/pt-BR.json` dentro de `chat.media`:

```json
"location": "Localização",
"contact": "Contato",
"poll": "Enquete",
"event": "Evento"
```

Adicionar traduções equivalentes em `en-US.json`, `es-ES.json`, `fr-FR.json`.

- [ ] **Step 3: Rodar type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS

- [ ] **Step 4: Rodar lint**

Run: `cd frontend && npm run lint:check`
Expected: PASS

- [ ] **Step 5: Rodar build**

Run: `cd frontend && npm run build`
Expected: PASS — build de produção sem erros

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/instance/EmbedChatMessage/InputMessage/media-options.tsx frontend/src/translate/languages/pt-BR.json frontend/src/translate/languages/en-US.json frontend/src/translate/languages/es-ES.json frontend/src/translate/languages/fr-FR.json
git commit -m "feat(frontend): integra modais de localizacao/contato/enquete/evento no MediaOptions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: Verificação manual end-to-end + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Nenhuma — task de verificação manual e documentação de encerramento

- [ ] **Step 1: Subir backend e frontend localmente**

Run: `cd backend && npm run dev` (background)
Run: `cd frontend && npm run dev` (background)

- [ ] **Step 2: Testar manualmente cada tipo novo com instância conectada real**

Acessar `http://localhost:5173/manager/instance/<instanceId>/chat`, selecionar conversa com número de teste, e validar manualmente:
- Reagir a uma mensagem recebida com emoji rápido — reação aparece na bolha
- Apagar mensagem própria enviada — vira "🚫 Mensagem apagada" nos dois lados (self-test enviando pro próprio número, se disponível)
- Enviar localização — aparece como card com coordenadas
- Enviar contato — aparece como card de contato
- Criar enquete com 3 opções — aparece pergunta + opções sem contagem
- Criar evento — aparece card com nome/data
- Receber vídeo redondo (ptv) de outro WhatsApp — renderiza como vídeo normal
- Receber pacote de figurinhas — renderiza card com nome/publisher

Anotar qualquer falha encontrada e corrigir antes de prosseguir (voltar à task correspondente).

- [ ] **Step 3: Rodar suite completa de testes (backend + frontend)**

Run: `cd backend && npm test`
Expected: PASS — sem regressão

Run: `cd frontend && npm run type-check && npm run lint:check`
Expected: PASS

- [ ] **Step 4: Rodar E2E Playwright se aplicável ao chat**

Run: `cd "d:/Projetos Dev/Outros/apis-whatsapp-doc-testes/zapo-manager" && npx playwright test tests/zapo-*.spec.ts`
Expected: PASS ou SKIP (testes que exigem env vars de número real pulam automaticamente conforme `docs/TESTING.md`)

- [ ] **Step 5: Atualizar CHANGELOG.md**

Adicionar em `CHANGELOG.md`, na seção `[Unreleased]` (criar se não existir, no topo do arquivo):

```markdown
## [Unreleased]

### Added
- Backend: rotas `sendReaction`, `sendLocation`, `sendContact`, `sendPoll`, `revoke`, `sendEvent`, `sendStickerPack` em `/message/*`, documentadas em `docs/openapi.yaml` e cobertas por testes em `backend/src/tests/message-new-types.test.ts`.
- Frontend: chat do Manager envia e renderiza reação, localização, contato, enquete (sem contagem de votos), revoke/apagar real, evento e pacote de figurinhas; vídeo redondo (ptv) renderiza como vídeo normal; reações e revokes recebidos são agrupados client-side na mensagem-alvo via `findMessages`.

### Pendências ativas
- Poll: contagem agregada de votos (`pollUpdateMessage`) não implementada nesta entrega — só exibição de pergunta/opções.
```

- [ ] **Step 6: Commit final**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): registra cobertura completa de tipos de mensagem no chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review do Plano

**Cobertura do spec:** todos os 7 tipos de mensagem faltantes do design (reaction, location, contact, poll, revoke, event, sticker-pack) têm task de backend (rota+teste+doc) e task de frontend (envio+recebimento). ptv coberto na Task 11. Requisito de validação/teste/doc OpenAPI por rota coberto em cada Task 1-7 + validação de triagem na Task 8.

**Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem código completo executável.

**Consistência de tipos:** `Key` (já existe em `evolution.types.ts`) reusado em `SendReaction`/`RevokeMessage`; `Reaction` novo tipo introduzido na Task 10 e consumido na Task 11 (`message-content.tsx`) com nome idêntico; hooks `useSendX` seguem exatamente o padrão de `useSendMessage`/`useSendMedia`/`useSendAudio` já existente, sem divergência de nome entre Task 9 (produção) e Tasks 13-15 (consumo).
