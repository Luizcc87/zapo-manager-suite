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
