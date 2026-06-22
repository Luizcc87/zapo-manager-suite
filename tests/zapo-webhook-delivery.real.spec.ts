/**
 * Suíte real de webhook.
 *
 * Execução opt-in:
 * - ALLOW_REAL_WEBHOOK_TESTS=true
 * - TEST_CONNECTED_INSTANCE=<instância conectada>
 * - TEST_TARGET_NUMBER=<número de destino real>
 *
 * A suíte:
 * - sobe um receiver HTTP local temporário
 * - configura o webhook da instância real para o receiver
 * - dispara um ciclo real de desconexão/reconexão
 * - valida a entrega do webhook `connection.update`
 */

import { test, expect } from '@playwright/test';
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http';

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';
const CONNECTED_INSTANCE = process.env.TEST_CONNECTED_INSTANCE || 'test-4';
const TARGET_NUMBER = process.env.TEST_TARGET_NUMBER || '';
const ENABLE_REAL = process.env.ALLOW_REAL_WEBHOOK_TESTS === 'true';

test.describe('Zapo Webhook Delivery Real Suite', () => {
  test.setTimeout(90_000);
  test.skip(!ENABLE_REAL, 'Defina ALLOW_REAL_WEBHOOK_TESTS=true para habilitar a suíte real.');
  test.skip(!TARGET_NUMBER, 'Defina TEST_TARGET_NUMBER para a suíte real.');

  let receiverServer: HttpServer;
  let receiverPort = 0;
  let resolvedInstance = '';
  let connectedInstanceKey = '';
  let originalWebhook: any = null;
  let payloadPromise: Promise<any> | null = null;
  let payloadResolve: ((value: any) => void) | null = null;
  let suiteReady = false;

  test.beforeAll(async ({ request }) => {
    receiverServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        let body: any = null;
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = raw;
        }

        if (payloadResolve) {
          payloadResolve({
            headers: req.headers,
            body,
          });
          payloadResolve = null;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => {
      receiverServer.listen(0, () => {
        const address = receiverServer.address();
        if (address && typeof address !== 'string') {
          receiverPort = address.port;
        }
        resolve();
      });
    });

    const listResponse = await request.get('/instance/fetchInstances', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(listResponse.status()).toBe(200);

    const list = await listResponse.json();
    const preferred = list.find((i: any) => i.name === CONNECTED_INSTANCE);
    const fallback = list.find((i: any) => i.connectionStatus === 'open');
    const found = preferred ?? fallback;

    if (!found) {
      return;
    }

    resolvedInstance = found.name;
    connectedInstanceKey = found.token;
    originalWebhook = await request.get(`/webhook/find/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey },
    }).then((r) => r.json());

    const setWebhookResponse = await request.post(`/webhook/set/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey, 'Content-Type': 'application/json' },
      data: {
        webhook: {
          enabled: true,
          url: `http://127.0.0.1:${receiverPort}/webhook`,
          events: ['messages.upsert'],
          webhookBase64: false,
          webhookByEvents: true,
        },
      },
    });
    expect(setWebhookResponse.status()).toBe(200);
    suiteReady = true;
  });

  test.afterAll(async ({ request }) => {
    if (resolvedInstance && connectedInstanceKey && originalWebhook) {
      await request.post(`/webhook/set/${resolvedInstance}`, {
        headers: { apikey: connectedInstanceKey, 'Content-Type': 'application/json' },
        data: { webhook: originalWebhook },
      }).catch(() => {});
    }

    await new Promise<void>((resolve) => {
      receiverServer?.close(() => resolve());
    });
  });

  test('deve entregar connection.update para receiver local após logout/connect', async ({ request }) => {
    test.skip(!suiteReady, 'Nenhuma instância conectada disponível para a suíte real.');

    payloadPromise = new Promise((resolve) => {
      payloadResolve = resolve;
    });

    const logoutResponse = await request.delete(`/instance/logout/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey },
      timeout: 30_000,
    });
    expect(logoutResponse.status()).toBe(200);

    const connectResponse = await request.get(`/instance/connect/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey },
      timeout: 30_000,
    });
    expect(connectResponse.status()).toBe(200);

    const received = await Promise.race([
      payloadPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Webhook não chegou a tempo')), 30_000)),
    ]);

    expect(received.body.event).toBe('connection.update');
    expect(received.body.instance).toBe(resolvedInstance);
    expect(received.body.payload.status).toBeDefined();
  });
});
