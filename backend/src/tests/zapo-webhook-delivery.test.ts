import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server as HttpServer } from 'http';

import { ZapoManager } from '../manager';
import { prisma } from '../lib/prisma';

process.env.GLOBAL_API_KEY = 'test_global_key';

describe('Zapo Webhook Delivery Test Suite', () => {
  let receiverApp: express.Express;
  let receiverServer: HttpServer;
  let receiverPort: number;
  let http500Port: number;

  const instanceName = 'zapo-webhook-delivery';
  const instanceApiKey = 'zapo_webhook_key';

  const received: Array<{ method: string; headers: any; body: any }> = [];
  const received500: Array<{ method: string; headers: any; body: any }> = [];

  before(async () => {
    (prisma.instance.findUnique as any) = async (args: any) => {
      if (args.where.instanceName === instanceName) {
        return {
          instanceName,
          apiKey: instanceApiKey,
          status: 'connected',
          mobileTransport: false,
          deviceInfo: null,
          settingsConfig: {},
          proxyConfig: {},
          webhookConfig: {
            enabled: true,
            url: `http://127.0.0.1:${receiverPort}/webhook`,
            events: ['connection.update', 'messages.upsert'],
            base64: false,
            byEvents: true,
          },
        };
      }
      return null;
    };

    receiverApp = express();
    receiverApp.use(express.json({ limit: '1mb' }));
    receiverApp.post('/webhook', (req, res) => {
      received.push({
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      res.status(200).json({ ok: true });
    });

    receiverServer = new HttpServer(receiverApp);
    await new Promise<void>((resolve) => {
      receiverServer.listen(0, () => {
        const address = receiverServer.address();
        if (address && typeof address !== 'string') {
          receiverPort = address.port;
        }
        resolve();
      });
    });

    const failingApp = express();
    failingApp.use(express.json({ limit: '1mb' }));
    failingApp.post('/webhook', (req, res) => {
      received500.push({
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      res.status(500).json({ ok: false });
    });

    const failingServer = new HttpServer(failingApp);
    await new Promise<void>((resolve) => {
      failingServer.listen(0, () => {
        const address = failingServer.address();
        if (address && typeof address !== 'string') {
          http500Port = address.port;
        }
        resolve();
      });
    });

    (globalThis as any).__zapoWebhookFailingServer = failingServer;
  });

  after(() => new Promise<void>((resolve) => {
    const failingServer = (globalThis as any).__zapoWebhookFailingServer as HttpServer | undefined;
    if (failingServer) {
      failingServer.close(() => {
        receiverServer.close(() => resolve());
      });
      return;
    }
    receiverServer.close(() => resolve());
  }));

  test('1. should deliver connection.update payload to local receiver', async () => {
    received.length = 0;

    await (ZapoManager as any).sendWebhook(instanceName, 'connection.update', {
      status: 'connected',
      meJid: '5511999999999@s.whatsapp.net',
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].method, 'POST');
    assert.strictEqual(received[0].headers['content-type'], 'application/json');
    assert.strictEqual(received[0].headers['apikey'], instanceName);
    assert.strictEqual(received[0].body.event, 'connection.update');
    assert.strictEqual(received[0].body.instance, instanceName);
    assert.deepStrictEqual(received[0].body.payload, {
      status: 'connected',
      meJid: '5511999999999@s.whatsapp.net',
    });
  });

  test('2. should deliver messages.upsert payload to local receiver', async () => {
    received.length = 0;

    await (ZapoManager as any).sendWebhook(instanceName, 'messages.upsert', {
      instance: instanceName,
      data: {
        key: {
          id: 'msg-123',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        messageType: 'conversation',
        message: {
          conversation: 'hello from test',
        },
        messageTimestamp: '1710000000',
      },
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].body.event, 'messages.upsert');
    assert.strictEqual(received[0].body.instance, instanceName);
    assert.strictEqual(received[0].body.payload.instance, instanceName);
    assert.strictEqual(received[0].body.payload.data.messageType, 'conversation');
    assert.strictEqual(received[0].body.payload.data.message.conversation, 'hello from test');
  });

  test('3. documents current behavior for HTTP 500 receivers without retry-on-status policy', async () => {
    const originalFindUnique = prisma.instance.findUnique;

    (prisma.instance.findUnique as any) = async (args: any) => {
      if (args.where.instanceName === instanceName) {
        return {
          instanceName,
          apiKey: instanceApiKey,
          status: 'connected',
          mobileTransport: false,
          deviceInfo: null,
          settingsConfig: {},
          proxyConfig: {},
          webhookConfig: {
            enabled: true,
            url: `http://127.0.0.1:${http500Port}/webhook`,
            events: ['connection.update'],
            base64: false,
            byEvents: true,
          },
        };
      }
      return null;
    };

    await (ZapoManager as any).sendWebhook(instanceName, 'connection.update', {
      status: 'connected',
    });

    assert.strictEqual(received500.length, 3);
    assert.strictEqual(received500[0].body.event, 'connection.update');
    assert.strictEqual(received500[0].body.instance, instanceName);
    (prisma.instance.findUnique as any) = originalFindUnique;
  });
});
