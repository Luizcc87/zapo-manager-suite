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

  test('dashboard renders create, primary registration, refresh, instance actions, and disabled closed-instance test button', async ({ page }) => {
    await page.goto('/manager/');

    await expect(page.getByRole('heading', { name: /Instancias|Instâncias|Instances/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Instância$|^Instancia$|^Instance$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar como Primario|Registrar como Primário|Register as Primary/i })).toBeVisible();
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
            image: {
              url: 'https://httpbin.org/image/jpeg',
            },
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
        body: JSON.stringify({ code: 'local-qr-code' }),
      });
    });

    await page.goto('/manager/instance/ui-mobile-id/dashboard');

    await expect(page.getByRole('heading', { name: /UI Mobile/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar via SMS\/Voz|Registrar como Primario|Registrar como Primário|Register/i })).toBeVisible();
    await page.getByRole('button', { name: /QR Code/i }).click();
    await expect.poll(() => connectCalled).toBe(true);
  });
});
