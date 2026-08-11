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
});
