import http from 'node:http';
import { expect, test } from '@playwright/test';

import {
  createFakeMobilePrimaryClient,
  pairManagerClientWithQr,
  startFakeWaServer,
  type FakeServerHarness,
} from './helpers/fake-server-setup';
import { createStore, WaClient } from '../backend/node_modules/zapo-js';
import {
  createTestInstance,
  deleteTestInstance,
  GLOBAL_API_KEY,
  type TestInstance,
} from './helpers/manager-fixtures';

async function waitForQr(request: any, instance: TestInstance): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await request.get(`/instance/connect/${instance.name}`, {
      headers: { apikey: instance.token },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    if (body.code) return body.code;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`QR fake nao gerado para ${instance.name}`);
}

async function waitForConnected(request: any, instance: TestInstance) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await request.get(`/instance/connectionState/${instance.name}`, {
      headers: { apikey: instance.token },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    if (body.instance?.state === 'open') return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Instancia fake nao conectou: ${instance.name}`);
}

async function startWebhookReceiver() {
  const received: any[] = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      received.push(JSON.parse(raw || '{}'));
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Webhook receiver sem porta TCP');

  return {
    url: `http://127.0.0.1:${address.port}/webhook`,
    received,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test.describe.serial('Zapo Manager smoke fake - offline end-to-end', () => {
  let fake: FakeServerHarness;
  let instance: TestInstance | undefined;

  test.beforeAll(async () => {
    fake = await startFakeWaServer();
  });

  test.afterAll(async ({ request }) => {
    await deleteTestInstance(request, instance?.name);
    await fake?.stop();
  });

  test('envia e recebe mensagens contra FakeWaServer sem WhatsApp real', async ({ request }) => {
    instance = await createTestInstance(request, 'smoke-fake');
    const qr = await waitForQr(request, instance);
    const pipeline = await pairManagerClientWithQr(fake.server, qr, '5511999000000:1@s.whatsapp.net');
    await waitForConnected(request, instance);

    const peer = await fake.server.createFakePeer({ jid: '5511888000000@s.whatsapp.net' }, pipeline);
    const outbound = await request.post(`/message/sendText/${instance.name}`, {
      headers: { apikey: instance.token },
      data: { number: '5511888000000', text: 'smoke fake outbound' },
    });
    expect(outbound.status()).toBe(201);
    const receivedByPeer = await peer.expectMessage({ timeoutMs: 10_000 });
    expect(receivedByPeer.message.conversation).toBe('smoke fake outbound');

    const receiver = await startWebhookReceiver();
    try {
      const webhook = await request.post(`/webhook/set/${instance.name}`, {
        headers: { apikey: instance.token },
        data: {
          webhook: {
            enabled: true,
            url: receiver.url,
            events: ['MESSAGES_UPSERT'],
            webhookBase64: false,
            webhookByEvents: true,
          },
        },
      });
      expect(webhook.status()).toBe(200);

      await peer.sendConversation('smoke fake inbound', { id: 'fake-inbound-1' });
      await expect.poll(() => receiver.received.length, { timeout: 10_000 }).toBeGreaterThan(0);
      expect(JSON.stringify(receiver.received[0])).toContain('smoke fake inbound');
    } finally {
      await receiver.stop();
    }
  });

  test('gera pairing code de 8 digitos via handshake fake', async ({ request }) => {
    const pairingInstance = await createTestInstance(request, 'smoke-fake-pairing');
    try {
      const response = await request.get(`/instance/connect/${pairingInstance.name}?number=5511999000000`, {
        headers: { apikey: pairingInstance.token },
        timeout: 20_000,
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(String(body.pairingCode || body.code)).toMatch(/^\d{8}$/);
    } finally {
      await deleteTestInstance(request, pairingInstance.name);
    }
  });

  test('logout limpa sessao e permite reconectar sem restart do backend', async ({ request }) => {
    test.skip(!instance, 'Teste de reconexao depende da instancia pareada no smoke anterior.');

    const logout = await request.delete(`/instance/logout/${instance!.name}`, {
      headers: { apikey: instance!.token },
    });
    expect(logout.status()).toBe(200);

    const state = await request.get(`/instance/connectionState/${instance!.name}`, {
      headers: { apikey: instance!.token },
    });
    expect(state.status()).toBe(200);
    expect((await state.json()).instance.state).toBe('close');

    const reconnect = await request.get(`/instance/connect/${instance!.name}`, {
      headers: { apikey: instance!.token },
    });
    expect(reconnect.status()).toBe(200);
  });

  test('companion hosting vincula e revoga companion com FakeMobilePrimary', async () => {
    const companionStore = createStore({});
    const companion = new WaClient({
      store: companionStore,
      sessionId: 'fake-companion-session',
      chatSocketUrls: [fake.server.url],
      testHooks: { noiseRootCa: fake.server.noiseRootCa },
    });
    const { client: primary } = await createFakeMobilePrimaryClient(fake.server, 'fake-primary-session', '5511999000000');

    try {
      let companionQr = '';
      companion.on('auth_qr', ({ qr }) => { companionQr = qr; });
      const companionPipelinePromise = fake.server.waitForAuthenticatedPipeline(10_000);
      void companion.connect();
      const companionPipeline = await companionPipelinePromise;
      await fake.server.offerCompanionPairing(companionPipeline);
      await expect.poll(() => companionQr, { timeout: 10_000 }).not.toBe('');

      void primary.connect();
      await fake.server.waitForNextAuthenticatedPipeline(10_000);
      const linked = await primary.mobile.linkCompanion(companionQr);
      expect(linked.deviceJid).toContain('@s.whatsapp.net');
      expect(fake.server.companionHost.linkedCompanions()).toHaveLength(1);

      await primary.mobile.revokeCompanion(linked.deviceJid);
      expect(fake.server.companionHost.linkedCompanions()).toHaveLength(0);
    } finally {
      await Promise.allSettled([companion.disconnect(), primary.disconnect()]);
    }
  });
});
