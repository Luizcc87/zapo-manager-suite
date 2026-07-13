/**
 * Executable local contract for Zapo Manager endpoints.
 *
 * This suite is intentionally offline-safe: it creates a disconnected test
 * instance and validates auth, required fields, persistence endpoints, and the
 * message/interactive route surface without requiring WhatsApp connectivity.
 */

import { expect, test } from '@playwright/test';

import {
  createTestInstance,
  deleteTestInstance,
  GLOBAL_API_KEY,
  interactivePayloads,
  type TestInstance,
} from './helpers/manager-fixtures';

test.describe('Zapo Manager endpoint contract - offline-safe', () => {
  let instance: TestInstance;

  test.beforeAll(async ({ request }) => {
    instance = await createTestInstance(request, 'test-contract');
  });

  test.afterAll(async ({ request }) => {
    await deleteTestInstance(request, instance?.name);
  });

  test('server root and credential verification expose manager metadata', async ({ request }) => {
    const root = await request.get('/');
    expect(root.status()).toBe(200);
    const info = await root.json();
    expect(info.version).toBeDefined();
    expect(info.clientName).toBe('zapo-manager');

    const creds = await request.post('/verify-creds', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(creds.status()).toBe(200);
    const credsBody = await creds.json();
    expect(credsBody.facebookAppId).toBeDefined();
    expect(credsBody.facebookConfigId).toBeDefined();
    expect(credsBody.facebookUserToken).toBeDefined();
  });

  test('instance lifecycle endpoints respond with the expected offline states', async ({ request }) => {
    const byName = await request.get(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance.name)}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(byName.status()).toBe(200);
    const instances = await byName.json();
    expect(instances).toHaveLength(1);
    expect(instances[0].name).toBe(instance.name);
    expect(instances[0].connectionStatus).toBe('close');
    expect(['web', 'mobile', 'primary']).toContain(instances[0].instanceType);

    const state = await request.get(`/instance/connectionState/${instance.name}`, {
      headers: { apikey: instance.token },
    });
    expect(state.status()).toBe(200);
    const stateBody = await state.json();
    expect(stateBody.instance.instanceName).toBe(instance.name);
    expect(stateBody.instance.state).toBe('close');
  });

  test('settings, webhook, proxy, chat, and contact routes are callable with instance auth', async ({ request }) => {
    const settingsPayload = {
      rejectCall: true,
      msgCall: 'Nao aceitamos ligacoes.',
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: true,
      readStatus: true,
      syncFullHistory: false,
    };

    const settingsSet = await request.post(`/settings/set/${instance.name}`, {
      headers: { apikey: instance.token },
      data: settingsPayload,
    });
    expect(settingsSet.status()).toBe(200);
    expect(await settingsSet.json()).toMatchObject(settingsPayload);

    const webhookSet = await request.post(`/webhook/set/${instance.name}`, {
      headers: { apikey: instance.token },
      data: {
        webhook: {
          enabled: true,
          url: 'http://example.com/webhook',
          events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
          webhookBase64: false,
          webhookByEvents: true,
        },
      },
    });
    expect(webhookSet.status()).toBe(200);
    const webhook = await webhookSet.json();
    expect(webhook.enabled).toBe(true);
    expect(webhook.events).toContain('MESSAGES_UPSERT');

    const proxyDisabled = await request.post(`/proxy/set/${instance.name}`, {
      headers: { apikey: instance.token },
      data: { enabled: false, host: '', port: '', protocol: 'http' },
    });
    expect(proxyDisabled.status()).toBe(200);
    expect((await proxyDisabled.json()).enabled).toBe(false);

    const proxyStatus = await request.get(`/proxy/status/${instance.name}`, {
      headers: { apikey: instance.token },
    });
    expect(proxyStatus.status()).toBe(200);
    expect(await proxyStatus.json()).toMatchObject({ enabled: false, connected: false });

    const chats = await request.post(`/chat/findChats/${instance.name}`, {
      headers: { apikey: instance.token },
      data: { where: {} },
    });
    expect(chats.status()).toBe(200);
    expect(Array.isArray(await chats.json())).toBe(true);

    const messages = await request.post(`/chat/findMessages/${instance.name}`, {
      headers: { apikey: instance.token },
      data: { where: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } },
    });
    expect(messages.status()).toBe(200);
    expect((await messages.json()).messages.records).toBeDefined();

    const contacts = await request.get(`/contact/find/${instance.name}`, {
      headers: { apikey: instance.token },
    });
    expect(contacts.status()).toBe(200);
    expect(Array.isArray(await contacts.json())).toBe(true);
  });

  test('all interactive message endpoints pass validation and stop at disconnected state', async ({ request }) => {
    for (const [name, fixture] of Object.entries(interactivePayloads)) {
      const response = await request.post(`/message/${fixture.endpoint}/${instance.name}`, {
        headers: { apikey: instance.token },
        data: fixture.payload,
      });

      expect(response.status(), `${name} should pass auth/body validation`).toBeGreaterThanOrEqual(500);
      expect(response.status(), `${name} should not fail auth or payload validation`).toBeLessThan(600);
      expect((await response.json()).error).toBeDefined();
    }
  });

  test('message routes reject the global key and validate required payload fields', async ({ request }) => {
    const strict = await request.post(`/message/sendText/${instance.name}`, {
      headers: { apikey: GLOBAL_API_KEY },
      data: { number: '5511999999999', text: 'deve falhar' },
    });
    expect(strict.status()).toBe(401);

    const requiredFieldChecks = [
      { endpoint: 'sendText', payload: { text: 'sem numero' }, error: 'number and text are required' },
      { endpoint: 'sendText', payload: { number: '5511999999999' }, error: 'number and text are required' },
      { endpoint: 'sendWhatsAppAudio', payload: { number: '5511999999999' }, error: 'number and audioMessage.audio (base64) are required' },
      { endpoint: 'sendMedia', payload: {}, error: 'number is required' },
      { endpoint: 'sendSticker', payload: {}, error: 'number is required' },
      { endpoint: 'sendButtons', payload: {}, error: 'number is required' },
      { endpoint: 'sendList', payload: {}, error: 'number is required' },
      { endpoint: 'sendCarousel', payload: {}, error: 'number is required' },
    ];

    for (const check of requiredFieldChecks) {
      const response = await request.post(`/message/${check.endpoint}/${instance.name}`, {
        headers: { apikey: instance.token },
        data: check.payload,
      });
      expect(response.status(), check.endpoint).toBe(400);
      expect((await response.json()).error).toBe(check.error);
    }
  });

  test('companion and email routes expose stable validation for inactive sessions', async ({ request }) => {
    const missingInstance = `missing-${instance.name}`;
    const runtimeRoutes = [
      { method: 'get', path: `/instance/companion/list/${missingInstance}` },
      { method: 'delete', path: `/instance/companion/revoke-all/${missingInstance}` },
      { method: 'post', path: `/instance/companion/reconcile/${missingInstance}` },
      { method: 'get', path: `/instance/email/status/${missingInstance}` },
      { method: 'post', path: `/instance/email/confirm/${missingInstance}` },
    ] as const;

    for (const route of runtimeRoutes) {
      const response = await request[route.method](route.path, { timeout: 5_000 });
      expect(response.status(), route.path).toBe(404);
      expect((await response.json()).error).toContain('not found or not connected');
    }

    const badCompanionMode = await request.post(`/instance/companion/link/${instance.name}`, {
      data: { mode: 'bad', value: 'x' },
    });
    expect(badCompanionMode.status()).toBe(400);

    const missingRevokeDevice = await request.delete(`/instance/companion/revoke/${instance.name}`, {
      data: {},
    });
    expect(missingRevokeDevice.status()).toBe(400);

    const missingEmail = await request.post(`/instance/email/set/${instance.name}`, {
      data: {},
    });
    expect(missingEmail.status()).toBe(400);

    const missingLocale = await request.post(`/instance/email/request-code/${instance.name}`, {
      data: { languageCode: 'pt' },
    });
    expect(missingLocale.status()).toBe(400);

    const missingCode = await request.post(`/instance/email/verify-code/${instance.name}`, {
      data: {},
    });
    expect(missingCode.status()).toBe(400);
  });
});
