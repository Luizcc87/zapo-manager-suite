import fs from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

const envFile = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const envGlobalKey = envFile.match(/^GLOBAL_API_KEY=(.+)$/m)?.[1]?.trim();

export const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || envGlobalKey || 'global_key';
export const LOCAL_API_URL = process.env.PLAYWRIGHT_API_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
export const LOCAL_UI_URL = process.env.PLAYWRIGHT_UI_URL || 'http://127.0.0.1:5173';

export const tmpName = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type TestInstance = {
  id: string;
  name: string;
  token: string;
};

export async function createTestInstance(request: APIRequestContext, prefix = 'test-manager'): Promise<TestInstance> {
  const instanceName = tmpName(prefix);
  const response = await request.post(`${LOCAL_API_URL}/instance/create`, {
    headers: { apikey: GLOBAL_API_KEY },
    data: { instanceName },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();

  return {
    id: body.instance.instanceId,
    name: body.instance.instanceName,
    token: body.instance.apikey,
  };
}

export async function deleteTestInstance(request: APIRequestContext, instanceName?: string) {
  if (!instanceName) return;
  await request.delete(`${LOCAL_API_URL}/instance/delete/${instanceName}`, {
    headers: { apikey: GLOBAL_API_KEY },
  });
}

export const targetNumber = process.env.TEST_TARGET_NUMBER || '5511999999999';

export const interactivePayloads = {
  text: {
    endpoint: 'sendText',
    payload: {
      number: targetNumber,
      text: 'Mensagem local de teste',
    },
  },
  buttonsReply: {
    endpoint: 'sendButtons',
    payload: {
      number: targetNumber,
      title: 'Resposta rapida',
      description: 'Escolha uma opcao',
      footer: 'Zapo Manager',
      buttons: [
        { type: 'reply', displayText: 'Confirmar', id: 'confirm' },
        { type: 'reply', displayText: 'Cancelar', id: 'cancel' },
      ],
    },
  },
  buttonsCta: {
    endpoint: 'sendButtons',
    payload: {
      number: targetNumber,
      title: 'CTA',
      description: 'Acoes externas',
      buttons: [
        { type: 'url', displayText: 'Abrir site', url: 'https://example.com' },
        { type: 'copy', displayText: 'Copiar codigo', copyCode: 'ABC-123' },
      ],
    },
  },
  buttonsPix: {
    endpoint: 'sendButtons',
    payload: {
      number: targetNumber,
      title: 'PIX',
      description: 'Copiar chave PIX',
      buttons: [
        { type: 'pix', displayText: 'Copiar PIX', name: 'Teste', keyType: 'random', key: 'abc123' },
      ],
    },
  },
  list: {
    endpoint: 'sendList',
    payload: {
      number: targetNumber,
      title: 'Lista',
      description: 'Escolha um item',
      footerText: 'Zapo Manager',
      buttonText: 'Ver opcoes',
      sections: [
        {
          title: 'Secao',
          rows: [
            { title: 'Item 1', description: 'Primeiro item', rowId: 'item_1' },
            { title: 'Item 2', description: 'Segundo item', rowId: 'item_2' },
          ],
        },
      ],
    },
  },
  carousel: {
    endpoint: 'sendCarousel',
    payload: {
      number: targetNumber,
      body: 'Catalogo',
      cards: [
        {
          body: 'Produto A',
          footer: 'R$ 10',
          buttons: [{ type: 'url', displayText: 'Comprar', url: 'https://example.com/a' }],
        },
        {
          body: 'Produto B',
          footer: 'R$ 20',
          buttons: [{ type: 'reply', displayText: 'Quero', id: 'produto_b' }],
        },
      ],
    },
  },
};

export function makeUiInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ui-open-id',
    name: 'ui-open',
    connectionStatus: 'open',
    instanceType: 'web',
    mobileTransport: false,
    webhookEnabled: true,
    softwareVersion: '2.3000.0',
    deviceInfo: null,
    ownerJid: '5511999999999@s.whatsapp.net',
    profileName: 'UI Open',
    profilePicUrl: '',
    integration: 'WHATSAPP-BAILEYS',
    number: '5511999999999',
    businessId: '',
    token: 'ui_instance_key',
    clientName: 'zapo-manager',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    proxyEnabled: true,
    proxyConnected: true,
    proxyError: null,
    operational: {
      contactCount: 3,
      historyPersistence: {
        mode: 'database',
        messagesEnabled: true,
        warning: null,
      },
      chatStats: {
        total: 2,
        lastUpdatedAt: new Date('2026-01-02T12:30:00.000Z').toISOString(),
        lastRemoteJid: '5511988887777@s.whatsapp.net',
      },
      lastActivityAt: new Date('2026-01-02T12:30:00.000Z').toISOString(),
      proxyHealth: {
        severity: 'ok',
        reason: null,
      },
      connectionDetails: {
        registered: true,
        hasActiveClient: true,
        hasQrCode: false,
        ownerJid: '5511999999999@s.whatsapp.net',
        lastKnownStatus: 'connected',
      },
    },
    Setting: {
      rejectCall: false,
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    },
    _count: { Message: 2, Contact: 1, Chat: 1 },
    ...overrides,
  };
}

export async function seedAuthenticatedUi(page: Page) {
  await page.addInitScript(({ apiUrl, globalKey }) => {
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('token', globalKey);
    localStorage.setItem('version', '1.0.0');
    localStorage.setItem('provider', 'zapo');
    localStorage.setItem('clientName', 'zapo-manager');
    localStorage.setItem('i18nextLng', 'pt-BR');
  }, { apiUrl: LOCAL_API_URL, globalKey: GLOBAL_API_KEY });
}

export async function mockManagerApi(page: Page, instances = [makeUiInstance()]) {
  await page.route(`${LOCAL_API_URL}/`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.0',
        clientName: 'zapo-manager',
        zapoVersion: '1.5.0',
        defaultLanguage: 'pt-BR',
      }),
    });
  });

  await page.route(`${LOCAL_API_URL}/verify-creds`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route(`${LOCAL_API_URL}/instance/fetchInstances**`, async (route) => {
    const url = new URL(route.request().url());
    const instanceId = url.searchParams.get('instanceId');
    const filtered = instanceId ? instances.filter((instance) => instance.id === instanceId) : instances;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(filtered) });
  });

  await page.route(`${LOCAL_API_URL}/instance/runtime-stats/**`, async (route) => {
    const instanceName = route.request().url().split('/').pop() || 'ui-open';
    const matchedInstance = instances.find((instance) => instance.name === instanceName);
    const databaseEnabled = (matchedInstance as any)?.operational?.historyPersistence?.messagesEnabled ?? true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceName,
        connected: true,
        memoryChats: 1,
        memoryMessages: 2,
        databaseMessages: databaseEnabled ? 2 : 0,
        databaseEnabled,
      }),
    });
  });

  await page.route(`${LOCAL_API_URL}/instance/events/**`, async (route) => {
    const instanceName = route.request().url().split('/').filter(Boolean).at(-1) || 'ui-open';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceName,
        events: [
          {
            id: 'ui-event-critical',
            instanceName,
            type: 'mobile_account_takeover_notice',
            severity: 'critical',
            title: 'Tentativa de takeover detectada',
            summary: 'Novo dispositivo: Android desconhecido',
            details: {},
            readAt: null,
            createdAt: new Date('2026-01-02T13:30:00.000Z').toISOString(),
          },
        ],
      }),
    });
  });

  await page.route(`${LOCAL_API_URL}/instance/events-summary/**`, async (route) => {
    const instanceName = route.request().url().split('/').filter(Boolean).at(-1)?.split('?')[0] || 'ui-open';
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'sent', instanceName, days: 7 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceName,
        days: 7,
        since: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        total: 3,
        unreadCount: 1,
        severity: {
          info: 0,
          warning: 1,
          critical: 2,
        },
        topTypes: [
          { type: 'mobile_account_takeover_notice', count: 2 },
          { type: 'connection.disconnected', count: 1 },
        ],
        lastCritical: {
          id: 'ui-event-critical',
          type: 'mobile_account_takeover_notice',
          title: 'Tentativa de takeover detectada',
          summary: 'Novo dispositivo: Android desconhecido',
          createdAt: new Date('2026-01-02T13:30:00.000Z').toISOString(),
          readAt: null,
        },
      }),
    });
  });

  let savedNotificationChannel: any = null;
  await page.route(`${LOCAL_API_URL}/notification/channels/**`, async (route) => {
    const method = route.request().method();
    const parts = route.request().url().split('/').filter(Boolean);
    const instanceName = parts.at(-1) || 'ui-open';

    if (method === 'POST') {
      if (parts.at(-1) === 'test') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'sent', channelId: parts.at(-2) || 'ui-telegram-channel' }),
        });
        return;
      }

      const payload = route.request().postDataJSON();
      savedNotificationChannel = {
        id: 'ui-telegram-channel',
        instanceName,
        type: 'telegram',
        name: payload.name || 'Telegram',
        enabled: payload.enabled ?? true,
        config: {
          botToken: '********',
          chatId: payload.config?.chatId || '123',
        },
        events: payload.events || [],
        createdAt: new Date('2026-01-02T13:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-02T13:00:00.000Z').toISOString(),
      };
      await route.fulfill({
        status: parts.length > 0 && parts.at(-2) === 'channels' ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify(savedNotificationChannel),
      });
      return;
    }

    if (method === 'DELETE') {
      savedNotificationChannel = null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', channelId: 'ui-telegram-channel' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ instanceName, channels: savedNotificationChannel ? [savedNotificationChannel] : [] }),
    });
  });

  await page.route(`${LOCAL_API_URL}/message/**`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accepted: true,
        key: { id: 'ui-message-id', remoteJid: `${targetNumber}@s.whatsapp.net`, fromMe: true },
        messageTimestamp: Math.floor(Date.now() / 1000),
        status: 'PENDING',
      }),
    });
  });

  await page.route(`${LOCAL_API_URL}/settings/find/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rejectCall: false,
        msgCall: '',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      }),
    });
  });

  await page.route(`${LOCAL_API_URL}/webhook/find/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, url: '', events: [], webhookBase64: false, webhookByEvents: false }),
    });
  });

  await page.route(`${LOCAL_API_URL}/proxy/status/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, connected: true, protocol: 'http', proxyUrl: 'http://proxy.local:8080' }),
    });
  });
}
