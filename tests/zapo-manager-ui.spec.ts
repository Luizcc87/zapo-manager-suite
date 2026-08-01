/**
 * Frontend manager smoke tests with a mocked local API.
 *
 * Run with tests/playwright/manager-ui.config.ts. These tests validate visible
 * buttons and the manager-facing client functions without requiring a real
 * WhatsApp session or live backend.
 */

import { expect, test } from '@playwright/test';

import {
  LOCAL_API_URL,
  makeUiInstance,
  mockManagerApi,
  seedAuthenticatedUi,
  targetNumber,
} from './helpers/manager-fixtures';

test.describe('Zapo Manager frontend controls - mocked API', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedUi(page);
    await mockManagerApi(page, [
      makeUiInstance(),
      makeUiInstance({
        id: 'ui-closed-id',
        name: 'ui-closed',
        profileName: 'UI Closed',
        connectionStatus: 'close',
        proxyEnabled: false,
        webhookEnabled: false,
        token: 'ui_closed_key',
      }),
    ]);
  });

  test('dashboard renders create, refresh, instance actions, and disabled closed-instance test button', async ({ page }) => {
    await page.goto('/manager/');

    await expect(page.getByRole('heading', { name: /Instancias|Instâncias|Instances/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Instância$|^Instancia$|^Instance$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Atualizar|Refresh/i })).toBeVisible();
    await expect(page.getByText('UI Open')).toBeVisible();
    await expect(page.getByText('UI Closed')).toBeVisible();

    await expect(page.locator('button[title="Testar mensagens interativas"]')).toBeEnabled();
    await expect(page.locator('button[title="Disponivel apenas com a instancia conectada"], button[title="Disponível apenas com a instância conectada"]')).toBeDisabled();
  });

  test('interactive modal sends text, link preview, reply, CTA, PIX, list, and carousel to the expected endpoints', async ({ page }) => {
    const requests: { url: string; payload: unknown }[] = [];
    await page.route(`${LOCAL_API_URL}/message/**`, async (route) => {
      const request = route.request();
      requests.push({ url: request.url(), payload: request.postDataJSON() });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: true,
          key: { id: `ui-message-${requests.length}`, remoteJid: `${targetNumber}@s.whatsapp.net`, fromMe: true },
          messageTimestamp: Math.floor(Date.now() / 1000),
          status: 'PENDING',
        }),
      });
    });

    await page.goto('/manager/');
    await page.locator('button[title="Testar mensagens interativas"]').click();

    const expectedTabs = [
      { tab: 'Texto', endpoint: '/message/sendText/ui-open' },
      { tab: 'Link Preview', endpoint: '/message/sendText/ui-open' },
      { tab: 'Reply', endpoint: '/message/sendButtons/ui-open' },
      { tab: 'CTA', endpoint: '/message/sendButtons/ui-open' },
      { tab: 'PIX', endpoint: '/message/sendButtons/ui-open' },
      { tab: 'Lista', endpoint: '/message/sendList/ui-open' },
      { tab: 'Carrossel', endpoint: '/message/sendCarousel/ui-open' },
    ];

    for (const [index, expected] of expectedTabs.entries()) {
      const expectedCount = requests.length + 1;
      if (index > 0) {
        const activeTab = page.getByRole('tab', { selected: true });
        await activeTab.focus();
        await activeTab.press('ArrowRight');
      }
      await expect(page.getByRole('tab', { name: expected.tab })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(`POST ${expected.endpoint}`)).toBeVisible();
      await page.locator('#ti-number').fill(targetNumber);
      await page.getByRole('button', { name: 'Enviar' }).click();
      await expect.poll(() => requests.length).toBe(expectedCount);
      const last = requests.at(-1)!;
      expect(last.url).toContain(expected.endpoint);
      expect(last.payload).toMatchObject({ number: targetNumber });
      if (expected.tab === 'Link Preview') {
        expect(last.payload).toMatchObject({
          textMessage: {
            text: expect.stringContaining('https://meli.la/2MU3MXd'),
          },
          linkPreview: true,
          linkPreviewHighQuality: true,
          preview: {
            url: 'https://meli.la/2MU3MXd',
          },
        });
      }

      if (expected !== expectedTabs.at(-1)) {
        await page.locator('button[title="Testar mensagens interativas"]').click();
      }
    }

    expect(requests).toHaveLength(expectedTabs.length);
  });

  test('instance dashboard calls fetch, connect, and proxy status functions from visible buttons', async ({ page }) => {
    await mockManagerApi(page, [
      makeUiInstance({
        id: 'ui-mobile-id',
        name: 'ui-mobile',
        profileName: 'UI Mobile',
        connectionStatus: 'close',
        instanceType: 'mobile',
        mobileTransport: true,
        token: 'ui_mobile_key',
      }),
    ]);

    let connectCalled = false;
    await page.route(`${LOCAL_API_URL}/instance/connect/ui-mobile**`, async (route) => {
      connectCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '2@local-qr-code,local-ref,local-key,local-secret,1', count: 0 }),
      });
    });

    await page.goto('/manager/instance/ui-mobile-id/dashboard');

    await expect(page.getByRole('heading', { name: /UI Mobile/i })).toBeVisible();
    await expect(page.getByText(/Última atividade|Ultima atividade|Last activity/i)).toBeVisible();
    await expect(page.getByText(/Persistência de mensagens|Persistencia de mensagens|Message storage/i)).toBeVisible();
    await expect(page.getByText(/Banco de dados|Database/i)).toBeVisible();
    await expect(page.locator('section').getByText(/^(Conexão|Conexao|Connection)$/i).first()).toBeVisible();
    await expect(page.locator('section').getByText(/^Proxy$/i).first()).toBeVisible();
    await expect(page.getByText(/^Conectado$|^Connected$/i).first()).toBeVisible();
    await expect(page.getByText(/Eventos recentes|Recent events/i)).toBeVisible();
    await expect(page.getByText(/Resumo de eventos|Events summary/i)).toBeVisible();
    await expect(page.getByText(/Últimos 7 dias|Ultimos 7 dias|Last 7 days/i)).toBeVisible();
    await page.getByRole('button', { name: /Enviar resumo|Send summary/i }).click();
    await expect(page.getByText(/Tentativa de takeover detectada/i).first()).toBeVisible();
    await expect(page.getByText(/Canal Telegram|Telegram channel/i)).toHaveCount(0);
    await page.getByRole('tab', { name: /Diagnóstico|Diagnostico|Diagnostics/i }).click();
    await expect(page.getByText(/Diagnóstico do histórico|Diagnostico do historico|History diagnostics/i)).toBeVisible();
    await expect(page.getByText(/Mensagens em memória|Mensagens em memoria|Memory messages/i)).toBeVisible();
    await expect(page.getByText(/Detalhes técnicos|Detalhes tecnicos|Technical details/i)).toBeVisible();
    await expect(page.getByText(/Proxy operacional|Proxy operational/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar via SMS\/Voz|Registrar como Primario|Registrar como Primário|Register/i })).toBeVisible();
    await page.getByRole('button', { name: /QR Code/i }).click();
    await expect.poll(() => connectCalled).toBe(true);
    await expect(page.locator('svg').filter({ has: page.locator('path') }).first()).toBeVisible();
  });

  test('instance notifications settings configures telegram channel from configuration submenu', async ({ page }) => {
    await mockManagerApi(page, [
      makeUiInstance({
        id: 'ui-mobile-id',
        name: 'ui-mobile',
        profileName: 'UI Mobile',
        token: 'ui_mobile_key',
      }),
    ]);

    let savedPayload: any = null;
    let testCalled = false;
    await page.route(`${LOCAL_API_URL}/notification/channels/**`, async (route) => {
      if (route.request().method() === 'POST') {
        if (route.request().url().endsWith('/test')) {
          testCalled = true;
        }
        savedPayload = route.request().postDataJSON();
      }
      await route.fallback();
    });

    await page.goto('/manager/instance/ui-mobile-id/dashboard');
    await page.getByRole('button', { name: /Configurações|Configuracoes|Configurations/i }).click();
    await page.getByRole('link', { name: /Notificações|Notifications/i }).click();

    await expect(page.getByRole('heading', { name: /Notificações|Notifications/i })).toBeVisible();
    await expect(page.getByText(/Canal Telegram|Telegram channel/i)).toBeVisible();
    await expect(page.getByText(/Como funciona|How it works/i)).toBeVisible();
    await expect(page.getByText(/falha no teste do proxy|proxy test failure/i)).toBeVisible();
    await expect(page.getByText(/Enviar resumo|Send summary/i)).toBeVisible();
    await expect(page.getByText(/TELEGRAM_ALERT_CONNECTION_EVENTS=true/i)).toBeVisible();
    await expect(page.getByText(/Dados do bot|Bot details/i)).toBeVisible();
    await expect(page.getByText(/@BotFather/i)).toBeVisible();
    await expect(page.getByText(/Destino das notificações|Notification destination/i)).toBeVisible();
    await expect(page.getByText(/-100/i)).toBeVisible();
    await expect(page.getByText(/Não configurado|Nao configurado|Not configured/i)).toBeVisible();
    await page.getByLabel(/^Chat ID$/i).fill('123');
    await page.getByLabel(/Bot token/i).fill('secret-token');
    await page.getByRole('button', { name: /Salvar|Save/i }).click();

    await expect.poll(() => savedPayload).toMatchObject({
      type: 'telegram',
      enabled: true,
      config: {
        botToken: 'secret-token',
        chatId: '123',
      },
      events: expect.arrayContaining(['operational.summary']),
    });

    await expect(page.getByRole('button', { name: /Enviar teste|Send test/i })).toBeVisible();
    await page.getByRole('button', { name: /Enviar teste|Send test/i }).click();
    await expect.poll(() => testCalled).toBe(true);
  });

  test('instance dashboard renders memory history and critical proxy states', async ({ page }) => {
    await mockManagerApi(page, [
      makeUiInstance({
        id: 'ui-critical-id',
        name: 'ui-critical',
        profileName: 'UI Critical',
        connectionStatus: 'open',
        proxyEnabled: true,
        proxyConnected: false,
        proxyError: 'proxy_auth_407',
        token: 'ui_critical_key',
        operational: {
          contactCount: 0,
          historyPersistence: {
            mode: 'memory',
            messagesEnabled: false,
            warning: 'message_history_memory_only',
          },
          chatStats: {
            total: 0,
            lastUpdatedAt: null,
            lastRemoteJid: null,
          },
          lastActivityAt: null,
          proxyHealth: {
            severity: 'critical',
            reason: 'proxy_auth_407',
          },
          connectionDetails: {
            registered: true,
            hasActiveClient: true,
            hasQrCode: false,
            ownerJid: '5511999999999@s.whatsapp.net',
            lastKnownStatus: 'connected',
          },
        },
        _count: { Message: 0, Contact: 0, Chat: 0 },
      }),
    ]);

    await page.route(`${LOCAL_API_URL}/instance/events-summary/ui-critical**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          instanceName: 'ui-critical',
          days: 7,
          since: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          total: 0,
          unreadCount: 0,
          severity: {
            info: 0,
            warning: 0,
            critical: 0,
          },
          topTypes: [],
          lastCritical: null,
        }),
      });
    });

    await page.goto('/manager/instance/ui-critical-id/dashboard');

    await expect(page.getByRole('heading', { name: /UI Critical/i })).toBeVisible();
    await expect(page.getByText(/Sem atividade registrada|No activity/i)).toBeVisible();
    await expect(page.getByText(/Persistência de mensagens|Persistencia de mensagens|Message storage/i)).toBeVisible();
    await expect(page.locator('section').getByText(/^Memória$|^Memoria$|^Memory$/i).first()).toBeVisible();
    await expect(page.locator('section').getByText(/^Proxy$/i).first()).toBeVisible();
    await expect(page.getByText(/^Falhou$|^Failed$/i).first()).toBeVisible();
    await expect(page.getByText(/Falha na conexão do Proxy|Falha na conexao do Proxy|Proxy connection failed/i)).toBeVisible();
    await expect(page.getByText(/Autenticação do proxy recusada|Proxy authentication/i)).toBeVisible();
    await expect(page.getByText('proxy_auth_407', { exact: true })).toBeVisible();
    await expect(page.getByText(/Resumo de eventos|Events summary/i)).toBeVisible();
    await expect(page.getByText(/Nenhum evento registrado|No events/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar resumo|Send summary/i })).toBeDisabled();
    await page.getByRole('tab', { name: /Diagnóstico|Diagnostico|Diagnostics/i }).click();
    await expect(page.getByText(/Detalhes técnicos|Detalhes tecnicos|Technical details/i)).toBeVisible();
    await expect(page.getByText(/Somente memória|Somente memoria|Memory only/i)).toBeVisible();
    await expect(page.getByText(/Motivo do proxy|Proxy reason/i)).toBeVisible();
  });
});
